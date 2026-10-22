# Materialwirtschaft · Preview 0.7

Die [verbindliche Nutzerpräzisierung](requirements/material-fulfillment.md) führt den Prozess vom Serviceauftrag aus. Freigegebene Lager-, Nichtlager- und Fremdleistungspositionen erzeugen automatisch ihren Bedarf. Arbeitszeit, Fahrt und Pauschalen erzeugen keinen Ersatzteilbedarf. Herkunft, Mengen, Termin und Kontierung bleiben an der genehmigten Position; ein automatischer Bedarf kann nicht unabhängig vom Auftrag gelöscht werden.

## Verfügbarkeit und Reservierung

Bestände sind nach Tenant, Buchungskreis, Artikel, Werk/Lagerort, Charge und Seriennummer aufgeteilt. Werke und zentrale, Werkstatt- oder mobile Lagerorte werden im Lagerarbeitsplatz konfiguriert. Lagerführung verlangt ausdrücklich gleitende Durchschnittsbewertung sowie Serien-/Chargenpflicht. Nach der ersten Bewegung bleibt diese Einstellung geschützt. Negative Bestände und gleichzeitig mehrfach aktive gleiche Seriennummern werden auch von der Datenbank verhindert.

Freier Bestand = physischer Bestand minus aktive Reservierungen aller Aufträge. „Lager nutzen“ reserviert verfügbare Mengen für die konkrete Auftragsposition. „Teile bestellen“ reserviert ebenfalls zunächst vorhandene Teile und erzeugt nur für die verbleibende, noch nicht durch Beschaffung gedeckte Menge eine BANF. Die BANF wird atomar in die konfigurierte unabhängige Freigabe eingereicht. Fehlende Regeln/Freigeber rollen das gesamte Kommando zurück. Wiederholung, parallele Planung und unveränderte Idempotenzschlüssel erzeugen keine Doppelbindung. Reservierungsfreigabe erfordert Version und Begründung.

Die native OpenUI5-Auftragsobjektseite zeigt Bedarf, freien Bestand, Reservierung, physische Fehlmenge, neu anzufordernde Menge, BANF, freigegebene Bestellung und Netto-Wareneingang. Positionsstatus und daraus abgeleiteter Versorgungsstatus am Kopf sind vom Ausführungs- und Fakturastatus getrennt. Nichtlagerteile/Fremdleistungen zeigen ihren direkten Beschaffungsweg; fehlender Lagerbestand wird ausdrücklich gemeldet. Der Lagerarbeitsplatz zeigt physisch/reserviert/frei je Lagerort und Bewertung je Buchungskreis/Artikel.

## Bewerteter Wareneingang

Nur freigegebene Bestellungen mit Lagerpositionen können Wareneingänge erzeugen. Offene Periode, Lagerort, Artikelkonfiguration, Restmenge, vereinbarte Überlieferungstoleranz, Serien-/Chargenangaben und Einkaufspreis werden serverseitig geprüft. Seriennummern benötigen einzelne Zeilen mit Menge eins; Lieferungen können auf mehrere Lagerorte/Chargen verteilt werden.

Wareneingang, unveränderliche Materialbelegpositionen, private Bestands-/Bewertungsprojektionen, automatische Reservierung für den Ursprungsbedarf, Bestell-/Versorgungsstatus, FI-Journal, Belegfluss und Audit werden in einer Transaktion geschrieben. Überschüssige Liefermengen bleiben frei. Bewertung erfolgt aus dem freigegebenen Einkaufspreis mit Dezimalrechnung; Durchschnittspreis = aggregierter Wert / Menge. Ein ausdrücklich mit Nullpreis genehmigter Zugang erzeugt Bestand ohne fingierte Geldbuchung.

Die Kontierungsregel STOCK_RECEIPT benötigt ein Bestandskonto (ASSET) und WE/RE-Verrechnungskonto (LIABILITY): Bestand im Soll, WE/RE im Haben. Ein Fehler bei der Buchung rollt auch die Mengenbewegung zurück. Bestellung 6 → WE4+2 und weitere Bestellung4 → WE4 ergibt Bestand10; mit Preisen40/60 ergibt sich Wert480 und Durchschnitt48.

Ein Wareneingangsstorno ist eine eindeutige vollständige Gegenbewegung mit Originalbezug, Grund und offener Periode. Menge und ursprünglicher Wert werden zurückgenommen; die FI-Gegenbuchung verwendet die ursprünglichen Konten auch nach einer Regeländerung. Eigene durch diesen Eingang angelegte Reservierungen werden freigegeben. Fremdreservierungen oder fehlender Bestand verhindern die Rücknahme. Der automatische FI-Beleg kann nicht separat vom Materialprozess storniert werden.

## Ausstehender Umfang

Reservierung ist noch kein tatsächlicher Verbrauch. Warenentnahme/Verbrauch mit WOT-/SRM- und Kostenübergabe, Rückgabe nach Verbrauch, Anfangsbestand, Umlagerung, Inventur, Einheitenumrechnung und historische ATP/MRP-Terminplanung sind noch offen. Nichtlager-/Fremdleistungsbestellungen besitzen noch keine Leistungsabnahme. Lieferantenrechnung/Drei-Wege-Abgleich und Faktura sind ebenfalls offen. Es gibt keine direkte Bestandskorrektur als Ersatz für diese Prozesse.
