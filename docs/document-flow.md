# Zentraler Belegfluss

`documents` enthält ID, Tenant, fachliche Nummer, Art, Organisation, Ersteller und Zeit. Fachliche Tabellen behalten ihre eigenen Attribute. `document_relations` verbindet Quelle und Ziel über Tenant-sichere Fremdschlüssel und einen fachlichen Typ; eindeutige Kanten und keine Selbstreferenzen.

Implementiert sind Ticket/Fall, Serviceauftrag, Artikel, Ticketaufgabe/SRM, Bedarf/BANF/Teilbestellungen/Lieferant sowie Journal/Gegenbeleg. Der Belegfluss liest die erreichbare Geschäftskette in beide Richtungen. Kunden, Lieferanten, Artikel, technische Objekte und Verträge sind dabei Endpunkte, damit gemeinsam verwendete Stammdaten keine unverbundenen Fälle zusammenführen. Nur ein ausdrücklich als Einstieg gewählter Stammdatensatz darf seine eigenen Beziehungen öffnen. Zyklen terminieren durch eine eindeutige Menge erreichter IDs.

Eine Relation erweitert keine Zugriffsrechte. Sowohl Quelle als auch Ziel müssen vor dem Graphdurchlauf sichtbar sein. Für Kunden fehlen interne Aufgaben/Beschaffungs-/Finanzbelege; Techniker bleiben an zugewiesene Fälle gebunden. Objektseiten zeigen native OpenUI5-Tabellen mit erneut autorisierten Beleglinks. Keine eigenen UI-Controls oder nachgebauten ProcessFlow-Elemente.

Noch offen: WE, Verbrauch, Rechnung und Zahlung. Verzweigungen/Teilbelege sind mehrere Kanten, keine überschreibbaren Einzelreferenzfelder. Nummer ist für Menschen, UUID für Beziehungen. Die Ticket-Korrelations-ID bleibt in Aufgabe und automatisch erzeugter SRM unverändert; Request-Korrelation dokumentiert einzelne API-Aufrufe. Gegenbeleg referenziert Original mit `REVERSES`.
