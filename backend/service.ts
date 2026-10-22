import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Sla } from './sla';
import { relate } from './business';
import { visibleDocuments } from './document-access';
import { Db,Principal,uuid,parse,ticketInput,nextNumber,audit,idempotent,ticketQuery,caseQuery,allowedTransitions } from './core';
@Injectable()
export class Service {
  constructor(readonly db:Db,private sla:Sla){}
  async ticket(client:PoolClient,u:Principal,id:string){
    const q=ticketQuery(u);q.values.push(id);
    const r=await client.query(`SELECT * FROM (${q.sql}) q WHERE id=$${q.values.length}`,q.values);
    if(!r.rowCount)throw new NotFoundException('Ticket nicht gefunden.');
    return r.rows[0];
  }
  async detail(u:Principal,id:string){
    parse(uuid,id);
    return this.db.as(u,async db=>{
      const ticket=await this.ticket(db,u,id);
      const events=await db.query("SELECT a.id,a.action,a.details,a.created_at AS \"createdAt\",u.name AS \"actorName\" FROM audit_events a JOIN users u ON u.tenant_id=a.tenant_id AND u.id=a.actor_id WHERE a.tenant_id=$1 AND a.document_id=$2 AND ($3::boolean OR (NOT(a.action='COMMENT_ADDED' AND a.details->>'visibility'='INTERNAL') AND a.action !~ '^(TIME_|TIMER_|TICKET_CHARGE_|TICKET_WORK_|WORK_ORDER_TASK_)')) ORDER BY a.created_at,a.id",[u.tenantId,id,u.role!=='CUSTOMER']);
      return {...ticket,allowedTransitions:allowedTransitions(u.role,ticket.status),events:events.rows};
    });
  }
  async create(u:Principal,raw:unknown,key:unknown,correlation:string){
    const input=parse(ticketInput,raw);
    if(u.role==='CUSTOMER'&&input.partnerId&&input.partnerId!==u.partnerId)throw new ForbiddenException('Fremder Kundenbezug.');
    const partnerId=u.role==='CUSTOMER'?u.partnerId:input.partnerId;
    if(!partnerId)throw new ConflictException('Kundenbezug erforderlich.');
    return this.db.as(u,db=>idempotent(db,u,'TICKET_CREATE',key,input,async()=>{
      const partner=await db.query("SELECT * FROM business_partners WHERE tenant_id=$1 AND id=$2 AND organization_id=ANY($3::uuid[]) AND status='ACTIVE' AND 'CUSTOMER'=ANY(roles) FOR SHARE",[u.tenantId,partnerId,u.orgIds]);
      if(!partner.rowCount)throw new NotFoundException('Aktiver Kunde nicht gefunden.');
      const org=partner.rows[0].organization_id, ticketId=randomUUID(),caseId=randomUUID();
      const number=await nextNumber(db,u.tenantId,'TCK'),caseNumber=await nextNumber(db,u.tenantId,'SVC');
      for(const [id,num,kind] of [[ticketId,number,'TICKET'],[caseId,caseNumber,'SERVICE_CASE']])await db.query('INSERT INTO documents(id,tenant_id,organization_id,number,kind,created_by) VALUES($1,$2,$3,$4,$5,$6)',[id,u.tenantId,org,num,kind,u.id]);
      await db.query('INSERT INTO service_cases(id,tenant_id,partner_id,title) VALUES($1,$2,$3,$4)',[caseId,u.tenantId,partnerId,input.title]);
      await db.query('INSERT INTO tickets(id,tenant_id,partner_id,case_id,title,description,type,priority,source,correlation_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[ticketId,u.tenantId,partnerId,caseId,input.title,input.description,input.type,input.priority,u.role==='CUSTOMER'?'CUSTOMER_PORTAL':'INTERNAL',correlation]);
      await db.query("INSERT INTO document_relations(id,tenant_id,source_id,target_id,kind) VALUES($1,$2,$3,$4,'BELONGS_TO')",[randomUUID(),u.tenantId,ticketId,caseId]);
      if(input.contractId){
        const started=(await db.query('SELECT created_at FROM documents WHERE tenant_id=$1 AND id=$2',[u.tenantId,ticketId])).rows[0].created_at;
        await this.sla.attachWithin(db,u,ticketId,input.contractId,org,partnerId,started);
        await db.query('UPDATE tickets SET contract_id=$3 WHERE tenant_id=$1 AND id=$2',[u.tenantId,ticketId,input.contractId]);
        await relate(db,u,ticketId,input.contractId,'SERVICE_CONTRACT');
      }
      if(input.technicalObjectId){
        const object=await db.query("SELECT 1 FROM technical_objects a JOIN documents d ON d.tenant_id=a.tenant_id AND d.id=a.id WHERE a.tenant_id=$1 AND a.id=$2 AND a.partner_id=$3 AND a.status='ACTIVE' AND d.organization_id=$4",[u.tenantId,input.technicalObjectId,partnerId,org]);
        if(!object.rowCount)throw new NotFoundException('Aktives technisches Objekt dieses Kunden fehlt.');
        await db.query('INSERT INTO case_objects VALUES($1,$2,$3)',[u.tenantId,caseId,input.technicalObjectId]);await relate(db,u,caseId,input.technicalObjectId,'AFFECTS');
      }
      await audit(db,u,correlation,'TICKET_CREATED',ticketId,{caseId,source:u.role==='CUSTOMER'?'CUSTOMER_PORTAL':'INTERNAL'});
      await audit(db,u,correlation,'SERVICE_CASE_CREATED',caseId,{ticketId});
      return {id:ticketId,number,caseId,caseNumber,correlationId:correlation,version:1};
    }));
  }
  async assign(u:Principal,id:string,raw:unknown,key:unknown,correlation:string){
    parse(uuid,id);
    const input=parse(z.object({technicianId:uuid,version:z.number().int().positive()}).strict(),raw);
    return this.db.as(u,db=>idempotent(db,u,`ASSIGN:${id}`,key,input,async()=>{
      const ticket=await this.ticket(db,u,id);
      await db.query('SELECT id FROM tickets WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[u.tenantId,id]);
      const current=await this.ticket(db,u,id);
      if(current.version!==input.version)throw new ConflictException('Ticket wurde geändert. Bitte neu laden.');
      if(['CANCELLED','CLOSED','TECHNICALLY_RESOLVED','COMMERCIALLY_CLOSED'].includes(current.status))throw new ConflictException('Dieser Status erlaubt keine Zuweisung.');
      const tech=await db.query('SELECT tech.id FROM technicians tech JOIN users u ON u.tenant_id=tech.tenant_id AND u.id=tech.user_id WHERE tech.tenant_id=$1 AND tech.id=$2 AND tech.organization_id=$3 AND tech.active AND u.active AND u.role IN (\'TECHNICIAN\',\'FIELD_TECHNICIAN\') AND EXISTS(SELECT 1 FROM user_organizations uo WHERE uo.tenant_id=u.tenant_id AND uo.user_id=u.id AND uo.organization_id=tech.organization_id)',[u.tenantId,input.technicianId,ticket.organizationId]);
      if(!tech.rowCount)throw new NotFoundException('Aktiver Techniker dieser Organisation nicht gefunden.');
      await db.query('UPDATE dispatch_assignments SET active=false WHERE tenant_id=$1 AND ticket_id=$2 AND active',[u.tenantId,id]);
      await db.query('INSERT INTO dispatch_assignments(id,tenant_id,ticket_id,technician_id,assigned_by) VALUES($1,$2,$3,$4,$5)',[randomUUID(),u.tenantId,id,input.technicianId,u.id]);
      const newStatus=['NEW','QUALIFYING'].includes(current.status)?'ASSIGNED':current.status;
      await db.query('UPDATE tickets SET status=$3,version=version+1,updated_at=now() WHERE tenant_id=$1 AND id=$2',[u.tenantId,id,newStatus]);
      await this.sla.transitionWithin(db,u,id,newStatus);
      await audit(db,u,correlation,'TECHNICIAN_ASSIGNED',id,{technicianId:input.technicianId,fromStatus:current.status,toStatus:newStatus});
      return {id,version:current.version+1,status:newStatus};
    }));
  }
  async status(u:Principal,id:string,raw:unknown,key:unknown,correlation:string){
    parse(uuid,id);
    const input=parse(z.object({status:z.string().min(1).max(40),version:z.number().int().positive()}).strict(),raw);
    return this.db.as(u,db=>idempotent(db,u,`STATUS:${id}`,key,input,async()=>{
      await this.ticket(db,u,id);
      await db.query('SELECT id FROM tickets WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[u.tenantId,id]);
      const ticket=await this.ticket(db,u,id);
      if(ticket.version!==input.version)throw new ConflictException('Ticket wurde geändert. Bitte neu laden.');
      if(!allowedTransitions(u.role,ticket.status).includes(input.status))throw new ConflictException('Statuswechsel nicht zulässig.');
      if(input.status==='IN_PROGRESS'&&!ticket.technicianId)throw new ConflictException('Vor Bearbeitung einen Techniker zuweisen.');
      await db.query('UPDATE tickets SET status=$3,version=version+1,updated_at=now() WHERE tenant_id=$1 AND id=$2',[u.tenantId,id,input.status]);
      await this.sla.transitionWithin(db,u,id,input.status);
      await audit(db,u,correlation,'STATUS_CHANGED',id,{from:ticket.status,to:input.status});
      return {id,status:input.status,version:ticket.version+1};
    }));
  }
  async serviceCase(u:Principal,id:string){
    parse(uuid,id);
    return this.db.as(u,async db=>{
      const q=caseQuery(u);q.values.push(id);
      const result=await db.query(`SELECT * FROM (${q.sql}) q WHERE id=$${q.values.length}`,q.values);
      if(!result.rowCount)throw new NotFoundException('Servicefall nicht gefunden.');
      const t=ticketQuery(u);t.values.push(id);
      const tickets=await db.query(`SELECT * FROM (${t.sql}) q WHERE "caseId"=$${t.values.length}`,t.values);
      return {...result.rows[0],tickets:tickets.rows};
    });
  }
  async flow(u:Principal,id:string){
    parse(uuid,id);
    return this.db.as(u,async db=>{
      const visibleQuery=visibleDocuments(u),visible=visibleQuery.sql;
      const p=[...visibleQuery.values,id];
      if(!(await db.query(`SELECT 1 FROM (${visible}) v WHERE id=$${p.length}`,p)).rowCount)throw new NotFoundException('Beleg nicht gefunden.');
      const r=await db.query(`WITH RECURSIVE visible_docs AS MATERIALIZED (${visible}),edges AS MATERIALIZED (SELECT r.* FROM document_relations r WHERE r.tenant_id=$1 AND r.source_id IN(SELECT id FROM visible_docs) AND r.target_id IN(SELECT id FROM visible_docs)),reachable(id) AS (SELECT $${p.length}::uuid UNION SELECT CASE WHEN e.source_id=g.id THEN e.target_id ELSE e.source_id END FROM reachable g JOIN documents current ON current.tenant_id=$1 AND current.id=g.id JOIN edges e ON e.source_id=g.id OR e.target_id=g.id WHERE current.id=$${p.length} OR current.kind NOT IN ('BUSINESS_PARTNER','MATERIAL','TECHNICAL_OBJECT','SERVICE_CONTRACT')) SELECT r.id,r.source_id AS "sourceId",r.target_id AS "targetId",r.kind,s.number AS "sourceNumber",s.kind AS "sourceKind",d.number AS "targetNumber",d.kind AS "targetKind" FROM edges r JOIN documents s ON s.tenant_id=r.tenant_id AND s.id=r.source_id JOIN documents d ON d.tenant_id=r.tenant_id AND d.id=r.target_id WHERE r.source_id IN(SELECT id FROM reachable) AND r.target_id IN(SELECT id FROM reachable) ORDER BY s.created_at,s.number,r.kind,d.created_at,d.number`,p);
      return r.rows;
    });
  }
  async partners(u:Principal){
    return this.db.as(u,async db=>(await db.query('SELECT id,number,name,email,status,organization_id AS "organizationId" FROM business_partners WHERE tenant_id=$1 AND organization_id=ANY($2::uuid[]) AND ($3::uuid IS NULL OR id=$3) AND $4=ANY(roles) ORDER BY name',[u.tenantId,u.orgIds,u.role==='CUSTOMER'?u.partnerId:null,'CUSTOMER'])).rows);
  }
  async technicians(u:Principal){
    return this.db.as(u,async db=>(await db.query("SELECT t.id,t.name,t.skills,t.organization_id AS \"organizationId\",(SELECT count(*)::int FROM dispatch_assignments a WHERE a.tenant_id=t.tenant_id AND a.technician_id=t.id AND a.active AND EXISTS(SELECT 1 FROM tickets tk WHERE tk.id=a.ticket_id AND tk.tenant_id=a.tenant_id AND tk.status NOT IN ('CLOSED','CANCELLED','COMMERCIALLY_CLOSED','TECHNICALLY_RESOLVED'))) AS \"assignedCount\" FROM technicians t JOIN users u ON u.tenant_id=t.tenant_id AND u.id=t.user_id WHERE t.tenant_id=$1 AND t.organization_id=ANY($2::uuid[]) AND t.active AND u.active AND u.role IN ('TECHNICIAN','FIELD_TECHNICIAN') ORDER BY t.name",[u.tenantId,u.orgIds])).rows);
  }
  async dashboard(u:Principal){
    return this.db.as(u,async db=>{
      const q=ticketQuery(u);
      const r=await db.query(`SELECT count(*)::int AS total,count(*) FILTER(WHERE status NOT IN ('CLOSED','CANCELLED','COMMERCIALLY_CLOSED'))::int AS open,count(*) FILTER(WHERE "technicianId" IS NULL AND status NOT IN ('CLOSED','CANCELLED','COMMERCIALLY_CLOSED','TECHNICALLY_RESOLVED'))::int AS unassigned,count(*) FILTER(WHERE priority IN ('HIGH','CRITICAL') AND status NOT IN ('CLOSED','CANCELLED','COMMERCIALLY_CLOSED','TECHNICALLY_RESOLVED'))::int AS critical,count(DISTINCT "caseId")::int AS cases FROM (${q.sql}) q`,q.values);
      const work=await db.query(`SELECT count(*) FILTER(WHERE status='NEW')::int AS "newCount",count(*) FILTER(WHERE status='IN_PROGRESS')::int AS "inProgress",count(*) FILTER(WHERE status IN ('WAITING_CUSTOMER','WAITING_MATERIAL','WAITING_VENDOR'))::int AS waiting,count(*) FILTER(WHERE "createdAt">=now()-interval '24 hours')::int AS "last24h" FROM (${q.sql}) q`,q.values);
      const priorities=await db.query(`SELECT priority,count(*)::int AS count FROM (${q.sql}) q WHERE status NOT IN ('CLOSED','CANCELLED','COMMERCIALLY_CLOSED') GROUP BY priority`,q.values);
      const labels:Record<string,string>={CRITICAL:'Kritisch',HIGH:'Hoch',MEDIUM:'Normal',LOW:'Niedrig'};
      const states:Record<string,string>={CRITICAL:'Error',HIGH:'Warning',MEDIUM:'Information',LOW:'None'};
      const distribution=Object.keys(labels).map(priority=>{
        const count=priorities.rows.find(p=>p.priority===priority)?.count||0;
        return {priority,label:labels[priority],state:states[priority],count,percent:r.rows[0].open?Math.round(100*count/r.rows[0].open):0};
      });
      const recent=await db.query(`SELECT * FROM (${q.sql}) q ORDER BY "createdAt" DESC,id DESC LIMIT 5`,q.values);
      return {...r.rows[0],...work.rows[0],distribution,recent:recent.rows,updatedAt:new Date().toISOString()};
    });
  }
}
