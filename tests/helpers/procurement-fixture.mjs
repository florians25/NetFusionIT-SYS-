import {randomUUID} from 'node:crypto';
import {client} from '../../scripts/test-harness.mjs';
import {cmd,ok,serviceFixture} from './service-fixture.mjs';
export async function procurementFixture(h,{companyVatId=''}={}){
 const f=await serviceFixture(h);let buyer,manager;
 for(const role of ['BUYER','PURCHASING_MANAGER']){const u={name:role==='BUYER'?'Einkauf Prüfung':'Einkaufsleitung Prüfung',email:role.toLowerCase()+'@example.test',password:randomUUID(),role,organizationId:f.org};ok(await f.admin('/api/admin/users',{method:'POST',body:u}));h.accounts.push({tenant:'netfusion',...u});const api=await client(h.base,{tenant:'netfusion',...u});if(role==='BUYER')buyer=api;else manager=api;}
 for(const subjectKind of ['REQUISITION','PURCHASE_ORDER'])ok(await f.admin('/api/workflow/definitions',cmd({name:'Freigabe '+subjectKind,organizationId:f.org,subjectKind,fourEyes:true,steps:[{name:'Einkaufsleitung',roles:['PURCHASING_MANAGER']}]})));
 ok(await f.admin('/api/workflow/definitions',cmd({name:'Geschäftspartnerfreigabe',organizationId:f.org,subjectKind:'BUSINESS_PARTNER',fourEyes:true,steps:[{name:'Stammdatenprüfung',roles:['SUPPORT']}]})));
 const company=ok(await f.admin('/api/finance/companies',cmd({organizationId:f.org,code:'1000',name:'NetFusion Testgesellschaft',currency:'EUR',country:'DE',street:'Teststraße 1',postalCode:'10115',city:'Berlin',vatId:companyVatId})));
 const product=ok(await f.admin('/api/catalog/products',cmd({organizationId:f.org,sku:'SPARE-10',name:'Netzwerk-Ersatzteil',kind:'STOCK',unit:'EA',taxCode:'STANDARD',productGroup:'IT',description:'Ersatzteil zur Reparatur.'})));ok(await f.approve(product.id,1));ok(await f.admin('/api/pricing/conditions',cmd({organizationId:f.org,code:'PR00',kind:'BASE',sequence:10,priority:0,productId:product.id,partnerId:null,contractId:null,customerGroup:null,productGroup:null,taxCode:null,currency:'EUR',validFrom:'2020-01-01',validTo:'2099-12-31',minimumQuantity:'0.000001',value:'100'})));
 const order=await f.makeOrder('PAID','TIME_MATERIAL',[{productId:product.id,quantity:'10',description:'Ersatzteile für die Netzwerkreparatur'}]);return {...f,buyer,manager,company,product,order};
}
