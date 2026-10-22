# Verbindliche Ergänzung · Lager, Auslieferung, PDF-Anlagen und Nummern

Nutzerpräzisierung vom 22.10.2026. Ergänzt den vollständigen Masterprompt und [Materialversorgung](material-fulfillment.md); keine Behauptung bereits fertiggestellter Funktionen.

## Wareneingang und Auslieferung

Wareneingang braucht ausdrücklich editierbare tatsächliche Eingangsmengen je Position. Teil- und Restlieferungen über mehrere Materialbelege sind erlaubt; bestellte, bisher erhaltene, aktuelle und verbleibende Mengen bleiben sichtbar. Storno erfolgt nachvollziehbar durch Gegenbewegung. Keine automatische Vollmengenannahme als einziger Bedienweg.

Ausliefern vom Serviceauftrag bucht Lagerartikel tatsächlich auf dessen genehmigte Positionen aus. Auftrag, Ticket/WOT, Materialbeleg, Bewertung/Kosten und automatisch erzeugte korrelierte SRM müssen zusammenpassen. Teilentnahmen, Serien-/Chargen-/Lagerplatzbezug, Restmengen, unabhängige Leistungsfreigabe und Belegfluss erhalten. Auslieferung/Warenausgang müssen rückgängig gemacht werden können; freigegebene/fakturierte Folgebelege benötigen kontrollierten Korrekturprozess, keine stille Bestands- oder SRM-Änderung.

## Anlagenlisten in allen Vorgängen

Ein kleines modales Fenster aus OpenUI5-Standardcontrols zeigt die PDF-Dateien zum jeweiligen Vorgang: insbesondere Bestellungen, Lieferscheine, Fakturen und weitere Geschäftsdokumente im Businessformat. Anzeige, Download, Herkunft, Erzeugungszeit/Version und Berechtigung bleiben am Vorgang gebunden. Ausgegebene Dokumente benötigen unveränderliche archivierte Inhalte; weder leere Platzhalterdateien noch aus aktuellen Stammdaten rückwirkend verfälschte PDF-Ausgaben. Externe PDF-Anlagen brauchen begrenzte/validierte Annahme, geschützte Speicherung und geprüften Download. Kein eingebauter Fremd-HTML-Viewer oder eigenes UI-Control.

## Physische Lagerstruktur und Scans

Werke/Lagerorte um Lagerbereiche, Gänge/Regale/Ebenen/Fächer bzw. eindeutig codierte Lagerplätze erweitern. Regale müssen anhand dieser Struktur tatsächlich eingerichtet werden können. Einlagerungs-/Lagerplatzlabels, druckbare Kennzeichnung und eindeutige scanbare Identität; Artikel, Seriennummer, Charge und Lagerplatz fachlich unterscheiden. Scan-Eingabe muss per Tastaturscanner funktionieren; Kamera nur über unterstützte Browserfunktionen mit nativer UI5-Bedienung und tatsächlich geprüftem Format. Keine ungeprüfte Scan-Erfolgsmeldung.

Einlagerung, Platzwechsel/Umlagerung, auftragsbezogene Kommissionierung/Auslieferung, Rücknahme und Inventur brauchen Bewegungsnachweise, Mengensperren und Gegenbewegungen. Lagerplatzkapazitäten/-sperren und unzulässige Vermischung nicht durch freie Textänderung umgehen.

## Nummernkreise

Format `KÜRZEL-########`, beispielsweise `RE-45000001`. Mandantenbezogen, fortlaufend und ohne Jahresrücksetzung; jedes Kürzel besitzt seinen fest definierten inklusiven Bereich. Zuteilung atomar mit Fachbeleg, keine Wiedervergabe bereits festgeschriebener Nummern, verständliche Bereichserschöpfung. Bestehende Geschäftsbelegnummern werden nicht rückwirkend umgeschrieben. Nummernkreisverwaltung zeigt Bereich, aktuellen/folgenden Wert, Verbrauch und Status; Änderungen nur autorisiert, versioniert und auditierbar. Noch fehlende Fachmodule werden durch ihren reservierten Nummernkreis nicht als implementiert ausgewiesen.

| Kürzel | Bereich | Von | Bis |
|---|---|---:|---:|
| KD | Kunden | 10000000 | 10999999 |
| IN | Interessenten | 11000000 | 11999999 |
| AP | Ansprechpartner | 12000000 | 12999999 |
| GP | Geschäftspartner | 13000000 | 13999999 |
| LF | Lieferanten | 20000000 | 20999999 |
| MA | Mitarbeiter | 21000000 | 21999999 |
| ST | Standorte | 22000000 | 22999999 |
| KO | Kostenstellen | 23000000 | 23999999 |
| HW | Hardware | 30000000 | 30999999 |
| SW | Software | 31000000 | 31999999 |
| DL | Dienstleistungen | 32000000 | 32999999 |
| LI | Lizenzen | 33000000 | 33999999 |
| ER | Ersatzteile | 34000000 | 34999999 |
| ZU | Zubehör | 35000000 | 35999999 |
| AS | IT-Assets | 36000000 | 36999999 |
| SE | Seriennummern-Datensätze | 37000000 | 37999999 |
| AN | Kundenanfragen | 40000000 | 40999999 |
| AG | Angebote | 41000000 | 41999999 |
| AU | Kundenaufträge | 42000000 | 42999999 |
| AB | Auftragsbestätigungen | 43000000 | 43999999 |
| LS | Lieferscheine | 44000000 | 44999999 |
| RE | Rechnungen | 45000000 | 45999999 |
| GU | Gutschriften/Rechnungskorrekturen | 46000000 | 46999999 |
| RT | Retouren | 47000000 | 47999999 |
| RK | Reklamationen | 48000000 | 48999999 |
| RP | Reparaturaufträge | 49000000 | 49999999 |
| BA | Bestellanforderungen | 50000000 | 50999999 |
| LA | Lieferantenanfragen | 51000000 | 51999999 |
| BE | Bestellungen | 52000000 | 52999999 |
| WE | Wareneingänge | 53000000 | 53999999 |
| WA | Warenausgänge | 54000000 | 54999999 |
| UL | Umlagerungen | 55000000 | 55999999 |
| IV | Inventuren | 56000000 | 56999999 |
| LK | Lagerkorrekturen | 57000000 | 57999999 |
| LR | Lieferantenretouren | 58000000 | 58999999 |
| EG | Eingangsrechnungen (interne ID) | 59000000 | 59999999 |
| TI | Supporttickets | 60000000 | 60999999 |
| SA | Serviceaufträge | 61000000 | 61999999 |
| TE | Technikereinsätze | 62000000 | 62999999 |
| WT | Wartungsaufträge | 63000000 | 63999999 |
| IS | Installationen | 64000000 | 64999999 |
| SM | Störungsmeldungen | 65000000 | 65999999 |
| CH | Änderungsaufträge | 66000000 | 66999999 |
| FW | Fernwartungen | 67000000 | 67999999 |
| RM | RMA-Vorgänge | 68000000 | 68999999 |
| SI | Sicherheitsvorfälle | 69000000 | 69999999 |
| KV | Kundenverträge | 70000000 | 70999999 |
| WV | Wartungsverträge | 71000000 | 71999999 |
| MV | Managed-Service-Verträge | 72000000 | 72999999 |
| LV | Lizenzverträge | 73000000 | 73999999 |
| HV | Hostingverträge | 74000000 | 74999999 |
| AV | Abonnements | 75000000 | 75999999 |
| PJ | Projekte | 76000000 | 76999999 |
| PA | Projektaufgaben | 77000000 | 77999999 |
| TN | Tätigkeitsnachweise | 78000000 | 78999999 |
| ZT | Zeiterfassungen | 79000000 | 79999999 |
| BU | Buchungsbelege | 80000000 | 80999999 |
| ZE | Zahlungseingänge | 81000000 | 81999999 |
| ZA | Zahlungsausgänge | 82000000 | 82999999 |
| MH | Mahnungen | 83000000 | 83999999 |
| KB | Kassenbelege | 84000000 | 84999999 |
| RS | Reisekosten | 85000000 | 85999999 |
| FR | Freigaben | 86000000 | 86999999 |
| DO | Dokumente | 87000000 | 87999999 |
| PR | Prüfprotokolle | 88000000 | 88999999 |
| SB | Stornobelege | 89000000 | 89999999 |

Abnahme: Bereichsgrenzen/letzte Nummer, konkurrierende Zuteilung, Transaktionsrollback, Mandantentrennung, gesperrter Nummernkreis, fehlende Rechte und Schutz alter Nummern. Nicht ausdrücklich zugeordnete interne technische Belege (z. B. Servicefall/WOT) erhalten keine fachlich falsche Zuordnung zu einer fremden Kategorie.
