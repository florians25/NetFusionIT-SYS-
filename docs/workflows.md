# Status und Genehmigungen

Implementiert sind die zentrale Ticket-Zustandsmaschine sowie die erste wiederverwendbare Genehmigungs-Engine für Kundenstammdaten: mehrere Rollenstufen, organisationsbezogene versionierte Definitionen, Snapshot pro Instanz, Vier-Augen-Prinzip, Rückfragen mit Einreicherantwort, Ablehnung, versionierte Entscheidungen, Audit und interne Benachrichtigungen. Definitionen sind nicht vorausgefüllt; fachlich verantwortliche Administratoren konfigurieren die Stufen. Der aktuelle Belegadapter aktiviert freigegebene Kunden. Die Engine ist erweiterbar, jedoch noch keine vollständige Umsetzung aller Betrags-/Vertretungs-/Eskalationsregeln.

Die geplante Genehmigungs-Engine verwaltet unveränderliche Definitionsversionen mit Anwendungsfall, Organisation/Buchungskreis, Bedingungen, Betrags-/Währungsgrenzen, Reihenfolge, Freigeberrolle, Vier-Augen-Regel, Vertretung und Eskalation. Instanzen speichern die verwendete Definition und Eingabewerte; Regeländerungen verändern keine laufende Genehmigung stillschweigend.

Entscheidung: APPROVE / REJECT / REQUEST_INFORMATION mit Kommentar und Actor. Nur aktuell aktive Schritte dürfen entschieden werden. Optimistic Locking + eindeutiger Schrittentscheid verhindern parallele Doppelentscheidung. Ersteller darf bei Vier-Augen keine eigene Freigabe treffen. Änderungen an kritischen Daten invalidieren die alte Freigabe gemäß Regel. Eskalation wird über Outbox/Worker geplant.

Anwendungsfälle: Partneranlage/-änderung, Artikel/Preis, Serviceauftrag, BANF, Bestellung, Eingangs-/Ausgangsrechnung, Storno, manuelle Finanzbuchung. Schwellen, Stellvertretung und Freigabeberechtigungen müssen vom Unternehmen entschieden werden. Keine geschätzten Betragsgrenzen im Code.
