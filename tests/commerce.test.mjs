import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {harness,client} from '../scripts/test-harness.mjs';
let h,admin,support,customer,technician,org,partner,product,order,ticket,discount;
const cmd=(body,key=randomUUID())=>({method:'POST',body,headers:{'Idempotency-Key':key}});
const item=(version=1,extra={})=>({version,productId:product.id,description:'Netzwerkdiagnose und Konfiguration',quantity:'2',billingRule:'TIME_MATERIAL',costCenter:'SERVICE-BERLIN',costObject:'SERVICEFALL',...extra});
async function createOrder(extra={}){return admin('/api/service/orders',cmd({caseId:ticket.caseId,sourceTicketId:null,contractId:null,title:'Serviceauftrag Netzwerk Berlin',kind:'PAID',currency:'EUR',pricingDate:'2026-10-22',...extra}));}
async function definition(kind){const r=await admin('/api/workflow/definitions',cmd({name:kind+' Freigabe',organizationId:org,subjectKind:kind,fourEyes:true,steps:[{name:'Fachliche Prüfung',roles:['SUPPORT']}]}));assert.equal(r.status,201,JSON.stringify(r.data));}
async function approve(id,version){const submitted=await admin('/api/workflow/submit/'+id,cmd({version}));assert.equal(submitted.status,201,JSON.stringify(submitted.data));const decided=await support('/api/workflow/instances/'+submitted.data.id+'/decide',cmd({version:1,decision:'APPROVE',comment:'Fachlich geprüft und freigegeben.'}));assert.equal(decided.status,201,JSON.stringify(decided.data));return decided;}
before(async()=>{h=await harness(3107);admin=await client(h.base,h.accounts.find(a=>a.role==='ADMIN'));support=await client(h.base,h.accounts.find(a=>a.role==='SUPPORT'));customer=await client(h.base,h.accounts.find(a=>a.role==='CUSTOMER'));technician=await client(h.base,h.accounts.find(a=>a.role==='TECHNICIAN'));org=(await admin('/api/organization')).data[0].id;partner=(await customer('/api/partners')).data[0].id;
 assert.equal((await admin('/api/catalog/currencies',cmd({code:'EUR',digits:2}))).status,201);
 const p=await admin('/api/catalog/products',cmd({organizationId:org,sku:'SERVICE-NET',name:'Netzwerkservice',kind:'SERVICE',unit:'HUR',taxCode:'STANDARD',productGroup:'IT',description:'Netzwerkdiagnose nach Aufwand.'}));assert.equal(p.status,201);product=p.data;
 ticket=(await customer('/api/tickets',cmd({title:'Netzwerkstörung zur kaufmännischen Bearbeitung',description:'Netzwerkdiagnose und Konfiguration am Standort Berlin erforderlich.',type:'INCIDENT',priority:'MEDIUM'}))).data;
});
after(async()=>{if(h)await h.close();});
test('Serviceaufträge akzeptieren keine ungeprüften Artikel und keine frei eingeschleusten Preise',async()=>{
 const o=await createOrder();assert.equal(o.status,201,JSON.stringify(o.data));order=o.data;
 assert.equal((await admin('/api/service/orders/'+order.id+'/items',cmd(item()))).status,409);
 assert.equal((await admin('/api/service/orders/'+order.id+'/items',cmd(item(1,{unitPrice:'0.01'})))).status,400);
 const d=(await admin('/api/service/orders/'+order.id)).data;assert.equal(d.items.length,0);assert.equal(d.version,1);
});
test('Artikel nutzen den konfigurierten Vier-Augen-Freigabeprozess und sind danach geschützt',async()=>{
 assert.equal((await admin('/api/workflow/submit/'+product.id,cmd({version:1}))).status,409);await definition('MATERIAL');await approve(product.id,1);
 const p=(await admin('/api/catalog/products')).data[0];assert.equal(p.status,'ACTIVE');assert.equal(p.version,3);
 const patch={sku:p.sku,name:p.name,kind:p.kind,unit:p.unit,taxCode:p.taxCode,productGroup:p.productGroup,description:p.description,version:p.version};assert.equal((await admin('/api/catalog/products/'+p.id,{...cmd(patch),method:'PATCH'})).status,409);
 assert.equal((await support('/api/workflow/submit/'+product.id,cmd({version:3}))).status,403);
});
test('Preisfindung berücksichtigt explizite Kundenkondition und speichert vollständigen Snapshot',async()=>{
 const condition={organizationId:org,code:'PR00',kind:'BASE',sequence:10,priority:0,productId:product.id,partnerId:null,contractId:null,customerGroup:null,productGroup:null,taxCode:null,currency:'EUR',validFrom:'2020-01-01',validTo:'2099-12-31',minimumQuantity:'1',value:'100'};
 for(const c of [condition,{...condition,code:'MWST',kind:'TAX',sequence:100,productId:null,taxCode:'STANDARD',value:'19'},{...condition,code:'K001',kind:'DISCOUNT_PERCENT',sequence:20,partnerId:partner,value:'10'}]){const r=await admin('/api/pricing/conditions',cmd(c));assert.equal(r.status,201,JSON.stringify(r.data));if(c.code==='K001')discount=r.data;}
 const r=await admin('/api/service/orders/'+order.id+'/items',cmd(item()));assert.equal(r.status,201,JSON.stringify(r.data));assert.equal(r.data.price.net,'180.00');assert.equal(r.data.price.tax,'34.20');assert.equal(r.data.price.gross,'214.20');assert.equal(r.data.price.trace[1].code,'K001');
 const d=(await admin('/api/service/orders/'+order.id)).data;assert.equal(d.totals.gross,'214.20');assert.equal(d.items[0].priceSnapshot.product.version,3);
});
test('Neue Konditionsermittlung verändert gespeicherte Auftragspositionen nicht rückwirkend',async()=>{
 assert.equal((await admin('/api/pricing/conditions/'+discount.id+'/disable',cmd({version:1}))).status,201);
 const o=(await createOrder()).data,r=await admin('/api/service/orders/'+o.id+'/items',cmd(item()));assert.equal(r.status,201);assert.equal(r.data.price.net,'200.00');
 assert.equal((await admin('/api/service/orders/'+order.id)).data.items[0].priceSnapshot.net,'180.00');
 const d=(await customer('/api/service/orders/'+order.id)).data;assert.equal(d.items[0].priceSnapshot,undefined);assert.equal(d.items[0].costCenter,undefined);assert.equal((await technician('/api/service/orders/'+order.id)).status,404);
});
test('Auftragsfreigabe prüft Kundenstatus erneut und sperrt genehmigte Positionen',async()=>{
 await definition('SERVICE_ORDER');const submitted=await admin('/api/workflow/submit/'+order.id,cmd({version:2}));assert.equal(submitted.status,201);
 await h.admin.query("UPDATE business_partners SET status='BLOCKED' WHERE id=$1",[partner]);let r=await support('/api/workflow/instances/'+submitted.data.id+'/decide',cmd({version:1,decision:'APPROVE',comment:'Freigabeversuch bei gesperrtem Kunden.'}));assert.equal(r.status,409);
 await h.admin.query("UPDATE business_partners SET status='ACTIVE' WHERE id=$1",[partner]);r=await support('/api/workflow/instances/'+submitted.data.id+'/decide',cmd({version:1,decision:'APPROVE',comment:'Kunde aktiv, Auftrag geprüft.'}));assert.equal(r.status,201);
 assert.equal((await admin('/api/service/orders/'+order.id)).data.status,'RELEASED');assert.equal((await admin('/api/service/orders/'+order.id+'/items',cmd(item(4)))).status,409);
 const flow=await customer('/api/documents/'+order.id+'/flow');assert.equal(flow.status,200);assert.ok(flow.data.some(r=>r.sourceId===ticket.caseId));
});
test('Parallele Auftragsanlage aus demselben Ticket erzeugt höchstens einen aktiven Auftrag',async()=>{
 const rs=await Promise.all([createOrder({sourceTicketId:ticket.id}),createOrder({sourceTicketId:ticket.id})]);assert.deepEqual(rs.map(r=>r.status).sort(),[201,409]);
});
test('Garantie und interne Tickets verhindern kostenpflichtige Kundenaufträge und Positionen',async()=>{
 const t=(await customer('/api/tickets',cmd({title:'Garantiefall ohne automatische Kundenkosten',description:'Garantieprüfung für defekte Hardware erforderlich.',type:'WARRANTY',priority:'MEDIUM'}))).data;
 assert.equal((await createOrder({caseId:t.caseId,sourceTicketId:t.id})).status,409);
 const o=await createOrder({caseId:t.caseId,sourceTicketId:t.id,kind:'WARRANTY'});assert.equal(o.status,201);
 assert.equal((await admin('/api/service/orders/'+o.data.id+'/items',cmd(item()))).status,409);
 const r=await admin('/api/service/orders/'+o.data.id+'/items',cmd(item(1,{billingRule:'NON_BILLABLE'})));assert.equal(r.status,201);assert.equal(r.data.price.gross,'0.00');
});
test('Neue kaufmännische Tabellen erzwingen Tenant-RLS auch bei direktem Laufzeitzugriff',async()=>{
 const app=new pg.Client({connectionString:h.urls.app});await app.connect();try{await app.query('BEGIN');await app.query("SELECT set_config('app.tenant_id',$1,true)",[randomUUID()]);for(const table of ['products','service_orders','service_order_items','price_conditions','currencies'])assert.equal((await app.query('SELECT count(*) FROM '+table)).rows[0].count,'0');await app.query('ROLLBACK');}finally{await app.end();}
});
