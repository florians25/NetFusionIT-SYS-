# Verbindliche Oberflächenvorgaben des Nutzers

Aktualisiert: 23.10.2026, nach den SAP-Musterbildern und der Navigationskorrektur.

- Ausschließlich OpenUI5-Standardcontrols, offizielle Themes und Standardklassen. Keine eigenen CSS-Dateien, Renderer, HTML-Ersatzcontrols oder SVG-Logos.
- Nach Anmeldung öffnet sich die **App-Zentrale**. Anwendungen werden über ihre rollenabhängigen App-Kacheln aufgerufen. Die Zentrale enthält keine darunter angehängte Ticketliste.
- Keine globale Tab-Leiste mit allen Anwendungen. Die Shell bietet die Rückkehr zur App-Zentrale und nennt die aktive Anwendung.
- Neueste Korrektur: keine App-Tabreiter in der Shell, auch nicht für verwandte Anwendungen. Cockpit, Tickets, Servicefälle, Einsatzplanung, Kostenvoranschläge, Verkaufsangebote und Kundenaufträge bleiben eigene Apps der App-Zentrale. Tatsächliche Geschäftsbelege lassen sich innerhalb des Vorgangs über den berechtigten Belegfluss öffnen. Fachliche Abschnitte einer Objektseite bleiben erhalten.
- Objektseiten verwenden kompakte Belegköpfe, nachvollziehbare Status/Summen und ausschließlich fachlich zugehörige Register. Positionsaktionen stehen direkt an der Positionstabelle. Kostenvoranschlag, Verkaufsangebot und Kundenauftrag verwenden am Desktop das native `sap.ui.table.Table`-Positionsraster mit separaten Spalten für Position, Artikel, Kurztext, Menge, ME, Einzelpreis, Nettowert, Steuer, Termin, Abrechnungsregel, Status und Kundenmaterial. Langtexte und Kontierung bleiben über einen nativen Positionsdialog erreichbar; auf dem Smartphone dient eine native Pop-in-Tabelle. Native OpenUI5 ObjectPageLayout/AnchorBar, Tabellen und Formulare bilden die Referenzmuster ab.
- Beispielbilder aus SAP sind fachliche und strukturelle Referenzen. Es werden keine nicht implementierten Aktionen oder erfundenen Kennzahlen als funktionsfähig dargestellt.
- Das Service-Cockpit bleibt eine eigenständige Anwendung mit echten Ticket-Kennzahlen und Arbeitsvorräten.

Die Vorgaben gelten auch für folgende Module und Preview-Versionen. Zusätzliche Anwendungen dürfen die globale Shell nicht wieder mit Tabs füllen.

## Informationsdichte aller Fachmasken

Nutzerpräzisierung vom 22.10.2026: Alle Fachseiten sollen die Informationsdichte und Gestaltung der Materialbedarfe erhalten. Native Belegköpfe und Anwendungsarbeitsplätze mit realen Geschäfts-/Organisationsbezügen, Status, Mengen/Werten, Herkunft/Folgebelegen, Filtern und Positionsaktionen ausbauen. Keine reinen Dekorationskennzahlen und keine leeren Platzhalterbereiche. Kleine PDF-Anlagenliste im nativen Modal nach der zusätzlichen [Lager-/Auslieferungs-/Anlagenvorgabe](warehouse-delivery-attachments.md). Auf Mobilgeräten kompakter Kopf, native Pop-ins und Abschnittsnavigation; Details bleiben erreichbar. Ausschließlich OpenUI5-Standardcontrols und Standardklassen.

Preview0.10 erweitert zusätzlich Disposition, Einsatzplanung, Genehmigungen und Geschäftspartner mit nativen Arbeitsplatz-/Objektköpfen, tatsächlichen Statuszählern, Herkunft, Team-/Qualifikationskontext, Filtern und Belegaktionen. Ticketerstellung zeigt die tatsächlich ausgewählten Objekt-/Vertragsstammdaten vor dem Speichern. PDF-Anlagen bleiben kleine Vorgangsdialoge. Screenshots unter docs/previews/v0.10.0-preview.1/.

Für mobile native Header-Aktionsmenüs ist ab Preview0.10 OpenUI5 1.152.1 festgelegt. Der beobachtete Frameworkfehler in1.153.0 wird nicht durch eigene Controls oder Frameworkänderungen umgangen.

## Zusätzliche Nutzerkorrekturen

In der Ticketmaske entfällt der Belegfluss ausdrücklich; direkte Servicefallnavigation bleibt erhalten. Nachrichten-/Notizverlauf und technische Bearbeitung werden weiter ausgebaut. Die neuen SAP-Auftrags-/Einkaufsbilder und DIN-Belegvorgaben sind unter [Geschäftsbelege und SAP-Muster](business-documents.md) erfasst. Kostenpflichtige Servicefolgebelege bleiben am Serviceauftrag. Beim zusätzlich beauftragten [Direktvertrieb](direct-sales.md) führt der AU die kaufmännischen Folgebelege ohne technisches Ticket/SA. Berichte erhalten einen eigenen berechtigten Arbeitsplatz mit echten Kennzahlen und Drill-down; keine globale Tab-Leiste.
