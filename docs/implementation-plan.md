# Entwicklungsplan und Lieferstatus

## Phasen mit Abhängigkeiten

| Phase | Lieferung | Abnahmekriterium |
|---|---|---|
| 1 | Monolith, OpenUI5, PG, Anmeldung, Rolle, Org, Logging, Deploymentbasis | Build, Login, persistente Daten, Scope-Tests |
| 2a | Kundenstamm, authentifiziertes Ticketformular, Ticket + Fall, Korrelation, Zuordnung | erster echter vertikaler Prozess inklusive Browser und Neustart |
| 2b | Kundenfreigaben, Kontakte, Kommentare/Uploads, Portal, anonyme Einladung | entschiedene Freigaberegel, sichere Annahme/Dateiprüfung |
| 3 | SLA, Dispatchkalender, Field Service, Assets, Verträge | reproduzierbare SLA, keine Doppelbelegung |
| 4 | Serviceauftrag, Pricing, Zeit, Bericht | Garantie/intern/kostenpflichtig getrennt; freigegebene Leistung |
| 5 | Material, Bestand, Reservierung, Verbrauch | gesperrte Mengen, keine unzulässigen negativen Bestände |
| 6 | BANF, Workflow, Bestellung, WE, Eingangsprüfung | Teilbeschaffung E und Drei-Wege-Abgleich |
| 7 | Faktura, PDF, E-Rechnung, Storno/Korrektur | keine Doppelfaktura, geprüfte Ausgabe, Szenario D |
| 8 | Konten, Journal, OP, Zahlung, Perioden, DATEV | ausgeglichene Journale und fachliche Abnahme |
| 9 | Controlling, Kosten/Erlös/Profitabilität | Abstimmung mit echten Bewegungen |
| 10 | Migration, Security/Last, Backup/Restore, Betrieb | dokumentierte technische und fachliche Produktionsfreigabe |

Workflow-Engine wird vor ersten genehmigungspflichtigen Stammdaten/Belegen eingeführt; Finance-Kern muss vor finaler Rechnungsbuchung existieren, auch wenn die UI-Phasen anders nummeriert sind. Architekturphasen sind keine Ausrede für inkonsistente Vorabbuchungen.

## Aktueller Stand · Preview 0.8

Der [vollständige Originalauftrag](master-prompt.md) und der [zusätzliche Fachbacklog mit Quellen](backlog.md) sind versioniert. Der Nutzer hat fortlaufende Entwicklung, regelmäßige GitHub-Pushes und Preview-Versionen mit Screenshots beauftragt. Keine erneute Bestätigung pro Phase nötig.

Umgesetzt: technisches Fundament und erster Serviceprozess, differenzierte Rollen, Kundenfreigabe mit Snapshot/Vier-Augen-Prinzip/Rückfrage, Kontakte/Adressen, öffentliche Kommentare/interne Notizen, Servicekalender, SLA-Policies und Ticket-Snapshots, Basisverträge, technische Objekte und Einsatzplanung mit Arbeitszeit-/Qualifikations-/Abwesenheits-/Kollisionsprüfung. Zusätzlich Artikel-/Servicekatalog, Währungen/Konditionen, exakte Preisfindung mit Snapshot, Serviceaufträge/Positionen und Artikel-/Auftragsfreigabe. Ticket als Arbeitsbeleg mit Work Order Tasks, Arbeits-/Fahrzeit, Pauschalen, Timer/Pausen, positionsgerechter Übergabe an den Auftrag, automatischer SRM mit Ticket-Korrelation beim Aufgabenabschluss, Teil-/Endrückmeldungen, Kundenbestätigung, Servicefreigabe, technischem Abschluss und Fakturabereitschaft. Buchungskern mit Buchungskreisen, Konten, Perioden, unabhängiger Journalfreigabe, endgültiger Buchung, Gegenbelegstorno, Salden und konfigurierbaren Kontenrollen. Auftragsbezogener Material-/Fremdleistungsbedarf, BANF, Teilbestellungen, freigegebene Lieferanten und unabhängige Beschaffungsfreigaben; geschützte Inhalte und konkurrierend abgesicherte Mengenbindungen. Automatische Artikelbedarfe, verfügbare/reservierte Lagerbestände, nur fehlmengenbezogene BANF mit automatischer Einreichung, Positions-/Kopf-Versorgungsstatus, Werke/Lagerorte und Serien-/Chargenpflicht. Bewertete Teilwareneingänge, automatische Ursprungsreservierung, gleitender Durchschnitt und eindeutiges Wareneingangsstorno mit atomarem FI-Quellenjournal. 66 mandantenbezogene Geschäftsnummernkreise mit Sperre, inklusiven Grenzen und Vorwärtsverwaltung. Dichtere native Arbeitsplätze für Aufträge, Kunden, Lieferanten, Artikel, Servicefälle, Servicebasis, SLA/Pricing und Administration mit echter Datengrundlage; weitere Maskenangleichung ist laufend. App-Zentrale als Einstieg und ausschließlich anwendungsbezogene Schnellzugriffe. Native OpenUI5-Objektseiten einschließlich separatem Ticket-Cockpit, Freigabearbeitsplatz, Servicebasis und PlanningCalendar.

Nachweise und genaue Grenzen stehen in den [Versionsnotizen](releases/v0.8.0-preview.1.md); echte Desktop-/Mobilbilder in der [Preview](previews/v0.8.0-preview.1/README.md). 109 automatisierte Prüfungen verwenden echte isolierte PostgreSQL-Datenbanken und reproduzierbare Kalenderfälle. Nummern, Belege und Audit rollen bei Fehlern atomar zurück. Rollenänderungen greifen im nächsten Request; API-Neustart erhält Sitzung und Belege. Die Entwicklungsdatenbank enthält keine künstlichen Tickets.

Offen bleiben insbesondere sichere Uploads, vollständige Stammdatenänderungsfreigaben, Delegation/Betragsgrenzen, weitergehende Disposition und die kaufmännischen Folgephasen. Die zusätzlichen SERVICE-01 bis SERVICE-05 sind Anforderungen mit Abnahmekriterien, keine fertiggestellten Funktionen. Der nächste vertikale Prozess führt von freigegebenen Leistungen über Materialbedarf, Beschaffung und Verbrauch zu Faktura und ausgeglichener Buchung. Keine Finanzbuchungen ohne explizit konfigurierte fachliche Regeln.

Ubuntu mit Docker ist laut Nutzer vorhanden. Kein Zugriff auf den Zielserver, kein Live-Docker-/HTTPS-/Restoretest, keine Produktivfreigabe. OData bleibt der dokumentierte lesende V4-Teilumfang. Wiederverwendbares Cloud-Setup ist gespeichert; neue Aufgaben müssen Installation und Prozessstart anhand des gespeicherten Start-Skills ausführen.

Die jüngsten Anforderungen für PDF-Anlagenlisten, physische Regal-/Lagerplatzstruktur mit Labels/Scans und auftragsbezogene Auslieferung mit Storno sind in requirements/warehouse-delivery-attachments.md verbindlich erfasst. Diese Erweiterungen sind in 0.8 noch nicht als vollständiger Prozess freigegeben.
