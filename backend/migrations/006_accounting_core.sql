CREATE TABLE company_codes (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,organization_id uuid NOT NULL,code text NOT NULL,name text NOT NULL,currency text NOT NULL,country text NOT NULL,street text NOT NULL,postal_code text NOT NULL,city text NOT NULL,vat_id text NOT NULL,version integer NOT NULL DEFAULT 1,
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,code),UNIQUE(tenant_id,organization_id),FOREIGN KEY(tenant_id,organization_id) REFERENCES organizations(tenant_id,id),FOREIGN KEY(tenant_id,currency) REFERENCES currencies(tenant_id,code)
);
CREATE TABLE gl_accounts (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,company_id uuid NOT NULL,code text NOT NULL,name text NOT NULL,kind text NOT NULL CHECK(kind IN ('ASSET','LIABILITY','EQUITY','EXPENSE','REVENUE','RECEIVABLE','PAYABLE','TAX','BANK')),active boolean NOT NULL DEFAULT true,version integer NOT NULL DEFAULT 1,
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,company_id,code),FOREIGN KEY(tenant_id,company_id) REFERENCES company_codes(tenant_id,id)
);
CREATE TABLE fiscal_periods (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,company_id uuid NOT NULL,year integer NOT NULL,period integer NOT NULL CHECK(period BETWEEN 1 AND 16),date_from date NOT NULL,date_to date NOT NULL,status text NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','CLOSED')),version integer NOT NULL DEFAULT 1,CHECK(date_to>=date_from),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,company_id,year,period),FOREIGN KEY(tenant_id,company_id) REFERENCES company_codes(tenant_id,id)
);
CREATE TABLE journals (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,company_id uuid NOT NULL,period_id uuid NOT NULL,posting_date date NOT NULL,document_date date NOT NULL,description text NOT NULL,reference text NOT NULL,currency text NOT NULL,source_id uuid,reversal_of uuid,reason text,
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','IN_REVIEW','APPROVED','REJECTED','POSTED')),version integer NOT NULL DEFAULT 1,posted_at timestamptz,posted_by uuid,content_hash text,
 UNIQUE(tenant_id,id),FOREIGN KEY(tenant_id,id) REFERENCES documents(tenant_id,id),FOREIGN KEY(tenant_id,company_id) REFERENCES company_codes(tenant_id,id),FOREIGN KEY(tenant_id,period_id) REFERENCES fiscal_periods(tenant_id,id),FOREIGN KEY(tenant_id,source_id) REFERENCES documents(tenant_id,id),FOREIGN KEY(tenant_id,reversal_of) REFERENCES journals(tenant_id,id),FOREIGN KEY(tenant_id,currency) REFERENCES currencies(tenant_id,code),FOREIGN KEY(tenant_id,posted_by) REFERENCES users(tenant_id,id)
);
CREATE UNIQUE INDEX journal_source_once ON journals(tenant_id,source_id) WHERE source_id IS NOT NULL AND status='POSTED';
CREATE UNIQUE INDEX journal_reversal_once ON journals(tenant_id,reversal_of) WHERE reversal_of IS NOT NULL AND status='POSTED';
CREATE TABLE journal_entries (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,journal_id uuid NOT NULL,position integer NOT NULL,account_id uuid NOT NULL,side text NOT NULL CHECK(side IN ('DEBIT','CREDIT')),amount numeric(20,4) NOT NULL CHECK(amount>0),description text NOT NULL,cost_center text,partner_id uuid,tax_code text,
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,journal_id,position),FOREIGN KEY(tenant_id,journal_id) REFERENCES journals(tenant_id,id),FOREIGN KEY(tenant_id,account_id) REFERENCES gl_accounts(tenant_id,id),FOREIGN KEY(tenant_id,partner_id) REFERENCES business_partners(tenant_id,id)
);
CREATE TABLE accounting_rules (
 tenant_id uuid NOT NULL,company_id uuid NOT NULL,event text NOT NULL CHECK(event IN ('STOCK_OPENING','STOCK_RECEIPT','STOCK_ISSUE','SALES_INVOICE','PURCHASE_INVOICE','CUSTOMER_PAYMENT','SUPPLIER_PAYMENT')),role text NOT NULL,account_id uuid NOT NULL,version integer NOT NULL DEFAULT 1,
 PRIMARY KEY(tenant_id,company_id,event,role),FOREIGN KEY(tenant_id,company_id) REFERENCES company_codes(tenant_id,id),FOREIGN KEY(tenant_id,account_id) REFERENCES gl_accounts(tenant_id,id)
);
CREATE FUNCTION journal_frozen() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
 IF OLD.status='POSTED' THEN RAISE EXCEPTION 'Gebuchter Journalbeleg ist unveränderlich';END IF;IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;
END$$;
CREATE TRIGGER journal_no_change BEFORE UPDATE OR DELETE ON journals FOR EACH ROW EXECUTE FUNCTION journal_frozen();
CREATE FUNCTION journal_line_frozen() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE j uuid;BEGIN
 IF TG_OP='DELETE' THEN j=OLD.journal_id;ELSE j=NEW.journal_id;END IF;
 IF EXISTS(SELECT 1 FROM journals WHERE tenant_id=COALESCE(NEW.tenant_id,OLD.tenant_id) AND id=j AND status='POSTED') THEN RAISE EXCEPTION 'Gebuchte Journalposition ist unveränderlich';END IF;
 IF TG_OP='UPDATE' AND EXISTS(SELECT 1 FROM journals WHERE tenant_id=OLD.tenant_id AND id=OLD.journal_id AND status='POSTED') THEN RAISE EXCEPTION 'Gebuchte Journalposition ist unveränderlich';END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;
END$$;
CREATE TRIGGER journal_line_no_change BEFORE INSERT OR UPDATE OR DELETE ON journal_entries FOR EACH ROW EXECUTE FUNCTION journal_line_frozen();
CREATE FUNCTION journal_balanced() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE balance numeric;cnt integer;invalid integer;BEGIN
 IF NEW.status='POSTED' THEN
 SELECT count(*),coalesce(sum(CASE WHEN e.side='DEBIT' THEN e.amount ELSE -e.amount END),0),count(*) FILTER(WHERE a.company_id<>NEW.company_id OR NOT a.active OR e.amount<>round(e.amount,c.digits)) INTO cnt,balance,invalid FROM journal_entries e JOIN gl_accounts a ON a.tenant_id=e.tenant_id AND a.id=e.account_id JOIN currencies c ON c.tenant_id=e.tenant_id AND c.code=NEW.currency WHERE e.tenant_id=NEW.tenant_id AND e.journal_id=NEW.id;
 IF cnt<2 OR balance<>0 OR invalid<>0 THEN RAISE EXCEPTION 'Journal ist unausgeglichen oder enthält ungültige Konten/Beträge';END IF;
 IF NOT EXISTS(SELECT 1 FROM fiscal_periods p JOIN company_codes c ON c.tenant_id=p.tenant_id AND c.id=p.company_id WHERE p.tenant_id=NEW.tenant_id AND p.id=NEW.period_id AND p.company_id=NEW.company_id AND p.status='OPEN' AND NEW.posting_date BETWEEN p.date_from AND p.date_to AND c.currency=NEW.currency) THEN RAISE EXCEPTION 'Buchungsperiode oder Währung unzulässig';END IF;
 IF NEW.posted_at IS NULL OR NEW.posted_by IS NULL OR NEW.content_hash IS NULL THEN RAISE EXCEPTION 'Buchungsmetadaten fehlen';END IF;
 END IF;RETURN NEW;
END$$;
CREATE CONSTRAINT TRIGGER journal_check AFTER INSERT OR UPDATE ON journals DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION journal_balanced();
DO $$DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['company_codes','gl_accounts','fiscal_periods','journals','journal_entries','accounting_rules'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid) WITH CHECK (tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid)',t);
 END LOOP;
END$$;
