import {configureDocumentContact} from './document-contact-fixture.mjs';
import {client} from '../../scripts/test-harness.mjs';
import {randomUUID} from 'node:crypto';
import {serviceFixture,cmd,ok} from './service-fixture.mjs';
export async function billingFixture(h){
 const f=await serviceFixture(h),staff={};
 for(const role of ['ACCOUNTANT','BILLING']){const user={name:'Fakturaprüfung '+role,email:role.toLowerCase()+'@example.test',password:randomUUID(),role,organizationId:f.org};ok(await f.admin('/api/admin/users',{method:'POST',body:user}));staff[role]=await client(h.base,{tenant:'netfusion',...user});}
 const accountant=staff.ACCOUNTANT,billing=staff.BILLING;
 const company=ok(await f.admin('/api/finance/companies',cmd({organizationId:f.org,code:'1000',name:'NetFusion Testgesellschaft GmbH',currency:'EUR',country:'DE',street:'Teststraße 1',postalCode:'10115',city:'Berlin',vatId:'DE123456789'})));
 await configureDocumentContact(f.admin,company.id);
 const period=ok(await f.admin('/api/finance/companies/'+company.id+'/periods',cmd({year:2026,period:10,dateFrom:'2026-10-01',dateTo:'2026-10-31'}))),accounts={};
 for(const [kind,code,name] of [['RECEIVABLE','1400','Forderungen'],['PAYABLE','1600','Verbindlichkeiten'],['REVENUE','8400','Serviceerlöse'],['TAX','1776','Umsatzsteuer']])accounts[kind]=ok(await f.admin('/api/finance/companies/'+company.id+'/accounts',cmd({kind,code,name})));
 ok(await f.admin('/api/finance/companies/'+company.id+'/rules',cmd({event:'SALES_INVOICE',version:0,accounts:{receivable:accounts.RECEIVABLE.id,revenue:accounts.REVENUE.id,tax:accounts.TAX.id}})));
 for(const kind of ['BILLING_REQUEST','PARTNER_ACCOUNT','COMPANY_BILLING_PROFILE'])ok(await f.admin('/api/workflow/definitions',cmd({organizationId:f.org,name:kind+' unabhängige Prüfung',subjectKind:kind,fourEyes:true,steps:[{name:'Kaufmännische Prüfung',roles:['ACCOUNTANT']}]})));
 const partnerId=ok(await f.customer('/api/auth/session'),200).user.partnerId;
 ok(await f.admin('/api/partners/'+partnerId+'/addresses',cmd({kind:'BILLING',street:'Kundenstraße 2',postalCode:'20095',city:'Hamburg',country:'DE',isDefault:true})));
 const ledger=ok(await f.admin('/api/partners/'+partnerId+'/accounts',cmd({companyId:company.id,kind:'DEBTOR',accountNumber:'D10000000',reconciliationAccountId:accounts.RECEIVABLE.id,paymentTermsDays:30,dunningProcedure:'STANDARD',creditLimit:'10000.00',invoiceBlock:false,paymentBlock:false})));ok(await f.approve(ledger.id,1,f.admin,accountant));
 const profile=ok(await f.admin('/api/billing/profiles',cmd({companyId:company.id,iban:'DE89370400440532013000',bic:'COBADEFFXXX',email:'rechnung@example.test',phone:'+4930123456'})));ok(await f.approve(profile.id,1,f.admin,accountant));
 async function readyOrder(rule='TIME_MATERIAL'){
  const order=await f.makeOrder('PAID',rule),task=ok(await f.tech('/api/tickets/'+f.ticket.id+'/tasks',cmd({title:'Netzwerkservice abschließen',description:'Freigegebene tatsächliche Leistung für Faktura.',orderId:order.id})));
  const startedAt='2020-02-'+String((await f.tech('/api/tickets/'+f.ticket.id+'/execution')).data.tasks.length).padStart(2,'0')+'T08:00:00Z';const endedAt=startedAt.replace('08:00:00','10:00:00');
  const time=ok(await f.tech('/api/tickets/'+f.ticket.id+'/times',cmd({taskId:task.id,category:'WORK',visitId:null,billable:true,description:'Netzwerk geprüft und dokumentiert.',startedAt,endedAt,pauseSeconds:0})));ok(await f.tech('/api/tickets/'+f.ticket.id+'/times/'+time.id+'/allocate',cmd({version:1,orderId:order.id,itemId:order.item.id})));
  const w=ok(await f.tech('/api/tickets/'+f.ticket.id+'/execution'),200).tasks.find(t=>t.id===task.id);const report=ok(await f.tech('/api/tickets/'+f.ticket.id+'/tasks/'+task.id+'/complete',cmd({version:w.version,diagnosis:'Konfigurationsfehler festgestellt.',workDone:'Konfiguration korrigiert und geprüft.',outcome:'Leistung erfolgreich erbracht.',isFinal:true}))).srm;ok(await f.tech('/api/workflow/submit/'+report.id,cmd({version:1})));const customerReport=ok(await f.customer('/api/service/reports/'+report.id),200);ok(await f.customer('/api/service/reports/'+report.id+'/confirm',cmd({version:customerReport.version,comment:'Leistung und Ergebnis bestätigt.'})));const pending=ok(await f.admin('/api/workflow/inbox'),200).find(a=>a.documentId===report.id);ok(await f.admin('/api/workflow/instances/'+pending.id+'/decide',cmd({version:1,decision:'APPROVE',comment:'Istleistung und Kundenbestätigung geprüft.'})));
  let execution=ok(await f.admin('/api/service/orders/'+order.id+'/execution'),200);ok(await f.admin('/api/service/orders/'+order.id+'/complete',cmd({version:execution.version})));execution=ok(await f.admin('/api/service/orders/'+order.id+'/execution'),200);ok(await f.admin('/api/service/orders/'+order.id+'/billing-ready',cmd({version:execution.version})));
  return {order:ok(await f.admin('/api/service/orders/'+order.id),200),task,time,report};
 }
 return {...f,accountant,billing,company,period,accounts,partnerId,ledger,profile,readyOrder};
}
