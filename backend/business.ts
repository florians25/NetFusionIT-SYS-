import { ConflictException,ForbiddenException,NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import { Principal,nextNumber } from './core';
export function checkOrg(u:Principal,organizationId:string){if(!u.orgIds.includes(organizationId))throw new ForbiddenException('Organisation nicht berechtigt.');}
export async function document(db:PoolClient,u:Principal,id:string,lock=false){
 const r=await db.query(`SELECT * FROM documents WHERE tenant_id=$1 AND id=$2 AND organization_id=ANY($3::uuid[])${lock?' FOR UPDATE':''}`,[u.tenantId,id,u.orgIds]);
 if(!r.rowCount)throw new NotFoundException('Beleg nicht gefunden.');return r.rows[0];
}
export async function createDocument(db:PoolClient,u:Principal,kind:string,prefix:string,organizationId:string,id=randomUUID()){
 checkOrg(u,organizationId);const number=await nextNumber(db,u.tenantId,prefix);
 await db.query('INSERT INTO documents(id,tenant_id,organization_id,number,kind,created_by) VALUES($1,$2,$3,$4,$5,$6)',[id,u.tenantId,organizationId,number,kind,u.id]);return {id,number};
}
export async function relate(db:PoolClient,u:Principal,source:string,target:string,kind='FOLLOW_UP'){
 await db.query('INSERT INTO document_relations(id,tenant_id,source_id,target_id,kind) VALUES($1,$2,$3,$4,$5) ON CONFLICT(tenant_id,source_id,target_id,kind) DO NOTHING',[randomUUID(),u.tenantId,source,target,kind]);
}
export function version(actual:number,expected:number){if(actual!==expected)throw new ConflictException('Beleg wurde geändert. Bitte neu laden.');}
export async function notify(db:PoolClient,u:Principal,recipients:string[],event:string,documentId:string,payload:unknown={}){
 for(const recipient of new Set(recipients))await db.query('INSERT INTO notification_outbox(id,tenant_id,recipient_id,event_type,document_id,payload) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),u.tenantId,recipient,event,documentId,JSON.stringify(payload)]);
}
