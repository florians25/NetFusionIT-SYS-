# Preview0.26 · Kundengutschriften, Warenrücknahme und Umsatzberichte

Vollständige Rechnungskorrektur einer tatsächlich fakturierten Direktvertriebslieferung: eigener GU-Prüfstand, unabhängige Freigabe, exakte ursprüngliche Gegen-FI, Debitoren-Gegenposten, validierte381-Ausgabe und anschließende tatsächliche ganze Lagergegenbewegung. Die neue Berichtsapp trennt Rechnungen/Gutschriften, fakturabezogenen Warenwert und tatsächlichen Warenaufwand. Originalbelege und frühere PDF-Bytes bleiben erhalten.

Alle Bildschirmbilder und Beispieldokumente stammen aus **isolierten synthetischen Prüfmandanten**. Es wurden keine künstlichen Geschäftsbelege in der Hauptumgebung angelegt. Die Beispieldatensätze der einzelnen Prozessprüfungen sind unabhängig voneinander.

## Native OpenUI5-Oberflächen

| Ansicht | Screenshot |
| --- | --- |
| GU mit Originalrechnung, Mengen, Status und Gegenkontierung | [Desktop](gutschrift-posted-desktop.png), [Vorbereitung](gutschrift-prepared-desktop.png) |
| Unabhängige Finanzprüfung | [Prüfstand](gutschrift-independent-review.png) |
| Tatsächliche Warenannahme nach vollständiger Gutschrift | [Lagergegenbewegung](gutschrift-physical-return.png) |
| Aufklappbarer Belegfluss und kleine Anlagenliste | [Baum](gutschrift-document-flow.png), [Anlagen](gutschrift-attachments.png) |
| Eigene Gutschriften-App und Smartphone | [Arbeitsvorrat](gutschrift-worklist.png), [390px](gutschrift-posted-mobile.png) |
| Umsatz und Warenkosten mit tatsächlichen Belegpositionen | [Desktop](umsatz-overview-desktop.png), [390px](umsatz-overview-mobile.png) |
| Zeitraum, Kunde, Artikel, Vertriebsbereich und Vergleich | [Filter](umsatz-filters-desktop.png), [Vergleich](umsatz-comparison-desktop.png) |
| Navigation bis Rechnung und Rolle ohne Kostenrecht | [Originalrechnung](umsatz-invoice-drilldown.png), [Umsatzsicht](umsatz-revenue-only-role.png) |

Die dargestellte Berichtsprobe hat200EUR Rechnungsnetto und100EUR Gutschrift: Nettoumsatz100EUR, fakturabezogener Warenwert40EUR, DB I60EUR. Der tatsächliche Warenaufwand bleibt80EUR, solange noch keine physische Gegenbewegung erfolgte; Periodenbeitrag20EUR. Ein Vergleich mit Umsatz null erzeugt keinen erfundenen Prozentwert.

## Formulare und prüfbare Artefakte

- Tatsächlich im Browser heruntergeladene [Rechnungskorrektur als PDF/A-3](rechnungskorrektur.pdf), [Druckvorschau](rechnungskorrektur.png) und [extrahiertes CII381](rechnungskorrektur.xml). Schwarz-Weiß, normale Anschrift links, vollständiger Vertriebsmitarbeiter rechts und deutsche Daten. [Unabhängige PDF-/Barcodeprüfung](document-verification.json): tatsächlicher Code128 `GU-46000000`, Originalreferenz `RE-45000000`, erneute normative Mustang-Validierung des archivierten PDFs und Hashes.
- [Tatsächlicher CSV-Download](umsatz-quellen.csv) mit derselben angewandten Filterung und deutschem Zahlen-/Datumsformat. Kostenrechte und Tabellenformel-Schutz werden auf dem Server geprüft.
- [385/385 vollständige Prüfungen](test-verification.json), darin9 GU-Prozessprüfungen,11 Reporting-Prüfungen und1 Upgradeprüfung. Sechs betroffene native Browserabläufe geprüft; der Bericht wurde nach der letzten Filterkorrektur erneut durchlaufen. Kein vollständiger32-Skripte-Browsermatrixlauf behauptet.
- [GU-Browserprüfung](credit-browser-verification.json), [GU-Prozess](credit-process-verification.json), [Berichts-Browserprüfung](report-browser-verification.json) und [Berichts-Prozess](report-process-verification.json). Ganze Rücknahme nach vollständiger GU, Parallelaufrufe, Originalwerte/FI/OP und echtes Quellen-Drill-down.
- [Upgrade29→33](upgrade-verification.json): vorhandenes Angebots-PDF und Archivmetadaten bleiben bytegleich. Ursprüngliche Migrationsdateien bleiben erhalten; die eng begrenzte Ausführungskorrektur zur Ausgabeart wird zusätzlich mit Datei-/Statementhashes protokolliert. Wiederholtes Upgrade und Manipulationsabwehr geprüft.
- [Hauptumgebung](main-environment.json):33 Migrationen mit geprüften Quellprüfsummen, Readiness, Dokumentkonfiguration, Gutschriften- und Berichtskonfiguration200; keine künstlichen Geschäftsbelege. Private echte Sicherungen [vor030](backup-before030-verification.json) und [vor032](backup-before032-verification.json),0600, Katalog/Hashes geprüft. Anschließend wurde die Sicherung vor032 tatsächlich in eine separate Prüfdatenbank zurückgespielt: [Restore und Upgrade31→33](restore-verification.json), Quellprüfsummen und Datensatzmengen erhalten, Mandantentrennung am wiederhergestellten Geschäftspartner geprüft, Prüfdatenbank entfernt. Die Sicherungsnachweise beschreiben ihren ursprünglichen Erstellungszeitpunkt; der spätere Restore ist separat protokolliert. Archive bleiben außerhalb von Git. Ein Zielserver-Disaster-Recovery-Test bleibt offen.
- [Produktionsimage](docker-smoke.json) und [tatsächliche HTTPS8070-Installation](docker-install-8070.json) für `sha256:6a3ab6b35a8c2882d58d307116d11342288d54303027918df6489351cc16cba7`: unprivilegierter schreibgeschützter Prozess, keine Build-Zertifikate in der Laufzeit, tatsächliche380-/381-Ausgabevalidierung, Migration/Bootstrap, Caddy-TLS, Zertifikatsprüfung, Secure-Cookie und geändertes Passwort nach Containerneuanlage. Die Testcontainer und Testvolumes sind entfernt. Lokales Image; kein Registry-Push oder Deployment auf den vorgesehenen Ubuntu-Zielserver.

## Fachlicher Restumfang

Dies ist die vollständige GU einer unbezahlten Inlands-Warenrechnung und die anschließende ganze Rücknahme. Eigene RT-Retourenaufträge, Teilgutschrift/Teilrückgabe, Prüfung/Sperrbestand, Servicekorrekturen, bereits ausgeglichene Rechnungen und Rückzahlungen bleiben offen. Service-/Personal-/weitere Istkosten erzeugen keinen erfundenen Deckungsbeitrag. Weitere Berichtsarten, Dimensionen, Varianten und Produktivlast sind offen.

[GU-Umfang](../../requirements/customer-credit-memos.md), [Berichtsdefinitionen](../../requirements/sales-reporting.md), [gelesene SAP-Fachtexte](../../requirements/sap-reference-log.md), [vollständiger Restbacklog](../../master-backlog-index.md), [Dockerbefehl für8070](../../docker-8070.md). Git-Preview mit annotiertem Tag; eine separate GitHub-Releaseseite konnte wegen des in dieser Umgebung gesperrten GitHub-API-Zugriffs (`Forbidden`) nicht angelegt werden. Technische Validierung ersetzt keine steuerliche, rechtliche oder produktive Gesamtabnahme.
