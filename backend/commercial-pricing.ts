import Decimal from 'decimal.js';
import{ConflictException}from'@nestjs/common';
import{PoolClient}from'pg';
import{Principal,uuid}from'./core';
import{calculatePrice,sumAmounts,PriceRule}from'./pricing';
export async function catalogPriceWithin(db:PoolClient,u:Principal,h:any,product:any,qty:string,billable:boolean){
 const rules=(await db.query(`SELECT r.id,r.code,r.kind,r.sequence,r.priority,r.version,r.value::text,r.minimum_quantity::text AS "minimumQuantity" FROM price_conditions r JOIN business_partners bp ON bp.tenant_id=r.tenant_id AND bp.id=$4 WHERE r.tenant_id=$1 AND r.organization_id=$2 AND r.active AND r.currency=$3 AND $5::date BETWEEN r.valid_from AND r.valid_to AND (r.product_id IS NULL OR r.product_id=$6) AND (r.partner_id IS NULL OR r.partner_id=$4) AND r.contract_id IS NULL AND (r.customer_group IS NULL OR r.customer_group=bp.customer_group) AND (r.product_group IS NULL OR r.product_group=$7) AND (r.tax_code IS NULL OR r.tax_code=$8)`,[u.tenantId,h.organization_id,h.currency,h.partner_id,h.pricingDate,product.id,product.product_group,product.tax_code])).rows as PriceRule[];
 const price=calculatePrice(qty,h.digits,rules,billable);
 return {...price,product:{id:product.id,sku:product.sku,name:product.name,kind:product.kind,unit:product.unit,taxCode:product.tax_code,productGroup:product.product_group,version:product.version},context:{sourceId:h.id,sourceNumber:h.number,partnerId:h.partner_id,organizationId:h.organization_id,currency:h.currency,pricingDate:h.pricingDate}};
}
export async function validateCatalogPriceWithin(db:PoolClient,u:Principal,h:any,l:any,buyerGroupSnapshot?:string){
 const p=l.price_snapshot;
 if(p.context?.sourceId!==h.id||p.context?.partnerId!==h.partner_id||p.context?.currency!==h.currency||p.context?.pricingDate!==h.pricingDate||p.product?.id!==l.product_id||p.product?.unit!==l.unit)throw new ConflictException('Preis-/Artikelherkunft der Position '+l.position+' passt nicht zum kommerziellen Vorgang.');
 if(l.item_category!=='NON_BILLABLE'){
  if(!Array.isArray(p.trace)||p.trace.some((r:any)=>!uuid.safeParse(r.id).success))throw new ConflictException('Vollständige tatsächliche Konditionsherkunft fehlt.');
  const sourceRules=(await db.query('SELECT r.*,r.value::text AS rule_value,r.minimum_quantity::text AS minimum_quantity,r.valid_from::text AS valid_from,r.valid_to::text AS valid_to,bp.customer_group AS buyer_group FROM price_conditions r JOIN business_partners bp ON bp.tenant_id=r.tenant_id AND bp.id=$4 WHERE r.tenant_id=$1 AND r.organization_id=$2 AND r.id=ANY($3::uuid[])',[u.tenantId,h.organization_id,p.trace.map((r:any)=>r.id),h.partner_id])).rows;
  for(const trace of p.trace){
   const rule=sourceRules.find(r=>r.id===trace.id),buyerGroup=buyerGroupSnapshot===undefined?rule?.buyer_group:buyerGroupSnapshot;
   if(!rule||rule.code!==trace.code||rule.kind!==trace.kind||rule.sequence!==trace.sequence||rule.priority!==trace.priority||!Number.isInteger(trace.version)||trace.version<1||trace.version>rule.version||sumAmounts([rule.rule_value],6)!==sumAmounts([trace.value],6)||sumAmounts([rule.minimum_quantity],6)!==sumAmounts([trace.minimumQuantity],6)||rule.currency!==h.currency||h.pricingDate<rule.valid_from||h.pricingDate>rule.valid_to||rule.product_id&&rule.product_id!==l.product_id||rule.partner_id&&rule.partner_id!==h.partner_id||rule.contract_id||rule.customer_group&&rule.customer_group!==buyerGroup||rule.product_group&&rule.product_group!==p.product.productGroup||rule.tax_code&&rule.tax_code!==p.product.taxCode)throw new ConflictException('Preisposition '+l.position+' ist nicht an ihre tatsächlichen Konditionssätze gebunden.');
  }
 }
 const recalculated=calculatePrice(l.quantity,h.digits,p.trace,l.item_category!=='NON_BILLABLE');
 if(sumAmounts([l.net],h.digits)!==recalculated.net||sumAmounts([l.tax],h.digits)!==recalculated.tax||sumAmounts([l.gross],h.digits)!==recalculated.gross)throw new ConflictException('Positionspreis passt nicht zur gebundenen Konditionsherkunft.');
}

const CommercialDecimal=Decimal.clone({precision:60,rounding:Decimal.ROUND_HALF_UP});
export function commercialUnitNet(net:string,qty:string){return new CommercialDecimal(net).div(qty).toDecimalPlaces(6,Decimal.ROUND_HALF_UP).toFixed(6);}
