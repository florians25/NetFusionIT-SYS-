# Ticket, Work Order Tasks und Service-Rückmeldung

Verbindliche Nutzerpräzisierung vom 22.10.2026, zusätzlich zum Masterprompt:

- Das Ticket ist der zentrale Arbeitsbeleg. Zeiten werden im Ticket erfasst, auch wenn noch kein Serviceauftrag existiert.
- Arbeitszeit, Fahrzeit, Pausen, Abrechenbarkeit, Fahrt-/Service-/Einsatzpauschalen und weitere Leistungen getrennt abbilden.
- Leistungen gehören zu einer Work Order Task des Tickets. Ihre Übergabe an einen Serviceauftrag dient der kaufmännischen Bearbeitung und Abrechnung; sie ersetzt den ursprünglichen Ticketbezug nicht.
- Beim Abschluss einer Work Order Task entsteht genau eine aktive Service-Rückmeldung (SRM) im zugeordneten Serviceauftrag. Sie übernimmt die tatsächlich erfassten Zeiten und Leistungen, keine erfundenen Planmengen.
- Die Korrelations-ID des Tickets wird unverändert auf Aufgabe und SRM übernommen. Ticket, Aufgabe, Serviceauftrag und SRM bleiben im Belegfluss verbunden.
- Korrekturen bewahren vorherige SRM. Abgelehnte/verworfene Nachweise öffnen die Aufgabe erneut; erneuter Abschluss erzeugt einen neuen nachvollziehbaren Nachweis.
- Die Oberfläche besteht ausschließlich aus Standardcontrols von OpenUI5. Anwendungen werden über die App-Zentrale geöffnet; obere Schnellzugriffe gehören zur aktiven Anwendung.

Abnahme: Ticket ohne Auftrag → Aufgabe → Arbeits-/Fahrzeiten und Pauschalen → freigegebener Auftrag → positionsgerechte Übergabe → WOT-Abschluss → SRM mit derselben Korrelation → Kundenbestätigung/Servicefreigabe → technischer Abschluss. Parallel ausgelöste Abschlussaktionen dürfen keine doppelten SRM erzeugen.

## Kaufmännische Führung über den Serviceauftrag

Weitere verbindliche Nutzerpräzisierung: Beschaffung und alle kostenpflichtigen Folgeprozesse werden vom Serviceauftrag aus geführt. Technische Erfassung im Ticket und kaufmännische Ausführung bleiben über Belegreferenzen verbunden.

- BANF, Bestellung, externe Leistungen, Wareneingang mit Bestellbezug, Kostenkontierung, Preisfindung und Fakturierung benötigen einen Serviceauftrags-/Positionsbezug und werden aus dessen Masken angestoßen.
- Das Ticket löst keine ungebundenen kostenpflichtigen Beschaffungsvorgänge oder Kundenforderungen aus. Pauschalen im Ticket dokumentieren tatsächlich erbrachte Leistungen; ihre Preis-/Abrechnungsbehandlung erfolgt im Serviceauftrag.
- Die Auftragsobjektseite erhält eigene fachliche Bereiche für Material-/Beschaffungsbedarf, Bestellungen/Wareneingänge, Kosten und Abrechnung. Alle Folgebelege bleiben im Belegfluss mit Ticket, Aufgabe, SRM und Auftrag nachvollziehbar.
- Diese ausdrückliche Präzisierung hat Vorrang vor frei angelegten, nicht zugeordneten Beschaffungsvorgängen im ursprünglichen Masterprompt.
