# Preview0.27 · Positionsgutschriften und verbleibende Forderung

Eine gebuchte unbezahlte Direktvertriebsrechnung kann jetzt über mehrere unabhängig geprüfte GU-Belege **positionsweise** korrigiert werden. Die Auswahl übernimmt ganze ursprüngliche Rechnungspositionen einschließlich Mengen, Preisen, Steuer, Lieferdatum und ursprünglicher Kontierung. Die erste Korrektur der tatsächlichen Prüfungsrechnung über357,00EUR beträgt119,00EUR;238,00EUR bleiben offen. Eine weitere unabhängig gebuchte GU gleicht diesen Rest aus. Die Originalrechnung und ihr PDF bleiben erhalten.

## Native Oberflächen

| Ansicht | Screenshot |
| --- | --- |
| Breite Bearbeitungsseite mit Mehrfachauswahl und Originalwerten | [Desktop](selection-desktop.png), [Smartphone390px](selection-mobile.png) |
| Eigener unabhängiger GU-Prüfstand und gebuchte Gegenkontierung | [Vorbereitung](prepared-desktop.png), [Buchung](posted-desktop.png) |
| Rechnungsrest und mehrere Korrekturbelege an der Originalrechnung | [Rechnung und Historie](invoice-remainder.png) |
| Bereits gebundene Positionen und verbleibende Auswahl | [Bindungsstand](remaining-selection.png) |

Alle Bilder und Beispieldokumente stammen aus isolierten synthetischen Prüfmandanten. Die Hauptumgebung enthält keine künstlichen Geschäftsbelege. Einstieg über die Originalrechnung bzw. die eigene Gutschriften-App; keine globalen Anwendungsreiter. Nur OpenUI5-Standardcontrols. Die Auswahl verwendet eine ganze Arbeitsseite; PDF-Anlagen bleiben kleine Dialoge.

## Fachliche Ergebnisse

- Originalpositionen werden einmalig gebunden. Wiederholte Requests und konkurrierende unabhängige Anlage erzeugen keine Doppelgutschrift. Je Rechnung ist ein ungebuchter Prüfstand gleichzeitig möglich.
- Offene oder abgelehnte Prüfstände können begründet verworfen werden. Nummer, Auswahl und Audit bleiben erhalten; die Position wird wieder verfügbar. Eine laufende Freigabe muss vorher kontrolliert zurückgezogen werden. Gebuchte Vorgänge sind unveränderlich.
- Jede Teilkorrektur benötigt ihre eigene unabhängige Finanzfreigabe. Sie erzeugt eine eigene Gegen-FI zu den ausgewählten ursprünglichen Konten sowie einen eigenen Debitoren-Gegenposten. Die ursprüngliche Forderung bleibt erhalten; ihre wirksame Restanzeige zieht die gebuchten GU genau einmal ab.
- Die Umsatz-App korrigiert ausschließlich ausgewählte Originalpositionen und genau deren historischen Warenkostenanteil. Tatsächlicher Warenaufwand bleibt bis zur physischen Rücknahme bestehen.
- Finanzkorrektur und Warenannahme sind getrennt: Eine ganze ursprüngliche Auslieferung wird erst frei, wenn alle dort gebundenen Mengen fakturiert und die betreffenden Rechnungspositionen gutgeschrieben sind. Bei zwei Lieferungen lässt sich dadurch eine ganze Lieferung zurücknehmen, während die andere gesperrt bleibt. Keine neue Fakturierbarkeit alter AF.
- Steuerrundung wird am ursprünglichen Gruppenbetrag geprüft. Eine Auswahl, die einen nicht selbst gültigen Steuerbetrag erzeugt oder einen nicht mehr einzeln korrigierbaren Steuercent zurücklässt, wird vor Vorbereitung abgewiesen. Die zusammenhängende vollständige Steuergruppe bleibt korrigierbar.

## Tatsächliche Belege und Nachweise

- [Heruntergeladenes PDF/A-3](rechnungskorrektur.pdf), [Schwarz-Weiß-Druckbild](rechnungskorrektur.png), [extrahiertes CII381](rechnungskorrektur.xml) und [unabhängige Dokumentprüfung](document-verification.json):119,00EUR, genau eine ausgewählte Position, Originalrechnung `RE-45000000`, vollständiger Vertriebsmitarbeiter, deutsches Datum und gescannter Code128. Erneute normative Mustang-Validierung des tatsächlichen Browserdownloads. Kein Zahlungsziel auf der verrechneten GU; Originalrechnung unverändert.
- [396/396 Gesamttests](test-verification.json), darunter11 neue Prozessprüfungen. Eigenfreigabe, Parallelaufrufe, ursprüngliche Konten/OP, Restbetrag, SQL-Auswahl-/Art-Sperren, verwerfbarer Prüfstand, Lieferungsrücknahme, normatives381 und Steuerrundungsrest sind geprüft.
- [Neuer nativer Browserablauf](browser-verification.json) mit Desktop-Auswahl, tatsächlichem PDF-Download und390px-Auswahl; [bisheriger Vollgutschrift-Ablauf](legacy-browser-verification.json) und [Umsatz-App](report-browser-verification.json) ebenfalls erneut geprüft. Kein vollständiger33-Skripte-Browsermatrixlauf behauptet.
- [Prozessrechnung357→238→0](process-verification.json); die vollständigen ursprünglichen Rechnungsbytes bleiben erhalten. Die beiden tatsächlichen Originalauslieferungen lassen sich nacheinander mit ihren historischen Werten zurücknehmen.
- [Upgrade29→34 mit vorhandenem Angebotsarchiv](upgrade-verification.json): alte Archivbytes erhalten, unveränderte030 und protokollierte Vorwärtskorrektur033 weiterhin geprüft. Keine nachträgliche Änderung von001–033.
- [Hauptumgebung](main-environment.json):34 Migrationen mit geprüften Quellprüfsummen, tatsächlicher Neustart, Readiness und authentifizierte Dokument-/GU-/Berichtskonfiguration200; keine künstlichen Geschäftsbelege. [Private Sicherung vor034](backup-verification.json),0600, Katalog und Hash geprüft. [Tatsächlicher isolierter Restore33→34](restore-verification.json) erhält Datenmengen und Quellprüfsummen; Mandantentrennung am wiederhergestellten Geschäftspartner geprüft und Prüfdatenbank entfernt. Entwicklungssnapshot; kein Produktiv-Zielserver-Disaster-Recovery-Test.
- [Produktionsimage](docker-smoke.json) und [tatsächliche HTTPS8070-Erstinstallation](docker-install-8070.json) gelten für das lokale Image `sha256:45df6531da38e5ada6cf3c9d0d04c6301dc9d48802fd003cb73ead930cfbd0ea`: Nicht-Root/read-only, keine Build-CA in der Runtime, normative380-/381-Validierung, Caddy-TLS, Zertifikatsprüfung, Secure-Cookie und Passworterhalt nach Containerneuanlage. Isolierte Testcontainer/-volumes entfernt. Kein Registry-Push oder Deployment auf den vorgesehenen Ubuntu-Zielserver.

## Verbleibender Umfang

Dies sind **ganze Rechnungspositionen** und weiterhin **ganze ursprüngliche Lagerauslieferungen**. Teilmengen innerhalb einer Position oder ursprünglichen Auslieferung, eigene RT-Anmeldung, Prüf-/Sperrbestand, Preisgutschrift, zusätzliche Rundungskorrektur, Servicekorrektur und bezahlte Rechnungen/Rückzahlungen bleiben offen. Weitere Reports und ERP-Module bleiben im [Masterbacklog](../../master-backlog-index.md). [Detaillierter Umfang](../../requirements/selected-customer-credits.md), [Docker-Einbefehl für8070](../../docker-8070.md), [tatsächlich gelesene SAP-Referenz](../../requirements/sap-reference-log.md).

Annotierter Git-Preview-Tag. Der Zugriff auf die GitHub-Release-API wurde am24.10.2026 erneut lesend geprüft und bleibt mit `Forbidden` gesperrt; Git-Push und Tags funktionieren. Die vorherigen Preview-Tags und deren Archivartefakte bleiben erhalten.
