import { Injectable,ForbiddenException,NotFoundException,ConflictException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Db,Principal,parse,uuid,nextNumber,audit,idempotent } from './core';
import { Service } from './service';
import { requirePermission } from './permissions';
import { version } from './business';
@Injectable()
export class Collaboration {
 constructor(private db:Db,private service:Service){}
 async comments(u:Principal,id:string){parse(uuid,id);return this.db.as(u,async db=>{await this.service.ticket(db,u,id);return (await db.query("SELECT c.id,c.body,c.visibility,c.created_at AS \"createdAt\",usr.name AS \"authorName\" FROM ticket_comments c JOIN users usr ON usr.tenant_id=c.tenant_id AND usr.id=c.author_id WHERE c.tenant_id=$1 AND c.ticket_id=$2 AND ($3::boolean OR c.visibility='PUBLIC') ORDER BY c.created_at,c.id",[u.tenantId,id,u.role!=='CUSTOMER'])).rows;});}
 async comment(u:Principal,id:string,raw:unknown,key:unknown,correlation:string){
  parse(uuid,id);const input=parse(z.object({body:z.string().trim().min(1).max(10000),visibility:z.enum(['PUBLIC','INTERNAL'])}).strict(),raw);
  if(u.role==='CUSTOMER'&&input.visibility!=='PUBLIC')throw new ForbiddenException('Kunden dürfen keine internen Notizen erstellen.');
  return this.db.as(u,db=>idempotent(db,u,'TICKET_COMMENT:'+id,key,input,async()=>{
   await this.service.ticket(db,u,id);const commentId=randomUUID();
   await db.query('INSERT INTO ticket_comments(id,tenant_id,ticket_id,author_id,visibility,body) VALUES($1,$2,$3,$4,$5,$6)',[commentId,u.tenantId,id,u.id,input.visibility,input.body]);
   await audit(db,u,correlation,'COMMENT_ADDED',id,{commentId,visibility:input.visibility});return {id:commentId};
  }));
 }
 async link(u:Principal,id:string,raw:unknown,key:unknown,correlation:string){
  requirePermission(u.role,'service.manage');parse(uuid,id);const input=parse(z.object({targetId:uuid,kind:z.enum(['RELATED','PARENT','DUPLICATE','PROBLEM','FOLLOW_UP'])}).strict(),raw);
  if(id===input.targetId)throw new ConflictException('Ticket kann nicht mit sich selbst verknüpft werden.');
  return this.db.as(u,db=>idempotent(db,u,'TICKET_LINK:'+id,key,input,async()=>{
   const source=await this.service.ticket(db,u,id),target=await this.service.ticket(db,u,input.targetId);if(source.organizationId!==target.organizationId||source.partnerId!==target.partnerId)throw new ConflictException('Ticketbeziehungen benötigen denselben Kunden und dieselbe Serviceorganisation.');if(input.kind==='PROBLEM'&&target.type!=='PROBLEM')throw new ConflictException('Als Problembezug ein tatsächliches Problemticket auswählen.');
   if(input.kind==='PARENT'){
    await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`TICKET_TREE:${u.tenantId}`]);
    const cycle=await db.query("WITH RECURSIVE parents(id) AS(SELECT target_id FROM ticket_links WHERE tenant_id=$1 AND source_id=$2 AND kind='PARENT' UNION SELECT l.target_id FROM ticket_links l JOIN parents p ON p.id=l.source_id WHERE l.tenant_id=$1 AND l.kind='PARENT') SELECT 1 FROM parents WHERE id=$3",[u.tenantId,input.targetId,id]);
    if(cycle.rowCount)throw new ConflictException('Zyklische Haupt-/Unterticketbeziehung nicht erlaubt.');
   }
   await db.query('INSERT INTO ticket_links(tenant_id,source_id,target_id,kind,created_by) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',[u.tenantId,id,input.targetId,input.kind,u.id]);
   await audit(db,u,correlation,'TICKET_LINKED',id,input);return {sourceId:id,...input};
  }));
 }
 async partner(u:Principal,id:string){
  requirePermission(u.role,'partner.read');parse(uuid,id);
  return this.db.as(u,async db=>{
   const partner=(await db.query('SELECT id,number,name,email,status,version,roles,legal_form AS "legalForm",vat_id AS "vatId",currency,organization_id AS "organizationId" FROM business_partners WHERE tenant_id=$1 AND id=$2 AND organization_id=ANY($3::uuid[]) AND ($4::uuid IS NULL OR id=$4)',[u.tenantId,id,u.orgIds,u.role==='CUSTOMER'?u.partnerId:null])).rows[0];
   if(!partner)throw new NotFoundException('Kunde nicht gefunden.');
   return {...partner,contacts:(await db.query('SELECT id,number,name,first_name AS "firstName",last_name AS "lastName",email,phone,mobile,department,position,functions,active,valid_from::text AS "validFrom",valid_to::text AS "validTo",version FROM partner_contacts WHERE tenant_id=$1 AND partner_id=$2 ORDER BY name',[u.tenantId,id])).rows,addresses:(await db.query('SELECT id,kind,street,postal_code AS "postalCode",city,country,is_default AS "isDefault",active,version FROM partner_addresses WHERE tenant_id=$1 AND partner_id=$2 ORDER BY kind',[u.tenantId,id])).rows};
  });
 }
 async partnerUpdate(u:Principal,id:string,raw:unknown,key:unknown,correlation:string){
  requirePermission(u.role,'partner.write');parse(uuid,id);
  const contact=z.object({name:z.string().trim().min(2).max(120),email:z.email().max(254),phone:z.string().max(50),position:z.string().max(100)}).strict();
  const address=z.object({kind:z.enum(['BUSINESS','BILLING','SERVICE']),street:z.string().trim().min(2).max(160),postalCode:z.string().max(20),city:z.string().trim().min(2).max(100),country:z.string().regex(/^[A-Z]{2}$/)}).strict();
  const input=parse(z.object({version:z.number().int().positive(),name:z.string().trim().min(2).max(160),email:z.email().max(254),legalForm:z.string().max(80),vatId:z.string().max(40),currency:z.string().regex(/^[A-Z]{3}$/),roles:z.array(z.enum(['CUSTOMER','SUPPLIER','BILL_TO','SOLD_TO','SHIP_TO','CONTACT'])).min(1),contacts:z.array(contact).max(50),addresses:z.array(address).max(20)}).strict(),raw);
  return this.db.as(u,db=>idempotent(db,u,'PARTNER_UPDATE:'+id,key,input,async()=>{
   const p=(await db.query('SELECT * FROM business_partners WHERE tenant_id=$1 AND id=$2 AND organization_id=ANY($3::uuid[]) FOR UPDATE',[u.tenantId,id,u.orgIds])).rows[0];
   if(!p)throw new NotFoundException('Kunde nicht gefunden.');version(p.version,input.version);
   if(!['DRAFT','REJECTED'].includes(p.status))throw new ConflictException('Aktive/eingereichte Stammdaten benötigen einen separaten Änderungsfreigabeprozess.');
   await db.query('UPDATE business_partners SET name=$3,email=$4,legal_form=$5,vat_id=$6,currency=$7,roles=$8,version=version+1 WHERE tenant_id=$1 AND id=$2',[u.tenantId,id,input.name,input.email,input.legalForm,input.vatId,input.currency,input.roles]);
   // Kontakte/Adressen werden versioniert als neue Datensätze ergänzt; bisherige
   // IDs bleiben nachvollziehbar und werden nicht destruktiv überschrieben.
   for(const c of input.contacts)await db.query('INSERT INTO partner_contacts(id,tenant_id,partner_id,name,email,phone,position,number) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[randomUUID(),u.tenantId,id,c.name,c.email,c.phone,c.position,await nextNumber(db,u.tenantId,'AP')]);
   for(const a of input.addresses)await db.query('INSERT INTO partner_addresses(id,tenant_id,partner_id,kind,street,postal_code,city,country) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[randomUUID(),u.tenantId,id,a.kind,a.street,a.postalCode,a.city,a.country]);
   await audit(db,u,correlation,'PARTNER_UPDATED',id,{version:input.version+1});return {id,version:input.version+1};
  }));
 }
 async notifications(u:Principal){return this.db.as(u,async db=>(await db.query('SELECT id,event_type AS "eventType",document_id AS "documentId",payload,created_at AS "createdAt",read_at AS "readAt" FROM notification_outbox WHERE tenant_id=$1 AND recipient_id=$2 ORDER BY created_at DESC LIMIT 100',[u.tenantId,u.id])).rows);}
 async readNotification(u:Principal,id:string){parse(uuid,id);return this.db.as(u,async db=>{const r=await db.query('UPDATE notification_outbox SET read_at=coalesce(read_at,now()) WHERE tenant_id=$1 AND id=$2 AND recipient_id=$3 RETURNING id',[u.tenantId,id,u.id]);if(!r.rowCount)throw new NotFoundException('Benachrichtigung nicht gefunden.');return {id};});}
}
