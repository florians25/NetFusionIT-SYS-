import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {client} from '../../scripts/test-harness.mjs';
import {inventoryFixture} from './inventory-fixture.mjs';
import {cmd,ok} from './service-fixture.mjs';
const base=id=>'/api/incoming-invoices/'+id;
const {renderInvoiceXml}=createRequire(import.meta.url)('../../dist/einvoice.js');
export async function incomingMatchingFixture(h){
const f=await inventoryFixture(h);ok(await f.configure());ok(await f.rules());const receipt=ok(await f.warehouse('/api/procurement/documents/'+f.pos[0].id+'/receipts',cmd(await f.body(f.pos[0],'2'))));
 const company=ok(await f.admin('/api/finance/companies'),200).find(c=>c.id===f.company.id),data={number:'LF-ORIGINAL-001',date:'2026-10-22',dueDate:'2026-11-21',currency:'EUR',buyerReference:'Eingangsprüfung',orderNumber:f.pos[0].number,seller:{...f.pos[0].supplier,vatId:'DE123456789',iban:'DE89370400440532013000',bic:'COBADEFFXXX'},buyer:{...company,number:'KD-10000000'},items:[10,20].map(position=>({position,sku:f.product.number,description:'Netzwerk-Ersatzteil',quantity:'2',unit:'EA',unitNet:'40.00',net:'80.00',taxRate:'19',serviceFrom:'2026-10-22',serviceTo:'2026-10-22'})),taxes:[{rate:'19',basis:'160.00',amount:'30.40'}],net:'160.00',tax:'30.40',gross:'190.40'};
 const invoiceData=data;const content=Buffer.from(renderInvoiceXml(data));const invoice=ok(await f.buyer('/api/incoming-invoices/receive?companyId='+f.company.id+'&filename=Rechnung.xml',{method:'POST',body:content,headers:{'Content-Type':'application/xml','Idempotency-Key':randomUUID()}}));assert.equal(ok(await f.buyer(base(invoice.id)+'/process',cmd({}))).state,'VALIDATED');const items=ok(await f.buyer(base(invoice.id)),200).items;
 const user={name:'Sofia Richter',email:'ap-accountant@example.test',password:randomUUID(),role:'ACCOUNTANT',organizationId:f.org};ok(await f.admin('/api/admin/users',{method:'POST',body:user}));h.accounts.push({tenant:'netfusion',...user});const accountant=await client(h.base,{tenant:'netfusion',...user});
 async function activateCreditor(){const payable=ok(await f.admin('/api/finance/companies/'+f.company.id+'/accounts',cmd({code:'1600',name:'Lieferantenverbindlichkeiten',kind:'PAYABLE'})));ok(await f.admin('/api/workflow/definitions',cmd({organizationId:f.org,name:'Unabhängige Kreditorenrolle',subjectKind:'PARTNER_ACCOUNT',fourEyes:true,steps:[{name:'Buchhalterische Prüfung',roles:['ACCOUNTANT']}]})));const ledger=ok(await f.admin('/api/partners/'+f.supplier.id+'/accounts',cmd({companyId:f.company.id,kind:'CREDITOR',accountNumber:'K20000000',reconciliationAccountId:payable.id,paymentTermsDays:30,dunningProcedure:'',creditLimit:'0',invoiceBlock:false,paymentBlock:false})));ok(await f.approve(ledger.id,1,f.admin,accountant));return ledger;}
 return {...f,invoice,items,receipt,accountant,invoiceData,activateCreditor};
}
