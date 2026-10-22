import { test,before,after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { harness,client } from '../scripts/test-harness.mjs';
let h,admin,dispatcher,customer,technician,org,partner,calendar,policy,contract,asset,ticket,tech;
const command=(body,key=randomUUID())=>({method:'POST',body,headers:{'Idempotency-Key':key}});
before(async()=>{h=await harness(3105);admin=await client(h.base,h.accounts.find(a=>a.role==='ADMIN'));dispatcher=await client(h.base,h.accounts.find(a=>a.role==='DISPATCHER'));customer=await client(h.base,h.accounts.find(a=>a.role==='CUSTOMER'));technician=await client(h.base,h.accounts.find(a=>a.role==='TECHNICIAN'));org=(await admin('/api/organization')).data[0].id;partner=(await customer('/api/partners')).data[0].id;tech=(await dispatcher('/api/dispatch/technicians')).data[0];});
after(async()=>{if(h)await h.close();});
test('Servicekalender und SLA-Policy sind explizit konfigurierte, persistente Geschäftsdaten',async()=>{
 let r=await admin('/api/service/calendars',command({name:'24/7 Service',organizationId:org,calendar:{timeZone:'Europe/Berlin',weekly:[1,2,3,4,5,6,7].map(day=>({day,start:'00:00',end:'24:00'})),holidays:[]}}));assert.equal(r.status,201,JSON.stringify(r.data));calendar=r.data;
 r=await admin('/api/service/sla-policies',command({name:'Reaktion 60 / Lösung 240',organizationId:org,calendarId:calendar.id,responseMinutes:60,resolutionMinutes:240,pauseStatuses:['WAITING_CUSTOMER']}));assert.equal(r.status,201);policy=r.data;
 assert.equal((await customer('/api/service/calendars')).status,403);
});
test('Vertrag und technische Objektstruktur prüfen Kunden- und Organisationsbezug',async()=>{
 let r=await admin('/api/service/contracts',command({organizationId:org,partnerId:partner,name:'Managed Service Testvertrag',kind:'MANAGED',validFrom:'2020-01-01',validTo:'2099-12-31',slaPolicyId:policy.id,scope:'Betrieb der vereinbarten Netzwerkinfrastruktur.'}));assert.equal(r.status,201);contract=r.data;
 assert.equal((await admin('/api/service/contracts/'+contract.id+'/status',command({version:1,status:'ACTIVE'}))).status,201);
 const input={organizationId:org,partnerId:partner,name:'Firewall Berlin',kind:'FIREWALL',manufacturer:'Testhersteller',model:'FW-100',serialNumber:'SERIAL-001',inventoryNumber:'INV-001',location:'Berlin',installedOn:'2026-01-01',warrantyUntil:'2027-12-31',parentId:null,contractId:contract.id};
 r=await admin('/api/service/assets',command(input));assert.equal(r.status,201);asset=r.data;
 assert.equal((await admin('/api/service/assets',command({...input,name:'Doppelte Seriennummer'}))).status,409);
 assert.equal((await customer('/api/service/assets')).data[0].id,asset.id);
});
test('Ticketanlage bindet Vertrag, SLA-Snapshot und technisches Objekt atomar',async()=>{
 const r=await customer('/api/tickets',command({title:'Firewall mit Servicevertrag gestört',description:'Dieses Ticket betrifft die vertraglich betreute Firewall.',type:'INCIDENT',priority:'HIGH',contractId:contract.id,technicalObjectId:asset.id}));assert.equal(r.status,201,JSON.stringify(r.data));ticket=r.data;
 const sla=(await customer('/api/tickets/'+ticket.id+'/sla')).data.sla;assert.equal(sla.snapshot.policyId,policy.id);assert.equal(sla.snapshot.calendarId,calendar.id);
 const detail=(await customer('/api/tickets/'+ticket.id)).data;assert.equal(detail.contractId,contract.id);assert.equal(new Date(sla.responseDue)-new Date(detail.createdAt),60*60000);
 assert.equal((await h.admin.query('SELECT count(*) FROM case_objects WHERE case_id=$1 AND object_id=$2',[ticket.caseId,asset.id])).rows[0].count,'1');
});
test('SLA-Pause verschiebt nur Geschäftszeit und Reaktion wird bei Zuweisung festgehalten',async()=>{
 assert.equal((await dispatcher('/api/tickets/'+ticket.id+'/assign',command({technicianId:tech.id,version:1}))).status,201);
 assert.equal((await technician('/api/tickets/'+ticket.id+'/status',command({status:'IN_PROGRESS',version:2}))).status,201);
 assert.equal((await technician('/api/tickets/'+ticket.id+'/status',command({status:'WAITING_CUSTOMER',version:3}))).status,201);
 const paused=(await customer('/api/tickets/'+ticket.id+'/sla')).data;assert.ok(paused.sla.pausedAt);assert.ok(paused.sla.respondedAt);
 assert.equal((await technician('/api/tickets/'+ticket.id+'/status',command({status:'IN_PROGRESS',version:4}))).status,201);
 const resumed=(await customer('/api/tickets/'+ticket.id+'/sla')).data;assert.equal(resumed.sla.pausedAt,null);assert.ok(new Date(resumed.sla.resolutionDue)>=new Date(paused.sla.resolutionDue));assert.ok(resumed.events.some(e=>e.kind==='PAUSED'));assert.ok(resumed.events.some(e=>e.kind==='RESUMED'));
});
test('Versäumte SLA-Fristen werden historisiert und bei wiederholter Überwachung nicht dupliziert',async()=>{
 // Ausschließlich Test-Fixture: simulierter vergangener Fälligkeitszeitpunkt.
 await h.admin.query("UPDATE ticket_sla SET resolution_due=now()-interval '1 minute' WHERE ticket_id=$1",[ticket.id]);
 assert.equal((await admin('/api/service/sla-sweep',command({}))).status,201);assert.equal((await admin('/api/service/sla-sweep',command({}))).status,201);
 const events=(await customer('/api/tickets/'+ticket.id+'/sla')).data.events;assert.equal(events.filter(e=>e.kind==='BREACH'&&e.deadlineType==='RESOLUTION').length,1);
 await assert.rejects(h.admin.query('DELETE FROM sla_events WHERE ticket_id=$1',[ticket.id]),/append-only/);
});
test('Terminplanung verlangt Arbeitszeitmodell und verhindert parallele Doppelbelegung',async()=>{
 const input={caseId:ticket.caseId,title:'Firewall vor Ort prüfen',location:'Berlin',startsAt:'2027-01-04T09:00:00Z',endsAt:'2027-01-04T11:00:00Z',technicianIds:[tech.id],requiredSkills:['Netzwerk']};
 assert.equal((await dispatcher('/api/dispatch/visits',command(input))).status,409);
 assert.equal((await dispatcher('/api/dispatch/technicians/'+tech.id,{...command({version:1,calendarId:calendar.id,skills:['IT-Support','Netzwerk'],location:'Berlin',certifications:[]}),method:'PATCH'})).status,200);
 const results=await Promise.all([dispatcher('/api/dispatch/visits',command(input)),dispatcher('/api/dispatch/visits',command(input))]);assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);
 assert.equal((await technician('/api/dispatch/visits')).data.length,1);
 assert.equal((await customer('/api/dispatch/visits')).data.length,1);
});
test('Abwesenheit, Qualifikation und Arbeitszeit beeinflussen Empfehlung und Buchung',async()=>{
 const interval={startsAt:'2027-01-05T09:00:00Z',endsAt:'2027-01-05T11:00:00Z'};
 assert.equal((await dispatcher('/api/dispatch/absences',command({technicianId:tech.id,...interval,reason:'Geplante Abwesenheit'}))).status,201);
 const recommendations=(await dispatcher('/api/dispatch/recommendations',command({caseId:ticket.caseId,...interval,requiredSkills:['Netzwerk']}))).data;assert.equal(recommendations[0].available,false);assert.match(recommendations[0].reason,/Abwesenheit/);
 assert.equal((await dispatcher('/api/dispatch/visits',command({caseId:ticket.caseId,title:'Termin während Abwesenheit',location:'Berlin',...interval,technicianIds:[tech.id],requiredSkills:['Netzwerk']}))).status,409);
 assert.equal((await dispatcher('/api/dispatch/absences',command({technicianId:tech.id,startsAt:'2027-01-04T10:00:00Z',endsAt:'2027-01-04T12:00:00Z',reason:'Kollision mit Einsatz'}))).status,409);
});
test('Belegfluss zeigt Kunden Vertrag, Objekt und Einsatz im eigenen Fall',async()=>{
 const flow=await customer('/api/documents/'+ticket.caseId+'/flow');assert.equal(flow.status,200,JSON.stringify(flow.data));
 assert.ok(flow.data.some(r=>r.targetId===asset.id&&r.targetKind==='TECHNICAL_OBJECT'));
 assert.ok(flow.data.some(r=>r.targetKind==='FIELD_VISIT'));
 const assetFlow=await customer('/api/documents/'+asset.id+'/flow');assert.equal(assetFlow.status,200);assert.ok(assetFlow.data.some(r=>r.targetId===contract.id));
});
test('Einsatzzuordnung gewährt Techniker Zugriff auf eigenen Fall ohne Ticketdirektzuweisung',async()=>{
 const r=await customer('/api/tickets',command({title:'Eigener Termineinsatz ohne direkte Zuweisung',description:'Dieser Testfall hat ausschließlich eine Zuordnung über den gebuchten Einsatz.',type:'INCIDENT',priority:'MEDIUM'}));assert.equal(r.status,201);const own=r.data;
 assert.equal((await technician('/api/tickets/'+own.id)).status,404);
 const visit=await dispatcher('/api/dispatch/visits',command({caseId:own.caseId,title:'Eigenen Termineinsatz prüfen',location:'Berlin',startsAt:'2027-01-06T09:00:00Z',endsAt:'2027-01-06T11:00:00Z',technicianIds:[tech.id],requiredSkills:['Netzwerk']}));assert.equal(visit.status,201);
 assert.equal((await technician('/api/tickets/'+own.id)).status,200);assert.equal((await technician('/api/cases/'+own.caseId)).status,200);
 assert.equal((await technician('/api/documents/'+visit.data.id+'/flow')).status,200);
 assert.ok((await technician('/api/service/context-partners')).data.some(p=>p.id===partner));
});
