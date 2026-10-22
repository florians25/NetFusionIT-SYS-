import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';

export type Role='ADMIN'|'DISPATCHER'|'SUPPORT'|'TECHNICIAN'|'CUSTOMER';
export interface Principal { id:string; tenantId:string; tenantName:string; tenantSlug:string; name:string; email:string; role:Role; partnerId:string|null; orgIds:string[]; }
export const uuid=z.uuid();
export function parse<T>(schema:z.ZodType<T>,value:unknown):T {
  const result=schema.safeParse(value);
  if(!result.success) throw new BadRequestException(result.error.issues.map(i=>`${i.path.join('.')||'Eingabe'}: ${i.message}`).join('; '));
  return result.data;
}
export const ticketInput=z.object({
  title:z.string().trim().min(5).max(160), description:z.string().trim().min(10).max(10000),
  type:z.enum(['INCIDENT','SERVICE_REQUEST','PROBLEM','CHANGE','MAINTENANCE','REPAIR','INSTALLATION','COMPLAINT','WARRANTY','INTERNAL']),
  priority:z.enum(['LOW','MEDIUM','HIGH','CRITICAL']), partnerId:uuid.optional()
}).strict();
export const transitions:Record<string,string[]>={
  NEW:['QUALIFYING','ESCALATED','CANCELLED'], QUALIFYING:['ESCALATED','CANCELLED'],
  ASSIGNED:['IN_PROGRESS','ESCALATED','CANCELLED'],
  IN_PROGRESS:['WAITING_CUSTOMER','WAITING_MATERIAL','WAITING_VENDOR','TECHNICALLY_RESOLVED','ESCALATED','CANCELLED'],
  WAITING_CUSTOMER:['IN_PROGRESS','ESCALATED','CANCELLED'], WAITING_MATERIAL:['IN_PROGRESS','ESCALATED','CANCELLED'], WAITING_VENDOR:['IN_PROGRESS','ESCALATED','CANCELLED'],
  TECHNICALLY_RESOLVED:['COMMERCIALLY_CLOSED','REOPENED'], COMMERCIALLY_CLOSED:['CLOSED'],
  CLOSED:['REOPENED'], ESCALATED:['IN_PROGRESS','CANCELLED'], REOPENED:['IN_PROGRESS','CANCELLED'], CANCELLED:[]
};
export function allowedTransitions(role:Role,status:string) {
  if(role==='CUSTOMER') return [];
  return (transitions[status]||[]).filter(s=>{
    if(['COMMERCIALLY_CLOSED','CLOSED','CANCELLED'].includes(s)) return ['ADMIN','DISPATCHER'].includes(role);
    return true;
  });
}
@Injectable()
export class Db {
  readonly pool:Pool;
  constructor(){
    if(!process.env.DATABASE_URL) throw new Error('DATABASE_URL fehlt.');
    this.pool=new Pool({connectionString:process.env.DATABASE_URL,max:10,connectionTimeoutMillis:5000,idleTimeoutMillis:30000});
    this.pool.on('error',()=>console.error(JSON.stringify({level:'error',event:'database_connection_error'})));
  }
  async as<T>(u:Principal,fn:(db:PoolClient)=>Promise<T>):Promise<T>{
    const db=await this.pool.connect();
    try{
      await db.query('BEGIN');
      await db.query("SELECT set_config('app.tenant_id',$1,true)",[u.tenantId]);
      const result=await fn(db);await db.query('COMMIT');return result;
    }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
  }
  async onApplicationShutdown(){await this.pool.end();}
}
export async function nextNumber(db:PoolClient,tenant:string,kind:string){
  const year=new Date().getUTCFullYear();
  const r=await db.query('INSERT INTO number_ranges(tenant_id,kind,year,current_value) VALUES($1,$2,$3,1) ON CONFLICT(tenant_id,kind,year) DO UPDATE SET current_value=number_ranges.current_value+1 RETURNING current_value',[tenant,kind,year]);
  return `${kind}-${year}-${String(r.rows[0].current_value).padStart(6,'0')}`;
}
export async function audit(db:PoolClient,u:Principal,correlation:string,action:string,document:string|null,details:unknown={}){
  await db.query('INSERT INTO audit_events(id,tenant_id,document_id,actor_id,action,correlation_id,details) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),u.tenantId,document,u.id,action,correlation,JSON.stringify(details)]);
}
export async function idempotent<T>(db:PoolClient,u:Principal,scope:string,key:unknown,payload:unknown,fn:()=>Promise<T>):Promise<T>{
  const id=parse(uuid,key);
  const hash=createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`${u.tenantId}:${u.id}:${scope}:${id}`]);
  const previous=await db.query('SELECT request_hash,response FROM idempotency_keys WHERE tenant_id=$1 AND actor_id=$2 AND scope=$3 AND key=$4',[u.tenantId,u.id,scope,id]);
  if(previous.rowCount){
    if(previous.rows[0].request_hash!==hash) throw new ConflictException('Idempotency-Key wurde mit anderem Inhalt verwendet.');
    return previous.rows[0].response;
  }
  const result=await fn();
  await db.query('INSERT INTO idempotency_keys(tenant_id,actor_id,scope,key,request_hash,response) VALUES($1,$2,$3,$4,$5,$6)',[u.tenantId,u.id,scope,id,hash,JSON.stringify(result)]);
  return result;
}
export function ticketQuery(u:Principal){
  const values:unknown[]=[u.tenantId,u.orgIds];
  let condition='d.tenant_id=$1 AND d.organization_id=ANY($2::uuid[])';
  if(u.role==='CUSTOMER'){values.push(u.partnerId);condition+=` AND t.partner_id=$${values.length}`;}
  if(u.role==='TECHNICIAN'){values.push(u.id);condition+=` AND EXISTS(SELECT 1 FROM dispatch_assignments a JOIN technicians tech ON tech.tenant_id=a.tenant_id AND tech.id=a.technician_id WHERE a.tenant_id=t.tenant_id AND a.ticket_id=t.id AND a.active AND tech.user_id=$${values.length})`;}
  const sql=`SELECT t.id,d.number,t.title,t.description,t.type,t.priority,t.status,t.version,t.source,
    t.correlation_id AS "correlationId",t.case_id AS "caseId",cd.number AS "caseNumber",
    p.id AS "partnerId",p.name AS "partnerName",p.email AS "partnerEmail",d.organization_id AS "organizationId",
    d.created_at AS "createdAt",t.updated_at AS "updatedAt",tech.id AS "technicianId",coalesce(tech.name,'Nicht zugewiesen') AS "technicianName"
    FROM tickets t JOIN documents d ON d.tenant_id=t.tenant_id AND d.id=t.id
    JOIN business_partners p ON p.tenant_id=t.tenant_id AND p.id=t.partner_id
    JOIN documents cd ON cd.tenant_id=t.tenant_id AND cd.id=t.case_id
    LEFT JOIN dispatch_assignments da ON da.tenant_id=t.tenant_id AND da.ticket_id=t.id AND da.active
    LEFT JOIN technicians tech ON tech.tenant_id=da.tenant_id AND tech.id=da.technician_id WHERE ${condition}`;
  return {sql,values};
}
export function caseQuery(u:Principal){
  const tickets=ticketQuery(u);
  return {sql:`SELECT sc.id,d.number,sc.title,sc.operational_status AS status,sc.technical_status AS "technicalStatus",sc.commercial_status AS "commercialStatus",sc.version,p.name AS "partnerName",d.created_at AS "createdAt" FROM service_cases sc JOIN documents d ON d.tenant_id=sc.tenant_id AND d.id=sc.id JOIN business_partners p ON p.tenant_id=sc.tenant_id AND p.id=sc.partner_id WHERE sc.id IN (SELECT q."caseId" FROM (${tickets.sql}) q)`,values:tickets.values};
}
