# Service Management

Ticket und Servicefall werden separat gespeichert und über Dokumentrelationen verbunden. Das erste Fallmodell besitzt OPEN/CLOSED als operativen Status sowie getrennte technische und kaufmännische Status. Ein Ticketabschluss schließt nicht stillschweigend alle verbundenen Fälle oder Aufträge.

## Ticket-Zustandsmaschine

NEW → QUALIFYING → ASSIGNED → IN_PROGRESS. IN_PROGRESS kann auf WAITING_CUSTOMER, WAITING_MATERIAL oder WAITING_VENDOR wechseln; Rückkehr nach IN_PROGRESS. Danach TECHNICALLY_RESOLVED → COMMERCIALLY_CLOSED → CLOSED. Zuweisung erfolgt nur über das Dispositionskommando. Wiedereröffnung: CLOSED/TECHNICALLY_RESOLVED → REOPENED → IN_PROGRESS. ESCALATED und CANCELLED sind explizite Aktionen. Gültige Kanten sind zentral im Backend definiert; UI erhält die zulässigen Aktionen und ist keine Sicherheitsgrenze.

Nur Serviceleitung/Dispatcher dürfen kaufmännisch abschließen; im ersten Umfang bedeutet dies lediglich Prozessstatus ohne Finanzbuchung. Kunde kann keine internen Statuswechsel durchführen. Techniker kann nur zugewiesene Tickets bearbeiten. CANCELLED ist terminal. Statusänderung erfordert erwartete Version; parallele Bearbeitung ergibt 409 und Neuladen.

## Spätere Servicefunktionen

Vertrags-/Garantieprüfung vor automatischem Auftrag. Preisfindung ausschließlich für kostenpflichtige Vorgänge; interner Service und Garantie erhalten interne Kostenträger. SLA-Engine speichert Policy-Version, Start, Pausenintervalle und Fristen. Berechnung in versioniertem Servicekalender mit Feiertagen und Zeitzone; Sommerzeit und Wochenenden werden getestet. Noch keine SLA-Zähler im ersten Dashboard.

Geplante Objektseitenregister: Technik, Kunde, Vertrag, SLA, Einsätze, Tätigkeiten, Material, Kosten, Auftrag, Bestellung, Faktura, Kommunikation, Freigabe, Historie, Belegfluss. Nur Register mit implementierter API werden eingeblendet. Keine leeren angeblich fertigen Module.

## SLA und Servicebasis in Preview 0.2

Servicekalender rechnen Geschäftszeit in der konfigurierten IANA-Zeitzone, einschließlich geteilten Arbeitsfenstern, Feiertagen und Zeitumstellungen. Policies definieren Reaktions-/Lösungsminuten und pausierende Status explizit. Ein gültiger aktiver Kundenvertrag kann bei Ticketanlage zusammen mit einem technischen Objekt gewählt werden. Die gesamte Anlage einschließlich SLA-/Kalendersnapshot und Belegbeziehungen ist atomar.

Erste Reaktion, Pause/Fortsetzung, technische Lösung und Storno werden historisiert. Der Hintergrundlauf prüft Fristüberschreitungen minütlich und erzeugt je Fristtyp genau ein append-only Ereignis; auch spät erfüllte Fristen bleiben als Verletzung erkennbar. Wiedereröffnung eines bereits gelösten SLA-Tickets erfordert eine noch offene fachliche Folgeregel und liefert aktuell 409, statt die ursprüngliche Leistungshistorie zu überschreiben.

Basisverträge enthalten Art, Laufzeit, Kundenbezug, Umfang und optionale SLA-Policy. Technische Objekte enthalten Hersteller/Modell/Seriennummer, Standort, Garantie-/Installationsdatum, Hierarchie und Vertragsbezug. Seriennummern sind mandantenweit eindeutig. Erweiterte Vertragsfindung, periodische Faktura und In-House Repair: siehe `backlog.md`.
