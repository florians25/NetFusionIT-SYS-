# Docker-Installation auf Port 8070

Im geklonten Repository genügt auf dem Ubuntu-Server mit Docker Engine und Compose v2:

```sh
ERP_DOMAIN=192.168.1.20 docker compose -f compose.quickstart.yaml up -d --build
```

`192.168.1.20` durch die tatsächliche Server-IP oder den Hostnamen ersetzen, ohne Protokoll und Port. Anschließend **`https://192.168.1.20:8070`** öffnen. Für einen ausschließlich lokalen Start kann `ERP_DOMAIN=…` entfallen; die Adresse lautet dann `https://localhost:8070`. Port 8070 muss auf dem Server erreichbar sein. Der erste Build lädt die festgelegten Node-/Java-/OpenUI5-Komponenten und benötigt entsprechend Zeit und Speicher.

Der Befehl erzeugt zufällige Datenbankpasswörter, Sitzungsschlüssel und ein Administratorpasswort in geschützten Docker-Volumes. Danach laufen Migrationen und die einmalige Mandanteneinrichtung automatisch. Es entstehen keine Demo-Konten oder Beispielbelege. Die API läuft als unprivilegierter Benutzer mit schreibgeschütztem Dateisystem; die Datenbank erhält keinen veröffentlichten Hostport. Der API stehen weder das Datenbank-Administratorpasswort noch das Erstpasswort zur Verfügung.

## Anmeldung und HTTPS

Die Zugangsdaten ausschließlich im eigenen Terminal abrufen:

```sh
docker compose -f compose.quickstart.yaml run --rm --no-deps install cat /run/netfusion-install/access.json
```

Die Datei enthält URL, Mandant, Administrator-E-Mail und zufälliges Erstpasswort. Standardmandant ist `netfusion`, die Administrator-E-Mail `admin@example.org`. Eigene Angaben lassen sich **beim ersten Start** mit `ERP_BOOTSTRAP_TENANT`, `ERP_BOOTSTRAP_COMPANY`, `ERP_BOOTSTRAP_NAME` und `ERP_BOOTSTRAP_EMAIL` setzen, beispielsweise über eine lokale, nicht eingecheckte `.env`. Diese Angaben müssen bei späteren Starts gleich bleiben. Zugangsdaten nicht ins Repository, in Tickets oder in Chatnachrichten kopieren.

Der Schnellstart verwendet ein von Caddy erzeugtes internes HTTPS-Zertifikat. Für vertrauenswürdiges HTTPS auf den verwendeten Geräten die **öffentliche Stammzertifikatsdatei** exportieren und im Zertifikatsspeicher der Geräte bzw. des Browsers installieren:

```sh
mkdir -p .local
docker compose -f compose.quickstart.yaml cp caddy:/data/caddy/pki/authorities/local/root.crt .local/netfusion-root.crt
```

Nur `root.crt` verteilen; der private CA-Schlüssel verbleibt im geschützten Caddy-Volume. Die Adresse muss zum beim Start gewählten Hostnamen bzw. zur IP passen. Die Anwendung verwendet auch auf Port 8070 HTTPS und sichere Sitzungscookies. Für öffentlich vertrauenswürdige Domainzertifikate bleibt die getrennte [Produktionskonfiguration](../compose.yaml) mit DNS und Caddy auf 80/443 verfügbar.

## Betrieb und Aktualisierung

Status und Startdiagnose:

```sh
docker compose -f compose.quickstart.yaml ps -a
docker compose -f compose.quickstart.yaml logs --tail 100 initialize install api caddy
```

Für Neustarts und Aktualisierungen denselben Startbefehl mit **derselben `ERP_DOMAIN` und denselben Erstinstallationsangaben** verwenden. Alternativ diese nicht geheimen Angaben dauerhaft in `.env` hinterlegen. Bestehende Mandanten und geänderte Benutzerpasswörter werden beim erneuten Start nicht überschrieben. `access.json` enthält das ursprüngliche Erstpasswort; nach einer Passwortänderung ist es kein aktueller Passwortnachweis.

```sh
docker compose -f compose.quickstart.yaml stop
# Später mit derselben Domain/Einstellung:
ERP_DOMAIN=192.168.1.20 docker compose -f compose.quickstart.yaml up -d --build
```

Vor Updates Datenbank und alle Installations-/Archiv-/Caddy-Volumes sichern. `down` erhält Volumes, **`down --volumes` löscht diese Installationsdaten**. Der Schnellstart benutzt ein eigenes Compose-Projekt `netfusion-erp-8070` und übernimmt keine bestehende Installation aus `compose.yaml`. Bereits dort angelegte Daten benötigen einen geprüften Umzug mit vollständigem Backup; nicht einfach neue leere Volumes starten.

Der technische Installationsnachweis ersetzt die noch offene fachliche und betriebliche Produktivabnahme des ERP nicht. Der verfügbare Ubuntu-Zielserver wurde durch Änderungen im Repository nicht automatisch eingerichtet.

Technisch geprüft: [automatische Erstinstallation, tatsächliches HTTPS8070 und Passworterhalt nach Containerneuanlage](previews/v0.22.0-preview.1/docker-install-8070.json). Interne Dienstadressen sind vom ausgehenden HTTP-Proxy ausgenommen; dies verhindert eine versehentliche Umleitung des Caddy→API-Verkehrs in Proxy-Umgebungen.
