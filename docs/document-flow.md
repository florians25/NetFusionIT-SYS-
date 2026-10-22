# Zentraler Belegfluss

`documents` enthält ID, Tenant, fachliche Nummer, Art, Organisation, Ersteller und Zeit. Fachliche Tabellen behalten ihre eigenen Attribute. `document_relations` verbindet Quelle und Ziel über Tenant-sichere Fremdschlüssel und einen fachlichen Typ; eindeutige Kanten und keine Selbstreferenzen.

Implementiert: Ticket → Servicefall (`BELONGS_TO`), beide Richtungen lesbar. Objektseite zeigt eine unveränderte OpenUI5-Standardtabelle mit anklickbaren Beleglinks; Historiendaten stammen aus Audit-Ereignissen. Gemäß Nutzeranforderung keine eigenen UI-Controls oder nachgebauten ProcessFlow-Elemente. Zugriff auf eine Relation gewährt keinen Zugriff auf ein fremdes Dokument; jedes Ziel wird erneut autorisiert. Kein kundenübergreifender Graph durch einen Relationsjoin.

Geplant: Ticket → Fall → Auftrag → Bedarf → BANF → Bestellung → WE → Verbrauch → Bericht → Rechnung → Journal → Zahlung. Verzweigungen/Teilbelege sind mehrere Kanten, keine überschreibbaren Einzelreferenzfelder. Nummer ist für Menschen, UUID für technische Beziehungen, Korrelations-ID für Request-Nachverfolgung. Gegenbeleg referenziert Original mit `REVERSES`.
