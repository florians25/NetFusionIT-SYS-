# Entwicklung und Deployment

## Cloud-Entwicklung

Node.js 24 LTS. `npm ci` → `npm run build` → `npm run dev:setup` → `npm run dev`. Der erste Schritt installiert versionsgebundene Pakete. Der Build erstellt TypeScript und vollständige OpenUI5-Browserressourcen einschließlich Themes und Versionsmetadaten mit dem offiziellen UI5-Tooling. Setup erzeugt nur lokale ignorierte Dateien und eine echte PostgreSQL-Instanz. `npm run dev` startet PostgreSQL, prüft Migrationen und startet die API mit lokal ausgeliefertem OpenUI5. Prozessdaten/Passwörter liegen unter `.local/`, niemals einchecken. Login-Informationen in `.local/accounts.json`; Entwicklungstenant `netfusion`. Keine festen Standardpasswörter. Stoppen per SIGINT/SIGTERM beendet nur eigene Prozesse. Daten bleiben erhalten.

Tests verwenden pro Lauf eine neue separate DB im selben lokalen Cluster und testen auch Fehler/Konkurrenz. Für den Neustarttest wird ausschließlich der selbst gestartete API-Prozess beendet und wieder gestartet. Verwendete Ports: API 3000, lokale PostgreSQL 55432, Test-API 3101, Browser-Test-API 3102.

## Geplanter Produktionspfad

`docker compose` stellt PostgreSQL und die gebaute API bereit; Caddy terminiert HTTPS. Kein Datenbankport nach außen. Umgebungswerte siehe `.env.example`; echte Werte sicher eintragen. Initialen Tenant und Administrator ausdrücklich mit dem Bootstrap-Kommando anlegen, keine Entwicklungskonten übernehmen. Migration als separater Release-Schritt mit privilegierter Migrationsrolle, API mit beschränkter Laufzeitrolle. Caddy-Konfiguration benötigt echte Domain und gültiges DNS. Container laufen unprivilegiert und mit persistentem DB-Volume.

Vor Rollout: Tests, Build, Migrationsprüfung auf wiederhergestellter Stagingkopie, Backup, Expand/Contract-Kompatibilität, Healthcheck und Smoke-Test. Bei Fehlern API-Version zurückrollen; destructive DB-Rollbacks nur per geprüftem Restore-Plan. Die mitgelieferte Compose-Datei ist Ausgangspunkt und wird ohne verfügbaren Docker-Daemon nicht als live geprüft bezeichnet.

Der Nutzer hat Ubuntu mit Docker als Zielhosting bestätigt. Konkrete Ressourcen, Domain/DNS, externe Datensicherung und Serverhärtung sind dort noch zu prüfen; Cloud-Tests ersetzen diese Prüfung nicht. Keine Produktivveröffentlichung durch diese Aufgabe.
