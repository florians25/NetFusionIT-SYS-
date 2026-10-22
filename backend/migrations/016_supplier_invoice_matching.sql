ALTER TABLE supplier_invoices ADD COLUMN match_note text NOT NULL DEFAULT '' CHECK(length(match_note)<=2000),ADD COLUMN matched_at timestamptz,ADD COLUMN matched_by uuid,ADD FOREIGN KEY(tenant_id,matched_by) REFERENCES users(tenant_id,id);
CREATE FUNCTION supplier_match_editable() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
 IF OLD.status<>'DRAFT' AND ROW(NEW.purchase_order_id,NEW.supplier_id,NEW.order_id,NEW.match_note,NEW.matched_at,NEW.matched_by) IS DISTINCT FROM ROW(OLD.purchase_order_id,OLD.supplier_id,OLD.order_id,OLD.match_note,OLD.matched_at,OLD.matched_by) THEN RAISE EXCEPTION 'Zuordnung eines abgeschlossenen Rechnungseingangs ist unveränderlich';END IF;
 RETURN NEW;
END$$;
CREATE TRIGGER supplier_match_edit_guard BEFORE UPDATE ON supplier_invoices FOR EACH ROW EXECUTE FUNCTION supplier_match_editable();
CREATE FUNCTION check_supplier_match() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE h supplier_invoices;p purchase_orders;doc documents;c company_codes;docid uuid;BEGIN
 IF TG_TABLE_NAME='supplier_invoice_items' THEN docid:=NEW.invoice_id;ELSE docid:=NEW.id;END IF;
 SELECT * INTO h FROM supplier_invoices WHERE tenant_id=NEW.tenant_id AND id=docid;
 IF h.purchase_order_id IS NULL THEN
  IF h.supplier_id IS NOT NULL OR h.order_id IS NOT NULL OR EXISTS(SELECT 1 FROM supplier_invoice_items WHERE tenant_id=h.tenant_id AND invoice_id=h.id AND purchase_order_item_id IS NOT NULL) THEN RAISE EXCEPTION 'Rechnungszuordnung benötigt eine gemeinsame Bestellung';END IF;
  RETURN NULL;
 END IF;
 SELECT * INTO p FROM purchase_orders WHERE tenant_id=h.tenant_id AND id=h.purchase_order_id;
 SELECT * INTO doc FROM documents WHERE tenant_id=h.tenant_id AND id=p.id;
 SELECT * INTO c FROM company_codes WHERE tenant_id=h.tenant_id AND id=h.company_id;
 IF p.id IS NULL OR p.company_id<>h.company_id OR h.order_id IS DISTINCT FROM p.order_id OR h.supplier_id IS DISTINCT FROM p.supplier_id OR c.organization_id<>doc.organization_id THEN RAISE EXCEPTION 'Kreditor, Serviceauftrag, Bestellung und Buchungskreis passen nicht zusammen';END IF;
 IF EXISTS(SELECT 1 FROM supplier_invoice_items i JOIN purchase_order_items pi ON pi.tenant_id=i.tenant_id AND pi.id=i.purchase_order_item_id WHERE i.tenant_id=h.tenant_id AND i.invoice_id=h.id AND pi.purchase_order_id<>p.id) THEN RAISE EXCEPTION 'Rechnungsposition ist einer anderen Bestellung zugeordnet';END IF;
 RETURN NULL;
END$$;
CREATE CONSTRAINT TRIGGER supplier_header_match_consistent AFTER INSERT OR UPDATE ON supplier_invoices DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_supplier_match();
CREATE CONSTRAINT TRIGGER supplier_item_match_consistent AFTER INSERT OR UPDATE ON supplier_invoice_items DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_supplier_match();
