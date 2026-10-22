# API-Vertrag – erste vertikale Funktion

Gleiche Origin für UI und API. JSON, validierte begrenzte Payloads, keine CORS-Freigabe. Fehler enthalten sichere Meldung und Korrelations-ID, keine SQL-/Stackdetails. 400 Validierung, 401 keine Session, 403 Aktion verboten/CSRF, 404 nicht sichtbar, 409 Versions-/Idempotenz-/Zustandskonflikt, 429 Rate Limit.

## REST-Kommandos

| Methode/Pfad | Zweck |
|---|---|
| GET /health/live, /health/ready | Prozess / tatsächliche DB-Erreichbarkeit |
| GET /api/auth/session | Session + CSRF-Token; anonym nur CSRF |
| POST /api/auth/login | Tenant-Slug, E-Mail, Passwort; Sessionregeneration |
| POST /api/auth/logout | Session löschen |
| GET /api/dashboard | echte, autorisierte Zähler |
| GET/POST /api/partners | aktive Kunden lesen / als Admin anlegen |
| GET /api/technicians | aktive Techniker der eigenen Org; nur interne Rollen |
| POST /api/tickets | validiertes Ticket + Fall; Idempotency-Key erforderlich |
| GET /api/tickets/:id | autorisierte Objektseite mit Statusaktionen |
| POST /api/tickets/:id/assign | technicianId + erwartete version; Idempotenz |
| POST /api/tickets/:id/status | status + erwartete version; Idempotenz |
| GET /api/cases/:id | sichtbarer Servicefall mit Tickets |
| GET /api/documents/:id/flow | bidirektionale, autorisierte Relationen |
| GET /api/admin/users | Benutzerliste ohne Hashes |
| POST /api/admin/users | Benutzer + Org-/Partnerbindung; keine Selbstregistrierung |
| PATCH /api/admin/users/:id | Rolle/Aktivstatus; Audit und Schutz letzter Admin |
| GET /api/admin/organization | eigene Organisationsstruktur |

Schreibende Requests benötigen `X-CSRF-Token`. Ticket-/Zuweisungs-/Statuskommandos zusätzlich `Idempotency-Key` (UUID); gleicher Schlüssel und andere Payload ergeben 409. `version` ist ein Pflichtfeld für Änderungen. Korrelation wird serverseitig je Request erzeugt.

## OData V4

Service `/odata/`, `$metadata` in EDMX V4. EntitySets Tickets, ServiceCases, BusinessPartners, Technicians. JSON enthält `@odata.context`, `value` und bei `$count=true` `@odata.count`. Unterstützt: Schlüsselzugriff, `$top` (max.100), `$skip`, `$select`, `$orderby`, `$count`, `$filter` mit `eq/ne`, `and/or`, Klammern und `contains`. Paging wird deterministisch um ID ergänzt. Ungültige Felder/Operatoren/Optionen werden abgewiesen, nicht in SQL interpoliert. Interne Serverbedingungen können nie durch OData-Filter aufgehoben werden.

Dies ist ein lesender OData-V4-Teilumfang, kein vollständiger OData-Server: kein `$batch`, `$expand`, `$apply`, Delta oder OData-Schreiben. Das UI5-V4-Modell verwendet `$direct`; Kommandos laufen über REST. Unsupported Requests erhalten explizite Fehler. Metadaten und UI5-Abfragen werden durch Integration und Browser überprüft.

`GET /api/dashboard` liefert `newCount`, `unassigned`, `critical` (HIGH/CRITICAL und noch technisch ungelöst), `inProgress`, `open`, `total`, `waiting`, `last24h`, `cases`, `distribution[]` und `updatedAt`. `distribution` enthält Anzahl/Prozent pro Priorität auf Basis offener Tickets, gerundet auf ganze Prozent. Keine SLA-Aussage. Arbeitsvorräte werden separat über `/odata/Tickets` mit entsprechenden Status-/Prioritätsfiltern geladen; jeder Leseweg wendet denselben Benutzer-/Kunden-/Organisationsumfang an. DateTimeOffset-Metadaten besitzen Millisekundenpräzision (`Precision=3`).

## Auftragskern ab Preview 0.3

- `/api/catalog/currencies`: konfigurierte Währungen lesen; Administration legt Code/Präzision einmalig an.
- `/api/catalog/products`: rollenbezogener Artikel-/Servicekatalog; Anlage als Entwurf, PATCH nur vor Freigabe.
- `/api/workflow/submit/:id`: prüft jetzt zusätzlich die belegspezifische Schreibberechtigung für Kunden, Artikel oder Serviceauftrag.
- `/api/pricing/conditions`: Konfiguration von Preisen/Steuern; Steuer erfordert Finance-Berechtigung, sonstige Preise Vertrieb. Deaktivieren mit erwarteter Version, keine rückwirkende Preisänderung.
- `/api/service/orders`, `/:id`, `/:id/items`: Fall-/Kundenbezug, nur genehmigte Artikel, explizite Konditionen, Preis-Snapshot und separate Auftragsfreigabe. Kundenprojektion entfernt interne Kostenzuordnung und Preisprotokoll.
- `/api/service/order-contexts`: zur Auftragsanlage berechtigte Benutzer erhalten zulässige Servicefälle mit Kunden-/Organisationsbezug.

POST/PATCH erfordern CSRF und Idempotency-Key; bestehende Versions-/Tenant-/Org-Grenzen gelten. Kein Lager-/Faktura-/FI-Seiteneffekt im Auftragsentwurf.

## Ticket-Ausführung ab Preview 0.4

Verbindlich: [Ticket → Work Order Task → SRM](requirements/ticket-execution.md). `GET /api/tickets/:id/execution` liefert Aufgaben, eigene/zugängliche Arbeits-/Fahrzeiten, Pauschalen und passende Aufträge. Kunden erhalten keine internen Ausführungsdaten. `POST .../tasks` legt eine eigene Aufgabe an, optional bereits mit Auftragsziel. Zeiten sind vor Auftragsanlage möglich.

`POST /api/tickets/:id/times` erfasst manuelle Arbeits-/Fahrzeit. `POST .../timer` startet den Ticket-Timer; `POST .../timer/{pause|resume|stop|discard}` verlangt dessen Version. Timer und manuelle Zeit gehören einer Aufgabe. `POST .../charges` erfasst katalogbasierte Fahrt-/Servicepauschalen, Kilometer-/Ausgabenleistungen. Keine frei eingeschleusten Verkaufspreise.

`POST .../{times|charges}/:entry/allocate` übergibt eine erfasste Leistung an Auftrag und Position mit Versionsschutz. Auftrag muss freigegeben und demselben Fall, Kunden und derselben Organisation zugeordnet sein. Arbeits-/Fahrzeit und Pauschalen werden gegen Einheit, Artikel und Abrechnungsregel geprüft. Ursprünglicher Ticket-/Aufgabenbezug bleibt erhalten. `POST .../{times|charges}/:entry/void` verwirft eine eigene, noch nicht eingereichte Erfassung mit Begründung.

`POST .../tasks/:task/order` ordnet das Auftragsziel zu, `POST .../tasks/:task/complete` schließt eine Aufgabe ab und erzeugt atomar eine SRM mit allen tatsächlichen Leistungen der Aufgabe. Korrelation wird aus dem Ticket übernommen, nicht aus der Anfrage. Idempotente und parallele Aufrufe erzeugen keine doppelte aktive SRM. `POST .../tasks/:task/cancel` erlaubt begründetes Verwerfen einer eigenen Aufgabe ohne aktive Leistungen.

`GET /api/service/orders/:id/execution` liefert übernommene Ticketleistungen und SRM; dort wird keine separate Zeitkopie erfasst. `GET /api/service/reports/:id` zeigt die SRM mit Ticket-/Aufgaben-/Auftragsbezug und Korrelation. Einreichen erfolgt über den bestehenden Workflow; `POST .../confirm` bestätigt als angemeldeter Kunde, `POST .../cancel` verwirft einen eigenen Entwurf und öffnet die Aufgabe erneut. Kundenbestätigung ist getrennt vom eingefrorenen fachlichen Versionsstand auditierbar und höchstens einmal möglich.

`POST /api/service/orders/:id/complete` prüft den vollständigen technischen Abschluss; `POST .../billing-ready` stellt einen technisch abgeschlossenen Auftrag mit fakturierbaren Positionen bereit. Aktuelle Version, CSRF und Idempotency-Key sind erforderlich. Keine Rechnung oder Finanzbuchung wird durch diese Kommandos vorgetäuscht.

## Buchungskern ab Preview 0.5

`GET/POST /api/finance/companies` verwaltet explizite Buchungskreise. Unter `companies/:id` stehen `context`, `accounts`, `periods`, `periods/:period/status`, `rules`, `journals` und `trial-balance` zur Verfügung. Kontierungsregeln benötigen einen vollständigen Satz passender Kontenrollen und die aktuelle Konfigurationsversion. Periodenänderungen benötigen Version und Begründung.

`POST /api/finance/journals` legt einen ausgeglichenen Entwurf an. Finanzbelege nutzen den konfigurierten Vier-Augen-Workflow mit ausschließlich Buchhaltungs-/Administrationsrollen. `GET journals/:id` liefert Kopf, Positionen und exakt berechnete Soll-/Haben-Summen. `POST journals/:id/post` prüft Freigabe, Version, Konten, Präzision und offene Periode erneut, vergibt die endgültige Nummer und schreibt den Beleg unveränderlich fest. `POST journals/:id/reverse` erzeugt einen eigenen genehmigungspflichtigen Gegenbeleg, keine Überschreibung des Originals. Entwürfe beeinflussen die Salden nicht.

Die Readiness-Probe liefert nur dann 200, wenn die Migrationsprüfsummen exakt zum laufenden Quellstand passen und alle Migrationstabellen existieren. Keine Daten oder Prüfsummen werden öffentlich ausgegeben.
