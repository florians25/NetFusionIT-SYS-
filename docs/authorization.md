# Rollen- und Berechtigungskonzept

Jede Anfrage benötigt aktive Session, aktiven Benutzer, Tenant, Organisationsumfang, Aktionsrecht und gegebenenfalls Partner-/Technikerbezug. Frontend-Ausblendung ersetzt keine Backendprüfung. Nicht berechtigtes oder fremdes Objekt liefert 404, fehlendes Aktionsrecht 403. Techniker sehen nur selbst zugewiesene, Kunden nur eigene Partnertickets/Fälle. Rollenänderungen werden beim nächsten Request wirksam, nicht erst beim Sessionablauf.

## Implementierte Rollen

| Aktion | Administrator | Dispatcher | Support | Techniker | Kundenbenutzer |
|---|---|---|---|---|---|
| Tickets lesen | eigene Org | eigene Org | eigene Org | zugewiesen | eigener Partner |
| Ticket erstellen | eigene Org | eigene Org | eigene Org | nein | eigener Partner |
| Operativen Status ändern | ja | ja | ja | zugewiesen | nein |
| Zuweisen | ja | ja | nein | nein | nein |
| Kaufmännisch schließen | ja | ja | nein | nein | nein |
| Partner anlegen | ja | nein | nein | nein | nein |
| Benutzer/Rollen verwalten | ja | nein | nein | nein | nein |
| Organisation lesen | ja | ja | ja | ja | keine fremden Daten |

Organisationsumfang gilt auch für Administratoren; SYSTEMADMIN bedeutet hier Tenant-Administrator, nicht plattformweiter Superuser. Administrationsaktionen protokollieren Änderungen; der letzte aktive Administrator kann nicht deaktiviert/demotiert werden. Erstellung eines Kundenbenutzers verlangt aktive Kundenbindung in derselben Organisation. Keine öffentlich wählbare Rolle oder Tenant-ID.

## Geplante Fachrollen

Serviceleiter: Servicefreigabe, Leistungsfreigabe, SLA. Field-Service-Techniker: zugewiesener Einsatz, Zeit/Material, keine Bestellung. Kundenstammdatenverwalter: Partnerdaten/Freigabe gemäß Policy. Einkäufer: Bestellung, keine eigene Freigabe bei Vier-Augen. Einkaufsleiter: Bestellfreigabe. Lagerist: WE/Entnahme, keine Preis-/FI-Regeländerung. Vertrieb: Angebot/Auftrag. Faktura: Fakturavorrat/Rechnung. Buchhalter: Journal/Perioden/Zahlung. Controller: Reporting. Geschäftsführung: autorisierte Freigaben/Auswertungen. Diese Rollen werden erst mit ihren Modulen als ausführbare Rechte ergänzt.

MFA/OIDC ist für den Produktivbetrieb vorgesehen, in dieser ersten Lieferung noch nicht vorhanden. Serverseitige DB-Sessions mit Ablauf, Regeneration nach Login, CSRF und deaktivierbaren Benutzern sind implementiert.

Migration 002 und `backend/permissions.ts` führen die vollständigen 16 Rollen als serverseitig getrennte Aktionsrechte ein. Neue Rollen erhalten keinen automatischen Zugriff auf Servicetickets. Der explizite Negativtest für einen Einkäufer zeigt 403 für Service-Cockpit und OData-Tickets bei gleichzeitig erlaubtem Partnerlesen. Field-Service-Techniker verwenden dieselben eigenen Zuweisungsfilter wie Techniker. Workflow-Entscheidungen prüfen zusätzlich die konkrete Rolle der aktuellen Stufe, den Einreicher und die erwartete Version.

Beschaffung ab Preview 0.6: Bedarf/BANF aus freigegebenen Aufträgen für Service- und Einkaufsrollen; Bestellung nur Einkauf/Einkaufsleitung/Administration. Auftragsleserecht erweitert nicht das Ticketleserecht. Lieferantenanlage erfordert Stammdaten-Schreibrecht. BANF-/Bestellfreigabe verlangt fachlich erlaubte Rollen und Vier-Augen-Prüfung gegen **Ersteller und Einreicher**. Kundensicht enthält keine Beschaffungsdaten. Beschaffungsleser ohne Partnerleserecht erhalten keine nicht ausführbaren Lieferantenlinks.

## Lager und Materialversorgung ab Preview 0.7

`inventory.read` erlaubt den internen, organisationsbegrenzten Lagerarbeitsplatz; Kunden erhalten keinen Zugriff. `inventory.reserve` erlaubt autorisierten Service-/Technik-/Lager-/Einkaufsrollen die auftragsbezogene Reservierung. „Teile bestellen“ verlangt zusätzlich `requisition.write`. Techniker bleiben an ihre zugewiesenen Fälle gebunden. `inventory.write` ist Administration und Lager vorbehalten: Werke/Lagerorte, Wareneingang und Storno. `material.write` erlaubt Administration/Stammdaten die Lagerführungskonfiguration; nach erster Bewegung ist sie gesperrt. Lageristen erhalten dadurch weder Ticketaktionen noch freie Journale/Regelpflege. BANF-Erzeugung reicht sofort ein, erteilt aber keine eigene Freigabe.

## Tatsächliche Materialausgabe ab Preview 0.9

`inventory.issue` erlaubt Administration, Lager, Serviceleitung, Disposition, Support und Technik die auftragsbezogene Ausgabe/Rücknahme. Voraussetzung sind ein zugänglicher laufender Auftrag, passende offene technische Aufgabe und tatsächliche Reservierung. Techniker bleiben auf eigene Aufgaben/zugewiesene Fälle beschränkt. Lager bucht Material auf die vorhandene technische Aufgabe, erhält dadurch keine Ticketbearbeitung oder freien FI-Zugriff. Das Quellenjournal verwendet ausschließlich konfigurierte Konten und serverseitig ermittelte Bewertung. Kunden erhalten weder Auslieferungs-/Lagerbelege noch interne Materialkosten; ihre SRM-Projektion enthält nur genehmigungsfähige Leistungsdaten.
