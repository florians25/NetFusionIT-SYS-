-- Position-based credits preserve whole original invoice lines. No quantity/price edits.
ALTER TABLE customer_credit_memos ADD COLUMN correction_mode text NOT NULL DEFAULT 'FULL' CHECK(correction_mode IN('FULL','POSITIONS'));
ALTER TABLE customer_credit_memos DROP CONSTRAINT customer_credit_memos_tenant_id_invoice_id_key;
ALTER TABLE customer_credit_memos DROP CONSTRAINT customer_credit_memos_status_check;
ALTER TABLE customer_credit_memos ADD CONSTRAINT customer_credit_memos_status_check CHECK(status IN('DRAFT','IN_REVIEW','APPROVED','REJECTED','POSTED','CANCELLED'));
CREATE UNIQUE INDEX customer_credit_one_open ON customer_credit_memos(tenant_id,invoice_id) WHERE status NOT IN('POSTED','CANCELLED');
CREATE TABLE customer_credit_lines(
 tenant_id uuid NOT NULL,credit_id uuid NOT NULL,invoice_item_id uuid NOT NULL,
 PRIMARY KEY(tenant_id,credit_id,invoice_item_id),
 FOREIGN KEY(tenant_id,credit_id) REFERENCES customer_credit_memos(tenant_id,id),
 FOREIGN KEY(tenant_id,invoice_item_id) REFERENCES invoice_items(tenant_id,id)
);
ALTER TABLE customer_credit_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_credit_lines FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON customer_credit_lines USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
CREATE TRIGGER customer_credit_lines_frozen BEFORE UPDATE OR DELETE ON customer_credit_lines FOR EACH ROW EXECUTE FUNCTION reject_attachment_mutation();

CREATE FUNCTION customer_credit_selection(t uuid,inv uuid,ids uuid[]) RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE i invoices;selected jsonb;taxes jsonb;net numeric(20,2);tax numeric(20,2);gross numeric(20,2);lines jsonb;
BEGIN
 SELECT * INTO STRICT i FROM invoices WHERE tenant_id=t AND id=inv;
 IF cardinality(ids)=0 OR cardinality(ids)>200 OR cardinality(ids)<>(SELECT count(DISTINCT x) FROM unnest(ids) x) OR EXISTS(SELECT 1 FROM unnest(ids) x WHERE NOT EXISTS(SELECT 1 FROM invoice_items ii WHERE ii.tenant_id=t AND ii.invoice_id=inv AND ii.id=x)) THEN RAISE EXCEPTION 'Eindeutige Originalpositionen dieser Rechnung wählen';END IF;
 WITH original AS (
  SELECT ii.*,row_number() OVER(ORDER BY ii.position) AS ordinal,
   round(sum(ii.net) OVER(PARTITION BY ii.tax_rate ORDER BY ii.position)*ii.tax_rate/100,2)-round((sum(ii.net) OVER(PARTITION BY ii.tax_rate ORDER BY ii.position)-ii.net)*ii.tax_rate/100,2) AS allocated_tax,
   (SELECT x FROM jsonb_array_elements(i.snapshot->'items') x WHERE (x->>'position')::int=ii.position) AS item
  FROM invoice_items ii WHERE ii.tenant_id=t AND ii.invoice_id=inv
 ) SELECT jsonb_agg(jsonb_build_object('id',id,'position',position,'ordinal',ordinal,'net',original.net::text,'tax',allocated_tax::text,'item',item) ORDER BY position),sum(original.net),sum(allocated_tax)
 INTO selected,net,tax FROM original WHERE id=ANY(ids);
 IF net IS NULL OR net<=0 OR EXISTS(SELECT 1 FROM jsonb_array_elements(selected) x WHERE x->'item' IS NULL OR (x->'item'->>'net')::numeric<>(x->>'net')::numeric) THEN RAISE EXCEPTION 'Passender positiver Originalpositionsstand fehlt';END IF;
 SELECT jsonb_agg(jsonb_build_object('rate',rate,'basis',basis::text,'amount',amount::text) ORDER BY rate::numeric) INTO taxes FROM (
  SELECT x->'item'->>'taxRate' AS rate,sum((x->>'net')::numeric)::numeric(20,2) AS basis,sum((x->>'tax')::numeric)::numeric(20,2) AS amount FROM jsonb_array_elements(selected) x GROUP BY 1
 ) q;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(taxes) x WHERE (x->>'amount')::numeric<>round((x->>'basis')::numeric*(x->>'rate')::numeric/100,2)) THEN RAISE EXCEPTION 'Positionsauswahl teilt einen ursprünglichen Steuerrundungscent; zusammenhängende Steuergruppe wählen. Separate Rundungskorrektur ist noch nicht freigegeben';END IF;
 -- Do not post a valid-looking subset that strands a non-representable tax cent in the remainder.
 IF EXISTS(WITH original AS (
  SELECT ii.id,ii.net,ii.tax_rate,round(sum(ii.net) OVER(PARTITION BY ii.tax_rate ORDER BY ii.position)*ii.tax_rate/100,2)-round((sum(ii.net) OVER(PARTITION BY ii.tax_rate ORDER BY ii.position)-ii.net)*ii.tax_rate/100,2) AS allocated_tax
  FROM invoice_items ii WHERE ii.tenant_id=t AND ii.invoice_id=inv
 ) SELECT 1 FROM original o WHERE NOT(o.id=ANY(ids)) AND NOT EXISTS(SELECT 1 FROM customer_credit_lines cl JOIN customer_credit_memos cm ON cm.tenant_id=cl.tenant_id AND cm.id=cl.credit_id WHERE cl.tenant_id=t AND cl.invoice_item_id=o.id AND cm.status<>'CANCELLED') GROUP BY o.tax_rate HAVING sum(o.allocated_tax)<>round(sum(o.net)*o.tax_rate/100,2)) THEN RAISE EXCEPTION 'Positionsauswahl hinterlässt einen nicht einzeln korrigierbaren Steuerrundungscent; zusammenhängende Steuergruppe wählen';END IF;
 gross=net+tax;
 WITH amounts AS (
  SELECT 10 AS position,gross AS amount
  UNION ALL SELECT ((x->>'ordinal')::int+1)*10,(x->>'net')::numeric FROM jsonb_array_elements(selected) x
  UNION ALL SELECT e.position,(x->>'amount')::numeric FROM jsonb_array_elements(taxes) x JOIN journal_entries e ON e.tenant_id=t AND e.journal_id=i.journal_id AND e.tax_code='VAT_'||(x->>'rate') WHERE (x->>'amount')::numeric>0
 ) SELECT jsonb_agg(jsonb_build_object('position',e.position,'accountId',e.account_id,'code',a.code,'name',a.name,'side',e.side,'amount',q.amount::numeric(20,2)::text,'description',e.description,'costCenter',e.cost_center,'partnerId',e.partner_id,'taxCode',e.tax_code) ORDER BY e.position) INTO lines
 FROM amounts q JOIN journal_entries e ON e.tenant_id=t AND e.journal_id=i.journal_id AND e.position=q.position JOIN gl_accounts a ON a.tenant_id=e.tenant_id AND a.id=e.account_id;
 IF (SELECT sum(CASE x->>'side' WHEN 'DEBIT' THEN (x->>'amount')::numeric ELSE -(x->>'amount')::numeric END) FROM jsonb_array_elements(lines) x)<>0 OR jsonb_array_length(lines)<2 THEN RAISE EXCEPTION 'Ursprüngliche Gegenkontierung der Auswahl ist unvollständig';END IF;
 RETURN jsonb_build_object('invoiceItemIds',(SELECT jsonb_agg(x->'id' ORDER BY (x->>'position')::int) FROM jsonb_array_elements(selected) x),'items',(SELECT jsonb_agg(x->'item' ORDER BY (x->>'position')::int) FROM jsonb_array_elements(selected) x),'taxes',taxes,'net',net::text,'tax',tax::text,'gross',gross::text,'lines',lines);
END$$;

CREATE FUNCTION customer_credit_claim_guard() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE h customer_credit_memos;BEGIN
 IF TG_TABLE_NAME='customer_credit_lines' THEN
  SELECT * INTO STRICT h FROM customer_credit_memos WHERE tenant_id=NEW.tenant_id AND id=NEW.credit_id;
  IF h.sealed OR h.status NOT IN('DRAFT','REJECTED') OR h.correction_mode<>'POSITIONS' THEN RAISE EXCEPTION 'Nur offener Positionsgutschrift-Prüfstand erhält Originalpositionen';END IF;
 ELSE h=NEW;END IF;
 PERFORM 1 FROM company_codes WHERE tenant_id=h.tenant_id AND id=h.company_id FOR UPDATE;
 PERFORM 1 FROM invoices WHERE tenant_id=h.tenant_id AND id=h.invoice_id FOR UPDATE;
 IF TG_TABLE_NAME='customer_credit_memos' THEN IF TG_OP='UPDATE' THEN IF NEW.correction_mode<>OLD.correction_mode THEN RAISE EXCEPTION 'Gutschriftart ist unveränderlich';END IF;END IF;END IF;
 IF h.status='CANCELLED' THEN RETURN NEW;END IF;
 IF EXISTS(SELECT 1 FROM customer_credit_memos c WHERE c.tenant_id=h.tenant_id AND c.invoice_id=h.invoice_id AND c.id<>h.id AND c.status<>'CANCELLED' AND (h.correction_mode='FULL' OR c.correction_mode='FULL')) THEN RAISE EXCEPTION 'Vollständige Korrektur und Positionskorrekturen dürfen sich nicht überlappen';END IF;
 IF TG_TABLE_NAME='customer_credit_lines' THEN IF EXISTS(SELECT 1 FROM customer_credit_lines l JOIN customer_credit_memos c ON c.tenant_id=l.tenant_id AND c.id=l.credit_id WHERE l.tenant_id=h.tenant_id AND l.invoice_item_id=NEW.invoice_item_id AND l.credit_id<>h.id AND c.status<>'CANCELLED') THEN RAISE EXCEPTION 'Rechnungsposition bereits in anderer aktiver oder gebuchter Gutschrift gebunden';END IF;END IF;
 RETURN NEW;
END$$;
CREATE TRIGGER customer_credit_claim BEFORE INSERT OR UPDATE ON customer_credit_memos FOR EACH ROW EXECUTE FUNCTION customer_credit_claim_guard();
CREATE TRIGGER customer_credit_line_claim BEFORE INSERT ON customer_credit_lines FOR EACH ROW EXECUTE FUNCTION customer_credit_claim_guard();
CREATE INDEX customer_credit_line_invoice ON customer_credit_lines(tenant_id,invoice_item_id);

CREATE OR REPLACE VIEW customer_invoice_balances WITH(security_invoker=true) AS
 SELECT o.*, (o.amount-coalesce((SELECT sum(op.amount) FROM customer_credit_open_items op JOIN customer_credit_memos c ON c.tenant_id=op.tenant_id AND c.id=op.credit_id WHERE op.tenant_id=o.tenant_id AND op.invoice_id=o.invoice_id AND c.sealed),0))::numeric(20,2) AS balance,
 (SELECT c.id FROM customer_credit_memos c WHERE c.tenant_id=o.tenant_id AND c.invoice_id=o.invoice_id AND c.sealed ORDER BY c.posted_at DESC,c.id DESC LIMIT 1) AS credit_id,
 (SELECT max(c.posted_at) FROM customer_credit_memos c WHERE c.tenant_id=o.tenant_id AND c.invoice_id=o.invoice_id AND c.sealed) AS credited_at FROM invoice_open_items o;
CREATE OR REPLACE FUNCTION customer_invoice_effective(t uuid,inv uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS(SELECT 1 FROM customer_invoice_balances WHERE tenant_id=t AND invoice_id=inv AND balance>0) $$;
CREATE OR REPLACE FUNCTION direct_issue_financially_closed(t uuid,issue uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT NOT EXISTS(SELECT 1 FROM billing_request_lines l JOIN billing_requests r ON r.tenant_id=l.tenant_id AND r.id=l.request_id JOIN goods_issue_items gi ON gi.tenant_id=l.tenant_id AND gi.id=l.goods_issue_item_id WHERE l.tenant_id=t AND gi.issue_id=issue AND r.status NOT IN('CANCELLED','REJECTED') AND
 (l.quantity<>(SELECT coalesce(sum(ii.quantity),0) FROM invoice_items ii WHERE ii.tenant_id=l.tenant_id AND ii.request_line_id=l.id AND EXISTS(SELECT 1 FROM customer_credit_memos c WHERE c.tenant_id=ii.tenant_id AND c.invoice_id=ii.invoice_id AND c.sealed AND (c.correction_mode='FULL' OR EXISTS(SELECT 1 FROM customer_credit_lines cl WHERE cl.tenant_id=c.tenant_id AND cl.credit_id=c.id AND cl.invoice_item_id=ii.id))))))
$$;
CREATE OR REPLACE FUNCTION credit_op_consistent() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
 IF NOT EXISTS(SELECT 1 FROM customer_credit_memos h JOIN invoices i ON i.tenant_id=h.tenant_id AND i.id=h.invoice_id JOIN invoice_open_items o ON o.tenant_id=i.tenant_id AND o.invoice_id=i.id WHERE h.tenant_id=NEW.tenant_id AND h.id=NEW.credit_id AND h.sealed AND NEW.invoice_id=i.id AND NEW.company_id=i.company_id AND NEW.partner_id=i.partner_id AND NEW.account_id=o.account_id AND NEW.currency=i.currency AND NEW.amount=(h.prepared_snapshot->>'gross')::numeric) THEN RAISE EXCEPTION 'Debitoren-Gegenposten benötigt gebuchte passende Gutschrift';END IF;RETURN NULL;
END$$;

CREATE OR REPLACE FUNCTION validate_customer_credit() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE h customer_credit_memos;i invoices;j journals;original journals;d documents;source_lines jsonb;wanted_lines jsonb;selection jsonb;ids uuid[];expected_net numeric;expected_tax numeric;expected_gross numeric;expected_data jsonb;BEGIN
 IF TG_TABLE_NAME='journals' THEN
  SELECT * INTO h FROM customer_credit_memos WHERE tenant_id=NEW.tenant_id AND id=NEW.source_id;
  IF h.id IS NULL THEN
   IF EXISTS(SELECT 1 FROM invoices si WHERE si.tenant_id=NEW.tenant_id AND si.journal_id=NEW.reversal_of AND si.sealed) THEN RAISE EXCEPTION 'Ausgangsrechnungs-FI benötigt einen unabhängig freigegebene Gutschrift';END IF;
   RETURN NULL;
  END IF;
 ELSIF TG_TABLE_NAME='customer_credit_lines' THEN SELECT * INTO h FROM customer_credit_memos WHERE tenant_id=NEW.tenant_id AND id=NEW.credit_id;
 ELSE SELECT * INTO h FROM customer_credit_memos WHERE tenant_id=NEW.tenant_id AND id=NEW.id;END IF;
 SELECT * INTO i FROM invoices WHERE tenant_id=h.tenant_id AND id=h.invoice_id;
 SELECT * INTO d FROM documents WHERE tenant_id=h.tenant_id AND id=h.id;
 IF i.id IS NULL OR NOT i.sealed OR i.sales_order_id IS NULL OR h.company_id<>i.company_id OR d.kind<>'CREDIT_NOTE' OR d.organization_id<>(SELECT organization_id FROM documents WHERE tenant_id=i.tenant_id AND id=i.id) THEN RAISE EXCEPTION 'Passende gebuchte Ursprungsrechnung für Gutschrift fehlt';END IF;
 expected_net=i.net;expected_tax=i.tax;expected_gross=i.gross;
 IF h.correction_mode='POSITIONS' THEN
  SELECT array_agg(l.invoice_item_id ORDER BY ii.position) INTO ids FROM customer_credit_lines l JOIN invoice_items ii ON ii.tenant_id=l.tenant_id AND ii.id=l.invoice_item_id WHERE l.tenant_id=h.tenant_id AND l.credit_id=h.id AND ii.invoice_id=i.id;
  IF ids IS NULL OR cardinality(ids)<>(SELECT count(*) FROM customer_credit_lines WHERE tenant_id=h.tenant_id AND credit_id=h.id) THEN RAISE EXCEPTION 'Passende ausgewählte Originalpositionen fehlen';END IF;
  selection=customer_credit_selection(h.tenant_id,i.id,ids);
  IF selection IS DISTINCT FROM h.prepared_snapshot->'selection' THEN RAISE EXCEPTION 'Positionsauswahl und ursprüngliche Beträge sind inkonsistent';END IF;
  IF h.status<>'CANCELLED' AND EXISTS(SELECT 1 FROM customer_credit_lines l JOIN customer_credit_memos c ON c.tenant_id=l.tenant_id AND c.id=l.credit_id WHERE l.tenant_id=h.tenant_id AND l.invoice_item_id=ANY(ids) AND c.id<>h.id AND c.status<>'CANCELLED') THEN RAISE EXCEPTION 'Rechnungsposition bereits in anderer Gutschrift gebunden';END IF;
  expected_net=(selection->>'net')::numeric;expected_tax=(selection->>'tax')::numeric;expected_gross=(selection->>'gross')::numeric;
 END IF;
 IF NOT h.sealed THEN
  IF h.journal_id IS NOT NULL OR EXISTS(SELECT 1 FROM journals WHERE tenant_id=h.tenant_id AND source_id=h.id) THEN RAISE EXCEPTION 'Gegenbuchung benötigt vollständig gebuchte Gutschrift';END IF;RETURN NULL;
 END IF;
 SELECT * INTO original FROM journals WHERE tenant_id=h.tenant_id AND id=i.journal_id;
 SELECT * INTO j FROM journals WHERE tenant_id=h.tenant_id AND id=h.journal_id;
 IF original.id IS NULL OR original.status<>'POSTED' OR original.reversal_of IS NOT NULL OR j.id IS NULL OR j.status<>'POSTED' OR j.reversal_of IS DISTINCT FROM (CASE WHEN h.correction_mode='FULL' THEN original.id ELSE NULL END) OR j.source_id IS DISTINCT FROM h.id OR j.company_id<>i.company_id OR j.currency<>i.currency OR j.period_id<>h.period_id OR j.posting_date<>h.posting_date OR j.document_date<>h.document_date OR j.reason IS DISTINCT FROM (CASE WHEN h.correction_mode='FULL' THEN h.reason ELSE NULL END) THEN RAISE EXCEPTION 'Passender Original-/Gegen-Finanzbeleg fehlt';END IF;
 IF h.posting_date<i.posting_date OR h.document_date<i.invoice_date OR NOT EXISTS(SELECT 1 FROM fiscal_periods p WHERE p.tenant_id=h.tenant_id AND p.id=h.period_id AND p.company_id=h.company_id AND p.status='OPEN' AND h.posting_date BETWEEN p.date_from AND p.date_to) THEN RAISE EXCEPTION 'Offene passende Gutschriftperiode oder zulässiges Datum fehlt';END IF;
 IF h.reviewed_by IN(d.created_by,h.prepared_by) OR NOT EXISTS(SELECT 1 FROM approval_instances ai JOIN approval_decisions ad ON ad.tenant_id=ai.tenant_id AND ad.instance_id=ai.id JOIN users u ON u.tenant_id=ad.tenant_id AND u.id=ad.actor_id WHERE ai.tenant_id=h.tenant_id AND ai.document_id=h.id AND ai.status='APPROVED' AND ai.four_eyes AND ai.subject_version=h.version-2 AND ai.submitted_by<>h.reviewed_by AND ad.decision='APPROVE' AND ad.actor_id=h.reviewed_by AND ad.step=jsonb_array_length(ai.steps_snapshot)-1 AND ad.comment=h.review_note AND ad.context->>'preparedHash'=encode(sha256(convert_to(h.prepared_snapshot::text,'UTF8')),'hex') AND u.active AND u.role IN('ADMIN','ACCOUNTANT') AND EXISTS(SELECT 1 FROM user_organizations uo WHERE uo.tenant_id=u.tenant_id AND uo.user_id=u.id AND uo.organization_id=d.organization_id)) THEN RAISE EXCEPTION 'Unabhängige Gutschriftfreigabe zum unveränderten Prüfstand fehlt';END IF;
 IF h.snapshot-'review' IS DISTINCT FROM h.prepared_snapshot OR h.snapshot->'review'->>'actorId' IS DISTINCT FROM h.reviewed_by::text OR h.snapshot->'review'->>'note' IS DISTINCT FROM h.review_note OR h.reviewed_at IS NULL OR h.prepared_snapshot->>'id' IS DISTINCT FROM h.id::text OR h.prepared_snapshot->>'number' IS DISTINCT FROM d.number OR h.prepared_snapshot->>'invoiceId' IS DISTINCT FROM i.id::text OR h.prepared_snapshot->>'companyId' IS DISTINCT FROM i.company_id::text OR h.prepared_snapshot->>'periodId' IS DISTINCT FROM h.period_id::text OR h.prepared_snapshot->>'postingDate' IS DISTINCT FROM h.posting_date::text OR h.prepared_snapshot->>'documentDate' IS DISTINCT FROM h.document_date::text OR h.prepared_snapshot->>'reason' IS DISTINCT FROM h.reason OR h.prepared_snapshot->>'preparedBy' IS DISTINCT FROM h.prepared_by::text OR h.prepared_snapshot->'invoiceSnapshot' IS DISTINCT FROM i.snapshot OR h.prepared_snapshot->'sourceJournal'->>'id' IS DISTINCT FROM original.id::text OR h.prepared_snapshot->'sourceJournal'->>'hash' IS DISTINCT FROM original.content_hash THEN RAISE EXCEPTION 'Gutschrift-/Originalsnapshot passt nicht zum geprüften Gegenbeleg';END IF;
 IF h.prepared_snapshot->>'currency' IS DISTINCT FROM i.currency OR (h.prepared_snapshot->>'net')::numeric IS DISTINCT FROM expected_net OR (h.prepared_snapshot->>'tax')::numeric IS DISTINCT FROM expected_tax OR (h.prepared_snapshot->>'gross')::numeric IS DISTINCT FROM expected_gross OR (h.prepared_snapshot->>'preparedAt')::timestamptz IS DISTINCT FROM h.prepared_at OR h.prepared_snapshot->>'invoiceNumber' IS DISTINCT FROM (SELECT number FROM documents WHERE tenant_id=i.tenant_id AND id=i.id) OR h.prepared_snapshot->'sourceJournal'->>'number' IS DISTINCT FROM (SELECT number FROM documents WHERE tenant_id=original.tenant_id AND id=original.id) OR (h.snapshot->'review'->>'at')::timestamptz IS DISTINCT FROM date_trunc('milliseconds',h.reviewed_at) THEN RAISE EXCEPTION 'Gutschriftbeträge, Originalreferenzen oder Prüfzeitpunkte sind inkonsistent';END IF;
 SELECT jsonb_agg(jsonb_build_object('position',e.position,'accountId',e.account_id,'side',e.side,'amount',e.amount::text,'description',e.description,'costCenter',e.cost_center,'partnerId',e.partner_id,'taxCode',e.tax_code) ORDER BY e.position) INTO source_lines FROM journal_entries e WHERE e.tenant_id=h.tenant_id AND e.journal_id=original.id;
 IF (SELECT jsonb_agg(x-'code'-'name' ORDER BY (x->>'position')::int) FROM jsonb_array_elements(h.prepared_snapshot->'sourceJournal'->'lines') x) IS DISTINCT FROM source_lines THEN RAISE EXCEPTION 'Stornierter Kontierungsstand passt nicht zur Original-FI';END IF;
 wanted_lines=CASE WHEN h.correction_mode='POSITIONS' THEN selection->'lines' ELSE h.prepared_snapshot->'sourceJournal'->'lines' END;
 IF EXISTS((SELECT (x->>'accountId')::uuid,CASE x->>'side' WHEN 'DEBIT' THEN 'CREDIT' ELSE 'DEBIT' END,(x->>'amount')::numeric,x->>'costCenter',(x->>'partnerId')::uuid,x->>'taxCode',x->>'description' FROM jsonb_array_elements(wanted_lines) x EXCEPT ALL SELECT account_id,side,amount,cost_center,partner_id,tax_code,description FROM journal_entries WHERE tenant_id=h.tenant_id AND journal_id=j.id) UNION ALL (SELECT account_id,side,amount,cost_center,partner_id,tax_code,description FROM journal_entries WHERE tenant_id=h.tenant_id AND journal_id=j.id EXCEPT ALL SELECT (x->>'accountId')::uuid,CASE x->>'side' WHEN 'DEBIT' THEN 'CREDIT' ELSE 'DEBIT' END,(x->>'amount')::numeric,x->>'costCenter',(x->>'partnerId')::uuid,x->>'taxCode',x->>'description' FROM jsonb_array_elements(wanted_lines) x)) THEN RAISE EXCEPTION 'Gutschrift muss die ursprüngliche ausgewählte Kontierung exakt gegenbuchen';END IF;
 IF NOT EXISTS(SELECT 1 FROM invoice_open_items o WHERE o.tenant_id=h.tenant_id AND o.invoice_id=i.id AND o.amount=i.gross AND o.company_id=i.company_id AND o.partner_id=i.partner_id) THEN RAISE EXCEPTION 'Unbezahlter Originalposten fehlt';END IF;

 IF NOT EXISTS(SELECT 1 FROM customer_credit_open_items op JOIN invoice_open_items orig ON orig.tenant_id=op.tenant_id AND orig.invoice_id=op.invoice_id WHERE op.tenant_id=h.tenant_id AND op.credit_id=h.id AND op.invoice_id=i.id AND op.company_id=i.company_id AND op.partner_id=i.partner_id AND op.account_id=orig.account_id AND op.currency=i.currency AND op.amount=expected_gross) THEN RAISE EXCEPTION 'Gutschrift benötigt passenden Debitoren-Gegenposten';END IF;
 expected_data=i.snapshot||jsonb_build_object('documentType','CREDIT_NOTE','number',d.number,'date',h.document_date::text,'dueDate',h.document_date::text,'creditReason',h.reason,'documentContactLabel','Vertriebsmitarbeiter','originalInvoice',jsonb_build_object('number',i.snapshot->>'number','date',i.invoice_date::text),'seller',(i.snapshot->'seller')||jsonb_build_object('contact',h.prepared_snapshot->'creditData'->'seller'->'contact'));
 IF h.correction_mode='POSITIONS' THEN
  expected_data=expected_data||jsonb_build_object('items',selection->'items','taxes',selection->'taxes','net',selection->>'net','tax',selection->>'tax','gross',selection->>'gross','deliveryNumbers',(SELECT coalesce(jsonb_agg(DISTINCT x->>'deliveryNumber' ORDER BY x->>'deliveryNumber'),'[]'::jsonb) FROM jsonb_array_elements(selection->'items') x WHERE x->>'deliveryNumber' IS NOT NULL));
 END IF;
 IF h.prepared_snapshot->'creditData' IS DISTINCT FROM expected_data OR coalesce(length(trim(expected_data->'seller'->'contact'->>'firstName')),0)=0 OR coalesce(length(trim(expected_data->'seller'->'contact'->>'lastName')),0)=0 THEN RAISE EXCEPTION 'Gutschriftausgabe benötigt unveränderte ausgewählte Originalwerte und vollständigen Ansprechpartner';END IF;
 RETURN NULL;
END$$;

CREATE CONSTRAINT TRIGGER customer_credit_selected_lines_consistent AFTER INSERT ON customer_credit_lines DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_customer_credit();
