# Fachprozess · Physische Inventur und Differenzbuchung

Fortsetzung des beauftragten Lagerbacklogs in Preview0.17. Konkrete Prüfung und technische Grenzen sind in den Versionsnotizen dokumentiert. Nur OpenUI5-Standardcontrols; keine freie Überschreibung bestehender Mengen/Werte.

## Fachlicher Ablauf

1. Einen IV-Vorgang für tatsächliche Fächer desselben Buchungskreises anlegen. Fach-/Artikel-/Chargen-/Serien-Sollstand und Firmen-/Strukturstand werden festgehalten. Ein aktiver Zählvorgang sperrt seine Fächer für WE, WA, Einlagerung, Platzwechsel und Umlagerung; er erlaubt weiterhin die getrennte Auftragsreservierungsfreigabe. Ein anderes Zählverfahren darf keine parallele zweite Zählung derselben Fächer eröffnen.
2. Tatsächliche Mengen ausdrücklich eingeben, einschließlich bestätigter Null. Leer bleibt „noch nicht gezählt“. Leere Fächer müssen gesondert bestätigt werden. Ergänzende bereits bekannte Lagerartikel/Tracking-Kombinationen besitzen Soll null und benötigen dieselben Prüfungen. Jede Erfassung/Änderung hat Zähler, Zeit, Notiz und unveränderlichen Verlauf.
3. Vollständiges Ergebnis mit offener Periode, tatsächlichem Buchungsdatum, Kontierung und aktuellem Bewertungsstand vorbereiten. Mengenänderung oder veränderter Bewertungs-/Konten-/Periodenstand entwertet die Vorbereitung. Keine erfundenen Preise oder Konten. Eine positive Differenz ohne tragfähige vorhandene Bewertung bleibt zur fachlichen Klärung offen.
4. Einen unabhängigen Finanzfreigeber über den konfigurierten Vier-Augen-Workflow entscheiden lassen. Ersteller, beteiligte Zähler und Vorbereiter dürfen den eigenen Stand nicht freigeben. Freigabe bindet den tatsächlichen Vorbereitungsfingerabdruck. Rückfrage, Ablehnung und Rücknahme bewahren den Verlauf.
5. Nach Freigabe Differenz atomar buchen: tatsächliche Fach-/Lagerortkorrektur, Unternehmensmenge/-wert, LK-Korrekturidentität, erforderliche ausgeglichene FI und unveränderlicher Ergebnisstand. Erst vollständiger Abschluss bzw. begründeter Abbruch löst Zählsperren. Ohne Differenz entsteht kein fingierter Material-/Finanzbeleg.
6. Eine notwendige Gegenbewegung wird separat vorbereitet und unabhängig freigegeben. Originalmengen/-werte/-konten, konkrete Fächer und Tracking bleiben maßgeblich. Fehlender bzw. reservierter Bestand, geänderte Bestandskonten und unzulässige Wertreste verhindern die Rücknahme. Originale bleiben erhalten.

## Mengen und Bewertung

Bestehende Reservierungen dürfen nicht durch eine Minderzählung unterschritten werden; notwendige Freigabe erfolgt ausdrücklich am Serviceauftrag. Alle Werte bleiben Dezimalstrings. Seriennummern entsprechen null oder einem Stück und sind auch über andere Fächer/Lagerorte eindeutig. Kapazität, Einheit, Mischregeln und manuelle Bereichs-/Regal-/Fachsperren gelten weiterhin.

Bewertung ist derzeit je Buchungskreis/Artikel geführt. Der tatsächliche Bewertungsstand wird bei Vorbereitung gebunden und vor Freigabe/Buchung erneut verglichen. Bewegungen anderer Fächer können den Bewertungsstand entwerten, verändern aber keinen gesperrten Zählbestand. Positive/negative Teildifferenzen desselben Artikels werden mit deterministischen ursprünglichen Centanteilen verteilt. Eine reine Platzkorrektur mit gleicher Unternehmensmenge und gleichem Unternehmenswert erzeugt keinen fingierten Gewinn/Aufwand. Tatsächliche bewertete Mehr-/Minderbestände verwenden konfigurierte Bestands-/Inventurgewinn-/Inventurverlustkonten. Der vollständige wertmäßige Abgang nimmt den genauen Restwert mit.

## Oberfläche und Nachweise

Eigenständiger Inventurarbeitsplatz aus der App-Zentrale, Vorgangsobjektseite mit Zählumfang, offenen/gezählten Zeilen, Differenzen, Zählhistorie, Vorbereitung/Kontierung, unabhängiger Prüfung und Quellen-FI. Fach-/Artikelscan prüft Identität und löst keine Mengenbuchung aus. Kleine Anlagenliste mit klassischem Schwarz-Weiß-IV-Ergebnis bzw. tatsächlichem LK-Korrekturformular, deutschen Daten/Mengen und Code128. Keine Sollmengen als automatisch bestätigte Zählmengen.

Abnahme umfasst Konkurrenz/Idempotenz, Bewegungs-/Doppelzählsperre, Null/Leer, Serien-/Chargenfälle, tatsächliche Mengen-/Wert-/FI-Kopplung, unabhängige Prüfung und veralteten Fingerabdruck, Perioden-/Kontenwechsel, Reservierungen, Zählabbruch, Originalgegenbewegung, SQL-/RLS-/Organisationsschutz, echte PDF-Barcodes und Desktop-/Mobilbedienung. Erweiterte initiale Bewertungsfälle, Geräte-/Druckerabnahme, mehrstufige Transitbestände und andere Mastermodule bleiben gesonderte Arbeiten.
