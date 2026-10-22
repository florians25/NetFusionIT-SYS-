import { Injectable,NotFoundException,ConflictException,ForbiddenException } from '@nestjs/common';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { PoolClient } from 'pg';
import { Db,Principal,parse,uuid,audit,idempotent,ticketQuery,caseQuery } from './core';
import { requirePermission } from './permissions';
import { calendarSchema,BusinessCalendar,businessMilliseconds } from './calendar';
import { createDocument,checkOrg,document,relate,version } from './business';
const label=z.string().trim().min(2).max(160);
const assetInput=z.object({organizationId:uuid,partnerId:uuid,name:label,kind:z.enum(['SERVER','NOTEBOOK','PC','NETWORK','FIREWALL','PRINTER','SOFTWARE','LICENSE','INFRASTRUCTURE','OTHER']),manufacturer:z.string().max(100),model:z.string().max(100),serialNumber:z.string().max(100),inventoryNumber:z.string().max(100),location:z.string().max(250),installedOn:z.iso.date().nullable(),warrantyUntil:z.iso.date().nullable(),parentId:uuid.nullable(),contractId:uuid.nullable()}).strict();
const contractInput=z.object({organizationId:uuid,partnerId:uuid,name:label,kind:z.enum(['MANAGED','MAINTENANCE','HOURS','FLATRATE','SLA','WARRANTY','SINGLE']),validFrom:z.iso.date(),validTo:z.iso.date(),slaPolicyId:uuid.nullable(),scope:z.string().trim().min(5).max(10000)}).strict().refine(d=>d.validTo>=d.validFrom,'Gültigkeitsende liegt vor Beginn.');
export function calendarFrom(row:any):BusinessCalendar{return {timeZone:row.time_zone,weekly:row.weekly,holidays:row.holidays};}
@Injectable()
export class Operations {
 constructor(private db:Db){}
 async contextPartners(u:Principal){return this.db.as(u,async db=>{const q=ticketQuery(u);return (await db.query(`SELECT DISTINCT p.id,p.name,p.organization_id AS "organizationId" FROM business_partners p WHERE p.tenant_id=$1 AND p.status='ACTIVE' AND p.id IN(SELECT "partnerId" FROM (${q.sql}) visible_tickets) ORDER BY p.name`,q.values)).rows;});}
 async calendars(u:Principal){return this.db.as(u,async db=>(await db.query('SELECT id,name,organization_id AS "organizationId",time_zone AS "timeZone",weekly,holidays,version FROM service_calendars WHERE tenant_id=$1 AND organization_id=ANY($2::uuid[]) ORDER BY name',[u.tenantId,u.orgIds])).rows);}
 async saveCalendar(u:Principal,raw:unknown,key:unknown,correlation:string){
  requirePermission(u.role,'service.manage');
  const input=parse(z.object({name:label,organizationId:uuid,calendar:calendarSchema}).strict(),raw);checkOrg(u,input.organizationId);
  return this.db.as(u,db=>idempotent(db,u,'CALENDAR_CREATE',key,input,async()=>{
   const id=randomUUID();await db.query('INSERT INTO service_calendars(id,tenant_id,organization_id,name,time_zone,weekly,holidays) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,u.tenantId,input.organizationId,input.name,input.calendar.timeZone,JSON.stringify(input.calendar.weekly),JSON.stringify(input.calendar.holidays)]);
   await audit(db,u,correlation,'SERVICE_CALENDAR_CREATED',null,{calendarId:id,...input});return {id,version:1};
  }));
 }
 async policies(u:Principal){return this.db.as(u,async db=>(await db.query('SELECT p.id,p.name,p.organization_id AS "organizationId",p.calendar_id AS "calendarId",c.name AS "calendarName",p.response_minutes AS "responseMinutes",p.resolution_minutes AS "resolutionMinutes",p.pause_statuses AS "pauseStatuses",p.version,p.active FROM sla_policies p JOIN service_calendars c ON c.tenant_id=p.tenant_id AND c.id=p.calendar_id WHERE p.tenant_id=$1 AND p.organization_id=ANY($2::uuid[]) ORDER BY p.name',[u.tenantId,u.orgIds])).rows);}
 async createPolicy(u:Principal,raw:unknown,key:unknown,correlation:string){
  requirePermission(u.role,'service.manage');const input=parse(z.object({name:label,organizationId:uuid,calendarId:uuid,responseMinutes:z.number().int().min(1).max(525600),resolutionMinutes:z.number().int().min(1).max(525600),pauseStatuses:z.array(z.enum(['WAITING_CUSTOMER','WAITING_MATERIAL','WAITING_VENDOR'])).max(3)}).strict().refine(i=>i.resolutionMinutes>=i.responseMinutes,'Lösungsfrist muss mindestens Reaktionsfrist sein.'),raw);checkOrg(u,input.organizationId);
  return this.db.as(u,db=>idempotent(db,u,'SLA_POLICY_CREATE',key,input,async()=>{
   if(!(await db.query('SELECT 1 FROM service_calendars WHERE tenant_id=$1 AND id=$2 AND organization_id=$3',[u.tenantId,input.calendarId,input.organizationId])).rowCount)throw new NotFoundException('Servicekalender dieser Organisation fehlt.');
   const id=randomUUID();await db.query('INSERT INTO sla_policies(id,tenant_id,organization_id,calendar_id,name,response_minutes,resolution_minutes,pause_statuses) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[id,u.tenantId,input.organizationId,input.calendarId,input.name,input.responseMinutes,input.resolutionMinutes,input.pauseStatuses]);
   await audit(db,u,correlation,'SLA_POLICY_CREATED',null,{policyId:id,...input});return {id,version:1};
  }));
 }
 private partnerScope(u:Principal,alias:string){
  const values:unknown[]=[u.tenantId,u.orgIds];let condition='d.tenant_id=$1 AND d.organization_id=ANY($2::uuid[])';
  if(u.role==='CUSTOMER'){values.push(u.partnerId);condition+=` AND ${alias}.partner_id=$3`;}
  if(['TECHNICIAN','FIELD_TECHNICIAN'].includes(u.role)){const q=ticketQuery(u);return {condition:`${condition} AND ${alias}.partner_id IN(SELECT q."partnerId" FROM (${q.sql}) q)`,values:q.values};}
  return {condition,values};
 }
 async contracts(u:Principal){requirePermission(u.role,'contract.read');return this.db.as(u,async db=>{const q=this.partnerScope(u,'c');return (await db.query(`SELECT c.id,d.number,c.name,c.kind,c.status,c.partner_id AS "partnerId",p.name AS "partnerName",d.organization_id AS "organizationId",c.valid_from::text AS "validFrom",c.valid_to::text AS "validTo",c.sla_policy_id AS "slaPolicyId",c.scope,c.version FROM service_contracts c JOIN documents d ON d.tenant_id=c.tenant_id AND d.id=c.id JOIN business_partners p ON p.tenant_id=c.tenant_id AND p.id=c.partner_id WHERE ${q.condition} ORDER BY d.created_at DESC`,q.values)).rows;});}
 async createContract(u:Principal,raw:unknown,key:unknown,correlation:string){
  requirePermission(u.role,'contract.write');const input=parse(contractInput,raw);checkOrg(u,input.organizationId);
  return this.db.as(u,db=>idempotent(db,u,'CONTRACT_CREATE',key,input,async()=>{
   await this.activePartner(db,u,input.partnerId,input.organizationId);
   if(input.slaPolicyId&&!(await db.query('SELECT 1 FROM sla_policies WHERE tenant_id=$1 AND id=$2 AND organization_id=$3 AND active',[u.tenantId,input.slaPolicyId,input.organizationId])).rowCount)throw new NotFoundException('Aktive SLA-Policy fehlt.');
   const doc=await createDocument(db,u,'SERVICE_CONTRACT',input.kind==='MANAGED'?'MV':input.kind==='MAINTENANCE'?'WV':'KV',input.organizationId);
   await db.query('INSERT INTO service_contracts(id,tenant_id,partner_id,name,kind,valid_from,valid_to,sla_policy_id,scope) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[doc.id,u.tenantId,input.partnerId,input.name,input.kind,input.validFrom,input.validTo,input.slaPolicyId,input.scope]);
   await audit(db,u,correlation,'CONTRACT_CREATED',doc.id,input);return {...doc,status:'DRAFT',version:1};
  }));
 }
 async activateContract(u:Principal,id:string,raw:unknown,key:unknown,correlation:string){
  requirePermission(u.role,'contract.write');parse(uuid,id);const input=parse(z.object({version:z.number().int().positive(),status:z.enum(['ACTIVE','BLOCKED','EXPIRED'])}).strict(),raw);
  return this.db.as(u,db=>idempotent(db,u,'CONTRACT_STATUS:'+id,key,input,async()=>{
   const doc=await document(db,u,id,true),c=(await db.query('SELECT * FROM service_contracts WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[u.tenantId,id])).rows[0];if(!c)throw new NotFoundException('Vertrag nicht gefunden.');version(c.version,input.version);
   await this.activePartner(db,u,c.partner_id,doc.organization_id);
   await db.query('UPDATE service_contracts SET status=$3,version=version+1 WHERE tenant_id=$1 AND id=$2',[u.tenantId,id,input.status]);await audit(db,u,correlation,'CONTRACT_STATUS_CHANGED',id,{from:c.status,to:input.status});return {id,status:input.status,version:c.version+1};
  }));
 }
 async assets(u:Principal){requirePermission(u.role,'asset.read');return this.db.as(u,async db=>{const q=this.partnerScope(u,'a');return (await db.query(`SELECT a.id,d.number,a.name,a.kind,a.manufacturer,a.model,a.serial_number AS "serialNumber",a.inventory_number AS "inventoryNumber",a.location,a.installed_on::text AS "installedOn",a.warranty_until::text AS "warrantyUntil",a.parent_id AS "parentId",a.contract_id AS "contractId",a.partner_id AS "partnerId",p.name AS "partnerName",d.organization_id AS "organizationId",a.status,a.version FROM technical_objects a JOIN documents d ON d.tenant_id=a.tenant_id AND d.id=a.id JOIN business_partners p ON p.tenant_id=a.tenant_id AND p.id=a.partner_id WHERE ${q.condition} ORDER BY a.name`,q.values)).rows;});}
 async createAsset(u:Principal,raw:unknown,key:unknown,correlation:string){
  requirePermission(u.role,'asset.write');const input=parse(assetInput,raw);checkOrg(u,input.organizationId);
  return this.db.as(u,db=>idempotent(db,u,'ASSET_CREATE',key,input,async()=>{
   await this.activePartner(db,u,input.partnerId,input.organizationId);
   if(['TECHNICIAN','FIELD_TECHNICIAN'].includes(u.role)){
    const q=ticketQuery(u);q.values.push(input.partnerId);if(!(await db.query(`SELECT 1 FROM (${q.sql}) q WHERE "partnerId"=$${q.values.length}`,q.values)).rowCount)throw new ForbiddenException('Kein zugewiesener Kundenbezug für dieses technische Objekt.');
   }
   if(input.parentId&&!(await db.query('SELECT 1 FROM technical_objects a JOIN documents d ON d.tenant_id=a.tenant_id AND d.id=a.id WHERE a.tenant_id=$1 AND a.id=$2 AND a.partner_id=$3 AND d.organization_id=$4',[u.tenantId,input.parentId,input.partnerId,input.organizationId])).rowCount)throw new NotFoundException('Übergeordnetes Objekt desselben Kunden fehlt.');
   if(input.contractId&&!(await db.query('SELECT 1 FROM service_contracts c JOIN documents d ON d.tenant_id=c.tenant_id AND d.id=c.id WHERE c.tenant_id=$1 AND c.id=$2 AND c.partner_id=$3 AND d.organization_id=$4',[u.tenantId,input.contractId,input.partnerId,input.organizationId])).rowCount)throw new NotFoundException('Kundenvertrag fehlt.');
   const doc=await createDocument(db,u,'TECHNICAL_OBJECT','EQP',input.organizationId);
   await db.query('INSERT INTO technical_objects(id,tenant_id,partner_id,name,kind,manufacturer,model,serial_number,inventory_number,location,installed_on,warranty_until,parent_id,contract_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',[doc.id,u.tenantId,input.partnerId,input.name,input.kind,input.manufacturer,input.model,input.serialNumber,input.inventoryNumber,input.location,input.installedOn,input.warrantyUntil,input.parentId,input.contractId]);
   if(input.parentId)await relate(db,u,input.parentId,doc.id,'COMPONENT');
   if(input.contractId)await relate(db,u,doc.id,input.contractId,'COVERED_BY');
   await audit(db,u,correlation,'TECHNICAL_OBJECT_CREATED',doc.id,input);return {...doc,status:'ACTIVE',version:1};
  }));
 }
 async linkObject(u:Principal,id:string,raw:unknown,key:unknown,correlation:string){
  requirePermission(u.role,'asset.write');parse(uuid,id);const input=parse(z.object({objectId:uuid}).strict(),raw);
  return this.db.as(u,db=>idempotent(db,u,'CASE_OBJECT:'+id,key,input,async()=>{
   const q=caseQuery(u);q.values.push(id);const c=(await db.query(`SELECT * FROM (${q.sql}) q WHERE id=$${q.values.length}`,q.values)).rows[0];if(!c)throw new NotFoundException('Servicefall nicht gefunden.');
   const match=await db.query('SELECT 1 FROM technical_objects a JOIN service_cases c ON c.tenant_id=a.tenant_id AND c.partner_id=a.partner_id WHERE a.tenant_id=$1 AND a.id=$2 AND c.id=$3',[u.tenantId,input.objectId,id]);if(!match.rowCount)throw new NotFoundException('Technisches Objekt dieses Kunden fehlt.');
   await db.query('INSERT INTO case_objects VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[u.tenantId,id,input.objectId]);await relate(db,u,id,input.objectId,'AFFECTS');await audit(db,u,correlation,'CASE_OBJECT_LINKED',id,input);return {id,...input};
  }));
 }
 async activePartner(db:PoolClient,u:Principal,id:string,organizationId:string){const p=(await db.query("SELECT * FROM business_partners WHERE tenant_id=$1 AND id=$2 AND organization_id=$3 AND status='ACTIVE'",[u.tenantId,id,organizationId])).rows[0];if(!p)throw new NotFoundException('Aktiver Kunde dieser Organisation fehlt.');return p;}
}
