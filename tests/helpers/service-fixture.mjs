import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {client} from '../../scripts/test-harness.mjs';
export const cmd=(body,key=randomUUID())=>({method:'POST',body,headers:{'Idempotency-Key':key}});
export function ok(r,status=201){assert.equal(r.status,status,JSON.stringify(r.data));return r.data;}
export async function serviceFixture(h){
 const account=role=>h.accounts.find(a=>a.role===role),admin=await client(h.base,account('ADMIN')),support=await client(h.base,account('SUPPORT')),customer=await client(h.base,account('CUSTOMER')),tech=await client(h.base,account('TECHNICIAN')),org=(await admin('/api/organization')).data[0].id;
 for(const kind of ['MATERIAL','SERVICE_ORDER','SERVICE_REPORT'])ok(await admin('/api/workflow/definitions',cmd({name:kind+' Prüfung',organizationId:org,subjectKind:kind,fourEyes:true,steps:[{name:'Fachprüfung',roles:[kind==='SERVICE_REPORT'?'ADMIN':'SUPPORT']}]})));
 async function approve(id,version,author=admin,approver=support){const s=ok(await author('/api/workflow/submit/'+id,cmd({version})));return approver('/api/workflow/instances/'+s.id+'/decide',cmd({version:1,decision:'APPROVE',comment:'Fachlich geprüft und bestätigt.'}));}
 ok(await admin('/api/catalog/currencies',cmd({code:'EUR',digits:2})));
 const product=ok(await admin('/api/catalog/products',cmd({organizationId:org,sku:'SERVICE-HUR',name:'Netzwerkservice',kind:'SERVICE',unit:'HUR',taxCode:'STANDARD',productGroup:'IT',description:'Serviceleistung nach tatsächlichen Stunden.'})));ok(await approve(product.id,1));
 const base={organizationId:org,code:'PR00',kind:'BASE',sequence:10,priority:0,productId:product.id,partnerId:null,contractId:null,customerGroup:null,productGroup:null,taxCode:null,currency:'EUR',validFrom:'2020-01-01',validTo:'2099-12-31',minimumQuantity:'0.000001',value:'100'};
 ok(await admin('/api/pricing/conditions',cmd(base)));ok(await admin('/api/pricing/conditions',cmd({...base,code:'MWST',kind:'TAX',sequence:100,productId:null,taxCode:'STANDARD',value:'19'})));
 const ticket=ok(await customer('/api/tickets',cmd({title:'Netzwerkservice mit Leistungsnachweis',description:'Diagnose, Konfiguration und dokumentierte Funktionsprüfung am Standort Berlin.',type:'INCIDENT',priority:'MEDIUM'})));
 const technician=(await admin('/api/technicians')).data[0];ok(await admin('/api/tickets/'+ticket.id+'/assign',cmd({technicianId:technician.id,version:1})));
 async function makeOrder(kind='PAID',billingRule='TIME_MATERIAL',extras=[]){
  const o=ok(await admin('/api/service/orders',cmd({caseId:ticket.caseId,sourceTicketId:null,contractId:null,title:'Netzwerkservice Berlin',kind,currency:'EUR',pricingDate:'2026-10-22'})));
  const item=ok(await admin('/api/service/orders/'+o.id+'/items',cmd({version:1,productId:product.id,description:'Netzwerkdiagnose und sichere Konfiguration',quantity:'2',billingRule,costCenter:'SERVICE-BERLIN',costObject:ticket.caseNumber})));
  let version=2;const extraItems=[];for(const e of extras){const r=ok(await admin('/api/service/orders/'+o.id+'/items',cmd({version,productId:e.productId,description:e.description||'Weitere Serviceleistung',quantity:e.quantity||'1',requiredOn:e.requiredOn||'2026-10-30',billingRule:e.billingRule||'TIME_MATERIAL',costCenter:'SERVICE-BERLIN',costObject:ticket.caseNumber})));version=r.version;extraItems.push(r);}ok(await approve(o.id,version));return {...o,item,extraItems};
 }
 return {admin,support,customer,tech,org,product,ticket,makeOrder,approve};
}
