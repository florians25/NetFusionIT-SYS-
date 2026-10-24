ALTER TABLE ticket_links DROP CONSTRAINT ticket_links_kind_check;
ALTER TABLE ticket_links ADD CONSTRAINT ticket_links_kind_check CHECK(kind IN('RELATED','PARENT','DUPLICATE','PROBLEM','FOLLOW_UP'));
CREATE TABLE service_playbooks(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,organization_id uuid NOT NULL,kind text NOT NULL CHECK(kind IN('TICKET','CHECKLIST')),name text NOT NULL,revision integer NOT NULL CHECK(revision>0),definition jsonb NOT NULL CHECK(jsonb_typeof(definition)='object'),status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN('DRAFT','ACTIVE','RETIRED')),version integer NOT NULL DEFAULT 1,previous_id uuid,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,organization_id,kind,name,revision),UNIQUE(tenant_id,previous_id),FOREIGN KEY(tenant_id,organization_id) REFERENCES organizations(tenant_id,id),FOREIGN KEY(tenant_id,created_by) REFERENCES users(tenant_id,id),FOREIGN KEY(tenant_id,previous_id) REFERENCES service_playbooks(tenant_id,id)
);
CREATE TABLE knowledge_articles(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,organization_id uuid NOT NULL,kind text NOT NULL CHECK(kind IN('HOWTO','KNOWN_ERROR')),title text NOT NULL,symptom text NOT NULL,cause text NOT NULL,solution text NOT NULL,workaround text NOT NULL DEFAULT '',revision integer NOT NULL CHECK(revision>0),status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN('DRAFT','PUBLISHED','RETIRED')),version integer NOT NULL DEFAULT 1,previous_id uuid,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,previous_id),FOREIGN KEY(tenant_id,organization_id) REFERENCES organizations(tenant_id,id),FOREIGN KEY(tenant_id,created_by) REFERENCES users(tenant_id,id),FOREIGN KEY(tenant_id,previous_id) REFERENCES knowledge_articles(tenant_id,id)
);
CREATE FUNCTION service_library_frozen() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Vorlagen- und Wissenshistorie bleibt erhalten';END IF;
 IF (to_jsonb(NEW)-ARRAY['name','title','definition','symptom','cause','solution','workaround','status','version','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['name','title','definition','symptom','cause','solution','workaround','status','version','updated_at']) OR NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'Bibliotheksidentität und Version sind verbindlich';END IF;
 IF OLD.status<>'DRAFT' AND ((to_jsonb(NEW)-ARRAY['status','version','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','version','updated_at']) OR NEW.status<>'RETIRED' OR OLD.status='RETIRED') THEN RAISE EXCEPTION 'Veröffentlichter Inhalt bleibt unveränderlich; neue Revision anlegen';END IF;
 RETURN NEW;END;$$;
CREATE TRIGGER playbook_frozen BEFORE UPDATE OR DELETE ON service_playbooks FOR EACH ROW EXECUTE FUNCTION service_library_frozen();
CREATE TRIGGER knowledge_frozen BEFORE UPDATE OR DELETE ON knowledge_articles FOR EACH ROW EXECUTE FUNCTION service_library_frozen();
CREATE TABLE ticket_watchers(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,ticket_id uuid NOT NULL,user_id uuid NOT NULL,added_by uuid NOT NULL,added_at timestamptz NOT NULL DEFAULT now(),removed_by uuid,removed_at timestamptz,CHECK((removed_by IS NULL)=(removed_at IS NULL)),
 FOREIGN KEY(tenant_id,ticket_id) REFERENCES tickets(tenant_id,id),FOREIGN KEY(tenant_id,user_id) REFERENCES users(tenant_id,id),FOREIGN KEY(tenant_id,added_by) REFERENCES users(tenant_id,id),FOREIGN KEY(tenant_id,removed_by) REFERENCES users(tenant_id,id)
);
CREATE UNIQUE INDEX one_active_ticket_watcher ON ticket_watchers(tenant_id,ticket_id,user_id) WHERE removed_at IS NULL;
CREATE FUNCTION ticket_watcher_guard() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Beobachterhistorie bleibt erhalten';END IF;
 IF TG_OP='INSERT' THEN IF NOT EXISTS(SELECT 1 FROM users u JOIN user_organizations uo ON uo.tenant_id=u.tenant_id AND uo.user_id=u.id JOIN documents d ON d.tenant_id=uo.tenant_id AND d.organization_id=uo.organization_id WHERE d.tenant_id=NEW.tenant_id AND d.id=NEW.ticket_id AND u.id=NEW.user_id AND u.active AND u.role<>'CUSTOMER') THEN RAISE EXCEPTION 'Aktiven internen Beobachter der Ticketorganisation wählen';END IF;
 ELSE IF OLD.removed_at IS NOT NULL OR NEW.removed_at IS NULL OR (to_jsonb(NEW)-ARRAY['removed_by','removed_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['removed_by','removed_at']) THEN RAISE EXCEPTION 'Beobachterhistorie nicht überschreiben';END IF;END IF;RETURN NEW;END;$$;
CREATE TRIGGER watcher_guard BEFORE INSERT OR UPDATE OR DELETE ON ticket_watchers FOR EACH ROW EXECUTE FUNCTION ticket_watcher_guard();
CREATE TABLE task_checklists(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,task_id uuid NOT NULL,template_id uuid NOT NULL,snapshot jsonb NOT NULL,assigned_by uuid NOT NULL,assigned_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,task_id,template_id),FOREIGN KEY(tenant_id,task_id) REFERENCES work_order_tasks(tenant_id,id),FOREIGN KEY(tenant_id,template_id) REFERENCES service_playbooks(tenant_id,id),FOREIGN KEY(tenant_id,assigned_by) REFERENCES users(tenant_id,id)
);
CREATE TABLE task_checklist_items(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,checklist_id uuid NOT NULL,position integer NOT NULL CHECK(position>0),title text NOT NULL,mandatory boolean NOT NULL,checked boolean NOT NULL DEFAULT false,note text NOT NULL DEFAULT '',checked_by uuid,checked_at timestamptz,version integer NOT NULL DEFAULT 1,
 CHECK(checked=(checked_by IS NOT NULL) AND checked=(checked_at IS NOT NULL)),UNIQUE(tenant_id,id),UNIQUE(tenant_id,checklist_id,position),FOREIGN KEY(tenant_id,checklist_id) REFERENCES task_checklists(tenant_id,id),FOREIGN KEY(tenant_id,checked_by) REFERENCES users(tenant_id,id)
);
CREATE TABLE task_checklist_events(id uuid PRIMARY KEY,tenant_id uuid NOT NULL,item_id uuid NOT NULL,actor_id uuid NOT NULL,checked boolean NOT NULL,note text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(tenant_id,item_id) REFERENCES task_checklist_items(tenant_id,id),FOREIGN KEY(tenant_id,actor_id) REFERENCES users(tenant_id,id));
CREATE TRIGGER checklist_event_immutable BEFORE UPDATE OR DELETE ON task_checklist_events FOR EACH ROW EXECUTE FUNCTION reject_attachment_mutation();
CREATE FUNCTION checklist_assignment_guard() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE w work_order_tasks;p service_playbooks;org uuid;BEGIN
 SELECT * INTO w FROM work_order_tasks WHERE tenant_id=NEW.tenant_id AND id=NEW.task_id FOR UPDATE;SELECT organization_id INTO org FROM documents WHERE tenant_id=w.tenant_id AND id=w.ticket_id;
 SELECT * INTO p FROM service_playbooks WHERE tenant_id=NEW.tenant_id AND id=NEW.template_id;
 IF w.id IS NULL OR w.status NOT IN('OPEN','IN_PROGRESS') OR p.kind<>'CHECKLIST' OR p.status<>'ACTIVE' OR p.organization_id<>org OR NEW.snapshot IS DISTINCT FROM jsonb_build_object('name',p.name,'revision',p.revision,'items',p.definition->'items') THEN RAISE EXCEPTION 'Aktive Checkliste und ursprünglicher Aufgaben-/Organisationsstand erforderlich';END IF;RETURN NEW;END;$$;
CREATE TRIGGER checklist_assignment_guard BEFORE INSERT ON task_checklists FOR EACH ROW EXECUTE FUNCTION checklist_assignment_guard();
CREATE TRIGGER checklist_assignment_immutable BEFORE UPDATE OR DELETE ON task_checklists FOR EACH ROW EXECUTE FUNCTION reject_attachment_mutation();
CREATE FUNCTION checklist_items_consistent() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE parent uuid;s jsonb;n integer;BEGIN
 IF TG_TABLE_NAME='task_checklists' THEN parent=NEW.id;ELSE parent=NEW.checklist_id;END IF;
 SELECT snapshot INTO s FROM task_checklists WHERE tenant_id=NEW.tenant_id AND id=parent;n=jsonb_array_length(s->'items');
 IF n NOT BETWEEN 1 AND 100 OR (SELECT count(*) FROM task_checklist_items WHERE tenant_id=NEW.tenant_id AND checklist_id=parent)<>n OR EXISTS(SELECT 1 FROM jsonb_array_elements(s->'items') WITH ORDINALITY e(value,nr) LEFT JOIN task_checklist_items i ON i.tenant_id=NEW.tenant_id AND i.checklist_id=parent AND i.position=e.nr WHERE i.id IS NULL OR i.title IS DISTINCT FROM e.value->>'title' OR i.mandatory IS DISTINCT FROM (e.value->>'mandatory')::boolean) THEN RAISE EXCEPTION 'Alle ursprünglichen Checklistenpunkte müssen unverändert übernommen werden';END IF;RETURN NULL;END;$$;
CREATE CONSTRAINT TRIGGER checklist_complete_snapshot AFTER INSERT ON task_checklists DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION checklist_items_consistent();
CREATE CONSTRAINT TRIGGER checklist_item_complete_snapshot AFTER INSERT OR UPDATE ON task_checklist_items DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION checklist_items_consistent();
CREATE FUNCTION checklist_item_guard() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE w work_order_tasks;BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Checklistenpunkte bleiben erhalten';END IF;
 SELECT t.* INTO w FROM work_order_tasks t JOIN task_checklists c ON c.tenant_id=t.tenant_id AND c.task_id=t.id WHERE c.tenant_id=NEW.tenant_id AND c.id=NEW.checklist_id FOR UPDATE OF t;
 IF w.id IS NULL OR w.status NOT IN('OPEN','IN_PROGRESS') THEN RAISE EXCEPTION 'Abgeschlossene Aufgabencheckliste bleibt unveränderlich';END IF;
 IF TG_OP='UPDATE' THEN IF (to_jsonb(NEW)-ARRAY['checked','note','checked_by','checked_at','version']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['checked','note','checked_by','checked_at','version']) OR NEW.version<>OLD.version+1 OR (NEW.checked AND NEW.checked_by<>w.worker_id) THEN RAISE EXCEPTION 'Nur ursprünglichen Punkt mit aktuellem Aufgabenbearbeiter bestätigen';END IF;END IF;RETURN NEW;END;$$;
CREATE TRIGGER checklist_item_guard BEFORE INSERT OR UPDATE OR DELETE ON task_checklist_items FOR EACH ROW EXECUTE FUNCTION checklist_item_guard();
CREATE FUNCTION required_task_checklist() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
 IF NEW.status='COMPLETED' AND OLD.status<>'COMPLETED' AND EXISTS(SELECT 1 FROM task_checklists c JOIN task_checklist_items i ON i.tenant_id=c.tenant_id AND i.checklist_id=c.id WHERE c.tenant_id=NEW.tenant_id AND c.task_id=NEW.id AND i.mandatory AND NOT i.checked) THEN RAISE EXCEPTION 'Offene Pflichtpunkte verhindern den WOT-Abschluss';END IF;RETURN NEW;END;$$;
CREATE TRIGGER required_task_checklist BEFORE UPDATE ON work_order_tasks FOR EACH ROW EXECUTE FUNCTION required_task_checklist();
CREATE TABLE ticket_knowledge_links(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,ticket_id uuid NOT NULL,article_id uuid NOT NULL,snapshot jsonb NOT NULL,adopted boolean NOT NULL,note text NOT NULL,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,ticket_id,article_id),FOREIGN KEY(tenant_id,ticket_id) REFERENCES tickets(tenant_id,id),FOREIGN KEY(tenant_id,article_id) REFERENCES knowledge_articles(tenant_id,id),FOREIGN KEY(tenant_id,created_by) REFERENCES users(tenant_id,id)
);
CREATE TRIGGER ticket_knowledge_immutable BEFORE UPDATE OR DELETE ON ticket_knowledge_links FOR EACH ROW EXECUTE FUNCTION reject_attachment_mutation();
CREATE TABLE crm_activities(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,partner_id uuid NOT NULL,kind text NOT NULL CHECK(kind IN('CALL','MEETING','TODO','EMAIL')),subject text NOT NULL,description text NOT NULL,responsible_id uuid NOT NULL,due_at timestamptz NOT NULL,status text NOT NULL DEFAULT 'OPEN' CHECK(status IN('OPEN','DONE','CANCELLED')),version integer NOT NULL DEFAULT 1,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id),FOREIGN KEY(tenant_id,partner_id) REFERENCES business_partners(tenant_id,id),FOREIGN KEY(tenant_id,responsible_id) REFERENCES users(tenant_id,id),FOREIGN KEY(tenant_id,created_by) REFERENCES users(tenant_id,id)
);
CREATE TABLE crm_activity_events(id uuid PRIMARY KEY,tenant_id uuid NOT NULL,activity_id uuid NOT NULL,actor_id uuid NOT NULL,status text NOT NULL,note text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(tenant_id,activity_id) REFERENCES crm_activities(tenant_id,id),FOREIGN KEY(tenant_id,actor_id) REFERENCES users(tenant_id,id));
CREATE TRIGGER crm_activity_event_immutable BEFORE UPDATE OR DELETE ON crm_activity_events FOR EACH ROW EXECUTE FUNCTION reject_attachment_mutation();
CREATE FUNCTION crm_activity_guard() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'CRM-Aktivitätenhistorie bleibt erhalten';END IF;
 IF OLD.status<>'OPEN' OR NEW.version<>OLD.version+1 OR (to_jsonb(NEW)-ARRAY['status','version','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','version','updated_at']) THEN RAISE EXCEPTION 'Aktivität nur nachvollziehbar abschließen oder verwerfen';END IF;RETURN NEW;END;$$;
CREATE TRIGGER crm_activity_guard BEFORE UPDATE OR DELETE ON crm_activities FOR EACH ROW EXECUTE FUNCTION crm_activity_guard();
DO $$DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['service_playbooks','knowledge_articles','ticket_watchers','task_checklists','task_checklist_items','task_checklist_events','ticket_knowledge_links','crm_activities','crm_activity_events'] LOOP EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);EXECUTE format('CREATE POLICY tenant_isolation ON %I USING(tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid) WITH CHECK(tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid)',t);END LOOP;END;$$;
CREATE INDEX playbook_organization ON service_playbooks(tenant_id,organization_id,kind,status);
CREATE INDEX knowledge_organization ON knowledge_articles(tenant_id,organization_id,status);
CREATE INDEX checklist_task ON task_checklists(tenant_id,task_id);
CREATE INDEX crm_activity_partner ON crm_activities(tenant_id,partner_id,due_at);
