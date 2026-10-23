-- Real typed AU origins in the existing purchasing ledger; no synthetic SA.
DO $$DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['order_requirements','purchase_requisitions','purchase_orders'] LOOP
  EXECUTE format('ALTER TABLE %I ALTER COLUMN order_id DROP NOT NULL',t);
  EXECUTE format('ALTER TABLE %I ADD COLUMN sales_order_id uuid',t);
  EXECUTE format('ALTER TABLE %I ADD FOREIGN KEY(tenant_id,sales_order_id) REFERENCES sales_orders(tenant_id,id)',t);
  EXECUTE format('ALTER TABLE %I ADD CHECK((order_id IS NULL)<>(sales_order_id IS NULL))',t);
 END LOOP;
END$$;
ALTER TABLE order_requirement_items ALTER COLUMN order_item_id DROP NOT NULL;
ALTER TABLE order_requirement_items ADD COLUMN sales_item_id uuid;
ALTER TABLE order_requirement_items ADD COLUMN sales_schedule_id uuid;
ALTER TABLE order_requirement_items ADD FOREIGN KEY(tenant_id,sales_item_id) REFERENCES sales_order_items(tenant_id,id);
ALTER TABLE order_requirement_items ADD FOREIGN KEY(tenant_id,sales_schedule_id) REFERENCES sales_order_schedules(tenant_id,id);
ALTER TABLE order_requirement_items ADD CHECK((order_item_id IS NOT NULL AND sales_item_id IS NULL AND sales_schedule_id IS NULL) OR (order_item_id IS NULL AND sales_item_id IS NOT NULL AND sales_schedule_id IS NOT NULL));
CREATE UNIQUE INDEX direct_requirement_schedule ON order_requirement_items(tenant_id,sales_schedule_id) WHERE sales_schedule_id IS NOT NULL;
CREATE INDEX direct_requirement_order ON order_requirements(tenant_id,sales_order_id);
CREATE INDEX direct_requisition_order ON purchase_requisitions(tenant_id,sales_order_id);
CREATE INDEX direct_purchase_order ON purchase_orders(tenant_id,sales_order_id);
CREATE VIEW procurement_item_sources WITH(security_invoker=true) AS
 SELECT tenant_id,id,order_id AS source_id,'SERVICE_ORDER'::text AS source_kind,product_id,position,description,quantity,unit,cost_center,cost_object,required_on,price_snapshot FROM service_order_items
 UNION ALL
 SELECT i.tenant_id,i.id,i.order_id,'SALES_ORDER'::text,i.product_id,i.position,i.description,i.quantity,i.unit,i.cost_center,i.cost_object,min(s.requested_on),i.price_snapshot FROM sales_order_items i LEFT JOIN sales_order_schedules s ON s.tenant_id=i.tenant_id AND s.item_id=i.id GROUP BY i.tenant_id,i.id;
CREATE FUNCTION direct_requested(t uuid,schedule uuid,excluded uuid DEFAULT NULL) RETURNS numeric LANGUAGE sql STABLE AS $$
 SELECT coalesce(sum(qi.quantity),0) FROM purchase_requisition_items qi JOIN purchase_requisitions q ON q.tenant_id=qi.tenant_id AND q.id=qi.requisition_id JOIN order_requirement_items ri ON ri.tenant_id=qi.tenant_id AND ri.id=qi.requirement_item_id WHERE qi.tenant_id=t AND ri.sales_schedule_id=schedule AND q.status NOT IN ('CANCELLED','REJECTED') AND (excluded IS NULL OR q.id<>excluded)
$$;
CREATE FUNCTION direct_procurement_check() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE target uuid;h sales_orders;r record;l record;s record;reserved numeric;requested numeric;BEGIN
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
   IF reserved+requested>s.quantity THEN RAISE EXCEPTION 'BANF und gebundener Bestand überschreiten tatsächliche AU-Einteilung';END IF;
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
DO $$DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['order_requirements','order_requirement_items','purchase_requisitions','purchase_requisition_items','purchase_orders','purchase_order_items'] LOOP
  EXECUTE format('CREATE CONSTRAINT TRIGGER direct_procurement_complete AFTER INSERT OR UPDATE ON %I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION direct_procurement_check()',t);
 END LOOP;
END$$;
CREATE FUNCTION direct_reservation_procurement_cap() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE planned numeric;reserved numeric;BEGIN
 IF NEW.sales_schedule_id IS NULL OR TG_OP<>'INSERT' THEN RETURN NEW;END IF;
 PERFORM 1 FROM sales_orders WHERE tenant_id=NEW.tenant_id AND id=NEW.sales_order_id FOR UPDATE;
 SELECT quantity INTO STRICT planned FROM sales_order_schedules WHERE tenant_id=NEW.tenant_id AND id=NEW.sales_schedule_id;
 SELECT coalesce(sum(CASE WHEN status='CANCELLED' THEN consumed_quantity ELSE quantity END),0) INTO reserved FROM stock_reservations WHERE tenant_id=NEW.tenant_id AND sales_schedule_id=NEW.sales_schedule_id;
 IF reserved+NEW.quantity+direct_requested(NEW.tenant_id,NEW.sales_schedule_id)>planned THEN RAISE EXCEPTION 'AU-Einteilung ist bereits durch Bestand oder Beschaffung gedeckt';END IF;RETURN NEW;
END$$;
CREATE TRIGGER direct_reservation_purchase_cap BEFORE INSERT ON stock_reservations FOR EACH ROW EXECUTE FUNCTION direct_reservation_procurement_cap();

-- Test free stock only for a new request. Later receipts must not invalidate
-- an already approved purchasing document when another header is updated.
CREATE FUNCTION direct_requisition_stock_first() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE h record;product uuid;BEGIN
 SELECT q.sales_order_id,q.company_id INTO h FROM purchase_requisitions q WHERE q.tenant_id=NEW.tenant_id AND q.id=NEW.requisition_id;
 IF h.sales_order_id IS NULL THEN RETURN NEW;END IF;
 PERFORM 1 FROM company_codes WHERE tenant_id=NEW.tenant_id AND id=h.company_id FOR UPDATE;
 PERFORM 1 FROM sales_orders WHERE tenant_id=NEW.tenant_id AND id=h.sales_order_id FOR UPDATE;
 SELECT i.product_id INTO product FROM order_requirement_items ri JOIN sales_order_items i ON i.tenant_id=ri.tenant_id AND i.id=ri.sales_item_id WHERE ri.tenant_id=NEW.tenant_id AND ri.id=NEW.requirement_item_id;
 IF EXISTS(SELECT 1 FROM stock_balances b WHERE b.tenant_id=NEW.tenant_id AND b.company_id=h.company_id AND b.product_id=product AND b.quantity>coalesce((SELECT sum(r.quantity-r.consumed_quantity) FROM stock_reservations r WHERE r.tenant_id=b.tenant_id AND r.company_id=b.company_id AND r.product_id=b.product_id AND r.location_id=b.location_id AND r.batch=b.batch AND r.serial=b.serial AND r.status='ACTIVE'),0)) THEN RAISE EXCEPTION 'Vorhandenen freien Lagerbestand zuerst in der AU-Materialplanung reservieren';END IF;
 RETURN NEW;
END$$;
CREATE TRIGGER direct_requisition_stock_first BEFORE INSERT ON purchase_requisition_items FOR EACH ROW EXECUTE FUNCTION direct_requisition_stock_first();
