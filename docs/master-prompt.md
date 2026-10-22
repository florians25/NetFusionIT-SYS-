# MASTER-PROMPT V1.0
# ENTERPRISE SERVICE ERP – SAP-S/4HANA-ÄHNLICHES UNTERNEHMENSSYSTEM MIT OPENUI5

## 0. Projektauftrag und oberstes Ziel

Du bist mein leitender Enterprise-Softwarearchitekt, SAP-S/4HANA-Prozessberater, OpenUI5-Entwickler, ITSM-Architekt, Datenbankarchitekt, Backend-Entwickler, ERP-Prozessdesigner, Finanzbuchhaltungsexperte, Security Engineer und Qualitätssicherungsleiter.

Entwickle ein vollständiges, eigenständiges Enterprise-Service-ERP für den produktiven Betrieb eines IT-Dienstleistungsunternehmens.

Dieses System soll langfristig die zentrale Unternehmenssoftware werden.

Es muss Kundenservice, IT-Tickets, Field Service, Dispatching, technische Objekte, Kundenverwaltung, Einkauf, Materialwirtschaft, Lager, Serviceaufträge, Vertrieb, Fakturierung und einfache doppelte Finanzbuchhaltung integrieren.

Die Geschäftsprozesse sollen sich fachlich möglichst genau an den etablierten Prozessprinzipien von SAP S/4HANA orientieren.

Dabei sollen insbesondere folgende SAP-Funktionsbereiche als fachliche Referenz dienen:

- SAP S/4HANA Service
- SAP Customer Service
- SAP Plant Maintenance / Enterprise Asset Management
- SAP Materials Management
- SAP Sales and Distribution
- SAP Financial Accounting
- SAP Controlling
- SAP Business Partner
- SAP Workflow
- SAP Fiori
- SAP Field Service Management

Das System darf jedoch keine SAP-Backend-Lizenz voraussetzen.

**Es muss eine eigene Software sein und nicht nur ein SAP-Frontend.**

### Verbindliche Grundprinzipien

1. Verwende echtes OpenUI5.
2. Orientiere Benutzerführung und Layout an SAP Fiori.
3. Implementiere echte, dauerhaft gespeicherte Geschäftsprozesse.
4. Verwende ein zentrales, konsistentes Belegmodell.
5. Verknüpfe alle betriebswirtschaftlichen Dokumente über einen navigierbaren Belegfluss.
6. Implementiere ein differenziertes Berechtigungssystem.
7. Implementiere eine zentrale Genehmigungs-Engine.
8. Implementiere ein einheitliches Statusmanagement.
9. Implementiere eine sichere und nachvollziehbare Buchungslogik.
10. Verwende transaktionssichere Datenbankoperationen.
11. Implementiere echte Storno- und Korrekturprozesse.
12. Trenne technische, operative und kaufmännische Status.
13. Entwickle die Software modular und erweiterbar.
14. Plane Migration, Backups, Monitoring und Wiederherstellung von Anfang an.
15. Verwende keine Dummy-Funktionen in als fertig deklarierten Modulen.
16. Stelle keine nicht implementierten Geschäftsprozesse als funktionsfähig dar.
17. Arbeite in kleinen, testbaren und abnahmefähigen Entwicklungsschritten.
18. Erhalte die langfristige Wartbarkeit des gesamten Systems.

**Ziel: Ein professionelles Service-ERP, auf dem ein IT-Unternehmen seine tatsächlichen Geschäftsabläufe betreiben kann.**

---

# 1. Technologische Zielarchitektur

## 1.1 Frontend

Verwende ausschließlich echtes OpenUI5 als primäres Anwendungsframework.

Technologien:

- OpenUI5
- SAP-Fiori-Designprinzipien
- XML Views
- JavaScript oder TypeScript, sofern im UI5-Build zuverlässig unterstützt
- UI5 Router
- OData V4 Model
- JSONModel für lokalen UI-Zustand
- `sap.m`
- `sap.f`
- `sap.ui.layout`
- `sap.ui.table`
- `sap.uxap`
- `sap.ui.core`

Prüfe die Verfügbarkeit jeder Komponente in der eingesetzten OpenUI5-Version.

Verwende keine ausschließlich in SAPUI5 verfügbaren proprietären Bibliotheken ohne entsprechende Lizenz.

Wenn eine gewünschte SAP-Komponente nicht in OpenUI5 verfügbar ist, entwickle eine OpenUI5-kompatible Alternative.

Keine React-, Vue- oder Angular-Anwendung, die nur optisch SAP imitiert.

## 1.2 Backend

Bevorzugte Technologien:

- Node.js LTS
- TypeScript
- NestJS
- PostgreSQL
- Prisma oder vergleichbare Datenzugriffsschicht
- OData-v4-kompatible Service-Schicht
- REST-API für externe Integrationen
- Redis für Jobs und Warteschlangen
- Hintergrundverarbeitung für Benachrichtigungen, Eskalationen und Dokumentenerstellung

Verifiziere die technische Kompatibilität der gewählten Komponenten vor der Implementierung.

## 1.3 Architekturprinzip

Verwende zunächst einen modularen Monolithen.

Module müssen fachlich getrennt sein und definierte Schnittstellen besitzen.

Vermeide unnötige Microservices.

Module:

- Identity & Access
- Organization
- Business Partner
- CRM
- Customer Portal
- ITSM
- Service Management
- Dispatching
- Field Service
- Asset Management
- Service Contracts
- Sales
- Pricing
- Material Master
- Inventory
- Procurement
- Warehouse
- Billing
- Finance
- Controlling
- Workflow
- Document Management
- Reporting
- Integration
- Administration

Jedes Modul besitzt klar definierte Datenverantwortlichkeiten.

## 1.4 Hosting

Das System muss unabhängig von SAP BTP betrieben werden können.

Bevorzugt:

- Linux VPS oder dedizierter Server
- Docker Compose
- Nginx oder Caddy
- PostgreSQL
- HTTPS
- Sichere Dateispeicherung
- Automatisierte Backups
- Monitoring
- Separate Test- und Produktionsumgebungen

Prüfe, ob mein vorhandenes Hosting die Anforderungen erfüllt.

Ein klassischer Shared-Webspace darf nicht ohne technische Prüfung als ausreichend angenommen werden.

---

# 2. SAP-Fiori-ähnliches Launchpad

Erstelle eine zentrale Startseite mit rollenabhängigen Kacheln.

## Kacheln

### Service
- Meine Tickets
- Alle Tickets
- Servicefälle
- Serviceaufträge
- Dispatching
- Technikerplanung
- SLA-Überwachung
- Wartungspläne
- Technische Objekte

### Kunden
- Kundenstamm
- Kunden anlegen
- Kundenfreigaben
- Ansprechpartner
- Kundenverträge
- Kundenportal

### Materialwirtschaft
- Artikelstamm
- Artikel anlegen
- Materialbedarf
- Bestandsübersicht
- Lagerbewegungen
- Reservierungen

### Einkauf
- BANF anlegen
- BANF verwalten
- Bestellungen
- Bestellfreigaben
- Wareneingänge
- Eingangsrechnungen

### Vertrieb
- Angebote
- Kundenaufträge
- Serviceaufträge
- Preisfindung
- Fakturavorrat
- Rechnungen
- Rechnungsstorno

### Finanzbuchhaltung
- Debitoren
- Kreditoren
- Hauptbuch
- Buchungsjournal
- Zahlungen
- Offene Posten
- Kontenplan
- Bilanz
- GuV
- Auswertungen

### Administration
- Benutzer
- Rollen
- Organisation
- Workflows
- Nummernkreise
- Buchungsperioden
- Steuern
- Dokumentvorlagen
- Systemeinstellungen

Die Kacheln sollen Zähler, Warnungen und relevante Kennzahlen anzeigen.

---

# 3. Organisationsstruktur

Implementiere eine SAP-ähnliche Organisationsstruktur.

Entitäten:

- Mandant
- Unternehmen
- Buchungskreis
- Geschäftsbereich
- Serviceorganisation
- Servicegruppe
- Einkaufsorganisation
- Einkäufergruppe
- Werk
- Lagerort
- Vertriebsorganisation
- Vertriebsweg
- Sparte
- Kostenstelle
- Profitcenter

Nicht jedes Unternehmen benötigt sämtliche Ebenen.

Organisationsstrukturen müssen konfigurierbar sein.

Alle relevanten Geschäftsbelege müssen ihre organisatorische Zuordnung speichern.

Berechtigungen und Nummernkreise können organisationsabhängig sein.

---

# 4. Geschäftspartner- und Kundenstamm

Entwickle einen zentralen Business-Partner-Stamm.

Ein Geschäftspartner kann mehrere Rollen besitzen:

- Kunde
- Lieferant
- Rechnungsempfänger
- Auftraggeber
- Leistungsempfänger
- Ansprechpartner

## Stammdaten

- Geschäftspartnernummer
- Kunden-/Lieferantennummer
- Name
- Rechtsform
- Adressen
- Kommunikationsdaten
- USt-IdNr.
- Steuerinformationen
- Bankverbindungen
- Zahlungsbedingungen
- Mahnverfahren
- Währung
- Kreditlimit
- Preisgruppe
- Kundengruppe
- Serviceorganisation
- Zuständiger Mitarbeiter
- Status

## Kundenfreigabe

Workflow:

Entwurf
→ Eingereicht
→ Stammdatenprüfung
→ Kaufmännische Prüfung
→ Freigabe
→ Aktiv

Alternativen:

- Abgelehnt
- Rückfrage
- Gesperrt

Konfigurierbare Genehmigungsstufen und Freigabeberechtigungen.

Änderungen kritischer Stammdaten benötigen optional eine erneute Genehmigung.

---

# 5. Externes Kundenportal und Webformulare

Kunden müssen Tickets selbst erstellen können.

Kanäle:

- Öffentliches Webformular
- Authentifiziertes Kundenportal
- REST-API
- Später E-Mail-Integration

## Ticketannahme

Beim Absenden:

1. Eingaben validieren.
2. Spam- und Missbrauchsschutz prüfen.
3. Identität beziehungsweise Kundenzuordnung prüfen.
4. Korrelations-ID erzeugen.
5. Eindeutige Ticketnummer erzeugen.
6. Ticket persistent speichern.
7. Anhänge sicher speichern.
8. Serviceorganisation ermitteln.
9. Eingang bestätigen.
10. Ereignis protokollieren.
11. Ticket in OpenUI5 anzeigen.

Die Korrelations-ID ist für die technische Nachverfolgung zuständig.

Fachliche Belegverknüpfungen müssen zusätzlich über dauerhafte Referenzen erfolgen.

Verhindere doppelte Tickets durch idempotente Verarbeitung.

## Kundenportal

Kunden können:

- Tickets erstellen
- Ticketstatus verfolgen
- Kommentare schreiben
- Anhänge hochladen
- Termine bestätigen
- Angebote freigeben
- Kostenvoranschläge genehmigen
- Leistungsnachweise einsehen
- Rechnungen einsehen
- Technische Objekte anzeigen

Kunden dürfen ausschließlich berechtigte Daten ihres Unternehmens sehen.

---

# 6. Enterprise-Ticketsystem und ITSM

Implementiere ein umfangreiches ITSM-System.

## Ticketarten

- Incident
- Service Request
- Problem
- Change
- Wartung
- Störung
- Reparatur
- Installation
- Reklamation
- Garantie
- Interner IT-Auftrag

## Ticketdaten

### Identifikation
- Ticketnummer
- UUID
- Korrelations-ID
- Externe Referenz
- Tickettyp
- Erstellungsquelle

### Kundenbezug
- Kunde
- Ansprechpartner
- Standort
- Servicevertrag
- Technisches Objekt
- Betroffene Benutzer

### Inhalt
- Kurzbeschreibung
- Langbeschreibung
- Fehlerbild
- Reproduktionsschritte
- Auswirkungen
- Anhänge
- Interne Notizen
- Kundenkommentare

### Priorität
- Auswirkung
- Dringlichkeit
- Priorität
- Kritikalität
- Eskalationsstufe

### Bearbeitung
- Zuständige Gruppe
- Verantwortlicher Mitarbeiter
- Dispatcher
- Techniker
- Bearbeitungsstatus
- Lösungsstatus
- Abschlussgrund

### Zeiten
- Eingang
- Reaktionsfrist
- Lösungsfrist
- Bearbeitungsbeginn
- SLA-Pause
- Technische Lösung
- Abschluss

### Kaufmännische Daten
- Abrechnungshinweis
- Vertrag
- Kostenträger
- Kostenstelle
- Serviceauftrag
- Kostenschätzung
- Abrechnungsstatus

## Statusworkflow

Neu
→ Qualifizierung
→ Zugewiesen
→ In Bearbeitung
→ Wartet auf Kunde
→ Wartet auf Material
→ Wartet auf Hersteller
→ Technisch gelöst
→ Kaufmännisch abgeschlossen
→ Geschlossen

Zusätzlich:

- Eskaliert
- Storniert
- Wiedereröffnet

Statuswechsel müssen über eine zentrale State Machine validiert werden.

## Erweiterte ITSM-Funktionen

- Ticketverknüpfung
- Haupt- und Untertickets
- Ticketzusammenführung
- Wiederkehrende Störungen
- Problem Management
- Known Errors
- Wissensdatenbank
- Change Requests
- Eskalationsmanagement
- Ticketvorlagen
- Automatische Zuweisungsregeln
- Kundenbenachrichtigungen
- Interne Benachrichtigungen
- Wiedervorlagen
- Beobachter
- Checklisten
- Aufgaben
- Aktivitätenhistorie

---

# 7. Eigenständiges Servicefallmanagement

Unterscheide fachlich zwischen:

1. Ticket
2. Servicefall
3. Serviceauftrag
4. Techniker-Einsatz
5. Materialbedarf
6. Leistungsnachweis
7. Fakturabeleg

Diese Objekte dürfen nicht zu einer einzigen Tabelle zusammengefasst werden.

Ein Servicefall kann mehrere Tickets, Einsätze, Aufträge und Materialien enthalten.

## Servicefall-Kopfdaten

- Servicefallnummer
- Vorgangsart
- Kunde
- Standort
- Technisches Objekt
- Vertrag
- Priorität
- Status
- Serviceorganisation
- Dispatcher
- Verantwortlicher
- Geplante Termine
- Tatsächliche Termine
- Kostenschätzung
- Abrechnungsart
- Garantieprüfung
- Serviceauftragsreferenz

## Registerkarten

- Allgemeine Informationen
- Technische Details
- Kunde
- Servicevertrag
- SLA
- Dispatching
- Einsätze
- Tätigkeiten
- Materialien
- Ersatzteile
- Kosten
- Aufträge
- Bestellungen
- Faktura
- Kommunikation
- Genehmigungen
- Historie
- Belegfluss

Jede Registerkarte benötigt echte Datenmodelle und APIs.

---

# 8. Dispatching und Einsatzplanung

Entwickle ein professionelles Dispatching-Cockpit.

## Planungsansichten

- Tagesansicht
- Wochenansicht
- Technikeransicht
- Teamansicht
- Nicht disponierte Einsätze
- Überfällige Einsätze
- SLA-kritische Einsätze
- Kapazitätsübersicht
- Abwesenheiten
- Bereitschaftsplanung

## Technikerstamm

- Mitarbeiter-ID
- Name
- Team
- Qualifikationen
- Zertifikate
- Einsatzgebiet
- Standort
- Arbeitszeitmodell
- Verfügbarkeit
- Bereitschaft
- Urlaub
- Fahrzeug
- Kostenstundensatz

## Dispositionsregeln

Berücksichtige:

- Qualifikation
- Verfügbarkeit
- Kundenstandort
- Einsatzdauer
- SLA
- Priorität
- Kundenvertrag
- Bereitschaft
- Benötigte Ersatzteile
- Fahrtzeit
- Arbeitszeitgrenzen

Erstelle eine regelbasierte automatische Technikerempfehlung.

Der Dispatcher kann die Zuordnung manuell ändern.

## Einsatzstatus

Nicht disponiert
→ Geplant
→ Zugewiesen
→ Bestätigt
→ Unterwegs
→ Vor Ort
→ In Arbeit
→ Unterbrochen
→ Technisch abgeschlossen
→ Abgenommen

## Einsatzfunktionen

- Mehrere Techniker
- Mehrere Termine
- Wiederkehrende Einsätze
- Terminverschiebung
- Materialreservierung
- Einsatzchecklisten
- Arbeitsbericht
- Kundenunterschrift
- Fotos
- Reisekosten
- Zeitbuchungen

Implementiere eine mobilfähige OpenUI5-Oberfläche für Techniker.

---

# 9. SLA-Management

Entwickle eine SLA-Engine.

Unterstütze:

- Reaktionszeit
- Lösungszeit
- Wiederherstellungszeit
- Vor-Ort-Zeit
- Verfügbarkeit
- Vertragsabhängige Servicezeiten
- Feiertagskalender
- Zeitzonen
- Pausenbedingungen
- Eskalationsstufen

SLA-Zeitberechnung muss reproduzierbar und testbar sein.

SLA-Verletzungen müssen historisiert werden.

---

# 10. Technische Objekte und installierte Basis

Implementiere eine technische Objektverwaltung.

Objektarten:

- Server
- Notebook
- PC
- Netzwerkgerät
- Firewall
- Drucker
- Software
- Lizenz
- Infrastrukturkomponente
- Sonstige Anlage

Daten:

- Objektnummer
- Kunde
- Standort
- Hersteller
- Modell
- Seriennummer
- Inventarnummer
- Installationsdatum
- Garantieende
- Wartungsvertrag
- Komponenten
- Servicehistorie

Unterstütze technische Objektstrukturen und Beziehungen.

Ein Servicefall kann mehrere technische Objekte betreffen.

---

# 11. Serviceverträge und Wartungsverträge

Vertragsarten:

- Managed Service
- Wartungsvertrag
- Stundenkontingent
- Flatrate
- SLA-Vertrag
- Garantievertrag
- Einzelservicevertrag

Vertragsdaten:

- Vertragsnummer
- Kunde
- Gültigkeit
- Leistungsumfang
- SLA
- Enthaltene Stunden
- Enthaltene Materialien
- Abrechnungssätze
- Pauschalen
- Kündigungsfristen
- Abrechnungsintervalle
- Verlängerungsregeln

Vertragsregeln beeinflussen:

- Ticketpriorität
- SLA
- Abrechenbarkeit
- Stundensätze
- Materialpreise
- Automatische Faktura
- Eskalation

---

# 12. Serviceaufträge

Implementiere ein eigenständiges Serviceauftragsmodul.

## Auftragstypen

- Kostenpflichtiger Service
- Wartung
- Reparatur
- Garantie
- Interner Service
- Kulanz
- Projektbezogener Service

## Serviceauftragspositionen

- Position
- Artikel
- Beschreibung
- Menge
- Einheit
- Preis
- Rabatt
- Steuer
- Kostenstelle
- Kostenträger
- Abrechnungsregel
- Leistungsstatus
- Fakturastatus

## Automatische Auftragserstellung

Wenn im Ticket „Kostenpflichtig“ ausgewählt wird:

1. Kundenstatus prüfen.
2. Vertrag prüfen.
3. Vorhandenen Serviceauftrag suchen.
4. Serviceartikel bestimmen.
5. Preisfindung durchführen.
6. Serviceauftrag erstellen.
7. Ticket verknüpfen.
8. Belegfluss aktualisieren.
9. Ereignis protokollieren.

Bei Garantie oder internem IT-Service darf nicht automatisch eine kostenpflichtige Kundenposition erzeugt werden.

Materialbedarf bleibt dennoch möglich.

## Auftragsstatus

Entwurf
→ In Prüfung
→ Freigegeben
→ In Ausführung
→ Technisch abgeschlossen
→ Fakturabereit
→ Teilfakturiert
→ Vollständig fakturiert
→ Abgeschlossen

---

# 13. Artikel- und Materialstamm

Entwickle einen SAP-ähnlichen Materialstamm.

## Artikelarten

- Dienstleistung
- Ersatzteil
- Handelsware
- Lagerartikel
- Nichtlagerartikel
- Verbrauchsmaterial
- Softwarelizenz
- Hardware
- Fremdleistung

## Stammdaten

- Materialnummer
- Kurztext
- Langtext
- Materialart
- Warengruppe
- Mengeneinheit
- Hersteller
- Herstellerartikelnummer
- Lieferant
- Lagerort
- Mindestbestand
- Meldebestand
- Seriennummernpflicht
- Chargenpflicht
- Steuerkennzeichen
- Bewertungsart

## Preisarten

- Manueller EK
- Manueller VK
- Standard-EK
- Durchschnittlicher EK
- Lieferanten-EK
- Listen-VK
- Kundenindividueller VK
- Vertragspreis
- Projektpreis

Preise müssen zeitabhängig, versioniert und nachvollziehbar sein.

Historische Belege behalten ihre ursprünglich ermittelten Konditionen.

## Artikelgenehmigung

Entwurf
→ Prüfung
→ Freigabe
→ Aktiv

Optional:

- Gesperrt
- Auslaufend
- Archiviert

---

# 14. Preisfindung und Konditionstechnik

Implementiere eine zentrale Preisfindungs-Engine nach SAP-ähnlichen Prinzipien.

Unterstütze:

- Preislisten
- Kundenpreise
- Artikelpreise
- Kundengruppenpreise
- Vertragskonditionen
- Mengenstaffeln
- Rabatte
- Zuschläge
- Währungen
- Gültigkeitszeiträume
- Steuerkennzeichen

Definiere Konditionsarten.

Beispiel:

PR00 – Grundpreis
K001 – Kundenrabatt
K002 – Mengenrabatt
FRA1 – Fracht
MWST – Umsatzsteuer

Diese Kürzel dienen als eigene konfigurierbare Bezeichnungen.

Implementiere eine definierte Konditionsreihenfolge und Preisfindungsprotokolle.

Die Preisfindung muss reproduzierbar sein.

---

# 15. Materialbedarf aus Tickets

Ein Techniker kann Materialbedarf direkt im Servicefall oder Einsatz erfassen.

Ablauf:

1. Materialbedarf anlegen.
2. Artikel auswählen.
3. Bestand prüfen.
4. Verfügbaren Bestand reservieren.
5. Fehlmenge ermitteln.
6. Beschaffungsbedarf erzeugen.
7. BANF erstellen.
8. Ticket, Einsatz und Serviceauftrag verknüpfen.

Unterstütze:

- Mehrere Materialien
- Teilmengen
- Ersatzartikel
- Seriennummern
- Dringlichkeitsbeschaffung
- Direktlieferung
- Lagerentnahme
- Rückgabe unbenutzten Materials

Materialanforderung, Reservierung, Wareneingang und tatsächlicher Verbrauch sind getrennte Buchungsvorgänge.

---

# 16. Bestellanforderungen (BANF)

Implementiere SAP-ähnliche Bestellanforderungen.

## BANF-Kopf

- BANF-Nummer
- Ersteller
- Organisation
- Datum
- Status
- Genehmigungsstatus

## BANF-Position

- Positionsnummer
- Artikel
- Beschreibung
- Menge
- Einheit
- Bedarfstermin
- Wunschlieferant
- Geschätzter Preis
- Währung
- Kostenstelle
- Kontierung
- Serviceauftrag
- Ticket
- Lagerort

## BANF-Workflow

Entwurf
→ Eingereicht
→ In Genehmigung
→ Freigegeben
→ Teilweise bestellt
→ Vollständig bestellt

Unterstütze Teilmengen und Restmengen.

---

# 17. Einkauf und Bestellungen

Nur berechtigte Einkäufer dürfen Bestellungen erstellen.

## Funktionen

- Bestellung aus BANF
- Freie Bestellung
- Lieferantenauswahl
- Lieferantenpreise
- Konditionen
- Liefertermine
- Bestellfreigaben
- Bestelländerungen
- Teilbestellungen
- Storno
- Bestellhistorie
- PDF-Bestellung
- E-Mail-Versand

## Bestellstatus

Entwurf
→ In Genehmigung
→ Freigegeben
→ Versendet
→ Teilweise geliefert
→ Vollständig geliefert
→ Abgeschlossen

Die Bestellmenge muss mit BANF, Wareneingang und Rechnungsprüfung abgestimmt werden.

---

# 18. Wareneingang

Implementiere eine SAP-ähnliche Wareneingangsbuchung.

Funktionen:

- Bestellung auswählen
- Offene Positionen anzeigen
- Wareneingangsmenge erfassen
- Teilwareneingang
- Überlieferungstoleranzen
- Unterlieferung
- Lagerort
- Seriennummern
- Chargen
- Lieferscheinnummer
- Buchungsdatum
- Belegdatum
- Wareneingangsstorno

Beim Buchen:

1. Berechtigung prüfen.
2. Bestellung prüfen.
3. Offene Mengen prüfen.
4. Materialbeleg erzeugen.
5. Bestand aktualisieren.
6. Bewertungslogik ausführen.
7. Buchhaltungsrelevanz bestimmen.
8. Belegfluss aktualisieren.
9. Audit-Ereignis speichern.

Alle Schritte müssen konsistent ausgeführt werden.

---

# 19. Lagerverwaltung

Implementiere:

- Werke
- Lagerorte
- Lagerbestände
- Reservierungen
- Wareneingänge
- Warenausgänge
- Umlagerungen
- Inventur
- Bestandskorrekturen
- Seriennummern
- Chargen
- Mindestbestände
- Materialbewegungshistorie

Bestandsänderungen dürfen nur über nachvollziehbare Materialbewegungen erfolgen.

Verhindere unzulässige negative Bestände.

---

# 20. Materialverbrauch im Field Service

Techniker müssen Materialien auf Einsätze und Serviceaufträge buchen können.

Ablauf:

1. Ticket öffnen.
2. Material auswählen.
3. Verfügbaren Bestand prüfen.
4. Entnahmemenge erfassen.
5. Kostenobjekt bestimmen.
6. Materialbewegung buchen.
7. Bestand reduzieren.
8. Verbrauchsbeleg erzeugen.
9. Kosten zuordnen.
10. Fakturarelevanz bestimmen.

Bei kostenpflichtigem Service wird die Materialposition für die Fakturierung vorbereitet.

Bei Garantie erfolgt eine entsprechende interne Kostenbehandlung.

Bei internem IT-Service wird eine Kostenstelle belastet, sofern die Kontierungsregeln dies vorsehen.

---

# 21. Technikerzeiten und Leistungsnachweise

Funktionen:

- Start/Stopp-Zeiterfassung
- Manuelle Zeiterfassung
- Ticketzuordnung
- Einsatzzuordnung
- Serviceauftragszuordnung
- Tätigkeitsbeschreibung
- Abrechenbare Zeit
- Nicht abrechenbare Zeit
- Zuschläge
- Reisekosten
- Pausen
- Kundenbestätigung
- Freigabe durch Serviceleiter

Unterscheide:

- Erfasste Zeit
- Geprüfte Zeit
- Freigegebene Zeit
- Fakturierte Zeit

Bereits fakturierte Leistungen dürfen nicht unkontrolliert geändert werden.

---

# 22. Fakturierung

Implementiere eine SAP-ähnliche Fakturaverarbeitung.

## Fakturavorrat

Zeige alle abrechenbaren Positionen:

- Arbeitszeiten
- Materialverbrauch
- Servicepauschalen
- Vertragsleistungen
- Fahrtkosten
- Zuschläge

Unterstütze:

- Fakturasperren
- Teilfakturierung
- Sammelfakturierung
- Monatsabrechnung
- Wiederkehrende Faktura
- Rechnungsvorschau
- Rechnungsfreigabe

## Rechnungserstellung

Beim finalen Buchen:

1. Berechtigung prüfen.
2. Abrechnungsdaten validieren.
3. Preise fixieren.
4. Steuerberechnung durchführen.
5. Rechnungsnummer vergeben.
6. Rechnungsdatensatz unveränderlich festschreiben.
7. PDF erzeugen.
8. E-Rechnung erzeugen.
9. Debitorenposten erzeugen.
10. Buchhaltungsbeleg erzeugen.
11. Fakturastatus aktualisieren.
12. Belegfluss aktualisieren.

Unterstütze XRechnung und ZUGFeRD mit validierten Implementierungen.

---

# 23. Rechnungsstorno und Rechnungskorrektur

Implementiere einen vollständigen Stornoprozess.

Eine gebuchte Rechnung darf niemals einfach gelöscht werden.

## Stornoablauf

1. Rechnung öffnen.
2. Stornoaktion auswählen.
3. Stornogrund erfassen.
4. Berechtigung prüfen.
5. Buchungsperiode prüfen.
6. Zahlungsstatus prüfen.
7. Genehmigung prüfen.
8. Stornobeleg erzeugen.
9. Erforderliches Korrekturdokument erstellen.
10. Buchhalterische Gegenbuchung erzeugen.
11. Offene Posten korrigieren.
12. Belegfluss aktualisieren.
13. Ursprungsrechnung erhalten.

Unterscheide:

- Vollstorno
- Rechnungskorrektur
- Teilkorrektur
- Preisgutschrift
- Rückerstattung
- Verrechnung

Bei bereits bezahlten Rechnungen sind Zahlungs- und Ausgleichsprozesse gesondert zu behandeln.

Verhindere doppelte Stornierung durch technische und fachliche Sperren.

---

# 24. Professionelle PDF-Formulare

Entwickle eine zentrale Formularengine.

Dokumentarten:

- Angebot
- Auftragsbestätigung
- Serviceauftrag
- Einsatzauftrag
- Arbeitsbericht
- Leistungsnachweis
- Wartungsprotokoll
- Bestellung
- Wareneingangsbeleg
- Materialentnahmeschein
- Rechnung
- Sammelrechnung
- Stornorechnung
- Rechnungskorrektur
- Gutschrift
- Mahnung
- Kontoauszug

## Anforderungen

- Professionelles einheitliches Layout
- Firmenlogo
- Absender
- Empfänger
- Belegnummer
- Belegdatum
- Kundenreferenz
- Positionstabelle
- Mengen
- Einzelpreise
- Rabatte
- Steuern
- Gesamtsummen
- Zahlungsbedingungen
- Bankverbindung
- Fußzeile
- Mehrseitige Dokumente
- Seitenzahlen
- Dokumentenvorschau
- PDF-Download
- E-Mail-Versand
- Archivierung
- Vorlagenversionierung

Gestalte die Dokumente SAP-typisch in Struktur und Professionalität, ohne proprietäre SAP-Formulare oder Markenkennzeichen zu kopieren.

---

# 25. Einfache integrierte Finanzbuchhaltung

Implementiere eine echte doppelte Buchführung für den definierten Unternehmensumfang.

Die Finanzbuchhaltung muss sauber von operativen Belegen getrennt sein.

## Kontenplan

Unterstütze konfigurierbare Kontenpläne, beispielsweise orientiert an SKR03/SKR04.

Kontenarten:

- Aktiva
- Passiva
- Aufwand
- Ertrag
- Debitoren
- Kreditoren
- Steuerkonten

## Buchungsjournal

Jeder Buchungsbeleg besitzt:

- Belegnummer
- Buchungskreis
- Geschäftsjahr
- Buchungsperiode
- Belegdatum
- Buchungsdatum
- Buchungstext
- Referenz
- Buchungspositionen
- Soll/Haben
- Konto
- Betrag
- Währung
- Steuerkennzeichen
- Kostenstelle
- Ersteller
- Buchungszeit

Jeder Buchungsbeleg muss ausgeglichen sein.

Verwende Decimal-Arithmetik für Geldbeträge.

Gebuchte Journaleinträge dürfen nicht nachträglich überschrieben werden.

Korrekturen erfolgen über dokumentierte Gegenbuchungen.

## Debitoren

- Ausgangsrechnungen
- Forderungen
- Offene Posten
- Zahlungseingänge
- Teilzahlungen
- Überzahlungen
- Gutschriften
- Stornos
- Mahnungen
- Ausgleich

## Kreditoren

- Eingangsrechnungen
- Lieferantenkonten
- Verbindlichkeiten
- Bestellbezug
- Wareneingangsbezug
- Rechnungsprüfung
- Zahlungsausgänge
- Gutschriften

## Hauptbuch

- Kontenstamm
- Buchungsjournal
- Kontoblatt
- Summen- und Saldenliste
- Periodensteuerung
- Manuelle Buchungen
- Stornobuchungen
- Steuerkonten
- Abschlussbuchungen

## Berichte

- Bilanzentwurf
- GuV
- BWA
- Offene-Posten-Liste
- Debitorensalden
- Kreditorensalden
- Umsatzsteuer-Auswertung
- Kostenstellenbericht
- Erlösbericht

## Buchungsautomatik

Definiere konfigurierbare Kontierungsregeln.

Beispiel Ausgangsrechnung:

Soll: Forderungen

Haben: Umsatzerlöse

Haben: Umsatzsteuer

Beispiel Zahlungseingang:

Soll: Bank

Haben: Forderungen

Beispiel Rechnungsstorno:

Erzeuge die erforderlichen Gegenbuchungen nach der definierten Stornologik.

## DATEV

Implementiere:

- DATEV-kompatiblen Buchungsexport
- Kontenzuordnung
- Debitoren-/Kreditorenexport
- Belegreferenzen
- Validierungsberichte

Die fachliche Korrektheit ist mit einem Steuerberater zu prüfen.

---

# 26. Genehmigungs-Engine

Implementiere eine zentrale, konfigurierbare Workflow-Engine.

Anwendungsfälle:

- Kundenanlage
- Kundenänderung
- Artikelanlage
- Preisänderung
- Serviceauftragsfreigabe
- BANF-Freigabe
- Bestellfreigabe
- Eingangsrechnungsfreigabe
- Ausgangsrechnungsfreigabe
- Rechnungsstorno
- Manuelle Finanzbuchung

Genehmigungen können abhängig sein von:

- Betrag
- Buchungskreis
- Kostenstelle
- Organisation
- Rolle
- Artikelgruppe
- Kundengruppe
- Risikostufe

Unterstütze:

- Mehrstufige Freigaben
- Vier-Augen-Prinzip
- Vertretungen
- Rückfragen
- Ablehnungen
- Eskalationen
- Freigabehistorie

---

# 27. Rollen und Berechtigungen

Implementiere serverseitig durchgesetzte Berechtigungen.

Rollen:

- Systemadministrator
- IT-Support
- Serviceleiter
- Dispatcher
- Techniker
- Field-Service-Techniker
- Kundenstammdatenverwalter
- Einkäufer
- Einkaufsleiter
- Lagerist
- Vertriebsmitarbeiter
- Fakturamitarbeiter
- Buchhalter
- Controller
- Geschäftsführer
- Kundenbenutzer

Prüfe Berechtigungen auf:

- Modul
- Aktion
- Organisation
- Belegtyp
- Belegstatus
- Datenbereich

Beispiele:

Ein Techniker darf Materialbedarf erfassen, aber keine Bestellung freigeben.

Ein Dispatcher darf Techniker zuweisen, aber keine Finanzbuchung ausführen.

Ein Buchhalter darf Rechnungen buchen, aber nicht automatisch alle Kundenstammdaten verändern.

Ein Kunde darf nur seine berechtigten Tickets und Rechnungen sehen.

---

# 28. Zentrales Belegflussmodell

Jeder Geschäftsbeleg erhält:

- Technische UUID
- Fachliche Belegnummer
- Belegart
- Status
- Ersteller
- Erstellungsdatum
- Organisation
- Referenzen
- Version
- Historie

Definiere ein generisches Document-Relation-Modell.

Beispiel:

Ticket
→ Servicefall
→ Serviceauftrag
→ Materialbedarf
→ BANF
→ Bestellung
→ Wareneingang
→ Materialverbrauch
→ Leistungsnachweis
→ Rechnung
→ Buchhaltungsbeleg
→ Zahlung

Implementiere eine grafische OpenUI5-Belegflussansicht.

Jeder Beleg muss anklickbar sein.

Beziehungen müssen bidirektional navigierbar sein.

Unterstütze auch Verzweigungen, Teilbelege und mehrere Referenzen.

---

# 29. Nummernkreise

Implementiere eine zentrale Nummernkreisverwaltung.

Beispiele:

- Kunde: 10000001
- Ticket: TCK-2026-000001
- Servicefall: SVC-2026-000001
- Serviceauftrag: SVO-2026-000001
- Material: MAT-000001
- BANF: PR-2026-000001
- Bestellung: PO-2026-000001
- Wareneingang: GR-2026-000001
- Rechnung: INV-2026-000001
- Buchhaltungsbeleg: ACC-2026-000001

Nummernkreise müssen:

- Eindeutig
- Parallelitätssicher
- Konfigurierbar
- Organisationsabhängig, falls erforderlich
- Historisch nachvollziehbar

sein.

Behandle gesetzlich relevante Rechnungsnummern gesondert.

---

# 30. Reporting und Controlling

Erstelle Dashboards für:

- Offene Tickets
- SLA-Verletzungen
- Techniker-Auslastung
- Serviceumsatz
- Nicht fakturierte Leistungen
- Materialkosten
- Einkauf
- Lagerwert
- Forderungen
- Verbindlichkeiten
- Umsatz
- Deckungsbeiträge
- Kundenprofitabilität
- Servicevertragsprofitabilität

Berichte müssen auf echten Buchungs- und Bewegungsdaten basieren.

Keine statischen Demo-Kennzahlen in produktiven Ansichten.

---

# 31. Sicherheits- und Betriebsanforderungen

Implementiere:

- Sichere Anmeldung
- MFA-Unterstützung
- Rollenbasierte Berechtigungen
- Sichere Sessions
- TLS
- CSRF-Schutz
- XSS-Schutz
- SQL-Injection-Schutz
- Rate Limiting
- Audit-Trails
- Mandantentrennung
- Datenschutzkonzept
- Sichere Datei-Uploads
- Virenprüfung
- Verschlüsselte Backups
- Backup-Rotation
- Wiederherstellungstests
- Monitoring
- Fehlerprotokollierung
- Alarmierung
- Versionsmigrationen
- Health Checks
- Deployment-Rollback

Verwende für kritische Buchungen:

- Datenbanktransaktionen
- Idempotency-Keys
- Sperrmechanismen
- Optimistic Locking
- Eindeutige Constraints
- Reproduzierbare Buchungsregeln

---

# 32. Datenbankarchitektur

Erstelle ein normalisiertes PostgreSQL-Datenmodell.

Zentrale Entitäten:

- Tenant
- Company
- CompanyCode
- Organization
- User
- Role
- Permission
- BusinessPartner
- Customer
- Supplier
- Contact
- Address
- CustomerApproval
- ServiceContract
- SLA
- Ticket
- TicketEvent
- ServiceCase
- ServiceOrder
- ServiceOrderItem
- Technician
- DispatchAssignment
- FieldServiceVisit
- TechnicalObject
- Material
- MaterialPrice
- PriceCondition
- MaterialRequirement
- InventoryStock
- InventoryReservation
- StockMovement
- PurchaseRequisition
- PurchaseRequisitionItem
- PurchaseOrder
- PurchaseOrderItem
- GoodsReceipt
- GoodsReceiptItem
- GoodsIssue
- TimeEntry
- ServiceReport
- Invoice
- InvoiceItem
- InvoiceCancellation
- CreditNote
- Payment
- AccountingDocument
- AccountingEntry
- GLAccount
- FiscalPeriod
- CostCenter
- ApprovalWorkflow
- ApprovalStep
- DocumentRelation
- DocumentAttachment
- AuditLog

Definiere:

- Primärschlüssel
- Fremdschlüssel
- Unique Constraints
- Indizes
- Versionierungsfelder
- Mandantenzuordnung
- Löschregeln
- Historisierung
- Transaktionsgrenzen

---

# 33. Vollständige End-to-End-Testprozesse

Implementiere automatisierte Tests für folgende Szenarien.

## Szenario A – Kostenpflichtiger Service

Kunde erstellt Ticket
→ Servicefall entsteht
→ Dispatcher plant Einsatz
→ Techniker führt Diagnose durch
→ Serviceauftrag entsteht
→ Materialbedarf wird erfasst
→ BANF entsteht
→ Einkäufer bestellt
→ Lager bucht Wareneingang
→ Techniker verbraucht Material
→ Arbeitszeit wird erfasst
→ Leistungsnachweis wird freigegeben
→ Rechnung entsteht
→ Buchhaltungsbeleg entsteht
→ Zahlungseingang wird gebucht
→ Offener Posten wird ausgeglichen

## Szenario B – Garantiefall

Ticket
→ Garantieprüfung
→ Servicefall
→ Techniker
→ Ersatzteil
→ Materialverbrauch
→ Garantie-Kostenträger
→ Abschluss ohne kostenpflichtige Kundenrechnung

## Szenario C – Interne IT-Störung

Internes Ticket
→ Supportgruppe
→ Techniker
→ Materialverbrauch
→ Kostenstelle
→ Technischer Abschluss

## Szenario D – Rechnungsstorno

Gebuchte Rechnung
→ Stornoantrag
→ Genehmigung
→ Stornobeleg
→ Gegenbuchung
→ Offene-Posten-Korrektur
→ Aktualisierter Belegfluss

## Szenario E – Teilbeschaffung

Materialbedarf 10 Stück
→ BANF 10 Stück
→ Bestellung 6 Stück
→ Teilwareneingang 4 Stück
→ Zweiter Wareneingang 2 Stück
→ Restbedarf 4 Stück
→ Zweite Bestellung
→ Abschließender Wareneingang

Alle Mengen und Status müssen korrekt bleiben.

---

# 34. Entwicklungs- und Lieferstrategie

Entwickle das System in klaren Phasen.

## Phase 1: Technisches Fundament

- Repository
- Architektur
- OpenUI5 Shell
- Backend
- PostgreSQL
- Authentifizierung
- Rollen
- Organisation
- Logging
- Deployment

## Phase 2: Kunden und Tickets

- Geschäftspartner
- Kundenfreigabe
- Kundenportal
- Ticketannahme
- Korrelations-ID
- Ticket-Objektseite
- Statusworkflow

## Phase 3: Service Management

- Servicefälle
- SLA
- Dispatching
- Techniker
- Einsätze
- Technische Objekte
- Serviceverträge

## Phase 4: Serviceaufträge

- Auftragsarten
- Positionen
- Abrechnungshinweise
- Automatische Auftragserstellung
- Preisfindung
- Zeiterfassung

## Phase 5: Materialwirtschaft

- Artikelstamm
- Preise
- Lager
- Materialbedarf
- Reservierungen
- Materialverbrauch

## Phase 6: Einkauf

- BANF
- Genehmigungen
- Bestellungen
- Wareneingang
- Eingangsrechnungsprüfung

## Phase 7: Faktura

- Fakturavorrat
- Rechnungen
- PDF-Formulare
- E-Rechnungen
- Rechnungsstorno
- Rechnungskorrekturen

## Phase 8: Finanzbuchhaltung

- Kontenplan
- Buchungsjournal
- Debitoren
- Kreditoren
- Zahlungen
- Perioden
- DATEV
- Finanzberichte

## Phase 9: Controlling

- Kostenstellen
- Erlöse
- Kosten
- Deckungsbeiträge
- Dashboards

## Phase 10: Produktivbetrieb

- Integrationstests
- Sicherheitstests
- Lasttests
- Datenmigration
- Backup- und Restore-Test
- Fachliche Abnahme
- Produktivsetzung

---

# 35. Verbindliche Definition of Done

Ein Modul ist erst fertig, wenn:

1. Das Frontend funktioniert.
2. Das Backend funktioniert.
3. Die Datenbank persistent speichert.
4. Berechtigungen geprüft werden.
5. Statusübergänge korrekt sind.
6. Geschäftsregeln implementiert sind.
7. Fehlerfälle behandelt werden.
8. Automatisierte Tests bestehen.
9. API und Datenmodell dokumentiert sind.
10. Belegverknüpfungen funktionieren.
11. Audit-Ereignisse gespeichert werden.
12. Keine unbeabsichtigten Doppelbuchungen entstehen.
13. Neustarts und Wiederholungen sicher verarbeitet werden.
14. Der relevante End-to-End-Prozess erfolgreich getestet wurde.

Für buchhalterische und steuerliche Funktionen ist zusätzlich eine fachliche Abnahme erforderlich.

---

# 36. Arbeitsweise von Codex

Arbeite nicht unkontrolliert an allen Modulen gleichzeitig.

Gehe systematisch vor.

## Schritt 1 – Analyse

Analysiere sämtliche Anforderungen.

Identifiziere:

- Fachliche Abhängigkeiten
- Unklare Geschäftsregeln
- Sicherheitsrisiken
- Buchhaltungsrisiken
- Technische Abhängigkeiten
- Hostinganforderungen

Stelle gezielte Rückfragen zu Entscheidungen, die nicht sicher abgeleitet werden können.

## Schritt 2 – Dokumentation

Erstelle:

- docs/architecture.md
- docs/domain-model.md
- docs/database-schema.md
- docs/business-processes.md
- docs/service-management.md
- docs/dispatching.md
- docs/material-management.md
- docs/procurement.md
- docs/billing.md
- docs/accounting.md
- docs/document-flow.md
- docs/workflows.md
- docs/authorization.md
- docs/api-design.md
- docs/security.md
- docs/deployment.md
- docs/test-strategy.md
- docs/implementation-plan.md

## Schritt 3 – Architekturprüfung

Prüfe:

- OpenUI5-Kompatibilität
- OData-v4-Unterstützung
- Datenbanktransaktionen
- Deployment
- Lizenzfragen
- Sicherheit
- Skalierbarkeit
- Wartbarkeit

## Schritt 4 – Projektgrundlage

Erstelle eine lauffähige Projektstruktur mit:

- Frontend
- Backend
- Datenbank
- Migrationen
- Testframework
- Docker-Konfiguration
- Dokumentation

## Schritt 5 – Erste vertikale Funktion

Implementiere:

Kundenformular
→ Backend-API
→ Validierung
→ Datenbank
→ Ticket
→ Korrelations-ID
→ OpenUI5-Ticketansicht

Alle Teile müssen tatsächlich funktionieren.

## Schritt 6 – Iterative Entwicklung

Implementiere danach Modul für Modul.

Führe nach jeder Änderung Tests aus.

Dokumentiere:

- Fertige Funktionen
- Offene Funktionen
- Bekannte Fehler
- Testabdeckung
- Risiken
- Nächste Schritte

---

# 37. Zusätzliche verbindliche Anforderungen für unternehmenskritischen Betrieb

Dieses ERP soll langfristig produktiv für ein reales Unternehmen eingesetzt werden.

Deshalb gelten folgende zusätzlichen Regeln.

## 37.1 Keine stillschweigenden fachlichen Annahmen

Wenn Geschäftsregeln nicht eindeutig definiert sind, stelle Rückfragen.

Insbesondere bei:

- Umsatzsteuer
- Garantie
- Storno
- Materialbewertung
- Lagerkontierung
- Rechnungskorrekturen
- Zahlungszuordnung
- Buchungsperioden
- Kundenfreigaben
- Genehmigungsgrenzen

## 37.2 Keine direkten Datenmanipulationen

Geschäftsbelege dürfen nicht durch unkontrollierte Datenbankupdates verändert werden.

Verwende definierte Business-Services und Statusübergänge.

## 37.3 Revisionsfähige Historie

Speichere alle wesentlichen Geschäftsereignisse nachvollziehbar.

Für buchhalterische Daten muss eine geeignete unveränderliche beziehungsweise gegen nachträgliche Manipulation abgesicherte Aufbewahrungslösung konzipiert werden.

## 37.4 Datenmigration

Plane Importfunktionen für:

- Kunden
- Lieferanten
- Artikel
- Lagerbestände
- Offene Tickets
- Verträge
- Offene Rechnungen
- Anfangssalden

Jede Migration benötigt Validierung, Protokoll und Abstimmung.

## 37.5 Release-Management

Implementiere:

- Versionsverwaltung
- Datenbankmigrationen
- Testumgebung
- Staging-Umgebung
- Rollback-Strategie
- Release Notes
- Abnahmetests

## 37.6 Geschäftskritische Tests

Teste insbesondere:

- Parallele Buchungen
- Doppelte Requests
- Netzwerkunterbrechungen
- Serverneustarts
- Datenbankfehler
- Teilweise fehlgeschlagene Prozesse
- Fehlende Berechtigungen
- Buchungen in gesperrten Perioden
- Negative Bestände
- Überlieferungen
- Doppelte Rechnungen
- Doppelte Stornos
- Falsche Steuerkennzeichen
- Falsche Kundenzuordnung

## 37.7 Keine unbelegten Compliance-Versprechen

Bezeichne das System nicht automatisch als:

- GoBD-konform
- Steuerrechtlich vollständig korrekt
- Revisionssicher
- Zertifiziert
- SAP-kompatibel

Solche Eigenschaften müssen anhand konkreter Anforderungen, Prüfungen und Nachweise belegt werden.

---

# 38. Konkreter Arbeitsauftrag – Jetzt beginnen

Erstelle zuerst eine vollständige fachliche und technische Architektur dieses Enterprise-Service-ERP.

Berücksichtige alle Module und ihre Abhängigkeiten.

Definiere insbesondere:

1. Die vollständige Systemarchitektur.
2. Das Datenbankmodell.
3. Die SAP-ähnlichen Geschäftsprozesse.
4. Die Servicefall-Architektur.
5. Die Dispatching-Architektur.
6. Die Serviceauftragslogik.
7. Die Materialwirtschaft.
8. Die BANF- und Bestellprozesse.
9. Die Wareneingangsbuchung.
10. Die Fakturierung.
11. Die Storno- und Korrekturprozesse.
12. Die einfache doppelte Finanzbuchhaltung.
13. Die OpenUI5-Anwendungsstruktur.
14. Die Rollen- und Berechtigungsmatrix.
15. Die Genehmigungs-Engine.
16. Den zentralen Belegfluss.
17. Die PDF-Formularengine.
18. Die Betriebs- und Sicherheitsarchitektur.
19. Die Test- und Abnahmestrategie.
20. Den detaillierten Entwicklungsplan.

Beginne anschließend mit Phase 1.

Erstelle zunächst ein lauffähiges OpenUI5-Grundsystem mit Backend, PostgreSQL, Anmeldung, Rollenverwaltung und Navigation.

Danach implementiere den ersten vollständig funktionsfähigen Prozess:

**Kunde erstellt Ticket über Webformular → Ticket wird mit Korrelations-ID gespeichert → Servicefall wird angelegt → Ticket erscheint im OpenUI5-System → Dispatcher kann es einem Techniker zuweisen.**

Erst wenn dieser Ablauf zuverlässig funktioniert und getestet ist, beginne mit den nächsten fachlichen Modulen.

**Langfristiges Ziel: Eine eigenständige, professionelle, sichere und wirtschaftlich einsetzbare Unternehmenssoftware mit SAP-ähnlichen Geschäftsprozessen und einer vollständigen OpenUI5-Benutzeroberfläche.**