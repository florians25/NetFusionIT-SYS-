ALTER TABLE users DROP CONSTRAINT users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK(role IN ('ADMIN','SERVICE_MANAGER','DISPATCHER','SUPPORT','TECHNICIAN','FIELD_TECHNICIAN','MASTER_DATA','BUYER','PURCHASING_MANAGER','WAREHOUSE','SALES','BILLING','ACCOUNTANT','CONTROLLER','EXECUTIVE','CUSTOMER'));
ALTER TABLE documents DROP CONSTRAINT documents_kind_check;
ALTER TABLE documents ADD CONSTRAINT documents_kind_check CHECK(kind IN ('TICKET','SERVICE_CASE','BUSINESS_PARTNER','APPROVAL','TECHNICAL_OBJECT','SERVICE_CONTRACT','FIELD_VISIT','SERVICE_ORDER','MATERIAL_REQUIREMENT','REQUISITION','PURCHASE_ORDER','GOODS_RECEIPT','GOODS_ISSUE','SERVICE_REPORT','INVOICE','CANCELLATION','ACCOUNTING','PAYMENT','QUOTATION','SALES_ORDER','CREDIT_NOTE'));
ALTER TABLE business_partners DROP CONSTRAINT business_partners_status_check;
ALTER TABLE business_partners ADD CONSTRAINT business_partners_status_check CHECK(status IN ('DRAFT','SUBMITTED','IN_REVIEW','APPROVED','ACTIVE','REJECTED','BLOCKED'));
ALTER TABLE business_partners ADD COLUMN roles text[] NOT NULL DEFAULT ARRAY['CUSTOMER'];
ALTER TABLE business_partners ADD COLUMN legal_form text NOT NULL DEFAULT '';
ALTER TABLE business_partners ADD COLUMN vat_id text NOT NULL DEFAULT '';
ALTER TABLE business_partners ADD COLUMN currency text NOT NULL DEFAULT 'EUR' CHECK(currency ~ '^[A-Z]{3}$');
CREATE TABLE partner_contacts (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,partner_id uuid NOT NULL,name text NOT NULL,email text NOT NULL,phone text NOT NULL DEFAULT '',position text NOT NULL DEFAULT '',
 UNIQUE(tenant_id,id),FOREIGN KEY(tenant_id,partner_id) REFERENCES business_partners(tenant_id,id)
);
CREATE TABLE partner_addresses (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,partner_id uuid NOT NULL,kind text NOT NULL CHECK(kind IN ('BUSINESS','BILLING','SERVICE')),street text NOT NULL,postal_code text NOT NULL,city text NOT NULL,country text NOT NULL CHECK(country ~ '^[A-Z]{2}$'),
 UNIQUE(tenant_id,id),FOREIGN KEY(tenant_id,partner_id) REFERENCES business_partners(tenant_id,id)
);
CREATE TABLE ticket_comments (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,ticket_id uuid NOT NULL,author_id uuid NOT NULL,visibility text NOT NULL CHECK(visibility IN ('PUBLIC','INTERNAL')),body text NOT NULL CHECK(length(body) BETWEEN 1 AND 10000),created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,ticket_id) REFERENCES tickets(tenant_id,id),FOREIGN KEY(tenant_id,author_id) REFERENCES users(tenant_id,id)
);
CREATE INDEX comments_ticket ON ticket_comments(tenant_id,ticket_id,created_at);
CREATE TABLE ticket_links (
 tenant_id uuid NOT NULL,source_id uuid NOT NULL,target_id uuid NOT NULL,kind text NOT NULL CHECK(kind IN ('RELATED','PARENT','DUPLICATE')),created_by uuid NOT NULL,CHECK(source_id<>target_id),PRIMARY KEY(tenant_id,source_id,target_id,kind),
 FOREIGN KEY(tenant_id,source_id) REFERENCES tickets(tenant_id,id),FOREIGN KEY(tenant_id,target_id) REFERENCES tickets(tenant_id,id),FOREIGN KEY(tenant_id,created_by) REFERENCES users(tenant_id,id)
);
CREATE TABLE approval_definitions (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,organization_id uuid NOT NULL,name text NOT NULL,subject_kind text NOT NULL,version integer NOT NULL DEFAULT 1,steps jsonb NOT NULL CHECK(jsonb_typeof(steps)='array' AND jsonb_array_length(steps)>0),active boolean NOT NULL DEFAULT true,four_eyes boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id),FOREIGN KEY(tenant_id,organization_id) REFERENCES organizations(tenant_id,id)
);
CREATE UNIQUE INDEX approval_active_definition ON approval_definitions(tenant_id,organization_id,subject_kind) WHERE active;
CREATE TABLE approval_instances (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,definition_id uuid NOT NULL,organization_id uuid NOT NULL,document_id uuid NOT NULL,submitted_by uuid NOT NULL,
 status text NOT NULL CHECK(status IN ('PENDING','APPROVED','REJECTED','INFORMATION_REQUIRED')),current_step integer NOT NULL DEFAULT 0,steps_snapshot jsonb NOT NULL,four_eyes boolean NOT NULL,subject_version integer NOT NULL,version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id),FOREIGN KEY(tenant_id,definition_id) REFERENCES approval_definitions(tenant_id,id),FOREIGN KEY(tenant_id,document_id) REFERENCES documents(tenant_id,id),FOREIGN KEY(tenant_id,submitted_by) REFERENCES users(tenant_id,id),FOREIGN KEY(tenant_id,organization_id) REFERENCES organizations(tenant_id,id)
);
CREATE UNIQUE INDEX approval_pending_subject ON approval_instances(tenant_id,document_id) WHERE status IN ('PENDING','INFORMATION_REQUIRED');
CREATE TABLE approval_decisions (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,instance_id uuid NOT NULL,step integer NOT NULL,actor_id uuid NOT NULL,decision text NOT NULL CHECK(decision IN ('APPROVE','REJECT','REQUEST_INFORMATION','RESUBMIT')),comment text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,instance_id) REFERENCES approval_instances(tenant_id,id),FOREIGN KEY(tenant_id,actor_id) REFERENCES users(tenant_id,id)
);
CREATE INDEX approval_decisions_instance ON approval_decisions(tenant_id,instance_id,created_at);
CREATE TABLE notification_outbox (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,recipient_id uuid NOT NULL,event_type text NOT NULL,document_id uuid,payload jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now(),read_at timestamptz,
 FOREIGN KEY(tenant_id,recipient_id) REFERENCES users(tenant_id,id),FOREIGN KEY(tenant_id,document_id) REFERENCES documents(tenant_id,id)
);
CREATE INDEX notifications_recipient ON notification_outbox(tenant_id,recipient_id,created_at DESC);
DO $$DECLARE t text;BEGIN
FOREACH t IN ARRAY ARRAY['partner_contacts','partner_addresses','ticket_comments','ticket_links','approval_definitions','approval_instances','approval_decisions','notification_outbox'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid) WITH CHECK (tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid)',t);
END LOOP;END $$;
