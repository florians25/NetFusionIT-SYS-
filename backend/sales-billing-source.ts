import {ConflictException} from '@nestjs/common';
import {PoolClient} from 'pg';
import Decimal from 'decimal.js';
import {Principal} from './core';
import {document} from './business';
import {scopedOrder} from './work';
import {directSalesOrder} from './sales-fulfillment';
const D=Decimal.clone({precision:60,rounding:Decimal.ROUND_HALF_UP});
export async function billingOrder(db:PoolClient,u:Principal,id:string,lock=false){
 const d=await document(db,u,id);
 if(d.kind!=='SALES_ORDER')return scopedOrder(db,u,id,lock);
 const {h,executionVersion}=await directSalesOrder(db,u,id,lock);
 if(h.billing_block)throw new ConflictException('Der Kundenauftrag ist für die Fakturierung gesperrt.');
 return {...h,version:executionVersion};
}
export async function directBillingSources(db:PoolClient,u:Principal,orderId:string,excludeRequest:string|null){
 const o=await billingOrder(db,u,orderId),company=(await db.query('SELECT c.*,cur.digits FROM company_codes c JOIN currencies cur ON cur.tenant_id=c.tenant_id AND cur.code=c.currency WHERE c.tenant_id=$1 AND c.id=$2',[u.tenantId,o.company_id])).rows[0];
 if(company.currency!==o.currency||company.digits!==2)throw new ConflictException('Direktvertriebsfaktura benötigt dieselbe zweistellige Währung; keine implizite Umrechnung.');
 const rows=(await db.query(`SELECT gi.id,gi.sales_item_id AS item_id,gi.quantity::text,g.id AS issue_id,d.number AS issue_number,g.delivery_number,g.delivery_date::text AS delivery_date,i.position,i.description,i.unit,i.net::text AS planned_net,i.quantity::text AS planned_quantity,i.price_snapshot,i.cost_center
 FROM goods_issue_items gi JOIN goods_issues g ON g.tenant_id=gi.tenant_id AND g.id=gi.issue_id JOIN documents d ON d.tenant_id=g.tenant_id AND d.id=g.id JOIN sales_order_items i ON i.tenant_id=gi.tenant_id AND i.id=gi.sales_item_id
 WHERE gi.tenant_id=$1 AND g.sales_order_id=$2 AND g.sealed AND g.movement_type='ISSUE' AND NOT EXISTS(SELECT 1 FROM goods_issues rev WHERE rev.tenant_id=g.tenant_id AND rev.reverses_id=g.id)
 AND i.rejection_reason IS NULL AND i.billing_block IS NULL AND i.billing_rule<>'NON_BILLABLE' ORDER BY g.delivery_date,d.number,gi.position`,[u.tenantId,orderId])).rows;
 const claims=(await db.query("SELECT l.source_key,sum(l.quantity)::text AS quantity FROM billing_request_lines l JOIN billing_requests r ON r.tenant_id=l.tenant_id AND r.id=l.request_id WHERE l.tenant_id=$1 AND r.sales_order_id=$2 AND r.status NOT IN ('CANCELLED','REJECTED') AND ($3::uuid IS NULL OR r.id<>$3) GROUP BY l.source_key",[u.tenantId,orderId,excludeRequest])).rows,used=new Map(claims.map(l=>[l.source_key,l.quantity]));
 const sources=rows.map(l=>({sourceKey:'WA:'+l.id,sourceKind:'DELIVERY',sourceLineId:null,itemId:null,salesItemId:l.item_id,goodsIssueItemId:l.id,issueId:l.issue_id,issueNumber:l.issue_number,deliveryNumber:l.delivery_number,orderPosition:l.position,sku:l.price_snapshot.product?.sku||'',description:l.description,unit:l.unit,sourceQuantity:l.quantity,remainingQuantity:D.max(0,new D(l.quantity).minus(used.get('WA:'+l.id)||0)).toFixed(),unitNet:new D(l.planned_net).div(l.planned_quantity).toFixed(12),taxRate:l.price_snapshot.taxRate,costCenter:l.cost_center,ticketNumbers:[],reportNumber:l.delivery_number,correlationId:null,serviceFrom:l.delivery_date,serviceTo:l.delivery_date}));
 return {order:o,company,sources};
}
