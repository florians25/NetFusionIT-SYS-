import {Injectable,ConflictException,NotFoundException} from '@nestjs/common';
import {randomUUID} from 'node:crypto';
import Decimal from 'decimal.js';
import {z} from 'zod';
import {Db,Principal,parse,uuid,audit,idempotent} from './core';
import {version} from './business';
import {requirePermission} from './permissions';
import {scopedOrder} from './work';
import {companyWithin} from './finance';
import {procurementOrder,createRequisitionWithin} from './procurement';
import {Workflow} from './workflow';
import {ensureOrderRequirements,freeStock,materialState,refreshMaterialStatus} from './material-state';
const D=Decimal.clone({precision:60,rounding:Decimal.ROUND_HALF_UP});
@Injectable()
export class MaterialPlanning{
 constructor(private db:Db,private workflow:Workflow){}
 async overview(u:Principal,id:string){requirePermission(u.role,'requisition.read');parse(uuid,id);return this.db.as(u,async db=>{await scopedOrder(db,u,id);const state=await materialState(db,u,id),reservations=(await db.query('SELECT r.id,r.requirement_item_id AS "requirementItemId",p.sku,p.name,p.unit,r.quantity::text,r.source,r.status,r.batch,r.serial,l.code AS "locationCode",pl.code AS "plantCode",r.reason,r.version FROM stock_reservations r JOIN products p ON p.tenant_id=r.tenant_id AND p.id=r.product_id JOIN storage_locations l ON l.tenant_id=r.tenant_id AND l.id=r.location_id JOIN plants pl ON pl.tenant_id=l.tenant_id AND pl.id=l.plant_id WHERE r.tenant_id=$1 AND r.order_id=$2 ORDER BY r.created_at DESC',[u.tenantId,id])).rows;return {...state,reservations};});}
 async plan(u:Principal,id:string,raw:unknown,key:unknown,corr:string){
  requirePermission(u.role,'inventory.reserve');parse(uuid,id);const i=parse(z.object({version:z.number().int().positive(),action:z.enum(['USE_STOCK','REQUEST_PARTS']),items:z.array(z.object({itemId:uuid,requiredOn:z.iso.date().nullable(),locationId:uuid.nullable()}).strict()).min(1).max(100).refine(a=>new Set(a.map(r=>r.itemId)).size===a.length)}).strict(),raw);
  if(i.action==='REQUEST_PARTS')requirePermission(u.role,'requisition.write');
  return this.db.as(u,db=>idempotent(db,u,'ORDER_MATERIAL_PLAN:'+id,key,i,async()=>{
   const o=await procurementOrder(db,u,id);version(o.version,i.version);await ensureOrderRequirements(db,u,id,corr);let state=await materialState(db,u,id);if(!state.companyId)throw new ConflictException('Buchungskreis und Hauswährung für die Serviceorganisation konfigurieren.');const company=await companyWithin(db,u,state.companyId,true),reserved=[];
   for(const selection of i.items){const item=state.items.find(r=>r.id===selection.itemId);if(!item)throw new NotFoundException('Materialposition dieses Serviceauftrags fehlt.');
    const requiredOn=selection.requiredOn||item.requiredOn;
    if(selection.requiredOn&&item.requiredOn&&selection.requiredOn!==item.requiredOn&&new D(item.requestedQuantity).gt(0))throw new ConflictException('Termin bereits angefordert; bestehende Beschaffung gesondert ändern.');
    if(requiredOn){for(const need of item.needs)if(need.neededOn&&need.neededOn!==requiredOn&&(await db.query('SELECT 1 FROM purchase_requisition_items WHERE tenant_id=$1 AND requirement_item_id=$2',[u.tenantId,need.id])).rowCount)throw new ConflictException('Bedarfstermin besitzt bereits Beschaffungsbelege; Änderung gesondert abstimmen.');await db.query('UPDATE service_order_items SET required_on=$3 WHERE tenant_id=$1 AND id=$2',[u.tenantId,item.id,requiredOn]);for(const need of item.needs)if(need.neededOn!==requiredOn)await db.query('UPDATE order_requirement_items SET needed_on=$3 WHERE tenant_id=$1 AND id=$2',[u.tenantId,need.id,requiredOn]);}
    if(selection.locationId&&!(await db.query('SELECT 1 FROM storage_locations l JOIN plants p ON p.tenant_id=l.tenant_id AND p.id=l.plant_id WHERE l.tenant_id=$1 AND l.id=$2 AND p.company_id=$3',[u.tenantId,selection.locationId,company.id])).rowCount)throw new ConflictException('Lagerort dieses Buchungskreises fehlt.');if(item.kind!=='STOCK')continue;
    for(const need of item.needs){
     const received=item.purchaseOrders.filter(r=>r.requirementItemId===need.id).reduce((v,r)=>v.plus(r.received),new D(0));
     const incomingMissing=D.max(0,D.min(new D(need.quantity).minus(need.stockReserved),received).minus(need.procurementReserved)),uncovered=D.max(0,new D(need.quantity).minus(need.stockReserved).minus(need.procurementReserved).minus(D.max(0,new D(need.requested).minus(received))));const amounts=[{source:'PROCUREMENT',quantity:D.min(incomingMissing,uncovered)},{source:'STOCK',quantity:D.max(0,uncovered.minus(incomingMissing))}];
     for(const demand of amounts){let remaining=demand.quantity;if(remaining.lte(0))continue;for(const stock of await freeStock(db,u,company.id,item.productId,selection.locationId)){
       const amount=D.min(remaining,D.max(0,new D(stock.available)));if(amount.lte(0))continue;
       const reservationId=randomUUID();await db.query('INSERT INTO stock_reservations(id,tenant_id,order_id,requirement_item_id,company_id,product_id,location_id,batch,serial,quantity,source,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',[reservationId,u.tenantId,id,need.id,company.id,item.productId,stock.location_id,stock.batch,stock.serial,amount.toFixed(6),demand.source,u.id]);
       reserved.push({id:reservationId,itemId:item.id,quantity:amount.toFixed(6),locationId:stock.location_id,source:demand.source});remaining=remaining.minus(amount);if(remaining.isZero())break;
      }}
    }
   }
   state=await materialState(db,u,id);const requests=[];
   if(i.action==='REQUEST_PARTS')for(const item of state.items.filter(r=>i.items.some(s=>s.itemId===r.id)))for(const need of item.needs){const received=item.purchaseOrders.filter(r=>r.requirementItemId===need.id).reduce((v,r)=>v.plus(r.received),new D(0)),amount=D.max(0,new D(need.quantity).minus(need.stockReserved).minus(need.procurementReserved).minus(D.max(0,new D(need.requested).minus(received))));if(amount.gt(0)){if(!need.neededOn)throw new ConflictException('Bedarfstermin für die automatische BANF angeben.');requests.push({requirementItemId:need.id,quantity:amount.toFixed(6),estimatedUnitPrice:null});}}
   let requisition=requests.length?await createRequisitionWithin(db,u,id,{title:'Teile bestellen · '+o.number,items:requests},corr):null;
   let approvalInstanceId:string|null=null;if(requisition){const approval=await this.workflow.submitWithin(db,u,requisition.id,requisition.version,corr);approvalInstanceId=approval.id;requisition={...requisition,status:'IN_REVIEW',version:requisition.version+1};}
   state=await refreshMaterialStatus(db,u,id,corr);const updated=(await db.query('UPDATE service_orders SET version=version+1 WHERE tenant_id=$1 AND id=$2 RETURNING version',[u.tenantId,id])).rows[0];await audit(db,u,corr,'ORDER_MATERIAL_PLANNED',id,{action:i.action,items:i.items,reserved,requisitionId:requisition?.id||null});
   return {orderId:id,version:updated.version,status:state.status,reserved,requisition,approvalInstanceId,shortages:state.items.filter(r=>i.items.some(s=>s.itemId===r.id)).map(r=>({itemId:r.id,quantity:r.shortageQuantity,unit:r.unit,availableQuantity:r.availableQuantity,requestedQuantity:r.requestedQuantity}))};
  }));
 }
 async release(u:Principal,id:string,reservationId:string,raw:unknown,key:unknown,corr:string){requirePermission(u.role,'inventory.reserve');parse(uuid,id);parse(uuid,reservationId);const i=parse(z.object({version:z.number().int().positive(),reason:z.string().trim().min(5).max(2000)}).strict(),raw);return this.db.as(u,db=>idempotent(db,u,'RESERVATION_RELEASE:'+reservationId,key,i,async()=>{
  await procurementOrder(db,u,id);const initial=(await db.query('SELECT company_id FROM stock_reservations WHERE tenant_id=$1 AND id=$2 AND order_id=$3',[u.tenantId,reservationId,id])).rows[0];if(!initial)throw new NotFoundException('Reservierung dieses Auftrags fehlt.');await companyWithin(db,u,initial.company_id,true);const r=(await db.query('SELECT * FROM stock_reservations WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[u.tenantId,reservationId])).rows[0];version(r.version,i.version);if(r.status!=='ACTIVE')throw new ConflictException('Reservierung ist bereits freigegeben.');await db.query("UPDATE stock_reservations SET status='CANCELLED',reason=$3,version=version+1 WHERE tenant_id=$1 AND id=$2",[u.tenantId,reservationId,i.reason]);await refreshMaterialStatus(db,u,id,corr);await audit(db,u,corr,'STOCK_RESERVATION_RELEASED',id,{reservationId,reason:i.reason,quantity:r.quantity});return {id:reservationId,status:'CANCELLED',version:r.version+1};
 }));}
}
