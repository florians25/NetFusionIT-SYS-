CREATE TABLE business_number_series (
 tenant_id uuid NOT NULL,prefix text NOT NULL CHECK(prefix ~ '^[A-Z]{2}$'),name text NOT NULL,range_start integer NOT NULL,range_end integer NOT NULL,current_value integer NOT NULL,active boolean NOT NULL DEFAULT true,version integer NOT NULL DEFAULT 1,
 PRIMARY KEY(tenant_id,prefix),FOREIGN KEY(tenant_id) REFERENCES tenants(id),CHECK(range_start>=10000000 AND range_end<=89999999 AND range_end>range_start AND current_value BETWEEN range_start-1 AND range_end)
);
ALTER TABLE business_number_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_number_series FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON business_number_series USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
CREATE FUNCTION protect_business_number_series() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
 IF TG_OP='DELETE' OR (to_jsonb(OLD)-'current_value'-'active'-'version') IS DISTINCT FROM (to_jsonb(NEW)-'current_value'-'active'-'version') OR NEW.current_value<OLD.current_value OR NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'Nummernkreis darf nicht zurückgesetzt oder umdefiniert werden';END IF;RETURN NEW;
END$$;
CREATE TRIGGER number_series_monotonic BEFORE UPDATE OR DELETE ON business_number_series FOR EACH ROW EXECUTE FUNCTION protect_business_number_series();
ALTER TABLE users ADD COLUMN employee_number text;
CREATE UNIQUE INDEX unique_employee_number ON users(tenant_id,employee_number) WHERE employee_number IS NOT NULL;
ALTER TABLE partner_contacts ADD COLUMN number text;
CREATE UNIQUE INDEX unique_contact_number ON partner_contacts(tenant_id,number) WHERE number IS NOT NULL;
ALTER TABLE time_entries ADD COLUMN number text;
CREATE UNIQUE INDEX unique_time_number ON time_entries(tenant_id,number) WHERE number IS NOT NULL;
