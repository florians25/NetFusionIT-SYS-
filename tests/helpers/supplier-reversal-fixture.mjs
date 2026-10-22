import {supplierPostingFixture} from './supplier-posting-fixture.mjs';
import {cmd,ok} from './service-fixture.mjs';
export async function supplierReversalFixture(h){
 const f=await supplierPostingFixture(h);ok(await f.prepare(f.invoice));const approved=await f.approve(f.invoice),posted=ok(await f.accountant('/api/incoming-invoices/'+f.invoice.id+'/post',cmd({version:approved.version})));
 ok(await f.admin('/api/workflow/definitions',cmd({organizationId:f.org,name:'Unabhängige Rechnungskorrektur',subjectKind:'SUPPLIER_INVOICE_REVERSAL',fourEyes:true,steps:[{name:'Gegenbuchung unabhängig prüfen',roles:['ADMIN','ACCOUNTANT']}]})));
 const reverseBody=version=>({version,periodId:f.period.id,postingDate:'2026-10-22',documentDate:'2026-10-22',reason:'Interne Fehlzuordnung vollständig aufheben; Lieferantenoriginal und Historie erhalten.'});
 async function createReversal(invoice=f.invoice){const financial=ok(await f.accountant('/api/incoming-invoices/'+invoice.id+'/financial'),200);return f.accountant('/api/incoming-invoices/'+invoice.id+'/reversal',cmd(reverseBody(financial.version)));}
 async function approveReversal(rev){const d=ok(await f.accountant('/api/supplier-invoice-reversals/'+rev.id),200),a=ok(await f.accountant('/api/workflow/submit/'+rev.id,cmd({version:d.version})));ok(await f.admin('/api/workflow/instances/'+a.id+'/decide',cmd({version:1,decision:'APPROVE',comment:'Ursprungsrechnung, Gegenkontierung, Grund und unbezahlten offenen Posten unabhängig geprüft.'})));return ok(await f.accountant('/api/supplier-invoice-reversals/'+rev.id),200);}
 return {...f,posted,reverseBody,createReversal,approveReversal};
}
