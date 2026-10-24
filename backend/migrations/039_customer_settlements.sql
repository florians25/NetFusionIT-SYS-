-- Actual, manually recorded customer bank movements. No bank transfer is initiated.
CREATE TABLE customer_settlements(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,invoice_id uuid NOT NULL,company_id uuid NOT NULL,period_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN('RECEIPT','REFUND','REVERSAL')),original_id uuid,bank_account_id uuid NOT NULL,
 amount numeric(20,2) NOT NULL CHECK(amount>0),currency text NOT NULL,posting_date date NOT NULL,document_date date NOT NULL,
 reference text NOT NULL CHECK(length(trim(reference)) BETWEEN 3 AND 140),reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 15 AND 2000),
 prepared_by uuid NOT NULL,status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN('DRAFT','APPROVED','POSTED','CANCELLED')),version int NOT NULL DEFAULT 1 CHECK(version>0),
 reviewed_by uuid,reviewed_at timestamptz,review_note text,journal_id uuid,sealed boolean NOT NULL DEFAULT false,posted_at timestamptz,
 CHECK((kind='REVERSAL')=(original_id IS NOT NULL)),CHECK((status='POSTED')=sealed),CHECK(NOT sealed OR(journal_id IS NOT NULL AND reviewed_by IS NOT NULL AND posted_at IS NOT NULL)),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,journal_id),
 FOREIGN KEY(tenant_id,id) REFERENCES documents(tenant_id,id),FOREIGN KEY(tenant_id,invoice_id) REFERENCES invoices(tenant_id,id),FOREIGN KEY(tenant_id,company_id) REFERENCES company_codes(tenant_id,id),FOREIGN KEY(tenant_id,period_id) REFERENCES fiscal_periods(tenant_id,id),FOREIGN KEY(tenant_id,bank_account_id) REFERENCES gl_accounts(tenant_id,id),FOREIGN KEY(tenant_id,prepared_by) REFERENCES users(tenant_id,id),FOREIGN KEY(tenant_id,reviewed_by) REFERENCES users(tenant_id,id),FOREIGN KEY(tenant_id,journal_id) REFERENCES journals(tenant_id,id),FOREIGN KEY(tenant_id,original_id) REFERENCES customer_settlements(tenant_id,id)
);
CREATE UNIQUE INDEX settlement_reversal_once ON customer_settlements(tenant_id,original_id) WHERE kind='REVERSAL' AND status<>'CANCELLED';
CREATE INDEX settlement_invoice_posting ON customer_settlements(tenant_id,invoice_id,posting_date) WHERE sealed;
CREATE TABLE customer_settlement_reviews(
 tenant_id uuid NOT NULL,settlement_id uuid NOT NULL,actor_id uuid NOT NULL,reviewed_at timestamptz NOT NULL,prepared_hash text NOT NULL,note text NOT NULL CHECK(length(trim(note)) BETWEEN 15 AND 2000),
 PRIMARY KEY(tenant_id,settlement_id),FOREIGN KEY(tenant_id,settlement_id) REFERENCES customer_settlements(tenant_id,id),FOREIGN KEY(tenant_id,actor_id) REFERENCES users(tenant_id,id)
);
CREATE TRIGGER settlement_review_immutable BEFORE UPDATE OR DELETE ON customer_settlement_reviews FOR EACH ROW EXECUTE FUNCTION reject_attachment_mutation();
DO $$DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['customer_settlements','customer_settlement_reviews'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);EXECUTE format('CREATE POLICY tenant_isolation ON %I USING(tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid) WITH CHECK(tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid)',t);
END LOOP;END$$;
CREATE FUNCTION settlement_prepared(h customer_settlements) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$SELECT to_jsonb(h)-ARRAY['status','version','reviewed_by','reviewed_at','review_note','journal_id','sealed','posted_at']$$;
CREATE FUNCTION customer_invoice_balance_at(t uuid,inv uuid,day date,exclude_id uuid DEFAULT NULL) RETURNS numeric LANGUAGE sql STABLE AS $$
 SELECT (o.amount-coalesce((SELECT sum(c.amount) FROM customer_credit_open_items c JOIN customer_credit_memos h ON h.tenant_id=c.tenant_id AND h.id=c.credit_id WHERE c.tenant_id=t AND c.invoice_id=inv AND h.sealed AND h.posting_date<=day),0)
 +coalesce((SELECT sum(CASE s.kind WHEN 'RECEIPT' THEN -s.amount WHEN 'REFUND' THEN s.amount ELSE CASE orig.kind WHEN 'RECEIPT' THEN s.amount ELSE -s.amount END END) FROM customer_settlements s LEFT JOIN customer_settlements orig ON orig.tenant_id=s.tenant_id AND orig.id=s.original_id WHERE s.tenant_id=t AND s.invoice_id=inv AND s.sealed AND s.posting_date<=day AND s.id IS DISTINCT FROM exclude_id),0))::numeric(20,2)
 FROM invoice_open_items o JOIN invoices i ON i.tenant_id=o.tenant_id AND i.id=o.invoice_id WHERE o.tenant_id=t AND o.invoice_id=inv AND i.sealed AND i.posting_date<=day
$$;
CREATE OR REPLACE VIEW customer_invoice_balances WITH(security_invoker=true) AS
 SELECT o.*,customer_invoice_balance_at(o.tenant_id,o.invoice_id,'9999-12-31')::numeric(20,2) AS balance,
 (SELECT c.id FROM customer_credit_memos c WHERE c.tenant_id=o.tenant_id AND c.invoice_id=o.invoice_id AND c.sealed ORDER BY c.posted_at DESC,c.id DESC LIMIT 1) AS credit_id,
 (SELECT max(c.posted_at) FROM customer_credit_memos c WHERE c.tenant_id=o.tenant_id AND c.invoice_id=o.invoice_id AND c.sealed) AS credited_at FROM invoice_open_items o;
CREATE FUNCTION settlement_guard() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
 IF TG_OP='DELETE' OR OLD.sealed OR OLD.status='CANCELLED' THEN RAISE EXCEPTION 'Zahlungsbeleg und Historie sind unveränderlich';END IF;
 IF settlement_prepared(OLD) IS DISTINCT FROM settlement_prepared(NEW) OR NEW.version<>OLD.version+1 OR NOT((OLD.status='DRAFT' AND NEW.status IN('APPROVED','CANCELLED')) OR(OLD.status='APPROVED' AND NEW.status IN('POSTED','CANCELLED'))) THEN RAISE EXCEPTION 'Zahlungsprüfstand bleibt unverändert; zulässigen Folgestatus verwenden';END IF;
 IF OLD.status='APPROVED' AND (OLD.reviewed_by,OLD.reviewed_at,OLD.review_note) IS DISTINCT FROM (NEW.reviewed_by,NEW.reviewed_at,NEW.review_note) THEN RAISE EXCEPTION 'Unabhängige Zahlungsprüfung bleibt unverändert';END IF;RETURN NEW;
END$$;
CREATE TRIGGER settlement_frozen BEFORE UPDATE OR DELETE ON customer_settlements FOR EACH ROW EXECUTE FUNCTION settlement_guard();
CREATE FUNCTION validate_customer_settlement() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE h customer_settlements;i invoices;o invoice_open_items;d documents;orig customer_settlements;j journals;b numeric;effective_kind text;expected jsonb;actual jsonb;
BEGIN
 IF TG_TABLE_NAME='journals' THEN SELECT * INTO h FROM customer_settlements WHERE tenant_id=NEW.tenant_id AND id=NEW.source_id;
  IF h.id IS NULL THEN IF EXISTS(SELECT 1 FROM customer_settlements s WHERE s.tenant_id=NEW.tenant_id AND s.journal_id=NEW.reversal_of AND s.sealed) THEN RAISE EXCEPTION 'Zahlungs-FI nur durch geprüften Zahlungsstorno gegenbuchen';END IF;RETURN NULL;END IF;
 ELSIF TG_TABLE_NAME='customer_settlement_reviews' THEN SELECT * INTO h FROM customer_settlements WHERE tenant_id=NEW.tenant_id AND id=NEW.settlement_id;
 ELSE SELECT * INTO h FROM customer_settlements WHERE tenant_id=NEW.tenant_id AND id=NEW.id;END IF;
 PERFORM 1 FROM company_codes WHERE tenant_id=h.tenant_id AND id=h.company_id FOR UPDATE;
 SELECT * INTO i FROM invoices WHERE tenant_id=h.tenant_id AND id=h.invoice_id FOR UPDATE;
 SELECT * INTO o FROM invoice_open_items WHERE tenant_id=h.tenant_id AND invoice_id=h.invoice_id;SELECT * INTO d FROM documents WHERE tenant_id=h.tenant_id AND id=h.id;
 IF i.id IS NULL OR NOT i.sealed OR o.invoice_id IS NULL OR h.company_id<>i.company_id OR h.currency<>i.currency OR d.kind<>'PAYMENT' OR d.organization_id<>(SELECT organization_id FROM documents WHERE tenant_id=i.tenant_id AND id=i.id) OR d.created_by<>h.prepared_by THEN RAISE EXCEPTION 'Passende gebuchte Kundenrechnung und Zahlungsidentität fehlen';END IF;
 IF h.kind='REVERSAL' THEN SELECT * INTO orig FROM customer_settlements WHERE tenant_id=h.tenant_id AND id=h.original_id;
  IF orig.id IS NULL OR NOT orig.sealed OR orig.kind='REVERSAL' OR (h.invoice_id,h.company_id,h.bank_account_id,h.currency,h.amount) IS DISTINCT FROM(orig.invoice_id,orig.company_id,orig.bank_account_id,orig.currency,orig.amount) OR h.posting_date<orig.posting_date THEN RAISE EXCEPTION 'Zahlungsstorno muss unveränderten gebuchten Originalbetrag und Konten gegenbuchen';END IF;
 END IF;
 IF h.status IN('APPROVED','POSTED') AND NOT EXISTS(SELECT 1 FROM customer_settlement_reviews r JOIN users u ON u.tenant_id=r.tenant_id AND u.id=r.actor_id WHERE r.tenant_id=h.tenant_id AND r.settlement_id=h.id AND r.actor_id=h.reviewed_by AND r.actor_id<>h.prepared_by AND r.reviewed_at=h.reviewed_at AND r.note=h.review_note AND r.prepared_hash=encode(sha256(convert_to(settlement_prepared(h)::text,'UTF8')),'hex') AND u.active AND u.role IN('ADMIN','ACCOUNTANT') AND EXISTS(SELECT 1 FROM user_organizations uo WHERE uo.tenant_id=u.tenant_id AND uo.user_id=u.id AND uo.organization_id=d.organization_id)) THEN RAISE EXCEPTION 'Unabhängige Finanzprüfung des unveränderten Zahlungsprüfstands fehlt';END IF;
 IF NOT h.sealed THEN IF h.journal_id IS NOT NULL OR EXISTS(SELECT 1 FROM journals WHERE tenant_id=h.tenant_id AND source_id=h.id) THEN RAISE EXCEPTION 'Zahlungs-FI benötigt gebuchten Zahlungsbeleg';END IF;RETURN NULL;END IF;
 IF h.posting_date<i.posting_date OR h.document_date<i.invoice_date OR h.posting_date>(now() AT TIME ZONE 'Europe/Berlin')::date OR h.document_date>(now() AT TIME ZONE 'Europe/Berlin')::date OR NOT EXISTS(SELECT 1 FROM fiscal_periods p WHERE p.tenant_id=h.tenant_id AND p.id=h.period_id AND p.company_id=h.company_id AND p.status='OPEN' AND h.posting_date BETWEEN p.date_from AND p.date_to) THEN RAISE EXCEPTION 'Zahlungsdatum oder offene Buchungsperiode unzulässig';END IF;
 IF EXISTS(SELECT 1 FROM customer_settlements s WHERE s.tenant_id=h.tenant_id AND s.invoice_id=h.invoice_id AND s.sealed AND s.id<>h.id AND s.posting_date>h.posting_date) THEN RAISE EXCEPTION 'Zahlung darf nicht vor bereits gebuchten Zahlungsbewegungen liegen';END IF;
 IF NOT EXISTS(SELECT 1 FROM gl_accounts a WHERE a.tenant_id=h.tenant_id AND a.id=h.bank_account_id AND a.company_id=h.company_id AND a.active AND a.kind='BANK') OR NOT EXISTS(SELECT 1 FROM gl_accounts a WHERE a.tenant_id=h.tenant_id AND a.id=o.account_id AND a.company_id=h.company_id AND a.active AND a.kind='RECEIVABLE') THEN RAISE EXCEPTION 'Aktives Bankkonto und ursprüngliches Forderungskonto erforderlich';END IF;
 b=customer_invoice_balance_at(h.tenant_id,h.invoice_id,h.posting_date,h.id);
 IF h.kind='RECEIPT' AND (h.amount>b OR h.amount>customer_invoice_balance_at(h.tenant_id,h.invoice_id,'9999-12-31',h.id)) THEN RAISE EXCEPTION 'Zahlung übersteigt offene Forderung';END IF;
 IF h.kind='REFUND' AND (h.amount> -b OR h.amount> -customer_invoice_balance_at(h.tenant_id,h.invoice_id,'9999-12-31',h.id)) THEN RAISE EXCEPTION 'Rückzahlung übersteigt tatsächliches Kundenguthaben';END IF;
 IF h.kind='REVERSAL' AND orig.kind='RECEIPT' AND EXISTS(SELECT 1 FROM customer_settlements s WHERE s.tenant_id=h.tenant_id AND s.invoice_id=h.invoice_id AND s.kind='REFUND' AND s.sealed AND NOT EXISTS(SELECT 1 FROM customer_settlements rev WHERE rev.tenant_id=s.tenant_id AND rev.original_id=s.id AND rev.sealed)) THEN RAISE EXCEPTION 'Aktive Kundenrückzahlungen zuerst gegenbuchen';END IF;
 SELECT * INTO j FROM journals WHERE tenant_id=h.tenant_id AND id=h.journal_id;
 IF j.id IS NULL OR j.status<>'POSTED' OR j.source_id IS DISTINCT FROM h.id OR j.company_id<>h.company_id OR j.period_id<>h.period_id OR j.posting_date<>h.posting_date OR j.document_date<>h.document_date OR j.currency<>h.currency OR j.reversal_of IS DISTINCT FROM orig.journal_id THEN RAISE EXCEPTION 'Passende gebuchte Zahlungs-FI fehlt';END IF;
 effective_kind=CASE WHEN h.kind='REVERSAL' THEN orig.kind ELSE h.kind END;
 IF h.kind='REVERSAL' THEN
  SELECT jsonb_agg(jsonb_build_array(account_id,CASE side WHEN 'DEBIT' THEN 'CREDIT' ELSE 'DEBIT' END,amount,cost_center,partner_id,tax_code,description) ORDER BY position) INTO expected FROM journal_entries WHERE tenant_id=h.tenant_id AND journal_id=orig.journal_id;
 ELSE expected=jsonb_build_array(jsonb_build_array(h.bank_account_id,CASE h.kind WHEN 'RECEIPT' THEN 'DEBIT' ELSE 'CREDIT' END,h.amount,NULL,NULL,NULL,h.reference),jsonb_build_array(o.account_id,CASE h.kind WHEN 'RECEIPT' THEN 'CREDIT' ELSE 'DEBIT' END,h.amount,NULL,o.partner_id,NULL,h.reference));END IF;
 SELECT jsonb_agg(jsonb_build_array(account_id,side,amount,cost_center,partner_id,tax_code,description) ORDER BY position) INTO actual FROM journal_entries WHERE tenant_id=h.tenant_id AND journal_id=j.id;
 IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Zahlung muss ausschließlich Bank und ursprüngliche Debitorenkontierung buchen';END IF;
 RETURN NULL;
END$$;
CREATE CONSTRAINT TRIGGER settlement_commit_check AFTER INSERT OR UPDATE ON customer_settlements DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_customer_settlement();
CREATE CONSTRAINT TRIGGER settlement_review_check AFTER INSERT ON customer_settlement_reviews DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_customer_settlement();
CREATE CONSTRAINT TRIGGER settlement_journal_check AFTER INSERT OR UPDATE ON journals DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_customer_settlement();
