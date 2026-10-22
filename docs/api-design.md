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
