# AU-Materialplanung und Einkauf · Preview0.22

Erster Einkaufsumfang aus [DS-06](direct-sales.md): freigegebener Direktvertriebs-AU → tatsächliche Lagerartikel-Einteilung → gemeinsamer Lagerbestand zuerst → nur Fehlmenge als BANF → unabhängige Freigabe → mengenbegrenzte Teilbestellungen → unabhängige Freigabe. Keine künstlichen Tickets, SA, WOT oder SRM. Servicebeschaffung behält ihren tatsächlichen SA-Ursprung.

Die eigene App **Vertriebsbeschaffung** öffnet über die App-Zentrale einen organisationsgebundenen Arbeitsvorrat. Die native Desktop-Positionstabelle unterscheidet Bedarf, reservierten und freien Bestand, neue Fehlmenge, angeforderte und tatsächlich freigegebene Bestellmenge, Termin, Status und Kontierung. Auf dem Smartphone erscheinen dieselben Positionen mit nativen Pop-ins. Belegfluss und kleine Anlagenliste öffnen reale Folgebelege.

Beim internen Öffnen werden fehlende Systembedarfe einmalig aus den freigegebenen Einteilungen abgeglichen. Der Bedarf übernimmt Menge, konkreten Termin, Artikel und unveränderte Positionskontierung. „Lager nutzen“ reserviert tatsächliche freie Mengen. „Teile bestellen“ nutzt zuerst denselben freien Bestand und fordert nur den verbleibenden Rest an; Einreichung in den konfigurierten Vier-Augen-Workflow erfolgt atomar. Ohne geeigneten unabhängigen Freigeber bleiben weder halbe Reservierung noch BANF zurück.

Auch der gemeinsame manuelle API-Pfad darf freien Bestand nicht umgehen. Serverseitige Prüfung und Datenbankregel verlangen bei einer neuen AU-BANF zuerst die Reservierung verfügbarer Ware. Später eintreffende Ware macht eine historisch gültige Bestellung nicht nachträglich ungültig. Aktive BANF und gebundener beziehungsweise verbrauchter Bestand dürfen zusammen die wirkliche Einteilung nicht überschreiten. Eine zusätzliche Bestandsreservierung kann bereits beschaffte Mengen nicht nochmals decken.

Bestellungen benötigen dieselbe unabhängig freigegebene AU-BANF, Organisation, Buchungskreis und Währung sowie einen aktiven freigegebenen Lieferanten. Entwürfe binden offene BANF-Mengen gegen konkurrierende Teilbestellungen; der Status „Teilbestellt“ beziehungsweise „Vollständig bestellt“ entsteht erst aus tatsächlich freigegebenen Bestellungen. AU-Überlieferungstoleranz ist in diesem Umfang0. Verwerfen/Ablehnung eines Entwurfs gibt dessen Mengenbindung frei. Freigegebene Originale werden dadurch nicht gelöscht oder umgeschrieben.

Vertrieb darf AU-Fehlbedarf einreichen, erhält dadurch keine Service-BANF- oder Bestellberechtigung. Bestellanlage bleibt beim Einkauf. Kunden und Techniker sehen keinen AU-Einkauf. Die gemeinsame Quellenprojektion ist eine reine `security_invoker`-Lesesicht auf tatsächliche AU-/SA-Positionen; Tenant-RLS, Organisation, CSRF, Version, Idempotenz und Audit gelten weiterhin.

Das Schwarz-Weiß-Bestell-PDF verwendet Formularrevision5, tatsächlichen Lieferantensnapshot, eigene Lieferanschrift, AU-/Bestellnummer, Artikel, Teilmenge, Einkaufspreis, Nettowert und deutschen Liefertermin. Code128 und unveränderte Archivbytes sind am heruntergeladenen Browseroriginal geprüft. Der AU bündelt auch seine wirklichen Einkaufs-PDFs für berechtigte interne Rollen.

## Nachweise und nächste Grenze

API/DB: Bedarf5, zwei frei, Reservierung2 und genau BANF3; eigene BANF-Prüfung; Teilbestellungen1+2 mit separater Freigabe; konkurrierende Restbestellung, Entwurfsstorno/Ersatz, Überbestellung, SQL-Mengen-/Quellenschutz, Tenant-RLS, Vertriebsrolle und tatsächliches PDF. Browser: Bestellung3 ×40,00EUR =120,00EUR netto, Originaldownload und390px. Diese beiden isolierten Beispiele werden nicht vermischt. [Artefakte](../previews/v0.22.0-preview.1/README.md).

**Folgeprozess seit Preview0.23:** Tatsächliche AU-Teilwareneingänge und Rechnungseingang sind für freigegebene Lagerartikel im selben Buchungskreis und derselben Währung umgesetzt. Teilmengen1+2, reale AU-Reservierung, Lagerplatz/Tracking, Bewertung/FI, geschützte Originalgegenbewegung sowie Bestell-/WE-/EG-Abgleich mit unabhängiger Finanz-/Steuerfreigabe und Rechnungsstorno. [Aktueller Umfang und Grenzen](direct-sales-receipts-payables.md). Bestellfreigabe allein erzeugt weiterhin keinen Bestand oder Finanzbeleg.

Ebenfalls offen bleiben Nichtlager-/Fremdleistungsabnahme, Streckengeschäft, Einkaufsorganisations-/Partnerdetails, Wunschlieferant/Bezugsquellen, Sammelbedarf, nachträgliche Änderung/Versand, fakturierte Retoure/Korrektur und übriger Masterbacklog. [SAP-Kapitel und fachliche Ableitung](sap-reference-log.md).
