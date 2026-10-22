# Auftragsbezogene Beschaffung

Stand Preview 0.6. Verbindlich gilt die [Nutzerpräzisierung](requirements/ticket-execution.md): Einstieg und kaufmännische Referenz sind Serviceauftrag und freigegebene Position. Das Ticket bleibt technischer Arbeitsbeleg. Kostenpflichtige Beschaffung kann nicht frei aus einem Ticket angelegt werden.

## Implementierter Prozess

Serviceauftrag **RELEASED/IN_PROGRESS → Materialbedarf → BANF → unabhängige Freigabe → Bestellung(en) → unabhängige Freigabe**. Native OpenUI5-Objektseiten und Dialoge mit mehreren Positionen, Bedarfstermin, Zweck, Mengen, optionalem Schätzpreis, Lieferant, Einkaufspreis und vereinbarter Überlieferungstoleranz. Material-/Nichtlager-/Fremdleistungspositionen sind zulässig, Stundenpositionen nicht. Kontierung wird aus der genehmigten Auftragsposition übernommen; Einkaufspreis wird getrennt vom Verkaufspreis gepflegt. BANF benötigt explizit konfigurierten Buchungskreis und Hauswährung.

Lieferanten sind Geschäftspartner mit Rolle SUPPLIER, kanonischer Geschäftsadresse/Umsatzsteuer-ID und Zahlungsziel. Anlage als Entwurf, Aktivierung nur über konfigurierte Geschäftspartnerfreigabe. Reine Lieferanten erscheinen nicht in der Kundenliste und können nicht als Ticketkunde verwendet werden. Die Bestellung hält einen unveränderlichen Lieferantensnapshot fest; vor Einreichung und endgültiger Freigabe wird der aktuelle aktive Lieferantenstatus erneut geprüft.

Bedarfsmengen bleiben innerhalb der freigegebenen Auftragsposition. Aktive BANF binden Bedarfsmengen; Bestellungen einschließlich Entwürfen binden BANF-Mengen. Die BANF erhält PARTIALLY_ORDERED/FULLY_ORDERED erst aus tatsächlich freigegebenen Bestellungen. Beispiel: Bedarf/BANF 10, Bestellung 6 in Prüfung → noch 4 ungebunden; Bestellung 6 freigegeben → Teilbestellt; weitere Bestellung 4 freigegeben → Vollständig bestellt. Das ist noch kein Wareneingang und noch kein Bestand.

Eine Sperre des übergeordneten Serviceauftrags serialisiert Mengenbindung und Freigabe. Auch parallele Anlage kann nicht überbestellen. Abgelehnte oder verworfene Belege binden keine Mengen; erneute Einreichung prüft deshalb die inzwischen anderweitig gebundenen Mengen erneut. DRAFT/REJECTED dürfen mit Begründung verworfen werden. Bedarf kann erst ohne aktive BANF verworfen werden. Freigegebene Bestellung kann nicht durch diese Entwurfsaktion gelöscht werden. Inhalt und Positionen werden zusätzlich durch Datenbanktrigger geschützt. Korrekturen erfolgen derzeit durch Verwerfen/Ablehnung und Ersatzanlage; nachträgliche Bestelländerung oder Lieferantenversand ist noch nicht implementiert.

Vier-Augen-Freigabe schließt sowohl Belegersteller als auch Einreicher aus, auch bei Vertretung. Für BANF können Service-/Einkaufsleitung oder Administration konfiguriert werden, für Bestellungen Einkaufsleitung/Administration. Einkauf darf Aufträge seines Organisationsumfangs lesen, erhält dadurch keine Servicetickets. Kundensichten enthalten keine Beschaffungsbelege. Tenant-RLS, Organisations-/Fallgrenzen, Version, CSRF, Idempotenz, Audit und Belegfluss gelten für alle Kommandos.

## Noch offene Folgeprozesse

Wareneingang/-storno, Bestände/Bewertung, Reservierung/Verbrauch, Fremdleistungsabnahme, Lieferantenrechnung und Drei-Wege-Abgleich sind noch nicht umgesetzt. Überlieferungstoleranz ist im Bestellinhalt gespeichert, wird aber erst beim späteren Wareneingang wirksam. Es entstehen derzeit keine behaupteten Lagerbewegungen oder Finanzbuchungen aus einer Bestellfreigabe.

Wareneingang muss Bestellfreigabe, Periode, Restmenge/Toleranz, Lagerort und Serien-/Chargenangaben prüfen und WE, Bewegung, Bewertung, FI-Beleg, Belegfluss und Audit atomar schreiben. Szenario E: BANF10 → Bestellung6 → WE4+2 → weitere Bestellung4 → WE4. Ein Storno muss Menge und Bewertung durch Gegenbewegung zurücknehmen und bereits verbrauchte Mengen/gesperrte Perioden berücksichtigen. Kreditorenrechnung benötigt Bestellung–WE–Rechnung-Abgleich mit Mengen-/Preisabweichungsworkflow.
