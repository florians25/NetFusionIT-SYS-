# Preview 0.31 · Native Oberflächen und 20 Backlog-Punkte

Gemeinsame Überarbeitung der vorhandenen OpenUI5-Anwendungen, danach das [festgelegte Zwanzigerpaket](../../requirements/next-twenty-ui-service-finance.md). Ausschließlich OpenUI5 1.152.1 mit Standardtheme, nativen Tabellen, Formularen, Arbeitsseiten und Dialogen. Keine eigenen HTML-/CSS-/SVG-Oberflächen oder Renderer.

## Oberfläche

Die responsiven Fachtabellen verwenden gemeinsame native Spaltenauswahl, Sortierung, passende Pop-ins und feste Tabellenköpfe. Stabile Facharbeitslisten bieten zusätzlich gespeicherte persönliche Ansichten. Bedingte Berechtigungsspalten bleiben geschützt. Desktop kompakt, Telefonansichten mit nativer Touchdarstellung. Mehrteilige Formulare verwenden den verfügbaren Platz; umfangreiche Stammdaten und Eingaben öffnen eigene breite Arbeitsseiten. Deutsche Daten und Europe/Berlin sind zentral eingestellt. Die App-Zentrale bietet Suche und persönliche Favoriten; Fachapps werden weiterhin dort geöffnet.

- [App-Zentrale und persönliche Favoriten](app-center-favorites.png), [persönliche Tabellenansicht](personal-table-view.png).
- [Ticketvorlagen und Checklisten](playbook-library.png), [breiter Checklisteneditor](checklist-editor.png).
- [Wissensbibliothek](knowledge-library.png), [Ticketzusammenarbeit](ticket-collaboration-knowledge.png), [Asset-Servicehistorie](asset-service-history.png), [Originaleinsatz aus der Historie](asset-original-visit.png), [bestätigte WOT-Pflichtpunkte](task-checklist-confirmed.png).
- [Arbeits-/Fahrtzeitbericht](service-time-desktop.png), [mobile Zeitansicht](service-time-mobile.png).
- [Offene BANF/Bestellungen](purchasing-desktop.png), [Termintreue](delivery-reliability-desktop.png), [Lagerbestand](stock-desktop.png), [Materialbewegungen](movements-desktop.png), [Tickets/SLA](ticket-sla-desktop.png).
- [Freigabe der Zahlungssperre](supplier-payment-release-reviewed.png), [breite Teilzahlungserfassung](supplier-payment-workspace.png), [gebuchte Lieferantenzahlung](supplier-payment-posted.png), [Anlagenliste](supplier-payment-attachments.png), [mobile Zahlung](supplier-payment-mobile.png).
- [Tatsächlicher Schwarz-Weiß-Zahlungsbeleg](lieferantenzahlung.pdf), [gerenderte Druckansicht](lieferantenzahlung.png) und [aus dem PDF decodierter Code128-Nachweis](document-verification.json). Begründungen werden vollständig ausgegeben; bereits archivierte Dateien bleiben unverändert.
- [Vollständiger Anwendungskatalog](application-catalog.md): tatsächliche Aufrufe sämtlicher Apps ohne Belegparameter am Desktop und im emulierten Telefonbrowser. Die Belegmasken werden zusätzlich durch die Fachprozess-Browsertests geprüft.

## Zwanzig umgesetzte Lieferpunkte

1. Interne Ticketbeobachter mit Aufnahme/Austragung und unveränderlichem Verlauf; Beobachtung erteilt keine Ticketrechte.
2. Typisierte Problem-/Folge-/Elternbeziehungen mit Gegenrichtung, Kunden-/Organisationsschutz und Zyklusprüfung.
3. Wiederverwendbare interne Ticketvorlagen ohne Kopieren fremder Kunden-/Assetidentitäten.
4. Versionierte Checklistenstämme mit Entwurf, Aktivierung, Stilllegung und eingefrorenem Übernahmestand.
5. WOT-Pflichtchecklisten mit tatsächlichem Bearbeiter und Nachweis; offene Pflichtpunkte verhindern den Abschluss in API und SQL.
6. Interne Wissensartikel mit Entwurf, Veröffentlichung, Stilllegung und neuer Revision.
7. Known-Error-Verknüpfung mit Originalrevision und bewusst bestätigter Workaround-Übernahme am Ticket.
8. Asset-Servicehistorie mit echten Tickets, SRM und berechtigten Einsätzen, einschließlich Originalnavigation.
9. CRM-Aktivitäten mit Verantwortlichem, Termin, Status, Version und Verlauf.
10. Nachvollziehbare Dublettenhinweise aus normalisiertem Namen, E-Mail und USt-IdNr.; keine automatische Zusammenführung.
11. Einkaufsbericht mit offenen freigegebenen BANF/Bestellpositionen, AU-/SA-Ursprung, Werk, bestellter/gelieferter/verrechneter Menge und offenem Wert.
12. Liefertermintreue nach Bestelltermin und tatsächlichem wirksamen Teil-WE; offene und verspätete Mengen getrennt.
13. Aktueller Lagerortbestand mit Fach-/Serien-/Chargenstand, offenen Reservierungen, freier Menge und berechtigter Bewertung.
14. Gebuchte WE/WA/Umlagerungen/Inventurdifferenzen und Gegenbewegungen mit tatsächlichen Originalbelegen und Werten.
15. Ticketkohorte und aktueller SLA-Stand einschließlich Antwort/Lösung, Vertragsstand, Pausen und protokollierter Überschreitung.
16. Tatsächliche Arbeits-/Fahrt-/Pausenzeit und Pauschalen nach Art/Einheit, WOT/SA/SRM-Korrelation und fakturierter Quellmenge.
17. Eigener unabhängiger Freigabeauftrag für die Zahlungssperre gebuchter Eingangsrechnungen mit erneutem Sperren und historischem Nachweis.
18. Tatsächliche manuelle Lieferanten-Teilzahlung als unabhängig geprüfter ZA: ursprünglicher Kreditor Soll, Bank Haben, datierter und aktueller OP-Schutz auch bei Parallelität.
19. Unabhängig geprüfter exakter Zahlungsstorno SB mit Wiederherstellung des OP; Rechnungsstorno kann bestehende Zahlungen nicht umgehen.
20. Benutzer-/Tenant-private Arbeitsansichten, Berichtsauswahlen und App-Favoriten mit Versionsschutz und erneuter Berechtigungsprüfung.

## Prüfung und Betrieb

[Gesamtprüfung](test-verification.json), [Browser-Fachprozesse](browser-suite.json), [neue Serviceoberflächen](service-browser-verification.json), [Berichte und Zahlung](package-browser-verification.json), [Maskenkatalog](application-catalog-verification.json), [Restore 42 → 46](restore-verification.json), [Hauptumgebung](main-environment.json), [Produktionsimage](runtime-build-verification.json), [Docker-Smoke](docker-smoke.json) und [HTTP-Installation auf 8070](ubuntu-installer-http-verification.json) dokumentieren den tatsächlichen Stand.

Der Installer führt weiterhin interaktiv durch HTTP-Testbetrieb oder HTTPS, Serverdaten und Administrationszugang. Die native Ersteinrichtung fragt danach Firma, USt-IdNr., Kontakt, Werke/Lager, Einkauf/Vertrieb, Konten/Perioden und Bank ab. Der [Ein-Befehl-Installer mit Git-Pull/Backup/Update](../../../README.md#ubuntu-mit-docker) ist im Repository beschrieben.

## Verbleibende Grenzen

Der [verbindliche Masterbacklog](../../master-backlog-index.md) bleibt offen. Dieses Paket liefert keinen vollständigen SAP-Ersatz. Insbesondere bleiben Werkstattreparatur, erweiterte Vertrags-/SD-/Steuerfälle, MFA/OIDC/feine SoD, Bankimport/Überweisung/SEPA/Skonto/FX, Mahnungen und Abschluss weitere Arbeitspakete.

Berichte verarbeiten höchstens 10.000 gefilterte Quellzeilen mit acht Sekunden SQL-Zeitlimit und seitenweiser Darstellung. Lagerbewertung ist ein aktueller Stand, kein historisches Lagerbuch. Ticket/SLA ist eine Eingangskohorte mit aktuellem Fristenstand; keine historische Auslastung oder vollständige gesetzliche Arbeitszeit. Pauschalen verwenden den tatsächlichen Audit-Erfassungszeitpunkt; Stunden und Kilometer werden nicht addiert. Persönliche Spaltenansichten gelten für responsive Arbeitslisten; native Desktop-Positionsraster und Berichtsauswahlen behalten ihre jeweils eigenen Bedienwerkzeuge. Technische Wissensartikel sind intern. Eine echte mobile Geräte-, Last-, Rechts- und Zielserverabnahme steht weiter aus.
