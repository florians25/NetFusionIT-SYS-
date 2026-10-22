# Sicherheits- und Betriebskonzept

## Erste Lieferung

Passwörter mit zufälligem Salt und scrypt, Timing-sichere Prüfung. DB-Sessions, Regeneration nach Login, HttpOnly/SameSite, produktiv Secure-Cookie hinter vertrauenswürdigem Proxy. CSRF-Token für jedes schreibende Kommando, Same-Origin, Helmet-Header und Content-Security-Policy für lokale OpenUI5-Ressourcen. Begrenzte JSON-Größe, Login-/API-Rate-Limits, parametrisierte SQL-Abfragen, XML/HTML-Ausgabe über Frameworkkontrollen. Untrusted Texte werden nie als HTML eingebunden.

RLS + Tenant-/Org-Filter + Partner-/Technikerfilter. Laufzeitrolle ohne Superuser/DDL. Entwicklung und Tests besitzen separate Datenbanken. Audit-Fachereignisse sind per DB-Trigger gegen UPDATE/DELETE geschützt. Dies ist nachvollziehbare Historie, keine Garantie gegen privilegierte Datenbank-/Hostadministratoren. Login protokolliert keine Passwörter oder Session-Tokens.

Lokale Entwicklungszugänge werden zufällig erzeugt, ausschließlich unter ignoriertem `.local/` mit Modus 0600 gespeichert und nicht in Logs ausgegeben. Produktionsstart seedet keine Konten. Keine Secrets im Repository oder Konfigurationsentwurf. Produktionssecrets über geschützte Umgebung/Secret-Dateien bereitstellen.

## Produktivfreigabe noch offen

MFA/OIDC, Passwort-Recovery, zentraler sitzungsübergreifender Login-Angriffsschutz, Security-/Lasttest, Tenant-Penetrationstest, Datenschutz/Löschkonzept und tatsächliches Zielhosting prüfen. Ab Preview0.10 gibt es begrenzte PDF-Uploads mit Quarantäne und ClamAV-INSTREAM-Adapter. Ohne bestätigte Prüfung bleibt der Download gesperrt. Annahmeprüfung, unveränderliche Bytes/Scanprotokolle, Quellen-/Rollengrenzen und verbleibende ClamAV-Betriebsabnahme unter [PDF-Archiv](attachments.md).

Abhängigkeitsprüfung 22.10.2026: `npm audit --omit=dev` meldet 0 bekannte Schwachstellen. Der Gesamtcheck meldet 14 Befunde ausschließlich im Entwicklungs-/UI5-Tooling-Abhängigkeitsbaum (11 high, 3 moderate), u. a. braces, pacote und sigstore. Die aktuelle UI5-CLI 4.0.71 wird verwendet. Keine blinde Herabstufung auf UI5-CLI 2 und keine Abschaltung von TLS-/Integritätsprüfungen. Diese Befunde sind vor Produktions-Buildfreigabe zu bewerten bzw. mit unterstützten Tooling-Updates zu beheben. OpenUI5-Frameworkressourcen werden separat versionsgebunden durch das offizielle UI5-Tooling bezogen; der npm-Laufzeitcheck ist kein vollständiger Securitynachweis aller ausgelieferten Assets.

Verschlüsselte externe Backups mit Rotation und getrennten Schlüsseln, WAL/PITR bei passendem RPO; Wiederherstellung in separater DB mit fachlicher Summenprüfung. Externe Objektdateien gemeinsam versionieren. RPO/RTO und Aufbewahrung müssen entschieden werden. Alarmierung auf DB-Ausfall, Fehlerquote, Speicher, Backupalter, Jobfehler und Zertifikatsablauf. Keine Kundendaten in Metriklabels. Produktivbetrieb erst nach dokumentierter Restore- und fachlicher Abnahme.

## Lagerprojektionen und Quellenbuchung ab Preview 0.7

Die Laufzeitrolle kann Bestands- und Bewertungsprojektionen nur lesen. Materialbelegtrigger mit festem Suchpfad wenden die unveränderliche Bewegung an. Reservierungsprüfung validiert den transaktionslokalen Mandantenkontext vor ihrer privilegierten Sperre und schützt gegen Überreservierung. Datenbankconstraints verhindern negative Bestände, doppelte aktive Seriennummern, unversiegelte/unvollständige Materialbelege und positive Bewegungen ohne passendes gebuchtes Quellenjournal. Ein Storno ist nur einmal möglich; Originalkonten bleiben auch nach Konfigurationsänderung maßgeblich. Warehouse-Berechtigung erlaubt den fachlich validierten Quellenprozess, keine frei wählbaren FI-Buchungen.

## Verbrauch und SRM-Istquellen ab Preview 0.9

Verbrauch wird aus einer tatsächlichen Reservierung abgeleitet; Kundenwerte für Kosten werden nicht übernommen. Die Datenbank prüft den gesperrten gleitenden Wert, nichtnegative Mengen, verbleibende Reservierung, vollständige Rücknahme und Originalkonten/-werte. Positive Bewegungen benötigen korrespondierende gebuchte Quellenjournale in offener Periode. Alle privaten Projektionen bleiben Runtime-read-only.

SRM-Positionen sind append-only und benötigen exakt passende tatsächliche Zeit-/Pauschalen-/Materialquellen. Einfügen in freigegebene Nachweise, Änderung alter Istpositionen und doppelte aktive Materialrückmeldung sind gesperrt. Ticket → Task → Auftrag ist die gemeinsame Sperrreihenfolge für Auslieferung, Rückmeldung und deren Korrektur; gleichzeitiger Entwurfsabbruch/Rücknahme ist geprüft. Keine Quersynchronisation freier Auftragszeiten.

## PDF-Archiv ab Preview 0.10

Archivbytes, Hash und Snapshot werden atomar gespeichert; Dateinamen sind keine Speicherpfade. Beide Tabellen besitzen Tenant-RLS und unveränderliche Append-only-Trigger. Jeder Download prüft Quelle und aktuelle Fach-/Kunden-/Technikerberechtigung. Auftragsbündelung öffnet keinen Zugriff auf fremde Fälle oder interne Belege für Kunden. Uploads sind bis5MiB begrenzt und bleiben ohne eindeutiges ClamAV-OK in Quarantäne. Downloads erzwingen attachment/no-store/nosniff/Sandbox-CSP. Der Scannerprotokolltest ist kein Nachweis eines echten Virenscanners mit aktuellen Definitionen. PDFKit 0.20.2 ergänzt die Laufzeitabhängigkeiten; Laufzeitaudit vom22.10.2026 weiterhin ohne bekannte Befunde.

OpenUI5 wird ab Preview0.10 auf den offiziellen Patchstand1.152.1 festgelegt: In1.153.0 ist das mobile native OverflowToolbar-Menü beim Zugriff auf einen noch fehlenden Positionierungsanker reproduzierbar abgestürzt. Die Anwendung verändert keine Frameworkdateien und ersetzt keine Controls. Die npm-Laufzeitprüfung umfasst weiterhin nicht alle separat bezogenen Frameworkressourcen.
