import { Injectable, ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Db,Principal,parse,uuid,nextNumber,audit } from './core';
import { hashPassword } from './auth';
import { ROLES } from './permissions';
const role=z.enum(ROLES);
@Injectable()
export class Admin {
  constructor(private db:Db){}
  async organization(u:Principal){
    return this.db.as(u,async db=>(await db.query('SELECT id,name,kind,parent_id AS "parentId" FROM organizations WHERE tenant_id=$1 AND id=ANY($2::uuid[]) ORDER BY name',[u.tenantId,u.orgIds])).rows);
  }
  async createPartner(u:Principal,raw:unknown,correlation:string){
    const input=parse(z.object({name:z.string().trim().min(2).max(160),email:z.email().max(254).transform(s=>s.toLowerCase()),organizationId:uuid}).strict(),raw);
    if(!u.orgIds.includes(input.organizationId))throw new ForbiddenException('Organisation nicht berechtigt.');
    return this.db.as(u,async db=>{
      const id=randomUUID(),number=await nextNumber(db,u.tenantId,'BP');
      await db.query("INSERT INTO business_partners(id,tenant_id,organization_id,number,name,email,status) VALUES($1,$2,$3,$4,$5,$6,'DRAFT')",[id,u.tenantId,input.organizationId,number,input.name,input.email]);
      await db.query("INSERT INTO documents(id,tenant_id,organization_id,number,kind,created_by) VALUES($1,$2,$3,$4,'BUSINESS_PARTNER',$5)",[id,u.tenantId,input.organizationId,number,u.id]);
      await audit(db,u,correlation,'PARTNER_CREATED',id,{partnerId:id,number});
      return {id,number,name:input.name,email:input.email,status:'DRAFT',version:1};
    });
  }
  async users(u:Principal){
    return this.db.as(u,async db=>(await db.query('SELECT u.id,u.email,u.name,u.role,u.active,u.partner_id AS "partnerId" FROM users u WHERE u.tenant_id=$1 AND EXISTS(SELECT 1 FROM user_organizations o WHERE o.tenant_id=u.tenant_id AND o.user_id=u.id AND o.organization_id=ANY($2::uuid[])) ORDER BY u.name',[u.tenantId,u.orgIds])).rows);
  }
  async createUser(u:Principal,raw:unknown,correlation:string){
    const input=parse(z.object({name:z.string().trim().min(2).max(100),email:z.email().max(254).transform(s=>s.toLowerCase()),password:z.string().min(14).max(128),role,organizationId:uuid,partnerId:uuid.optional()}).strict(),raw);
    if(!u.orgIds.includes(input.organizationId))throw new ForbiddenException('Organisation nicht berechtigt.');
    if(input.role==='CUSTOMER'&&!input.partnerId)throw new ConflictException('Kundenbenutzer benötigt Kundenbindung.');
    if(input.role!=='CUSTOMER'&&input.partnerId)throw new ConflictException('Kundenbindung ist nur für Kundenbenutzer erlaubt.');
    const hash=await hashPassword(input.password);
    return this.db.as(u,async db=>{
      if(input.partnerId&&!(await db.query("SELECT 1 FROM business_partners WHERE tenant_id=$1 AND id=$2 AND organization_id=$3 AND status='ACTIVE'",[u.tenantId,input.partnerId,input.organizationId])).rowCount)throw new NotFoundException('Aktiver Kunde nicht gefunden.');
      const id=randomUUID();
      await db.query('INSERT INTO users(id,tenant_id,name,email,password_hash,role,partner_id) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,u.tenantId,input.name,input.email,hash,input.role,input.partnerId||null]);
      await db.query('INSERT INTO user_organizations VALUES($1,$2,$3)',[u.tenantId,id,input.organizationId]);
      if(['TECHNICIAN','FIELD_TECHNICIAN'].includes(input.role))await db.query('INSERT INTO technicians(id,tenant_id,user_id,organization_id,name) VALUES($1,$2,$3,$4,$5)',[randomUUID(),u.tenantId,id,input.organizationId,input.name]);
      await audit(db,u,correlation,'USER_CREATED',null,{userId:id,role:input.role});
      return {id,name:input.name,email:input.email,role:input.role,active:true};
    });
  }
  async updateUser(u:Principal,id:string,raw:unknown,correlation:string){
    parse(uuid,id);
    const input=parse(z.object({role,active:z.boolean()}).strict(),raw);
    return this.db.as(u,async db=>{
      // Alle Rollenänderungen je Tenant serialisieren, damit zwei Administratoren
      // sich nicht gleichzeitig als jeweils vermeintlich vorletzten deaktivieren.
      await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`ADMIN_ROLES:${u.tenantId}`]);
      const r=await db.query('SELECT u.* FROM users u WHERE u.tenant_id=$1 AND u.id=$2 AND EXISTS(SELECT 1 FROM user_organizations o WHERE o.tenant_id=u.tenant_id AND o.user_id=u.id AND o.organization_id=ANY($3::uuid[])) FOR UPDATE',[u.tenantId,id,u.orgIds]);
      if(!r.rowCount)throw new NotFoundException('Benutzer nicht gefunden.');
      const prior=r.rows[0];
      if(prior.role==='ADMIN'&&prior.active&&(!input.active||input.role!=='ADMIN')){
        const count=await db.query("SELECT count(*)::int AS count FROM users WHERE tenant_id=$1 AND role='ADMIN' AND active",[u.tenantId]);
        if(count.rows[0].count<=1)throw new ConflictException('Letzter aktiver Administrator muss erhalten bleiben.');
      }
      if((prior.role==='CUSTOMER')!==(input.role==='CUSTOMER'))throw new ConflictException('Interne und Kundenkonten dürfen nicht ineinander umgewandelt werden. Neues Konto anlegen.');
      await db.query('UPDATE users SET role=$3,active=$4 WHERE tenant_id=$1 AND id=$2',[u.tenantId,id,input.role,input.active]);
      if(['TECHNICIAN','FIELD_TECHNICIAN'].includes(input.role))await db.query('INSERT INTO technicians(id,tenant_id,user_id,organization_id,name,active) SELECT $1,u.tenant_id,u.id,o.organization_id,u.name,$4 FROM users u JOIN user_organizations o ON o.tenant_id=u.tenant_id AND o.user_id=u.id WHERE u.tenant_id=$2 AND u.id=$3 ORDER BY o.organization_id LIMIT 1 ON CONFLICT(tenant_id,user_id) DO UPDATE SET active=excluded.active',[randomUUID(),u.tenantId,id,input.active]);
      else await db.query('UPDATE technicians SET active=false WHERE tenant_id=$1 AND user_id=$2',[u.tenantId,id]);
      await audit(db,u,correlation,'USER_ACCESS_CHANGED',null,{userId:id,from:{role:prior.role,active:prior.active},to:input});
      return {id,...input};
    });
  }
}
