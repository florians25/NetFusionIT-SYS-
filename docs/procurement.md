# Einkauf (geplant)

BANF-Kopf: Organisation, Ersteller, Nummer, Status und Genehmigungsinstanz. Position: Material/Freitext, Bedarfsmenge, Einheit, Termin, Wunschlieferant, geschätzter Preis/Währung, Kostenstelle, Auftrag/Ticket, Lagerort. Bestellmenge und Restmenge werden aus zugeordneten Bestellpositionen ermittelt.

BANF: DRAFT → SUBMITTED → IN_APPROVAL → APPROVED → PARTIALLY_ORDERED → ORDERED. Bestellung: DRAFT → IN_APPROVAL → RELEASED → PARTIALLY_RECEIVED → RECEIVED → CLOSED; Ablehnung/Storno sind explizit. Nur Einkäufer erstellt Bestellung, Freigeber benötigt eigene Berechtigung. Änderungen nach Freigabe können erneute Freigabe auslösen.

## Wareneingang

Kommando prüft Rolle, Organisation, Bestellfreigabe, Periode, offene Menge, dokumentierte Überlieferungstoleranz, Lagerort und Serien-/Chargenangaben. Sperrt Bestellposition und Bestand in definierter Reihenfolge. Speichert WE-Kopf/-Position, Materialbewegung, Bewertung, gegebenenfalls FI-Beleg, Belegfluss und Audit in einer Transaktion. Idempotenz verhindert Doppel-WE. Teilmengen werden addiert; noch offene 6 nach WE4 und WE2 ergeben 0 bei Bestellung6, aber weiterhin Bedarf4 bei BANF10.

Storno referenziert Originalbewegung und kehrt Menge/Bewertung um. Bereits verbrauchtes Material oder gesperrte Periode verhindert ungeprüftes Storno. Kreditorenrechnung benötigt Drei-Wege-Abgleich Bestellung–WE–Rechnung mit Mengen-/Preisabweichungsworkflow.
