-- Direct sales keeps the existing billing, FI, open-item and immutable output ledgers.
ALTER TABLE billing_requests ALTER COLUMN order_id DROP NOT NULL;
ALTER TABLE billing_requests ADD COLUMN sales_order_id uuid;
ALTER TABLE billing_requests ADD FOREIGN KEY(tenant_id,sales_order_id) REFERENCES sales_orders(tenant_id,id);
ALTER TABLE billing_requests ADD CHECK((order_id IS NULL)<>(sales_order_id IS NULL));
ALTER TABLE invoices ALTER COLUMN order_id DROP NOT NULL;
ALTER TABLE invoices ADD COLUMN sales_order_id uuid;
ALTER TABLE invoices ADD FOREIGN KEY(tenant_id,sales_order_id) REFERENCES sales_orders(tenant_id,id);
ALTER TABLE invoices ADD CHECK((order_id IS NULL)<>(sales_order_id IS NULL));
ALTER TABLE billing_request_lines ALTER COLUMN item_id DROP NOT NULL;
ALTER TABLE billing_request_lines ADD COLUMN sales_item_id uuid;
ALTER TABLE billing_request_lines ADD COLUMN goods_issue_item_id uuid;
ALTER TABLE billing_request_lines ADD FOREIGN KEY(tenant_id,sales_item_id) REFERENCES sales_order_items(tenant_id,id);
ALTER TABLE billing_request_lines ADD FOREIGN KEY(tenant_id,goods_issue_item_id) REFERENCES goods_issue_items(tenant_id,id);
ALTER TABLE billing_request_lines DROP CONSTRAINT billing_request_lines_source_kind_check;
ALTER TABLE billing_request_lines DROP CONSTRAINT billing_request_lines_check1;
ALTER TABLE billing_request_lines ADD CHECK(source_kind IN ('TIME_MATERIAL','FIXED_PRICE','DELIVERY'));
ALTER TABLE billing_request_lines ADD CHECK((source_kind='DELIVERY' AND item_id IS NULL AND source_line_id IS NULL AND sales_item_id IS NOT NULL AND goods_issue_item_id IS NOT NULL) OR (source_kind IN ('TIME_MATERIAL','FIXED_PRICE') AND item_id IS NOT NULL AND sales_item_id IS NULL AND goods_issue_item_id IS NULL AND ((source_kind='FIXED_PRICE')=(source_line_id IS NULL))));
ALTER TABLE billing_request_lines ALTER COLUMN source_key SET EXPRESSION AS (CASE WHEN source_kind='DELIVERY' THEN 'WA:'||goods_issue_item_id::text WHEN source_kind='FIXED_PRICE' THEN 'FIX:'||item_id::text ELSE 'SRM:'||source_line_id::text END);
CREATE INDEX direct_billing_request_source ON billing_requests(tenant_id,sales_order_id);
CREATE INDEX direct_invoice_source ON invoices(tenant_id,sales_order_id);

CREATE FUNCTION validate_direct_billing_request(t uuid,rid uuid) RETURNS void LANGUAGE plpgsql AS $$DECLARE r billing_requests;h sales_orders;l record;s record;bound numeric;BEGIN
 SELECT * INTO STRICT r FROM billing_requests WHERE tenant_id=t AND id=rid;
 SELECT * INTO STRICT h FROM sales_orders WHERE tenant_id=t AND id=r.sales_order_id FOR UPDATE;
 IF h.status<>'RELEASED' OR h.execution_mode<>'DIRECT_SALES' OR h.released_snapshot IS NULL OR h.company_id IS DISTINCT FROM r.company_id OR h.partner_id IS DISTINCT FROM r.partner_id OR h.billing_block IS NOT NULL OR NOT EXISTS(SELECT 1 FROM documents d WHERE d.tenant_id=t AND d.id=r.id AND d.organization_id=h.organization_id) THEN RAISE EXCEPTION 'Direkte Fakturaanforderung benötigt passenden unabhängig freigegebenen AU ohne Fakturasperre';END IF;
 IF NOT EXISTS(SELECT 1 FROM billing_request_lines WHERE tenant_id=t AND request_id=rid) THEN RAISE EXCEPTION 'Fakturaanforderung benötigt tatsächliche Lieferpositionen';END IF;
 FOR l IN SELECT * FROM billing_request_lines WHERE tenant_id=t AND request_id=rid LOOP
  SELECT gi.quantity,g.delivery_date,i.net AS planned_net,i.quantity AS planned_quantity,i.price_snapshot,i.unit,i.description,i.cost_center,g.id AS issue_id,g.delivery_number,d.number AS issue_number,i.position INTO s FROM goods_issue_items gi JOIN goods_issues g ON g.tenant_id=gi.tenant_id AND g.id=gi.issue_id JOIN sales_order_items i ON i.tenant_id=gi.tenant_id AND i.id=gi.sales_item_id JOIN documents d ON d.tenant_id=g.tenant_id AND d.id=g.id
   WHERE gi.tenant_id=t AND gi.id=l.goods_issue_item_id AND gi.sales_item_id=l.sales_item_id AND i.order_id=h.id AND g.sales_order_id=h.id AND g.company_id=r.company_id AND g.sealed AND g.movement_type='ISSUE' AND i.rejection_reason IS NULL AND i.billing_block IS NULL AND i.billing_rule<>'NON_BILLABLE' AND NOT EXISTS(SELECT 1 FROM goods_issues rev WHERE rev.tenant_id=t AND rev.reverses_id=g.id);
  IF NOT FOUND OR l.source_kind<>'DELIVERY' OR l.item_id IS NOT NULL OR l.source_line_id IS NOT NULL THEN RAISE EXCEPTION 'Tatsächlich gebuchte, nicht zurückgenommene AU-Lieferquelle fehlt';END IF;
  IF l.unit IS DISTINCT FROM s.unit OR l.unit_net IS DISTINCT FROM round(s.planned_net/s.planned_quantity,12) OR l.tax_rate IS DISTINCT FROM (s.price_snapshot->>'taxRate')::numeric OR l.service_from IS DISTINCT FROM s.delivery_date OR l.service_to IS DISTINCT FROM s.delivery_date THEN RAISE EXCEPTION 'Direktvertriebsmenge benötigt genehmigten Preis, Steuer und tatsächliches Lieferdatum';END IF;
  IF NOT(jsonb_build_object('sourceKey',l.source_key,'sourceKind','DELIVERY','salesItemId',l.sales_item_id,'goodsIssueItemId',l.goods_issue_item_id,'issueId',s.issue_id,'issueNumber',s.issue_number,'deliveryNumber',s.delivery_number,'sku',s.price_snapshot->'product'->>'sku','description',s.description,'unit',s.unit,'ticketNumbers','[]'::jsonb,'serviceFrom',s.delivery_date::text,'serviceTo',s.delivery_date::text,'costCenter',s.cost_center) <@ l.snapshot) THEN RAISE EXCEPTION 'Direkte Fakturaquelle darf keine fremden Referenzen oder veränderten Texte enthalten';END IF;
  SELECT coalesce(sum(bl.quantity),0) INTO bound FROM billing_request_lines bl JOIN billing_requests br ON br.tenant_id=bl.tenant_id AND br.id=bl.request_id WHERE bl.tenant_id=t AND bl.source_key=l.source_key AND br.status NOT IN ('CANCELLED','REJECTED');
  IF bound>s.quantity THEN RAISE EXCEPTION 'Tatsächliche Liefermenge bereits in Fakturaanforderung gebunden';END IF;
 END LOOP;
END$$;

-- Both sides lock the same company, then AU: an AF and return cannot both win.
CREATE FUNCTION direct_billing_return_guard() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
 IF NEW.sales_order_id IS NOT NULL AND NEW.reverses_id IS NOT NULL THEN
  PERFORM 1 FROM company_codes WHERE tenant_id=NEW.tenant_id AND id=NEW.company_id FOR UPDATE;
  PERFORM 1 FROM sales_orders WHERE tenant_id=NEW.tenant_id AND id=NEW.sales_order_id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM billing_request_lines l JOIN billing_requests r ON r.tenant_id=l.tenant_id AND r.id=l.request_id JOIN goods_issue_items gi ON gi.tenant_id=l.tenant_id AND gi.id=l.goods_issue_item_id WHERE l.tenant_id=NEW.tenant_id AND gi.issue_id=NEW.reverses_id AND r.status NOT IN ('CANCELLED','REJECTED')) THEN RAISE EXCEPTION 'Lieferung ist in Fakturaanforderung oder Rechnung gebunden; erst zulässige kaufmännische Rückabwicklung durchführen';END IF;
 END IF;RETURN NEW;
END$$;
CREATE TRIGGER direct_billing_return BEFORE INSERT ON goods_issues FOR EACH ROW EXECUTE FUNCTION direct_billing_return_guard();

CREATE OR REPLACE FUNCTION billing_integrity() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE r record;l record;cap numeric;bound numeric;inv record;vat numeric;target_order uuid;BEGIN
 IF TG_TABLE_NAME IN ('billing_requests','invoices') THEN target_order=coalesce(NEW.order_id,NEW.sales_order_id);
 ELSIF TG_TABLE_NAME='billing_request_lines' THEN SELECT coalesce(order_id,sales_order_id) INTO target_order FROM billing_requests WHERE tenant_id=NEW.tenant_id AND id=NEW.request_id;
 ELSE SELECT coalesce(order_id,sales_order_id) INTO target_order FROM invoices WHERE tenant_id=NEW.tenant_id AND id=NEW.invoice_id;END IF;
 PERFORM 1 FROM service_orders WHERE tenant_id=NEW.tenant_id AND id=target_order FOR UPDATE;
 PERFORM 1 FROM sales_orders WHERE tenant_id=NEW.tenant_id AND id=target_order FOR UPDATE;
 FOR r IN SELECT * FROM billing_requests WHERE tenant_id=NEW.tenant_id AND coalesce(order_id,sales_order_id)=target_order AND status NOT IN ('CANCELLED','REJECTED') LOOP
  IF r.sales_order_id IS NOT NULL THEN PERFORM validate_direct_billing_request(r.tenant_id,r.id);CONTINUE;END IF;
  FOR l IN SELECT * FROM billing_request_lines WHERE tenant_id=r.tenant_id AND request_id=r.id LOOP
   PERFORM 1 FROM service_order_items i JOIN service_orders o ON o.tenant_id=i.tenant_id AND o.id=i.order_id JOIN company_codes c ON c.tenant_id=o.tenant_id AND c.organization_id=(SELECT organization_id FROM documents WHERE tenant_id=o.tenant_id AND id=o.id) WHERE i.tenant_id=l.tenant_id AND i.id=l.item_id AND o.id=r.order_id AND o.partner_id=r.partner_id AND c.id=r.company_id AND c.currency=o.currency AND i.billing_rule=l.source_kind AND i.service_status='COMPLETED';
   IF NOT FOUND THEN RAISE EXCEPTION 'Fakturaanforderung benötigt passende abgeschlossene Auftragsposition';END IF;
   IF NOT EXISTS(SELECT 1 FROM service_order_items oi WHERE oi.tenant_id=l.tenant_id AND oi.id=l.item_id AND l.unit_net=round(CASE WHEN l.source_kind='FIXED_PRICE' THEN oi.net ELSE oi.net/oi.quantity END,12) AND l.tax_rate=(oi.price_snapshot->>'taxRate')::numeric) THEN RAISE EXCEPTION 'Fakturapreis und Steuer müssen dem genehmigten Preisstand entsprechen';END IF;
   IF l.source_kind='FIXED_PRICE' THEN
    cap=1;
    IF NOT EXISTS(SELECT 1 FROM service_report_lines sl JOIN service_reports sr ON sr.tenant_id=sl.tenant_id AND sr.id=sl.report_id WHERE sl.tenant_id=l.tenant_id AND sl.item_id=l.item_id AND sr.status='APPROVED' AND (sl.snapshot->>'billable')::boolean) THEN RAISE EXCEPTION 'Freigegebener Festpreisnachweis fehlt';END IF;
   ELSE
    SELECT sl.quantity INTO cap FROM service_report_lines sl JOIN service_reports sr ON sr.tenant_id=sl.tenant_id AND sr.id=sl.report_id WHERE sl.tenant_id=l.tenant_id AND sl.id=l.source_line_id AND sl.item_id=l.item_id AND sr.order_id=r.order_id AND sr.status='APPROVED' AND (sl.snapshot->>'billable')::boolean;
    IF cap IS NULL THEN RAISE EXCEPTION 'Freigegebene fakturierbare SRM-Quelle fehlt';END IF;
   END IF;
   SELECT coalesce(sum(bl.quantity),0) INTO bound FROM billing_request_lines bl JOIN billing_requests br ON br.tenant_id=bl.tenant_id AND br.id=bl.request_id WHERE bl.tenant_id=l.tenant_id AND bl.source_key=l.source_key AND br.status NOT IN ('CANCELLED','REJECTED');
   IF bound>cap THEN RAISE EXCEPTION 'Quellmenge bereits in Fakturaanforderung gebunden';END IF;
  END LOOP;
 END LOOP;
 FOR l IN SELECT bl.id,bl.quantity,br.status,br.order_id FROM billing_request_lines bl JOIN billing_requests br ON br.tenant_id=bl.tenant_id AND br.id=bl.request_id WHERE bl.tenant_id=NEW.tenant_id AND coalesce(br.order_id,br.sales_order_id)=target_order LOOP
  SELECT coalesce(sum(quantity),0) INTO bound FROM invoice_items WHERE tenant_id=NEW.tenant_id AND request_line_id=l.id;
  IF (SELECT coalesce(sum(net),0) FROM invoice_items WHERE tenant_id=NEW.tenant_id AND request_line_id=l.id)>(SELECT net FROM billing_request_lines WHERE tenant_id=NEW.tenant_id AND id=l.id) THEN RAISE EXCEPTION 'Fakturierte Teilbeträge überschreiten freigegebenen Anforderungswert';END IF;
  IF bound>l.quantity OR (bound>0 AND l.status<>'RELEASED') THEN RAISE EXCEPTION 'Fakturierte Menge überschreitet freigegebene Anforderung';END IF;
 END LOOP;
 FOR inv IN SELECT * FROM invoices WHERE tenant_id=NEW.tenant_id AND coalesce(order_id,sales_order_id)=target_order LOOP
  SELECT coalesce(sum(round(basis*rate/100,2)),0) INTO vat FROM (SELECT sum(net) AS basis,tax_rate AS rate FROM invoice_items WHERE tenant_id=inv.tenant_id AND invoice_id=inv.id GROUP BY tax_rate) taxes;
  IF NOT inv.sealed OR inv.net<>(SELECT coalesce(sum(net),0) FROM invoice_items WHERE tenant_id=inv.tenant_id AND invoice_id=inv.id) OR inv.tax<>vat THEN RAISE EXCEPTION 'Rechnung benötigt versiegelte, konsistente Positionen und Steuer';END IF;
  IF NOT EXISTS(SELECT 1 FROM journals j WHERE j.tenant_id=inv.tenant_id AND j.id=inv.journal_id AND j.source_id=inv.id AND j.status='POSTED' AND j.company_id=inv.company_id AND j.currency=inv.currency) OR NOT EXISTS(SELECT 1 FROM invoice_open_items op WHERE op.tenant_id=inv.tenant_id AND op.invoice_id=inv.id AND op.company_id=inv.company_id AND op.partner_id=inv.partner_id AND op.amount=inv.gross AND op.currency=inv.currency AND op.due_date=inv.due_date) THEN RAISE EXCEPTION 'Rechnung benötigt zugehörige gebuchte FI und Debitorenposten';END IF;
  IF (SELECT coalesce(sum(amount),0) FROM journal_entries WHERE tenant_id=inv.tenant_id AND journal_id=inv.journal_id AND side='DEBIT')<>inv.gross THEN RAISE EXCEPTION 'Forderungsbetrag stimmt nicht mit Rechnung überein';END IF;
  IF EXISTS(SELECT 1 FROM invoice_items ii JOIN billing_request_lines bl ON bl.tenant_id=ii.tenant_id AND bl.id=ii.request_line_id JOIN billing_requests br ON br.tenant_id=bl.tenant_id AND br.id=bl.request_id WHERE ii.tenant_id=inv.tenant_id AND ii.invoice_id=inv.id AND (coalesce(br.order_id,br.sales_order_id) IS DISTINCT FROM coalesce(inv.order_id,inv.sales_order_id) OR (br.order_id IS NULL) IS DISTINCT FROM (inv.order_id IS NULL) OR br.partner_id<>inv.partner_id OR br.company_id<>inv.company_id OR ii.net<>round(ii.quantity*bl.unit_net,2) OR ii.tax_rate<>bl.tax_rate OR bl.service_to>inv.invoice_date)) THEN RAISE EXCEPTION 'Rechnungsposition passt nicht zur freigegebenen Quelle';END IF;
 END LOOP;RETURN NULL;
END$$;

CREATE OR REPLACE FUNCTION invoice_seal_check() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE c record;p record;b record;a record;l record;s jsonb;BEGIN
 IF NOT NEW.sealed THEN RETURN NEW;END IF;
 IF NEW.sales_order_id IS NOT NULL THEN
  IF NEW.snapshot->>'orderKind' IS DISTINCT FROM 'SALES_ORDER' OR NEW.snapshot->'deliveryNumbers' IS DISTINCT FROM (SELECT jsonb_agg(n ORDER BY n) FROM (SELECT DISTINCT bl.snapshot->>'deliveryNumber' AS n FROM invoice_items ii JOIN billing_request_lines bl ON bl.tenant_id=ii.tenant_id AND bl.id=ii.request_line_id WHERE ii.tenant_id=NEW.tenant_id AND ii.invoice_id=NEW.id) refs) OR EXISTS(SELECT 1 FROM invoice_items ii JOIN billing_request_lines bl ON bl.tenant_id=ii.tenant_id AND bl.id=ii.request_line_id LEFT JOIN LATERAL (SELECT value FROM jsonb_array_elements(NEW.snapshot->'items') WHERE (value->>'position')::integer=ii.position) printed ON true WHERE ii.tenant_id=NEW.tenant_id AND ii.invoice_id=NEW.id AND (bl.source_kind<>'DELIVERY' OR printed.value->>'deliveryNumber' IS DISTINCT FROM bl.snapshot->>'deliveryNumber')) THEN RAISE EXCEPTION 'Direkte Rechnung benötigt tatsächliche AU- und Lieferscheinreferenzen';END IF;
 END IF;

 SELECT * INTO c FROM company_codes WHERE tenant_id=NEW.tenant_id AND id=NEW.company_id;
 SELECT * INTO p FROM business_partners WHERE tenant_id=NEW.tenant_id AND id=NEW.partner_id;
 SELECT * INTO b FROM company_billing_profiles WHERE tenant_id=NEW.tenant_id AND company_id=NEW.company_id AND status='ACTIVE';
 IF b.id IS NULL OR NOT (jsonb_build_object('number',(SELECT number FROM documents WHERE tenant_id=NEW.tenant_id AND id=NEW.id),'date',NEW.invoice_date::text,'dueDate',NEW.due_date::text,'currency',NEW.currency,'orderNumber',(SELECT number FROM documents WHERE tenant_id=NEW.tenant_id AND id=coalesce(NEW.order_id,NEW.sales_order_id)),'net',NEW.net::text,'tax',NEW.tax::text,'gross',NEW.gross::text) <@ NEW.snapshot) THEN RAISE EXCEPTION 'Rechnungssnapshot stimmt nicht mit gebuchten Kopfdaten überein';END IF;
 IF NOT (jsonb_build_object('name',c.name,'street',c.street,'postalCode',c.postal_code,'city',c.city,'country',c.country,'vatId',c.vat_id,'iban',b.iban,'bic',b.bic,'email',b.email,'phone',b.phone) = (NEW.snapshot->'seller')) THEN RAISE EXCEPTION 'Rechnungsaussteller entspricht nicht dem freigegebenen Profil';END IF;
 IF NOT (jsonb_build_object('name',p.name,'number',p.number,'vatId',p.vat_id) <@ (NEW.snapshot->'buyer')) OR NOT EXISTS(SELECT 1 FROM partner_addresses pa WHERE pa.tenant_id=NEW.tenant_id AND pa.partner_id=NEW.partner_id AND pa.active AND pa.kind IN ('BILLING','BUSINESS') AND jsonb_build_object('street',pa.street,'postalCode',pa.postal_code,'city',pa.city,'country',pa.country) <@ (NEW.snapshot->'buyer')) THEN RAISE EXCEPTION 'Rechnungsempfänger entspricht nicht dem Kunden';END IF;
 IF jsonb_array_length(NEW.snapshot->'items')<>(SELECT count(*) FROM invoice_items WHERE tenant_id=NEW.tenant_id AND invoice_id=NEW.id) THEN RAISE EXCEPTION 'Rechnungssnapshot benötigt alle Positionen';END IF;
 FOR l IN SELECT ii.*,bl.unit,bl.unit_net,bl.service_from,bl.service_to,bl.snapshot AS source_snapshot FROM invoice_items ii JOIN billing_request_lines bl ON bl.tenant_id=ii.tenant_id AND bl.id=ii.request_line_id WHERE ii.tenant_id=NEW.tenant_id AND ii.invoice_id=NEW.id LOOP
  SELECT value INTO s FROM jsonb_array_elements(NEW.snapshot->'items') WHERE (value->>'position')::integer=l.position;
  IF s IS NULL OR (s->>'quantity')::numeric IS DISTINCT FROM l.quantity OR (s->>'net')::numeric IS DISTINCT FROM l.net OR (s->>'unitNet')::numeric IS DISTINCT FROM l.unit_net OR (s->>'taxRate')::numeric IS DISTINCT FROM l.tax_rate OR s->>'unit' IS DISTINCT FROM l.unit OR s->>'serviceFrom' IS DISTINCT FROM l.service_from::text OR s->>'serviceTo' IS DISTINCT FROM l.service_to::text OR s->>'sku' IS DISTINCT FROM l.source_snapshot->>'sku' OR s->>'description' IS DISTINCT FROM l.source_snapshot->>'description' THEN RAISE EXCEPTION 'Rechnungssnapshot verändert freigegebene Position';END IF;
 END LOOP;
 IF NEW.snapshot->'taxes' IS DISTINCT FROM (SELECT jsonb_agg(jsonb_build_object('rate',trim_scale(rate)::text,'basis',basis::numeric(20,2)::text,'amount',round(basis*rate/100,2)::text) ORDER BY rate) FROM (SELECT tax_rate AS rate,sum(net) AS basis FROM invoice_items WHERE tenant_id=NEW.tenant_id AND invoice_id=NEW.id GROUP BY tax_rate) t) THEN RAISE EXCEPTION 'Steuersnapshot ist inkonsistent';END IF;
 SELECT * INTO a FROM invoice_open_items WHERE tenant_id=NEW.tenant_id AND invoice_id=NEW.id;
 IF (SELECT count(*) FROM journal_entries WHERE tenant_id=NEW.tenant_id AND journal_id=NEW.journal_id AND side='DEBIT')<>1 OR NOT EXISTS(SELECT 1 FROM journal_entries e JOIN gl_accounts g ON g.tenant_id=e.tenant_id AND g.id=e.account_id WHERE e.tenant_id=NEW.tenant_id AND e.journal_id=NEW.journal_id AND e.side='DEBIT' AND e.account_id=a.account_id AND e.partner_id=NEW.partner_id AND e.amount=NEW.gross AND g.kind='RECEIVABLE') THEN RAISE EXCEPTION 'Forderungsbuchung passt nicht zum Debitorenposten';END IF;
 IF (SELECT coalesce(sum(e.amount),0) FROM journal_entries e JOIN gl_accounts g ON g.tenant_id=e.tenant_id AND g.id=e.account_id WHERE e.tenant_id=NEW.tenant_id AND e.journal_id=NEW.journal_id AND e.side='CREDIT' AND g.kind='REVENUE')<>NEW.net OR (SELECT coalesce(sum(e.amount),0) FROM journal_entries e JOIN gl_accounts g ON g.tenant_id=e.tenant_id AND g.id=e.account_id WHERE e.tenant_id=NEW.tenant_id AND e.journal_id=NEW.journal_id AND e.side='CREDIT' AND g.kind='TAX')<>NEW.tax THEN RAISE EXCEPTION 'Erlös-/Steuerbuchung passt nicht zur Rechnung';END IF;
 RETURN NEW;
END$$;

CREATE OR REPLACE FUNCTION invoice_ticket_snapshot_check() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE expected jsonb;line record;actual jsonb;BEGIN
 IF NOT NEW.sealed THEN RETURN NEW;END IF;
 IF NEW.sales_order_id IS NOT NULL THEN
  IF NEW.snapshot->'ticketNumbers' IS DISTINCT FROM '[]'::jsonb OR EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.snapshot->'items') x WHERE x->'ticketNumbers' IS DISTINCT FROM '[]'::jsonb) THEN RAISE EXCEPTION 'Direktvertrieb darf keine erfundenen Ticketreferenzen enthalten';END IF;RETURN NEW;
 END IF;
 SELECT coalesce(jsonb_agg(number ORDER BY number),'[]'::jsonb) INTO expected FROM (
  SELECT DISTINCT td.number FROM invoice_items ii JOIN billing_request_lines bl ON bl.tenant_id=ii.tenant_id AND bl.id=ii.request_line_id
  JOIN service_report_lines sl ON sl.tenant_id=bl.tenant_id AND ((bl.source_kind='TIME_MATERIAL' AND sl.id=bl.source_line_id) OR (bl.source_kind='FIXED_PRICE' AND sl.item_id=bl.item_id))
  JOIN service_reports sr ON sr.tenant_id=sl.tenant_id AND sr.id=sl.report_id JOIN documents td ON td.tenant_id=sr.tenant_id AND td.id=sr.ticket_id
  WHERE ii.tenant_id=NEW.tenant_id AND ii.invoice_id=NEW.id AND sr.order_id=NEW.order_id AND sr.status='APPROVED' AND (sl.snapshot->>'billable')::boolean
 ) refs;
 IF expected='[]'::jsonb OR NEW.snapshot->'ticketNumbers' IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Ticketreferenzen entsprechen nicht den abgerechneten SRM-Quellen';END IF;
 FOR line IN SELECT ii.position,bl.source_line_id,bl.item_id,bl.source_kind FROM invoice_items ii JOIN billing_request_lines bl ON bl.tenant_id=ii.tenant_id AND bl.id=ii.request_line_id WHERE ii.tenant_id=NEW.tenant_id AND ii.invoice_id=NEW.id LOOP
  SELECT coalesce(jsonb_agg(number ORDER BY number),'[]'::jsonb) INTO expected FROM (SELECT DISTINCT td.number FROM service_report_lines sl JOIN service_reports sr ON sr.tenant_id=sl.tenant_id AND sr.id=sl.report_id JOIN documents td ON td.tenant_id=sr.tenant_id AND td.id=sr.ticket_id WHERE sl.tenant_id=NEW.tenant_id AND sr.order_id=NEW.order_id AND sr.status='APPROVED' AND (sl.snapshot->>'billable')::boolean AND ((line.source_kind='TIME_MATERIAL' AND sl.id=line.source_line_id) OR (line.source_kind='FIXED_PRICE' AND sl.item_id=line.item_id))) refs;
  SELECT value->'ticketNumbers' INTO actual FROM jsonb_array_elements(NEW.snapshot->'items') WHERE (value->>'position')::integer=line.position;
  IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Ticketreferenz der Rechnungsposition stimmt nicht mit SRM überein';END IF;
 END LOOP;RETURN NEW;
END$$;

CREATE OR REPLACE FUNCTION sales_invoice_source_consistent() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE execution service_orders;commercial sales_orders;buyer jsonb;payer jsonb;payment jsonb;BEGIN
 IF NEW.sales_order_id IS NOT NULL THEN SELECT * INTO STRICT commercial FROM sales_orders WHERE tenant_id=NEW.tenant_id AND id=NEW.sales_order_id;ELSE
 SELECT * INTO STRICT execution FROM service_orders WHERE tenant_id=NEW.tenant_id AND id=NEW.order_id;IF execution.source_sales_order_id IS NULL THEN RETURN NULL;END IF;
 SELECT * INTO STRICT commercial FROM sales_orders WHERE tenant_id=NEW.tenant_id AND id=execution.source_sales_order_id;
 END IF;
 SELECT x INTO buyer FROM jsonb_array_elements(commercial.released_snapshot->'commercial'->'partners') x WHERE x->>'role'='BILL_TO';SELECT x INTO payer FROM jsonb_array_elements(commercial.released_snapshot->'commercial'->'partners') x WHERE x->>'role'='PAYER';SELECT x INTO payment FROM jsonb_array_elements(commercial.released_snapshot->'commercial'->'terms') x WHERE x->>'kind'='PAYMENT';
 IF buyer IS NULL OR payer IS NULL OR payment IS NULL OR (buyer->>'partnerId')::uuid IS DISTINCT FROM NEW.partner_id OR (payer->>'partnerId')::uuid IS DISTINCT FROM NEW.partner_id OR NEW.snapshot->>'salesOrderNumber' IS DISTINCT FROM (SELECT number FROM documents WHERE tenant_id=NEW.tenant_id AND id=commercial.id) OR NEW.snapshot->>'customerOrderReference' IS DISTINCT FROM commercial.customer_reference OR NEW.snapshot->'buyer'->>'name' IS DISTINCT FROM buyer->>'name' OR NEW.snapshot->'buyer'->>'street' IS DISTINCT FROM buyer->'address'->>'street' OR NEW.snapshot->'buyer'->>'postalCode' IS DISTINCT FROM buyer->'address'->>'postalCode' OR NEW.snapshot->'buyer'->>'city' IS DISTINCT FROM buyer->'address'->>'city' OR NEW.snapshot->'buyer'->>'country' IS DISTINCT FROM buyer->'address'->>'country' OR (NEW.snapshot->>'dueDate')::date IS DISTINCT FROM (NEW.snapshot->>'date')::date+(payment->>'netDays')::int THEN RAISE EXCEPTION 'Faktura muss freigegebene AU-Partner-, Adress-, Referenz- und Zahlungsbedingungen erhalten';END IF;RETURN NULL;
END$$;
