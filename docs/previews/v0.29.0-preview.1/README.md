# Preview0.29 · Retourenprüfung und HTTP-Testinstallation

Fünf zusammenhängende Backlog-Punkte: tatsächlicher unbewerteter Prüfeingang vor GU, Fachwahl mit Tastaturscan, Inspektion mit angenommenen/abgelehnten Mengen, Übernahme geprüfter und gutgeschriebener Mengen in Eigenbestand sowie Rücksendung abgelehnter Mengen. Eigenständige Originalbelege, Gegenbewegungen, Rollen, Fach-/Mengen-/Bewertungsregeln und native OpenUI5-Arbeitsseiten. [Vollständiger Umfang und SAP-Handbuchabgleich](../../requirements/return-inspection-custody.md).

Beispiel:3 gelieferte Artikel →3 Stück unbewerteter Kunden-Prüfbestand →1 angenommen/2 abgelehnt →unabhängige GU für1 Stück →1 Stück Eigenbestandsübernahme mit40,00EUR historischem Warenwert →2 Stück Rücksendung ohne neue FI. Alle Schritte können in zulässiger Reihenfolge exakt gegenbucht werden. Der Direktvertrieb erzeugt dafür keine künstlichen Tickets, Serviceaufträge, WOT oder SRM.

## Oberflächen und Belege

- [Prüfeingang mit Fachscan](custody-arrival-workspace.png)
- [Inspektionssplit mit Befund](inspection-split-workspace.png)
- [Übernahme in eigenes Zielfach](accepted-release-workspace.png) und [gebuchter WE](accepted-stock-receipt.png)
- [Abgeschlossene Mengenverteilung](completed-disposition-desktop.png) und [Rücksendebeleg mit Tree](dispatch-document-desktop.png)
- [Native390px-Ansicht](custody-mobile.png)
- [Prüfeingangs-PDF](custody-arrival.pdf), [Prüfprotokoll](inspection-report.pdf), [Rücksendelieferschein](return-delivery-note.pdf)
- [OpenUI5-App-Zentrale im tatsächlichen HTTP-Testbetrieb](http-app-center.png)

Die neuen Formulare verwenden die vorhandene Schwarz-Weiß-Geschäftsformularbasis. Ansprechpartner rechts mit Vor- und Nachnamen, deutsche Daten, tatsächliche Originalbezüge und im gerenderten PDF gescannter Code128. Mobil ist die lesende Retourenansicht geprüft; eine vollständige Abnahme sämtlicher Kommandos auf echten mobilen Geräten bleibt offen.

## Nachweise

- [419/419 Gesamttests](test-verification.json), ohne Fehler oder Skip. Abschließend21 betroffene API-/UI-/Tree-Prüfungen nach den letzten Lesemodelländerungen sowie20 UI-/Tree-/Installerprüfungen bestanden; diese Teilmengen sind keine zusätzlichen419 Tests.
- [Neuer nativer Browserablauf](browser-verification.json): Eingang, Scan, Mengensplit, geprüfte Übernahme, Kundenrücksendung, Anlagen und PDFs am Desktop sowie390px ohne Seitenüberlauf. [Vorhandener RT-/Teilmengen-/WE-/Stornoablauf erneut geprüft](legacy-return-browser-verification.json).
- [Geschäfts-PDFs, vollständiger Kontakt, Datum und gescannte Barcodes](return-document-verification.json).
- [Tatsächlicher privater Sicherungs-Restore mit Upgrade36→37](restore-verification.json), unveränderte Bestandsdaten/Checksummen und RLS, isolierte Restore-Datenbank anschließend entfernt.
- [Hauptumgebung](main-environment.json):37 Migrationen mit geprüften Checksummen, Readiness200 und keine künstlichen Geschäftsbelege.
- [Finaler Runtime-Build mit Datei-Hashes](runtime-build-verification.json), [Produktionscontainer mit validierter Rechnung/GU](docker-smoke.json).
- [HTTP-Ein-Befehl-Installer](http-installer-verification.json) und [HTTPS-Gegenprüfung](https-installer-verification.json): echter Clone/Pull, Migration, geschützte Sicherung, tatsächlicher Restore, erhaltene Benutzer/Passwörter und sichere Ablehnung fremder/lokal geänderter Checkouts. Die zusätzliche Migration999 existiert ausschließlich in der isolierten Testfixture. HTTP zusätzlich mit echter Browseranmeldung und UUID-Erzeugung außerhalb eines Secure Context geprüft.

Das lokale Produktionsimage aktualisiert die zuvor geprüfte0.28-Abhängigkeits-/Java-/UI5-Basis mit einer COPY-Schicht aus neu kompiliertem API/UI, unveränderten und neuen Migrationen sowie Installer-Skripten. Kein vollständiger erneuter Dockerfile-/npm-Build und kein Registry-Push behauptet. Docker-Erststart/Update und das tatsächliche finale Image sind separat geprüft. Erste parallel gestartete Dockerläufe scheiterten am Cloud-Speicherlimit; sie gelten nicht als Abnahme. Die erfolgreichen Prüfungen liefen anschließend einzeln nach gezielter Entfernung eigener veralteter Build-Caches.

## Installation und verbleibender Umfang

[HTTP-Testinstallation mit einem Befehl einschließlich Git-Pull, Backup und Update](../../docker-8070.md). Port8070; Zugang unter `http://SERVER-IP:8070`. Für HTTPS im selben Installer `ERP_INSTALL_PROTOCOL=https` verwenden. Die Wahl bleibt gespeichert.

Bewerteter Sperrbestand, Wiederaufbereitung/Verschrottung, Ersatzlieferungsautomatik, Preis-/Service-/Zahlungskorrekturen und die weiteren Module bleiben im [Masterbacklog](../../master-backlog-index.md). Kein abgeschlossenes SAP-Ersatzsystem und keine Abnahme des vorgesehenen Ubuntu-Zielservers.
