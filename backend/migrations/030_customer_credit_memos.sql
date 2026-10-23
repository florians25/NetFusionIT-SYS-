-- Full, independently approved customer invoice credit; original records stay immutable.
CREATE TABLE customer_credit_memos(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,invoice_id uuid NOT NULL,company_id uuid NOT NULL,
 period_id uuid NOT NULL,posting_date date NOT NULL,document_date date NOT NULL,reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 15 AND 2000),
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','IN_REVIEW','APPROVED','REJECTED','POSTED')),version integer NOT NULL DEFAULT 1 CHECK(version>0),
 prepared_by uuid NOT NULL,prepared_at timestamptz NOT NULL,prepared_snapshot jsonb NOT NULL,
 reviewed_by uuid,reviewed_at timestamptz,review_note text,journal_id uuid,snapshot jsonb,sealed boolean NOT NULL DEFAULT false,posted_at timestamptz,
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,invoice_id),UNIQUE(tenant_id,journal_id),
 FOREIGN KEY(tenant_id,id) REFERENCES documents(tenant_id,id),FOREIGN KEY(tenant_id,invoice_id) REFERENCES invoices(tenant_id,id),
 FOREIGN KEY(tenant_id,company_id) REFERENCES company_codes(tenant_id,id),FOREIGN KEY(tenant_id,period_id) REFERENCES fiscal_periods(tenant_id,id),
 FOREIGN KEY(tenant_id,prepared_by) REFERENCES users(tenant_id,id),FOREIGN KEY(tenant_id,reviewed_by) REFERENCES users(tenant_id,id),FOREIGN KEY(tenant_id,journal_id) REFERENCES journals(tenant_id,id),
 CHECK((status='POSTED')=sealed),CHECK(NOT sealed OR (journal_id IS NOT NULL AND snapshot IS NOT NULL AND posted_at IS NOT NULL AND reviewed_by IS NOT NULL))
);
ALTER TABLE customer_credit_memos ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_credit_memos FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON customer_credit_memos USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
CREATE FUNCTION customer_credit_frozen() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
 IF TG_OP='DELETE' OR OLD.sealed THEN RAISE EXCEPTION 'Gutschrift und gebuchte Historie sind unveränderlich';END IF;
 IF ROW(NEW.id,NEW.tenant_id,NEW.invoice_id,NEW.company_id) IS DISTINCT FROM ROW(OLD.id,OLD.tenant_id,OLD.invoice_id,OLD.company_id) THEN RAISE EXCEPTION 'Ursprung des Gutschrifts ist unveränderlich';END IF;
 IF OLD.status NOT IN ('DRAFT','REJECTED') AND ROW(NEW.period_id,NEW.posting_date,NEW.document_date,NEW.reason,NEW.prepared_by,NEW.prepared_at,NEW.prepared_snapshot) IS DISTINCT FROM ROW(OLD.period_id,OLD.posting_date,OLD.document_date,OLD.reason,OLD.prepared_by,OLD.prepared_at,OLD.prepared_snapshot) THEN RAISE EXCEPTION 'Eingereichter Gutschrift-Prüfstand ist unveränderlich';END IF;
 RETURN NEW;
END$$;
CREATE TRIGGER customer_credit_no_change BEFORE UPDATE OR DELETE ON customer_credit_memos FOR EACH ROW EXECUTE FUNCTION customer_credit_frozen();
CREATE FUNCTION customer_invoice_effective(t uuid,inv uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT EXISTS(SELECT 1 FROM invoices i WHERE i.tenant_id=t AND i.id=inv AND i.sealed AND NOT EXISTS(SELECT 1 FROM customer_credit_memos r WHERE r.tenant_id=i.tenant_id AND r.invoice_id=i.id AND r.sealed))
$$;
CREATE VIEW customer_invoice_balances WITH(security_invoker=true) AS
 SELECT o.*,CASE WHEN r.sealed THEN 0::numeric(20,2) ELSE o.amount END AS balance,r.id AS credit_id,r.posted_at AS credited_at
 FROM invoice_open_items o LEFT JOIN customer_credit_memos r ON r.tenant_id=o.tenant_id AND r.invoice_id=o.invoice_id AND r.sealed;

CREATE FUNCTION validate_customer_credit() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE h customer_credit_memos;i invoices;j journals;original journals;d documents;source_lines jsonb;BEGIN
 IF TG_TABLE_NAME='journals' THEN
  SELECT * INTO h FROM customer_credit_memos WHERE tenant_id=NEW.tenant_id AND id=NEW.source_id;
  IF h.id IS NULL THEN
   IF EXISTS(SELECT 1 FROM invoices si WHERE si.tenant_id=NEW.tenant_id AND si.journal_id=NEW.reversal_of AND si.sealed) THEN RAISE EXCEPTION 'Ausgangsrechnungs-FI benötigt einen unabhängig freigegebenen Gutschrift';END IF;
   RETURN NULL;
  END IF;
 ELSE SELECT * INTO h FROM customer_credit_memos WHERE tenant_id=NEW.tenant_id AND id=NEW.id;END IF;
 SELECT * INTO i FROM invoices WHERE tenant_id=h.tenant_id AND id=h.invoice_id;
 SELECT * INTO d FROM documents WHERE tenant_id=h.tenant_id AND id=h.id;
 IF i.id IS NULL OR NOT i.sealed OR i.sales_order_id IS NULL OR h.company_id<>i.company_id OR d.kind<>'CREDIT_NOTE' OR d.organization_id<>(SELECT organization_id FROM documents WHERE tenant_id=i.tenant_id AND id=i.id) THEN RAISE EXCEPTION 'Passende gebuchte Ursprungsrechnung für Gutschrift fehlt';END IF;
 IF NOT h.sealed THEN
  IF h.journal_id IS NOT NULL OR EXISTS(SELECT 1 FROM journals WHERE tenant_id=h.tenant_id AND source_id=h.id) THEN RAISE EXCEPTION 'Gegenbuchung benötigt vollständig gebuchten Gutschrift';END IF;RETURN NULL;
 END IF;
 SELECT * INTO original FROM journals WHERE tenant_id=h.tenant_id AND id=i.journal_id;
 SELECT * INTO j FROM journals WHERE tenant_id=h.tenant_id AND id=h.journal_id;
 IF original.id IS NULL OR original.status<>'POSTED' OR original.reversal_of IS NOT NULL OR j.id IS NULL OR j.status<>'POSTED' OR j.reversal_of IS DISTINCT FROM original.id OR j.source_id IS DISTINCT FROM h.id OR j.company_id<>i.company_id OR j.currency<>i.currency OR j.period_id<>h.period_id OR j.posting_date<>h.posting_date OR j.document_date<>h.document_date OR j.reason IS DISTINCT FROM h.reason THEN RAISE EXCEPTION 'Passender Original-/Gegen-Finanzbeleg fehlt';END IF;
 IF h.posting_date<i.posting_date OR h.document_date<i.invoice_date OR NOT EXISTS(SELECT 1 FROM fiscal_periods p WHERE p.tenant_id=h.tenant_id AND p.id=h.period_id AND p.company_id=h.company_id AND p.status='OPEN' AND h.posting_date BETWEEN p.date_from AND p.date_to) THEN RAISE EXCEPTION 'Offene passende Gutschriftperiode oder zulässiges Datum fehlt';END IF;
 IF h.reviewed_by IN(d.created_by,h.prepared_by) OR NOT EXISTS(SELECT 1 FROM approval_instances ai JOIN approval_decisions ad ON ad.tenant_id=ai.tenant_id AND ad.instance_id=ai.id JOIN users u ON u.tenant_id=ad.tenant_id AND u.id=ad.actor_id WHERE ai.tenant_id=h.tenant_id AND ai.document_id=h.id AND ai.status='APPROVED' AND ai.four_eyes AND ai.subject_version=h.version-2 AND ai.submitted_by<>h.reviewed_by AND ad.decision='APPROVE' AND ad.actor_id=h.reviewed_by AND ad.step=jsonb_array_length(ai.steps_snapshot)-1 AND ad.comment=h.review_note AND ad.context->>'preparedHash'=encode(sha256(convert_to(h.prepared_snapshot::text,'UTF8')),'hex') AND u.role IN('ADMIN','ACCOUNTANT')) THEN RAISE EXCEPTION 'Unabhängige Gutschriftfreigabe zum unveränderten Prüfstand fehlt';END IF;
 IF h.snapshot-'review' IS DISTINCT FROM h.prepared_snapshot OR h.snapshot->'review'->>'actorId' IS DISTINCT FROM h.reviewed_by::text OR h.snapshot->'review'->>'note' IS DISTINCT FROM h.review_note OR h.reviewed_at IS NULL OR h.prepared_snapshot->>'id' IS DISTINCT FROM h.id::text OR h.prepared_snapshot->>'number' IS DISTINCT FROM d.number OR h.prepared_snapshot->>'invoiceId' IS DISTINCT FROM i.id::text OR h.prepared_snapshot->>'companyId' IS DISTINCT FROM i.company_id::text OR h.prepared_snapshot->>'periodId' IS DISTINCT FROM h.period_id::text OR h.prepared_snapshot->>'postingDate' IS DISTINCT FROM h.posting_date::text OR h.prepared_snapshot->>'documentDate' IS DISTINCT FROM h.document_date::text OR h.prepared_snapshot->>'reason' IS DISTINCT FROM h.reason OR h.prepared_snapshot->>'preparedBy' IS DISTINCT FROM h.prepared_by::text OR h.prepared_snapshot->'invoiceSnapshot' IS DISTINCT FROM i.snapshot OR h.prepared_snapshot->'sourceJournal'->>'id' IS DISTINCT FROM original.id::text OR h.prepared_snapshot->'sourceJournal'->>'hash' IS DISTINCT FROM original.content_hash THEN RAISE EXCEPTION 'Gutschrift-/Originalsnapshot passt nicht zum geprüften Gegenbeleg';END IF;
 IF h.prepared_snapshot->>'currency' IS DISTINCT FROM i.currency OR (h.prepared_snapshot->>'net')::numeric IS DISTINCT FROM i.net OR (h.prepared_snapshot->>'tax')::numeric IS DISTINCT FROM i.tax OR (h.prepared_snapshot->>'gross')::numeric IS DISTINCT FROM i.gross OR (h.prepared_snapshot->>'preparedAt')::timestamptz IS DISTINCT FROM h.prepared_at OR h.prepared_snapshot->>'invoiceNumber' IS DISTINCT FROM (SELECT number FROM documents WHERE tenant_id=i.tenant_id AND id=i.id) OR h.prepared_snapshot->'sourceJournal'->>'number' IS DISTINCT FROM (SELECT number FROM documents WHERE tenant_id=original.tenant_id AND id=original.id) OR (h.snapshot->'review'->>'at')::timestamptz IS DISTINCT FROM date_trunc('milliseconds',h.reviewed_at) THEN RAISE EXCEPTION 'Gutschriftbeträge, Originalreferenzen oder Prüfzeitpunkte sind inkonsistent';END IF;
 SELECT jsonb_agg(jsonb_build_object('position',e.position,'accountId',e.account_id,'side',e.side,'amount',e.amount::text,'description',e.description,'costCenter',e.cost_center,'partnerId',e.partner_id,'taxCode',e.tax_code) ORDER BY e.position) INTO source_lines FROM journal_entries e WHERE e.tenant_id=h.tenant_id AND e.journal_id=original.id;
 IF (SELECT jsonb_agg(x-'code'-'name' ORDER BY (x->>'position')::int) FROM jsonb_array_elements(h.prepared_snapshot->'sourceJournal'->'lines') x) IS DISTINCT FROM source_lines THEN RAISE EXCEPTION 'Stornierter Kontierungsstand passt nicht zur Original-FI';END IF;
 IF EXISTS((SELECT account_id,CASE side WHEN 'DEBIT' THEN 'CREDIT' ELSE 'DEBIT' END,amount,cost_center,partner_id,tax_code,description FROM journal_entries WHERE tenant_id=h.tenant_id AND journal_id=original.id EXCEPT ALL SELECT account_id,side,amount,cost_center,partner_id,tax_code,description FROM journal_entries WHERE tenant_id=h.tenant_id AND journal_id=j.id) UNION ALL (SELECT account_id,side,amount,cost_center,partner_id,tax_code,description FROM journal_entries WHERE tenant_id=h.tenant_id AND journal_id=j.id EXCEPT ALL SELECT account_id,CASE side WHEN 'DEBIT' THEN 'CREDIT' ELSE 'DEBIT' END,amount,cost_center,partner_id,tax_code,description FROM journal_entries WHERE tenant_id=h.tenant_id AND journal_id=original.id)) THEN RAISE EXCEPTION 'Gutschrift muss jede ursprüngliche Kontierung exakt gegenbuchen';END IF;
 IF NOT EXISTS(SELECT 1 FROM invoice_open_items o WHERE o.tenant_id=h.tenant_id AND o.invoice_id=i.id AND o.amount=i.gross AND o.company_id=i.company_id AND o.partner_id=i.partner_id) THEN RAISE EXCEPTION 'Unbezahlter Originalposten fehlt';END IF;

 IF NOT EXISTS(SELECT 1 FROM customer_credit_open_items op JOIN invoice_open_items orig ON orig.tenant_id=op.tenant_id AND orig.invoice_id=op.invoice_id WHERE op.tenant_id=h.tenant_id AND op.credit_id=h.id AND op.invoice_id=i.id AND op.company_id=i.company_id AND op.partner_id=i.partner_id AND op.account_id=orig.account_id AND op.currency=i.currency AND op.amount=i.gross) THEN RAISE EXCEPTION 'Gutschrift benötigt passenden Debitoren-Gegenposten';END IF;
 IF h.prepared_snapshot->'creditData' - ARRAY['documentType','originalInvoice','creditReason','number','date','dueDate','seller','documentContactLabel'] IS DISTINCT FROM i.snapshot - ARRAY['documentType','originalInvoice','creditReason','number','date','dueDate','seller','documentContactLabel']
 OR h.prepared_snapshot->'creditData'->'seller'-'contact' IS DISTINCT FROM i.snapshot->'seller'-'contact'
 OR NOT(jsonb_build_object('documentType','CREDIT_NOTE','number',d.number,'date',h.document_date::text,'dueDate',h.document_date::text,'creditReason',h.reason,'documentContactLabel','Vertriebsmitarbeiter','originalInvoice',jsonb_build_object('number',i.snapshot->>'number','date',i.invoice_date::text)) <@ (h.prepared_snapshot->'creditData'))
 OR coalesce(length(trim(h.prepared_snapshot->'creditData'->'seller'->'contact'->>'firstName')),0)=0 OR coalesce(length(trim(h.prepared_snapshot->'creditData'->'seller'->'contact'->>'lastName')),0)=0
 THEN RAISE EXCEPTION 'Gutschriftausgabe muss den unveränderten Rechnungsstand und vollständigen Ansprechpartner enthalten';END IF;
 RETURN NULL;
END$$;
CREATE CONSTRAINT TRIGGER customer_credit_consistent AFTER INSERT OR UPDATE ON customer_credit_memos DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_customer_credit();
CREATE CONSTRAINT TRIGGER customer_credit_journal_consistent AFTER INSERT OR UPDATE ON journals DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_customer_credit();


CREATE TABLE customer_credit_open_items(
 credit_id uuid PRIMARY KEY,tenant_id uuid NOT NULL,invoice_id uuid NOT NULL,company_id uuid NOT NULL,partner_id uuid NOT NULL,account_id uuid NOT NULL,currency text NOT NULL,amount numeric(20,2) NOT NULL CHECK(amount>0),
 FOREIGN KEY(tenant_id,credit_id) REFERENCES customer_credit_memos(tenant_id,id),FOREIGN KEY(tenant_id,invoice_id) REFERENCES invoices(tenant_id,id),FOREIGN KEY(tenant_id,company_id) REFERENCES company_codes(tenant_id,id),FOREIGN KEY(tenant_id,partner_id) REFERENCES business_partners(tenant_id,id),FOREIGN KEY(tenant_id,account_id) REFERENCES gl_accounts(tenant_id,id)
);
CREATE TRIGGER customer_credit_op_frozen BEFORE UPDATE OR DELETE ON customer_credit_open_items FOR EACH ROW EXECUTE FUNCTION reject_attachment_mutation();
CREATE FUNCTION credit_op_consistent() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
 IF NOT EXISTS(SELECT 1 FROM customer_credit_memos h JOIN invoices i ON i.tenant_id=h.tenant_id AND i.id=h.invoice_id JOIN invoice_open_items o ON o.tenant_id=i.tenant_id AND o.invoice_id=i.id WHERE h.tenant_id=NEW.tenant_id AND h.id=NEW.credit_id AND h.sealed AND NEW.invoice_id=i.id AND NEW.company_id=i.company_id AND NEW.partner_id=i.partner_id AND NEW.account_id=o.account_id AND NEW.currency=i.currency AND NEW.amount=i.gross) THEN RAISE EXCEPTION 'Debitoren-Gegenposten benötigt vollständig gebuchte passende Gutschrift';END IF;RETURN NULL;
END$$;
CREATE CONSTRAINT TRIGGER customer_credit_op_consistent AFTER INSERT ON customer_credit_open_items DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION credit_op_consistent();
CREATE TABLE customer_credit_output_jobs(
 credit_id uuid PRIMARY KEY,tenant_id uuid NOT NULL,archive_number text NOT NULL,status text NOT NULL DEFAULT 'PENDING' CHECK(status IN('PENDING','PROCESSING','READY','FAILED')),attempts integer NOT NULL DEFAULT 0,token uuid,started_at timestamptz,finished_at timestamptz,last_error text NOT NULL DEFAULT '',FOREIGN KEY(tenant_id,credit_id) REFERENCES customer_credit_memos(tenant_id,id)
);
CREATE TABLE customer_credit_outputs(
 credit_id uuid PRIMARY KEY,tenant_id uuid NOT NULL,pdf bytea NOT NULL,xml bytea NOT NULL,pdf_hash text NOT NULL,xml_hash text NOT NULL,validator text NOT NULL,validation_report text NOT NULL,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(tenant_id,credit_id) REFERENCES customer_credit_memos(tenant_id,id),FOREIGN KEY(tenant_id,created_by) REFERENCES users(tenant_id,id),CHECK(pdf_hash=encode(sha256(pdf),'hex') AND xml_hash=encode(sha256(xml),'hex'))
);
CREATE TRIGGER customer_credit_outputs_frozen BEFORE UPDATE OR DELETE ON customer_credit_outputs FOR EACH ROW EXECUTE FUNCTION reject_attachment_mutation();
DO $$DECLARE tab text;BEGIN FOREACH tab IN ARRAY ARRAY['customer_credit_open_items','customer_credit_output_jobs','customer_credit_outputs'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',tab);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',tab);
 EXECUTE format($policy$CREATE POLICY tenant_isolation ON %I USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid)$policy$,tab);
 END LOOP;END$$;
ALTER TABLE document_attachments DROP CONSTRAINT document_attachments_document_type_check;
ALTER TABLE document_attachments ADD CONSTRAINT document_attachments_document_type_check CHECK(document_type IN('RECORD','ORDER_CONFIRMATION','PURCHASE_ORDER','GOODS_RECEIPT','DELIVERY_NOTE','SERVICE_REPORT','EXTERNAL_PDF','INVOICE','CREDIT_NOTE'));
-- A full physical return requires every claimed unit to have been invoiced and
-- fully credited. An approved request or a credit draft never releases stock.
CREATE FUNCTION direct_issue_financially_closed(t uuid,issue uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT NOT EXISTS(SELECT 1 FROM billing_request_lines l JOIN billing_requests r ON r.tenant_id=l.tenant_id AND r.id=l.request_id JOIN goods_issue_items gi ON gi.tenant_id=l.tenant_id AND gi.id=l.goods_issue_item_id WHERE l.tenant_id=t AND gi.issue_id=issue AND r.status NOT IN('CANCELLED','REJECTED') AND
 (l.quantity<>(SELECT coalesce(sum(ii.quantity),0) FROM invoice_items ii JOIN customer_credit_memos cm ON cm.tenant_id=ii.tenant_id AND cm.invoice_id=ii.invoice_id AND cm.sealed WHERE ii.tenant_id=l.tenant_id AND ii.request_line_id=l.id)))
$$;
CREATE OR REPLACE FUNCTION direct_billing_return_guard() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
 IF NEW.sales_order_id IS NOT NULL AND NEW.reverses_id IS NOT NULL THEN
  PERFORM 1 FROM company_codes WHERE tenant_id=NEW.tenant_id AND id=NEW.company_id FOR UPDATE;
  PERFORM 1 FROM sales_orders WHERE tenant_id=NEW.tenant_id AND id=NEW.sales_order_id FOR UPDATE;
  IF NOT direct_issue_financially_closed(NEW.tenant_id,NEW.reverses_id) THEN RAISE EXCEPTION 'Lieferung ist in Fakturaanforderung oder Rechnung gebunden; alle gebundenen Mengen erst vollständig fakturieren und unabhängig gutschreiben oder unfakturierte Anforderung stornieren';END IF;
 END IF;RETURN NEW;
END$$;
CREATE OR REPLACE FUNCTION validate_direct_billing_request(t uuid,rid uuid) RETURNS void LANGUAGE plpgsql AS $$DECLARE r billing_requests;h sales_orders;l record;s record;bound numeric;BEGIN
 SELECT * INTO STRICT r FROM billing_requests WHERE tenant_id=t AND id=rid;
 SELECT * INTO STRICT h FROM sales_orders WHERE tenant_id=t AND id=r.sales_order_id FOR UPDATE;
 IF h.status<>'RELEASED' OR h.execution_mode<>'DIRECT_SALES' OR h.released_snapshot IS NULL OR h.company_id IS DISTINCT FROM r.company_id OR h.partner_id IS DISTINCT FROM r.partner_id OR h.billing_block IS NOT NULL OR NOT EXISTS(SELECT 1 FROM documents d WHERE d.tenant_id=t AND d.id=r.id AND d.organization_id=h.organization_id) THEN RAISE EXCEPTION 'Direkte Fakturaanforderung benötigt passenden unabhängig freigegebenen AU ohne Fakturasperre';END IF;
 IF NOT EXISTS(SELECT 1 FROM billing_request_lines WHERE tenant_id=t AND request_id=rid) THEN RAISE EXCEPTION 'Fakturaanforderung benötigt tatsächliche Lieferpositionen';END IF;
 FOR l IN SELECT * FROM billing_request_lines WHERE tenant_id=t AND request_id=rid LOOP
  SELECT gi.quantity,g.delivery_date,i.net AS planned_net,i.quantity AS planned_quantity,i.price_snapshot,i.unit,i.description,i.cost_center,g.id AS issue_id,g.delivery_number,d.number AS issue_number,i.position INTO s FROM goods_issue_items gi JOIN goods_issues g ON g.tenant_id=gi.tenant_id AND g.id=gi.issue_id JOIN sales_order_items i ON i.tenant_id=gi.tenant_id AND i.id=gi.sales_item_id JOIN documents d ON d.tenant_id=g.tenant_id AND d.id=g.id
   WHERE gi.tenant_id=t AND gi.id=l.goods_issue_item_id AND gi.sales_item_id=l.sales_item_id AND i.order_id=h.id AND g.sales_order_id=h.id AND g.company_id=r.company_id AND g.sealed AND g.movement_type='ISSUE' AND i.rejection_reason IS NULL AND i.billing_block IS NULL AND i.billing_rule<>'NON_BILLABLE' AND (NOT EXISTS(SELECT 1 FROM goods_issues rev WHERE rev.tenant_id=t AND rev.reverses_id=g.id) OR direct_issue_financially_closed(t,g.id));
  IF NOT FOUND OR l.source_kind<>'DELIVERY' OR l.item_id IS NOT NULL OR l.source_line_id IS NOT NULL THEN RAISE EXCEPTION 'Tatsächlich gebuchte, nicht zurückgenommene AU-Lieferquelle fehlt';END IF;
  IF l.unit IS DISTINCT FROM s.unit OR l.unit_net IS DISTINCT FROM round(s.planned_net/s.planned_quantity,12) OR l.tax_rate IS DISTINCT FROM (s.price_snapshot->>'taxRate')::numeric OR l.service_from IS DISTINCT FROM s.delivery_date OR l.service_to IS DISTINCT FROM s.delivery_date THEN RAISE EXCEPTION 'Direktvertriebsmenge benötigt genehmigten Preis, Steuer und tatsächliches Lieferdatum';END IF;
  IF NOT(jsonb_build_object('sourceKey',l.source_key,'sourceKind','DELIVERY','salesItemId',l.sales_item_id,'goodsIssueItemId',l.goods_issue_item_id,'issueId',s.issue_id,'issueNumber',s.issue_number,'deliveryNumber',s.delivery_number,'sku',s.price_snapshot->'product'->>'sku','description',s.description,'unit',s.unit,'ticketNumbers','[]'::jsonb,'serviceFrom',s.delivery_date::text,'serviceTo',s.delivery_date::text,'costCenter',s.cost_center) <@ l.snapshot) THEN RAISE EXCEPTION 'Direkte Fakturaquelle darf keine fremden Referenzen oder veränderten Texte enthalten';END IF;
  SELECT coalesce(sum(bl.quantity),0) INTO bound FROM billing_request_lines bl JOIN billing_requests br ON br.tenant_id=bl.tenant_id AND br.id=bl.request_id WHERE bl.tenant_id=t AND bl.source_key=l.source_key AND br.status NOT IN ('CANCELLED','REJECTED');
  IF bound>s.quantity THEN RAISE EXCEPTION 'Tatsächliche Liefermenge bereits in Fakturaanforderung gebunden';END IF;
 END LOOP;
END$$;

