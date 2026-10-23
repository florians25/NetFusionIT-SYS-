-- Direct goods sales use the same reservation, valuation, bin and financial ledgers.
-- No service order, ticket, task or service report is invented for this source.
ALTER TABLE sales_orders ADD COLUMN execution_mode text NOT NULL DEFAULT 'SERVICE' CHECK(execution_mode IN('SERVICE','DIRECT_SALES'));
-- An accepted sales quotation already fixes its execution path.
ALTER TABLE sales_orders DISABLE TRIGGER USER;
UPDATE sales_orders h SET execution_mode='DIRECT_SALES' FROM service_quotes q WHERE q.tenant_id=h.tenant_id AND q.id=h.source_quote_id AND q.purpose='SALES_QUOTATION';
ALTER TABLE sales_orders ENABLE TRIGGER USER;
CREATE TABLE sales_order_fulfillment(
 tenant_id uuid NOT NULL,order_id uuid NOT NULL,version integer NOT NULL DEFAULT 1 CHECK(version>0),
 PRIMARY KEY(tenant_id,order_id),FOREIGN KEY(tenant_id,order_id) REFERENCES sales_orders(tenant_id,id)
);
ALTER TABLE sales_order_fulfillment ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_order_fulfillment FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON sales_order_fulfillment USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
INSERT INTO sales_order_fulfillment(tenant_id,order_id) SELECT tenant_id,id FROM sales_orders WHERE execution_mode='DIRECT_SALES' AND status='RELEASED';
CREATE FUNCTION direct_sales_order_guard() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
 IF TG_OP='UPDATE' AND NEW.execution_mode IS DISTINCT FROM OLD.execution_mode THEN RAISE EXCEPTION 'AU-Ausführungsweg bleibt unveränderlich; eigener Änderungsprozess erforderlich';END IF;
 IF NEW.source_quote_id IS NOT NULL AND NEW.execution_mode<>(SELECT CASE purpose WHEN 'SALES_QUOTATION' THEN 'DIRECT_SALES' ELSE 'SERVICE' END FROM service_quotes WHERE tenant_id=NEW.tenant_id AND id=NEW.source_quote_id) THEN RAISE EXCEPTION 'AU-Ausführungsweg muss zur tatsächlichen Angebotsart passen';END IF;
 RETURN NEW;
END$$;
CREATE TRIGGER direct_sales_mode BEFORE INSERT OR UPDATE ON sales_orders FOR EACH ROW EXECUTE FUNCTION direct_sales_order_guard();
CREATE FUNCTION direct_sales_release() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$BEGIN
 IF NEW.execution_mode='DIRECT_SALES' AND NEW.status='RELEASED' THEN
  IF NEW.approval_snapshot->'header'->>'executionMode' IS DISTINCT FROM NEW.execution_mode THEN RAISE EXCEPTION 'Freigabe muss den wirklichen AU-Ausführungsweg binden';END IF;
  INSERT INTO sales_order_fulfillment(tenant_id,order_id) VALUES(NEW.tenant_id,NEW.id) ON CONFLICT DO NOTHING;
 END IF;RETURN NEW;
END$$;
CREATE TRIGGER direct_sales_released AFTER INSERT OR UPDATE ON sales_orders FOR EACH ROW EXECUTE FUNCTION direct_sales_release();
CREATE FUNCTION direct_sales_forbid_service() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
 IF NEW.source_sales_order_id IS NOT NULL AND EXISTS(SELECT 1 FROM sales_orders WHERE tenant_id=NEW.tenant_id AND id=NEW.source_sales_order_id AND execution_mode='DIRECT_SALES') THEN RAISE EXCEPTION 'Direktvertrieb darf keinen künstlichen Serviceauftrag erzeugen';END IF;RETURN NEW;
END$$;
CREATE TRIGGER direct_sales_no_service BEFORE INSERT OR UPDATE ON service_orders FOR EACH ROW EXECUTE FUNCTION direct_sales_forbid_service();
ALTER TABLE stock_reservations ALTER COLUMN order_id DROP NOT NULL,ALTER COLUMN requirement_item_id DROP NOT NULL,
 ADD COLUMN sales_order_id uuid,ADD COLUMN sales_item_id uuid,ADD COLUMN sales_schedule_id uuid,
 ADD FOREIGN KEY(tenant_id,sales_order_id) REFERENCES sales_orders(tenant_id,id),
 ADD FOREIGN KEY(tenant_id,sales_item_id) REFERENCES sales_order_items(tenant_id,id),
 ADD FOREIGN KEY(tenant_id,sales_schedule_id) REFERENCES sales_order_schedules(tenant_id,id),
 ADD CHECK((order_id IS NOT NULL AND requirement_item_id IS NOT NULL AND sales_order_id IS NULL AND sales_item_id IS NULL AND sales_schedule_id IS NULL) OR (order_id IS NULL AND requirement_item_id IS NULL AND sales_order_id IS NOT NULL AND sales_item_id IS NOT NULL AND sales_schedule_id IS NOT NULL));
CREATE INDEX direct_sales_reservations ON stock_reservations(tenant_id,sales_order_id,sales_schedule_id);
CREATE FUNCTION direct_sales_reservation_guard() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE h sales_orders;l sales_order_items;s sales_order_schedules;claimed numeric;BEGIN
 IF NEW.sales_order_id IS NULL THEN RETURN NEW;END IF;
 IF TG_OP='UPDATE' THEN RETURN NEW;END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('DIRECT_SALES:'||NEW.tenant_id::text||':'||NEW.sales_order_id::text,0));
 SELECT * INTO STRICT h FROM sales_orders WHERE tenant_id=NEW.tenant_id AND id=NEW.sales_order_id;
 SELECT * INTO STRICT l FROM sales_order_items WHERE tenant_id=NEW.tenant_id AND id=NEW.sales_item_id;
 SELECT * INTO STRICT s FROM sales_order_schedules WHERE tenant_id=NEW.tenant_id AND id=NEW.sales_schedule_id;
 IF NEW.source<>'STOCK' OR NEW.source_receipt_id IS NOT NULL OR h.execution_mode<>'DIRECT_SALES' OR h.status<>'RELEASED' OR h.released_snapshot IS NULL OR h.company_id<>NEW.company_id OR h.currency<>(SELECT currency FROM company_codes WHERE tenant_id=h.tenant_id AND id=h.company_id) OR l.order_id<>h.id OR s.order_id<>h.id OR s.item_id<>l.id OR l.product_id<>NEW.product_id OR l.rejection_reason IS NOT NULL OR l.delivery_block IS NOT NULL OR h.delivery_block IS NOT NULL OR NOT EXISTS(SELECT 1 FROM products p JOIN documents d ON d.tenant_id=p.tenant_id AND d.id=p.id WHERE p.tenant_id=l.tenant_id AND p.id=l.product_id AND p.kind='STOCK' AND p.status='ACTIVE' AND p.unit=l.unit AND d.organization_id=h.organization_id) THEN RAISE EXCEPTION 'AU-Reservierung benötigt freigegebenen Direktvertrieb und eine tatsächliche Lagerposition/Einteilung';END IF;
 SELECT coalesce(sum(CASE WHEN status='CANCELLED' THEN consumed_quantity ELSE quantity END),0) INTO claimed FROM stock_reservations WHERE tenant_id=NEW.tenant_id AND sales_schedule_id=s.id;
 IF claimed+NEW.quantity>s.quantity THEN RAISE EXCEPTION 'AU-Reservierung überschreitet die noch offene Einteilungsmenge';END IF;
 RETURN NEW;
END$$;
CREATE TRIGGER direct_sales_reservation BEFORE INSERT OR UPDATE ON stock_reservations FOR EACH ROW EXECUTE FUNCTION direct_sales_reservation_guard();
ALTER TABLE goods_issues ALTER COLUMN order_id DROP NOT NULL,ALTER COLUMN ticket_id DROP NOT NULL,ALTER COLUMN task_id DROP NOT NULL,ALTER COLUMN worker_id DROP NOT NULL,ALTER COLUMN correlation_id DROP NOT NULL,
 ADD COLUMN sales_order_id uuid,ADD COLUMN delivery_date date,ADD FOREIGN KEY(tenant_id,sales_order_id) REFERENCES sales_orders(tenant_id,id),
 ADD CHECK((sales_order_id IS NULL AND order_id IS NOT NULL AND ticket_id IS NOT NULL AND task_id IS NOT NULL AND worker_id IS NOT NULL AND correlation_id IS NOT NULL) OR (sales_order_id IS NOT NULL AND order_id IS NULL AND ticket_id IS NULL AND task_id IS NULL AND worker_id IS NULL AND correlation_id IS NULL));
ALTER TABLE goods_issue_items ALTER COLUMN order_item_id DROP NOT NULL,
 ADD COLUMN sales_item_id uuid,ADD COLUMN sales_schedule_id uuid,
 ADD FOREIGN KEY(tenant_id,sales_item_id) REFERENCES sales_order_items(tenant_id,id),ADD FOREIGN KEY(tenant_id,sales_schedule_id) REFERENCES sales_order_schedules(tenant_id,id),
 ADD CHECK((order_item_id IS NOT NULL AND sales_item_id IS NULL AND sales_schedule_id IS NULL) OR (order_item_id IS NULL AND sales_item_id IS NOT NULL AND sales_schedule_id IS NOT NULL));
CREATE FUNCTION direct_sales_issue_header() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE h sales_orders;BEGIN
 IF NEW.sales_order_id IS NULL THEN RETURN NEW;END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('DIRECT_SALES:'||NEW.tenant_id::text||':'||NEW.sales_order_id::text,0));
 SELECT * INTO STRICT h FROM sales_orders WHERE tenant_id=NEW.tenant_id AND id=NEW.sales_order_id;
 IF (NEW.movement_type='ISSUE' AND (NEW.delivery_date IS NULL OR NEW.delivery_date>(now() AT TIME ZONE 'Europe/Berlin')::date)) OR h.status<>'RELEASED' OR h.execution_mode<>'DIRECT_SALES' OR h.released_snapshot IS NULL OR h.company_id<>NEW.company_id OR h.currency<>NEW.currency OR NOT EXISTS(SELECT 1 FROM documents d JOIN users u ON u.tenant_id=d.tenant_id AND u.id=d.created_by JOIN user_organizations o ON o.tenant_id=u.tenant_id AND o.user_id=u.id WHERE d.tenant_id=NEW.tenant_id AND d.id=NEW.id AND d.kind='GOODS_ISSUE' AND d.organization_id=h.organization_id AND u.active AND u.role IN('ADMIN','WAREHOUSE') AND o.organization_id=h.organization_id) THEN RAISE EXCEPTION 'AU-Auslieferung benötigt echten freigegebenen Warenauftrag und berechtigte Lagerbuchung';END IF;
 RETURN NEW;
END$$;
CREATE TRIGGER direct_sales_issue_source BEFORE INSERT ON goods_issues FOR EACH ROW EXECUTE FUNCTION direct_sales_issue_header();

CREATE OR REPLACE FUNCTION apply_goods_issue_item() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$DECLARE h goods_issues;r stock_reservations;direction integer;valuation inventory_valuations;digits integer;expected numeric;original_account uuid;BEGIN
 IF NEW.tenant_id IS DISTINCT FROM nullif(current_setting('app.tenant_id',true),'')::uuid THEN RAISE EXCEPTION 'Mandantenkontext fehlt';END IF;
 SELECT * INTO STRICT h FROM goods_issues WHERE tenant_id=NEW.tenant_id AND id=NEW.issue_id;IF h.sealed THEN RAISE EXCEPTION 'Materialbeleg ist abgeschlossen';END IF;
 SELECT * INTO STRICT r FROM stock_reservations WHERE tenant_id=NEW.tenant_id AND id=NEW.reservation_id FOR UPDATE;
 IF r.order_id IS DISTINCT FROM h.order_id OR r.sales_order_id IS DISTINCT FROM h.sales_order_id OR r.product_id<>NEW.product_id OR r.location_id<>NEW.location_id OR r.batch<>NEW.batch OR r.serial<>NEW.serial OR r.company_id<>h.company_id THEN RAISE EXCEPTION 'Auslieferung stimmt nicht mit Reservierung überein';END IF;
 IF h.sales_order_id IS NULL THEN
  IF NEW.order_item_id IS NULL OR r.requirement_item_id IS NULL OR NOT EXISTS(SELECT 1 FROM order_requirement_items WHERE tenant_id=r.tenant_id AND id=r.requirement_item_id AND order_item_id=NEW.order_item_id) THEN RAISE EXCEPTION 'Serviceauslieferung benötigt die tatsächliche Serviceposition';END IF;
 ELSE
  IF NEW.order_item_id IS NOT NULL OR NEW.sales_item_id IS DISTINCT FROM r.sales_item_id OR NEW.sales_schedule_id IS DISTINCT FROM r.sales_schedule_id THEN RAISE EXCEPTION 'Direkte Warenlieferung benötigt die reservierte AU-Position und Einteilung';END IF;
 END IF;
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
CREATE OR REPLACE FUNCTION validate_goods_issue() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE h goods_issues;original goods_issues;total numeric;counter_journal uuid;source_journal uuid;BEGIN
 SELECT * INTO STRICT h FROM goods_issues WHERE tenant_id=NEW.tenant_id AND id=NEW.id;
 SELECT sum(value) INTO total FROM goods_issue_items WHERE tenant_id=h.tenant_id AND issue_id=h.id;
 IF h.sales_order_id IS NULL THEN IF NOT EXISTS(SELECT 1 FROM work_order_tasks w JOIN tickets t ON t.tenant_id=w.tenant_id AND t.id=w.ticket_id WHERE w.tenant_id=h.tenant_id AND w.id=h.task_id AND w.order_id=h.order_id AND w.ticket_id=h.ticket_id AND w.worker_id=h.worker_id AND w.correlation_id=h.correlation_id AND t.correlation_id=h.correlation_id) THEN RAISE EXCEPTION 'Aufgabe, Auftrag und Ticketkorrelation stimmen nicht überein';END IF; ELSE
 IF NOT EXISTS(SELECT 1 FROM sales_orders WHERE tenant_id=h.tenant_id AND id=h.sales_order_id AND execution_mode='DIRECT_SALES' AND status='RELEASED' AND company_id=h.company_id AND currency=h.currency) THEN RAISE EXCEPTION 'Freigegebener Direktvertriebsauftrag fehlt';END IF;
 END IF;
 IF NOT h.sealed OR total IS NULL THEN RAISE EXCEPTION 'Warenausgang ist unvollständig';END IF;
 IF h.movement_type='ISSUE_REVERSAL' THEN
  SELECT * INTO STRICT original FROM goods_issues WHERE tenant_id=h.tenant_id AND id=h.reverses_id;
  IF original.movement_type<>'ISSUE' OR original.order_id IS DISTINCT FROM h.order_id OR original.sales_order_id IS DISTINCT FROM h.sales_order_id OR original.task_id IS DISTINCT FROM h.task_id OR original.company_id<>h.company_id OR original.currency<>h.currency OR goods_issue_signature(h.tenant_id,h.id) IS DISTINCT FROM goods_issue_signature(h.tenant_id,original.id) THEN RAISE EXCEPTION 'Gegenbewegung stimmt nicht vollständig mit Ursprung überein';END IF;
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
CREATE OR REPLACE FUNCTION sales_delivery_source_consistent() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE issue goods_issues;execution service_orders;commercial sales_orders;party jsonb;expected_receiver jsonb;BEGIN
 SELECT * INTO STRICT issue FROM goods_issues WHERE tenant_id=NEW.tenant_id AND id=NEW.id;IF issue.sales_order_id IS NOT NULL THEN SELECT * INTO STRICT commercial FROM sales_orders WHERE tenant_id=issue.tenant_id AND id=issue.sales_order_id;
 ELSE
 SELECT * INTO STRICT execution FROM service_orders WHERE tenant_id=issue.tenant_id AND id=issue.order_id;
 IF execution.source_sales_order_id IS NULL THEN IF issue.receiver_snapshot IS NOT NULL THEN RAISE EXCEPTION 'AU-Empfängersnapshot benötigt tatsächlichen AU-Folgeauftrag';END IF;RETURN NULL;END IF;
 SELECT * INTO STRICT commercial FROM sales_orders WHERE tenant_id=issue.tenant_id AND id=execution.source_sales_order_id;
 END IF;
 IF issue.movement_type='ISSUE' THEN
  SELECT x INTO party FROM jsonb_array_elements(commercial.released_snapshot->'commercial'->'partners') x WHERE x->>'role'='SHIP_TO';
  expected_receiver:=party||jsonb_build_object('salesOrderId',commercial.id,'salesOrderNumber',(SELECT number FROM documents WHERE tenant_id=commercial.tenant_id AND id=commercial.id));
 ELSE SELECT receiver_snapshot INTO expected_receiver FROM goods_issues WHERE tenant_id=issue.tenant_id AND id=issue.reverses_id;END IF;
 IF expected_receiver IS NULL OR issue.receiver_snapshot IS DISTINCT FROM expected_receiver THEN RAISE EXCEPTION 'Auslieferung muss den tatsächlich freigegebenen AU-Empfänger bzw. Originalempfänger erhalten';END IF;RETURN NULL;
END$$;

CREATE FUNCTION direct_issue_signature(tenant uuid,issue uuid) RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT coalesce(jsonb_agg(to_jsonb(i)-'id'-'issue_id' ORDER BY position),'[]'::jsonb) FROM goods_issue_items i WHERE tenant_id=tenant AND issue_id=issue
$$;
CREATE FUNCTION direct_issue_complete() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE h goods_issues;source goods_issues;BEGIN
 SELECT * INTO STRICT h FROM goods_issues WHERE tenant_id=NEW.tenant_id AND id=NEW.id;IF h.sales_order_id IS NULL THEN RETURN NULL;END IF;
 IF EXISTS(SELECT 1 FROM goods_issue_items i JOIN sales_order_items l ON l.tenant_id=i.tenant_id AND l.id=i.sales_item_id JOIN sales_order_schedules s ON s.tenant_id=i.tenant_id AND s.id=i.sales_schedule_id WHERE i.tenant_id=h.tenant_id AND i.issue_id=h.id AND (l.order_id<>h.sales_order_id OR s.order_id<>h.sales_order_id OR s.item_id<>l.id OR l.product_id<>i.product_id OR l.rejection_reason IS NOT NULL OR l.delivery_block IS NOT NULL)) THEN RAISE EXCEPTION 'Auslieferungsposition passt nicht zur tatsächlichen AU-Einteilung';END IF;
 IF h.movement_type='ISSUE_REVERSAL' THEN
  SELECT * INTO STRICT source FROM goods_issues WHERE tenant_id=h.tenant_id AND id=h.reverses_id;
  IF source.sales_order_id IS DISTINCT FROM h.sales_order_id OR source.movement_type<>'ISSUE' OR direct_issue_signature(h.tenant_id,h.id) IS DISTINCT FROM direct_issue_signature(h.tenant_id,source.id) THEN RAISE EXCEPTION 'AU-Gegenbewegung muss Ursprung, Einteilung, Fach, Tracking, Menge und Wert genau erhalten';END IF;
 END IF;RETURN NULL;
END$$;
CREATE CONSTRAINT TRIGGER direct_issue_consistent AFTER INSERT OR UPDATE ON goods_issues DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION direct_issue_complete();

CREATE FUNCTION direct_fulfillment_revision_guard() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'AU-Ausführungsstand bleibt erhalten';END IF;
 IF NEW.tenant_id IS DISTINCT FROM nullif(current_setting('app.tenant_id',true),'')::uuid THEN RAISE EXCEPTION 'Mandantenkontext fehlt';END IF;
 IF NOT EXISTS(SELECT 1 FROM sales_orders WHERE tenant_id=NEW.tenant_id AND id=NEW.order_id AND status='RELEASED' AND execution_mode='DIRECT_SALES') THEN RAISE EXCEPTION 'Ausführungsstand benötigt freigegebenen Direktvertrieb';END IF;
 IF TG_OP='UPDATE' AND ((to_jsonb(OLD)-'version') IS DISTINCT FROM (to_jsonb(NEW)-'version') OR NEW.version<>OLD.version+1) THEN RAISE EXCEPTION 'AU-Ausführungsrevision muss die unveränderte Quelle erhalten';END IF;RETURN NEW;
END$$;
CREATE TRIGGER direct_fulfillment_revision BEFORE INSERT OR UPDATE OR DELETE ON sales_order_fulfillment FOR EACH ROW EXECUTE FUNCTION direct_fulfillment_revision_guard();
