CREATE TABLE material_inventory_settings (
 tenant_id uuid NOT NULL,product_id uuid NOT NULL,serial_required boolean NOT NULL,batch_required boolean NOT NULL,valuation_method text NOT NULL CHECK(valuation_method='MOVING_AVERAGE'),version integer NOT NULL DEFAULT 1,
 PRIMARY KEY(tenant_id,product_id),FOREIGN KEY(tenant_id,product_id) REFERENCES products(tenant_id,id)
);
CREATE TABLE plants (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,company_id uuid NOT NULL,code text NOT NULL,name text NOT NULL,
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,company_id,code),FOREIGN KEY(tenant_id,company_id) REFERENCES company_codes(tenant_id,id)
);
CREATE TABLE storage_locations (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,plant_id uuid NOT NULL,code text NOT NULL,name text NOT NULL,kind text NOT NULL CHECK(kind IN ('CENTRAL','WORKSHOP','MOBILE')),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,plant_id,code),FOREIGN KEY(tenant_id,plant_id) REFERENCES plants(tenant_id,id)
);
CREATE TABLE goods_receipts (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,order_id uuid NOT NULL,purchase_order_id uuid NOT NULL,company_id uuid NOT NULL,period_id uuid NOT NULL,currency text NOT NULL,
 movement_type text NOT NULL CHECK(movement_type IN ('RECEIPT','RECEIPT_REVERSAL')),posting_date date NOT NULL,document_date date NOT NULL,delivery_note text NOT NULL,reason text,reverses_id uuid,sealed boolean NOT NULL DEFAULT false,
 CHECK((movement_type='RECEIPT')=(reverses_id IS NULL)),CHECK(movement_type='RECEIPT' OR length(reason)>=5),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,reverses_id),FOREIGN KEY(tenant_id,id) REFERENCES documents(tenant_id,id),FOREIGN KEY(tenant_id,order_id) REFERENCES service_orders(tenant_id,id),FOREIGN KEY(tenant_id,purchase_order_id) REFERENCES purchase_orders(tenant_id,id),FOREIGN KEY(tenant_id,company_id) REFERENCES company_codes(tenant_id,id),FOREIGN KEY(tenant_id,period_id) REFERENCES fiscal_periods(tenant_id,id),FOREIGN KEY(tenant_id,currency) REFERENCES currencies(tenant_id,code),FOREIGN KEY(tenant_id,reverses_id) REFERENCES goods_receipts(tenant_id,id)
);
CREATE TABLE goods_receipt_items (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,receipt_id uuid NOT NULL,purchase_order_item_id uuid NOT NULL,position integer NOT NULL,product_id uuid NOT NULL,location_id uuid NOT NULL,
 quantity numeric(18,6) NOT NULL CHECK(quantity>0),unit_price numeric(18,6) NOT NULL CHECK(unit_price>=0),value numeric(20,4) NOT NULL CHECK(value>=0),batch text NOT NULL DEFAULT '',serial text NOT NULL DEFAULT '',
 CHECK(serial='' OR quantity=1),UNIQUE(tenant_id,id),UNIQUE(tenant_id,receipt_id,position),
 FOREIGN KEY(tenant_id,receipt_id) REFERENCES goods_receipts(tenant_id,id),FOREIGN KEY(tenant_id,purchase_order_item_id) REFERENCES purchase_order_items(tenant_id,id),FOREIGN KEY(tenant_id,product_id) REFERENCES products(tenant_id,id),FOREIGN KEY(tenant_id,location_id) REFERENCES storage_locations(tenant_id,id)
);
CREATE TABLE stock_balances (
 tenant_id uuid NOT NULL,company_id uuid NOT NULL,product_id uuid NOT NULL,location_id uuid NOT NULL,batch text NOT NULL,serial text NOT NULL,quantity numeric(24,6) NOT NULL CHECK(quantity>=0),
 CHECK(serial='' OR quantity IN (0,1)),PRIMARY KEY(tenant_id,company_id,product_id,location_id,batch,serial),FOREIGN KEY(tenant_id,company_id) REFERENCES company_codes(tenant_id,id),FOREIGN KEY(tenant_id,product_id) REFERENCES products(tenant_id,id),FOREIGN KEY(tenant_id,location_id) REFERENCES storage_locations(tenant_id,id)
);
CREATE UNIQUE INDEX unique_stock_serial ON stock_balances(tenant_id,product_id,serial) WHERE serial<>'' AND quantity>0;
CREATE TABLE inventory_valuations (
 tenant_id uuid NOT NULL,company_id uuid NOT NULL,product_id uuid NOT NULL,quantity numeric(24,6) NOT NULL CHECK(quantity>=0),value numeric(24,4) NOT NULL CHECK(value>=0),
 CHECK(quantity<>0 OR value=0),PRIMARY KEY(tenant_id,company_id,product_id),FOREIGN KEY(tenant_id,company_id) REFERENCES company_codes(tenant_id,id),FOREIGN KEY(tenant_id,product_id) REFERENCES products(tenant_id,id)
);
CREATE FUNCTION apply_goods_receipt_item() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$DECLARE header goods_receipts;direction integer;BEGIN
 SELECT * INTO STRICT header FROM goods_receipts WHERE tenant_id=NEW.tenant_id AND id=NEW.receipt_id;
 direction:=CASE WHEN header.movement_type='RECEIPT' THEN 1 ELSE -1 END;
 IF header.sealed THEN RAISE EXCEPTION 'Materialbeleg ist abgeschlossen';END IF;
 INSERT INTO stock_balances(tenant_id,company_id,product_id,location_id,batch,serial,quantity) VALUES(NEW.tenant_id,header.company_id,NEW.product_id,NEW.location_id,NEW.batch,NEW.serial,0) ON CONFLICT DO NOTHING;
 UPDATE stock_balances SET quantity=quantity+direction*NEW.quantity WHERE tenant_id=NEW.tenant_id AND company_id=header.company_id AND product_id=NEW.product_id AND location_id=NEW.location_id AND batch=NEW.batch AND serial=NEW.serial;
 INSERT INTO inventory_valuations(tenant_id,company_id,product_id,quantity,value) VALUES(NEW.tenant_id,header.company_id,NEW.product_id,0,0) ON CONFLICT DO NOTHING;
 UPDATE inventory_valuations SET quantity=quantity+direction*NEW.quantity,value=value+direction*NEW.value WHERE tenant_id=NEW.tenant_id AND company_id=header.company_id AND product_id=NEW.product_id;
 RETURN NEW;
END$$;
CREATE TRIGGER apply_receipt_item AFTER INSERT ON goods_receipt_items FOR EACH ROW EXECUTE FUNCTION apply_goods_receipt_item();
CREATE FUNCTION protect_inventory_document() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
 IF TG_TABLE_NAME='goods_receipts' AND TG_OP='UPDATE' THEN IF NOT OLD.sealed AND NEW.sealed AND (to_jsonb(OLD)-'sealed')=(to_jsonb(NEW)-'sealed') THEN RETURN NEW;END IF;END IF;
 RAISE EXCEPTION 'Gebuchte Materialbelege bleiben unveränderlich; Gegenbewegung verwenden';END$$;
CREATE TRIGGER immutable_receipt BEFORE UPDATE OR DELETE ON goods_receipts FOR EACH ROW EXECUTE FUNCTION protect_inventory_document();
CREATE TRIGGER immutable_receipt_item BEFORE UPDATE OR DELETE ON goods_receipt_items FOR EACH ROW EXECUTE FUNCTION protect_inventory_document();
DO $$DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['material_inventory_settings','plants','storage_locations','goods_receipts','goods_receipt_items','stock_balances','inventory_valuations'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid) WITH CHECK (tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid)',t);
 END LOOP;
END$$;

CREATE FUNCTION validate_goods_receipt() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE h goods_receipts;total numeric;BEGIN
 SELECT * INTO STRICT h FROM goods_receipts WHERE tenant_id=NEW.tenant_id AND id=NEW.id;
 IF NOT h.sealed THEN RAISE EXCEPTION 'Materialbeleg ist unvollständig';END IF;
 SELECT sum(value) INTO total FROM goods_receipt_items WHERE tenant_id=h.tenant_id AND receipt_id=h.id;
 IF total IS NULL THEN RAISE EXCEPTION 'Materialbeleg benötigt Positionen';END IF;
 IF NOT EXISTS(SELECT 1 FROM fiscal_periods p JOIN company_codes c ON c.tenant_id=p.tenant_id AND c.id=p.company_id WHERE p.tenant_id=h.tenant_id AND p.id=h.period_id AND c.id=h.company_id AND c.currency=h.currency AND p.status='OPEN' AND h.posting_date BETWEEN p.date_from AND p.date_to) THEN RAISE EXCEPTION 'Offene passende Buchungsperiode fehlt';END IF;
 IF total>0 AND NOT EXISTS(SELECT 1 FROM journals j WHERE j.tenant_id=h.tenant_id AND j.source_id=h.id AND j.company_id=h.company_id AND j.currency=h.currency AND j.posting_date=h.posting_date AND j.status='POSTED' AND (SELECT sum(e.amount) FROM journal_entries e WHERE e.tenant_id=j.tenant_id AND e.journal_id=j.id AND e.side='DEBIT')=total) THEN RAISE EXCEPTION 'Passender gebuchter Finanzbeleg fehlt';END IF;
 RETURN NULL;
END$$;
CREATE CONSTRAINT TRIGGER receipt_complete AFTER INSERT OR UPDATE ON goods_receipts DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_goods_receipt();
CREATE FUNCTION protect_material_inventory_settings() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
 IF EXISTS(SELECT 1 FROM goods_receipt_items WHERE tenant_id=OLD.tenant_id AND product_id=OLD.product_id) THEN RAISE EXCEPTION 'Bewertung und Tracking sind nach erster Bewegung unveränderlich';END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;
END$$;
CREATE TRIGGER inventory_settings_used BEFORE UPDATE OR DELETE ON material_inventory_settings FOR EACH ROW EXECUTE FUNCTION protect_material_inventory_settings();
