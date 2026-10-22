ALTER TABLE documents DROP CONSTRAINT documents_kind_check;
ALTER TABLE documents ADD CONSTRAINT documents_kind_check CHECK(kind IN ('WORK_ORDER_TASK','TICKET','SERVICE_CASE','BUSINESS_PARTNER','APPROVAL','TECHNICAL_OBJECT','SERVICE_CONTRACT','FIELD_VISIT','SERVICE_ORDER','MATERIAL','MATERIAL_REQUIREMENT','REQUISITION','PURCHASE_ORDER','GOODS_RECEIPT','GOODS_ISSUE','SERVICE_REPORT','INVOICE','CANCELLATION','ACCOUNTING','PAYMENT','QUOTATION','SALES_ORDER','CREDIT_NOTE','BILLING_REQUEST','PARTNER_ACCOUNT','COMPANY_BILLING_PROFILE','SUPPLIER_INVOICE'));
CREATE TABLE supplier_invoices (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,company_id uuid NOT NULL,supplier_id uuid,purchase_order_id uuid,order_id uuid,
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','CANCELLED')),version integer NOT NULL DEFAULT 1 CHECK(version>0),
 external_number text NOT NULL DEFAULT '' CHECK(length(external_number)<=120),external_key text GENERATED ALWAYS AS (upper(regexp_replace(btrim(external_number),'[[:space:]]','','g'))) STORED,
 invoice_date date,due_date date,currency text CHECK(currency ~ '^[A-Z]{3}$'),net numeric(20,2),tax numeric(20,2),gross numeric(20,2),
 CHECK(net IS NULL OR net>0),CHECK(tax IS NULL OR tax>=0),CHECK(gross IS NULL OR gross=net+tax),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,id,company_id),FOREIGN KEY(tenant_id,id) REFERENCES documents(tenant_id,id),FOREIGN KEY(tenant_id,company_id) REFERENCES company_codes(tenant_id,id),FOREIGN KEY(tenant_id,supplier_id) REFERENCES business_partners(tenant_id,id),FOREIGN KEY(tenant_id,purchase_order_id) REFERENCES purchase_orders(tenant_id,id),FOREIGN KEY(tenant_id,order_id) REFERENCES service_orders(tenant_id,id)
);
CREATE TABLE supplier_invoice_originals (
 invoice_id uuid PRIMARY KEY,tenant_id uuid NOT NULL,company_id uuid NOT NULL,filename text NOT NULL,media_type text NOT NULL CHECK(media_type IN ('application/xml','application/pdf')),
 content bytea NOT NULL CHECK(octet_length(content) BETWEEN 1 AND 5242880),sha256 text NOT NULL CHECK(sha256=encode(sha256(content),'hex')),received_at timestamptz NOT NULL DEFAULT now(),received_by uuid NOT NULL,
 UNIQUE(tenant_id,company_id,sha256),FOREIGN KEY(tenant_id,invoice_id,company_id) REFERENCES supplier_invoices(tenant_id,id,company_id),FOREIGN KEY(tenant_id,company_id) REFERENCES company_codes(tenant_id,id),FOREIGN KEY(tenant_id,received_by) REFERENCES users(tenant_id,id)
);
CREATE TABLE supplier_invoice_imports (
 invoice_id uuid PRIMARY KEY,tenant_id uuid NOT NULL,state text NOT NULL DEFAULT 'PENDING' CHECK(state IN ('PENDING','PROCESSING','VALIDATED','INVALID','UNSUPPORTED','QUARANTINE','FAILED')),
 scan_status text NOT NULL DEFAULT 'PENDING' CHECK(scan_status IN ('PENDING','CLEAN','STRUCTURAL_XML','INFECTED','UNAVAILABLE')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),token uuid,started_at timestamptz,completed_at timestamptz,last_error text NOT NULL DEFAULT '',
 xml bytea,xml_sha256 text,parsed jsonb,validator text,validation_report text,
 CHECK(xml IS NULL OR (octet_length(xml) BETWEEN 1 AND 5242880 AND xml_sha256=encode(sha256(xml),'hex'))),
 -- Technical validity is historical. A later malware finding must still be
 -- able to revoke access without changing the validated canonical extraction.
 CHECK(state<>'VALIDATED' OR (xml IS NOT NULL AND parsed IS NOT NULL AND validator IS NOT NULL AND validation_report IS NOT NULL AND completed_at IS NOT NULL)),
 FOREIGN KEY(tenant_id,invoice_id) REFERENCES supplier_invoices(tenant_id,id)
);
CREATE TABLE supplier_invoice_scans (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,invoice_id uuid NOT NULL,status text NOT NULL CHECK(status IN ('CLEAN','INFECTED','UNAVAILABLE','STRUCTURAL_XML')),engine text NOT NULL,detail text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),created_by uuid NOT NULL,
 FOREIGN KEY(tenant_id,invoice_id) REFERENCES supplier_invoices(tenant_id,id),FOREIGN KEY(tenant_id,created_by) REFERENCES users(tenant_id,id)
);
CREATE TABLE supplier_invoice_items (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,invoice_id uuid NOT NULL,position integer NOT NULL,external_position text NOT NULL,sku text NOT NULL,description text NOT NULL,
 quantity numeric(18,6) NOT NULL CHECK(quantity>0),unit text NOT NULL,unit_net numeric(30,12) NOT NULL CHECK(unit_net>=0),net numeric(20,2) NOT NULL CHECK(net>=0),tax_rate numeric(7,4) NOT NULL CHECK(tax_rate>0 AND tax_rate<=100),
 service_from date,service_to date,purchase_order_position text NOT NULL DEFAULT '',purchase_order_item_id uuid,
 CHECK(service_from IS NULL OR service_to IS NULL OR service_to>=service_from),CHECK(net=round(quantity*unit_net,2)),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,invoice_id,position),UNIQUE(tenant_id,invoice_id,external_position),FOREIGN KEY(tenant_id,invoice_id) REFERENCES supplier_invoices(tenant_id,id),FOREIGN KEY(tenant_id,purchase_order_item_id) REFERENCES purchase_order_items(tenant_id,id)
);
CREATE INDEX supplier_invoice_duplicates ON supplier_invoices(tenant_id,company_id,external_key) WHERE external_number<>'';
CREATE TRIGGER supplier_original_immutable BEFORE UPDATE OR DELETE ON supplier_invoice_originals FOR EACH ROW EXECUTE FUNCTION reject_attachment_mutation();
CREATE TRIGGER supplier_scan_immutable BEFORE UPDATE OR DELETE ON supplier_invoice_scans FOR EACH ROW EXECUTE FUNCTION reject_attachment_mutation();
CREATE FUNCTION supplier_import_frozen() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Rechnungseingangsprüfung bleibt erhalten';END IF;
 IF OLD.state='VALIDATED' AND (to_jsonb(NEW)-'scan_status'-'last_error') IS DISTINCT FROM (to_jsonb(OLD)-'scan_status'-'last_error') THEN RAISE EXCEPTION 'Validierte Originalextraktion ist unveränderlich';END IF;
 RETURN NEW;
END$$;
CREATE TRIGGER supplier_import_no_change BEFORE UPDATE OR DELETE ON supplier_invoice_imports FOR EACH ROW EXECUTE FUNCTION supplier_import_frozen();
CREATE FUNCTION supplier_item_frozen() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
 IF TG_OP='DELETE' OR (to_jsonb(NEW)-'purchase_order_item_id') IS DISTINCT FROM (to_jsonb(OLD)-'purchase_order_item_id') THEN RAISE EXCEPTION 'Aus dem Original übernommene Rechnungsposition ist unveränderlich';END IF;
 IF NOT EXISTS(SELECT 1 FROM supplier_invoices WHERE tenant_id=OLD.tenant_id AND id=OLD.invoice_id AND status='DRAFT') THEN RAISE EXCEPTION 'Rechnungszuordnung ist nicht mehr änderbar';END IF;
 RETURN NEW;
END$$;
CREATE TRIGGER supplier_item_no_change BEFORE UPDATE OR DELETE ON supplier_invoice_items FOR EACH ROW EXECUTE FUNCTION supplier_item_frozen();
CREATE FUNCTION supplier_header_original_fields() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Rechnungseingang und Original bleiben erhalten';END IF;
 IF NEW.company_id<>OLD.company_id OR NEW.tenant_id<>OLD.tenant_id OR NEW.id<>OLD.id THEN RAISE EXCEPTION 'Rechnungseingangsidentität ist unveränderlich';END IF;
 IF EXISTS(SELECT 1 FROM supplier_invoice_imports WHERE tenant_id=OLD.tenant_id AND invoice_id=OLD.id AND state='VALIDATED') AND ROW(NEW.external_number,NEW.invoice_date,NEW.due_date,NEW.currency,NEW.net,NEW.tax,NEW.gross) IS DISTINCT FROM ROW(OLD.external_number,OLD.invoice_date,OLD.due_date,OLD.currency,OLD.net,OLD.tax,OLD.gross) THEN RAISE EXCEPTION 'Aus dem Original übernommene Rechnungswerte sind unveränderlich';END IF;
 RETURN NEW;
END$$;
CREATE TRIGGER supplier_header_original_frozen BEFORE UPDATE OR DELETE ON supplier_invoices FOR EACH ROW EXECUTE FUNCTION supplier_header_original_fields();
DO $$DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['supplier_invoices','supplier_invoice_originals','supplier_invoice_imports','supplier_invoice_scans','supplier_invoice_items'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_isolation ON %I USING(tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid) WITH CHECK(tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid)',t);
 END LOOP;
END$$;
