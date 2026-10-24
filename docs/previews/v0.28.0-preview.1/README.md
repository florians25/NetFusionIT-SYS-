# Preview0.28 · RT, Teilmengengutschriften und tatsächliche Retoureneingänge

Drei weitere zusammenhängende Backlog-Punkte sind für unbezahlte inländische Direktvertriebs-Warenrechnungen umgesetzt:

1. **Eigene RT-Retourenanmeldung:** Originallieferung, Kunde/AU, angemeldete Menge, geplantes Rücksendedatum, Kundenreferenz und Grund. Eigene App mit Arbeitsvorrat, Filtern, Mengenstand und fachlicher Vertriebsfreigabe.
2. **Teilmengen einer Rechnungsposition gutschreiben:** ursprünglicher Preis, Steuergruppe und Gegenkontierung; unabhängige Finanzfreigabe, eigener GU-/FI-/Gegen-OP-Beleg und verbleibende Forderung. Nicht darstellbare Preis-/Steuercent-Teilungen werden abgewiesen.
3. **Tatsächliche Teil-Retoureneingänge und Storno:** konkrete Istmengen, Eingangs-/Beleg-/Buchungsdatum, Originalfach/-serie/-charge und anteiliger historischer WA-Wert. Separate WE-/SB-Belege mit exakter Finanzgegenbewegung.

[Verbindliche Regeln und Grenzen](../../requirements/customer-returns.md). RT-Anmeldung verändert weder Lager noch Forderung. Ein tatsächlicher Eingang benötigt eine freigegebene RT und zuvor gebuchte GU-Menge. Aktive RT sperrt eine konkurrierende ganze WA-Gegenbewegung. Historische AU-Reservierung und AF bleiben verbraucht; es entstehen keine künstlichen Ticket-/SA-/WOT-/SRM-Belege.

## Native Oberflächen

| Ansicht | Tatsächlicher Screenshot |
| --- | --- |
| RT-Anmeldung in voller Arbeitsbreite | [Anmeldung](return-request-desktop.png) |
| Eigener RT-Arbeitsvorrat und Detail | [Arbeitsvorrat](return-worklist-desktop.png), [Freigegebene RT](return-released-desktop.png) |
| Teilmenge aus der Originalrechnung | [GU-Vorbereitung](quantity-credit-desktop.png) |
| Tatsächliche Eingangsmenge mit Originalfach und GU-Mengenstand | [Desktop](partial-receipt-workspace.png), [Smartphone390px](partial-receipt-mobile.png) |
| Unveränderlicher Eingang und exaktes Storno | [WE](partial-receipt-posted.png), [SB](receipt-reversal-desktop.png) |

Nur native OpenUI5-Controls/Standardtheme, Desktop-Positionsraster, mobile Tabellen, deutsche Daten, aufklappbarer Belegfluss und kleine Anlagenlisten. Bilder und Belege stammen aus isolierten synthetischen Prüfmandanten; keine künstlichen Geschäftsbelege in der Hauptumgebung.

## Belege und Prüfungen

- Tatsächlicher Ablauf: **3 Stück /357,00EUR Original →1 Stück /119,00EUR GU →238,00EUR Rest →1 Stück physischer Eingang /40,00EUR ursprünglicher Warenwert →exakter Storno**. Die Prozessprüfungen buchen danach erneut1 und weitere2 Stück, schließen RT-/Forderungsrest und prüfen weitere Gegenbewegungen samt abschließender RT-Verwerfung.
- [Teilmengen-GU als PDF/A-3](rechnungskorrektur.pdf), [Druckbild](rechnungskorrektur.png), [extrahiertes CII381](rechnungskorrektur.xml) und [normative Dokument-/Barcodeprüfung](document-verification.json). Originalrechnung, Lieferdaten und vollständiger Vertriebsmitarbeiter bleiben erhalten.
- [RT-Geschäfts-PDF](return-request.pdf), [Druckbild](return-request.png), [tatsächlicher WE-Beleg](partial-receipt.pdf), [Druckbild](partial-receipt.png) und [aus den PDFs gescannte Code128-Nachweise](return-document-verification.json).
- [403/403 Gesamttests](test-verification.json), darunter sieben neue mengen-/retourenbezogene Prozessprüfungen: konkurrierende Bindung, Idempotenz, unabhängige GU-Freigabe, OP-/Kostenrest, tatsächliche Mengen, SQL-Unveränderlichkeit, exakte Gegenbewegung, Stornogrenzen, RLS und Erhalt der verbrauchten Quellen.
- [Neuer nativer Browserprozess](browser-verification.json), erneut geprüfte [Positionsgutschriften](legacy-selected-browser-verification.json), [Vollgutschriften](legacy-credit-browser-verification.json) und [Berichte](report-browser-verification.json). Desktop und390px; kein kompletter Browsermatrixlauf behauptet.
- [Upgrade mit vorhandenem Angebotsarchiv](upgrade-verification.json), [private Sicherung vor035](backup-verification.json), [tatsächlicher isolierter Restore34→36](restore-verification.json) und [Hauptumgebung](main-environment.json).001–034 bleiben unverändert; neue035/036 erweitern GU und RT. Vorherige veröffentlichte Artefakte bleiben erhalten.
- [Produktions-Smoke](docker-smoke.json), [HTTPS8070-Erstinstallation und Passworterhalt](docker-install-8070.json), [Image-/Buildzuordnung](build-verification.json). Die endgültigen kompilierten UI-/API-Ausgaben und Migrationen wurden nach Sichtprüfung in das zuvor vollständig gebaute Runtime-Image übernommen und dieses erneut geprüft. Keine Build-CA im Runtime-Image; Nicht-Root und read-only. Isolierte Testcontainer/-volumes entfernt. Kein Registry-Push oder Ubuntu-Zielserverdeployment.

## Verbleibender Umfang

Prüf-/Sperrbestand vor GU, Inspektion und weitere Folgeaktivitäten, Wiederaufbereitung/Verschrottung, automatische Ersatzlieferung und freie Fachwahl, reine Preisgutschriften, Service-/Zahlungskorrekturen, weitere Steuer-/Finanzpartnerfälle und sämtliche übrigen Module bleiben im [Masterbacklog](../../master-backlog-index.md). Dies ist keine vollständige Advanced-Returns- oder SAP-Abdeckung. Der tatsächliche Ubuntu-Zielserver und produktive Betrieb bleiben separat abzunehmen.
