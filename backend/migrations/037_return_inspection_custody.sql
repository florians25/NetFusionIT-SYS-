-- Customer-owned inspection custody is physically present but never free or valued own stock.
ALTER TABLE documents DROP CONSTRAINT documents_kind_check;
ALTER TABLE documents ADD CONSTRAINT documents_kind_check CHECK(kind IN('WORK_ORDER_TASK','TICKET','SERVICE_CASE','BUSINESS_PARTNER','APPROVAL','TECHNICAL_OBJECT','SERVICE_CONTRACT','FIELD_VISIT','SERVICE_ORDER','MATERIAL','MATERIAL_REQUIREMENT','REQUISITION','PURCHASE_ORDER','GOODS_RECEIPT','GOODS_ISSUE','SERVICE_REPORT','INVOICE','CANCELLATION','ACCOUNTING','PAYMENT','QUOTATION','SALES_ORDER','CREDIT_NOTE','BILLING_REQUEST','PARTNER_ACCOUNT','COMPANY_BILLING_PROFILE','SUPPLIER_INVOICE','SUPPLIER_INVOICE_REVERSAL','STOCK_TRANSFER','INVENTORY_COUNT','CUSTOMER_RETURN','CUSTOMER_RETURN_RECEIPT','RETURN_CUSTODY','RETURN_INSPECTION'));
CREATE TABLE return_custody_events(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,return_id uuid NOT NULL,return_line_id uuid NOT NULL,company_id uuid NOT NULL,bin_id uuid NOT NULL,
 movement_type text NOT NULL CHECK(movement_type IN('ARRIVAL','DISPATCH','REVERSAL')),lot_id uuid,reverses_id uuid,
 quantity numeric(24,6) NOT NULL CHECK(quantity>0),movement_date date NOT NULL,reason text NOT NULL CHECK(length(reason) BETWEEN 15 AND 2000),version integer NOT NULL DEFAULT 1 CHECK(version=1),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,reverses_id),CHECK((movement_type='REVERSAL')=(reverses_id IS NOT NULL)),CHECK((movement_type='ARRIVAL')=(lot_id IS NULL)),
 FOREIGN KEY(tenant_id,id) REFERENCES documents(tenant_id,id),FOREIGN KEY(tenant_id,return_id) REFERENCES customer_returns(tenant_id,id),FOREIGN KEY(tenant_id,return_line_id) REFERENCES customer_return_lines(tenant_id,id),FOREIGN KEY(tenant_id,company_id) REFERENCES company_codes(tenant_id,id),FOREIGN KEY(tenant_id,bin_id) REFERENCES warehouse_bins(tenant_id,id),FOREIGN KEY(tenant_id,lot_id) REFERENCES return_custody_events(tenant_id,id),FOREIGN KEY(tenant_id,reverses_id) REFERENCES return_custody_events(tenant_id,id)
);
CREATE TABLE return_inspections(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,return_id uuid NOT NULL,company_id uuid NOT NULL,lot_id uuid NOT NULL,reverses_id uuid,
 accepted_quantity numeric(24,6) NOT NULL CHECK(accepted_quantity>=0),rejected_quantity numeric(24,6) NOT NULL CHECK(rejected_quantity>=0),condition_code text NOT NULL CHECK(condition_code IN('INTACT','DAMAGED','WRONG_ITEM','INCOMPLETE','OTHER')),
 inspection_date date NOT NULL,findings text NOT NULL CHECK(length(findings) BETWEEN 15 AND 4000),reason text NOT NULL CHECK(length(reason) BETWEEN 15 AND 2000),version integer NOT NULL DEFAULT 1 CHECK(version=1),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,reverses_id),FOREIGN KEY(tenant_id,id) REFERENCES documents(tenant_id,id),FOREIGN KEY(tenant_id,return_id) REFERENCES customer_returns(tenant_id,id),FOREIGN KEY(tenant_id,company_id) REFERENCES company_codes(tenant_id,id),FOREIGN KEY(tenant_id,lot_id) REFERENCES return_custody_events(tenant_id,id),FOREIGN KEY(tenant_id,reverses_id) REFERENCES return_inspections(tenant_id,id)
);
ALTER TABLE customer_return_receipt_items ADD COLUMN bin_id uuid,ADD COLUMN custody_lot_id uuid,ADD FOREIGN KEY(tenant_id,bin_id) REFERENCES warehouse_bins(tenant_id,id),ADD FOREIGN KEY(tenant_id,custody_lot_id) REFERENCES return_custody_events(tenant_id,id);
DO $$DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['return_custody_events','return_inspections'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY tenant_isolation ON %I USING(tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid) WITH CHECK(tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid)',t);
 EXECUTE format('CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION reject_attachment_mutation()',t);
END LOOP;END$$;
CREATE FUNCTION return_lot_state(t uuid,lot uuid) RETURNS TABLE(arrived numeric,dispatched numeric,released numeric,held numeric,accepted numeric,rejected numeric,inspection_id uuid) LANGUAGE sql STABLE AS $$
 WITH a AS(SELECT * FROM return_custody_events WHERE tenant_id=t AND id=lot AND movement_type='ARRIVAL'),
 x AS(SELECT a.quantity-CASE WHEN EXISTS(SELECT 1 FROM return_custody_events WHERE tenant_id=t AND reverses_id=a.id) THEN a.quantity ELSE 0 END AS arrived,
 coalesce((SELECT sum(d.quantity) FROM return_custody_events d WHERE d.tenant_id=t AND d.lot_id=lot AND d.movement_type='DISPATCH' AND NOT EXISTS(SELECT 1 FROM return_custody_events rev WHERE rev.tenant_id=t AND rev.reverses_id=d.id)),0) AS dispatched,
 coalesce((SELECT sum(CASE h.movement_type WHEN 'RECEIPT' THEN i.quantity ELSE -i.quantity END) FROM customer_return_receipt_items i JOIN customer_return_receipts h ON h.tenant_id=i.tenant_id AND h.id=i.receipt_id WHERE i.tenant_id=t AND i.custody_lot_id=lot),0) AS released FROM a),
 i AS(SELECT * FROM return_inspections s WHERE s.tenant_id=t AND s.lot_id=lot AND s.reverses_id IS NULL AND NOT EXISTS(SELECT 1 FROM return_inspections r WHERE r.tenant_id=t AND r.reverses_id=s.id))
 SELECT x.arrived,x.dispatched,x.released,x.arrived-x.dispatched-x.released,coalesce(i.accepted_quantity,0),coalesce(i.rejected_quantity,0),i.id FROM x LEFT JOIN i ON true
$$;
CREATE FUNCTION return_bin_held(t uuid,bin uuid) RETURNS numeric LANGUAGE sql STABLE AS $$SELECT coalesce(sum(s.held),0) FROM return_custody_events a CROSS JOIN LATERAL return_lot_state(t,a.id) s WHERE a.tenant_id=t AND a.bin_id=bin AND a.movement_type='ARRIVAL'$$;
CREATE FUNCTION return_custody_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r customer_returns;l customer_return_lines;g goods_issue_items;b warehouse_bins;old return_custody_events;lot return_custody_events;s record;bound numeric;inspected record;BEGIN
 SELECT * INTO STRICT r FROM customer_returns WHERE tenant_id=NEW.tenant_id AND id=NEW.return_id;
 PERFORM 1 FROM company_codes WHERE tenant_id=r.tenant_id AND id=r.company_id FOR UPDATE;
 PERFORM 1 FROM customer_returns WHERE tenant_id=r.tenant_id AND id=r.id FOR UPDATE;
 SELECT * INTO STRICT l FROM customer_return_lines WHERE tenant_id=NEW.tenant_id AND id=NEW.return_line_id;
 SELECT * INTO STRICT g FROM goods_issue_items WHERE tenant_id=l.tenant_id AND id=l.issue_item_id;
 SELECT * INTO STRICT b FROM warehouse_bins WHERE tenant_id=NEW.tenant_id AND id=NEW.bin_id FOR UPDATE;
 IF r.status<>'RELEASED' OR l.return_id<>r.id OR NEW.company_id<>r.company_id OR b.company_id<>r.company_id OR b.location_id<>g.location_id OR b.system_buffer THEN RAISE EXCEPTION 'Freigegebene Retoure und eigenes Fach im ursprünglichen Lagerort erforderlich';END IF;
 IF NEW.movement_date>(now() AT TIME ZONE 'Europe/Berlin')::date OR NEW.movement_date<(SELECT delivery_date FROM goods_issues WHERE tenant_id=r.tenant_id AND id=r.issue_id) THEN RAISE EXCEPTION 'Zulässiges tatsächliches Retourendatum erforderlich';END IF;
 IF NOT EXISTS(SELECT 1 FROM documents d JOIN documents src ON src.tenant_id=d.tenant_id AND src.id=r.id WHERE d.tenant_id=NEW.tenant_id AND d.id=NEW.id AND d.kind='RETURN_CUSTODY' AND d.organization_id=src.organization_id) THEN RAISE EXCEPTION 'Passender Prüfbestandsbeleg fehlt';END IF;
 IF b.blocked OR EXISTS(SELECT 1 FROM warehouse_racks k JOIN warehouse_areas a ON a.tenant_id=k.tenant_id AND a.id=k.area_id WHERE k.tenant_id=b.tenant_id AND k.id=b.rack_id AND (k.blocked OR a.blocked)) OR EXISTS(SELECT 1 FROM inventory_count_scopes WHERE tenant_id=b.tenant_id AND bin_id=b.id AND released_at IS NULL) THEN RAISE EXCEPTION 'Prüffach ist für Bewegungen gesperrt';END IF;
 IF NEW.movement_type='REVERSAL' THEN
  SELECT * INTO STRICT old FROM return_custody_events WHERE tenant_id=NEW.tenant_id AND id=NEW.reverses_id;
  IF old.movement_type='REVERSAL' OR (NEW.return_id,NEW.return_line_id,NEW.company_id,NEW.bin_id,NEW.quantity) IS DISTINCT FROM (old.return_id,old.return_line_id,old.company_id,old.bin_id,old.quantity) OR NEW.lot_id IS DISTINCT FROM coalesce(old.lot_id,old.id) OR NEW.movement_date<old.movement_date THEN RAISE EXCEPTION 'Gegenbewegung muss ursprünglichen Prüfbestand exakt zurücknehmen';END IF;
 END IF;
 IF NEW.movement_type='ARRIVAL' THEN
  SELECT coalesce(sum(ls.arrived),0) INTO bound FROM return_custody_events a CROSS JOIN LATERAL return_lot_state(a.tenant_id,a.id) ls WHERE a.tenant_id=l.tenant_id AND a.return_line_id=l.id AND a.movement_type='ARRIVAL';
  -- Released custody is already included in arrived; add only historical direct receipts.
  SELECT bound+coalesce(sum(CASE h.movement_type WHEN 'RECEIPT' THEN i.quantity ELSE -i.quantity END),0) INTO bound FROM customer_return_receipt_items i JOIN customer_return_receipts h ON h.tenant_id=i.tenant_id AND h.id=i.receipt_id WHERE i.tenant_id=l.tenant_id AND i.return_line_id=l.id AND i.custody_lot_id IS NULL;
  IF bound+NEW.quantity>l.quantity OR (g.serial<>'' AND NEW.quantity<>1) THEN RAISE EXCEPTION 'Prüfeingang überschreitet tatsächliche angemeldete Restmenge';END IF;
 ELSE
  SELECT * INTO STRICT lot FROM return_custody_events WHERE tenant_id=NEW.tenant_id AND id=NEW.lot_id AND movement_type='ARRIVAL';
  SELECT * INTO s FROM return_lot_state(NEW.tenant_id,lot.id);
  IF (lot.return_id,lot.return_line_id,lot.bin_id) IS DISTINCT FROM (NEW.return_id,NEW.return_line_id,NEW.bin_id) OR NEW.movement_date<lot.movement_date THEN RAISE EXCEPTION 'Ursprüngliches Prüflos erforderlich';END IF;
  IF NEW.movement_type='DISPATCH' THEN
   IF s.inspection_id IS NULL OR NEW.quantity>s.rejected-s.dispatched OR NEW.quantity>s.held OR NEW.movement_date<(SELECT inspection_date FROM return_inspections WHERE tenant_id=NEW.tenant_id AND id=s.inspection_id) THEN RAISE EXCEPTION 'Nur tatsächlich geprüfte abgelehnte Restmenge zurücksenden';END IF;
  ELSIF old.movement_type='ARRIVAL' AND (s.inspection_id IS NOT NULL OR s.released<>0 OR s.dispatched<>0 OR s.held<>lot.quantity) THEN RAISE EXCEPTION 'Prüfeingang hat Folgeaktivitäten; diese zuerst gegenbuchen';
  END IF;
 END IF;
 -- No own stock may share a custody bin, including a reversed dispatch arriving again.
 IF NEW.movement_type='ARRIVAL' OR (NEW.movement_type='REVERSAL' AND old.movement_type='DISPATCH') THEN
  IF EXISTS(SELECT 1 FROM warehouse_bin_balances WHERE tenant_id=b.tenant_id AND bin_id=b.id AND quantity>0) THEN RAISE EXCEPTION 'Kunden-Prüfbestand benötigt ein vom eigenen Bestand getrenntes Fach';END IF;
  IF NOT b.allow_mixed_products AND EXISTS(SELECT 1 FROM return_custody_events a JOIN customer_return_lines x ON x.tenant_id=a.tenant_id AND x.id=a.return_line_id JOIN goods_issue_items gi ON gi.tenant_id=x.tenant_id AND gi.id=x.issue_item_id CROSS JOIN LATERAL return_lot_state(a.tenant_id,a.id) ls WHERE a.tenant_id=b.tenant_id AND a.bin_id=b.id AND a.movement_type='ARRIVAL' AND ls.held>0 AND gi.product_id<>g.product_id) THEN RAISE EXCEPTION 'Prüffach erlaubt keine Artikelvermischung';END IF;
  IF NOT b.allow_mixed_batches AND EXISTS(SELECT 1 FROM return_custody_events a JOIN customer_return_lines x ON x.tenant_id=a.tenant_id AND x.id=a.return_line_id JOIN goods_issue_items gi ON gi.tenant_id=x.tenant_id AND gi.id=x.issue_item_id CROSS JOIN LATERAL return_lot_state(a.tenant_id,a.id) ls WHERE a.tenant_id=b.tenant_id AND a.bin_id=b.id AND a.movement_type='ARRIVAL' AND ls.held>0 AND gi.product_id=g.product_id AND gi.batch<>g.batch) THEN RAISE EXCEPTION 'Prüffach erlaubt keine Chargenvermischung';END IF;
  IF b.capacity IS NOT NULL AND (b.capacity_unit<>(SELECT unit FROM products WHERE tenant_id=g.tenant_id AND id=g.product_id) OR return_bin_held(b.tenant_id,b.id)+NEW.quantity>b.capacity) THEN RAISE EXCEPTION 'Prüffachkapazität überschritten';END IF;
  IF g.serial<>'' AND (EXISTS(SELECT 1 FROM warehouse_bin_balances WHERE tenant_id=g.tenant_id AND product_id=g.product_id AND serial=g.serial AND quantity>0) OR EXISTS(SELECT 1 FROM return_custody_events a JOIN customer_return_lines x ON x.tenant_id=a.tenant_id AND x.id=a.return_line_id JOIN goods_issue_items gi ON gi.tenant_id=x.tenant_id AND gi.id=x.issue_item_id CROSS JOIN LATERAL return_lot_state(a.tenant_id,a.id) ls WHERE a.tenant_id=g.tenant_id AND a.movement_type='ARRIVAL' AND ls.held>0 AND gi.product_id=g.product_id AND gi.serial=g.serial)) THEN RAISE EXCEPTION 'Seriennummer ist bereits physisch vorhanden';END IF;
 END IF;
 RETURN NEW;
END$$;
CREATE TRIGGER custody_guard BEFORE INSERT ON return_custody_events FOR EACH ROW EXECUTE FUNCTION return_custody_guard();
CREATE FUNCTION return_inspection_guard() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE a return_custody_events;r customer_returns;s record;o return_inspections;BEGIN
 SELECT * INTO STRICT a FROM return_custody_events WHERE tenant_id=NEW.tenant_id AND id=NEW.lot_id AND movement_type='ARRIVAL';
 SELECT * INTO STRICT r FROM customer_returns WHERE tenant_id=a.tenant_id AND id=a.return_id;
 PERFORM 1 FROM company_codes WHERE tenant_id=r.tenant_id AND id=r.company_id FOR UPDATE;
 PERFORM 1 FROM customer_returns WHERE tenant_id=r.tenant_id AND id=r.id FOR UPDATE;
 SELECT * INTO s FROM return_lot_state(a.tenant_id,a.id);
 IF r.status<>'RELEASED' OR NEW.return_id<>r.id OR NEW.company_id<>r.company_id OR NEW.inspection_date<a.movement_date OR NEW.inspection_date>(now() AT TIME ZONE 'Europe/Berlin')::date OR s.arrived=0 THEN RAISE EXCEPTION 'Wirksamer Prüfeingang und zulässiges Prüfdatum erforderlich';END IF;
 IF NOT EXISTS(SELECT 1 FROM documents d JOIN documents src ON src.tenant_id=d.tenant_id AND src.id=r.id WHERE d.tenant_id=NEW.tenant_id AND d.id=NEW.id AND d.kind='RETURN_INSPECTION' AND d.organization_id=src.organization_id) THEN RAISE EXCEPTION 'Prüfprotokollbeleg fehlt';END IF;
 IF EXISTS(SELECT 1 FROM customer_return_lines rl JOIN goods_issue_items gi ON gi.tenant_id=rl.tenant_id AND gi.id=rl.issue_item_id WHERE rl.tenant_id=a.tenant_id AND rl.id=a.return_line_id AND gi.serial<>'' AND (NEW.accepted_quantity NOT IN(0,1) OR NEW.rejected_quantity NOT IN(0,1))) THEN RAISE EXCEPTION 'Seriennummer darf bei der Prüfung nicht geteilt werden';END IF;
 IF NEW.reverses_id IS NULL THEN
  IF s.inspection_id IS NOT NULL OR NEW.accepted_quantity+NEW.rejected_quantity<>a.quantity THEN RAISE EXCEPTION 'Ein Prüflos vollständig und genau einmal auf angenommene/abgelehnte Mengen aufteilen';END IF;
 ELSE
  SELECT * INTO STRICT o FROM return_inspections WHERE tenant_id=NEW.tenant_id AND id=NEW.reverses_id;
  IF s.inspection_id IS DISTINCT FROM o.id OR o.reverses_id IS NOT NULL OR (NEW.lot_id,NEW.accepted_quantity,NEW.rejected_quantity,NEW.condition_code,NEW.findings) IS DISTINCT FROM (o.lot_id,o.accepted_quantity,o.rejected_quantity,o.condition_code,o.findings) OR NEW.inspection_date<o.inspection_date OR s.released<>0 OR s.dispatched<>0 THEN RAISE EXCEPTION 'Prüfentscheidung erst nach Gegenbuchung aller Folgeaktivitäten exakt zurücknehmen';END IF;
 END IF;RETURN NEW;
END$$;
CREATE TRIGGER inspection_guard BEFORE INSERT ON return_inspections FOR EACH ROW EXECUTE FUNCTION return_inspection_guard();
-- Every own-stock path and inventory count observes custody separation, even direct SQL.
CREATE FUNCTION return_custody_separation() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE bin uuid;BEGIN
 IF TG_TABLE_NAME='warehouse_bins' THEN bin=NEW.id;ELSE bin=NEW.bin_id;END IF;
 PERFORM 1 FROM warehouse_bins WHERE tenant_id=NEW.tenant_id AND id=bin FOR UPDATE;
 IF return_bin_held(NEW.tenant_id,bin)>0 THEN
  IF TG_TABLE_NAME='warehouse_bin_entries' THEN IF NEW.quantity>0 THEN RAISE EXCEPTION 'Fach enthält gesperrten Kunden-Prüfbestand; getrenntes Zielfach wählen';END IF;
  ELSIF TG_TABLE_NAME='inventory_count_scopes' THEN RAISE EXCEPTION 'Prüfbestand wird getrennt vom eigenen Inventurbestand geführt';
  ELSIF TG_TABLE_NAME='warehouse_bins' THEN IF (NEW.location_id,NEW.company_id,NEW.capacity,NEW.capacity_unit,NEW.allow_mixed_products,NEW.allow_mixed_batches,NEW.rack_id,NEW.code) IS DISTINCT FROM (OLD.location_id,OLD.company_id,OLD.capacity,OLD.capacity_unit,OLD.allow_mixed_products,OLD.allow_mixed_batches,OLD.rack_id,OLD.code) THEN RAISE EXCEPTION 'Belegtes Prüffach zunächst vollständig räumen';END IF;END IF;
 END IF;RETURN NEW;
END$$;
CREATE TRIGGER custody_stock_separation BEFORE INSERT ON warehouse_bin_entries FOR EACH ROW EXECUTE FUNCTION return_custody_separation();
CREATE TRIGGER custody_count_separation BEFORE INSERT ON inventory_count_scopes FOR EACH ROW EXECUTE FUNCTION return_custody_separation();
CREATE TRIGGER custody_bin_separation BEFORE UPDATE ON warehouse_bins FOR EACH ROW EXECUTE FUNCTION return_custody_separation();
CREATE FUNCTION return_custody_cancel_guard() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
 IF NEW.status='CANCELLED' AND EXISTS(SELECT 1 FROM return_custody_events a CROSS JOIN LATERAL return_lot_state(a.tenant_id,a.id) s WHERE a.tenant_id=NEW.tenant_id AND a.return_id=NEW.id AND a.movement_type='ARRIVAL' AND s.arrived>0) THEN RAISE EXCEPTION 'Wirksame Prüfeingänge zuerst mit ihren Folgeaktivitäten gegenbuchen';END IF;RETURN NEW;
END$$;
CREATE TRIGGER custody_cancel_guard BEFORE UPDATE ON customer_returns FOR EACH ROW EXECUTE FUNCTION return_custody_cancel_guard();

CREATE FUNCTION return_receipt_custody_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE h customer_return_receipts;g goods_issue_items;l customer_return_lines;b warehouse_bins;a return_custody_events;s record;o customer_return_receipt_items;bound numeric;BEGIN
 SELECT * INTO STRICT h FROM customer_return_receipts WHERE tenant_id=NEW.tenant_id AND id=NEW.receipt_id;
 PERFORM 1 FROM company_codes WHERE tenant_id=h.tenant_id AND id=h.company_id FOR UPDATE;
 SELECT * INTO STRICT l FROM customer_return_lines WHERE tenant_id=NEW.tenant_id AND id=NEW.return_line_id;
 SELECT * INTO STRICT g FROM goods_issue_items WHERE tenant_id=l.tenant_id AND id=l.issue_item_id;
 IF h.movement_type='REVERSAL' THEN
  SELECT * INTO STRICT o FROM customer_return_receipt_items WHERE tenant_id=NEW.tenant_id AND receipt_id=h.reverses_id AND return_line_id=l.id;
  IF NEW.bin_id IS NULL THEN NEW.bin_id=coalesce(o.bin_id,g.bin_id);END IF;
  IF NEW.bin_id IS DISTINCT FROM coalesce(o.bin_id,g.bin_id) OR NEW.custody_lot_id IS DISTINCT FROM o.custody_lot_id THEN RAISE EXCEPTION 'Retourenstorno muss tatsächliches ursprüngliches Fach und Prüflos erhalten';END IF;
 ELSE
  IF NEW.bin_id IS NULL THEN NEW.bin_id=g.bin_id;END IF;
 END IF;
 SELECT * INTO STRICT b FROM warehouse_bins WHERE tenant_id=NEW.tenant_id AND id=NEW.bin_id;
 IF b.location_id<>g.location_id OR b.company_id<>h.company_id THEN RAISE EXCEPTION 'Zielfach muss im ursprünglichen Lagerort und Buchungskreis liegen';END IF;
 IF NEW.custody_lot_id IS NOT NULL THEN
  SELECT * INTO STRICT a FROM return_custody_events WHERE tenant_id=NEW.tenant_id AND id=NEW.custody_lot_id AND movement_type='ARRIVAL';
  SELECT * INTO s FROM return_lot_state(a.tenant_id,a.id);
  IF a.return_line_id<>l.id OR a.return_id<>h.return_id OR a.bin_id=b.id OR h.received_date<>a.movement_date THEN RAISE EXCEPTION 'Tatsächliches Prüflos, ursprüngliches Eingangsdatum und getrenntes Zielfach erforderlich';END IF;
  IF h.movement_type='RECEIPT' THEN
   IF s.inspection_id IS NULL OR NEW.quantity>s.accepted-s.released OR NEW.quantity>s.held OR h.posting_date<(SELECT inspection_date FROM return_inspections WHERE tenant_id=a.tenant_id AND id=s.inspection_id) THEN RAISE EXCEPTION 'Nur freigegebene geprüfte Restmenge in eigenen Bestand übernehmen';END IF;
  ELSE
   IF EXISTS(SELECT 1 FROM warehouse_bins cb JOIN return_custody_events ca ON ca.tenant_id=cb.tenant_id AND ca.bin_id=cb.id JOIN customer_return_lines cl ON cl.tenant_id=ca.tenant_id AND cl.id=ca.return_line_id JOIN goods_issue_items cg ON cg.tenant_id=cl.tenant_id AND cg.id=cl.issue_item_id CROSS JOIN LATERAL return_lot_state(ca.tenant_id,ca.id) cs WHERE cb.tenant_id=a.tenant_id AND cb.id=a.bin_id AND ca.movement_type='ARRIVAL' AND cs.held>0 AND ((NOT cb.allow_mixed_products AND cg.product_id<>g.product_id) OR (NOT cb.allow_mixed_batches AND cg.product_id=g.product_id AND cg.batch<>g.batch))) THEN RAISE EXCEPTION 'Ursprüngliches Prüffach erlaubt keine Vermischung mit inzwischen anderem Prüfbestand';END IF;
   PERFORM 1 FROM warehouse_bins WHERE tenant_id=a.tenant_id AND id=a.bin_id FOR UPDATE;
   IF EXISTS(SELECT 1 FROM warehouse_bin_balances WHERE tenant_id=a.tenant_id AND bin_id=a.bin_id AND quantity>0) OR EXISTS(SELECT 1 FROM warehouse_bins WHERE tenant_id=a.tenant_id AND id=a.bin_id AND (blocked OR (capacity IS NOT NULL AND return_bin_held(a.tenant_id,a.bin_id)+NEW.quantity>capacity))) OR EXISTS(SELECT 1 FROM warehouse_racks k JOIN warehouse_bins wb ON wb.tenant_id=k.tenant_id AND wb.rack_id=k.id JOIN warehouse_areas ar ON ar.tenant_id=k.tenant_id AND ar.id=k.area_id WHERE wb.tenant_id=a.tenant_id AND wb.id=a.bin_id AND (k.blocked OR ar.blocked)) OR EXISTS(SELECT 1 FROM inventory_count_scopes WHERE tenant_id=a.tenant_id AND bin_id=a.bin_id AND released_at IS NULL) THEN RAISE EXCEPTION 'Ursprüngliches Prüffach hat keinen freien zulässigen Platz für Gegenbewegung';END IF;
  END IF;
 ELSIF h.movement_type='RECEIPT' THEN
  SELECT coalesce(sum(x.arrived),0) INTO bound FROM return_custody_events ca CROSS JOIN LATERAL return_lot_state(ca.tenant_id,ca.id) x WHERE ca.tenant_id=l.tenant_id AND ca.return_line_id=l.id AND ca.movement_type='ARRIVAL';
  SELECT bound+coalesce(sum(CASE r.movement_type WHEN 'RECEIPT' THEN i.quantity ELSE -i.quantity END),0) INTO bound FROM customer_return_receipt_items i JOIN customer_return_receipts r ON r.tenant_id=i.tenant_id AND r.id=i.receipt_id WHERE i.tenant_id=l.tenant_id AND i.return_line_id=l.id AND i.custody_lot_id IS NULL;
  IF bound+NEW.quantity>l.quantity THEN RAISE EXCEPTION 'Angemeldete Menge ist bereits in Prüflosen oder tatsächlichen Rücknahmen gebunden';END IF;
 END IF;
 RETURN NEW;
END$$;
CREATE TRIGGER return_receipt_custody_guard BEFORE INSERT ON customer_return_receipt_items FOR EACH ROW EXECUTE FUNCTION return_receipt_custody_guard();

CREATE OR REPLACE FUNCTION customer_return_apply() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE h customer_return_receipts;r customer_returns;l customer_return_lines;gi goods_issue_items;g goods_issues;prior record;q numeric;v numeric;credit numeric;sgn integer;account uuid;old customer_return_receipt_items;BEGIN
 IF NEW.tenant_id IS DISTINCT FROM nullif(current_setting('app.tenant_id',true),'')::uuid THEN RAISE EXCEPTION 'Mandantenkontext fehlt';END IF;
 SELECT * INTO STRICT h FROM customer_return_receipts WHERE tenant_id=NEW.tenant_id AND id=NEW.receipt_id;
 PERFORM 1 FROM company_codes WHERE tenant_id=h.tenant_id AND id=h.company_id FOR UPDATE;
 SELECT * INTO STRICT r FROM customer_returns WHERE tenant_id=h.tenant_id AND id=h.return_id FOR UPDATE;
 SELECT * INTO STRICT l FROM customer_return_lines WHERE tenant_id=NEW.tenant_id AND id=NEW.return_line_id;
 SELECT * INTO STRICT gi FROM goods_issue_items WHERE tenant_id=l.tenant_id AND id=l.issue_item_id;SELECT * INTO STRICT g FROM goods_issues WHERE tenant_id=gi.tenant_id AND id=gi.issue_id;
 IF h.sealed OR r.status<>'RELEASED' OR l.return_id<>r.id OR h.company_id<>r.company_id OR EXISTS(SELECT 1 FROM goods_issues WHERE tenant_id=g.tenant_id AND reverses_id=g.id) THEN RAISE EXCEPTION 'Freigegebene tatsächliche Retoure erforderlich';END IF;
 IF EXISTS(SELECT 1 FROM inventory_count_scopes WHERE tenant_id=gi.tenant_id AND bin_id=NEW.bin_id AND released_at IS NULL) THEN RAISE EXCEPTION 'Retourenfach ist für Inventur gesperrt';END IF;
 SELECT * INTO prior FROM customer_return_received(l.tenant_id,l.id);prior.quantity=prior.quantity-CASE h.movement_type WHEN 'RECEIPT' THEN NEW.quantity ELSE -NEW.quantity END;
 IF h.movement_type='RECEIPT' THEN
  IF prior.quantity+NEW.quantity>l.quantity OR (gi.serial<>'' AND NEW.quantity<>1) THEN RAISE EXCEPTION 'Retoureneingang überschreitet offene tatsächliche Anmeldemenge';END IF;
  SELECT coalesce(sum(a.quantity),0),coalesce(sum(a.value),0) INTO q,v FROM customer_return_lines x CROSS JOIN LATERAL customer_return_received(x.tenant_id,x.id) a WHERE x.tenant_id=gi.tenant_id AND x.issue_item_id=gi.id;
  q=q-NEW.quantity;v=v-NEW.value;
  credit=customer_return_credited(gi.tenant_id,gi.id,h.posting_date);
  IF q+NEW.quantity>credit THEN RAISE EXCEPTION 'Retoureneingang benötigt zuvor gebuchte Gutschrift der tatsächlichen Menge';END IF;
  IF NEW.value<>round(gi.value*(q+NEW.quantity)/gi.quantity,2)-v THEN RAISE EXCEPTION 'Retourenbewertung muss ursprünglichen Warenwert centgenau anteilig fortschreiben';END IF;sgn=1;
 ELSE
  SELECT * INTO STRICT old FROM customer_return_receipt_items WHERE tenant_id=h.tenant_id AND receipt_id=h.reverses_id AND return_line_id=l.id;
  IF NEW.quantity<>old.quantity OR NEW.value<>old.value OR prior.quantity<NEW.quantity THEN RAISE EXCEPTION 'Retourenstorno muss genau den Originaleingang gegenbuchen';END IF;sgn=-1;
 END IF;
 SELECT account_id INTO account FROM journal_entries WHERE tenant_id=g.tenant_id AND journal_id=direct_issue_journal(g.tenant_id,g.id) AND side='CREDIT';
 IF gi.value>0 AND NOT EXISTS(SELECT 1 FROM inventory_valuations WHERE tenant_id=gi.tenant_id AND company_id=h.company_id AND product_id=gi.product_id AND inventory_account_id=account) THEN RAISE EXCEPTION 'Historisches Bestandskonto hat sich geändert';END IF;
 UPDATE stock_balances SET quantity=quantity+sgn*NEW.quantity WHERE tenant_id=gi.tenant_id AND company_id=h.company_id AND product_id=gi.product_id AND location_id=gi.location_id AND batch=gi.batch AND serial=gi.serial;
 IF NOT FOUND THEN RAISE EXCEPTION 'Ursprünglicher Lagerbestand fehlt';END IF;
 UPDATE inventory_valuations SET quantity=quantity+sgn*NEW.quantity,value=value+sgn*NEW.value WHERE tenant_id=gi.tenant_id AND company_id=h.company_id AND product_id=gi.product_id;
 IF EXISTS(SELECT 1 FROM inventory_valuations WHERE tenant_id=gi.tenant_id AND company_id=h.company_id AND product_id=gi.product_id AND (value<0 OR (quantity=0 AND value<>0))) THEN RAISE EXCEPTION 'Retourenstorno würde ursprüngliche Bewertung unterschreiten';END IF;
 INSERT INTO warehouse_bin_entries(id,tenant_id,company_id,bin_id,product_id,batch,serial,quantity,return_item_id) VALUES(gen_random_uuid(),gi.tenant_id,h.company_id,NEW.bin_id,gi.product_id,gi.batch,gi.serial,sgn*NEW.quantity,NEW.id);RETURN NEW;
END$$;

CREATE OR REPLACE FUNCTION customer_return_bin_guard() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
 IF NEW.return_item_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM customer_return_receipt_items i JOIN customer_return_receipts h ON h.tenant_id=i.tenant_id AND h.id=i.receipt_id JOIN customer_return_lines l ON l.tenant_id=i.tenant_id AND l.id=i.return_line_id JOIN goods_issue_items gi ON gi.tenant_id=l.tenant_id AND gi.id=l.issue_item_id WHERE i.tenant_id=NEW.tenant_id AND i.id=NEW.return_item_id AND h.company_id=NEW.company_id AND coalesce(i.bin_id,gi.bin_id)=NEW.bin_id AND gi.product_id=NEW.product_id AND gi.batch=NEW.batch AND gi.serial=NEW.serial AND NEW.quantity=CASE h.movement_type WHEN 'RECEIPT' THEN i.quantity ELSE -i.quantity END) THEN RAISE EXCEPTION 'Retourenplatzbewegung passt nicht zur Originalauslieferung';END IF;RETURN NEW;
END$$;

CREATE FUNCTION return_unvalued_journal_guard() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
 IF EXISTS(SELECT 1 FROM documents WHERE tenant_id=NEW.tenant_id AND id=NEW.source_id AND kind IN('RETURN_CUSTODY','RETURN_INSPECTION')) THEN RAISE EXCEPTION 'Kunden-Prüfbestand und Prüfentscheidung sind unbewertet und haben keine Finanzbuchung';END IF;RETURN NEW;
END$$;
CREATE TRIGGER return_unvalued_journal_guard BEFORE INSERT OR UPDATE ON journals FOR EACH ROW EXECUTE FUNCTION return_unvalued_journal_guard();
