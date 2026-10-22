# Materialwirtschaft (geplant)

Materialstamm mit Dienstleistung, Ersatzteil, Handelsware, Lager-/Nichtlagerartikel, Verbrauch, Lizenz, Hardware und Fremdleistung. Aktiver Status wird über Stammdatenfreigabe erreicht. Serien-/Chargenpflicht wird am Material hinterlegt. Lagerbestände sind pro Tenant/Werk/Lagerort/Material/Charge/Seriennummer dimensioniert.

Bedarf, Reservierung, Wareneingang und Verbrauch sind getrennte Vorgänge. Verfügbar = freier Bestand minus aktive Reservierungen. Reservierung sperrt die betroffene Bestandszeile, prüft Menge und erzeugt kein Materialverbrauchsdokument. Fehlmenge erzeugt verknüpften Beschaffungsbedarf. Verbrauch reduziert Bestand und offene Reservierung atomar, erzeugt Materialbeleg, Kostenreferenz, Fakturakandidat nur bei passender Abrechnungsregel.

Bewegungsarten: WE, Entnahme, Rückgabe, Umlagerung, Inventurdifferenz und jeweils Gegenbewegung. Keine direkte Bestandsänderung. Umlagerung ist ein zusammengehöriges Mengenpaar. Negative Bestände und unzulässige Seriennummernwiederverwendung werden durch Service und Constraints verhindert. Bereits fakturierte Verbräuche benötigen einen Korrekturprozess.

Bewertungsverfahren, Bestandskonten, Garantie-/interne Kostenträger, Einheitenumrechnung und Rundungen sind vor Implementierung zu entscheiden. Eine Mengenbuchung ohne entschiedene Bewertung wird nicht als fertige integrierte Lagerbuchhaltung bezeichnet.
