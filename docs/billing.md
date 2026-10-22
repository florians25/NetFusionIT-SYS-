# Faktura und Formulare (geplant)

Fakturavorrat enthält ausschließlich freigegebene, noch nicht fakturierte Leistungsmengen: Zeit, Materialverbrauch, Pauschale, Vertrag, Fahrt und Zuschlag. Eindeutiger Quellbezug verhindert doppelte Faktura; Teilfaktura reduziert die offene Menge. Fakturasperre, Sammelrechnung und periodische Vertragsabrechnung besitzen explizite Regeln.

Finales Buchungskommando prüft Rolle, Kunde, Organisation, offene Periode, Leistungsfreigabe, Preis-/Steuerregel und idempotente Verarbeitung. Eine Transaktion vergibt die rechtlich relevante Nummer, friert Rechnungspositionen und Konditionen ein, erzeugt Forderung, ausgeglichenes Journal und Relationen und markiert Quellen. Dokumentenerstellung folgt über Outbox; Rechnungsstatus unterscheidet fachlich gebucht von PDF/XML erfolgreich erzeugt. Keine bereits festgeschriebene Rechnung löschen.

## Storno und Korrektur

Vollstorno benötigt Grund, Berechtigung, Perioden-/Zahlungsprüfung und Genehmigung. Sperre und Unique-Constraint auf wirksames Storno verhindern Doppelstorno. Ursprungsbeleg bleibt; Stornobeleg, Gegenjournal, OP-Korrektur und Relationen entstehen atomar. Bereits gezahlte Rechnung erfordert separate Rückzahlungs-/Verrechnungsvorgänge. Teilkorrektur, Preisgutschrift und Vollstorno sind unterschiedliche Belegarten. Steuerbehandlung und Freigabegrenzen werden vor Umsetzung geklärt.

## Formularengine

Versionierte Vorlagen für Angebot, Auftrag, Service/Einsatz, Bericht, Bestellung, WE, Entnahme, Rechnung, Sammelrechnung, Storno, Korrektur, Gutschrift, Mahnung und Kontoauszug. Snapshot der Ausgabedaten; Layout mit eigener Marke, Empfänger, Nummer/Datum, Referenzen, Positionen, Steuer/Summen, Zahlungsbedingungen, Fuß-/Seitenzeilen. Privater Speicher mit Content-Hash und Archivverweis. PDF-Erzeugung im isolierten Worker ohne freien Netzwerkzugriff. Ausgabe wird auf mehrseitige Tabellen und Unicode getestet.

XRechnung und ZUGFeRD werden erst mit ausgewählter Bibliothek, aktuellen Schematron-/XSD-Prüfungen und fachlicher Abnahme als implementiert bezeichnet. Im ersten Umfang keine PDF-/E-Rechnungsschaltflächen.

## Entwicklung Preview0.11

Der erste durchgängige Umfang ist **eine Teil-/Endrechnung zu einem SA**, normale positive Umsatzsteuer, gleiche zweistellige Buchungskreis-/Auftragswährung und Rechnungsempfänger=Auftragskunde. Er ersetzt keine vollständige SD-/Faktura-/CRM-/AP-Lösung. Eigener AU, Sammelrechnung über mehrere Aufträge, Steuerbefreiung/Reverse Charge/Kleinunternehmer/EU/Drittland, Anzahlungs-/Schlussrechnung, periodische Pläne, Rechnungskorrektur/Gutschrift, Zahlung/Ausgleich, vollständiger CRM-Änderungsworkflow und Eingangsrechnungsprüfung bleiben offen. [Rechtliche Lücken](compliance-gap-analysis.md) gelten weiterhin.

Abgeschlossene und genehmigte tatsächliche SRM-Zeilen werden mit eingefrorenem Auftragspreis und getrenntem Leistungszeitraum in eine nummerierte Fakturaanforderung übernommen. Entwürfe binden Quellmenge; nur unabhängig freigegebene offene Positionen erscheinen im Fakturavorrat. Festpreise sind ohne Fakturierungsplan nicht teilbar. Rechnungsbuchung erzeugt in einer Transaktion RE, unveränderlichen Snapshot, Forderung, ausgeglichenes FI-Journal und Quellenmengenstatus. SQL-Trigger prüfen Quelle/Menge/Preis/Steuer und beim Versiegeln die öffentlichen Snapshotdaten sowie AR/Erlös/USt. Die spätere Ausgabe bleibt ein eigener dauerhafter Auftrag.

Debitoren-/Kreditorenrollen und das Bank-/Fakturaprofil werden als DO-Stammdatenentwurf je Buchungskreis angelegt und unabhängig freigegeben; sie aktivieren sich nicht selbst. Der Debitor benötigt passendes Forderungskonto, Kunde und Buchungskreis müssen zur Organisation passen. Sperre, Zahlungsziel und Kreditlimit fließen in die Buchung ein. Das konfigurierte Bankprofil ist Voraussetzung des hier implementierten Überweisungswegs, keine universelle gesetzliche Rechnungsangabe. Aktive Profile haben noch keinen vollständigen Austausch-/Sperrworkflow; keine Direktänderung bestehender Buchungen.

E-Rechnung: offizielle **Mustang-CLI2.26.0**, aus Maven Central mit festgelegter SHA-256 geladen, PDF/A-3b mit eingebetteter `factur-x.xml`, CII-Profil EN16931. Tatsächliche PDF/A-, XSD- und Schematronprüfung vor Bereitstellung; ungültige Summen werden abgewiesen. Die strukturierte Originalausgabe, PDF, SHA-256 und Validatorbericht werden unverändert gespeichert. Das ist kein Nachweis für XRechnung oder sämtliche steuerlichen/rechtsformabhängigen Sonderfälle. Privilegierte Administrator-/Backupzugriffe benötigen die zusätzliche betriebliche Archivabsicherung.

Pro API-Prozess wird höchstens ein Java-Validierungslauf gestartet (`-Xmx512m`, Zeitlimit90s). Bei belegter Kapazität bleibt ein weiterer Ausgabeauftrag PENDING. Es gibt eine gezielte Wiederanlauf-API/Schaltfläche und einen5-Minuten-Lease; ein autonomer periodischer Worker und clusterweite Kapazitätssteuerung sind weiterer Betriebsumfang. Fehlgeschlagene Ausgabe ändert nicht das gebuchte Journal und wird mit Korrelations-ID/Fehlerklasse protokolliert. Wiederholung erzeugt dieselbe Rechnung, keine zweite FI. PDF/XML erst nach erfolgreicher Ausgabe abrufbar; Kundenzugriff ausschließlich auf eigene Rechnungen.

Vorbereitung: Java21, `npm run einvoice:setup`, Build, Migrationen. Das Werkzeug wird unter `.local/tools` abgelegt (kein Repository-Upload). Docker enthält eine Java21-JRE-Stufe und das geprüfte Werkzeug; tatsächlicher Docker-/Ubuntu-Start ist separat abzunehmen. CI ist entsprechend konfiguriert, ein entfernter grüner Lauf wird dadurch nicht behauptet.

Sperren des ersten Umfangs: Aussteller und Rechnungsanschrift müssen DE sein; abweichende Länder werden bis zur Freigabe weiterer Leistungsort-/Steuerfälle abgewiesen. Wiederholtes Runden kleinster Teilmengen darf den genehmigten Anforderungsnettowert nicht überschreiten. Der letzte solche Teilbetrag wird gesperrt und verlangt größere Teilmengen bzw. einen noch offenen Rundungskorrekturprozess; es wird kein zusätzlicher Umsatz erfunden.
