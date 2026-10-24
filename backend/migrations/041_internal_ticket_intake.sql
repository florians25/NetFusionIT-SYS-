-- Internal operational context; no commercial, inventory or billing mutation.
CREATE TABLE ticket_intakes(
 ticket_id uuid PRIMARY KEY,tenant_id uuid NOT NULL,contact_id uuid,address_id uuid,data jsonb NOT NULL,updated_by uuid NOT NULL,updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(jsonb_typeof(data)='object'),CHECK(data ?& ARRAY['channel','category','impact','urgency','affectedUsers','priorityOverride','priorityReason']),
 CHECK(data->>'channel' IN('PHONE','EMAIL','INTERNAL','MONITORING','ON_SITE')),CHECK(data->>'category' IN('HARDWARE','SOFTWARE','NETWORK','IDENTITY','SECURITY','CLOUD','BACKUP','WORKPLACE','OTHER')),CHECK(data->>'impact' IN('PERSON','TEAM','SITE','COMPANY')),CHECK(data->>'urgency' IN('LOW','NORMAL','HIGH','IMMEDIATE')),CHECK((data->>'affectedUsers')::integer BETWEEN 0 AND 1000000),
 CHECK(data->>'priorityOverride' IS NULL OR (data->>'priorityOverride' IN('LOW','MEDIUM','HIGH','CRITICAL') AND length(trim(data->>'priorityReason'))>=15)),
 CHECK(data-ARRAY['channel','category','subcategory','impact','urgency','affectedUsers','startedAt','location','environment','errorCode','reproductionSteps','businessImpact','workaround','internalSummary','followUpOn','priorityOverride','priorityReason']='{}'::jsonb),
 FOREIGN KEY(tenant_id,ticket_id) REFERENCES tickets(tenant_id,id),FOREIGN KEY(tenant_id,contact_id) REFERENCES partner_contacts(tenant_id,id),FOREIGN KEY(tenant_id,address_id) REFERENCES partner_addresses(tenant_id,id),FOREIGN KEY(tenant_id,updated_by) REFERENCES users(tenant_id,id)
);
CREATE TABLE ticket_asset_links(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,ticket_id uuid NOT NULL,object_id uuid NOT NULL,added_by uuid NOT NULL,added_at timestamptz NOT NULL DEFAULT now(),removed_by uuid,removed_at timestamptz,
 CHECK((removed_by IS NULL)=(removed_at IS NULL)),FOREIGN KEY(tenant_id,ticket_id) REFERENCES tickets(tenant_id,id),FOREIGN KEY(tenant_id,object_id) REFERENCES technical_objects(tenant_id,id),FOREIGN KEY(tenant_id,added_by) REFERENCES users(tenant_id,id),FOREIGN KEY(tenant_id,removed_by) REFERENCES users(tenant_id,id)
);
CREATE UNIQUE INDEX ticket_active_asset ON ticket_asset_links(tenant_id,ticket_id,object_id) WHERE removed_at IS NULL;
INSERT INTO ticket_asset_links(id,tenant_id,ticket_id,object_id,added_by)
 SELECT gen_random_uuid(),t.tenant_id,t.id,co.object_id,d.created_by FROM tickets t JOIN documents d ON d.tenant_id=t.tenant_id AND d.id=t.id JOIN case_objects co ON co.tenant_id=t.tenant_id AND co.case_id=t.case_id;
DO $$DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['ticket_intakes','ticket_asset_links'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);EXECUTE format('CREATE POLICY tenant_isolation ON %I USING(tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid) WITH CHECK(tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid)',t);
END LOOP;END$$;
CREATE FUNCTION internal_ticket_context_guard() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE t tickets;org uuid;BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Ticketkontext und Assetzuordnung behalten ihren Verlauf';END IF;
 IF TG_OP='UPDATE' THEN
  IF TG_TABLE_NAME='ticket_asset_links' THEN IF OLD.removed_at IS NOT NULL OR (to_jsonb(NEW)-ARRAY['removed_by','removed_at']) IS DISTINCT FROM(to_jsonb(OLD)-ARRAY['removed_by','removed_at']) THEN RAISE EXCEPTION 'Assetzuordnung bleibt erhalten; nur begründet lösen';END IF;END IF;
  IF (NEW.tenant_id,NEW.ticket_id) IS DISTINCT FROM(OLD.tenant_id,OLD.ticket_id) THEN RAISE EXCEPTION 'Ticketzuordnung bleibt unveränderlich';END IF;
 END IF;
 SELECT * INTO STRICT t FROM tickets WHERE tenant_id=NEW.tenant_id AND id=NEW.ticket_id FOR UPDATE;
 SELECT organization_id INTO org FROM documents WHERE tenant_id=t.tenant_id AND id=t.id;
 IF t.status IN('CLOSED','CANCELLED','COMMERCIALLY_CLOSED') THEN RAISE EXCEPTION 'Abgeschlossenen Ticketkontext nicht verändern';END IF;
 IF TG_TABLE_NAME='ticket_asset_links' THEN
  IF NOT EXISTS(SELECT 1 FROM technical_objects a JOIN documents d ON d.tenant_id=a.tenant_id AND d.id=a.id WHERE a.tenant_id=t.tenant_id AND a.id=NEW.object_id AND a.partner_id=t.partner_id AND d.organization_id=org AND (TG_OP='UPDATE' OR a.status='ACTIVE')) THEN RAISE EXCEPTION 'Aktives Asset desselben Kunden und derselben Organisation erforderlich';END IF;
 ELSE
  IF NEW.contact_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM partner_contacts p WHERE p.tenant_id=t.tenant_id AND p.id=NEW.contact_id AND p.partner_id=t.partner_id) THEN RAISE EXCEPTION 'Ansprechpartner gehört nicht zum Ticketkunden';END IF;
  IF NEW.address_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM partner_addresses a WHERE a.tenant_id=t.tenant_id AND a.id=NEW.address_id AND a.partner_id=t.partner_id) THEN RAISE EXCEPTION 'Standortadresse gehört nicht zum Ticketkunden';END IF;
 END IF;RETURN NEW;
END$$;
CREATE TRIGGER ticket_intake_guard BEFORE INSERT OR UPDATE OR DELETE ON ticket_intakes FOR EACH ROW EXECUTE FUNCTION internal_ticket_context_guard();
CREATE TRIGGER ticket_asset_guard BEFORE INSERT OR UPDATE OR DELETE ON ticket_asset_links FOR EACH ROW EXECUTE FUNCTION internal_ticket_context_guard();
