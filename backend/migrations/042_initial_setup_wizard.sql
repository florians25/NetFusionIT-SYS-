ALTER TABLE company_codes ADD COLUMN tax_number text NOT NULL DEFAULT '',ADD COLUMN register_court text NOT NULL DEFAULT '',ADD COLUMN register_number text NOT NULL DEFAULT '',ADD COLUMN managing_directors text NOT NULL DEFAULT '',ADD COLUMN website text NOT NULL DEFAULT '',ADD COLUMN email text NOT NULL DEFAULT '',ADD COLUMN phone text NOT NULL DEFAULT '';
CREATE TABLE initial_setup_runs(
 tenant_id uuid PRIMARY KEY,organization_id uuid NOT NULL,company_id uuid NOT NULL,snapshot jsonb NOT NULL,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,organization_id) REFERENCES organizations(tenant_id,id),FOREIGN KEY(tenant_id,company_id) REFERENCES company_codes(tenant_id,id),FOREIGN KEY(tenant_id,created_by) REFERENCES users(tenant_id,id)
);
ALTER TABLE initial_setup_runs ENABLE ROW LEVEL SECURITY;ALTER TABLE initial_setup_runs FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON initial_setup_runs USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
CREATE TRIGGER initial_setup_immutable BEFORE UPDATE OR DELETE ON initial_setup_runs FOR EACH ROW EXECUTE FUNCTION reject_attachment_mutation();
