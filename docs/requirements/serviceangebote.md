Mit dieser App können Sie Serviceangebote anlegen, um Ihren Kunden Kostenvoranschläge für eine angeforderte Serviceleistung bereitzustellen. Ein Serviceangebot enthält alle Informationen, die für die Planung und Ausführung einer Serviceleistung erforderlich sind. Außerdem können Sie Serviceangebote, die aus externen Systemen synchronisiert wurden, überwachen und bearbeiten.
Mit dieser App können Sie Folgendes tun:
- Serviceangebote suchen
- Serviceangebote und Serviceangebotspositionen anzeigen, anlegen und bearbeiten
- Servicepakete in Angebote aufnehmen, um Pakete aus Serviceprodukten, Ersatzteilen und Ausgabenpositionen anzubieten
- Servicegruppen zu Serviceangebotspositionen zuordnen
- Serviceangebote zur Genehmigung an Kunden senden
- das Anlegen von Folgeserviceaufträgen anstoßen, wenn Serviceangebote von Ihren Kunden angenommen werden
- ein angepasstes Angebot anlegen, wenn für die Erbringung einer Serviceleistung zusätzliche Servicepositionen oder Ersatzteile erforderlich sind und diese nicht im angenommenen Serviceangebot angegeben wurden
Es gibt zwei Arten von Serviceangeboten: Standardserviceangebote und Festpreis-Serviceangebote. Ein Standardserviceangebot kann sowohl Positionen enthalten, die basierend auf dem Verbrauch von Zeit und Materialien fakturiert werden, als auch Festpreispositionen. Festpreis-Serviceangebote können dagegen nur Festpreispositionen enthalten.
Das System ermittelt automatisch Serviceverträge, denen Sie ein Serviceangebot zuordnen können. Nach der Zuordnung kopiert das System die relevanten Servicevertragsdaten, z.B. vertraglich vereinbarte Positionspreise, in das Serviceangebot. Wenn das Serviceangebot angenommen wird, werden auch die Servicevertragsdaten in den Folgeserviceauftrag kopiert.
Wenn Service Level Agreements (SLAs) im Servicevertrag definiert sind, werden die SLA-Bedingungen automatisch in Folgeserviceaufträge übernommen, die angelegt werden, wenn Kunden Serviceangebote annehmen.
             Weitere Informationen finden Sie unter [Servicevertragsfindung](https://help.sap.com/docs/SAP_S4HANA_CLOUD/adbae5bcd5994f159bf2847a11397b61/5d6e852d14094c5e98776ea253d7d624.html?locale=de-DE&state=PRODUCTION&version=2608.500 "Hier erhalten Sie detaillierte Informationen zu Funktionen und Kriterien, die das System bei der Servicevertragsfindung anwendet.").
Hinweis
Sie können Festpreis-Serviceangebote (SVQ2) nicht zu Serviceverträgen zuordnen.
In Serviceangeboten können Sie Kreditprüfungen durchführen und simulieren, um zu ermitteln, ob der Bruttowert der Positionen das verfügbare Kreditlimit überschreiten könnte, das in den Kreditsegmentdaten für den Regulierer (Geschäftspartner) definiert wurde, der den Positionen zugeordnet ist.
Die Kreditprüfung erfolgt automatisch, sobald das Serviceangebot freigegeben wird, und der Status ändert sich in An Kunden gesendet. Das Ergebnis der Kreditprüfung wird im Kreditstatus angezeigt. Die eigentliche Kreditprüfung wird im Serviceauftrag durchgeführt, der angelegt wird, sobald das Serviceangebot angenommen wird.
Wenn Sie das Ergebnis der Kreditprüfung sehen möchten, während das Serviceangebot in Bearbeitung ist, können Sie eine Kreditprüfung für die zugehörigen Positionen wie folgt simulieren:
- Simulieren Sie die Kreditprüfung für alle Positionen, die nicht den Status Angenommen oder Abgesagt haben.
- Simulieren Sie die Kreditprüfung für Positionen, die den Status An Kunden gesendet (Freigegeben) haben.
Hinweis
Anders als bei der Kreditprüfung, die in Serviceaufträgen durchgeführt wird (siehe [Kreditprüfungen in Serviceaufträgen](https://help.sap.com/docs/SAP_S4HANA_CLOUD/adbae5bcd5994f159bf2847a11397b61/830695f64e6a4c31b8a9f121c3cd8733.html?locale=de-DE&state=PRODUCTION&version=2608.500 "Führen Sie Kreditprüfungen in Serviceaufträgen durch.")), ändert das Ergebnis der Prüfungen und der Simulationen in Serviceangeboten weder das Obligo noch blockiert es die weitere Bearbeitung des Serviceangebots.
Hinweis
Voraussetzungen
Sie können Kreditprüfungen und Kreditprüfungssimulationen für Serviceangebotspositionen durchführen, wenn dem Regulierer, der zu den Serviceangebotspositionen zugeordnet ist, die Rolle "SAP Credit Management“ zugeordnet ist und Kreditprüfungen für Serviceangebote aktiviert wurden. Weitere Informationen finden Sie unter [Credit Management konfigurieren](https://help.sap.com/docs/SAP_S4HANA_CLOUD/adbae5bcd5994f159bf2847a11397b61/9f2aa32b3d394698b507980712c29227.html?locale=de-DE&state=PRODUCTION&version=2608.500 "Als Anwendungsexperte können Sie Credit Management für Servicevorgänge konfigurieren.").
Mit der Ausgabeverwaltung für Serviceangebote können Sie Serviceangebote drucken, per E-Mail versenden oder an ein externes System senden (EXTOM-Kanal). Sobald Sie ein Serviceangebot an einen Kunden gesendet haben, wird der Status des Angebots auf Freigegeben gesetzt. Wenn der Kunde Änderungen vorschlägt, können Sie das Serviceangebot bearbeiten und eine erneute Ausgabe anstoßen. Mit dieser Funktion können Sie Serviceangebote mehrfach an Kunden senden.
             Weitere Informationen finden Sie unter:
- [Ausgabeverwaltung](https://help.sap.com/docs/SAP_S4HANA_CLOUD/adbae5bcd5994f159bf2847a11397b61/d7bd4b5d70d94f09bcf99b221a7a1688.html?locale=de-DE&state=PRODUCTION&version=2608.500 "Die Apps für die Ausgabeverwaltung umfassen Aktivitäten, die die Ausgabe von Geschäftsbelegen als Druckversion und in E-Mails betreffen. Sie können den Kanal für Ihre Ausgabe direkt in Ihrer App wählen (Druck oder E-Mail\).")
- [Ausgabeverwaltung für Servicevorgänge](https://help.sap.com/docs/SAP_S4HANA_CLOUD/adbae5bcd5994f159bf2847a11397b61/425b3b73b0cc40d0b18d7147fed2531a.html?locale=de-DE&state=PRODUCTION&version=2608.500)
             .
Sie können Dateien und URLs auf Kopfebene an Serviceangebote anhängen. Außerdem können Sie Anlagen herunterladen und löschen. Weitere Informationen zu Anlagen finden Sie unter [Anlagenservice](https://help.sap.com/docs/SAP_S4HANA_CLOUD/adbae5bcd5994f159bf2847a11397b61/e7ff65b0c2c34652995745c9416edc5e.html?locale=de-DE&state=PRODUCTION&version=2608.500).
Hinweis
Anlagen, die Sie zu Serviceangeboten hinzugefügt haben, werden nicht in Folgeserviceaufträge kopiert.
           Die Tabelle liefert eine Übersicht über den möglichen Status von Serviceangeboten.
Status
Beschreibung
Offen
Dies ist der Standardstatus, den alle Serviceangebote haben, nachdem sie angelegt wurden. Er zeigt an, dass Sie das Angebot bearbeiten können.
An Kunden gesendet
Das Serviceangebot wurde an einen Kunden gesendet. Wenn Sie ein Angebot bearbeiten, das an einen Kunden gesendet wurde, wird der Status des Angebots auf Wird geprüft gesetzt.
Wird geprüft
Das Serviceangebot wird intern geprüft, nachdem es an einen Kunden gesendet wurde. Das geänderte Serviceangebot können Sie an den Kunden senden, damit dieser es annehmen oder ablehnen kann.
Hinweis
Sie können nicht die Positionspreisfindung ändern oder Positionen löschen, die im ursprünglichen Angebot enthalten waren. Sie können jedoch neue Positionen hinzufügen.
Angenommen
Der Kunde hat das Serviceangebot angenommen. Dadurch wird ein Folgeserviceauftrag angelegt, und die relevanten Daten aus dem Serviceangebot werden in den Serviceauftrag übernommen.
                 Kunden können Serviceangebote auch teilweise annehmen, indem sie nur einzelne Positionen annehmen und andere absagen.
Hinweis
Wenn ein Serviceangebot angenommen wurde, kann es nur abgesagt werden, indem der Folgeserviceauftrag abgesagt wird.
Abgesagt
Der Kunde hat das Serviceangebot abgelehnt.
Sie können ein Serviceangebot absagen, nachdem es angelegt wurde. Diese Absage kann sowohl auf Kopf- als auch auf Positionsebene des Serviceangebots erfolgen, sodass Sie einzelne Positionen absagen können, ohne das gesamte Angebot abzusagen.
Der Status des Serviceangebots bleibt unabhängig vom Status des Folgeserviceauftrags. Wenn ein Folgeserviceauftrag abgesagt wird, behält das Serviceangebot seinen ursprünglichen Status.
            Als Anwendungsexperte können Sie Absageprofile für Servicevorgängen konfigurieren und zuordnen. Diese Konfiguration besteht aus drei Schritten:
1. Absagegründe für Servicevorgänge definieren: In dieser Aktivität definieren Sie die Absagegründe, die in Servicevorgängen verwendet werden können.
2. Absageprofile für Servicevorgänge definieren: In dieser Aktivität kombinieren Sie Absagegründe entsprechend ihren betriebswirtschaftlichen Anforderungen, um Absageprofile zu erstellen.
3. Absageprofile zu Servicevorgängen zuordnen: In dieser Aktivität ordnen Sie die Absageprofile den relevanten Servicevorgängen zu.
Nachdem Sie die Absageprofile konfiguriert und zugeordnet haben, können Sie den Absagegrund anzeigen und auswählen, wenn Sie eine Position oder ein Angebot absagen.
- Desktop
- Tablet
