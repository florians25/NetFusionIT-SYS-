# Geschäftsprozesse und Transaktionsgrenzen

## Implementierter erster Prozess

1. Kunde meldet sich im eigenen Tenant mit gebundenem Geschäftspartner an.
2. Webformular validiert Titel, Beschreibung, Typ und Priorität; Kundenzuordnung kommt aus der Session.
3. POST mit CSRF-Token und Idempotency-Key. Backend prüft Rolle, aktive Partner-/Org-Zuordnung und Payload.
4. Eine PostgreSQL-Transaktion sperrt den Idempotenzschlüssel, vergibt Nummern und speichert Ticket, Servicefall, Dokumente, Relation und Audit. Antwort enthält beide IDs und Korrelations-ID.
5. Wiederholung desselben Inhalts liefert dieselbe Antwort. Wiederverwendung mit anderem Inhalt ergibt 409.
6. Dispatcher sieht nur seine Organisation. Zuweisung an aktiven Techniker derselben Organisation prüft Version und legt eine separate Disposition an.
7. Der Techniker sieht die zugewiesenen Tickets; gültige Statuswechsel werden zentral geprüft und historisiert.

Keine öffentliche E-Mail-zu-Kunde-Zuordnung. Das erste Kundenformular ist authentifiziert. Anonyme Formulare, Einladungen, Spam-/Dateiprüfung und Benachrichtigungen sind spätere Erweiterungen.

## Geplante E2E-Ketten

| Szenario | Kette | Harte Invariante |
|---|---|---|
| A: kostenpflichtig | Ticket → Fall → Einsatz → Auftrag → Bedarf → BANF → Bestellung → WE → Verbrauch → Zeit/Bericht → Rechnung → Journal → Zahlung | gleiche Leistung nie doppelt fakturieren; Salden stimmen |
| B: Garantie | Ticket → Deckungsprüfung → Fall → Einsatz → Verbrauch → Garantiekostenträger → Abschluss | keine automatische kostenpflichtige Kundenposition |
| C: intern | internes Ticket → Gruppe → Techniker → Verbrauch → Kostenstelle → Abschluss | kein externer Debitorenbeleg |
| D: Storno | Rechnung → Antrag → Genehmigung → Storno → Gegenjournal → OP-Korrektur | Original bleibt erhalten; nur eine wirksame Gegenbuchung |
| E: Teilbeschaffung | Bedarf 10 → BANF 10 → Bestellung 6 → WE 4+2 → Rest 4 → Bestellung 4 → WE 4 | Bedarfs-, Bestell-, Liefer- und Verbrauchsmengen bleiben getrennt |

Jeder Pfeil ist ein definiertes Kommando mit Transaktion, Berechtigungsprüfung, Idempotenz und Ereignis; externe Effekte folgen über Outbox. Eine gesamte mehrwöchige Kette ist keine einzelne Datenbanktransaktion.
