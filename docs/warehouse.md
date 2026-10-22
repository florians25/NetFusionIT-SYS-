# Physisches Lager · Preview 0.15

Der Lagerarbeitsplatz ist eine eigene Anwendung in der App-Zentrale. Er ergänzt Werk/Lagerort und die bewertete Materialwirtschaft um Bereich, Gang, Regal, Ebene und Fach. Die Fachmenge unterteilt den vorhandenen Lagerortbestand; sie ist kein zweiter bewerteter Bestand. Lagerortsummen, Reservierungen und gleitende Bestandswerte bleiben bei internen Platzwechseln erhalten.

## Struktur und Einlagerung

Lagerberechtigte legen Bereiche, Regale und Fächer an. Platzcode und Strukturidentität bleiben erhalten; Name, Bewegungssperre, Kapazität und Mischregeln sind mit Version und Änderungsgrund bearbeitbar. Bereichs-/Regalsperren gelten für darunterliegende Fächer. Ein Fach kann eine Kapazität mit genau einer Einheit, Artikelvermischung und Chargenvermischung vorgeben. Eine nachträgliche Regelverschärfung darf vorhandene tatsächliche Bestände nicht widersprechen. Struktur wird gesperrt statt gelöscht.

Migration019 übernimmt bestehende positive Lagerortbestände mit Charge/Serie als unveränderlichen beobachteten Anfangsstand ausschließlich in den jeweiligen Systempuffer `UNASSIGNED`. Sie erfindet keine historische Fachzuordnung oder Bewegung. Neue Lagerorte erhalten einen leeren Puffer. Neue tatsächliche Wareneingänge und ihre Gegenbewegungen wirken ebenfalls auf diesen Puffer.

Eine Einlagerung bestätigt Artikel, Tracking, tatsächliche Teilmenge, Quellpuffer, Zielfach und Grund. Ein Platzwechsel bestätigt dieselben Daten zwischen zwei verschiedenen Plätzen desselben Lagerorts. UL-Beleg, zwei ausgeglichene Platzbuchungen und Projektionen entstehen atomar. Das Bewegungsdatum ist der tatsächliche Geschäftstag in Europe/Berlin. Es gibt keine frei rückdatierbare Fachhistorie. Zwischen verschiedenen Lagerorten ist ein eigener künftig auszuarbeitender Umlagerungsprozess erforderlich.

## Ausliefern und zurücknehmen

Eine SA-Auslieferungsposition nennt das tatsächliche Entnahmefach. Eine Reservierung kann für eine Teillieferung über mehrere verschiedene Fächer aufgeteilt werden. Gesamtmenge je Reservierung und tatsächliche Fachmenge werden gemeinsam geprüft. Platzabbuchung, Lagerortabbuchung, Reservierungsverbrauch, WA/LS, gleitender Wertabgang und Quellen-FI bleiben eine Transaktion. Ohne explizites Fach verwendet der API-Kompatibilitätsweg ausschließlich den tatsächlichen Pufferbestand, niemals eine automatische erfundene Regalentnahme.

Auslieferungsrücknahme legt jede ursprüngliche Positionsmenge in ihr ursprüngliches Fach zurück; Sperre und Kapazität werden erneut geprüft. Historische Ausgaben vor019 ohne Fachzuordnung gehen in den Puffer zurück. Die bisherigen fachlichen Rücknahmesperren nach WOT-/SRM-/Auftragsfortschritt gelten weiter. Einlagerung/Platzwechsel wird mit eigenem SB-Beleg exakt umgekehrt. Fehlender tatsächlicher Zielbestand verhindert die Gegenbewegung. Ein WE-Storno benötigt zuerst ausreichende ursprüngliche Tracking-Menge im Eingangspuffer; notwendige Fachrückführungen sind getrennt nachvollziehbar.

## Etiketten und Scans

Das physische Platzetikett ist schwarz-weiß, einseitig 100 × 70 mm. Es enthält echten Firmennamen, lesbaren Platzcode, Strukturpfad und Code128. Die LP-Identität kodiert alle128 UUID-Bits dezimal; sie ist eine technische Scanneridentität, kein weiterer Geschäftsnummernkreis. Der kompaktere numerische Code128-Modus lässt auf diesem Druckformat ausreichend breite Module zu. Tatsächliche PDF-Raster bei150 dpi werden mit einer unabhängigen Barcodebibliothek zurückgelesen. 100 % ohne automatische Seitenanpassung drucken; Drucker-/Material-/Geräteabnahme bleibt erforderlich.

Jeder Etikettenstand erhält DO-Nummer, Snapshot, Hash und unveränderliche PDF-Bytes. Erneute Erstellung desselben vollständigen Standes liefert dasselbe Archiv; spätere Platz-/Regal-/Bereichsänderungen erhalten den alten Stand. Eine kleine native OpenUI5-Anlagenmaske bietet Erstellung und authentifizierten Download. UL/SB besitzt zusätzlich die normale kleine Anlagenliste mit klassischem Geschäftsformular und Geschäftsnummernbarcode; seine Artikel-/Firmen-/Quell-/Zielinformationen stammen aus dem gebuchten Snapshot.

Ein Tastatur-/USB-/Bluetooth-Scanner liefert den Code in das native Eingabefeld und bestätigt mit Enter. Der erwartete Scantyp ist ausdrücklich Lagerplatz oder Artikel. API-Prüfung berücksichtigt Tenant, Organisation und Buchungskreis; Platzetikett im Artikelscan wird abgelehnt. Scannen filtert den Arbeitsplatz bzw. wählt ein geprüftes Zielfach, löst jedoch keine Mengenbuchung aus. Produktcode ist der eindeutige freigegebene Stammschlüssel bzw. SKU, keine universelle Hersteller-EAN-Auflösung. Kamera, Offline-Puffer und fremde Barcode-Kataloge sind noch offen.

## Schutz und nachvollziehbare Grenzen

Anwendung erhält nur Lesezugriff auf Mengenprojektionen und das Platzbuch. Geschützte Quelltrigger erzeugen die Einträge. Aufgeschobene Datenbankprüfungen gleichen jede Fachsumme mit dem kanonischen Lagerortbestand ab. Gebuchte Köpfe/Positionen, Anfangsbeobachtungen, Einträge und Etiketten sind unveränderlich. Spätere Positionen an bereits versiegelten Platzbelegen sind gesperrt. Buchungskreissperren serialisieren konkurrierende Mengen-/Regeländerungen; fehlgeschlagene Bewegungen rollen Nummer, Menge, Beleg und Audit zurück.

Der Arbeitsplatz zeigt tatsächliche Bestände; Bestandszeilen unterschiedlicher Einheiten werden nicht zu einer scheinbaren Gesamtmenge addiert. Das Journal lädt die letzten100 Platzbelege und200 Platzbuchungen je Buchungskreis und kennzeichnet diese Grenze. Keine vollständige historische Such-/Export- oder Hochlastzusage. Noch offen bleiben lagerortübergreifende Umlagerung, Einheitenumrechnung, Inventur/Differenzfreigabe, Mehrfachlager-ATP, Sperr-/Prüfbestand, Pickwellen/Packstücke, Geräte-/Druckerabnahme und Fach-/Versandkorrektur nach Faktura. Die Dokumentation in material-deliveries.md gilt für die kaufmännisch-technische Übergabe weiter.
