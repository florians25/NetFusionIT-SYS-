# Fachlicher Backlog

Stand: 22.10.2026. Der vollständige [Masterprompt](master-prompt.md) bleibt der Grundauftrag. Die folgenden Ergänzungen wurden zusätzlich vom Nutzer beauftragt. Sie sind Anforderungen, keine Behauptung bereits implementierter Funktionen. Oberflächen bestehen ausschließlich aus Standardcontrols von **OpenUI5**. [Verbindliche Navigations-/Maskenvorgaben](requirements/navigation.md): App-Zentrale als Einstieg, ausschließlich anwendungsbezogene Schnellzugriffe und native Belegobjektseiten. SAP-Dokumentation dient als fachliche Referenz; SAP-Backend-Dienste oder SAPUI5-exklusive Controls werden dadurch nicht vorausgesetzt.

## SERVICE-01 · Serviceangebote

Status: offen · Umsetzung zusammen mit Masterprompt-Phase 4 und 7.
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

[Verbindliche Ticket-/WOT-/SRM-Präzisierung](requirements/ticket-execution.md).

## SERVICE-02 · Serviceaufträge und Servicerückmeldungen

Status: Auftragsanlage, Positionen, Preisfindung, Freigabe, Ticketaufgaben, Arbeits-/Fahrzeiten/Pauschalen, Timer, automatische SRM beim Aufgabenabschluss mit Ticket-Korrelation, Teil-/Endrückmeldungen, Kundenbestätigung und technischer Abschluss implementiert; erweiterte Positionstypen, Beschaffung, Faktura und FI/CO-Integration offen · Masterprompt-Phase 4–8.
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
