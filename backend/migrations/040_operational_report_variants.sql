CREATE TABLE report_variants(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,user_id uuid NOT NULL,report text NOT NULL CHECK(report IN('ORDERS','PIPELINE','AGING')),
 name text NOT NULL CHECK(length(trim(name)) BETWEEN 3 AND 80),filters jsonb NOT NULL CHECK(jsonb_typeof(filters)='object'),version int NOT NULL DEFAULT 1 CHECK(version>0),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,user_id,report,name),FOREIGN KEY(tenant_id,user_id) REFERENCES users(tenant_id,id)
);
ALTER TABLE report_variants ENABLE ROW LEVEL SECURITY;ALTER TABLE report_variants FORCE ROW LEVEL SECURITY;
CREATE POLICY personal_report_variant ON report_variants USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND user_id=nullif(current_setting('app.user_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND user_id=nullif(current_setting('app.user_id',true),'')::uuid);
CREATE INDEX report_order_cohort ON sales_orders(tenant_id,company_id,order_date,id);
CREATE INDEX report_quote_cohort ON service_quotes(tenant_id,company_id,quote_date,id);
CREATE INDEX report_invoice_posting ON invoices(tenant_id,company_id,posting_date,id) WHERE sealed;
