import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {harness,client} from '../scripts/test-harness.mjs';
import {cmd,ok,serviceFixture} from './helpers/service-fixture.mjs';
let h,f,buyer,manager,product,order,need,banf,supplier,po1,po2;
const root=()=>'/api/service/orders/'+order.id;
const poBody=(quantity='6')=>({requisitionId:banf.id,supplierId:supplier.id,title:'Ersatzteile für Serviceauftrag Berlin',items:[{requisitionItemId:banf.items[0].id,quantity,unitPrice:'40',deliveryDate:'2026-10-30',overdeliveryPercent:'0'}]});
async function approve(author,id,version){const s=ok(await author('/api/workflow/submit/'+id,cmd({version})));return manager('/api/workflow/instances/'+s.id+'/decide',cmd({version:1,decision:'APPROVE',comment:'Bedarf, Menge und Einkaufskonditionen geprüft.'}));}
before(async()=>{
 h=await harness(3115);f=await serviceFixture(h);
 for(const role of ['BUYER','PURCHASING_MANAGER']){const u={name:role==='BUYER'?'Einkauf Prüfung':'Einkaufsleitung Prüfung',email:role.toLowerCase()+'@example.test',password:randomUUID(),role,organizationId:f.org};ok(await f.admin('/api/admin/users',{method:'POST',body:u}));const api=await client(h.base,{tenant:'netfusion',...u});if(role==='BUYER')buyer=api;else manager=api;}
 for(const subjectKind of ['REQUISITION','PURCHASE_ORDER'])ok(await f.admin('/api/workflow/definitions',cmd({name:'Freigabe '+subjectKind,organizationId:f.org,subjectKind,fourEyes:true,steps:[{name:'Einkaufsleitung',roles:['PURCHASING_MANAGER']}]})));
 ok(await f.admin('/api/workflow/definitions',cmd({name:'Geschäftspartnerfreigabe',organizationId:f.org,subjectKind:'BUSINESS_PARTNER',fourEyes:true,steps:[{name:'Stammdatenprüfung',roles:['SUPPORT']}]})));
 ok(await f.admin('/api/finance/companies',cmd({organizationId:f.org,code:'1000',name:'NetFusion Testgesellschaft',currency:'EUR',country:'DE',street:'Teststraße 1',postalCode:'10115',city:'Berlin',vatId:''})));
 product=ok(await f.admin('/api/catalog/products',cmd({organizationId:f.org,sku:'SPARE-10',name:'Netzwerk-Ersatzteil',kind:'STOCK',unit:'EA',taxCode:'STANDARD',productGroup:'IT',description:'Ersatzteil zur Reparatur.'})));ok(await f.approve(product.id,1));ok(await f.admin('/api/pricing/conditions',cmd({organizationId:f.org,code:'PR00',kind:'BASE',sequence:10,priority:0,productId:product.id,partnerId:null,contractId:null,customerGroup:null,productGroup:null,taxCode:null,currency:'EUR',validFrom:'2020-01-01',validTo:'2099-12-31',minimumQuantity:'0.000001',value:'100'})));
 order=await f.makeOrder('PAID','TIME_MATERIAL',[{productId:product.id,quantity:'10',description:'Ersatzteile für die Netzwerkreparatur'}]);supplier=ok(await f.admin('/api/procurement/suppliers',cmd({organizationId:f.org,name:'Ersatzteilhandel Test GmbH',email:'supplier@example.test',street:'Lieferantenstraße 2',postalCode:'20095',city:'Hamburg',country:'DE',vatId:'',paymentTermsDays:30})));
});after(async()=>{if(h)await h.close();});
test('Beschaffung startet nur vom freigegebenen Serviceauftrag; Bedarf bleibt an dessen Positionen gebunden',async()=>{
 assert.equal((await f.tech('/api/service/orders/'+f.ticket.id+'/material-requirements',cmd({title:'Unzulässiger Ticketbedarf',urgency:'NORMAL',items:[{orderItemId:order.extraItems[0].id,quantity:'10',neededOn:'2026-10-30',purpose:'Ersatzteile zur Reparatur.'}]}))).status,404);
 assert.equal((await f.customer(root()+'/procurement')).status,403);assert.equal((await f.tech(root()+'/material-requirements',cmd({title:'Stunden sind kein Materialbedarf',urgency:'NORMAL',items:[{orderItemId:order.item.id,quantity:'1',neededOn:'2026-10-30',purpose:'Unzulässiger Stundenbedarf.'}]}))).status,409);
 need=ok(await f.tech(root()+'/material-requirements',cmd({title:'Materialbedarf Netzwerkreparatur',urgency:'URGENT',items:[{orderItemId:order.extraItems[0].id,quantity:'10',neededOn:'2026-10-30',purpose:'Defekte Komponenten vollständig austauschen.'}]})));need=ok(await f.tech('/api/procurement/documents/'+need.id),200);assert.equal(need.orderId,order.id);assert.equal(need.items[0].quantity,'10.000000');
 assert.equal((await f.tech(root()+'/material-requirements',cmd({title:'Überhöhte Zusatzanforderung',urgency:'NORMAL',items:[{orderItemId:order.extraItems[0].id,quantity:'1',neededOn:'2026-10-30',purpose:'Unzulässiger Mehrbedarf.'}]}))).status,409);
});
test('Parallele BANF-Anlage kann denselben Bedarf nicht doppelt beschaffen und übernimmt die Kontierung',async()=>{
 const b={title:'BANF Netzwerk-Ersatzteile',items:[{requirementItemId:need.items[0].id,quantity:'10',estimatedUnitPrice:'40'}]},rs=await Promise.all([f.tech(root()+'/requisitions',cmd(b)),f.tech(root()+'/requisitions',cmd(b))]);assert.deepEqual(rs.map(r=>r.status).sort(),[201,409]);banf=ok(await f.tech('/api/procurement/documents/'+rs.find(r=>r.status===201).data.id),200);assert.equal(banf.items[0].costCenter,'SERVICE-BERLIN');assert.equal(banf.items[0].costObject,f.ticket.caseNumber);assert.equal((await f.tech(root()+'/purchase-orders',cmd(poBody()))).status,403);assert.equal((await buyer(root()+'/purchase-orders',cmd(poBody()))).status,409);ok(await approve(f.tech,banf.id,1));
});
test('Lieferanten verwenden Stammdatenfreigabe und erscheinen nicht als Kunden im Ticketformular',async()=>{
 assert.equal((await buyer(root()+'/purchase-orders',cmd(poBody()))).status,409);const submitted=ok(await f.admin('/api/workflow/submit/'+supplier.id,cmd({version:1})));ok(await f.support('/api/workflow/instances/'+submitted.id+'/decide',cmd({version:1,decision:'APPROVE',comment:'Lieferantenstammdaten geprüft.'})));assert.equal(ok(await buyer('/api/procurement/suppliers'),200)[0].status,'ACTIVE');assert.equal(ok(await f.admin('/api/partners'),200).some(p=>p.id===supplier.id),false);assert.equal((await f.admin('/api/tickets',cmd({partnerId:supplier.id,title:'Lieferant darf kein Ticketkunde sein',description:'Unzulässiger Kundenbezug auf reine Lieferantenrolle.',type:'INCIDENT',priority:'MEDIUM'}))).status,404);
 assert.equal((await buyer('/api/tickets/'+f.ticket.id)).status,403);assert.equal((await buyer('/api/service/orders/'+order.id)).status,200);
});
test('Parallele Teilbestellung bindet maximal die offene BANF-Menge, einschließlich Entwürfen',async()=>{
 const rs=await Promise.all([buyer(root()+'/purchase-orders',cmd(poBody())),buyer(root()+'/purchase-orders',cmd(poBody()))]);assert.deepEqual(rs.map(r=>r.status).sort(),[201,409]);po1=rs.find(r=>r.status===201).data;const r=ok(await buyer('/api/procurement/documents/'+banf.id),200);assert.equal(r.items[0].committedQuantity,'6.000000');assert.equal(r.status,'RELEASED');po2=ok(await buyer(root()+'/purchase-orders',cmd(poBody('4'))));assert.equal((await buyer(root()+'/purchase-orders',cmd(poBody('1')))).status,409);
});
test('Freigabe prüft Lieferantenstatus erneut; BANF wird erst mit freigegebenen Bestellungen teilweise/vollständig bestellt',async()=>{
 const s=ok(await buyer('/api/workflow/submit/'+po1.id,cmd({version:1})));await h.admin.query("UPDATE business_partners SET status='BLOCKED' WHERE id=$1",[supplier.id]);assert.equal((await manager('/api/workflow/instances/'+s.id+'/decide',cmd({version:1,decision:'APPROVE',comment:'Freigabe bei gesperrtem Lieferanten.'}))).status,409);await h.admin.query("UPDATE business_partners SET status='ACTIVE' WHERE id=$1",[supplier.id]);ok(await manager('/api/workflow/instances/'+s.id+'/decide',cmd({version:1,decision:'APPROVE',comment:'Lieferant aktiv, Bestellung geprüft.'})));assert.equal(ok(await buyer('/api/procurement/documents/'+banf.id),200).status,'PARTIALLY_ORDERED');ok(await approve(buyer,po2.id,1));assert.equal(ok(await buyer('/api/procurement/documents/'+banf.id),200).status,'FULLY_ORDERED');const overview=ok(await f.tech(root()+'/procurement'),200);assert.equal(overview.purchaseOrders.length,2);assert.ok(overview.purchaseOrders.every(p=>p.status==='RELEASED'));
});
test('Belegfluss erhält Auftrag → Bedarf → BANF → Teilbestellungen und schützt Kundensicht',async()=>{
 const flow=ok(await buyer('/api/documents/'+order.id+'/flow'),200);assert.ok(flow.some(x=>x.sourceId===need.id&&x.targetId===banf.id));assert.ok(flow.some(x=>x.sourceId===banf.id&&x.targetId===po1.id));const customerFlow=ok(await f.customer('/api/documents/'+order.id+'/flow'),200);assert.equal(customerFlow.some(x=>[need.id,banf.id,po1.id,po2.id,supplier.id].includes(x.targetId)),false);assert.equal((await f.customer('/api/procurement/documents/'+po1.id)).status,403);
});
test('Neue Beschaffungstabellen erzwingen Mandanten-RLS bei direktem Laufzeitzugriff',async()=>{
 const app=new pg.Client({connectionString:h.urls.app});await app.connect();try{await app.query('BEGIN');await app.query("SELECT set_config('app.tenant_id',$1,true)",[randomUUID()]);for(const table of ['supplier_data','order_requirements','order_requirement_items','purchase_requisitions','purchase_requisition_items','purchase_orders','purchase_order_items'])assert.equal((await app.query('SELECT count(*) FROM '+table)).rows[0].count,'0');await app.query('ROLLBACK');}finally{await app.end();}
});

test('Verwerfen und Ablehnung geben Mengen frei; Wiedereinreichen kann freigewordene Mengen nicht doppelt binden',async()=>{
 const o=await f.makeOrder('PAID','TIME_MATERIAL',[{productId:product.id,quantity:'10',description:'Zweiter Materialbedarf zur Korrekturprüfung'}]),base='/api/service/orders/'+o.id;
 let n=ok(await f.tech(base+'/material-requirements',cmd({title:'Korrigierbarer Materialbedarf',urgency:'NORMAL',items:[{orderItemId:o.extraItems[0].id,quantity:'10',neededOn:'2026-10-30',purpose:'Beschaffung mit korrigierbaren Entwürfen.'}]})));n=ok(await f.tech('/api/procurement/documents/'+n.id),200);
 const body={title:'Korrigierbare BANF',items:[{requirementItemId:n.items[0].id,quantity:'10',estimatedUnitPrice:'40'}]},q1=ok(await f.tech(base+'/requisitions',cmd(body))),s=ok(await f.tech('/api/workflow/submit/'+q1.id,cmd({version:1})));
 ok(await manager('/api/workflow/instances/'+s.id+'/decide',cmd({version:1,decision:'REJECT',comment:'Bitte neue Anforderung erstellen.'})));
 let q2=ok(await f.tech(base+'/requisitions',cmd(body)));assert.equal((await f.tech('/api/workflow/submit/'+q1.id,cmd({version:3}))).status,409);
 assert.equal((await f.tech('/api/procurement/documents/'+n.id+'/cancel',cmd({version:1,reason:'Aktiven Bedarf verwerfen.'}))).status,409);
 ok(await f.tech('/api/procurement/documents/'+q1.id+'/cancel',cmd({version:3,reason:'Abgelehnte Anforderung ersetzt.'})));ok(await approve(f.tech,q2.id,1));q2=ok(await buyer('/api/procurement/documents/'+q2.id),200);
 const pb={requisitionId:q2.id,supplierId:supplier.id,title:'Korrigierbare Bestellung',items:[{requisitionItemId:q2.items[0].id,quantity:'10',unitPrice:'40',deliveryDate:'2026-10-30',overdeliveryPercent:'0'}]},p1=ok(await buyer(base+'/purchase-orders',cmd(pb))),ps=ok(await buyer('/api/workflow/submit/'+p1.id,cmd({version:1})));
 ok(await manager('/api/workflow/instances/'+ps.id+'/decide',cmd({version:1,decision:'REJECT',comment:'Konditionen vor Bestellung erneut prüfen.'})));const p2=ok(await buyer(base+'/purchase-orders',cmd(pb)));assert.equal((await buyer('/api/workflow/submit/'+p1.id,cmd({version:3}))).status,409);
 ok(await buyer('/api/procurement/documents/'+p2.id+'/cancel',cmd({version:1,reason:'Nicht versendeten Entwurf ersetzen.'})));assert.equal(ok(await buyer('/api/procurement/documents/'+q2.id),200).items[0].remainingQuantity,'10.000000');
 ok(await approve(buyer,p1.id,3));assert.equal((await buyer('/api/procurement/documents/'+p1.id+'/cancel',cmd({version:5,reason:'Freigegebene Bestellung verwerfen.'}))).status,409);
});

test('Beschaffungsfreigabe schützt Inhalt und Ursprungspositionen auch bei direkten Datenbankänderungen',async()=>{
 const p=ok(await buyer('/api/procurement/documents/'+po1.id),200);
 await assert.rejects(h.admin.query("UPDATE purchase_orders SET title='Stille Vertragsänderung' WHERE id=$1",[po1.id]),/unveränderlich/);
 await assert.rejects(h.admin.query('UPDATE purchase_order_items SET quantity=100 WHERE id=$1',[p.items[0].id]),/unveränderlich/);
 await assert.rejects(h.admin.query('DELETE FROM purchase_order_items WHERE id=$1',[p.items[0].id]),/unveränderlich/);
 await assert.rejects(h.admin.query('INSERT INTO purchase_order_items SELECT $1,tenant_id,purchase_order_id,requisition_item_id,99,quantity,unit_price,delivery_date,overdelivery_percent FROM purchase_order_items WHERE id=$2',[randomUUID(),p.items[0].id]),/freigegeben/);
});

test('Gemeinsamer Lieferant verbindet im Belegfluss keine getrennten Servicefälle',async()=>{
 const t=ok(await f.customer('/api/tickets',cmd({title:'Getrennter Servicefall mit demselben Lieferanten',description:'Dieser Fall darf im Belegfluss des ersten Auftrags nicht erscheinen.',type:'INCIDENT',priority:'MEDIUM'}))),o=ok(await f.admin('/api/service/orders',cmd({caseId:t.caseId,sourceTicketId:null,contractId:null,title:'Separater Kundenauftrag',kind:'PAID',currency:'EUR',pricingDate:'2026-10-22'}))),oi=ok(await f.admin('/api/service/orders/'+o.id+'/items',cmd({version:1,productId:product.id,description:'Ersatzteil für anderen Servicefall',quantity:'1',billingRule:'TIME_MATERIAL',costCenter:'SERVICE-BERLIN',costObject:t.caseNumber})));ok(await f.approve(o.id,oi.version));
 const base='/api/service/orders/'+o.id;let n=ok(await buyer(base+'/material-requirements',cmd({title:'Separater Ersatzteilbedarf',urgency:'NORMAL',items:[{orderItemId:oi.id,quantity:'1',neededOn:'2026-10-30',purpose:'Ersatzteil für getrennten Servicefall.'}]})));n=ok(await buyer('/api/procurement/documents/'+n.id),200);let q=ok(await buyer(base+'/requisitions',cmd({title:'Separate Bestellanforderung',items:[{requirementItemId:n.items[0].id,quantity:'1',estimatedUnitPrice:'40'}]})));ok(await approve(buyer,q.id,1));q=ok(await buyer('/api/procurement/documents/'+q.id),200);
 const po=ok(await buyer(base+'/purchase-orders',cmd({title:'Separate Bestellung an denselben Lieferanten',supplierId:supplier.id,requisitionId:q.id,items:[{requisitionItemId:q.items[0].id,quantity:'1',unitPrice:'40',deliveryDate:'2026-10-30',overdeliveryPercent:'0'}]})));
 const flow=ok(await buyer('/api/documents/'+order.id+'/flow'),200);assert.equal(flow.some(r=>[o.id,n.id,q.id,po.id,t.id].includes(r.sourceId)||[o.id,n.id,q.id,po.id,t.id].includes(r.targetId)),false);
 const master=ok(await buyer('/api/documents/'+supplier.id+'/flow'),200);assert.ok(master.some(r=>r.targetId===po.id));assert.ok(master.some(r=>r.targetId===po1.id));
});
