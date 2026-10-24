# Positionsbezogene Kundengutschriften

Preview0.27 erweitert die [vollständige Rechnungskorrektur](customer-credit-memos.md) um eine Auswahl **ganzer ursprünglicher Rechnungspositionen** einer unbezahlten inländischen Direktvertriebsrechnung. Mehrere separat geprüfte GU-Belege können unterschiedliche Positionen derselben Rechnung korrigieren. Die Rechnung, ihre FI, der ursprüngliche Debitorenposten und die archivierten PDF-Bytes bleiben erhalten.

## Verbindlicher Ablauf

1. An der Rechnung „Positionen gutschreiben“ öffnen. Die breite native OpenUI5-Arbeitsseite zeigt Originalmenge, Nettowert, Steuer, Lieferschein und den bestehenden Bindungsstand. Auf dem Smartphone dient eine native Mehrfachauswahltabelle demselben Ablauf. Preise, Teilmengen und Leistungs-/Lieferdaten können hier nicht überschrieben werden.
2. Ungebundene Originalpositionen auswählen und Periode, deutsche Daten und einen nachvollziehbaren Grund erfassen. Ein Prüfstand bindet seine Positionen, verändert aber weder Forderung noch Lagerbestand. Je Rechnung ist ein ungebuchter Prüfstand gleichzeitig zulässig. Wiederholung und konkurrierende Anlage erzeugen keine Doppelbindung.
3. Jede GU benötigt eine eigene unabhängige Finanzfreigabe. Ersteller und Vorbereiter bleiben ausgeschlossen. Vorbereitung, Rücknahme einer Freigabe und erneute Prüfung verwenden dieselben bestehenden Regeln wie die Vollgutschrift.
4. Die Buchung erzeugt einen eigenen Finanzbeleg mit Bezug zur Original-FI. Forderung, ausgewählte Erlöszeilen, Kostenstellen und Steuerkontierung kommen ausschließlich aus dem Rechnungsoriginal. Die Teilekorrektur ist kein zweiter vollständiger FI-Storno. Der Debitoren-Gegenposten enthält genau den GU-Betrag; der ursprüngliche OP bleibt unverändert. Die Saldenansicht zieht jede gebuchte GU einmal ab.
5. Ausgabe und Archivierung verwenden eigene validierte PDF/A-3-/CII381-Originale, Originalrechnungsreferenz, vollständigen Vertriebsmitarbeiter, deutsche Daten und Code128. Jede Rechnung zeigt sämtliche Gutschriften; Kunden sehen nur ihre gebuchten Ausgaben. Keine Zahlungsaufforderung auf der verrechneten GU.
6. Ein offener oder abgelehnter Prüfstand kann mit Begründung verworfen werden. Nummer, Auswahl, ursprünglicher Grund und Audit bleiben erhalten; seine Positionen werden wieder verfügbar. Eine laufende Freigabe muss zuerst kontrolliert zurückgezogen werden. Gebuchte Gutschriften lassen sich so nicht verwerfen.

Beispiel der tatsächlichen Prozessprüfung: Zwei Lieferpositionen ergeben357,00EUR Rechnungsbetrag. Die erste GU über119,00EUR lässt238,00EUR offen. Eine weitere unabhängig gebuchte GU über238,00EUR stellt den Rest auf null. Der ursprüngliche Forderungsposten über357,00EUR bleibt unverändert erhalten.

## Steuer und Bericht

Die ursprüngliche Rechnung rundet Umsatzsteuer je Steuergruppe. Deren Centbetrag wird kumulativ auf die ursprünglichen Positionen verteilt. Die Auswahl muss zugleich einen selbst gültigen Steuergruppenbetrag ergeben und einen weiterhin korrekt darstellbaren Rest hinterlassen. Eine Auswahl, die einen nicht einzeln korrigierbaren Steuerrundungscent abtrennt oder im Rest zurücklässt, wird **vor** Anlage/Buchung abgewiesen. Die zusammenhängende Steuergruppe kann vollständig korrigiert werden. Es wird kein Cent stillschweigend erfunden, verloren oder einem anderen Steuersatz zugeschlagen.

Die Umsatz-App zieht ausschließlich die tatsächlich ausgewählten Originalpositionen ab, einschließlich genau ihres ursprünglichen analytischen Warenkostenanteils und Steueranteils. Der tatsächliche Warenaufwand bleibt bis zum tatsächlichen physischen Rückerhalt bestehen. Rollen ohne Kostenrecht erhalten weiterhin keine internen Kostenwerte. CSV, Filter und Belegnavigation verwenden dieselben Quellen.

## Physische Rücknahme und offene Grenzen

Die finanzielle GU erzeugt keinen Wareneingang. Eine **ganze ursprüngliche Auslieferung** darf erst zurückgenommen werden, wenn alle dort gebundenen aktiven AF-Mengen vollständig fakturiert und ihre tatsächlichen Rechnungspositionen gutgeschrieben wurden. Bei zwei getrennten Auslieferungen genügt die Korrektur der zu einer einzelnen Lieferung gehörenden Positionen, um genau diese ganze Lieferung zurückzunehmen; die andere bleibt gesperrt. Fach, Charge/Serie, Menge, Wert und ursprüngliche Gegen-FI bleiben erhalten. Historische AF werden nicht erneut fakturierbar.

Weiter offen: Teilmengen innerhalb einer Rechnungsposition oder einer ursprünglichen Lagerauslieferung, eigene RT-Retourenanmeldung, Prüf-/Sperrbestand, Wiederaufbereitung, reine Preisgutschrift, gesonderte Rundungskorrektur, Servicekorrektur, bezahlte Rechnungen/Rückzahlungen und geänderte Steuer-/Finanzpartnerfälle. Eine Auswahl ganzer Rechnungspositionen ist keine vollständige Advanced-Returns-Implementierung.

Migration034 ergänzt den Auswahlbezug und erweitert die bestehenden Prüfungen, Salden und Rücknahmeschranken.001–033 bleiben unverändert. Historische Vollgutschriften erhalten die Kennzeichnung `FULL`, neue ausgewählte Vorgänge `POSITIONS`. Die bestehende echte Gesamtgegenbuchung und ihr einmaliger Stornobezug bleiben erhalten. [Masterbacklog](../master-backlog-index.md).

## Fortschreibung Preview0.28

Die dort noch offenen Teilmengen innerhalb einer Rechnungsposition, eigene RT-Anmeldung und tatsächliche Teil-Retoureneingänge mit exaktem Storno sind nun für unbezahlte inländische DIRECT-Warenrechnungen ergänzt. [Regeln, Masken und verbleibende Grenzen](customer-returns.md). Die obigen Abschnitte beschreiben weiterhin den ursprünglichen0.27-Umfang ganzer Positionen.
