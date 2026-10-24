import{before,after,test}from'node:test';
import assert from'node:assert/strict';
import{randomUUID,createHash}from'node:crypto';
import{execFileSync}from'node:child_process';
import{mkdir,writeFile}from'node:fs/promises';
import pg from'pg';
import{harness}from'../scripts/test-harness.mjs';
import{approvedSalesOrder}from'./helpers/sales-fixture.mjs';
import{directSalesFixture}from'./helpers/direct-sales-fixture.mjs';
import{cmd,ok}from'./helpers/service-fixture.mjs';
let h,f,deliveries,invoice,items,first,second,original,stockBefore;
const body=ids=>({version:1,periodId:f.period.id,postingDate:'2026-10-23',documentDate:'2026-10-23',reason:'Nur die ausgewählten tatsächlichen Rechnungspositionen nach unabhängiger Finanzprüfung korrigieren.',invoiceItemIds:ids});
const reversal=()=>({periodId:f.period.id,postingDate:'2026-10-23',documentDate:'2026-10-23',reason:'Diese vollständige Originalauslieferung tatsächlich zurückerhalten und kontrolliert am ursprünglichen Fach angenommen.'});
const report=()=>f.admin('/api/reporting/sales?'+new URLSearchParams({companyId:f.company.id,from:'2026-10-01',to:'2026-10-31'}));
async function post(id){let d=ok(await f.billing('/api/customer-credits/'+id),200);ok(await f.approve(id,d.version,f.billing,f.accountant));d=ok(await f.billing('/api/customer-credits/'+id),200);return ok(await f.billing('/api/customer-credits/'+id+'/post',cmd({version:d.version})));}
before(async()=>{
 h=await harness(3195);f=await directSalesFixture(h);ok(await f.admin('/api/workflow/definitions',cmd({organizationId:f.org,name:'Unabhängige Positionsgutschriftprüfung',subjectKind:'CREDIT_NOTE',fourEyes:true,steps:[{name:'Finanzprüfung',roles:['ACCOUNTANT']}]})));
 deliveries=[await f.deliver('1'),await f.deliver('2')];const sources=await f.sources();const r=ok(await f.billing('/api/billing/orders/'+f.directOrder.id+'/requests',cmd({version:sources.version,title:'Zwei tatsächlich getrennte Lieferquellen prüfen',lines:sources.sources.map(l=>({sourceKey:l.sourceKey,quantity:l.remainingQuantity,serviceFrom:l.serviceFrom,serviceTo:l.serviceTo}))})));ok(await f.approve(r.id,1,f.billing,f.accountant));
 const lines=ok(await f.billing('/api/billing/requests/'+r.id),200).lines;
 const i=ok(await f.billing('/api/billing/invoices',cmd({orderId:f.directOrder.id,periodId:f.period.id,invoiceDate:'2026-10-22',postingDate:'2026-10-22',buyerReference:'ZWEI-ORIGINALPOSITIONEN',lines:lines.map(l=>({requestLineId:l.id,quantity:l.quantity}))})));
 invoice=ok(await f.billing('/api/billing/invoices/'+i.id),200);items=ok(await f.billing('/api/customer-credits/invoices/'+i.id+'/selection'),200).items;items.sort((a,b)=>Number(a.quantity)-Number(b.quantity));
 original=ok(await f.customer('/api/billing/invoices/'+i.id+'/pdf',{binary:true}),200);stockBefore=(await h.admin.query('SELECT sum(value)::text AS value,sum(quantity)::text AS quantity FROM inventory_valuations')).rows[0];
});
after(async()=>{if(h){if(process.env.ERP_TEST_DEBUG)console.error(h.logs());await h.close();}});
test('Rechnungspositionen werden mit tatsächlichen Mengen und Bindungsstand angeboten; Kunde/Lager bleiben ohne Finanzvorbereitung',async()=>{
 assert.equal(invoice.openAmount,'357.00');assert.equal(items.length,2);assert.ok(items.every(l=>l.available));assert.equal(items[0].net,'100.00');assert.equal(items[1].net,'200.00');
 for(const actor of[f.customer,f.warehouse])assert.equal((await actor('/api/customer-credits/invoices/'+invoice.id+'/selection')).status,403);
 assert.equal((await f.billing('/api/customer-credits/invoices/'+invoice.id,cmd(body([randomUUID()])))).status,409);
 assert.equal((await f.billing('/api/customer-credits/invoices/'+invoice.id,cmd(body([items[0].id,items[0].id])))).status,409);
 assert.equal(ok(await f.billing('/api/billing/invoices/'+invoice.id),200).openAmount,'357.00');
});
test('Ein wiederholter Prüfstand bindet genau seine Originalposition, ohne Forderung oder Bestand zu buchen',async()=>{
 const key=randomUUID(),responses=await Promise.all([f.billing('/api/customer-credits/invoices/'+invoice.id,cmd(body([items[0].id]),key)),f.billing('/api/customer-credits/invoices/'+invoice.id,cmd(body([items[0].id]),key))]);first=ok(responses[0]);assert.deepEqual(first,ok(responses[1]));
 const d=ok(await f.billing('/api/customer-credits/'+first.id),200);assert.equal(d.correctionMode,'POSITIONS');assert.equal(d.gross,'119.00');assert.deepEqual(d.snapshot.items,[invoice.snapshot.items.find(l=>l.position===items[0].position)]);assert.equal(d.snapshot.taxes[0].basis,'100.00');assert.equal(d.snapshot.deliveryNumbers.length,1);
 assert.equal((await f.billing('/api/customer-credits/invoices/'+invoice.id,cmd(body([items[1].id])))).status,409);const full=body([]);delete full.invoiceItemIds;assert.equal((await f.billing('/api/customer-credits/invoices/'+invoice.id,cmd(full))).status,409);
 assert.equal(ok(await f.billing('/api/billing/invoices/'+invoice.id),200).openAmount,'357.00');assert.deepEqual((await h.admin.query('SELECT sum(value)::text AS value,sum(quantity)::text AS quantity FROM inventory_valuations')).rows[0],stockBefore);
});
test('Auswahl und Korrekturart lassen sich auch mit SQL nicht nachträglich erweitern oder verändern',async()=>{
 await assert.rejects(h.admin.query("UPDATE customer_credit_memos SET correction_mode='FULL' WHERE id=$1",[first.id]),/unveränderlich/);
 await assert.rejects(h.admin.query('UPDATE customer_credit_lines SET invoice_item_id=$2 WHERE credit_id=$1',[first.id,items[1].id]),/unveränderlich/);
 await assert.rejects(h.admin.query('INSERT INTO customer_credit_lines(tenant_id,credit_id,invoice_item_id) SELECT tenant_id,id,$2 FROM customer_credit_memos WHERE id=$1',[first.id,items[1].id]),/Positionsauswahl/);
 assert.equal((await h.admin.query('SELECT count(*)::int AS n FROM customer_credit_lines WHERE credit_id=$1',[first.id])).rows[0].n,1);
});
test('Verworfene ungebuchte Prüfstände erhalten Historie und geben ihre Position wieder frei',async()=>{
 const cancelled=ok(await f.billing('/api/customer-credits/'+first.id+'/cancel',cmd({version:1,reason:'Falscher Korrekturgrund im offenen Prüfstand; Vorgang verwerfen und nachvollziehbar neu anlegen.'})));assert.equal(cancelled.status,'CANCELLED');
 const rows=ok(await f.billing('/api/customer-credits/invoices/'+invoice.id+'/selection'),200).items;assert.ok(rows.every(l=>l.available));assert.equal(ok(await f.billing('/api/customer-credits/'+first.id),200).status,'CANCELLED');
 const competing=await Promise.all([f.billing('/api/customer-credits/invoices/'+invoice.id,cmd(body([items[0].id]))),f.billing('/api/customer-credits/invoices/'+invoice.id,cmd(body([items[0].id])))]);assert.equal(competing.filter(r=>r.status===201).length,1);assert.equal(competing.filter(r=>r.status===409).length,1);first=ok(competing.find(r=>r.status===201));assert.notEqual(first.id,cancelled.id);
});
test('Unabhängige Freigabe bucht nur ausgewählte Originalkonten und belässt die restliche Forderung',async()=>{
 const a=ok(await f.billing('/api/workflow/submit/'+first.id,cmd({version:1})));assert.equal((await f.billing('/api/workflow/instances/'+a.id+'/decide',cmd({version:1,decision:'APPROVE',comment:'Eigene Positionskorrektur darf nicht selbst genehmigt werden.'}))).status,403);
 ok(await f.accountant('/api/workflow/instances/'+a.id+'/decide',cmd({version:1,decision:'APPROVE',comment:'Ausgewählte volle Originalposition, Steueranteil und ursprüngliche Kontierung unabhängig geprüft.'})));
 const d=ok(await f.billing('/api/customer-credits/'+first.id),200),key=randomUUID(),rs=await Promise.all([f.billing('/api/customer-credits/'+first.id+'/post',cmd({version:d.version},key)),f.billing('/api/customer-credits/'+first.id+'/post',cmd({version:d.version},key))]);first=ok(rs[0]);assert.equal(ok(rs[1]).journal.id,first.journal.id);assert.equal(ok(await f.billing('/api/customer-credits/'+first.id),200).outputStatus,'READY');
 const remaining=ok(await f.billing('/api/billing/invoices/'+invoice.id),200);assert.equal(remaining.openAmount,'238.00');assert.equal(remaining.canCreditPositions,true);assert.equal(remaining.canCredit,false);
 const d2=ok(await f.billing('/api/customer-credits/'+first.id),200),actual=(await h.admin.query('SELECT account_id,side,amount::numeric(20,2)::text AS amount,cost_center,partner_id,tax_code,description FROM journal_entries WHERE journal_id=$1 ORDER BY position',[first.journal.id])).rows;
 assert.deepEqual(actual,d2.lines.map(l=>({account_id:l.accountId,side:l.counterSide,amount:l.amount,cost_center:l.costCenter,partner_id:l.partnerId,tax_code:l.taxCode,description:l.description})));assert.equal((await h.admin.query('SELECT reversal_of FROM journals WHERE id=$1',[first.journal.id])).rows[0].reversal_of,null);
 assert.equal((await f.billing('/api/customer-credits/'+first.id+'/cancel',cmd({version:4,reason:'Gebuchte Gutschrift darf niemals als Entwurf gelöscht oder freigegeben werden.'}))).status,409);
 assert.equal((await f.billing('/api/customer-credits/invoices/'+invoice.id,cmd(body([items[0].id])))).status,409);
});
test('Teilkorrektur hat eigenes valides CII381 und PDF; Rechnung und nicht ausgewählte Positionen bleiben unverändert',async()=>{
 const pdf=ok(await f.customer('/api/customer-credits/'+first.id+'/pdf',{binary:true}),200),xml=ok(await f.customer('/api/customer-credits/'+first.id+'/xml',{binary:true}),200).toString();assert.equal((xml.match(/<ram:IncludedSupplyChainTradeLineItem>/g)||[]).length,1);assert.ok(xml.includes('<ram:GrandTotalAmount>119.00</ram:GrandTotalAmount>'));assert.ok(xml.includes(invoice.snapshot.number));assert.match((await h.admin.query('SELECT validation_report FROM customer_credit_outputs WHERE credit_id=$1',[first.id])).rows[0].validation_report,/status="valid"/);
 const text=execFileSync('pdftotext',['-layout','-','-'],{input:pdf,encoding:'utf8'});assert.ok(text.includes('119,00 EUR'));assert.ok(!text.includes('Zahlbar bis'));assert.deepEqual(ok(await f.customer('/api/billing/invoices/'+invoice.id+'/pdf',{binary:true}),200),original);
 await mkdir('test-results/selected-customer-credits',{recursive:true});await writeFile('test-results/selected-customer-credits/partial-credit.pdf',pdf);await writeFile('test-results/selected-customer-credits/partial-credit.xml',xml);
});
test('Bericht korrigiert nur die ausgewählte Position und ihre ursprünglichen Warenkosten; physischer Aufwand bleibt bestehen',async()=>{
 const r=ok(await report(),200);assert.equal(r.summary.invoiceNet,'300.00');assert.equal(r.summary.creditNet,'100.00');assert.equal(r.summary.netRevenue,'200.00');assert.equal(r.summary.billedCost,'80.00');assert.equal(r.summary.stockExpense,'120.00');assert.equal(r.summary.billingMargin,'120.00');assert.equal(r.summary.tax,'38.00');assert.equal(r.rows.filter(l=>l.eventKind==='CREDIT_NOTE').length,1);assert.deepEqual(await f.count(),f.baseline);
 const claim=ok(await f.billing('/api/customer-credits/invoices/'+invoice.id+'/selection'),200).items;assert.equal(claim.filter(l=>l.available).length,1);assert.equal(claim.find(l=>l.id===items[0].id).claim.id,first.id);
});
test('Warenrücknahme bleibt lieferbezogen: korrigierte ganze Lieferung ist frei, andere Lieferung bleibt gesperrt',async()=>{
 assert.equal(ok(await f.warehouse('/api/sales/deliveries/'+deliveries[0].id),200).reversible,true);assert.equal(ok(await f.warehouse('/api/sales/deliveries/'+deliveries[1].id),200).reversible,false);
 assert.equal((await f.warehouse('/api/inventory/issues/'+deliveries[1].id+'/reverse',cmd(reversal()))).status,409);ok(await f.warehouse('/api/inventory/issues/'+deliveries[0].id+'/reverse',cmd(reversal())));
 assert.equal((await f.context()).items[0].deliveredQuantity,'2.000000');const r=ok(await report(),200);assert.equal(r.summary.netRevenue,'200.00');assert.equal(r.summary.stockExpense,'80.00');assert.equal(r.rows.filter(l=>l.eventKind==='STOCK_RETURN').length,1);
});
test('Weitere unabhängig gebuchte Positionsgutschrift ergibt exakt null Rest ohne doppelte Faktura oder Mehrfachausgleich',async()=>{
 second=ok(await f.billing('/api/customer-credits/invoices/'+invoice.id,cmd(body([items[1].id]))));second=await post(second.id);const d=ok(await f.billing('/api/billing/invoices/'+invoice.id),200);assert.equal(d.openAmount,'0.00');assert.equal(d.canCreditPositions,false);assert.equal(d.credits.length,3);assert.equal(d.credits.filter(c=>c.status==='POSTED').length,2);assert.equal((await f.billing('/api/customer-credits/invoices/'+invoice.id,cmd(body([items[1].id])))).status,409);
 const r=ok(await report(),200);assert.equal(r.summary.creditNet,'300.00');assert.equal(r.summary.netRevenue,'0.00');assert.equal(r.rows.filter(l=>l.eventKind==='CREDIT_NOTE').length,2);ok(await f.warehouse('/api/inventory/issues/'+deliveries[1].id+'/reverse',cmd(reversal())));assert.equal((await f.context()).items[0].deliveredQuantity,'0.000000');assert.equal((await f.sources()).sources.length,0);assert.deepEqual(await f.count(),f.baseline);
 const own=ok(await f.customer('/api/billing/invoices/'+invoice.id),200);assert.equal(own.credits.length,2);assert.ok(own.credits.every(c=>!c.reason&&!c.preparedByName));
 await writeFile('test-results/selected-customer-credits/verification.json',JSON.stringify({invoice:invoice.snapshot.number,originalGross:'357.00',firstCreditGross:'119.00',remainingAfterFirst:'238.00',finalOpenAmount:'0.00',originalPdfSha256:createHash('sha256').update(original).digest('hex'),independentCredits:2,cancelledDraftPreserved:true,actualDeliveriesReturnedIndividually:true,originalInvoicePreserved:true,noAdditionalServiceDocuments:true},null,2)+'\n');
});
test('Neue Positionszuordnungen erzwingen Mandantentrennung auch für die Laufzeitrolle',async()=>{
 const db=new pg.Client({connectionString:h.urls.app});await db.connect();try{await db.query('BEGIN');await db.query("SELECT set_config('app.tenant_id',$1,true)",[randomUUID()]);assert.equal((await db.query('SELECT count(*) FROM customer_credit_lines')).rows[0].count,'0');await db.query('ROLLBACK');}finally{await db.end();}
});

test('Nicht aufteilbare Steuerrundungsreste werden vor der Vorbereitung abgewiesen; vollständige Steuergruppe bleibt korrigierbar',async()=>{
 const current=await f.context(),reservation=current.reservations.find(r=>r.status==='ACTIVE');ok(await f.sales('/api/sales/orders/'+f.directOrder.id+'/reservations/'+reservation.id+'/release',cmd({version:current.version,reservationVersion:reservation.version,reason:'Ursprüngliche nach ganzer Warenrücknahme wieder offene Reservierung freigeben.'})));
 ok(await f.admin('/api/pricing/conditions',cmd({organizationId:f.org,code:'PR00',kind:'BASE',sequence:10,priority:900,productId:f.product.id,partnerId:null,contractId:null,customerGroup:null,productGroup:null,taxCode:null,currency:'EUR',validFrom:'2020-01-01',validTo:'2099-12-31',minimumQuantity:'0.000001',value:'0.01'})));
 const order=(await approvedSalesOrder(f,{quantity:'3',createExecution:false,executionMode:'DIRECT_SALES'})).order,base='/api/sales/orders/'+order.id;let c=ok(await f.warehouse(base+'/fulfillment'),200);
 ok(await f.sales(base+'/reservations',cmd({version:c.version,reason:'Drei echte Lagerteile für Steuerrundungsgrenzen der Positionsgutschrift reservieren.',items:[{scheduleId:c.items[0].schedules[0].id,locationId:f.location.id,batch:'',serial:'',quantity:'3'}]})));
 for(let n=0;n<3;n++){c=ok(await f.warehouse(base+'/fulfillment'),200);ok(await f.warehouse(base+'/deliveries',cmd({version:c.version,periodId:f.period.id,postingDate:'2026-10-22',documentDate:'2026-10-22',deliveryDate:'2026-10-22',description:'Ein tatsächlich gezähltes Originalteil für die Rundungsprüfung ausliefern.',items:[{reservationId:c.reservations[0].id,binId:f.buffer.id,quantity:'1'}]})));}
 const sources=ok(await f.billing('/api/billing/orders/'+order.id+'/sources'),200),req=ok(await f.billing('/api/billing/orders/'+order.id+'/requests',cmd({version:sources.version,title:'Drei reale Lieferungen mit gemeinsamen Steuercent',lines:sources.sources.map(l=>({sourceKey:l.sourceKey,quantity:l.remainingQuantity,serviceFrom:l.serviceFrom,serviceTo:l.serviceTo}))})));ok(await f.approve(req.id,1,f.billing,f.accountant));const lines=ok(await f.billing('/api/billing/requests/'+req.id),200).lines;
 const inv=ok(await f.billing('/api/billing/invoices',cmd({orderId:order.id,periodId:f.period.id,invoiceDate:'2026-10-22',postingDate:'2026-10-22',buyerReference:'STEUER-RUNDUNG',lines:lines.map(l=>({requestLineId:l.id,quantity:l.quantity}))}))),options=ok(await f.billing('/api/customer-credits/invoices/'+inv.id+'/selection'),200).items;
 assert.equal(options.length,3);assert.ok(options.every(l=>l.net==='0.01'));
 const last=await f.billing('/api/customer-credits/invoices/'+inv.id,cmd(body([options[2].id])));assert.equal(last.status,409);assert.match(last.data.error.message,/Steuerrundungscent/);
 const firstTwo=await f.billing('/api/customer-credits/invoices/'+inv.id,cmd(body(options.slice(0,2).map(l=>l.id))));assert.equal(firstTwo.status,409);assert.match(firstTwo.data.error.message,/Steuerrundungscent/);
 assert.equal(ok(await f.billing('/api/billing/invoices/'+inv.id),200).openAmount,'0.04');const r=ok(await f.billing('/api/customer-credits/invoices/'+inv.id,cmd(body(options.map(l=>l.id)))));const result=await post(r.id);assert.equal(result.outputStatus,'READY');assert.equal(ok(await f.billing('/api/billing/invoices/'+inv.id),200).openAmount,'0.00');
});
