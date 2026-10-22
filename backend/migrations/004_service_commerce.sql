ALTER TABLE documents DROP CONSTRAINT documents_kind_check;
ALTER TABLE documents ADD CONSTRAINT documents_kind_check CHECK(kind IN ('TICKET','SERVICE_CASE','BUSINESS_PARTNER','APPROVAL','TECHNICAL_OBJECT','SERVICE_CONTRACT','FIELD_VISIT','SERVICE_ORDER','MATERIAL','MATERIAL_REQUIREMENT','REQUISITION','PURCHASE_ORDER','GOODS_RECEIPT','GOODS_ISSUE','SERVICE_REPORT','INVOICE','CANCELLATION','ACCOUNTING','PAYMENT','QUOTATION','SALES_ORDER','CREDIT_NOTE'));
ALTER TABLE business_partners ADD COLUMN customer_group text NOT NULL DEFAULT '';
CREATE TABLE currencies (
 tenant_id uuid NOT NULL REFERENCES tenants(id),code text NOT NULL CHECK(code ~ '^[A-Z]{3}$'),digits integer NOT NULL CHECK(digits BETWEEN 0 AND 4),PRIMARY KEY(tenant_id,code)
);
CREATE TABLE products (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,sku text NOT NULL,name text NOT NULL,kind text NOT NULL CHECK(kind IN ('STOCK','NON_STOCK','SERVICE','SOFTWARE','LICENSE','TRAVEL','EXPENSE','INTERNAL','MAINTENANCE','EXTERNAL_SERVICE')),unit text NOT NULL,tax_code text NOT NULL,product_group text NOT NULL DEFAULT '',description text NOT NULL DEFAULT '',status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','IN_REVIEW','ACTIVE','REJECTED','BLOCKED')),version integer NOT NULL DEFAULT 1,
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,sku),FOREIGN KEY(tenant_id,id) REFERENCES documents(tenant_id,id)
);
CREATE TABLE price_conditions (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,organization_id uuid NOT NULL,code text NOT NULL,kind text NOT NULL CHECK(kind IN ('BASE','DISCOUNT_PERCENT','DISCOUNT_AMOUNT','SURCHARGE_PERCENT','SURCHARGE_AMOUNT','TAX')),sequence integer NOT NULL CHECK(sequence>=0),priority integer NOT NULL,product_id uuid,partner_id uuid,contract_id uuid,customer_group text,product_group text,tax_code text,currency text NOT NULL,valid_from date NOT NULL,valid_to date NOT NULL,minimum_quantity numeric(18,6) NOT NULL CHECK(minimum_quantity>0),value numeric(18,6) NOT NULL CHECK(value>=0),active boolean NOT NULL DEFAULT true,version integer NOT NULL DEFAULT 1,CHECK(valid_to>=valid_from),
 UNIQUE(tenant_id,id),FOREIGN KEY(tenant_id,organization_id) REFERENCES organizations(tenant_id,id),FOREIGN KEY(tenant_id,product_id) REFERENCES products(tenant_id,id),FOREIGN KEY(tenant_id,partner_id) REFERENCES business_partners(tenant_id,id),FOREIGN KEY(tenant_id,contract_id) REFERENCES service_contracts(tenant_id,id),FOREIGN KEY(tenant_id,currency) REFERENCES currencies(tenant_id,code)
);
CREATE TABLE service_orders (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,case_id uuid NOT NULL,partner_id uuid NOT NULL,source_ticket_id uuid,contract_id uuid,title text NOT NULL,kind text NOT NULL CHECK(kind IN ('PAID','MAINTENANCE','REPAIR','WARRANTY','INTERNAL','GOODWILL','PROJECT')),currency text NOT NULL,pricing_date date NOT NULL,status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','IN_REVIEW','REJECTED','RELEASED','IN_PROGRESS','TECHNICALLY_COMPLETED','BILLING_READY','PARTIALLY_BILLED','FULLY_BILLED','CLOSED','CANCELLED')),version integer NOT NULL DEFAULT 1,
 UNIQUE(tenant_id,id),FOREIGN KEY(tenant_id,id) REFERENCES documents(tenant_id,id),FOREIGN KEY(tenant_id,case_id) REFERENCES service_cases(tenant_id,id),FOREIGN KEY(tenant_id,partner_id) REFERENCES business_partners(tenant_id,id),FOREIGN KEY(tenant_id,source_ticket_id) REFERENCES tickets(tenant_id,id),FOREIGN KEY(tenant_id,contract_id) REFERENCES service_contracts(tenant_id,id),FOREIGN KEY(tenant_id,currency) REFERENCES currencies(tenant_id,code)
);
CREATE UNIQUE INDEX order_ticket_once ON service_orders(tenant_id,source_ticket_id) WHERE source_ticket_id IS NOT NULL AND status<>'CANCELLED';
CREATE TABLE service_order_items (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,order_id uuid NOT NULL,position integer NOT NULL,product_id uuid NOT NULL,description text NOT NULL,quantity numeric(18,6) NOT NULL CHECK(quantity>0),unit text NOT NULL,billing_rule text NOT NULL CHECK(billing_rule IN ('TIME_MATERIAL','FIXED_PRICE','NON_BILLABLE')),cost_center text NOT NULL,cost_object text NOT NULL,price_snapshot jsonb NOT NULL,net numeric(20,4) NOT NULL CHECK(net>=0),tax numeric(20,4) NOT NULL CHECK(tax>=0),gross numeric(20,4) NOT NULL CHECK(gross=net+tax),service_status text NOT NULL DEFAULT 'PLANNED',billing_status text NOT NULL DEFAULT 'NOT_BILLED',
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,order_id,position),FOREIGN KEY(tenant_id,order_id) REFERENCES service_orders(tenant_id,id),FOREIGN KEY(tenant_id,product_id) REFERENCES products(tenant_id,id)
);
DO $$DECLARE t text;BEGIN
FOREACH t IN ARRAY ARRAY['currencies','products','price_conditions','service_orders','service_order_items'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid) WITH CHECK (tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid)',t);
END LOOP;END $$;
