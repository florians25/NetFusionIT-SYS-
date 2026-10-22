# Geschäftliche Nummernkreise · Preview 0.8

Die vollständigen 66 festen Bereiche stehen in der [Nutzervorgabe](requirements/warehouse-delivery-attachments.md). Format `KÜRZEL-########`, mandantenbezogen, ohne Jahresrücksetzung. Unter Administration → Nummernkreise werden Bereichsgrenzen, Zählerstand, nächste Nummer, belegte/verfügbare Werte und Sperrstatus angezeigt. Beide Bereichsgrenzen sind zulässig. Die erste Vergabe beginnt am unteren Grenzwert; `RE-45000001` ist beispielsweise eine gültige Rechnungsnummer.

Die Zuteilung erfolgt in der Transaktion des Fachbelegs. Zeilensperre/UPDATE, Version und RLS verhindern Konkurrenz, fremde Mandantenzugriffe und rückwärtige Zähleränderung. Ein Fehler bei Beleganlage rollt auch die Nummer zurück. Festgeschriebene Nummern werden nicht wiedervergeben; eine Verwaltungs-Vorwärtssetzung überspringt Werte dauerhaft und benötigt Begründung und Audit. „Belegt“ enthält solche reservierten/übersprungenen Werte und ist keine Anzahl erzeugter Geschäftsbelege. Gesperrte oder erschöpfte Reihen verweigern die Anlage verständlich.

| Implementierter Vorgang | Nummernkreis |
|---|---|
| Neuer Kunde / Lieferant | KD / LF |
| Neuer interner Benutzer / Ansprechpartner | MA / AP |
| Serviceleistung / Software / Lizenz | DL / SW / LI |
| Lager-/Nichtlagerartikel | ER; explizit HW oder ZU wählbar |
| Technisches Objekt | AS |
| Ticket / Einsatz | TI / TE |
| Serviceauftrag / Wartungsauftrag / Reparaturauftrag | SA / WT / RP |
| Managed-Service-Vertrag / Wartungsvertrag / sonstiger Basisvertrag | MV / WV / KV |
| BANF / Bestellung / Wareneingang | BA / BE / WE |
| SRM als Tätigkeitsnachweis / Ticketzeit | TN / ZT |
| Journalentwurf / gebuchtes Journal / gebuchter Storno | DO / BU / SB |
| Wareneingangsstorno | SB |

Artikelnummern sind vom frei gepflegten SKU/externen Artikelschlüssel getrennt. Die bei Artikelanlage gewählte Gruppe muss zur Artikelart passen. Der Artikelkatalog zeigt beide Kennungen. Nummerngruppen für spätere Module sind reserviert, erzeugen aber keine vermeintlich vorhandenen Rechnungen, Lieferungen oder Projekte.

Bestehende Geschäftsbelegnummern bleiben erhalten. Interne technische Belege ohne ausdrücklich passende fachliche Nutzergruppe, insbesondere Servicefall, Work Order Task und technischer Materialbedarf, behalten vorerst ihre bisherigen technischen Nummern. Eine Zuordnung einer WOT zu einem fachfremden Projektaufgabenbereich wird nicht behauptet.
