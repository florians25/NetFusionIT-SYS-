-- Controlled physical counts. Counter entries and approved material movements
-- are separate records; existing stock is never edited by the application.
ALTER TABLE documents DROP CONSTRAINT documents_kind_check;
ALTER TABLE documents ADD CONSTRAINT documents_kind_check CHECK(kind IN ('WORK_ORDER_TASK','TICKET','SERVICE_CASE','BUSINESS_PARTNER','APPROVAL','TECHNICAL_OBJECT','SERVICE_CONTRACT','FIELD_VISIT','SERVICE_ORDER','MATERIAL','MATERIAL_REQUIREMENT','REQUISITION','PURCHASE_ORDER','GOODS_RECEIPT','GOODS_ISSUE','SERVICE_REPORT','INVOICE','CANCELLATION','ACCOUNTING','PAYMENT','QUOTATION','SALES_ORDER','CREDIT_NOTE','BILLING_REQUEST','PARTNER_ACCOUNT','COMPANY_BILLING_PROFILE','SUPPLIER_INVOICE','SUPPLIER_INVOICE_REVERSAL','STOCK_TRANSFER','INVENTORY_COUNT'));
CREATE TABLE inventory_counts(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,company_id uuid NOT NULL,title text NOT NULL,reason text NOT NULL,count_day date NOT NULL,company_snapshot jsonb NOT NULL,reverses_id uuid,
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN('DRAFT','IN_REVIEW','APPROVED','REJECTED','POSTED','CANCELLED')),version integer NOT NULL DEFAULT 1,data_version integer NOT NULL DEFAULT 1,
 period_id uuid,posting_date date,document_date date,cost_center text,preparation_note text,prepared_by uuid,prepared_at timestamptz,prepared_snapshot jsonb,reviewed_by uuid,reviewed_at timestamptz,review_note text,
 cancel_reason text,correction_number text,journal_id uuid,snapshot jsonb,sealed boolean NOT NULL DEFAULT false,posted_at timestamptz,posted_by uuid,
 CHECK(sealed=(status='POSTED')),CHECK((status='CANCELLED')=(cancel_reason IS NOT NULL)),CHECK(cancel_reason IS NULL OR length(cancel_reason)>=15),CHECK(length(title) BETWEEN 3 AND 160),CHECK(length(reason) BETWEEN 15 AND 2000),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,correction_number),
 FOREIGN KEY(tenant_id,id) REFERENCES documents(tenant_id,id),FOREIGN KEY(tenant_id,company_id) REFERENCES company_codes(tenant_id,id),FOREIGN KEY(tenant_id,reverses_id) REFERENCES inventory_counts(tenant_id,id),FOREIGN KEY(tenant_id,period_id) REFERENCES fiscal_periods(tenant_id,id),FOREIGN KEY(tenant_id,prepared_by) REFERENCES users(tenant_id,id),FOREIGN KEY(tenant_id,reviewed_by) REFERENCES users(tenant_id,id),FOREIGN KEY(tenant_id,journal_id) REFERENCES journals(tenant_id,id),FOREIGN KEY(tenant_id,posted_by) REFERENCES users(tenant_id,id)
);
CREATE UNIQUE INDEX inventory_count_reversal_once ON inventory_counts(tenant_id,reverses_id) WHERE reverses_id IS NOT NULL AND status<>'CANCELLED';
CREATE TABLE inventory_count_scopes(
 tenant_id uuid NOT NULL,count_id uuid NOT NULL,bin_id uuid NOT NULL,snapshot jsonb NOT NULL,empty_confirmed_by uuid,empty_confirmed_at timestamptz,released_at timestamptz,
 PRIMARY KEY(tenant_id,count_id,bin_id),FOREIGN KEY(tenant_id,count_id) REFERENCES inventory_counts(tenant_id,id),FOREIGN KEY(tenant_id,bin_id) REFERENCES warehouse_bins(tenant_id,id),FOREIGN KEY(tenant_id,empty_confirmed_by) REFERENCES users(tenant_id,id),CHECK((empty_confirmed_by IS NULL)=(empty_confirmed_at IS NULL))
);
CREATE UNIQUE INDEX inventory_count_bin_once ON inventory_count_scopes(tenant_id,bin_id) WHERE released_at IS NULL;
CREATE TABLE inventory_count_lines(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,count_id uuid NOT NULL,bin_id uuid NOT NULL,product_id uuid NOT NULL,batch text NOT NULL,serial text NOT NULL,position integer NOT NULL,expected_quantity numeric(24,6) NOT NULL CHECK(expected_quantity>=0),counted_quantity numeric(24,6) CHECK(counted_quantity>=0),counted_by uuid,counted_at timestamptz,created_by uuid NOT NULL,snapshot jsonb NOT NULL,
 CHECK(serial='' OR (expected_quantity IN(0,1) AND (counted_quantity IS NULL OR counted_quantity IN(0,1)))),CHECK((counted_quantity IS NULL)=(counted_by IS NULL)),CHECK((counted_by IS NULL)=(counted_at IS NULL)),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,count_id,position),UNIQUE(tenant_id,count_id,bin_id,product_id,batch,serial),
 FOREIGN KEY(tenant_id,count_id,bin_id) REFERENCES inventory_count_scopes(tenant_id,count_id,bin_id),FOREIGN KEY(tenant_id,product_id) REFERENCES products(tenant_id,id),FOREIGN KEY(tenant_id,counted_by) REFERENCES users(tenant_id,id),FOREIGN KEY(tenant_id,created_by) REFERENCES users(tenant_id,id)
);
CREATE TABLE inventory_count_entries(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,count_id uuid NOT NULL,line_id uuid,bin_id uuid NOT NULL,kind text NOT NULL CHECK(kind IN('COUNT','EMPTY','REVERSAL')),revision integer NOT NULL,previous_quantity numeric(24,6),counted_quantity numeric(24,6),actor_id uuid NOT NULL,recorded_at timestamptz NOT NULL,note text NOT NULL CHECK(length(note) BETWEEN 5 AND 2000),
 CHECK((kind IN('COUNT','REVERSAL') AND line_id IS NOT NULL AND counted_quantity IS NOT NULL AND counted_quantity>=0) OR (kind='EMPTY' AND line_id IS NULL AND counted_quantity IS NULL AND previous_quantity IS NULL)),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,count_id,revision),FOREIGN KEY(tenant_id,count_id,bin_id) REFERENCES inventory_count_scopes(tenant_id,count_id,bin_id),FOREIGN KEY(tenant_id,line_id) REFERENCES inventory_count_lines(tenant_id,id),FOREIGN KEY(tenant_id,actor_id) REFERENCES users(tenant_id,id)
);
CREATE TABLE inventory_count_preparations(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,count_id uuid NOT NULL,revision integer NOT NULL,snapshot jsonb NOT NULL,sha256 text NOT NULL,prepared_by uuid NOT NULL,prepared_at timestamptz NOT NULL,
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,count_id,revision),FOREIGN KEY(tenant_id,count_id) REFERENCES inventory_counts(tenant_id,id),FOREIGN KEY(tenant_id,prepared_by) REFERENCES users(tenant_id,id),CHECK(sha256=encode(sha256(convert_to(snapshot::text,'UTF8')),'hex'))
);
CREATE TABLE inventory_count_movements(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,count_id uuid NOT NULL,line_id uuid NOT NULL,position integer NOT NULL,bin_id uuid NOT NULL,product_id uuid NOT NULL,batch text NOT NULL,serial text NOT NULL,quantity numeric(24,6) NOT NULL CHECK(quantity<>0),value numeric(24,4) NOT NULL,inventory_account_id uuid,snapshot jsonb NOT NULL,
 CHECK((quantity>0 AND value>=0) OR (quantity<0 AND value<=0)),CHECK(serial='' OR abs(quantity)=1),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,line_id),UNIQUE(tenant_id,count_id,position),
 FOREIGN KEY(tenant_id,count_id) REFERENCES inventory_counts(tenant_id,id),FOREIGN KEY(tenant_id,line_id) REFERENCES inventory_count_lines(tenant_id,id),FOREIGN KEY(tenant_id,bin_id) REFERENCES warehouse_bins(tenant_id,id),FOREIGN KEY(tenant_id,product_id) REFERENCES products(tenant_id,id),FOREIGN KEY(tenant_id,inventory_account_id) REFERENCES gl_accounts(tenant_id,id)
);
ALTER TABLE warehouse_bin_entries ADD COLUMN count_movement_id uuid,
 ADD FOREIGN KEY(tenant_id,count_movement_id) REFERENCES inventory_count_movements(tenant_id,id);
ALTER TABLE warehouse_bin_entries DROP CONSTRAINT warehouse_bin_entries_check;
ALTER TABLE warehouse_bin_entries ADD CHECK(num_nonnulls(receipt_item_id,issue_item_id,transfer_item_id,count_movement_id)=1),ADD UNIQUE(tenant_id,count_movement_id);
DO $$DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['inventory_counts','inventory_count_scopes','inventory_count_lines','inventory_count_entries','inventory_count_preparations','inventory_count_movements'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY tenant_isolation ON %I USING(tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid) WITH CHECK(tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid)',t);
END LOOP;END$$;
CREATE TRIGGER inventory_count_entry_immutable BEFORE UPDATE OR DELETE ON inventory_count_entries FOR EACH ROW EXECUTE FUNCTION reject_attachment_mutation();
CREATE TRIGGER inventory_count_preparation_immutable BEFORE UPDATE OR DELETE ON inventory_count_preparations FOR EACH ROW EXECUTE FUNCTION reject_attachment_mutation();
CREATE TRIGGER inventory_count_movement_immutable BEFORE UPDATE OR DELETE ON inventory_count_movements FOR EACH ROW EXECUTE FUNCTION reject_attachment_mutation();
CREATE FUNCTION inventory_count_header_guard() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
 IF TG_OP='INSERT' THEN IF NEW.status<>'DRAFT' OR NEW.sealed THEN RAISE EXCEPTION 'Inventur beginnt als offener Zählvorgang';END IF;RETURN NEW;END IF;
 IF TG_OP='DELETE' OR OLD.sealed OR OLD.status='CANCELLED' THEN RAISE EXCEPTION 'Inventur bleibt unveränderlich; gesonderte Gegenbewegung verwenden';END IF;
 IF NEW.version<OLD.version OR NEW.version>OLD.version+1 OR NEW.data_version<OLD.data_version OR NEW.data_version>OLD.data_version+1 OR (NEW.data_version<>OLD.data_version AND NEW.version<>OLD.version+1) THEN RAISE EXCEPTION 'Inventurrevision darf nicht zurückgesetzt oder übersprungen werden';END IF;
 IF NEW.status<>OLD.status AND NOT ((OLD.status IN('DRAFT','REJECTED') AND NEW.status IN('DRAFT','IN_REVIEW','CANCELLED')) OR (OLD.status='IN_REVIEW' AND NEW.status IN('DRAFT','APPROVED','REJECTED')) OR (OLD.status='APPROVED' AND NEW.status IN('DRAFT','POSTED'))) THEN RAISE EXCEPTION 'Unzulässiger Inventurstatusübergang';END IF;
 IF (to_jsonb(OLD)-'status'-'version'-'data_version'-'period_id'-'posting_date'-'document_date'-'cost_center'-'preparation_note'-'prepared_by'-'prepared_at'-'prepared_snapshot'-'reviewed_by'-'reviewed_at'-'review_note'-'correction_number'-'journal_id'-'snapshot'-'sealed'-'posted_at'-'posted_by'-'cancel_reason') IS DISTINCT FROM (to_jsonb(NEW)-'status'-'version'-'data_version'-'period_id'-'posting_date'-'document_date'-'cost_center'-'preparation_note'-'prepared_by'-'prepared_at'-'prepared_snapshot'-'reviewed_by'-'reviewed_at'-'review_note'-'correction_number'-'journal_id'-'snapshot'-'sealed'-'posted_at'-'posted_by'-'cancel_reason') THEN RAISE EXCEPTION 'Inventuridentität und ursprünglicher Umfang sind unveränderlich';END IF;
 IF OLD.status IN('IN_REVIEW','APPROVED') AND (to_jsonb(OLD)-'status'-'version'-'reviewed_by'-'reviewed_at'-'review_note'-'correction_number'-'journal_id'-'snapshot'-'sealed'-'posted_at'-'posted_by'-'cancel_reason') IS DISTINCT FROM (to_jsonb(NEW)-'status'-'version'-'reviewed_by'-'reviewed_at'-'review_note'-'correction_number'-'journal_id'-'snapshot'-'sealed'-'posted_at'-'posted_by'-'cancel_reason') THEN RAISE EXCEPTION 'Zähl-/Vorbereitungsstand ist in unabhängiger Prüfung gebunden';END IF;
 RETURN NEW;
END$$;
CREATE TRIGGER inventory_count_header_frozen BEFORE INSERT OR UPDATE OR DELETE ON inventory_counts FOR EACH ROW EXECUTE FUNCTION inventory_count_header_guard();
CREATE FUNCTION inventory_count_line_guard() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE h inventory_counts;b warehouse_bins;p products;s material_inventory_settings;actual numeric;BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Zählposition bleibt nachvollziehbar';END IF;
 SELECT * INTO STRICT h FROM inventory_counts WHERE tenant_id=NEW.tenant_id AND id=NEW.count_id;
 IF h.status NOT IN('DRAFT','REJECTED') THEN RAISE EXCEPTION 'Zählstand ist nicht mehr änderbar';END IF;
 IF TG_OP='UPDATE' THEN
  IF (to_jsonb(OLD)-'counted_quantity'-'counted_by'-'counted_at') IS DISTINCT FROM (to_jsonb(NEW)-'counted_quantity'-'counted_by'-'counted_at') THEN RAISE EXCEPTION 'Zählherkunft und Sollstand sind unveränderlich';END IF;RETURN NEW;
 END IF;
 SELECT * INTO STRICT b FROM warehouse_bins WHERE tenant_id=NEW.tenant_id AND id=NEW.bin_id;
 SELECT * INTO STRICT p FROM products WHERE tenant_id=NEW.tenant_id AND id=NEW.product_id;
 SELECT * INTO STRICT s FROM material_inventory_settings WHERE tenant_id=NEW.tenant_id AND product_id=NEW.product_id;
 IF b.company_id<>h.company_id OR p.kind<>'STOCK' OR NOT EXISTS(SELECT 1 FROM documents d JOIN company_codes c ON c.tenant_id=d.tenant_id AND c.organization_id=d.organization_id WHERE d.tenant_id=h.tenant_id AND d.id=p.id AND c.id=h.company_id) OR s.serial_required<>(NEW.serial<>'') OR s.batch_required<>(NEW.batch<>'') THEN RAISE EXCEPTION 'Zählposition passt nicht zu Buchungskreis, Artikel und Tracking';END IF;
 SELECT coalesce((SELECT quantity FROM warehouse_bin_balances WHERE tenant_id=NEW.tenant_id AND bin_id=NEW.bin_id AND product_id=NEW.product_id AND batch=NEW.batch AND serial=NEW.serial),0) INTO actual;
 IF actual<>NEW.expected_quantity THEN RAISE EXCEPTION 'Inventur-Sollmenge entspricht nicht dem tatsächlich gesperrten Fachbestand';END IF;
 RETURN NEW;
END$$;
CREATE TRIGGER inventory_count_line_frozen BEFORE INSERT OR UPDATE OR DELETE ON inventory_count_lines FOR EACH ROW EXECUTE FUNCTION inventory_count_line_guard();
CREATE FUNCTION inventory_count_release_bins() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$BEGIN
 IF NEW.status IN('POSTED','CANCELLED') AND NEW.status IS DISTINCT FROM OLD.status THEN UPDATE inventory_count_scopes SET released_at=now() WHERE tenant_id=NEW.tenant_id AND count_id=NEW.id AND released_at IS NULL;END IF;RETURN NEW;
END$$;
CREATE TRIGGER inventory_count_release AFTER UPDATE ON inventory_counts FOR EACH ROW EXECUTE FUNCTION inventory_count_release_bins();
CREATE FUNCTION inventory_count_scope_guard() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE h inventory_counts;BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Inventurumfang bleibt nachvollziehbar';END IF;
 SELECT * INTO STRICT h FROM inventory_counts WHERE tenant_id=NEW.tenant_id AND id=NEW.count_id;
 IF TG_OP='UPDATE' AND OLD.released_at IS NOT NULL THEN RAISE EXCEPTION 'Abgeschlossener Zählumfang bleibt unveränderlich';END IF;
 IF TG_OP='UPDATE' AND (to_jsonb(OLD)-'empty_confirmed_by'-'empty_confirmed_at'-'released_at') IS DISTINCT FROM (to_jsonb(NEW)-'empty_confirmed_by'-'empty_confirmed_at'-'released_at') THEN RAISE EXCEPTION 'Gesperrter Inventurumfang ist unveränderlich';END IF;
 IF TG_OP='UPDATE' AND NEW.empty_confirmed_at IS NOT NULL AND (NEW.empty_confirmed_by,NEW.empty_confirmed_at) IS DISTINCT FROM (OLD.empty_confirmed_by,OLD.empty_confirmed_at) AND NOT EXISTS(SELECT 1 FROM inventory_count_entries e WHERE e.tenant_id=NEW.tenant_id AND e.count_id=NEW.count_id AND e.bin_id=NEW.bin_id AND e.kind='EMPTY' AND e.revision=h.data_version+1 AND e.actor_id=NEW.empty_confirmed_by AND e.recorded_at=NEW.empty_confirmed_at) THEN RAISE EXCEPTION 'Leerbestätigung benötigt tatsächlichen neuen Erfassungsverlauf';END IF;
 IF NEW.released_at IS NOT NULL THEN IF h.status NOT IN('POSTED','CANCELLED') THEN RAISE EXCEPTION 'Zählsperre erst nach Abschluss oder begründetem Abbruch lösen';END IF;
 ELSIF h.status NOT IN('DRAFT','REJECTED') THEN RAISE EXCEPTION 'Zählumfang ist in unabhängiger Prüfung gebunden';END IF;
 IF NOT EXISTS(SELECT 1 FROM warehouse_bins WHERE tenant_id=NEW.tenant_id AND id=NEW.bin_id AND company_id=h.company_id) THEN RAISE EXCEPTION 'Zählfach gehört nicht zum Buchungskreis';END IF;
 RETURN NEW;
END$$;
CREATE TRIGGER inventory_count_scope_frozen BEFORE INSERT OR UPDATE OR DELETE ON inventory_count_scopes FOR EACH ROW EXECUTE FUNCTION inventory_count_scope_guard();

CREATE OR REPLACE FUNCTION warehouse_apply_entry() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$DECLARE b warehouse_bins;p products;total numeric;BEGIN
 IF NEW.tenant_id IS DISTINCT FROM nullif(current_setting('app.tenant_id',true),'')::uuid THEN RAISE EXCEPTION 'Mandantenkontext fehlt';END IF;
 SELECT * INTO STRICT b FROM warehouse_bins WHERE tenant_id=NEW.tenant_id AND id=NEW.bin_id FOR UPDATE;
 IF b.company_id<>NEW.company_id OR b.blocked OR EXISTS(SELECT 1 FROM warehouse_racks r JOIN warehouse_areas a ON a.tenant_id=r.tenant_id AND a.id=r.area_id WHERE r.tenant_id=b.tenant_id AND r.id=b.rack_id AND (r.blocked OR a.blocked)) THEN RAISE EXCEPTION 'Lagerplatz, Regal oder Bereich ist für Bewegungen gesperrt';END IF;
 IF EXISTS(SELECT 1 FROM inventory_count_scopes cs WHERE cs.tenant_id=NEW.tenant_id AND cs.bin_id=NEW.bin_id AND cs.released_at IS NULL AND NOT EXISTS(SELECT 1 FROM inventory_count_movements cm WHERE cm.tenant_id=NEW.tenant_id AND cm.id=NEW.count_movement_id AND cm.count_id=cs.count_id)) THEN RAISE EXCEPTION 'Lagerplatz ist durch eine laufende Inventur für Bewegungen gesperrt';END IF;
 IF NEW.count_movement_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM inventory_count_movements cm JOIN inventory_counts c ON c.tenant_id=cm.tenant_id AND c.id=cm.count_id WHERE cm.tenant_id=NEW.tenant_id AND cm.id=NEW.count_movement_id AND cm.bin_id=NEW.bin_id AND c.company_id=NEW.company_id AND cm.product_id=NEW.product_id AND cm.batch=NEW.batch AND cm.serial=NEW.serial AND cm.quantity=NEW.quantity AND c.status='APPROVED' AND NOT c.sealed) THEN RAISE EXCEPTION 'Platzkorrektur benötigt die passende unabhängig freigegebene Inventur';END IF;
 IF NEW.receipt_item_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM goods_receipt_items i JOIN goods_receipts h ON h.tenant_id=i.tenant_id AND h.id=i.receipt_id WHERE i.tenant_id=NEW.tenant_id AND i.id=NEW.receipt_item_id AND b.system_buffer AND i.location_id=b.location_id AND h.company_id=b.company_id AND i.product_id=NEW.product_id AND i.batch=NEW.batch AND i.serial=NEW.serial AND NEW.quantity=CASE h.movement_type WHEN 'RECEIPT' THEN i.quantity ELSE -i.quantity END) THEN RAISE EXCEPTION 'Platzbewegung passt nicht zum tatsächlichen Wareneingang';END IF;
 IF NEW.issue_item_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM goods_issue_items i JOIN goods_issues h ON h.tenant_id=i.tenant_id AND h.id=i.issue_id WHERE i.tenant_id=NEW.tenant_id AND i.id=NEW.issue_item_id AND i.bin_id=b.id AND i.location_id=b.location_id AND h.company_id=b.company_id AND i.product_id=NEW.product_id AND i.batch=NEW.batch AND i.serial=NEW.serial AND NEW.quantity=CASE h.movement_type WHEN 'ISSUE' THEN -i.quantity ELSE i.quantity END) THEN RAISE EXCEPTION 'Platzbewegung passt nicht zur tatsächlichen Auslieferung';END IF;
 IF NEW.transfer_item_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM warehouse_transfer_items i JOIN warehouse_transfers h ON h.tenant_id=i.tenant_id AND h.id=i.transfer_id WHERE i.tenant_id=NEW.tenant_id AND i.id=NEW.transfer_item_id AND h.company_id=b.company_id AND ((i.from_bin_id=b.id AND b.location_id=h.location_id) OR (i.to_bin_id=b.id AND b.location_id=coalesce(h.destination_location_id,h.location_id))) AND i.product_id=NEW.product_id AND i.batch=NEW.batch AND i.serial=NEW.serial AND ((i.from_bin_id=b.id AND NEW.quantity=-i.quantity) OR (i.to_bin_id=b.id AND NEW.quantity=i.quantity))) THEN RAISE EXCEPTION 'Platzbewegung passt nicht zum Platzwechsel';END IF;
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

CREATE FUNCTION inventory_count_entry_guard() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE h inventory_counts;l inventory_count_lines;BEGIN
 SELECT * INTO STRICT h FROM inventory_counts WHERE tenant_id=NEW.tenant_id AND id=NEW.count_id;
 IF h.status NOT IN('DRAFT','REJECTED') OR NEW.revision<>h.data_version+1 THEN RAISE EXCEPTION 'Zählrevision ist nicht mehr aktuell oder bearbeitbar';END IF;
 IF NOT EXISTS(SELECT 1 FROM users u JOIN user_organizations o ON o.tenant_id=u.tenant_id AND o.user_id=u.id JOIN company_codes c ON c.tenant_id=o.tenant_id AND c.organization_id=o.organization_id WHERE u.tenant_id=NEW.tenant_id AND u.id=NEW.actor_id AND u.active AND u.role IN('ADMIN','WAREHOUSE') AND c.id=h.company_id) THEN RAISE EXCEPTION 'Zähler dieses Buchungskreises fehlt';END IF;
 IF NEW.kind='EMPTY' THEN
  IF EXISTS(SELECT 1 FROM inventory_count_lines WHERE tenant_id=NEW.tenant_id AND count_id=NEW.count_id AND bin_id=NEW.bin_id) THEN RAISE EXCEPTION 'Fach enthält Zählpositionen und kann nicht pauschal leer bestätigt werden';END IF;
 ELSE
  SELECT * INTO STRICT l FROM inventory_count_lines WHERE tenant_id=NEW.tenant_id AND id=NEW.line_id;
  IF l.count_id<>NEW.count_id OR l.bin_id<>NEW.bin_id OR l.counted_quantity IS DISTINCT FROM NEW.previous_quantity OR (NEW.kind='REVERSAL')<>(h.reverses_id IS NOT NULL) THEN RAISE EXCEPTION 'Zählerfassung passt nicht zur tatsächlichen Inventurherkunft';END IF;
 END IF;RETURN NEW;
END$$;
CREATE TRIGGER inventory_count_entry_source BEFORE INSERT ON inventory_count_entries FOR EACH ROW EXECUTE FUNCTION inventory_count_entry_guard();
CREATE FUNCTION inventory_count_capture_guard() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE h inventory_counts;BEGIN
 SELECT * INTO STRICT h FROM inventory_counts WHERE tenant_id=NEW.tenant_id AND id=NEW.count_id;
 IF NEW.counted_quantity IS NULL OR (h.reverses_id IS NOT NULL AND OLD.counted_quantity IS NOT NULL) OR NOT EXISTS(SELECT 1 FROM inventory_count_entries e WHERE e.tenant_id=NEW.tenant_id AND e.count_id=NEW.count_id AND e.line_id=NEW.id AND e.revision=h.data_version+1 AND e.counted_quantity=NEW.counted_quantity AND e.actor_id=NEW.counted_by AND e.recorded_at=NEW.counted_at) THEN RAISE EXCEPTION 'Zähländerung benötigt eine neue tatsächliche Erfassung mit Verlauf';END IF;
 RETURN NEW;
END$$;
CREATE TRIGGER inventory_count_capture_source BEFORE UPDATE OF counted_quantity,counted_by,counted_at ON inventory_count_lines FOR EACH ROW EXECUTE FUNCTION inventory_count_capture_guard();

ALTER TABLE accounting_rules DROP CONSTRAINT accounting_rules_event_check;
ALTER TABLE accounting_rules ADD CHECK(event IN('STOCK_OPENING','STOCK_RECEIPT','STOCK_ISSUE','STOCK_COUNT','SALES_INVOICE','PURCHASE_INVOICE','CUSTOMER_PAYMENT','SUPPLIER_PAYMENT'));

CREATE FUNCTION inventory_count_material_entry() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$DECLARE h inventory_counts;l inventory_count_lines;b warehouse_bins;planned jsonb;BEGIN
 IF NEW.tenant_id IS DISTINCT FROM nullif(current_setting('app.tenant_id',true),'')::uuid THEN RAISE EXCEPTION 'Mandantenkontext fehlt';END IF;
 SELECT * INTO STRICT h FROM inventory_counts WHERE tenant_id=NEW.tenant_id AND id=NEW.count_id;
 IF h.status<>'APPROVED' OR h.sealed OR h.reviewed_by IS NULL THEN RAISE EXCEPTION 'Inventurbewegung benötigt unabhängige Differenzfreigabe';END IF;
 SELECT * INTO STRICT l FROM inventory_count_lines WHERE tenant_id=NEW.tenant_id AND id=NEW.line_id;
 SELECT * INTO STRICT b FROM warehouse_bins WHERE tenant_id=NEW.tenant_id AND id=NEW.bin_id FOR UPDATE;
 SELECT x INTO planned FROM jsonb_array_elements(h.prepared_snapshot->'lines') x WHERE x->>'id'=NEW.line_id::text;
 IF l.count_id<>h.id OR l.bin_id<>b.id OR b.company_id<>h.company_id OR l.product_id<>NEW.product_id OR l.batch<>NEW.batch OR l.serial<>NEW.serial OR l.counted_quantity-l.expected_quantity<>NEW.quantity OR planned IS NULL OR planned IS DISTINCT FROM NEW.snapshot OR (planned->>'value')::numeric IS DISTINCT FROM NEW.value OR (planned->>'inventoryAccountId')::uuid IS DISTINCT FROM NEW.inventory_account_id OR NOT EXISTS(SELECT 1 FROM inventory_count_scopes cs WHERE cs.tenant_id=NEW.tenant_id AND cs.count_id=h.id AND cs.bin_id=b.id AND cs.released_at IS NULL) THEN RAISE EXCEPTION 'Inventurbewegung passt nicht zum gebundenen tatsächlichen Zähl-/Bewertungsstand';END IF;
 PERFORM 1 FROM company_codes WHERE tenant_id=h.tenant_id AND id=h.company_id FOR UPDATE;
 INSERT INTO stock_balances(tenant_id,company_id,product_id,location_id,batch,serial,quantity) VALUES(h.tenant_id,h.company_id,NEW.product_id,b.location_id,NEW.batch,NEW.serial,0) ON CONFLICT DO NOTHING;
 UPDATE stock_balances SET quantity=quantity+NEW.quantity WHERE tenant_id=h.tenant_id AND company_id=h.company_id AND product_id=NEW.product_id AND location_id=b.location_id AND batch=NEW.batch AND serial=NEW.serial;
 INSERT INTO warehouse_bin_entries(id,tenant_id,company_id,bin_id,product_id,batch,serial,quantity,count_movement_id) VALUES(gen_random_uuid(),h.tenant_id,h.company_id,b.id,NEW.product_id,NEW.batch,NEW.serial,NEW.quantity,NEW.id);
 RETURN NEW;
END$$;
CREATE TRIGGER inventory_count_material_projection AFTER INSERT ON inventory_count_movements FOR EACH ROW EXECUTE FUNCTION inventory_count_material_entry();
CREATE FUNCTION inventory_count_value_entry() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$DECLARE change record;v inventory_valuations;account uuid;BEGIN
 IF NEW.sealed AND NOT OLD.sealed THEN
  IF NEW.tenant_id IS DISTINCT FROM nullif(current_setting('app.tenant_id',true),'')::uuid THEN RAISE EXCEPTION 'Mandantenkontext fehlt';END IF;
  PERFORM 1 FROM company_codes WHERE tenant_id=NEW.tenant_id AND id=NEW.company_id FOR UPDATE;
  FOR change IN SELECT product_id,sum(quantity) AS quantity,sum(value) AS value,array_agg(DISTINCT inventory_account_id) FILTER(WHERE inventory_account_id IS NOT NULL) AS accounts FROM inventory_count_movements WHERE tenant_id=NEW.tenant_id AND count_id=NEW.id GROUP BY product_id LOOP
   SELECT * INTO STRICT v FROM inventory_valuations WHERE tenant_id=NEW.tenant_id AND company_id=NEW.company_id AND product_id=change.product_id FOR UPDATE;
   IF coalesce(array_length(change.accounts,1),0)>1 THEN RAISE EXCEPTION 'Inventurdifferenz vermischt historische Bestandskonten';END IF;
   account:=change.accounts[1];IF v.value>0 AND account IS NOT NULL AND v.inventory_account_id IS DISTINCT FROM account THEN RAISE EXCEPTION 'Bestandskonto hat sich gegenüber dem Prüfstand geändert';END IF;
   UPDATE inventory_valuations SET quantity=quantity+change.quantity,value=value+change.value,inventory_account_id=CASE WHEN value+change.value=0 THEN NULL ELSE coalesce(inventory_account_id,account) END WHERE tenant_id=NEW.tenant_id AND company_id=NEW.company_id AND product_id=change.product_id;
  END LOOP;
 END IF;RETURN NEW;
END$$;
CREATE TRIGGER inventory_count_apply_value AFTER UPDATE ON inventory_counts FOR EACH ROW EXECUTE FUNCTION inventory_count_value_entry();
CREATE FUNCTION inventory_count_posting_consistent() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE h inventory_counts;j journals;original inventory_counts;c company_codes;digits integer;creator uuid;v record;before_state jsonb;dq numeric;dv numeric;nq numeric;nv numeric;expected_value numeric;BEGIN
 IF TG_TABLE_NAME='inventory_count_movements' THEN SELECT * INTO STRICT h FROM inventory_counts WHERE tenant_id=NEW.tenant_id AND id=NEW.count_id;
 ELSIF TG_TABLE_NAME='journals' THEN
  IF NEW.reversal_of IS NOT NULL AND EXISTS(SELECT 1 FROM journals prior_j JOIN inventory_counts ic ON ic.tenant_id=prior_j.tenant_id AND ic.id=prior_j.source_id WHERE prior_j.tenant_id=NEW.tenant_id AND prior_j.id=NEW.reversal_of) AND NOT EXISTS(SELECT 1 FROM inventory_counts counter JOIN journals prior_j ON prior_j.tenant_id=counter.tenant_id AND prior_j.source_id=counter.reverses_id WHERE counter.tenant_id=NEW.tenant_id AND counter.id=NEW.source_id AND counter.sealed AND counter.status='POSTED' AND prior_j.id=NEW.reversal_of) THEN RAISE EXCEPTION 'Automatische Inventur-FI nur mit freigegebener tatsächlicher Gegenbewegung stornieren';END IF;
  SELECT * INTO h FROM inventory_counts WHERE tenant_id=NEW.tenant_id AND id=NEW.source_id;IF h.id IS NULL THEN RETURN NULL;END IF;
 ELSE SELECT * INTO STRICT h FROM inventory_counts WHERE tenant_id=NEW.tenant_id AND id=NEW.id;END IF;
 IF NOT h.sealed THEN IF h.snapshot IS NOT NULL OR h.correction_number IS NOT NULL OR h.journal_id IS NOT NULL OR h.posted_at IS NOT NULL OR h.posted_by IS NOT NULL OR EXISTS(SELECT 1 FROM inventory_count_movements WHERE tenant_id=h.tenant_id AND count_id=h.id) THEN RAISE EXCEPTION 'Unvollständige Inventurbuchung darf weder Mengen noch Finanzbestand verändern';END IF;RETURN NULL;END IF;
 SELECT * INTO STRICT c FROM company_codes WHERE tenant_id=h.tenant_id AND id=h.company_id;SELECT cur.digits INTO STRICT digits FROM currencies cur WHERE cur.tenant_id=c.tenant_id AND cur.code=c.currency;SELECT created_by INTO STRICT creator FROM documents WHERE tenant_id=h.tenant_id AND id=h.id AND kind='INVENTORY_COUNT' AND organization_id=c.organization_id;
 IF h.status<>'POSTED' OR h.prepared_snapshot IS NULL OR h.snapshot->'preparation' IS DISTINCT FROM h.prepared_snapshot OR h.posted_by IS NULL OR h.posted_at IS NULL OR h.reviewed_by IS NULL OR h.reviewed_at IS NULL OR length(h.review_note)<15 OR NOT EXISTS(SELECT 1 FROM inventory_count_preparations p WHERE p.tenant_id=h.tenant_id AND p.count_id=h.id AND p.snapshot=h.prepared_snapshot) THEN RAISE EXCEPTION 'Gebundener vollständiger Inventur-/Vorbereitungsstand fehlt';END IF;
 IF h.reviewed_by IN(creator,h.prepared_by) OR EXISTS(SELECT 1 FROM inventory_count_entries WHERE tenant_id=h.tenant_id AND count_id=h.id AND actor_id=h.reviewed_by) OR EXISTS(SELECT 1 FROM inventory_count_lines WHERE tenant_id=h.tenant_id AND count_id=h.id AND created_by=h.reviewed_by) OR EXISTS(SELECT 1 FROM inventory_count_preparations WHERE tenant_id=h.tenant_id AND count_id=h.id AND prepared_by=h.reviewed_by) THEN RAISE EXCEPTION 'Eigene Zählung oder Vorbereitung darf nicht selbst freigegeben werden';END IF;
 IF NOT EXISTS(SELECT 1 FROM users u JOIN user_organizations o ON o.tenant_id=u.tenant_id AND o.user_id=u.id WHERE u.tenant_id=h.tenant_id AND u.id=h.reviewed_by AND u.active AND u.role IN('ADMIN','ACCOUNTANT') AND o.organization_id=c.organization_id) OR NOT EXISTS(SELECT 1 FROM users u JOIN user_organizations o ON o.tenant_id=u.tenant_id AND o.user_id=u.id WHERE u.tenant_id=h.tenant_id AND u.id=h.posted_by AND u.active AND u.role IN('ADMIN','ACCOUNTANT') AND o.organization_id=c.organization_id) THEN RAISE EXCEPTION 'Aktuelle unabhängige Finanzverantwortung fehlt';END IF;
 IF NOT EXISTS(SELECT 1 FROM approval_instances a JOIN approval_decisions ad ON ad.tenant_id=a.tenant_id AND ad.instance_id=a.id WHERE a.tenant_id=h.tenant_id AND a.document_id=h.id AND a.status='APPROVED' AND a.four_eyes AND a.submitted_by<>h.reviewed_by AND ad.actor_id=h.reviewed_by AND ad.decision='APPROVE' AND ad.step=jsonb_array_length(a.steps_snapshot)-1 AND ad.context->>'role' IN('ADMIN','ACCOUNTANT') AND ad.context->>'preparedHash'=encode(sha256(convert_to(h.prepared_snapshot::text,'UTF8')),'hex')) THEN RAISE EXCEPTION 'Unabhängige Freigabe ist nicht an den tatsächlichen Inventurprüfstand gebunden';END IF;
 IF h.prepared_snapshot->>'id' IS DISTINCT FROM h.id::text OR h.prepared_snapshot->>'companyId' IS DISTINCT FROM h.company_id::text OR h.prepared_snapshot->>'currency' IS DISTINCT FROM c.currency OR (h.prepared_snapshot->>'digits')::int IS DISTINCT FROM digits OR (h.prepared_snapshot->>'dataVersion')::int IS DISTINCT FROM h.data_version OR (h.snapshot->'review'->>'at')::timestamptz IS DISTINCT FROM date_trunc('milliseconds',h.reviewed_at) OR h.prepared_snapshot->>'preparedBy' IS DISTINCT FROM h.prepared_by::text OR (h.prepared_snapshot->>'preparedAt')::timestamptz IS DISTINCT FROM h.prepared_at OR (h.prepared_snapshot->>'postingDate')::date IS DISTINCT FROM h.posting_date OR (h.prepared_snapshot->>'documentDate')::date IS DISTINCT FROM h.document_date THEN RAISE EXCEPTION 'Inventurherkunft, Währung oder Zeit-/Versionsstand stimmt nicht überein';END IF;
 IF NOT EXISTS(SELECT 1 FROM fiscal_periods p WHERE p.tenant_id=h.tenant_id AND p.id=h.period_id AND p.company_id=h.company_id AND p.status='OPEN' AND h.posting_date BETWEEN p.date_from AND p.date_to AND (h.prepared_snapshot->'period'->>'version')::int=p.version) THEN RAISE EXCEPTION 'Offener gebundener Periodenstand fehlt';END IF;
 IF NOT EXISTS(SELECT 1 FROM inventory_count_scopes WHERE tenant_id=h.tenant_id AND count_id=h.id) OR EXISTS(SELECT 1 FROM inventory_count_scopes s WHERE s.tenant_id=h.tenant_id AND s.count_id=h.id AND (s.released_at IS NULL OR (s.empty_confirmed_at IS NULL AND NOT EXISTS(SELECT 1 FROM inventory_count_lines l WHERE l.tenant_id=s.tenant_id AND l.count_id=s.count_id AND l.bin_id=s.bin_id)))) THEN RAISE EXCEPTION 'Zählumfang ist nicht vollständig abgeschlossen';END IF;
 IF EXISTS(SELECT 1 FROM inventory_count_lines l WHERE l.tenant_id=h.tenant_id AND l.count_id=h.id AND (l.counted_quantity IS NULL OR NOT EXISTS(SELECT 1 FROM inventory_count_entries e WHERE e.tenant_id=l.tenant_id AND e.count_id=l.count_id AND e.line_id=l.id AND e.counted_quantity=l.counted_quantity AND e.actor_id=l.counted_by AND e.recorded_at=l.counted_at AND e.revision=(SELECT max(revision) FROM inventory_count_entries last WHERE last.tenant_id=l.tenant_id AND last.line_id=l.id)))) THEN RAISE EXCEPTION 'Tatsächliche letzte Zählerfassung fehlt';END IF;
 IF EXISTS(SELECT 1 FROM inventory_count_scopes s JOIN warehouse_bin_balances b ON b.tenant_id=s.tenant_id AND b.bin_id=s.bin_id WHERE s.tenant_id=h.tenant_id AND s.count_id=h.id AND b.quantity>0 AND NOT EXISTS(SELECT 1 FROM inventory_count_lines l WHERE l.tenant_id=b.tenant_id AND l.count_id=h.id AND l.bin_id=b.bin_id AND l.product_id=b.product_id AND l.batch=b.batch AND l.serial=b.serial AND l.counted_quantity=b.quantity)) OR EXISTS(SELECT 1 FROM inventory_count_lines l WHERE l.tenant_id=h.tenant_id AND l.count_id=h.id AND l.counted_quantity<>coalesce((SELECT quantity FROM warehouse_bin_balances b WHERE b.tenant_id=l.tenant_id AND b.bin_id=l.bin_id AND b.product_id=l.product_id AND b.batch=l.batch AND b.serial=l.serial),0)) THEN RAISE EXCEPTION 'Gebuchter Fachendbestand passt nicht zur bestätigten Zählung';END IF;
 IF EXISTS(SELECT 1 FROM inventory_count_lines l WHERE l.tenant_id=h.tenant_id AND l.count_id=h.id AND ((l.counted_quantity<>l.expected_quantity)<>(EXISTS(SELECT 1 FROM inventory_count_movements m WHERE m.tenant_id=l.tenant_id AND m.line_id=l.id)))) THEN RAISE EXCEPTION 'Tatsächliche Differenzbewegungen fehlen oder sind fingiert';END IF;
 IF (h.correction_number IS NULL)<>(NOT EXISTS(SELECT 1 FROM inventory_count_movements WHERE tenant_id=h.tenant_id AND count_id=h.id)) OR (h.correction_number IS NOT NULL AND h.correction_number!~(CASE WHEN h.reverses_id IS NULL THEN '^LK-57[0-9]{6}$' ELSE '^SB-89[0-9]{6}$' END)) THEN RAISE EXCEPTION 'Tatsächliche Korrekturidentität passt nicht zur Inventurdifferenz';END IF;
 FOR before_state IN SELECT x FROM jsonb_array_elements(h.prepared_snapshot->'valuations') x LOOP
  SELECT coalesce(sum(quantity),0),coalesce(sum(value),0),coalesce(sum(-quantity) FILTER(WHERE quantity<0),0),coalesce(sum(-value) FILTER(WHERE quantity<0),0) INTO dq,dv,nq,nv FROM inventory_count_movements WHERE tenant_id=h.tenant_id AND count_id=h.id AND product_id=(before_state->>'productId')::uuid;
  SELECT * INTO v FROM inventory_valuations WHERE tenant_id=h.tenant_id AND company_id=h.company_id AND product_id=(before_state->>'productId')::uuid;
  IF coalesce(v.quantity,0)<>(before_state->>'quantity')::numeric+dq OR coalesce(v.value,0)<>(before_state->>'value')::numeric+dv THEN RAISE EXCEPTION 'Inventurwert ist nicht aus dem tatsächlichen Unternehmensstand abgeleitet';END IF;
  IF h.reverses_id IS NULL THEN
   IF (before_state->>'quantity')::numeric=0 THEN IF dq<>0 OR dv<>0 OR nq<>0 THEN RAISE EXCEPTION 'Bewertungsgrundlage für Inventurdifferenz fehlt';END IF;
   ELSE
    expected_value:=CASE WHEN dq=-(before_state->>'quantity')::numeric THEN -(before_state->>'value')::numeric ELSE round(trunc((before_state->>'value')::numeric*dq,60)/(before_state->>'quantity')::numeric,digits) END;
    IF dv<>expected_value OR nv<>(CASE WHEN nq=(before_state->>'quantity')::numeric THEN (before_state->>'value')::numeric ELSE round(trunc((before_state->>'value')::numeric*nq,60)/(before_state->>'quantity')::numeric,digits) END) THEN RAISE EXCEPTION 'Inventurdifferenz verwendet nicht die gebundene gleitende Bewertung und Originalcentverteilung';END IF;
   END IF;
  END IF;
 END LOOP;
 IF h.reverses_id IS NOT NULL THEN
  SELECT * INTO STRICT original FROM inventory_counts WHERE tenant_id=h.tenant_id AND id=h.reverses_id;
  IF NOT original.sealed OR original.reverses_id IS NOT NULL OR original.company_id<>h.company_id OR original.correction_number IS NULL THEN RAISE EXCEPTION 'Ursprüngliche Inventurkorrektur fehlt';END IF;
  IF EXISTS((SELECT bin_id,product_id,batch,serial,-quantity,-value,inventory_account_id FROM inventory_count_movements WHERE tenant_id=h.tenant_id AND count_id=original.id EXCEPT ALL SELECT bin_id,product_id,batch,serial,quantity,value,inventory_account_id FROM inventory_count_movements WHERE tenant_id=h.tenant_id AND count_id=h.id) UNION ALL (SELECT bin_id,product_id,batch,serial,quantity,value,inventory_account_id FROM inventory_count_movements WHERE tenant_id=h.tenant_id AND count_id=h.id EXCEPT ALL SELECT bin_id,product_id,batch,serial,-quantity,-value,inventory_account_id FROM inventory_count_movements WHERE tenant_id=h.tenant_id AND count_id=original.id)) THEN RAISE EXCEPTION 'Inventurgegenbewegung muss ursprüngliche Mengen/Werte/Fächer exakt umkehren';END IF;
 END IF;
 IF jsonb_array_length(h.prepared_snapshot->'journalLines')=0 THEN IF h.journal_id IS NOT NULL OR EXISTS(SELECT 1 FROM journals WHERE tenant_id=h.tenant_id AND source_id=h.id) THEN RAISE EXCEPTION 'Inventur ohne Wertdifferenz erzeugt keine fingierte FI';END IF;
 ELSE
  SELECT * INTO STRICT j FROM journals WHERE tenant_id=h.tenant_id AND id=h.journal_id AND source_id=h.id AND status='POSTED' AND company_id=h.company_id AND currency=c.currency AND posting_date=h.posting_date AND period_id=h.period_id;
  IF EXISTS((SELECT e.account_id,e.side,e.amount,e.description,e.cost_center,e.partner_id,e.tax_code FROM journal_entries e WHERE e.tenant_id=h.tenant_id AND e.journal_id=j.id EXCEPT ALL SELECT l."accountId",l.side,l.amount,l.description,l."costCenter",l."partnerId",l."taxCode" FROM jsonb_to_recordset(h.prepared_snapshot->'journalLines') AS l("accountId" uuid,side text,amount numeric,description text,"costCenter" text,"partnerId" uuid,"taxCode" text)) UNION ALL (SELECT l."accountId",l.side,l.amount,l.description,l."costCenter",l."partnerId",l."taxCode" FROM jsonb_to_recordset(h.prepared_snapshot->'journalLines') AS l("accountId" uuid,side text,amount numeric,description text,"costCenter" text,"partnerId" uuid,"taxCode" text) EXCEPT ALL SELECT e.account_id,e.side,e.amount,e.description,e.cost_center,e.partner_id,e.tax_code FROM journal_entries e WHERE e.tenant_id=h.tenant_id AND e.journal_id=j.id)) THEN RAISE EXCEPTION 'Inventur-FI stimmt nicht mit unabhängig freigegebener Kontierung überein';END IF;
  IF h.reverses_id IS NOT NULL AND j.reversal_of IS DISTINCT FROM original.journal_id THEN RAISE EXCEPTION 'Ursprünglicher Inventur-Finanzbeleg wird nicht exakt gegengebucht';END IF;
 END IF;
 RETURN NULL;
END$$;
CREATE CONSTRAINT TRIGGER inventory_count_posting_complete AFTER INSERT OR UPDATE ON inventory_counts DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION inventory_count_posting_consistent();
CREATE CONSTRAINT TRIGGER inventory_count_movement_complete AFTER INSERT ON inventory_count_movements DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION inventory_count_posting_consistent();
CREATE CONSTRAINT TRIGGER inventory_count_journal_complete AFTER INSERT OR UPDATE ON journals DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION inventory_count_posting_consistent();
