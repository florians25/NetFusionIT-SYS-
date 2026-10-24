# Ersteinrichtung und interne Ticketqualifikation · Preview0.30

Nutzerauftrag24.10.2026: Bei der Erstinstallation benötigte Angaben im Assistenten abfragen, ausdrücklich Werke, USt-IdNr. und weitere Unternehmensdaten. Professionellere, breite OpenUI5-Masken; internes Ticket mit mehreren verknüpften Assets. Der vorhandene Kundenportalprozess bleibt kompatibel.

## Installationsassistent im Ubuntu-Terminal

Der Ein-Befehl-Installer fragt bei einer neuen interaktiven Installation Verzeichnis, Compose-Projekt, Serveradresse, HTTP-Testbetrieb oder HTTPS, Mandantenkennung, Firmennamen sowie Vorname, Nachname und E-Mail der Administration ab. Ein Passwort kann verdeckt zweimal eingegeben oder sicher generiert werden. Vor Initialisierung erscheint eine prüfbare Übersicht. Abbruch legt keine Unternehmensdaten an. Ein eigenes Passwort wird ausschließlich über eine temporäre0600-Datei eingebunden und anschließend entfernt; es steht weder in Kommandoargumenten noch im Installationslog.

Updates übernehmen die vorhandene Konfiguration und das tatsächlich geänderte Passwort. Git-Pull, Build, Sicherung und Migration bleiben im selben Befehl. `ERP_INSTALL_WIZARD=0` ermöglicht unveränderte automatisierte Installation mit Umgebungswerten; `=1` verlangt ein tatsächliches Terminal. Ohne Terminal wird bei `auto` nicht auf Eingaben gewartet.

## Unternehmensassistent nach erster Administratoranmeldung

Sechs native `sap.m.Wizard`-Schritte innerhalb einer breiten `sap.f.DynamicPage`, ohne eigene Controls/CSS. Vorbelegte Werte sind vor dem Speichern veränderbar. Eine vollständige Prüfübersicht zeigt die gewählten Angaben.

| Schritt | Erfasste Angaben | Tatsächliche Speicherung |
| --- | --- | --- |
| Firma und Steuern | Serviceorganisation, Organisationsname, Buchungskreis, rechtlicher Firmenname, LandDE/WährungEUR, Straße, PLZ/Ort, Firmen-E-Mail/Telefon/Website, USt-IdNr., Steuernummer, Registergericht/-nummer, Geschäftsführung | Unternehmens- und Organisationsstamm einschließlich Rechts-/Steuerdaten |
| Ansprechpartner | Vorname, Nachname, E-Mail und Telefon | Dokumentansprechpartner für neue Geschäftsunterlagen |
| Werke und Lager | Mehrere Werksschlüssel/-namen, mehrere Lagerorte mit Art, optional Bereich/Gang/Regal/Ebenen/Fächer/Präfix | Echte Werke, Lagerorte, Eingangspuffer und optional bis500 leere Regalfächer; keine erfundenen Bestände |
| Vertrieb und Einkauf | Verkaufsorganisation, Vertriebsweg, Sparte, Zahlungsziel/-bedingung, Versandart, Incoterms/Ausgabe, Einkaufsorganisation, Einkäufergruppe und vorhandene berechtigte Einkaufsverantwortliche | Vertriebsbereich, Geschäftsbedingungen, Einkaufs-/Werkszuordnungen und Gruppenmitglieder |
| Konten und Perioden | Geschäftsjahr und zwölf bearbeitbare Kontovorschläge | Sachkonten,19 tatsächlich verwendete Buchungsregeln und zwölf Monatsperioden |
| Bank und Freigaben | Eigene IBAN/BIC, Faktura-E-Mail/Telefon, unabhängige Prüfrolle | Bank-/Fakturaprofil als Entwurf; fehlende Finanzfreigabedefinitionen mit Vier-Augen-Regel |

Die Eingaben werden serverseitig streng geprüft und in einer Transaktion angelegt. Deutsche IBAN mit echter Prüfziffer; USt-IdNr. mit deutscher Syntaxprüfung, ohne behauptete Behördenabfrage. Ein später ungültiger Einkäufer lässt auch zuvor angelegte Konten/Werke vollständig zurückrollen. Wiederholung mit demselben Idempotenzschlüssel erzeugt keine Dubletten. Ein tenantweiter Transaktionslock schützt parallele Erstabschlüsse. Vorhandene Buchungskreise werden nicht überschrieben. Der unveränderliche Einrichtungssnapshot dokumentiert den gewählten Stand; spätere Stammdatenänderungen erfolgen in den zuständigen Fachapps.

Der Assistent öffnet für eine noch nicht konfigurierte Installation nach Administratoranmeldung und bleibt über die eigene App **Ersteinrichtung** erreichbar. „Später einrichten“ führt zur App-Zentrale. Bank-/Fakturaprofile benötigen weiterhin einen anderen berechtigten Prüfer; der erste Administrator genehmigt seine eigene Bankkonfiguration nicht automatisch.

Der Stand richtet die vorhandene deutsche EUR-Teilbasis ein. Mehrwährung, weitere Steuerverfahren, Fremdkontenimporte, Mailserver/OIDC/MFA, zusätzliche Buchungskreise sowie alle späteren ERP-Customizingfelder sind weitere Backlog-Arbeiten. Kontovorschläge sind keine steuerliche Kontenplanberatung. Die Installation erzeugt keine Kundenrechnungen, Zahlungen oder Lagerbestände.

## Interne Ticketmaske und Assets

Die breite native Erfassung und die eigene Qualifikationsarbeitsseite enthalten:

- Kunde/Servicevertrag, Anfrageart, Betreff und ausführliche Beschreibung.
- Kundenbezogenen Ansprechpartner und Standortanschrift, Eingangskanal, erstmals aufgetreten und Wiedervorlage.
- Kategorie/Unterkategorie, Auswirkung, Dringlichkeit und betroffene Personen. Die Priorität wird serverseitig aus der Matrix ermittelt; Abweichungen erfordern einen ausdrücklichen Grund.
- Raum/Standort, Systemumgebung/Version, Fehlercode, Reproduktionsschritte, Geschäftsbeeinträchtigung, Workaround und interne Übergabe.
- Mehrere echte Assets desselben Kunden und derselben Serviceorganisation mit Assetnummer, Hersteller/Modell, Serien-/Inventarnummer, Standort und Garantie. Hinzufügen/Entfernen wird historisch erhalten; keine Löschung ursprünglicher Verknüpfungen.
- Übersicht mit Bearbeitungs-, SLA-, Zeit- und Assetkontext, vorhandene Nachrichtenhistorie, WOT-/Zeit-/Leistungsfunktionen. Interne Nachrichten starten mit interner Sichtbarkeit.

Anlage von Ticket, Servicefall, Qualifikation und Assetverknüpfungen ist atomar. Bearbeitung prüft Ticketversion, Rolle, Organisation und bei Technikern die tatsächliche eigene Einsatz-/Bearbeitungszuordnung. Kunden können keine internen Qualifikationsfelder einschleusen oder lesen; ihr vorhandenes einzelnes technisches Objekt bleibt kompatibel. Geschlossene bzw. kaufmännisch abgeschlossene Tickets werden nicht nachträglich umqualifiziert. Bestehende SLA-Fristen behalten ihre gebundene ursprüngliche Vereinbarung.

Assetzuordnung führt keine Warenbewegung aus. Ticketzeiten, Arbeits-/Fahrzeiten und WOT-Abschluss übergeben Leistungen weiter an die korrelierte SRM im Serviceauftrag. Kosten, Beschaffung und Abrechnung bleiben am Serviceauftrag. Kein Belegfluss in der Ticketmaske.

## Abnahme

Tatsächliche API-/PostgreSQL-Prüfungen für vollständige Erstkonfiguration, Eingabefehler/Rollback, Idempotenz, Rechte/Org, Konfigurationserhalt, interne Daten-/Assetgrenzen, Prioritätsmatrix und Versionskonflikte. Echter Terminaltest für Dialog, verdecktes Passwort und Abbruch. Nativer Desktop-/390px-Browserablauf mit tatsächlich gespeicherten Unternehmensdaten, zwei Werken/drei Lagerorten/20 leeren Fächern und zwei Ticketassets. Konkrete finale Nachweise stehen im [Preview-Verzeichnis](../previews/v0.30.0-preview.1/README.md).
