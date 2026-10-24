# Oberflächenüberarbeitung und nächstes Zwanzigerpaket

Auftrag 24.10.2026 nach Preview0.30: zuerst die gesamte Oberfläche über alle bestehenden Anwendungen verbessern, danach 20 offene Backlog-Punkte umsetzen. Verbindliche Quellen bleiben Masterprompt, Modulübersicht sowie Reporting RPT-07–12, AP-07/08/10, CRM-01/08 und die offenen ITSM-/Asset-/UI-Funktionen. Das Paket ersetzt weder Werkstattreparatur noch weitere Security-/Vertrags-/Steuerpakete.

## Übergreifende Oberfläche zuerst

Alle bestehenden Fachseiten erhalten konsistente native OpenUI5-Tabellenwerkzeuge, lesbare Spaltenköpfe, passende responsive Spalten, klarere Arbeitsseiten/Formulare und sichere mobile Anordnung. Lange Eingaben öffnen breite Arbeitsseiten, kurze Aktionen bleiben native Dialoge. App-Zentrale mit Suche und persönlichen Favoriten; keine globale Leiste aller Anwendungen. Datums-/Betragswerte bleiben deutsch. Keine eigenen Controls, Renderer, CSS oder HTML.

## Zwanzig offene fachliche Lieferpunkte

| Nr. | Backlogbezug | Konkrete Umsetzung und Abnahme |
| --- | --- | --- |
| 01 | ITSM: Beobachter | Aktive interne Beobachter innerhalb der Ticketorganisation, eigene Aufnahme/Austragung, Verlauf; kein zusätzlicher Ticketzugriff allein durch Beobachtung. |
| 02 | ITSM: Problem-/Folgebezüge | Typisierte Ticketbeziehungen mit Gegenrichtung, Org-/Kundenschutz, kein künstlicher kaufmännischer Belegfluss im Ticket. |
| 03 | ITSM: Vorlagen | Wiederverwendbare interne Ticketvorlagen für Anliegen/Kategorie/Diagnose ohne Übernahme fremder Kunden-/Asset-/Vertragsidentitäten. |
| 04 | ITSM: Checklistenstamm | Versionierte Vorlagen mit Pflicht-/Optionalpunkten und nachvollziehbarer Aktivierung/Stilllegung; tatsächlicher Stand wird beim Übernehmen eingefroren. |
| 05 | ITSM/WOT: Checklistenprüfung | Aufgabenbezogene Bestätigungen mit Bearbeiter/Zeit; WOT-Abschluss wird bei offenen Pflichtpunkten serverseitig verhindert. Keine rückwirkende Änderung abgeschlossener SRM. |
| 06 | ITSM: Wissen | Interne Wissensartikel mit Fehlerbild, Ursache, Lösung/Workaround, Entwurf/Veröffentlichung/Stilllegung und Rollen; kein Kundenleck. |
| 07 | ITSM: Known Error | Tatsächliche Wissens-/Known-Error-Verknüpfung am Ticket und dokumentierte Übernahme in die operative Bearbeitung; kein automatisches Schließen. |
| 08 | Installierte Basis: Servicehistorie | Assetbezogene echte Tickets, Einsätze und freigegebene Leistungsnachweise mit Originalnavigation und jeweiliger Berechtigung. |
| 09 | CRM: Aktivitäten | Interne kunden-/lieferantenbezogene Aufgaben/Telefonate/Termine, vollständiger Verantwortlicher, Fälligkeit, Status/Verlauf und Version. |
| 10 | CRM: Dublettenhinweise | Nachvollziehbare Kandidaten aus tatsächlichen normalisierten Stammwerten; keine automatische Zusammenführung historischer Identitäten. |
| 11 | RPT-07: Einkaufsbestand | Freigegebene BANF/Bestellungen, tatsächlich bestellt/geliefert/verrechnet/offen mit Lieferant, Werk und AU-/SA-Ursprung. |
| 12 | RPT-07: Liefertreue | Termin und tatsächliche Teil-WE/Gegenbewegung getrennt; überfällige Restmengen und tatsächliche Erfüllung, keine fiktive Lieferantenbewertung. |
| 13 | RPT-08: Lagerbestand/Bewertung | Freie/reservierte Mengen, tatsächlicher Fach-/Trackingstand und aktuelle Bewertung, Einheiten/Währungen getrennt. |
| 14 | RPT-08: Bewegungen/Inventur | Quellengebundene WE/WA/UL/LK und jeweilige Gegenbewegungen mit echten Mengen/Werten/Datum/Originalnavigation. |
| 15 | RPT-09: Tickets/SLA | Eingänge/offener Stand, tatsächliche Reaktions-/Lösungsereignisse und bestehende SLA-Snapshots/Pausen, fehlende Messbasis ausdrücklich kennzeichnen. |
| 16 | RPT-10: Arbeits-/Fahrzeiten | Echte Arbeits-/Fahrzeiten/Pausen mit WOT/SRM/Fakturastand und Kostenrechten; keine Planzeit als Istzeit oder Arbeitszeitgesetz-Vollnachweis. |
| 17 | AP: Zahlungsfreigabe | Eigene unabhängige Freigabe/Rücknahme der Zahlungssperre auf gebuchten Kreditorenposten; Originalrechnung und ursprünglicher Block bleiben unverändert dokumentiert. |
| 18 | AP: Teilzahlung | Tatsächliche manuelle Bankbewegung: ursprünglicher Kreditor Soll/Bank Haben, unabhängig geprüft, begrenzt auf datierten und aktuellen OP-Rest. Kein Bankauftrag/Skonto/FX. |
| 19 | AP: Zahlungsgegenbuchung | Eigener unabhängig geprüfter SB mit exakter Originalkontierung; ursprüngliche Zahlungen/OP unveränderlich. Bezahlte Rechnung darf vor Gegenbuchung nicht durch bisherigen Rechnungsstorno umgangen werden. |
| 20 | UI/RPT-12: persönliche Arbeitsansichten | Nutzer-/Tenant-private Tabellenansichten über alle bestehenden Fachapps, native Auswahl/Sortierung und App-Favoriten mit erneuter Rollenprüfung; keine geteilten Kundendaten in Einstellungen. |

## Gemeinsame Abnahme

Neue fachliche Änderungen benötigen API-/PostgreSQL-Prüfungen für Rollen/Tenant/Org, Version/Idempotenz, Parallelität, Originalschutz und zulässige Folgeprozesse. Änderungen am WOT-Abschluss werden mit Ticketzeiten → SRM → SA/Faktura gegengeprüft. Tabellen-/Formularänderungen werden über einen vollständigen Maskenkatalog am Desktop und mobil geprüft. Repräsentative tatsächliche Fachabläufe, deutsche CSV/PDF, Restore/Upgrade und aktuelles Docker-/HTTP8070 werden als Preview mit konkreten Grenzen dokumentiert. Keine erledigten Markierungen aus bloßen Kacheln oder Screenshot-Mockups.

Status: Die 20 beschriebenen Lieferpunkte sind implementiert und mit ihren genannten Grenzen geprüft. [Preview 0.31 mit Screenshots, 474/474 Gesamttests, abschließenden betroffenen Prüfungen, 38 Fachprozess-Browserprüfungen, 96 App-Aufrufen, echtem Restore und Docker-/8070-Installation](../previews/v0.31.0-preview.1/README.md). Weitere Modul-/Rechts-/Security-/Betriebspakete bleiben im Masterbacklog offen.

Zusätzliche Prüfgrenzen: Historische Lagerbuch-/Team-Auslastungsberichte, Einkaufs-Preisabweichungen und Erweiterungen der Kontierung sind nicht durch diese sechs Berichte abgeschlossen. Der offene BANF-Berichtsrest wird ausschließlich durch tatsächlich freigegebene Bestellungen reduziert; Entwürfe und laufende Prüfung bleiben davon getrennt. Stabile responsive Facharbeitslisten speichern persönliche Spalten-/Sortieransichten; dynamische kurzlebige Dialogtabellen und native Desktop-Positionsraster haben jeweils ihre eigenen Standardwerkzeuge.
