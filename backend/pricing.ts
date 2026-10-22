import Decimal from 'decimal.js';
import { ConflictException } from '@nestjs/common';
import { z } from 'zod';

const D=Decimal.clone({precision:40,rounding:Decimal.ROUND_HALF_UP});
export const quantity=z.string().regex(/^(0|[1-9]\d{0,11})(\.\d{1,6})?$/).refine(s=>new D(s).gt(0),'Menge muss positiv sein.');
export const amount=z.string().regex(/^(0|[1-9]\d{0,11})(\.\d{1,6})?$/);
export interface PriceRule {
 id:string;code:string;kind:'BASE'|'DISCOUNT_PERCENT'|'DISCOUNT_AMOUNT'|'SURCHARGE_PERCENT'|'SURCHARGE_AMOUNT'|'TAX';
 sequence:number;priority:number;version?:number;value:string;minimumQuantity:string;
}
/** Rules have already been filtered by tenant, org, validity, currency and scope.
 * Highest explicit priority and quantity tier select the base and each condition.
 * An ambiguous configuration fails instead of depending on SQL row order.
 * Absolute adjustments are per unit; tax uses rounded line net. No FX conversion.
 */
export function calculatePrice(qty:string,digits:number,rules:PriceRule[],billable=true){
 quantity.parse(qty);if(!Number.isInteger(digits)||digits<0||digits>4)throw new ConflictException('Währungspräzision nicht konfiguriert.');
 const applicable=rules.filter(r=>new D(qty).gte(r.minimumQuantity));
 const best=(rows:PriceRule[])=>{
  const sorted=[...rows].sort((a,b)=>b.priority-a.priority||new D(b.minimumQuantity).cmp(a.minimumQuantity));
  if(!sorted.length)throw new ConflictException('Preis- oder Steuerkondition fehlt.');
  if(sorted[1]&&sorted[0].priority===sorted[1].priority&&new D(sorted[0].minimumQuantity).eq(sorted[1].minimumQuantity))throw new ConflictException('Mehrdeutige Preisfindung: gleichrangige Konditionen.');
  return sorted[0];
 };
 if(!billable)return {quantity:qty,unitPrice:'0',net:new D(0).toFixed(digits),tax:new D(0).toFixed(digits),gross:new D(0).toFixed(digits),taxRate:'0',billable:false,trace:[{reason:'NON_BILLABLE',before:'0',after:'0'}]};
 const base=best(applicable.filter(r=>r.kind==='BASE')),taxRule=best(applicable.filter(r=>r.kind==='TAX'));
 if(new D(taxRule.value).gt(100))throw new ConflictException('Ungültiger Steuersatz.');
 let total=new D(base.value).times(qty);
 const trace:any[]=[{...base,before:'0',after:total.toString()}];
 const groups=new Map<string,PriceRule[]>();
 for(const r of applicable.filter(r=>!['BASE','TAX'].includes(r.kind))){const key=r.sequence+':'+r.code;groups.set(key,[...(groups.get(key)||[]),r]);}
 const adjustments=[...groups.values()].map(best).sort((a,b)=>a.sequence-b.sequence||a.code.localeCompare(b.code,'en'));
 for(const r of adjustments){
  const before=total.toString(),value=new D(r.value),percent=r.kind.endsWith('_PERCENT');
  if(percent&&value.gt(100)&&r.kind==='DISCOUNT_PERCENT')throw new ConflictException('Rabatt darf 100 Prozent nicht überschreiten.');
  const delta=percent?total.times(value).div(100):value.times(qty);
  total=r.kind.startsWith('DISCOUNT')?total.minus(delta):total.plus(delta);
  if(total.lt(0))throw new ConflictException('Konditionen erzeugen einen negativen Preis.');
  trace.push({...r,before,after:total.toString()});
 }
 const net=total.toDecimalPlaces(digits),tax=net.times(taxRule.value).div(100).toDecimalPlaces(digits);
 if(net.plus(tax).gte('10000000000000000'))throw new ConflictException('Positionsbetrag überschreitet den unterstützten Wertebereich.');
 trace.push({...taxRule,before:net.toFixed(digits),after:net.plus(tax).toFixed(digits)});
 return {quantity:qty,unitPrice:base.value,net:net.toFixed(digits),tax:tax.toFixed(digits),gross:net.plus(tax).toFixed(digits),taxRate:taxRule.value,billable:true,trace};
}
export function sumAmounts(values:string[],digits:number){return values.reduce((total,s)=>total.plus(s),new D(0)).toFixed(digits);}
