-- Explicit person components; historical labels are retained until completed.
ALTER TABLE users ADD COLUMN first_name text NOT NULL DEFAULT '',ADD COLUMN last_name text NOT NULL DEFAULT '',ADD CHECK((first_name='' AND last_name='') OR (length(trim(first_name)) BETWEEN 1 AND 60 AND length(trim(last_name)) BETWEEN 1 AND 80));
ALTER TABLE partner_contacts ADD COLUMN first_name text NOT NULL DEFAULT '',ADD COLUMN last_name text NOT NULL DEFAULT '',ADD CHECK((first_name='' AND last_name='') OR (length(trim(first_name)) BETWEEN 1 AND 60 AND length(trim(last_name)) BETWEEN 1 AND 80));
CREATE FUNCTION person_full_name() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
 IF NEW.first_name<>'' OR NEW.last_name<>'' THEN
  IF trim(NEW.first_name)='' OR trim(NEW.last_name)='' THEN RAISE EXCEPTION 'Vorname und Nachname gemeinsam erforderlich';END IF;
  NEW.first_name=regexp_replace(trim(NEW.first_name),'\s+',' ','g');NEW.last_name=regexp_replace(trim(NEW.last_name),'\s+',' ','g');NEW.name=NEW.first_name||' '||NEW.last_name;
 END IF;RETURN NEW;
END$$;
CREATE TRIGGER person_full_name BEFORE INSERT OR UPDATE ON users FOR EACH ROW EXECUTE FUNCTION person_full_name();
CREATE TRIGGER person_full_name BEFORE INSERT OR UPDATE ON partner_contacts FOR EACH ROW EXECUTE FUNCTION person_full_name();
CREATE FUNCTION technician_person_name() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
 IF NEW.name IS DISTINCT FROM OLD.name THEN UPDATE technicians SET name=NEW.name WHERE tenant_id=NEW.tenant_id AND user_id=NEW.id;END IF;RETURN NULL;
END$$;
CREATE TRIGGER technician_person_name AFTER UPDATE ON users FOR EACH ROW EXECUTE FUNCTION technician_person_name();
CREATE TABLE company_document_contacts (
 tenant_id uuid NOT NULL,company_id uuid NOT NULL,first_name text NOT NULL CHECK(length(trim(first_name)) BETWEEN 1 AND 60),last_name text NOT NULL CHECK(length(trim(last_name)) BETWEEN 1 AND 80),email text NOT NULL,phone text NOT NULL DEFAULT '',active boolean NOT NULL DEFAULT true,version integer NOT NULL DEFAULT 1 CHECK(version>0),
 PRIMARY KEY(tenant_id,company_id),FOREIGN KEY(tenant_id,company_id) REFERENCES company_codes(tenant_id,id)
);
CREATE FUNCTION document_contact_guard() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Dokumentansprechpartner deaktivieren statt löschen';END IF;
 IF TG_OP='UPDATE' AND (NEW.company_id<>OLD.company_id OR NEW.tenant_id<>OLD.tenant_id OR NEW.version<>OLD.version+1) THEN RAISE EXCEPTION 'Dokumentansprechpartner benötigt unveränderten Buchungskreis und neue Revision';END IF;
 NEW.first_name=regexp_replace(trim(NEW.first_name),'\s+',' ','g');NEW.last_name=regexp_replace(trim(NEW.last_name),'\s+',' ','g');
 IF NEW.first_name ~ '[\r\n\t]' OR NEW.last_name ~ '[\r\n\t]' OR NEW.email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'Vollständigen Namen und gültige E-Mail eintragen';END IF;RETURN NEW;
END$$;
CREATE TRIGGER document_contact_guard BEFORE INSERT OR UPDATE OR DELETE ON company_document_contacts FOR EACH ROW EXECUTE FUNCTION document_contact_guard();
ALTER TABLE company_document_contacts ENABLE ROW LEVEL SECURITY;ALTER TABLE company_document_contacts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON company_document_contacts USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
-- Pending historical invoice outputs retain the renderer of their frozen snapshot.
ALTER TABLE invoice_output_jobs ADD COLUMN template_version integer NOT NULL DEFAULT 5 CHECK(template_version IN(5,6));
ALTER TABLE invoice_output_jobs ALTER COLUMN template_version SET DEFAULT 6;

-- Preserve the existing FI, buyer, tax and source guards; validate the new contact separately.
CREATE OR REPLACE FUNCTION invoice_seal_check() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE c record;p record;b record;a record;l record;s jsonb;BEGIN
 IF NOT NEW.sealed THEN RETURN NEW;END IF;
 IF NEW.sales_order_id IS NOT NULL THEN
  IF NEW.snapshot->>'orderKind' IS DISTINCT FROM 'SALES_ORDER' OR NEW.snapshot->'deliveryNumbers' IS DISTINCT FROM (SELECT jsonb_agg(n ORDER BY n) FROM (SELECT DISTINCT bl.snapshot->>'deliveryNumber' AS n FROM invoice_items ii JOIN billing_request_lines bl ON bl.tenant_id=ii.tenant_id AND bl.id=ii.request_line_id WHERE ii.tenant_id=NEW.tenant_id AND ii.invoice_id=NEW.id) refs) OR EXISTS(SELECT 1 FROM invoice_items ii JOIN billing_request_lines bl ON bl.tenant_id=ii.tenant_id AND bl.id=ii.request_line_id LEFT JOIN LATERAL (SELECT value FROM jsonb_array_elements(NEW.snapshot->'items') WHERE (value->>'position')::integer=ii.position) printed ON true WHERE ii.tenant_id=NEW.tenant_id AND ii.invoice_id=NEW.id AND (bl.source_kind<>'DELIVERY' OR printed.value->>'deliveryNumber' IS DISTINCT FROM bl.snapshot->>'deliveryNumber')) THEN RAISE EXCEPTION 'Direkte Rechnung benötigt tatsächliche AU- und Lieferscheinreferenzen';END IF;
 END IF;

 SELECT * INTO c FROM company_codes WHERE tenant_id=NEW.tenant_id AND id=NEW.company_id;
 SELECT * INTO p FROM business_partners WHERE tenant_id=NEW.tenant_id AND id=NEW.partner_id;
 SELECT * INTO b FROM company_billing_profiles WHERE tenant_id=NEW.tenant_id AND company_id=NEW.company_id AND status='ACTIVE';
 IF b.id IS NULL OR NOT (jsonb_build_object('number',(SELECT number FROM documents WHERE tenant_id=NEW.tenant_id AND id=NEW.id),'date',NEW.invoice_date::text,'dueDate',NEW.due_date::text,'currency',NEW.currency,'orderNumber',(SELECT number FROM documents WHERE tenant_id=NEW.tenant_id AND id=coalesce(NEW.order_id,NEW.sales_order_id)),'net',NEW.net::text,'tax',NEW.tax::text,'gross',NEW.gross::text) <@ NEW.snapshot) THEN RAISE EXCEPTION 'Rechnungssnapshot stimmt nicht mit gebuchten Kopfdaten überein';END IF;
 IF NOT (jsonb_build_object('name',c.name,'street',c.street,'postalCode',c.postal_code,'city',c.city,'country',c.country,'vatId',c.vat_id,'iban',b.iban,'bic',b.bic,'email',b.email,'phone',b.phone) = ((NEW.snapshot->'seller')-'contact')) THEN RAISE EXCEPTION 'Rechnungsaussteller entspricht nicht dem freigegebenen Profil';END IF;
 IF (NEW.snapshot->'seller'->'contact') IS DISTINCT FROM (SELECT jsonb_build_object('firstName',first_name,'lastName',last_name,'email',email,'phone',phone,'version',version) FROM company_document_contacts WHERE tenant_id=NEW.tenant_id AND company_id=NEW.company_id AND active) OR NOT (NEW.snapshot->'seller' ? 'contact') THEN RAISE EXCEPTION 'Rechnung benötigt tatsächlichen vollständigen Dokumentansprechpartner';END IF;
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

CREATE FUNCTION invoice_output_template_guard() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
 IF TG_OP='INSERT' THEN IF NEW.template_version<>6 THEN RAISE EXCEPTION 'Neue Rechnungsausgabe benötigt aktuellen Vorlagenstand';END IF;
 ELSIF NEW.template_version<>OLD.template_version THEN RAISE EXCEPTION 'Archivierter Ausgabevorlagenstand bleibt erhalten';END IF;RETURN NEW;
END$$;
CREATE TRIGGER invoice_output_template_guard BEFORE INSERT OR UPDATE ON invoice_output_jobs FOR EACH ROW EXECUTE FUNCTION invoice_output_template_guard();
