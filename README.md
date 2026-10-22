# NetFusion · Enterprise Service ERP

Eigenständiger modularer Monolith mit echtem **OpenUI5**, **NestJS/TypeScript** und **PostgreSQL**. Die Oberfläche verwendet ausschließlich **OpenUI5-Standardcontrols**, das Standardtheme und Standard-Abstandsklassen. Keine eigenen UI-Controls, Renderer, CSS-Dateien oder SVG-Logos. Preview 0.9: **Kundenformular → Ticket + Servicefall → Belegfluss → Technikerbearbeitung**, Kundenfreigabe, SLA, Servicebasis, Einsatzplanung sowie Artikel-/Auftragsfreigabe mit Preisfindung, Zeiten, geprüfte Leistungsnachweise und technischen Abschluss. Buchungskern mit Konten, Perioden, freigegebenen Journalen, Storno und Summen/Salden. Automatische Materialbedarfe aus freigegebenen Artikelpositionen, Lagerverfügbarkeit und Reservierungen; „Teile bestellen“ fordert nur die Fehlmenge per BANF mit Freigabe an. Teilbestellungen, bewertete Teilwareneingänge und Gegenbewegungen mit atomaren Finanzbuchungen. Tatsächliche Materialauslieferung/Teilauslieferung zum Serviceauftrag mit WA/LS-Nummern, Gegenbewegung, Kostenbuchung und automatischer Materialübernahme in die WOT-SRM. 66 verwaltbare Geschäftsnummernkreise; dichtere native Facharbeitsplätze mit Filtern, Belegwerten, Kontext und Status.

Kein SAP-Backend nötig. Eigene Marke; Screenshots dienen als Fiori-/Prozessreferenz. Noch keine Produktivfreigabe. Beschaffung und Finanzbuchhaltung besitzen geprüfte Teilprozesse. Physische Lagerplätze/Labels/Scanner, PDF-Anlagenlisten, Umlagerung/Inventur, Faktura, offene Posten und erweiterte Workflow-/Vertragsfunktionen bleiben offen; der gesamte Masterprompt ist noch nicht umgesetzt.

Nach Anmeldung öffnet sich die **App-Zentrale** mit rollenabhängigen App-Kacheln. Die Shell zeigt nur Schnellzugriffe der aktiven Anwendung. Das separat aufgerufene **Service-Cockpit** bietet: klickbare Kennzahlenkarten, Arbeitsvorräte für neue/unzugewiesene/kritische/laufende Tickets, Such-/Prioritäts-/Typfilter, Prioritätsverteilung und direkte Technikerzuweisung. Alle Werte stammen aus autorisierten Datenbankabfragen. Die App-Zentrale enthält nur App-Kacheln. Objektseiten verwenden native OpenUI5-Belegköpfe und fachliche Register, Positionsaktionen stehen an der Tabelle.

## Lokal entwickeln

Voraussetzung: Linux x64 oder eine vom PostgreSQL-Paket unterstützte Plattform, Node.js **24 LTS**, npm. Für Browsertests Chromium (`CHROMIUM_PATH` bei abweichendem Pfad).

```sh
npm ci
npm run build
npm run dev:setup
npm run dev
```

Der Entwicklungsstart verwendet eine echte lokale PostgreSQL-18.4-Instanz auf Port 55432, dauerhaft unter `.local/postgres`. API/UI auf Port 3000. Bei Start mit belegtem Port nicht fremde Prozesse beenden. Mit Strg+C werden nur die eigenen Prozesse beendet. Nach Änderungen an UI5-Views/Controllern neu bauen; der Server liefert den geprüften Build unter `ui5-dist/` aus. Das vollständige Cloud-Setup steht in `scripts/cloud-install.sh`.

Zufällig erzeugte Zugänge für Administration, Disposition, Support, Technik und Kundenportal liegen in **`.local/accounts.json`** (Modus 0600). Tenant: `netfusion`. Passwörter nicht einchecken oder in Logs/Chat kopieren. Keine festen Standardpasswörter. Die Entwicklungsdatenbank enthält einen ausdrücklich bezeichneten Entwicklungskunden und keine künstlichen Tickets oder Kennzahlen. Neue Anfragen werden wirklich gespeichert.

```sh
npm run build
npm test
npm run test:browser:all
```

Tests erzeugen und entfernen eigene isolierte PostgreSQL-Datenbanken. Sie verändern keine Entwicklungs-/Produktionsbelege. Wenn die lokale DB noch nicht läuft, startet der Test-Harness sie für den Test. Browserbilder unter `test-results/` enthalten ausschließlich Testdaten.

## Ubuntu mit Docker

`compose.yaml` enthält PostgreSQL, Migrationsjob, unprivilegierte API und Caddy für HTTPS. Die Konfiguration benötigt DNS, Domain und sichere Secrets. Beispielnamen stehen in `.env.example`. Verwende für `POSTGRES_PASSWORD` und `ERP_DATABASE_PASSWORD` mindestens 32 zufällige **URL-sichere** Zeichen, für `ERP_SESSION_SECRET` mindestens 48. `.env` liegt außerhalb der Versionskontrolle.

```sh
docker compose config --quiet
docker compose up --build -d
# Einmalig: ERP_BOOTSTRAP_* sicher in .env setzen, dann:
docker compose --profile setup run --rm bootstrap
```

Bootstrap legt einen echten Tenant, eine Serviceorganisation und einen Administrator an, überschreibt keine vorhandenen Mandanten und seedet keine Entwicklungskonten. Danach Bootstrap-Passwort aus `.env` entfernen. Kunden und interne Benutzer werden in der Administration angelegt. Vor produktivem Einsatz MFA/OIDC, zentralen Angriffsschutz, Backup/Restore, Monitoring, fachliche Regeln und Security-/Lasttests abschließen.

In dieser Cloud wurde Compose nicht live getestet, da kein Docker-Daemon zugänglich ist. Der lokale Anwendungstest ist davon getrennt. Ubuntu + Docker ist grundsätzlich geeignet; Ressourcen, Domain, Datensicherung und tatsächliche Serverkonfiguration müssen dort noch geprüft werden.

## Dokumentation

- [Preview 0.9: Buchungskern und Finanzbelege](docs/previews/v0.5.0-preview.1/README.md) und [Versionsnotizen](docs/releases/v0.5.0-preview.1.md)
- [Preview 0.4: Ticketzeiten, WOT und SRM](docs/previews/v0.4.0-preview.1/README.md) und [Versionsnotizen](docs/releases/v0.4.0-preview.1.md)
- [Preview 0.3: Serviceauftrag und Preisfindung](docs/previews/v0.3.0-preview.1/README.md) und [Versionsnotizen](docs/releases/v0.3.0-preview.1.md)
- [Preview 0.2 mit Screenshots](docs/previews/v0.2.0-preview.1/README.md) und [Versionsnotizen](docs/releases/v0.2.0-preview.1.md)
- [Auslieferung und Materialverbrauch](docs/material-deliveries.md)
- [Nummernkreisverwaltung](docs/number-series.md)
- [Zusätzlicher Fachbacklog mit Originalanhängen](docs/backlog.md)
- [Architektur und Modulgrenzen](docs/architecture.md)
- [Domänenmodell](docs/domain-model.md) und [Datenbankschema](docs/database-schema.md)
- [Geschäftsprozesse](docs/business-processes.md), [Service](docs/service-management.md), [Dispatching](docs/dispatching.md)
- [Material](docs/material-management.md), [Einkauf](docs/procurement.md), [Faktura](docs/billing.md), [Buchhaltung](docs/accounting.md)
- [Belegfluss](docs/document-flow.md), [Workflows](docs/workflows.md), [Berechtigungen](docs/authorization.md)
- [API](docs/api-design.md), [Sicherheit](docs/security.md), [Deployment](docs/deployment.md)
- [Tests](docs/test-strategy.md) und [Entwicklungsplan/Status](docs/implementation-plan.md)

Lese-OData-V4-Teilumfang ist dokumentiert; Business-Kommandos verwenden REST mit CSRF, Idempotenz und Versionsprüfung. Der Browser ist keine Berechtigungsgrenze. Geschäftsbelege werden ausschließlich über Business-Services verändert.
