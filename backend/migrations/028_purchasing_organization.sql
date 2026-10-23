-- Configurable, company-bound purchasing; no fabricated historical assignments.
CREATE TABLE purchasing_organizations (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,organization_id uuid NOT NULL,company_id uuid NOT NULL,code text NOT NULL CHECK(code ~ '^[A-Z0-9_-]{1,12}$'),name text NOT NULL CHECK(length(name) BETWEEN 2 AND 120),active boolean NOT NULL DEFAULT true,version integer NOT NULL DEFAULT 1 CHECK(version>0),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,organization_id,code),FOREIGN KEY(tenant_id,organization_id) REFERENCES organizations(tenant_id,id),FOREIGN KEY(tenant_id,company_id) REFERENCES company_codes(tenant_id,id)
);
CREATE TABLE buyer_groups (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,organization_id uuid NOT NULL,code text NOT NULL CHECK(code ~ '^[A-Z0-9_-]{1,12}$'),name text NOT NULL CHECK(length(name) BETWEEN 2 AND 120),active boolean NOT NULL DEFAULT true,version integer NOT NULL DEFAULT 1 CHECK(version>0),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,organization_id,code),FOREIGN KEY(tenant_id,organization_id) REFERENCES organizations(tenant_id,id)
);
CREATE TABLE purchasing_group_assignments (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,organization_id uuid NOT NULL,purchasing_organization_id uuid NOT NULL,buyer_group_id uuid NOT NULL,active boolean NOT NULL DEFAULT true,version integer NOT NULL DEFAULT 1 CHECK(version>0),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,purchasing_organization_id,buyer_group_id),FOREIGN KEY(tenant_id,organization_id) REFERENCES organizations(tenant_id,id),FOREIGN KEY(tenant_id,purchasing_organization_id) REFERENCES purchasing_organizations(tenant_id,id),FOREIGN KEY(tenant_id,buyer_group_id) REFERENCES buyer_groups(tenant_id,id)
);
CREATE TABLE purchasing_plant_assignments (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,organization_id uuid NOT NULL,purchasing_organization_id uuid NOT NULL,plant_id uuid NOT NULL,active boolean NOT NULL DEFAULT true,version integer NOT NULL DEFAULT 1 CHECK(version>0),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,purchasing_organization_id,plant_id),FOREIGN KEY(tenant_id,organization_id) REFERENCES organizations(tenant_id,id),FOREIGN KEY(tenant_id,purchasing_organization_id) REFERENCES purchasing_organizations(tenant_id,id),FOREIGN KEY(tenant_id,plant_id) REFERENCES plants(tenant_id,id)
);
CREATE TABLE buyer_group_members (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,organization_id uuid NOT NULL,buyer_group_id uuid NOT NULL,user_id uuid NOT NULL,active boolean NOT NULL DEFAULT true,version integer NOT NULL DEFAULT 1 CHECK(version>0),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,buyer_group_id,user_id),FOREIGN KEY(tenant_id,organization_id) REFERENCES organizations(tenant_id,id),FOREIGN KEY(tenant_id,buyer_group_id) REFERENCES buyer_groups(tenant_id,id),FOREIGN KEY(tenant_id,user_id) REFERENCES users(tenant_id,id)
);
CREATE FUNCTION purchasing_master_guard() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Einkaufsstammdaten deaktivieren statt löschen';END IF;
 IF TG_OP='UPDATE' AND ((to_jsonb(OLD)-'name'-'active'-'version') IS DISTINCT FROM (to_jsonb(NEW)-'name'-'active'-'version') OR NEW.version<>OLD.version+1) THEN RAISE EXCEPTION 'Einkaufsidentität und Zuordnungen sind unveränderlich; Revision erforderlich';END IF;
 IF TG_TABLE_NAME='purchasing_organizations' THEN IF NOT EXISTS(SELECT 1 FROM company_codes c WHERE c.tenant_id=NEW.tenant_id AND c.id=NEW.company_id AND c.organization_id=NEW.organization_id) THEN RAISE EXCEPTION 'Einkaufsorganisation benötigt eigenen Buchungskreis';END IF;END IF;
 IF TG_TABLE_NAME IN ('purchasing_group_assignments','purchasing_plant_assignments') THEN
  IF NOT EXISTS(SELECT 1 FROM purchasing_organizations p WHERE p.tenant_id=NEW.tenant_id AND p.id=NEW.purchasing_organization_id AND p.organization_id=NEW.organization_id) THEN RAISE EXCEPTION 'Fremde Einkaufsorganisation';END IF;
 END IF;
 IF TG_TABLE_NAME IN ('purchasing_group_assignments','buyer_group_members') THEN
  IF NOT EXISTS(SELECT 1 FROM buyer_groups g WHERE g.tenant_id=NEW.tenant_id AND g.id=NEW.buyer_group_id AND g.organization_id=NEW.organization_id) THEN RAISE EXCEPTION 'Fremde Einkäufergruppe';END IF;
 END IF;
 IF TG_TABLE_NAME='purchasing_plant_assignments' THEN IF NOT EXISTS(SELECT 1 FROM purchasing_organizations p JOIN plants l ON l.tenant_id=p.tenant_id AND l.company_id=p.company_id WHERE p.tenant_id=NEW.tenant_id AND p.id=NEW.purchasing_organization_id AND l.id=NEW.plant_id) THEN RAISE EXCEPTION 'Werk gehört nicht zum Einkaufsbuchungskreis';END IF;END IF;
 IF TG_TABLE_NAME='buyer_group_members' THEN IF NEW.active AND NOT EXISTS(SELECT 1 FROM users u JOIN user_organizations o ON o.tenant_id=u.tenant_id AND o.user_id=u.id WHERE u.tenant_id=NEW.tenant_id AND u.id=NEW.user_id AND u.active AND u.role IN ('BUYER','PURCHASING_MANAGER') AND o.organization_id=NEW.organization_id) THEN RAISE EXCEPTION 'Aktiver Einkäufer oder Einkaufsleiter derselben Organisation erforderlich';END IF;END IF;
 RETURN NEW;
END$$;
DO $$DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['purchasing_organizations','buyer_groups','purchasing_group_assignments','purchasing_plant_assignments','buyer_group_members'] LOOP
 EXECUTE format('CREATE TRIGGER purchasing_master_guard BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION purchasing_master_guard()',t);
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid) WITH CHECK (tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid)',t);
 END LOOP;
END$$;
ALTER TABLE purchase_orders ADD COLUMN purchasing_organization_id uuid,ADD COLUMN buyer_group_id uuid,ADD COLUMN organization_snapshot jsonb,
 ADD FOREIGN KEY(tenant_id,purchasing_organization_id) REFERENCES purchasing_organizations(tenant_id,id),ADD FOREIGN KEY(tenant_id,buyer_group_id) REFERENCES buyer_groups(tenant_id,id),
 ADD CHECK((purchasing_organization_id IS NULL AND buyer_group_id IS NULL AND organization_snapshot IS NULL) OR (purchasing_organization_id IS NOT NULL AND buyer_group_id IS NOT NULL AND organization_snapshot IS NOT NULL AND jsonb_typeof(organization_snapshot)='object'));
ALTER TABLE purchase_order_items ADD COLUMN receiving_plant_id uuid,ADD COLUMN plant_snapshot jsonb,
 ADD FOREIGN KEY(tenant_id,receiving_plant_id) REFERENCES plants(tenant_id,id),ADD CHECK((receiving_plant_id IS NULL)=(plant_snapshot IS NULL));
CREATE FUNCTION purchasing_order_guard() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE p purchasing_organizations;g buyer_groups;BEGIN
 IF TG_OP='INSERT' AND NEW.purchasing_organization_id IS NULL AND EXISTS(SELECT 1 FROM purchasing_organizations WHERE tenant_id=NEW.tenant_id AND company_id=NEW.company_id) THEN RAISE EXCEPTION 'Einkaufsorganisation und Einkäufergruppe für neue Bestellung erforderlich';END IF;
 IF NEW.purchasing_organization_id IS NULL THEN RETURN NEW;END IF;
 IF TG_OP='UPDATE' AND NOT ((NEW.status='IN_REVIEW' OR NEW.status='RELEASED' AND OLD.status='IN_REVIEW') AND NEW.status IS DISTINCT FROM OLD.status) THEN RETURN NEW;END IF;
 SELECT * INTO p FROM purchasing_organizations WHERE tenant_id=NEW.tenant_id AND id=NEW.purchasing_organization_id;
 SELECT * INTO g FROM buyer_groups WHERE tenant_id=NEW.tenant_id AND id=NEW.buyer_group_id;
 IF NOT coalesce(p.active AND g.active,false) OR p.company_id<>NEW.company_id OR g.organization_id<>p.organization_id OR NOT EXISTS(SELECT 1 FROM documents WHERE tenant_id=NEW.tenant_id AND id=NEW.id AND organization_id=p.organization_id) OR NOT EXISTS(SELECT 1 FROM purchasing_group_assignments WHERE tenant_id=NEW.tenant_id AND purchasing_organization_id=p.id AND buyer_group_id=g.id AND active) THEN RAISE EXCEPTION 'Aktive passende Einkaufsorganisation und zugeordnete Einkäufergruppe erforderlich';END IF;
 IF TG_OP='INSERT' AND NEW.organization_snapshot IS DISTINCT FROM jsonb_build_object('purchasingOrganizationId',p.id,'purchasingOrganizationCode',p.code,'purchasingOrganizationName',p.name,'purchasingOrganizationVersion',p.version,'buyerGroupId',g.id,'buyerGroupCode',g.code,'buyerGroupName',g.name,'buyerGroupVersion',g.version) THEN RAISE EXCEPTION 'Einkaufssnapshot stimmt nicht mit tatsächlicher Zuordnung überein';END IF;
 IF TG_OP='UPDATE' AND EXISTS(SELECT 1 FROM purchase_order_items i WHERE i.tenant_id=NEW.tenant_id AND i.purchase_order_id=NEW.id AND NOT EXISTS(SELECT 1 FROM purchasing_plant_assignments a WHERE a.tenant_id=i.tenant_id AND a.purchasing_organization_id=p.id AND a.plant_id=i.receiving_plant_id AND a.active)) THEN RAISE EXCEPTION 'Empfangswerk ist nicht mehr für Einkauf zugeordnet';END IF;
 RETURN NEW;
END$$;
CREATE TRIGGER purchasing_order_guard BEFORE INSERT OR UPDATE ON purchase_orders FOR EACH ROW EXECUTE FUNCTION purchasing_order_guard();
CREATE FUNCTION purchasing_item_guard() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE h purchase_orders;p plants;BEGIN
 SELECT * INTO STRICT h FROM purchase_orders WHERE tenant_id=NEW.tenant_id AND id=NEW.purchase_order_id;
 IF h.purchasing_organization_id IS NULL THEN
  IF NEW.receiving_plant_id IS NOT NULL THEN RAISE EXCEPTION 'Werkzuordnung benötigt konfigurierte Einkaufsorganisation';END IF;
 ELSE
  SELECT * INTO p FROM plants WHERE tenant_id=NEW.tenant_id AND id=NEW.receiving_plant_id AND company_id=h.company_id;
  IF p.id IS NULL OR NOT EXISTS(SELECT 1 FROM purchasing_plant_assignments WHERE tenant_id=NEW.tenant_id AND purchasing_organization_id=h.purchasing_organization_id AND plant_id=p.id AND active) OR NEW.plant_snapshot IS DISTINCT FROM jsonb_build_object('id',p.id,'code',p.code,'name',p.name) THEN RAISE EXCEPTION 'Bestellposition benötigt tatsächliches zugeordnetes Empfangswerk mit Originalstand';END IF;
 END IF;RETURN NEW;
END$$;
CREATE TRIGGER purchasing_item_guard BEFORE INSERT ON purchase_order_items FOR EACH ROW EXECUTE FUNCTION purchasing_item_guard();
CREATE FUNCTION purchasing_receipt_plant_guard() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE plant uuid;BEGIN
 SELECT receiving_plant_id INTO plant FROM purchase_order_items WHERE tenant_id=NEW.tenant_id AND id=NEW.purchase_order_item_id;
 IF plant IS NOT NULL AND NOT EXISTS(SELECT 1 FROM storage_locations WHERE tenant_id=NEW.tenant_id AND id=NEW.location_id AND plant_id=plant) THEN RAISE EXCEPTION 'Wareneingang benötigt Lagerort des bestellten Empfangswerks';END IF;RETURN NEW;
END$$;
CREATE TRIGGER purchasing_receipt_plant_guard BEFORE INSERT ON goods_receipt_items FOR EACH ROW EXECUTE FUNCTION purchasing_receipt_plant_guard();
-- Check after insertion of all positions, without allowing an empty configured PO.
CREATE FUNCTION purchasing_complete_order_guard() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
 IF NEW.purchasing_organization_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM purchase_order_items WHERE tenant_id=NEW.tenant_id AND purchase_order_id=NEW.id) THEN RAISE EXCEPTION 'Konfigurierte Bestellung benötigt tatsächliche Positionen mit Empfangswerk';END IF;RETURN NULL;
END$$;
CREATE CONSTRAINT TRIGGER purchasing_complete_order_guard AFTER INSERT ON purchase_orders DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION purchasing_complete_order_guard();
