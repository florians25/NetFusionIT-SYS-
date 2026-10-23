import {directProcurementFixture} from './direct-procurement-fixture.mjs';
import {cmd,ok} from './service-fixture.mjs';
export async function directReceiptsFixture(h){
 const f=await directProcurementFixture(h),planned=ok(await f.plan(await f.context())),request=planned.requisition;
 const pending=ok(await f.manager('/api/workflow/inbox'),200).find(i=>i.documentId===request.id);
 ok(await f.manager('/api/workflow/instances/'+pending.id+'/decide',cmd({version:pending.version,decision:'APPROVE',comment:'Tatsächlichen AU-Bedarf5, freien Bestand2 und Fehlmenge3 unabhängig prüfen.'})));
 const requisition=ok(await f.buyer('/api/procurement/documents/'+request.id),200);
 const po=ok(await f.buyer('/api/sales/orders/'+f.directOrder.id+'/purchase-orders',cmd({requisitionId:request.id,supplierId:f.supplier.id,title:'Ersatzteile zum tatsächlichen Kundenauftrag',items:[{requisitionItemId:requisition.items[0].id,quantity:'3',unitPrice:'40',deliveryDate:'2026-10-23',overdeliveryPercent:'0'}]})));
 ok(await f.approveProcurement(f.buyer,po.id));
 const purchase=()=>f.buyer('/api/procurement/documents/'+po.id),receiving=async()=>ok(await f.warehouse('/api/procurement/documents/'+po.id+'/receiving-context'),200);
 async function receiptBody(quantity){const c=await receiving();return {version:c.version,periodId:f.period.id,postingDate:'2026-10-23',documentDate:'2026-10-23',deliveryNote:'LF-AU-TEILLIEFERUNG-'+quantity,items:[{purchaseOrderItemId:c.items[0].id,locationId:f.location.id,quantity,batch:'',serial:''}]};}
 const receive=async(quantity,key)=>f.warehouse('/api/procurement/documents/'+po.id+'/receipts',cmd(await receiptBody(quantity),key));
 const reverse=id=>f.warehouse('/api/inventory/receipts/'+id+'/reverse',cmd({periodId:f.period.id,postingDate:'2026-10-23',documentDate:'2026-10-23',reason:'Tatsächliche falsche Teillieferung mit vollständiger Originalgegenbewegung zurücknehmen.'}));
 const fulfillment=async()=>ok(await f.warehouse('/api/sales/orders/'+f.directOrder.id+'/fulfillment'),200);
 return {...f,po,request,purchase,receiving,receiptBody,receive,reverseReceipt:reverse,fulfillment};
}
