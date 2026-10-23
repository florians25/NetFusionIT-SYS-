-- Extend the same material and AP ledgers with a real alternate AU source.
ALTER TABLE goods_receipts ALTER COLUMN order_id DROP NOT NULL;
ALTER TABLE goods_receipts ADD COLUMN sales_order_id uuid;
ALTER TABLE goods_receipts ADD FOREIGN KEY(tenant_id,sales_order_id) REFERENCES sales_orders(tenant_id,id);
ALTER TABLE goods_receipts ADD CHECK((order_id IS NULL)<>(sales_order_id IS NULL));
CREATE INDEX direct_receipt_order ON goods_receipts(tenant_id,sales_order_id);
ALTER TABLE supplier_invoices ADD COLUMN sales_order_id uuid;
ALTER TABLE supplier_invoices ADD FOREIGN KEY(tenant_id,sales_order_id) REFERENCES sales_orders(tenant_id,id);
ALTER TABLE supplier_invoices ADD CHECK((purchase_order_id IS NULL AND order_id IS NULL AND sales_order_id IS NULL) OR (purchase_order_id IS NOT NULL AND ((order_id IS NULL)<>(sales_order_id IS NULL))));
CREATE INDEX direct_supplier_order ON supplier_invoices(tenant_id,sales_order_id);
CREATE FUNCTION direct_received(t uuid,schedule uuid,excluded uuid DEFAULT NULL) RETURNS numeric LANGUAGE sql STABLE AS $$
 SELECT coalesce(sum(CASE g.movement_type WHEN 'RECEIPT' THEN gi.quantity ELSE -gi.quantity END),0) FROM goods_receipt_items gi JOIN goods_receipts g ON g.tenant_id=gi.tenant_id AND g.id=gi.receipt_id JOIN purchase_order_items pi ON pi.tenant_id=gi.tenant_id AND pi.id=gi.purchase_order_item_id JOIN purchase_requisition_items qi ON qi.tenant_id=pi.tenant_id AND qi.id=pi.requisition_item_id JOIN purchase_requisitions q ON q.tenant_id=qi.tenant_id AND q.id=qi.requisition_id JOIN order_requirement_items ri ON ri.tenant_id=qi.tenant_id AND ri.id=qi.requirement_item_id WHERE gi.tenant_id=t AND ri.sales_schedule_id=schedule AND g.sales_order_id=q.sales_order_id AND q.status NOT IN ('CANCELLED','REJECTED') AND (excluded IS NULL OR q.id<>excluded)
$$;
CREATE OR REPLACE FUNCTION direct_procurement_check() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE target uuid;h sales_orders;r record;l record;s record;reserved numeric;requested numeric;BEGIN
 IF TG_TABLE_NAME IN ('order_requirements','purchase_requisitions','purchase_orders') THEN target=NEW.sales_order_id;
 ELSIF TG_TABLE_NAME='order_requirement_items' THEN SELECT sales_order_id INTO target FROM order_requirements WHERE tenant_id=NEW.tenant_id AND id=NEW.requirement_id;
 ELSIF TG_TABLE_NAME='purchase_requisition_items' THEN SELECT sales_order_id INTO target FROM purchase_requisitions WHERE tenant_id=NEW.tenant_id AND id=NEW.requisition_id;
 ELSE SELECT sales_order_id INTO target FROM purchase_orders WHERE tenant_id=NEW.tenant_id AND id=NEW.purchase_order_id;END IF;
 IF target IS NULL THEN RETURN NULL;END IF;
 SELECT * INTO STRICT h FROM sales_orders WHERE tenant_id=NEW.tenant_id AND id=target FOR UPDATE;
 IF h.execution_mode<>'DIRECT_SALES' OR h.status<>'RELEASED' OR h.released_snapshot IS NULL THEN RAISE EXCEPTION 'Beschaffung benötigt unabhängig freigegebenen Direktvertriebs-AU';END IF;
 FOR r IN SELECT * FROM order_requirements WHERE tenant_id=h.tenant_id AND sales_order_id=h.id AND status='OPEN' LOOP
  IF NOT EXISTS(SELECT 1 FROM documents d WHERE d.tenant_id=r.tenant_id AND d.id=r.id AND d.organization_id=h.organization_id) THEN RAISE EXCEPTION 'AU-Bedarf gehört zu derselben Organisation';END IF;
  FOR l IN SELECT * FROM order_requirement_items WHERE tenant_id=r.tenant_id AND requirement_id=r.id LOOP
   SELECT sc.*,i.product_id,i.rejection_reason,i.delivery_block,p.kind INTO s FROM sales_order_schedules sc JOIN sales_order_items i ON i.tenant_id=sc.tenant_id AND i.id=sc.item_id JOIN products p ON p.tenant_id=i.tenant_id AND p.id=i.product_id WHERE sc.tenant_id=l.tenant_id AND sc.id=l.sales_schedule_id AND sc.item_id=l.sales_item_id AND sc.order_id=h.id;
   IF NOT FOUND OR l.quantity IS DISTINCT FROM s.quantity OR l.needed_on IS DISTINCT FROM coalesce(s.confirmed_on,s.requested_on) OR s.rejection_reason IS NOT NULL OR s.kind<>'STOCK' THEN RAISE EXCEPTION 'AU-Materialbedarf muss tatsächliche Lagerposition und Einteilung unverändert referenzieren';END IF;
  END LOOP;
 END LOOP;
 FOR r IN SELECT * FROM purchase_requisitions WHERE tenant_id=h.tenant_id AND sales_order_id=h.id AND status NOT IN ('CANCELLED','REJECTED') LOOP
  IF r.company_id IS DISTINCT FROM h.company_id OR r.currency IS DISTINCT FROM h.currency OR NOT EXISTS(SELECT 1 FROM documents d WHERE d.tenant_id=r.tenant_id AND d.id=r.id AND d.organization_id=h.organization_id) THEN RAISE EXCEPTION 'BANF benötigt denselben AU-/Buchungskreis-/Währungsursprung';END IF;
  IF NOT EXISTS(SELECT 1 FROM purchase_requisition_items WHERE tenant_id=r.tenant_id AND requisition_id=r.id) THEN RAISE EXCEPTION 'AU-BANF benötigt tatsächliche Bedarfspositionen';END IF;
  FOR l IN SELECT * FROM purchase_requisition_items WHERE tenant_id=r.tenant_id AND requisition_id=r.id LOOP
   SELECT ri.*,i.cost_center,i.cost_object,i.delivery_block FROM order_requirement_items ri JOIN order_requirements mr ON mr.tenant_id=ri.tenant_id AND mr.id=ri.requirement_id JOIN sales_order_items i ON i.tenant_id=ri.tenant_id AND i.id=ri.sales_item_id WHERE ri.tenant_id=l.tenant_id AND ri.id=l.requirement_item_id AND mr.sales_order_id=h.id AND mr.status='OPEN' INTO s;
   IF NOT FOUND OR l.cost_center IS DISTINCT FROM s.cost_center OR l.cost_object IS DISTINCT FROM s.cost_object OR s.delivery_block IS NOT NULL OR h.delivery_block IS NOT NULL THEN RAISE EXCEPTION 'BANF benötigt offenen eigenen AU-Bedarf und genehmigte Kontierung ohne Liefersperre';END IF;
   SELECT coalesce(sum(CASE WHEN status='CANCELLED' THEN consumed_quantity ELSE quantity END),0) INTO reserved FROM stock_reservations WHERE tenant_id=l.tenant_id AND sales_schedule_id=s.sales_schedule_id;
   requested=direct_requested(l.tenant_id,s.sales_schedule_id);
   IF reserved+greatest(0,requested-direct_received(l.tenant_id,s.sales_schedule_id))>s.quantity THEN RAISE EXCEPTION 'BANF und gebundener Bestand überschreiten tatsächliche AU-Einteilung';END IF;
  END LOOP;
 END LOOP;
 FOR r IN SELECT * FROM purchase_orders WHERE tenant_id=h.tenant_id AND sales_order_id=h.id AND status NOT IN ('CANCELLED','REJECTED') LOOP
  IF r.company_id IS DISTINCT FROM h.company_id OR r.currency IS DISTINCT FROM h.currency OR NOT EXISTS(SELECT 1 FROM purchase_requisitions q WHERE q.tenant_id=r.tenant_id AND q.id=r.requisition_id AND q.sales_order_id=h.id AND q.company_id=r.company_id AND q.currency=r.currency AND q.status IN ('RELEASED','PARTIALLY_ORDERED','FULLY_ORDERED')) OR NOT EXISTS(SELECT 1 FROM documents d WHERE d.tenant_id=r.tenant_id AND d.id=r.id AND d.organization_id=h.organization_id) THEN RAISE EXCEPTION 'AU-Bestellung benötigt eigenen freigegebenen BANF-Ursprung';END IF;
  IF NOT EXISTS(SELECT 1 FROM purchase_order_items WHERE tenant_id=r.tenant_id AND purchase_order_id=r.id) THEN RAISE EXCEPTION 'AU-Bestellung benötigt Positionen';END IF;
  FOR l IN SELECT * FROM purchase_order_items WHERE tenant_id=r.tenant_id AND purchase_order_id=r.id LOOP
   SELECT * INTO s FROM purchase_requisition_items WHERE tenant_id=l.tenant_id AND id=l.requisition_item_id AND requisition_id=r.requisition_id;
   IF NOT FOUND OR l.overdelivery_percent<>0 OR (SELECT coalesce(sum(pi.quantity),0) FROM purchase_order_items pi JOIN purchase_orders po ON po.tenant_id=pi.tenant_id AND po.id=pi.purchase_order_id WHERE pi.tenant_id=l.tenant_id AND pi.requisition_item_id=l.requisition_item_id AND po.status NOT IN ('CANCELLED','REJECTED'))>s.quantity THEN RAISE EXCEPTION 'AU-Bestellung überschreitet freigegebene BANF oder verwendet fremde Position';END IF;
  END LOOP;
 END LOOP;RETURN NULL;
END$$;
CREATE OR REPLACE FUNCTION direct_reservation_procurement_cap() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE planned numeric;reserved numeric;BEGIN
 IF NEW.sales_schedule_id IS NULL OR TG_OP<>'INSERT' THEN RETURN NEW;END IF;
 PERFORM 1 FROM company_codes WHERE tenant_id=NEW.tenant_id AND id=NEW.company_id FOR UPDATE;
 PERFORM 1 FROM sales_orders WHERE tenant_id=NEW.tenant_id AND id=NEW.sales_order_id FOR UPDATE;
 SELECT quantity INTO STRICT planned FROM sales_order_schedules WHERE tenant_id=NEW.tenant_id AND id=NEW.sales_schedule_id;
 SELECT coalesce(sum(CASE WHEN status='CANCELLED' THEN consumed_quantity ELSE quantity END),0) INTO reserved FROM stock_reservations WHERE tenant_id=NEW.tenant_id AND sales_schedule_id=NEW.sales_schedule_id;
 IF reserved+NEW.quantity+greatest(0,direct_requested(NEW.tenant_id,NEW.sales_schedule_id)-direct_received(NEW.tenant_id,NEW.sales_schedule_id))>planned THEN RAISE EXCEPTION 'AU-Einteilung ist bereits durch Bestand oder Beschaffung gedeckt';END IF;RETURN NEW;
END$$;
CREATE OR REPLACE FUNCTION direct_sales_reservation_guard() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE h sales_orders;l sales_order_items;s sales_order_schedules;claimed numeric;BEGIN
 IF NEW.sales_order_id IS NULL THEN RETURN NEW;END IF;
 IF TG_OP='UPDATE' THEN RETURN NEW;END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('DIRECT_SALES:'||NEW.tenant_id::text||':'||NEW.sales_order_id::text,0));
 SELECT * INTO STRICT h FROM sales_orders WHERE tenant_id=NEW.tenant_id AND id=NEW.sales_order_id;
 SELECT * INTO STRICT l FROM sales_order_items WHERE tenant_id=NEW.tenant_id AND id=NEW.sales_item_id;
 SELECT * INTO STRICT s FROM sales_order_schedules WHERE tenant_id=NEW.tenant_id AND id=NEW.sales_schedule_id;
 IF NEW.source NOT IN ('STOCK','PROCUREMENT') OR (NEW.source='STOCK' AND NEW.source_receipt_id IS NOT NULL) OR (NEW.source='PROCUREMENT' AND NEW.source_receipt_id IS NULL) OR h.execution_mode<>'DIRECT_SALES' OR h.status<>'RELEASED' OR h.released_snapshot IS NULL OR h.company_id<>NEW.company_id OR h.currency<>(SELECT currency FROM company_codes WHERE tenant_id=h.tenant_id AND id=h.company_id) OR l.order_id<>h.id OR s.order_id<>h.id OR s.item_id<>l.id OR l.product_id<>NEW.product_id OR l.rejection_reason IS NOT NULL OR l.delivery_block IS NOT NULL OR h.delivery_block IS NOT NULL OR NOT EXISTS(SELECT 1 FROM products p JOIN documents d ON d.tenant_id=p.tenant_id AND d.id=p.id WHERE p.tenant_id=l.tenant_id AND p.id=l.product_id AND p.kind='STOCK' AND p.status='ACTIVE' AND p.unit=l.unit AND d.organization_id=h.organization_id) THEN RAISE EXCEPTION 'AU-Reservierung benötigt freigegebenen Direktvertrieb und eine tatsächliche Lagerposition/Einteilung';END IF;
 IF NEW.source='PROCUREMENT' THEN
  IF NOT EXISTS(SELECT 1 FROM goods_receipt_items gi JOIN goods_receipts g ON g.tenant_id=gi.tenant_id AND g.id=gi.receipt_id JOIN purchase_order_items pi ON pi.tenant_id=gi.tenant_id AND pi.id=gi.purchase_order_item_id JOIN purchase_requisition_items qi ON qi.tenant_id=pi.tenant_id AND qi.id=pi.requisition_item_id JOIN order_requirement_items ri ON ri.tenant_id=qi.tenant_id AND ri.id=qi.requirement_item_id WHERE gi.tenant_id=NEW.tenant_id AND gi.receipt_id=NEW.source_receipt_id AND g.sales_order_id=h.id AND g.company_id=NEW.company_id AND g.movement_type='RECEIPT' AND gi.product_id=NEW.product_id AND gi.location_id=NEW.location_id AND gi.batch=NEW.batch AND gi.serial=NEW.serial AND ri.sales_schedule_id=s.id AND NOT EXISTS(SELECT 1 FROM goods_receipts rev WHERE rev.tenant_id=g.tenant_id AND rev.reverses_id=g.id) GROUP BY gi.tenant_id HAVING sum(gi.quantity)>=NEW.quantity+coalesce((SELECT sum(CASE WHEN r.status='CANCELLED' THEN r.consumed_quantity ELSE r.quantity END) FROM stock_reservations r WHERE r.tenant_id=NEW.tenant_id AND r.source_receipt_id=NEW.source_receipt_id AND r.sales_schedule_id=s.id AND r.product_id=NEW.product_id AND r.location_id=NEW.location_id AND r.batch=NEW.batch AND r.serial=NEW.serial),0)) THEN RAISE EXCEPTION 'AU-Eingangsreservierung benötigt die tatsächlich erhaltene eigene Bestellmenge mit gleichem Lager und Tracking';END IF;
 END IF;
 SELECT coalesce(sum(CASE WHEN status='CANCELLED' THEN consumed_quantity ELSE quantity END),0) INTO claimed FROM stock_reservations WHERE tenant_id=NEW.tenant_id AND sales_schedule_id=s.id;
 IF claimed+NEW.quantity>s.quantity THEN RAISE EXCEPTION 'AU-Reservierung überschreitet die noch offene Einteilungsmenge';END IF;
 RETURN NEW;
END$$;
CREATE OR REPLACE FUNCTION supplier_match_editable() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
 IF OLD.status NOT IN ('DRAFT','REJECTED') AND ROW(NEW.purchase_order_id,NEW.supplier_id,NEW.order_id,NEW.sales_order_id,NEW.match_note,NEW.matched_at,NEW.matched_by) IS DISTINCT FROM ROW(OLD.purchase_order_id,OLD.supplier_id,OLD.order_id,OLD.sales_order_id,OLD.match_note,OLD.matched_at,OLD.matched_by) THEN RAISE EXCEPTION 'Zuordnung eines eingereichten Rechnungseingangs ist unveränderlich';END IF;RETURN NEW;
END$$;
CREATE OR REPLACE FUNCTION check_supplier_match() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE h supplier_invoices;p purchase_orders;doc documents;c company_codes;docid uuid;BEGIN
 IF TG_TABLE_NAME='supplier_invoice_items' THEN docid:=NEW.invoice_id;ELSE docid:=NEW.id;END IF;
 SELECT * INTO h FROM supplier_invoices WHERE tenant_id=NEW.tenant_id AND id=docid;
 IF h.purchase_order_id IS NULL THEN
  IF h.supplier_id IS NOT NULL OR h.order_id IS NOT NULL OR h.sales_order_id IS NOT NULL OR EXISTS(SELECT 1 FROM supplier_invoice_items WHERE tenant_id=h.tenant_id AND invoice_id=h.id AND purchase_order_item_id IS NOT NULL) THEN RAISE EXCEPTION 'Rechnungszuordnung benötigt eine gemeinsame Bestellung';END IF;
  RETURN NULL;
 END IF;
 SELECT * INTO p FROM purchase_orders WHERE tenant_id=h.tenant_id AND id=h.purchase_order_id;
 SELECT * INTO doc FROM documents WHERE tenant_id=h.tenant_id AND id=p.id;
 SELECT * INTO c FROM company_codes WHERE tenant_id=h.tenant_id AND id=h.company_id;
 IF p.id IS NULL OR p.company_id<>h.company_id OR h.order_id IS DISTINCT FROM p.order_id OR h.sales_order_id IS DISTINCT FROM p.sales_order_id OR h.supplier_id IS DISTINCT FROM p.supplier_id OR c.organization_id<>doc.organization_id THEN RAISE EXCEPTION 'Kreditor, Auftragsquelle, Bestellung und Buchungskreis passen nicht zusammen';END IF;
 IF EXISTS(SELECT 1 FROM supplier_invoice_items i JOIN purchase_order_items pi ON pi.tenant_id=i.tenant_id AND pi.id=i.purchase_order_item_id WHERE i.tenant_id=h.tenant_id AND i.invoice_id=h.id AND pi.purchase_order_id<>p.id) THEN RAISE EXCEPTION 'Rechnungsposition ist einer anderen Bestellung zugeordnet';END IF;
 RETURN NULL;
END$$;
CREATE OR REPLACE FUNCTION validate_supplier_financial_posting() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE h supplier_invoices;docid uuid;s record;j record;op record;allocation_row record;total numeric;vat numeric;BEGIN
 IF TG_TABLE_NAME='supplier_invoices' THEN docid:=NEW.id;ELSE docid:=NEW.invoice_id;END IF;
 SELECT * INTO h FROM supplier_invoices WHERE tenant_id=NEW.tenant_id AND id=docid;
 IF NOT h.sealed THEN
  IF EXISTS(SELECT 1 FROM supplier_invoice_allocations WHERE tenant_id=h.tenant_id AND invoice_id=h.id) OR EXISTS(SELECT 1 FROM supplier_invoice_open_items WHERE tenant_id=h.tenant_id AND invoice_id=h.id) THEN RAISE EXCEPTION 'WE-Verrechnung und Kreditorenposten benötigen vollständig gebuchte Rechnung';END IF;RETURN NULL;
 END IF;
 SELECT d.number,d.created_by,o.sha256,im.parsed,im.state,im.scan_status INTO s FROM documents d JOIN supplier_invoice_originals o ON o.tenant_id=d.tenant_id AND o.invoice_id=d.id JOIN supplier_invoice_imports im ON im.tenant_id=d.tenant_id AND im.invoice_id=d.id WHERE d.tenant_id=h.tenant_id AND d.id=h.id;
 IF s.state<>'VALIDATED' OR s.scan_status NOT IN ('CLEAN','STRUCTURAL_XML') OR h.prepared_snapshot IS NULL OR h.snapshot-'taxReview' IS DISTINCT FROM h.prepared_snapshot OR h.snapshot->'original' IS DISTINCT FROM s.parsed OR h.snapshot->>'originalSha256' IS DISTINCT FROM s.sha256 OR h.snapshot->>'number' IS DISTINCT FROM s.number THEN RAISE EXCEPTION 'Eingangsrechnung benötigt unveränderten validierten Original- und Vorbereitungssnapshot';END IF;
 IF h.snapshot->>'id' IS DISTINCT FROM h.id::text OR h.snapshot->>'companyId' IS DISTINCT FROM h.company_id::text OR h.snapshot->>'supplierId' IS DISTINCT FROM h.supplier_id::text OR h.snapshot->>'purchaseOrderId' IS DISTINCT FROM h.purchase_order_id::text OR h.snapshot->>'orderId' IS DISTINCT FROM coalesce(h.sales_order_id,h.order_id)::text OR coalesce(h.snapshot->>'orderKind','SERVICE_ORDER') IS DISTINCT FROM (CASE WHEN h.sales_order_id IS NULL THEN 'SERVICE_ORDER' ELSE 'SALES_ORDER' END) OR h.snapshot->>'periodId' IS DISTINCT FROM h.period_id::text OR h.snapshot->>'postingDate' IS DISTINCT FROM h.posting_date::text OR h.snapshot->>'dueDate' IS DISTINCT FROM h.payable_due_date::text THEN RAISE EXCEPTION 'Finanzsnapshot passt nicht zu Rechnung, Quelle oder Buchungsdaten';END IF;
 IF h.prepared_by IS NULL OR h.matched_by IS NULL OR h.tax_reviewed_by IS NULL OR h.tax_reviewed_by IN(s.created_by,h.prepared_by,h.matched_by) OR NOT EXISTS(SELECT 1 FROM approval_instances ai JOIN approval_decisions ad ON ad.tenant_id=ai.tenant_id AND ad.instance_id=ai.id JOIN users u ON u.tenant_id=ad.tenant_id AND u.id=ad.actor_id WHERE ai.tenant_id=h.tenant_id AND ai.document_id=h.id AND ai.status='APPROVED' AND ai.four_eyes AND ai.subject_version=h.version-2 AND ad.decision='APPROVE' AND ad.step=jsonb_array_length(ai.steps_snapshot)-1 AND ad.actor_id=h.tax_reviewed_by AND ad.comment=h.tax_review_note AND ad.context->>'inputTaxChecked'='true' AND ad.context->>'preparedHash'=encode(sha256(convert_to(h.prepared_snapshot::text,'UTF8')),'hex') AND u.role IN ('ADMIN','ACCOUNTANT')) THEN RAISE EXCEPTION 'Unabhängige sachliche und steuerliche Eingangsrechnungsfreigabe fehlt';END IF;
 IF h.snapshot->'taxReview'->>'actorId' IS DISTINCT FROM h.tax_reviewed_by::text OR h.snapshot->'taxReview'->>'note' IS DISTINCT FROM h.tax_review_note OR h.tax_reviewed_at IS NULL OR h.posting_date<h.invoice_date THEN RAISE EXCEPTION 'Steuerfreigabe oder Buchungsdaten sind inkonsistent';END IF;
 SELECT sum(net) INTO total FROM supplier_invoice_items WHERE tenant_id=h.tenant_id AND invoice_id=h.id;
 SELECT sum(round(basis*rate/100,2)) INTO vat FROM(SELECT tax_rate AS rate,sum(net) AS basis FROM supplier_invoice_items WHERE tenant_id=h.tenant_id AND invoice_id=h.id GROUP BY tax_rate) v;
 IF total<>h.net OR vat<>h.tax OR NOT EXISTS(SELECT 1 FROM fiscal_periods p JOIN company_codes c ON c.tenant_id=p.tenant_id AND c.id=p.company_id WHERE p.tenant_id=h.tenant_id AND p.id=h.period_id AND c.id=h.company_id AND c.currency=h.currency AND p.status='OPEN' AND h.posting_date BETWEEN p.date_from AND p.date_to) THEN RAISE EXCEPTION 'Originalwerte, Vorsteuer oder offene passende Periode fehlen';END IF;
 IF EXISTS(SELECT 1 FROM supplier_invoice_items i WHERE i.tenant_id=h.tenant_id AND i.invoice_id=h.id AND ((SELECT coalesce(sum(quantity),0) FROM supplier_invoice_allocations a WHERE a.tenant_id=i.tenant_id AND a.invoice_item_id=i.id)<>i.quantity OR (SELECT coalesce(sum(net),0) FROM supplier_invoice_allocations a WHERE a.tenant_id=i.tenant_id AND a.invoice_item_id=i.id)<>i.net)) THEN RAISE EXCEPTION 'Vollständige mengen- und wertgleiche WE-Verrechnung jeder Originalposition fehlt';END IF;
 FOR allocation_row IN SELECT al.*,ii.purchase_order_item_id,ii.invoice_id AS source_invoice,ii.unit_net AS invoice_unit_net,ii.unit AS invoice_unit,pi.unit_price AS ordered_unit_net,oi.unit AS ordered_unit,gi.purchase_order_item_id AS receipt_po,gr.company_id,gr.order_id,gr.sales_order_id,gr.posting_date AS receipt_date FROM supplier_invoice_allocations al JOIN supplier_invoice_items ii ON ii.tenant_id=al.tenant_id AND ii.id=al.invoice_item_id JOIN purchase_order_items pi ON pi.tenant_id=ii.tenant_id AND pi.id=ii.purchase_order_item_id JOIN purchase_requisition_items qi ON qi.tenant_id=pi.tenant_id AND qi.id=pi.requisition_item_id JOIN order_requirement_items ri ON ri.tenant_id=qi.tenant_id AND ri.id=qi.requirement_item_id JOIN procurement_item_sources oi ON oi.tenant_id=ri.tenant_id AND oi.id=coalesce(ri.order_item_id,ri.sales_item_id) JOIN goods_receipt_items gi ON gi.tenant_id=al.tenant_id AND gi.id=al.receipt_item_id JOIN goods_receipts gr ON gr.tenant_id=gi.tenant_id AND gr.id=gi.receipt_id WHERE al.tenant_id=h.tenant_id AND al.invoice_id=h.id LOOP
  IF allocation_row.source_invoice<>h.id OR allocation_row.invoice_unit_net<>allocation_row.ordered_unit_net OR allocation_row.invoice_unit<>(CASE allocation_row.ordered_unit WHEN 'EA' THEN 'C62' WHEN 'ST' THEN 'C62' WHEN 'PC' THEN 'C62' WHEN 'H' THEN 'HUR' WHEN 'STD' THEN 'HUR' WHEN 'KM' THEN 'KMT' ELSE allocation_row.ordered_unit END) OR allocation_row.purchase_order_item_id IS DISTINCT FROM allocation_row.receipt_po OR allocation_row.company_id<>h.company_id OR allocation_row.order_id IS DISTINCT FROM h.order_id OR allocation_row.sales_order_id IS DISTINCT FROM h.sales_order_id OR allocation_row.receipt_date>h.posting_date OR (allocation_row.snapshot->>'quantity')::numeric IS DISTINCT FROM allocation_row.quantity OR (allocation_row.snapshot->>'net')::numeric IS DISTINCT FROM allocation_row.net OR allocation_row.snapshot->>'invoiceItemId' IS DISTINCT FROM allocation_row.invoice_item_id::text OR allocation_row.snapshot->>'receiptItemId' IS DISTINCT FROM allocation_row.receipt_item_id::text OR allocation_row.snapshot->>'grirAccountId' IS DISTINCT FROM allocation_row.grir_account_id::text THEN RAISE EXCEPTION 'Unzulässige oder verfälschte WE-/Auftragspositionszuordnung';END IF;
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

CREATE FUNCTION direct_receipt_header() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE p purchase_orders;h sales_orders;o goods_receipts;BEGIN
 IF NEW.sales_order_id IS NULL THEN RETURN NEW;END IF;
 PERFORM 1 FROM company_codes WHERE tenant_id=NEW.tenant_id AND id=NEW.company_id FOR UPDATE;
 SELECT * INTO STRICT h FROM sales_orders WHERE tenant_id=NEW.tenant_id AND id=NEW.sales_order_id FOR UPDATE;
 SELECT * INTO STRICT p FROM purchase_orders WHERE tenant_id=NEW.tenant_id AND id=NEW.purchase_order_id FOR UPDATE;
 IF h.execution_mode<>'DIRECT_SALES' OR h.status<>'RELEASED' OR h.released_snapshot IS NULL OR p.sales_order_id IS DISTINCT FROM h.id OR p.company_id IS DISTINCT FROM NEW.company_id OR h.company_id IS DISTINCT FROM NEW.company_id OR p.currency IS DISTINCT FROM NEW.currency OR h.currency IS DISTINCT FROM NEW.currency OR p.status NOT IN ('RELEASED','PARTIALLY_RECEIVED','FULLY_RECEIVED') OR NOT EXISTS(SELECT 1 FROM documents d JOIN users u ON u.tenant_id=d.tenant_id AND u.id=d.created_by JOIN user_organizations org ON org.tenant_id=u.tenant_id AND org.user_id=u.id WHERE d.tenant_id=NEW.tenant_id AND d.id=NEW.id AND d.kind='GOODS_RECEIPT' AND d.organization_id=h.organization_id AND org.organization_id=h.organization_id AND u.active AND u.role IN ('ADMIN','WAREHOUSE')) THEN RAISE EXCEPTION 'AU-Wareneingang benötigt eigene unabhängig freigegebene Bestellung und berechtigte Lagerbuchung';END IF;
 IF NEW.movement_type='RECEIPT_REVERSAL' THEN
  SELECT * INTO STRICT o FROM goods_receipts WHERE tenant_id=NEW.tenant_id AND id=NEW.reverses_id;
  IF o.movement_type<>'RECEIPT' OR NOT o.sealed OR o.sales_order_id IS DISTINCT FROM NEW.sales_order_id OR o.purchase_order_id IS DISTINCT FROM NEW.purchase_order_id OR o.company_id IS DISTINCT FROM NEW.company_id OR o.currency IS DISTINCT FROM NEW.currency OR NEW.posting_date<o.posting_date THEN RAISE EXCEPTION 'AU-WE-Storno benötigt denselben tatsächlichen Ursprung und späteres Buchungsdatum';END IF;
 END IF;RETURN NEW;
END$$;
CREATE TRIGGER direct_receipt_header BEFORE INSERT ON goods_receipts FOR EACH ROW EXECUTE FUNCTION direct_receipt_header();
CREATE FUNCTION direct_receipt_item() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE h goods_receipts;p record;digits integer;received numeric;settings material_inventory_settings;BEGIN
 SELECT * INTO STRICT h FROM goods_receipts WHERE tenant_id=NEW.tenant_id AND id=NEW.receipt_id;
 IF h.sales_order_id IS NULL THEN RETURN NEW;END IF;
 SELECT pi.*,i.product_id,i.unit,ri.sales_schedule_id INTO p FROM purchase_order_items pi JOIN purchase_requisition_items qi ON qi.tenant_id=pi.tenant_id AND qi.id=pi.requisition_item_id JOIN order_requirement_items ri ON ri.tenant_id=qi.tenant_id AND ri.id=qi.requirement_item_id JOIN sales_order_items i ON i.tenant_id=ri.tenant_id AND i.id=ri.sales_item_id WHERE pi.tenant_id=NEW.tenant_id AND pi.id=NEW.purchase_order_item_id AND pi.purchase_order_id=h.purchase_order_id AND i.order_id=h.sales_order_id;
 IF NOT FOUND OR NEW.product_id IS DISTINCT FROM p.product_id OR NEW.unit_price IS DISTINCT FROM p.unit_price OR NOT EXISTS(SELECT 1 FROM storage_locations l JOIN plants pl ON pl.tenant_id=l.tenant_id AND pl.id=l.plant_id WHERE l.tenant_id=NEW.tenant_id AND l.id=NEW.location_id AND pl.company_id=h.company_id) THEN RAISE EXCEPTION 'AU-WE-Position benötigt eigene Bestellposition, Artikel, Einkaufspreis und Lagerort';END IF;
 SELECT c.digits INTO STRICT digits FROM currencies c WHERE c.tenant_id=h.tenant_id AND c.code=h.currency;
 SELECT * INTO STRICT settings FROM material_inventory_settings WHERE tenant_id=NEW.tenant_id AND product_id=NEW.product_id;
 IF settings.serial_required IS DISTINCT FROM (NEW.serial<>'') OR settings.batch_required IS DISTINCT FROM (NEW.batch<>'') OR (NEW.serial<>'' AND NEW.quantity<>1) OR NEW.value<>round(NEW.quantity*NEW.unit_price,digits) THEN RAISE EXCEPTION 'AU-WE benötigt korrekte Trackingangaben und tatsächlichen Bestellwert';END IF;
 IF h.movement_type='RECEIPT' THEN
  SELECT coalesce(sum(CASE g.movement_type WHEN 'RECEIPT' THEN gi.quantity ELSE -gi.quantity END),0) INTO received FROM goods_receipt_items gi JOIN goods_receipts g ON g.tenant_id=gi.tenant_id AND g.id=gi.receipt_id WHERE gi.tenant_id=NEW.tenant_id AND gi.purchase_order_item_id=p.id;
  IF received+NEW.quantity>p.quantity THEN RAISE EXCEPTION 'AU-Teil-WE überschreitet tatsächliche offene Bestellmenge';END IF;
 END IF;RETURN NEW;
END$$;
CREATE TRIGGER direct_receipt_item BEFORE INSERT ON goods_receipt_items FOR EACH ROW EXECUTE FUNCTION direct_receipt_item();
CREATE FUNCTION direct_receipt_signature(t uuid,r uuid) RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY purchase_order_item_id,product_id,location_id,batch,serial,unit_price),'[]'::jsonb) FROM(SELECT purchase_order_item_id,product_id,location_id,batch,serial,unit_price,sum(quantity) AS quantity,sum(value) AS value FROM goods_receipt_items WHERE tenant_id=t AND receipt_id=r GROUP BY purchase_order_item_id,product_id,location_id,batch,serial,unit_price) s
$$;
CREATE FUNCTION direct_receipt_complete() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE h goods_receipts;target uuid;original_journal uuid;counter_journal uuid;BEGIN
 IF TG_TABLE_NAME='goods_receipts' THEN target=NEW.id;ELSE target=NEW.receipt_id;END IF;
 SELECT * INTO STRICT h FROM goods_receipts WHERE tenant_id=NEW.tenant_id AND id=target;
 IF h.sales_order_id IS NULL THEN RETURN NULL;END IF;
 IF h.movement_type='RECEIPT_REVERSAL' THEN
  IF direct_receipt_signature(h.tenant_id,h.id) IS DISTINCT FROM direct_receipt_signature(h.tenant_id,h.reverses_id) OR EXISTS(SELECT 1 FROM stock_reservations WHERE tenant_id=h.tenant_id AND source_receipt_id=h.reverses_id AND (consumed_quantity>0 OR status='ACTIVE')) THEN RAISE EXCEPTION 'AU-WE-Storno benötigt vollständige Originalmengen/Werte und unverbrauchte freigegebene Eingangsreservierung';END IF;
  IF (SELECT sum(value)>0 FROM goods_receipt_items WHERE tenant_id=h.tenant_id AND receipt_id=h.id) THEN
   SELECT id INTO STRICT original_journal FROM journals WHERE tenant_id=h.tenant_id AND source_id=h.reverses_id AND status='POSTED';
   SELECT id INTO STRICT counter_journal FROM journals WHERE tenant_id=h.tenant_id AND source_id=h.id AND reversal_of=original_journal AND status='POSTED';
   IF journal_cost_signature(h.tenant_id,counter_journal,false) IS DISTINCT FROM journal_cost_signature(h.tenant_id,original_journal,true) THEN RAISE EXCEPTION 'AU-WE-Gegenbuchung muss ursprüngliche Konten und Originalwerte erhalten';END IF;
  END IF;
 END IF;
 IF EXISTS(SELECT 1 FROM sales_order_schedules sc WHERE sc.tenant_id=h.tenant_id AND sc.order_id=h.sales_order_id AND coalesce((SELECT sum(CASE WHEN r.status='CANCELLED' THEN r.consumed_quantity ELSE r.quantity END) FROM stock_reservations r WHERE r.tenant_id=sc.tenant_id AND r.sales_schedule_id=sc.id),0)+greatest(0,direct_requested(sc.tenant_id,sc.id)-direct_received(sc.tenant_id,sc.id))>sc.quantity) THEN RAISE EXCEPTION 'AU-Bestand und verbleibende Beschaffung überschreiten tatsächliche Einteilung';END IF;
 RETURN NULL;
END$$;
CREATE CONSTRAINT TRIGGER direct_receipt_complete AFTER INSERT OR UPDATE ON goods_receipts DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION direct_receipt_complete();
CREATE CONSTRAINT TRIGGER direct_receipt_items_complete AFTER INSERT ON goods_receipt_items DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION direct_receipt_complete();
