import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import pg from 'pg';
import {harness} from '../scripts/test-harness.mjs';
import {directSalesFixture} from './helpers/direct-sales-fixture.mjs';
import {cmd,ok} from './helpers/service-fixture.mjs';
let h,f,delivery,invoice,credit,originalPdf,priorStock;
const body=()=>({version:invoice.version,periodId:f.period.id,postingDate:'2026-10-23',documentDate:'2026-10-23',reason:'Kunde gibt die gesamte gelieferte Ware zurück; vollständige Rechnungskorrektur nach unabhängiger Finanzprüfung.'});
const reverse=()=>({periodId:f.period.id,postingDate:'2026-10-23',documentDate:'2026-10-23',reason:'Die ursprünglich ausgelieferten zwei Teile tatsächlich vollständig zurückerhalten und geprüft.'});
const sha=b=>createHash('sha256').update(b).digest('hex');
before(async()=>{
 h=await harness(3190);f=await directSalesFixture(h);
 ok(await f.admin('/api/workflow/definitions',cmd({organizationId:f.org,name:'Unabhängige Kundengutschriftprüfung',subjectKind:'CREDIT_NOTE',fourEyes:true,steps:[{name:'Finanzprüfung',roles:['ADMIN','ACCOUNTANT']}]})));
 delivery=await f.deliver('2');const request=ok(await f.request('2'));ok(await f.approve(request.id,1,f.billing,f.accountant));
 const l=ok(await f.billing('/api/billing/requests/'+request.id),200).lines[0];const inv=ok(await f.billing('/api/billing/invoices',cmd({orderId:f.directOrder.id,periodId:f.period.id,invoiceDate:'2026-10-22',postingDate:'2026-10-22',buyerReference:'PO-RETOURE-2026',lines:[{requestLineId:l.id,quantity:'2'}]})));
 invoice=ok(await f.billing('/api/billing/invoices/'+inv.id),200);originalPdf=ok(await f.customer('/api/billing/invoices/'+invoice.id+'/pdf',{binary:true}),200);
 priorStock=(await h.admin.query('SELECT sum(quantity)::text AS quantity,sum(value)::text AS value FROM inventory_valuations')).rows[0];
});
after(async()=>{if(h){if(process.env.ERP_TEST_DEBUG)console.error(h.logs());await h.close();}});
test('Gutschriftenrechte sind von Lager und Kunde getrennt; ungültige Daten ändern keine Forderung',async()=>{
 assert.equal((await f.warehouse('/api/customer-credits')).status,403);assert.equal((await f.customer('/api/customer-credits')).status,403);
 assert.equal((await f.billing('/api/customer-credits/invoices/'+invoice.id,cmd({...body(),documentDate:'2026-10-21'}))).status,409);
 assert.equal((await f.billing('/api/customer-credits/invoices/'+invoice.id,cmd({...body(),version:999}))).status,409);
 assert.equal((await f.warehouse('/api/inventory/issues/'+delivery.id+'/reverse',cmd(reverse()))).status,409);
 assert.equal(ok(await f.billing('/api/billing/invoices/'+invoice.id),200).openAmount,'238.00');
});
test('Parallele wiederholte Anlage erstellt genau einen GU-Beleg und übernimmt Originalmenge, Steuer und Preisstand',async()=>{
 const key=randomUUID(),rs=await Promise.all([f.billing('/api/customer-credits/invoices/'+invoice.id,cmd(body(),key)),f.billing('/api/customer-credits/invoices/'+invoice.id,cmd(body(),key))]);credit=ok(rs[0]);assert.deepEqual(credit,ok(rs[1]));assert.match(credit.number,/^GU-46\d{6}$/);
 const d=ok(await f.billing('/api/customer-credits/'+credit.id),200);assert.equal(d.snapshot.documentType,'CREDIT_NOTE');assert.equal(d.snapshot.originalInvoice.number,invoice.snapshot.number);assert.deepEqual(d.snapshot.items,invoice.snapshot.items);assert.deepEqual(d.snapshot.taxes,invoice.snapshot.taxes);assert.equal(d.gross,'238.00');assert.equal(d.outputStatus,null);
 assert.equal((await f.billing('/api/customer-credits/invoices/'+invoice.id,cmd(body()))).status,409);assert.equal((await f.billing('/api/customer-credits/'+credit.id+'/post',cmd({version:1}))).status,409);assert.equal(ok(await f.billing('/api/billing/invoices/'+invoice.id),200).openAmount,'238.00');
});
test('Eingereichter Prüfstand und unabhängige Finanzfreigabe sind verbindlich, auch für Administratoren',async()=>{
 assert.equal((await f.admin('/api/workflow/definitions',cmd({organizationId:f.org,name:'Keine Eigenfreigabe',subjectKind:'CREDIT_NOTE',fourEyes:false,steps:[{name:'Selbstprüfung',roles:['BILLING']}]}))).status,409);
 const a=ok(await f.billing('/api/workflow/submit/'+credit.id,cmd({version:1})));
 await assert.rejects(h.admin.query("UPDATE customer_credit_memos SET reason='Nachträglich veränderter Prüfstand' WHERE id=$1",[credit.id]),/unveränderlich/);
 assert.equal((await f.billing('/api/workflow/instances/'+a.id+'/decide',cmd({version:1,decision:'APPROVE',comment:'Eigene Gutschrift selbst genehmigen ist nicht erlaubt.'}))).status,403);
 assert.equal((await f.warehouse('/api/inventory/issues/'+delivery.id+'/reverse',cmd(reverse()))).status,409);
 ok(await f.accountant('/api/workflow/instances/'+a.id+'/decide',cmd({version:1,decision:'APPROVE',comment:'Originalrechnung, volle Mengen, Steuern, Forderung und ursprüngliche Kontierung unabhängig geprüft.'})));
 assert.equal(ok(await f.billing('/api/customer-credits/'+credit.id),200).status,'APPROVED');assert.equal(ok(await f.billing('/api/billing/invoices/'+invoice.id),200).openAmount,'238.00');
});
test('Buchung erzeugt genau eine historische Gegen-FI und einen Debitoren-Gegenposten; Bestand bleibt bis zur Warenannahme unverändert',async()=>{
 const rs=await Promise.all([f.billing('/api/customer-credits/'+credit.id+'/post',cmd({version:3})),f.billing('/api/customer-credits/'+credit.id+'/post',cmd({version:3}))]);assert.equal(rs.filter(r=>r.status===201).length,1,JSON.stringify(rs));assert.equal(rs.filter(r=>r.status===409).length,1);
 credit=ok(await f.billing('/api/customer-credits/'+credit.id),200);assert.equal(credit.status,'POSTED');assert.equal(credit.outputStatus,'READY',h.logs());assert.equal(ok(await f.billing('/api/billing/invoices/'+invoice.id),200).openAmount,'0.00');assert.equal(ok(await f.customer('/api/billing/invoices/'+invoice.id),200).creditId,credit.id);
 assert.deepEqual((await h.admin.query('SELECT sum(quantity)::text AS quantity,sum(value)::text AS value FROM inventory_valuations')).rows[0],priorStock);
 const entries=(await h.admin.query('SELECT account_id,side,amount::text,cost_center,tax_code,partner_id FROM journal_entries WHERE journal_id=$1 ORDER BY position',[invoice.journalId])).rows;
 const counter=(await h.admin.query('SELECT account_id,side,amount::text,cost_center,tax_code,partner_id FROM journal_entries WHERE journal_id=$1 ORDER BY position',[credit.journal.id])).rows;assert.deepEqual(counter,entries.map(l=>({...l,side:l.side==='DEBIT'?'CREDIT':'DEBIT'})));
 const ops=(await h.admin.query('SELECT count(*)::int AS n,sum(amount)::text AS amount FROM customer_credit_open_items WHERE credit_id=$1',[credit.id])).rows[0];assert.deepEqual(ops,{n:1,amount:'238.00'});assert.deepEqual(await f.count(),f.baseline);
});
test('Validiertes ZUGFeRD381 referenziert Originaldatum und Rechnung; ursprüngliches Rechnungs-PDF bleibt bytegleich',async()=>{
 const xml=ok(await f.customer('/api/customer-credits/'+credit.id+'/xml',{binary:true}),200).toString(),pdf=ok(await f.customer('/api/customer-credits/'+credit.id+'/pdf',{binary:true}),200);
 assert.match(xml,/<ram:TypeCode>381<\/ram:TypeCode>/);assert.ok(xml.includes('<ram:InvoiceReferencedDocument>'));assert.ok(xml.includes(invoice.snapshot.number));assert.match(xml,/20261022/);assert.match(xml,/Keine Zahlung erforderlich/);
 assert.deepEqual(ok(await f.customer('/api/billing/invoices/'+invoice.id+'/pdf',{binary:true}),200),originalPdf);
 const output=(await h.admin.query('SELECT validation_report FROM customer_credit_outputs WHERE credit_id=$1',[credit.id])).rows[0];assert.match(output.validation_report,/status="valid"/);
 const own=ok(await f.customer('/api/documents/'+f.directOrder.id+'/attachments'),200).attachments;assert.ok(own.some(a=>a.sourceId===credit.id&&a.documentType==='CREDIT_NOTE'));assert.ok(!ok(await f.warehouse('/api/documents/'+f.directOrder.id+'/attachments'),200).attachments.some(a=>a.documentType==='CREDIT_NOTE'));
 await mkdir('test-results/customer-credits',{recursive:true});await writeFile('test-results/customer-credits/'+credit.number+'.pdf',pdf);await writeFile('test-results/customer-credits/'+credit.number+'.xml',xml);await writeFile('test-results/customer-credits/verification.json',JSON.stringify({invoice:invoice.snapshot.number,credit:credit.number,gross:'238.00',originalPdfSha256:sha(originalPdf),creditPdfSha256:sha(pdf),creditXmlSha256:sha(xml),normativeValidation:true,originalPreserved:true},null,2)+'\n');
});
test('Gebuchte Gutschrift, Gegenposten, Ausgabe und ursprünglicher Prüfstand lassen sich nicht umschreiben',async()=>{
 await assert.rejects(h.admin.query("UPDATE customer_credit_memos SET reason='Originalwerte nachträglich überschreiben' WHERE id=$1",[credit.id]),/unveränderlich/);
 await assert.rejects(h.admin.query('DELETE FROM customer_credit_memos WHERE id=$1',[credit.id]),/unveränderlich/);
 await assert.rejects(h.admin.query('UPDATE customer_credit_open_items SET amount=1 WHERE credit_id=$1',[credit.id]),/unveränderlich/);
 await assert.rejects(h.admin.query("UPDATE customer_credit_outputs SET xml='changed' WHERE credit_id=$1",[credit.id]),/unveränderlich/);
});
test('Erst nach vollständiger Gutschrift ist die tatsächliche ganze Warenrücknahme mit ursprünglichem Wert und Bestandskonto möglich',async()=>{
 assert.equal(ok(await f.warehouse('/api/sales/deliveries/'+delivery.id),200).reversible,true);
 const rs=await Promise.all([f.warehouse('/api/inventory/issues/'+delivery.id+'/reverse',cmd(reverse())),f.warehouse('/api/inventory/issues/'+delivery.id+'/reverse',cmd(reverse()))]);assert.equal(rs.filter(r=>r.status===201).length,1,JSON.stringify(rs));assert.equal(rs.filter(r=>r.status===409).length,1);
 const c=await f.context();assert.equal(c.items[0].deliveredQuantity,'0.000000');assert.equal((await f.sources()).sources.length,0);assert.equal(ok(await f.billing('/api/billing/worklist'),200).due.length,0);
 const original=(await h.admin.query('SELECT sum(quantity)::text AS quantity,sum(value)::text AS value FROM goods_issue_items WHERE issue_id=$1',[delivery.id])).rows[0];const stock=(await h.admin.query('SELECT sum(quantity)::text AS quantity,sum(value)::text AS value FROM inventory_valuations')).rows[0];assert.equal(Number(stock.quantity)-Number(priorStock.quantity),Number(original.quantity));assert.equal(Number(stock.value)-Number(priorStock.value),Number(original.value));
 // The historical AF remains claimed. A credited original can never be billed again.
 const bound=(await h.admin.query('SELECT request_line_id FROM invoice_items WHERE invoice_id=$1',[invoice.id])).rows[0];assert.equal((await f.billing('/api/billing/invoices',cmd({orderId:f.directOrder.id,periodId:f.period.id,invoiceDate:'2026-10-23',postingDate:'2026-10-23',buyerReference:'Keine Doppelfaktura',lines:[{requestLineId:bound.request_line_id,quantity:'1'}]}))).status,409);
 assert.deepEqual(await f.count(),f.baseline);
});
test('Mandantenisolation gilt auch für Salden und Ausgaben; ungebundene FI darf keine Kundenrechnung gegenbuchen',async()=>{
 const db=new pg.Client({connectionString:h.urls.app});await db.connect();try{await db.query('BEGIN');await db.query("SELECT set_config('app.tenant_id',$1,true)",[randomUUID()]);for(const table of ['customer_credit_memos','customer_credit_open_items','customer_credit_output_jobs','customer_credit_outputs','customer_invoice_balances'])assert.equal((await db.query('SELECT count(*) FROM '+table)).rows[0].count,'0');await db.query('ROLLBACK');}finally{await db.end();}
 const id=randomUUID();await h.admin.query('BEGIN');try{await h.admin.query("INSERT INTO documents(id,tenant_id,organization_id,number,kind,created_by) SELECT $1,tenant_id,organization_id,'DO-SQL-CREDIT-ATTEMPT','ACCOUNTING',created_by FROM documents WHERE id=$2",[id,invoice.id]);await h.admin.query("INSERT INTO journals(id,tenant_id,company_id,period_id,posting_date,document_date,description,reference,currency,reversal_of) SELECT $1,tenant_id,company_id,period_id,posting_date,document_date,'Ungebundene Gegenbuchung','Original',currency,id FROM journals WHERE id=$2",[id,invoice.journalId]);await assert.rejects(h.admin.query('COMMIT'),/Gutschrift/);}finally{await h.admin.query('ROLLBACK');}
});
test('Eigener neuer Vorbereiter darf nicht freigeben; Periodensperre, Rücknahme und erneute Prüfung erhalten die volle Historie',async()=>{
 await f.deliver('2');const req=ok(await f.request('2'));ok(await f.approve(req.id,1,f.billing,f.accountant));const l=ok(await f.billing('/api/billing/requests/'+req.id),200).lines[0];const inv=ok(await f.billing('/api/billing/invoices',cmd({orderId:f.directOrder.id,periodId:f.period.id,invoiceDate:'2026-10-22',postingDate:'2026-10-22',buyerReference:'ZWEITE-RETOURE',lines:[{requestLineId:l.id,quantity:'2'}]})));
 let r=ok(await f.billing('/api/customer-credits/invoices/'+inv.id,cmd({...body(),version:1})));ok(await f.accountant('/api/customer-credits/'+r.id+'/prepare',cmd({...body(),version:1})));let a=ok(await f.billing('/api/workflow/submit/'+r.id,cmd({version:2})));
 assert.equal((await f.accountant('/api/workflow/instances/'+a.id+'/decide',cmd({version:1,decision:'APPROVE',comment:'Eigene Vorbereitung trotz anderem Ersteller nicht selbst genehmigen.'}))).status,403);
 ok(await f.admin('/api/workflow/instances/'+a.id+'/decide',cmd({version:1,decision:'APPROVE',comment:'Originalwerte und Vorbereitung vollständig unabhängig geprüft.'})));
 r=ok(await f.billing('/api/customer-credits/'+r.id),200);ok(await f.admin('/api/finance/companies/'+f.company.id+'/periods/'+f.period.id+'/status',cmd({version:1,status:'CLOSED',reason:'Periodensperre vor geplanter Rechnungskorrektur prüfen.'})));
 assert.equal((await f.billing('/api/customer-credits/'+r.id+'/post',cmd({version:r.version}))).status,409);assert.equal(ok(await f.billing('/api/billing/invoices/'+inv.id),200).openAmount,'238.00');assert.equal((await h.admin.query('SELECT count(*)::int AS n FROM journals WHERE source_id=$1',[r.id])).rows[0].n,0);
 ok(await f.billing('/api/customer-credits/'+r.id+'/withdraw',cmd({version:r.version,reason:'Prüfstand nach Periodensperre kontrolliert zurückziehen und neu unabhängig prüfen.'})));r=ok(await f.billing('/api/customer-credits/'+r.id),200);assert.equal(r.status,'DRAFT');assert.ok(r.decisions.some(d=>d.decision==='WITHDRAW'));
 ok(await f.admin('/api/finance/companies/'+f.company.id+'/periods/'+f.period.id+'/status',cmd({version:2,status:'OPEN',reason:'Berechtigte Wiederöffnung zur vollständigen Rechnungskorrektur.'})));ok(await f.billing('/api/customer-credits/'+r.id+'/prepare',cmd({...body(),version:r.version})));r=ok(await f.billing('/api/customer-credits/'+r.id),200);a=ok(await f.billing('/api/workflow/submit/'+r.id,cmd({version:r.version})));ok(await f.accountant('/api/workflow/instances/'+a.id+'/decide',cmd({version:1,decision:'APPROVE',comment:'Erneute unabhängige Prüfung nach Rücknahme und Periodenöffnung.'})));
 r=ok(await f.billing('/api/customer-credits/'+r.id),200);ok(await f.billing('/api/customer-credits/'+r.id+'/post',cmd({version:r.version})));assert.equal(ok(await f.billing('/api/billing/invoices/'+inv.id),200).openAmount,'0.00');
});
