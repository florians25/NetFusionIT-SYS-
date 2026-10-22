import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import Decimal from 'decimal.js';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {harness,client} from '../scripts/test-harness.mjs';
import {incomingMatchingFixture} from './helpers/incoming-matching-fixture.mjs';
import {cmd,ok} from './helpers/service-fixture.mjs';
const {renderInvoiceXml}=createRequire(import.meta.url)('../dist/einvoice.js');let h,f,invoice,items,receipt,accountant,invoiceData;
const base=id=>'/api/incoming-invoices/'+id;
before(async()=>{h=await harness(3135);f=await incomingMatchingFixture(h);({invoice,items,receipt,accountant,invoiceData}=f);});
after(async()=>{if(h)await h.close();});
const mapping=(version,po=f.pos[0],target=po.items[0].id)=>({version,purchaseOrderId:po.id,note:'Lieferantenoriginal mit dem freigegebenen Serviceauftrag abgeglichen.',lines:items.map(l=>({invoiceItemId:l.id,purchaseOrderItemId:target}))});
test('Bestellkontext zeigt freigegebene SA-Bestellungen, tatsächlichen Teil-WE und getrennten Kreditorenbedarf',async()=>{
 const first=ok(await f.buyer(base(invoice.id)+'/matching'),200);assert.equal(first.choices.length,2);assert.ok(first.issues.some(i=>i.code==='ORDER'));ok(await f.buyer(base(invoice.id)+'/matching',cmd(mapping(first.version))));const m=ok(await f.buyer(base(invoice.id)+'/matching'),200);assert.equal(m.purchaseOrderNumber,f.pos[0].number);assert.equal(m.orderNumber,f.order.number);assert.equal(m.items[0].quantity,'6.000000');assert.equal(m.items[0].receivedQuantity,'2');assert.equal(m.items[0].invoiceQuantity,'4');assert.equal(m.receipts[0].number,receipt.number);assert.ok(m.issues.some(i=>i.code==='QUANTITY'));assert.ok(m.issues.some(i=>i.code==='CREDITOR'));assert.equal(m.accountingImplemented,false);assert.equal((await f.customer(base(invoice.id)+'/matching')).status,403);
});
test('Zwei Rechnungspositionen werden gemeinsam gegen dieselbe WE-Menge geprüft; weitere Teillieferung beseitigt die Mengenabweichung',async()=>{
 ok(await f.warehouse('/api/procurement/documents/'+f.pos[0].id+'/receipts',cmd(await f.body(f.pos[0],'2'))));let m=ok(await f.buyer(base(invoice.id)+'/matching'),200);assert.equal(m.items[0].receivedQuantity,'4');assert.equal(m.items[0].invoiceQuantity,'4');assert.ok(!m.issues.some(i=>i.code==='QUANTITY'));assert.equal(m.receipts.length,2);assert.equal(m.clear,false,'Fehlender Kreditor wird nicht durch passende WE-Menge ersetzt');
 await f.activateCreditor();m=ok(await f.buyer(base(invoice.id)+'/matching'),200);assert.equal(m.creditor.status,'ACTIVE');assert.equal(m.clear,true,JSON.stringify(m.issues));assert.equal(m.accountingImplemented,false);assert.equal((await h.admin.query('SELECT count(*) FROM journals WHERE source_id=$1',[invoice.id])).rows[0].count,'0');
});
test('WE-Storno wird beim erneuten Abgleich sofort berücksichtigt; Entwurfsmatching erzeugt weder Verbrauch noch eine neue Lagerbewegung',async()=>{
 ok(await f.warehouse('/api/inventory/receipts/'+receipt.id+'/reverse',cmd({periodId:f.period.id,postingDate:'2026-10-22',documentDate:'2026-10-22',reason:'Teillieferung zurückgebucht nach Mengenprüfung.'})));const m=ok(await f.buyer(base(invoice.id)+'/matching'),200);assert.equal(m.items[0].receivedQuantity,'2');assert.equal(m.receipts.filter(r=>!r.reversed).length,1);assert.ok(m.issues.some(i=>i.code==='QUANTITY'));assert.equal(m.items[0].invoiceQuantity,'4');
});
test('Version, vollständige Quellpositionen und Bestellpositionsbindung gelten über API und deferred SQL-Schutz',async()=>{
 const m=ok(await f.buyer(base(invoice.id)+'/matching'),200);assert.equal((await f.buyer(base(invoice.id)+'/matching',cmd(mapping(m.version-1)))).status,409);assert.equal((await f.buyer(base(invoice.id)+'/matching',cmd(mapping(m.version,f.pos[0],f.pos[1].items[0].id)))).status,409);assert.equal((await f.buyer(base(invoice.id)+'/matching',cmd({...mapping(m.version),lines:[]}))).status,400);
 await assert.rejects(h.admin.query('UPDATE supplier_invoice_items SET purchase_order_item_id=$1 WHERE id=$2',[f.pos[1].items[0].id,items[0].id]),/anderen Bestellung/);await assert.rejects(h.admin.query('UPDATE supplier_invoices SET order_id=$1 WHERE id=$2',[randomUUID(),invoice.id]));
 const rows=await Promise.all([f.buyer(base(invoice.id)+'/matching',cmd(mapping(m.version))),f.buyer(base(invoice.id)+'/matching',cmd(mapping(m.version)))]);assert.deepEqual(rows.map(r=>r.status).sort(),[201,409]);
});

test('Abweichende Währung, Parteien, Preise und Einheiten werden trotz normativ gültigem Original getrennt zur Klärung gemeldet',async()=>{
 const data=structuredClone(invoiceData);data.number='LF-ORIGINAL-002';data.currency='USD';data.seller.name='Anderer Rechnungsaussteller GmbH';data.buyer.street='Abweichende Straße 9';for(const l of data.items){l.unit='H';l.unitNet='60';l.net='120.00';}data.net='240.00';data.tax='45.60';data.gross='285.60';data.taxes=[{rate:'19',basis:data.net,amount:data.tax}];const content=Buffer.from(renderInvoiceXml(data)),other=ok(await f.buyer('/api/incoming-invoices/receive?companyId='+f.company.id+'&filename=Abweichung.xml',{method:'POST',body:content,headers:{'Content-Type':'application/xml','Idempotency-Key':randomUUID()}}));assert.equal(ok(await f.buyer(base(other.id)+'/process',cmd({}))).state,'VALIDATED');const d=ok(await f.buyer(base(other.id)),200);ok(await f.buyer(base(other.id)+'/matching',cmd({version:d.version,purchaseOrderId:f.pos[0].id,note:'Abweichungen des Originalbelegs sichtbar prüfen.',lines:d.items.map(l=>({invoiceItemId:l.id,purchaseOrderItemId:f.pos[0].items[0].id}))})));const m=ok(await f.buyer(base(other.id)+'/matching'),200);for(const code of ['CURRENCY','SELLER','BUYER','PRICE','UNIT'])assert.ok(m.issues.some(i=>i.code===code),code);assert.equal(m.clear,false);assert.ok(new Decimal(ok(await f.buyer('/api/procurement/documents/'+f.pos[0].id),200).items[0].unitPrice).eq('40'));
});
test('Unterschiedliche Originalbytes mit derselben Kreditoren-Belegnummer werden nach Zuordnung in beiden offenen Eingängen als Dublette erkannt',async()=>{
 const content=Buffer.from(renderInvoiceXml(invoiceData)+'\n'),other=ok(await f.buyer('/api/incoming-invoices/receive?companyId='+f.company.id+'&filename=DoppelterEingang.xml',{method:'POST',body:content,headers:{'Content-Type':'application/xml','Idempotency-Key':randomUUID()}}));assert.notEqual(other.id,invoice.id);assert.equal(ok(await f.buyer(base(other.id)+'/process',cmd({}))).state,'VALIDATED');const d=ok(await f.buyer(base(other.id)),200);ok(await f.buyer(base(other.id)+'/matching',cmd({version:d.version,purchaseOrderId:f.pos[0].id,note:'Doppelten Eingang zur Klärung zugeordnet.',lines:d.items.map(l=>({invoiceItemId:l.id,purchaseOrderItemId:f.pos[0].items[0].id}))})));for(const id of [invoice.id,other.id])assert.ok(ok(await f.buyer(base(id)+'/matching'),200).issues.some(i=>i.code==='DUPLICATE'));
});

test('Abgebrochene Eingänge behalten die frühere Zuordnung und lassen sie weder über API noch per SQL nachträglich ändern',async()=>{
 const m=ok(await f.buyer(base(invoice.id)+'/matching'),200);ok(await f.buyer(base(invoice.id)+'/cancel',cmd({version:m.version,reason:'Nicht zu buchenden Doppeleingang nachvollziehbar abbrechen.'})));assert.equal((await f.buyer(base(invoice.id)+'/matching',cmd(mapping(m.version+1)))).status,409);await assert.rejects(h.admin.query("UPDATE supplier_invoices SET match_note='Nachträglich verändert' WHERE id=$1",[invoice.id]),/unveränderlich/);assert.equal(ok(await f.buyer(base(invoice.id)+'/matching'),200).purchaseOrderId,f.pos[0].id);
});
