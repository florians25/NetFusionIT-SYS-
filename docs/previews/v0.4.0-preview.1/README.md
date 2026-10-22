# Preview 0.4 · Ticket → Work Order Task → SRM

Echte OpenUI5-Oberflächen aus dem isolierten Chromium-Testprozess. Alle angezeigten Belege, Personen, Zeiten und Kennzahlen sind Testdaten. Die Entwicklungsdatenbank wird durch diese Prozesse nicht befüllt.

## Zeiterfassung am Ticket

Arbeits-/Fahrzeit, Timer/Pausen, Aufgabenbezug und ausdrückliche Übergabe an die passende Auftragsposition. Die Erfassung funktioniert bereits vor der Anlage des Serviceauftrags.

![Arbeitszeiten am Ticket mit Auftragsübernahme](ticket-time.png)

![Ticketzeiten auf dem Smartphone](ticket-time-mobile.png)

## Automatische SRM beim Aufgabenabschluss

Die Work Order Task erzeugt einen eigenen SRM-Beleg mit den tatsächlichen Leistungen und unveränderter Ticket-Korrelations-ID. Die SRM bleibt mit Ticket, Aufgabe und Auftrag verknüpft.

![Erzeugte SRM mit Korrelation und Ticket-/Auftragsnavigation](task-srm.png)

![Kundenbestätigung der SRM](service-report-customer.png)

## Kaufmännische Weiterbearbeitung

Der Serviceauftrag zeigt die übergebenen Leistungen. Technischer Abschluss und Fakturabereitschaft folgen nach Kundenbestätigung, Servicefreigabe und vollständiger Endrückmeldung. Noch keine Rechnung oder Finanzbuchung.

![Übernommene Ticketleistungen am Serviceauftrag](order-execution.png)

![Freigegebene End-SRM am fakturabereiten Auftrag](order-completed.png)

![Serviceauftrag auf dem Smartphone](order-mobile.png)

[Versionsumfang und offene Punkte](../../releases/v0.4.0-preview.1.md) · [Verbindlicher Ticket-/SRM-Prozess](../../requirements/ticket-execution.md) · [App-Zentrale und Preisfindung aus Preview 0.3](../v0.3.0-preview.1/README.md)
