# Dispatching und Field Service

## Erster Umfang

Dispatcher kann ein Ticket einem aktiven Techniker aus derselben Serviceorganisation zuweisen. Die Zuweisung ist eine eigene persistente Entität mit Verantwortlichem und Zeit. Erneute Zuweisung deaktiviert die vorherige innerhalb derselben Transaktion. Ticket und Fall bleiben eigenständig. Technikerbenutzer, Organisationsmitgliedschaft und Aktivstatus werden serverseitig geprüft.

Das Cockpit zeigt nicht zugewiesene Tickets und aktive Zuordnungen aus realen Daten. Es behauptet keine Kapazitäts-/Routenplanung. Kunden sehen keine Techniker-Auswahlliste.

## Geplanter Ausbau

FieldServiceVisit speichert Zeitraum mit Zeitzone, mehrere Techniker, Standort und Servicefall. PostgreSQL-Exclusion-Constraint verhindert überlappende aktive Termine je Techniker; Fahrt-/Pausenpuffer werden regelbasiert ergänzt. Technikerprofile besitzen Qualifikation, Zertifikatsgültigkeit, Gebiet, Arbeitszeit, Urlaub, Fahrzeug, Kostenstundensatz und Bereitschaft.

Empfehlungsalgorithmus: erst harte Ausschlüsse (Berechtigung, Skills, Abwesenheit, Arbeitszeit, Material), dann transparentes Ranking (SLA-Risiko, Fahrtzeit, Kapazität). Manuelle Übersteuerung erfordert Grund und Audit. Ohne belastbare Standort-/Arbeitszeitdaten keine scheinpräzise Automatik.

Einsatzstatus: UNPLANNED → PLANNED → ASSIGNED → CONFIRMED → TRAVELING → ONSITE → IN_PROGRESS → TECHNICALLY_COMPLETED → ACCEPTED; Unterbrechung hat Grund. Zeiten, Reisekosten, Fotos, Kundenunterschrift und Materialverbrauch sind eigene gebuchte Daten. Mobile Oberfläche ist responsiv; Offline-Synchronisation gehört nicht zum ersten Umfang.
