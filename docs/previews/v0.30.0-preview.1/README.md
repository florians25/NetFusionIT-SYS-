# Preview0.30 · Ersteinrichtung, interne Tickets, Korrekturen und Berichte

Zehn beauftragte Backlog-Pakete plus die zusätzliche vollständige Erstkonfiguration der vorhandenen Unternehmensbasis und umfangreiche interne Ticketqualifikation. Ausschließlich native OpenUI5-Controls, Standardtheme und breite Arbeitsseiten. [Feldliste und Regeln des Assistenten/Tickets](../../requirements/initial-setup-internal-tickets.md), [zehn kaufmännische Pakete mit Abnahmegrenzen](../../requirements/commercial-corrections-settlements-reports.md).

## Neue Oberflächen

- [Firma, USt-IdNr., Steuer-/Registerdaten und Geschäftsanschrift](wizard-company-vat-desktop.png).
- [Mehrere Werke, Lagerorte und erste leere Regalfächer](wizard-plants-storage-racks-desktop.png).
- [Vertrieb und Einkauf](wizard-sales-purchasing-desktop.png), [Konten/Perioden](wizard-accounts-periods-desktop.png), [Bank mit unabhängiger Freigabe](wizard-bank-review-desktop.png).
- [Interne Ticketaufnahme mit Diagnose und mehreren echten Assets](ticket-intake-assets-desktop.png).
- [Breite Qualifikationsarbeitsseite](ticket-qualification-workspace.png), [Ticketübersicht](ticket-overview-desktop.png), [390px-Ansicht](ticket-overview-mobile.png) und [mobile Assetliste](ticket-assets-mobile.png).

Der native Erstassistent speichert Firma/USt-IdNr./Steuernummer/Handelsregister/Geschäftsführung, vollständigen Dokumentkontakt, Werke/Lagerorte/optionale Regale, Vertriebs- und Einkaufsorganisation, Bedingungen, Sachkonten/Regeln/Monatsperioden und einen Bankentwurf gemeinsam. Der Terminalassistent führt zuvor durch Server/HTTP oder HTTPS/Mandant/Adminname und ein verdecktes eigenes oder sicher erzeugtes Passwort. Vorhandene Einstellungen und geänderte Passwörter bleiben beim Update erhalten. Bankfreigaben benötigen weiterhin eine andere berechtigte Person.

Interne Tickets führen Kontakt, Standort, Eingangskanal, Kategorie, Auswirkung/Dringlichkeit, Diagnose, Wiedervorlage, Übergabe und mehrere Kundenassets. Rechte/Org/Technikerzuordnung, Version, Kundenabschottung und Assethistorie sind tatsächlich durchgesetzt. Ticket/WOT-Zeiten werden weiter über korrelierte SRM im Serviceauftrag abgerechnet.

## Zehn kaufmännische Backlog-Punkte

1. Reine Preisgutschrift ohne Mengen-/Kosten-/Bestandsrücknahme.
2. Servicegutschrift mit erhaltenem Ticket/WOT/Zeit/SRM/AF-Ursprung.
3. Restgutschrift nach gemischten Mengen-/Preiskorrekturen mit genauer Steuerkapazität.
4. TeilzahlungseingangZE mit tatsächlicher Bank-/Debitorenbuchung.
5. Exakter ZahlungsstornoSB mit historischer OP-Wirkung.
6. RückzahlungZA nach bezahlter Rechnung/GU und kontrollierte Gegenbewegung.
7. Eigene Auftrags-/Liefer-/Fakturavorrat-App mit Originaldrill-down.
8. Eigene Angebotspipeline mit tatsächlicher Annahmequote.
9. Historische Debitoren-/Kreditoren-Altersstruktur mit stichtagsbezogenen Gegenbewegungen.
10. Persönliche Varianten, berechtigter deutscher CSV-Export und Drill-down für diese drei Apps.

Zahlungseingang/Rückzahlung benötigen unabhängige Finanzprüfung. Kein automatischer Bankauftrag; ursprüngliche Rechnungs-/OP-/Archivdaten bleiben erhalten. Servicegutschriften ändern keine tatsächlich erbrachten Zeiten oder Leistungsnachweise. Neue Rechnungskorrekturen verwenden die gemeinsame Schwarz-Weiß-Formularbasis und validiertes ZUGFeRD381.

## Nachweise und Betrieb

[Assistent/Ticket im echten Browser](setup-ticket-browser-verification.json):1920px und390px, tatsächlich gespeicherte USt-ID und Steuerdaten, zwei Werke/drei Lagerorte/20 leere Fächer/zwölf Konten/zwölf Perioden, zwei echte Ticketassets, serverseitige Priorität und breite Bearbeitung, ohne Browser-/APIfehler.

[Reale private Sicherung](backup-verification.json) und [tatsächlicher isolierter Restore mit Upgrade37→42](restore-verification.json): Quellprüfsummen, Datensatzmengen und Tenant-RLS geprüft; isolierte Datenbank anschließend entfernt. Keine Daten des vorgesehenen Ubuntu-Servers wurden dafür verändert.

[HTTP-Installation mit einem Befehl einschließlich Git-Pull, Backup und Update](../../docker-8070.md). Port8070; Betriebsart wird beim interaktiven Erststart abgefragt. Zugangsdaten liegen ausschließlich in der geschützten Datei. Nach Administratoranmeldung öffnet der native Unternehmensassistent; er bleibt als eigene App erreichbar.

Der Assistent richtet die vorhandene deutsche EUR-Basis ein. Konten sind bearbeitbare Vorschläge. Kein externer USt-ID-Bestätigungsdienst, vollständiger Steuerfallkatalog oder abgeschlossenes SAP-Ersatzsystem. Der [übrige Masterbacklog](../../master-backlog-index.md), Bank-/Kreditorenzahlungen, Mahnung/Skonto, weitere Reports, MFA/OIDC, zusätzliche Organisations-/Steuerkonfiguration und echte Zielserver-/Geräteabnahme bleiben offen.
