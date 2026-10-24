CREATE TABLE personal_workspaces(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,user_id uuid NOT NULL,scope text NOT NULL CHECK(length(scope) BETWEEN 3 AND 200),name text NOT NULL CHECK(length(name) BETWEEN 3 AND 80),state jsonb NOT NULL CHECK(jsonb_typeof(state)='object'),version integer NOT NULL DEFAULT 1 CHECK(version>0),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,user_id,scope,name),FOREIGN KEY(tenant_id,user_id) REFERENCES users(tenant_id,id)
);
ALTER TABLE personal_workspaces ENABLE ROW LEVEL SECURITY;ALTER TABLE personal_workspaces FORCE ROW LEVEL SECURITY;
CREATE POLICY personal_workspace_owner ON personal_workspaces USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND user_id=nullif(current_setting('app.user_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND user_id=nullif(current_setting('app.user_id',true),'')::uuid);
