import {ConflictException,Injectable} from '@nestjs/common';
import {z} from 'zod';
import {numberCatalog} from './number-catalog';
import {Db,Principal,parse,audit,idempotent} from './core';
import {requirePermission} from './permissions';
import {version} from './business';
import {ensureNumberSeries} from './number-allocation';
@Injectable()
export class NumberSeries{
 constructor(private db:Db){}
 async list(u:Principal){requirePermission(u.role,'admin.write');return this.db.as(u,async db=>{await ensureNumberSeries(db,u.tenantId);return (await db.query('SELECT prefix,name,range_start AS "rangeStart",range_end AS "rangeEnd",CASE WHEN current_value>=range_start THEN current_value END AS "currentValue",CASE WHEN current_value<range_end THEN current_value+1 END AS "nextValue",current_value-range_start+1 AS allocated,range_end-current_value AS remaining,active,version FROM business_number_series WHERE tenant_id=$1 ORDER BY range_start',[u.tenantId])).rows;});}
 async change(u:Principal,prefix:string,raw:unknown,key:unknown,corr:string){requirePermission(u.role,'admin.write');if(!numberCatalog.some(s=>s.prefix===prefix))throw new ConflictException('Unbekannter Nummernkreis.');const i=parse(z.object({version:z.number().int().positive(),active:z.boolean(),nextValue:z.number().int().min(10000000).max(89999999).nullable(),reason:z.string().trim().min(5).max(1000)}).strict(),raw);return this.db.as(u,db=>idempotent(db,u,'NUMBER_SERIES:'+prefix,key,i,async()=>{
  await ensureNumberSeries(db,u.tenantId,prefix);const s=(await db.query('SELECT * FROM business_number_series WHERE tenant_id=$1 AND prefix=$2 FOR UPDATE',[u.tenantId,prefix])).rows[0];version(s.version,i.version);if(i.nextValue!==null&&(i.nextValue<=s.current_value||i.nextValue>s.range_end))throw new ConflictException('Nächste Nummer muss vorwärts innerhalb des festen Bereichs liegen.');
  await db.query('UPDATE business_number_series SET active=$3,current_value=$4,version=version+1 WHERE tenant_id=$1 AND prefix=$2',[u.tenantId,prefix,i.active,i.nextValue===null?s.current_value:i.nextValue-1]);await audit(db,u,corr,'NUMBER_SERIES_CHANGED',null,{prefix,from:s.current_value,to:i.nextValue===null?s.current_value:i.nextValue-1,active:i.active,reason:i.reason});return {prefix,version:s.version+1};
 }));}
}
