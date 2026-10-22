# Preview 0.7 · Automatische Materialversorgung und bewertetes Lager

Echte Chromium-Aufnahmen vom 22.10.2026 mit OpenUI5 1.153.0 und isolierten PostgreSQL-Testdaten. 103 automatisierte Prüfungen und neun Browserprozesse bestanden. [Versionsnotizen und Grenzen](../../releases/v0.7.0-preview.1.md).

Der Versorgungsfall zeigt Bedarf10, Bestand6, Reservierung6 und Fehlmengen-BANF4. Nach Bestellung/WE4 sind zehn Stück für die Lagerposition reserviert. Zwei weitere Nichtlager-/Fremdleistungspositionen bleiben ungedeckt; deshalb meldet der gesamte Auftrag weiterhin fehlende Versorgung. Reservierung ist noch kein Verbrauch.

Der separate Bewertungsfall zeigt Bestellung6/WE4+2 zum Preis40 und Bestellung4/WE4 zum Preis60: Menge10, Wert480, Durchschnitt48. Storno der letzten Lieferung nimmt Menge4 und Wert240 über Material- und FI-Gegenbeleg zurück.

## Automatisch erkannter Bedarf und Lagerverfügbarkeit

![Automatisch erkannter Bedarf und Lagerverfügbarkeit](material-availability.png)

## Sechs Stück aus vorhandenem Lager reserviert

![Sechs Stück aus vorhandenem Lager reserviert](material-stock-reserved.png)

## Nur vier fehlende Stück per BANF in Prüfung

![Nur vier fehlende Stück per BANF in Prüfung](material-shortage-requested.png)

## Wareneingang ergänzt die Reservierung auf zehn Stück

![Wareneingang ergänzt die Reservierung auf zehn Stück](material-arrived-reserved.png)

## Materialversorgung im mobilen Browser

![Materialversorgung im mobilen Browser](material-supply-mobile.png)

## Auftragskopf und freigegebene Positionen

![Auftragskopf und freigegebene Positionen](order-positions-expanded.png)

## Kunde, Fall, Organisation und Ursprung

![Kunde, Fall, Organisation und Ursprung](order-business-context.png)

## Werke und Lagerorte

![Werke und Lagerorte](warehouse-locations.png)

## Zehn Stück mit Wert480 und Durchschnitt48

![Zehn Stück mit Wert480 und Durchschnitt48](inventory-valuation.png)

## Bewerteter Teilwareneingang zur Bestellung

![Bewerteter Teilwareneingang zur Bestellung](goods-receipt-posted.png)

## Gegenbewegung mit Originalbezug

![Gegenbewegung mit Originalbezug](goods-receipt-reversal.png)

## Automatische ausgeglichene Finanzbuchung

![Automatische ausgeglichene Finanzbuchung](goods-receipt-journal.png)

## Materialbeleg auf dem Smartphone

![Materialbeleg auf dem Smartphone](goods-receipt-mobile.png)

