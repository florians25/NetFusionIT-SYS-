import {Injectable,ConflictException,NotFoundException} from '@nestjs/common';
import {PoolClient} from 'pg';
import {z} from 'zod';
import {Db,Principal,uuid,parse,idempotent,audit} from './core';
import {version} from './business';
import {requirePermission} from './permissions';
export const firstName=z.string().trim().min(1).max(60).regex(/^[^\r\n\t]+$/).transform(s=>s.replace(/\s+/g,' '));
export const lastName=z.string().trim().min(1).max(80).regex(/^[^\r\n\t]+$/).transform(s=>s.replace(/\s+/g,' '));
export async function documentContact(db:PoolClient,u:Principal,companyId:string,required=true){
 const c=(await db.query('SELECT id FROM company_codes WHERE tenant_id=$1 AND id=$2 AND organization_id=ANY($3::uuid[])',[u.tenantId,companyId,u.orgIds])).rows[0];if(!c)throw new NotFoundException('Buchungskreis nicht gefunden.');
 const p=(await db.query('SELECT first_name AS "firstName",last_name AS "lastName",email,phone,version FROM company_document_contacts WHERE tenant_id=$1 AND company_id=$2 AND active',[u.tenantId,companyId])).rows[0];if(!p&&required)throw new ConflictException('Für neue Geschäftsunterlagen den Ansprechpartner mit Vorname und Nachname in der App Dokumenteinstellungen hinterlegen.');return p||null;
}
@Injectable()
export class DocumentSettings{
 constructor(private db:Db){}
 async list(u:Principal){requirePermission(u.role,'document.config.read');return this.db.snapshot(u,async db=>(await db.query('SELECT c.id,c.organization_id AS "organizationId",c.code,c.name,p.first_name AS "firstName",p.last_name AS "lastName",p.email,p.phone,coalesce(p.version,0) AS version,coalesce(p.active,false) AS active FROM company_codes c LEFT JOIN company_document_contacts p ON p.tenant_id=c.tenant_id AND p.company_id=c.id WHERE c.tenant_id=$1 AND c.organization_id=ANY($2::uuid[]) ORDER BY c.code',[u.tenantId,u.orgIds])).rows);}
 async save(u:Principal,id:string,raw:unknown,key:unknown,corr:string){requirePermission(u.role,'document.configure');parse(uuid,id);const i=parse(z.object({version:z.number().int().min(0),firstName,lastName,email:z.email().max(160),phone:z.string().trim().max(50),active:z.boolean(),reason:z.string().trim().min(5).max(500)}).strict(),raw);return this.db.as(u,db=>idempotent(db,u,'DOCUMENT_CONTACT:'+id,key,i,async()=>{
  if(!(await db.query('SELECT id FROM company_codes WHERE tenant_id=$1 AND id=$2 AND organization_id=ANY($3::uuid[]) FOR UPDATE',[u.tenantId,id,u.orgIds])).rowCount)throw new NotFoundException('Buchungskreis nicht gefunden.');const old=(await db.query('SELECT * FROM company_document_contacts WHERE tenant_id=$1 AND company_id=$2 FOR UPDATE',[u.tenantId,id])).rows[0];version(old?.version||0,i.version);await db.query('INSERT INTO company_document_contacts(tenant_id,company_id,first_name,last_name,email,phone,active) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(tenant_id,company_id) DO UPDATE SET first_name=excluded.first_name,last_name=excluded.last_name,email=excluded.email,phone=excluded.phone,active=excluded.active,version=company_document_contacts.version+1',[u.tenantId,id,i.firstName,i.lastName,i.email,i.phone,i.active]);await audit(db,u,corr,'DOCUMENT_CONTACT_CONFIGURED',null,{companyId:id,...i});return {companyId:id,version:i.version+1};
 }));}
}
