ALTER TABLE business_partners ADD CONSTRAINT business_partner_roles CHECK(cardinality(roles)>0 AND roles<@ARRAY['CUSTOMER','SUPPLIER','BILL_TO','SOLD_TO','SHIP_TO','CONTACT']::text[]);
CREATE TABLE supplier_data (
 tenant_id uuid NOT NULL,id uuid NOT NULL,payment_terms_days integer NOT NULL CHECK(payment_terms_days BETWEEN 0 AND 365),PRIMARY KEY(tenant_id,id),FOREIGN KEY(tenant_id,id) REFERENCES business_partners(tenant_id,id)
);
CREATE TABLE order_requirements (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,order_id uuid NOT NULL,title text NOT NULL,urgency text NOT NULL CHECK(urgency IN ('NORMAL','URGENT')),status text NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','CANCELLED')),version integer NOT NULL DEFAULT 1,
 UNIQUE(tenant_id,id),FOREIGN KEY(tenant_id,id) REFERENCES documents(tenant_id,id),FOREIGN KEY(tenant_id,order_id) REFERENCES service_orders(tenant_id,id)
);
CREATE TABLE order_requirement_items (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,requirement_id uuid NOT NULL,order_item_id uuid NOT NULL,position integer NOT NULL,quantity numeric(18,6) NOT NULL CHECK(quantity>0),needed_on date NOT NULL,purpose text NOT NULL,
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,requirement_id,position),FOREIGN KEY(tenant_id,requirement_id) REFERENCES order_requirements(tenant_id,id),FOREIGN KEY(tenant_id,order_item_id) REFERENCES service_order_items(tenant_id,id)
);
CREATE TABLE purchase_requisitions (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,order_id uuid NOT NULL,company_id uuid NOT NULL,title text NOT NULL,currency text NOT NULL,status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','IN_REVIEW','RELEASED','REJECTED','PARTIALLY_ORDERED','FULLY_ORDERED','CANCELLED')),version integer NOT NULL DEFAULT 1,
 UNIQUE(tenant_id,id),FOREIGN KEY(tenant_id,id) REFERENCES documents(tenant_id,id),FOREIGN KEY(tenant_id,order_id) REFERENCES service_orders(tenant_id,id),FOREIGN KEY(tenant_id,company_id) REFERENCES company_codes(tenant_id,id),FOREIGN KEY(tenant_id,currency) REFERENCES currencies(tenant_id,code)
);
CREATE TABLE purchase_requisition_items (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,requisition_id uuid NOT NULL,requirement_item_id uuid NOT NULL,position integer NOT NULL,quantity numeric(18,6) NOT NULL CHECK(quantity>0),estimated_unit_price numeric(18,6) CHECK(estimated_unit_price>=0),cost_center text NOT NULL,cost_object text NOT NULL,
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,requisition_id,position),FOREIGN KEY(tenant_id,requisition_id) REFERENCES purchase_requisitions(tenant_id,id),FOREIGN KEY(tenant_id,requirement_item_id) REFERENCES order_requirement_items(tenant_id,id)
);
CREATE TABLE purchase_orders (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,order_id uuid NOT NULL,requisition_id uuid NOT NULL,company_id uuid NOT NULL,supplier_id uuid NOT NULL,title text NOT NULL,currency text NOT NULL,supplier_snapshot jsonb NOT NULL,
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','IN_REVIEW','RELEASED','REJECTED','PARTIALLY_RECEIVED','FULLY_RECEIVED','CLOSED','CANCELLED')),version integer NOT NULL DEFAULT 1,
 UNIQUE(tenant_id,id),FOREIGN KEY(tenant_id,id) REFERENCES documents(tenant_id,id),FOREIGN KEY(tenant_id,order_id) REFERENCES service_orders(tenant_id,id),FOREIGN KEY(tenant_id,requisition_id) REFERENCES purchase_requisitions(tenant_id,id),FOREIGN KEY(tenant_id,company_id) REFERENCES company_codes(tenant_id,id),FOREIGN KEY(tenant_id,supplier_id) REFERENCES business_partners(tenant_id,id),FOREIGN KEY(tenant_id,currency) REFERENCES currencies(tenant_id,code)
);
CREATE TABLE purchase_order_items (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,purchase_order_id uuid NOT NULL,requisition_item_id uuid NOT NULL,position integer NOT NULL,quantity numeric(18,6) NOT NULL CHECK(quantity>0),unit_price numeric(18,6) NOT NULL CHECK(unit_price>=0),delivery_date date NOT NULL,overdelivery_percent numeric(5,2) NOT NULL DEFAULT 0 CHECK(overdelivery_percent BETWEEN 0 AND 100),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,purchase_order_id,position),FOREIGN KEY(tenant_id,purchase_order_id) REFERENCES purchase_orders(tenant_id,id),FOREIGN KEY(tenant_id,requisition_item_id) REFERENCES purchase_requisition_items(tenant_id,id)
);
-- Corrections use an explicit cancellation/replacement. Approval must never
-- silently change the payload that later documents reference.
CREATE FUNCTION protect_procurement_header() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Beschaffungsbelege bleiben unveränderlich erhalten';END IF;
 IF (to_jsonb(OLD)-'status'-'version') IS DISTINCT FROM (to_jsonb(NEW)-'status'-'version') THEN RAISE EXCEPTION 'Beschaffungsinhalt ist unveränderlich; Beleg ersetzen';END IF;
 RETURN NEW;
END$$;
CREATE FUNCTION protect_procurement_item() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE parent_status text;BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Beschaffungspositionen sind unveränderlich; Beleg ersetzen';END IF;
 IF TG_TABLE_NAME='order_requirement_items' THEN SELECT status INTO parent_status FROM order_requirements WHERE tenant_id=NEW.tenant_id AND id=NEW.requirement_id;
 ELSIF TG_TABLE_NAME='purchase_requisition_items' THEN SELECT status INTO parent_status FROM purchase_requisitions WHERE tenant_id=NEW.tenant_id AND id=NEW.requisition_id;
 ELSE SELECT status INTO parent_status FROM purchase_orders WHERE tenant_id=NEW.tenant_id AND id=NEW.purchase_order_id;END IF;
 IF parent_status IS NULL OR parent_status NOT IN ('OPEN','DRAFT') THEN RAISE EXCEPTION 'Keine neue Position an freigegebenem Beschaffungsbeleg';END IF;
 RETURN NEW;
END$$;
CREATE TRIGGER protect_requirement_header BEFORE UPDATE OR DELETE ON order_requirements FOR EACH ROW EXECUTE FUNCTION protect_procurement_header();
CREATE TRIGGER protect_requisition_header BEFORE UPDATE OR DELETE ON purchase_requisitions FOR EACH ROW EXECUTE FUNCTION protect_procurement_header();
CREATE TRIGGER protect_purchase_order_header BEFORE UPDATE OR DELETE ON purchase_orders FOR EACH ROW EXECUTE FUNCTION protect_procurement_header();
CREATE TRIGGER protect_requirement_item BEFORE INSERT OR UPDATE OR DELETE ON order_requirement_items FOR EACH ROW EXECUTE FUNCTION protect_procurement_item();
CREATE TRIGGER protect_requisition_item BEFORE INSERT OR UPDATE OR DELETE ON purchase_requisition_items FOR EACH ROW EXECUTE FUNCTION protect_procurement_item();
CREATE TRIGGER protect_purchase_order_item BEFORE INSERT OR UPDATE OR DELETE ON purchase_order_items FOR EACH ROW EXECUTE FUNCTION protect_procurement_item();
DO $$DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['supplier_data','order_requirements','order_requirement_items','purchase_requisitions','purchase_requisition_items','purchase_orders','purchase_order_items'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid) WITH CHECK (tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid)',t);
 END LOOP;
END$$;
