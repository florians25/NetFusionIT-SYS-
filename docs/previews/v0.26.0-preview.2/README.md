# Preview0.26.0-preview.2 · Rechnungskorrektur ohne Zahlungsaufforderung

Der vollständige GU-Beleg verrechnet die ursprüngliche unbezahlte Forderung. Das neu erzeugte Formular zeigt deshalb **„Keine Zahlung erforderlich“ und kein Zahlungsziel**. Die Rechnung selbst behält „Zahlbar bis“. Bereits archivierte Originale bleiben unverändert; Preview.1 und dessen Artefakte werden erhalten.

Dieser Stand enthält weiterhin die [Kundengutschrift mit unabhängiger Freigabe und ganzer tatsächlicher Warenrücknahme sowie die Umsatz-/Warenkostenberichte aus Preview.1](../v0.26.0-preview.1/README.md). Dort liegen die vollständigen Oberflächenbilder, die fachlichen Prozessnachweise, das Archive-Upgrade und der tatsächliche Restore einer privaten Entwicklungssicherung. Es handelt sich um OpenUI5-Standardcontrols; neue globale App-Reiter wurden nicht eingeführt.

## Aktuelle Oberflächen und Druckausgabe

| Ansicht | Artefakt |
| --- | --- |
| Gebuchte Gutschrift mit tatsächlicher Originalrechnung und Gegenkontierung | [Desktop](gutschrift-posted-desktop.png), [390px](gutschrift-posted-mobile.png) |
| Korrigierte Schwarz-Weiß-Ausgabe, vollständiger Vertriebsmitarbeiter rechts, deutsche Daten und Code128 | [Druckbild](rechnungskorrektur.png), [archiviertes PDF/A-3](rechnungskorrektur.pdf), [eingebettetes CII381](rechnungskorrektur.xml) |
| Umsatz, Kosten, Vergleich, Filter und Navigation in Originalbelege | [Berichtsoberflächen aus demselben UI-Stand](../v0.26.0-preview.1/README.md#native-openui5-oberflächen) |

Die Bilder und PDF-Beispiele stammen aus isolierten synthetischen Prüfmandanten. Die Hauptumgebung enthält weiterhin keine künstlichen Geschäftsbelege.

## Erneute Prüfung dieses Stands

- [Gesamttests und gezielte PDF-Prüfungen](test-verification.json):385/385 Gesamttests sowie15/15 gezielte GU-/Formularprüfungen. Die gedruckte GU enthält kein „Zahlbar bis“; das originale Rechnungs-PDF enthält es weiterhin. Die fünf unveränderten weiteren Browserabläufe aus Preview.1 bleiben Referenznachweise; kein neuer vollständiger Browsermatrixlauf wird behauptet.
- [Native GU-Browserprüfung](credit-browser-verification.json): tatsächlicher Download, unabhängige Freigabe, Gegen-FI/OP, vollständige physische Warenrücknahme, Belegflussbaum, Anlagen und390px erneut geprüft.
- [Unabhängige Prüfung des heruntergeladenen Originals](document-verification.json): Mustang-Validierung des tatsächlichen PDF/A-3/CII381, Originalrechnungsreferenz, PDF-/XML-Hashes und gescannter Code128. Das Zahlungsziel fehlt; „Keine Zahlung erforderlich“ ist vorhanden.
- [Hauptumgebung](main-environment.json):33 Migrationen mit verifizierten Quellprüfsummen, Readiness und authentifizierte Fachkonfiguration200. Keine neue Migration in Preview.2;001–033 bleiben eingefroren.
- [Produktionsimage](docker-smoke.json) und [echte HTTPS8070-Erstinstallation](docker-install-8070.json) gelten ausschließlich für das neue lokale Image `sha256:216f5bce4b29ae79d7486c593f3b620d0c01df9f63df7512527ccc926bf1c23f`. Keine Root-Laufzeit, schreibgeschützter Prozess, keine Build-Zertifikate im Runtime-Image, echte380-/381-Validierung, Caddy-TLS/Zertifikatsprüfung, Secure-Cookie und Passworterhalt bei Containerneuanlage. Isolierte Testcontainer und Testvolumes sind entfernt.

Der geprüfte [Restore der vorhandenen Entwicklungssicherung](../v0.26.0-preview.1/restore-verification.json) wird durch diese reine Formularänderung nicht ersetzt oder erneut behauptet. Kein Registry-Push und kein Deployment auf den vorgesehenen Ubuntu-Zielserver.

[Docker-Start auf8070](../../docker-8070.md), [GU-Grenzen](../../requirements/customer-credit-memos.md), [Berichtsdefinitionen](../../requirements/sales-reporting.md), [vollständiger Restbacklog](../../master-backlog-index.md). Nächster fachlicher Umfang: RT-/Teilretouren, Teilgutschrift und Service-/Zahlungskorrekturen; anschließend Auftragsbestand/Pipeline und weitere operative Reports. Dies ist weiterhin kein vollständig umgesetzter SAP-Ersatz.

Der Preview wird als annotierter Git-Tag veröffentlicht. Eine separate GitHub-Releaseseite ist wegen des gesperrten GitHub-API-Zugriffs (`Forbidden`) in dieser Umgebung nicht verfügbar; Git-Push und Tags funktionieren.
