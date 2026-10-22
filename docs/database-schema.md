# Datenbankmodell · Preview 0.7

Die ausführbare Wahrheit sind die prüfsummengesicherten Migrationen `backend/migrations/001_*` bis `009_*`. Bereits angewendete Dateien werden nicht verändert; Ausbau erfolgt über Folgemigrationen. Readiness prüft Dateinamen, SHA-256 und erwartete Tabellen. UUID-Schlüssel werden serverseitig erzeugt; zusammengesetzte Tenant-Fremdschlüssel verhindern mandantenübergreifende Herkunftsbezüge. Restriktives Löschen für Geschäftsbelege.

| Migration | Physisch implementierter Umfang |
|---|---|
| 001 foundation | tenants, organizations, business_partners, users, user_organizations, technicians, number_ranges, documents, service_cases, tickets, dispatch_assignments, document_relations, audit_events, idempotency_keys, sessions |
| 002 workflow_and_collaboration | partner_contacts, partner_addresses, ticket_comments, ticket_links, approval_definitions, approval_instances, approval_decisions, notification_outbox; differenzierte Rollen |
| 003 service_operations | service_calendars, sla_policies, service_contracts, technical_objects, case_objects, ticket_sla, sla_events, technician_absences, field_visits, visit_technicians |
| 004 service_commerce | currencies, products, price_conditions, service_orders, service_order_items; explizite Preis-Snapshots |
| 005 service_execution | work_order_tasks, service_reports, time_entries, work_timers, ticket_charges, service_report_lines |
| 006 accounting_core | company_codes, gl_accounts, fiscal_periods, journals, journal_entries, accounting_rules |
| 007 order_procurement | supplier_data, order_requirements, order_requirement_items, purchase_requisitions, purchase_requisition_items, purchase_orders, purchase_order_items |
| 008 valued_goods_receipts | material_inventory_settings, plants, storage_locations, goods_receipts, goods_receipt_items, stock_balances, inventory_valuations |
| 009 automatic_material_planning | stock_reservations; automatische Bedarfskennzeichnung, Bedarfstermin und separater Positions-/Kopf-Versorgungsstatus |

## Integrität und Laufzeitrolle

Fachliche Tabellen besitzen RLS mit transaktionslokalem `app.tenant_id`. Zusätzlich erzwingen Services Organisation, Kunde und eigene Technikerzuweisung. Der Laufzeitbenutzer besitzt weder Superuser-/DDL-Rechte noch Änderungsrechte an Audit oder privaten Bestands-/Bewertungsprojektionen. Session- und Loginzugriffe sind technisch begrenzt. Parametrisierte SQL-Werte, Versionen und Zeilensperren schützen Änderungen und Mengenbindung.

Beschaffungsbelege und -positionen schützen Herkunft und genehmigte Inhalte mit Triggern; Ablehnung/Verwerfen erhält die Historie. Automatische Bedarfe können nur vor ihrer ersten BANF terminlich ergänzt werden. Reservierung sperrt die konkrete Bestandszeile und vergleicht sämtliche aktiven Bindungen. Ihr Inhalt bleibt unveränderlich; Freigabe benötigt Begründung. Bestandsreduktion darf keine fremden Reservierungen unterschreiten.

Wareneingang und -storno sind versiegelte unveränderliche Köpfe mit append-only Positionen. Ein verzögerter Constraint verlangt vollständigen Beleg, passende offene Periode und bei positivem Wert einen korrespondierenden gebuchten Finanzbeleg. Vertrauenswürdige Trigger projizieren die Bewegung in `stock_balances` und `inventory_valuations`. Die Runtime besitzt dort nur SELECT. Trigger mit SECURITY DEFINER besitzen festen Suchpfad; Reservierungsprüfung validiert den expliziten Mandantenkontext vor privilegierter Zeilensperre. Nichtnegative Mengen/Werte, eindeutige aktive Seriennummern und genau ein Storno je Ursprung gelten zusätzlich zur Serviceprüfung.

Journalpositionen/gebuchte Inhalte und Audit sind gegen nachträgliches UPDATE/DELETE geschützt. Korrekturen erfolgen über Gegenbelege. Nummern, Projektionen, Journale, Beziehungen, Audit und Idempotenzantwort rollen bei Fehlern gemeinsam zurück. Eine technische Historie ist keine gesetzliche Archivierungszusage.

## Noch keine implementierten Tabellen

Angebote, Service-/Reparaturvorlagen, Werkstattreparaturen/Retouren, tatsächliche Warenentnahmen, Inventur/Umlagerung, Lieferantenrechnungen/Abnahmen, Fakturakandidaten/Rechnungen, offene Posten/Zahlungsausgleich, sichere Anhänge, DATEV-Läufe und Integrations-Inbox sind Ausbau. Vorhandene Outbox/Vertragsbasis bedeutet keine vollständige Versand-/Vertragslösung. Jede Erweiterung benötigt eigene Tenant-/Scope-/Audit-/Korrekturregeln und Migrationstests.
