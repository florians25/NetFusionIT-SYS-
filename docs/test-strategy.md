# Tests und Abnahme

## Erster Prozess – verpflichtend

Build/TypeScript; PostgreSQL-Migration wiederholbar und prüfsummengesichert; Login/Logout/CSRF; Kundenformular → persistentes Ticket/Fall/Relation/Audit; echte UI5-OData-Liste und Objektseite; Dispatcherzuweisung; Technikersicht und Statusregel; Neustart mit erhaltenen Daten.

Negativtests: falsche Anmeldung, fehlende Session/CSRF, unbekannte Felder, ungültige UUIDs, gesperrter Kunde, fremder Partner, falscher Tenant/Org, fehlende Rolle, fremder Techniker, ungültiger Status, veraltete Version, parallele gleiche Idempotenz, anderer Inhalt bei gleichem Schlüssel, konkurrierende Änderungen, Audit-UPDATE/DELETE und DB-Ausfall/Transaktionsrollback. Filter-/Sortier-Injection muss fehlschlagen. Ein Test ohne tatsächlich ausgeführte Fälle ist kein Nachweis.

Browser: echtes Chromium, echtes OpenUI5, Login, Kundenanlage/Ticketformular, Liste/Detail, Navigation, Zuweisung, mobile Darstellung. Keine rein statischen Screenshots als Funktionsnachweis. Zähler basieren auf gespeicherten Testbelegen, nicht auf fest codierten Zahlen.

## Spätere Abnahme

Szenarien A–E aus `business-processes.md` mit Mengen-/Geldabstimmung; zusätzlich negative Bestände, Überlieferung, doppelte Rechnung/Storno, geschlossene Periode, falsches Steuerkennzeichen, Teil-/Überzahlung, Rundung, Garantie-/Interngrenze, Sommerzeit/SLA-Pause, Terminüberschneidung. Finanz-/Steuerprozesse durch fachliche Abnahme ergänzen.

Restoretest mit isoliertem Ziel und Zeilen-/Referenz-/Summenprüfung, Lasttest mit definierter Zielgröße, Securitytest mit zweitem Tenant und Rollenmatrix. Noch nicht implementierte Module besitzen keine bestandenen E2E-Tests. Konkrete Ergebnisse werden in `docs/implementation-plan.md` dokumentiert.

## Materialversorgung und bewertetes Lager · Preview 0.7

Automatische Bedarfserkennung aus genehmigten Artikelpositionen, Bestand6/Bedarf10, Lagerreservierung6 und Fehlmengen-BANF4 mit automatischem Workflowstart; fehlende Definition rollt BANF/Nummern/Version zurück. Parallele Planung erzeugt keine Doppelreservierung; gleichzeitige Auftragsfreigabe und Planung verwenden konsistente Sperrreihenfolge. Wiederholtes Bestellen darf keine zweite Fehlmenge anfordern. Kunden-/Techniker-/Org-/Tenantgrenzen und Datenbank-Überreservierung werden negativ geprüft.

WE prüft Konfiguration, Lagerort, Periode, Toleranz, kumulierte Teilmengen, Serien-/Chargenpflicht, Nullpreis und exakte Bewertung. WE4+2 zu Bestellung6 sowie WE4 zu weiterer Bestellung4 ergibt Bestand10/Wert480/Durchschnitt48. Storno verwendet Originalwerte/-konten und verhindert doppelte Gegenbewegung, Fremdreservierungsbruch und isoliertes Quellen-FI-Storno. Direkte Projektionsänderung und nachträglicher Materialbeleginhalt sind gesperrt.

Zwei zusätzliche echte Chromium-Prozesse prüfen Lagerkonfiguration/WE/FI/Storno und den auftragsbezogenen Lager-/Fehlmengenprozess mit Nichtlager-/Fremdleistungspositionen. Desktop- und Android-Mobile-Darstellung, native Overflow-Navigation, Konsolen-/HTTP-Fehler und horizontaler Überlauf werden geprüft. Screenshots entstehen erst nach abgeschlossener Datenladung und Standardnavigation.

## Tatsächlicher Verbrauch und SRM · Preview 0.9

Teilausgabe2/Wert96, Originalrücknahme, Vollausgabe10/Wert480 auf Nullbestand/-wert; keine neue BANF für Verbrauch. Konkurrierende Ausgabe, gleiche Idempotenzantwort, fehlende Regeln/Aufgaben und Rollen-/Kundengrenzen sind geprüft. Rücknahme nach geänderter Kontierung verwendet Originalkonten. Gleichzeitig laufender SRM-Entwurfsabbruch und Rücknahme dürfen nicht blockieren oder doppelt buchen; neue Nachweise erhalten korrekte tatsächliche Quellen.

SQL-Negativprüfung verhindert direkte falsche Bewertung, Änderung von Istpositionen, Anhängen an freigegebene SRM und private Projektionsänderung. Zusätzlicher Währungsfall USD-Verkaufsauftrag/EUR-Einkauf/-Istkosten prüft den Materialkosten-Snapshot. Der elfte Browserablauf führt durch Ticketzeit, Mengen-Dialog, Ausgabe, Gegenbewegung, Materialnavigation, SRM, Kundenbestätigung, Servicefreigabe und Abschluss einschließlich Smartphone.

## PDF-Archiv und Fachmasken · Preview 0.10

128 automatisierte Prüfungen bestehen. PDFKit-Dateien werden mit Poppler tatsächlich ausgelesen: korrekter Lieferantensnapshot, Mengen, Bestellwerte, Herkunft, Ticket-Korrelation und kundensichere Leistungsdaten; letzte Position, Unicode, wiederholte Tabellenköpfe und Seitenzahl über mehrere A4-Seiten. Historische Bytes bleiben nach Kundenbestätigung identisch; neuer Quellstand erhält eine neue Anlage. Konkurrenz, Idempotenz, falsche Quelle/Quellversion, getrennte Kunden/Techniker, Tenant-RLS, unveränderliche Archive/Scans sowie Dateiname/Typ/Größe und fehlender Virenscan werden geprüft. Der INSTREAM-Simulator validiert exakte Übertragung/Protokollantworten; er ist ausdrücklich kein echter ClamAV-Nachweis.

Der zwölfte Chromium-Ablauf öffnet echte native Anlagen-Dialoge, erzeugt/archiviert ein Geschäfts-PDF, lädt es herunter, bündelt Folgebelegdateien am Auftrag und lädt eine fremde PDF-Datei in gesperrte Quarantäne hoch. Weitere Fachmasken und Smartphone werden geöffnet und aufgenommen. Das native FileUploader-Control erzeugt ein verborgenes `about:blank`-Frame. Daher prüfen Dialogwartebedingungen tatsächliche abgeschlossene Requests und UI-Busy-Zustand; der beabsichtigte Modal-Blocklayer bleibt sichtbar. Keine deaktivierte Quellen-/Downloadprüfung als Testabkürzung.

Preview0.10 verwendet den offiziellen OpenUI5-Patchstand1.152.1. Der Smartphone-Test öffnet ausdrücklich das native Header-Überlaufmenü und daraus die Anlagenliste; dadurch wird die in1.153.0 beobachtete Positionierungsregression erkannt. Keine manipulierten Frameworkdateien oder Ersatzcontrols. Sämtliche Browserketten werden beim Versionswechsel erneut ausgeführt.

Der DIN-Briefbogentest liest tatsächliche PDF-Textrahmen aus und prüft die Grenzen der Fensteranschrift, Informationsblock, Betreff, Beträge und einseitigen Fuß. Überlange Anschriften werden explizit abgewiesen. Mehrseitentests prüfen den Tabellenkopf und die tatsächliche Seitennummer auf jeder Positionsseite. Die Ticket-Browserkette verlangt ausdrücklich kein Belegflussregister und navigiert direkt zum Servicefall.

Preview0.10.0-preview.2 prüft die monochrome Formularausgabe zusätzlich durch tatsächliches Rastern und identische RGB-Kanäle jedes Pixels. Belegkopf rechts, DIN-Fensteranschrift, gespeicherte Artikelnummern und Preis je Basiseinheit werden verwendet; sechs Dokumentarten werden für die isolierte Preview als echte heruntergeladene PDFs ausgegeben. Die Archivtests prüfen Vorlagenstand3.

Die abschließende Formular-Sichtprüfung sichert vollständige Wörter in schmalen Überschriften (z.B. Seriennummer), vierstellige Positionen ohne abgespaltene Endziffer und lesbare deutsche MEZ/MESZ-Zeitstempel ab. Keine Titel-/Spaltenänderung erzeugt neue fachliche Mengen oder Werte.

Preview0.11:143 automatisierte Tests einschließlich genehmigter SRM→Anforderung→Teil-/Endfaktura, Konkurrenz/Retry, unveränderlichem Snapshot/FI/OP, Festpreis-/Länder-/Rundungssperren, echtem Ausgabefehler/Neustart/Retry ohne zweite FI, CRM-Funktionen/Adressstandard/Finanzrolle und tatsächlicher PDF/A-/CII-Validierung. Rechnerisch falsche E-Rechnung wird vom offiziellen Validator abgewiesen; Java-Kapazität ist lokal begrenzt. Code128 wird aus gerasterten Formularen mit unabhängigem ZXing-Decoder einschließlich Mehrseitigkeit gelesen; auch das fertig kombinierte ZUGFeRD-PDF wurde gegen seine XML-Rechnungsnummer gescannt. Archivtests erwarten Vorlagenstand4; frühere Archivbytes werden nicht ersetzt. Neuer Browserablauf prüft echte Standardcontrols und Mobilansicht, keine simulierte Rechnungsausgabe. Keine Aussage über GoBD-/Steuer-/XRechnung-/Produktivabnahme daraus ableiten.
