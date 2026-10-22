-- Same-company location transfer keeps company quantity/value unchanged.
-- Reservations stay at their location; only genuinely unreserved stock moves.
ALTER TABLE warehouse_transfers ADD COLUMN destination_location_id uuid,
 ADD FOREIGN KEY(tenant_id,destination_location_id) REFERENCES storage_locations(tenant_id,id);
ALTER TABLE warehouse_transfers DROP CONSTRAINT warehouse_transfers_movement_type_check;
ALTER TABLE warehouse_transfers ADD CHECK(movement_type IN('PUTAWAY','BIN_TRANSFER','LOCATION_TRANSFER','REVERSAL')),
 ADD CHECK(destination_location_id IS NULL OR destination_location_id<>location_id),
 ADD CHECK((movement_type='LOCATION_TRANSFER' AND destination_location_id IS NOT NULL) OR (movement_type IN('PUTAWAY','BIN_TRANSFER') AND destination_location_id IS NULL) OR movement_type='REVERSAL');

CREATE OR REPLACE FUNCTION warehouse_apply_entry() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$DECLARE b warehouse_bins;p products;total numeric;BEGIN
 IF NEW.tenant_id IS DISTINCT FROM nullif(current_setting('app.tenant_id',true),'')::uuid THEN RAISE EXCEPTION 'Mandantenkontext fehlt';END IF;
 SELECT * INTO STRICT b FROM warehouse_bins WHERE tenant_id=NEW.tenant_id AND id=NEW.bin_id FOR UPDATE;
 IF b.company_id<>NEW.company_id OR b.blocked OR EXISTS(SELECT 1 FROM warehouse_racks r JOIN warehouse_areas a ON a.tenant_id=r.tenant_id AND a.id=r.area_id WHERE r.tenant_id=b.tenant_id AND r.id=b.rack_id AND (r.blocked OR a.blocked)) THEN RAISE EXCEPTION 'Lagerplatz, Regal oder Bereich ist für Bewegungen gesperrt';END IF;
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

CREATE OR REPLACE FUNCTION warehouse_transfer_entries() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$DECLARE h warehouse_transfers;BEGIN
 SELECT * INTO STRICT h FROM warehouse_transfers WHERE tenant_id=NEW.tenant_id AND id=NEW.transfer_id;
 IF h.sealed THEN RAISE EXCEPTION 'Platzwechsel ist bereits abgeschlossen';END IF;
 PERFORM 1 FROM company_codes WHERE tenant_id=h.tenant_id AND id=h.company_id FOR UPDATE;
 IF h.destination_location_id IS NOT NULL THEN
  IF NOT EXISTS(SELECT 1 FROM warehouse_bins f JOIN warehouse_bins t ON t.tenant_id=f.tenant_id WHERE f.tenant_id=h.tenant_id AND f.id=NEW.from_bin_id AND t.id=NEW.to_bin_id AND f.company_id=h.company_id AND t.company_id=h.company_id AND f.location_id=h.location_id AND t.location_id=h.destination_location_id) THEN RAISE EXCEPTION 'Umlagerung passt nicht zu tatsächlichen Quell-/Zielfächern';END IF;
  -- Source first preserves the unique active serial identity across locations.
  UPDATE stock_balances SET quantity=quantity-NEW.quantity WHERE tenant_id=h.tenant_id AND company_id=h.company_id AND product_id=NEW.product_id AND location_id=h.location_id AND batch=NEW.batch AND serial=NEW.serial;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tatsächlicher Umlagerungsbestand fehlt';END IF;
  INSERT INTO stock_balances(tenant_id,company_id,product_id,location_id,batch,serial,quantity) VALUES(h.tenant_id,h.company_id,NEW.product_id,h.destination_location_id,NEW.batch,NEW.serial,0) ON CONFLICT DO NOTHING;
  UPDATE stock_balances SET quantity=quantity+NEW.quantity WHERE tenant_id=h.tenant_id AND company_id=h.company_id AND product_id=NEW.product_id AND location_id=h.destination_location_id AND batch=NEW.batch AND serial=NEW.serial;
 END IF;

 INSERT INTO warehouse_bin_entries(id,tenant_id,company_id,bin_id,product_id,batch,serial,quantity,transfer_item_id) VALUES(gen_random_uuid(),NEW.tenant_id,h.company_id,NEW.from_bin_id,NEW.product_id,NEW.batch,NEW.serial,-NEW.quantity,NEW.id);
 INSERT INTO warehouse_bin_entries(id,tenant_id,company_id,bin_id,product_id,batch,serial,quantity,transfer_item_id) VALUES(gen_random_uuid(),NEW.tenant_id,h.company_id,NEW.to_bin_id,NEW.product_id,NEW.batch,NEW.serial,NEW.quantity,NEW.id);RETURN NEW;
END$$;

CREATE OR REPLACE FUNCTION warehouse_transfer_consistent() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE h warehouse_transfers;o warehouse_transfers;BEGIN
 SELECT * INTO STRICT h FROM warehouse_transfers WHERE tenant_id=NEW.tenant_id AND id=NEW.id;
 IF NOT h.sealed OR NOT EXISTS(SELECT 1 FROM warehouse_transfer_items WHERE tenant_id=h.tenant_id AND transfer_id=h.id) THEN RAISE EXCEPTION 'Platzwechsel ist unvollständig';END IF;
 IF h.movement_date<>(now() AT TIME ZONE 'Europe/Berlin')::date THEN RAISE EXCEPTION 'Physischer Platzwechsel benötigt das tatsächliche heutige Bewegungsdatum';END IF;
 IF NOT EXISTS(SELECT 1 FROM storage_locations l JOIN plants p ON p.tenant_id=l.tenant_id AND p.id=l.plant_id JOIN company_codes c ON c.tenant_id=p.tenant_id AND c.id=p.company_id JOIN documents d ON d.tenant_id=c.tenant_id AND d.organization_id=c.organization_id WHERE l.tenant_id=h.tenant_id AND l.id=h.location_id AND c.id=h.company_id AND d.id=h.id AND d.kind='STOCK_TRANSFER') THEN RAISE EXCEPTION 'Platzwechsel gehört nicht zu Lagerort, Buchungskreis und Beleg';END IF;
 IF h.destination_location_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM storage_locations l JOIN plants p ON p.tenant_id=l.tenant_id AND p.id=l.plant_id WHERE l.tenant_id=h.tenant_id AND l.id=h.destination_location_id AND p.company_id=h.company_id) THEN RAISE EXCEPTION 'Ziel-Lagerort muss zum selben Buchungskreis gehören';END IF;
 IF EXISTS(SELECT 1 FROM warehouse_transfer_items i JOIN warehouse_bins f ON f.tenant_id=i.tenant_id AND f.id=i.from_bin_id JOIN warehouse_bins t ON t.tenant_id=i.tenant_id AND t.id=i.to_bin_id WHERE i.tenant_id=h.tenant_id AND i.transfer_id=h.id AND (f.company_id<>h.company_id OR t.company_id<>h.company_id OR f.location_id<>h.location_id OR t.location_id<>coalesce(h.destination_location_id,h.location_id))) THEN RAISE EXCEPTION 'Quell-/Zielfach und Lagerortbezug des Materialbelegs stimmen nicht überein';END IF;
 IF EXISTS(SELECT 1 FROM journals WHERE tenant_id=h.tenant_id AND source_id=h.id) THEN RAISE EXCEPTION 'Interner Platzwechsel darf Bestand und Aufwand nicht erneut buchen';END IF;
 IF NOT EXISTS(SELECT 1 FROM company_codes c WHERE c.tenant_id=h.tenant_id AND c.id=h.company_id AND h.company_snapshot->>'id'=c.id::text AND h.company_snapshot->>'name'=c.name AND h.company_snapshot->>'street'=c.street AND h.company_snapshot->>'postalCode'=c.postal_code AND h.company_snapshot->>'city'=c.city AND h.company_snapshot->>'country'=c.country) THEN RAISE EXCEPTION 'Historischer Firmenstand des Platzwechsels fehlt';END IF;
 IF EXISTS(SELECT 1 FROM warehouse_transfer_items i JOIN warehouse_bins f ON f.tenant_id=i.tenant_id AND f.id=i.from_bin_id JOIN warehouse_bins t ON t.tenant_id=i.tenant_id AND t.id=i.to_bin_id JOIN products p ON p.tenant_id=i.tenant_id AND p.id=i.product_id WHERE i.tenant_id=h.tenant_id AND i.transfer_id=h.id AND (i.snapshot->'from'->>'id' IS DISTINCT FROM i.from_bin_id::text OR i.snapshot->'to'->>'id' IS DISTINCT FROM i.to_bin_id::text OR i.snapshot->'from'->>'code' IS DISTINCT FROM f.code OR i.snapshot->'to'->>'code' IS DISTINCT FROM t.code OR i.snapshot->'product'->>'id' IS DISTINCT FROM i.product_id::text OR i.snapshot->'product'->>'unit' IS DISTINCT FROM p.unit OR (i.snapshot->>'quantity')::numeric IS DISTINCT FROM i.quantity OR i.snapshot->>'batch' IS DISTINCT FROM i.batch OR i.snapshot->>'serial' IS DISTINCT FROM i.serial)) THEN RAISE EXCEPTION 'Platzwechsel-Snapshot passt nicht zur tatsächlichen Bewegung';END IF;
 IF EXISTS(SELECT 1 FROM warehouse_transfer_items i WHERE i.tenant_id=h.tenant_id AND i.transfer_id=h.id AND ((SELECT count(*) FROM warehouse_bin_entries e WHERE e.tenant_id=i.tenant_id AND e.transfer_item_id=i.id)<>2 OR (SELECT sum(quantity) FROM warehouse_bin_entries e WHERE e.tenant_id=i.tenant_id AND e.transfer_item_id=i.id)<>0)) THEN RAISE EXCEPTION 'Vollständige ausgeglichene Platzbewegung fehlt';END IF;
 IF h.movement_type='PUTAWAY' AND EXISTS(SELECT 1 FROM warehouse_transfer_items i JOIN warehouse_bins f ON f.tenant_id=i.tenant_id AND f.id=i.from_bin_id JOIN warehouse_bins t ON t.tenant_id=i.tenant_id AND t.id=i.to_bin_id WHERE i.tenant_id=h.tenant_id AND i.transfer_id=h.id AND (NOT f.system_buffer OR t.system_buffer)) THEN RAISE EXCEPTION 'Einlagerung benötigt Puffer als Quelle und Fach als Ziel';END IF;
 IF h.reverses_id IS NOT NULL THEN
  SELECT * INTO o FROM warehouse_transfers WHERE tenant_id=h.tenant_id AND id=h.reverses_id;
  IF o.id IS NULL OR NOT o.sealed OR o.movement_type='REVERSAL' OR o.company_id<>h.company_id OR coalesce(o.destination_location_id,o.location_id)<>h.location_id OR (CASE WHEN o.destination_location_id IS NULL THEN NULL ELSE o.location_id END) IS DISTINCT FROM h.destination_location_id THEN RAISE EXCEPTION 'Ursprünglicher Platzwechsel fehlt';END IF;
  IF EXISTS((SELECT position,from_bin_id,to_bin_id,product_id,quantity,batch,serial FROM warehouse_transfer_items WHERE tenant_id=h.tenant_id AND transfer_id=o.id EXCEPT ALL SELECT position,to_bin_id,from_bin_id,product_id,quantity,batch,serial FROM warehouse_transfer_items WHERE tenant_id=h.tenant_id AND transfer_id=h.id) UNION ALL (SELECT position,to_bin_id,from_bin_id,product_id,quantity,batch,serial FROM warehouse_transfer_items WHERE tenant_id=h.tenant_id AND transfer_id=h.id EXCEPT ALL SELECT position,from_bin_id,to_bin_id,product_id,quantity,batch,serial FROM warehouse_transfer_items WHERE tenant_id=h.tenant_id AND transfer_id=o.id)) THEN RAISE EXCEPTION 'Gegenbewegung muss den ursprünglichen Platzwechsel exakt umkehren';END IF;
 END IF;RETURN NULL;
END$$;
