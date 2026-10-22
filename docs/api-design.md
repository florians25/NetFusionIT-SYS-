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

## Beschaffung ab Preview 0.6

`GET/POST /api/procurement/suppliers` liest beziehungsweise erzeugt Lieferantenstammdaten mit bestehender Geschäftspartnerfreigabe. Kundenlisten filtern explizit die CUSTOMER-Rolle.

`GET /api/service/orders/:id/procurement` liefert Bedarfe, BANF, Bestellungen und offene Materialpositionen. `POST .../material-requirements`, `.../requisitions` und `.../purchase-orders` erstellen ausschließlich auftrags-/positionsbezogene Belege. Mengenbindungen sind mit Auftragszeilensperre vor konkurrierenden Mehrfachanforderungen geschützt. Einkaufspreis und Auftragsverkaufspreis sind getrennt.

`GET /api/procurement/documents/:id` liefert Kopf, Ursprungsauftrag, Positionen, Kontierung, noch ungebundene Mengen beziehungsweise Bestellwert. `POST .../:id/cancel` verwirft zulässige Entwürfe/abgelehnte Belege mit Version und Grund. Freigabe läuft über die gemeinsame Workflow-API mit belegspezifischer Berechtigung und erneutem Mengen-/Lieferanten-/Auftragscheck. Ersteller und Einreicher sind bei Vier-Augen beide ausgeschlossen. Keine WE-/Lager-/FI-Seiteneffekte aus Bestellfreigabe.

## Materialversorgung und bewertetes Lager ab Preview 0.7

- `GET /api/service/orders/:id/material-planning`: automatische Artikelbedarfe, freie/reservierte Mengen, physische Fehlmenge, neu anzufordernde Menge, BANF/Bestell-/WE-Mengen, Positions-/Kopf-Versorgungsstatus und Reservierungen. Keine Kundenprojektion.
- `POST /api/service/orders/:id/material-planning`: erwartete Auftragsversion, `action` USE_STOCK oder REQUEST_PARTS sowie `items[{itemId,requiredOn,locationId}]`. Reserviert zuerst tatsächlichen freien Bestand; REQUEST_PARTS erzeugt nur ungedeckte Fehlmengen-BANF und reicht sie atomar in den konfigurierten Workflow ein. Antwort enthält Reservierungen, Fehlmengen, ggf. BANF IN_REVIEW und Freigabeinstanz. Kein Bestellerfolg bei fehlender Workflowkonfiguration.
- `POST /api/service/orders/:id/reservations/:reservation/release`: Version/Grund, Auftragsumfang und Status werden erneut geprüft.
- `GET /api/inventory/companies`, `GET /api/inventory/companies/:id`: erlaubte Buchungskreise, Lagerorte, Lagerführung, physisch/reserviert/frei, aggregierte Bewertung/Durchschnitt und sichtbare Bewegungen.
- `POST /api/inventory/companies/:id/plants`, `.../locations`: native Lagerkonfiguration mit explizitem Buchungskreis.
- `POST /api/inventory/materials/:id/settings`: explizite Bewertungs-/Trackingkonfiguration, geschützt nach erster Bewegung.
- `GET /api/procurement/documents/:id/receiving-context`: freigegebene Lagerpositionen, Rest-/Toleranzmengen, offene Perioden und Lagerorte.
- `POST /api/procurement/documents/:id/receipts`: Bestellversion, Periode, Buchungs-/Belegdatum, Lieferschein und Positionen mit Menge/Lagerort/Charge/Seriennummer. Materialbeleg, Bewertung, Ursprungsreservierung, Quellen-FI und Audit sind atomar.
- `GET /api/inventory/receipts/:id`: autorisierter Materialbeleg mit Ursprung und Journalreferenz.
- `POST /api/inventory/receipts/:id/reverse`: Periode, Datum und Grund für eindeutige Gegenbewegung mit Originalwert/-konten.

Alle schreibenden Kommandos verlangen CSRF/Idempotenz; Versionen werden dort verlangt, wo veränderlicher Vorzustand besteht. Sichtbarkeit folgt dem Auftrag. Eine Materialreservierung erzeugt keine SRM und noch keinen tatsächlichen Verbrauch.

## Geschäftsnummern und Arbeitslisten ab Preview 0.8

`GET /api/admin/number-series` liefert alle 66 festen Bereiche mit nächster Nummer, Belegung, Rest, Aktivstatus und Version. `PATCH /api/admin/number-series/:prefix` benötigt Administration, CSRF/Idempotenz, erwartete Version, `active`, optionalen `nextValue` und Grund. Nur Vorwärtssetzung innerhalb des festen Bereichs; keine frei zugängliche Nummernreservierung ohne Fachbeleg. Neue Fachbelege beziehen ihre Nummern automatisch in derselben Transaktion.

Artikelanlage akzeptiert optional `numberPrefix` HW/SW/DL/LI/ER/ZU passend zur Artikelart; SKU bleibt unabhängig. Benutzer-/Kontakt-/Zeiterfassungsprojektionen enthalten ihre neuen Nummern. Auftragslisten enthalten exakte Positionssummen als Dezimalstrings, Positionsanzahl, Fall-/Organisationsbezug und Materialstatus innerhalb derselben autorisierten Sicht. Arbeitslistensuche und Statusfilter verwenden native UI5-Filter; serverseitige Berechtigung wird dadurch nicht erweitert.

## Auslieferung/Verbrauch ab Preview 0.9

- `GET /api/service/orders/:id/delivery-context`: offene berechtigte Aufgaben, Perioden und verbleibende konkrete Reservierungen mit Serien-/Chargen-/Lagerbezug.
- `POST /api/service/orders/:id/deliveries`: Auftragsversion, Task, Periode, Daten/Text und `items[{reservationId,quantity}]`; tatsächliche Teil-/Vollausgabe mit WA/LS, Bewertung und Quellen-FI. Keine freie Kostenangabe.
- `GET /api/service/orders/:id/deliveries`: zugehörige Materialbelege/Rücknahmen.
- `GET /api/inventory/issues/:id`: autorisierter Istbeleg mit Ticket/WOT-Korrelation, ursprünglicher Auftragsposition, Bewertung, Journal und aktueller Rücknehmbarkeit.
- `POST /api/inventory/issues/:id/reverse`: offener Korrekturzustand, Periode, Daten und Grund für eindeutige vollständige Gegenbewegung.

Schreiben benötigt CSRF/Idempotenz; veränderlicher Auftragszustand wird versionsgeprüft und gesperrt. WOT-Abschluss sammelt zusätzlich wirksame Materialausgaben als dritte Istquelle; keine unabhängige manuelle Materialkopie in der SRM. Ticket-Ausführung liefert interne Materialbelegverweise. Materialplanung unterscheidet ursprüngliche/offene Reservierung und Verbrauch und fordert verbrauchte Mengen nicht neu an.

## Vorgangsbezogene PDF-Anlagen

`GET /api/documents/:id/attachments` liefert Quellenstand, erlaubte Dokumentarten und geschützte Metadaten; beim Serviceauftrag zusätzlich berechtigte Folgebelegdateien. `POST .../generate` benötigt Idempotency-Key, Quellversion, DocumentType und Sichtbarkeit. `POST .../upload?filename=...` sendet maximal5MiB `application/pdf` als rohe Bytes mit CSRF und Idempotency-Key. `POST .../:attachmentId/scan` startet einen weiteren protokollierten Scan. `GET .../:attachmentId/download` liefert nach erneuter Quellenprüfung die archivierten Bytes als Anhang; Quarantäne409, fremde Quelle/Datei404. Kunden können nur ausdrücklich veröffentlichte PDFs ihrer Vorgänge lesen; keine Erzeugung/Uploads/Scans. Siehe [Archiv, Dateitypen und Grenzen](attachments.md).

## Physischer Lagerarbeitsplatz (0.15)

Alle Mutationen benötigen Session/CSRF/Idempotency-Key. `inventory.read` erlaubt autorisierte Anzeige/Scan/Download; `inventory.write` erlaubt Struktur, Platzbewegung und Etikettenerstellung. Veränderbare Stammdaten verlangen aktuelle Version und Grund. Mengen bleiben Dezimalstrings.

| Methode/Pfad | Zweck |
| --- | --- |
| GET /api/warehouse/companies/:id | Tatsächliche Struktur, Fach-/Puffermengen, letzte100 Platzbelege/200 Buchungen |
| POST /api/warehouse/areas, /racks, /bins | Bereich, Gang/Regal und Fach anlegen |
| PATCH /api/warehouse/structure/:kind/:id | Versionierte Bezeichnung, Sperre und Fachregeln |
| POST /api/warehouse/transfers | Tatsächliche Teil-Einlagerung bzw. Platzwechsel im selben Lagerort |
| GET /api/warehouse/transfers/:id | Unveränderlicher gebuchter Stand und Gegenbezug |
| POST /api/warehouse/transfers/:id/reverse | Exakte Gegenbewegung mit tatsächlich verfügbarem Bestand |
| GET /api/warehouse/scan?companyId=…&kind=BIN\|PRODUCT&value=… | Autorisierte Identitätsprüfung; keine Mengenbuchung |
| GET/POST /api/warehouse/bins/:id/labels | Kleine Etikettenliste / unveränderlichen aktuellen PDF-Stand archivieren |
| GET /api/warehouse/bins/:id/labels/:labelId/download | Autorisierter, hashgeprüfter PDF-Download |

SA-Auslieferungszeilen ergänzen `binId`; eine Reservierung darf über mehrere unterschiedliche Fächer verteilt werden. Ohne `binId` ist ausschließlich tatsächlicher Eingangspufferbestand verwendbar. Rücknahmen verwenden das Originalfach. Normale Dokumentanlagen unterstützen `STOCK_TRANSFER`. [Fachlicher Vertrag und Grenzen](warehouse.md).

Ab0.16 akzeptiert `POST /api/warehouse/transfers` zusätzlich `movementType: "LOCATION_TRANSFER"` mit `destinationLocationId`. Alle Positionen verbinden tatsächliche Fächer der angegebenen unterschiedlichen Quell-/Ziel-Lagerorte im selben Buchungskreis. Nur freie Menge ist verwendbar; Reservierungen bleiben erhalten. Die exakte Gegenbewegung verwendet die umgekehrten Originalorte/-fächer und freie Zielmenge. Kontext/Detail ergänzt `destinationLocationId`/-codes und je Fachzeile `locationQuantity`, `locationFreeQuantity`, `locationReservedQuantity` aus demselben lesenden Snapshot.

### Inventur und Differenzbuchung (0.17)

`GET /api/inventory-counts/companies/:companyId` liefert die letzten100 Vorgänge; `GET /api/inventory-counts/:id` liefert Zählumfang, Linien, unveränderliche Erfassungs-/Vorbereitungshistorie, Bewertungsstand, Prüfung, tatsächliche Korrektur und FI. `POST /api/inventory-counts` beginnt mit `companyId,title,reason,binIds` und sperrt reale Fächer. `POST :id/lines/:lineId/count` erfasst `version,quantity,note` (leere Menge ist nicht null; ausdrückliche0 zulässig). `POST :id/bins/:binId/empty` bestätigt ein tatsächlich positionsloses Fach; `POST :id/lines` ergänzt bekannte Artikel mit `binId,productId,batch,serial,note,version` und Soll0.

`POST :id/prepare` bindet `version,periodId,postingDate,documentDate,costCenter,note` an die tatsächliche Bewertung. Vorhandener Vier-Augen-Workflow mit `subjectKind: INVENTORY_COUNT` verwendet unabhängige Rollen ADMIN/ACCOUNTANT. `POST :id/withdraw` zieht eine noch nicht gebuchte Freigabe mit Grund zurück; `POST :id/cancel` bricht offene Zählung mit Grund ab. `POST :id/post` benötigt Finanzberechtigung, `version`, gebundenen aktuellen Prüfstand und unabhängige Freigabe. `POST :id/reverse` übernimmt `version,reason` in einen eigenen gebundenen Gegenbewegungsantrag; Vorbereitung/Freigabe/Buchung sind erneut erforderlich. Jede Mutation verwendet CSRF, Versionsprüfung und Idempotency-Key. Zugehörige kleine Anlagenliste nutzt dieselbe geschützte PDF-API wie andere Vorgänge.
