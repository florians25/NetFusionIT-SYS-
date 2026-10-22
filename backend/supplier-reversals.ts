import {ConflictException,ForbiddenException,Injectable,NotFoundException} from '@nestjs/common';
import {PoolClient} from 'pg';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {Db,Principal,parse,uuid,idempotent,audit} from './core';
import {document,createDocument,version,relate} from './business';
import {companyWithin,periodWithin,automaticJournal} from './finance';
import {lockSupplierPosting} from './supplier-posting';
import {can,requirePermission} from './permissions';

const preparation=z.object({version:z.number().int().positive(),periodId:uuid,postingDate:z.iso.date(),documentDate:z.iso.date(),reason:z.string().trim().min(15).max(2000)}).strict();
export async function lockSupplierReversal(db:PoolClient,u:Principal,id:string){
 const r=(await db.query('SELECT invoice_id FROM supplier_invoice_reversals WHERE tenant_id=$1 AND id=$2',[u.tenantId,id])).rows[0];
 if(r)await lockSupplierPosting(db,u,r.invoice_id);
}
async function reversal(db:PoolClient,u:Principal,id:string,lock=false){
 const d=await document(db,u,id,lock),r=(await db.query(`SELECT *,posting_date::text AS posting_day,document_date::text AS document_day FROM supplier_invoice_reversals WHERE tenant_id=$1 AND id=$2${lock?' FOR UPDATE':''}`,[u.tenantId,id])).rows[0];
 if(!r)throw new NotFoundException('Stornobeleg fehlt.');return {...r,number:d.number,created_by:d.created_by};
}
async function source(db:PoolClient,u:Principal,id:string){
 const d=await document(db,u,id),i=(await db.query('SELECT *,posting_date::text AS posting_day FROM supplier_invoices WHERE tenant_id=$1 AND id=$2',[u.tenantId,id])).rows[0];
 if(!i)throw new NotFoundException('Ursprungsrechnung fehlt.');
 if(!i.sealed||i.status!=='POSTED')throw new ConflictException('Nur eine gebuchte Eingangsrechnung erhält einen Stornobeleg.');
 const j=(await db.query('SELECT j.*,d.number FROM journals j JOIN documents d ON d.tenant_id=j.tenant_id AND d.id=j.id WHERE j.tenant_id=$1 AND j.id=$2 FOR SHARE OF j',[u.tenantId,i.journal_id])).rows[0];
 if(!j||j.status!=='POSTED'||j.reversal_of)throw new ConflictException('Wirksamer ursprünglicher Finanzbeleg fehlt.');
 if((await db.query("SELECT 1 FROM journals WHERE tenant_id=$1 AND reversal_of=$2 AND status='POSTED'",[u.tenantId,j.id])).rowCount)throw new ConflictException('Die Ursprungsrechnung ist bereits gegengebucht.');
 const op=(await db.query('SELECT * FROM supplier_invoice_open_items WHERE tenant_id=$1 AND invoice_id=$2',[u.tenantId,id])).rows[0];
 if(!op||!op.payment_block||op.amount!==i.gross)throw new ConflictException('Unbezahlter zahlungsgesperrter Originalposten erforderlich.');
 const lines=(await db.query('SELECT e.position,e.account_id AS "accountId",a.code,a.name,e.side,e.amount::text,e.description,e.cost_center AS "costCenter",e.partner_id AS "partnerId",e.tax_code AS "taxCode",a.active FROM journal_entries e JOIN gl_accounts a ON a.tenant_id=e.tenant_id AND a.id=e.account_id WHERE e.tenant_id=$1 AND e.journal_id=$2 ORDER BY e.position FOR SHARE OF a',[u.tenantId,j.id])).rows;
 if(!lines.length||lines.some(l=>!l.active))throw new ConflictException('Die ursprünglichen Konten müssen für die Gegenbuchung aktiv sein.');
 return {...i,number:d.number,journal:j,lines:lines.map(({active,...l})=>l)};
}
async function plan(db:PoolClient,u:Principal,h:any){
 const i=await source(db,u,h.invoice_id),c=await companyWithin(db,u,i.company_id);await periodWithin(db,u,c,h.period_id,h.posting_day,true);
 if(h.posting_day<i.posting_day||h.document_day<i.snapshot.original.date)throw new ConflictException('Stornobuchung darf nicht vor der Originalbuchung, Stornobelegdatum nicht vor dem Rechnungsdatum liegen.');
 const snapshot={id:h.id,number:h.number,invoiceId:i.id,invoiceNumber:i.number,externalNumber:i.external_number,companyId:i.company_id,periodId:h.period_id,postingDate:h.posting_day,documentDate:h.document_day,reason:h.reason,preparedBy:h.prepared_by,preparedAt:new Date(h.prepared_at).toISOString(),currency:i.currency,net:i.net,tax:i.tax,gross:i.gross,invoiceSnapshot:i.snapshot,sourceJournal:{id:i.journal.id,number:i.journal.number,hash:i.journal.content_hash,lines:i.lines}};
 return {h,i,snapshot};
}
export async function validateSupplierReversal(db:PoolClient,u:Principal,id:string){
 const h=await reversal(db,u,id),p=await plan(db,u,h),equal=(await db.query('SELECT $1::jsonb=$2::jsonb AS equal',[JSON.stringify(h.prepared_snapshot),JSON.stringify(p.snapshot)])).rows[0].equal;
 if(!equal)throw new ConflictException('Storno-Prüfstand hat sich geändert. Vorbereitung und unabhängige Freigabe erneuern.');return p;
}
export async function supplierReversalReviewer(db:PoolClient,u:Principal,id:string){const h=await reversal(db,u,id);if([h.created_by,h.prepared_by].includes(u.id))throw new ForbiddenException('Eigener Stornoantrag oder eigene Vorbereitung darf nicht selbst freigegeben werden.');}
export async function approveSupplierReversal(db:PoolClient,u:Principal,id:string,note:string){
 await supplierReversalReviewer(db,u,id);if(note.trim().length<15)throw new ConflictException('Unabhängige Stornoprüfung nachvollziehbar begründen.');await validateSupplierReversal(db,u,id);
 await db.query('UPDATE supplier_invoice_reversals SET reviewed_by=$3,reviewed_at=now(),review_note=$4 WHERE tenant_id=$1 AND id=$2',[u.tenantId,id,u.id,note]);
}
@Injectable()
export class SupplierReversals{
 constructor(private db:Db){}
 async create(u:Principal,id:string,raw:unknown,key:unknown,corr:string){
  requirePermission(u.role,'ap.post');parse(uuid,id);const input=parse(preparation,raw);
  return this.db.as(u,db=>idempotent(db,u,'SUPPLIER_REVERSAL_CREATE:'+id,key,input,async()=>{
   await lockSupplierPosting(db,u,id);await document(db,u,id,true);const i=await source(db,u,id);version(i.version,input.version);
   if((await db.query('SELECT 1 FROM supplier_invoice_reversals WHERE tenant_id=$1 AND invoice_id=$2',[u.tenantId,id])).rowCount)throw new ConflictException('Ein Stornobeleg zu dieser Rechnung besteht bereits; vorhandenen Vorgang bearbeiten.');
   const c=await companyWithin(db,u,i.company_id),d=await createDocument(db,u,'SUPPLIER_INVOICE_REVERSAL','SB',c.organization_id),at=new Date(),h={...d,invoice_id:id,period_id:input.periodId,posting_day:input.postingDate,document_day:input.documentDate,reason:input.reason,prepared_by:u.id,prepared_at:at},p=await plan(db,u,h);
   await db.query('INSERT INTO supplier_invoice_reversals(id,tenant_id,invoice_id,company_id,period_id,posting_date,document_date,reason,prepared_by,prepared_at,prepared_snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[d.id,u.tenantId,id,i.company_id,input.periodId,input.postingDate,input.documentDate,input.reason,u.id,at,JSON.stringify(p.snapshot)]);
   await relate(db,u,id,d.id,'REVERSAL_REQUEST');await audit(db,u,corr,'SUPPLIER_REVERSAL_CREATED',d.id,{invoiceId:id,reason:input.reason});return {...d,status:'DRAFT',version:1};
  }));
 }
 async detail(u:Principal,id:string){
  requirePermission(u.role,'ap.read');parse(uuid,id);return this.db.as(u,async db=>{
   const h=await reversal(db,u,id),s=h.snapshot||h.prepared_snapshot,people=(await db.query('SELECT id,name FROM users WHERE tenant_id=$1 AND id=ANY($2::uuid[])',[u.tenantId,[h.prepared_by,h.reviewed_by].filter(Boolean)])).rows,names=new Map(people.map(p=>[p.id,p.name]));
   await companyWithin(db,u,h.company_id);
   return {id,number:h.number,status:h.status,version:h.version,invoiceId:h.invoice_id,invoiceNumber:s.invoiceNumber,externalNumber:s.externalNumber,companyId:h.company_id,periodId:h.period_id,postingDate:h.posting_day,documentDate:h.document_day,reason:h.reason,currency:s.currency,net:s.net,tax:s.tax,gross:s.gross,supplierName:s.invoiceSnapshot.original.seller.name,preparedByName:names.get(h.prepared_by),preparedAt:h.prepared_at,reviewedByName:s.review?.name||names.get(h.reviewed_by)||null,reviewNote:h.review_note,reviewedAt:h.reviewed_at,postedAt:h.posted_at,sourceJournal:s.sourceJournal,journal:h.journal_id?(await db.query('SELECT id,number FROM documents WHERE tenant_id=$1 AND id=$2',[u.tenantId,h.journal_id])).rows[0]:null,lines:s.sourceJournal.lines.map((l:any)=>({...l,counterSide:l.side==='DEBIT'?'CREDIT':'DEBIT'})),snapshot:h.snapshot,preparedSnapshot:h.prepared_snapshot,
    canPrepare:can(u.role,'ap.post')&&['DRAFT','REJECTED'].includes(h.status),canSubmit:can(u.role,'ap.post')&&['DRAFT','REJECTED'].includes(h.status),canPost:can(u.role,'ap.post')&&h.status==='APPROVED',canWithdraw:can(u.role,'ap.post')&&['IN_REVIEW','APPROVED'].includes(h.status),
    periods:(await db.query('SELECT id,year,period,date_from::text AS "dateFrom",date_to::text AS "dateTo",status FROM fiscal_periods WHERE tenant_id=$1 AND company_id=$2 ORDER BY date_from',[u.tenantId,h.company_id])).rows,
    decisions:(await db.query('SELECT ad.decision,ad.comment,u.name AS "actorName",ad.created_at AS "createdAt",ad.context FROM approval_decisions ad JOIN approval_instances ai ON ai.tenant_id=ad.tenant_id AND ai.id=ad.instance_id JOIN users u ON u.tenant_id=ad.tenant_id AND u.id=ad.actor_id WHERE ai.tenant_id=$1 AND ai.document_id=$2 ORDER BY ad.created_at,ad.id',[u.tenantId,id])).rows};
  });
 }
 async prepare(u:Principal,id:string,raw:unknown,key:unknown,corr:string){
  requirePermission(u.role,'ap.post');parse(uuid,id);const input=parse(preparation,raw);return this.db.as(u,db=>idempotent(db,u,'SUPPLIER_REVERSAL_PREPARE:'+id,key,input,async()=>{
   await lockSupplierReversal(db,u,id);const h=await reversal(db,u,id,true);version(h.version,input.version);if(!['DRAFT','REJECTED'].includes(h.status))throw new ConflictException('Nur offener oder abgelehnter Storno kann neu vorbereitet werden.');
   Object.assign(h,{period_id:input.periodId,posting_day:input.postingDate,document_day:input.documentDate,reason:input.reason,prepared_by:u.id,prepared_at:new Date()});const p=await plan(db,u,h);
   await db.query("UPDATE supplier_invoice_reversals SET status='DRAFT',period_id=$3,posting_date=$4,document_date=$5,reason=$6,prepared_by=$7,prepared_at=$8,prepared_snapshot=$9,reviewed_by=NULL,reviewed_at=NULL,review_note=NULL,version=version+1 WHERE tenant_id=$1 AND id=$2",[u.tenantId,id,input.periodId,input.postingDate,input.documentDate,input.reason,u.id,h.prepared_at,JSON.stringify(p.snapshot)]);
   await audit(db,u,corr,'SUPPLIER_REVERSAL_PREPARED',id,{reason:input.reason});return {id,version:h.version+1,status:'DRAFT'};
  }));
 }
 async withdraw(u:Principal,id:string,raw:unknown,key:unknown,corr:string){
  requirePermission(u.role,'ap.post');parse(uuid,id);const input=parse(z.object({version:z.number().int().positive(),reason:z.string().trim().min(15).max(2000)}).strict(),raw);return this.db.as(u,db=>idempotent(db,u,'SUPPLIER_REVERSAL_WITHDRAW:'+id,key,input,async()=>{
   const a=(await db.query('SELECT * FROM approval_instances WHERE tenant_id=$1 AND document_id=$2 AND organization_id=ANY($3::uuid[]) ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE',[u.tenantId,id,u.orgIds])).rows[0];await lockSupplierReversal(db,u,id);const h=await reversal(db,u,id,true);version(h.version,input.version);
   if(!a||!['IN_REVIEW','APPROVED'].includes(h.status)||!['PENDING','INFORMATION_REQUIRED','APPROVED'].includes(a.status))throw new ConflictException('Nur eine laufende oder noch nicht gebuchte Stornofreigabe zurückziehen.');
   await db.query("INSERT INTO approval_decisions(id,tenant_id,instance_id,step,actor_id,decision,comment) VALUES($1,$2,$3,$4,$5,'WITHDRAW',$6)",[randomUUID(),u.tenantId,a.id,Math.max(0,Math.min(a.current_step,a.steps_snapshot.length-1)),u.id,input.reason]);await db.query("UPDATE approval_instances SET status='WITHDRAWN',version=version+1 WHERE tenant_id=$1 AND id=$2",[u.tenantId,a.id]);
   await db.query("UPDATE supplier_invoice_reversals SET status='DRAFT',reviewed_by=NULL,reviewed_at=NULL,review_note=NULL,version=version+1 WHERE tenant_id=$1 AND id=$2",[u.tenantId,id]);await audit(db,u,corr,'SUPPLIER_REVERSAL_APPROVAL_WITHDRAWN',id,{reason:input.reason});return {id,status:'DRAFT',version:h.version+1};
  }));
 }
 async post(u:Principal,id:string,raw:unknown,key:unknown,corr:string){
  requirePermission(u.role,'ap.post');parse(uuid,id);const input=parse(z.object({version:z.number().int().positive()}).strict(),raw);return this.db.as(u,db=>idempotent(db,u,'SUPPLIER_REVERSAL_POST:'+id,key,input,async()=>{
   await lockSupplierReversal(db,u,id);const h=await reversal(db,u,id,true);version(h.version,input.version);if(h.status!=='APPROVED'||!h.reviewed_by)throw new ConflictException('Unabhängig freigegebener Stornobeleg erforderlich.');
   const reviewer=(await db.query('SELECT role,name FROM users WHERE tenant_id=$1 AND id=$2 FOR SHARE',[u.tenantId,h.reviewed_by])).rows[0];if(!reviewer||!['ADMIN','ACCOUNTANT'].includes(reviewer.role))throw new ConflictException('Finanzielle Freigabeverantwortung hat sich geändert; erneut unabhängig prüfen.');
   const p=await validateSupplierReversal(db,u,id),lines=p.i.lines.map(({position,code,name,...l}:any)=>({...l,side:l.side==='DEBIT'?'CREDIT':'DEBIT'}));
   const journal=await automaticJournal(db,u,{companyId:h.company_id,periodId:h.period_id,postingDate:h.posting_day,documentDate:h.document_day,description:'Storno Eingangsrechnung '+p.i.number,reference:p.i.external_number,lines},id,corr,{id:p.i.journal.id,reason:h.reason});
   const snapshot={...p.snapshot,review:{actorId:h.reviewed_by,name:reviewer.name,note:h.review_note,at:new Date(h.reviewed_at).toISOString()}};
   await db.query("UPDATE supplier_invoice_reversals SET status='POSTED',journal_id=$3,snapshot=$4,sealed=true,posted_at=now(),version=version+1 WHERE tenant_id=$1 AND id=$2",[u.tenantId,id,journal.id,JSON.stringify(snapshot)]);await relate(db,u,h.invoice_id,id,'REVERSED_BY');await audit(db,u,corr,'SUPPLIER_INVOICE_REVERSED',id,{invoiceId:h.invoice_id,journalId:journal.id,originalJournalId:p.i.journal.id,gross:p.i.gross});return {id,number:h.number,status:'POSTED',version:h.version+1,journal};
  }));
 }
}
