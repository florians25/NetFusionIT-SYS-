# Faktura und Formulare (geplant)

Fakturavorrat enthält ausschließlich freigegebene, noch nicht fakturierte Leistungsmengen: Zeit, Materialverbrauch, Pauschale, Vertrag, Fahrt und Zuschlag. Eindeutiger Quellbezug verhindert doppelte Faktura; Teilfaktura reduziert die offene Menge. Fakturasperre, Sammelrechnung und periodische Vertragsabrechnung besitzen explizite Regeln.

Finales Buchungskommando prüft Rolle, Kunde, Organisation, offene Periode, Leistungsfreigabe, Preis-/Steuerregel und idempotente Verarbeitung. Eine Transaktion vergibt die rechtlich relevante Nummer, friert Rechnungspositionen und Konditionen ein, erzeugt Forderung, ausgeglichenes Journal und Relationen und markiert Quellen. Dokumentenerstellung folgt über Outbox; Rechnungsstatus unterscheidet fachlich gebucht von PDF/XML erfolgreich erzeugt. Keine bereits festgeschriebene Rechnung löschen.

## Storno und Korrektur

Vollstorno benötigt Grund, Berechtigung, Perioden-/Zahlungsprüfung und Genehmigung. Sperre und Unique-Constraint auf wirksames Storno verhindern Doppelstorno. Ursprungsbeleg bleibt; Stornobeleg, Gegenjournal, OP-Korrektur und Relationen entstehen atomar. Bereits gezahlte Rechnung erfordert separate Rückzahlungs-/Verrechnungsvorgänge. Teilkorrektur, Preisgutschrift und Vollstorno sind unterschiedliche Belegarten. Steuerbehandlung und Freigabegrenzen werden vor Umsetzung geklärt.

## Formularengine

Versionierte Vorlagen für Angebot, Auftrag, Service/Einsatz, Bericht, Bestellung, WE, Entnahme, Rechnung, Sammelrechnung, Storno, Korrektur, Gutschrift, Mahnung und Kontoauszug. Snapshot der Ausgabedaten; Layout mit eigener Marke, Empfänger, Nummer/Datum, Referenzen, Positionen, Steuer/Summen, Zahlungsbedingungen, Fuß-/Seitenzeilen. Privater Speicher mit Content-Hash und Archivverweis. PDF-Erzeugung im isolierten Worker ohne freien Netzwerkzugriff. Ausgabe wird auf mehrseitige Tabellen und Unicode getestet.

XRechnung und ZUGFeRD werden erst mit ausgewählter Bibliothek, aktuellen Schematron-/XSD-Prüfungen und fachlicher Abnahme als implementiert bezeichnet. Im ersten Umfang keine PDF-/E-Rechnungsschaltflächen.
