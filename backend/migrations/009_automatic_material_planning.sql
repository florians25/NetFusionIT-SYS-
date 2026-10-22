ALTER TABLE service_orders ADD COLUMN material_status text NOT NULL DEFAULT 'NOT_REQUIRED';
ALTER TABLE service_order_items ADD COLUMN supply_status text NOT NULL DEFAULT 'NOT_REQUIRED';
ALTER TABLE service_order_items ADD COLUMN required_on date;
ALTER TABLE order_requirements ADD COLUMN system_generated boolean NOT NULL DEFAULT false;
ALTER TABLE order_requirement_items ALTER COLUMN needed_on DROP NOT NULL;
CREATE TABLE stock_reservations (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,order_id uuid NOT NULL,requirement_item_id uuid NOT NULL,company_id uuid NOT NULL,product_id uuid NOT NULL,location_id uuid NOT NULL,batch text NOT NULL,serial text NOT NULL,
 quantity numeric(18,6) NOT NULL CHECK(quantity>0),source text NOT NULL CHECK(source IN ('STOCK','PROCUREMENT')),source_receipt_id uuid,status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','CANCELLED')),reason text,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),version integer NOT NULL DEFAULT 1,
 CHECK(serial='' OR quantity=1),CHECK(source='PROCUREMENT' OR source_receipt_id IS NULL),
 UNIQUE(tenant_id,id),FOREIGN KEY(tenant_id,order_id) REFERENCES service_orders(tenant_id,id),FOREIGN KEY(tenant_id,requirement_item_id) REFERENCES order_requirement_items(tenant_id,id),FOREIGN KEY(tenant_id,company_id,product_id,location_id,batch,serial) REFERENCES stock_balances(tenant_id,company_id,product_id,location_id,batch,serial),FOREIGN KEY(tenant_id,source_receipt_id) REFERENCES goods_receipts(tenant_id,id),FOREIGN KEY(tenant_id,created_by) REFERENCES users(tenant_id,id)
);
CREATE INDEX active_stock_reservations ON stock_reservations(tenant_id,company_id,product_id,location_id,batch,serial) WHERE status='ACTIVE';
CREATE FUNCTION validate_stock_reservation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$DECLARE available numeric;claimed numeric;BEGIN
 IF NEW.tenant_id IS DISTINCT FROM nullif(current_setting('app.tenant_id',true),'')::uuid THEN RAISE EXCEPTION 'Mandantenkontext der Reservierung fehlt';END IF;
 IF TG_OP='UPDATE' AND (to_jsonb(OLD)-'status'-'reason'-'version') IS DISTINCT FROM (to_jsonb(NEW)-'status'-'reason'-'version') THEN RAISE EXCEPTION 'Reservierungsinhalt ist unveränderlich';END IF;
 IF TG_OP='UPDATE' AND (OLD.status<>'ACTIVE' OR NEW.status<>'CANCELLED' OR length(NEW.reason)<5) THEN RAISE EXCEPTION 'Reservierung nur begründet freigeben';END IF;
 IF NEW.status='ACTIVE' THEN
  SELECT quantity INTO STRICT available FROM stock_balances WHERE tenant_id=NEW.tenant_id AND company_id=NEW.company_id AND product_id=NEW.product_id AND location_id=NEW.location_id AND batch=NEW.batch AND serial=NEW.serial FOR UPDATE;
  SELECT coalesce(sum(quantity),0) INTO claimed FROM stock_reservations WHERE tenant_id=NEW.tenant_id AND company_id=NEW.company_id AND product_id=NEW.product_id AND location_id=NEW.location_id AND batch=NEW.batch AND serial=NEW.serial AND status='ACTIVE' AND id<>NEW.id;
  IF claimed+NEW.quantity>available THEN RAISE EXCEPTION 'Reservierung überschreitet freien Bestand';END IF;
 END IF;RETURN NEW;
END$$;
CREATE TRIGGER reservation_available BEFORE INSERT OR UPDATE ON stock_reservations FOR EACH ROW EXECUTE FUNCTION validate_stock_reservation();
ALTER TABLE stock_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_reservations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON stock_reservations USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
-- Scheduling an automatically detected need is allowed before its first BANF.
CREATE OR REPLACE FUNCTION protect_procurement_item() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE parent_status text;BEGIN
 IF TG_OP='UPDATE' AND TG_TABLE_NAME='order_requirement_items' THEN
  IF NEW.needed_on IS NOT NULL AND (to_jsonb(OLD)-'needed_on')=(to_jsonb(NEW)-'needed_on') AND NOT EXISTS(SELECT 1 FROM purchase_requisition_items WHERE tenant_id=OLD.tenant_id AND requirement_item_id=OLD.id) THEN RETURN NEW;END IF;
 END IF;
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Beschaffungspositionen sind unveränderlich; Beleg ersetzen';END IF;
 IF TG_TABLE_NAME='order_requirement_items' THEN SELECT status INTO parent_status FROM order_requirements WHERE tenant_id=NEW.tenant_id AND id=NEW.requirement_id;
 ELSIF TG_TABLE_NAME='purchase_requisition_items' THEN SELECT status INTO parent_status FROM purchase_requisitions WHERE tenant_id=NEW.tenant_id AND id=NEW.requisition_id;
 ELSE SELECT status INTO parent_status FROM purchase_orders WHERE tenant_id=NEW.tenant_id AND id=NEW.purchase_order_id;END IF;
 IF parent_status IS NULL OR parent_status NOT IN ('OPEN','DRAFT') THEN RAISE EXCEPTION 'Keine neue Position an freigegebenem Beschaffungsbeleg';END IF;
 RETURN NEW;
END$$;

CREATE FUNCTION protect_reserved_balance() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE reserved numeric;BEGIN
 SELECT coalesce(sum(quantity),0) INTO reserved FROM stock_reservations WHERE tenant_id=NEW.tenant_id AND company_id=NEW.company_id AND product_id=NEW.product_id AND location_id=NEW.location_id AND batch=NEW.batch AND serial=NEW.serial AND status='ACTIVE';
 IF NEW.quantity<reserved THEN RAISE EXCEPTION 'Bestandsbewegung würde aktive Reservierungen unterschreiten';END IF;RETURN NEW;
END$$;
CREATE TRIGGER reserved_stock_available BEFORE UPDATE ON stock_balances FOR EACH ROW EXECUTE FUNCTION protect_reserved_balance();
