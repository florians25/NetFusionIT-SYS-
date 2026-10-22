# Datenbankmodell

## Physisch implementierter Kern

Die ausführbare Wahrheit ist `backend/migrations/001_foundation.sql`. Alle UUID-Primärschlüssel werden serverseitig erzeugt. Mandantenabhängige Entitäten besitzen zusätzlich `UNIQUE(tenant_id,id)`; Fremdschlüssel referenzieren diese Kombination. Restriktives Löschen statt Kaskaden für Geschäftsbelege.

| Tabelle | Wesentliche Schlüssel / Beziehungen |
|---|---|
| tenants | UUID, eindeutiger slug, Name |
| organizations | Tenant + ID, typisierter Knoten, Parent im selben Tenant |
| business_partners | Tenant + ID, Nummer pro Tenant, ACTIVE/BLOCKED, Kundenrolle |
| users | Tenant + ID, E-Mail pro Tenant, scrypt-Hash, Rollen-Enum, aktiver Status, optionale Partnerbindung |
| user_organizations | Benutzer + Organisation, nur gleiche Mandanten |
| technicians | Tenant + ID, Benutzer unique, aktiv, Qualifikationen |
| number_ranges | Tenant + Art + Jahr, atomarer Zähler |
| documents | Tenant + ID, eindeutige Art/Nummer, Organisation, Ersteller |
| service_cases | eigene ID = Dokument-ID, Partner, technischer/operativer/kaufmännischer Status, Version |
| tickets | eigene ID = Dokument-ID, Fall, Partner, Titel, Inhalt, Priorität, Status, Quelle, Korrelation, Version |
| dispatch_assignments | Ticket, Techniker, Zuweisender, Zeit, aktiv; nur eine aktive Zuweisung je Ticket |
| document_relations | zwei Dokument-FKs, Relationstyp; keine Selbstbezüge, unique gerichtete Kante |
| audit_events | append-only per DB-Trigger, Actor, Aktion, Dokument, Korrelation, JSON-Details |
| idempotency_keys | Tenant + Actor + Scope + Schlüssel, Request-Hash, Antwort; atomar mit Fachbeleg |
| sessions | serverseitige Sessiondaten, Ablaufindex; nicht über OData verfügbar |
| schema_migrations | Dateiname + SHA-256; bestehende Migrationen unveränderlich |

RLS mit `app.tenant_id` für fachliche Tabellen; jeder Request setzt den Kontext transaktionslokal. Der Laufzeitbenutzer ist nicht Superuser und hat keine DDL-Rechte. Login und Session-Speicher haben eng definierte technische Zugriffe. SQL verwendet ausschließlich parametrisierte Werte. Indizes: Ticket(Tenant,Org,Status,Erstellt), Partner(Tenant,Nummer), Audit(Tenant,Dokument,Zeit), Relation(Tenant,Ziel), aktive Disposition(Tenant,Techniker). Optimistic Locking verwendet `version` plus Zeilensperre für Änderungen.

## Ausbau-Schema (geplant, noch keine Tabellen/Migrationsbehauptung)

| Domäne | Tabellen und zentrale Integritätsregeln |
|---|---|
| Organization | companies, company_codes, org_settings, cost_centers, profit_centers; eindeutige Codes im Tenant |
| Partner / CRM | partner_roles, addresses, contacts, banks, customer_approvals; gültigkeitsbezogene Versionen |
| Service / Assets | service_contracts, contract_items, sla_policies, sla_events, technical_objects, object_relations, case_objects, field_visits, visit_technicians; vertragliche Deckung explizit |
| ITSM | ticket_comments, attachments, ticket_links, problems, known_errors, changes; öffentliche/interne Sichtbarkeit getrennt |
| Sales | quotations, sales_orders, service_orders, service_order_items; Belegdokument-FKs und fixierte Preise |
| Pricing | material_prices, condition_types, price_conditions, pricing_runs, pricing_steps; Datumsspannen und Priorität |
| Inventory | materials, material_units, inventory_stock, inventory_reservations, stock_movements, serial_numbers, batches; keine negativen verfügbaren Mengen, Seriennummer unique |
| Procurement | material_requirements, requisitions/items, purchase_orders/items, goods_receipts/items, supplier_invoices/items; Restmenge aus gebuchten Mengen |
| Performance | time_entries, service_reports/items, approvals; keine Änderung fakturierter Zeit |
| Billing | billing_candidates, invoices/items, invoice_cancellations, credit_notes; Rechnung unique, Storno original unique, immutable nach Buchung |
| Finance | gl_accounts, fiscal_periods, accounting_documents/entries, open_items, payments, allocations, tax_codes; Soll=Haben, Periode offen, keine Journalupdates |
| Workflow | approval_definitions/versions, instances, steps, decisions, delegations; Freigeber≠Ersteller falls Vier-Augen |
| Documents | attachments, template_versions, generated_documents, retention_policies; Content-Hash, Scanstatus, private Speicherung |
| Integration | outbox_events, inbox_messages, import_batches/rows, reconciliation_runs; eindeutige externe Nachricht |

Jede neue Tabelle benötigt Tenant-FK, RLS, Org-Scope-Entscheidung, Delete-Regel, Audit-Regel und Migrationstest. Journale und Bestandsbewegungen werden append-only, Korrektur durch Gegenbeleg. Eine technische DB-Historie allein ist keine unveränderliche gesetzliche Archivierung.
