import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {harness} from '../scripts/test-harness.mjs';
import {cmd,ok} from './helpers/service-fixture.mjs';
import {inventoryFixture} from './helpers/inventory-fixture.mjs';
let h,f,order,supply,initialReceipt,requested,po,partialReceipt;
const path=()=>'/api/service/orders/'+order.id;
const state=async()=>ok(await f.tech(path()+'/material-planning'),200);
async function body(action,which=order){return {version:ok(await f.tech('/api/service/orders/'+which.id),200).version,action,items:[{itemId:which.extraItems[0].id,requiredOn:'2026-10-30',locationId:null}]};}
async function approve(author,id,version){const pending=ok(await f.manager('/api/workflow/inbox'),200).find(r=>r.documentId===id&&r.status==='PENDING'),s=pending||ok(await author('/api/workflow/submit/'+id,cmd({version})));ok(await f.manager('/api/workflow/instances/'+s.id+'/decide',cmd({version:1,decision:'APPROVE',comment:'Materialversorgung und Auftragskontierung geprüft.'})));}
before(async()=>{
 h=await harness(3120);f=await inventoryFixture(h);ok(await f.configure());ok(await f.rules());initialReceipt=ok(await f.warehouse('/api/procurement/documents/'+f.pos[0].id+'/receipts',cmd(await f.body(f.pos[0],'6'))));
 const origin=ok(await f.tech('/api/service/orders/'+f.order.id+'/material-planning'),200);assert.equal(origin.reservations.length,1);ok(await f.tech('/api/service/orders/'+f.order.id+'/reservations/'+origin.reservations[0].id+'/release',cmd({version:1,reason:'Lagerbestand bewusst für einen anderen dringenden Auftrag freigeben.'})));
 order=await f.makeOrder('PAID','TIME_MATERIAL',[{productId:f.product.id,quantity:'10',description:'Zehn Ersatzteile aus Lager und Beschaffung'}]);
});after(async()=>{if(h)await h.close();});
test('Freigegebene Artikelpositionen erzeugen automatisch Bedarf; freier Bestand und Fehlmenge sind positionsbezogen sichtbar',async()=>{
 supply=await state();assert.equal(supply.items.length,1);const p=supply.items[0];assert.equal(p.quantity,'10.000000');assert.equal(p.availableQuantity,'6.000000');assert.equal(p.reservedQuantity,'0.000000');assert.equal(p.shortageQuantity,'4.000000');assert.equal(p.supplyStatus,'PARTIALLY_AVAILABLE');assert.equal(p.needs.length,1);assert.equal(p.needs[0].neededOn,'2026-10-30');assert.equal(ok(await f.tech('/api/procurement/documents/'+p.needs[0].requirementId),200).systemGenerated,true);
 assert.equal((await f.customer(path()+'/material-planning')).status,403);assert.equal((await f.tech('/api/procurement/documents/'+p.needs[0].requirementId+'/cancel',cmd({version:1,reason:'Automatischen Bedarf unabhängig vom Auftrag löschen.'}))).status,409);
});
test('Lager nutzen reserviert verfügbare Mengen atomar; Konkurrenz erzeugt keine Doppelreservierung und noch keine BANF',async()=>{
 const b=await body('USE_STOCK'),rs=await Promise.all([f.tech(path()+'/material-planning',cmd(b)),f.tech(path()+'/material-planning',cmd(b))]);assert.deepEqual(rs.map(r=>r.status).sort(),[201,409]);assert.equal(rs.find(r=>r.status===201).data.requisition,null);supply=await state();assert.equal(supply.items[0].reservedQuantity,'6.000000');assert.equal(supply.items[0].shortageQuantity,'4.000000');assert.equal(supply.items[0].availableQuantity,'0.000000');const c=ok(await f.warehouse('/api/inventory/companies/'+f.company.id),200);assert.equal(c.balances[0].quantity,'6.000000');assert.equal(c.balances[0].reservedQuantity,'6.000000');assert.equal(c.balances[0].availableQuantity,'0.000000');assert.equal(c.valuations[0].value,'240.0000');
});
test('Fehlende Freigabedefinition rollt die automatische BANF und Nummernvergabe vollständig zurück',async()=>{
 const definition=ok(await f.admin('/api/workflow/definitions'),200).find(d=>d.subjectKind==='REQUISITION'&&d.active),before=(await h.admin.query("SELECT count(*) FROM documents WHERE kind='REQUISITION'")).rows[0].count,v=ok(await f.tech(path()),200).version;
 try{await h.admin.query('UPDATE approval_definitions SET active=false WHERE id=$1',[definition.id]);assert.equal((await f.tech(path()+'/material-planning',cmd(await body('REQUEST_PARTS')))).status,409);assert.equal((await h.admin.query("SELECT count(*) FROM documents WHERE kind='REQUISITION'")).rows[0].count,before);assert.equal(ok(await f.tech(path()),200).version,v);assert.equal((await state()).items[0].reservedQuantity,'6.000000');}finally{await h.admin.query('UPDATE approval_definitions SET active=true WHERE id=$1',[definition.id]);}
});
test('Teile bestellen erzeugt automatisch nur BANF4 und behält Kostenkontierung; Wiederholung erzeugt keinen weiteren Beleg',async()=>{
 const b=await body('REQUEST_PARTS'),key=randomUUID(),r=ok(await f.tech(path()+'/material-planning',cmd(b,key)));assert.ok(r.requisition);assert.deepEqual(ok(await f.tech(path()+'/material-planning',cmd(b,key))),r);requested=ok(await f.tech('/api/procurement/documents/'+r.requisition.id),200);assert.equal(requested.status,'IN_REVIEW');assert.equal(requested.items[0].quantity,'4.000000');assert.equal(requested.items[0].costCenter,'SERVICE-BERLIN');assert.equal(requested.items[0].costObject,f.ticket.caseNumber);assert.equal((await state()).status,'REQUESTED');assert.equal(ok(await f.tech(path()+'/material-planning',cmd(await body('REQUEST_PARTS')))).requisition,null);assert.equal(ok(await f.tech(path()+'/procurement'),200).requisitions.length,1);
 const own=ok(await f.tech('/api/service/orders/'+order.id),200);assert.equal(own.materialStatus,'REQUESTED');assert.equal(own.items.find(i=>i.id===order.extraItems[0].id).supplyStatus,'REQUESTED');assert.equal(own.context.caseNumber,f.ticket.caseNumber);
});
test('Bestellfreigabe und Teil-WE aktualisieren Positions- und Kopfstatus; eingehende Teile werden für ihren Auftrag reserviert',async()=>{
 await approve(f.tech,requested.id,requested.version);po=ok(await f.buyer(path()+'/purchase-orders',cmd({requisitionId:requested.id,supplierId:f.supplier.id,title:'Automatisch angeforderte Fehlmenge',items:[{requisitionItemId:requested.items[0].id,quantity:'4',unitPrice:'50',deliveryDate:'2026-10-30',overdeliveryPercent:'0'}]})));await approve(f.buyer,po.id,1);assert.equal((await state()).status,'ORDERED');po=ok(await f.buyer('/api/procurement/documents/'+po.id),200);
 partialReceipt=ok(await f.warehouse('/api/procurement/documents/'+po.id+'/receipts',cmd(await f.body(po,'2'))));supply=await state();assert.equal(supply.status,'PARTIALLY_RECEIVED');assert.equal(supply.items[0].reservedQuantity,'8.000000');assert.equal(supply.items[0].receivedQuantity,'2.000000');assert.equal(supply.items[0].openProcurementQuantity,'2.000000');
 ok(await f.warehouse('/api/procurement/documents/'+po.id+'/receipts',cmd(await f.body(po,'2'))));supply=await state();assert.equal(supply.status,'MATERIAL_READY');assert.equal(supply.items[0].reservedQuantity,'10.000000');assert.equal(ok(await f.tech(path()),200).materialStatus,'MATERIAL_READY');assert.equal(ok(await f.warehouse('/api/inventory/companies/'+f.company.id),200).valuations[0].value,'440.0000');
});
test('Wareneingangsstorno gibt nur eigene Reservierungen frei und setzt Versorgung nachvollziehbar zurück',async()=>{
 ok(await f.warehouse('/api/inventory/receipts/'+partialReceipt.id+'/reverse',cmd({periodId:f.period.id,postingDate:'2026-10-23',documentDate:'2026-10-23',reason:'Falsche Teilanlieferung zurücknehmen.'})));supply=await state();assert.equal(supply.status,'PARTIALLY_RECEIVED');assert.equal(supply.items[0].reservedQuantity,'8.000000');assert.equal(supply.reservations.filter(r=>r.status==='ACTIVE'&&r.source==='STOCK').length,1);
 assert.equal((await f.warehouse('/api/inventory/receipts/'+initialReceipt.id+'/reverse',cmd({periodId:f.period.id,postingDate:'2026-10-23',documentDate:'2026-10-23',reason:'Anderweitig reservierten Bestand zurücknehmen.'}))).status,409);
});
test('Ohne freien Lagerbestand meldet Lager nutzen die Fehlmenge und kann keine fremden Reservierungen verwenden',async()=>{
 const other=await f.makeOrder('PAID','TIME_MATERIAL',[{productId:f.product.id,quantity:'1',description:'Weiterer Auftrag ohne verfügbaren Lagerbestand'}]),b=await body('USE_STOCK',other),r=ok(await f.tech('/api/service/orders/'+other.id+'/material-planning',cmd(b)));assert.equal(r.reserved.length,0);assert.equal(r.requisition,null);assert.equal(r.shortages[0].quantity,'1.000000');assert.equal(ok(await f.tech('/api/service/orders/'+other.id+'/material-planning'),200).status,'SHORTAGE');
 const invalid=await body('USE_STOCK',other);invalid.items[0].locationId=randomUUID();assert.equal((await f.tech('/api/service/orders/'+other.id+'/material-planning',cmd(invalid))).status,409);
});
test('Reservierungen besitzen Mandanten-RLS und Datenbankschutz gegen Überreservierung',async()=>{
 const active=(await state()).reservations.find(r=>r.status==='ACTIVE');const tenant=(await h.admin.query('SELECT tenant_id FROM stock_reservations WHERE id=$1',[active.id])).rows[0].tenant_id;await h.admin.query('BEGIN');await h.admin.query("SELECT set_config('app.tenant_id',$1,true)",[tenant]);await assert.rejects(h.admin.query("INSERT INTO stock_reservations(id,tenant_id,order_id,requirement_item_id,company_id,product_id,location_id,batch,serial,quantity,source,created_by) SELECT $1,tenant_id,order_id,requirement_item_id,company_id,product_id,location_id,batch,serial,999,'STOCK',created_by FROM stock_reservations WHERE id=$2",[randomUUID(),active.id]),/freien Bestand/);await h.admin.query('ROLLBACK');
 const app=new pg.Client({connectionString:h.urls.app});await app.connect();try{await app.query('BEGIN');await app.query("SELECT set_config('app.tenant_id',$1,true)",[randomUUID()]);assert.equal((await app.query('SELECT count(*) FROM stock_reservations')).rows[0].count,'0');await app.query('ROLLBACK');}finally{await app.end();}
});

test('Gleichzeitige Auftragsfreigabe und Materialplanung sperren Dokument und Auftrag in konsistenter Reihenfolge',async()=>{
 for(let index=0;index<4;index++){
  const o=ok(await f.admin('/api/service/orders',cmd({caseId:f.ticket.caseId,sourceTicketId:null,contractId:null,title:'Freigabe-/Planungskonkurrenz '+index,kind:'PAID',currency:'EUR',pricingDate:'2026-10-22'}))),item=ok(await f.admin('/api/service/orders/'+o.id+'/items',cmd({version:1,productId:f.product.id,description:'Materialposition zur parallelen Freigabe',quantity:'1',billingRule:'TIME_MATERIAL',costCenter:'SERVICE-BERLIN',costObject:f.ticket.caseNumber,requiredOn:'2026-10-30'}))),submitted=ok(await f.admin('/api/workflow/submit/'+o.id,cmd({version:item.version})));
  const rs=await Promise.all([f.support('/api/workflow/instances/'+submitted.id+'/decide',cmd({version:1,decision:'APPROVE',comment:'Auftragsfreigabe parallel zur Materialplanung.'})),f.tech('/api/service/orders/'+o.id+'/material-planning',cmd({version:item.version+1,action:'USE_STOCK',items:[{itemId:item.id,requiredOn:'2026-10-30',locationId:null}]}))]);assert.equal(rs[0].status,201,JSON.stringify(rs[0].data));assert.equal(rs[1].status,409,JSON.stringify(rs[1].data));assert.equal(ok(await f.tech('/api/service/orders/'+o.id+'/procurement'),200).requirements.length,1);
 }
});
