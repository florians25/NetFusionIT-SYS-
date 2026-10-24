-- Price-only credits consume monetary capacity, never physical return quantity.
ALTER TABLE customer_credit_memos DROP CONSTRAINT customer_credit_memos_correction_mode_check;
ALTER TABLE customer_credit_memos ADD CONSTRAINT customer_credit_memos_correction_mode_check CHECK(correction_mode IN('FULL','POSITIONS','QUANTITY','PRICE','RESIDUAL'));
ALTER TABLE customer_credit_lines ADD COLUMN net_amount numeric(20,2) CHECK(net_amount>0);
CREATE OR REPLACE FUNCTION customer_credit_amounts(t uuid,item uuid,exclude_credit uuid DEFAULT NULL,as_of date DEFAULT '9999-12-31') RETURNS TABLE(quantity numeric,net numeric,tax numeric) LANGUAGE sql STABLE AS $$
 WITH original AS (
 SELECT ii.*,round(sum(ii.net) OVER(PARTITION BY ii.invoice_id,ii.tax_rate ORDER BY ii.position)*ii.tax_rate/100,2)-round((sum(ii.net) OVER(PARTITION BY ii.invoice_id,ii.tax_rate ORDER BY ii.position)-ii.net)*ii.tax_rate/100,2) AS line_tax FROM invoice_items ii WHERE ii.tenant_id=t AND ii.invoice_id=(SELECT invoice_id FROM invoice_items WHERE tenant_id=t AND id=item)
 ) SELECT coalesce(sum(CASE WHEN h.correction_mode='PRICE' THEN 0 WHEN h.correction_mode='FULL' THEN o.quantity ELSE coalesce(cl.quantity,o.quantity) END),0),coalesce(sum(CASE WHEN h.correction_mode IN('QUANTITY','PRICE','RESIDUAL') THEN (a.value->>'net')::numeric ELSE o.net END),0),coalesce(sum(CASE WHEN h.correction_mode IN('QUANTITY','PRICE','RESIDUAL') THEN (a.value->>'tax')::numeric ELSE o.line_tax END),0)
 FROM original o JOIN customer_credit_memos h ON h.tenant_id=t AND h.invoice_id=o.invoice_id AND h.sealed AND h.id IS DISTINCT FROM exclude_credit AND h.posting_date<=as_of
 LEFT JOIN customer_credit_lines cl ON cl.tenant_id=h.tenant_id AND cl.credit_id=h.id AND cl.invoice_item_id=o.id
 LEFT JOIN LATERAL(SELECT x AS value FROM jsonb_array_elements(h.prepared_snapshot->'selection'->'allocations') x WHERE x->>'invoiceItemId'=o.id::text) a ON true
 WHERE o.id=item AND (h.correction_mode='FULL' OR cl.credit_id IS NOT NULL)
$$;
CREATE FUNCTION customer_credit_adjustment_selection(t uuid,inv uuid,credit uuid,choices jsonb,mode text) RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE i invoices;x jsonb;r record;prior record;q numeric(24,6);n numeric(20,2);tx numeric(20,2);unit_price numeric;remaining numeric;items jsonb='[]';allocations jsonb='[]';taxes jsonb;lines jsonb;ids uuid[]='{}';total_net numeric(20,2);total_tax numeric(20,2);gross numeric(20,2);
BEGIN
 SELECT * INTO STRICT i FROM invoices WHERE tenant_id=t AND id=inv;
 IF mode NOT IN('PRICE','RESIDUAL') OR jsonb_typeof(choices)<>'array' OR jsonb_array_length(choices) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Tatsächliche Originalpositionen und Korrekturbeträge wählen';END IF;
 FOR x IN SELECT e FROM jsonb_array_elements(choices) e ORDER BY (SELECT position FROM invoice_items WHERE tenant_id=t AND id=(e->>'invoiceItemId')::uuid) LOOP
  IF (x->>'invoiceItemId')::uuid=ANY(ids) THEN RAISE EXCEPTION 'Doppelte Originalposition';END IF;
  WITH original AS (
   SELECT ii.*,row_number() OVER(ORDER BY ii.position) AS ordinal,round(sum(ii.net) OVER(PARTITION BY ii.tax_rate ORDER BY ii.position)*ii.tax_rate/100,2)-round((sum(ii.net) OVER(PARTITION BY ii.tax_rate ORDER BY ii.position)-ii.net)*ii.tax_rate/100,2) AS line_tax,(SELECT e FROM jsonb_array_elements(i.snapshot->'items') e WHERE (e->>'position')::int=ii.position) AS item FROM invoice_items ii WHERE ii.tenant_id=t AND ii.invoice_id=inv
  ) SELECT o.*,coalesce(gi.serial,'') AS serial INTO r FROM original o JOIN billing_request_lines b ON b.tenant_id=t AND b.id=o.request_line_id LEFT JOIN goods_issue_items gi ON gi.tenant_id=b.tenant_id AND gi.id=b.goods_issue_item_id WHERE o.id=(x->>'invoiceItemId')::uuid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Originalposition dieser Rechnung fehlt';END IF;
  SELECT * INTO prior FROM customer_credit_amounts(t,r.id,credit);
  remaining=r.quantity-prior.quantity;
  IF mode='PRICE' THEN
   q=0;n=(x->>'netAmount')::numeric;unit_price=n;
  ELSE
   q=(x->>'quantity')::numeric;
   IF q IS NULL OR q<=0 OR q>remaining OR (r.serial<>'' AND q<>1) THEN RAISE EXCEPTION 'Restkorrektur überschreitet offene Originalmenge oder teilt Seriennummer';END IF;
   n=CASE WHEN q=remaining THEN r.net-prior.net ELSE round((r.net-prior.net)*q/remaining,2) END;
   unit_price=round(n/q,6);
  END IF;
  IF n IS NULL OR n<=0 OR n>r.net-prior.net OR (mode='RESIDUAL' AND round(unit_price*q,2)<>n) THEN RAISE EXCEPTION 'Korrektur überschreitet verbleibenden Originalwert oder ist nicht centgenau darstellbar';END IF;
  tx=round(r.line_tax*(prior.net+n)/r.net,2)-prior.tax;
  IF tx<0 OR tx>r.line_tax-prior.tax THEN RAISE EXCEPTION 'Verbleibende ursprüngliche Steuer überschritten';END IF;
  ids=array_append(ids,r.id);
  items=items||jsonb_build_array(r.item||jsonb_build_object('quantity',CASE WHEN mode='PRICE' THEN '1' ELSE q::text END,'unit',CASE WHEN mode='PRICE' THEN 'EA' ELSE r.item->>'unit' END,'unitNet',unit_price::text,'net',n::text,'description',CASE WHEN mode='PRICE' THEN 'Preiskorrektur ohne Mengenrücknahme: '|| (r.item->>'description') ELSE r.item->>'description' END));
  allocations=allocations||jsonb_build_array(jsonb_build_object('invoiceItemId',r.id,'position',r.position,'ordinal',r.ordinal,'quantity',q::text,'net',n::text,'tax',tx::text,'taxRate',r.item->>'taxRate','priorQuantity',prior.quantity::text,'priorNet',prior.net::text,'priorTax',prior.tax::text));
 END LOOP;
 SELECT jsonb_agg(jsonb_build_object('rate',rate,'basis',basis::text,'amount',amount::text) ORDER BY rate::numeric) INTO taxes FROM(SELECT a->>'taxRate' AS rate,sum((a->>'net')::numeric)::numeric(20,2) AS basis,sum((a->>'tax')::numeric)::numeric(20,2) AS amount FROM jsonb_array_elements(allocations) a GROUP BY 1) g;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(taxes) a WHERE (a->>'amount')::numeric<>round((a->>'basis')::numeric*(a->>'rate')::numeric/100,2)) THEN RAISE EXCEPTION 'Auswahl trennt einen nicht darstellbaren Steuerrundungscent';END IF;
 IF EXISTS(WITH original AS (
  SELECT ii.*,round(sum(ii.net) OVER(PARTITION BY ii.tax_rate ORDER BY ii.position)*ii.tax_rate/100,2)-round((sum(ii.net) OVER(PARTITION BY ii.tax_rate ORDER BY ii.position)-ii.net)*ii.tax_rate/100,2) AS line_tax FROM invoice_items ii WHERE ii.tenant_id=t AND ii.invoice_id=inv
 ) SELECT 1 FROM original o CROSS JOIN LATERAL customer_credit_amounts(t,o.id,credit) used LEFT JOIN LATERAL(SELECT a FROM jsonb_array_elements(allocations) a WHERE a->>'invoiceItemId'=o.id::text) chosen ON true GROUP BY o.tax_rate HAVING sum(o.line_tax-used.tax-coalesce((chosen.a->>'tax')::numeric,0))<>round(sum(o.net-used.net-coalesce((chosen.a->>'net')::numeric,0))*o.tax_rate/100,2)) THEN RAISE EXCEPTION 'Auswahl hinterlässt einen nicht darstellbaren Steuerrundungsrest';END IF;
 SELECT sum((a->>'net')::numeric),sum((a->>'tax')::numeric) INTO total_net,total_tax FROM jsonb_array_elements(allocations) a;gross=total_net+total_tax;
 WITH amounts AS(
 SELECT 10 AS position,gross AS amount UNION ALL SELECT ((a->>'ordinal')::int+1)*10,(a->>'net')::numeric FROM jsonb_array_elements(allocations) a
 UNION ALL SELECT e.position,(a->>'amount')::numeric FROM jsonb_array_elements(taxes) a JOIN journal_entries e ON e.tenant_id=t AND e.journal_id=i.journal_id AND e.tax_code='VAT_'||(a->>'rate') WHERE (a->>'amount')::numeric>0
 ) SELECT jsonb_agg(jsonb_build_object('position',e.position,'accountId',e.account_id,'code',g.code,'name',g.name,'side',e.side,'amount',v.amount::numeric(20,2)::text,'description',e.description,'costCenter',e.cost_center,'partnerId',e.partner_id,'taxCode',e.tax_code) ORDER BY e.position) INTO lines FROM amounts v JOIN journal_entries e ON e.tenant_id=t AND e.journal_id=i.journal_id AND e.position=v.position JOIN gl_accounts g ON g.tenant_id=e.tenant_id AND g.id=e.account_id;
 IF (SELECT sum(CASE a->>'side' WHEN 'DEBIT' THEN (a->>'amount')::numeric ELSE -(a->>'amount')::numeric END) FROM jsonb_array_elements(lines) a)<>0 OR jsonb_array_length(lines)<2 THEN RAISE EXCEPTION 'Ursprüngliche Gegenkontierung ist unvollständig';END IF;
 RETURN jsonb_build_object('invoiceItemIds',to_jsonb(ids),'allocations',allocations,'items',items,'taxes',taxes,'net',total_net::text,'tax',total_tax::text,'gross',gross::text,'lines',lines);
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
 IF i.id IS NULL OR NOT i.sealed OR coalesce(i.sales_order_id,i.order_id) IS NULL OR h.company_id<>i.company_id OR d.kind<>'CREDIT_NOTE' OR d.organization_id<>(SELECT organization_id FROM documents WHERE tenant_id=i.tenant_id AND id=i.id) THEN RAISE EXCEPTION 'Passende gebuchte Ursprungsrechnung für Gutschrift fehlt';END IF;
 expected_net=i.net;expected_tax=i.tax;expected_gross=i.gross;
 IF h.correction_mode IN('POSITIONS','QUANTITY','PRICE','RESIDUAL') THEN
  SELECT array_agg(l.invoice_item_id ORDER BY ii.position) INTO ids FROM customer_credit_lines l JOIN invoice_items ii ON ii.tenant_id=l.tenant_id AND ii.id=l.invoice_item_id WHERE l.tenant_id=h.tenant_id AND l.credit_id=h.id AND ii.invoice_id=i.id;
  IF ids IS NULL OR cardinality(ids)<>(SELECT count(*) FROM customer_credit_lines WHERE tenant_id=h.tenant_id AND credit_id=h.id) THEN RAISE EXCEPTION 'Passende ausgewählte Originalpositionen fehlen';END IF;
  IF h.correction_mode='QUANTITY' THEN
   selection=customer_credit_quantity_selection(h.tenant_id,i.id,h.id,(SELECT jsonb_agg(jsonb_build_object('invoiceItemId',l.invoice_item_id,'quantity',l.quantity::text) ORDER BY ii.position) FROM customer_credit_lines l JOIN invoice_items ii ON ii.tenant_id=l.tenant_id AND ii.id=l.invoice_item_id WHERE l.tenant_id=h.tenant_id AND l.credit_id=h.id));
  ELSIF h.correction_mode IN('PRICE','RESIDUAL') THEN
   selection=customer_credit_adjustment_selection(h.tenant_id,i.id,h.id,(SELECT jsonb_agg(jsonb_build_object('invoiceItemId',l.invoice_item_id,'quantity',l.quantity::text,'netAmount',l.net_amount::text) ORDER BY ii.position) FROM customer_credit_lines l JOIN invoice_items ii ON ii.tenant_id=l.tenant_id AND ii.id=l.invoice_item_id WHERE l.tenant_id=h.tenant_id AND l.credit_id=h.id),h.correction_mode);
  ELSE selection=customer_credit_selection(h.tenant_id,i.id,ids);END IF;
  IF selection IS DISTINCT FROM h.prepared_snapshot->'selection' THEN RAISE EXCEPTION 'Positionsauswahl und ursprüngliche Beträge sind inkonsistent';END IF;
  IF h.correction_mode='POSITIONS' AND h.status<>'CANCELLED' AND EXISTS(SELECT 1 FROM customer_credit_lines l JOIN customer_credit_memos c ON c.tenant_id=l.tenant_id AND c.id=l.credit_id WHERE l.tenant_id=h.tenant_id AND l.invoice_item_id=ANY(ids) AND c.id<>h.id AND c.status<>'CANCELLED') THEN RAISE EXCEPTION 'Rechnungsposition bereits in anderer Gutschrift gebunden';END IF;
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
 wanted_lines=CASE WHEN h.correction_mode IN('POSITIONS','QUANTITY','PRICE','RESIDUAL') THEN selection->'lines' ELSE h.prepared_snapshot->'sourceJournal'->'lines' END;
 IF EXISTS((SELECT (x->>'accountId')::uuid,CASE x->>'side' WHEN 'DEBIT' THEN 'CREDIT' ELSE 'DEBIT' END,(x->>'amount')::numeric,x->>'costCenter',(x->>'partnerId')::uuid,x->>'taxCode',x->>'description' FROM jsonb_array_elements(wanted_lines) x EXCEPT ALL SELECT account_id,side,amount,cost_center,partner_id,tax_code,description FROM journal_entries WHERE tenant_id=h.tenant_id AND journal_id=j.id) UNION ALL (SELECT account_id,side,amount,cost_center,partner_id,tax_code,description FROM journal_entries WHERE tenant_id=h.tenant_id AND journal_id=j.id EXCEPT ALL SELECT (x->>'accountId')::uuid,CASE x->>'side' WHEN 'DEBIT' THEN 'CREDIT' ELSE 'DEBIT' END,(x->>'amount')::numeric,x->>'costCenter',(x->>'partnerId')::uuid,x->>'taxCode',x->>'description' FROM jsonb_array_elements(wanted_lines) x)) THEN RAISE EXCEPTION 'Gutschrift muss die ursprüngliche ausgewählte Kontierung exakt gegenbuchen';END IF;
 IF NOT EXISTS(SELECT 1 FROM invoice_open_items o WHERE o.tenant_id=h.tenant_id AND o.invoice_id=i.id AND o.amount=i.gross AND o.company_id=i.company_id AND o.partner_id=i.partner_id) THEN RAISE EXCEPTION 'Unbezahlter Originalposten fehlt';END IF;

 IF NOT EXISTS(SELECT 1 FROM customer_credit_open_items op JOIN invoice_open_items orig ON orig.tenant_id=op.tenant_id AND orig.invoice_id=op.invoice_id WHERE op.tenant_id=h.tenant_id AND op.credit_id=h.id AND op.invoice_id=i.id AND op.company_id=i.company_id AND op.partner_id=i.partner_id AND op.account_id=orig.account_id AND op.currency=i.currency AND op.amount=expected_gross) THEN RAISE EXCEPTION 'Gutschrift benötigt passenden Debitoren-Gegenposten';END IF;
 expected_data=i.snapshot||jsonb_build_object('documentType','CREDIT_NOTE','number',d.number,'date',h.document_date::text,'dueDate',h.document_date::text,'creditReason',h.reason,'documentContactLabel','Vertriebsmitarbeiter','originalInvoice',jsonb_build_object('number',i.snapshot->>'number','date',i.invoice_date::text),'seller',(i.snapshot->'seller')||jsonb_build_object('contact',h.prepared_snapshot->'creditData'->'seller'->'contact'));
 IF h.correction_mode IN('POSITIONS','QUANTITY','PRICE','RESIDUAL') THEN
  expected_data=expected_data||jsonb_build_object('items',selection->'items','taxes',selection->'taxes','net',selection->>'net','tax',selection->>'tax','gross',selection->>'gross','deliveryNumbers',(SELECT coalesce(jsonb_agg(DISTINCT x->>'deliveryNumber' ORDER BY x->>'deliveryNumber'),'[]'::jsonb) FROM jsonb_array_elements(selection->'items') x WHERE x->>'deliveryNumber' IS NOT NULL));
 END IF;
 IF h.prepared_snapshot->'creditData' IS DISTINCT FROM expected_data OR coalesce(length(trim(expected_data->'seller'->'contact'->>'firstName')),0)=0 OR coalesce(length(trim(expected_data->'seller'->'contact'->>'lastName')),0)=0 THEN RAISE EXCEPTION 'Gutschriftausgabe benötigt unveränderte ausgewählte Originalwerte und vollständigen Ansprechpartner';END IF;
 RETURN NULL;
END$$;

CREATE OR REPLACE FUNCTION customer_credit_claim_guard() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE h customer_credit_memos;item invoice_items;claimed numeric;used record;BEGIN
 IF TG_TABLE_NAME='customer_credit_lines' THEN
  SELECT * INTO STRICT h FROM customer_credit_memos WHERE tenant_id=NEW.tenant_id AND id=NEW.credit_id;
  IF h.sealed OR h.status NOT IN('DRAFT','REJECTED') OR h.correction_mode NOT IN('POSITIONS','QUANTITY','PRICE','RESIDUAL') THEN RAISE EXCEPTION 'Nur offener Korrekturprüfstand erhält Originalpositionen';END IF;
 ELSE h=NEW;END IF;
 PERFORM 1 FROM company_codes WHERE tenant_id=h.tenant_id AND id=h.company_id FOR UPDATE;PERFORM 1 FROM invoices WHERE tenant_id=h.tenant_id AND id=h.invoice_id FOR UPDATE;
 IF TG_TABLE_NAME='customer_credit_memos' AND TG_OP='UPDATE' THEN IF NEW.correction_mode<>OLD.correction_mode THEN RAISE EXCEPTION 'Gutschriftart ist unveränderlich';END IF;END IF;
 IF h.status='CANCELLED' THEN RETURN NEW;END IF;
 IF EXISTS(SELECT 1 FROM customer_credit_memos c WHERE c.tenant_id=h.tenant_id AND c.invoice_id=h.invoice_id AND c.id<>h.id AND c.status<>'CANCELLED' AND (h.correction_mode='FULL' OR c.correction_mode='FULL')) THEN RAISE EXCEPTION 'Vollständige Korrektur und Teilkorrekturen dürfen sich nicht überlappen';END IF;
 IF h.correction_mode IN('QUANTITY','POSITIONS') AND EXISTS(SELECT 1 FROM customer_credit_memos c WHERE c.tenant_id=h.tenant_id AND c.invoice_id=h.invoice_id AND c.id<>h.id AND c.sealed AND c.correction_mode IN('PRICE','RESIDUAL')) THEN RAISE EXCEPTION 'Nach Preis-/Restkorrektur den verbleibenden Wert über Restgutschrift korrigieren';END IF;
 IF TG_TABLE_NAME='customer_credit_lines' THEN
  SELECT * INTO STRICT item FROM invoice_items WHERE tenant_id=NEW.tenant_id AND id=NEW.invoice_item_id;
  IF item.invoice_id<>h.invoice_id OR (h.correction_mode IN('QUANTITY','RESIDUAL'))<>(NEW.quantity IS NOT NULL) OR (h.correction_mode='PRICE')<>(NEW.net_amount IS NOT NULL) THEN RAISE EXCEPTION 'Originalposition, Mengen- und Wertart passen nicht zum Prüfstand';END IF;
  SELECT coalesce(sum(CASE WHEN c.correction_mode='PRICE' THEN 0 ELSE coalesce(l.quantity,item.quantity) END),0) INTO claimed FROM customer_credit_lines l JOIN customer_credit_memos c ON c.tenant_id=l.tenant_id AND c.id=l.credit_id WHERE l.tenant_id=h.tenant_id AND l.invoice_item_id=item.id AND c.status<>'CANCELLED';
  IF claimed+(CASE WHEN h.correction_mode='PRICE' THEN 0 ELSE coalesce(NEW.quantity,item.quantity) END)>item.quantity THEN RAISE EXCEPTION 'Originalmenge bereits in aktiven oder gebuchten Gutschriften gebunden';END IF;
  IF h.correction_mode='PRICE' THEN SELECT * INTO used FROM customer_credit_amounts(h.tenant_id,item.id,h.id);IF NEW.net_amount>item.net-used.net THEN RAISE EXCEPTION 'Verbleibender ursprünglicher Nettowert überschritten';END IF;END IF;
 END IF;RETURN NEW;
END$$;
