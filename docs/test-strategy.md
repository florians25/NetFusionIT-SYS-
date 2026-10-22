# Tests und Abnahme

## Erster Prozess – verpflichtend

Build/TypeScript; PostgreSQL-Migration wiederholbar und prüfsummengesichert; Login/Logout/CSRF; Kundenformular → persistentes Ticket/Fall/Relation/Audit; echte UI5-OData-Liste und Objektseite; Dispatcherzuweisung; Technikersicht und Statusregel; Neustart mit erhaltenen Daten.

Negativtests: falsche Anmeldung, fehlende Session/CSRF, unbekannte Felder, ungültige UUIDs, gesperrter Kunde, fremder Partner, falscher Tenant/Org, fehlende Rolle, fremder Techniker, ungültiger Status, veraltete Version, parallele gleiche Idempotenz, anderer Inhalt bei gleichem Schlüssel, konkurrierende Änderungen, Audit-UPDATE/DELETE und DB-Ausfall/Transaktionsrollback. Filter-/Sortier-Injection muss fehlschlagen. Ein Test ohne tatsächlich ausgeführte Fälle ist kein Nachweis.

Browser: echtes Chromium, echtes OpenUI5, Login, Kundenanlage/Ticketformular, Liste/Detail, Navigation, Zuweisung, mobile Darstellung. Keine rein statischen Screenshots als Funktionsnachweis. Zähler basieren auf gespeicherten Testbelegen, nicht auf fest codierten Zahlen.

## Spätere Abnahme

Szenarien A–E aus `business-processes.md` mit Mengen-/Geldabstimmung; zusätzlich negative Bestände, Überlieferung, doppelte Rechnung/Storno, geschlossene Periode, falsches Steuerkennzeichen, Teil-/Überzahlung, Rundung, Garantie-/Interngrenze, Sommerzeit/SLA-Pause, Terminüberschneidung. Finanz-/Steuerprozesse durch fachliche Abnahme ergänzen.

Restoretest mit isoliertem Ziel und Zeilen-/Referenz-/Summenprüfung, Lasttest mit definierter Zielgröße, Securitytest mit zweitem Tenant und Rollenmatrix. Noch nicht implementierte Module besitzen keine bestandenen E2E-Tests. Konkrete Ergebnisse werden in `docs/implementation-plan.md` dokumentiert.

## Materialversorgung und bewertetes Lager · Preview 0.7

Automatische Bedarfserkennung aus genehmigten Artikelpositionen, Bestand6/Bedarf10, Lagerreservierung6 und Fehlmengen-BANF4 mit automatischem Workflowstart; fehlende Definition rollt BANF/Nummern/Version zurück. Parallele Planung erzeugt keine Doppelreservierung; gleichzeitige Auftragsfreigabe und Planung verwenden konsistente Sperrreihenfolge. Wiederholtes Bestellen darf keine zweite Fehlmenge anfordern. Kunden-/Techniker-/Org-/Tenantgrenzen und Datenbank-Überreservierung werden negativ geprüft.

WE prüft Konfiguration, Lagerort, Periode, Toleranz, kumulierte Teilmengen, Serien-/Chargenpflicht, Nullpreis und exakte Bewertung. WE4+2 zu Bestellung6 sowie WE4 zu weiterer Bestellung4 ergibt Bestand10/Wert480/Durchschnitt48. Storno verwendet Originalwerte/-konten und verhindert doppelte Gegenbewegung, Fremdreservierungsbruch und isoliertes Quellen-FI-Storno. Direkte Projektionsänderung und nachträglicher Materialbeleginhalt sind gesperrt.

Zwei zusätzliche echte Chromium-Prozesse prüfen Lagerkonfiguration/WE/FI/Storno und den auftragsbezogenen Lager-/Fehlmengenprozess mit Nichtlager-/Fremdleistungspositionen. Desktop- und Android-Mobile-Darstellung, native Overflow-Navigation, Konsolen-/HTTP-Fehler und horizontaler Überlauf werden geprüft. Screenshots entstehen erst nach abgeschlossener Datenladung und Standardnavigation.

## Tatsächlicher Verbrauch und SRM · Preview 0.9

Teilausgabe2/Wert96, Originalrücknahme, Vollausgabe10/Wert480 auf Nullbestand/-wert; keine neue BANF für Verbrauch. Konkurrierende Ausgabe, gleiche Idempotenzantwort, fehlende Regeln/Aufgaben und Rollen-/Kundengrenzen sind geprüft. Rücknahme nach geänderter Kontierung verwendet Originalkonten. Gleichzeitig laufender SRM-Entwurfsabbruch und Rücknahme dürfen nicht blockieren oder doppelt buchen; neue Nachweise erhalten korrekte tatsächliche Quellen.

SQL-Negativprüfung verhindert direkte falsche Bewertung, Änderung von Istpositionen, Anhängen an freigegebene SRM und private Projektionsänderung. Zusätzlicher Währungsfall USD-Verkaufsauftrag/EUR-Einkauf/-Istkosten prüft den Materialkosten-Snapshot. Der elfte Browserablauf führt durch Ticketzeit, Mengen-Dialog, Ausgabe, Gegenbewegung, Materialnavigation, SRM, Kundenbestätigung, Servicefreigabe und Abschluss einschließlich Smartphone.
