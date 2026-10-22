Mit dieser App können Sie Vorlagen für Service- und Reparaturaufträge, die häufig in Ihren Serviceprozessen vorkommen, anlegen und verwenden. Serviceauftragsvorlagen werden genutzt, um wiederverwendbare servicebezogene Daten zu definieren. Sie verringern den Zeitaufwand für das Anlegen von Service- und Reparaturaufträgen. Serviceauftragsvorlagen beschreiben den Umfang geplanter Serviceleistungen und enthalten keine Daten zur tatsächlichen Ausführung.
- Serviceauftragsvorlagen: Sie können Serviceauftragsvorlagen, Festpreis-Serviceauftragsvorlagen, Reparaturauftragsvorlagen und Festpreis-Reparaturauftragsvorlagen verwenden. Jede Vorlagenart kann verschiedene Arten von Positionen enthalten, z.B. Serviceprodukte, Ausgaben, Ersatzteile und nicht fakturierbare Positionen.
- Mit dieser App können Sie Folgendes tun:
  - Serviceauftragsvorlagen anlegen und bearbeiten, um die Datenerfassung beim Anlegen von Service- und Reparaturaufträgen zu beschleunigen
  - alle oder einzelne Positionen aus der Vorlage in Folgeserviceangebote, Folgeserviceaufträge oder Folgereparaturaufträge kopieren
- Unterstützung von Serviceangeboten
  Sie können Serviceangebote aus Serviceauftragsvorlagen anlegen, indem Sie die Aktion „Folgevorgang anlegen“ verwenden. Wenn Sie einen Folgeserviceauftrag aus dem Angebot anlegen, pflegt das System den Vorlagenkontext, um die Konsistenz zwischen Angebot und Auftrag sicherzustellen.
           Zusätzlich unterstützt die App die Integration mit folgenden technischen Funktionen und Optionen:
- Wartungspläne: Wartungspläne enthalten die Termine und den Umfang der an Instandhaltungsobjekten durchzuführenden Inspektionsmaßnahmen. Sie können Wartungspläne für technische Objekte in Ihrer Organisation anlegen, um sicherzustellen, dass Ihre technischen Objekte optimal funktionieren. Sie können Serviceauftragsvorlagen zu Wartungsplänen zuordnen. Relevante Daten aus der Serviceauftragsvorlage, z.B. Serviceprodukte oder Ersatzteile, werden in Folgeserviceaufträge oder Folgereparaturaufträge kopiert, die aus dem Wartungsplan und der Serviceauftragsvorlage angelegt wurden. Weitere Informationen finden Sie unter [Serviceauftragsgenerierung](https://help.sap.com/docs/SAP_S4HANA_CLOUD/adbae5bcd5994f159bf2847a11397b61/5c28583fd4554a3cb9261aecb7ea4e24.html?locale=de-DE&state=PRODUCTION&version=2608.500).
- Notizen: Sie können Notizen verwenden, um z.B. Anweisungen zu Serviceauftragsvorlagen hinzuzufügen, die spezifisch für Ihr Servicegeschäft sind. Verwenden Sie vorgangsübergreifende Notizen, um Notizen zwischen verschiedenen Servicevorgängen zu kopieren.
- Anlagen: Sie können Dateien und URL-Links an Serviceauftragsvorlagen anhängen. Außerdem können Sie Anlagen herunterladen und löschen. Weitere Informationen finden Sie unter [Anlagenservice](https://help.sap.com/docs/SAP_S4HANA_CLOUD/adbae5bcd5994f159bf2847a11397b61/e7ff65b0c2c34652995745c9416edc5e.html?locale=de-DE&state=PRODUCTION&version=2608.500).
Die folgende Tabelle zeigt die Positionstypen, die Sie verwenden können, um Serviceauftragsvorlagen (SVT1) und Reparaturauftragsvorlagen (RPT1) zu definieren.
Positionstyp für Serviceauftragsvorlage (SVT1) und Reparaturauftragsvorlage (RPT1)
Beschreibung des Positionstyps
STE1
Ausgabenposition (Vorlage)
STE2
Festpreis-Ausgabenposition (Vorlage)
STE4
Festpreis-Ausgabenposition (Vorlage)
STEN
Nicht fakturierbare Ausgabenposition (Vorlage)
STP1
Serviceposition (Vorlage)
STP2
Festpreis-Serviceposition (Vorlage)
STP4
Festpreis-Serviceposition (Vorlage)
STPN
Nicht fakturierbare Serviceposition (Vorlage)
STR1
Lagerersatzteil (Vorlage)
STR2
Festpreis-Lagerersatzteil (Vorlage)
STR4
Festpreis-Lagerersatzteil (Vorlage)
STRN
Lagereratzteil-PosVorlage (n. fakt.)
STS1
Ersatzteil (Vorlage)
STS2
Festpreis-Ersatzteil (Vorlage)
STS4
Festpreis-Ersatzteil (Vorlage)
STSN
Servicepositionsvorlage (n. fakt.)
STW1
Externe Serviceposition (Vorlage)
STW2
Ext. Festpreis-Serviceposition (Vorlage)
Hinweis
Dieser Positionstyp gilt nur für Reparaturauftragsvorlagen (RPT1).
STW4
Ext. Festpreis-Serviceposition (Vorlage)
STWN
Ext. Servicepositionsvorlage (n. fakt.)
STB1
Servicepaket (Vorlage)
STB4
Festpreis-Servicepaket (Vorlage)
STB6
Servicepaket (FP/Teilfakt./Vorlage)
STBB
Servicepaketvorlage (n. fakt.)
Festpreis-Serviceauftragsvorlagen (Vorgangsart: SVT2) und Reparaturauftragsvorlagen (Vorgangsart: RPT2) können nur Festpreis-Auftragspositionen enthalten. Die Tabelle unten zeigt die Positionstypen, die Sie verwenden können, um einen solchen Auftrag anzulegen. Dem Kunden werden die im Service-/Reparaturauftrag definierten Preise in Rechnung gestellt.
Positionstyp für Serviceauftragsvorlage (SVT2) und Reparaturauftragsvorlage (RPT2)
Beschreibung des Positionstyps
STE2
Festpreis-Ausgabenposition (Vorlage)
STE4
Festpreis-Ausgabenposition (Vorlage)
STP2
Festpreis-Serviceposition (Vorlage)
STP4
Festpreis-Serviceposition (Vorlage)
STR2
Festpreis-Lagerersatzteil (Vorlage)
STR4
Festpreis-Lagerersatzteil (Vorlage)
STS2
Festpreis-Ersatzteil (Vorlage)
STS4
Festpreis-Ersatzteil (Vorlage)
STW2
Ext. Festpreis-Serviceposition (Vorlage)
STW4
Ext. Festpreis-Serviceposition (Vorlage)
STB4
Festpreis-Servicepaket (Vorlage)
            Die folgende Tabelle liefert eine Übersicht über den möglichen Lebenszyklusstatus von Serviceauftragsvorlagen:
Lebenszyklusstatus
Beschreibung
Offen
Dies ist der Standardstatus einer Serviceauftragsvorlage, nachdem sie angelegt wurde. Er zeigt an, dass Sie die Vorlage ändern können.
In Bearbeitung
Ein Benutzer hat den Status manuell auf In Bearbeitung gesetzt; z.B. wurden Vorlagenpositionen hinzugefügt, aber noch nicht abgeschlossen.
Freigegeben
Die Serviceauftragsvorlage wurde abgeschlossen, und es sind keine weiteren Änderungen erforderlich.
Erledigt
Verwenden Sie diesen Status, wenn Sie das Anlegen einer Serviceauftragsvorlage beenden möchten oder wenn eine freigegebene Vorlage bestimmte Bedingungen erfüllt, so dass das System die Bearbeitung beendet.
