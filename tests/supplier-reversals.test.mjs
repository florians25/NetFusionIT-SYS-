import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,writeFile,readFile,rm,mkdir} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import pg from 'pg';
import {harness} from '../scripts/test-harness.mjs';
import {supplierReversalFixture} from './helpers/supplier-reversal-fixture.mjs';
import {cmd,ok} from './helpers/service-fixture.mjs';
let h,f,rev,approval,posted,original,initialStock,initialInvoice,initialAllocations;
const path=id=>'/api/supplier-invoice-reversals/'+id;
before(async()=>{h=await harness(3139);f=await supplierReversalFixture(h);original=ok(await f.buyer('/api/incoming-invoices/'+f.invoice.id+'/files/original',{binary:true}),200);initialInvoice=(await h.admin.query('SELECT to_jsonb(i) AS row FROM supplier_invoices i WHERE id=$1',[f.invoice.id])).rows[0].row;initialAllocations=(await h.admin.query('SELECT to_jsonb(a) AS row FROM supplier_invoice_allocations a ORDER BY position')).rows;initialStock=(await h.admin.query('SELECT quantity::text,value::text FROM inventory_valuations WHERE product_id=$1',[f.product.id])).rows;});
after(async()=>{if(h)await h.close();});
test('Stornoentwurf ist eigener SB-Beleg; nur Finanzrollen, gültige Quelle und Datumsfolge; noch keine Freigabe von OP oder WE',async()=>{
 const financial=ok(await f.accountant('/api/incoming-invoices/'+f.invoice.id+'/financial'),200),body=f.reverseBody(financial.version);
 assert.equal((await f.buyer('/api/incoming-invoices/'+f.invoice.id+'/reversal',cmd(body))).status,403);
 assert.equal((await f.accountant('/api/incoming-invoices/'+f.invoice.id+'/reversal',cmd({...body,postingDate:'2026-10-21'}))).status,409);
 const attempts=await Promise.all([f.createReversal(),f.createReversal()]);assert.deepEqual(attempts.map(r=>r.status).sort(),[201,409]);rev=ok(attempts.find(r=>r.status===201));assert.match(rev.number,/^SB-89\d{6}$/);assert.equal((await f.createReversal()).status,409);
 const d=ok(await f.accountant(path(rev.id)),200);assert.equal(d.status,'DRAFT');assert.equal(d.lines.length,3);assert.ok(d.lines.find(l=>l.code==='1900'&&l.counterSide==='CREDIT'));assert.equal((await f.accountant(path(rev.id)+'/post',cmd({version:d.version}))).status,409);
 const op=ok(await f.accountant('/api/incoming-invoices/'+f.invoice.id+'/financial'),200);assert.equal(op.openItem.balance,'190.40');assert.equal(op.reversed,false);assert.equal(op.reversal.id,rev.id);
 assert.equal((await f.warehouse('/api/inventory/receipts/'+f.receipt.id+'/reverse',cmd({periodId:f.period.id,postingDate:'2026-10-22',documentDate:'2026-10-22',reason:'Ein Stornoentwurf hebt eine gebuchte Verrechnung noch nicht auf.'}))).status,409);
 assert.equal((await h.admin.query('SELECT count(*) FROM journals WHERE source_id=$1',[rev.id])).rows[0].count,'0');
});
test('Stornofreigabe benötigt unabhängige Finanzrolle und unveränderten Prüfstand; eigene Freigabe und kurze Begründung scheitern',async()=>{
 assert.equal((await f.admin('/api/workflow/definitions',cmd({organizationId:f.org,name:'Unzulässige Stornofreigabe',subjectKind:'SUPPLIER_INVOICE_REVERSAL',fourEyes:false,steps:[{name:'Direktfreigabe',roles:['BUYER']}]}))).status,409);
 approval=ok(await f.accountant('/api/workflow/submit/'+rev.id,cmd({version:1})));
 assert.equal((await f.accountant('/api/workflow/instances/'+approval.id+'/decide',cmd({version:1,decision:'APPROVE',comment:'Eigene Gegenbuchung darf nicht selbst freigegeben werden.'}))).status,403);
 assert.equal((await f.admin('/api/workflow/instances/'+approval.id+'/decide',cmd({version:1,decision:'APPROVE',comment:'Okay'}))).status,409);
 await assert.rejects(h.admin.query("UPDATE supplier_invoice_reversals SET reason='Nachträglicher anderer Grund ohne neue unabhängige Prüfung' WHERE id=$1",[rev.id]),/unveränderlich/);
 ok(await f.admin('/api/workflow/instances/'+approval.id+'/decide',cmd({version:1,decision:'APPROVE',comment:'Ursprung, Gegenkontierung und unbezahlten Posten unabhängig geprüft.'})));
 const context=(await h.admin.query("SELECT context FROM approval_decisions WHERE instance_id=$1 AND decision='APPROVE'",[approval.id])).rows[0].context;assert.match(context.preparedHash,/^[a-f0-9]{64}$/);assert.equal(context.inputTaxChecked,undefined);
});
test('Geschlossene Stornoperiode rollt Gegen-FI und Mengenfreigabe zurück; Rücknahme erhält die Freigabehistorie',async()=>{
 const d=ok(await f.accountant(path(rev.id)),200);ok(await f.admin('/api/finance/companies/'+f.company.id+'/periods/'+f.period.id+'/status',cmd({version:1,status:'CLOSED',reason:'Buchungsperiode vor geplanter Rechnungskorrektur schließen.'})));
 assert.equal((await f.accountant(path(rev.id)+'/post',cmd({version:d.version}))).status,409);assert.equal((await h.admin.query('SELECT count(*) FROM journals WHERE source_id=$1',[rev.id])).rows[0].count,'0');assert.equal(ok(await f.accountant('/api/incoming-invoices/'+f.invoice.id+'/financial'),200).openItem.balance,'190.40');
 ok(await f.accountant(path(rev.id)+'/withdraw',cmd({version:d.version,reason:'Periodensperre erfordert aktualisierte Vorbereitung und erneute unabhängige Prüfung.'})));let current=ok(await f.accountant(path(rev.id)),200);assert.equal(current.status,'DRAFT');assert.ok(current.decisions.some(d=>d.decision==='WITHDRAW'));
 ok(await f.admin('/api/finance/companies/'+f.company.id+'/periods/'+f.period.id+'/status',cmd({version:2,status:'OPEN',reason:'Berechtigte Wiederöffnung für nachvollziehbare Gegenbuchung.'})));
 ok(await f.accountant(path(rev.id)+'/prepare',cmd(f.reverseBody(current.version))));current=await f.approveReversal(rev);assert.equal(current.status,'APPROVED');
});
test('Parallele Wiederholung erzeugt genau einen Gegen-FI-Beleg, null OP-Rest und freigegebene WE-Mengen ohne Lagerbewegung',async()=>{
 const d=ok(await f.accountant(path(rev.id)),200),key=randomUUID(),rows=await Promise.all([f.accountant(path(rev.id)+'/post',cmd({version:d.version},key)),f.accountant(path(rev.id)+'/post',cmd({version:d.version},key))]);rows.forEach(r=>ok(r));posted=rows[0].data;assert.equal(posted.journal.id,rows[1].data.journal.id);
 const op=ok(await f.accountant('/api/incoming-invoices/'+f.invoice.id+'/financial'),200);assert.equal(op.reversed,true);assert.equal(op.openItem.amount,'190.40');assert.equal(op.openItem.balance,'0.00');assert.equal((await h.admin.query('SELECT count(*) FROM journals WHERE reversal_of=$1',[f.posted.journal.id])).rows[0].count,'1');
 assert.deepEqual((await h.admin.query('SELECT quantity::text,value::text FROM inventory_valuations WHERE product_id=$1',[f.product.id])).rows,initialStock);assert.deepEqual((await h.admin.query('SELECT to_jsonb(i) AS row FROM supplier_invoices i WHERE id=$1',[f.invoice.id])).rows[0].row,initialInvoice);assert.deepEqual((await h.admin.query('SELECT to_jsonb(a) AS row FROM supplier_invoice_allocations a ORDER BY position')).rows,initialAllocations);
 const balance=ok(await f.admin('/api/finance/companies/'+f.company.id+'/trial-balance'),200),b=id=>Number(balance.find(x=>x.id===id).balance);assert.equal(b(f.grir.id),-160);assert.equal(b(f.payable.id),0);assert.equal(b(f.tax.id),0);assert.equal(b(f.inventory.id),160);
 const matching=ok(await f.buyer('/api/incoming-invoices/'+f.invoice.id+'/matching'),200);assert.equal(matching.reversed,true);assert.equal(matching.items[0].remainingQuantity,'4');
});
test('Erst tatsächlich gebuchter Storno erlaubt eine neue Rechnung auf dieselbe WE-Menge; weitere Rechnung schützt den WE erneut',async()=>{
 const next=await f.importInvoice('LIEFERANT-NEU-NACH-KORREKTUR','4');ok(await f.prepare(next));const a=await f.approve(next);ok(await f.accountant('/api/incoming-invoices/'+next.id+'/post',cmd({version:a.version})));
 const q=(await h.admin.query('SELECT sum(a.quantity)::text AS q FROM supplier_invoice_allocations a WHERE supplier_invoice_effective(a.tenant_id,a.invoice_id)')).rows[0].q;assert.equal(q,'4.000000');assert.equal((await f.warehouse('/api/inventory/receipts/'+f.receipt.id+'/reverse',cmd({periodId:f.period.id,postingDate:'2026-10-22',documentDate:'2026-10-22',reason:'Neue wirksame Rechnung beansprucht wieder diese Wareneingangsmenge.'}))).status,409);
 const second=ok(await f.createReversal(next)),approved=await f.approveReversal(second);ok(await f.accountant(path(second.id)+'/post',cmd({version:approved.version})));
 ok(await f.warehouse('/api/inventory/receipts/'+f.receipt.id+'/reverse',cmd({periodId:f.period.id,postingDate:'2026-10-22',documentDate:'2026-10-22',reason:'Nach vollständigen Finanzgegenbuchungen nun tatsächlichen Wareneingang zurücknehmen.'})));
});
test('Gebuchte Stornobelege/OP bleiben unveränderlich, direkte FI-Umgehung und fremde Mandanten werden abgewehrt',async()=>{
 for(const sql of ["UPDATE supplier_invoice_reversals SET snapshot='{}' WHERE id=$1","UPDATE supplier_invoice_reversals SET sealed=false,status='DRAFT' WHERE id=$1","DELETE FROM supplier_invoice_reversals WHERE id=$1"])await assert.rejects(h.admin.query(sql,[rev.id]),/unveränderlich/);
 assert.equal((await f.buyer(path(rev.id)+'/post',cmd({version:5}))).status,403);for(const api of [f.customer,f.tech,f.warehouse])assert.equal((await api(path(rev.id))).status,403);assert.equal((await f.accountant(path(randomUUID()))).status,404);
 const db=new pg.Client({connectionString:h.urls.app});await db.connect();try{await db.query('BEGIN');await db.query("SELECT set_config('app.tenant_id',$1,true)",[randomUUID()]);for(const table of ['supplier_invoice_reversals','supplier_invoice_balances'])assert.equal((await db.query('SELECT count(*) FROM '+table)).rows[0].count,'0');await db.query('ROLLBACK');}finally{await db.end();}
 // No unbound journal may reverse an AP journal, even through direct SQL.
 const id=randomUUID();await h.admin.query('BEGIN');try{await h.admin.query("INSERT INTO documents(id,tenant_id,organization_id,number,kind,created_by) SELECT $1,tenant_id,organization_id,'DO-SQL-ATTEMPT','ACCOUNTING',created_by FROM documents WHERE id=$2",[id,f.invoice.id]);await h.admin.query("INSERT INTO journals(id,tenant_id,company_id,period_id,posting_date,document_date,description,reference,currency,reversal_of) SELECT $1,tenant_id,company_id,period_id,posting_date,document_date,'Umgehungsversuch','Original','EUR',id FROM journals WHERE id=$2",[id,f.posted.journal.id]);await assert.rejects(h.admin.query('COMMIT'),/Stornobeleg/);}finally{await h.admin.query('ROLLBACK');}
});
test('Storno-PDF referenziert EG, externe Nummer, ursprüngliche und Gegen-FI, deutsche Daten und Begründung; Lieferantenoriginal bytegleich',async()=>{
 const p='/api/documents/'+rev.id+'/attachments',ctx=ok(await f.accountant(p),200),a=ok(await f.accountant(p+'/generate',cmd({version:ctx.version,documentType:'RECORD',visibility:'INTERNAL'}))),pdf=ok(await f.accountant(p+'/'+a.id+'/download',{binary:true}),200),folder=await mkdtemp('/tmp/erp-ap-counter-pdf-');
 try{await writeFile(folder+'/proof.pdf',pdf);await promisify(execFile)('pdftotext',['-layout',folder+'/proof.pdf',folder+'/proof.txt']);const text=await readFile(folder+'/proof.txt','utf8');for(const v of ['Stornobeleg',rev.number,f.invoice.number,f.posted.journal.number,posted.journal.number,'22.10.2026','190,40 EUR'])assert.ok(text.includes(v),v);assert.ok(!text.includes('2026-10-22'));assert.ok(text.includes(f.invoiceData.buyer.name));assert.ok(!text.includes('Andere Testgesellschaft'));assert.ok(!text.includes('Falsche Straße'));await mkdir('test-results',{recursive:true});await writeFile('test-results/supplier-reversal-proof.pdf',pdf);}finally{await rm(folder,{recursive:true,force:true});}
 assert.deepEqual(ok(await f.buyer('/api/incoming-invoices/'+f.invoice.id+'/files/original',{binary:true}),200),original);
});

test('Ursprüngliche Periode bleibt geschlossen; vollständige Gegenbuchung in neuer offener Stornoperiode ist zulässig',async()=>{
 const invoice=await f.importInvoice('LIEFERANT-NEUER-STORNOMONAT','2');ok(await f.prepare(invoice));const approved=await f.approve(invoice);ok(await f.accountant('/api/incoming-invoices/'+invoice.id+'/post',cmd({version:approved.version})));
 const november=ok(await f.admin('/api/finance/companies/'+f.company.id+'/periods',cmd({year:2026,period:11,dateFrom:'2026-11-01',dateTo:'2026-11-30'}))),period=(await h.admin.query('SELECT version FROM fiscal_periods WHERE id=$1',[f.period.id])).rows[0];
 ok(await f.admin('/api/finance/companies/'+f.company.id+'/periods/'+f.period.id+'/status',cmd({version:period.version,status:'CLOSED',reason:'Originalmonat abschließen; Korrektur wird in der neuen offenen Periode gebucht.'})));
 const original=ok(await f.accountant('/api/incoming-invoices/'+invoice.id+'/financial'),200),counter=ok(await f.accountant('/api/incoming-invoices/'+invoice.id+'/reversal',cmd({...f.reverseBody(original.version),periodId:november.id,postingDate:'2026-11-02',documentDate:'2026-11-02'}))),reviewed=await f.approveReversal(counter);ok(await f.accountant(path(counter.id)+'/post',cmd({version:reviewed.version})));
 const d=ok(await f.accountant(path(counter.id)),200);assert.equal(d.postingDate,'2026-11-02');assert.equal(d.periodId,november.id);assert.equal(ok(await f.accountant('/api/incoming-invoices/'+invoice.id+'/financial'),200).openItem.balance,'0.00');assert.equal((await h.admin.query('SELECT status FROM fiscal_periods WHERE id=$1',[f.period.id])).rows[0].status,'CLOSED');
});
