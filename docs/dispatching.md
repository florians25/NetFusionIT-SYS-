# Dispatching und Field Service

## Erster Umfang

Dispatcher kann ein Ticket einem aktiven Techniker aus derselben Serviceorganisation zuweisen. Die Zuweisung ist eine eigene persistente Entität mit Verantwortlichem und Zeit. Erneute Zuweisung deaktiviert die vorherige innerhalb derselben Transaktion. Ticket und Fall bleiben eigenständig. Technikerbenutzer, Organisationsmitgliedschaft und Aktivstatus werden serverseitig geprüft.

Das Cockpit zeigt nicht zugewiesene Tickets und aktive Zuordnungen aus realen Daten. Es behauptet keine Kapazitäts-/Routenplanung. Kunden sehen keine Techniker-Auswahlliste.

## Implementierte Preview 0.2

Einsätze werden als eigene Belege mit Servicefall, mehreren Technikern, Ort, Start/Ende, benötigten Qualifikationen und Status persistiert. Der native OpenUI5 PlanningCalendar bietet Stunden-/Tages-/Wochen-/Monatsansichten; die Tabelle funktioniert auch mobil. Techniker erhalten Sicht auf ihren zugewiesenen Fall auch über einen Einsatz ohne direkte Ticketzuweisung.

Buchungen sperren alle beteiligten Techniker in sortierter Reihenfolge mit transaktionalen PostgreSQL-Advisory-Locks. Arbeitszeit/Feiertag, Qualifikation, Abwesenheit und vorhandene aktive Termine werden unter dieser Sperre geprüft; gleichzeitige kollidierende Buchungen liefern genau einmal Erfolg und einmal 409. Empfehlungen verwenden dieselben harten Prüfungen und sortieren verfügbare Techniker nach aktiven Einsätzen. Es gibt keine vorgetäuschte Fahrtzeitbewertung.

Technikerprofile speichern Kalender, Skills, Standort und Zertifikate. Zertifikate sind noch keine Zulassungsregel der Terminbuchung. Einsätze können bestätigt, angefahren, begonnen, unterbrochen, technisch abgeschlossen und abgenommen werden. Kunden können ausschließlich eigene technisch abgeschlossene Einsätze abnehmen. Abwesenheiten dürfen bestehende aktive Termine nicht überlagern.

## Geplanter Ausbau

FieldServiceVisit speichert Zeitraum mit Zeitzone, mehrere Techniker, Standort und Servicefall. PostgreSQL-Exclusion-Constraint verhindert überlappende aktive Termine je Techniker; Fahrt-/Pausenpuffer werden regelbasiert ergänzt. Technikerprofile besitzen Qualifikation, Zertifikatsgültigkeit, Gebiet, Arbeitszeit, Urlaub, Fahrzeug, Kostenstundensatz und Bereitschaft.

Empfehlungsalgorithmus: erst harte Ausschlüsse (Berechtigung, Skills, Abwesenheit, Arbeitszeit, Material), dann transparentes Ranking (SLA-Risiko, Fahrtzeit, Kapazität). Manuelle Übersteuerung erfordert Grund und Audit. Ohne belastbare Standort-/Arbeitszeitdaten keine scheinpräzise Automatik.

Einsatzstatus: UNPLANNED → PLANNED → ASSIGNED → CONFIRMED → TRAVELING → ONSITE → IN_PROGRESS → TECHNICALLY_COMPLETED → ACCEPTED; Unterbrechung hat Grund. Zeiten, Reisekosten, Fotos, Kundenunterschrift und Materialverbrauch sind eigene gebuchte Daten. Mobile Oberfläche ist responsiv; Offline-Synchronisation gehört nicht zum ersten Umfang.
