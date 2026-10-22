-- Register pre-existing partner masters without renumbering them. This is a
-- technical registration, not a claim about their historical business creator.
WITH registered AS (
 INSERT INTO documents(id,tenant_id,organization_id,number,kind,created_by,created_at)
 SELECT p.id,p.tenant_id,p.organization_id,p.number,'BUSINESS_PARTNER',u.id,p.created_at
 FROM business_partners p JOIN LATERAL(SELECT id FROM users WHERE tenant_id=p.tenant_id AND role='ADMIN' ORDER BY created_at,id LIMIT 1) u ON true
 WHERE NOT EXISTS(SELECT 1 FROM documents d WHERE d.tenant_id=p.tenant_id AND d.id=p.id)
 RETURNING id,tenant_id,created_by
)
INSERT INTO audit_events(id,tenant_id,document_id,actor_id,action,correlation_id,details)
SELECT gen_random_uuid(),tenant_id,id,created_by,'LEGACY_PARTNER_REGISTERED',gen_random_uuid(),'{"reason":"Technical registration of existing partner; historical creator not recorded"}'::jsonb FROM registered;

CREATE TABLE document_attachments (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL, source_id uuid NOT NULL,
 number text NOT NULL, document_type text NOT NULL CHECK(document_type IN ('RECORD','ORDER_CONFIRMATION','PURCHASE_ORDER','GOODS_RECEIPT','DELIVERY_NOTE','SERVICE_REPORT','EXTERNAL_PDF')),
 filename text NOT NULL CHECK(length(filename) BETWEEN 5 AND 180 AND filename !~ '[/\\[:cntrl:]]'),
 visibility text NOT NULL CHECK(visibility IN ('INTERNAL','CUSTOMER')),
 origin text NOT NULL CHECK(origin IN ('GENERATED','UPLOADED')),
 source_version integer NOT NULL CHECK(source_version>0), template_version integer NOT NULL CHECK(template_version>0),
 source_hash text NOT NULL CHECK(source_hash ~ '^[a-f0-9]{64}$'),
 source_snapshot jsonb NOT NULL CHECK(jsonb_typeof(source_snapshot)='object'),
 content bytea NOT NULL CHECK(octet_length(content) BETWEEN 20 AND 5242880),
 sha256 text NOT NULL CHECK(sha256=encode(sha256(content),'hex')),
 created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id), UNIQUE(tenant_id,number),
 UNIQUE(tenant_id,source_id,document_type,visibility,source_hash,template_version),
 FOREIGN KEY(tenant_id,source_id) REFERENCES documents(tenant_id,id),
 FOREIGN KEY(tenant_id,created_by) REFERENCES users(tenant_id,id),
 CHECK((origin='UPLOADED')=(document_type='EXTERNAL_PDF'))
);
CREATE TABLE attachment_scans (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL, attachment_id uuid NOT NULL,
 status text NOT NULL CHECK(status IN ('CLEAN','INFECTED','UNAVAILABLE')),
 engine text NOT NULL CHECK(length(engine) BETWEEN 1 AND 200),
 detail text NOT NULL CHECK(length(detail)<=1000), scanned_by uuid NOT NULL,
 scanned_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(tenant_id,attachment_id) REFERENCES document_attachments(tenant_id,id),
 FOREIGN KEY(tenant_id,scanned_by) REFERENCES users(tenant_id,id)
);
CREATE INDEX attachment_source ON document_attachments(tenant_id,source_id,created_at DESC);
CREATE INDEX attachment_scan_latest ON attachment_scans(tenant_id,attachment_id,scanned_at DESC,id DESC);
CREATE FUNCTION reject_attachment_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Archivierte Anlagen und Scanprotokolle sind unveränderlich'; END;
$$;
CREATE TRIGGER attachment_immutable BEFORE UPDATE OR DELETE ON document_attachments FOR EACH ROW EXECUTE FUNCTION reject_attachment_mutation();
CREATE TRIGGER attachment_scan_immutable BEFORE UPDATE OR DELETE ON attachment_scans FOR EACH ROW EXECUTE FUNCTION reject_attachment_mutation();
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['document_attachments','attachment_scans'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY tenant_isolation ON %I USING(tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid) WITH CHECK(tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid)',t);
 END LOOP;
END $$;
