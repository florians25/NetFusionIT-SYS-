# Verbindliche Oberflächenvorgaben des Nutzers

Aktualisiert: 22.10.2026, nach den SAP-Musterbildern und der Navigationskorrektur.

- Ausschließlich OpenUI5-Standardcontrols, offizielle Themes und Standardklassen. Keine eigenen CSS-Dateien, Renderer, HTML-Ersatzcontrols oder SVG-Logos.
- Nach Anmeldung öffnet sich die **App-Zentrale**. Anwendungen werden über ihre rollenabhängigen App-Kacheln aufgerufen. Die Zentrale enthält keine darunter angehängte Ticketliste.
- Keine globale Tab-Leiste mit allen Anwendungen. Die Shell bietet die Rückkehr zur App-Zentrale und nennt die aktive Anwendung.
- Schnellzugriffe oben enthalten ausschließlich Masken der aktiven Anwendung: im Service Desk Cockpit, Tickets und Servicefälle; in der Disposition Ticketzuweisung und Einsatzplanung. Bei nur einer Maske entfällt die zusätzliche Leiste.
- Objektseiten verwenden kompakte Belegköpfe, nachvollziehbare Status/Summen und ausschließlich fachlich zugehörige Register. Positionsaktionen stehen direkt an der Positionstabelle. Native OpenUI5 ObjectPageLayout/AnchorBar, Tabellen und Formulare bilden die Referenzmuster ab.
- Beispielbilder aus SAP sind fachliche und strukturelle Referenzen. Es werden keine nicht implementierten Aktionen oder erfundenen Kennzahlen als funktionsfähig dargestellt.
- Das Service-Cockpit bleibt eine eigenständige Anwendung mit echten Ticket-Kennzahlen und Arbeitsvorräten.

Die Vorgaben gelten auch für folgende Module und Preview-Versionen. Zusätzliche Anwendungen dürfen die globale Shell nicht wieder mit Tabs füllen.
