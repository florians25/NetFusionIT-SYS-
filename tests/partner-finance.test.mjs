import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {harness} from '../scripts/test-harness.mjs';
import {billingFixture} from './helpers/billing-fixture.mjs';
import {cmd,ok} from './helpers/service-fixture.mjs';
let h,f;
before(async()=>{h=await harness(3132);f=await billingFixture(h);});after(async()=>{if(h)await h.close();});
test('Debitoren-/Kreditorenrolle benötigt freigegebenen Geschäftspartner, passende GP-Rolle und richtiges Abstimmkonto',async()=>{
 const account={companyId:f.company.id,kind:'CREDITOR',accountNumber:'K20000000',reconciliationAccountId:f.accounts.PAYABLE.id,paymentTermsDays:14,dunningProcedure:'',creditLimit:'0.00',invoiceBlock:false,paymentBlock:false};assert.equal((await f.admin('/api/partners/'+f.partnerId+'/accounts',cmd(account))).status,409);assert.equal((await f.billing('/api/partners/'+f.partnerId+'/accounts',cmd({...account,kind:'DEBTOR',reconciliationAccountId:f.accounts.RECEIVABLE.id}))).status,403);
 const context=ok(await f.accountant('/api/partners/'+f.partnerId+'/accounts'),200);assert.equal(context.length,1);assert.equal(context[0].status,'ACTIVE');assert.equal(context[0].kind,'DEBTOR');await assert.rejects(h.admin.query('UPDATE partner_company_accounts SET reconciliation_account_id=$2 WHERE id=$1',[f.ledger.id,f.accounts.PAYABLE.id]),/unveränderlich/);
 assert.equal((await f.admin('/api/billing/profiles',cmd({companyId:f.company.id,iban:'DE00370400440532013000',bic:'COBADEFFXXX',email:'finanz@example.test',phone:'+4930123456'}))).status,400);await assert.rejects(h.admin.query("UPDATE company_billing_profiles SET iban='DE00370400440532013000' WHERE id=$1",[f.profile.id]),/unveränderlich/);
});
test('Ansprechpartner hat AP-Nummer, mehrere Funktionen, Gültigkeit und Versionsschutz ohne alte Kontakte zu löschen',async()=>{
 const data={name:'Erika Kontakt',email:'erika@example.test',phone:'+49305555',mobile:'',position:'Leitung Service',department:'IT',functions:['TECHNICAL','BILLING'],active:true,validFrom:'2026-01-01',validTo:null},c=ok(await f.admin('/api/partners/'+f.partnerId+'/contacts',cmd({data})));assert.match(c.number,/^AP-12\d{6}$/);const path='/api/partners/'+f.partnerId+'/contacts/'+c.id,changes={data:{...data,functions:['APPROVAL','BILLING'],active:false},version:1};ok(await f.admin(path,{...cmd(changes),method:'PATCH'}),200);assert.equal((await f.admin(path,{...cmd(changes),method:'PATCH'})).status,409);assert.equal((await f.tech(path,{...cmd({...changes,version:2}),method:'PATCH'})).status,403);
 const p=ok(await f.admin('/api/partners/'+f.partnerId),200),contact=p.contacts.find(a=>a.id===c.id);assert.equal(contact.active,false);assert.equal(contact.version,2);assert.deepEqual(contact.functions,['APPROVAL','BILLING']);assert.equal((await f.admin('/api/partners/'+f.partnerId+'/contacts',cmd({data:{...data,validFrom:'2027-01-01',validTo:'2026-01-01'}}))).status,400);
});
test('Nur eine Standardadresse je Adressart bleibt aktiv; historische Rechnungsanschriften werden nicht umgeschrieben',async()=>{
 const a=ok(await f.admin('/api/partners/'+f.partnerId+'/addresses',cmd({kind:'BILLING',street:'Neue Straße 3',postalCode:'10115',city:'Berlin',country:'DE',isDefault:true})));const p=ok(await f.admin('/api/partners/'+f.partnerId),200);assert.equal(p.addresses.filter(a=>a.kind==='BILLING'&&a.isDefault).length,1);assert.equal(p.addresses.find(row=>row.id===a.id).isDefault,true);assert.ok(p.addresses.some(a=>a.street==='Kundenstraße 2'&&!a.isDefault));assert.equal((await f.customer('/api/partners/'+f.partnerId+'/addresses',cmd({kind:'BILLING',street:'Falsch',postalCode:'10115',city:'Berlin',country:'DE',isDefault:true}))).status,403);
});
