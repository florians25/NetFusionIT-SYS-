import {Injectable,ConflictException,NotFoundException} from '@nestjs/common';
import {PoolClient} from 'pg';
import {randomUUID} from 'node:crypto';
import Decimal from 'decimal.js';
import {z} from 'zod';
import {Db,Principal,parse,uuid,audit,idempotent,nextNumber} from './core';
import {createDocument,document,relate,version} from './business';
import {can,requirePermission} from './permissions';
import {salesOrderWithin,lockSalesOrder} from './sales-orders';
import {salesShippingParty} from './sales-order-source';
import {companyWithin,periodWithin,automaticJournal} from './finance';
import {physicalBin,assertBinSource,assertBinTarget,warehouseToday} from './warehouse-state';
import {quantity} from './pricing';
const D=Decimal.clone({precision:60,rounding:Decimal.ROUND_HALF_UP});
const reason=z.string().trim().min(15).max(1000),expected=z.number().int().positive();
const dates={periodId:uuid,postingDate:z.iso.date(),documentDate:z.iso.date()};

export async function directSalesOrder(db:PoolClient,u:Principal,id:string,lock=false){
 if(lock)await lockSalesOrder(db,u,id);
 const h=await salesOrderWithin(db,u,id,lock);
 if(h.execution_mode!=='DIRECT_SALES'||h.status!=='RELEASED'||!h.released_snapshot)throw new ConflictException('Auslieferung benötigt einen unabhängig freigegebenen Kundenauftrag für Direktvertrieb.');
 const c=await companyWithin(db,u,h.company_id,lock);
 if(c.currency!==h.currency)throw new ConflictException('Direktvertrieb benötigt dieselbe Auftrags- und Buchungskreiswährung; kein stiller Währungswechsel.');
 const state=(await db.query(`SELECT version FROM sales_order_fulfillment WHERE tenant_id=$1 AND order_id=$2${lock?' FOR UPDATE':''}`,[u.tenantId,id])).rows[0];
 if(!state)throw new ConflictException('Tatsächlicher AU-Ausführungsstand fehlt.');
 return {h,c,executionVersion:state.version as number};
}
export async function bumpDirectSales(db:PoolClient,u:Principal,id:string){
 return (await db.query('UPDATE sales_order_fulfillment SET version=version+1 WHERE tenant_id=$1 AND order_id=$2 RETURNING version',[u.tenantId,id])).rows[0].version as number;
}
const reservationsSql=`SELECT r.*,i.position,i.description,i.unit,i.cost_center,i.cost_object,p.sku,p.name,l.code AS location_code,pl.code AS plant_code
 FROM stock_reservations r JOIN sales_order_items i ON i.tenant_id=r.tenant_id AND i.id=r.sales_item_id
 JOIN products p ON p.tenant_id=i.tenant_id AND p.id=i.product_id
 JOIN storage_locations l ON l.tenant_id=r.tenant_id AND l.id=r.location_id JOIN plants pl ON pl.tenant_id=l.tenant_id AND pl.id=l.plant_id
 WHERE r.tenant_id=$1 AND r.sales_order_id=$2`;

@Injectable()
export class SalesFulfillment{
 constructor(private db:Db){}
 async list(u:Principal){
  requirePermission(u.role,'sales.fulfillment.read');
  return this.db.snapshot(u,async db=>(await db.query(`SELECT h.id,d.number,h.title,p.name AS "partnerName",h.customer_reference AS "customerReference",h.requested_on::text AS "requestedOn",h.currency,f.version,
   (SELECT count(*)::int FROM sales_order_items i WHERE i.tenant_id=h.tenant_id AND i.order_id=h.id AND i.rejection_reason IS NULL) AS "itemCount",
   EXISTS(SELECT 1 FROM goods_issues g WHERE g.tenant_id=h.tenant_id AND g.sales_order_id=h.id AND g.movement_type='ISSUE' AND NOT EXISTS(SELECT 1 FROM goods_issues rev WHERE rev.tenant_id=g.tenant_id AND rev.reverses_id=g.id)) AS "hasDelivery"
   FROM sales_orders h JOIN sales_order_fulfillment f ON f.tenant_id=h.tenant_id AND f.order_id=h.id JOIN documents d ON d.tenant_id=h.tenant_id AND d.id=h.id JOIN business_partners p ON p.tenant_id=h.tenant_id AND p.id=h.partner_id
   WHERE h.tenant_id=$1 AND h.organization_id=ANY($2::uuid[]) AND h.status='RELEASED' AND h.execution_mode='DIRECT_SALES' AND ($3::uuid IS NULL OR h.partner_id=$3)
   ORDER BY h.requested_on,d.created_at,h.id LIMIT 100`,[u.tenantId,u.orgIds,u.role==='CUSTOMER'?u.partnerId:null])).rows);
 }
 async context(u:Principal,id:string){
  requirePermission(u.role,'sales.fulfillment.read');parse(uuid,id);
  return this.db.snapshot(u,async db=>{
   const {h,c,executionVersion}=await directSalesOrder(db,u,id),internal=u.role!=='CUSTOMER';
   const rows=(await db.query(`SELECT i.id,i.position,i.product_id AS "productId",i.description,i.unit,i.quantity::text,p.sku,p.kind,p.status AS "productStatus",i.rejection_reason AS "rejectionReason",i.delivery_block AS "deliveryBlock",i.billing_block AS "billingBlock"
    FROM sales_order_items i JOIN products p ON p.tenant_id=i.tenant_id AND p.id=i.product_id WHERE i.tenant_id=$1 AND i.order_id=$2 ORDER BY i.position`,[u.tenantId,id])).rows;
   const schedules=(await db.query(`SELECT s.id,s.item_id AS "itemId",s.position,s.quantity::text,s.requested_on::text AS "requestedOn",s.confirmed_on::text AS "confirmedOn",
    coalesce((SELECT sum(CASE WHEN r.status='CANCELLED' THEN r.consumed_quantity ELSE r.quantity END) FROM stock_reservations r WHERE r.tenant_id=s.tenant_id AND r.sales_schedule_id=s.id),0)::text AS claimed,
    coalesce((SELECT sum(r.quantity-r.consumed_quantity) FROM stock_reservations r WHERE r.tenant_id=s.tenant_id AND r.sales_schedule_id=s.id AND r.status='ACTIVE'),0)::text AS reserved,
    coalesce((SELECT sum(CASE g.movement_type WHEN 'ISSUE' THEN gi.quantity ELSE -gi.quantity END) FROM goods_issue_items gi JOIN goods_issues g ON g.tenant_id=gi.tenant_id AND g.id=gi.issue_id WHERE gi.tenant_id=s.tenant_id AND gi.sales_schedule_id=s.id AND g.sealed),0)::text AS delivered
    FROM sales_order_schedules s WHERE s.tenant_id=$1 AND s.order_id=$2 ORDER BY s.item_id,s.position`,[u.tenantId,id])).rows.map(s=>({...s,openToReserve:new D(s.quantity).minus(s.claimed).toFixed(6),remainingQuantity:new D(s.quantity).minus(s.delivered).toFixed(6)}));
   const deliveries=(await db.query(`SELECT g.id,d.number,g.delivery_number AS "deliveryNumber",g.movement_type AS "movementType",g.delivery_date::text AS "deliveryDate",g.posting_date::text AS "postingDate",g.description,
    (SELECT id FROM goods_issues rev WHERE rev.tenant_id=g.tenant_id AND rev.reverses_id=g.id) AS "reversalId",g.reverses_id AS "reversesId"
    FROM goods_issues g JOIN documents d ON d.tenant_id=g.tenant_id AND d.id=g.id WHERE g.tenant_id=$1 AND g.sales_order_id=$2 AND g.sealed ORDER BY d.created_at DESC`,[u.tenantId,id])).rows;
   const items=rows.map(l=>{const own=schedules.filter(s=>s.itemId===l.id),delivered=own.reduce((n,s)=>n.plus(s.delivered),new D(0)),reserved=own.reduce((n,s)=>n.plus(s.reserved),new D(0));return {...l,schedules:own,deliveredQuantity:delivered.toFixed(6),reservedQuantity:reserved.toFixed(6),remainingQuantity:new D(l.quantity).minus(delivered).toFixed(6),supported:l.kind==='STOCK',deliveryStatus:l.rejectionReason?'REJECTED':delivered.eq(l.quantity)?'DELIVERED':delivered.gt(0)?'PARTIALLY_DELIVERED':reserved.gt(0)?'RESERVED':'OPEN'};});
   const open=items.filter(l=>!l.rejectionReason),deliveryStatus=open.length&&open.every(l=>l.deliveryStatus==='DELIVERED')?'DELIVERED':open.some(l=>new D(l.deliveredQuantity).gt(0))?'PARTIALLY_DELIVERED':'OPEN';
   const result:any={id,number:h.number,title:h.title,partnerId:h.partner_id,customerReference:h.customer_reference,companyId:c.id,currency:c.currency,version:executionVersion,deliveryStatus,items,deliveries,canReserve:can(u.role,'sales.reserve'),canDeliver:can(u.role,'sales.deliver'),canReadOrder:can(u.role,'sales.read'),shipTo:h.released_snapshot.commercial.partners.find((p:any)=>p.role==='SHIP_TO')};
   if(!internal)return result;
   result.periods=(await db.query("SELECT id,year,period,date_from::text AS \"dateFrom\",date_to::text AS \"dateTo\" FROM fiscal_periods WHERE tenant_id=$1 AND company_id=$2 AND status='OPEN' ORDER BY date_from",[u.tenantId,c.id])).rows;
   result.stock=(await db.query(`SELECT b.product_id AS "productId",b.location_id AS "locationId",p.sku,l.code AS "locationCode",pl.code AS "plantCode",b.batch,b.serial,b.quantity::text,
    (b.quantity-coalesce((SELECT sum(r.quantity-r.consumed_quantity) FROM stock_reservations r WHERE r.tenant_id=b.tenant_id AND r.company_id=b.company_id AND r.product_id=b.product_id AND r.location_id=b.location_id AND r.batch=b.batch AND r.serial=b.serial AND r.status='ACTIVE'),0))::text AS "availableQuantity"
    FROM stock_balances b JOIN products p ON p.tenant_id=b.tenant_id AND p.id=b.product_id JOIN storage_locations l ON l.tenant_id=b.tenant_id AND l.id=b.location_id JOIN plants pl ON pl.tenant_id=l.tenant_id AND pl.id=l.plant_id
    WHERE b.tenant_id=$1 AND b.company_id=$2 AND b.product_id=ANY($3::uuid[]) AND b.quantity>0 ORDER BY p.sku,pl.code,l.code,b.batch,b.serial`,[u.tenantId,c.id,rows.map(l=>l.productId)])).rows;
   const freeByProduct=new Map<string,Decimal>();
   for(const stock of result.stock)freeByProduct.set(stock.productId,(freeByProduct.get(stock.productId)||new D(0)).plus(stock.availableQuantity));
   for(const line of items){const need=D.max(0,new D(line.remainingQuantity).minus(line.reservedQuantity)),free=D.max(0,freeByProduct.get(line.productId)||0),cover=line.supported&&!line.rejectionReason?D.min(need,free):new D(0);line.stockCoverage=cover.toFixed(6);line.shortageQuantity=line.supported&&!line.rejectionReason?need.minus(cover).toFixed(6):null;freeByProduct.set(line.productId,free.minus(cover));}
   result.reservations=(await db.query(reservationsSql+' ORDER BY i.position,r.created_at,r.id',[u.tenantId,id])).rows.map(r=>({id:r.id,itemId:r.sales_item_id,scheduleId:r.sales_schedule_id,sku:r.sku,description:r.description,unit:r.unit,position:r.position,locationId:r.location_id,locationCode:r.location_code,plantCode:r.plant_code,batch:r.batch,serial:r.serial,quantity:r.quantity,consumedQuantity:r.consumed_quantity,remainingQuantity:new D(r.quantity).minus(r.consumed_quantity).toFixed(6),status:r.status,version:r.version}));
   result.bins=(await db.query(`SELECT b.id,b.code,b.location_id AS "locationId",s.product_id AS "productId",s.batch,s.serial,s.quantity::text,b.blocked OR coalesce(r.blocked,false) OR coalesce(a.blocked,false) OR EXISTS(SELECT 1 FROM inventory_count_scopes cs WHERE cs.tenant_id=b.tenant_id AND cs.bin_id=b.id AND cs.released_at IS NULL) AS unavailable
    FROM warehouse_bin_balances s JOIN warehouse_bins b ON b.tenant_id=s.tenant_id AND b.id=s.bin_id LEFT JOIN warehouse_racks r ON r.tenant_id=b.tenant_id AND r.id=b.rack_id LEFT JOIN warehouse_areas a ON a.tenant_id=r.tenant_id AND a.id=r.area_id WHERE s.tenant_id=$1 AND s.company_id=$2 AND s.product_id=ANY($3::uuid[]) AND s.quantity>0 ORDER BY b.code`,[u.tenantId,c.id,rows.map(l=>l.productId)])).rows;
   return result;
  });
 }
 async reserve(u:Principal,id:string,raw:unknown,key:unknown,corr:string){
  requirePermission(u.role,'sales.reserve');parse(uuid,id);
  const i=parse(z.object({version:expected,reason,items:z.array(z.object({scheduleId:uuid,locationId:uuid,quantity,batch:z.string().trim().max(100),serial:z.string().trim().max(100)}).strict()).min(1).max(200)}).strict(),raw);
  return this.db.as(u,db=>idempotent(db,u,'SALES_RESERVE:'+id,key,i,async()=>{
   const {h,c,executionVersion}=await directSalesOrder(db,u,id,true);version(executionVersion,i.version);
   const reservations=[];
   for(const selected of i.items){
    const line=(await db.query(`SELECT s.item_id,s.quantity::text,l.product_id,l.description,l.unit,l.rejection_reason,l.delivery_block,p.kind,p.status AS product_status,
     coalesce((SELECT sum(CASE WHEN r.status='CANCELLED' THEN r.consumed_quantity ELSE r.quantity END) FROM stock_reservations r WHERE r.tenant_id=s.tenant_id AND r.sales_schedule_id=s.id),0)::text AS claimed
     FROM sales_order_schedules s JOIN sales_order_items l ON l.tenant_id=s.tenant_id AND l.id=s.item_id JOIN products p ON p.tenant_id=l.tenant_id AND p.id=l.product_id WHERE s.tenant_id=$1 AND s.id=$2 AND s.order_id=$3`,[u.tenantId,selected.scheduleId,id])).rows[0];
    if(!line)throw new ConflictException('Tatsächliche Einteilung dieses AU wählen.');
    if(line.kind!=='STOCK'||line.product_status!=='ACTIVE'||line.rejection_reason||line.delivery_block||h.delivery_block)throw new ConflictException('Freigegebene, lieferbare Lagerposition ohne Absage oder Sperre erforderlich.');
    if(new D(line.claimed).plus(selected.quantity).gt(line.quantity))throw new ConflictException('Reservierung überschreitet die noch offene AU-Einteilungsmenge.');
    const stock=(await db.query('SELECT quantity::text FROM stock_balances WHERE tenant_id=$1 AND company_id=$2 AND product_id=$3 AND location_id=$4 AND batch=$5 AND serial=$6',[u.tenantId,c.id,line.product_id,selected.locationId,selected.batch,selected.serial])).rows[0];
    const claimed=(await db.query("SELECT coalesce(sum(quantity-consumed_quantity),0)::text AS quantity FROM stock_reservations WHERE tenant_id=$1 AND company_id=$2 AND product_id=$3 AND location_id=$4 AND batch=$5 AND serial=$6 AND status='ACTIVE'",[u.tenantId,c.id,line.product_id,selected.locationId,selected.batch,selected.serial])).rows[0];
    if(!stock||new D(stock.quantity).minus(claimed.quantity).lt(selected.quantity))throw new ConflictException('Kein ausreichender freier Lagerbestand. Bereits für Service oder Vertrieb reservierte Mengen stehen nicht erneut zur Verfügung.');
    const reservationId=randomUUID();await db.query(`INSERT INTO stock_reservations(id,tenant_id,company_id,product_id,location_id,batch,serial,quantity,source,created_by,sales_order_id,sales_item_id,sales_schedule_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'STOCK',$9,$10,$11,$12)`,[reservationId,u.tenantId,c.id,line.product_id,selected.locationId,selected.batch,selected.serial,selected.quantity,u.id,id,line.item_id,selected.scheduleId]);reservations.push(reservationId);
   }
   const revision=await bumpDirectSales(db,u,id);await audit(db,u,corr,'SALES_STOCK_RESERVED',h.id,{reason:i.reason,reservations});return {id,version:revision,reservations};
  }));
 }
 async release(u:Principal,id:string,reservationId:string,raw:unknown,key:unknown,corr:string){
  requirePermission(u.role,'sales.reserve');parse(uuid,id);parse(uuid,reservationId);const i=parse(z.object({version:expected,reservationVersion:expected,reason}).strict(),raw);
  return this.db.as(u,db=>idempotent(db,u,'SALES_RESERVATION_RELEASE:'+reservationId,key,i,async()=>{
   const {executionVersion}=await directSalesOrder(db,u,id,true);version(executionVersion,i.version);
   const r=(await db.query('SELECT * FROM stock_reservations WHERE tenant_id=$1 AND id=$2 AND sales_order_id=$3 FOR UPDATE',[u.tenantId,reservationId,id])).rows[0];if(!r)throw new NotFoundException('AU-Reservierung fehlt.');version(r.version,i.reservationVersion);if(r.status!=='ACTIVE')throw new ConflictException('Nur offene Reservierungen können freigegeben werden.');
   await db.query("UPDATE stock_reservations SET status='CANCELLED',reason=$3,version=version+1 WHERE tenant_id=$1 AND id=$2",[u.tenantId,reservationId,i.reason]);const revision=await bumpDirectSales(db,u,id);await audit(db,u,corr,'SALES_RESERVATION_RELEASED',id,{reservationId,reason:i.reason});return {id,version:revision};
  }));
 }
 async deliver(u:Principal,id:string,raw:unknown,key:unknown,corr:string){
  requirePermission(u.role,'sales.deliver');parse(uuid,id);
  const i=parse(z.object({...dates,version:expected,deliveryDate:z.iso.date(),description:reason,items:z.array(z.object({reservationId:uuid,binId:uuid,quantity}).strict()).min(1).max(200).refine(a=>new Set(a.map(l=>l.reservationId+':'+l.binId)).size===a.length)}).strict(),raw);
  if(i.deliveryDate>warehouseToday())throw new ConflictException('Tatsächlicher Warenausgang darf nicht in der Zukunft liegen.');
  return this.db.as(u,db=>idempotent(db,u,'SALES_DELIVERY:'+id,key,i,async()=>{
   const {h,c,executionVersion}=await directSalesOrder(db,u,id,true);version(executionVersion,i.version);await periodWithin(db,u,c,i.periodId,i.postingDate,true);
   const shipTo=await salesShippingParty(db,u,{source_sales_order_id:id,organization_id:h.organization_id,partner_id:h.partner_id},true);
   const reservations=(await db.query(reservationsSql+' ORDER BY r.id FOR UPDATE OF r',[u.tenantId,id])).rows;
   const doc=await createDocument(db,u,'GOODS_ISSUE','WA',h.organization_id),deliveryNumber=await nextNumber(db,u.tenantId,'LS');
   await db.query(`INSERT INTO goods_issues(id,tenant_id,sales_order_id,company_id,period_id,currency,delivery_number,movement_type,posting_date,document_date,description,receiver_snapshot,delivery_date) VALUES($1,$2,$3,$4,$5,$6,$7,'ISSUE',$8,$9,$10,$11,$12)`,[doc.id,u.tenantId,id,c.id,i.periodId,c.currency,deliveryNumber,i.postingDate,i.documentDate,i.description,JSON.stringify(shipTo),i.deliveryDate]);
   const costs:any[]=[];let inventoryAccount:string|null=null;
   for(const selected of i.items){
    const r=reservations.find(r=>r.id===selected.reservationId);if(!r||r.status!=='ACTIVE'||new D(r.quantity).minus(r.consumed_quantity).lt(selected.quantity))throw new ConflictException('Tatsächlich offene AU-Reservierung und zulässige Entnahmemenge wählen.');
    const bin=await physicalBin(db,u,selected.binId,true);if(bin.company_id!==c.id||bin.location_id!==r.location_id)throw new ConflictException('Entnahmefach passt nicht zum reservierten AU-Lagerort.');await assertBinSource(db,u,bin,r.product_id,selected.quantity,r.batch,r.serial);
    const valuation=(await db.query('SELECT * FROM inventory_valuations WHERE tenant_id=$1 AND company_id=$2 AND product_id=$3',[u.tenantId,c.id,r.product_id])).rows[0];if(!valuation||new D(valuation.quantity).lt(selected.quantity))throw new ConflictException('Bewerteter Bestand reicht nicht aus.');
    const value=new D(valuation.quantity).eq(selected.quantity)?new D(valuation.value):new D(valuation.value).times(selected.quantity).div(valuation.quantity).toDecimalPlaces(c.digits);
    if(value.gt(0)){if(!valuation.inventory_account_id||inventoryAccount&&inventoryAccount!==valuation.inventory_account_id)throw new ConflictException('Eindeutiges historisches Bestandskonto erforderlich.');inventoryAccount=valuation.inventory_account_id;}
    await db.query(`INSERT INTO goods_issue_items(id,tenant_id,issue_id,reservation_id,sales_item_id,sales_schedule_id,product_id,location_id,bin_id,position,quantity,value,batch,serial) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,[randomUUID(),u.tenantId,doc.id,r.id,r.sales_item_id,r.sales_schedule_id,r.product_id,r.location_id,bin.id,(costs.length+1)*10,selected.quantity,value.toFixed(c.digits),r.batch,r.serial]);costs.push({value:value.toFixed(c.digits),costCenter:r.cost_center,costObject:r.cost_object});r.consumed_quantity=new D(r.consumed_quantity).plus(selected.quantity).toFixed(6);if(new D(r.consumed_quantity).eq(r.quantity))r.status='CONSUMED';
   }
   const total=costs.reduce((sum,l)=>sum.plus(l.value),new D(0));let journal=null;
   if(total.gt(0)){
    const map=Object.fromEntries((await db.query("SELECT role,account_id FROM accounting_rules WHERE tenant_id=$1 AND company_id=$2 AND event='STOCK_ISSUE'",[u.tenantId,c.id])).rows.map(r=>[r.role,r.account_id]));
    if(!map.consumption||map.inventory!==inventoryAccount)throw new ConflictException('Warenabgang mit Aufwand und historischem Bestandskonto zuerst konfigurieren.');
    const lines=costs.filter(l=>new D(l.value).gt(0)).map(l=>({accountId:map.consumption,side:'DEBIT' as 'DEBIT'|'CREDIT',amount:l.value,description:('Warenaufwand '+h.number+' · '+l.costObject).slice(0,160),costCenter:l.costCenter,partnerId:null,taxCode:null}));lines.push({accountId:map.inventory,side:'CREDIT',amount:total.toFixed(c.digits),description:'Bestandsabgang '+deliveryNumber,costCenter:null,partnerId:null,taxCode:null});
    journal=await automaticJournal(db,u,{companyId:c.id,periodId:i.periodId,postingDate:i.postingDate,documentDate:i.documentDate,description:'Warenverkauf '+h.number,reference:deliveryNumber,lines},doc.id,corr);
   }
   await db.query('UPDATE goods_issues SET sealed=true WHERE tenant_id=$1 AND id=$2',[u.tenantId,doc.id]);const revision=await bumpDirectSales(db,u,id);await relate(db,u,id,doc.id,'SALES_DELIVERY');await audit(db,u,corr,'SALES_GOODS_DELIVERED',doc.id,{salesOrderId:id,deliveryNumber,actualDeliveryDate:i.deliveryDate,total:total.toFixed(c.digits),journalId:journal?.id||null});return {...doc,deliveryNumber,version:revision,total:total.toFixed(c.digits),journal};
  }));
 }
 async reverse(u:Principal,issueId:string,raw:unknown,key:unknown,corr:string){
  requirePermission(u.role,'sales.deliver');parse(uuid,issueId);const i=parse(z.object({...dates,reason}).strict(),raw);
  return this.db.as(u,db=>idempotent(db,u,'SALES_DELIVERY_REVERSE:'+issueId,key,i,async()=>{
   const source=(await db.query('SELECT g.*,g.posting_date::text AS posting_day FROM goods_issues g WHERE tenant_id=$1 AND id=$2 AND sales_order_id IS NOT NULL',[u.tenantId,issueId])).rows[0];if(!source)throw new NotFoundException('Vertriebsauslieferung fehlt.');
   const {h,c}=await directSalesOrder(db,u,source.sales_order_id,true);await document(db,u,issueId,true);await periodWithin(db,u,c,i.periodId,i.postingDate,true);
   if(!source.sealed||source.movement_type!=='ISSUE'||(await db.query('SELECT 1 FROM goods_issues WHERE tenant_id=$1 AND reverses_id=$2',[u.tenantId,issueId])).rowCount)throw new ConflictException('Nur ein gebuchtes, noch nicht zurückgenommenes Auslieferungsoriginal kann zurückgenommen werden.');
   if((await db.query("SELECT 1 FROM billing_request_lines l JOIN billing_requests r ON r.tenant_id=l.tenant_id AND r.id=l.request_id JOIN goods_issue_items gi ON gi.tenant_id=l.tenant_id AND gi.id=l.goods_issue_item_id WHERE l.tenant_id=$1 AND gi.issue_id=$2 AND r.status NOT IN ('CANCELLED','REJECTED')",[u.tenantId,issueId])).rowCount)throw new ConflictException('Lieferung ist in Fakturaanforderung oder Rechnung gebunden; erst zulässige kaufmännische Rückabwicklung durchführen.');
   if(i.postingDate<source.posting_day)throw new ConflictException('Rücknahme darf nicht vor dem ursprünglichen Warenausgang gebucht werden.');
   const lines=(await db.query('SELECT * FROM goods_issue_items WHERE tenant_id=$1 AND issue_id=$2 ORDER BY position',[u.tenantId,issueId])).rows;
   const originalJournal=(await db.query("SELECT id FROM journals WHERE tenant_id=$1 AND source_id=$2 AND status='POSTED'",[u.tenantId,issueId])).rows[0];
   const entries=originalJournal?(await db.query(`SELECT account_id AS "accountId",CASE side WHEN 'DEBIT' THEN 'CREDIT' ELSE 'DEBIT' END AS side,amount::text,description,cost_center AS "costCenter",partner_id AS "partnerId",tax_code AS "taxCode" FROM journal_entries WHERE tenant_id=$1 AND journal_id=$2 ORDER BY position`,[u.tenantId,originalJournal.id])).rows:[];
   const doc=await createDocument(db,u,'GOODS_ISSUE','SB',h.organization_id);
   await db.query(`INSERT INTO goods_issues(id,tenant_id,sales_order_id,company_id,period_id,currency,movement_type,posting_date,document_date,description,reason,reverses_id,receiver_snapshot,delivery_date) VALUES($1,$2,$3,$4,$5,$6,'ISSUE_REVERSAL',$7,$8,$9,$10,$11,$12,$13)`,[doc.id,u.tenantId,h.id,c.id,i.periodId,c.currency,i.postingDate,i.documentDate,'Rücknahme '+source.delivery_number,i.reason,issueId,JSON.stringify(source.receiver_snapshot),source.delivery_date]);
   for(const line of lines){const bin=await physicalBin(db,u,line.bin_id,true),product=(await db.query('SELECT id,unit FROM products WHERE tenant_id=$1 AND id=$2',[u.tenantId,line.product_id])).rows[0];await assertBinTarget(db,u,bin,product,line.quantity,line.batch);await db.query(`INSERT INTO goods_issue_items(id,tenant_id,issue_id,reservation_id,sales_item_id,sales_schedule_id,product_id,location_id,bin_id,position,quantity,value,batch,serial) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,[randomUUID(),u.tenantId,doc.id,line.reservation_id,line.sales_item_id,line.sales_schedule_id,line.product_id,line.location_id,line.bin_id,line.position,line.quantity,line.value,line.batch,line.serial]);}
   let journal=null;if(originalJournal)journal=await automaticJournal(db,u,{companyId:c.id,periodId:i.periodId,postingDate:i.postingDate,documentDate:i.documentDate,description:'Rücknahme '+source.delivery_number,reference:source.delivery_number,lines:entries},doc.id,corr,{id:originalJournal.id,reason:i.reason});
   await db.query('UPDATE goods_issues SET sealed=true WHERE tenant_id=$1 AND id=$2',[u.tenantId,doc.id]);const revision=await bumpDirectSales(db,u,h.id);await relate(db,u,issueId,doc.id,'REVERSES');await relate(db,u,h.id,doc.id,'SALES_DELIVERY_REVERSAL');await audit(db,u,corr,'SALES_DELIVERY_REVERSED',doc.id,{salesOrderId:h.id,originalId:issueId,reason:i.reason,journalId:journal?.id||null});return {...doc,version:revision,journal};
  }));
 }
 async detail(u:Principal,id:string){
  requirePermission(u.role,'sales.fulfillment.read');parse(uuid,id);return this.db.snapshot(u,async db=>{
   const g=(await db.query(`SELECT g.*,d.number,od.number AS "orderNumber",g.posting_date::text AS "postingDate",g.document_date::text AS "documentDate",g.delivery_date::text AS "deliveryDate" FROM goods_issues g JOIN documents d ON d.tenant_id=g.tenant_id AND d.id=g.id JOIN documents od ON od.tenant_id=g.tenant_id AND od.id=g.sales_order_id WHERE g.tenant_id=$1 AND g.id=$2`,[u.tenantId,id])).rows[0];if(!g)throw new NotFoundException('Vertriebsauslieferung fehlt.');await directSalesOrder(db,u,g.sales_order_id);
   const internal=u.role!=='CUSTOMER',lines=(await db.query(`SELECT i.id,i.position,i.quantity::text,i.value::text,i.batch,i.serial,i.sales_item_id AS "salesItemId",i.sales_schedule_id AS "scheduleId",s.position AS "schedulePosition",l.position AS "orderPosition",l.unit,l.description,l.customer_material AS "customerMaterial",p.sku,p.name,b.code AS "binCode",sl.code AS "locationCode",pl.code AS "plantCode" FROM goods_issue_items i JOIN sales_order_items l ON l.tenant_id=i.tenant_id AND l.id=i.sales_item_id JOIN sales_order_schedules s ON s.tenant_id=i.tenant_id AND s.id=i.sales_schedule_id JOIN products p ON p.tenant_id=i.tenant_id AND p.id=i.product_id JOIN warehouse_bins b ON b.tenant_id=i.tenant_id AND b.id=i.bin_id JOIN storage_locations sl ON sl.tenant_id=i.tenant_id AND sl.id=i.location_id JOIN plants pl ON pl.tenant_id=sl.tenant_id AND pl.id=sl.plant_id WHERE i.tenant_id=$1 AND i.issue_id=$2 ORDER BY i.position`,[u.tenantId,id])).rows;
   const reversal=(await db.query('SELECT id FROM goods_issues WHERE tenant_id=$1 AND reverses_id=$2',[u.tenantId,id])).rows[0],journal=internal?(await db.query('SELECT j.id,d.number FROM journals j JOIN documents d ON d.tenant_id=j.tenant_id AND d.id=j.id WHERE j.tenant_id=$1 AND j.source_id=$2',[u.tenantId,id])).rows[0]:null;
   const billingBound=internal?!!(await db.query("SELECT 1 FROM billing_request_lines l JOIN billing_requests r ON r.tenant_id=l.tenant_id AND r.id=l.request_id JOIN goods_issue_items gi ON gi.tenant_id=l.tenant_id AND gi.id=l.goods_issue_item_id WHERE l.tenant_id=$1 AND gi.issue_id=$2 AND r.status NOT IN ('CANCELLED','REJECTED')",[u.tenantId,id])).rowCount:false;
   return {id,number:g.number,orderId:g.sales_order_id,orderNumber:g.orderNumber,orderKind:'SALES_ORDER',deliveryNumber:g.delivery_number,movementType:g.movement_type,postingDate:g.postingDate,documentDate:g.documentDate,deliveryDate:g.deliveryDate,description:g.description,reason:g.reason,receiverSnapshot:g.receiver_snapshot,currency:g.currency,reversalId:reversal?.id||null,reversible:can(u.role,'sales.deliver')&&g.movement_type==='ISSUE'&&!reversal&&!billingBound,...(internal?{journal:journal||null,total:lines.reduce((n,l)=>n.plus(l.value),new D(0)).toFixed(4)}:{}),lines:internal?lines:lines.map(({value,binCode,locationCode,plantCode,...l})=>l)};
  });
 }
}
