# Geschäftsbelege und zusätzliche SAP-Muster

Nutzerpräzisierungen vom 22.10.2026. „DIN 50008“ wird als **DIN 5008** umgesetzt. Die bereitgestellten SAP-Beispiele bestimmen die fachliche Gliederung, nicht ein SAP-Logo oder eine behauptete SAP-Zertifizierung.

## Geschäfts-PDFs

A4, Briefbogen nach DIN 5008 Form B: Textbeginn bei25mm, rechter Rand20mm; Anschriftfeld bei20mm/45mm mit85mm Breite und45mm Höhe. Rücksendeangabe im oberen5mm-Streifen, Anschriftzone ab62,7mm mit maximal sechs Zeilen und4,23mm Zeilenabstand. Nach zusätzlichem Nutzermuster steht der kompakte Formular-Belegkopf rechts ab110mm/38mm, mit Nummer/Datum/Seite ab50mm. Die spätere Nutzerkorrektur für Revision6 (unten) ersetzt die ältere Nummer-/Datum-/Seitenanordnung: vollständiger Ansprechpartner und nur wesentliche Angaben rechts, Seite in der Fußzeile. Belegart im Kopf, längere Bezüge und Beschreibung unterhalb von Anschrift und Kopf. Dies ist eine Formularvariante mit DIN-Fensteranschrift, kein unverändert übernommener Geschäftsbrief-Betreff bei98,5mm. Anschriften werden bei Überlänge ausdrücklich abgewiesen und niemals abgeschnitten. Beträge und Mengen stehen rechtsbündig, Positionstabellen besitzen wiederholte Köpfe und ein Summenfeld. Fortsetzungsseiten nennen Firma und Beleg; Fußzeilen enthalten Firma, vorhandene Geschäftsadresse/USt-ID, Archivnummer, Vorlagenstand und Seitennummer. Vorlagenänderungen ändern keine archivierten Bytes.

Vorlagenstand2 ist im ersten Preview0.10 implementiert. Vorlagenstand3 ersetzt ab0.10.0-preview.2 die Gestaltung gemäß weiterem Nutzermuster: ausschließlich Schwarz-Weiß, kompakter rechter Kopf mit kleinen Feldtiteln, Lieferanschrift links, kräftige horizontale Tabellenlinien ohne Farbflächen oder vertikale Kästen, Positionsnummern, Materialnummern, Preis je Basiseinheit und dreigeteilte Firmen-/Archivfußzeile. Alle sechs bisherigen Dokumentarten nutzen diese Basis; alte archivierte Bytes bleiben erhalten. Tatsächliche PDF-Textrahmen werden mit Poppler auf Anschriftfeldgrenzen und Überschneidungen geprüft; lange Positionen, wiederholte Tabellenköpfe und letzte Zeile über mehrere Seiten ebenfalls. Das ist ein Implementierungsnachweis für diese Layoutmaße, keine unabhängige DIN-Konformitätszertifizierung. Eine vollständige Normprüfung anhand der lizenzierten aktuellen Norm und rechtliche Vollständigkeit der konkreten Firmenpflichtangaben sind noch nicht abgenommen. Fehlende Register-/Vertreter-/Bankdaten werden nicht erfunden.

Vorhandene Belegarten: Serviceauftragsbestätigung, Bestellung, WE, Lieferschein, SRM und interne Vorgangsblätter. Rechnungen/Gutschriften folgen dem noch offenen Fakturaprozess; ein Vorgangsblatt erhält keine Rechnungsnummer.

## Ticketarbeitsplatz

**Kein Belegfluss in der Ticketmaske.** Direkter Servicefallzugriff bleibt möglich. Das Ticket führt technische Bearbeitung, WOT, Arbeits-/Fahrzeiten, Pauschalen und Nachrichten. Mehr Kontext und Funktionen aus tatsächlichen Daten sowie ein besser gegliederter Kunden-/Notizverlauf sind als weiterer Ausbau beauftragt. Kunden sehen keine internen Notizen. Kein behaupteter E-Mail-Versand ohne Zustellintegration. Die kaufmännische Folgebelegkette gehört weiterhin zum Serviceauftrag.

## Sales Orders und Einkauf

Die zusätzlichen Nutzerbilder umfassen Verkaufsauftragskopf, Positionsübersicht/-details, Partnerrollen, Termine, Konditionen, Liefer-/Fakturasperren, Absage und Freigabe sowie Bestellkopf, Kontierung, Lieferung/Rechnung, Konditionen, Historie, Ausgabe und BANF-Bearbeiterzuweisung. Diese Funktionen sind verbindlicher Ausbauumfang, nicht durch vorhandene Serviceaufträge vollständig geliefert.

Ein eigener Kundenauftrag verwendet AU und bewahrt freigegebene Kopf-/Positions-/Preisstände. Übergabe an Serviceauftrag und technische Ausführung dürfen kaufmännische Sperren nicht umgehen. Kostenpflichtige Beschaffung, Istverbrauch und SRM-Abrechnung bleiben den genehmigten Serviceauftragspositionen zugeordnet. Teilmengen, Folgebeleggrenzen, Ablehnung, Storno/Gegenbelege und unabhängige Freigabe sind fachlich abzunehmen. Keine bloßen leeren Register oder funktionslosen Musteraktionen.

## Letzte Layoutkorrektur, Preview0.25

Revision6 übernimmt die [aktuelle Vorgabe](workspaces-document-contacts.md): keine zusätzliche Infobox und keine gerahmte Anschriftentabelle. Die linke Anschrift bleibt normal gesetzt. Der vollständige Ansprechpartner gehört in den reduzierten rechten Belegkopf mit Nummer, Datum und wichtigen Referenzen. Organisationsdaten stehen im Beleginhalt; Seitennummern in der Fußzeile. Historische Archivbytes und wartende Ausgabeaufträge mit Vorlagenstand5 bleiben geschützt.
