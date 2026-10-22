import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {harness,client} from '../scripts/test-harness.mjs';
import {cmd,ok} from './helpers/service-fixture.mjs';
let h,admin,accountant,customer,tech,org,company,period,accounts={},journal;
const journalBody=(extra={})=>({companyId:company.id,periodId:period.id,postingDate:'2026-10-22',documentDate:'2026-10-22',description:'Eigenkapitaleinlage auf Bankkonto',reference:'BANK-TEST-001',lines:[{accountId:accounts.BANK.id,side:'DEBIT',amount:'100.10',description:'Bankgutschrift',costCenter:null,partnerId:null,taxCode:null},{accountId:accounts.EQUITY.id,side:'CREDIT',amount:'100.10',description:'Kapitalzuführung',costCenter:null,partnerId:null,taxCode:null}],...extra});
async function approve(id,version){const s=ok(await admin('/api/workflow/submit/'+id,cmd({version})));return accountant('/api/workflow/instances/'+s.id+'/decide',cmd({version:1,decision:'APPROVE',comment:'Buchung sachlich und rechnerisch geprüft.'}));}
before(async()=>{
 h=await harness(3113);admin=await client(h.base,h.accounts.find(a=>a.role==='ADMIN'));customer=await client(h.base,h.accounts.find(a=>a.role==='CUSTOMER'));tech=await client(h.base,h.accounts.find(a=>a.role==='TECHNICIAN'));org=(await admin('/api/organization')).data[0].id;
 const user={name:'Buchhaltung Prüfung',email:'accountant@example.test',password:randomUUID(),role:'ACCOUNTANT',organizationId:org};ok(await admin('/api/admin/users',{method:'POST',body:user}));accountant=await client(h.base,{tenant:'netfusion',...user});ok(await admin('/api/catalog/currencies',cmd({code:'XTS',digits:4})));
 company=ok(await admin('/api/finance/companies',cmd({organizationId:org,code:'1000',name:'NetFusion Testgesellschaft',currency:'XTS',country:'DE',street:'Teststraße 1',postalCode:'10115',city:'Berlin',vatId:''})));
 for(const kind of ['BANK','EQUITY','EXPENSE','REVENUE'])accounts[kind]=ok(await admin('/api/finance/companies/'+company.id+'/accounts',cmd({code:{BANK:'1200',EQUITY:'9000',EXPENSE:'4900',REVENUE:'8400'}[kind],name:{BANK:'Bank',EQUITY:'Eigenkapital',EXPENSE:'Sonstiger Aufwand',REVENUE:'Serviceerlöse'}[kind],kind})));
 period=ok(await admin('/api/finance/companies/'+company.id+'/periods',cmd({year:2026,period:10,dateFrom:'2026-10-01',dateTo:'2026-10-31'})));
 ok(await admin('/api/workflow/definitions',cmd({name:'Vier-Augen-Prüfung Buchhaltung',organizationId:org,subjectKind:'ACCOUNTING',fourEyes:true,steps:[{name:'Buchhaltungsprüfung',roles:['ACCOUNTANT']}]})));
});after(async()=>{if(h)await h.close();});
test('Buchungskreis und Periode sind explizit; Rollen und Periodenüberschneidungen werden geprüft',async()=>{
 assert.equal((await customer('/api/finance/companies')).status,403);assert.equal((await tech('/api/finance/companies')).status,403);assert.equal((await admin('/api/finance/companies/'+company.id+'/periods',cmd({year:2026,period:11,dateFrom:'2026-10-15',dateTo:'2026-11-15'}))).status,409);
 assert.equal((await admin('/api/workflow/definitions',cmd({name:'Unzulässige Finanzfreigabe',organizationId:org,subjectKind:'ACCOUNTING',fourEyes:false,steps:[{name:'Prüfung',roles:['SUPPORT']}]}))).status,409);
});
test('Unausgeglichene Journale, falsche Währungspräzision und geschlossene/falsche Perioden erzeugen keine Belege',async()=>{
 const before=ok(await admin('/api/finance/companies/'+company.id+'/journals'),200).length;
 for(const b of [journalBody({lines:journalBody().lines.map((l,i)=>({...l,amount:i?'100':'100.10'}))}),journalBody({lines:journalBody().lines.map(l=>({...l,amount:'100.00001'}))}),journalBody({postingDate:'2026-11-01'}),journalBody({lines:journalBody().lines.map(l=>({...l,accountId:randomUUID()}))})])assert.equal((await admin('/api/finance/journals',cmd(b))).status,409);
 assert.equal(ok(await admin('/api/finance/companies/'+company.id+'/journals'),200).length,before);
});
test('Journalentwurf verändert keine Kontensalden und kann nur nach unabhängiger Freigabe gebucht werden',async()=>{
 journal=ok(await admin('/api/finance/journals',cmd(journalBody())));assert.match(journal.number,/^JRD-/);assert.ok(ok(await admin('/api/finance/companies/'+company.id+'/trial-balance'),200).every(a=>Number(a.balance)===0));assert.equal((await admin('/api/finance/journals/'+journal.id+'/post',cmd({version:1}))).status,409);ok(await approve(journal.id,1));
 const d=ok(await admin('/api/finance/journals/'+journal.id),200);assert.equal(d.status,'APPROVED');assert.equal(d.version,3);
});
test('Periodensperre nach Freigabe verhindert Buchung ohne Verlust des genehmigten Belegs',async()=>{
 ok(await admin('/api/finance/companies/'+company.id+'/periods/'+period.id+'/status',cmd({version:1,status:'CLOSED',reason:'Monatsabschluss für Prüfung gesperrt.'})));assert.equal((await admin('/api/finance/journals/'+journal.id+'/post',cmd({version:3}))).status,409);assert.equal(ok(await admin('/api/finance/journals/'+journal.id),200).status,'APPROVED');ok(await admin('/api/finance/companies/'+company.id+'/periods/'+period.id+'/status',cmd({version:2,status:'OPEN',reason:'Buchungsprüfung abgeschlossen, erneut öffnen.'})));
});
test('Parallele Buchung vergibt eine Journalnummer und schreibt exakt ausgeglichene Salden',async()=>{
 const rs=await Promise.all([admin('/api/finance/journals/'+journal.id+'/post',cmd({version:3})),admin('/api/finance/journals/'+journal.id+'/post',cmd({version:3}))]);assert.deepEqual(rs.map(r=>r.status).sort(),[201,409]);journal=rs.find(r=>r.status===201).data;assert.match(journal.number,/^JRN-/);const d=ok(await admin('/api/finance/journals/'+journal.id),200);assert.equal(d.contentHash.length,64);const balances=ok(await admin('/api/finance/companies/'+company.id+'/trial-balance'),200);assert.equal(balances.find(a=>a.code==='1200').balance,'100.1000');assert.equal(balances.find(a=>a.code==='9000').balance,'-100.1000');
});
test('PostgreSQL verhindert Änderungen und zusätzliche Positionen an gebuchten Journalen',async()=>{
 const d=ok(await admin('/api/finance/journals/'+journal.id),200);await assert.rejects(h.admin.query("UPDATE journals SET description='changed' WHERE id=$1",[journal.id]),/unveränderlich/);await assert.rejects(h.admin.query("UPDATE journal_entries SET amount=1 WHERE id=$1",[d.lines[0].id]),/unveränderlich/);await assert.rejects(h.admin.query('DELETE FROM journal_entries WHERE id=$1',[d.lines[0].id]),/unveränderlich/);await assert.rejects(h.admin.query('INSERT INTO journal_entries(id,tenant_id,journal_id,position,account_id,side,amount,description) SELECT $1,tenant_id,id,99,$3,\'DEBIT\',1,\'Manipulation\' FROM journals WHERE id=$2',[randomUUID(),journal.id,accounts.BANK.id]),/unveränderlich/);
});
test('Storno erzeugt genehmigungspflichtigen Gegenbeleg und gleicht Salden aus; Original bleibt erhalten',async()=>{
 const reversal=ok(await admin('/api/finance/journals/'+journal.id+'/reverse',cmd({version:4,periodId:period.id,postingDate:'2026-10-23',documentDate:'2026-10-23',reason:'Testbuchung vollständig zurücknehmen.'})));assert.equal((await admin('/api/finance/journals/'+journal.id+'/reverse',cmd({version:4,periodId:period.id,postingDate:'2026-10-23',documentDate:'2026-10-23',reason:'Doppelter Stornoversuch.'}))).status,409);ok(await approve(reversal.id,1));ok(await admin('/api/finance/journals/'+reversal.id+'/post',cmd({version:3})));assert.ok(ok(await admin('/api/finance/companies/'+company.id+'/trial-balance'),200).every(a=>Number(a.balance)===0));assert.equal(ok(await admin('/api/finance/journals/'+journal.id),200).status,'POSTED');const flow=ok(await admin('/api/documents/'+journal.id+'/flow'),200);assert.ok(flow.some(r=>r.kind==='REVERSES'&&r.targetId===reversal.id));assert.equal((await customer('/api/documents/'+journal.id+'/flow')).status,404);
});
test('Journalprüfung in der Datenbank blockiert unausgeglichene Direktbuchung und neue Tabellen erzwingen Tenant-RLS',async()=>{
 const draft=ok(await admin('/api/finance/journals',cmd(journalBody())));await h.admin.query('UPDATE journal_entries SET amount=1 WHERE journal_id=$1 AND side=\'CREDIT\'',[draft.id]);await assert.rejects(h.admin.query("UPDATE journals SET status='POSTED',posted_at=now(),posted_by=$2,content_hash='invalid' WHERE id=$1",[draft.id,h.accounts.find(a=>a.role==='ADMIN').id]),/unausgeglichen/);assert.equal(ok(await admin('/api/finance/journals/'+draft.id),200).status,'DRAFT');
 const app=new pg.Client({connectionString:h.urls.app});await app.connect();try{await app.query('BEGIN');await app.query("SELECT set_config('app.tenant_id',$1,true)",[randomUUID()]);for(const table of ['company_codes','gl_accounts','fiscal_periods','journals','journal_entries','accounting_rules'])assert.equal((await app.query('SELECT count(*) FROM '+table)).rows[0].count,'0');await app.query('ROLLBACK');}finally{await app.end();}
});
test('Kontierungsregeln prüfen Buchungskreis, Kontenarten, vollständige Rollen und Konfigurationsversion',async()=>{
 const inventory=ok(await admin('/api/finance/companies/'+company.id+'/accounts',cmd({code:'1000',name:'Materialbestand',kind:'ASSET'})));
 assert.equal((await admin('/api/finance/companies/'+company.id+'/rules',cmd({event:'STOCK_OPENING',version:0,accounts:{inventory:inventory.id}}))).status,409);
 assert.equal((await admin('/api/finance/companies/'+company.id+'/rules',cmd({event:'STOCK_OPENING',version:0,accounts:{inventory:accounts.BANK.id,offset:accounts.EQUITY.id}}))).status,409);
 const valid={event:'STOCK_OPENING',version:0,accounts:{inventory:inventory.id,offset:accounts.EQUITY.id}};ok(await admin('/api/finance/companies/'+company.id+'/rules',cmd(valid)));assert.equal((await admin('/api/finance/companies/'+company.id+'/rules',cmd(valid))).status,409);assert.equal(ok(await admin('/api/finance/companies/'+company.id+'/context'),200).rules.length,2);
});
test('Readiness prüft alle Migrationsprüfsummen und Tabellen des laufenden Quellstands',async()=>{
 const row=(await h.admin.query("SELECT name,checksum FROM schema_migrations ORDER BY name DESC LIMIT 1")).rows[0];try{await h.admin.query("UPDATE schema_migrations SET checksum='invalid' WHERE name=$1",[row.name]);assert.equal((await fetch(h.base+'/health/ready')).status,503);}finally{await h.admin.query('UPDATE schema_migrations SET checksum=$2 WHERE name=$1',[row.name,row.checksum]);}assert.equal((await fetch(h.base+'/health/ready')).status,200);
 try{await h.admin.query('ALTER TABLE gl_accounts RENAME TO gl_accounts_readiness_test');assert.equal((await fetch(h.base+'/health/ready')).status,503);}finally{await h.admin.query('ALTER TABLE gl_accounts_readiness_test RENAME TO gl_accounts');}assert.equal((await fetch(h.base+'/health/ready')).status,200);
});

test('Hohe ausgeglichene Beträge mit vier Nachkommastellen bleiben auch bei Summierung exakt',async()=>{
 const lines=[...Array.from({length:2},()=>({...journalBody().lines[0],side:'DEBIT',amount:'9999999999999999.9999'})),...Array.from({length:2},()=>({...journalBody().lines[1],side:'CREDIT',amount:'9999999999999999.9999'}))];const j=ok(await admin('/api/finance/journals',cmd(journalBody({lines}))));const d=ok(await admin('/api/finance/journals/'+j.id),200);assert.equal(d.totals.debit,'19999999999999999.9998');assert.equal(d.totals.credit,d.totals.debit);
});

test('Belegersteller kann Vier-Augen-Prüfung auch über einen anderen Einreicher nicht umgehen',async()=>{
 const u={name:'Unabhängige Finanzprüfung',email:'independent-finance@example.test',password:randomUUID(),role:'ADMIN',organizationId:org};ok(await admin('/api/admin/users',{method:'POST',body:u}));const independent=await client(h.base,{tenant:'netfusion',...u});
 ok(await admin('/api/workflow/definitions',cmd({name:'Unabhängige Administrationsprüfung',organizationId:org,subjectKind:'ACCOUNTING',fourEyes:true,steps:[{name:'Finanzprüfung',roles:['ADMIN']}]})));
 const d=ok(await admin('/api/finance/journals',cmd(journalBody()))),s=ok(await accountant('/api/workflow/submit/'+d.id,cmd({version:1})));
 assert.equal((await admin('/api/workflow/instances/'+s.id+'/decide',cmd({version:1,decision:'APPROVE',comment:'Eigene Buchung durch Stellvertreter eingereicht.'}))).status,403);
 ok(await independent('/api/workflow/instances/'+s.id+'/decide',cmd({version:1,decision:'APPROVE',comment:'Unabhängig vom Ersteller und Einreicher geprüft.'})));
});
