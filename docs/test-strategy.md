# Tests und Abnahme

## Erster Prozess – verpflichtend

Build/TypeScript; PostgreSQL-Migration wiederholbar und prüfsummengesichert; Login/Logout/CSRF; Kundenformular → persistentes Ticket/Fall/Relation/Audit; echte UI5-OData-Liste und Objektseite; Dispatcherzuweisung; Technikersicht und Statusregel; Neustart mit erhaltenen Daten.

Negativtests: falsche Anmeldung, fehlende Session/CSRF, unbekannte Felder, ungültige UUIDs, gesperrter Kunde, fremder Partner, falscher Tenant/Org, fehlende Rolle, fremder Techniker, ungültiger Status, veraltete Version, parallele gleiche Idempotenz, anderer Inhalt bei gleichem Schlüssel, konkurrierende Änderungen, Audit-UPDATE/DELETE und DB-Ausfall/Transaktionsrollback. Filter-/Sortier-Injection muss fehlschlagen. Ein Test ohne tatsächlich ausgeführte Fälle ist kein Nachweis.

Browser: echtes Chromium, echtes OpenUI5, Login, Kundenanlage/Ticketformular, Liste/Detail, Navigation, Zuweisung, mobile Darstellung. Keine rein statischen Screenshots als Funktionsnachweis. Zähler basieren auf gespeicherten Testbelegen, nicht auf fest codierten Zahlen.

## Spätere Abnahme

Szenarien A–E aus `business-processes.md` mit Mengen-/Geldabstimmung; zusätzlich negative Bestände, Überlieferung, doppelte Rechnung/Storno, geschlossene Periode, falsches Steuerkennzeichen, Teil-/Überzahlung, Rundung, Garantie-/Interngrenze, Sommerzeit/SLA-Pause, Terminüberschneidung. Finanz-/Steuerprozesse durch fachliche Abnahme ergänzen.

Restoretest mit isoliertem Ziel und Zeilen-/Referenz-/Summenprüfung, Lasttest mit definierter Zielgröße, Securitytest mit zweitem Tenant und Rollenmatrix. Noch nicht implementierte Module besitzen keine bestandenen E2E-Tests. Konkrete Ergebnisse werden in `docs/implementation-plan.md` dokumentiert.
