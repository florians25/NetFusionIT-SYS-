# Direkte Lagerauslieferung · Preview0.20

Erster tatsächlicher Teilumfang aus [DS-01–16](direct-sales.md). Noch keine vollständige Direktvertriebsabnahme: lieferbezogene Fakturaanforderungen und direkte AU-Beschaffung fehlen weiterhin und werden anschließend ergänzt.

Der Ausführungsweg wird bei AU-Anlage ausdrücklich gewählt und in der unabhängigen Freigabe gebunden. Ein Verkaufsangebot erzeugt einen Direktvertriebs-AU, ein Service-Kostenvoranschlag einen Service-AU. Der Weg bleibt nach Speicherung unveränderlich; ein anderer Weg braucht einen eigenen kontrollierten Änderungsprozess. Bereits archivierte kommerzielle Originale bleiben unverändert.

WAREHOUSE besitzt einen eigenen Arbeitsvorrat und die berechtigte Warenbuchung. SALES kann Bestand für konkrete AU-Einteilungen reservieren. Service und Direktvertrieb verwenden dasselbe Reservierungs-/Bestands-/Bewertungs-/Fachbuch. Eine Reservierung hat entweder eine echte SA-/Bedarfsposition oder eine echte AU-/Position-/Einteilungsquelle. Neu eingeführte AU-Materialbelege besitzen keine Ticket-, WOT-, Techniker- oder SRM-Ersatzreferenz.

Aus tatsächlich eingegebenen Teilmengen und konkreten Lagerfächern entstehen atomar WA und LS, physische Fachentnahme, Lagerort-/Unternehmensbewertung und Warenaufwand/FI. Mehrere Fächer derselben Reservierung werden als getrennte tatsächliche Entnahmezeilen dokumentiert. Mengen je Position/Einteilung unterscheiden geplant, offen reserviert, tatsächlich geliefert und offen. Fehlmengen werden aus freiem gemeinsamen Bestand berechnet, ohne denselben Bestand mehreren Positionen rechnerisch zuzuschlagen.

Rücknahme bucht den vollständigen Original-WA mit gleicher Menge, Bewertung, Kontierung, ursprünglichem Fach/Tracking und Empfängersnapshot zurück. Eine neue Konto-/Adressrevision schreibt alte Originale nicht um. Gesperrte Plätze, Inventur, geschlossene Periode und eine zweite Rücknahme werden kontrolliert abgewiesen. Die zurückgenommene Menge ist je nach Reservierungsstatus erneut gebunden oder frei; tatsächliche Lieferrestmengen werden wiederhergestellt.

Der Schwarz-Weiß-Lieferschein nutzt tatsächliches Warenausgangsdatum, vereinbarten Warenempfänger, AU-/Kundenbestellreferenz und Originalmengen. Kleine native Anlagenlisten am Warenbeleg und AU zeigen wirkliche geschützte PDF-Dateien; Kunden erhalten nur eigene freigegebene Originale und keine interne Bewertung oder Lagerdetails. Datumswerte werden aus PostgreSQL als Datumstext gelesen, damit eine Serverzeitzone das aufgedruckte Lieferdatum nicht verschiebt.

Noch offen: AU-Fehlbedarf/BANF/Bestellung/Teil-WE und Rechnungseingang, lieferbezogene AF/Freigabe/Vorrat/RE/ZUGFeRD/FI/OP, Änderung nach Freigabe, Teilretoure nach Faktura/Gutschrift, eigene ungebuchte Kommissionier-/Lieferaufträge, Packstücke/Versand, Nichtlager-/Lizenzbereitstellung und Streckengeschäft. Diese Lücken sind kein erledigter Direktvertrieb und kein Gesamtabschluss des Backlogs.

Abgenommen:295/295 vollständige Tests einschließlich12 Direktvertriebsfällen, eigene native Desktop-/390px-Browserkette und betroffene Service-/AU-/KVA-Regressionen. [Echte Artefakte](../previews/v0.20.0-preview.1/README.md). Migrationen001–024 sind nach Anwendung und Prüfsummenprüfung eingefroren.
