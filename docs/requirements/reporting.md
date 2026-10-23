# Reporting und Statistiken · verbindlicher Ausbau

Beauftragt im Masterprompt und am 23.10.2026 nochmals ausdrücklich präzisiert. **Status: offen, vorhandene Cockpit-Zähler und Summen/Salden sind Teilbasis.** Berichte werden zusammen mit ihren tatsächlich implementierten Fachquellen entwickelt; fehlende Quellen werden als fehlende Abdeckung ausgewiesen. [Masterbacklog mit aktueller Reihenfolge](../master-backlog-index.md), [Direktvertrieb](direct-sales.md).

## Fachliche Regeln aus dem Handbuchabgleich

Die tatsächlichen SAP-Fachtexte zu Sales, Umsatz, offenen Verkäufen und Deckungsbeitrag wurden am 23.10.2026 gelesen: [Referenzprotokoll mit Version und übernommenen Regeln](sap-reference-log.md). Maßgeblich sind unter anderem **Sales Volume – Profit Margin (F2271)** und **Sales Volume – Check Open Sales (F2270)**. Die ältere Detailed-Analysis-App ist laut Handbuch zur Ablösung vorgesehen; deren APF-Technik wird nicht als neue Architektur übernommen. Keine SAPUI5-/CDS-/Smart-Business-Abhängigkeit: Implementierung mit eigenen berechtigten Datenabfragen und ausschließlich OpenUI5-Standardcontrols.

- **Umsatz:** tatsächlich fakturierte, wirksame Nettowerte der Rechnungspositionen im ausgewählten Zeitraum. Gutschriften, Rechnungsstornos, Steuern und Zahlungsbeträge sind eigene Größen; keine Entwürfe, Angebote oder AU-Planmengen als Umsatz.
- **Nettoumsatz:** wirksamer fakturierter Umsatz abzüglich wirksamer Gutschriften; ursprüngliche Rechnung und Gegenbelege so verrechnen, dass kein Storno doppelt abgezogen wird. Gutschriften/Korrekturen erst einbeziehen, wenn deren Fachprozess umgesetzt ist; bis dahin dessen fehlende Abdeckung ausweisen.
- **Offener Auftragsbestand, offene Lieferung und Fakturavorrat:** getrennte Mengen/Werte mit tatsächlichem AU-/SA-/Einteilungs-/Liefer-/Anforderungsbezug. Diese Größen nicht zum fakturierten Umsatz addieren und als Erlös bezeichnen.
- **Deckungsbeitrag:** definierter Nettoumsatz abzüglich zugeordneter tatsächlicher Kosten; Kostenherkunft unterscheidet Lager-WA, Beschaffung und Service-Istleistung. Geplante Kalkulation und Istkosten getrennt. Fehlende Kostengrundlage bedeutet unvollständige Kalkulation, nicht Kosten null. Bei Umsatz null kein erfundener Prozentwert.
- **Zeit-/Währungsbezug:** Rechnungs-, Liefer-/Leistungs- und FI-Buchungsdatum ausdrücklich unterscheiden. Kalender-/Geschäftsperiode und Vergleichszeitraum anzeigen. Unterschiedliche Währungen getrennt auswerten; Umrechnung nur mit tatsächlichem freigegebenem Kurs und ausgewiesenem Stichtag.
- **Drill-down und Datenschutz:** Aggregat → Kunde/Artikel/Auftrag → berechtigte Belegposition → Originalbeleg. Filterung bereits auf Datenbankebene nach Tenant, Organisation, Rolle und erlaubten Dimensionen; keine intern sichtbaren Kosten im Kundenportal. Begrenzte, seitenweise Detailabfragen statt unbeschränktem Vollabruf.

## Verbleibende Arbeitspakete

| ID | Bericht / Funktion | Abnahme |
| --- | --- | --- |
| RPT-01 | Berichtsarbeitsplatz mit Kennzahlendefinition, Stichtag, Quellenabdeckung und Filtern | Eigene Anwendung in App-Zentrale, nur zugehörige Schnellzugriffe; Zeitraum, Buchungskreis, Vertriebsbereich, Kunde, Artikel und Währung nachvollziehbar |
| RPT-02 | Umsatzstatistik nach Tag/Monat/Quartal/Jahr, Kunde/Kundengruppe, Artikel/Warengruppe, Verkaufsorganisation/Vertriebsweg/Sparte | Nettowerte aus wirksamen Rechnungspositionen; Belegpositions-Drill-down und Abstimmung gegen Rechnung/FI; Service und Direktvertrieb unterscheidbar |
| RPT-03 | Vorperioden-/Vorjahresvergleich und Umsatzentwicklung | Gleiche explizite Periodenlänge und Kennzahlbasis; absolute/relative Änderung, kontrollierte Nullbasis; keine fiktiven Zielwerte |
| RPT-04 | Auftragseingang, offener Auftragsbestand, offene Lieferungen und Fakturavorrat | Freigegebene und offene Mengen/Werte mit Absagen/Teilausführung/Gegenbelegen korrekt; Termin-/Sperrgründe und Herkunft aufklappbar |
| RPT-05 | Angebotspipeline und Annahme-/Absagequote | Version, Zeitraum und Nenner eindeutig; Teilannahme positions-/wertbezogen, keine Mehrfachzählung derselben Kundenentscheidung oder Umwandlung |
| RPT-06 | Plan-/Istkosten und Deckungsbeitrag nach AU/SA/Kunde/Artikel | Tatsächliche Kostenquellen zuordnen, Rücknahmen/Gutschriften korrekt, nicht vorhandene Kosten als unvollständig markieren; Kostenrechte serverseitig |
| RPT-07 | Einkauf: offene BANF/Bestellungen, Liefertermine, Teil-WE, Preisabweichung und Rechnungseingang | Bestellte/gelieferte/verrechnete Mengen und Werte getrennt; Lieferant und AU-/SA-Ursprung erhalten; Rückgaben/Stornos berücksichtigen |
| RPT-08 | Lager: frei/reserviert/Fehlmenge, Fach-/Trackingbestand, Bewegungen, Inventurdifferenzen und Bewertung | Ein konsistenter Lesestand; Warenbewegung und Gegenbewegung, Werk/Lager/Fach, Serien/Chargen und FI abstimmbar; keine Addition inkompatibler Einheiten |
| RPT-09 | Service/Tickets: Eingänge, offener Bestand, Alter, Lösung, Reaktion/SLA, Team-/Technikerauslastung | Tatsächliche Status-/Kalender-/Pausenereignisse statt bloßer aktueller Statuszählung; Wiederöffnung und fehlende Zeitbasis erkennbar |
| RPT-10 | Arbeits-/Fahrzeiten, Pausen, Pauschalen, Rückmeldungs-/Fakturierungsgrad | Erfasste/freigegebene/abgerechnete Mengen getrennt, WOT-/SRM-Korrelation und Korrekturen berücksichtigen; Ticketzeiten nicht als vollständige gesetzliche Arbeitszeit behaupten |
| RPT-11 | Debitoren/Kreditoren: offene Posten, Fälligkeit, Altersstruktur, Zahlungen und Mahnungen | Tatsächlicher Stichtagsrest mit Sperren/Gegenbuchungen; Zahlungen erst nach implementiertem Ausgleich als bezahlt ausweisen, kein Umsatz aus Zahlungseingang |
| RPT-12 | Gespeicherte Varianten, Tabellen/Diagramme, berechtigter Export, Drill-down und Laufzeitkontrolle | Export entspricht exakt Filter und Rechten, CSV-Injection abwehren, Detailseiten ebenfalls prüfen; native OpenUI5-Darstellung, deutsche sichtbare Daten und lesbare Mobilansicht |

## Prüfnachweis je Bericht

Kleine isolierte fachliche Prüfdaten mit Teilmengen, mehreren Perioden/Kunden, internen und Kundenrollen sowie tatsächlichen Gegenbelegen. Beispielsweise 100EUR wirksamer Nettoumsatz und 20EUR wirksame Gutschrift ergeben 80EUR Nettoumsatz; Steuer und Zahlung verändern diesen Nettowert nicht. Derselbe Auftrag mit zwei Teillieferungen und Teilrechnungen darf nicht pro Join mehrfach zählen. Fremde Tenant-/Organisationsdaten dürfen auch Aggregat, Export und Direktaufruf nicht beeinflussen.

Echte Tabellen-/Diagrammansicht, Filterwechsel, Periodenvergleich und Navigation bis zum vorhandenen Originalbeleg im Browser prüfen. Bei großen Datenbeständen Begrenzung/Indexierung und Antwortzeiten messen. Keine abgeschlossenen Report-Labels allein aufgrund einer Kachel oder statischen Beispielgrafik. SAP-Handbuchprüfung bei jedem weiteren Fachgebiet mit konkretem Text, Version, Datum und Umsetzungsentscheidung fortführen.
