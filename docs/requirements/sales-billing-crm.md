# Verbindlicher Ausbau: Sales Order, Faktura und CRM

Nutzerpräzisierungen vom22.10.2026 ergänzen den vollständigen [Masterprompt](../master-prompt.md). Die übermittelten SAP-Masken sind verbindliche Strukturreferenzen. Bestehende Serviceaufträge ersetzen keinen eigenen Kundenauftrag. Diese Liste bezeichnet Anforderungen; der Lieferstatus wird erst anhand funktionierender APIs, Datenhaltung, Berechtigungen und End-to-End-Prüfung geändert.

Ergänzung vom 23.10.2026: [Direktvertrieb DS-01–16](direct-sales.md) führt Warenverkauf direkt aus dem AU, ohne Ticket/SA/WOT/SRM. Kosten und Beschaffung liegen dort am AU; im Service weiterhin am SA. [RPT-01–12](reporting.md) ergänzen Umsatz-/Auftrags-/Kosten- und operative Statistiken.

## SD: eigenständiger Kundenauftrag AU

| ID | Ablauf / Maske | Abnahme |
| --- | --- | --- |
| SD-01 | Auftragsliste mit Varianten, Suche, Kunden-/Organisations-/Datums-/Status-/Sperrfiltern, Bearbeiter und tatsächlichen Werten | Filter und Zähler aus berechtigten Daten; kunden- und organisationsfremde Treffer ausgeschlossen |
| SD-02 | Belegkopf wie Nutzermuster: AU-Nummer, Auftragsart, Kunde, Referenz/-datum, Organisation, Status, Freigabe, Nettowert | Nummer atomar; Kopf- und Positionszustände getrennt, kein Belegverlust bei Wiederholung |
| SD-03 | Vertriebsbereich: Verkaufsorganisation, Vertriebsweg, Sparte; Buchungskreis, Geschäftsstelle/-gruppe, Zuständigkeit | Konfiguration und Berechtigungen verhindern falsche Organisationskombinationen |
| SD-04 | Partnerrollen Auftraggeber, Waren-/Leistungsempfänger, Rechnungsempfänger, Regulierer, Ansprechpartner | Vorgangsrollen getrennt vom Geschäftspartnerstamm; Mehrdeutigkeit und manuelle Übersteuerung dokumentiert; gültige Adressen als Snapshot |
| SD-05 | Dichte editierbare Positionstabelle: Pos./Überpos., Artikel, Kundenmaterial, Text, Menge/Einheit, Preis, Typ, Termin, Ablehnung | Artikel-/Positionsarten und Hierarchie prüfen; keine Löschung bereits ausgeführter/fakturierter Positionen |
| SD-06 | Positionsdetails: Grunddaten, Materialgruppe, Charge/Serie, Kontierung, Kosten-/Profitcenter, Projekt/PSP | Pflichtfelder je Positionstyp; Istkosten bleiben beim fachlichen Ursprung: SA für Service, AU für Direktvertrieb |
| SD-07 | Konditionsregister: Grundpreis, Rabatt, Zuschlag, Steuer, Summen, statistische/interne Konditionen, Herkunft | Gültigkeit/Staffel/Priorität, exakte Rundung, steuerliche Kategorien und vollständiges Preisfindungsprotokoll; Kunden sehen keine internen Kosten |
| SD-08 | Liefer-/Leistungseinteilungen: Wunsch-, bestätigter und tatsächlicher Termin, Teilmengen, offene Restmengen | Mehrere Einteilungen; Überlieferung nur gemäß Regel; keine doppelte Mengenbindung bei Parallelität |
| SD-09 | Liefer-/Fakturasperren an Kopf/Position mit Grund, Unvollständigkeitsprüfung | Sperre verhindert den konkreten Folgeprozess serverseitig; Aufheben auditieren und ggf. unabhängig freigeben |
| SD-10 | Zahlung, Incoterms/Version/Ort, Versandart, Werk/Lager, Abhol-/Lieferanschrift | Kein erfundener Standard; fehlende Pflichtkonfiguration verhindert Freigabe statt späterer Falschbuchung |
| SD-11 | Mehrstufige unabhängige Freigabe, Rückfrage, Ablehnung, erneute Einreichung, Änderungsfreigabe | Ersteller/Einreicher können Vier-Augen-Prüfung nicht umgehen; genehmigter Stand eingefroren |
| SD-12 | Angebot → Teilannahme → AU; Direktvertrieb mit eigener Lieferung/Beschaffung oder freigegebener SA für Serviceausführung | Nur angenommene Positionen kopieren, Preis-/Quellenstand erhalten, Wiederholung erzeugt keine Doppelaufträge |
| SD-13 | Teil-Auslieferung, Rücknahme, Retoure, Liefer-/Leistungsstatus, Warenausgang und Geschäftslieferschein | Tatsächliche Mengen/Serien, Reservierung/Verbrauch und Originalgegenbewegung; Kontierung und Bestand atomar |
| SD-14 | Positionsbezogene Fakturaanforderungen, Fakturavorrat, Teil-/Sammel-/Endrechnung | Keine Faktura direkt aus technischen Ticketzeiten; nur freigegebene und noch offene Anforderungsmengen |
| SD-15 | Absagegrund, Änderungsauftrag, Storno/Gutschrift mit ursprünglichen Referenzen | Bereits ausgeführte oder fakturierte Mengen nicht still zurücksetzen; Gegenbelege und Salden nachvollziehbar |
| SD-16 | Kopf-/Positionstexte, Anlagenmodal, Ausgabevorschau, Druck-/E-Mail-Status, Änderungsprotokoll | PDFs im verbindlichen Schwarz-Weiß-Formular; kein vorgetäuschter Versand; eingefrorene historische Bytes |
| SD-17 | Belegfluss, Statusübersicht, Genehmigungsdetails, Historie direkt aus AU | Tatsächliche Teil-/Folgebelege und Org-/Kundenschutz, keine Verbindung fremder Fälle über gemeinsame Stammdaten |

## BILL: Freigabe als Fakturaanforderung und Fakturavorrat

- BILL-01: Freigegebene tatsächliche Leistungen aus SRM und Serviceauftragspositionen bzw. tatsächliche AU-Liefermengen im Direktvertrieb selektieren. Warenlieferungen benötigen keine SRM. Leistungserbringungsdatum bzw. Leistungszeitraum je Position, Steuerdatum, Rechnungstermin und Buchungsdatum getrennt führen. Arbeits-/Fahrzeiten, Material, Pauschalen, Zuschläge und Vertragsleistungen nach ihrer Abrechnungsregel behandeln.
- BILL-02: Eigenständige Fakturaanforderung mit Kopf, Positionen, typisiertem Ursprungsauftrag/-position, tatsächlicher AU-Lieferquelle oder Service-SRM mit Ticket-Korrelation, freigegebener Menge/Wert, Preis-/Steuersnapshot, Freigabe, Sperre und Restmenge. Keine Anfrage mit Rechnungsnummer versehen.
- BILL-03: Erst freigegebene Anforderungen erscheinen im Fakturavorrat. Filtern nach Kunde, Rechnungsempfänger, Regulierer, Buchungskreis, Zeitraum/Fälligkeit, Währung, Sperre, Bearbeiter. Teilmengen, Vorschau, Freigabe, Rücknahme und Fehlerprotokoll.
- BILL-04: Rechnung nur aus offenen freigegebenen Mengen. Parallele/erneute Verarbeitung darf dieselbe Quelle nicht doppelt fakturieren. Festpreis, Istaufwand und nicht fakturierbare Leistungen strikt getrennt; keine stille Übernahme der Planmenge als Istleistung.
- BILL-05: Sammelrechnung nur nach definierten Splitkriterien: Rechnungsempfänger/Regulierer, Buchungskreis, Währung, Steuer-/Zahlungsbedingungen, Referenzanforderungen. Monats-/periodische Abrechnung und Vertragspläne als weitere Quellen.
- BILL-06: Finale Rechnung mit RE-Nummer, eingefrorenem Partner-/Adress-/Steuer-/Preisstand, tatsächlichen Leistungsdaten, Zahlungsziel/Fälligkeit, ausgeglichenem FI und Debitorenposten. Unveränderliche Rechnung/Positionen; Aktualisierung der Quellen-/Auftrags-Fakturastände atomar.
- BILL-07: ZUGFeRD als echtes PDF/A-3 mit eingebettetem standardkonformem CII-XML, benanntem Profil/Versionsstand, XSD/Schematron- und PDF/A-Prüfung. Sichtbares Formular und XML müssen dieselben Summen/Mengen/Leistungsdaten enthalten. Technischer Erzeugungs-/Validierungsfehler ist kein erfolgreicher E-Rechnungsversand.
- BILL-08: XRechnung nach erforderlichem Profil, Käuferreferenz/Leitweg-ID und Endpunktangaben; kein normales PDF als E-Rechnung bezeichnen. Versand/Empfang/Zustellnachweise, Wiederholung, Archiv und Fehlerwarteschlange separat führen.
- BILL-09: Gutschrift, Teil-/Vollstorno, Korrektur-/Ersatzrechnung, Steuerkorrektur und OP-Ausgleich mit Genehmigung und Ursprungsbezug. Bezahlte Rechnungen brauchen Rückzahlungs-/Verrechnungsvorgang; keine Änderung der Originalrechnung.
- BILL-10: Mahnung, Zahlung/Teilzahlung, Bankzuordnung, Skonto, Ausbuchung und Abstimmung mit Debitoren-/Hauptbuch; überfällige Posten und Sperren nachvollziehbar.

Abnahme: tatsächliche AU-Lieferung oder technisch freigegebene Serviceleistung → ausgewählte Fakturaanforderung mit Liefer-/Leistungsdatum → unabhängige/regelgerechte Freigabe → Vorrat → Teil-/Restfaktura → unveränderliche RE + valides ZUGFeRD + FI + OP. Konkurrenz, Preisänderung nach Freigabe, falsche Währung/Organisation/Kunde, Sperre, geschlossene Periode, fehlende Steuer-/Debitorenstammdaten und Ausgabefehler prüfen.

## CRM/BP: zentraler Geschäftspartner mit vertrieblichen und buchhalterischen Rollen

- CRM-01: Eine Identität mit mehreren fachlichen Rollen, getrennten Kunden-/Lieferantenreferenzen, natürlichen/juristischen Personen, Beziehungen und Dublettenprüfung. Kunde und Lieferant derselben Firma werden nicht unverbunden doppelt angelegt.
- CRM-02: Allgemeine Stammdaten, Rechtsform, Kommunikationskanäle, Umsatzsteuer-/Steuerdaten, Sprache/Währung, Klassifikation, Gruppen, Zuständigkeit und Status; Historie/Version/Gültigkeit und kritische Änderungsfreigabe.
- CRM-03: Mehrere Ansprechpartner mit AP-Nummer, Position, Abteilung, Telefon/Mobil/E-Mail, Gültigkeit, primärer Zuordnung und Rollen: Technik, Einkauf, Vertrieb, Disposition, Rechnungsempfang, Freigabe, Geschäftsführung. Rollen gelten im Kontext einer Geschäftspartnerbeziehung, nicht als Anmeldung mit Systemrechten.
- CRM-04: Mehrere Adressen mit Typ, Gültigkeit und Standardfindung; zentrale Hauptadresse, Leistungs-/Liefer-/Rechnungsanschriften; abweichende Rechnungsempfänger und Regulierer getrennt modellieren.
- CRM-05: Debitorenrolle je Buchungskreis mit Abstimmkonto, Zahlungsbedingung, Zahlungsart, Mahnverfahren/-sperre, Kreditlimit/-währung und Fakturasperre. Kein Debitorenstamm als bereits gebuchter offener Posten ausgeben.
- CRM-06: Kreditorenrolle je Buchungskreis mit Abstimmkonto, Zahlungsbedingung, Zahlungs-/Einkaufssperre und Bank-/Zahlungsdaten. Fachliche Lieferantenfreigabe und Finanzrolle getrennt, miteinander konsistent.
- CRM-07: Vertriebsbereichsdaten, Preis-/Kundengruppe, Steuerklassifikation, Partnerfindung, Versand-/Fakturasperren und Kreditmanagement; Einkaufskonditionen im entsprechenden Einkaufsbereich.
- CRM-08: Kundenakte mit Aktivitäten, Kontaktverlauf, Wiedervorlagen, Aufgaben, E-Mails/Telefonnotizen, Anlagen; Tickets, Verträge, Objekte, Angebote, AU/SA, Lieferungen, Rechnungen und OP als berechtigte Übersichten.
- CRM-09: Leads/Interessenten IN, Verkaufschancen, Phasen, Wahrscheinlichkeit, Ansprechpartner, Angebote und Umwandlung; echte Vertriebspipeline, keine erfundenen Kennzahlen.
- CRM-10: Datenimport, externe Schlüssel, Dubletten-/Zusammenführungsprozess mit Belegreferenzerhalt; DSGVO-Zugriff/Auskunft/Aufbewahrung und dokumentierte Änderungshistorie.

Abnahme: derselbe GP als Kunde/Lieferant mit getrenntem Debitor/Kreditor in zwei Buchungskreisen, mehreren Ansprechpartnerrollen und abweichendem Rechnungsempfänger. Freigegebene Rechnungen behalten alte Adresse/Zahlungsdaten; neue Belege nutzen neue genehmigte Version. Kundenbenutzer und technische Rollen sehen keine fremden OP, Bank- oder internen Notizdaten.

## Folgende Arbeitsreihenfolge

1. Fakturaanforderung und Vorrat mit Leistungsdaten sowie blockierter Doppelverwendung.
2. Debitor-/Kreditor- und Ansprechpartnergrundlagen, die die Faktura sicher benötigt.
3. Unveränderliche Rechnung, FI/OP und nachweislich valides ZUGFeRD auf der vorhandenen Schwarz-Weiß-Vorlage.
4. Weitere SD-/CRM-Prozesse, Teil-/Sammel-/periodische Faktura, Storno/Korrektur und Auslieferungs-/Retourenlücken schrittweise schließen. Kein Abschlusslabel nur wegen vorhandener Register oder reservierter Nummernkreise.
