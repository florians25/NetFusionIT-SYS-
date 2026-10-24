# Umsatz und Warenkosten aus tatsächlichen Quellen

Die eigene App wertet gebuchte Rechnungspositionen, vollständige Kundengutschriften und tatsächliche Direktvertriebs-Warenbewegungen aus. Ein Buchungskreis und dessen Währung sind verbindlich. Tenant und Organisation werden vor der Aggregation geprüft; Kunde, Artikel, Vertriebsbereich, Auftrag und Service/Direktvertrieb grenzen dieselbe Quellenmenge ein. Gruppierung nach Tag, Monat, Quartal, Jahr, Kunde, Artikel oder Auftrag; Navigation von der Gruppe zur tatsächlichen Position und zum berechtigten Originalbeleg.

## Kennzahlen und Datum

Der Zeitraum verwendet ausdrücklich das **FI-Buchungsdatum** jedes eigenen Belegs. Eine Gutschrift vom Folgetag verändert nicht nachträglich den Umsatz des ursprünglichen Rechnungsdatums. Rechnungsdatum, Lieferdatum und FI-Buchungsdatum sind verschiedene Daten. Steuer und Zahlung sind kein Nettoumsatz. Die Steuer der Rechnungsgruppe wird centgenau auf die ursprünglichen Positionen verteilt; sie wird nicht pro Teilzeile nochmals gerundet.

| Kennzahl | Tatsächliche Grundlage |
| --- | --- |
| Fakturiert netto | Nettowerte der gebuchten Rechnungspositionen im Zeitraum |
| Gutschriften netto | Gebuchte GU zum eigenen Buchungsdatum: vollständige Originalrechnung oder ab0.27 ausschließlich ausgewählte ganze Originalpositionen; ohne zusätzlichen Abzug der Gegen-FI |
| Nettoumsatz | Fakturiert netto abzüglich Gutschriften netto |
| Warenwert Faktura | Ursprünglicher WA-Wert anteilig zur tatsächlich fakturierten Menge; GU korrigiert dieselbe analytische Zuordnung |
| DB I Faktura | Nettoumsatz abzüglich fakturabezogenem Warenwert; kein vollständiger Unternehmensgewinn |
| Tatsächlicher Warenaufwand | Ursprünglicher WA-Wert und echte physische Gegenbewegung am jeweiligen Buchungsdatum, einschließlich noch unfakturierter Lieferungen |
| Periodenbeitrag Waren | Nettoumsatz abzüglich tatsächlichem Warenaufwand des Zeitraums |

Beispiel: Zwei Rechnungen über jeweils100EUR netto aus einem WA mit80EUR Warenaufwand. Eine Rechnung wird gutgeschrieben, die Ware ist noch nicht zurückgekommen: Nettoumsatz100, fakturabezogener Warenwert40, DB I60, tatsächlicher Warenaufwand80 und Periodenbeitrag20. Die Finanzgutschrift allein erzeugt keinen physischen Lagerzugang. Erst die echte Rücknahme korrigiert den Lageraufwand. Analytische Kostenzuordnung und tatsächliche FI-/Lagerbewegung werden nicht miteinander verwechselt.

Die Kostenteilung ist centgebunden: Ein historischer WA-Wert0,05EUR bei drei einzeln fakturierten Einheiten wird als0,02 /0,01 /0,02 zugeordnet. Eine Gutschrift erhält genau den Kostenanteil ihrer ursprünglichen Teilrechnung. Neue Einkaufspreise oder zwischenzeitliche Kontenregeln ersetzen diese ursprünglichen Werte nicht.

Serviceumsatz verwendet die echte Rechnung aus Ticket/WOT/SRM. Mangels vollständiger Service-Istkosten bleibt dessen DB ausdrücklich leer. Bekannte Warenkosten sind eine Teilgröße; fehlende Personal-/Fremdleistungs-/Gemeinkosten werden nicht als null erfunden. Für Umsatz null wird kein erfundener Margenprozentsatz ausgegeben.

## Vergleich, Rechte und Export

Ein optionaler Vergleich verwendet zwei ausdrücklich sichtbare Zeiträume mit gleicher Anzahl Kalendertage. Die relative Änderung hat bei Vergleichsbasis null keinen Zahlenwert. Unterschiedliche Währungen werden nicht addiert; es gibt keinen impliziten Berichtskurs.

Die Umsatzsicht für Vertrieb/Faktura enthält keine internen Kostenwerte und keine zusätzlichen Lagerkostenpositionen. Kostenrechte werden auf dem Server geprüft, auch bei direktem API-Aufruf und Export. Kunden, Techniker und Lagerrollen erhalten durch die App keine Berichtsberechtigung. Originalnavigation richtet sich nach dem jeweiligen Fachrecht.

Die responsive native OpenUI5-Seite bietet Kennzahlen, standardmäßige Tabellen/ProgressIndicator, Filter, tatsächliche Belegpositionen, Gruppeneingrenzung und Quellen-Drill-down. Der CSV-Export verwendet denselben angewandten Berichtsfilter und Rechteumfang, deutsche Daten/Dezimaldarstellung und Formel-Injection-Schutz. Er wird protokolliert.

Ein wiederholbarer Lesestand umfasst die zusammengehörigen Summen, Gruppen, Seiten und Vergleichswerte. Maximal fünf Jahre,50 Quellenpositionen pro Standardseite (bis200),500 sichtbare Gruppen mit ausdrücklichem Überlaufhinweis und höchstens10.000 Exportzeilen. Der Export lehnt größere Ergebnisse ab, statt still abzuschneiden. Abfragen besitzen ein Zeitlimit; Migration032 ergänzt Quellenindizes. Die Auswahlstämme sind auf500 Einträge begrenzt; diese Grenze schränkt einen Bericht ohne Einzelfilter nicht auf diese ersten Einträge ein.

## Verbleibende Reporting-Lücken

Dies ist die geprüfte erste Teilbasis für RPT-01/02/03/06/12. Eigene gespeicherte Varianten, große Stammdatensuche, Kundengruppen/Warengruppen, zusätzliche Organisationsdimensionen, Gruppenvergleiche, Auftragsbestand/Pipeline, Einkauf/Lagerübersichten, Service-/Zeit-/SLA-Berichte, stichtagsbezogene OP-/Zahlungsberichte und Produktivlast bleiben offen. Geplante Kalkulation und weitere Ausführungsarten sind keine bereits vorhandene Istkostenbasis.

Fachliche Orientierung: tatsächlich gelesene SAP-Kapitel F2271 und „Key Figures Based on Billing Documents“, [Referenzprotokoll](sap-reference-log.md). Der zusätzliche tatsächliche Periodenbeitrag ist eine ausdrücklich eigene Kennzahl. Es wird keine identische Implementierung sämtlicher SAP-Analytics-/CDS-Funktionen behauptet.
