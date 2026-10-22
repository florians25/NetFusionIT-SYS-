ALTER TABLE documents DROP CONSTRAINT documents_kind_check;
ALTER TABLE documents ADD CONSTRAINT documents_kind_check CHECK(kind IN ('WORK_ORDER_TASK','TICKET','SERVICE_CASE','BUSINESS_PARTNER','APPROVAL','TECHNICAL_OBJECT','SERVICE_CONTRACT','FIELD_VISIT','SERVICE_ORDER','MATERIAL','MATERIAL_REQUIREMENT','REQUISITION','PURCHASE_ORDER','GOODS_RECEIPT','GOODS_ISSUE','SERVICE_REPORT','INVOICE','CANCELLATION','ACCOUNTING','PAYMENT','QUOTATION','SALES_ORDER','CREDIT_NOTE'));
CREATE TABLE work_order_tasks (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,ticket_id uuid NOT NULL,order_id uuid,worker_id uuid NOT NULL,title text NOT NULL,description text NOT NULL,correlation_id uuid NOT NULL,
 status text NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','IN_PROGRESS','COMPLETED','CANCELLED')),version integer NOT NULL DEFAULT 1,
 UNIQUE(tenant_id,id),FOREIGN KEY(tenant_id,id) REFERENCES documents(tenant_id,id),FOREIGN KEY(tenant_id,ticket_id) REFERENCES tickets(tenant_id,id),FOREIGN KEY(tenant_id,order_id) REFERENCES service_orders(tenant_id,id),FOREIGN KEY(tenant_id,worker_id) REFERENCES users(tenant_id,id)
);
CREATE TABLE service_reports (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,order_id uuid NOT NULL,ticket_id uuid NOT NULL,task_id uuid NOT NULL,correlation_id uuid NOT NULL,author_id uuid NOT NULL,title text NOT NULL,diagnosis text NOT NULL,work_done text NOT NULL,outcome text NOT NULL,is_final boolean NOT NULL DEFAULT false,
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','IN_REVIEW','APPROVED','REJECTED','CANCELLED')),
 customer_confirmed_at timestamptz,customer_confirmed_by uuid,customer_comment text,
 version integer NOT NULL DEFAULT 1,UNIQUE(tenant_id,id),
 CHECK((customer_confirmed_at IS NULL)=(customer_confirmed_by IS NULL)),
 FOREIGN KEY(tenant_id,ticket_id) REFERENCES tickets(tenant_id,id),FOREIGN KEY(tenant_id,task_id) REFERENCES work_order_tasks(tenant_id,id),FOREIGN KEY(tenant_id,id) REFERENCES documents(tenant_id,id),FOREIGN KEY(tenant_id,order_id) REFERENCES service_orders(tenant_id,id),FOREIGN KEY(tenant_id,author_id) REFERENCES users(tenant_id,id),FOREIGN KEY(tenant_id,customer_confirmed_by) REFERENCES users(tenant_id,id)
);
CREATE UNIQUE INDEX one_final_report ON service_reports(tenant_id,order_id) WHERE is_final AND status NOT IN ('REJECTED','CANCELLED');
CREATE TABLE time_entries (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,ticket_id uuid NOT NULL,task_id uuid NOT NULL,order_id uuid,item_id uuid,category text NOT NULL CHECK(category IN ('WORK','TRAVEL')),worker_id uuid NOT NULL,visit_id uuid,started_at timestamptz NOT NULL,ended_at timestamptz NOT NULL,pause_seconds integer NOT NULL CHECK(pause_seconds>=0),duration_seconds integer NOT NULL CHECK(duration_seconds>0 AND duration_seconds<=86400),quantity numeric(18,6) NOT NULL CHECK(quantity>0),billable boolean NOT NULL,description text NOT NULL,source text NOT NULL CHECK(source IN ('MANUAL','TIMER')),
 status text NOT NULL DEFAULT 'RECORDED' CHECK(status IN ('RECORDED','CHECKED','RELEASED','BILLED','VOIDED')),report_id uuid,version integer NOT NULL DEFAULT 1,
 CHECK((order_id IS NULL)=(item_id IS NULL)),CHECK(ended_at>started_at),CHECK(extract(epoch FROM ended_at-started_at)::integer=duration_seconds+pause_seconds),
 UNIQUE(tenant_id,id),FOREIGN KEY(tenant_id,ticket_id) REFERENCES tickets(tenant_id,id),FOREIGN KEY(tenant_id,task_id) REFERENCES work_order_tasks(tenant_id,id),FOREIGN KEY(tenant_id,order_id) REFERENCES service_orders(tenant_id,id),FOREIGN KEY(tenant_id,item_id) REFERENCES service_order_items(tenant_id,id),FOREIGN KEY(tenant_id,worker_id) REFERENCES users(tenant_id,id),FOREIGN KEY(tenant_id,visit_id) REFERENCES field_visits(tenant_id,id),FOREIGN KEY(tenant_id,report_id) REFERENCES service_reports(tenant_id,id)
);
CREATE INDEX time_worker_intervals ON time_entries(tenant_id,worker_id,started_at,ended_at) WHERE status<>'VOIDED';
CREATE TABLE work_timers (
 tenant_id uuid NOT NULL,worker_id uuid NOT NULL,ticket_id uuid NOT NULL,task_id uuid NOT NULL,category text NOT NULL CHECK(category IN ('WORK','TRAVEL')),visit_id uuid,started_at timestamptz NOT NULL,paused_at timestamptz,pause_seconds integer NOT NULL DEFAULT 0 CHECK(pause_seconds>=0),billable boolean NOT NULL,description text NOT NULL,version integer NOT NULL DEFAULT 1,
 PRIMARY KEY(tenant_id,worker_id),FOREIGN KEY(tenant_id,task_id) REFERENCES work_order_tasks(tenant_id,id),FOREIGN KEY(tenant_id,ticket_id) REFERENCES tickets(tenant_id,id),FOREIGN KEY(tenant_id,worker_id) REFERENCES users(tenant_id,id),FOREIGN KEY(tenant_id,visit_id) REFERENCES field_visits(tenant_id,id)
);
CREATE TABLE ticket_charges (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,ticket_id uuid NOT NULL,task_id uuid NOT NULL,order_id uuid,item_id uuid,worker_id uuid NOT NULL,product_id uuid NOT NULL,kind text NOT NULL CHECK(kind IN ('TRAVEL_FLAT','SERVICE_FLAT','MILEAGE','EXPENSE')),quantity numeric(18,6) NOT NULL CHECK(quantity>0),unit text NOT NULL,billable boolean NOT NULL,description text NOT NULL,
 status text NOT NULL DEFAULT 'RECORDED' CHECK(status IN ('RECORDED','CHECKED','RELEASED','BILLED','VOIDED')),report_id uuid,version integer NOT NULL DEFAULT 1,
 CHECK((order_id IS NULL)=(item_id IS NULL)),UNIQUE(tenant_id,id),FOREIGN KEY(tenant_id,ticket_id) REFERENCES tickets(tenant_id,id),FOREIGN KEY(tenant_id,task_id) REFERENCES work_order_tasks(tenant_id,id),FOREIGN KEY(tenant_id,order_id) REFERENCES service_orders(tenant_id,id),FOREIGN KEY(tenant_id,item_id) REFERENCES service_order_items(tenant_id,id),FOREIGN KEY(tenant_id,worker_id) REFERENCES users(tenant_id,id),FOREIGN KEY(tenant_id,product_id) REFERENCES products(tenant_id,id),FOREIGN KEY(tenant_id,report_id) REFERENCES service_reports(tenant_id,id)
);
CREATE TABLE service_report_lines (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,report_id uuid NOT NULL,item_id uuid NOT NULL,time_entry_id uuid,charge_id uuid,quantity numeric(18,6) NOT NULL CHECK(quantity>0),snapshot jsonb NOT NULL,CHECK((time_entry_id IS NULL)<>(charge_id IS NULL)),UNIQUE(tenant_id,report_id,time_entry_id),UNIQUE(tenant_id,report_id,charge_id),FOREIGN KEY(tenant_id,charge_id) REFERENCES ticket_charges(tenant_id,id),FOREIGN KEY(tenant_id,report_id) REFERENCES service_reports(tenant_id,id),FOREIGN KEY(tenant_id,item_id) REFERENCES service_order_items(tenant_id,id),FOREIGN KEY(tenant_id,time_entry_id) REFERENCES time_entries(tenant_id,id)
);
CREATE FUNCTION protect_released_time() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
 IF OLD.status IN ('RELEASED','BILLED') AND (TG_OP='DELETE' OR (to_jsonb(NEW)-'status'-'version') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'version') OR NOT (NEW.status=OLD.status OR (OLD.status='RELEASED' AND NEW.status='BILLED'))) THEN RAISE EXCEPTION 'Freigegebene Zeit ist unveränderlich';END IF;RETURN NEW;
END$$;
CREATE TRIGGER time_immutable BEFORE UPDATE OR DELETE ON time_entries FOR EACH ROW EXECUTE FUNCTION protect_released_time();
CREATE TRIGGER charges_immutable BEFORE UPDATE OR DELETE ON ticket_charges FOR EACH ROW EXECUTE FUNCTION protect_released_time();
CREATE FUNCTION protect_approved_report() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
 IF OLD.status='APPROVED' THEN RAISE EXCEPTION 'Freigegebener Leistungsnachweis ist unveränderlich';END IF;RETURN NEW;
END$$;
CREATE TRIGGER report_immutable BEFORE UPDATE OR DELETE ON service_reports FOR EACH ROW EXECUTE FUNCTION protect_approved_report();
DO $$DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['work_order_tasks','service_reports','time_entries','work_timers','service_report_lines','ticket_charges'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid) WITH CHECK (tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid)',t);
 END LOOP;
END$$;

CREATE UNIQUE INDEX one_active_srm_per_task ON service_reports(tenant_id,task_id) WHERE status NOT IN ('REJECTED','CANCELLED');
