# Vorgangsbezogenes PDF-Archiv · Preview 0.10

Die kleine native OpenUI5-Anlagenliste öffnet sich am Ticket, Servicefall, Geschäftspartner, Serviceauftrag, SRM, Materialbedarf, BANF, Bestellung, Wareneingang, Warenausgang und Finanzbeleg. Artikel, Lieferanten, technische Objekte, Serviceverträge, Technikereinsätze und Ticketaufgaben haben eine Anlagenaktion an der jeweiligen Zeile. Administrations- und Konfigurationszeilen ohne Geschäftsbeleg sind keine künstlichen PDF-Vorgänge.

Die Auftragsliste der Dateien bündelt auch Archive der zugehörigen Bedarfe, Beschaffungs-, Material- und Leistungsbelege, jeweils innerhalb der Berechtigung des Benutzers. Interne Einkaufs-/Finanzdateien werden Kunden nicht angezeigt. Ein ausdrücklich für Kunden erzeugter Lieferschein ist über den eigenen Serviceauftrag zugänglich; das gewährt keinen Zugriff auf die interne Lagerobjektseite. Die direkte Quellansicht verlangt weiterhin die ursprüngliche Fachberechtigung. Die Anlagenliste wird nicht als neue globale Anwendung oder als großes Dauerregister eingeführt.

## Geschäfts-PDFs

Neue Geschäftsdateien verwenden kompakte Belegdateinamen wie `BE-52000000.pdf` und `LS-44000000.pdf`; Dokumentart, Archivnummer und Quellversion bleiben getrennte Metadaten.

PDFKit 0.20.2 erzeugt tatsächliche A4-Dateien mit eingebetteten DejaVu-Schriften, Geschäftsadresse, Empfänger, Datum, Herkunft, Belegstand, Positionen und Seiten-/Archivnummern. Schriftlizenz unter `assets/fonts/`. Vorlagenstand3 setzt das [DIN-5008-Form-B-Brieflayout mit SAP-orientierter Beleggliederung](requirements/business-documents.md) um: Fensteranschrift, kompakter rechter Belegkopf mit Nummer/Datum/Seite, deutsche Datumsdarstellung, rechtsbündige Mengen/Beträge, Summenblock und wiederholte Tabellenköpfe. Die gemeinsame Formularbasis ist ausschließlich schwarz auf weiß, mit kräftigen horizontalen Tabellenlinien und klassischer Firmen-/Archivfußzeile nach dem zusätzlichen Nutzermuster. Eine Überlänge der Anschrift wird abgewiesen statt abgeschnitten. Lange Tabellen/Positionsbeschreibungen laufen über weitere Seiten. Geldberechnung erfolgt mit Decimal-Präzision60; Bestellpositionswerte werden mit der konfigurierten Währungspräzision gerundet, ohne Geldbeträge durch JavaScript-Gleitkommazahlen zu berechnen.

- Serviceauftragsbestätigung nach fachlicher Auftragsfreigabe: freigegebene Positionen und gespeicherte Netto-/Steuer-/Bruttowerte. Sie verwendet den Serviceauftrag als kaufmännischen Ursprungsbeleg; ein eigener Auftragsbestätigungs-Geschäftsprozess mit AB-Beleg ist damit noch nicht umgesetzt.
- Bestellung nach Einkaufsfreigabe: gespeicherter Lieferanten- und Adress-/Zahlungszielsnapshot, Mengen, Termine, Einkaufspreise und Nettowerte.
- Wareneingangsbeleg: tatsächlich gebuchte Eingangsmenge, Werk/Lagerort, Charge/Serie und Wert; Gegenbewegung bleibt ein eigener Beleg.
- Lieferschein: tatsächliche Auslieferung mit LS-/WA-Referenz, Menge, Artikel und Tracking, ohne interne Einstandskosten. Nach Rücknahme kann ein weiterer Archivstand mit dem Rücknahmehinweis erzeugt werden; alte Dateien bleiben erhalten.
- SRM nach Einreichung: Diagnose, Arbeiten, Ergebnis, tatsächliche Leistungs-/Materialmengen, Ticket/WOT und unveränderte Ticket-Korrelation, Kundenbestätigungsstand; keine internen Einstandskosten. Ein Nachweis in Prüfung wird ausdrücklich als noch nicht fachlich freigegeben bezeichnet.
- Interne Vorgangsblätter für bestehende Geschäftsbelege; Bedarfs-/BANF-Positionen und Finanzjournalzeilen werden mit ausgegeben. Diese Blätter sind keine Rechnungen oder ersatzweise Bestellungen.

Rechnungs-/Gutschrifterzeugung, E-Mail-Ausgabe, qualifizierte Signatur und Langzeitarchiv-Zertifizierung sind nicht durch das PDF-Archiv implementiert. Vorhandene externe Rechnungs-PDFs können als interne Unterlagen am Vorgang abgelegt werden. Ohne Fakturamodul werden keine Rechnungen vorgetäuscht.

## Unveränderlicher Archivstand

Jede Anlage besitzt UUID, atomar vergebene DO-Nummer, Ursprungsbeleg, Vorgangsversion, Dokumentart, Sichtbarkeit, Ursprung, Templateversion, Quellenhash, konkreten Quellensnapshot, Bytes, SHA-256, Erzeuger und Zeitpunkt. PostgreSQL speichert Bytes und Metadaten gemeinsam; SHA-256 wird zusätzlich mit der Datenbankfunktion gegen die Bytes geprüft. Änderungen und Löschungen von Anlagen oder Scanprotokollen sind durch Datenbanktrigger gesperrt. Derselbe Inhaltsstand/Typ/Sichtbarkeit erzeugt bei Wiederholung dieselbe Anlage. Ein geänderter Quellstand erzeugt eine weitere Anlage, ohne historische Dateien aus heutigen Stammdaten neu zu rendern. Audit dokumentiert Erstellen, Upload, Scan und Download.

Vorhandene Kundenstämme ohne zentralen Belegeintrag werden ohne Umnummerierung technisch registriert; der Audit kennzeichnet ausdrücklich, dass der historische Ersteller nicht dokumentiert war. Neue Entwicklungsstämme werden direkt im Belegregister angelegt.

Jeder Zugriff prüft erneut Session, Mandant, Organisation und die Fach-/Kunden-/Technikergrenze des Vorgangs. Metadaten enthalten keine internen Quellensnapshots oder PDF-Bytes. Auch der Download über den Auftrag validiert, dass der konkrete Folgebeleg tatsächlich zu diesem Auftrag gehört. Datenbank-RLS schützt beide Archivtabellen; Laufzeitrechte sind SELECT/INSERT.

## Externe PDFs und Quarantäne

Nur interne Benutzer mit Zugriff auf den Vorgang können hochladen. Maximal5MiB, `.pdf`, begrenzter Dateiname ohne Pfad-/Steuerzeichen, PDF-Kopf und EOF-Abschluss. Das ist eine Annahmeprüfung und keine vollständige Validierung sämtlicher PDF-Strukturen. Fremde URLs oder andere Dateitypen werden nicht heruntergeladen. Uploads bleiben intern.

ClamAV-INSTREAM unter `ERP_CLAMAV_HOST`/`ERP_CLAMAV_PORT` prüft die genauen Archivbytes mit begrenzter Antwort und absolutem Zeitlimit. Ohne Konfiguration, bei Netzwerk-/Protokollfehler, fehlendem eindeutigem OK oder Virenfund bleibt der Download gesperrt. Scanversuche werden unveränderlich protokolliert; eine erneute Prüfung ist möglich. Systemseitig erzeugte PDFs haben den getrennten Status `TRUSTED_GENERATED` und werden nicht als virengeprüfter Upload bezeichnet.

`deploy/compose.antivirus.yaml` ist ein optionales Docker-Overlay für den Ubuntu-Zielserver mit internem ClamAV-Dienst und persistenten Signaturen. `ERP_CLAMAV_IMAGE` verlangt ein geprüftes offizielles Image mit unveränderlichem Digest. Hier wurden Quarantäne und der echte Netzwerkprotokolladapter gegen einen Simulator geprüft, **kein laufender ClamAV mit aktuellen Signaturen oder Docker-Zielbetrieb**. Dies bleibt eine Betriebsabnahme. Das Grundsystem funktioniert ohne Scanner, gibt externe Dateien dann aber nicht zum Download frei.

Downloads werden ausschließlich als `application/pdf` mit `Content-Disposition: attachment`, no-store, nosniff und restriktiver Sandbox-CSP geliefert. Kein eingebetteter Fremd-HTML-/PDF-Viewer. Dateinamen dienen nie als Dateisystempfad. Dateimengen-/Speicherquoten, Aufbewahrung und rechtlich zulässige Lösch-/Anonymisierungskonzepte benötigen vor Produktivfreigabe eine eigene Betriebsentscheidung.
