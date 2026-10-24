# RT-Anmeldung, Teilmengengutschrift und tatsächlicher Retoureneingang

Preview0.28 ergänzt drei zusammenhängende Arbeitspakete für unbezahlte inländische Direktvertriebs-Warenrechnungen. Die Umsetzung verwendet native OpenUI5-Controls und eigene Anwendungen. Sie erweitert die vorhandenen Voll-/Positionsgutschriften, ohne Originalrechnung, FI, OP oder archivierte Ausgaben umzuschreiben.

## 1. Eigene Retourenanmeldung

An der ursprünglichen Vertriebsauslieferung öffnet „Retoure anmelden“ eine breite Arbeitsseite. Originalartikel, Liefermenge, Fach, Charge und Seriennummer kommen aus dem tatsächlichen WA. Kunde und Kundenauftrag bleiben gebunden. Je Position wird nur die noch nicht in anderen aktiven RT gebundene Liefermenge angeboten. Anmeldemengen, geplantes Rücksendedatum, Kundenreferenz und Grund werden im RT-Beleg gespeichert. Eine Seriennummer kann nicht geteilt werden.

Die eigene App „Kundenretouren“ bietet Suche, Statusfilter, Mengenstand und getrennte Entwurfs-/Offen-/Erledigtanzeigen. Der Vertrieb gibt den RT-Entwurf mit Begründung frei. Diese **fachliche RT-Freigabe ist kein unabhängiger Finanzfreigabeprozess**. Eine GU benötigt weiterhin ihre eigene unabhängige Finanzprüfung. RT-Anmeldung und Freigabe verändern weder Forderung noch Lagerbestand. Ein verworfener RT bleibt erhalten; vorhandene wirksame Eingänge sind zuerst exakt zu stornieren. Parallele Anmeldungen dürfen dieselbe Liefermenge nicht doppelt binden.

## 2. Teilmengen einer Rechnungsposition gutschreiben

An einer gebuchten Rechnung öffnet „Teilmengen gutschreiben“ eine native Arbeitsseite mit Original- und Restmengen. Der Nutzer wählt Positionen und Mengen. Preis, Steuerart, Liefer-/Leistungsdaten und Kontierung bleiben am Rechnungsoriginal gebunden. Jeder Prüfstand benötigt eine eigene unabhängige GU-Freigabe; eigene Vorbereitung darf nicht selbst freigegeben werden. Je Rechnung ist weiterhin höchstens ein ungebuchter Prüfstand möglich.

Netto-/Steuerbeträge werden kumulativ am Original verteilt; der letzte Anteil erhält genau den verbliebenen Originalbetrag. Eine Teilung muss sowohl ihren eigenen Steuergruppenbetrag als auch den verbleibenden Steuerrest gültig darstellen. Nicht darstellbare Preis-/Steuercents werden vor Anlage abgewiesen. Keine freie Preisänderung und kein stiller Rundungsaufschlag. Nach einer Teilmengenkorrektur erfolgen weitere Korrekturen derselben Rechnung über diese Mengenfunktion; bisherige volle Positionsgutschriften bleiben unverändert.

Die Buchung erzeugt eine eigene anteilige Gegen-FI mit ursprünglichen Konten/Kostenstellen und einen eigenen Debitoren-Gegenposten. Die Saldenansicht zeigt die verbleibende Forderung. Jede GU erhält eine validierte PDF/A-3-/CII381-Ausgabe mit Originalrechnungsbezug, vollständigem Vertriebsmitarbeiter und Code128. Die Umsatz-App korrigiert ausschließlich die tatsächliche Teilmenge und deren ursprünglichen analytischen Warenkostenanteil.

## 3. Tatsächliche Teil-Retoureneingänge und exaktes Storno

Aus dem freigegebenen RT erfasst das Lager tatsächliche Mengen, Eingangs-/Beleg-/Buchungsdatum, offene Periode und Buchungsgrund. Mehrere Eingänge sind möglich. Die physische Rücknahme ist zusätzlich durch die bis zum Buchungstag **tatsächlich gebuchte** GU-Menge der ursprünglichen Lieferquelle begrenzt. Ein GU-Entwurf oder eine erst künftig datierte GU reicht nicht aus.

Der Eingang bucht auf das ursprüngliche Fach mit Originalcharge/-serie. Bewertung ist der centgenaue kumulative Anteil des ursprünglichen WA-Wertes; Bestands-/Aufwandskonto und Kostenstelle stammen aus der damaligen FI. Fachsperre, laufende Inventur, Kapazität, Mischregeln, Serienidentität und logischer/physischer Bestandsabgleich gelten. Die Laufzeitrolle hat weiterhin keine Schreibrechte auf die Bestandsprojektionen. Beleg, Positionen und Finanzbuchung werden zusammen atomar geprüft und bleiben nach Buchung unveränderlich.

Jeder WE kann einmal mit eigenem SB und exakter Originalmenge/-bewertung/-FI gegengebucht werden. Das Storno benötigt ausreichenden noch verfügbaren Bestand auf dem ursprünglichen Fach und darf Reservierungen oder Bewertung nicht unterschreiten. Danach ist die RT-Menge wieder empfangbar. Eine aktive RT sperrt die konkurrierende vollständige WA-Gegenbewegung. Nach allen Eingangsstornos und RT-Verwerfung kann die vorhandene ganze WA-Rücknahme erneut separat geprüft werden.

Die ursprüngliche AU-Auslieferung erfüllt weiterhin die ursprüngliche Lieferverpflichtung. Eine echte Kundenretoure öffnet verbrauchte Reservierungen oder alte Fakturaquellen **nicht erneut**. Ersatzlieferungen benötigen einen neuen kommerziellen Folgeprozess. Es werden keine Tickets, Serviceaufträge, WOT oder SRM für Direktvertrieb erfunden.

## Oberflächen, Dokumente und Grenzen

RT und Eingänge haben eigene Detailmasken, kleine Anlagenlisten, native Positionsraster am Desktop, mobile Tabellen, deutsche Daten und aufklappbare Belegflussbäume. Geschäfts-PDFs nutzen dieselbe Schwarz-Weiß-Basis mit vollständigem Ansprechpartner und Code128. Die Lagerbewegungsanzeige und der Umsatz-/Aufwandsbericht enthalten die tatsächlichen Eingänge und Stornos mit ihrem FI-Datum.

Nicht enthalten: Prüf-/Sperrbestand vor GU, Inspektion und freie Folgeaktivität, Wiederaufbereitung/Verschrottung, Ersatzlieferungsautomatik, freie Ziel-Fachwahl, Service-/Preisgutschriften, bezahlte Rechnungen/Rückzahlungen, geänderte Steuer-/Finanzpartner oder vollständige Advanced Returns. Diese Punkte bleiben verbindlich im Masterbacklog.

Migration035 ergänzt mengenbezogene GU, Migration036 RT und physische Gegenbewegungen.001–034 bleiben unverändert. Historische `FULL`-/`POSITIONS`-Belege behalten ihre Bedeutung; nur neue `QUANTITY`-Bezüge enthalten Teilmengen.
