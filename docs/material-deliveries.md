# Auslieferung und tatsächlicher Materialverbrauch · Preview 0.9

Der Einstieg liegt am freigegebenen/laufenden Serviceauftrag. Eine offene, diesem Auftrag zugeordnete Work Order Task aus dem Ticket ist erforderlich. Technik kann auf eigene Aufgaben ausliefern; Lager kann Material auf eine vorhandene technische Aufgabe des autorisierten Auftrags buchen. Das Ticket bleibt der Hauptbeleg für Arbeits-/Fahrzeit, Pauschalen und Aufgabenabschluss.

## Ausliefern

„Ausliefern“ zeigt die konkreten offenen Reservierungen mit Auftragsposition, Artikel, Werk/Lagerort, Charge/Seriennummer und editierbarer tatsächlicher Menge. Teilmengen und weitere Auslieferungen sind möglich. Die eingegebene Menge darf die noch offene Reservierung nicht überschreiten. Buchungsperiode/-datum, Belegdatum, Aufgabe und Auslieferungstext werden geprüft. Fehlende Aufgaben und Konfiguration werden erklärt; freie Kosten-/Wertangaben werden nicht übernommen.

Die Buchung erzeugt WA-Materialbeleg und LS-Lieferscheinnummer, reduziert physischen Bestand und offene Reservierung, führt die Verbrauchsmenge fort und bucht die gleitende Bewertung ab. Menge und Kosten gehören zur genehmigten Auftragsposition; ursprüngliche Ticket-Korrelation und verantwortlicher Techniker bleiben erhalten. Alle Effekte einschließlich FI, Belegfluss, Audit und Idempotenzantwort sind atomar.

Kosten = aktuelle Buchungskreis-/Artikelbewertung proportional zur entnommenen Menge. Der letzte Abgang nimmt den exakten Restwert mit; es bleiben keine Geldreste bei Nullbestand. PostgreSQL prüft die Bewertung unabhängig von der Serviceberechnung. STOCK_ISSUE benötigt Materialaufwand (EXPENSE) im Soll und das historische Bestandskonto (ASSET) im Haben. Unterschiedliche Bestandskonten werden nicht still vermischt. Bei explizit wertfreiem Bestand gibt es eine physische Bewegung ohne fingiertes Geldjournal.

Istkosten behalten die Buchungskreiswährung, auch bei abweichender Verkaufswährung des Auftrags. Das ist keine automatische Währungsumrechnung für Profitabilitätsberichte. Nicht erhaltene Beschaffung, offene Reservierung und bereits verbrauchte Menge decken jeweils ihren Anteil; verbrauchte Teile lösen keine weitere BANF aus. Vollständig ausgelieferte Positionen erhalten einen eigenen Versorgungsstatus.

## Rücknahme

Eine Rücknahme ist ein vollständiger Gegenbeleg zur ausgewählten Auslieferung. Mehrere Teilauslieferungen bleiben einzeln rücknehmbar. Grund, offene Periode und technische Ausführbarkeit sind erforderlich. Menge und Originalwert werden zurückgeführt; offene Reservierung wird wiederhergestellt, soweit sie nicht zuvor ausdrücklich freigegeben wurde. Dann kommt die Menge frei zurück. Original bleibt unverändert; eine zweite Rücknahme desselben Ursprungs ist gesperrt.

Die Finanzgegenbuchung verwendet die ursprünglichen Konten, Werte und Kontierungsmerkmale, auch nach geänderter Kontierungsregel. Die Datenbank vergleicht die vollständig gruppierten Material- und Journalpositionen mit dem Ursprung. Ein separates Storno des automatischen FI-Belegs ist gesperrt.

Eine aktive SRM oder abgeschlossene Aufgabe sperrt die unmittelbare Materialrücknahme. Ein eigener SRM-Entwurf kann begründet verworfen werden; die Aufgabe öffnet wieder. Abgelehnte Nachweise bleiben erhalten und ermöglichen einen korrigierten Abschluss. Freigegebene/fakturierte SRM benötigen einen weitergehenden Korrektur-/Gutschriftprozess, der noch nicht implementiert ist. Diese Grenze wird nicht durch Änderung alter Istbelege umgangen.

## Ticket → WOT → SRM

Beim Aufgabenabschluss sammelt das System die tatsächlichen Ticketzeiten/Pauschalen und die wirksamen, noch nicht anderweitig aktiv rückgemeldeten Materialausgaben dieser Aufgabe. Rückgenommene Ausgaben zählen nicht. Die SRM entsteht automatisch mit unveränderter Ticket-Korrelations-ID. Mengen, Materialkosten/-währung, Auftragskontierung und Auslieferungsherkunft werden als Snapshot übernommen. Es gibt keine zweite freie Material-/Zeitkopie im Auftrag.

SRM-Positionen dürfen weder nachträglich verändert noch an freigegebene Nachweise angehängt werden. PostgreSQL prüft jede Istquelle gegen Aufgabe, Ticket, Auftrag, Artikelposition, Menge und bei Material Kosten/Korrelation. Ein korrigierter Nachweis nach Entwurfsverwerfen verwendet noch wirksame Ausgaben erneut als Nachweis und bucht keinen zweiten Verbrauch. Kundenprojektionen enthalten keine internen Materialkosten und keinen Beschaffungs-/Finanzzugriff.

Kundenbestätigung und unabhängige Servicefreigabe schließen den Nachweis ab. Technischer Abschluss verlangt die abgeschlossene Nachweiskette. Für Lagerpositionen verlangt die Endrückmeldung aktuell die vollständige Auslieferung der genehmigten Menge; Mengenänderung freigegebener Positionen ist ein noch offener Änderungsprozess. Fakturabereitschaft erzeugt keine Rechnung.

## Nachgewiesenes Mengenszenario

WE6 zu Preis40 und WE4 zu Preis60 → Bestand10/Wert480. Teil-Auslieferung2 → Bestand8/Wert384, offener Reservierungsanteil8, Verbrauch2/Wert96. Rücknahme → Bestand10/Wert480 und Reservierung10. Vollständige Auslieferung10 → Bestand0/Wert0 und Verbrauch10. Ticketzeit plus Material → korrelierte End-SRM → Kunde → unabhängige Freigabe → technischer Abschluss/Fakturabereitschaft. Zusätzlicher API-Fall prüft gleichzeitige Berichtskorrektur/Rücknahme und erneute Ausgabe ohne Doppelverbrauch.

## Folgender Ausbau

PDF-Ausgabe und kleine Anlagenlisten, physische Lagerplätze/Regale, Labels/Scanner, Inventur/Umlagerung, Nichtlager-/Fremdleistungsabnahme, Faktura und Korrekturen nach freigegebener/fakturierter SRM bleiben weitere Anforderungen. Die LS-Nummer ist bereits der Auslieferung zugeordnet; ein archivierter PDF-Lieferschein wird in 0.9 noch nicht vorgetäuscht.
