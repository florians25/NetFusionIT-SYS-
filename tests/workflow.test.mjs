import { test,before,after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { harness,client } from '../scripts/test-harness.mjs';
let h,admin,support,dispatch,customer,org,partner,instance;
const command=(body,key=randomUUID())=>({method:'POST',body,headers:{'Idempotency-Key':key}});
before(async()=>{h=await harness(3103);admin=await client(h.base,h.accounts.find(a=>a.role==='ADMIN'));support=await client(h.base,h.accounts.find(a=>a.role==='SUPPORT'));dispatch=await client(h.base,h.accounts.find(a=>a.role==='DISPATCHER'));customer=await client(h.base,h.accounts.find(a=>a.role==='CUSTOMER'));org=(await admin('/api/organization')).data[0].id;});
after(async()=>{if(h)await h.close();});
test('Neue Kunden sind Entwürfe und können ohne aktive fachliche Definition nicht aktiviert werden',async()=>{
 const r=await admin('/api/partners',command({name:'Freigabekunde',email:'approval@example.test',organizationId:org}));assert.equal(r.status,201);partner=r.data;assert.equal(partner.status,'DRAFT');
 assert.equal((await admin('/api/workflow/submit/'+partner.id,command({version:1}))).status,409);
 assert.equal((await admin('/api/tickets',command({title:'Nicht aktiver Kunde',description:'Diese Anfrage darf nicht für einen Entwurf erstellt werden.',priority:'MEDIUM',type:'INCIDENT',partnerId:partner.id}))).status,404);
});
test('Kontakte und Adressen speichern mit Version und Idempotenz; kein freier Tenant-Zugriff',async()=>{
 const body={version:1,name:partner.name,email:partner.email,legalForm:'GmbH',vatId:'',currency:'EUR',roles:['CUSTOMER','BILL_TO'],contacts:[{name:'Eva Kontakt',email:'eva@example.test',phone:'+49 30 1234',position:'IT'}],addresses:[{kind:'BUSINESS',street:'Teststraße 1',postalCode:'10115',city:'Berlin',country:'DE'}]},key=randomUUID();
 const a=await admin('/api/partners/'+partner.id,{...command(body,key),method:'PATCH'});assert.equal(a.status,200);assert.equal(a.data.version,2);
 assert.deepEqual((await admin('/api/partners/'+partner.id,{...command(body,key),method:'PATCH'})).data,a.data);
 const detail=(await admin('/api/partners/'+partner.id)).data;assert.equal(detail.contacts.length,1);assert.equal(detail.addresses.length,1);
 assert.equal((await customer('/api/partners/'+partner.id)).status,404);
});
test('Konfigurierter zweistufiger Freigabefluss verwendet unveränderlichen Definitionssnapshot',async()=>{
 const definition={name:'Stamm und Kaufmännisch',organizationId:org,subjectKind:'BUSINESS_PARTNER',fourEyes:true,steps:[{name:'Stammdatenprüfung',roles:['SUPPORT']},{name:'Kaufmännische Prüfung',roles:['DISPATCHER']}]};
 assert.equal((await support('/api/workflow/definitions',command(definition))).status,403);
 assert.equal((await admin('/api/workflow/definitions',command(definition))).status,201);
 const submit=await admin('/api/workflow/submit/'+partner.id,command({version:2}));assert.equal(submit.status,201);instance=submit.data;
 // Neue Regel beeinflusst die bereits eingereichte Instanz nicht.
 assert.equal((await admin('/api/workflow/definitions',command({...definition,name:'Nächste Definition',steps:[{name:'Neue Stufe',roles:['ADMIN']}]}))).status,201);
 const inbox=(await support('/api/workflow/inbox')).data.find(i=>i.id===instance.id);assert.equal(inbox.steps.length,2);assert.equal(inbox.steps[0].roles[0],'SUPPORT');
 assert.equal((await dispatch('/api/workflow/instances/'+instance.id+'/decide',command({version:1,decision:'APPROVE',comment:'Nicht zuständige Stufe'}))).status,403);
});
test('Rückfrage und Antwort sind persistent; konkurrierende Freigabe entscheidet nur einmal',async()=>{
 let r=await support('/api/workflow/instances/'+instance.id+'/decide',command({version:1,decision:'REQUEST_INFORMATION',comment:'Bitte Kontaktdaten bestätigen.'}));assert.equal(r.status,201);assert.equal(r.data.status,'INFORMATION_REQUIRED');
 assert.equal((await support('/api/workflow/instances/'+instance.id+'/decide',command({version:2,decision:'RESUBMIT',comment:'Falscher Antwortender'}))).status,403);
 r=await admin('/api/workflow/instances/'+instance.id+'/decide',command({version:2,decision:'RESUBMIT',comment:'Kontaktdaten wurden bestätigt.'}));assert.equal(r.data.status,'PENDING');
 const results=await Promise.all(Array.from({length:2},()=>support('/api/workflow/instances/'+instance.id+'/decide',command({version:3,decision:'APPROVE',comment:'Stammdaten geprüft.'}))));assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);
 assert.equal((await admin('/api/partners/'+partner.id)).data.status,'IN_REVIEW');
 r=await dispatch('/api/workflow/instances/'+instance.id+'/decide',command({version:4,decision:'APPROVE',comment:'Kaufmännisch geprüft.'}));assert.equal(r.data.status,'APPROVED');
 assert.equal((await admin('/api/partners/'+partner.id)).data.status,'ACTIVE');
 const history=(await admin('/api/workflow/instances/'+instance.id+'/decisions')).data;assert.equal(history.length,4);
 assert.ok((await admin('/api/notifications')).data.length>=3);
});
test('Vier-Augen-Prinzip verhindert Eigenfreigabe auch für Administratoren',async()=>{
 // Ein zweiter aktiver Admin macht die Definition erfüllbar; der Ersteller bleibt gesperrt.
 const user=await admin('/api/admin/users',command({name:'Zweiter Freigeber',email:'second-admin@example.test',password:'Second-approval-password-2026!',role:'ADMIN',organizationId:org}));assert.equal(user.status,201);
 const p=(await admin('/api/partners',command({name:'Vier Augen',email:'eyes@example.test',organizationId:org}))).data;
 const submit=await admin('/api/workflow/submit/'+p.id,command({version:1}));assert.equal(submit.status,201);
 assert.equal((await admin('/api/workflow/instances/'+submit.data.id+'/decide',command({version:1,decision:'APPROVE',comment:'Eigene Freigabeversuch'}))).status,403);
});
test('Öffentliche Kommentare und interne Notizen sind getrennt und idempotent',async()=>{
 const t=(await customer('/api/tickets',command({title:'Kommunikation testen',description:'Kommentare und interne Notizen müssen getrennt angezeigt werden.',priority:'MEDIUM',type:'INCIDENT'}))).data;
 const key=randomUUID(),body={body:'Interne Diagnose ohne Kundensicht',visibility:'INTERNAL'};
 assert.equal((await support('/api/tickets/'+t.id+'/comments',command(body,key))).status,201);
 assert.equal((await support('/api/tickets/'+t.id+'/comments',command(body,key))).status,201);
 assert.equal((await customer('/api/tickets/'+t.id+'/comments',command(body))).status,403);
 assert.equal((await customer('/api/tickets/'+t.id+'/comments',command({body:'Kundenantwort',visibility:'PUBLIC'}))).status,201);
 assert.equal((await customer('/api/tickets/'+t.id+'/comments')).data.length,1);
 assert.equal((await support('/api/tickets/'+t.id+'/comments')).data.length,2);
});
test('Fachrollen sind serverseitig beschränkt; Einkäufer erhält keine Servicetickets',async()=>{
 const r=await admin('/api/admin/users',command({name:'Einkauf',email:'buyer@example.test',password:'Strong-buyer-password-2026!',role:'BUYER',organizationId:org}));assert.equal(r.status,201);
 const buyer=await client(h.base,{tenant:'netfusion',email:'buyer@example.test',password:'Strong-buyer-password-2026!'});
 assert.equal((await buyer('/api/dashboard')).status,403);assert.equal((await buyer('/odata/Tickets')).status,403);
 assert.equal((await buyer('/api/partners')).status,200);assert.equal((await buyer('/api/workflow/definitions',command({}))).status,403);
});
