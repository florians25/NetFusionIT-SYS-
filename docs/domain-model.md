# Fachmodell und Invarianten

## Identität und Organisation

Mandant → Unternehmen → Buchungskreis. Ein Organisationsbaum verwendet typisierte Knoten (Geschäftsbereich, Serviceorganisation/-gruppe, Einkauf/-gruppe, Werk, Lagerort, Vertriebsorganisation/-weg, Sparte, Kostenstelle, Profitcenter). Ebenen können ausgelassen werden; Eltern-Kind-Regeln werden konfiguriert. Jeder operative Beleg trägt einen Mandanten, eine verantwortliche Serviceorganisation und später den relevanten Buchungskreis. Ein Benutzer gehört einem Mandanten und expliziten Organisationen an.

BusinessPartner ist der zentrale Stamm. Kunde/Lieferant/Rechnungsempfänger/Auftraggeber/Leistungsempfänger/Ansprechpartner sind Rollen desselben Partners. Kontakte, Adressen, Bankverbindungen und Steuerdaten werden getrennt versioniert. Sperre oder ungeprüfte Anlage verhindert neue kaufmännische Belege. Im ersten Prozess werden aktive Kunden im Administrationsbereich angelegt; die mehrstufige Kundenfreigabe ist noch offen und wird vor kaufmännischer Nutzung benötigt.

## Serviceobjekte

Ticket = Eingang/Kommunikation und ITSM-Status. ServiceCase = fachlicher Problemkontext. ServiceOrder = kaufmännischer Leistungsauftrag. DispatchAssignment = verantwortlicher Techniker. FieldServiceVisit = konkreter zeitlicher Einsatz. MaterialRequirement = Bedarf. StockMovement = gebuchte Menge. ServiceReport = bestätigte Leistung. Invoice = Abrechnung. Keines dieser Objekte ersetzt ein anderes.

Ein Servicefall kann viele Tickets, Aufträge, technische Objekte und Einsätze umfassen. Die erste Anlage erstellt ein Ticket und einen Servicefall atomar; spätere Zusammenführung benötigt einen gesonderten Business-Service. Tickets besitzen technische ID, Nummer, Korrelations-ID, Quelle, Partner, Organisation, Priorität, Status und Version. Zuweisung verändert keine Preise und erzeugt keine Rechnung.

## Kaufmännische Werte

Geld: PostgreSQL `numeric(19,4)`, Anwendung Decimal-Bibliothek, Währung ISO-4217. Mengen: `numeric(19,6)` und Einheit, Umrechnung nur über freigegebene Stammdaten. Historische Belege speichern den angewendeten Preis, Rabatt, Steuerregel und die Version der Preisfindung. Keine binären JavaScript-Floats für Buchungen. Zeitzonen: Speicherung `timestamptz` in UTC; Anzeige in Benutzerzeitzone, Geschäftskalender explizit versioniert.

## Noch zu entscheidende Fachregeln

Vor den jeweiligen Phasen verbindlich klären: Land/Steuerarten/Rundung, Garantieumfang und Kostenträger, Storno bei bezahlten Belegen, Bewertung (gleitender Durchschnitt/Standard), Bestandskontierung, Zahlungsausgleich, Periodensperren, Kundenfreigabe und Betragsgrenzen. Diese Fragen blockieren keine nicht kaufmännische Ticketannahme. Dafür werden keine steuerlichen Annahmen getroffen.
