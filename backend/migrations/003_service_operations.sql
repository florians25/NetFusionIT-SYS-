CREATE TABLE service_calendars (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,organization_id uuid NOT NULL,name text NOT NULL,time_zone text NOT NULL,weekly jsonb NOT NULL,holidays jsonb NOT NULL DEFAULT '[]',version integer NOT NULL DEFAULT 1,
 UNIQUE(tenant_id,id),FOREIGN KEY(tenant_id,organization_id) REFERENCES organizations(tenant_id,id)
);
CREATE TABLE sla_policies (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,organization_id uuid NOT NULL,calendar_id uuid NOT NULL,name text NOT NULL,response_minutes integer NOT NULL CHECK(response_minutes>0),resolution_minutes integer NOT NULL CHECK(resolution_minutes>=response_minutes),pause_statuses text[] NOT NULL DEFAULT '{}',version integer NOT NULL DEFAULT 1,active boolean NOT NULL DEFAULT true,
 UNIQUE(tenant_id,id),FOREIGN KEY(tenant_id,organization_id) REFERENCES organizations(tenant_id,id),FOREIGN KEY(tenant_id,calendar_id) REFERENCES service_calendars(tenant_id,id)
);
CREATE TABLE service_contracts (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,partner_id uuid NOT NULL,name text NOT NULL,kind text NOT NULL CHECK(kind IN ('MANAGED','MAINTENANCE','HOURS','FLATRATE','SLA','WARRANTY','SINGLE')),status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','ACTIVE','BLOCKED','EXPIRED')),valid_from date NOT NULL,valid_to date NOT NULL,sla_policy_id uuid,scope text NOT NULL,version integer NOT NULL DEFAULT 1,CHECK(valid_to>=valid_from),
 UNIQUE(tenant_id,id),FOREIGN KEY(tenant_id,id) REFERENCES documents(tenant_id,id),FOREIGN KEY(tenant_id,partner_id) REFERENCES business_partners(tenant_id,id),FOREIGN KEY(tenant_id,sla_policy_id) REFERENCES sla_policies(tenant_id,id)
);
ALTER TABLE tickets ADD COLUMN contract_id uuid;
ALTER TABLE tickets ADD CONSTRAINT ticket_contract FOREIGN KEY(tenant_id,contract_id) REFERENCES service_contracts(tenant_id,id);
CREATE TABLE technical_objects (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,partner_id uuid NOT NULL,name text NOT NULL,kind text NOT NULL CHECK(kind IN ('SERVER','NOTEBOOK','PC','NETWORK','FIREWALL','PRINTER','SOFTWARE','LICENSE','INFRASTRUCTURE','OTHER')),manufacturer text NOT NULL DEFAULT '',model text NOT NULL DEFAULT '',serial_number text NOT NULL DEFAULT '',inventory_number text NOT NULL DEFAULT '',location text NOT NULL DEFAULT '',installed_on date,warranty_until date,parent_id uuid,contract_id uuid,status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','BLOCKED','RETIRED')),version integer NOT NULL DEFAULT 1,
 UNIQUE(tenant_id,id),FOREIGN KEY(tenant_id,id) REFERENCES documents(tenant_id,id),FOREIGN KEY(tenant_id,partner_id) REFERENCES business_partners(tenant_id,id),FOREIGN KEY(tenant_id,parent_id) REFERENCES technical_objects(tenant_id,id),FOREIGN KEY(tenant_id,contract_id) REFERENCES service_contracts(tenant_id,id),CHECK(parent_id IS NULL OR parent_id<>id)
);
CREATE UNIQUE INDEX asset_serial ON technical_objects(tenant_id,manufacturer,serial_number) WHERE serial_number<>'';
CREATE TABLE case_objects (
 tenant_id uuid NOT NULL,case_id uuid NOT NULL,object_id uuid NOT NULL,PRIMARY KEY(tenant_id,case_id,object_id),FOREIGN KEY(tenant_id,case_id) REFERENCES service_cases(tenant_id,id),FOREIGN KEY(tenant_id,object_id) REFERENCES technical_objects(tenant_id,id)
);
CREATE TABLE ticket_sla (
 tenant_id uuid NOT NULL,ticket_id uuid NOT NULL,contract_id uuid NOT NULL,snapshot jsonb NOT NULL,response_due timestamptz NOT NULL,resolution_due timestamptz NOT NULL,responded_at timestamptz,resolved_at timestamptz,terminated_at timestamptz,paused_at timestamptz,version integer NOT NULL DEFAULT 1,
 PRIMARY KEY(tenant_id,ticket_id),FOREIGN KEY(tenant_id,ticket_id) REFERENCES tickets(tenant_id,id),FOREIGN KEY(tenant_id,contract_id) REFERENCES service_contracts(tenant_id,id)
);
CREATE TABLE sla_events (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,ticket_id uuid NOT NULL,kind text NOT NULL,deadline_type text NOT NULL DEFAULT '',due_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),details jsonb NOT NULL DEFAULT '{}',
 FOREIGN KEY(tenant_id,ticket_id) REFERENCES tickets(tenant_id,id)
);
CREATE UNIQUE INDEX one_sla_breach ON sla_events(tenant_id,ticket_id,deadline_type) WHERE kind='BREACH';
ALTER TABLE technicians ADD COLUMN calendar_id uuid;
ALTER TABLE technicians ADD COLUMN location text NOT NULL DEFAULT '';
ALTER TABLE technicians ADD COLUMN certifications jsonb NOT NULL DEFAULT '[]';
ALTER TABLE technicians ADD COLUMN version integer NOT NULL DEFAULT 1;
ALTER TABLE technicians ADD CONSTRAINT technician_calendar FOREIGN KEY(tenant_id,calendar_id) REFERENCES service_calendars(tenant_id,id);
CREATE TABLE technician_absences (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,technician_id uuid NOT NULL,starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL,reason text NOT NULL,CHECK(ends_at>starts_at),
 FOREIGN KEY(tenant_id,technician_id) REFERENCES technicians(tenant_id,id)
);
CREATE TABLE field_visits (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,case_id uuid NOT NULL,title text NOT NULL,location text NOT NULL,starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL,status text NOT NULL DEFAULT 'PLANNED' CHECK(status IN ('PLANNED','ASSIGNED','CONFIRMED','TRAVELING','ONSITE','IN_PROGRESS','INTERRUPTED','TECHNICALLY_COMPLETED','ACCEPTED','CANCELLED')),required_skills text[] NOT NULL DEFAULT '{}',version integer NOT NULL DEFAULT 1,CHECK(ends_at>starts_at),
 UNIQUE(tenant_id,id),FOREIGN KEY(tenant_id,id) REFERENCES documents(tenant_id,id),FOREIGN KEY(tenant_id,case_id) REFERENCES service_cases(tenant_id,id)
);
CREATE TABLE visit_technicians (
 tenant_id uuid NOT NULL,visit_id uuid NOT NULL,technician_id uuid NOT NULL,PRIMARY KEY(tenant_id,visit_id,technician_id),FOREIGN KEY(tenant_id,visit_id) REFERENCES field_visits(tenant_id,id),FOREIGN KEY(tenant_id,technician_id) REFERENCES technicians(tenant_id,id)
);
CREATE INDEX visits_period ON field_visits(tenant_id,starts_at,ends_at);
DO $$DECLARE t text;BEGIN
FOREACH t IN ARRAY ARRAY['service_calendars','sla_policies','service_contracts','technical_objects','case_objects','ticket_sla','sla_events','technician_absences','field_visits','visit_technicians'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid) WITH CHECK (tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid)',t);
END LOOP;END $$;
CREATE TRIGGER sla_immutable BEFORE UPDATE OR DELETE ON sla_events FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();
