import {cmd,ok} from './service-fixture.mjs';
export async function configurePurchasing(f){
 const create=async(kind,body)=>ok(await f.admin('/api/procurement/configuration/'+kind,cmd({organizationId:f.org,...body})));
 const purchasing=await create('organizations',{companyId:f.company.id,code:'EK10',name:'Zentrale Beschaffung'}),group=await create('groups',{code:'IT01',name:'IT-Systemtechnik'}),assignment=await create('assignments',{purchasingOrganizationId:purchasing.id,buyerGroupId:group.id}),plantAssignment=await create('plants',{purchasingOrganizationId:purchasing.id,plantId:f.plant.id});
 const data=ok(await f.admin('/api/procurement/configuration'),200),members=[];for(const u of data.users)members.push({...await create('members',{buyerGroupId:group.id,userId:u.id}),role:u.role,userId:u.id});
 return {purchasing,group,assignment,plantAssignment,members,create};
}
export async function servicePurchaseRequest(f,quantity='3'){
 const order=await f.makeOrder('PAID','TIME_MATERIAL',[{productId:f.product.id,quantity,description:'Ersatzteile mit verbindlichem Einkauf und Empfangswerk'}]),c=ok(await f.tech('/api/service/orders/'+order.id+'/procurement'),200),need=ok(await f.tech('/api/procurement/documents/'+c.requirements[0].id),200),r=ok(await f.tech('/api/service/orders/'+order.id+'/requisitions',cmd({title:'Verbindliche Beschaffung am Standort Berlin',items:[{requirementItemId:need.items[0].id,quantity,estimatedUnitPrice:'40'}]}))),a=ok(await f.tech('/api/workflow/submit/'+r.id,cmd({version:1})));ok(await f.manager('/api/workflow/instances/'+a.id+'/decide',cmd({version:1,decision:'APPROVE',comment:'Tatsächlicher eigener Auftragsbedarf unabhängig geprüft.'})));return {order,request:ok(await f.buyer('/api/procurement/documents/'+r.id),200)};
}
