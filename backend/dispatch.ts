import { Injectable,NotFoundException,ConflictException,ForbiddenException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { PoolClient } from 'pg';
import { Db,Principal,parse,uuid,audit,idempotent,caseQuery } from './core';
import { requirePermission } from './permissions';
import { calendarFrom } from './operations';
import { businessMilliseconds } from './calendar';
import { createDocument,document,relate,version } from './business';
const visitInput=z.object({caseId:uuid,title:z.string().trim().min(3).max(160),location:z.string().trim().min(2).max(250),startsAt:z.iso.datetime({offset:true}),endsAt:z.iso.datetime({offset:true}),technicianIds:z.array(uuid).min(1).max(20),requiredSkills:z.array(z.string().trim().min(1).max(80)).max(30)}).strict().refine(i=>new Date(i.endsAt)>new Date(i.startsAt)&&new Date(i.endsAt).getTime()-new Date(i.startsAt).getTime()<=86400000,'Ein Termin muss positiv und höchstens 24 Stunden lang sein. Mehrtägige Arbeit in mehrere Termine aufteilen.');
export const visitTransitions:Record<string,string[]>={PLANNED:['ASSIGNED','CANCELLED'],ASSIGNED:['CONFIRMED','CANCELLED'],CONFIRMED:['TRAVELING','ONSITE','CANCELLED'],TRAVELING:['ONSITE','INTERRUPTED'],ONSITE:['IN_PROGRESS','INTERRUPTED'],IN_PROGRESS:['INTERRUPTED','TECHNICALLY_COMPLETED'],INTERRUPTED:['TRAVELING','ONSITE','IN_PROGRESS','CANCELLED'],TECHNICALLY_COMPLETED:['ACCEPTED'],ACCEPTED:[],CANCELLED:[]};
@Injectable()
export class Dispatch {
 constructor(private db:Db){}
 async technicianProfiles(u:Principal){
  requirePermission(u.role,'service.read');return this.db.as(u,async db=>(await db.query("SELECT t.id,t.name,t.skills,t.location,t.certifications,t.calendar_id AS \"calendarId\",t.organization_id AS \"organizationId\",t.version,t.active FROM technicians t JOIN users usr ON usr.tenant_id=t.tenant_id AND usr.id=t.user_id WHERE t.tenant_id=$1 AND t.organization_id=ANY($2::uuid[]) AND t.active AND usr.active AND ($3::boolean OR t.user_id=$4) ORDER BY t.name",[u.tenantId,u.orgIds,!['TECHNICIAN','FIELD_TECHNICIAN','CUSTOMER'].includes(u.role),u.id])).rows);
 }
 async profile(u:Principal,id:string,raw:unknown,key:unknown,correlation:string){
  requirePermission(u.role,'service.assign');parse(uuid,id);const input=parse(z.object({version:z.number().int().positive(),calendarId:uuid,skills:z.array(z.string().trim().min(1).max(80)).max(30),location:z.string().max(250),certifications:z.array(z.object({name:z.string().min(2).max(100),validUntil:z.iso.date()}).strict()).max(30)}).strict(),raw);
  return this.db.as(u,db=>idempotent(db,u,'TECHNICIAN_PROFILE:'+id,key,input,async()=>{
   const t=(await db.query('SELECT * FROM technicians WHERE tenant_id=$1 AND id=$2 AND organization_id=ANY($3::uuid[]) FOR UPDATE',[u.tenantId,id,u.orgIds])).rows[0];if(!t)throw new NotFoundException('Techniker nicht gefunden.');version(t.version,input.version);
   if(!(await db.query('SELECT 1 FROM service_calendars WHERE tenant_id=$1 AND id=$2 AND organization_id=$3',[u.tenantId,input.calendarId,t.organization_id])).rowCount)throw new NotFoundException('Arbeitszeitkalender dieser Organisation fehlt.');
   await db.query('UPDATE technicians SET calendar_id=$3,skills=$4,location=$5,certifications=$6,version=version+1 WHERE tenant_id=$1 AND id=$2',[u.tenantId,id,input.calendarId,input.skills,input.location,JSON.stringify(input.certifications)]);await audit(db,u,correlation,'TECHNICIAN_PROFILE_CHANGED',null,{technicianId:id,version:t.version+1});return {id,version:t.version+1};
  }));
 }
 async absences(u:Principal){requirePermission(u.role,'service.assign');return this.db.as(u,async db=>(await db.query('SELECT a.id,a.technician_id AS "technicianId",t.name AS "technicianName",a.starts_at AS "startsAt",a.ends_at AS "endsAt",a.reason FROM technician_absences a JOIN technicians t ON t.tenant_id=a.tenant_id AND t.id=a.technician_id WHERE a.tenant_id=$1 AND t.organization_id=ANY($2::uuid[]) ORDER BY a.starts_at DESC LIMIT 500',[u.tenantId,u.orgIds])).rows);}
 async absence(u:Principal,raw:unknown,key:unknown,correlation:string){
  requirePermission(u.role,'service.assign');const input=parse(z.object({technicianId:uuid,startsAt:z.iso.datetime({offset:true}),endsAt:z.iso.datetime({offset:true}),reason:z.string().trim().min(3).max(250)}).strict().refine(i=>new Date(i.endsAt)>new Date(i.startsAt),'Ungültiges Abwesenheitsintervall.'),raw);
  return this.db.as(u,db=>idempotent(db,u,'TECHNICIAN_ABSENCE',key,input,async()=>{
   const t=(await db.query('SELECT id FROM technicians WHERE tenant_id=$1 AND id=$2 AND organization_id=ANY($3::uuid[])',[u.tenantId,input.technicianId,u.orgIds])).rows[0];if(!t)throw new NotFoundException('Techniker nicht gefunden.');await this.lockTechnicians(db,u,[input.technicianId]);
   const busy=await db.query("SELECT 1 FROM field_visits v JOIN visit_technicians vt ON vt.tenant_id=v.tenant_id AND vt.visit_id=v.id WHERE v.tenant_id=$1 AND vt.technician_id=$2 AND v.status NOT IN ('CANCELLED','ACCEPTED','TECHNICALLY_COMPLETED') AND v.starts_at<$4 AND v.ends_at>$3",[u.tenantId,input.technicianId,input.startsAt,input.endsAt]);
   if(busy.rowCount)throw new ConflictException('Abwesenheit überschneidet einen geplanten Einsatz. Erst Einsätze umplanen.');
   const id=randomUUID();await db.query('INSERT INTO technician_absences VALUES($1,$2,$3,$4,$5,$6)',[id,u.tenantId,input.technicianId,input.startsAt,input.endsAt,input.reason]);await audit(db,u,correlation,'TECHNICIAN_ABSENCE_CREATED',null,{id,...input});return {id};
  }));
 }
 private async lockTechnicians(db:PoolClient,u:Principal,ids:string[]){for(const id of [...new Set(ids)].sort())await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`DISPATCH:${u.tenantId}:${id}`]);}
 private async available(db:PoolClient,u:Principal,id:string,org:string,start:string,end:string,skills:string[],exclude:string|null=null){
  const t=(await db.query("SELECT t.*,c.time_zone,c.weekly,c.holidays FROM technicians t JOIN users usr ON usr.tenant_id=t.tenant_id AND usr.id=t.user_id LEFT JOIN service_calendars c ON c.tenant_id=t.tenant_id AND c.id=t.calendar_id WHERE t.tenant_id=$1 AND t.id=$2 AND t.organization_id=$3 AND t.active AND usr.active AND usr.role IN ('TECHNICIAN','FIELD_TECHNICIAN')",[u.tenantId,id,org])).rows[0];
  if(!t)return {available:false,reason:'Aktiver Techniker dieser Organisation fehlt.'};
  if(!t.calendar_id)return {available:false,reason:'Arbeitszeitkalender fehlt.'};
  if(skills.some(s=>!t.skills.includes(s)))return {available:false,reason:'Erforderliche Qualifikation fehlt.'};
  const duration=new Date(end).getTime()-new Date(start).getTime();
  if(businessMilliseconds(start,end,calendarFrom(t))!==duration)return {available:false,reason:'Außerhalb der Arbeits-/Servicezeiten oder an einem Feiertag.'};
  if((await db.query('SELECT 1 FROM technician_absences WHERE tenant_id=$1 AND technician_id=$2 AND starts_at<$4 AND ends_at>$3',[u.tenantId,id,start,end])).rowCount)return {available:false,reason:'Abwesenheit im Zeitraum.'};
  const busy=await db.query("SELECT 1 FROM field_visits v JOIN visit_technicians vt ON vt.tenant_id=v.tenant_id AND vt.visit_id=v.id WHERE v.tenant_id=$1 AND vt.technician_id=$2 AND v.status NOT IN ('CANCELLED','ACCEPTED','TECHNICALLY_COMPLETED') AND v.starts_at<$4 AND v.ends_at>$3 AND ($5::uuid IS NULL OR v.id<>$5)",[u.tenantId,id,start,end,exclude]);
  if(busy.rowCount)return {available:false,reason:'Überschneidung mit bestehendem Einsatz.'};return {available:true,reason:'Qualifikation, Arbeitszeit und Verfügbarkeit passen.'};
 }
 async visits(u:Principal){return this.db.as(u,async db=>{
  const q=caseQuery(u);return (await db.query(`SELECT v.id,d.number,v.case_id AS "caseId",v.title,v.location,v.starts_at AS "startsAt",v.ends_at AS "endsAt",v.status,v.version,v.required_skills AS "requiredSkills",(SELECT jsonb_agg(jsonb_build_object('id',t.id,'name',t.name)) FROM visit_technicians vt JOIN technicians t ON t.tenant_id=vt.tenant_id AND t.id=vt.technician_id WHERE vt.tenant_id=v.tenant_id AND vt.visit_id=v.id) AS technicians FROM field_visits v JOIN documents d ON d.tenant_id=v.tenant_id AND d.id=v.id WHERE v.case_id IN(SELECT id FROM (${q.sql}) q) ${['TECHNICIAN','FIELD_TECHNICIAN'].includes(u.role)?'AND EXISTS(SELECT 1 FROM visit_technicians own JOIN technicians tech ON tech.tenant_id=own.tenant_id AND tech.id=own.technician_id WHERE own.tenant_id=v.tenant_id AND own.visit_id=v.id AND tech.user_id=$3)':''} ORDER BY v.starts_at DESC LIMIT 500`,q.values)).rows;
 });}
 async create(u:Principal,raw:unknown,key:unknown,correlation:string){
  requirePermission(u.role,'service.assign');const input=parse(visitInput,raw);
  if(new Set(input.technicianIds).size!==input.technicianIds.length)throw new ConflictException('Techniker darf nicht mehrfach zugewiesen werden.');
  return this.db.as(u,db=>idempotent(db,u,'FIELD_VISIT_CREATE',key,input,async()=>{
   const q=caseQuery(u);q.values.push(input.caseId);if(!(await db.query(`SELECT 1 FROM (${q.sql}) q WHERE id=$${q.values.length}`,q.values)).rowCount)throw new NotFoundException('Servicefall nicht gefunden.');
   const parent=await document(db,u,input.caseId);await this.lockTechnicians(db,u,input.technicianIds);
   for(const id of input.technicianIds){const result=await this.available(db,u,id,parent.organization_id,input.startsAt,input.endsAt,input.requiredSkills);if(!result.available)throw new ConflictException(result.reason);}
   const doc=await createDocument(db,u,'FIELD_VISIT','VIS',parent.organization_id);
   await db.query("INSERT INTO field_visits(id,tenant_id,case_id,title,location,starts_at,ends_at,required_skills,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'ASSIGNED')",[doc.id,u.tenantId,input.caseId,input.title,input.location,input.startsAt,input.endsAt,input.requiredSkills]);
   for(const id of input.technicianIds)await db.query('INSERT INTO visit_technicians VALUES($1,$2,$3)',[u.tenantId,doc.id,id]);
   await relate(db,u,input.caseId,doc.id,'SCHEDULED_VISIT');await audit(db,u,correlation,'FIELD_VISIT_PLANNED',doc.id,input);return {...doc,status:'ASSIGNED',version:1};
  }));
 }
 async status(u:Principal,id:string,raw:unknown,key:unknown,correlation:string){
  parse(uuid,id);const input=parse(z.object({version:z.number().int().positive(),status:z.string().min(2).max(40)}).strict(),raw);
  return this.db.as(u,db=>idempotent(db,u,'FIELD_VISIT_STATUS:'+id,key,input,async()=>{
   await document(db,u,id,true);const v=(await db.query('SELECT * FROM field_visits WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[u.tenantId,id])).rows[0];if(!v)throw new NotFoundException('Einsatz nicht gefunden.');version(v.version,input.version);
   if(u.role==='CUSTOMER'){if(input.status!=='ACCEPTED')throw new ForbiddenException('Kunden dürfen nur technisch abgeschlossene Einsätze abnehmen.');const q=caseQuery(u);q.values.push(v.case_id);if(!(await db.query(`SELECT 1 FROM (${q.sql}) q WHERE id=$${q.values.length}`,q.values)).rowCount)throw new NotFoundException('Einsatz nicht gefunden.');}
   else if(['TECHNICIAN','FIELD_TECHNICIAN'].includes(u.role)){
    if(!(await db.query('SELECT 1 FROM visit_technicians vt JOIN technicians t ON t.tenant_id=vt.tenant_id AND t.id=vt.technician_id WHERE vt.tenant_id=$1 AND vt.visit_id=$2 AND t.user_id=$3',[u.tenantId,id,u.id])).rowCount)throw new NotFoundException('Eigener Einsatz nicht gefunden.');
    if(['ACCEPTED','CANCELLED'].includes(input.status))throw new ForbiddenException('Abnahme/Storno erfordert Kunde oder Disposition.');
   }else requirePermission(u.role,'service.assign');
   if(!visitTransitions[v.status]?.includes(input.status))throw new ConflictException('Einsatzstatuswechsel nicht zulässig.');
   await db.query('UPDATE field_visits SET status=$3,version=version+1 WHERE tenant_id=$1 AND id=$2',[u.tenantId,id,input.status]);await audit(db,u,correlation,'FIELD_VISIT_STATUS_CHANGED',id,{from:v.status,to:input.status});return {id,status:input.status,version:v.version+1};
  }));
 }
 async recommendations(u:Principal,raw:unknown){
  requirePermission(u.role,'service.assign');const input=parse(z.object({caseId:uuid,startsAt:z.iso.datetime({offset:true}),endsAt:z.iso.datetime({offset:true}),requiredSkills:z.array(z.string().min(1).max(80)).max(30)}).strict().refine(i=>new Date(i.endsAt)>new Date(i.startsAt)&&new Date(i.endsAt).getTime()-new Date(i.startsAt).getTime()<=86400000,'Ungültiges Terminintervall.'),raw);
  return this.db.as(u,async db=>{const parent=await document(db,u,input.caseId);if(parent.kind!=='SERVICE_CASE')throw new NotFoundException('Servicefall fehlt.');const technicians=(await db.query('SELECT id,name FROM technicians WHERE tenant_id=$1 AND organization_id=$2 AND active ORDER BY name',[u.tenantId,parent.organization_id])).rows;const result=[];
   for(const t of technicians){const a=await this.available(db,u,t.id,parent.organization_id,input.startsAt,input.endsAt,input.requiredSkills);const load=Number((await db.query("SELECT count(*) FROM visit_technicians vt JOIN field_visits v ON v.tenant_id=vt.tenant_id AND v.id=vt.visit_id WHERE vt.tenant_id=$1 AND vt.technician_id=$2 AND v.status NOT IN ('CANCELLED','ACCEPTED','TECHNICALLY_COMPLETED')",[u.tenantId,t.id])).rows[0].count);result.push({...t,...a,activeVisits:load});}
   return result.sort((a,b)=>Number(b.available)-Number(a.available)||a.activeVisits-b.activeVisits||a.name.localeCompare(b.name));
  });
 }
}
