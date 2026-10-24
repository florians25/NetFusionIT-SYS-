-- Explicit RT authorisation and independently dated physical receipts. Originals stay immutable.
ALTER TABLE documents DROP CONSTRAINT documents_kind_check;
ALTER TABLE documents ADD CONSTRAINT documents_kind_check CHECK(kind IN('WORK_ORDER_TASK','TICKET','SERVICE_CASE','BUSINESS_PARTNER','APPROVAL','TECHNICAL_OBJECT','SERVICE_CONTRACT','FIELD_VISIT','SERVICE_ORDER','MATERIAL','MATERIAL_REQUIREMENT','REQUISITION','PURCHASE_ORDER','GOODS_RECEIPT','GOODS_ISSUE','SERVICE_REPORT','INVOICE','CANCELLATION','ACCOUNTING','PAYMENT','QUOTATION','SALES_ORDER','CREDIT_NOTE','BILLING_REQUEST','PARTNER_ACCOUNT','COMPANY_BILLING_PROFILE','SUPPLIER_INVOICE','SUPPLIER_INVOICE_REVERSAL','STOCK_TRANSFER','INVENTORY_COUNT','CUSTOMER_RETURN','CUSTOMER_RETURN_RECEIPT'));
CREATE TABLE customer_returns(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,company_id uuid NOT NULL,issue_id uuid NOT NULL,sales_order_id uuid NOT NULL,
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN('DRAFT','RELEASED','CANCELLED')),version integer NOT NULL DEFAULT 1,
 requested_date date NOT NULL,reason text NOT NULL CHECK(length(reason) BETWEEN 15 AND 2000),reference text NOT NULL DEFAULT '',cancel_reason text,
 UNIQUE(tenant_id,id),FOREIGN KEY(tenant_id,id) REFERENCES documents(tenant_id,id),FOREIGN KEY(tenant_id,company_id) REFERENCES company_codes(tenant_id,id),FOREIGN KEY(tenant_id,issue_id) REFERENCES goods_issues(tenant_id,id),FOREIGN KEY(tenant_id,sales_order_id) REFERENCES sales_orders(tenant_id,id),CHECK((status='CANCELLED')=(cancel_reason IS NOT NULL))
);
CREATE TABLE customer_return_lines(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,return_id uuid NOT NULL,issue_item_id uuid NOT NULL,quantity numeric(24,6) NOT NULL CHECK(quantity>0),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,return_id,issue_item_id),FOREIGN KEY(tenant_id,return_id) REFERENCES customer_returns(tenant_id,id),FOREIGN KEY(tenant_id,issue_item_id) REFERENCES goods_issue_items(tenant_id,id)
);
CREATE TABLE customer_return_receipts(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,return_id uuid NOT NULL,company_id uuid NOT NULL,period_id uuid NOT NULL,posting_date date NOT NULL,document_date date NOT NULL,received_date date NOT NULL,
 movement_type text NOT NULL CHECK(movement_type IN('RECEIPT','REVERSAL')),reverses_id uuid,reason text NOT NULL CHECK(length(reason) BETWEEN 15 AND 2000),journal_id uuid,sealed boolean NOT NULL DEFAULT false,version integer NOT NULL DEFAULT 1,
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,reverses_id),FOREIGN KEY(tenant_id,id) REFERENCES documents(tenant_id,id),FOREIGN KEY(tenant_id,return_id) REFERENCES customer_returns(tenant_id,id),FOREIGN KEY(tenant_id,company_id) REFERENCES company_codes(tenant_id,id),FOREIGN KEY(tenant_id,period_id) REFERENCES fiscal_periods(tenant_id,id),FOREIGN KEY(tenant_id,journal_id) REFERENCES journals(tenant_id,id),FOREIGN KEY(tenant_id,reverses_id) REFERENCES customer_return_receipts(tenant_id,id),CHECK((movement_type='REVERSAL')=(reverses_id IS NOT NULL))
);
CREATE TABLE customer_return_receipt_items(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,receipt_id uuid NOT NULL,return_line_id uuid NOT NULL,quantity numeric(24,6) NOT NULL CHECK(quantity>0),value numeric(24,2) NOT NULL CHECK(value>=0),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,receipt_id,return_line_id),FOREIGN KEY(tenant_id,receipt_id) REFERENCES customer_return_receipts(tenant_id,id),FOREIGN KEY(tenant_id,return_line_id) REFERENCES customer_return_lines(tenant_id,id)
);
DO $$DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['customer_returns','customer_return_lines','customer_return_receipts','customer_return_receipt_items'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY tenant_isolation ON %I USING(tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid) WITH CHECK(tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid)',t);
END LOOP;END$$;
CREATE TRIGGER customer_return_line_immutable BEFORE UPDATE OR DELETE ON customer_return_lines FOR EACH ROW EXECUTE FUNCTION reject_attachment_mutation();
CREATE TRIGGER customer_return_receipt_item_immutable BEFORE UPDATE OR DELETE ON customer_return_receipt_items FOR EACH ROW EXECUTE FUNCTION reject_attachment_mutation();
CREATE FUNCTION customer_return_received(t uuid,line uuid) RETURNS TABLE(quantity numeric,value numeric) LANGUAGE sql STABLE AS $$
 SELECT coalesce(sum(CASE h.movement_type WHEN 'RECEIPT' THEN i.quantity ELSE -i.quantity END),0),coalesce(sum(CASE h.movement_type WHEN 'RECEIPT' THEN i.value ELSE -i.value END),0) FROM customer_return_receipt_items i JOIN customer_return_receipts h ON h.tenant_id=i.tenant_id AND h.id=i.receipt_id WHERE i.tenant_id=t AND i.return_line_id=line
$$;
CREATE FUNCTION customer_return_credited(t uuid,item uuid,day date) RETURNS numeric LANGUAGE sql STABLE AS $$
 SELECT coalesce(sum(c.quantity),0) FROM invoice_items ii JOIN billing_request_lines bl ON bl.tenant_id=ii.tenant_id AND bl.id=ii.request_line_id CROSS JOIN LATERAL customer_credit_amounts(t,ii.id,NULL,day) c WHERE ii.tenant_id=t AND bl.goods_issue_item_id=item
$$;
CREATE FUNCTION customer_return_guard() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE h customer_returns;g goods_issues;gi goods_issue_items;q numeric;BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Retouren bleiben als Vorgang erhalten';END IF;
 IF TG_TABLE_NAME='customer_return_lines' THEN SELECT * INTO STRICT h FROM customer_returns WHERE tenant_id=NEW.tenant_id AND id=NEW.return_id;ELSE h=NEW;END IF;
 PERFORM 1 FROM company_codes WHERE tenant_id=h.tenant_id AND id=h.company_id FOR UPDATE;
 SELECT * INTO STRICT g FROM goods_issues WHERE tenant_id=h.tenant_id AND id=h.issue_id FOR UPDATE;
 IF NOT g.sealed OR g.movement_type<>'ISSUE' OR g.sales_order_id IS DISTINCT FROM h.sales_order_id OR g.company_id<>h.company_id OR EXISTS(SELECT 1 FROM goods_issues WHERE tenant_id=g.tenant_id AND reverses_id=g.id) THEN RAISE EXCEPTION 'Retoure benötigt tatsächliche, ungestornierte Direktvertriebslieferung';END IF;
 IF NOT EXISTS(SELECT 1 FROM documents d JOIN documents src ON src.tenant_id=d.tenant_id AND src.id=g.id WHERE d.tenant_id=h.tenant_id AND d.id=h.id AND d.kind='CUSTOMER_RETURN' AND d.organization_id=src.organization_id) THEN RAISE EXCEPTION 'Retourenorganisation passt nicht zur Lieferung';END IF;
 IF TG_TABLE_NAME='customer_returns' AND TG_OP='INSERT' THEN IF h.status<>'DRAFT' OR h.version<>1 THEN RAISE EXCEPTION 'Retoure beginnt als Entwurf';END IF;END IF;
 IF TG_TABLE_NAME='customer_return_lines' THEN
  IF h.status<>'DRAFT' THEN RAISE EXCEPTION 'Nur offener Retourenentwurf erhält Positionen';END IF;
  SELECT * INTO STRICT gi FROM goods_issue_items WHERE tenant_id=NEW.tenant_id AND id=NEW.issue_item_id;
  SELECT coalesce(sum(l.quantity),0) INTO q FROM customer_return_lines l JOIN customer_returns r ON r.tenant_id=l.tenant_id AND r.id=l.return_id WHERE l.tenant_id=h.tenant_id AND l.issue_item_id=gi.id AND r.status<>'CANCELLED';
  IF gi.issue_id<>h.issue_id OR q+NEW.quantity>gi.quantity OR (gi.serial<>'' AND NEW.quantity<>1) THEN RAISE EXCEPTION 'Retourenanmeldung überschreitet ungebundene Liefermenge oder teilt Seriennummer';END IF;
 ELSIF TG_OP='UPDATE' THEN
  IF (NEW.id,NEW.tenant_id,NEW.company_id,NEW.issue_id,NEW.sales_order_id,NEW.requested_date,NEW.reason,NEW.reference) IS DISTINCT FROM (OLD.id,OLD.tenant_id,OLD.company_id,OLD.issue_id,OLD.sales_order_id,OLD.requested_date,OLD.reason,OLD.reference) OR OLD.status='CANCELLED' OR NEW.version<>OLD.version+1 OR NOT((NEW.status=OLD.status AND NEW.cancel_reason IS NOT DISTINCT FROM OLD.cancel_reason) OR (OLD.status='DRAFT' AND NEW.status IN('RELEASED','CANCELLED')) OR (OLD.status='RELEASED' AND NEW.status='CANCELLED')) THEN RAISE EXCEPTION 'Retourenursprung bleibt unveränderlich; zulässigen Statuswechsel verwenden';END IF;
  IF NEW.status='RELEASED' AND NOT EXISTS(SELECT 1 FROM customer_return_lines WHERE tenant_id=NEW.tenant_id AND return_id=NEW.id) THEN RAISE EXCEPTION 'Retourenpositionen fehlen';END IF;
  IF NEW.status='CANCELLED' AND EXISTS(SELECT 1 FROM customer_return_lines l CROSS JOIN LATERAL customer_return_received(l.tenant_id,l.id) r WHERE l.tenant_id=NEW.tenant_id AND l.return_id=NEW.id AND r.quantity<>0) THEN RAISE EXCEPTION 'Tatsächliche Retoureneingänge zuerst stornieren';END IF;
 END IF;RETURN NEW;
END$$;
CREATE TRIGGER customer_return_guard BEFORE INSERT OR UPDATE OR DELETE ON customer_returns FOR EACH ROW EXECUTE FUNCTION customer_return_guard();
CREATE TRIGGER customer_return_line_guard BEFORE INSERT ON customer_return_lines FOR EACH ROW EXECUTE FUNCTION customer_return_guard();
-- Physical ledger entries retain all original tracking dimensions.
ALTER TABLE warehouse_bin_entries ADD COLUMN return_item_id uuid,ADD FOREIGN KEY(tenant_id,return_item_id) REFERENCES customer_return_receipt_items(tenant_id,id),ADD UNIQUE(tenant_id,return_item_id);
DO $$DECLARE c record;BEGIN FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='warehouse_bin_entries'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%num_nonnulls%' LOOP EXECUTE format('ALTER TABLE warehouse_bin_entries DROP CONSTRAINT %I',c.conname);END LOOP;END$$;
ALTER TABLE warehouse_bin_entries ADD CHECK(num_nonnulls(receipt_item_id,issue_item_id,transfer_item_id,count_movement_id,return_item_id)=1);
CREATE FUNCTION customer_return_bin_guard() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
 IF NEW.return_item_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM customer_return_receipt_items i JOIN customer_return_receipts h ON h.tenant_id=i.tenant_id AND h.id=i.receipt_id JOIN customer_return_lines l ON l.tenant_id=i.tenant_id AND l.id=i.return_line_id JOIN goods_issue_items gi ON gi.tenant_id=l.tenant_id AND gi.id=l.issue_item_id WHERE i.tenant_id=NEW.tenant_id AND i.id=NEW.return_item_id AND h.company_id=NEW.company_id AND gi.bin_id=NEW.bin_id AND gi.product_id=NEW.product_id AND gi.batch=NEW.batch AND gi.serial=NEW.serial AND NEW.quantity=CASE h.movement_type WHEN 'RECEIPT' THEN i.quantity ELSE -i.quantity END) THEN RAISE EXCEPTION 'Retourenplatzbewegung passt nicht zur Originalauslieferung';END IF;RETURN NEW;
END$$;
CREATE TRIGGER customer_return_bin_guard BEFORE INSERT ON warehouse_bin_entries FOR EACH ROW EXECUTE FUNCTION customer_return_bin_guard();
CREATE FUNCTION direct_issue_journal(t uuid,issue uuid) RETURNS uuid LANGUAGE sql STABLE AS $$SELECT id FROM journals WHERE tenant_id=t AND source_id=issue AND status='POSTED'$$;
CREATE FUNCTION customer_return_apply() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE h customer_return_receipts;r customer_returns;l customer_return_lines;gi goods_issue_items;g goods_issues;prior record;q numeric;v numeric;credit numeric;sgn integer;account uuid;old customer_return_receipt_items;BEGIN
 IF NEW.tenant_id IS DISTINCT FROM nullif(current_setting('app.tenant_id',true),'')::uuid THEN RAISE EXCEPTION 'Mandantenkontext fehlt';END IF;
 SELECT * INTO STRICT h FROM customer_return_receipts WHERE tenant_id=NEW.tenant_id AND id=NEW.receipt_id;
 PERFORM 1 FROM company_codes WHERE tenant_id=h.tenant_id AND id=h.company_id FOR UPDATE;
 SELECT * INTO STRICT r FROM customer_returns WHERE tenant_id=h.tenant_id AND id=h.return_id FOR UPDATE;
 SELECT * INTO STRICT l FROM customer_return_lines WHERE tenant_id=NEW.tenant_id AND id=NEW.return_line_id;
 SELECT * INTO STRICT gi FROM goods_issue_items WHERE tenant_id=l.tenant_id AND id=l.issue_item_id;SELECT * INTO STRICT g FROM goods_issues WHERE tenant_id=gi.tenant_id AND id=gi.issue_id;
 IF h.sealed OR r.status<>'RELEASED' OR l.return_id<>r.id OR h.company_id<>r.company_id OR EXISTS(SELECT 1 FROM goods_issues WHERE tenant_id=g.tenant_id AND reverses_id=g.id) THEN RAISE EXCEPTION 'Freigegebene tatsächliche Retoure erforderlich';END IF;
 IF EXISTS(SELECT 1 FROM inventory_count_scopes WHERE tenant_id=gi.tenant_id AND bin_id=gi.bin_id AND released_at IS NULL) THEN RAISE EXCEPTION 'Retourenfach ist für Inventur gesperrt';END IF;
 SELECT * INTO prior FROM customer_return_received(l.tenant_id,l.id);prior.quantity=prior.quantity-CASE h.movement_type WHEN 'RECEIPT' THEN NEW.quantity ELSE -NEW.quantity END;
 IF h.movement_type='RECEIPT' THEN
  IF prior.quantity+NEW.quantity>l.quantity OR (gi.serial<>'' AND NEW.quantity<>1) THEN RAISE EXCEPTION 'Retoureneingang überschreitet offene tatsächliche Anmeldemenge';END IF;
  SELECT coalesce(sum(a.quantity),0),coalesce(sum(a.value),0) INTO q,v FROM customer_return_lines x CROSS JOIN LATERAL customer_return_received(x.tenant_id,x.id) a WHERE x.tenant_id=gi.tenant_id AND x.issue_item_id=gi.id;
  q=q-NEW.quantity;v=v-NEW.value;
  credit=customer_return_credited(gi.tenant_id,gi.id,h.posting_date);
  IF q+NEW.quantity>credit THEN RAISE EXCEPTION 'Retoureneingang benötigt zuvor gebuchte Gutschrift der tatsächlichen Menge';END IF;
  IF NEW.value<>round(gi.value*(q+NEW.quantity)/gi.quantity,2)-v THEN RAISE EXCEPTION 'Retourenbewertung muss ursprünglichen Warenwert centgenau anteilig fortschreiben';END IF;sgn=1;
 ELSE
  SELECT * INTO STRICT old FROM customer_return_receipt_items WHERE tenant_id=h.tenant_id AND receipt_id=h.reverses_id AND return_line_id=l.id;
  IF NEW.quantity<>old.quantity OR NEW.value<>old.value OR prior.quantity<NEW.quantity THEN RAISE EXCEPTION 'Retourenstorno muss genau den Originaleingang gegenbuchen';END IF;sgn=-1;
 END IF;
 SELECT account_id INTO account FROM journal_entries WHERE tenant_id=g.tenant_id AND journal_id=direct_issue_journal(g.tenant_id,g.id) AND side='CREDIT';
 IF gi.value>0 AND NOT EXISTS(SELECT 1 FROM inventory_valuations WHERE tenant_id=gi.tenant_id AND company_id=h.company_id AND product_id=gi.product_id AND inventory_account_id=account) THEN RAISE EXCEPTION 'Historisches Bestandskonto hat sich geändert';END IF;
 UPDATE stock_balances SET quantity=quantity+sgn*NEW.quantity WHERE tenant_id=gi.tenant_id AND company_id=h.company_id AND product_id=gi.product_id AND location_id=gi.location_id AND batch=gi.batch AND serial=gi.serial;
 IF NOT FOUND THEN RAISE EXCEPTION 'Ursprünglicher Lagerbestand fehlt';END IF;
 UPDATE inventory_valuations SET quantity=quantity+sgn*NEW.quantity,value=value+sgn*NEW.value WHERE tenant_id=gi.tenant_id AND company_id=h.company_id AND product_id=gi.product_id;
 IF EXISTS(SELECT 1 FROM inventory_valuations WHERE tenant_id=gi.tenant_id AND company_id=h.company_id AND product_id=gi.product_id AND (value<0 OR (quantity=0 AND value<>0))) THEN RAISE EXCEPTION 'Retourenstorno würde ursprüngliche Bewertung unterschreiten';END IF;
 INSERT INTO warehouse_bin_entries(id,tenant_id,company_id,bin_id,product_id,batch,serial,quantity,return_item_id) VALUES(gen_random_uuid(),gi.tenant_id,h.company_id,gi.bin_id,gi.product_id,gi.batch,gi.serial,sgn*NEW.quantity,NEW.id);RETURN NEW;
END$$;
CREATE TRIGGER customer_return_receipt_projection AFTER INSERT ON customer_return_receipt_items FOR EACH ROW EXECUTE FUNCTION customer_return_apply();
CREATE FUNCTION customer_return_journal_lines(t uuid,receipt uuid) RETURNS jsonb LANGUAGE sql STABLE AS $$
 WITH h AS(SELECT * FROM customer_return_receipts WHERE tenant_id=t AND id=receipt),original AS(
 SELECT i.value,gi.position,e.account_id,e.cost_center,e.partner_id,e.tax_code,e.description,direct_issue_journal(g.tenant_id,g.id) AS journal_id FROM customer_return_receipt_items i JOIN customer_return_lines l ON l.tenant_id=i.tenant_id AND l.id=i.return_line_id JOIN goods_issue_items gi ON gi.tenant_id=l.tenant_id AND gi.id=l.issue_item_id JOIN goods_issues g ON g.tenant_id=gi.tenant_id AND g.id=gi.issue_id JOIN journal_entries e ON e.tenant_id=g.tenant_id AND e.journal_id=direct_issue_journal(g.tenant_id,g.id) AND e.side='DEBIT' AND e.position=10*(SELECT count(*) FROM goods_issue_items x WHERE x.tenant_id=gi.tenant_id AND x.issue_id=gi.issue_id AND x.position<=gi.position AND x.value>0) WHERE i.tenant_id=t AND i.receipt_id=receipt AND i.value>0
 ),lines AS(
 SELECT o.position,o.account_id,'CREDIT' AS side,o.value AS amount,o.description,o.cost_center,o.partner_id,o.tax_code FROM original o,h WHERE h.movement_type='RECEIPT'
 UNION ALL SELECT 100000,e.account_id,'DEBIT',sum(o.value),'Bestandsrücknahme',NULL::text,NULL::uuid,NULL::text FROM original o,h JOIN journal_entries e ON e.tenant_id=t AND e.journal_id=(SELECT direct_issue_journal(g.tenant_id,g.id) FROM goods_issues g JOIN customer_returns r ON r.tenant_id=g.tenant_id AND r.issue_id=g.id WHERE r.tenant_id=t AND r.id=h.return_id) AND e.side='CREDIT' WHERE h.movement_type='RECEIPT' GROUP BY e.account_id
 UNION ALL SELECT e.position,e.account_id,CASE e.side WHEN 'DEBIT' THEN 'CREDIT' ELSE 'DEBIT' END,e.amount,e.description,e.cost_center,e.partner_id,e.tax_code FROM h JOIN customer_return_receipts old ON old.tenant_id=h.tenant_id AND old.id=h.reverses_id JOIN journal_entries e ON e.tenant_id=old.tenant_id AND e.journal_id=old.journal_id WHERE h.movement_type='REVERSAL'
 ) SELECT coalesce(jsonb_agg(jsonb_build_object('accountId',account_id,'side',side,'amount',amount::numeric(24,2)::text,'description',description,'costCenter',cost_center,'partnerId',partner_id,'taxCode',tax_code) ORDER BY position),'[]'::jsonb) FROM lines WHERE amount>0
$$;
CREATE FUNCTION customer_return_receipt_guard() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE r customer_returns;original_receipt customer_return_receipts;BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Retoureneingänge bleiben unveränderlich';END IF;
 IF TG_OP='UPDATE' THEN
  IF OLD.sealed OR NOT NEW.sealed OR (NEW.id,NEW.tenant_id,NEW.return_id,NEW.company_id,NEW.period_id,NEW.posting_date,NEW.document_date,NEW.received_date,NEW.movement_type,NEW.reverses_id,NEW.reason) IS DISTINCT FROM (OLD.id,OLD.tenant_id,OLD.return_id,OLD.company_id,OLD.period_id,OLD.posting_date,OLD.document_date,OLD.received_date,OLD.movement_type,OLD.reverses_id,OLD.reason) THEN RAISE EXCEPTION 'Gebuchter Retoureneingang bleibt unveränderlich';END IF;
 END IF;
 SELECT * INTO STRICT r FROM customer_returns WHERE tenant_id=NEW.tenant_id AND id=NEW.return_id;
 IF NEW.company_id<>r.company_id OR NEW.posting_date<(SELECT posting_date FROM goods_issues WHERE tenant_id=r.tenant_id AND id=r.issue_id) OR NEW.posting_date<NEW.received_date OR NEW.received_date>(now() AT TIME ZONE 'Europe/Berlin')::date OR NOT EXISTS(SELECT 1 FROM fiscal_periods WHERE tenant_id=NEW.tenant_id AND id=NEW.period_id AND company_id=NEW.company_id AND status='OPEN' AND NEW.posting_date BETWEEN date_from AND date_to) THEN RAISE EXCEPTION 'Zulässiges Eingangsdatum und offene passende Periode erforderlich';END IF;
 IF NEW.movement_type='REVERSAL' THEN SELECT * INTO STRICT original_receipt FROM customer_return_receipts WHERE tenant_id=NEW.tenant_id AND id=NEW.reverses_id;IF original_receipt.return_id<>NEW.return_id OR original_receipt.movement_type<>'RECEIPT' OR NOT original_receipt.sealed OR NEW.posting_date<original_receipt.posting_date THEN RAISE EXCEPTION 'Retourenstorno benötigt ursprünglichen gebuchten Eingang';END IF;END IF;
 RETURN NEW;
END$$;
CREATE TRIGGER customer_return_receipt_guard BEFORE INSERT OR UPDATE OR DELETE ON customer_return_receipts FOR EACH ROW EXECUTE FUNCTION customer_return_receipt_guard();
CREATE FUNCTION customer_return_receipt_validate() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE h customer_return_receipts;j journals;expected jsonb;actual jsonb;old customer_return_receipts;BEGIN
 IF TG_TABLE_NAME='journals' THEN SELECT * INTO h FROM customer_return_receipts WHERE tenant_id=NEW.tenant_id AND id=NEW.source_id;IF h.id IS NULL THEN RETURN NULL;END IF;
 ELSIF TG_TABLE_NAME='customer_return_receipt_items' THEN SELECT * INTO h FROM customer_return_receipts WHERE tenant_id=NEW.tenant_id AND id=NEW.receipt_id;ELSE SELECT * INTO h FROM customer_return_receipts WHERE tenant_id=NEW.tenant_id AND id=NEW.id;END IF;
 IF NOT h.sealed OR NOT EXISTS(SELECT 1 FROM customer_return_receipt_items WHERE tenant_id=h.tenant_id AND receipt_id=h.id) OR NOT EXISTS(SELECT 1 FROM documents WHERE tenant_id=h.tenant_id AND id=h.id AND kind='CUSTOMER_RETURN_RECEIPT' AND organization_id=(SELECT organization_id FROM documents WHERE tenant_id=h.tenant_id AND id=h.return_id)) THEN RAISE EXCEPTION 'Vollständig gebuchter Retoureneingang mit tatsächlichen Positionen fehlt';END IF;
 IF h.movement_type='REVERSAL' AND EXISTS((SELECT return_line_id,quantity,value FROM customer_return_receipt_items WHERE tenant_id=h.tenant_id AND receipt_id=h.reverses_id EXCEPT ALL SELECT return_line_id,quantity,value FROM customer_return_receipt_items WHERE tenant_id=h.tenant_id AND receipt_id=h.id) UNION ALL(SELECT return_line_id,quantity,value FROM customer_return_receipt_items WHERE tenant_id=h.tenant_id AND receipt_id=h.id EXCEPT ALL SELECT return_line_id,quantity,value FROM customer_return_receipt_items WHERE tenant_id=h.tenant_id AND receipt_id=h.reverses_id)) THEN RAISE EXCEPTION 'Retourenstorno muss alle ursprünglichen Eingangspositionen enthalten';END IF;
 expected=customer_return_journal_lines(h.tenant_id,h.id);
 IF jsonb_array_length(expected)=0 THEN IF h.journal_id IS NOT NULL THEN RAISE EXCEPTION 'Unbewerteter Eingang hat keine Finanzbuchung';END IF;RETURN NULL;END IF;
 SELECT * INTO j FROM journals WHERE tenant_id=h.tenant_id AND id=h.journal_id;SELECT * INTO old FROM customer_return_receipts WHERE tenant_id=h.tenant_id AND id=h.reverses_id;
 IF j.id IS NULL OR j.status<>'POSTED' OR j.source_id IS DISTINCT FROM h.id OR j.company_id<>h.company_id OR j.period_id<>h.period_id OR j.posting_date<>h.posting_date OR j.document_date<>h.document_date OR j.reversal_of IS DISTINCT FROM (CASE WHEN h.movement_type='REVERSAL' THEN old.journal_id ELSE NULL END) THEN RAISE EXCEPTION 'Passende ursprüngliche Retouren-Finanzkontierung fehlt';END IF;
 SELECT jsonb_agg(jsonb_build_object('accountId',account_id,'side',side,'amount',amount::numeric(24,2)::text,'description',description,'costCenter',cost_center,'partnerId',partner_id,'taxCode',tax_code) ORDER BY position) INTO actual FROM journal_entries WHERE tenant_id=h.tenant_id AND journal_id=h.journal_id;
 IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Retouren-FI muss historische Bestands-/Aufwandskonten und tatsächliche Werte exakt buchen';END IF;
 RETURN NULL;
END$$;
CREATE CONSTRAINT TRIGGER customer_return_receipt_valid AFTER INSERT OR UPDATE ON customer_return_receipts DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION customer_return_receipt_validate();
CREATE CONSTRAINT TRIGGER customer_return_receipt_item_valid AFTER INSERT ON customer_return_receipt_items DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION customer_return_receipt_validate();
CREATE CONSTRAINT TRIGGER customer_return_journal_valid AFTER INSERT OR UPDATE ON journals DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION customer_return_receipt_validate();
-- Whole-WA cancellation cannot coexist with a genuine RT process.
CREATE OR REPLACE FUNCTION direct_issue_financially_closed(t uuid,issue uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT NOT EXISTS(SELECT 1 FROM customer_returns WHERE tenant_id=t AND issue_id=issue AND status<>'CANCELLED') AND NOT EXISTS(SELECT 1 FROM billing_request_lines l JOIN billing_requests r ON r.tenant_id=l.tenant_id AND r.id=l.request_id JOIN goods_issue_items gi ON gi.tenant_id=l.tenant_id AND gi.id=l.goods_issue_item_id WHERE l.tenant_id=t AND gi.issue_id=issue AND r.status NOT IN('CANCELLED','REJECTED') AND l.quantity<>(SELECT coalesce(sum(c.quantity),0) FROM invoice_items ii CROSS JOIN LATERAL customer_credit_amounts(t,ii.id) c WHERE ii.tenant_id=l.tenant_id AND ii.request_line_id=l.id))
$$;
