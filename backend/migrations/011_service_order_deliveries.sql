ALTER TABLE inventory_valuations ADD COLUMN inventory_account_id uuid;
ALTER TABLE inventory_valuations ADD FOREIGN KEY(tenant_id,inventory_account_id) REFERENCES gl_accounts(tenant_id,id);
UPDATE inventory_valuations v SET inventory_account_id=(SELECT (array_agg(DISTINCT e.account_id))[1] FROM goods_receipts g JOIN goods_receipt_items gi ON gi.tenant_id=g.tenant_id AND gi.receipt_id=g.id JOIN journals j ON j.tenant_id=g.tenant_id AND j.source_id=g.id JOIN journal_entries e ON e.tenant_id=j.tenant_id AND e.journal_id=j.id AND e.side='DEBIT' WHERE g.tenant_id=v.tenant_id AND g.company_id=v.company_id AND gi.product_id=v.product_id AND gi.value>0 AND g.movement_type='RECEIPT' AND NOT EXISTS(SELECT 1 FROM goods_receipts r WHERE r.tenant_id=g.tenant_id AND r.reverses_id=g.id) HAVING count(DISTINCT e.account_id)=1);
CREATE FUNCTION bind_receipt_inventory_account() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$DECLARE a uuid;l record;v inventory_valuations;BEGIN
 IF NEW.tenant_id IS DISTINCT FROM nullif(current_setting('app.tenant_id',true),'')::uuid THEN RAISE EXCEPTION 'Mandantenkontext fehlt';END IF;
 IF NOT NEW.sealed OR OLD.sealed THEN RETURN NEW;END IF;
 SELECT e.account_id INTO a FROM journals j JOIN journal_entries e ON e.tenant_id=j.tenant_id AND e.journal_id=j.id JOIN gl_accounts gl ON gl.tenant_id=e.tenant_id AND gl.id=e.account_id WHERE j.tenant_id=NEW.tenant_id AND j.source_id=NEW.id AND e.side=CASE WHEN NEW.movement_type='RECEIPT' THEN 'DEBIT' ELSE 'CREDIT' END AND gl.kind='ASSET';
 IF a IS NULL THEN RETURN NEW;END IF;
 FOR l IN SELECT product_id,sum(value) AS amount FROM goods_receipt_items WHERE tenant_id=NEW.tenant_id AND receipt_id=NEW.id GROUP BY product_id LOOP
  SELECT * INTO STRICT v FROM inventory_valuations WHERE tenant_id=NEW.tenant_id AND company_id=NEW.company_id AND product_id=l.product_id FOR UPDATE;
  IF NEW.movement_type='RECEIPT' AND v.value-l.amount>0 AND v.inventory_account_id IS DISTINCT FROM a THEN RAISE EXCEPTION 'Bestandskonto vorhandener Bewertung stimmt nicht überein; Umbuchung erforderlich';END IF;
  IF NEW.movement_type='RECEIPT_REVERSAL' AND v.value>0 AND v.inventory_account_id IS DISTINCT FROM a THEN RAISE EXCEPTION 'Storno würde unterschiedliche Bestandskonten vermischen';END IF;
  UPDATE inventory_valuations SET inventory_account_id=CASE WHEN value=0 THEN NULL ELSE a END WHERE tenant_id=NEW.tenant_id AND company_id=NEW.company_id AND product_id=l.product_id;
 END LOOP;RETURN NEW;
END$$;
CREATE TRIGGER receipt_valuation_account AFTER UPDATE OF sealed ON goods_receipts FOR EACH ROW EXECUTE FUNCTION bind_receipt_inventory_account();
ALTER TABLE stock_reservations ADD COLUMN consumed_quantity numeric(18,6) NOT NULL DEFAULT 0 CHECK(consumed_quantity>=0 AND consumed_quantity<=quantity);
ALTER TABLE stock_reservations DROP CONSTRAINT stock_reservations_status_check;
ALTER TABLE stock_reservations ADD CONSTRAINT stock_reservations_status_check CHECK(status IN ('ACTIVE','CONSUMED','CANCELLED'));
ALTER TABLE stock_reservations ADD CHECK((status='CONSUMED')=(consumed_quantity=quantity));
CREATE OR REPLACE FUNCTION validate_stock_reservation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$DECLARE available numeric;claimed numeric;BEGIN
 IF NEW.tenant_id IS DISTINCT FROM nullif(current_setting('app.tenant_id',true),'')::uuid THEN RAISE EXCEPTION 'Mandantenkontext der Reservierung fehlt';END IF;
 IF TG_OP='INSERT' AND NEW.consumed_quantity<>0 THEN RAISE EXCEPTION 'Verbrauch benötigt Materialbeleg';END IF;
 IF TG_OP='UPDATE' THEN
  IF (to_jsonb(OLD)-'status'-'reason'-'version'-'consumed_quantity') IS DISTINCT FROM (to_jsonb(NEW)-'status'-'reason'-'version'-'consumed_quantity') THEN RAISE EXCEPTION 'Reservierungsinhalt ist unveränderlich';END IF;
  IF NEW.consumed_quantity<>OLD.consumed_quantity THEN IF pg_trigger_depth()<2 THEN RAISE EXCEPTION 'Verbrauch benötigt Materialbeleg';END IF;
  ELSIF OLD.status<>'ACTIVE' OR NEW.status<>'CANCELLED' OR length(NEW.reason)<5 THEN RAISE EXCEPTION 'Reservierung nur begründet freigeben';END IF;
 END IF;
 IF NEW.status='ACTIVE' THEN
  SELECT quantity INTO STRICT available FROM stock_balances WHERE tenant_id=NEW.tenant_id AND company_id=NEW.company_id AND product_id=NEW.product_id AND location_id=NEW.location_id AND batch=NEW.batch AND serial=NEW.serial FOR UPDATE;
  SELECT coalesce(sum(quantity-consumed_quantity),0) INTO claimed FROM stock_reservations WHERE tenant_id=NEW.tenant_id AND company_id=NEW.company_id AND product_id=NEW.product_id AND location_id=NEW.location_id AND batch=NEW.batch AND serial=NEW.serial AND status='ACTIVE' AND id<>NEW.id;
  IF claimed+NEW.quantity-NEW.consumed_quantity>available THEN RAISE EXCEPTION 'Reservierung überschreitet freien Bestand';END IF;
 END IF;RETURN NEW;
END$$;
CREATE OR REPLACE FUNCTION protect_reserved_balance() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE reserved numeric;BEGIN
 SELECT coalesce(sum(quantity-consumed_quantity),0) INTO reserved FROM stock_reservations WHERE tenant_id=NEW.tenant_id AND company_id=NEW.company_id AND product_id=NEW.product_id AND location_id=NEW.location_id AND batch=NEW.batch AND serial=NEW.serial AND status='ACTIVE';
 IF NEW.quantity<reserved THEN RAISE EXCEPTION 'Bestandsbewegung würde aktive Reservierungen unterschreiten';END IF;RETURN NEW;
END$$;
CREATE TABLE goods_issues (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,order_id uuid NOT NULL,ticket_id uuid NOT NULL,task_id uuid NOT NULL,worker_id uuid NOT NULL,correlation_id uuid NOT NULL,company_id uuid NOT NULL,period_id uuid NOT NULL,currency text NOT NULL,delivery_number text,
 movement_type text NOT NULL CHECK(movement_type IN ('ISSUE','ISSUE_REVERSAL')),posting_date date NOT NULL,document_date date NOT NULL,description text NOT NULL,reason text,reverses_id uuid,sealed boolean NOT NULL DEFAULT false,
 CHECK((movement_type='ISSUE')=(reverses_id IS NULL)),CHECK((movement_type='ISSUE')=(delivery_number IS NOT NULL)),CHECK(movement_type='ISSUE' OR length(reason)>=5),UNIQUE(tenant_id,id),UNIQUE(tenant_id,reverses_id),UNIQUE(tenant_id,delivery_number),
 FOREIGN KEY(tenant_id,id) REFERENCES documents(tenant_id,id),FOREIGN KEY(tenant_id,order_id) REFERENCES service_orders(tenant_id,id),FOREIGN KEY(tenant_id,ticket_id) REFERENCES tickets(tenant_id,id),FOREIGN KEY(tenant_id,task_id) REFERENCES work_order_tasks(tenant_id,id),FOREIGN KEY(tenant_id,worker_id) REFERENCES users(tenant_id,id),FOREIGN KEY(tenant_id,company_id) REFERENCES company_codes(tenant_id,id),FOREIGN KEY(tenant_id,period_id) REFERENCES fiscal_periods(tenant_id,id),FOREIGN KEY(tenant_id,currency) REFERENCES currencies(tenant_id,code),FOREIGN KEY(tenant_id,reverses_id) REFERENCES goods_issues(tenant_id,id)
);
CREATE TABLE goods_issue_items (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,issue_id uuid NOT NULL,reservation_id uuid NOT NULL,order_item_id uuid NOT NULL,product_id uuid NOT NULL,location_id uuid NOT NULL,position integer NOT NULL,quantity numeric(18,6) NOT NULL CHECK(quantity>0),value numeric(20,4) NOT NULL CHECK(value>=0),batch text NOT NULL,serial text NOT NULL,
 CHECK(serial='' OR quantity=1),UNIQUE(tenant_id,id),UNIQUE(tenant_id,issue_id,position),FOREIGN KEY(tenant_id,issue_id) REFERENCES goods_issues(tenant_id,id),FOREIGN KEY(tenant_id,reservation_id) REFERENCES stock_reservations(tenant_id,id),FOREIGN KEY(tenant_id,order_item_id) REFERENCES service_order_items(tenant_id,id),FOREIGN KEY(tenant_id,product_id) REFERENCES products(tenant_id,id),FOREIGN KEY(tenant_id,location_id) REFERENCES storage_locations(tenant_id,id)
);
CREATE FUNCTION apply_goods_issue_item() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$DECLARE h goods_issues;r stock_reservations;direction integer;valuation inventory_valuations;digits integer;expected numeric;original_account uuid;BEGIN
 IF NEW.tenant_id IS DISTINCT FROM nullif(current_setting('app.tenant_id',true),'')::uuid THEN RAISE EXCEPTION 'Mandantenkontext fehlt';END IF;
 SELECT * INTO STRICT h FROM goods_issues WHERE tenant_id=NEW.tenant_id AND id=NEW.issue_id;IF h.sealed THEN RAISE EXCEPTION 'Materialbeleg ist abgeschlossen';END IF;
 SELECT * INTO STRICT r FROM stock_reservations WHERE tenant_id=NEW.tenant_id AND id=NEW.reservation_id FOR UPDATE;
 IF r.order_id<>h.order_id OR r.product_id<>NEW.product_id OR r.location_id<>NEW.location_id OR r.batch<>NEW.batch OR r.serial<>NEW.serial OR NOT EXISTS(SELECT 1 FROM order_requirement_items WHERE tenant_id=r.tenant_id AND id=r.requirement_item_id AND order_item_id=NEW.order_item_id) THEN RAISE EXCEPTION 'Auslieferung stimmt nicht mit Reservierung überein';END IF;
 direction:=CASE WHEN h.movement_type='ISSUE' THEN 1 ELSE -1 END;
 SELECT * INTO STRICT valuation FROM inventory_valuations WHERE tenant_id=NEW.tenant_id AND company_id=h.company_id AND product_id=NEW.product_id FOR UPDATE;
 SELECT c.digits INTO STRICT digits FROM currencies c WHERE c.tenant_id=NEW.tenant_id AND c.code=h.currency;
 IF direction=1 THEN
  IF valuation.quantity<NEW.quantity THEN RAISE EXCEPTION 'Bewertungsbestand reicht nicht aus';END IF;
  expected:=CASE WHEN valuation.quantity=NEW.quantity THEN valuation.value ELSE round(trunc(valuation.value*NEW.quantity,60)/valuation.quantity,digits) END;
  IF NEW.value<>expected THEN RAISE EXCEPTION 'Materialwert passt nicht zur gleitenden Bewertung';END IF;
 ELSIF NEW.value>0 THEN
  SELECT e.account_id INTO STRICT original_account FROM journals j JOIN journal_entries e ON e.tenant_id=j.tenant_id AND e.journal_id=j.id JOIN gl_accounts a ON a.tenant_id=e.tenant_id AND a.id=e.account_id WHERE j.tenant_id=NEW.tenant_id AND j.source_id=h.reverses_id AND e.side='CREDIT' AND a.kind='ASSET';
  IF valuation.value>0 AND valuation.inventory_account_id IS DISTINCT FROM original_account THEN RAISE EXCEPTION 'Rücknahme würde unterschiedliche Bestandskonten vermischen';END IF;
 END IF;
 IF direction=1 AND (r.status<>'ACTIVE' OR r.quantity-r.consumed_quantity<NEW.quantity) THEN RAISE EXCEPTION 'Auslieferung überschreitet offene Reservierung';END IF;
 IF direction=-1 THEN UPDATE stock_balances SET quantity=quantity+NEW.quantity WHERE tenant_id=NEW.tenant_id AND company_id=h.company_id AND product_id=NEW.product_id AND location_id=NEW.location_id AND batch=NEW.batch AND serial=NEW.serial;IF NOT FOUND THEN RAISE EXCEPTION 'Bestandszeile fehlt';END IF;END IF;
 UPDATE stock_reservations SET consumed_quantity=consumed_quantity+direction*NEW.quantity,status=CASE WHEN status='CANCELLED' THEN status WHEN consumed_quantity+direction*NEW.quantity=quantity THEN 'CONSUMED' ELSE 'ACTIVE' END,version=version+1 WHERE tenant_id=NEW.tenant_id AND id=NEW.reservation_id;
 IF direction=1 THEN
 UPDATE stock_balances SET quantity=quantity-direction*NEW.quantity WHERE tenant_id=NEW.tenant_id AND company_id=h.company_id AND product_id=NEW.product_id AND location_id=NEW.location_id AND batch=NEW.batch AND serial=NEW.serial;
 IF NOT FOUND THEN RAISE EXCEPTION 'Bestandszeile fehlt';END IF;
 END IF;
 UPDATE inventory_valuations SET quantity=quantity-direction*NEW.quantity,value=value-direction*NEW.value,inventory_account_id=CASE WHEN value-direction*NEW.value=0 THEN NULL WHEN direction=-1 AND NEW.value>0 THEN original_account ELSE inventory_account_id END WHERE tenant_id=NEW.tenant_id AND company_id=h.company_id AND product_id=NEW.product_id;
 RETURN NEW;
END$$;
CREATE TRIGGER issue_projection AFTER INSERT ON goods_issue_items FOR EACH ROW EXECUTE FUNCTION apply_goods_issue_item();
-- Same sealing rule as receipts, but applied to the issue header.
CREATE FUNCTION protect_goods_issue() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
 IF TG_OP='UPDATE' AND NOT OLD.sealed AND NEW.sealed AND (to_jsonb(OLD)-'sealed')=(to_jsonb(NEW)-'sealed') THEN RETURN NEW;END IF;RAISE EXCEPTION 'Gebuchter Warenausgang ist unveränderlich; Gegenbewegung verwenden';END$$;
CREATE TRIGGER immutable_issue BEFORE UPDATE OR DELETE ON goods_issues FOR EACH ROW EXECUTE FUNCTION protect_goods_issue();
CREATE TRIGGER immutable_issue_item BEFORE UPDATE OR DELETE ON goods_issue_items FOR EACH ROW EXECUTE FUNCTION protect_inventory_document();
CREATE FUNCTION goods_issue_signature(tenant uuid,issue uuid) RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.reservation_id,s.order_item_id,s.product_id,s.location_id,s.batch,s.serial),'[]'::jsonb) FROM (SELECT reservation_id,order_item_id,product_id,location_id,batch,serial,sum(quantity) AS quantity,sum(value) AS value FROM goods_issue_items WHERE tenant_id=tenant AND issue_id=issue GROUP BY reservation_id,order_item_id,product_id,location_id,batch,serial) s
$$;
CREATE FUNCTION journal_cost_signature(tenant uuid,journal uuid,opposite boolean) RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.account_id,s.side,s.cost_center NULLS FIRST,s.partner_id NULLS FIRST,s.tax_code NULLS FIRST),'[]'::jsonb) FROM (SELECT account_id,cost_center,partner_id,tax_code,CASE WHEN opposite THEN CASE WHEN side='DEBIT' THEN 'CREDIT' ELSE 'DEBIT' END ELSE side END AS side,sum(amount) AS amount FROM journal_entries WHERE tenant_id=tenant AND journal_id=journal GROUP BY account_id,cost_center,partner_id,tax_code,side) s
$$;
CREATE FUNCTION validate_goods_issue() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE h goods_issues;original goods_issues;total numeric;counter_journal uuid;source_journal uuid;BEGIN
 SELECT * INTO STRICT h FROM goods_issues WHERE tenant_id=NEW.tenant_id AND id=NEW.id;
 SELECT sum(value) INTO total FROM goods_issue_items WHERE tenant_id=h.tenant_id AND issue_id=h.id;
 IF NOT EXISTS(SELECT 1 FROM work_order_tasks w JOIN tickets t ON t.tenant_id=w.tenant_id AND t.id=w.ticket_id WHERE w.tenant_id=h.tenant_id AND w.id=h.task_id AND w.order_id=h.order_id AND w.ticket_id=h.ticket_id AND w.worker_id=h.worker_id AND w.correlation_id=h.correlation_id AND t.correlation_id=h.correlation_id) THEN RAISE EXCEPTION 'Aufgabe, Auftrag und Ticketkorrelation stimmen nicht überein';END IF;
 IF NOT h.sealed OR total IS NULL THEN RAISE EXCEPTION 'Warenausgang ist unvollständig';END IF;
 IF h.movement_type='ISSUE_REVERSAL' THEN
  SELECT * INTO STRICT original FROM goods_issues WHERE tenant_id=h.tenant_id AND id=h.reverses_id;
  IF original.movement_type<>'ISSUE' OR original.order_id<>h.order_id OR original.task_id<>h.task_id OR original.company_id<>h.company_id OR original.currency<>h.currency OR goods_issue_signature(h.tenant_id,h.id) IS DISTINCT FROM goods_issue_signature(h.tenant_id,original.id) THEN RAISE EXCEPTION 'Gegenbewegung stimmt nicht vollständig mit Ursprung überein';END IF;
  IF EXISTS(SELECT 1 FROM goods_issue_items gi JOIN service_report_lines l ON l.tenant_id=gi.tenant_id AND l.goods_issue_item_id=gi.id JOIN service_reports sr ON sr.tenant_id=l.tenant_id AND sr.id=l.report_id WHERE gi.tenant_id=h.tenant_id AND gi.issue_id=original.id AND sr.status NOT IN ('REJECTED','CANCELLED')) THEN RAISE EXCEPTION 'Materialverbrauch ist bereits aktiv rückgemeldet';END IF;
  IF total>0 THEN
   SELECT id INTO STRICT source_journal FROM journals WHERE tenant_id=h.tenant_id AND source_id=original.id AND status='POSTED';
   SELECT id INTO STRICT counter_journal FROM journals WHERE tenant_id=h.tenant_id AND source_id=h.id AND reversal_of=source_journal AND status='POSTED';
   IF journal_cost_signature(h.tenant_id,counter_journal,false) IS DISTINCT FROM journal_cost_signature(h.tenant_id,source_journal,true) THEN RAISE EXCEPTION 'Gegenbuchung verwendet nicht die ursprünglichen Konten und Werte';END IF;
  END IF;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM fiscal_periods p JOIN company_codes c ON c.tenant_id=p.tenant_id AND c.id=p.company_id WHERE p.tenant_id=h.tenant_id AND p.id=h.period_id AND c.id=h.company_id AND c.currency=h.currency AND p.status='OPEN' AND h.posting_date BETWEEN p.date_from AND p.date_to) THEN RAISE EXCEPTION 'Offene passende Buchungsperiode fehlt';END IF;
 IF total>0 AND NOT EXISTS(SELECT 1 FROM journals j WHERE j.tenant_id=h.tenant_id AND j.source_id=h.id AND j.company_id=h.company_id AND j.currency=h.currency AND j.status='POSTED' AND j.posting_date=h.posting_date AND (SELECT sum(amount) FROM journal_entries e WHERE e.tenant_id=j.tenant_id AND e.journal_id=j.id AND e.side='DEBIT')=total) THEN RAISE EXCEPTION 'Passender Finanzbeleg zum Verbrauch fehlt';END IF;
 RETURN NULL;
END$$;
CREATE CONSTRAINT TRIGGER issue_complete AFTER INSERT OR UPDATE ON goods_issues DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_goods_issue();
DO $$DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['goods_issues','goods_issue_items'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);EXECUTE format('CREATE POLICY tenant_isolation ON %I USING(tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid) WITH CHECK(tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid)',t);
END LOOP;END$$;
ALTER TABLE service_report_lines ADD COLUMN goods_issue_item_id uuid;
ALTER TABLE service_report_lines ADD FOREIGN KEY(tenant_id,goods_issue_item_id) REFERENCES goods_issue_items(tenant_id,id);
ALTER TABLE service_report_lines DROP CONSTRAINT service_report_lines_check;
ALTER TABLE service_report_lines ADD CHECK(num_nonnulls(time_entry_id,charge_id,goods_issue_item_id)=1);
CREATE UNIQUE INDEX one_issue_line_per_report ON service_report_lines(tenant_id,report_id,goods_issue_item_id) WHERE goods_issue_item_id IS NOT NULL;
CREATE FUNCTION protect_report_actual_source() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE r service_reports;BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Rückmeldungspositionen sind unveränderlich; Nachweis korrigieren';END IF;
 SELECT * INTO STRICT r FROM service_reports WHERE tenant_id=NEW.tenant_id AND id=NEW.report_id;
 IF r.status<>'DRAFT' OR NOT EXISTS(SELECT 1 FROM service_order_items WHERE tenant_id=NEW.tenant_id AND id=NEW.item_id AND order_id=r.order_id) THEN RAISE EXCEPTION 'Rückmeldungsposition benötigt passenden Entwurf';END IF;
 IF NEW.time_entry_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM time_entries t WHERE t.tenant_id=NEW.tenant_id AND t.id=NEW.time_entry_id AND t.task_id=r.task_id AND t.ticket_id=r.ticket_id AND t.order_id=r.order_id AND t.item_id=NEW.item_id AND t.worker_id=r.author_id AND t.status='RECORDED' AND t.report_id IS NULL AND t.quantity=NEW.quantity) THEN RAISE EXCEPTION 'Tatsächliche Ticketzeit stimmt nicht überein';END IF;
 IF NEW.charge_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM ticket_charges c WHERE c.tenant_id=NEW.tenant_id AND c.id=NEW.charge_id AND c.task_id=r.task_id AND c.ticket_id=r.ticket_id AND c.order_id=r.order_id AND c.item_id=NEW.item_id AND c.worker_id=r.author_id AND c.status='RECORDED' AND c.report_id IS NULL AND c.quantity=NEW.quantity) THEN RAISE EXCEPTION 'Tatsächliche Ticketleistung stimmt nicht überein';END IF;
 IF NEW.goods_issue_item_id IS NOT NULL THEN
  IF NOT EXISTS(SELECT 1 FROM goods_issue_items gi JOIN goods_issues g ON g.tenant_id=gi.tenant_id AND g.id=gi.issue_id WHERE gi.tenant_id=NEW.tenant_id AND gi.id=NEW.goods_issue_item_id AND gi.order_item_id=NEW.item_id AND gi.quantity=NEW.quantity AND gi.value=(NEW.snapshot->>'value')::numeric AND g.currency=NEW.snapshot->>'currency' AND g.order_id=r.order_id AND g.ticket_id=r.ticket_id AND g.task_id=r.task_id AND g.worker_id=r.author_id AND g.correlation_id=r.correlation_id AND g.sealed AND g.movement_type='ISSUE' AND NOT EXISTS(SELECT 1 FROM goods_issues rev WHERE rev.tenant_id=g.tenant_id AND rev.reverses_id=g.id)) THEN RAISE EXCEPTION 'Tatsächlicher Materialverbrauch stimmt nicht überein';END IF;
  IF EXISTS(SELECT 1 FROM service_report_lines l JOIN service_reports sr ON sr.tenant_id=l.tenant_id AND sr.id=l.report_id WHERE l.tenant_id=NEW.tenant_id AND l.goods_issue_item_id=NEW.goods_issue_item_id AND sr.status NOT IN ('CANCELLED','REJECTED')) THEN RAISE EXCEPTION 'Materialverbrauch bereits aktiv rückgemeldet';END IF;
 END IF;RETURN NEW;
END$$;
CREATE TRIGGER report_actual_source BEFORE INSERT OR UPDATE OR DELETE ON service_report_lines FOR EACH ROW EXECUTE FUNCTION protect_report_actual_source();
