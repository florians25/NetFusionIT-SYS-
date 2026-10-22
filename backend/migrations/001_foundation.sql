CREATE TABLE tenants (
 id uuid PRIMARY KEY, slug text NOT NULL UNIQUE CHECK(slug ~ '^[a-z0-9-]{2,48}$'), name text NOT NULL
);
CREATE TABLE organizations (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id), name text NOT NULL,
 kind text NOT NULL, parent_id uuid, UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,parent_id) REFERENCES organizations(tenant_id,id)
);
CREATE TABLE business_partners (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id), organization_id uuid NOT NULL,
 number text NOT NULL, name text NOT NULL, email text NOT NULL,
 status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','BLOCKED')),
 created_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1,
 UNIQUE(tenant_id,id), UNIQUE(tenant_id,number),
 FOREIGN KEY(tenant_id,organization_id) REFERENCES organizations(tenant_id,id)
);
CREATE TABLE users (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id), email text NOT NULL,
 name text NOT NULL, password_hash text NOT NULL,
 role text NOT NULL CHECK(role IN ('ADMIN','DISPATCHER','SUPPORT','TECHNICIAN','CUSTOMER')),
 active boolean NOT NULL DEFAULT true, partner_id uuid, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id), UNIQUE(tenant_id,email),
 FOREIGN KEY(tenant_id,partner_id) REFERENCES business_partners(tenant_id,id),
 CHECK(role <> 'CUSTOMER' OR partner_id IS NOT NULL)
);
CREATE TABLE user_organizations (
 tenant_id uuid NOT NULL, user_id uuid NOT NULL, organization_id uuid NOT NULL,
 PRIMARY KEY(tenant_id,user_id,organization_id),
 FOREIGN KEY(tenant_id,user_id) REFERENCES users(tenant_id,id),
 FOREIGN KEY(tenant_id,organization_id) REFERENCES organizations(tenant_id,id)
);
CREATE TABLE technicians (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL, user_id uuid NOT NULL, organization_id uuid NOT NULL,
 name text NOT NULL, skills text[] NOT NULL DEFAULT '{}', active boolean NOT NULL DEFAULT true,
 UNIQUE(tenant_id,id), UNIQUE(tenant_id,user_id),
 FOREIGN KEY(tenant_id,user_id) REFERENCES users(tenant_id,id),
 FOREIGN KEY(tenant_id,organization_id) REFERENCES organizations(tenant_id,id)
);
CREATE TABLE number_ranges (
 tenant_id uuid NOT NULL REFERENCES tenants(id), kind text NOT NULL, year integer NOT NULL, current_value bigint NOT NULL,
 PRIMARY KEY(tenant_id,kind,year)
);
CREATE TABLE documents (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL, organization_id uuid NOT NULL,
 number text NOT NULL, kind text NOT NULL CHECK(kind IN ('TICKET','SERVICE_CASE')), created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,id), UNIQUE(tenant_id,kind,number),
 FOREIGN KEY(tenant_id,organization_id) REFERENCES organizations(tenant_id,id),
 FOREIGN KEY(tenant_id,created_by) REFERENCES users(tenant_id,id)
);
CREATE TABLE service_cases (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL, partner_id uuid NOT NULL, title text NOT NULL,
 operational_status text NOT NULL DEFAULT 'OPEN' CHECK(operational_status IN ('OPEN','CLOSED')),
 technical_status text NOT NULL DEFAULT 'UNRESOLVED', commercial_status text NOT NULL DEFAULT 'NOT_ASSESSED',
 version integer NOT NULL DEFAULT 1,
 UNIQUE(tenant_id,id), FOREIGN KEY(tenant_id,id) REFERENCES documents(tenant_id,id),
 FOREIGN KEY(tenant_id,partner_id) REFERENCES business_partners(tenant_id,id)
);
CREATE TABLE tickets (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL, partner_id uuid NOT NULL, case_id uuid NOT NULL,
 title text NOT NULL CHECK(length(title) BETWEEN 5 AND 160), description text NOT NULL CHECK(length(description) BETWEEN 10 AND 10000),
 type text NOT NULL CHECK(type IN ('INCIDENT','SERVICE_REQUEST','PROBLEM','CHANGE','MAINTENANCE','REPAIR','INSTALLATION','COMPLAINT','WARRANTY','INTERNAL')),
 priority text NOT NULL CHECK(priority IN ('LOW','MEDIUM','HIGH','CRITICAL')),
 status text NOT NULL DEFAULT 'NEW' CHECK(status IN ('NEW','QUALIFYING','ASSIGNED','IN_PROGRESS','WAITING_CUSTOMER','WAITING_MATERIAL','WAITING_VENDOR','TECHNICALLY_RESOLVED','COMMERCIALLY_CLOSED','CLOSED','ESCALATED','CANCELLED','REOPENED')),
 source text NOT NULL CHECK(source IN ('CUSTOMER_PORTAL','INTERNAL')), correlation_id uuid NOT NULL,
 version integer NOT NULL DEFAULT 1 CHECK(version > 0), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id), FOREIGN KEY(tenant_id,id) REFERENCES documents(tenant_id,id),
 FOREIGN KEY(tenant_id,partner_id) REFERENCES business_partners(tenant_id,id),
 FOREIGN KEY(tenant_id,case_id) REFERENCES service_cases(tenant_id,id)
);
CREATE TABLE dispatch_assignments (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL, ticket_id uuid NOT NULL, technician_id uuid NOT NULL,
 assigned_by uuid NOT NULL, assigned_at timestamptz NOT NULL DEFAULT now(), active boolean NOT NULL DEFAULT true,
 FOREIGN KEY(tenant_id,ticket_id) REFERENCES tickets(tenant_id,id),
 FOREIGN KEY(tenant_id,technician_id) REFERENCES technicians(tenant_id,id),
 FOREIGN KEY(tenant_id,assigned_by) REFERENCES users(tenant_id,id)
);
CREATE UNIQUE INDEX one_active_assignment ON dispatch_assignments(tenant_id,ticket_id) WHERE active;
CREATE INDEX assignments_technician ON dispatch_assignments(tenant_id,technician_id) WHERE active;
CREATE TABLE document_relations (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL, source_id uuid NOT NULL, target_id uuid NOT NULL, kind text NOT NULL,
 CHECK(source_id<>target_id), UNIQUE(tenant_id,source_id,target_id,kind),
 FOREIGN KEY(tenant_id,source_id) REFERENCES documents(tenant_id,id),
 FOREIGN KEY(tenant_id,target_id) REFERENCES documents(tenant_id,id)
);
CREATE INDEX relation_target ON document_relations(tenant_id,target_id);
CREATE TABLE audit_events (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id), document_id uuid, actor_id uuid NOT NULL,
 action text NOT NULL, correlation_id uuid NOT NULL, details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,document_id) REFERENCES documents(tenant_id,id),
 FOREIGN KEY(tenant_id,actor_id) REFERENCES users(tenant_id,id)
);
CREATE INDEX audit_document ON audit_events(tenant_id,document_id,created_at);
CREATE FUNCTION reject_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Audit events are append-only'; END;
$$;
CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();
CREATE TABLE idempotency_keys (
 tenant_id uuid NOT NULL REFERENCES tenants(id), actor_id uuid NOT NULL, scope text NOT NULL, key uuid NOT NULL,
 request_hash text NOT NULL, response jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,actor_id,scope,key), FOREIGN KEY(tenant_id,actor_id) REFERENCES users(tenant_id,id)
);
CREATE TABLE sessions (sid varchar PRIMARY KEY, sess json NOT NULL, expire timestamp(6) NOT NULL);
CREATE INDEX sessions_expire ON sessions(expire);
CREATE INDEX tickets_scope ON tickets(tenant_id,status,updated_at);
CREATE INDEX documents_scope ON documents(tenant_id,organization_id,created_at);

DO $$
DECLARE table_name text;
BEGIN
 FOREACH table_name IN ARRAY ARRAY['organizations','business_partners','technicians','number_ranges','documents','service_cases','tickets','dispatch_assignments','document_relations','audit_events','idempotency_keys'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',table_name);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',table_name);
  EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_id = nullif(current_setting(''app.tenant_id'',true),'''')::uuid) WITH CHECK (tenant_id = nullif(current_setting(''app.tenant_id'',true),'''')::uuid)',table_name);
 END LOOP;
END $$;
