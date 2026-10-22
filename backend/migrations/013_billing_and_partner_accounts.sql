ALTER TABLE documents DROP CONSTRAINT documents_kind_check;
ALTER TABLE documents ADD CONSTRAINT documents_kind_check CHECK(kind IN ('WORK_ORDER_TASK','TICKET','SERVICE_CASE','BUSINESS_PARTNER','APPROVAL','TECHNICAL_OBJECT','SERVICE_CONTRACT','FIELD_VISIT','SERVICE_ORDER','MATERIAL','MATERIAL_REQUIREMENT','REQUISITION','PURCHASE_ORDER','GOODS_RECEIPT','GOODS_ISSUE','SERVICE_REPORT','INVOICE','CANCELLATION','ACCOUNTING','PAYMENT','QUOTATION','SALES_ORDER','CREDIT_NOTE','BILLING_REQUEST','PARTNER_ACCOUNT','COMPANY_BILLING_PROFILE'));
ALTER TABLE partner_contacts ADD COLUMN department text NOT NULL DEFAULT '';
ALTER TABLE partner_contacts ADD COLUMN mobile text NOT NULL DEFAULT '';
ALTER TABLE partner_contacts ADD COLUMN functions text[] NOT NULL DEFAULT ARRAY[]::text[] CHECK(functions<@ARRAY['TECHNICAL','PURCHASING','SALES','DISPATCH','BILLING','APPROVAL','MANAGEMENT']::text[]);
ALTER TABLE partner_contacts ADD COLUMN active boolean NOT NULL DEFAULT true;
ALTER TABLE partner_contacts ADD COLUMN valid_from date;
ALTER TABLE partner_contacts ADD COLUMN valid_to date;
ALTER TABLE partner_contacts ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK(version>0);
ALTER TABLE partner_contacts ADD CHECK(valid_to IS NULL OR valid_from IS NULL OR valid_to>=valid_from);
ALTER TABLE partner_addresses ADD COLUMN active boolean NOT NULL DEFAULT true;
ALTER TABLE partner_addresses ADD COLUMN is_default boolean NOT NULL DEFAULT false;
ALTER TABLE partner_addresses ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK(version>0);
CREATE UNIQUE INDEX partner_default_address ON partner_addresses(tenant_id,partner_id,kind) WHERE active AND is_default;
CREATE TABLE company_billing_profiles (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,company_id uuid NOT NULL,iban text NOT NULL,bic text NOT NULL,email text NOT NULL,phone text NOT NULL,
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','IN_REVIEW','ACTIVE','REJECTED','BLOCKED')),version integer NOT NULL DEFAULT 1,
 UNIQUE(tenant_id,id),FOREIGN KEY(tenant_id,id) REFERENCES documents(tenant_id,id),FOREIGN KEY(tenant_id,company_id) REFERENCES company_codes(tenant_id,id)
);
CREATE UNIQUE INDEX active_billing_profile ON company_billing_profiles(tenant_id,company_id) WHERE status='ACTIVE';
CREATE TABLE partner_company_accounts (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,company_id uuid NOT NULL,partner_id uuid NOT NULL,kind text NOT NULL CHECK(kind IN ('DEBTOR','CREDITOR')),account_number text NOT NULL,
 reconciliation_account_id uuid NOT NULL,payment_terms_days integer NOT NULL CHECK(payment_terms_days BETWEEN 0 AND 365),dunning_procedure text NOT NULL DEFAULT '',credit_limit numeric(20,2) NOT NULL CHECK(credit_limit>=0),invoice_block boolean NOT NULL DEFAULT false,payment_block boolean NOT NULL DEFAULT false,
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','IN_REVIEW','ACTIVE','REJECTED','BLOCKED')),version integer NOT NULL DEFAULT 1,
 UNIQUE(tenant_id,id),FOREIGN KEY(tenant_id,id) REFERENCES documents(tenant_id,id),FOREIGN KEY(tenant_id,company_id) REFERENCES company_codes(tenant_id,id),FOREIGN KEY(tenant_id,partner_id) REFERENCES business_partners(tenant_id,id),FOREIGN KEY(tenant_id,reconciliation_account_id) REFERENCES gl_accounts(tenant_id,id)
);
CREATE UNIQUE INDEX active_partner_account ON partner_company_accounts(tenant_id,company_id,partner_id,kind) WHERE status='ACTIVE';
CREATE UNIQUE INDEX active_partner_account_number ON partner_company_accounts(tenant_id,company_id,kind,account_number) WHERE status='ACTIVE';
CREATE TABLE billing_requests (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,order_id uuid NOT NULL,company_id uuid NOT NULL,partner_id uuid NOT NULL,title text NOT NULL,
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','IN_REVIEW','RELEASED','REJECTED','CANCELLED')),version integer NOT NULL DEFAULT 1,
 UNIQUE(tenant_id,id),FOREIGN KEY(tenant_id,id) REFERENCES documents(tenant_id,id),FOREIGN KEY(tenant_id,order_id) REFERENCES service_orders(tenant_id,id),FOREIGN KEY(tenant_id,company_id) REFERENCES company_codes(tenant_id,id),FOREIGN KEY(tenant_id,partner_id) REFERENCES business_partners(tenant_id,id)
);
ALTER TABLE service_report_lines ADD UNIQUE(tenant_id,id);
CREATE TABLE billing_request_lines (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,request_id uuid NOT NULL,item_id uuid NOT NULL,source_line_id uuid,source_kind text NOT NULL CHECK(source_kind IN ('TIME_MATERIAL','FIXED_PRICE')),
 source_key text GENERATED ALWAYS AS (CASE WHEN source_kind='FIXED_PRICE' THEN 'FIX:'||item_id::text ELSE 'SRM:'||source_line_id::text END) STORED,
 position integer NOT NULL,quantity numeric(18,6) NOT NULL CHECK(quantity>0),unit text NOT NULL,unit_net numeric(30,12) NOT NULL CHECK(unit_net>0),net numeric(20,2) NOT NULL CHECK(net>0),tax_rate numeric(7,4) NOT NULL CHECK(tax_rate>0 AND tax_rate<=100),service_from date NOT NULL,service_to date NOT NULL CHECK(service_to>=service_from),snapshot jsonb NOT NULL,
 CHECK((source_kind='FIXED_PRICE')=(source_line_id IS NULL)),CHECK(source_kind<>'FIXED_PRICE' OR quantity=1),CHECK(net=round(quantity*unit_net,2)),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,request_id,position),FOREIGN KEY(tenant_id,request_id) REFERENCES billing_requests(tenant_id,id),FOREIGN KEY(tenant_id,item_id) REFERENCES service_order_items(tenant_id,id),FOREIGN KEY(tenant_id,source_line_id) REFERENCES service_report_lines(tenant_id,id)
);
CREATE INDEX billing_request_source ON billing_request_lines(tenant_id,source_key);
CREATE TABLE invoices (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,company_id uuid NOT NULL,partner_id uuid NOT NULL,order_id uuid NOT NULL,period_id uuid NOT NULL,journal_id uuid,
 invoice_date date NOT NULL,posting_date date NOT NULL,due_date date NOT NULL CHECK(due_date>=invoice_date),currency text NOT NULL,net numeric(20,2) NOT NULL CHECK(net>0),tax numeric(20,2) NOT NULL CHECK(tax>=0),gross numeric(20,2) NOT NULL CHECK(gross=net+tax),snapshot jsonb NOT NULL,version integer NOT NULL DEFAULT 1,sealed boolean NOT NULL DEFAULT false,
 UNIQUE(tenant_id,id),CHECK(NOT sealed OR journal_id IS NOT NULL),FOREIGN KEY(tenant_id,id) REFERENCES documents(tenant_id,id),FOREIGN KEY(tenant_id,company_id) REFERENCES company_codes(tenant_id,id),FOREIGN KEY(tenant_id,partner_id) REFERENCES business_partners(tenant_id,id),FOREIGN KEY(tenant_id,order_id) REFERENCES service_orders(tenant_id,id),FOREIGN KEY(tenant_id,period_id) REFERENCES fiscal_periods(tenant_id,id),FOREIGN KEY(tenant_id,journal_id) REFERENCES journals(tenant_id,id)
);
CREATE TABLE invoice_items (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,invoice_id uuid NOT NULL,request_line_id uuid NOT NULL,position integer NOT NULL,quantity numeric(18,6) NOT NULL CHECK(quantity>0),net numeric(20,2) NOT NULL CHECK(net>0),tax_rate numeric(7,4) NOT NULL CHECK(tax_rate>0 AND tax_rate<=100),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,invoice_id,position),UNIQUE(tenant_id,invoice_id,request_line_id),FOREIGN KEY(tenant_id,invoice_id) REFERENCES invoices(tenant_id,id),FOREIGN KEY(tenant_id,request_line_id) REFERENCES billing_request_lines(tenant_id,id)
);
CREATE TABLE invoice_open_items (
 invoice_id uuid PRIMARY KEY,tenant_id uuid NOT NULL,company_id uuid NOT NULL,partner_id uuid NOT NULL,account_id uuid NOT NULL,due_date date NOT NULL,currency text NOT NULL,amount numeric(20,2) NOT NULL CHECK(amount>0),
 FOREIGN KEY(tenant_id,invoice_id) REFERENCES invoices(tenant_id,id),FOREIGN KEY(tenant_id,company_id) REFERENCES company_codes(tenant_id,id),FOREIGN KEY(tenant_id,partner_id) REFERENCES business_partners(tenant_id,id),FOREIGN KEY(tenant_id,account_id) REFERENCES gl_accounts(tenant_id,id)
);
CREATE TABLE invoice_output_jobs (
 invoice_id uuid PRIMARY KEY,tenant_id uuid NOT NULL,archive_number text NOT NULL,status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','PROCESSING','READY','FAILED')),attempts integer NOT NULL DEFAULT 0,token uuid,started_at timestamptz,finished_at timestamptz,last_error text NOT NULL DEFAULT '',
 FOREIGN KEY(tenant_id,invoice_id) REFERENCES invoices(tenant_id,id),UNIQUE(tenant_id,archive_number)
);
CREATE TABLE invoice_outputs (
 invoice_id uuid PRIMARY KEY,tenant_id uuid NOT NULL,pdf bytea NOT NULL CHECK(octet_length(pdf) BETWEEN 20 AND 5242880),xml bytea NOT NULL CHECK(octet_length(xml) BETWEEN 20 AND 5242880),pdf_hash text NOT NULL CHECK(pdf_hash=encode(sha256(pdf),'hex')),xml_hash text NOT NULL CHECK(xml_hash=encode(sha256(xml),'hex')),validator text NOT NULL,validation_report text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),created_by uuid NOT NULL,
 FOREIGN KEY(tenant_id,invoice_id) REFERENCES invoices(tenant_id,id),FOREIGN KEY(tenant_id,created_by) REFERENCES users(tenant_id,id)
);
ALTER TABLE document_attachments DROP CONSTRAINT document_attachments_document_type_check;
ALTER TABLE document_attachments ADD CONSTRAINT document_attachments_document_type_check CHECK(document_type IN ('RECORD','ORDER_CONFIRMATION','PURCHASE_ORDER','GOODS_RECEIPT','DELIVERY_NOTE','SERVICE_REPORT','EXTERNAL_PDF','INVOICE'));
CREATE TRIGGER invoice_outputs_immutable BEFORE UPDATE OR DELETE ON invoice_outputs FOR EACH ROW EXECUTE FUNCTION reject_attachment_mutation();
CREATE TRIGGER open_items_immutable BEFORE UPDATE OR DELETE ON invoice_open_items FOR EACH ROW EXECUTE FUNCTION reject_attachment_mutation();
CREATE FUNCTION billing_frozen() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
 IF TG_TABLE_NAME='invoices' THEN IF OLD.sealed THEN RAISE EXCEPTION 'Gebuchte Rechnung ist unveränderlich';END IF;
 ELSIF OLD.status IN ('IN_REVIEW','RELEASED','ACTIVE','BLOCKED') AND (TG_OP='DELETE' OR (to_jsonb(NEW)-'status'-'version') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'version')) THEN RAISE EXCEPTION 'Freigegebener Faktura-/Finanzstamm ist unveränderlich';END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;
END$$;
CREATE TRIGGER invoice_frozen BEFORE UPDATE OR DELETE ON invoices FOR EACH ROW EXECUTE FUNCTION billing_frozen();
CREATE TRIGGER billing_request_frozen BEFORE UPDATE OR DELETE ON billing_requests FOR EACH ROW EXECUTE FUNCTION billing_frozen();
CREATE TRIGGER partner_account_frozen BEFORE UPDATE OR DELETE ON partner_company_accounts FOR EACH ROW EXECUTE FUNCTION billing_frozen();
CREATE TRIGGER company_profile_frozen BEFORE UPDATE OR DELETE ON company_billing_profiles FOR EACH ROW EXECUTE FUNCTION billing_frozen();
CREATE FUNCTION billing_line_frozen() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE r record;BEGIN
 IF TG_TABLE_NAME='invoice_items' THEN
  IF TG_OP='DELETE' THEN SELECT sealed INTO r FROM invoices WHERE tenant_id=OLD.tenant_id AND id=OLD.invoice_id;ELSE SELECT sealed INTO r FROM invoices WHERE tenant_id=NEW.tenant_id AND id=NEW.invoice_id;END IF;
  IF r.sealed THEN RAISE EXCEPTION 'Gebuchte Rechnungsposition ist unveränderlich';END IF;
  IF TG_OP='UPDATE' AND EXISTS(SELECT 1 FROM invoices WHERE tenant_id=OLD.tenant_id AND id=OLD.invoice_id AND sealed) THEN RAISE EXCEPTION 'Gebuchte Rechnungsposition ist unveränderlich';END IF;
 ELSE
  IF TG_OP='DELETE' THEN SELECT status INTO r FROM billing_requests WHERE tenant_id=OLD.tenant_id AND id=OLD.request_id;ELSE SELECT status INTO r FROM billing_requests WHERE tenant_id=NEW.tenant_id AND id=NEW.request_id;END IF;
  IF r.status NOT IN ('DRAFT','REJECTED') THEN RAISE EXCEPTION 'Freigegebene Fakturaanforderungsposition ist unveränderlich';END IF;
  IF TG_OP='UPDATE' AND EXISTS(SELECT 1 FROM billing_requests WHERE tenant_id=OLD.tenant_id AND id=OLD.request_id AND status NOT IN ('DRAFT','REJECTED')) THEN RAISE EXCEPTION 'Freigegebene Fakturaanforderungsposition ist unveränderlich';END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;
END$$;
CREATE TRIGGER billing_request_line_frozen BEFORE INSERT OR UPDATE OR DELETE ON billing_request_lines FOR EACH ROW EXECUTE FUNCTION billing_line_frozen();
CREATE TRIGGER invoice_line_frozen BEFORE INSERT OR UPDATE OR DELETE ON invoice_items FOR EACH ROW EXECUTE FUNCTION billing_line_frozen();
-- Source and quantity constraints are checked at commit and after workflow transitions.
CREATE FUNCTION billing_integrity() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE r record;l record;cap numeric;bound numeric;inv record;vat numeric;target_order uuid;BEGIN
 IF TG_TABLE_NAME IN ('billing_requests','invoices') THEN target_order=NEW.order_id;
 ELSIF TG_TABLE_NAME='billing_request_lines' THEN SELECT order_id INTO target_order FROM billing_requests WHERE tenant_id=NEW.tenant_id AND id=NEW.request_id;
 ELSE SELECT order_id INTO target_order FROM invoices WHERE tenant_id=NEW.tenant_id AND id=NEW.invoice_id;END IF;
 PERFORM 1 FROM service_orders WHERE tenant_id=NEW.tenant_id AND id=target_order FOR UPDATE;
 FOR r IN SELECT * FROM billing_requests WHERE tenant_id=NEW.tenant_id AND order_id=target_order AND status NOT IN ('CANCELLED','REJECTED') LOOP
  FOR l IN SELECT * FROM billing_request_lines WHERE tenant_id=r.tenant_id AND request_id=r.id LOOP
   PERFORM 1 FROM service_order_items i JOIN service_orders o ON o.tenant_id=i.tenant_id AND o.id=i.order_id JOIN company_codes c ON c.tenant_id=o.tenant_id AND c.organization_id=(SELECT organization_id FROM documents WHERE tenant_id=o.tenant_id AND id=o.id) WHERE i.tenant_id=l.tenant_id AND i.id=l.item_id AND o.id=r.order_id AND o.partner_id=r.partner_id AND c.id=r.company_id AND c.currency=o.currency AND i.billing_rule=l.source_kind AND i.service_status='COMPLETED';
   IF NOT FOUND THEN RAISE EXCEPTION 'Fakturaanforderung benötigt passende abgeschlossene Auftragsposition';END IF;
   IF NOT EXISTS(SELECT 1 FROM service_order_items oi WHERE oi.tenant_id=l.tenant_id AND oi.id=l.item_id AND l.unit_net=round(CASE WHEN l.source_kind='FIXED_PRICE' THEN oi.net ELSE oi.net/oi.quantity END,12) AND l.tax_rate=(oi.price_snapshot->>'taxRate')::numeric) THEN RAISE EXCEPTION 'Fakturapreis und Steuer müssen dem genehmigten Preisstand entsprechen';END IF;
   IF l.source_kind='FIXED_PRICE' THEN
    cap=1;
    IF NOT EXISTS(SELECT 1 FROM service_report_lines sl JOIN service_reports sr ON sr.tenant_id=sl.tenant_id AND sr.id=sl.report_id WHERE sl.tenant_id=l.tenant_id AND sl.item_id=l.item_id AND sr.status='APPROVED' AND (sl.snapshot->>'billable')::boolean) THEN RAISE EXCEPTION 'Freigegebener Festpreisnachweis fehlt';END IF;
   ELSE
    SELECT sl.quantity INTO cap FROM service_report_lines sl JOIN service_reports sr ON sr.tenant_id=sl.tenant_id AND sr.id=sl.report_id WHERE sl.tenant_id=l.tenant_id AND sl.id=l.source_line_id AND sl.item_id=l.item_id AND sr.order_id=r.order_id AND sr.status='APPROVED' AND (sl.snapshot->>'billable')::boolean;
    IF cap IS NULL THEN RAISE EXCEPTION 'Freigegebene fakturierbare SRM-Quelle fehlt';END IF;
   END IF;
   SELECT coalesce(sum(bl.quantity),0) INTO bound FROM billing_request_lines bl JOIN billing_requests br ON br.tenant_id=bl.tenant_id AND br.id=bl.request_id WHERE bl.tenant_id=l.tenant_id AND bl.source_key=l.source_key AND br.status NOT IN ('CANCELLED','REJECTED');
   IF bound>cap THEN RAISE EXCEPTION 'Quellmenge bereits in Fakturaanforderung gebunden';END IF;
  END LOOP;
 END LOOP;
 FOR l IN SELECT bl.id,bl.quantity,br.status,br.order_id FROM billing_request_lines bl JOIN billing_requests br ON br.tenant_id=bl.tenant_id AND br.id=bl.request_id WHERE bl.tenant_id=NEW.tenant_id AND br.order_id=target_order LOOP
  SELECT coalesce(sum(quantity),0) INTO bound FROM invoice_items WHERE tenant_id=NEW.tenant_id AND request_line_id=l.id;
  IF (SELECT coalesce(sum(net),0) FROM invoice_items WHERE tenant_id=NEW.tenant_id AND request_line_id=l.id)>(SELECT net FROM billing_request_lines WHERE tenant_id=NEW.tenant_id AND id=l.id) THEN RAISE EXCEPTION 'Fakturierte Teilbeträge überschreiten freigegebenen Anforderungswert';END IF;
  IF bound>l.quantity OR (bound>0 AND l.status<>'RELEASED') THEN RAISE EXCEPTION 'Fakturierte Menge überschreitet freigegebene Anforderung';END IF;
 END LOOP;
 FOR inv IN SELECT * FROM invoices WHERE tenant_id=NEW.tenant_id AND order_id=target_order LOOP
  SELECT coalesce(sum(round(basis*rate/100,2)),0) INTO vat FROM (SELECT sum(net) AS basis,tax_rate AS rate FROM invoice_items WHERE tenant_id=inv.tenant_id AND invoice_id=inv.id GROUP BY tax_rate) taxes;
  IF NOT inv.sealed OR inv.net<>(SELECT coalesce(sum(net),0) FROM invoice_items WHERE tenant_id=inv.tenant_id AND invoice_id=inv.id) OR inv.tax<>vat THEN RAISE EXCEPTION 'Rechnung benötigt versiegelte, konsistente Positionen und Steuer';END IF;
  IF NOT EXISTS(SELECT 1 FROM journals j WHERE j.tenant_id=inv.tenant_id AND j.id=inv.journal_id AND j.source_id=inv.id AND j.status='POSTED' AND j.company_id=inv.company_id AND j.currency=inv.currency) OR NOT EXISTS(SELECT 1 FROM invoice_open_items op WHERE op.tenant_id=inv.tenant_id AND op.invoice_id=inv.id AND op.company_id=inv.company_id AND op.partner_id=inv.partner_id AND op.amount=inv.gross AND op.currency=inv.currency AND op.due_date=inv.due_date) THEN RAISE EXCEPTION 'Rechnung benötigt zugehörige gebuchte FI und Debitorenposten';END IF;
  IF (SELECT coalesce(sum(amount),0) FROM journal_entries WHERE tenant_id=inv.tenant_id AND journal_id=inv.journal_id AND side='DEBIT')<>inv.gross THEN RAISE EXCEPTION 'Forderungsbetrag stimmt nicht mit Rechnung überein';END IF;
  IF EXISTS(SELECT 1 FROM invoice_items ii JOIN billing_request_lines bl ON bl.tenant_id=ii.tenant_id AND bl.id=ii.request_line_id JOIN billing_requests br ON br.tenant_id=bl.tenant_id AND br.id=bl.request_id WHERE ii.tenant_id=inv.tenant_id AND ii.invoice_id=inv.id AND (br.order_id<>inv.order_id OR br.partner_id<>inv.partner_id OR br.company_id<>inv.company_id OR ii.net<>round(ii.quantity*bl.unit_net,2) OR ii.tax_rate<>bl.tax_rate OR bl.service_to>inv.invoice_date)) THEN RAISE EXCEPTION 'Rechnungsposition passt nicht zur freigegebenen Quelle';END IF;
 END LOOP;RETURN NULL;
END$$;
DO $$DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['billing_requests','billing_request_lines','invoices','invoice_items','invoice_open_items'] LOOP
  EXECUTE format('CREATE CONSTRAINT TRIGGER billing_commit_check AFTER INSERT OR UPDATE ON %I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION billing_integrity()',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['company_billing_profiles','partner_company_accounts','billing_requests','billing_request_lines','invoices','invoice_items','invoice_open_items','invoice_output_jobs','invoice_outputs'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_isolation ON %I USING(tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid) WITH CHECK(tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid)',t);
 END LOOP;
END$$;

CREATE INDEX invoice_source_line ON invoice_items(tenant_id,request_line_id);

-- Validate the exact public output snapshot once, when sealing. Historical
-- invoices do not depend on later changes to live partner/company master data.
CREATE FUNCTION invoice_seal_check() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE c record;p record;b record;a record;l record;s jsonb;BEGIN
 IF NOT NEW.sealed THEN RETURN NEW;END IF;
 SELECT * INTO c FROM company_codes WHERE tenant_id=NEW.tenant_id AND id=NEW.company_id;
 SELECT * INTO p FROM business_partners WHERE tenant_id=NEW.tenant_id AND id=NEW.partner_id;
 SELECT * INTO b FROM company_billing_profiles WHERE tenant_id=NEW.tenant_id AND company_id=NEW.company_id AND status='ACTIVE';
 IF b.id IS NULL OR NOT (jsonb_build_object('number',(SELECT number FROM documents WHERE tenant_id=NEW.tenant_id AND id=NEW.id),'date',NEW.invoice_date::text,'dueDate',NEW.due_date::text,'currency',NEW.currency,'orderNumber',(SELECT number FROM documents WHERE tenant_id=NEW.tenant_id AND id=NEW.order_id),'net',NEW.net::text,'tax',NEW.tax::text,'gross',NEW.gross::text) <@ NEW.snapshot) THEN RAISE EXCEPTION 'Rechnungssnapshot stimmt nicht mit gebuchten Kopfdaten überein';END IF;
 IF NOT (jsonb_build_object('name',c.name,'street',c.street,'postalCode',c.postal_code,'city',c.city,'country',c.country,'vatId',c.vat_id,'iban',b.iban,'bic',b.bic,'email',b.email,'phone',b.phone) = (NEW.snapshot->'seller')) THEN RAISE EXCEPTION 'Rechnungsaussteller entspricht nicht dem freigegebenen Profil';END IF;
 IF NOT (jsonb_build_object('name',p.name,'number',p.number,'vatId',p.vat_id) <@ (NEW.snapshot->'buyer')) OR NOT EXISTS(SELECT 1 FROM partner_addresses pa WHERE pa.tenant_id=NEW.tenant_id AND pa.partner_id=NEW.partner_id AND pa.active AND pa.kind IN ('BILLING','BUSINESS') AND jsonb_build_object('street',pa.street,'postalCode',pa.postal_code,'city',pa.city,'country',pa.country) <@ (NEW.snapshot->'buyer')) THEN RAISE EXCEPTION 'Rechnungsempfänger entspricht nicht dem Kunden';END IF;
 IF jsonb_array_length(NEW.snapshot->'items')<>(SELECT count(*) FROM invoice_items WHERE tenant_id=NEW.tenant_id AND invoice_id=NEW.id) THEN RAISE EXCEPTION 'Rechnungssnapshot benötigt alle Positionen';END IF;
 FOR l IN SELECT ii.*,bl.unit,bl.unit_net,bl.service_from,bl.service_to,bl.snapshot AS source_snapshot FROM invoice_items ii JOIN billing_request_lines bl ON bl.tenant_id=ii.tenant_id AND bl.id=ii.request_line_id WHERE ii.tenant_id=NEW.tenant_id AND ii.invoice_id=NEW.id LOOP
  SELECT value INTO s FROM jsonb_array_elements(NEW.snapshot->'items') WHERE (value->>'position')::integer=l.position;
  IF s IS NULL OR (s->>'quantity')::numeric IS DISTINCT FROM l.quantity OR (s->>'net')::numeric IS DISTINCT FROM l.net OR (s->>'unitNet')::numeric IS DISTINCT FROM l.unit_net OR (s->>'taxRate')::numeric IS DISTINCT FROM l.tax_rate OR s->>'unit' IS DISTINCT FROM l.unit OR s->>'serviceFrom' IS DISTINCT FROM l.service_from::text OR s->>'serviceTo' IS DISTINCT FROM l.service_to::text OR s->>'sku' IS DISTINCT FROM l.source_snapshot->>'sku' OR s->>'description' IS DISTINCT FROM l.source_snapshot->>'description' THEN RAISE EXCEPTION 'Rechnungssnapshot verändert freigegebene Position';END IF;
 END LOOP;
 IF NEW.snapshot->'taxes' IS DISTINCT FROM (SELECT jsonb_agg(jsonb_build_object('rate',trim_scale(rate)::text,'basis',basis::numeric(20,2)::text,'amount',round(basis*rate/100,2)::text) ORDER BY rate) FROM (SELECT tax_rate AS rate,sum(net) AS basis FROM invoice_items WHERE tenant_id=NEW.tenant_id AND invoice_id=NEW.id GROUP BY tax_rate) t) THEN RAISE EXCEPTION 'Steuersnapshot ist inkonsistent';END IF;
 SELECT * INTO a FROM invoice_open_items WHERE tenant_id=NEW.tenant_id AND invoice_id=NEW.id;
 IF (SELECT count(*) FROM journal_entries WHERE tenant_id=NEW.tenant_id AND journal_id=NEW.journal_id AND side='DEBIT')<>1 OR NOT EXISTS(SELECT 1 FROM journal_entries e JOIN gl_accounts g ON g.tenant_id=e.tenant_id AND g.id=e.account_id WHERE e.tenant_id=NEW.tenant_id AND e.journal_id=NEW.journal_id AND e.side='DEBIT' AND e.account_id=a.account_id AND e.partner_id=NEW.partner_id AND e.amount=NEW.gross AND g.kind='RECEIVABLE') THEN RAISE EXCEPTION 'Forderungsbuchung passt nicht zum Debitorenposten';END IF;
 IF (SELECT coalesce(sum(e.amount),0) FROM journal_entries e JOIN gl_accounts g ON g.tenant_id=e.tenant_id AND g.id=e.account_id WHERE e.tenant_id=NEW.tenant_id AND e.journal_id=NEW.journal_id AND e.side='CREDIT' AND g.kind='REVENUE')<>NEW.net OR (SELECT coalesce(sum(e.amount),0) FROM journal_entries e JOIN gl_accounts g ON g.tenant_id=e.tenant_id AND g.id=e.account_id WHERE e.tenant_id=NEW.tenant_id AND e.journal_id=NEW.journal_id AND e.side='CREDIT' AND g.kind='TAX')<>NEW.tax THEN RAISE EXCEPTION 'Erlös-/Steuerbuchung passt nicht zur Rechnung';END IF;
 RETURN NEW;
END$$;
CREATE TRIGGER invoice_seal BEFORE INSERT OR UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION invoice_seal_check();
