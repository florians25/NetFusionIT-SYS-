# Deutsche Datumsformate und Ticketreferenzen auf Service-Rechnungen

Nutzersteuerung22.10.2026: Backlog vollständig weiterbearbeiten, keine weitere Rückfrage pro Phase. Sichtbare Datumswerte als `TT.MM.JJJJ`; Datum/Zeit mit deutscher Tages-/Monatsreihenfolge. Maschinenformate in API, Datenbank und normiertem CII-XML bleiben unverändert.

Leistungsbeginn=Leistungsende wird als ein Datum ausgegeben, z.B. `Leistung: 01.02.2020`. Kurzer Zeitraum z.B. `01.02.2020 – 03.02.2020` möglichst in einer Zeile; keine wiederholten langen Beschriftungen je Datum. Breite/Umbruch werden an real gerenderten PDF-Wörtern geprüft. Auf mobilen Tabellen erhalten Beschreibung und Leistungszeitraum ausreichend Raum; native Pop-ins statt abgeschnittener Information.

Bei einer Rechnung aus Serviceauftrag werden die **tatsächlich abgerechneten** Ticketnummern aus den freigegebenen SRM-Quellen bestimmt, pro Rechnungsposition und im eingefrorenen Rechnungskopf gespeichert und im PDF sowie als Rechnungsnotiz im CII ausgegeben. Festpreise berücksichtigen alle zugehörigen genehmigten Istnachweise. Nicht pauschal sämtliche Tickets des Kunden/Falls oder nur das zuerst gefundene Ticket drucken. Keine frei eingegebene Ersatzreferenz. Kunde/Organisation/Quellenprüfung bleibt erhalten; ein Ticket erhält dadurch keinen eigenen Belegfluss-Tab.

Alte archivierte Rechnungen behalten ihre Bytes und ihren damaligen Stand. Neue Stammdaten-/Ticketänderungen schreiben keine gebuchten Rechnungen um. Bestehende noch nicht fakturierte Anforderungen können ihre Ticketreferenz direkt aus der tatsächlichen Quelle ermitteln. Migration014 prüft die neue Referenzzuordnung beim Versiegeln; Migrationen001–013 bleiben unverändert.
