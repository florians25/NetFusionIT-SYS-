# E-Rechnungswerkzeug und Barcode-Abhängigkeiten

Stand22.10.2026. Verwendete Laufzeitbibliotheken sind in package-lock.json exakt festgelegt.

- Mustang-CLI2.26.0: offizielles Maven-Central-Artefakt `org.mustangproject:Mustang-CLI:2.26.0`, heruntergeladen durch `npm run einvoice:setup`. SHA-256 `42d7868cb68264874a7b8cab4c3587b03b23ccc7cd72373da917f66758bb9736`. Das enthaltene Projekt-POM nennt Apache License2.0; enthaltene Drittkomponenten/Lizenzen sind beim Verteilen des Werkzeugs zusätzlich zu berücksichtigen. Die JAR-Datei wird nicht im Git-Repository gespeichert. Java21 ist lokal geprüft; Docker enthält eine passende JRE-Stufe, lokaler Docker-Start mit tatsächlicher PDF/A-/CII-Ausgabe bestanden, spätere Zielserverabnahme offen.
- bwip-js4.11.4: serverseitige BWIPP-Code128-Erzeugung mit automatischer Zeichensatzwahl und Prüfsumme; Ausgabe direkt als monochrome PDF-Vektorbalken. Lizenzdateien der installierten Bibliothek einschließlich BWIPP-Hinweisen bleiben Bestandteil der Distribution.
- @zxing/library0.23.0: ausschließlich Entwicklungs-/Testabhängigkeit, unabhängiges Decodieren gerasterter PDF-Barcodes. Kein UI-Control oder Browser-Bundle.

Die Barcode-Nutzlast ist nur die sichtbare Belegnummer. Rechte und Mandantenzuordnung bleiben im ERP zu prüfen. Ein Barcode ist weder elektronische Signatur noch steuerliche Pflichtangabe. Alte Archivdateien bleiben unverändert; fremde Lieferantenoriginale werden nicht nachträglich gestempelt.

Mustang prüft die tatsächliche fertige Datei einschließlich PDF/A und CII-Profil. Eine bestandene technische Prüfung ersetzt keine fachliche Steuer-/Pflichtangaben-/Rechtsformprüfung. XRechnung wird dadurch nicht als umgesetzt ausgegeben. Aktuelle offizielle Spezifikations-/Rechtsstandsprüfung und betriebliche Archiv-/Restoreabnahme stehen unter [Compliance](compliance-gap-analysis.md).
