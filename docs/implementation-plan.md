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

## Aktueller Stand

Architektur in 18 Fach-/Technikkapiteln definiert. Phase 1 und erster vertikaler Prozess implementiert: Anmeldung, serverseitige Rollen, Org-Scope, einfacher aktiver Kundenstamm, authentifiziertes Kundenformular, persistentes Ticket und separater Servicefall, Korrelation, Belegrelation, Audit, idempotente Annahme, Technikerzuweisung und zentrale Ticket-Zustandsmaschine. Die Oberfläche verwendet ausschließlich Standardcontrols und Standardklassen von OpenUI5; eigene CSS-/SVG-Dateien und Renderer sind ausgeschlossen.

Nachweise am 22.10.2026:

- TypeScript- und offizieller OpenUI5-Build mit Horizon-Themes und Versionsmetadaten bestanden.
- 20 automatisierte Prüfungen bestanden, 0 fehlgeschlagen/übersprungen: 19 echte PostgreSQL/API-Integrationstests und 1 UI-Vorgabenprüfung. Die zusätzliche Kennzahlenprüfung stimmt Cockpit-Zähler und Prioritätsverteilung mit gespeicherten, sichtbaren Belegen ab.
- Browserprozess in echtem Chromium bestanden: Kunde → Ticket/Fall → Liste/Objektseite/Belegrelation → direkte Dispatcherzuweisung im Service-Cockpit → Technikerstatus. Zusätzlich Kundenanlage, Administration, Abmeldung/Neuanmeldung und Mobilprofil geprüft. Klickbare Cockpit-Arbeitsvorräte, direkte Zuweisung und mobiles Cockpit bestanden ohne Browser-/HTTP-Fehler. Eigene Browserbilder verwenden ausschließlich isolierte, über Business-APIs angelegte Testbelege. Die Entwicklungsdatenbank erhält keine künstlichen Tickets.
- Parallele Idempotenzrequests, Konkurrenz auf Belegversion, mehrere Mandanten/Organisationen/Kunden und absichtlich ausgelöster DB-Fehler mit vollständigem Rollback geprüft.
- API-Neustart erhält Session, Geschäftsbelege, Zuweisung und Historie. Separater vollständiger Cluster-/Host-Recoverytest ist noch offen.
- Setup zweimal gegen bestehende Datenbank wiederholt; kein Duplizieren von Entwicklungsbenutzern.
- Compose-Konfiguration mit Platzhalterwerten statisch gültig; Shell-/Node-Skripte syntaktisch geprüft. Kein Live-Docker-Deployment, HTTPS-/Backup-/Restoretest oder Produktivhostingtest ausgeführt.
- npm-Laufzeitabhängigkeiten ohne bekannte Audit-Befunde. 14 Entwicklungs-Tooling-Befunde verbleiben, siehe `security.md`.

Noch keine Produktivfreigabe. Zielhosting: Ubuntu mit Docker laut Nutzer; kein Zugriff und noch kein Deployment-/Ressourcennachweis. Der OData-Service ist der dokumentierte lesende V4-Teilumfang, keine vollständige OData-Implementierung. Kundenfreigabe, SLA/Kalender, Material, Einkauf, Rechnungen, FI, MFA und alle weiteren Phasen bleiben offen. Offene Fachentscheidungen sind in `domain-model.md` und den Modulkapiteln genannt.

Nach dieser Lieferung erst den ersten Prozess abnehmen, dann Phase 2b/3 vertiefen. Keine parallele Scheinimplementierung aller Fachmodule.
