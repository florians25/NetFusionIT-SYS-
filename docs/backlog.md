# Fachlicher Backlog

Stand: 23.10.2026. Der vollständige [Masterprompt](master-prompt.md) bleibt der Grundauftrag. Die folgenden Ergänzungen wurden zusätzlich vom Nutzer beauftragt. Sie sind Anforderungen, keine Behauptung bereits implementierter Funktionen. Oberflächen bestehen ausschließlich aus Standardcontrols von **OpenUI5**. [Verbindliche Navigations-/Maskenvorgaben](requirements/navigation.md): App-Zentrale als Einstieg, keine globalen App-Tabreiter und native Belegobjektseiten mit fachlichen Abschnitten. SAP-Dokumentation dient als fachliche Referenz; SAP-Backend-Dienste oder SAPUI5-exklusive Controls werden dadurch nicht vorausgesetzt.

[Vollständiger Modulindex mit vorhandener Teilbasis und offenen Prozesslücken](master-backlog-index.md).

## Umfang und aktueller Lieferstand

Der Masterprompt umfasst alle darin genannten Module; diese Ergänzungsliste ist keine vollständige Liste bereits gelieferter Funktionen. Ein Grundstamm, eine Tabellenmaske oder ein reservierter Nummernkreis erledigt keinen End-to-End-Prozess. Die jüngste [detaillierte SD-/Faktura-/CRM-Aufteilung](requirements/sales-billing-crm.md) enthält 17 Sales-Order-Abläufe, 10 Faktura- und 10 CRM-Arbeitspakete mit Abnahmekriterien. Preview0.18 liefert den eigenen AU mit unabhängiger Freigabe, AB und gebundener SA-Ausführung. Die vollständige SD-Abdeckung bleibt offen. Die eigenständige Angebotsbasis mit Kundenoriginal, selektiver Entscheidung und gebundener Übernahme ist in Preview0.19 geliefert; weitere Angebotsprozesse bleiben offen. Neu beauftragt sind [eigenständiger Direktvertrieb ohne Ticket/SA](requirements/direct-sales.md) und [ausführliche Statistik-/Berichtsfunktionen](requirements/reporting.md). Den tatsächlichen Restumfang und die aktuelle Reihenfolge zeigt der [Masterbacklog](master-backlog-index.md); frühere Versionsabschnitte unten dokumentieren jeweils ihren historischen Teilstand.

## Preview0.25 · aktuelle Masken- und Dokumentkorrektur

Umfangreiche Bearbeitungen öffnen größere native Arbeitsseiten; Positionsdetails, Mehrzeilenbelege und Journalentwürfe sind darunter. Desktop-Positionsraster und mobile Pop-ins verwenden ausschließlich OpenUI5. Benutzer- und Kontaktpflege führen explizite Vor-/Nachnamen. Eigene Dokumenteinstellungen pflegen den tatsächlichen Ansprechpartner je Buchungskreis. **Letzte Nutzervorgabe:** keine zusätzliche Infobox und keine Anschriftentabelle; der vollständige Name als Vertriebsmitarbeiter im reduzierten Kopf rechts oben, nur wesentliche Belegdaten. Alte Archivbytes und wartende historische Rechnungsausgaben bleiben erhalten. [Umfang, Altbestände und Grenzen](requirements/workspaces-document-contacts.md), [aktuelle Vorschau](previews/v0.25.0-preview.1/README.md). Geschäftsbereich, Profitcenter und die übrigen offenen Modulprozesse sind dadurch nicht erledigt.

## SERVICE-01 · Serviceangebote

Status: Teilbasis in Preview0.19 · eigene Service-Kostenvoranschläge und getrennte Verkaufsangebote, Konditionen/Partner/Einteilungen, unabhängige Prüfung, Kunden-PDF, selektive Entscheidung und gebundene AG→AU-Übernahme einschließlich eigener Prüfung und nativer UI-Abnahme umgesetzt. Servicefolge bis tatsächliche SRM/Faktura/valide Rechnung geprüft. Weitere Vertrags-/Kredit-/Vorlagen-/Änderungs- und Versandfunktionen sowie direkte AU-Warenausführung bleiben offen. Umsetzung zusammen mit Masterprompt-Phase4 und7.
Quelle: [vollständiger Nutzeranhang](requirements/serviceangebote.md).

- Suchbare Liste, Filter, Kopf-/Positionspflege; Standardangebot mit verbrauchsabhängigen und festen Preisen sowie reines Festpreisangebot.
- Serviceprodukte, Ersatzteile, Ausgaben, Servicepakete mit Hierarchie und zuständige Servicegruppen.
- Vertragsfindung nach expliziten Auswahlkriterien; vereinbarte Preise und SLA als nachvollziehbarer Snapshot in Angebot und Folgeauftrag. Gemäß Referenz dürfen Festpreisangebote SVQ2 nicht mit Verträgen verknüpft werden; die Regel ist als konfigurierbare Vorgangsart abzubilden.
- Kundenausgabe, Annahme, Teilannahme, Ablehnung, Prüfung/Änderung und erneute Ausgabe. Ein angenommenes Angebot erzeugt genau einen passenden Folgeauftrag für die angenommenen Positionen; abgelehnte Positionen werden nicht beauftragt.
- Anpassungsangebot für zusätzliche Leistungen; ursprüngliche akzeptierte Positionen und Preise bleiben erhalten. Versionen, Änderungsnachweis, idempotente Umwandlung und Belegfluss.
- Kreditprüfung/-simulation nach aktivierter Regel und vorhandenem Regulierer/Kreditsegment. Angebotssimulation verändert kein Obligo und sperrt das Angebot nicht; tatsächliche Auftragsprüfung ist separat.
- PDF/Druck, E-Mail und externer Ausgabekanal mit Ausgabestatus und Wiederholung; Dateien/URL-Anlagen mit Zugriffsschutz und Prüfung. Angebotsanlagen werden nicht automatisch in Folgeaufträge kopiert.
- Konfigurierbare Absagegründe/-profile an Kopf und Position; keine stillen Änderungen angenommener Vorgänge.

Abnahme: Standard-/Festpreisregeln, Teilannahme und mehrfach parallel ausgelöste Auftragserstellung testen; Angebot → Auftrag bleibt einschließlich Vertrags-/Preis-/SLA-Snapshot nachvollziehbar. Kunden sehen ausschließlich eigene Angebote. Nicht konfigurierte Kredit-/Versanddienste melden einen offenen Konfigurationsbedarf statt Erfolg zu simulieren.

[Verbindliche Ticket-/WOT-/SRM- und Beschaffungspräzisierung](requirements/ticket-execution.md).

## SERVICE-02 · Serviceaufträge und Servicerückmeldungen

Status: Auftragsanlage, Positionen, Preisfindung, Freigabe, Ticketaufgaben, Arbeits-/Fahrzeiten/Pauschalen, Timer, automatische SRM beim Aufgabenabschluss mit Ticket-Korrelation, Teil-/Endrückmeldungen, Kundenbestätigung und technischer Abschluss implementiert; auftragsbezogener Materialbedarf, BANF und Teilbestellungen mit Lieferanten-/Beschaffungsfreigabe implementiert; automatischer Artikelbedarf, Fehlmengen-BANF, Lagerreservierung, bewerteter Teil-Wareneingang/Storno und Quellen-FI implementiert; tatsächliche Auslieferung/Materialverbrauch/Rücknahme mit Quellen-FI und automatischer WOT/SRM-Übergabe implementiert; weitere Positionstypen, erweiterte Faktura-/Steuerfälle und vollständige FI/CO-Integration offen · Masterprompt-Phase 4–8.
Quelle: [vollständiger Nutzeranhang](requirements/serviceauftraege.md); alle darin enthaltenen Details gelten zusätzlich zur Kurzfassung.

- Liste/Suche/Filter, Anzeigen/Anlegen/Bearbeiten; Servicegruppen, Positionen und hierarchische Servicepakete für Service, Material und Ausgaben.
- Getrennte Planungs-/Ausführungs-/Freigabestatus an Kopf und Position. Servicerückmeldung nur zu freigegebenen Aufträgen, Übernahme der relevanten Daten, Istmengen/-zeiten/-ausgaben und mehrere Rückmeldungen pro Auftrag.
- Abschluss verlangt abgeschlossene Rückmeldungen und eine Endrückmeldung. Fakturafreigabe erfolgt regelgerecht aus abgeschlossenen Aufträgen/Positionen; Teilfakturierung bleibt positions- und rückmeldungsbezogen.
- Ad-hoc-Fakturierungsplan für Festpreise mit Terminen und Beträgen, konsistente Summe zum vereinbarten Preis; jede Fälligkeit erzeugt ihre Fakturaanforderung genau einmal. Konfiguration für Zusammenfassung mehrerer Anforderungen in einer Rechnung.
- Partnerfindung aus Stammdaten, Organisation und Vorgängern über konfigurierbare Zugriffsfolgen, einschließlich Alternativvorschlag und Neufindung leerer Funktionen.
- Profitcenter-Findung und optionale PSP-/Ergebnisobjektzuordnung. Profitcenter bleiben nach erledigter/stornierter Rückmeldung geschützt.
- Anlagen/URLs, Kreditprüfung, Preisfindung, Auftragsänderung/Storno und die weiteren Funktionen des Originalanhangs vollständig berücksichtigen.
- Anlagen an Auftragskopf, Auftragsposition und Rückmeldungsposition. Buchungskreisübergreifende Faktura/Kosten/Abrechnung für Service- und Ausgabenpositionen mit Sperre/Erlaubtliste je Sender-/Empfängerbuchungskreis; Ersatzteilpositionen sind gemäß Referenz ausgeschlossen. Berechnungsmotive wie Kulanz/Garantie steuern konfigurierte Kalkulationsschemata und Skontosätze.
- Integration mit Serviceverträgen, Reservierung/Verbrauch, Beschaffung externer Leistungen/Nichtlagerteile, Faktura, Finanzwesen und Controlling; alle Folgebelege im Belegfluss.

Abnahme: Plan → Freigabe → mehrere Rückmeldungen → Endrückmeldung → Teil-/Endfaktura; fehlende Freigaben, doppelte Fakturaanforderungen, falsche Organisations-/Kundenbezüge und Änderungen gesperrter Werte werden serverseitig verhindert. Buchungen müssen ausgeglichen und auf Ursprungspositionen rückführbar sein.

## SERVICE-03 · Wiederverwendbare Service-/Reparaturauftragsvorlagen

Status: offen · Voraussetzung für SERVICE-04 und Wartungsautomatik.
Quelle: [vollständiger Nutzeranhang samt Positionstypmatrix](requirements/auftragsvorlagen.md).

- Standard- und Festpreisvorlagen für Service- und Reparaturaufträge (SVT1/SVT2/RPT1/RPT2 als Referenztypen); Service, Lager-/Nichtlagerersatzteil, externe Leistung, Ausgaben, Pakete und nicht fakturierbare Positionen gemäß Matrix.
- Lifecycle Offen → In Bearbeitung → Freigegeben → Erledigt, Rollen und Versionsschutz. Festpreisvorlagen enthalten ausschließlich erlaubte Festpreispositionen; externe Standard-Serviceposition STW2 ist laut Referenz nur bei Reparaturvorlagen zulässig.
- Alle oder ausgewählte Positionen nach Angebot, Service- oder Reparaturauftrag übernehmen. Vorlagenversion und Herkunft auch über Angebot → Auftrag erhalten; keine Ist-Ausführungsdaten in Vorlagen.
- Wiederverwendbare/vorgangsübergreifende Notizen und geschützte Anlagen/URLs.
- Wartungsplan je technischem Objekt mit Terminen/Umfang und Vorlage; fällige Folgeaufträge idempotent erzeugen.

Abnahme: Positionstypmatrix je Vorgangsart, selektives Kopieren, Herkunftsnachweis, gesperrte abgeschlossene Vorlagen und doppelte Wartungsaufrufe testen.

## SERVICE-04 · In-House Repair / Werkstattreparatur

Status: offen · zusätzliche Anforderung aus Nutzernachricht vom 22.10.2026.

- Werkstattreparatur mit mehreren einzeln verfolgten Reparaturobjekten, Seriennummern, Kunden-/Vertragsbezug und Status-/Entscheidungshistorie.
- Kundenretoure anstoßen oder aus Retourenposition eine Werkstattreparatur erzeugen; physischer Wareneingang und Eigentum des Kunden bleiben nachvollziehbar.
- Vorprüfung je Objekt mit dokumentierter Folgeentscheidung: Diagnose, Angebot, Reparatur, Rücksendung oder Absage.
- Diagnose planen und Mitarbeiter zuordnen; Diagnoseauftrag aus Vorlage/Objekt erzeugen; Leistungen, Ersatzteile und Ausgaben in Reparaturrückmeldungen als Istverbrauch erfassen.
- Reparaturangebot erstellen/ausgeben; Kundenannahme/-ablehnung und Änderungen dokumentieren. Reparatur erst nach erforderlicher Annahme/Freigabe einplanen.
- Reparaturauftrag planen, Mitarbeiter zuordnen, ausführen und rückmelden. Diagnose und Reparatur bleiben getrennt abrechenbar und miteinander verknüpft.
- Lagerersatzteile auf Verfügbarkeit prüfen (auch Simulation), passende Mengen reservieren; Nichtlagerteile und externe Serviceanbieter über BANF/Bestellung beschaffen.
- Vertrags-/Positionsfindung anhand expliziter Kriterien; Garantie/Deckung, Preis und SLA nachvollziehbar übernehmen.
- Fakturierung für Diagnose/Reparatur vorbereiten und anstoßen; Kosten/Erlöse über Finance und Controlling buchen. Kreditprüfung am zugeordneten Regulierer nach Regel, Ergebnisse nachvollziehbar halten.
- Auslieferung/Rücksendung zum Kunden mit Objekt-, Mengen-, Versand- und Belegbezug; Kundenobjekte nicht als eigenen frei verfügbaren Bestand behandeln.

Abhängigkeiten: SERVICE-01/02/03/05, Retouren/Auslieferung, Einkauf, Bestandsführung, Kreditmanagement, Faktura, Finance. Referenz: SAP S/4HANA Cloud Public Edition, In-House Repair und verlinkte Prozesse, Version 2608.500 (Nutzerquelle).

Abnahme: Retoure → Vorprüfung → Diagnose → Angebot → Annahme → Reparatur inkl. Fremdbeschaffung → Rückmeldung → Faktura → Rücksendung vollständig je Objekt nachvollziehen; Ablehnung, Garantie, Teilrücksendung, fehlendes Material und wiederholte Folgebeleganforderung prüfen. Keine doppelte Berechnung von Diagnose-/Reparaturpositionen.

## SERVICE-05 · Erweitertes Service Contract Management

Status: Basisvertrag und SLA-Zuordnung in Entwicklung; nachfolgender Umfang offen.

- Verträge per App und versionierter API übernehmen, anzeigen, ändern und freigeben. Herkunft/externen Schlüssel festhalten; spätere interne Änderungen werden gemäß Nutzerquelle nicht automatisch ins Quellsystem zurücksynchronisiert.
- Vertragsvorlagen mit wiederverwendbaren Kopf-/Positionsdaten; Folgevertrag mit Herkunft und Vorlagenversion.
- Automatische Vertrags- und Positionsfindung beim Anlegen/Bearbeiten von Servicevorgängen; Treffer, Kriterien, Mehrdeutigkeiten und manuelle Auswahl dokumentieren.
- Vertragspositionen, Preisvereinbarungen, gültigkeitsabhängige Preisanpassungen, Deckungs-/Kontingentregeln und SLA konsistent verwenden.
- Periodische Fakturierungspläne und automatische Fakturaanforderungen; Fälligkeit, Verlängerung, Laufprotokolle, Fehler und sichere Wiederholung nachvollziehen.
- Konfigurierbare Kreditprüfung beim Speichern am Regulierer mit Ergebnishistorie; Integration in Auftragsabwicklung, Faktura, Pricing, Controlling und Rechnungswesen.

Abnahme: Import mit erneutem externem Schlüssel, interne Änderung ohne Rücksynchronisation, versioniertes Kopieren, mehrdeutige Vertragsfindung, Preisanpassung zum Stichtag und wiederholter periodischer Abrechnungslauf testen. Keine automatische Buchung oder Aktivierung unkonfigurierter kaufmännischer Regeln.

## DELIVERY-01 · Regelmäßige Preview-Versionen und Screenshots

Status: beauftragt, laufend.

- Getestete Zwischenstände auf GitHub pushen; Preview-Tag und Versionsnotizen mit konkretem Funktionsumfang, Prüfergebnissen und offenen Punkten.
- Echte Chromium-Screenshots von Desktop und Mobilgerät; ausschließlich isolierte Testbelege und Standard-OpenUI5-Controls. Bilder enthalten keine Zugangs-/Sitzungsdaten.
- Vorschauversionen sind Entwicklungsstände. Livehosting, vollständige Masterprompt-Abdeckung und Produktionsfreigabe sind davon getrennt nachzuweisen.
- GitHub-Release-Veröffentlichung/API-Zugriff ist zusätzlich zum Git-Push erforderlich. Bei fehlendem API-Zugriff bleiben Git-Tag, Quellarchiv und Versionsnotizen als prüfbarer Preview-Stand verfügbar.

Abnahme: Remote-SHA/Tag, bestandene Build-/Funktionstests, datierte Versionsnotizen und Screenshots desselben Quellstands.

## PROC-01 · Kaufmännische Führung am Serviceauftrag

Nutzerpräzisierung vom 22.10.2026, für Service unverändert verbindlich: Beschaffung und alle kostenpflichtigen Servicefolgeprozesse werden vom Serviceauftrag aus angestoßen. BANF/Bestellung/externe Leistung/Wareneingang, Kontierung, Preisfindung und Abrechnung erhalten zwingenden Auftrags-/Positionsbezug. Das Ticket bleibt technischer Arbeitsbeleg und erzeugt keine ungebundenen kostenpflichtigen Beschaffungsbelege. Siehe [verbindliche Prozessvorgabe](requirements/ticket-execution.md).

Die Ergänzung vom 23.10.2026 führt zusätzlich den **Direktvertrieb aus AU** ein: Bei reinem Warenverkauf führt der Kundenauftrag Kosten, Bedarf, Beschaffung, Lieferung und Faktura. Es gibt keine Pflicht zu Ticket, WOT, SA oder SRM. [DS-01–16 und Prozessabnahme](requirements/direct-sales.md).

## SALES-DIRECT / REPORTING · Ergänzung vom 23.10.2026

Status: beauftragt, offen. Lagerverkauf und auftragsbezogene Warenbeschaffung einschließlich Teil-WE, Teil-Auslieferung, Fakturaanforderung/Freigabe/Vorrat, ZUGFeRD, FI/OP, Gegenbewegung und Retoure erhalten einen eigenen AU-Ursprung. Nichtlager-/Lizenzverkauf und Streckengeschäft werden gesondert nachgewiesen. Die gemeinsame AU-/Lager-/Finanzbasis ersetzt keinen vollständigen Vertriebsprozess.

[Reporting RPT-01–12](requirements/reporting.md): Umsatzstatistik nach Kunde/Artikel/Zeitraum/Vertriebsbereich, Auftragseingang/-bestand, Angebotserfolg, Deckungsbeitrag, Lager/Einkauf, Servicezeiten/SLA und OP/Fälligkeit. Quellen-/Perioden-/Währungsbezug, Filter, Vorperiodenvergleich, berechtigter Export und Drill-down sind Teil der Abnahme. SAP-Handbücher werden fachlich abgeglichen; tatsächliche Abrufe mit Datum/Version und konkreten übernommenen Regeln sind zu protokollieren. Kein behaupteter Quellenabgleich aus einem bloßen HTTP200 der Portalhülle.

## MATERIAL-01 · Automatische Versorgung und Lagerverwaltung

Status Preview 0.7: automatische Lager-/Nichtlager-/Fremdleistungsbedarfe, freie/reservierte Bestände, Fehlmengenhinweis, „Lager nutzen“/„Teile bestellen“ mit automatischer BANF-Einreichung, Positions-/Kopf-Versorgungsstatus, Werke/Lagerorte, Serien-/Chargenpflicht, bewerteter Teil-WE und Gegenbelegstorno mit atomarer FI integriert. Tatsächlicher Verbrauch mit WOT/SRM, Inventur, Umlagerung und Nichtlager-/Fremdleistungsabnahme bleiben offen. [Verbindliche Präzisierung und Recherchegrenze](requirements/material-fulfillment.md).

## WAREHOUSE-02 / DOCUMENT-01 / NUMBER-01 / UI-02

Neue Nutzerpräzisierungen: tatsächliche Teil-Eingangsmengen, auftragsbezogene Auslieferung/Warenausgang mit Storno, physische Lagerplätze mit Einlagerungslabels/Scanner, kleine PDF-Anlagenlisten in allen Vorgängen, 66 fest definierte Nummernkreise und Informationsdichte der Materialbedarfe auf allen Fachseiten. Vollständige [Vorgabe mit Nummernkreistabelle und Abnahmekriterien](requirements/warehouse-delivery-attachments.md); [Maskenvorgaben](requirements/navigation.md). Teil-WE ist ab 0.7 vorhanden; die weiteren Ergänzungen werden fortlaufend implementiert und erst nach Prüfung als geliefert markiert.

NUMBER-01 ist ab 0.8 für alle 66 reservierten Bereiche und die bereits implementierten Fachvorgänge verfügbar. UI-02 wurde für die aktuellen Facharbeitslisten, Servicefall und Administration erweitert; weitere Maskenangleichung bleibt laufend. WAREHOUSE-02/DOCUMENT-01 sind weiterhin in Umsetzung, nicht durch Nummernkreisreservierung erledigt.

WAREHOUSE-02 ab 0.9: editierbare Teil-Auslieferung zum Serviceauftrag, tatsächlicher bewerteter Abgang mit WA/LS, Originalgegenbewegung, Istmengen im Ticket und automatische Materialquelle der SRM sind implementiert. Freigegebene/fakturierte Nachweiskorrektur und physische Lagerplatz-/Label-/Scanprozesse bleiben folgende Arbeiten. PDF-Anlagenlisten sind ab0.10 umgesetzt.

WAREHOUSE-02 / Anlagen ab0.10: kleine native Dialoge an bestehenden Geschäftsbelegen, Auftragsbündelung berechtigter Folgebeleg-PDFs, unveränderliches Archiv/DO, Auftrags-/Bestell-/WE-/LS-/SRM-PDFs, interne Vorgangsblätter, geschützte Downloads und PDF-Upload-Quarantäne implementiert. Echte ClamAV-/Docker-Zielabnahme, Fakturaprozess/Rechnungs-PDFs, Positionsanlagen, vollständige Ausgabe-/Aufbewahrungs-/Löschprozesse bleiben offen. [Genaue Grenzen](attachments.md).

## SALES-01 / TICKET-UI-03 / DOCUMENT-02

Zusätzliche SAP-Muster für vollständige Kundenauftrags- und Einkaufsprozesse sowie umfangreichere Ticketbearbeitung und Nachrichtenhistorie sind unter [verbindliche Nutzerpräzisierung](requirements/business-documents.md) aufgenommen. Kein Belegfluss in der Ticketmaske; in0.10 entfernt. Eigener AU-Kundenauftrag mit Partnerrollen, Termin-/Positions-/Konditionsführung, Sperren und unabhängiger Freigabe bleibt offen. DIN-5008-Form-B-Geschäftsbrief mit SAP-orientierter Beleggliederung ist als PDF-Vorlagenstand2 in0.10 implementiert; unabhängige vollständige Norm-/Pflichtangabenabnahme steht aus.

## SD / BILL / CRM · Vertiefter Ausbau nach Nutzermustern

Verbindliche zusätzliche [Prozess- und Maskenanforderungen](requirements/sales-billing-crm.md). Fakturapositionen werden ausdrücklich als eigenständige Fakturaanforderungen freigegeben; nur deren freigegebene offene Mengen gelangen in den Fakturavorrat. Leistungserbringungsdatum/-zeitraum, ZUGFeRD mit tatsächlichem Validierungsnachweis und ein CRM-/Geschäftspartnerstamm mit Ansprechpartnerrollen sowie getrennten Debitoren-/Kreditorendaten je Buchungskreis sind beauftragt. Der geplante Umfang reicht deutlich über die bisherigen Grundmasken hinaus.

## LEG-00–10 / AP-01–12 / DOC-BAR-01 · Recht, Eingangsrechnungen und Belegbarcodes

Nutzerergänzung22.10.2026: [Originalauftrag](requirements/compliance-user-prompt.md), [Compliance-Matrix, Risiken, Prioritäten und offene Rechtsfragen](compliance-gap-analysis.md), [zwölf konkrete Eingangsrechnungsabläufe und Barcode-Abnahme](requirements/incoming-invoices-barcodes.md).

Die rechtliche Prüfung ergänzt bestehende Anforderungen um notwendige Kontroll-/Nachweislücken. Rechtsgrundlagen/Übergangsfristen sind wegen blockierter amtlicher Quellen **zum gewünschten Stichtag nicht abschließend verifiziert**. Keine GoBD-Zertifizierung oder Produktivfreigabe. Eingangsrechnungen brauchen unveränderte Originale, UBL/CII-/Hybridannahme, externe Lieferantennummer plus interne EG-ID, Dublettenprüfung, Teilmengen-Drei-Wege-Abgleich, Abweichungs-/Zahlungssperren, unabhängige Freigabe, WE/RE-/Vorsteuer-/Kreditorenbuchung, OP und nachvollziehbare Korrektur. Die unten dokumentierten Teilstände erledigen nicht alle Steuer-, Korrektur- und Zahlungsfälle.

Code128 mit tatsächlicher Belegnummer wird in der gemeinsamen schwarzen Formularbasis umgesetzt; alte Archivbytes bleiben erhalten. Fremde Eingangsoriginale werden dafür nicht verändert. Barcode ist Nutzerkomfort, keine allgemeine gesetzliche Pflicht; physische Lagerlabels/Scanner bleiben eigener Umfang.


### Technischer Teilstand Preview0.11

Fakturaanforderung mit tatsächlichen SRM-Quellen, unabhängiger Freigabe, Fakturavorrat, Teil-/Endrechnung eines SA, Inland-DE-Normalumsatzsteuer, gleichem zweistelligem Währungscode, FI/Forderung und echter validierter ZUGFeRD-Ausgabe sind umgesetzt. Native OpenUI5-Seiten führen durch diese Schritte; Quellmengen, genehmigte Nettowerte und historische Snapshots sind geschützt. Ansprechpartnerfunktionen/Gültigkeit, mehrere Adressarten sowie separat freizugebende Debitoren-/Kreditorenrollen und Bankprofile je Buchungskreis sind Teilbasis. Sie erledigen weder den gesamten SD-/BILL-/CRM-Backlog noch Eingangsrechnungen. Code128 ist in der gemeinsamen Formularbasis (Vorlagenstand4) einschließlich neuer Rechnungen integriert. [Umfang und Grenzen](billing.md), [Preview-Nachweise](previews/v0.11.0-preview.1/README.md). Rechtliche Abnahme und Produktionsbetrieb bleiben getrennt.

## UI-DATE-01 / BILL-TICKET-01 · Deutsche Datumsanzeige und Ticketnummer auf Rechnung

[Verbindliche Präzisierung](requirements/dates-ticket-invoice-references.md): sichtbare Datumswerte `TT.MM.JJJJ`, kompakte Leistungsdatum-/Zeitraumdarstellung und tatsächliche Ticketnummern aus abgerechneten SRM-Quellen auf Serviceauftragsrechnungen. Neue Ausgabe und eingefrorener Snapshot werden entsprechend ergänzt; historische Archivbytes und maschinenlesbare Normformate bleiben erhalten. Der Nutzer hat die vollständige weitere Bearbeitung ohne Phasenrückfragen erneut beauftragt.

### Technischer Teilstand Preview0.12

Originaler Rechnungseingang mit EG, unveränderlichem Original, externer Rechnungsnummer, sicherer CII/UBL-Verarbeitung und tatsächlicher normativer Prüfung, PDF-Quarantäne, Dublettenhinweis, nativer OpenUI5-Arbeitsliste/Detail/Anlagenliste und eigenem Schwarz-Weiß-Prüfblatt mit Barcode. Keine FI/OP aus technischer Validierung. AP-01/02/04/11 teilweise umgesetzt; Drei-Wege-Abgleich, Kreditor, fachliche Freigabe, WE/RE-/Vorsteuerbuchung, Korrektur und Zahlung bleiben offen. [Details und Grenzen](incoming-invoices.md).

Preview0.12.0-preview.2 ergänzt AP-03/05/11 teilweise: gespeicherte Zuordnung an freigegebene SA-Bestellung/Positionen, Aggregation gegen tatsächliche nicht stornierte Teil-WE, Kreditoren-/Parteien-/Preis-/Einheiten-/Währungs-/Dublettenbefunde. Kein Verbrauch gebuchter Rechnungsmenge und keine FI/OP aus der Vorprüfung; finanzielle Freigabe/Buchung bleibt nächster Schritt.

### Finanzteilstand Preview0.13

AP-03/05/06/08/11 teilweise: gespeicherter verbindlicher Finanzstand, tatsächlich verfügbare WE-Mengen und historische WE/RE-Centwerte, unabhängig bestätigte Vorsteuerprüfung und unveränderlicher Freigabefingerabdruck. Atomare Buchung mit FI, zahlungsgesperrtem Kreditorenposten und Originalsnapshot. Bereits verrechnete Mengen schützen weitere Teilrechnungen und WE-Storno; keine zweite Lager-/Aufwandsbuchung. Native Finanzmaske, Journalnavigation und eigener Schwarz-Weiß-Rechnungsprüfbeleg mit EG-Barcode. 182 Tests, fünf relevante Browserabläufe und aktuelles Docker-Image bestanden. [Nachweise](previews/v0.13.0-preview.1/README.md). Storno/Gutschrift, Ausnahme-/Toleranzkontierung, zusätzliche Steuerfälle, Zahlung und Ausgleich bleiben offen.

### Korrekturteilstand Preview0.14

AP-09/11 teilweise: eigener vollständiger interner SB-Storno zu einer unbezahlten gebuchten Rechnung, gespeicherter Kontierungs-/Originalprüfstand, unabhängige Finanzfreigabe und nachvollziehbare Rücknahme. Tatsächliche Gegen-FI, abgeleiteter OP-Rest null und Freigabe der ursprünglichen WE-Verrechnung entstehen atomar. Originale, OP-Basis und Verrechnungszeilen bleiben unverändert; physischer Lagerstorno bleibt getrennt. Externe Lieferantengutschrift381, Teilkorrektur, Wiederbuchung desselben Originals, bezahlte Posten und Bank-/Zahlungsvorgänge bleiben offen. [Details](incoming-invoices.md).

Preview0.15 setzt die physische Lagerteilbasis um: Bereich/Gang/Regal/Ebene/Fach, tatsächliche Fachmengen, Teil-Einlagerung/Platzwechsel und genaue Gegenbewegung, Kapazität/Sperre/Mischregeln, unveränderliche Code128-Platzetiketten/Tastaturscan, aufgeteilte Fachentnahme an SA und Originalfach-Rücknahme. Migration019 übernimmt echte Altbestände ausschließlich unzugeordnet und wertneutral. [Details und verbleibende Grenzen](warehouse.md). Lagerortübergreifende Umlagerung, Inventur/Differenzen, Kamera/Offline, Geräte-/Druckerabnahme und nachgelagerte Fakturakorrektur bleiben offen. [Weitere UI-Inspiration des Nutzers](requirements/ui-inspiration-links.md).

Preview0.16 ergänzt freie einstufige Umlagerung zwischen Lagerorten/Werken desselben Buchungskreises, tatsächliche Quell-/Zielfächer/Tracking, Originalgegenbewegung und unveränderte Unternehmensbewertung. Reservierte bzw. ausgegebene Zielmengen sperren die Rücknahme; vorhandene Auftragsbindung wird nicht automatisch verschoben. Die Bestandsanzeige erhält auch bei parallelen Buchungen einen zusammenhängenden Lesestand. Preview0.17 ergänzt tatsächliche Inventur mit Fachsperre, ausdrücklicher Mengen-/Leerbestätigung, unveränderlichem Verlauf, unabhängiger Differenzfreigabe, atomarer Mengen-/Wert-/LK-/FI-Buchung und exakter Originalgegenbewegung. Initiale Bewertung ohne vorhandene Wertgrundlage, mehrstufiger Transit, Intercompany und automatische Reservierungsverlagerung bleiben offen.
