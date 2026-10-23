# Verbindliche Materialversorgung aus Serviceauftragspositionen

Nutzerpräzisierung vom 22.10.2026: Materialbedarf wird automatisch anhand der Artikel erkannt. BANF-Erzeugung und Positions-/Auftragsstatus gehören in den Serviceauftrag; vorhandene Lagerartikel werden genutzt. Fehlender Bestand benötigt einen verständlichen Hinweis. Die bisherigen Masken und die manuelle Bedarf→BANF-Klickstrecke sind dem Nutzer zu einfach und zu leer.

Ergänzung vom 23.10.2026: Diese Beschreibung bleibt für Service gültig. [Direktvertrieb](direct-sales.md) benötigt dieselbe belastbare Versorgung aus AU-Positionen mit typisierter AU-Kosten-/Beschaffungsquelle, ohne Ticket/SA/SRM. AU und SA konkurrieren um denselben tatsächlichen freien Bestand; keine Doppelreservierung. Die AU-Erweiterung ist noch offen.

## Umsetzungsregeln

- Artikelart unterscheidet Lagerersatzteil, Nichtlagerteil und Fremdleistung von Arbeitszeit, Fahrtleistung und Pauschale. Die freigegebene Auftragsposition erzeugt ihren Materialbedarf automatisch; keine erneute Artikel-/Mengenerfassung in einem separaten Anforderungsformular.
- Bestand, freier Bestand, aktive Reservierung, Fehlmenge, BANF, bestellt, geliefert und tatsächlich verbraucht bleiben getrennte Mengen mit Herkunft. Mehrfachklick, Konkurrenz und wiederholte Statusaktion dürfen nicht überreservieren oder doppelt beschaffen.
- Lagerbestand prüfen und vorhandene Mengen für den Auftrag reservieren. Nur die nicht anderweitig gedeckte Fehlmenge wird mit der Aktion **Teile bestellen** automatisch als auftrags-/positionsbezogene BANF angefordert. Die BANF wird im selben Kommando in die konfigurierte Freigabe eingereicht; fehlende Definition oder geeignete Freigeber rollen den Vorgang vollständig zurück. Sie bleibt vor Bestellung genehmigungspflichtig; Einkauf und unabhängige Freigabe bleiben getrennt.
- Nichtlagerteile und externe Leistungen erhalten ihren passenden Beschaffungsweg. Keine vorgetäuschte Lagerverfügbarkeit für Dienstleistungen. Unkonfigurierter Buchungskreis oder Bewertungs-/Trackingbedarf wird sichtbar gemeldet.
- Versorgung besitzt einen eigenen Positionsstatus und einen abgeleiteten Status am Auftragskopf; Ausführungs-/Rückmeldungs-/Fakturastatus werden nicht mit Materialversorgung gleichgesetzt. Bestellung, Teil-WE, Storno, Reservierungsfreigabe und Verbrauch aktualisieren Mengen und Status nachvollziehbar.
- Lager reserviert eingehende auftragsbezogene Teile für den Ursprung. Überlieferung darf keine Mengen für andere Aufträge unbemerkt binden. Storno berücksichtigt aktive Reservierungen und späteren Verbrauch.
- Die UI zeigt die vollständige Materialversorgung mit konkreten Mengen, Lagerorten, Terminen, Status, Kontierung und Folgebelegen. Objektkopf und Positionsmasken werden mit tatsächlich gespeicherten Geschäfts-/Organisations-/Ursprungsdaten gefüllt. Nur OpenUI5-Standardcontrols, native kompakte Tabellen/Formulare, keine eigenen CSS-/HTML-/Renderer-Ersatzkomponenten.
- Technische Zeiten bleiben im Ticket. WOT-Abschluss erzeugt eine korrelierte SRM; Beschaffung und alle kostenpflichtigen Folgevorgänge bleiben auftragsgeführt.

## SAP-Referenzen und Recherchegrenze

Vorliegende Originalbeschreibungen: [Serviceaufträge](serviceauftraege.md), [Positionstypmatrix der Vorlagen](auftragsvorlagen.md), [Serviceangebote](serviceangebote.md), zusätzlich Nutzerbeschreibung In-House Repair/Service Contract Management in [Backlog](../backlog.md). Diese Quellen unterscheiden Service, Lager-/Nichtlagerersatzteile, Fremdleistung und integrierte Beschaffung/Bestandsführung/Rückmeldung/Faktura.

Vom Nutzer verlangter Liveabruf von SAP Help und Websuche wurde versucht; der Cloud-Netzwerkproxy antwortet für `help.sap.com` und `www.google.com` mit HTTP 403. Die beiden Domains wurden zum wiederverwendbaren Konfigurationsentwurf hinzugefügt; dieser muss in den Umgebungseinstellungen gespeichert und veröffentlicht werden, bevor der Liveabruf erneut geprüft werden kann. Bis dahin ist zusätzliche Online-Recherche **nicht verifiziert**. Anwendungseigene Statusbezeichnungen sind keine Behauptung einer identischen SAP-Implementierung.
