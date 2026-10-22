# Strukturierte Eingangsrechnungs-Testdateien

Ausschließlich fiktive Daten aus der isolierten Preview0.11-Testrechnung. `cii.xml` entspricht deren tatsächlich erzeugtem und validiertem CII-Original. `ubl.xml` wurde mit der offiziellen Mustang-CLI2.26.0 (`--action ubl`) aus demselben CII konvertiert und anschließend mit deren tatsächlicher XML-/XSD-/Schematronprüfung erfolgreich geprüft. Beide enthalten dieselben fachlichen Werte und keine Zugangs-/Sitzungsdaten. Die Beispieldaten dürfen nicht als echte Forderung/Verbindlichkeit in die Hauptdatenbank übernommen werden.

Parserprüfungen: Werte/Parteien/Leistungsdaten, UTF8/UTF16 und Originalbytes, DTD/XXE/Verarbeitungsanweisungen, Namespaces/Mehrdeutigkeiten, Größen/Tiefe, Steuer-/Summenabweichungen, explizit unterstützte Profile/Steuerarten/Einheiten. Sichere Extraktion ist eine eigene Stufe; sie ersetzt weder normative Validierung noch Originalarchiv, sachlichen Bestell-/WE-Abgleich, Vorsteuerprüfung, Freigabe oder Buchung.
