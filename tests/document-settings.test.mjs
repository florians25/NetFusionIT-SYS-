import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import pg from 'pg';
import {harness,client} from '../scripts/test-harness.mjs';
import {serviceFixture,cmd,ok} from './helpers/service-fixture.mjs';
import {testDocumentContact} from './helpers/document-contact-fixture.mjs';
let h,f,company,order,old,oldBytes;
const path=()=>'/api/document-settings/'+company.id;
const save=(data,api=f.admin,key=randomUUID())=>api(path(),{...cmd(data,key),method:'PUT'});
const data=(version,extra={})=>({version,...testDocumentContact,active:true,reason:'Dokumentansprechpartner nachvollziehbar pflegen.',...extra});
const generate=()=>f.admin('/api/documents/'+order.id+'/attachments/generate',cmd({version:order.version,documentType:'RECORD',visibility:'INTERNAL'}));
before(async()=>{h=await harness(3198);f=await serviceFixture(h);company=ok(await f.admin('/api/finance/companies',cmd({organizationId:f.org,code:'1000',name:'Isolierte Formularprüfung GmbH',currency:'EUR',country:'DE',street:'Teststraße 1',postalCode:'10115',city:'Berlin',vatId:'DE123456789'})));order=await f.makeOrder();order=ok(await f.admin('/api/service/orders/'+order.id),200);});
after(async()=>{if(h)await h.close();});
test('Dokumentapp verlangt explizite Personendaten und berechtigte Pflege; fehlende Kontakte erzeugen keinen Archivbeleg',async()=>{
 const before=(await h.admin.query('SELECT count(*) FROM document_attachments')).rows[0].count;
 assert.equal((await generate()).status,409);assert.equal((await h.admin.query('SELECT count(*) FROM document_attachments')).rows[0].count,before);
 assert.equal((await f.customer('/api/document-settings')).status,403);assert.equal((await save(data(0),f.tech)).status,403);
 assert.equal((await save(data(0,{firstName:''}))).status,400);assert.equal((await save(data(0,{lastName:'Muster\nfrau'}))).status,400);
 const key=randomUUID(),r=ok(await save(data(0),f.admin,key),200);assert.deepEqual(ok(await save(data(0),f.admin,key),200),r);assert.equal(r.version,1);assert.equal((await save(data(0))).status,409);assert.equal((await f.admin('/api/document-settings/'+randomUUID(),{...cmd(data(0)),method:'PUT'})).status,404);
});
test('Neue Formulare archivieren den vollständigen Kontakt; Profiländerung schreibt alte PDFs und Hashes nicht um',async()=>{
 old=ok(await generate());assert.equal(old.templateVersion,6);oldBytes=ok(await f.admin('/api/documents/'+order.id+'/attachments/'+old.id+'/download',{binary:true}),200);
 assert.equal(createHash('sha256').update(oldBytes).digest('hex'),old.sha256);
 const snapshot=(await h.admin.query('SELECT source_snapshot FROM document_attachments WHERE id=$1',[old.id])).rows[0].source_snapshot;assert.equal(snapshot.contactLabel,'Vertriebsmitarbeiter');assert.equal(snapshot.contact.firstName,'Martina');assert.equal(snapshot.contact.lastName,'Musterfrau');
 ok(await save(data(1,{firstName:'Carolin',lastName:'Beispiel-Müller'})),200);
 const again=ok(await f.admin('/api/documents/'+order.id+'/attachments/'+old.id+'/download',{binary:true}),200);assert.deepEqual(again,oldBytes);
 const next=ok(await generate());assert.notEqual(next.id,old.id);const snap=(await h.admin.query('SELECT source_snapshot FROM document_attachments WHERE id=$1',[next.id])).rows[0].source_snapshot;assert.equal(snap.contact.firstName,'Carolin');assert.equal(snap.contact.version,2);
});
test('Kontakte sind mandantenisoliert, versioniert und können nur deaktiviert werden',async()=>{
 await assert.rejects(h.admin.query('DELETE FROM company_document_contacts WHERE company_id=$1',[company.id]),/deaktivieren/);
 await assert.rejects(h.admin.query("UPDATE company_document_contacts SET last_name='Manipuliert' WHERE company_id=$1",[company.id]),/Revision/);
 const app=new pg.Client({connectionString:h.urls.app});await app.connect();try{await app.query('BEGIN');await app.query("SELECT set_config('app.tenant_id',$1,true)",[randomUUID()]);assert.equal((await app.query('SELECT count(*) FROM company_document_contacts')).rows[0].count,'0');await app.query('ROLLBACK');}finally{await app.end();}
 ok(await save(data(2,{active:false})),200);assert.equal((await generate()).status,409);assert.deepEqual(ok(await f.admin('/api/documents/'+order.id+'/attachments/'+old.id+'/download',{binary:true}),200),oldBytes);
});
test('Vorname und Nachname bestimmen Benutzer- und Technikernamen ohne Aufspalten historischer Bezeichnungen',async()=>{
 const email='person-'+randomUUID()+'@example.test',password=randomUUID(),user=ok(await f.admin('/api/admin/users',cmd({name:'Wird kanonisch ersetzt',firstName:'Anne Marie',lastName:'von Beispiel',email,password,role:'TECHNICIAN',organizationId:f.org})));
 let users=ok(await f.admin('/api/admin/users'),200),p=users.find(x=>x.id===user.id);assert.equal(p.name,'Anne Marie von Beispiel');assert.equal(p.firstName,'Anne Marie');assert.equal(ok(await f.admin('/api/technicians'),200).find(x=>x.userId===user.id)?.name|| (await h.admin.query('SELECT name FROM technicians WHERE user_id=$1',[user.id])).rows[0].name,p.name);
 const api=await client(h.base,{tenant:'netfusion',email,password});assert.equal(ok(await api('/api/auth/session'),200).user.name,p.name);
 ok(await f.admin('/api/admin/users/'+user.id,{method:'PATCH',body:{role:'TECHNICIAN',active:true,firstName:'Anne Marie',lastName:'Beispiel-Weber'}}),200);
 assert.equal((await h.admin.query('SELECT name FROM technicians WHERE user_id=$1',[user.id])).rows[0].name,'Anne Marie Beispiel-Weber');assert.equal(ok(await api('/api/auth/session'),200).user.name,'Anne Marie Beispiel-Weber');
 const legacy=users.find(x=>x.id!==user.id);assert.equal(legacy.firstName,'');assert.equal(legacy.lastName,'');assert.equal((await f.admin('/api/admin/users/'+user.id,{method:'PATCH',body:{role:'TECHNICIAN',active:true,firstName:'Anne'}})).status,400);
});
test('CRM-Ansprechpartner behalten explizite Vor- und Nachnamen in Datenbank und Detailansicht',async()=>{
 const partnerId=ok(await f.customer('/api/auth/session'),200).user.partnerId;
 const c=ok(await f.admin('/api/partners/'+partnerId+'/contacts',cmd({data:{name:'Alte Darstellung',firstName:'Jan Peter',lastName:'von Muster',email:'jan@example.test',phone:'',mobile:'',position:'Einkauf',department:'IT',functions:['PURCHASING'],active:true,validFrom:null,validTo:null}})));
 const detail=ok(await f.admin('/api/partners/'+partnerId),200).contacts.find(x=>x.id===c.id);assert.equal(detail.name,'Jan Peter von Muster');assert.equal(detail.firstName,'Jan Peter');assert.equal(detail.lastName,'von Muster');
});
