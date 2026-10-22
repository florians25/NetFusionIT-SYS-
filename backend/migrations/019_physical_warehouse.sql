-- Physical quantities are a subdivision of existing location stock, never an
-- additional stock activation or valuation. Existing stock starts unassigned.
ALTER TABLE documents DROP CONSTRAINT documents_kind_check;
ALTER TABLE documents ADD CONSTRAINT documents_kind_check CHECK(kind IN ('WORK_ORDER_TASK','TICKET','SERVICE_CASE','BUSINESS_PARTNER','APPROVAL','TECHNICAL_OBJECT','SERVICE_CONTRACT','FIELD_VISIT','SERVICE_ORDER','MATERIAL','MATERIAL_REQUIREMENT','REQUISITION','PURCHASE_ORDER','GOODS_RECEIPT','GOODS_ISSUE','SERVICE_REPORT','INVOICE','CANCELLATION','ACCOUNTING','PAYMENT','QUOTATION','SALES_ORDER','CREDIT_NOTE','BILLING_REQUEST','PARTNER_ACCOUNT','COMPANY_BILLING_PROFILE','SUPPLIER_INVOICE','SUPPLIER_INVOICE_REVERSAL','STOCK_TRANSFER'));
CREATE TABLE warehouse_areas(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,location_id uuid NOT NULL,code text NOT NULL,name text NOT NULL,blocked boolean NOT NULL DEFAULT false,version integer NOT NULL DEFAULT 1,
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,location_id,code),FOREIGN KEY(tenant_id,location_id) REFERENCES storage_locations(tenant_id,id)
);
CREATE TABLE warehouse_racks(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,area_id uuid NOT NULL,aisle text NOT NULL,code text NOT NULL,name text NOT NULL,blocked boolean NOT NULL DEFAULT false,version integer NOT NULL DEFAULT 1,
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,area_id,aisle,code),FOREIGN KEY(tenant_id,area_id) REFERENCES warehouse_areas(tenant_id,id)
);
CREATE TABLE warehouse_bins(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,company_id uuid NOT NULL,location_id uuid NOT NULL,rack_id uuid,code text NOT NULL,name text NOT NULL,
 level_code text NOT NULL DEFAULT '',compartment text NOT NULL DEFAULT '',system_buffer boolean NOT NULL DEFAULT false,
 capacity numeric(24,6) CHECK(capacity>0),capacity_unit text NOT NULL DEFAULT '',allow_mixed_products boolean NOT NULL DEFAULT false,allow_mixed_batches boolean NOT NULL DEFAULT false,blocked boolean NOT NULL DEFAULT false,version integer NOT NULL DEFAULT 1,
 CHECK(capacity IS NULL OR capacity_unit<>''),CHECK(NOT system_buffer OR (rack_id IS NULL AND capacity IS NULL AND NOT blocked)),CHECK(system_buffer OR rack_id IS NOT NULL),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,location_id,code),UNIQUE(tenant_id,rack_id,level_code,compartment),
 FOREIGN KEY(tenant_id,company_id) REFERENCES company_codes(tenant_id,id),FOREIGN KEY(tenant_id,location_id) REFERENCES storage_locations(tenant_id,id),FOREIGN KEY(tenant_id,rack_id) REFERENCES warehouse_racks(tenant_id,id)
);
CREATE UNIQUE INDEX one_warehouse_buffer ON warehouse_bins(tenant_id,location_id) WHERE system_buffer;
CREATE TABLE warehouse_bin_balances(
 tenant_id uuid NOT NULL,company_id uuid NOT NULL,bin_id uuid NOT NULL,product_id uuid NOT NULL,batch text NOT NULL,serial text NOT NULL,quantity numeric(24,6) NOT NULL CHECK(quantity>=0),
 CHECK(serial='' OR quantity IN(0,1)),PRIMARY KEY(tenant_id,bin_id,product_id,batch,serial),
 FOREIGN KEY(tenant_id,bin_id) REFERENCES warehouse_bins(tenant_id,id),FOREIGN KEY(tenant_id,company_id) REFERENCES company_codes(tenant_id,id),FOREIGN KEY(tenant_id,product_id) REFERENCES products(tenant_id,id)
);
CREATE UNIQUE INDEX one_physical_stock_serial ON warehouse_bin_balances(tenant_id,product_id,serial) WHERE serial<>'' AND quantity>0;
CREATE TABLE warehouse_bin_openings(
 tenant_id uuid NOT NULL,company_id uuid NOT NULL,bin_id uuid NOT NULL,product_id uuid NOT NULL,batch text NOT NULL,serial text NOT NULL,quantity numeric(24,6) NOT NULL CHECK(quantity>0),observed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,bin_id,product_id,batch,serial),FOREIGN KEY(tenant_id,bin_id) REFERENCES warehouse_bins(tenant_id,id),FOREIGN KEY(tenant_id,company_id) REFERENCES company_codes(tenant_id,id),FOREIGN KEY(tenant_id,product_id) REFERENCES products(tenant_id,id)
);
INSERT INTO warehouse_bins(id,tenant_id,company_id,location_id,code,name,system_buffer,allow_mixed_products,allow_mixed_batches)
 SELECT gen_random_uuid(),l.tenant_id,p.company_id,l.id,'UNASSIGNED','Eingangspuffer / Platzzuordnung offen',true,true,true FROM storage_locations l JOIN plants p ON p.tenant_id=l.tenant_id AND p.id=l.plant_id;
INSERT INTO warehouse_bin_openings(tenant_id,company_id,bin_id,product_id,batch,serial,quantity)
 SELECT s.tenant_id,s.company_id,b.id,s.product_id,s.batch,s.serial,s.quantity FROM stock_balances s JOIN warehouse_bins b ON b.tenant_id=s.tenant_id AND b.location_id=s.location_id AND b.system_buffer WHERE s.quantity>0;
INSERT INTO warehouse_bin_balances(tenant_id,company_id,bin_id,product_id,batch,serial,quantity) SELECT tenant_id,company_id,bin_id,product_id,batch,serial,quantity FROM warehouse_bin_openings;
CREATE TRIGGER warehouse_opening_immutable BEFORE UPDATE OR DELETE ON warehouse_bin_openings FOR EACH ROW EXECUTE FUNCTION reject_attachment_mutation();
CREATE TABLE warehouse_transfers(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,company_id uuid NOT NULL,location_id uuid NOT NULL,movement_date date NOT NULL,
 movement_type text NOT NULL CHECK(movement_type IN('PUTAWAY','BIN_TRANSFER','REVERSAL')),reason text NOT NULL CHECK(length(reason)>=5),company_snapshot jsonb NOT NULL,reverses_id uuid,sealed boolean NOT NULL DEFAULT false,
 CHECK((movement_type='REVERSAL')=(reverses_id IS NOT NULL)),UNIQUE(tenant_id,id),UNIQUE(tenant_id,reverses_id),
 FOREIGN KEY(tenant_id,id) REFERENCES documents(tenant_id,id),FOREIGN KEY(tenant_id,company_id) REFERENCES company_codes(tenant_id,id),FOREIGN KEY(tenant_id,location_id) REFERENCES storage_locations(tenant_id,id),FOREIGN KEY(tenant_id,reverses_id) REFERENCES warehouse_transfers(tenant_id,id)
);
CREATE TABLE warehouse_transfer_items(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,transfer_id uuid NOT NULL,position integer NOT NULL,from_bin_id uuid NOT NULL,to_bin_id uuid NOT NULL,product_id uuid NOT NULL,quantity numeric(18,6) NOT NULL CHECK(quantity>0),batch text NOT NULL DEFAULT '',serial text NOT NULL DEFAULT '',snapshot jsonb NOT NULL,
 CHECK(from_bin_id<>to_bin_id),CHECK(serial='' OR quantity=1),UNIQUE(tenant_id,id),UNIQUE(tenant_id,transfer_id,position),
 FOREIGN KEY(tenant_id,transfer_id) REFERENCES warehouse_transfers(tenant_id,id),FOREIGN KEY(tenant_id,from_bin_id) REFERENCES warehouse_bins(tenant_id,id),FOREIGN KEY(tenant_id,to_bin_id) REFERENCES warehouse_bins(tenant_id,id),FOREIGN KEY(tenant_id,product_id) REFERENCES products(tenant_id,id)
);
ALTER TABLE goods_issue_items ADD COLUMN bin_id uuid,ADD FOREIGN KEY(tenant_id,bin_id) REFERENCES warehouse_bins(tenant_id,id);
CREATE TABLE warehouse_bin_entries(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,company_id uuid NOT NULL,bin_id uuid NOT NULL,product_id uuid NOT NULL,batch text NOT NULL,serial text NOT NULL,quantity numeric(24,6) NOT NULL CHECK(quantity<>0),
 receipt_item_id uuid,issue_item_id uuid,transfer_item_id uuid,created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(num_nonnulls(receipt_item_id,issue_item_id,transfer_item_id)=1),UNIQUE(tenant_id,id),UNIQUE(tenant_id,receipt_item_id),UNIQUE(tenant_id,issue_item_id),UNIQUE(tenant_id,transfer_item_id,bin_id),
 FOREIGN KEY(tenant_id,company_id) REFERENCES company_codes(tenant_id,id),FOREIGN KEY(tenant_id,bin_id) REFERENCES warehouse_bins(tenant_id,id),FOREIGN KEY(tenant_id,product_id) REFERENCES products(tenant_id,id),
 FOREIGN KEY(tenant_id,receipt_item_id) REFERENCES goods_receipt_items(tenant_id,id),FOREIGN KEY(tenant_id,issue_item_id) REFERENCES goods_issue_items(tenant_id,id),FOREIGN KEY(tenant_id,transfer_item_id) REFERENCES warehouse_transfer_items(tenant_id,id)
);
CREATE TRIGGER warehouse_entry_immutable BEFORE UPDATE OR DELETE ON warehouse_bin_entries FOR EACH ROW EXECUTE FUNCTION reject_attachment_mutation();
CREATE TRIGGER warehouse_transfer_item_immutable BEFORE UPDATE OR DELETE ON warehouse_transfer_items FOR EACH ROW EXECUTE FUNCTION reject_attachment_mutation();
CREATE TABLE warehouse_bin_labels(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,bin_id uuid NOT NULL,number text NOT NULL,source_version integer NOT NULL,source_hash text NOT NULL,snapshot jsonb NOT NULL,content bytea NOT NULL,sha256 text NOT NULL,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,number),UNIQUE(tenant_id,bin_id,source_hash),FOREIGN KEY(tenant_id,bin_id) REFERENCES warehouse_bins(tenant_id,id),FOREIGN KEY(tenant_id,created_by) REFERENCES users(tenant_id,id)
);
CREATE TRIGGER warehouse_label_immutable BEFORE UPDATE OR DELETE ON warehouse_bin_labels FOR EACH ROW EXECUTE FUNCTION reject_attachment_mutation();
DO $$DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['warehouse_areas','warehouse_racks','warehouse_bins','warehouse_bin_balances','warehouse_bin_openings','warehouse_transfers','warehouse_transfer_items','warehouse_bin_entries','warehouse_bin_labels'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY tenant_isolation ON %I USING(tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid) WITH CHECK(tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid)',t);
END LOOP;END$$;
CREATE FUNCTION warehouse_location_buffer() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$BEGIN
 IF NEW.tenant_id IS DISTINCT FROM nullif(current_setting('app.tenant_id',true),'')::uuid THEN RAISE EXCEPTION 'Mandantenkontext fehlt';END IF;
 INSERT INTO warehouse_bins(id,tenant_id,company_id,location_id,code,name,system_buffer,allow_mixed_products,allow_mixed_batches) SELECT gen_random_uuid(),NEW.tenant_id,p.company_id,NEW.id,'UNASSIGNED','Eingangspuffer / Platzzuordnung offen',true,true,true FROM plants p WHERE p.tenant_id=NEW.tenant_id AND p.id=NEW.plant_id;
 RETURN NEW;
END$$;
CREATE TRIGGER location_physical_buffer AFTER INSERT ON storage_locations FOR EACH ROW EXECUTE FUNCTION warehouse_location_buffer();
CREATE FUNCTION warehouse_issue_bin() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE h goods_issues;BEGIN
 SELECT * INTO STRICT h FROM goods_issues WHERE tenant_id=NEW.tenant_id AND id=NEW.issue_id;
 IF NEW.bin_id IS NULL AND h.movement_type='ISSUE_REVERSAL' THEN SELECT bin_id INTO NEW.bin_id FROM goods_issue_items WHERE tenant_id=NEW.tenant_id AND issue_id=h.reverses_id AND position=NEW.position;END IF;
 IF NEW.bin_id IS NULL THEN SELECT id INTO STRICT NEW.bin_id FROM warehouse_bins WHERE tenant_id=NEW.tenant_id AND company_id=h.company_id AND location_id=NEW.location_id AND system_buffer;END IF;
 IF NOT EXISTS(SELECT 1 FROM warehouse_bins WHERE tenant_id=NEW.tenant_id AND id=NEW.bin_id AND company_id=h.company_id AND location_id=NEW.location_id) THEN RAISE EXCEPTION 'Entnahmeplatz passt nicht zu Lagerort und Buchungskreis';END IF;
 RETURN NEW;
END$$;
CREATE TRIGGER issue_assign_physical_bin BEFORE INSERT ON goods_issue_items FOR EACH ROW EXECUTE FUNCTION warehouse_issue_bin();
CREATE FUNCTION warehouse_apply_entry() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$DECLARE b warehouse_bins;p products;total numeric;BEGIN
 IF NEW.tenant_id IS DISTINCT FROM nullif(current_setting('app.tenant_id',true),'')::uuid THEN RAISE EXCEPTION 'Mandantenkontext fehlt';END IF;
 SELECT * INTO STRICT b FROM warehouse_bins WHERE tenant_id=NEW.tenant_id AND id=NEW.bin_id FOR UPDATE;
 IF b.company_id<>NEW.company_id OR b.blocked OR EXISTS(SELECT 1 FROM warehouse_racks r JOIN warehouse_areas a ON a.tenant_id=r.tenant_id AND a.id=r.area_id WHERE r.tenant_id=b.tenant_id AND r.id=b.rack_id AND (r.blocked OR a.blocked)) THEN RAISE EXCEPTION 'Lagerplatz, Regal oder Bereich ist für Bewegungen gesperrt';END IF;
 IF NEW.receipt_item_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM goods_receipt_items i JOIN goods_receipts h ON h.tenant_id=i.tenant_id AND h.id=i.receipt_id WHERE i.tenant_id=NEW.tenant_id AND i.id=NEW.receipt_item_id AND b.system_buffer AND i.location_id=b.location_id AND h.company_id=b.company_id AND i.product_id=NEW.product_id AND i.batch=NEW.batch AND i.serial=NEW.serial AND NEW.quantity=CASE h.movement_type WHEN 'RECEIPT' THEN i.quantity ELSE -i.quantity END) THEN RAISE EXCEPTION 'Platzbewegung passt nicht zum tatsächlichen Wareneingang';END IF;
 IF NEW.issue_item_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM goods_issue_items i JOIN goods_issues h ON h.tenant_id=i.tenant_id AND h.id=i.issue_id WHERE i.tenant_id=NEW.tenant_id AND i.id=NEW.issue_item_id AND i.bin_id=b.id AND i.location_id=b.location_id AND h.company_id=b.company_id AND i.product_id=NEW.product_id AND i.batch=NEW.batch AND i.serial=NEW.serial AND NEW.quantity=CASE h.movement_type WHEN 'ISSUE' THEN -i.quantity ELSE i.quantity END) THEN RAISE EXCEPTION 'Platzbewegung passt nicht zur tatsächlichen Auslieferung';END IF;
 IF NEW.transfer_item_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM warehouse_transfer_items i JOIN warehouse_transfers h ON h.tenant_id=i.tenant_id AND h.id=i.transfer_id WHERE i.tenant_id=NEW.tenant_id AND i.id=NEW.transfer_item_id AND h.company_id=b.company_id AND h.location_id=b.location_id AND i.product_id=NEW.product_id AND i.batch=NEW.batch AND i.serial=NEW.serial AND ((i.from_bin_id=b.id AND NEW.quantity=-i.quantity) OR (i.to_bin_id=b.id AND NEW.quantity=i.quantity))) THEN RAISE EXCEPTION 'Platzbewegung passt nicht zum Platzwechsel';END IF;
 IF NEW.quantity>0 THEN
  SELECT * INTO STRICT p FROM products WHERE tenant_id=NEW.tenant_id AND id=NEW.product_id;
  IF NOT b.allow_mixed_products AND EXISTS(SELECT 1 FROM warehouse_bin_balances WHERE tenant_id=b.tenant_id AND bin_id=b.id AND product_id<>NEW.product_id AND quantity>0) THEN RAISE EXCEPTION 'Lagerplatz erlaubt keine Artikelvermischung';END IF;
  IF NOT b.allow_mixed_batches AND EXISTS(SELECT 1 FROM warehouse_bin_balances WHERE tenant_id=b.tenant_id AND bin_id=b.id AND product_id=NEW.product_id AND batch<>NEW.batch AND quantity>0) THEN RAISE EXCEPTION 'Lagerplatz erlaubt keine Chargenvermischung';END IF;
  IF b.capacity IS NOT NULL THEN
   SELECT coalesce(sum(quantity),0) INTO total FROM warehouse_bin_balances WHERE tenant_id=b.tenant_id AND bin_id=b.id;
   IF b.capacity_unit<>p.unit OR total+NEW.quantity>b.capacity THEN RAISE EXCEPTION 'Lagerplatzkapazität oder Kapazitätseinheit überschritten';END IF;
  END IF;
 END IF;
 INSERT INTO warehouse_bin_balances(tenant_id,company_id,bin_id,product_id,batch,serial,quantity) VALUES(NEW.tenant_id,NEW.company_id,NEW.bin_id,NEW.product_id,NEW.batch,NEW.serial,0) ON CONFLICT DO NOTHING;
 UPDATE warehouse_bin_balances SET quantity=quantity+NEW.quantity WHERE tenant_id=NEW.tenant_id AND bin_id=NEW.bin_id AND product_id=NEW.product_id AND batch=NEW.batch AND serial=NEW.serial;
 RETURN NEW;
END$$;
CREATE TRIGGER warehouse_entry_projection AFTER INSERT ON warehouse_bin_entries FOR EACH ROW EXECUTE FUNCTION warehouse_apply_entry();
CREATE FUNCTION warehouse_receipt_entry() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$DECLARE h goods_receipts;b uuid;BEGIN
 SELECT * INTO STRICT h FROM goods_receipts WHERE tenant_id=NEW.tenant_id AND id=NEW.receipt_id;
 SELECT id INTO STRICT b FROM warehouse_bins WHERE tenant_id=NEW.tenant_id AND company_id=h.company_id AND location_id=NEW.location_id AND system_buffer;
 INSERT INTO warehouse_bin_entries(id,tenant_id,company_id,bin_id,product_id,batch,serial,quantity,receipt_item_id) VALUES(gen_random_uuid(),NEW.tenant_id,h.company_id,b,NEW.product_id,NEW.batch,NEW.serial,CASE h.movement_type WHEN 'RECEIPT' THEN NEW.quantity ELSE -NEW.quantity END,NEW.id);RETURN NEW;
END$$;
CREATE TRIGGER warehouse_receipt_projection AFTER INSERT ON goods_receipt_items FOR EACH ROW EXECUTE FUNCTION warehouse_receipt_entry();
CREATE FUNCTION warehouse_issue_entry() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$DECLARE h goods_issues;BEGIN
 SELECT * INTO STRICT h FROM goods_issues WHERE tenant_id=NEW.tenant_id AND id=NEW.issue_id;
 INSERT INTO warehouse_bin_entries(id,tenant_id,company_id,bin_id,product_id,batch,serial,quantity,issue_item_id) VALUES(gen_random_uuid(),NEW.tenant_id,h.company_id,NEW.bin_id,NEW.product_id,NEW.batch,NEW.serial,CASE h.movement_type WHEN 'ISSUE' THEN -NEW.quantity ELSE NEW.quantity END,NEW.id);RETURN NEW;
END$$;
CREATE TRIGGER warehouse_issue_projection AFTER INSERT ON goods_issue_items FOR EACH ROW EXECUTE FUNCTION warehouse_issue_entry();
CREATE FUNCTION warehouse_transfer_entries() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$DECLARE h warehouse_transfers;BEGIN
 SELECT * INTO STRICT h FROM warehouse_transfers WHERE tenant_id=NEW.tenant_id AND id=NEW.transfer_id;
 IF h.sealed THEN RAISE EXCEPTION 'Platzwechsel ist bereits abgeschlossen';END IF;
 PERFORM 1 FROM company_codes WHERE tenant_id=h.tenant_id AND id=h.company_id FOR UPDATE;
 INSERT INTO warehouse_bin_entries(id,tenant_id,company_id,bin_id,product_id,batch,serial,quantity,transfer_item_id) VALUES(gen_random_uuid(),NEW.tenant_id,h.company_id,NEW.from_bin_id,NEW.product_id,NEW.batch,NEW.serial,-NEW.quantity,NEW.id);
 INSERT INTO warehouse_bin_entries(id,tenant_id,company_id,bin_id,product_id,batch,serial,quantity,transfer_item_id) VALUES(gen_random_uuid(),NEW.tenant_id,h.company_id,NEW.to_bin_id,NEW.product_id,NEW.batch,NEW.serial,NEW.quantity,NEW.id);RETURN NEW;
END$$;
CREATE TRIGGER warehouse_transfer_projection AFTER INSERT ON warehouse_transfer_items FOR EACH ROW EXECUTE FUNCTION warehouse_transfer_entries();
CREATE FUNCTION warehouse_quantities_consistent() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE loc uuid;physical numeric;logical numeric;BEGIN
 IF TG_TABLE_NAME='stock_balances' THEN loc:=NEW.location_id;ELSE SELECT location_id INTO loc FROM warehouse_bins WHERE tenant_id=NEW.tenant_id AND id=NEW.bin_id;END IF;
 SELECT coalesce(sum(s.quantity),0) INTO physical FROM warehouse_bin_balances s JOIN warehouse_bins b ON b.tenant_id=s.tenant_id AND b.id=s.bin_id WHERE s.tenant_id=NEW.tenant_id AND b.location_id=loc AND s.company_id=NEW.company_id AND s.product_id=NEW.product_id AND s.batch=NEW.batch AND s.serial=NEW.serial;
 SELECT coalesce(sum(quantity),0) INTO logical FROM stock_balances WHERE tenant_id=NEW.tenant_id AND location_id=loc AND company_id=NEW.company_id AND product_id=NEW.product_id AND batch=NEW.batch AND serial=NEW.serial;
 IF physical<>logical THEN RAISE EXCEPTION 'Physische Platzmenge stimmt nicht mit dem gebuchten Lagerortbestand überein';END IF;RETURN NULL;
END$$;
CREATE CONSTRAINT TRIGGER physical_stock_consistent AFTER INSERT OR UPDATE ON stock_balances DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION warehouse_quantities_consistent();
CREATE CONSTRAINT TRIGGER physical_bin_consistent AFTER INSERT OR UPDATE ON warehouse_bin_balances DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION warehouse_quantities_consistent();
CREATE FUNCTION warehouse_master_consistent() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE loc uuid;company uuid;total numeric;BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Lagerstruktur bleibt nachvollziehbar; sperren statt löschen';END IF;
 IF TG_OP='UPDATE' THEN
  IF TG_TABLE_NAME='warehouse_areas' AND (to_jsonb(OLD)-'name'-'blocked'-'version') IS DISTINCT FROM (to_jsonb(NEW)-'name'-'blocked'-'version') THEN RAISE EXCEPTION 'Bereichsidentität ist unveränderlich';END IF;
  IF TG_TABLE_NAME='warehouse_racks' AND (to_jsonb(OLD)-'name'-'blocked'-'version') IS DISTINCT FROM (to_jsonb(NEW)-'name'-'blocked'-'version') THEN RAISE EXCEPTION 'Regalidentität ist unveränderlich';END IF;
  IF TG_TABLE_NAME='warehouse_bins' THEN
  IF ((to_jsonb(OLD)-'name'-'blocked'-'capacity'-'capacity_unit'-'allow_mixed_products'-'allow_mixed_batches'-'version') IS DISTINCT FROM (to_jsonb(NEW)-'name'-'blocked'-'capacity'-'capacity_unit'-'allow_mixed_products'-'allow_mixed_batches'-'version') OR OLD.system_buffer) THEN RAISE EXCEPTION 'Platzidentität und Systempuffer sind unveränderlich';END IF;
  END IF;
 END IF;
 IF TG_TABLE_NAME='warehouse_racks' THEN
  IF NOT EXISTS(SELECT 1 FROM warehouse_areas WHERE tenant_id=NEW.tenant_id AND id=NEW.area_id) THEN RAISE EXCEPTION 'Lagerbereich fehlt';END IF;
 ELSIF TG_TABLE_NAME='warehouse_bins' THEN
  SELECT p.company_id INTO company FROM storage_locations l JOIN plants p ON p.tenant_id=l.tenant_id AND p.id=l.plant_id WHERE l.tenant_id=NEW.tenant_id AND l.id=NEW.location_id;
  IF company IS DISTINCT FROM NEW.company_id THEN RAISE EXCEPTION 'Lagerplatz gehört nicht zu diesem Buchungskreis';END IF;
  IF NOT NEW.system_buffer THEN
   SELECT a.location_id INTO loc FROM warehouse_racks r JOIN warehouse_areas a ON a.tenant_id=r.tenant_id AND a.id=r.area_id WHERE r.tenant_id=NEW.tenant_id AND r.id=NEW.rack_id;
   IF loc IS DISTINCT FROM NEW.location_id THEN RAISE EXCEPTION 'Regal gehört nicht zu diesem Lagerort';END IF;
  END IF;
  PERFORM 1 FROM warehouse_bins WHERE tenant_id=NEW.tenant_id AND id=NEW.id FOR UPDATE;
  SELECT coalesce(sum(quantity),0) INTO total FROM warehouse_bin_balances WHERE tenant_id=NEW.tenant_id AND bin_id=NEW.id;
  IF NEW.capacity IS NOT NULL AND (total>NEW.capacity OR EXISTS(SELECT 1 FROM warehouse_bin_balances s JOIN products p ON p.tenant_id=s.tenant_id AND p.id=s.product_id WHERE s.tenant_id=NEW.tenant_id AND s.bin_id=NEW.id AND s.quantity>0 AND p.unit<>NEW.capacity_unit)) THEN RAISE EXCEPTION 'Kapazitätsänderung passt nicht zum tatsächlichen Platzbestand';END IF;
  IF NOT NEW.allow_mixed_products AND (SELECT count(DISTINCT product_id) FROM warehouse_bin_balances WHERE tenant_id=NEW.tenant_id AND bin_id=NEW.id AND quantity>0)>1 THEN RAISE EXCEPTION 'Tatsächlicher Mischbestand benötigt vorherige Entmischung';END IF;
  IF NOT NEW.allow_mixed_batches AND EXISTS(SELECT 1 FROM warehouse_bin_balances WHERE tenant_id=NEW.tenant_id AND bin_id=NEW.id AND quantity>0 GROUP BY product_id HAVING count(DISTINCT batch)>1) THEN RAISE EXCEPTION 'Tatsächliche Chargen benötigen vorherige Entmischung';END IF;
 END IF;RETURN NEW;
END$$;
CREATE TRIGGER warehouse_area_master BEFORE INSERT OR UPDATE OR DELETE ON warehouse_areas FOR EACH ROW EXECUTE FUNCTION warehouse_master_consistent();
CREATE TRIGGER warehouse_rack_master BEFORE INSERT OR UPDATE OR DELETE ON warehouse_racks FOR EACH ROW EXECUTE FUNCTION warehouse_master_consistent();
CREATE TRIGGER warehouse_bin_master BEFORE INSERT OR UPDATE OR DELETE ON warehouse_bins FOR EACH ROW EXECUTE FUNCTION warehouse_master_consistent();
CREATE FUNCTION warehouse_transfer_frozen() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
 IF TG_OP='UPDATE' AND NOT OLD.sealed AND NEW.sealed AND (to_jsonb(OLD)-'sealed')=(to_jsonb(NEW)-'sealed') THEN RETURN NEW;END IF;
 RAISE EXCEPTION 'Platzwechsel ist unveränderlich; Gegenbewegung verwenden';
END$$;
CREATE TRIGGER warehouse_transfer_immutable BEFORE UPDATE OR DELETE ON warehouse_transfers FOR EACH ROW EXECUTE FUNCTION warehouse_transfer_frozen();
CREATE FUNCTION warehouse_transfer_consistent() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE h warehouse_transfers;o warehouse_transfers;BEGIN
 SELECT * INTO STRICT h FROM warehouse_transfers WHERE tenant_id=NEW.tenant_id AND id=NEW.id;
 IF NOT h.sealed OR NOT EXISTS(SELECT 1 FROM warehouse_transfer_items WHERE tenant_id=h.tenant_id AND transfer_id=h.id) THEN RAISE EXCEPTION 'Platzwechsel ist unvollständig';END IF;
 IF h.movement_date<>(now() AT TIME ZONE 'Europe/Berlin')::date THEN RAISE EXCEPTION 'Physischer Platzwechsel benötigt das tatsächliche heutige Bewegungsdatum';END IF;
 IF NOT EXISTS(SELECT 1 FROM storage_locations l JOIN plants p ON p.tenant_id=l.tenant_id AND p.id=l.plant_id JOIN company_codes c ON c.tenant_id=p.tenant_id AND c.id=p.company_id JOIN documents d ON d.tenant_id=c.tenant_id AND d.organization_id=c.organization_id WHERE l.tenant_id=h.tenant_id AND l.id=h.location_id AND c.id=h.company_id AND d.id=h.id AND d.kind='STOCK_TRANSFER') THEN RAISE EXCEPTION 'Platzwechsel gehört nicht zu Lagerort, Buchungskreis und Beleg';END IF;
 IF EXISTS(SELECT 1 FROM journals WHERE tenant_id=h.tenant_id AND source_id=h.id) THEN RAISE EXCEPTION 'Interner Platzwechsel darf Bestand und Aufwand nicht erneut buchen';END IF;
 IF NOT EXISTS(SELECT 1 FROM company_codes c WHERE c.tenant_id=h.tenant_id AND c.id=h.company_id AND h.company_snapshot->>'id'=c.id::text AND h.company_snapshot->>'name'=c.name AND h.company_snapshot->>'street'=c.street AND h.company_snapshot->>'postalCode'=c.postal_code AND h.company_snapshot->>'city'=c.city AND h.company_snapshot->>'country'=c.country) THEN RAISE EXCEPTION 'Historischer Firmenstand des Platzwechsels fehlt';END IF;
 IF EXISTS(SELECT 1 FROM warehouse_transfer_items i JOIN warehouse_bins f ON f.tenant_id=i.tenant_id AND f.id=i.from_bin_id JOIN warehouse_bins t ON t.tenant_id=i.tenant_id AND t.id=i.to_bin_id JOIN products p ON p.tenant_id=i.tenant_id AND p.id=i.product_id WHERE i.tenant_id=h.tenant_id AND i.transfer_id=h.id AND (i.snapshot->'from'->>'id' IS DISTINCT FROM i.from_bin_id::text OR i.snapshot->'to'->>'id' IS DISTINCT FROM i.to_bin_id::text OR i.snapshot->'from'->>'code' IS DISTINCT FROM f.code OR i.snapshot->'to'->>'code' IS DISTINCT FROM t.code OR i.snapshot->'product'->>'id' IS DISTINCT FROM i.product_id::text OR i.snapshot->'product'->>'unit' IS DISTINCT FROM p.unit OR (i.snapshot->>'quantity')::numeric IS DISTINCT FROM i.quantity OR i.snapshot->>'batch' IS DISTINCT FROM i.batch OR i.snapshot->>'serial' IS DISTINCT FROM i.serial)) THEN RAISE EXCEPTION 'Platzwechsel-Snapshot passt nicht zur tatsächlichen Bewegung';END IF;
 IF EXISTS(SELECT 1 FROM warehouse_transfer_items i WHERE i.tenant_id=h.tenant_id AND i.transfer_id=h.id AND ((SELECT count(*) FROM warehouse_bin_entries e WHERE e.tenant_id=i.tenant_id AND e.transfer_item_id=i.id)<>2 OR (SELECT sum(quantity) FROM warehouse_bin_entries e WHERE e.tenant_id=i.tenant_id AND e.transfer_item_id=i.id)<>0)) THEN RAISE EXCEPTION 'Vollständige ausgeglichene Platzbewegung fehlt';END IF;
 IF h.movement_type='PUTAWAY' AND EXISTS(SELECT 1 FROM warehouse_transfer_items i JOIN warehouse_bins f ON f.tenant_id=i.tenant_id AND f.id=i.from_bin_id JOIN warehouse_bins t ON t.tenant_id=i.tenant_id AND t.id=i.to_bin_id WHERE i.tenant_id=h.tenant_id AND i.transfer_id=h.id AND (NOT f.system_buffer OR t.system_buffer)) THEN RAISE EXCEPTION 'Einlagerung benötigt Puffer als Quelle und Fach als Ziel';END IF;
 IF h.reverses_id IS NOT NULL THEN
  SELECT * INTO o FROM warehouse_transfers WHERE tenant_id=h.tenant_id AND id=h.reverses_id;
  IF o.id IS NULL OR NOT o.sealed OR o.movement_type='REVERSAL' OR o.company_id<>h.company_id OR o.location_id<>h.location_id THEN RAISE EXCEPTION 'Ursprünglicher Platzwechsel fehlt';END IF;
  IF EXISTS((SELECT position,from_bin_id,to_bin_id,product_id,quantity,batch,serial FROM warehouse_transfer_items WHERE tenant_id=h.tenant_id AND transfer_id=o.id EXCEPT ALL SELECT position,to_bin_id,from_bin_id,product_id,quantity,batch,serial FROM warehouse_transfer_items WHERE tenant_id=h.tenant_id AND transfer_id=h.id) UNION ALL (SELECT position,to_bin_id,from_bin_id,product_id,quantity,batch,serial FROM warehouse_transfer_items WHERE tenant_id=h.tenant_id AND transfer_id=h.id EXCEPT ALL SELECT position,from_bin_id,to_bin_id,product_id,quantity,batch,serial FROM warehouse_transfer_items WHERE tenant_id=h.tenant_id AND transfer_id=o.id)) THEN RAISE EXCEPTION 'Gegenbewegung muss den ursprünglichen Platzwechsel exakt umkehren';END IF;
 END IF;RETURN NULL;
END$$;
CREATE CONSTRAINT TRIGGER physical_transfer_complete AFTER INSERT OR UPDATE ON warehouse_transfers DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION warehouse_transfer_consistent();

CREATE FUNCTION warehouse_item_open() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
 IF NOT EXISTS(SELECT 1 FROM warehouse_transfers WHERE tenant_id=NEW.tenant_id AND id=NEW.transfer_id AND NOT sealed) THEN RAISE EXCEPTION 'Gebuchter Platzwechsel ist unveränderlich';END IF;
 RETURN NEW;
END$$;
CREATE TRIGGER warehouse_item_unsealed BEFORE INSERT ON warehouse_transfer_items FOR EACH ROW EXECUTE FUNCTION warehouse_item_open();
