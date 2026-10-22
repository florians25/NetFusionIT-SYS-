-- Internal reversal of an unpaid posted invoice. The supplier original, its
-- allocations and the initial open item remain immutable historical records.
ALTER TABLE documents DROP CONSTRAINT documents_kind_check;
ALTER TABLE documents ADD CONSTRAINT documents_kind_check CHECK(kind IN ('WORK_ORDER_TASK','TICKET','SERVICE_CASE','BUSINESS_PARTNER','APPROVAL','TECHNICAL_OBJECT','SERVICE_CONTRACT','FIELD_VISIT','SERVICE_ORDER','MATERIAL','MATERIAL_REQUIREMENT','REQUISITION','PURCHASE_ORDER','GOODS_RECEIPT','GOODS_ISSUE','SERVICE_REPORT','INVOICE','CANCELLATION','ACCOUNTING','PAYMENT','QUOTATION','SALES_ORDER','CREDIT_NOTE','BILLING_REQUEST','PARTNER_ACCOUNT','COMPANY_BILLING_PROFILE','SUPPLIER_INVOICE','SUPPLIER_INVOICE_REVERSAL'));
CREATE TABLE supplier_invoice_reversals(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,invoice_id uuid NOT NULL,company_id uuid NOT NULL,
 period_id uuid NOT NULL,posting_date date NOT NULL,document_date date NOT NULL,reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 15 AND 2000),
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','IN_REVIEW','APPROVED','REJECTED','POSTED')),version integer NOT NULL DEFAULT 1 CHECK(version>0),
 prepared_by uuid NOT NULL,prepared_at timestamptz NOT NULL,prepared_snapshot jsonb NOT NULL,
 reviewed_by uuid,reviewed_at timestamptz,review_note text,journal_id uuid,snapshot jsonb,sealed boolean NOT NULL DEFAULT false,posted_at timestamptz,
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,invoice_id),UNIQUE(tenant_id,journal_id),
 FOREIGN KEY(tenant_id,id) REFERENCES documents(tenant_id,id),FOREIGN KEY(tenant_id,invoice_id) REFERENCES supplier_invoices(tenant_id,id),
 FOREIGN KEY(tenant_id,company_id) REFERENCES company_codes(tenant_id,id),FOREIGN KEY(tenant_id,period_id) REFERENCES fiscal_periods(tenant_id,id),
 FOREIGN KEY(tenant_id,prepared_by) REFERENCES users(tenant_id,id),FOREIGN KEY(tenant_id,reviewed_by) REFERENCES users(tenant_id,id),FOREIGN KEY(tenant_id,journal_id) REFERENCES journals(tenant_id,id),
 CHECK((status='POSTED')=sealed),CHECK(NOT sealed OR (journal_id IS NOT NULL AND snapshot IS NOT NULL AND posted_at IS NOT NULL AND reviewed_by IS NOT NULL))
);
ALTER TABLE supplier_invoice_reversals ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_invoice_reversals FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON supplier_invoice_reversals USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
CREATE FUNCTION supplier_reversal_frozen() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
 IF TG_OP='DELETE' OR OLD.sealed THEN RAISE EXCEPTION 'Stornobeleg und gebuchte Historie sind unveränderlich';END IF;
 IF ROW(NEW.id,NEW.tenant_id,NEW.invoice_id,NEW.company_id) IS DISTINCT FROM ROW(OLD.id,OLD.tenant_id,OLD.invoice_id,OLD.company_id) THEN RAISE EXCEPTION 'Ursprung des Stornobelegs ist unveränderlich';END IF;
 IF OLD.status NOT IN ('DRAFT','REJECTED') AND ROW(NEW.period_id,NEW.posting_date,NEW.document_date,NEW.reason,NEW.prepared_by,NEW.prepared_at,NEW.prepared_snapshot) IS DISTINCT FROM ROW(OLD.period_id,OLD.posting_date,OLD.document_date,OLD.reason,OLD.prepared_by,OLD.prepared_at,OLD.prepared_snapshot) THEN RAISE EXCEPTION 'Eingereichter Storno-Prüfstand ist unveränderlich';END IF;
 RETURN NEW;
END$$;
CREATE TRIGGER supplier_reversal_no_change BEFORE UPDATE OR DELETE ON supplier_invoice_reversals FOR EACH ROW EXECUTE FUNCTION supplier_reversal_frozen();
CREATE FUNCTION supplier_invoice_effective(t uuid,inv uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT EXISTS(SELECT 1 FROM supplier_invoices i WHERE i.tenant_id=t AND i.id=inv AND i.sealed AND NOT EXISTS(SELECT 1 FROM supplier_invoice_reversals r WHERE r.tenant_id=i.tenant_id AND r.invoice_id=i.id AND r.sealed))
$$;
CREATE VIEW supplier_invoice_balances WITH(security_invoker=true) AS
 SELECT o.*,CASE WHEN r.sealed THEN 0::numeric(20,2) ELSE o.amount END AS balance,r.id AS reversal_id,r.posted_at AS reversed_at
 FROM supplier_invoice_open_items o LEFT JOIN supplier_invoice_reversals r ON r.tenant_id=o.tenant_id AND r.invoice_id=o.invoice_id AND r.sealed;

CREATE FUNCTION validate_supplier_reversal() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE h supplier_invoice_reversals;i supplier_invoices;j journals;original journals;d documents;source_lines jsonb;BEGIN
 IF TG_TABLE_NAME='journals' THEN
  SELECT * INTO h FROM supplier_invoice_reversals WHERE tenant_id=NEW.tenant_id AND id=NEW.source_id;
  IF h.id IS NULL THEN
   IF EXISTS(SELECT 1 FROM supplier_invoices si WHERE si.tenant_id=NEW.tenant_id AND si.journal_id=NEW.reversal_of AND si.sealed) THEN RAISE EXCEPTION 'Eingangsrechnungs-FI benötigt einen unabhängig freigegebenen Stornobeleg';END IF;
   RETURN NULL;
  END IF;
 ELSE SELECT * INTO h FROM supplier_invoice_reversals WHERE tenant_id=NEW.tenant_id AND id=NEW.id;END IF;
 SELECT * INTO i FROM supplier_invoices WHERE tenant_id=h.tenant_id AND id=h.invoice_id;
 SELECT * INTO d FROM documents WHERE tenant_id=h.tenant_id AND id=h.id;
 IF i.id IS NULL OR NOT i.sealed OR h.company_id<>i.company_id OR d.kind<>'SUPPLIER_INVOICE_REVERSAL' OR d.organization_id<>(SELECT organization_id FROM documents WHERE tenant_id=i.tenant_id AND id=i.id) THEN RAISE EXCEPTION 'Passende gebuchte Ursprungsrechnung für Stornobeleg fehlt';END IF;
 IF NOT h.sealed THEN
  IF h.journal_id IS NOT NULL OR EXISTS(SELECT 1 FROM journals WHERE tenant_id=h.tenant_id AND source_id=h.id) THEN RAISE EXCEPTION 'Gegenbuchung benötigt vollständig gebuchten Stornobeleg';END IF;RETURN NULL;
 END IF;
 SELECT * INTO original FROM journals WHERE tenant_id=h.tenant_id AND id=i.journal_id;
 SELECT * INTO j FROM journals WHERE tenant_id=h.tenant_id AND id=h.journal_id;
 IF original.id IS NULL OR original.status<>'POSTED' OR original.reversal_of IS NOT NULL OR j.id IS NULL OR j.status<>'POSTED' OR j.reversal_of IS DISTINCT FROM original.id OR j.source_id IS DISTINCT FROM h.id OR j.company_id<>i.company_id OR j.currency<>i.currency OR j.period_id<>h.period_id OR j.posting_date<>h.posting_date OR j.document_date<>h.document_date OR j.reason IS DISTINCT FROM h.reason THEN RAISE EXCEPTION 'Passender Original-/Gegen-Finanzbeleg fehlt';END IF;
 IF h.posting_date<i.posting_date OR h.document_date<i.invoice_date OR NOT EXISTS(SELECT 1 FROM fiscal_periods p WHERE p.tenant_id=h.tenant_id AND p.id=h.period_id AND p.company_id=h.company_id AND p.status='OPEN' AND h.posting_date BETWEEN p.date_from AND p.date_to) THEN RAISE EXCEPTION 'Offene passende Stornoperiode oder zulässiges Datum fehlt';END IF;
 IF h.reviewed_by IN(d.created_by,h.prepared_by) OR NOT EXISTS(SELECT 1 FROM approval_instances ai JOIN approval_decisions ad ON ad.tenant_id=ai.tenant_id AND ad.instance_id=ai.id JOIN users u ON u.tenant_id=ad.tenant_id AND u.id=ad.actor_id WHERE ai.tenant_id=h.tenant_id AND ai.document_id=h.id AND ai.status='APPROVED' AND ai.four_eyes AND ai.subject_version=h.version-2 AND ai.submitted_by<>h.reviewed_by AND ad.decision='APPROVE' AND ad.actor_id=h.reviewed_by AND ad.step=jsonb_array_length(ai.steps_snapshot)-1 AND ad.comment=h.review_note AND ad.context->>'preparedHash'=encode(sha256(convert_to(h.prepared_snapshot::text,'UTF8')),'hex') AND u.role IN('ADMIN','ACCOUNTANT')) THEN RAISE EXCEPTION 'Unabhängige Stornofreigabe zum unveränderten Prüfstand fehlt';END IF;
 IF h.snapshot-'review' IS DISTINCT FROM h.prepared_snapshot OR h.snapshot->'review'->>'actorId' IS DISTINCT FROM h.reviewed_by::text OR h.snapshot->'review'->>'note' IS DISTINCT FROM h.review_note OR h.reviewed_at IS NULL OR h.prepared_snapshot->>'id' IS DISTINCT FROM h.id::text OR h.prepared_snapshot->>'number' IS DISTINCT FROM d.number OR h.prepared_snapshot->>'invoiceId' IS DISTINCT FROM i.id::text OR h.prepared_snapshot->>'companyId' IS DISTINCT FROM i.company_id::text OR h.prepared_snapshot->>'periodId' IS DISTINCT FROM h.period_id::text OR h.prepared_snapshot->>'postingDate' IS DISTINCT FROM h.posting_date::text OR h.prepared_snapshot->>'documentDate' IS DISTINCT FROM h.document_date::text OR h.prepared_snapshot->>'reason' IS DISTINCT FROM h.reason OR h.prepared_snapshot->>'preparedBy' IS DISTINCT FROM h.prepared_by::text OR h.prepared_snapshot->'invoiceSnapshot' IS DISTINCT FROM i.snapshot OR h.prepared_snapshot->'sourceJournal'->>'id' IS DISTINCT FROM original.id::text OR h.prepared_snapshot->'sourceJournal'->>'hash' IS DISTINCT FROM original.content_hash THEN RAISE EXCEPTION 'Storno-/Originalsnapshot passt nicht zum geprüften Gegenbeleg';END IF;
 IF h.prepared_snapshot->>'currency' IS DISTINCT FROM i.currency OR (h.prepared_snapshot->>'net')::numeric IS DISTINCT FROM i.net OR (h.prepared_snapshot->>'tax')::numeric IS DISTINCT FROM i.tax OR (h.prepared_snapshot->>'gross')::numeric IS DISTINCT FROM i.gross OR (h.prepared_snapshot->>'preparedAt')::timestamptz IS DISTINCT FROM h.prepared_at OR h.prepared_snapshot->>'externalNumber' IS DISTINCT FROM i.external_number OR h.prepared_snapshot->>'invoiceNumber' IS DISTINCT FROM (SELECT number FROM documents WHERE tenant_id=i.tenant_id AND id=i.id) OR h.prepared_snapshot->'sourceJournal'->>'number' IS DISTINCT FROM (SELECT number FROM documents WHERE tenant_id=original.tenant_id AND id=original.id) OR (h.snapshot->'review'->>'at')::timestamptz IS DISTINCT FROM date_trunc('milliseconds',h.reviewed_at) THEN RAISE EXCEPTION 'Stornobeträge, Originalreferenzen oder Prüfzeitpunkte sind inkonsistent';END IF;
 SELECT jsonb_agg(jsonb_build_object('position',e.position,'accountId',e.account_id,'side',e.side,'amount',e.amount::text,'description',e.description,'costCenter',e.cost_center,'partnerId',e.partner_id,'taxCode',e.tax_code) ORDER BY e.position) INTO source_lines FROM journal_entries e WHERE e.tenant_id=h.tenant_id AND e.journal_id=original.id;
 IF (SELECT jsonb_agg(x-'code'-'name' ORDER BY (x->>'position')::int) FROM jsonb_array_elements(h.prepared_snapshot->'sourceJournal'->'lines') x) IS DISTINCT FROM source_lines THEN RAISE EXCEPTION 'Stornierter Kontierungsstand passt nicht zur Original-FI';END IF;
 IF EXISTS((SELECT account_id,CASE side WHEN 'DEBIT' THEN 'CREDIT' ELSE 'DEBIT' END,amount,cost_center,partner_id,tax_code,description FROM journal_entries WHERE tenant_id=h.tenant_id AND journal_id=original.id EXCEPT ALL SELECT account_id,side,amount,cost_center,partner_id,tax_code,description FROM journal_entries WHERE tenant_id=h.tenant_id AND journal_id=j.id) UNION ALL (SELECT account_id,side,amount,cost_center,partner_id,tax_code,description FROM journal_entries WHERE tenant_id=h.tenant_id AND journal_id=j.id EXCEPT ALL SELECT account_id,CASE side WHEN 'DEBIT' THEN 'CREDIT' ELSE 'DEBIT' END,amount,cost_center,partner_id,tax_code,description FROM journal_entries WHERE tenant_id=h.tenant_id AND journal_id=original.id)) THEN RAISE EXCEPTION 'Storno muss jede ursprüngliche Kontierung exakt gegenbuchen';END IF;
 IF NOT EXISTS(SELECT 1 FROM supplier_invoice_open_items o WHERE o.tenant_id=h.tenant_id AND o.invoice_id=i.id AND o.amount=i.gross AND o.payment_block AND o.company_id=i.company_id AND o.supplier_id=i.supplier_id) THEN RAISE EXCEPTION 'Unbezahlter gesperrter Originalposten fehlt';END IF;
 RETURN NULL;
END$$;
CREATE CONSTRAINT TRIGGER supplier_reversal_consistent AFTER INSERT OR UPDATE ON supplier_invoice_reversals DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_supplier_reversal();
CREATE CONSTRAINT TRIGGER supplier_reversal_journal_consistent AFTER INSERT OR UPDATE ON journals DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_supplier_reversal();

-- Only a posted counterdocument releases the original receipt claim.
CREATE OR REPLACE FUNCTION check_supplier_receipt_capacity() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE item uuid;t uuid;g record;q numeric;n numeric;BEGIN
 IF TG_TABLE_NAME='goods_receipts' THEN
  IF NEW.reverses_id IS NULL THEN RETURN NULL;END IF;
  IF EXISTS(SELECT 1 FROM supplier_invoice_allocations a JOIN supplier_invoices i ON i.tenant_id=a.tenant_id AND i.id=a.invoice_id JOIN goods_receipt_items gi ON gi.tenant_id=a.tenant_id AND gi.id=a.receipt_item_id WHERE a.tenant_id=NEW.tenant_id AND gi.receipt_id=NEW.reverses_id AND supplier_invoice_effective(i.tenant_id,i.id)) THEN RAISE EXCEPTION 'Wareneingang ist durch eine gebuchte Eingangsrechnung verrechnet';END IF;
  RETURN NULL;
 END IF;
 t:=NEW.tenant_id;item:=NEW.receipt_item_id;
 SELECT gi.*,gr.movement_type,gr.sealed AS receipt_sealed,gr.id AS receipt FROM goods_receipt_items gi JOIN goods_receipts gr ON gr.tenant_id=gi.tenant_id AND gr.id=gi.receipt_id WHERE gi.tenant_id=t AND gi.id=item INTO g;
 IF g.id IS NULL OR g.movement_type<>'RECEIPT' OR NOT g.receipt_sealed OR EXISTS(SELECT 1 FROM goods_receipts WHERE tenant_id=t AND reverses_id=g.receipt) THEN RAISE EXCEPTION 'Wirksamer originaler Wareneingang für Rechnungsmenge fehlt';END IF;
 PERFORM 1 FROM company_codes c JOIN goods_receipts gr ON gr.tenant_id=c.tenant_id AND gr.company_id=c.id WHERE gr.tenant_id=t AND gr.id=g.receipt FOR UPDATE OF c;
 SELECT coalesce(sum(a.quantity),0),coalesce(sum(a.net),0) INTO q,n FROM supplier_invoice_allocations a JOIN supplier_invoices i ON i.tenant_id=a.tenant_id AND i.id=a.invoice_id WHERE a.tenant_id=t AND a.receipt_item_id=item AND supplier_invoice_effective(i.tenant_id,i.id);
 IF q>g.quantity OR n>supplier_receipt_clearing_value(t,item) OR (q=g.quantity AND n<>supplier_receipt_clearing_value(t,item)) THEN RAISE EXCEPTION 'Wareneingangsmenge oder ursprünglicher WE/RE-Wert bereits verrechnet';END IF;
 RETURN NULL;
END$$;
