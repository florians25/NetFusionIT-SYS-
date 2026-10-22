import Decimal from 'decimal.js';
import {ConflictException} from '@nestjs/common';
const D=Decimal.clone({precision:60,rounding:Decimal.ROUND_HALF_UP});
export interface CountDifference {id:string;delta:string;}
export interface CountValuation {quantity:string;value:string;}
/** Allocate signed original cents across count positions; relocation within a
 * product has no net company value or artificial gain/loss. */
export function valueCountDifferences(lines:CountDifference[],valuation:CountValuation,digits:number){
 const negative=lines.filter(l=>new D(l.delta).lt(0)),positive=lines.filter(l=>new D(l.delta).gt(0)),sum=(rows:CountDifference[])=>rows.reduce((v,l)=>v.plus(l.delta),new D(0)),out=sum(negative).negated(),incoming=sum(positive),net=incoming.minus(out),q=new D(valuation.quantity),v=new D(valuation.value);
 if(q.lt(0)||v.lt(0)||q.isZero()&&!v.isZero()||out.gt(q))throw new ConflictException('Zähldifferenz passt nicht zum tatsächlich bewerteten Unternehmensbestand.');
 if((out.gt(0)||incoming.gt(0))&&q.isZero())throw new ConflictException('Positive Zähldifferenz ohne vorhandene Bewertungsgrundlage zuerst fachlich klären.');
 const amount=(qty:Decimal)=>qty.isZero()?new D(0):qty.eq(q)?v:v.times(qty).div(q).toDecimalPlaces(digits),removed=amount(out),netValue=net.gte(0)?amount(net):amount(net.negated()).negated(),added=removed.plus(netValue);
 if(added.lt(0)||netValue.abs().gte('10000000000000000'))throw new ConflictException('Inventurwert überschreitet die unterstützte Buchungsgrundlage.');
 const values=new Map<string,string>(lines.map(l=>[l.id,new D(0).toFixed(digits)]));
 function allocate(rows:CountDifference[],total:Decimal,quantity:Decimal,sign:number){let cumulative=new D(0),assigned=new D(0);for(const line of rows){cumulative=cumulative.plus(new D(line.delta).abs());const next=cumulative.eq(quantity)?total:total.times(cumulative).div(quantity).toDecimalPlaces(digits),part=next.minus(assigned);if(part.lt(0))throw new ConflictException('Inventur-Centverteilung ist nicht monoton.');values.set(line.id,part.times(sign).toFixed(digits));assigned=next;}}
 if(out.gt(0))allocate(negative,removed,out,-1);if(incoming.gt(0))allocate(positive,added,incoming,1);
 return {values,netQuantity:net.toFixed(6),netValue:netValue.toFixed(digits),negativeValue:removed.toFixed(digits),positiveValue:added.toFixed(digits)};
}
