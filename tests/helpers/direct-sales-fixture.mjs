import{randomUUID}from'node:crypto';
import{client}from'../../scripts/test-harness.mjs';
import{warehouseFixture}from'./warehouse-fixture.mjs';
import{configureSales,approvedSalesOrder}from'./sales-fixture.mjs';
import{cmd,ok}from'./service-fixture.mjs';
export async function directSalesFixture(h,warehouseOptions={}){
 const f=await configureSales(h,await warehouseFixture(h,{companyVatId:'DE123456789',...warehouseOptions})),staff={};
 for(const role of ['BILLING','ACCOUNTANT']){const u={name:'Direktvertriebsfaktura '+role,email:role.toLowerCase()+'@example.test',password:randomUUID(),role,organizationId:f.org};ok(await f.admin('/api/admin/users',{method:'POST',body:u}));h.accounts.push({tenant:'netfusion',...u});staff[role]=await client(h.base,{tenant:'netfusion',...u});}
 const billing=staff.BILLING,accountant=staff.ACCOUNTANT,accounts={};for(const[kind,code,name]of[['RECEIVABLE','1400','Forderungen aus Warenverkauf'],['REVENUE','8400','Warenerlöse'],['TAX','1776','Umsatzsteuer']])accounts[kind]=ok(await f.admin('/api/finance/companies/'+f.company.id+'/accounts',cmd({kind,code,name})));
 ok(await f.admin('/api/finance/companies/'+f.company.id+'/rules',cmd({event:'SALES_INVOICE',version:0,accounts:{receivable:accounts.RECEIVABLE.id,revenue:accounts.REVENUE.id,tax:accounts.TAX.id}})));
 for(const subjectKind of ['BILLING_REQUEST','PARTNER_ACCOUNT','COMPANY_BILLING_PROFILE'])ok(await f.admin('/api/workflow/definitions',cmd({organizationId:f.org,name:'Unabhängige Prüfung '+subjectKind,subjectKind,fourEyes:true,steps:[{name:'Finanzprüfung',roles:['ACCOUNTANT']}]})));
 const ledger=ok(await f.admin('/api/partners/'+f.partnerId+'/accounts',cmd({companyId:f.company.id,kind:'DEBTOR',accountNumber:'D10000000',reconciliationAccountId:accounts.RECEIVABLE.id,paymentTermsDays:30,dunningProcedure:'STANDARD',creditLimit:'10000',invoiceBlock:false,paymentBlock:false})));ok(await f.approve(ledger.id,1,f.admin,accountant));
 const profile=ok(await f.admin('/api/billing/profiles',cmd({companyId:f.company.id,iban:'DE89370400440532013000',bic:'COBADEFFXXX',email:'rechnung@example.test',phone:'+4930123456'})));ok(await f.approve(profile.id,1,f.admin,accountant));
 const held=(await h.admin.query("SELECT id,version FROM stock_reservations WHERE status='ACTIVE'")).rows;for(const r of held)ok(await f.tech('/api/service/orders/'+f.order.id+'/reservations/'+r.id+'/release',cmd({version:r.version,reason:'Echten vorhandenen Lagerbestand für unabhängige neue Warenaufträge freigeben.'})));
 const count=async()=>(await h.admin.query('SELECT (SELECT count(*)::int FROM service_orders) AS orders,(SELECT count(*)::int FROM tickets) AS tickets,(SELECT count(*)::int FROM work_order_tasks) AS tasks,(SELECT count(*)::int FROM service_reports) AS reports')).rows[0];const baseline=await count();
 const order=(await approvedSalesOrder(f,{quantity:'5',createExecution:false,executionMode:'DIRECT_SALES',itemDescription:'Netzwerk-Ersatzteile gemäß Kundenbestellung'})).order;
 async function context(){return ok(await f.warehouse('/api/sales/orders/'+order.id+'/fulfillment'),200);}
 let c=await context();ok(await f.sales('/api/sales/orders/'+order.id+'/reservations',cmd({version:c.version,reason:'Fünf echte Lagerteile für bestätigten Warenauftrag reservieren.',items:[{scheduleId:c.items[0].schedules[0].id,locationId:f.location.id,batch:'',serial:'',quantity:'5'}]})));
 async function deliver(quantity,day='2026-10-22'){const c=await context();return ok(await f.warehouse('/api/sales/orders/'+order.id+'/deliveries',cmd({version:c.version,periodId:f.period.id,postingDate:day,documentDate:day,deliveryDate:day,description:'Tatsächlich gezählte Waren direkt an die vereinbarte Kundenanschrift liefern.',items:[{reservationId:c.reservations[0].id,binId:f.buffer.id,quantity}]})));}
 async function sources(){return ok(await billing('/api/billing/orders/'+order.id+'/sources'),200);}
 async function request(quantity,sourceIndex=0){const s=await sources(),l=s.sources[sourceIndex];return billing('/api/billing/orders/'+order.id+'/requests',cmd({version:s.version,title:'Tatsächlich gelieferte Waren zur unabhängigen Fakturaprüfung',lines:[{sourceKey:l.sourceKey,quantity,serviceFrom:l.serviceFrom,serviceTo:l.serviceTo}]}));}
 return {...f,billing,accountant,accounts,ledger,profile,directOrder:order,context,deliver,sources,request,count,baseline};
}
