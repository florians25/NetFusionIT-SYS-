# Ubuntu · Ein-Befehl-Installation und Git-Updates

[Ein-Befehl-Aufruf und Betrieb](../../docker-8070.md). Der Installer klont das Repository, aktualisiert einen sauberen main-Checkout mit Fast-forward-Pull, baut die Anwendung und startet den HTTPS8070-Stack. Vorhandene Einstellungen werden aus den Installationsvolumes übernommen. Updates sichern Datenbank/Rollen, Source-Archiv und fünf Installations-/Caddy-Volumes mit privaten Rechten und SHA256-Manifest, bevor Migrationen laufen.

## Tatsächlich geprüft

- [Acht Konfigurations-/Bootstrapprüfungen samt Dateiprüfsummen](unit-verification.json): automatische bzw. explizite Domain, erhaltene Einstellungen, keine Geheimnisse in Metadatenausgaben, beschädigte/fehlende Konfiguration, vollständiger Download mit temporärer Datei und Nichtausführung fehlgeschlagener Teil-Downloads.
- [Isolierter echter Git-/Docker-/HTTPS-Ablauf](verification.json): neuer Clone, Fast-forward-Pull eines Folgecommits, erste Anmeldung, angelegter Prüfkunde, geändertes Administratorpasswort, Update ohne erneut gesetzte Erstangaben und erhaltene Geheimniskonfiguration.
- Tatsächliche zusätzliche Migration37 ausschließlich in einem synthetischen Test-Checkout/-Image; das Anwendungsschema im Repository und in der Hauptumgebung bleibt36. Geprüfte0.28-Runtime wiederverwendet, Update-Testimage ergänzt nur die Migrationsfixture. Der vollständige ERP-Buildbefehl ist im Ablauf erfasst; ein erneuter vollständiger Anwendungsimage-Build wird durch diesen Test nicht behauptet.
- Geschützte Datenbanksicherung aus dem Update in eine getrennte Datenbank zurückgespielt: ursprünglicher Stand36, Administrator und Prüfkunde erhalten. Fünf Volumearchive, Hashmanifest und0700-/0600-Rechte geprüft. Kein Disaster-Recovery-Test des tatsächlichen Ubuntu-Zielservers.
- Lokale Dateien/Änderungen, fremder Remote, abweichender Branch und explizit geänderte Domain stoppen vor Rebuild/Neustart. Dateien und Anmeldung bleiben erhalten.
- Testcontainer, Testvolumes, Testimage und temporäre Testdateien entfernt. Keine Geschäfts-/Entwicklungsdaten der Hauptumgebung verändert.

Die Sicherung wird lokal angelegt; für externe Aufbewahrung und einen getesteten Wiederanlauf bleibt das Betriebskonzept maßgeblich. Der Installer führt keinen automatischen Datenbank-Rollback und keine Änderungen bestehender Installationsdomains durch.
