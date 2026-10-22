# Doppelte Finanzbuchhaltung (geplant)

Operative Belege sind keine Journale. Finance verwaltet Kontenplan, Geschäftsjahr/Periode, Kontierung, Steuerkennzeichen, Journal, offene Posten, Zahlungen und Ausgleich. Konfigurierbarer, fachlich abgestimmter Kontenplan, beispielsweise SKR03/SKR04-orientiert. Journalposition: Konto, Soll/Haben, Decimal-Betrag, Währung, Steuer, Kostenstelle und Referenz. Pro Beleg/Währung Soll = Haben; keine negativen oder gleichzeitig Soll/Haben-Werte. Nur offene Perioden, aktive Konten und gültige Kontierungsregeln.

Ausgangsrechnung: Forderung im Soll, Erlös und Umsatzsteuer im Haben. Zahlungseingang: Bank im Soll, Forderung im Haben. Gutschrift/Storno verwendet referenzierte Gegenbuchung; keine nachträgliche Änderung gebuchter Journale. Technischer Hash/Audit allein ersetzt kein geeignetes Archiv.

OP-Ausgleich ist eine eigene Zuordnung zwischen Zahlung und Forderung, mit Teil-/Überzahlung und Währung. Konkurrenzsperre schützt offenen Betrag. Kreditoren integrieren Bestell-/Wareneingangsbezug und Rechnungseingangsprüfung. Zahlungsdateien benötigen separate Sicherheits-/Freigabekontrollen.

Berichte: Kontoblatt, Summen/Salden, OP, Debitoren/Kreditoren, USt, Kostenstellen, Bilanz-/GuV-Entwurf und BWA auf echten Journalen. DATEV-Export besitzt eindeutigen Lauf, Kontenmapping, Belegreferenzen, Format-/Summenvalidierung und Abstimmbericht.

Vor Umsetzung erforderlich: Unternehmens-/Steuerland, Umsatzsteuerverfahren, Kontenrahmen, Periodensteuerung, Rundung, Währungsregeln, Zahlungszuordnung und Korrekturpolicy. Steuerberater muss Buchungsregeln und Exporte fachlich abnehmen. Die erste Lieferung besitzt keine Finanzbuchhaltung und keine entsprechende Compliance-Zusage.
