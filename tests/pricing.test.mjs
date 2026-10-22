import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{calculatePrice,sumAmounts}=require('../dist/pricing.js');
const rule=(kind,value,extra={})=>({id:kind,code:kind,kind,value,sequence:10,priority:0,minimumQuantity:'1',...extra});
test('Preisfindung erhält Dezimalwerte, rundet je Position und addiert Steuer reproduzierbar',()=>{
 const r=calculatePrice('3',2,[rule('BASE','0.1'),rule('TAX','19')]);assert.equal(r.net,'0.30');assert.equal(r.tax,'0.06');assert.equal(r.gross,'0.36');assert.equal(r.trace.at(-1).kind,'TAX');
 assert.equal(calculatePrice('1',2,[rule('BASE','0.005'),rule('TAX','0')]).net,'0.01');
 assert.equal(sumAmounts(['9999999999999999.9999','0.0001'],4),'10000000000000000.0000');
});
test('Explizite Priorität und Mengenstaffel bestimmen den Preis unabhängig von Eingangsreihenfolge',()=>{
 const rules=[rule('BASE','100'),rule('BASE','80',{id:'tier',minimumQuantity:'10'}),rule('BASE','70',{id:'customer',priority:10}),rule('TAX','0')];
 assert.equal(calculatePrice('12',2,rules).unitPrice,'70');assert.deepEqual(calculatePrice('12',2,rules),calculatePrice('12',2,[...rules].reverse()));
 assert.equal(calculatePrice('12',2,rules.filter(r=>r.id!=='customer')).net,'960.00');assert.equal(calculatePrice('2',2,rules.filter(r=>r.id!=='customer')).net,'200.00');
});
test('Rabatte und Zuschläge folgen konfigurierter Reihenfolge; absolute Anpassung gilt je Einheit',()=>{
 const r=calculatePrice('2',2,[rule('BASE','100'),rule('DISCOUNT_PERCENT','10',{sequence:20}),rule('SURCHARGE_AMOUNT','5',{sequence:30}),rule('TAX','19')]);assert.equal(r.net,'190.00');assert.equal(r.tax,'36.10');assert.equal(r.gross,'226.10');
});
test('Fehlende oder mehrdeutige Konditionen, Überrabatt und Betragsüberlauf werden abgewiesen',()=>{
 assert.throws(()=>calculatePrice('1',2,[rule('BASE','100')]),/fehlt/);assert.throws(()=>calculatePrice('1',2,[rule('BASE','100'),rule('BASE','90'),rule('TAX','19')]),/Mehrdeutige/);
 assert.throws(()=>calculatePrice('1',2,[rule('BASE','10'),rule('DISCOUNT_AMOUNT','11'),rule('TAX','19')]),/negativen/);
 assert.throws(()=>calculatePrice('999999999999',2,[rule('BASE','999999999999'),rule('TAX','0')]),/Wertebereich/);
});
test('Nicht fakturierbare Garantie/interne Leistung erzeugt auch ohne Verkaufskonditionen keinen Kundenpreis',()=>{
 const r=calculatePrice('2',2,[],false);assert.equal(r.net,'0.00');assert.equal(r.tax,'0.00');assert.equal(r.billable,false);assert.equal(r.trace[0].reason,'NON_BILLABLE');
});
