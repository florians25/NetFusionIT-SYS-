import { Temporal } from '@js-temporal/polyfill';
import { z } from 'zod';
export const calendarSchema=z.object({
 timeZone:z.string().min(1).max(80).refine(v=>{try{Temporal.Instant.from('2026-01-01T00:00:00Z').toZonedDateTimeISO(v);return true;}catch{return false;}},'Ungültige IANA-Zeitzone'),
 weekly:z.array(z.object({day:z.number().int().min(1).max(7),start:z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),end:z.string().regex(/^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/)}).strict()).min(1).max(50),
 holidays:z.array(z.iso.date()).max(1000)
}).strict().superRefine((v,ctx)=>{
 for(let day=1;day<=7;day++){
  const intervals=v.weekly.filter(w=>w.day===day).sort((a,b)=>a.start.localeCompare(b.start));
  for(let i=0;i<intervals.length;i++)if(intervals[i].end<=intervals[i].start||(i>0&&intervals[i-1].end>intervals[i].start))ctx.addIssue({code:'custom',message:'Arbeitszeitfenster dürfen nicht leer sein oder überlappen.',path:['weekly']});
 }
});
export type BusinessCalendar=z.infer<typeof calendarSchema>;
function dayWindows(date:Temporal.PlainDate,c:BusinessCalendar){
 if(c.holidays.includes(date.toString()))return [];
 return c.weekly.filter(w=>w.day===date.dayOfWeek).sort((a,b)=>a.start.localeCompare(b.start)).map(w=>{
  const start=date.toZonedDateTime({timeZone:c.timeZone,plainTime:w.start});
  const end=w.end==='24:00'?date.add({days:1}).toZonedDateTime({timeZone:c.timeZone,plainTime:'00:00'}):date.toZonedDateTime({timeZone:c.timeZone,plainTime:w.end});
  return {start:Number(start.epochMilliseconds),end:Number(end.epochMilliseconds)};
 });
}
export function addBusinessMilliseconds(start:string|Date,amount:number,c:BusinessCalendar):string{
 if(!Number.isSafeInteger(amount)||amount<0)throw new Error('Geschäftsdauer muss eine nichtnegative ganzzahlige Millisekundenzahl sein.');
 let remaining=amount,cursor=new Date(start).getTime();if(!Number.isFinite(cursor))throw new Error('Ungültiger Startzeitpunkt.');
 if(!amount)return new Date(cursor).toISOString();
 let date=Temporal.Instant.fromEpochMilliseconds(cursor).toZonedDateTimeISO(c.timeZone).toPlainDate();
 for(let day=0;day<36600;day++,date=date.add({days:1})){
  for(const interval of dayWindows(date,c)){
   const from=Math.max(cursor,interval.start),available=interval.end-from;if(available<=0)continue;
   if(remaining<=available)return new Date(from+remaining).toISOString();remaining-=available;
  }
 }
 throw new Error('Kein ausreichendes Geschäftszeitfenster innerhalb von 100 Jahren.');
}
export function addBusinessMinutes(start:string|Date,minutes:number,c:BusinessCalendar){return addBusinessMilliseconds(start,minutes*60000,c);}
export function businessMilliseconds(start:string|Date,end:string|Date,c:BusinessCalendar):number{
 const from=new Date(start).getTime(),to=new Date(end).getTime();if(!Number.isFinite(from)||!Number.isFinite(to)||to<from)throw new Error('Ungültiges Geschäftszeitintervall.');
 let date=Temporal.Instant.fromEpochMilliseconds(from).toZonedDateTimeISO(c.timeZone).toPlainDate(),sum=0;
 for(let day=0;day<36600;day++,date=date.add({days:1})){
  const dayStart=Number(date.toZonedDateTime({timeZone:c.timeZone,plainTime:'00:00'}).epochMilliseconds);if(dayStart>=to)break;
  for(const interval of dayWindows(date,c))sum+=Math.max(0,Math.min(to,interval.end)-Math.max(from,interval.start));
 }
 return sum;
}
