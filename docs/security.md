# Sicherheits- und Betriebskonzept

## Erste Lieferung

Passwörter mit zufälligem Salt und scrypt, Timing-sichere Prüfung. DB-Sessions, Regeneration nach Login, HttpOnly/SameSite, produktiv Secure-Cookie hinter vertrauenswürdigem Proxy. CSRF-Token für jedes schreibende Kommando, Same-Origin, Helmet-Header und Content-Security-Policy für lokale OpenUI5-Ressourcen. Begrenzte JSON-Größe, Login-/API-Rate-Limits, parametrisierte SQL-Abfragen, XML/HTML-Ausgabe über Frameworkkontrollen. Untrusted Texte werden nie als HTML eingebunden.

RLS + Tenant-/Org-Filter + Partner-/Technikerfilter. Laufzeitrolle ohne Superuser/DDL. Entwicklung und Tests besitzen separate Datenbanken. Audit-Fachereignisse sind per DB-Trigger gegen UPDATE/DELETE geschützt. Dies ist nachvollziehbare Historie, keine Garantie gegen privilegierte Datenbank-/Hostadministratoren. Login protokolliert keine Passwörter oder Session-Tokens.

Lokale Entwicklungszugänge werden zufällig erzeugt, ausschließlich unter ignoriertem `.local/` mit Modus 0600 gespeichert und nicht in Logs ausgegeben. Produktionsstart seedet keine Konten. Keine Secrets im Repository oder Konfigurationsentwurf. Produktionssecrets über geschützte Umgebung/Secret-Dateien bereitstellen.

## Produktivfreigabe noch offen

MFA/OIDC, Passwort-Recovery, zentraler sitzungsübergreifender Login-Angriffsschutz, Security-/Lasttest, Tenant-Penetrationstest, Datenschutz/Löschkonzept und tatsächliches Zielhosting prüfen. Keine Datei-Uploads, deshalb aktuell auch kein Schein-Virenscanner. Vor Uploads: Typ/Größe/Signatur/Archivbomben, Quarantäne, ClamAV, zufällige Objektnamen und autorisierter Download.

Abhängigkeitsprüfung 22.10.2026: `npm audit --omit=dev` meldet 0 bekannte Schwachstellen. Der Gesamtcheck meldet 14 Befunde ausschließlich im Entwicklungs-/UI5-Tooling-Abhängigkeitsbaum (11 high, 3 moderate), u. a. braces, pacote und sigstore. Die aktuelle UI5-CLI 4.0.71 wird verwendet. Keine blinde Herabstufung auf UI5-CLI 2 und keine Abschaltung von TLS-/Integritätsprüfungen. Diese Befunde sind vor Produktions-Buildfreigabe zu bewerten bzw. mit unterstützten Tooling-Updates zu beheben. OpenUI5-Frameworkressourcen werden separat versionsgebunden durch das offizielle UI5-Tooling bezogen; der npm-Laufzeitcheck ist kein vollständiger Securitynachweis aller ausgelieferten Assets.

Verschlüsselte externe Backups mit Rotation und getrennten Schlüsseln, WAL/PITR bei passendem RPO; Wiederherstellung in separater DB mit fachlicher Summenprüfung. Externe Objektdateien gemeinsam versionieren. RPO/RTO und Aufbewahrung müssen entschieden werden. Alarmierung auf DB-Ausfall, Fehlerquote, Speicher, Backupalter, Jobfehler und Zertifikatsablauf. Keine Kundendaten in Metriklabels. Produktivbetrieb erst nach dokumentierter Restore- und fachlicher Abnahme.

## Lagerprojektionen und Quellenbuchung ab Preview 0.7

Die Laufzeitrolle kann Bestands- und Bewertungsprojektionen nur lesen. Materialbelegtrigger mit festem Suchpfad wenden die unveränderliche Bewegung an. Reservierungsprüfung validiert den transaktionslokalen Mandantenkontext vor ihrer privilegierten Sperre und schützt gegen Überreservierung. Datenbankconstraints verhindern negative Bestände, doppelte aktive Seriennummern, unversiegelte/unvollständige Materialbelege und positive Bewegungen ohne passendes gebuchtes Quellenjournal. Ein Storno ist nur einmal möglich; Originalkonten bleiben auch nach Konfigurationsänderung maßgeblich. Warehouse-Berechtigung erlaubt den fachlich validierten Quellenprozess, keine frei wählbaren FI-Buchungen.
