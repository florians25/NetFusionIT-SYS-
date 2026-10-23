# NetFusion · Enterprise Service ERP

**Preview0.25:** Größere native OpenUI5-Arbeitsseiten und Positionsraster, vollständige Ansprechpartner und eigene Dokumenteinstellungen. Normale Anschrift links, reduzierter Belegkopf mit Ansprechpartner rechts oben; historische PDFs bleiben unverändert. [Screenshots, PDF und Prüfungen](docs/previews/v0.25.0-preview.1/README.md).

**Oberflächen-Update:** Belegfluss in18 Vorgangsmasken als nativer aufklappbarer OpenUI5-Baum, mit Einzelzweigen, Gesamtsteuerung und Belegsprung. [Bilder und Prüfungen](docs/previews/document-flow-tree/README.md).

Eigenständiger modularer Monolith mit echtem **OpenUI5**, **NestJS/TypeScript** und **PostgreSQL**. Die Oberfläche verwendet ausschließlich **OpenUI5-Standardcontrols**, das Standardtheme und Standard-Abstandsklassen. Keine eigenen UI-Controls, Renderer, CSS-Dateien oder SVG-Logos. Seit Preview 0.19: **getrennte Service-Kostenvoranschläge und Verkaufsangebote**, native Desktop-Positionsraster, selektive Kundenentscheidung und gebundene AG→AU-Übernahme mit unabhängigen Prüfungen. Docker-Erstinstallation auf HTTPS-Port8070. **Kundenformular → Ticket + Servicefall → Technikerbearbeitung**, Kundenfreigabe, SLA, Servicebasis, Einsatzplanung sowie Artikel-/Auftragsfreigabe mit Preisfindung, Zeiten, geprüfte Leistungsnachweise und technischen Abschluss. Buchungskern mit Konten, Perioden, freigegebenen Journalen, Storno und Summen/Salden. Automatische Materialbedarfe aus freigegebenen Artikelpositionen, Lagerverfügbarkeit und Reservierungen; „Teile bestellen“ fordert nur die Fehlmenge per BANF mit Freigabe an. Teilbestellungen, bewertete Teilwareneingänge und Gegenbewegungen mit atomaren Finanzbuchungen. Tatsächliche Materialauslieferung/Teilauslieferung zum Serviceauftrag mit WA/LS-Nummern, Gegenbewegung, Kostenbuchung und automatischer Materialübernahme in die WOT-SRM. 66 verwaltbare Geschäftsnummernkreise; dichtere native Facharbeitsplätze mit Filtern, Belegwerten, Kontext und Status. Kleine PDF-Anlagenlisten mit unveränderlichem Archiv, tatsächlichen Geschäfts-PDFs im DIN-5008-Form-B-Brieflayout mit SAP-orientierter Beleggliederung, geschützten Downloads und Upload-Quarantäne. Eigenständige Fakturaanforderung → unabhängige Freigabe → Fakturavorrat → Teil-/Endrechnung mit FI/Forderung, tatsächlichem Leistungszeitraum und validiertem ZUGFeRD (PDF/A-3/CII). Originaler Rechnungseingang mit EG, sicherer CII/UBL-/Hybrid-Prüfung, Quarantäne und nativer Prüfoberfläche; gespeicherter Bestell-/Teil-WE-Abgleich, unabhängige Finanzprüfung und atomare WE/RE-/Vorsteuer-/Kreditorenbuchung mit zahlungsgesperrtem OP. Vollständiger interner Storno unbezahlter Eingangsrechnungen über unabhängig freigegebenen SB-Beleg, exakte Gegen-FI und Freigabe der ursprünglichen WE-Verrechnung. Physisches Lager mit Bereich/Gang/Regal/Ebene/Fach, echten Teil-Einlagerungen/Platzwechseln und Gegenbewegungen, Kapazitäts-/Mischregeln, Code128-Platzetiketten mit Archiv und Tastaturscan sowie geteilter Fachentnahme an SA. Einstufige Umlagerung freier Mengen zwischen Lagerorten/Werken desselben Buchungskreises mit genauer Gegenbewegung und erhaltener Unternehmensbewertung. Inventur mit tatsächlichem Zählstand, Fachsperren, ausdrücklichen Null-/Leerbestätigungen, unveränderlichem Erfassungsverlauf, unabhängiger Differenzfreigabe und atomarer LK-/FI-Korrektur einschließlich Originalgegenbewegung. Schwarze Code128-Belegnummern in der gemeinsamen Formularbasis; Ansprechpartnerfunktionen und freigegebene Finanzrollen je Buchungskreis. Eigener AU-Kundenauftrag mit echtem Vertriebsbereich, getrennten Partnerrollen/Anschriften, Positionshierarchie, Kontierung, Konditionsherkunft, Teileinteilungen, Sperren und unabhängiger Freigabe. Unveränderliche AB-Bestätigung, quellengebundener SA mit eigener Prüfung sowie akzeptierte Liefer-/Rechnungsanschrift und AU-/Kundenbestellreferenz bis zu WA/LS und tatsächlich validierter E-Rechnung.

Kein SAP-Backend nötig. Eigene Marke; Screenshots dienen als Fiori-/Prozessreferenz. Noch keine Produktivfreigabe. Beschaffung und Finanzbuchhaltung besitzen geprüfte Teilprozesse. Buchungskreisübergreifende bzw. mehrstufige Umlagerung, initiale Inventurbewertung ohne Wertgrundlage, Kamera-/Geräteabnahme, erweiterte Faktura/Steuerfälle, Rechnungskorrektur, Zahlung/Ausgleich, erweiterte Eingangsrechnungsfälle und erweiterte Workflow-/Vertragsfunktionen bleiben offen; der gesamte Masterprompt ist noch nicht umgesetzt.

Nach Anmeldung öffnet sich die **App-Zentrale** mit rollenabhängigen App-Kacheln. Anwendungen werden dort einzeln geöffnet; die Shell besitzt keine globalen App-Tabreiter. Das separat aufgerufene **Service-Cockpit** bietet: klickbare Kennzahlenkarten, Arbeitsvorräte für neue/unzugewiesene/kritische/laufende Tickets, Such-/Prioritäts-/Typfilter, Prioritätsverteilung und direkte Technikerzuweisung. Alle Werte stammen aus autorisierten Datenbankabfragen. Die App-Zentrale enthält nur App-Kacheln. Objektseiten verwenden native OpenUI5-Belegköpfe und fachliche Register, Positionsaktionen stehen an der Tabelle.

## Lokal entwickeln

Voraussetzung: Linux x64 oder eine vom PostgreSQL-Paket unterstützte Plattform, Node.js **24 LTS**, npm und Java **21** für die E-Rechnungsausgabe. PDF-Prüfungen benötigen `poppler-utils`. Für Browsertests Chromium (`CHROMIUM_PATH` bei abweichendem Pfad).

```sh
npm ci
npm run einvoice:setup
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

**Schnellinstallation auf Port 8070** (im Repository-Verzeichnis, Server-IP anpassen):

```sh
ERP_DOMAIN=192.168.1.20 docker compose -f compose.quickstart.yaml up -d --build
```

Danach `https://192.168.1.20:8070` öffnen. Datenbank, Migrationen und Erstadministrator werden automatisch angelegt. [Zugangsdaten abrufen, internes HTTPS-Zertifikat und Neustarts](docs/docker-8070.md).

### Eigene Produktionskonfiguration mit Domain

`compose.yaml` enthält PostgreSQL, Migrationsjob, unprivilegierte API und Caddy für HTTPS. Die Konfiguration benötigt DNS, Domain und sichere Secrets. Beispielnamen stehen in `.env.example`. Verwende für `POSTGRES_PASSWORD` und `ERP_DATABASE_PASSWORD` mindestens 32 zufällige **URL-sichere** Zeichen, für `ERP_SESSION_SECRET` mindestens 48. `.env` liegt außerhalb der Versionskontrolle.

```sh
docker compose config --quiet
docker compose up --build -d
# Einmalig: ERP_BOOTSTRAP_* sicher in .env setzen, dann:
docker compose --profile setup run --rm bootstrap
```

Bootstrap legt einen echten Tenant, eine Serviceorganisation und einen Administrator an, überschreibt keine vorhandenen Mandanten und seedet keine Entwicklungskonten. Danach Bootstrap-Passwort aus `.env` entfernen. Kunden und interne Benutzer werden in der Administration angelegt. Vor produktivem Einsatz MFA/OIDC, zentralen Angriffsschutz, Backup/Restore, Monitoring, fachliche Regeln und Security-/Lasttests abschließen.

Das Produktionsimage wurde in dieser Cloud mit isoliertem PostgreSQL, Migrationen, Bootstrap, Anmeldung, schreibgeschütztem unprivilegiertem Prozess und echter E-Rechnungsprüfung getestet. Der [Image-Nachweis](docs/previews/v0.25.0-preview.1/docker-smoke.json) gilt für genau dieses lokale Image. Auf dem vorgesehenen Ubuntu-Server stehen Domain/HTTPS, Antivirus, Ressourcen, Backup/Restore und tatsächliche Betriebskonfiguration noch zur Prüfung aus.

## Dokumentation

- [Verbleibender Masterbacklog und aktuelle Arbeitsreihenfolge](docs/master-backlog-index.md)
- [Direktvertrieb ohne Ticket/Serviceauftrag](docs/requirements/direct-sales.md), [Statistiken und Reports](docs/requirements/reporting.md) · Lagerverkauf/Faktura, AU-BANF/Bestellung und Teil-WE/Rechnungseingang geliefert; fakturierte Retoure/Korrektur und weitere Reports offen

- [Preview0.25: Arbeitsseiten und vollständige Ansprechpartner](docs/previews/v0.25.0-preview.1/README.md), [Versionsnotizen](docs/releases/v0.25.0-preview.1.md)
- [Preview0.24: Einkaufsorganisationen und verbindliche Bestellzuordnungen](docs/previews/v0.24.0-preview.1/README.md), [Versionsnotizen](docs/releases/v0.24.0-preview.1.md)
- [Preview0.23: AU-Teilwareneingang und Rechnungseingang](docs/previews/v0.23.0-preview.1/README.md), [Versionsnotizen](docs/releases/v0.23.0-preview.1.md)
- [Preview0.22: AU-Materialbedarf, BANF und Teilbestellungen](docs/previews/v0.22.0-preview.1/README.md), [Versionsnotizen](docs/releases/v0.22.0-preview.1.md)
- [Preview 0.21.1: direkte Lieferfaktura, AF/Vorrat und ZUGFeRD](docs/previews/v0.21.0-preview.1/README.md), [Versionsnotizen](docs/releases/v0.21.0-preview.1.md)
- [Preview 0.20.1: direkte Lagerauslieferung, Teilmengen und genaue Rücknahme](docs/previews/v0.20.0-preview.1/README.md), [Versionsnotizen](docs/releases/v0.20.0-preview.1.md)
- [Preview 0.19.1: Kostenvoranschläge, Verkaufsangebote und Docker8070](docs/previews/v0.19.0-preview.1/README.md), [Versionsnotizen](docs/releases/v0.19.0-preview.1.md)
- [Preview 0.18.1: eigener Kundenauftrag, unveränderliche AB und gebundene Serviceausführung](docs/previews/v0.18.0-preview.1/README.md), [Versionsnotizen](docs/releases/v0.18.0-preview.1.md)
- [Preview 0.17.1: tatsächliche Inventur, unabhängige Differenzprüfung und genaue Gegenbewegung](docs/previews/v0.17.0-preview.1/README.md), [Versionsnotizen](docs/releases/v0.17.0-preview.1.md)
- [Preview 0.16.1: freie Lagerortumlagerung, genauer Gegenbeleg und konsistente Bestandsanzeige](docs/previews/v0.16.0-preview.1/README.md), [Versionsnotizen](docs/releases/v0.16.0-preview.1.md)
- [Preview 0.15.1: physisches Lager, Teil-Einlagerung, Fachentnahme und scanbare Platzetiketten](docs/previews/v0.15.0-preview.1/README.md), [Versionsnotizen](docs/releases/v0.15.0-preview.1.md)
- [Preview 0.14.1: interner Eingangsrechnungsstorno mit Gegen-FI und nachvollziehbarer Mengenfreigabe](docs/previews/v0.14.0-preview.1/README.md), [Versionsnotizen](docs/releases/v0.14.0-preview.1.md)
- [Preview 0.13.1: unabhängige Eingangsrechnungsprüfung, WE/RE-Verrechnung, FI und Kreditorenposten](docs/previews/v0.13.0-preview.1/README.md), [Versionsnotizen](docs/releases/v0.13.0-preview.1.md)
- [Preview 0.12.2: Bestell-/SA-Zuordnung und tatsächliche Teil-WE-Vorprüfung](docs/previews/v0.12.0-preview.2/README.md), [Versionsnotizen](docs/releases/v0.12.0-preview.2.md)
- [Preview 0.12.1: Rechnungseingang, Originalprüfung und EG-Prüfblatt](docs/previews/v0.12.0-preview.1/README.md), [Versionsnotizen](docs/releases/v0.12.0-preview.1.md)
- [Preview 0.11.1: Fakturaanforderung, Teilrechnung, ZUGFeRD und Code128](docs/previews/v0.11.0-preview.1/README.md), [Versionsnotizen](docs/releases/v0.11.0-preview.1.md)
- [Rechtliche Compliance-Matrix und priorisierte Ergänzungen](docs/compliance-gap-analysis.md), [Eingangsrechnungen und Barcodes](docs/requirements/incoming-invoices-barcodes.md)
- [Preview 0.10.2: klassische Schwarz-Weiß-Geschäftsformulare](docs/previews/v0.10.0-preview.2/README.md) und [Versionsnotizen](docs/releases/v0.10.0-preview.2.md)
- [Preview 0.10.1: Anlagenlisten und dichtere Fachmasken](docs/previews/v0.10.0-preview.1/README.md) und [Versionsnotizen](docs/releases/v0.10.0-preview.1.md)
- [Preview 0.9: Auslieferung und korrelierte Material-SRM](docs/previews/v0.9.0-preview.1/README.md)
- [PDF-Archiv, Quarantäne und ClamAV-Overlay](docs/attachments.md)
- [Preview 0.5: Buchungskern und Finanzbelege](docs/previews/v0.5.0-preview.1/README.md) und [Versionsnotizen](docs/releases/v0.5.0-preview.1.md)
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

PDF-Inhaltsprüfungen benötigen `pdftotext` (Poppler, z.B. Ubuntu-Paket `poppler-utils`). Die Anwendung benötigt dieses CLI-Tool nicht zur PDF-Erzeugung. Das optionale Antivirus-Overlay und seine noch offene Zielserverabnahme stehen unter docs/attachments.md.
