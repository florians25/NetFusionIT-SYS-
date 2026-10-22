import { Injectable,ConflictException,NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import { Db,Principal,ticketQuery,audit,parse,uuid } from './core';
import { BusinessCalendar,addBusinessMinutes,addBusinessMilliseconds,businessMilliseconds } from './calendar';
interface Snapshot extends BusinessCalendar { policyId:string;policyName:string;policyVersion:number;calendarId:string;calendarVersion:number;responseMinutes:number;resolutionMinutes:number;pauseStatuses:string[]; }
@Injectable()
export class Sla {
 private timer?:ReturnType<typeof setInterval>;private sweeping=false;
 constructor(private db:Db){}
 async attachWithin(db:PoolClient,u:Principal,ticketId:string,contractId:string,organizationId:string,partnerId:string,startedAt:Date){
  const r=await db.query(`SELECT c.id,c.valid_from::text AS "validFrom",c.valid_to::text AS "validTo",c.sla_policy_id,p.name,p.id AS "policyId",p.version AS "policyVersion",p.response_minutes,p.resolution_minutes,p.pause_statuses,cal.id AS "calendarId",cal.version AS "calendarVersion",cal.time_zone,cal.weekly,cal.holidays FROM service_contracts c JOIN documents d ON d.tenant_id=c.tenant_id AND d.id=c.id LEFT JOIN sla_policies p ON p.tenant_id=c.tenant_id AND p.id=c.sla_policy_id AND p.active LEFT JOIN service_calendars cal ON cal.tenant_id=p.tenant_id AND cal.id=p.calendar_id WHERE c.tenant_id=$1 AND c.id=$2 AND c.partner_id=$3 AND d.organization_id=$4 AND c.status='ACTIVE'`,[u.tenantId,contractId,partnerId,organizationId]);
  if(!r.rowCount)throw new NotFoundException('Aktiver Servicevertrag dieses Kunden nicht gefunden.');
  const c=r.rows[0];
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:c.time_zone||'UTC',year:'numeric',month:'2-digit',day:'2-digit'}).format(startedAt);
  if(today<c.validFrom||today>c.validTo)throw new ConflictException('Servicevertrag ist am Eingangsdatum nicht gültig.');
  if(!c.sla_policy_id)return;
  if(!c.policyId||!c.calendarId)throw new ConflictException('Aktive SLA-Policy oder Servicekalender fehlt.');
  const snapshot:Snapshot={policyId:c.policyId,policyName:c.name,policyVersion:c.policyVersion,calendarId:c.calendarId,calendarVersion:c.calendarVersion,timeZone:c.time_zone,weekly:c.weekly,holidays:c.holidays,responseMinutes:c.response_minutes,resolutionMinutes:c.resolution_minutes,pauseStatuses:c.pause_statuses};
  const response=addBusinessMinutes(startedAt,snapshot.responseMinutes,snapshot),resolution=addBusinessMinutes(startedAt,snapshot.resolutionMinutes,snapshot);
  await db.query('INSERT INTO ticket_sla(tenant_id,ticket_id,contract_id,snapshot,response_due,resolution_due) VALUES($1,$2,$3,$4,$5,$6)',[u.tenantId,ticketId,contractId,JSON.stringify(snapshot),response,resolution]);
  await this.event(db,u.tenantId,ticketId,'STARTED',{policyId:snapshot.policyId,policyVersion:snapshot.policyVersion,responseDue:response,resolutionDue:resolution});
 }
 private async event(db:PoolClient,tenant:string,ticketId:string,kind:string,details:unknown){await db.query('INSERT INTO sla_events(id,tenant_id,ticket_id,kind,details) VALUES($1,$2,$3,$4,$5)',[randomUUID(),tenant,ticketId,kind,JSON.stringify(details)]);}
 private async breaches(db:PoolClient,tenant:string,s:any,now:Date){
  if(s.terminated_at)return;
  const effective=s.paused_at?new Date(s.paused_at):now;
  for(const [type,due,met] of [['RESPONSE',s.response_due,s.responded_at],['RESOLUTION',s.resolution_due,s.resolved_at]] as const){
   // Auch verspätet erfüllte Fristen bleiben historische Verletzungen.
   const actual=met?new Date(met):effective;
   if(actual>new Date(due))await db.query("INSERT INTO sla_events(id,tenant_id,ticket_id,kind,deadline_type,due_at,details) VALUES($1,$2,$3,'BREACH',$4,$5,$6) ON CONFLICT(tenant_id,ticket_id,deadline_type) WHERE kind='BREACH' DO NOTHING",[randomUUID(),tenant,s.ticket_id,type,due,JSON.stringify({observedAt:now.toISOString()})]);
  }
 }
 async transitionWithin(db:PoolClient,u:Principal,ticketId:string,to:string,at=new Date()){
  const s=(await db.query('SELECT * FROM ticket_sla WHERE tenant_id=$1 AND ticket_id=$2 FOR UPDATE',[u.tenantId,ticketId])).rows[0];if(!s)return;
  await this.breaches(db,u.tenantId,s,at);
  const snapshot=s.snapshot as Snapshot;
  if(to==='CANCELLED'){
   await db.query('UPDATE ticket_sla SET terminated_at=$3,paused_at=null,version=version+1 WHERE tenant_id=$1 AND ticket_id=$2',[u.tenantId,ticketId,at]);await this.event(db,u.tenantId,ticketId,'TERMINATED',{reason:'TICKET_CANCELLED'});return;
  }
  if(s.terminated_at)throw new ConflictException('Beendete SLA kann nicht stillschweigend wieder gestartet werden.');
  let response=s.response_due,resolution=s.resolution_due,paused=s.paused_at;
  if(paused&&!snapshot.pauseStatuses.includes(to)){
   const duration=businessMilliseconds(paused,at,snapshot);
   if(!s.responded_at)response=addBusinessMilliseconds(response,duration,snapshot);
   if(!s.resolved_at)resolution=addBusinessMilliseconds(resolution,duration,snapshot);
   await this.event(db,u.tenantId,ticketId,'RESUMED',{pausedBusinessMilliseconds:duration});paused=null;
  }
  const responded=s.responded_at||(to!=='NEW'?at:null);
  const resolved=s.resolved_at||(['TECHNICALLY_RESOLVED','COMMERCIALLY_CLOSED','CLOSED'].includes(to)?at:null);
  if(!paused&&snapshot.pauseStatuses.includes(to)&&!resolved){paused=at;await this.event(db,u.tenantId,ticketId,'PAUSED',{status:to});}
  if(to==='REOPENED'&&s.resolved_at)throw new ConflictException('Wiedereröffnung eines SLA-Tickets benötigt eine fachliche SLA-Folgeentscheidung statt Rücksetzen der Historie.');
  await db.query('UPDATE ticket_sla SET response_due=$3,resolution_due=$4,responded_at=$5,resolved_at=$6,paused_at=$7,version=version+1 WHERE tenant_id=$1 AND ticket_id=$2',[u.tenantId,ticketId,response,resolution,responded,resolved,paused]);
 }
 async detail(u:Principal,id:string){parse(uuid,id);return this.db.as(u,async db=>{
  const q=ticketQuery(u);q.values.push(id);if(!(await db.query(`SELECT 1 FROM (${q.sql}) q WHERE id=$${q.values.length}`,q.values)).rowCount)throw new NotFoundException('Ticket nicht gefunden.');
  const s=(await db.query('SELECT contract_id AS "contractId",snapshot,response_due AS "responseDue",resolution_due AS "resolutionDue",responded_at AS "respondedAt",resolved_at AS "resolvedAt",paused_at AS "pausedAt",terminated_at AS "terminatedAt",version FROM ticket_sla WHERE tenant_id=$1 AND ticket_id=$2',[u.tenantId,id])).rows[0];
  if(!s)return {sla:null,events:[]};return {sla:s,events:(await db.query('SELECT id,kind,deadline_type AS "deadlineType",due_at AS "dueAt",created_at AS "createdAt",details FROM sla_events WHERE tenant_id=$1 AND ticket_id=$2 ORDER BY created_at,id',[u.tenantId,id])).rows};
 });}
 async sweep(u:Principal){return this.db.as(u,async db=>{const q=ticketQuery(u);const rows=await db.query(`SELECT s.* FROM ticket_sla s WHERE s.ticket_id IN(SELECT id FROM (${q.sql}) q) AND s.terminated_at IS NULL`,q.values);for(const row of rows.rows)await this.breaches(db,u.tenantId,row,new Date());return {checked:rows.rowCount};});}
 onModuleInit(){if(process.env.NODE_ENV==='test')return;this.timer=setInterval(()=>{void this.systemSweep();},60000);this.timer.unref();}
 async onApplicationShutdown(){if(this.timer)clearInterval(this.timer);}
 private async systemSweep(){
  if(this.sweeping)return;this.sweeping=true;
  try{
   const tenants=await this.db.pool.query('SELECT id,slug,name FROM tenants');
   for(const t of tenants.rows){
    const system:Principal={id:'00000000-0000-4000-8000-000000000001',tenantId:t.id,tenantSlug:t.slug,tenantName:t.name,name:'SLA-Systemdienst',email:'',role:'ADMIN',partnerId:null,orgIds:[]};
    system.orgIds=await this.db.as(system,async db=>(await db.query('SELECT id FROM organizations WHERE tenant_id=$1',[t.id])).rows.map(o=>o.id));
    await this.sweep(system); // SLA-Ereignisse besitzen bewusst keinen vorgetäuschten menschlichen Actor.
   }
  }catch(e){console.error(JSON.stringify({level:'error',event:'sla_sweep_failed',type:(e as Error).name}));}finally{this.sweeping=false;}
 }
}
