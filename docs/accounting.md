# Finanzbuchhaltung · implementierter Kern

Stand Preview 0.7. Buchungskreise, explizite Hauswährung, Konten, offene/geschlossene Perioden, Journalentwürfe, unabhängige Journalfreigabe, endgültige Buchung, Gegenbelegstorno und Summen/Salden sind implementiert. Jede Journalposition enthält Konto, Soll/Haben, exakten positiven Decimal-Betrag, Positionstext und optionale Kostenstelle. Pro Journal gilt Soll = Haben. Aktive Konten, passende Währung und offene Periode werden vor Freigabe und Buchung erneut geprüft. Keine vom System erfundenen Konten oder Steuersätze.

Gebuchte Journalinhalte und Positionen sind datenbankseitig unveränderlich. Die Buchung hält Hash, Actor und Zeit fest. Korrektur erfolgt durch eindeutig referenzierten Gegenbeleg mit Begründung und eigenem Freigabe-/Buchungsprozess. Summen/Salden lesen tatsächlich gebuchte Einträge einschließlich Gegenbuchungen; Entwürfe zählen nicht. Dezimalrechnung verhindert binäre Geldrundung.

## Integrierter Wareneingang

Konfigurierbare Ereignisregeln ordnen Kontenrollen zu. STOCK_RECEIPT benötigt Bestand (ASSET) und WE/RE-Verrechnung (LIABILITY). Der freigegebene Einkaufspreis bewertet den tatsächlichen Eingang: Bestand Soll, WE/RE Haben. Materialbewegung, private Bewertung und automatisch gebuchtes Journal sind atomar; fehlende Regeln/Periode verhindern auch den Wareneingang. Explizite Nullpreislieferungen erzeugen keine fingierten Journalbeträge.

Lageristen dürfen über den autorisierten Wareneingang ein solches Quellenjournal auslösen, aber weder freie Journale erfassen noch Kontierungsregeln ändern. Das Journal bleibt mit Serviceauftrag, Bestellung und Materialbeleg verbunden. Sein Storno wird ausschließlich vom Wareneingangsstorno ausgelöst und verwendet die Originalkonten und Originalwerte. Ein isoliertes FI-Storno dieses Quellenjournals ist gesperrt.

## Noch nicht implementiert

Debitoren-/Kreditorenrechnungen, Steuerbuchung aus Rechnung, OP, Zahlung/Ausgleich, Teil-/Überzahlung, vollständige Kostenrechnung, Materialverbrauchsbuchung, Kontoblatt, Bilanz/GuV/BWA, DATEV und E-Rechnungen sind offen. Konfigurierbare Kontenrollen allein belegen keine fertigen Rechnungs-/Steuerprozesse. Ein technischer Hash ersetzt kein geeignetes Archiv. Kontenrahmen, Steuerregeln, Währungen, Rundung und Exporte benötigen fachliche Abnahme vor Produktivbetrieb.
