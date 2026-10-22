ALTER TABLE supplier_invoices DROP CONSTRAINT supplier_invoices_status_check;
ALTER TABLE supplier_invoices ADD CHECK(status IN ('DRAFT','IN_REVIEW','APPROVED','REJECTED','POSTED','CANCELLED'));
ALTER TABLE approval_instances DROP CONSTRAINT approval_instances_status_check;
ALTER TABLE approval_instances ADD CHECK(status IN ('PENDING','APPROVED','REJECTED','INFORMATION_REQUIRED','WITHDRAWN'));
ALTER TABLE approval_decisions DROP CONSTRAINT approval_decisions_decision_check;
ALTER TABLE approval_decisions ADD CHECK(decision IN ('APPROVE','REJECT','REQUEST_INFORMATION','RESUBMIT','WITHDRAW'));
ALTER TABLE approval_decisions ADD COLUMN context jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE supplier_invoices ADD COLUMN period_id uuid,ADD COLUMN posting_date date,ADD COLUMN payable_due_date date,
 ADD COLUMN commercial_note text NOT NULL DEFAULT '',ADD COLUMN prepared_by uuid,ADD COLUMN prepared_at timestamptz,ADD COLUMN prepared_snapshot jsonb,
 ADD COLUMN tax_reviewed_by uuid,ADD COLUMN tax_reviewed_at timestamptz,ADD COLUMN tax_review_note text,
 ADD COLUMN journal_id uuid,ADD COLUMN snapshot jsonb,ADD COLUMN sealed boolean NOT NULL DEFAULT false,ADD COLUMN posted_at timestamptz,
 ADD FOREIGN KEY(tenant_id,period_id) REFERENCES fiscal_periods(tenant_id,id),ADD FOREIGN KEY(tenant_id,prepared_by) REFERENCES users(tenant_id,id),ADD FOREIGN KEY(tenant_id,tax_reviewed_by) REFERENCES users(tenant_id,id),ADD FOREIGN KEY(tenant_id,journal_id) REFERENCES journals(tenant_id,id),
 ADD CHECK((status='POSTED')=sealed),ADD CHECK(NOT sealed OR (journal_id IS NOT NULL AND snapshot IS NOT NULL AND posted_at IS NOT NULL)),
 ADD CHECK(payable_due_date IS NULL OR payable_due_date>=invoice_date);
CREATE UNIQUE INDEX posted_supplier_invoice_number ON supplier_invoices(tenant_id,company_id,supplier_id,external_key) WHERE sealed;
CREATE TABLE supplier_invoice_allocations(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,invoice_id uuid NOT NULL,invoice_item_id uuid NOT NULL,receipt_item_id uuid NOT NULL,position integer NOT NULL,
 quantity numeric(18,6) NOT NULL CHECK(quantity>0),net numeric(20,2) NOT NULL CHECK(net>=0),grir_account_id uuid,snapshot jsonb NOT NULL,
 CHECK(net=0 OR grir_account_id IS NOT NULL),UNIQUE(tenant_id,id),UNIQUE(tenant_id,invoice_id,position),UNIQUE(tenant_id,invoice_item_id,receipt_item_id),
 FOREIGN KEY(tenant_id,invoice_id) REFERENCES supplier_invoices(tenant_id,id),FOREIGN KEY(tenant_id,invoice_item_id) REFERENCES supplier_invoice_items(tenant_id,id),FOREIGN KEY(tenant_id,receipt_item_id) REFERENCES goods_receipt_items(tenant_id,id),FOREIGN KEY(tenant_id,grir_account_id) REFERENCES gl_accounts(tenant_id,id)
);
CREATE TABLE supplier_invoice_open_items(
 invoice_id uuid PRIMARY KEY,tenant_id uuid NOT NULL,company_id uuid NOT NULL,supplier_id uuid NOT NULL,account_id uuid NOT NULL,
 due_date date NOT NULL,currency text NOT NULL,amount numeric(20,2) NOT NULL CHECK(amount>0),payment_block boolean NOT NULL DEFAULT true CHECK(payment_block),
 FOREIGN KEY(tenant_id,invoice_id) REFERENCES supplier_invoices(tenant_id,id),FOREIGN KEY(tenant_id,company_id) REFERENCES company_codes(tenant_id,id),FOREIGN KEY(tenant_id,supplier_id) REFERENCES business_partners(tenant_id,id),FOREIGN KEY(tenant_id,account_id) REFERENCES gl_accounts(tenant_id,id)
);
CREATE TRIGGER supplier_allocation_immutable BEFORE UPDATE OR DELETE ON supplier_invoice_allocations FOR EACH ROW EXECUTE FUNCTION reject_attachment_mutation();
CREATE TRIGGER supplier_open_item_immutable BEFORE UPDATE OR DELETE ON supplier_invoice_open_items FOR EACH ROW EXECUTE FUNCTION reject_attachment_mutation();
CREATE FUNCTION supplier_financial_frozen() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
 IF OLD.sealed THEN RAISE EXCEPTION 'Gebuchte Eingangsrechnung ist unveränderlich';END IF;
 IF OLD.status NOT IN ('DRAFT','REJECTED') AND ROW(NEW.period_id,NEW.posting_date,NEW.payable_due_date,NEW.commercial_note,NEW.prepared_by,NEW.prepared_at,NEW.prepared_snapshot) IS DISTINCT FROM ROW(OLD.period_id,OLD.posting_date,OLD.payable_due_date,OLD.commercial_note,OLD.prepared_by,OLD.prepared_at,OLD.prepared_snapshot) THEN RAISE EXCEPTION 'Eingereichte Buchungsvorbereitung ist unveränderlich';END IF;
 RETURN NEW;
END$$;
CREATE TRIGGER supplier_financial_no_change BEFORE UPDATE ON supplier_invoices FOR EACH ROW EXECUTE FUNCTION supplier_financial_frozen();
CREATE OR REPLACE FUNCTION supplier_match_editable() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
 IF OLD.status NOT IN ('DRAFT','REJECTED') AND ROW(NEW.purchase_order_id,NEW.supplier_id,NEW.order_id,NEW.match_note,NEW.matched_at,NEW.matched_by) IS DISTINCT FROM ROW(OLD.purchase_order_id,OLD.supplier_id,OLD.order_id,OLD.match_note,OLD.matched_at,OLD.matched_by) THEN RAISE EXCEPTION 'Zuordnung eines eingereichten Rechnungseingangs ist unveränderlich';END IF;RETURN NEW;
END$$;
CREATE OR REPLACE FUNCTION supplier_item_frozen() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
 IF TG_OP='DELETE' OR (to_jsonb(NEW)-'purchase_order_item_id') IS DISTINCT FROM (to_jsonb(OLD)-'purchase_order_item_id') THEN RAISE EXCEPTION 'Aus dem Original übernommene Rechnungsposition ist unveränderlich';END IF;
 IF NOT EXISTS(SELECT 1 FROM supplier_invoices WHERE tenant_id=OLD.tenant_id AND id=OLD.invoice_id AND status IN ('DRAFT','REJECTED')) THEN RAISE EXCEPTION 'Rechnungszuordnung ist nicht mehr änderbar';END IF;RETURN NEW;
END$$;
-- Distribute the original posted receipt's cents by largest remainder. This
-- allocates rounding deterministically without activating stock a second time.
CREATE FUNCTION supplier_receipt_clearing_value(t uuid,item uuid) RETURNS numeric LANGUAGE sql STABLE AS $$
 WITH r AS(SELECT receipt_id FROM goods_receipt_items WHERE tenant_id=t AND id=item),
 ranked AS(SELECT i.id,floor(i.value*100) AS base,row_number() OVER(ORDER BY i.value*100-floor(i.value*100) DESC,i.position,i.id) AS rank,
 round(sum(i.value) OVER(),2)*100-sum(floor(i.value*100)) OVER() AS remaining
 FROM goods_receipt_items i JOIN r ON r.receipt_id=i.receipt_id WHERE i.tenant_id=t)
 SELECT (base+CASE WHEN rank<=remaining THEN 1 ELSE 0 END)/100 FROM ranked WHERE id=item
$$;
CREATE FUNCTION check_supplier_receipt_capacity() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE item uuid;t uuid;g record;q numeric;n numeric;BEGIN
 IF TG_TABLE_NAME='goods_receipts' THEN
  IF NEW.reverses_id IS NULL THEN RETURN NULL;END IF;
  IF EXISTS(SELECT 1 FROM supplier_invoice_allocations a JOIN supplier_invoices i ON i.tenant_id=a.tenant_id AND i.id=a.invoice_id JOIN goods_receipt_items gi ON gi.tenant_id=a.tenant_id AND gi.id=a.receipt_item_id WHERE a.tenant_id=NEW.tenant_id AND gi.receipt_id=NEW.reverses_id AND i.sealed) THEN RAISE EXCEPTION 'Wareneingang ist durch eine gebuchte Eingangsrechnung verrechnet';END IF;
  RETURN NULL;
 END IF;
 t:=NEW.tenant_id;item:=NEW.receipt_item_id;
 SELECT gi.*,gr.movement_type,gr.sealed AS receipt_sealed,gr.id AS receipt FROM goods_receipt_items gi JOIN goods_receipts gr ON gr.tenant_id=gi.tenant_id AND gr.id=gi.receipt_id WHERE gi.tenant_id=t AND gi.id=item INTO g;
 IF g.id IS NULL OR g.movement_type<>'RECEIPT' OR NOT g.receipt_sealed OR EXISTS(SELECT 1 FROM goods_receipts WHERE tenant_id=t AND reverses_id=g.receipt) THEN RAISE EXCEPTION 'Wirksamer originaler Wareneingang für Rechnungsmenge fehlt';END IF;
 PERFORM 1 FROM company_codes c JOIN goods_receipts gr ON gr.tenant_id=c.tenant_id AND gr.company_id=c.id WHERE gr.tenant_id=t AND gr.id=g.receipt FOR UPDATE OF c;
 SELECT coalesce(sum(a.quantity),0),coalesce(sum(a.net),0) INTO q,n FROM supplier_invoice_allocations a JOIN supplier_invoices i ON i.tenant_id=a.tenant_id AND i.id=a.invoice_id WHERE a.tenant_id=t AND a.receipt_item_id=item AND i.sealed;
 IF q>g.quantity OR n>supplier_receipt_clearing_value(t,item) OR (q=g.quantity AND n<>supplier_receipt_clearing_value(t,item)) THEN RAISE EXCEPTION 'Wareneingangsmenge oder ursprünglicher WE/RE-Wert bereits verrechnet';END IF;
 RETURN NULL;
END$$;
CREATE CONSTRAINT TRIGGER supplier_receipt_capacity AFTER INSERT ON supplier_invoice_allocations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_supplier_receipt_capacity();
CREATE CONSTRAINT TRIGGER invoiced_receipt_no_reversal AFTER INSERT OR UPDATE ON goods_receipts DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_supplier_receipt_capacity();
CREATE FUNCTION validate_supplier_financial_posting() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE h supplier_invoices;docid uuid;s record;j record;op record;allocation_row record;total numeric;vat numeric;BEGIN
 IF TG_TABLE_NAME='supplier_invoices' THEN docid:=NEW.id;ELSE docid:=NEW.invoice_id;END IF;
 SELECT * INTO h FROM supplier_invoices WHERE tenant_id=NEW.tenant_id AND id=docid;
 IF NOT h.sealed THEN
  IF EXISTS(SELECT 1 FROM supplier_invoice_allocations WHERE tenant_id=h.tenant_id AND invoice_id=h.id) OR EXISTS(SELECT 1 FROM supplier_invoice_open_items WHERE tenant_id=h.tenant_id AND invoice_id=h.id) THEN RAISE EXCEPTION 'WE-Verrechnung und Kreditorenposten benötigen vollständig gebuchte Rechnung';END IF;RETURN NULL;
 END IF;
 SELECT d.number,d.created_by,o.sha256,im.parsed,im.state,im.scan_status INTO s FROM documents d JOIN supplier_invoice_originals o ON o.tenant_id=d.tenant_id AND o.invoice_id=d.id JOIN supplier_invoice_imports im ON im.tenant_id=d.tenant_id AND im.invoice_id=d.id WHERE d.tenant_id=h.tenant_id AND d.id=h.id;
 IF s.state<>'VALIDATED' OR s.scan_status NOT IN ('CLEAN','STRUCTURAL_XML') OR h.prepared_snapshot IS NULL OR h.snapshot-'taxReview' IS DISTINCT FROM h.prepared_snapshot OR h.snapshot->'original' IS DISTINCT FROM s.parsed OR h.snapshot->>'originalSha256' IS DISTINCT FROM s.sha256 OR h.snapshot->>'number' IS DISTINCT FROM s.number THEN RAISE EXCEPTION 'Eingangsrechnung benötigt unveränderten validierten Original- und Vorbereitungssnapshot';END IF;
 IF h.snapshot->>'id' IS DISTINCT FROM h.id::text OR h.snapshot->>'companyId' IS DISTINCT FROM h.company_id::text OR h.snapshot->>'supplierId' IS DISTINCT FROM h.supplier_id::text OR h.snapshot->>'purchaseOrderId' IS DISTINCT FROM h.purchase_order_id::text OR h.snapshot->>'orderId' IS DISTINCT FROM h.order_id::text OR h.snapshot->>'periodId' IS DISTINCT FROM h.period_id::text OR h.snapshot->>'postingDate' IS DISTINCT FROM h.posting_date::text OR h.snapshot->>'dueDate' IS DISTINCT FROM h.payable_due_date::text THEN RAISE EXCEPTION 'Finanzsnapshot passt nicht zu Rechnung, Quelle oder Buchungsdaten';END IF;
 IF h.prepared_by IS NULL OR h.matched_by IS NULL OR h.tax_reviewed_by IS NULL OR h.tax_reviewed_by IN(s.created_by,h.prepared_by,h.matched_by) OR NOT EXISTS(SELECT 1 FROM approval_instances ai JOIN approval_decisions ad ON ad.tenant_id=ai.tenant_id AND ad.instance_id=ai.id JOIN users u ON u.tenant_id=ad.tenant_id AND u.id=ad.actor_id WHERE ai.tenant_id=h.tenant_id AND ai.document_id=h.id AND ai.status='APPROVED' AND ai.four_eyes AND ai.subject_version=h.version-2 AND ad.decision='APPROVE' AND ad.step=jsonb_array_length(ai.steps_snapshot)-1 AND ad.actor_id=h.tax_reviewed_by AND ad.comment=h.tax_review_note AND ad.context->>'inputTaxChecked'='true' AND ad.context->>'preparedHash'=encode(sha256(convert_to(h.prepared_snapshot::text,'UTF8')),'hex') AND u.role IN ('ADMIN','ACCOUNTANT')) THEN RAISE EXCEPTION 'Unabhängige sachliche und steuerliche Eingangsrechnungsfreigabe fehlt';END IF;
 IF h.snapshot->'taxReview'->>'actorId' IS DISTINCT FROM h.tax_reviewed_by::text OR h.snapshot->'taxReview'->>'note' IS DISTINCT FROM h.tax_review_note OR h.tax_reviewed_at IS NULL OR h.posting_date<h.invoice_date THEN RAISE EXCEPTION 'Steuerfreigabe oder Buchungsdaten sind inkonsistent';END IF;
 SELECT sum(net) INTO total FROM supplier_invoice_items WHERE tenant_id=h.tenant_id AND invoice_id=h.id;
 SELECT sum(round(basis*rate/100,2)) INTO vat FROM(SELECT tax_rate AS rate,sum(net) AS basis FROM supplier_invoice_items WHERE tenant_id=h.tenant_id AND invoice_id=h.id GROUP BY tax_rate) v;
 IF total<>h.net OR vat<>h.tax OR NOT EXISTS(SELECT 1 FROM fiscal_periods p JOIN company_codes c ON c.tenant_id=p.tenant_id AND c.id=p.company_id WHERE p.tenant_id=h.tenant_id AND p.id=h.period_id AND c.id=h.company_id AND c.currency=h.currency AND p.status='OPEN' AND h.posting_date BETWEEN p.date_from AND p.date_to) THEN RAISE EXCEPTION 'Originalwerte, Vorsteuer oder offene passende Periode fehlen';END IF;
 IF EXISTS(SELECT 1 FROM supplier_invoice_items i WHERE i.tenant_id=h.tenant_id AND i.invoice_id=h.id AND ((SELECT coalesce(sum(quantity),0) FROM supplier_invoice_allocations a WHERE a.tenant_id=i.tenant_id AND a.invoice_item_id=i.id)<>i.quantity OR (SELECT coalesce(sum(net),0) FROM supplier_invoice_allocations a WHERE a.tenant_id=i.tenant_id AND a.invoice_item_id=i.id)<>i.net)) THEN RAISE EXCEPTION 'Vollständige mengen- und wertgleiche WE-Verrechnung jeder Originalposition fehlt';END IF;
 FOR allocation_row IN SELECT al.*,ii.purchase_order_item_id,ii.invoice_id AS source_invoice,ii.unit_net AS invoice_unit_net,ii.unit AS invoice_unit,pi.unit_price AS ordered_unit_net,oi.unit AS ordered_unit,gi.purchase_order_item_id AS receipt_po,gr.company_id,gr.order_id,gr.posting_date AS receipt_date FROM supplier_invoice_allocations al JOIN supplier_invoice_items ii ON ii.tenant_id=al.tenant_id AND ii.id=al.invoice_item_id JOIN purchase_order_items pi ON pi.tenant_id=ii.tenant_id AND pi.id=ii.purchase_order_item_id JOIN purchase_requisition_items qi ON qi.tenant_id=pi.tenant_id AND qi.id=pi.requisition_item_id JOIN order_requirement_items ri ON ri.tenant_id=qi.tenant_id AND ri.id=qi.requirement_item_id JOIN service_order_items oi ON oi.tenant_id=ri.tenant_id AND oi.id=ri.order_item_id JOIN goods_receipt_items gi ON gi.tenant_id=al.tenant_id AND gi.id=al.receipt_item_id JOIN goods_receipts gr ON gr.tenant_id=gi.tenant_id AND gr.id=gi.receipt_id WHERE al.tenant_id=h.tenant_id AND al.invoice_id=h.id LOOP
  IF allocation_row.source_invoice<>h.id OR allocation_row.invoice_unit_net<>allocation_row.ordered_unit_net OR allocation_row.invoice_unit<>(CASE allocation_row.ordered_unit WHEN 'EA' THEN 'C62' WHEN 'ST' THEN 'C62' WHEN 'PC' THEN 'C62' WHEN 'H' THEN 'HUR' WHEN 'STD' THEN 'HUR' WHEN 'KM' THEN 'KMT' ELSE allocation_row.ordered_unit END) OR allocation_row.purchase_order_item_id IS DISTINCT FROM allocation_row.receipt_po OR allocation_row.company_id<>h.company_id OR allocation_row.order_id<>h.order_id OR allocation_row.receipt_date>h.posting_date OR (allocation_row.snapshot->>'quantity')::numeric IS DISTINCT FROM allocation_row.quantity OR (allocation_row.snapshot->>'net')::numeric IS DISTINCT FROM allocation_row.net OR allocation_row.snapshot->>'invoiceItemId' IS DISTINCT FROM allocation_row.invoice_item_id::text OR allocation_row.snapshot->>'receiptItemId' IS DISTINCT FROM allocation_row.receipt_item_id::text OR allocation_row.snapshot->>'grirAccountId' IS DISTINCT FROM allocation_row.grir_account_id::text THEN RAISE EXCEPTION 'Unzulässige oder verfälschte WE-/SA-Positionszuordnung';END IF;
  IF allocation_row.net>0 AND NOT EXISTS(SELECT 1 FROM journals r JOIN journal_entries e ON e.tenant_id=r.tenant_id AND e.journal_id=r.id JOIN gl_accounts ga ON ga.tenant_id=e.tenant_id AND ga.id=e.account_id JOIN goods_receipt_items gi ON gi.tenant_id=r.tenant_id AND gi.receipt_id=r.source_id WHERE r.tenant_id=h.tenant_id AND gi.id=allocation_row.receipt_item_id AND r.status='POSTED' AND e.side='CREDIT' AND e.account_id=allocation_row.grir_account_id AND ga.kind='LIABILITY' AND ga.active AND ga.company_id=h.company_id AND NOT EXISTS(SELECT 1 FROM journals rev WHERE rev.tenant_id=r.tenant_id AND rev.reversal_of=r.id AND rev.status='POSTED')) THEN RAISE EXCEPTION 'Ursprüngliches wirksames WE/RE-Konto fehlt';END IF;
 END LOOP;
 IF h.snapshot->'allocations' IS DISTINCT FROM (SELECT jsonb_agg(snapshot ORDER BY position) FROM supplier_invoice_allocations WHERE tenant_id=h.tenant_id AND invoice_id=h.id) THEN RAISE EXCEPTION 'Verrechnungssnapshot passt nicht zu den gebuchten Mengen';END IF;
 SELECT * INTO j FROM journals WHERE tenant_id=h.tenant_id AND id=h.journal_id;
 SELECT * INTO op FROM supplier_invoice_open_items WHERE tenant_id=h.tenant_id AND invoice_id=h.id;
 IF j.id IS NULL OR j.status<>'POSTED' OR j.source_id<>h.id OR j.company_id<>h.company_id OR j.currency<>h.currency OR j.posting_date<>h.posting_date OR j.period_id<>h.period_id OR op.invoice_id IS NULL OR op.amount<>h.gross OR op.supplier_id<>h.supplier_id OR op.company_id<>h.company_id OR op.currency<>h.currency OR op.due_date<>h.payable_due_date OR NOT op.payment_block THEN RAISE EXCEPTION 'Passender FI-Beleg oder zahlungsgesperrter Kreditorenposten fehlt';END IF;
 IF NOT EXISTS(SELECT 1 FROM partner_company_accounts ca JOIN gl_accounts ga ON ga.tenant_id=ca.tenant_id AND ga.id=ca.reconciliation_account_id WHERE ca.tenant_id=h.tenant_id AND ca.company_id=h.company_id AND ca.partner_id=h.supplier_id AND ca.kind='CREDITOR' AND ca.status='ACTIVE' AND NOT ca.invoice_block AND ga.active AND ga.kind='PAYABLE' AND ca.reconciliation_account_id=op.account_id) THEN RAISE EXCEPTION 'Passendes aktives Kreditoren-Abstimmkonto fehlt';END IF;
 IF (SELECT coalesce(sum(amount),0) FROM journal_entries WHERE tenant_id=h.tenant_id AND journal_id=j.id AND side='CREDIT' AND account_id=op.account_id AND partner_id=h.supplier_id)<>h.gross OR (SELECT coalesce(sum(amount),0) FROM journal_entries WHERE tenant_id=h.tenant_id AND journal_id=j.id AND side='CREDIT')<>h.gross THEN RAISE EXCEPTION 'Kreditorenbuchung passt nicht zum Originalbetrag';END IF;
 FOR allocation_row IN SELECT grir_account_id,sum(net) AS amount FROM supplier_invoice_allocations WHERE tenant_id=h.tenant_id AND invoice_id=h.id AND net>0 GROUP BY grir_account_id LOOP
  IF (SELECT coalesce(sum(amount),0) FROM journal_entries WHERE tenant_id=h.tenant_id AND journal_id=j.id AND side='DEBIT' AND account_id=allocation_row.grir_account_id)<>allocation_row.amount THEN RAISE EXCEPTION 'WE/RE-Verrechnung fehlt oder Bestand/Aufwand wurde doppelt gebucht';END IF;
 END LOOP;
 IF h.snapshot->'accounts'->>'payableAccountId' IS DISTINCT FROM op.account_id::text OR h.snapshot->'creditor'->>'accountId' IS DISTINCT FROM op.account_id::text OR NOT EXISTS(SELECT 1 FROM accounting_rules ar JOIN gl_accounts ga ON ga.tenant_id=ar.tenant_id AND ga.id=ar.account_id WHERE ar.tenant_id=h.tenant_id AND ar.company_id=h.company_id AND ar.event='PURCHASE_INVOICE' AND ar.role='tax' AND ga.kind='TAX' AND ga.active AND ar.account_id::text=h.snapshot->'accounts'->>'inputTaxAccountId') OR EXISTS(SELECT 1 FROM journal_entries e JOIN gl_accounts ga ON ga.tenant_id=e.tenant_id AND ga.id=e.account_id WHERE e.tenant_id=h.tenant_id AND e.journal_id=j.id AND ga.kind='TAX' AND e.account_id::text IS DISTINCT FROM h.snapshot->'accounts'->>'inputTaxAccountId') THEN RAISE EXCEPTION 'Freigegebenes Abstimm-/Vorsteuerkonto passt nicht zum Finanzsnapshot';END IF;
 IF (SELECT coalesce(sum(e.amount),0) FROM journal_entries e JOIN gl_accounts ga ON ga.tenant_id=e.tenant_id AND ga.id=e.account_id WHERE e.tenant_id=h.tenant_id AND e.journal_id=j.id AND e.side='DEBIT' AND ga.kind='TAX')<>h.tax OR (SELECT coalesce(sum(amount),0) FROM journal_entries WHERE tenant_id=h.tenant_id AND journal_id=j.id AND side='DEBIT')<>h.gross THEN RAISE EXCEPTION 'Vorsteuer und Sollsumme passen nicht zur Originalrechnung';END IF;
 RETURN NULL;
END$$;
CREATE CONSTRAINT TRIGGER supplier_invoice_fi_consistent AFTER INSERT OR UPDATE ON supplier_invoices DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_supplier_financial_posting();
CREATE CONSTRAINT TRIGGER supplier_allocation_fi_consistent AFTER INSERT ON supplier_invoice_allocations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_supplier_financial_posting();
CREATE CONSTRAINT TRIGGER supplier_open_item_fi_consistent AFTER INSERT ON supplier_invoice_open_items DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_supplier_financial_posting();
DO $$DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['supplier_invoice_allocations','supplier_invoice_open_items'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY tenant_isolation ON %I USING(tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid) WITH CHECK(tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid)',t);
END LOOP;END$$;
