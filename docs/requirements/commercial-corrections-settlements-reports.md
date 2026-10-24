# Zehnerpaket: Kundenkorrekturen, Bankbewegungen und operative Berichte

Aus dem priorisierten Masterbacklog nach Preview0.29 ausgewählt. Bestehende Tickets/WOT/SRM bleiben operative Originale; kostenpflichtige Leistungen und Material verbleiben am Serviceauftrag. Eine Finanzkorrektur setzt keine Leistungs- oder Fakturaquelle zurück. Alle Masken verwenden native OpenUI5-Controls und werden über die App-Zentrale bzw. den Originalbeleg geöffnet.

| Nr. | Geliefertes Teilpaket | Verbindliches Verhalten |
| --- | --- | --- |
| 1 | Preisgutschrift | Nettopreisnachlass je Original-Rechnungsposition bis zum verbleibenden Wert; Mengenanspruch und Warenkosten bleiben unverändert. Unabhängige GU-Freigabe, ursprüngliche Kontierung, valides381/PDF-A3. |
| 2 | Servicegutschrift | Gebuchte Service- und Warenrechnung korrigierbar. Ursprünglicher SA, Ticketbezüge, Leistungstage, WOT, Zeiten, SRM und verbrauchte AF bleiben erhalten. |
| 3 | Gemischte Restgutschrift | Preisnachlass und spätere Mengen-/Restkorrektur überschreiten zusammen weder Originalwert/-steuer noch Originalmenge. Rest wird aus verbleibendem Originalwert berechnet; keine Wiedereröffnung der AF. |
| 4 | Teilzahlungseingang | ZE erfasst eine tatsächliche Bankbewegung zu genau einer gebuchten Rechnung. Erst unabhängige Finanzprüfung und Buchung: Bank Soll / ursprünglicher Debitor Haben; OP wird um den echten Betrag reduziert. |
| 5 | Zahlungsstorno | Eigener geprüfter SB bucht exakt Originalbetrag, Bank-/Debitorenkonto und FI gegen. OP wird wiederhergestellt; doppelte Gegenbuchung ist ausgeschlossen. |
| 6 | Kundenrückzahlung | GU auf bezahlte Rechnung erzeugt negatives AR-Guthaben. Eigene geprüfte ZA: ursprünglicher Debitor Soll / Bank Haben. Rückzahlung ist begrenzt und exakt gegenbuchbar; aktive Rückzahlungen müssen vor dem Storno zugehöriger Eingänge zurückgeführt werden. |
| 7 | Auftrag/Lieferung/Vorrat (RPT-04-Teilpaket) | Aktueller freigegebener Direktvertriebs-AU nach Auftragsdatum: Originalmenge/-wert, tatsächlicher WA abzüglich SB, offene Lieferung, Termine/Sperren und fakturierter Wert. Separater freigegebener AF-Rest nach Anforderungsdatum für Service und Direktvertrieb. Keine Addition dieser Größen zum Umsatz. |
| 8 | Angebotspipeline (RPT-05-Teilpaket) | Eigene App für AG/KVA-Kohorten nach Angebotsdatum, aktuelle Datenversion, echte Annahme/Absage und Umwandlungsbezug, ungewichtete offene gültige Werte. Annahmequote nach Wert = angenommen / (angenommen + kundenseitig abgelehnt); offene Angebote sind nicht im Nenner, Nullbasis ergibt keine Quote. |
| 9 | OP-Altersstruktur (RPT-11-Teilpaket) | Historischer Buchungsstichtag berücksichtigt Originale und tatsächlich datierte GU/ZE/ZA/SB. AR-Forderung, Kundenguthaben und AP-Verbindlichkeit getrennt; Altersklassen je Kontoart. AP enthält gebuchte EG/Vollstornos und zeigt deren Zahlungssperre. |
| 10 | Persönliche Berichtsvarianten (RPT-12-Teilpaket) | Persönliche Varianten der drei neuen Fachapps; Tenant- und Nutzer-RLS, enge Filtervalidierung, erneute Berechtigungsprüfung bei Abruf und Export. Native Desktop-Raster/mobile Listen, begrenzte Seiten und CSV mit deutschen Daten/Formelschutz. |

## Fachliche Grenzen

- Bankbewegungen werden anhand eines vorhandenen Nachweises manuell dokumentiert. Kein Zahlungsauftrag, Banktransfer, Kontoauszugsimport, Sammelausgleich, Skonto, Währungsgewinn/-verlust, Mahnlauf oder Kreditorenzahlung. Diese Prozesse bleiben im Backlog.
- Der Ersteller eines Zahlungsprüfstands darf dessen unabhängige Prüfung nicht übernehmen, auch als Administrator. Zahlungsprüfstände sind unveränderlich; ungebuchte falsche Stände werden begründet verworfen und neu angelegt. GU nutzen weiterhin den konfigurierten Freigabeworkflow. Zahlungen haben einen eigenen fest definierten Finanzprüfschritt.
- Preisgutschrift enthält eine finanzielle Einheit mit ausdrücklichem Hinweis „ohne Mengenrücknahme“. Keine künstliche Arbeitszeit- oder Warenrücknahme. Verbleibende Steuergruppen müssen centgenau darstellbar sein; unzulässige Teilung eines Rundungscent wird abgewiesen. Keine stillen Rundungs- oder Ausgleichsbuchungen.
- Zahlungseingänge können keine Forderung überzahlen. Nach späterer Gutschrift vorhandenes Guthaben ist separat auszuweisen. GU-Verfügung und Rückzahlungsbuchung bleiben getrennte Vorgänge.
- RPT-04 liefert keine historische Rückrechnung aller Auftragsstände und keinen vollständigen Service-Planbestand. Service wird dort über freigegebenen tatsächlichen AF-Vorrat ausgewertet. Lagerkosten, offene Aufträge, Angebotspipeline und Zahlungen werden nicht als Umsatz behandelt.
- Pipeline verwendet aktuelle Entscheidungen der ausgewählten Angebotskohorte. Der Gültigkeitsstichtag ist kein historischer Wiederaufbau früherer Angebotsversionen. Nicht veröffentlichte Entwürfe sind keine offene genehmigte Pipeline.
- Varianten gelten für die drei neuen Berichte. Übergreifende Varianten aller anderen Fachmasken sowie weitere Berichtsarten/Dimensionen und automatisierter Versand bleiben offen.
- Deutsche Normalsteuer/Inlandswährung der vorhandenen Faktura. Erweiterte Steuerfälle, Wechselkurse, bewertete Retourenfolgeaktivitäten, Werkstattreparatur und weitere Modulrestlücken bleiben verbindlich.

## Datenintegrität und Ausgabe

Migrationen038–040 ergänzen die unveränderten001–037. Originalrechnung, ursprüngliche Forderung, GU, Zahlungsprüfung und gebuchte FI werden nicht überschrieben. Der Saldo wird aus gebuchten Quellen berechnet. Buchungskreissperre, Version, Idempotenz, Status-/Betrags-/Periodenprüfungen sowie Datenbank-Commit-Prüfungen schützen konkurrierende Vorgänge. Originalkontierung und historische Dokumentbytes bleiben erhalten.

Kundenzahlungen besitzen eigene Anlagenlisten, native aufklappbare Belegflussbäume und interne Schwarz-Weiß-Geschäfts-PDFs mit Code128, deutschem Datum und vollständigem Ansprechpartner. Banknachweise können über die vorhandene geprüfte Anlagenannahme abgelegt werden. Gutschrifttexte verlangen kein Zahlungsziel und erklären, dass bereits geleistete Zahlungen ein separat auszuzahlendes Kundenguthaben ergeben können.

## SAP-Handbuchbezug

Die vom Nutzer bereitgestellten Fachtexte zu [Serviceauftragsabwicklung](https://help.sap.com/docs/SAP_S4HANA_CLOUD/adbae5bcd5994f159bf2847a11397b61/d305c2c23a184c05b75ea3263038965c.html?locale=de-DE) und [Serviceangebote verwalten](https://help.sap.com/docs/SAP_S4HANA_CLOUD/adbae5bcd5994f159bf2847a11397b61/a5f69832fa9245be9741f6aba2ab698c.html?locale=de-DE) bleiben die fachliche Referenz: kommerzielle Angebote/Annahme, integrierte Serviceausführung und anschließende Faktura/Finance. Das Paket verwendet die vorhandenen freigegebenen Originalquellen und trennt Rechnungskorrektur, Zahlung und Warenbewegung. Eine vollständige SAP-Implementierung oder SAP-Zertifizierung wird damit nicht behauptet. Am24.10.2026 wurde „Serviceangebote verwalten“ erneut im tatsächlichen Help-Portal ausgelesen: Standard-/Festpreisangebote, Kundenannahme, Folgeserviceauftrag, Anpassungsangebote, Vertragsfindung und Kreditprüfung sind dort getrennte Funktionen. Dieses Paket wertet die bereits vorhandenen echten Entscheidungen aus; Anpassungsangebote, erweiterte Vertrags-/Kreditprüfung und externe Ausgabekanäle bleiben im Backlog.
