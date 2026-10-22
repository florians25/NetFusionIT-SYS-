-- Ticket references are derived from the billed actual SRM, not arbitrary input.
-- The original invoice snapshot stays frozen after sealing.
CREATE FUNCTION invoice_ticket_snapshot_check() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE expected jsonb;line record;actual jsonb;BEGIN
 IF NOT NEW.sealed THEN RETURN NEW;END IF;
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
CREATE TRIGGER invoice_ticket_snapshot BEFORE INSERT OR UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION invoice_ticket_snapshot_check();
