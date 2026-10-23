# Größere Arbeitsseiten und vollständige Ansprechpartner

Verbindliche Nutzerpräzisierung, 23.10.2026: breite, professionell gegliederte Masken mit möglichst wenigen Umbrüchen; komplexe Bearbeitung soll eine eigene Arbeitsseite erhalten. Die letzte Dokumentkorrektur gilt: **keine zusätzliche Infobox, keine Anschriftentabelle. Ansprechpartner mit Vor- und Nachnamen rechts oben; dort nur wesentliche Belegdaten.**

## Umsetzung in Preview0.25

- Native OpenUI5-Arbeitsseiten für umfangreiche Formulare ab zehn Feldern, ausdrücklich als Seite gewählte Bearbeitungen, kaufmännische Positionsdetails, mehrzeilige Belegerfassung und Journalentwürfe. Desktopformulare verwenden zwei fachliche Gruppen; mobile Formulare eine Spalte. Kleine Entscheidungen und die Anlagenliste bleiben Dialoge.
- Der Servicefolgeauftrag lädt Material- und Beschaffungsdaten nur mit dem tatsächlichen Service-Leserecht. Eine Vertriebsberechtigung für direkte AU-Beschaffung löst dort keine unzulässigen Anfragen aus; abgeleitete SA-Positionen bleiben geschützt.
- Belegpositionen im Bearbeitungsformular verwenden am Desktop `sap.ui.table.Table`: eigene Spaltenbreiten, resizierbare Spalten, horizontale Bewegung innerhalb des Rasters, Löschen und gegebenenfalls Zeilenaufteilung. Auf dem Telefon bleibt eine native Pop-in-Tabelle. Keine eigenen Styles oder Renderer.
- Speichern verwendet weiterhin die tatsächlichen APIs, Revisionen und Idempotenzschlüssel. Abbrechen schreibt nichts. Eine abgeschlossene, neu geladene oder einer beendeten Sitzung zugehörige Arbeitsseite erhält keine weiterverwendbare Schreibaktion. Ein inzwischen im Quellcontroller geänderter Vorgang kann nicht über die alte Arbeitsseite beschrieben werden. Entwürfe sind im Arbeitsspeicher und gehen beim Neuladen verloren; keine behauptete persistente Entwurfsverwaltung.
- Eigene App „Dokumenteinstellungen“: expliziter Vorname, Nachname, E-Mail und Telefon je berechtigtem Buchungskreis, aktiver Stand, Änderungsgrund und optimistische Revision. ADMIN/MASTER_DATA dürfen pflegen; interne Rollen lesen berechtigte Buchungskreise, Kunden nicht. Tenant-RLS und Datenbankregeln schützen Identität, Revision und Deaktivierung statt Löschen.
- Benutzer- und CRM-Kontaktpflege verlangen getrennte Vor-/Nachnamen in der Oberfläche. Kanonische Anzeigenamen entstehen aus diesen tatsächlichen Komponenten; Technikernamen und spätere Sitzungsanzeigen werden mitgeführt. Die Begrüßung verwendet den vollständigen vorhandenen Namen.

## Geschäftsformulare, Revision6

Der bestehende linke Anschriftenblock bleibt normaler Text im Fensteranschriftfeld. **Kein Rahmen und keine zusätzliche Tabelle.** Der rechte Belegkopf enthält Belegart, Nummer, Datum, vollständigen Ansprechpartner und höchstens drei wesentliche Kunden-/Lieferanten-/Bestellreferenzen, gegebenenfalls den wirklichen Ursprungsbeleg. Nicht wesentliche Angaben wie Einkaufsorganisation, Einkäufergruppe und weitere Bedingungen stehen im Beleginhalt, kurze Angaben nebeneinander. Seitennummern bleiben in der Fußzeile. Betrag, Menge, Datum und kurze Spaltenüberschriften erhalten ausreichend Breite; Langtexte bleiben vollständig.

Neue PDFs benötigen einen ausdrücklich gepflegten aktiven Dokumentansprechpartner. Der Name wird in den archivierten Formularstand übernommen. KVA/AG/AU-Prüfstände binden das Profil; eine Änderung entwertet einen noch laufenden Prüfstand. Eine neue Rechnung bindet den tatsächlichen Kontakt vor der Buchung; fehlt er, werden weder FI noch Rechnung oder Geschäftsnummer erzeugt. CII enthält denselben vollständigen Verkäuferkontakt. Normative ZUGFeRD-/PDF/A-Prüfung erfolgt weiterhin mit Mustang.

Archivierte Bytes werden nicht neu gerendert. Vorlagenstand5 bleibt als unveränderter Renderer für bereits vor Migration029 angelegte Rechnungsausgabeaufträge erhalten; neue Aufträge verwenden6 und können ihren Vorlagenstand nicht nachträglich wechseln. Alte genehmigte Angebotsstände benötigen bei fehlender heutiger Vollständigkeit eine ausdrückliche Rücknahme und erneute Prüfung, keine nachträgliche Anreicherung des Originals.

## Altbestände und Grenzen

Historische unstrukturierte Namen werden nicht geraten oder anhand von Leerzeichen zerteilt. Sie bleiben lesbar und müssen in der Benutzer-/Kontaktpflege mit den tatsächlichen Komponenten vervollständigt werden. Bestehende API-Namensfelder bleiben für alte Integrationen kompatibel; neue Oberflächen verwenden die getrennten Komponenten. Keine erfundenen Telefonnummern oder Personen in der Hauptumgebung. Ein aktiver Ansprechpartner muss vor der Erstellung neuer Geschäftsunterlagen eingerichtet werden.

Dies ersetzt keine vollständige CRM-, Entwurfs-, Barrierefreiheits-, DIN-, Rechts- oder Geräteabnahme. Geschäftsbereiche/Profitcenter, weitere Organisationszuordnungen und alle übrigen offenen Masterbacklog-Pakete bleiben offen. Die bestehende Ticketausnahme ohne Belegfluss bleibt bestehen.

Technische Referenzen: OpenUI5 [Page](https://sdk.openui5.org/1.152.1/#/api/sap.m.Page), [SimpleForm](https://sdk.openui5.org/1.152.1/#/api/sap.ui.layout.form.SimpleForm), [Table](https://sdk.openui5.org/1.152.1/#/api/sap.ui.table.Table) und [Fixed RowMode](https://sdk.openui5.org/1.152.1/#/api/sap.ui.table.rowmodes.Fixed). Die verwendeten Controls werden mit dem tatsächlich installierten SDK im Browser geprüft.
