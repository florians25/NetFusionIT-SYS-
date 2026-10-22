import { test,before,after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { harness,client } from '../scripts/test-harness.mjs';
import { hashPassword } from '../scripts/password.mjs';
import { migrate } from '../scripts/migrate.mjs';
let h,admin,customer,dispatcher,tech,support,anonymous,ticket,techId,tenantId,orgId,otherCustomer,foreign,foreignOrgCustomer,otherPartnerId;
const payload={title:'VPN am Standort nicht erreichbar',description:'Seit heute Morgen ist die VPN-Verbindung unterbrochen. Mehrere Arbeitsplätze sind betroffen.',type:'INCIDENT',priority:'HIGH'};
const command=(body,key=randomUUID())=>({method:'POST',body,headers:{'Idempotency-Key':key}});
before(async()=>{
  h=await harness();
  for(const [role,set] of [['ADMIN',v=>admin=v],['CUSTOMER',v=>customer=v],['DISPATCHER',v=>dispatcher=v],['TECHNICIAN',v=>tech=v],['SUPPORT',v=>support=v]])set(await client(h.base,h.accounts.find(a=>a.role===role)));
  anonymous=await client(h.base);
  tenantId=(await h.admin.query("SELECT id FROM tenants WHERE slug='netfusion'")).rows[0].id;
  orgId=(await h.admin.query('SELECT id FROM organizations WHERE tenant_id=$1',[tenantId])).rows[0].id;
  techId=(await dispatcher('/api/technicians')).data[0].id;
  async function fixture(slug,tenant,org,partner,email){
    const id=randomUUID(),password='Test-fixture-strong-password-24!';
    if(tenant!==tenantId)await h.admin.query('INSERT INTO tenants VALUES($1,$2,$3)',[tenant,slug,slug]);
    if(org!==orgId)await h.admin.query("INSERT INTO organizations(id,tenant_id,name,kind) VALUES($1,$2,'Andere Organisation','SERVICE_ORGANIZATION')",[org,tenant]);
    await h.admin.query("INSERT INTO business_partners(id,tenant_id,organization_id,number,name,email) VALUES($1,$2,$3,$4,'Anderer Kunde',$5)",[partner,tenant,org,randomUUID(),email]);
    await h.admin.query("INSERT INTO users(id,tenant_id,email,name,password_hash,role,partner_id) VALUES($1,$2,$3,'Testkunde',$4,'CUSTOMER',$5)",[id,tenant,email,await hashPassword(password),partner]);
    await h.admin.query('INSERT INTO user_organizations VALUES($1,$2,$3)',[tenant,id,org]);
    return client(h.base,{tenant:slug,email,password});
  }
  otherPartnerId=randomUUID();otherCustomer=await fixture('netfusion',tenantId,orgId,otherPartnerId,'other@example.test');
  foreign=await fixture('other',randomUUID(),randomUUID(),randomUUID(),'foreign@example.test');
  foreignOrgCustomer=await fixture('netfusion',tenantId,randomUUID(),randomUUID(),'branch@example.test');
});
after(async()=>{if(h)await h.close();});
test('Migration ist wiederholbar und Laufzeitrolle besitzt weder Superuser noch DDL',async()=>{
  await migrate(h.urls.admin);
  const r=await h.admin.query("SELECT rolsuper,rolbypassrls,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname='erp_app'");
  assert.deepEqual(r.rows[0],{rolsuper:false,rolbypassrls:false,rolcreatedb:false,rolcreaterole:false});
  const db=new pg.Client({connectionString:h.urls.app});await db.connect();
  try{await assert.rejects(db.query('CREATE TABLE forbidden(id int)'),/permission denied/);assert.equal((await db.query('SELECT count(*) FROM tickets')).rows[0].count,'0');}finally{await db.end();}
});
test('Healthcheck und echte V4-Metadaten funktionieren; Daten sind geschützt',async()=>{
  assert.equal((await anonymous('/health/ready')).status,200);
  assert.equal((await anonymous('/api/dashboard')).status,401);
  const meta=await anonymous('/odata/$metadata');assert.equal(meta.status,200);assert.match(meta.data,/edmx:Edmx Version="4.0"/);assert.match(meta.data,/Edm.DateTimeOffset" Precision="3"/);
  assert.equal((await anonymous('/odata/Tickets')).status,401);
});
test('Falsche Anmeldung, CSRF und fremde Origin werden abgewiesen',async()=>{
  assert.equal((await anonymous('/api/auth/login',{method:'POST',body:{tenant:'netfusion',email:'missing@example.test',password:'bad'}})).status,401);
  assert.equal((await customer('/api/tickets',{...command(payload),headers:{'X-CSRF-Token':'x'}})).status,403);
  assert.equal((await customer('/api/tickets',{...command(payload),headers:{Origin:'https://attacker.example'}})).status,403);
});
test('Validierung lehnt ungültige, zu kurze und zusätzliche Werte ab',async()=>{
  assert.equal((await customer('/api/tickets',command({...payload,title:'a'}))).status,400);
  assert.equal((await customer('/api/tickets',command({...payload,tenantId}))).status,400);
  assert.equal((await customer('/api/tickets',command({...payload,priority:'IMMEDIATE'}))).status,400);
  assert.equal((await customer('/api/tickets',command(payload,'bad-key'))).status,400);
});
test('Kundenformular speichert Ticket, eigenen Fall, Relation und Audit atomar',async()=>{
  const r=await customer('/api/tickets',command(payload));assert.equal(r.status,201,JSON.stringify(r.data));ticket=r.data;
  assert.match(ticket.number,/^TCK-\d{4}-\d{6}$/);assert.match(ticket.correlationId,/^[a-f0-9-]{36}$/);assert.notEqual(ticket.id,ticket.caseId);
  const d=await customer('/api/tickets/'+ticket.id);assert.equal(d.status,200);assert.equal(d.data.source,'CUSTOMER_PORTAL');assert.equal(d.data.events.length,1);
  const c=await customer('/api/cases/'+ticket.caseId);assert.equal(c.data.tickets[0].id,ticket.id);
  const flow=await customer('/api/documents/'+ticket.id+'/flow');assert.equal(flow.data[0].targetId,ticket.caseId);
  const reverse=await customer('/api/documents/'+ticket.caseId+'/flow');assert.equal(reverse.data[0].sourceId,ticket.id);
});
test('Cockpit-Zähler und Prioritätsverteilung basieren auf sichtbaren gespeicherten Tickets',async()=>{
  const d=(await customer('/api/dashboard')).data;
  assert.equal(d.total,1);assert.equal(d.newCount,1);assert.equal(d.inProgress,0);assert.equal(d.unassigned,1);assert.equal(d.critical,1);assert.equal(d.last24h,1);
  assert.equal(d.distribution.reduce((sum,p)=>sum+p.count,0),d.open);
  assert.equal(d.distribution.find(p=>p.priority==='HIGH').percent,100);
  assert.equal((await foreign('/api/dashboard')).data.newCount,0);
});
test('Kundentrennung, Mandantentrennung und Organisationsumfang gelten für alle Projektionen',async()=>{
  for(const c of [otherCustomer,foreign,foreignOrgCustomer]){
    assert.equal((await c('/api/tickets/'+ticket.id)).status,404);
    assert.equal((await c('/api/cases/'+ticket.caseId)).status,404);
    assert.equal((await c('/api/documents/'+ticket.caseId+'/flow')).status,404);
    assert.equal((await c('/odata/Tickets?$count=true')).data['@odata.count'],0);
    assert.equal((await c('/api/dashboard')).data.total,0);
  }
  assert.equal((await customer('/api/tickets',command({...payload,partnerId:otherPartnerId}))).status,403);
});
test('Parallele doppelte Requests erzeugen genau einen Beleg und dieselbe Antwort',async()=>{
  const key=randomUUID(),before=(await customer('/api/dashboard')).data.total;
  const results=await Promise.all(Array.from({length:6},()=>customer('/api/tickets',command({...payload,title:'Parallele idempotente Anfrage'},key))));
  assert.ok(results.every(r=>r.status===201));assert.equal(new Set(results.map(r=>r.data.id)).size,1);
  assert.equal((await customer('/api/dashboard')).data.total,before+1);
  assert.equal((await customer('/api/tickets',command({...payload,title:'Abweichender Inhalt'},key))).status,409);
});
test('Abgewiesene Anlage hinterlässt keine Nummern, Belege oder Audit-Ereignisse',async()=>{
  const before=(await h.admin.query('SELECT (SELECT count(*) FROM tickets) AS tickets,(SELECT count(*) FROM documents) AS documents,(SELECT count(*) FROM audit_events) AS audits,(SELECT sum(current_value) FROM number_ranges) AS numbers')).rows[0];
  assert.equal((await admin('/api/tickets',command({...payload,partnerId:randomUUID()}))).status,404);
  const after=(await h.admin.query('SELECT (SELECT count(*) FROM tickets) AS tickets,(SELECT count(*) FROM documents) AS documents,(SELECT count(*) FROM audit_events) AS audits,(SELECT sum(current_value) FROM number_ranges) AS numbers')).rows[0];assert.deepEqual(after,before);
});
test('Fehler mitten in der Transaktion rollt Nummer, Dokumente, Fall und Idempotenz zurück',async()=>{
  const snapshot=async()=>(await h.admin.query('SELECT (SELECT count(*) FROM tickets) AS tickets,(SELECT count(*) FROM service_cases) AS cases,(SELECT count(*) FROM documents) AS documents,(SELECT count(*) FROM audit_events) AS audits,(SELECT count(*) FROM idempotency_keys) AS keys,(SELECT sum(current_value) FROM number_ranges) AS numbers')).rows[0];
  const before=await snapshot();
  await h.admin.query("CREATE FUNCTION test_failure() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'injected database failure'; END;$$; CREATE TRIGGER test_failure BEFORE INSERT ON tickets FOR EACH ROW EXECUTE FUNCTION test_failure()");
  const key=randomUUID();
  try{
    const r=await customer('/api/tickets',command({...payload,title:'Rollbacktest mit Datenbankfehler'},key));assert.equal(r.status,500);assert.ok(!JSON.stringify(r.data).includes('injected'));assert.deepEqual(await snapshot(),before);
  }finally{await h.admin.query('DROP TRIGGER test_failure ON tickets; DROP FUNCTION test_failure()');}
  assert.equal((await customer('/api/tickets',command({...payload,title:'Rollbacktest mit Datenbankfehler'},key))).status,201);
});
test('Gesperrte Kunden und tatsächlich vorhandene fremde Organisationstickets bleiben geschützt',async()=>{
  await h.admin.query("UPDATE business_partners SET status='BLOCKED' WHERE id=$1",[otherPartnerId]);
  try{assert.equal((await otherCustomer('/api/tickets',command(payload))).status,404);}finally{await h.admin.query("UPDATE business_partners SET status='ACTIVE' WHERE id=$1",[otherPartnerId]);}
  for(const c of [foreignOrgCustomer,foreign]){
    const created=await c('/api/tickets',command(payload));assert.equal(created.status,201);
    assert.equal((await admin('/api/tickets/'+created.data.id)).status,404);
    assert.equal((await admin('/api/cases/'+created.data.caseId)).status,404);
    const rows=(await admin('/odata/Tickets')).data.value;assert.ok(!rows.some(t=>t.id===created.data.id));
  }
});
test('Zuweisung prüft Rolle, Organisation, Techniker und erwartete Version',async()=>{
  assert.equal((await customer('/api/tickets/'+ticket.id+'/assign',command({technicianId:techId,version:1}))).status,403);
  assert.equal((await support('/api/tickets/'+ticket.id+'/assign',command({technicianId:techId,version:1}))).status,403);
  assert.equal((await dispatcher('/api/tickets/'+ticket.id+'/assign',command({technicianId:randomUUID(),version:1}))).status,404);
  assert.equal((await tech('/api/tickets/'+ticket.id)).status,404);
  const key=randomUUID(),a=await dispatcher('/api/tickets/'+ticket.id+'/assign',command({technicianId:techId,version:1},key));assert.equal(a.status,201);assert.equal(a.data.status,'ASSIGNED');
  assert.deepEqual((await dispatcher('/api/tickets/'+ticket.id+'/assign',command({technicianId:techId,version:1},key))).data,a.data);
  assert.equal((await dispatcher('/api/tickets/'+ticket.id+'/assign',command({technicianId:techId,version:1}))).status,409);
  assert.equal((await tech('/api/tickets/'+ticket.id)).status,200);
  assert.equal((await h.admin.query('SELECT count(*) FROM dispatch_assignments WHERE ticket_id=$1 AND active',[ticket.id])).rows[0].count,'1');
});
test('Statusmaschine und konkurrierende Versionen verhindern ungültige Änderungen',async()=>{
  assert.equal((await tech('/api/tickets/'+ticket.id+'/status',command({status:'CLOSED',version:2}))).status,409);
  const results=await Promise.all(['IN_PROGRESS','ESCALATED'].map(status=>tech('/api/tickets/'+ticket.id+'/status',command({status,version:2}))));
  assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);
  const detail=(await tech('/api/tickets/'+ticket.id)).data;assert.equal(detail.version,3);assert.equal(detail.events.length,3);
});
test('OData liefert Paging, Sortierung, Filter, Count, Select und Schlüsselzugriff',async()=>{
  const r=await dispatcher('/odata/Tickets?'+new URLSearchParams({'$top':'1','$skip':'0','$count':'true','$orderby':'createdAt desc','$filter':"contains(title,'VPN') and priority eq 'HIGH'",'$select':'id,number,title'}));
  assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.value.length,1);assert.ok(r.data['@odata.count']>=1);assert.equal(r.data.value[0].priority,undefined);
  assert.equal((await dispatcher('/odata/Tickets('+ticket.id+')')).data.id,ticket.id);
  assert.equal((await otherCustomer('/odata/Tickets('+ticket.id+')')).status,404);
});
test('OData verwirft SQL-Injection und unbekannte Optionen statt ungesichertem Fallback',async()=>{
  for(const q of [{'$filter':"title eq 'x'; DROP TABLE tickets"},{'$orderby':'id;DROP TABLE tickets'},{'$top':'1000'},{'$expand':'partner'},{'$filter':"tenantId eq 'x'"}])assert.equal((await dispatcher('/odata/Tickets?'+new URLSearchParams(q))).status,400);
  assert.equal((await customer('/odata/Technicians')).status,403);
});
test('Kunden- und Benutzerverwaltung ist autorisiert; Rollenänderung gilt sofort',async()=>{
  assert.equal((await dispatcher('/api/admin/users')).status,403);
  const p=await admin('/api/partners',{method:'POST',body:{name:'Kunde Integrationstest',email:'new@example.test',organizationId:orgId}});assert.equal(p.status,201);
  const user=await admin('/api/admin/users',{method:'POST',body:{name:'Testtechniker',email:'new-tech@example.test',password:'Strong-integration-password-2026!',role:'TECHNICIAN',organizationId:orgId}});assert.equal(user.status,201);
  const session=await client(h.base,{tenant:'netfusion',email:'new-tech@example.test',password:'Strong-integration-password-2026!'});
  assert.equal((await session('/api/dashboard')).status,200);
  const update=await admin('/api/admin/users/'+user.data.id,{method:'PATCH',body:{role:'TECHNICIAN',active:false}});assert.equal(update.status,200);
  assert.equal((await session('/api/dashboard')).status,401);
  assert.equal((await admin('/api/admin/users/'+h.accounts.find(a=>a.role==='ADMIN').id,{method:'PATCH',body:{role:'SUPPORT',active:true}})).status,409);
  assert.ok((await admin('/api/admin/users')).data.every(u=>u.password_hash===undefined));
});
test('Geschäftliche Audit-Ereignisse sind gegen UPDATE und DELETE gesperrt',async()=>{
  await assert.rejects(h.admin.query("UPDATE audit_events SET action='tampered' WHERE document_id=$1",[ticket.id]),/append-only/);
  await assert.rejects(h.admin.query('DELETE FROM audit_events WHERE document_id=$1',[ticket.id]),/append-only/);
});
test('API-Neustart erhält Session, Ticket, Fall, Zuweisung und Historie',async()=>{
  const before=(await customer('/api/tickets/'+ticket.id)).data;
  await h.restart();
  const after=await customer('/api/tickets/'+ticket.id);assert.equal(after.status,200);assert.deepEqual(after.data,before);
});
test('Logout invalidiert die serverseitige Sitzung',async()=>{
  assert.equal((await customer('/api/auth/logout',{method:'POST'})).status,200);
  assert.equal((await customer('/api/dashboard')).status,401);
});
