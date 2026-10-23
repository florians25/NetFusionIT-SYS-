import {ConflictException,ForbiddenException,Injectable,NotFoundException} from '@nestjs/common';
import {PoolClient} from 'pg';
import {randomUUID,createHash} from 'node:crypto';
import {z} from 'zod';
import {Db,Principal,parse,uuid,idempotent,audit,nextNumber} from './core';
import {document,createDocument,version,relate} from './business';
import {companyWithin,periodWithin,automaticJournal} from './finance';
import {documentContact} from './document-settings';
import {can,requirePermission} from './permissions';
import {InvoiceData,createValidatedEInvoice,EInvoiceBusyError} from './einvoice';

const preparation=z.object({version:z.number().int().positive(),periodId:uuid,postingDate:z.iso.date(),documentDate:z.iso.date(),reason:z.string().trim().min(15).max(2000)}).strict();
const hash=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
export async function lockCustomerCredit(db:PoolClient,u:Principal,id:string){
 const h=(await db.query('SELECT company_id FROM customer_credit_memos WHERE tenant_id=$1 AND id=$2',[u.tenantId,id])).rows[0];
 if(h)await companyWithin(db,u,h.company_id,true);
}
async function credit(db:PoolClient,u:Principal,id:string,lock=false){
 const d=await document(db,u,id,lock),h=(await db.query(`SELECT *,posting_date::text AS posting_day,document_date::text AS document_day FROM customer_credit_memos WHERE tenant_id=$1 AND id=$2${lock?' FOR UPDATE':''}`,[u.tenantId,id])).rows[0];
 if(!h)throw new NotFoundException('Gutschrift fehlt.');return {...h,number:d.number,created_by:d.created_by};
}
async function source(db:PoolClient,u:Principal,id:string){
 await document(db,u,id);const i=(await db.query('SELECT *,posting_date::text AS posting_day,invoice_date::text AS invoice_day FROM invoices WHERE tenant_id=$1 AND id=$2',[u.tenantId,id])).rows[0];
 if(!i?.sealed||!i.sales_order_id)throw new ConflictException('Vollständige Korrektur benötigt eine gebuchte Direktvertriebsrechnung.');
 const j=(await db.query("SELECT j.*,d.number FROM journals j JOIN documents d ON d.tenant_id=j.tenant_id AND d.id=j.id WHERE j.tenant_id=$1 AND j.id=$2 AND j.status='POSTED' FOR SHARE OF j",[u.tenantId,i.journal_id])).rows[0];
 if(!j||j.reversal_of||(await db.query("SELECT 1 FROM journals WHERE tenant_id=$1 AND reversal_of=$2 AND status='POSTED'",[u.tenantId,j.id])).rowCount)throw new ConflictException('Ursprungsrechnung ist bereits gegengebucht.');
 const op=(await db.query('SELECT * FROM invoice_open_items WHERE tenant_id=$1 AND invoice_id=$2',[u.tenantId,id])).rows[0];
 if(!op||op.amount!==i.gross)throw new ConflictException('Vollständiger unbezahlter Originalposten erforderlich.');
 const lines=(await db.query('SELECT e.position,e.account_id AS "accountId",a.code,a.name,e.side,e.amount::text,e.description,e.cost_center AS "costCenter",e.partner_id AS "partnerId",e.tax_code AS "taxCode",a.active FROM journal_entries e JOIN gl_accounts a ON a.tenant_id=e.tenant_id AND a.id=e.account_id WHERE e.tenant_id=$1 AND e.journal_id=$2 ORDER BY e.position FOR SHARE OF a',[u.tenantId,j.id])).rows;
 if(!lines.length||lines.some(l=>!l.active))throw new ConflictException('Ursprüngliche Finanzkonten müssen für die Gegenbuchung aktiv sein.');
 return {...i,number:i.snapshot.number,journal:j,openItem:op,lines:lines.map(({active,...l})=>l)};
}
async function plan(db:PoolClient,u:Principal,h:any){
 const i=await source(db,u,h.invoice_id),c=await companyWithin(db,u,i.company_id);await periodWithin(db,u,c,h.period_id,h.posting_day,true);
 if(h.posting_day<i.posting_day||h.document_day<i.invoice_day)throw new ConflictException('Korrekturdaten dürfen nicht vor dem Rechnungsoriginal liegen.');
 // The original commercial/tax/address values stay frozen. A fresh, explicitly
 // configured full contact is captured once on preparation, never guessed.
 const contact=h.prepared_snapshot?.creditData?.seller?.contact||await documentContact(db,u,i.company_id);
 const creditData:InvoiceData={...i.snapshot,documentContactLabel:'Vertriebsmitarbeiter',documentType:'CREDIT_NOTE',originalInvoice:{number:i.number,date:i.invoice_day},creditReason:h.reason,number:h.number,date:h.document_day,dueDate:h.document_day,seller:{...i.snapshot.seller,contact}};
 const snapshot={id:h.id,number:h.number,invoiceId:i.id,invoiceNumber:i.number,companyId:i.company_id,periodId:h.period_id,postingDate:h.posting_day,documentDate:h.document_day,reason:h.reason,preparedBy:h.prepared_by,preparedAt:new Date(h.prepared_at).toISOString(),currency:i.currency,net:i.net,tax:i.tax,gross:i.gross,invoiceSnapshot:i.snapshot,sourceJournal:{id:i.journal.id,number:i.journal.number,hash:i.journal.content_hash,lines:i.lines},creditData};
 return {h,i,snapshot};
}
export async function validateCustomerCredit(db:PoolClient,u:Principal,id:string){
 const h=await credit(db,u,id),p=await plan(db,u,h);
 if(!(await db.query('SELECT $1::jsonb=$2::jsonb AS equal',[JSON.stringify(h.prepared_snapshot),JSON.stringify(p.snapshot)])).rows[0].equal)throw new ConflictException('Gutschrift-Prüfstand hat sich geändert; neu vorbereiten und unabhängig freigeben.');return p;
}
export async function customerCreditReviewer(db:PoolClient,u:Principal,id:string){const h=await credit(db,u,id);if([h.created_by,h.prepared_by].includes(u.id))throw new ForbiddenException('Eigene Gutschrift oder eigene Vorbereitung darf nicht selbst freigegeben werden.');}
export async function approveCustomerCredit(db:PoolClient,u:Principal,id:string,note:string){
 await customerCreditReviewer(db,u,id);if(note.trim().length<15)throw new ConflictException('Unabhängige Prüfung nachvollziehbar begründen.');await validateCustomerCredit(db,u,id);
 await db.query('UPDATE customer_credit_memos SET reviewed_by=$3,reviewed_at=now(),review_note=$4 WHERE tenant_id=$1 AND id=$2',[u.tenantId,id,u.id,note]);
}
@Injectable()
export class CustomerCredits{
 constructor(private db:Db){}
 async create(u:Principal,id:string,raw:unknown,key:unknown,corr:string){
  requirePermission(u.role,'billing.credit.write');parse(uuid,id);const input=parse(preparation,raw);
  return this.db.as(u,db=>idempotent(db,u,'CUSTOMER_CREDIT_CREATE:'+id,key,input,async()=>{
   const initial=await source(db,u,id);await companyWithin(db,u,initial.company_id,true);await document(db,u,id,true);const i=await source(db,u,id);version(i.version,input.version);
   if((await db.query('SELECT 1 FROM customer_credit_memos WHERE tenant_id=$1 AND invoice_id=$2',[u.tenantId,id])).rowCount)throw new ConflictException('Gutschrift besteht bereits; vorhandenen Vorgang bearbeiten.');
   const c=await companyWithin(db,u,i.company_id),d=await createDocument(db,u,'CREDIT_NOTE','GU',c.organization_id),h={...d,invoice_id:id,period_id:input.periodId,posting_day:input.postingDate,document_day:input.documentDate,reason:input.reason,prepared_by:u.id,prepared_at:new Date()},p=await plan(db,u,h);
   await db.query('INSERT INTO customer_credit_memos(id,tenant_id,invoice_id,company_id,period_id,posting_date,document_date,reason,prepared_by,prepared_at,prepared_snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[d.id,u.tenantId,id,i.company_id,input.periodId,input.postingDate,input.documentDate,input.reason,u.id,h.prepared_at,JSON.stringify(p.snapshot)]);
   await relate(db,u,id,d.id,'CREDIT_REQUEST');await relate(db,u,i.sales_order_id,d.id,'CUSTOMER_CREDIT');await audit(db,u,corr,'CUSTOMER_CREDIT_CREATED',d.id,{invoiceId:id,reason:input.reason});return {...d,status:'DRAFT',version:1};
  }));
 }
 async list(u:Principal){requirePermission(u.role,'billing.credit.read');return this.db.snapshot(u,async db=>(await db.query(`SELECT h.id,d.number,h.status,h.version,h.document_date::text AS "documentDate",h.posting_date::text AS "postingDate",h.invoice_id AS "invoiceId",i.snapshot->>'number' AS "invoiceNumber",i.snapshot->'buyer'->>'name' AS "partnerName",i.currency,i.net::text,i.tax::text,i.gross::text,i.sales_order_id AS "orderId",i.snapshot->>'orderNumber' AS "orderNumber" FROM customer_credit_memos h JOIN documents d ON d.tenant_id=h.tenant_id AND d.id=h.id JOIN invoices i ON i.tenant_id=h.tenant_id AND i.id=h.invoice_id WHERE h.tenant_id=$1 AND d.organization_id=ANY($2::uuid[]) ORDER BY d.created_at DESC,h.id`,[u.tenantId,u.orgIds])).rows);}
 async detail(u:Principal,id:string){
  requirePermission(u.role,'billing.credit.read');parse(uuid,id);return this.db.snapshot(u,async db=>{
   const h=await credit(db,u,id),s=h.snapshot||h.prepared_snapshot;await companyWithin(db,u,h.company_id);
   const people=(await db.query('SELECT id,name FROM users WHERE tenant_id=$1 AND id=ANY($2::uuid[])',[u.tenantId,[h.prepared_by,h.reviewed_by].filter(Boolean)])).rows,names=new Map(people.map(p=>[p.id,p.name]));
   return {id,number:h.number,status:h.status,version:h.version,invoiceId:h.invoice_id,invoiceNumber:s.invoiceNumber,companyId:h.company_id,periodId:h.period_id,postingDate:h.posting_day,documentDate:h.document_day,reason:h.reason,currency:s.currency,net:s.net,tax:s.tax,gross:s.gross,partnerName:s.invoiceSnapshot.buyer.name,orderNumber:s.invoiceSnapshot.orderNumber,orderId:(await db.query('SELECT sales_order_id FROM invoices WHERE tenant_id=$1 AND id=$2',[u.tenantId,h.invoice_id])).rows[0].sales_order_id,preparedByName:names.get(h.prepared_by),preparedAt:h.prepared_at,reviewedByName:s.review?.name||names.get(h.reviewed_by)||null,reviewNote:h.review_note,reviewedAt:h.reviewed_at,postedAt:h.posted_at,sourceJournal:s.sourceJournal,journal:h.journal_id?(await db.query('SELECT id,number FROM documents WHERE tenant_id=$1 AND id=$2',[u.tenantId,h.journal_id])).rows[0]:null,lines:s.sourceJournal.lines.map((l:any)=>({...l,counterSide:l.side==='DEBIT'?'CREDIT':'DEBIT'})),snapshot:s.creditData,outputStatus:(await db.query('SELECT status FROM customer_credit_output_jobs WHERE tenant_id=$1 AND credit_id=$2',[u.tenantId,id])).rows[0]?.status||null,
    canPrepare:can(u.role,'billing.credit.write')&&['DRAFT','REJECTED'].includes(h.status),canSubmit:can(u.role,'billing.credit.write')&&['DRAFT','REJECTED'].includes(h.status),canPost:can(u.role,'billing.credit.write')&&h.status==='APPROVED',canWithdraw:can(u.role,'billing.credit.write')&&['IN_REVIEW','APPROVED'].includes(h.status),
    periods:(await db.query('SELECT id,year,period,date_from::text AS "dateFrom",date_to::text AS "dateTo",status FROM fiscal_periods WHERE tenant_id=$1 AND company_id=$2 ORDER BY date_from',[u.tenantId,h.company_id])).rows,
    decisions:(await db.query('SELECT ad.decision,ad.comment,u.name AS "actorName",ad.created_at AS "createdAt" FROM approval_decisions ad JOIN approval_instances ai ON ai.tenant_id=ad.tenant_id AND ai.id=ad.instance_id JOIN users u ON u.tenant_id=ad.tenant_id AND u.id=ad.actor_id WHERE ai.tenant_id=$1 AND ai.document_id=$2 ORDER BY ad.created_at,ad.id',[u.tenantId,id])).rows};
  });
 }
 async prepare(u:Principal,id:string,raw:unknown,key:unknown,corr:string){
  requirePermission(u.role,'billing.credit.write');parse(uuid,id);const input=parse(preparation,raw);return this.db.as(u,db=>idempotent(db,u,'CUSTOMER_CREDIT_PREPARE:'+id,key,input,async()=>{
   await lockCustomerCredit(db,u,id);const h=await credit(db,u,id,true);version(h.version,input.version);if(!['DRAFT','REJECTED'].includes(h.status))throw new ConflictException('Nur offene oder abgelehnte Gutschrift neu vorbereiten.');
   Object.assign(h,{period_id:input.periodId,posting_day:input.postingDate,document_day:input.documentDate,reason:input.reason,prepared_by:u.id,prepared_at:new Date(),prepared_snapshot:null});const p=await plan(db,u,h);
   await db.query("UPDATE customer_credit_memos SET status='DRAFT',period_id=$3,posting_date=$4,document_date=$5,reason=$6,prepared_by=$7,prepared_at=$8,prepared_snapshot=$9,reviewed_by=NULL,reviewed_at=NULL,review_note=NULL,version=version+1 WHERE tenant_id=$1 AND id=$2",[u.tenantId,id,input.periodId,input.postingDate,input.documentDate,input.reason,u.id,h.prepared_at,JSON.stringify(p.snapshot)]);await audit(db,u,corr,'CUSTOMER_CREDIT_PREPARED',id,{reason:input.reason});return {id,version:h.version+1,status:'DRAFT'};
  }));
 }
 async withdraw(u:Principal,id:string,raw:unknown,key:unknown,corr:string){
  requirePermission(u.role,'billing.credit.write');parse(uuid,id);const input=parse(z.object({version:z.number().int().positive(),reason:z.string().trim().min(15).max(2000)}).strict(),raw);return this.db.as(u,db=>idempotent(db,u,'CUSTOMER_CREDIT_WITHDRAW:'+id,key,input,async()=>{
   const a=(await db.query('SELECT * FROM approval_instances WHERE tenant_id=$1 AND document_id=$2 AND organization_id=ANY($3::uuid[]) ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE',[u.tenantId,id,u.orgIds])).rows[0];await lockCustomerCredit(db,u,id);const h=await credit(db,u,id,true);version(h.version,input.version);
   if(!a||!['IN_REVIEW','APPROVED'].includes(h.status)||!['PENDING','INFORMATION_REQUIRED','APPROVED'].includes(a.status))throw new ConflictException('Nur eine laufende oder noch nicht gebuchte Gutschriftfreigabe zurückziehen.');
   await db.query("INSERT INTO approval_decisions(id,tenant_id,instance_id,step,actor_id,decision,comment) VALUES($1,$2,$3,$4,$5,'WITHDRAW',$6)",[randomUUID(),u.tenantId,a.id,Math.max(0,Math.min(a.current_step,a.steps_snapshot.length-1)),u.id,input.reason]);await db.query("UPDATE approval_instances SET status='WITHDRAWN',version=version+1 WHERE tenant_id=$1 AND id=$2",[u.tenantId,a.id]);
   await db.query("UPDATE customer_credit_memos SET status='DRAFT',reviewed_by=NULL,reviewed_at=NULL,review_note=NULL,version=version+1 WHERE tenant_id=$1 AND id=$2",[u.tenantId,id]);await audit(db,u,corr,'CUSTOMER_CREDIT_WITHDRAWN',id,{reason:input.reason});return {id,status:'DRAFT',version:h.version+1};
  }));
 }
 async post(u:Principal,id:string,raw:unknown,key:unknown,corr:string){
  requirePermission(u.role,'billing.credit.write');parse(uuid,id);const input=parse(z.object({version:z.number().int().positive()}).strict(),raw);
  const result=await this.db.as(u,db=>idempotent(db,u,'CUSTOMER_CREDIT_POST:'+id,key,input,async()=>{
   await lockCustomerCredit(db,u,id);const h=await credit(db,u,id,true);version(h.version,input.version);if(h.status!=='APPROVED'||!h.reviewed_by)throw new ConflictException('Unabhängig freigegebene Gutschrift erforderlich.');
   const reviewer=(await db.query('SELECT role,name,active FROM users WHERE tenant_id=$1 AND id=$2 FOR SHARE',[u.tenantId,h.reviewed_by])).rows[0];if(!reviewer?.active||!['ADMIN','ACCOUNTANT'].includes(reviewer.role)||(await db.query('SELECT 1 FROM user_organizations WHERE tenant_id=$1 AND user_id=$2 AND organization_id=(SELECT organization_id FROM documents WHERE tenant_id=$1 AND id=$3)',[u.tenantId,h.reviewed_by,id])).rowCount===0)throw new ConflictException('Finanzfreigabeverantwortung hat sich geändert.');
   const p=await validateCustomerCredit(db,u,id),lines=p.i.lines.map(({position,code,name,...l}:any)=>({...l,side:l.side==='DEBIT'?'CREDIT':'DEBIT'}));
   const journal=await automaticJournal(db,u,{companyId:h.company_id,periodId:h.period_id,postingDate:h.posting_day,documentDate:h.document_day,description:'Gutschrift '+h.number+' zu '+p.i.number,reference:p.i.number,lines},id,corr,{id:p.i.journal.id,reason:h.reason});
   await db.query('INSERT INTO customer_credit_open_items(credit_id,tenant_id,invoice_id,company_id,partner_id,account_id,currency,amount) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[id,u.tenantId,h.invoice_id,h.company_id,p.i.partner_id,p.i.openItem.account_id,p.i.currency,p.i.gross]);
   const snapshot={...p.snapshot,review:{actorId:h.reviewed_by,name:reviewer.name,note:h.review_note,at:new Date(h.reviewed_at).toISOString()}};
   await db.query("UPDATE customer_credit_memos SET status='POSTED',journal_id=$3,snapshot=$4,sealed=true,posted_at=now(),version=version+1 WHERE tenant_id=$1 AND id=$2",[u.tenantId,id,journal.id,JSON.stringify(snapshot)]);
   await db.query('INSERT INTO customer_credit_output_jobs(credit_id,tenant_id,archive_number) VALUES($1,$2,$3)',[id,u.tenantId,await nextNumber(db,u.tenantId,'DO')]);await relate(db,u,h.invoice_id,id,'CREDITED_BY');await audit(db,u,corr,'CUSTOMER_INVOICE_CREDITED',id,{invoiceId:h.invoice_id,journalId:journal.id,gross:p.i.gross});return {id,number:h.number,status:'POSTED',version:h.version+1,journal};
  }));
  await this.processOutput(u,id,corr).catch(()=>{});return {...result,outputStatus:(await this.detail(u,id)).outputStatus};
 }
 async processOutput(u:Principal,id:string,corr:string){
  requirePermission(u.role,'billing.credit.write');await this.detail(u,id);const claim=await this.db.as(u,async db=>{
   const j=(await db.query('SELECT * FROM customer_credit_output_jobs WHERE tenant_id=$1 AND credit_id=$2 FOR UPDATE',[u.tenantId,id])).rows[0];if(!j)throw new ConflictException('Erst unabhängig freigeben und buchen.');if(j.status==='READY')return null;if(j.status==='PROCESSING'&&Date.now()-new Date(j.started_at).getTime()<300000)throw new ConflictException('Gutschriftausgabe wird verarbeitet.');const token=randomUUID();await db.query("UPDATE customer_credit_output_jobs SET status='PROCESSING',attempts=attempts+1,token=$3,started_at=now(),last_error='' WHERE tenant_id=$1 AND credit_id=$2",[u.tenantId,id,token]);return {token,archiveNumber:j.archive_number,snapshot:(await db.query('SELECT snapshot FROM customer_credit_memos WHERE tenant_id=$1 AND id=$2',[u.tenantId,id])).rows[0].snapshot.creditData};
  });if(!claim)return {id,status:'READY'};
  try{const output=await createValidatedEInvoice(claim.snapshot,claim.archiveNumber);await this.db.as(u,async db=>{
   const j=(await db.query('SELECT token FROM customer_credit_output_jobs WHERE tenant_id=$1 AND credit_id=$2 FOR UPDATE',[u.tenantId,id])).rows[0];if(j.token!==claim.token)throw new ConflictException('Ausgabeauftrag wurde übernommen.');
   await db.query('INSERT INTO customer_credit_outputs(credit_id,tenant_id,pdf,xml,pdf_hash,xml_hash,validator,validation_report,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[id,u.tenantId,output.pdf,output.xml,hash(output.pdf),hash(output.xml),output.validator,output.validation,u.id]);
   await db.query("INSERT INTO document_attachments(id,tenant_id,source_id,number,document_type,filename,visibility,origin,source_version,template_version,source_hash,source_snapshot,content,sha256,created_by) VALUES($1,$2,$3,$4,'CREDIT_NOTE',$5,'CUSTOMER','GENERATED',1,6,$6,$7,$8,$9,$10)",[randomUUID(),u.tenantId,id,claim.archiveNumber,claim.snapshot.number+'.pdf',hash(JSON.stringify(claim.snapshot)),JSON.stringify(claim.snapshot),output.pdf,hash(output.pdf),u.id]);
   await db.query("UPDATE customer_credit_output_jobs SET status='READY',finished_at=now() WHERE tenant_id=$1 AND credit_id=$2",[u.tenantId,id]);await audit(db,u,corr,'CUSTOMER_CREDIT_OUTPUT_READY',id,{pdfHash:hash(output.pdf),xmlHash:hash(output.xml),validator:output.validator});
  });return {id,status:'READY'};
  }catch(e){await this.db.as(u,async db=>{await db.query("UPDATE customer_credit_output_jobs SET status=$4,finished_at=now(),last_error=$5 WHERE tenant_id=$1 AND credit_id=$2 AND token=$3",[u.tenantId,id,claim.token,e instanceof EInvoiceBusyError?'PENDING':'FAILED','Gutschriftausgabe oder normative Validierung fehlgeschlagen; Ausgabe kann erneut verarbeitet werden.']);await audit(db,u,corr,'CUSTOMER_CREDIT_OUTPUT_FAILED',id,{errorType:(e as Error).name});});throw new ConflictException('Gutschrift ist gebucht; Ausgabe erneut verarbeiten.');}
 }
 async download(u:Principal,id:string,kind:'pdf'|'xml',corr:string){
  requirePermission(u.role,'billing.read');parse(uuid,id);return this.db.as(u,async db=>{await document(db,u,id);const r=(await db.query("SELECT o.*,h.snapshot FROM customer_credit_outputs o JOIN customer_credit_memos h ON h.tenant_id=o.tenant_id AND h.id=o.credit_id JOIN invoices i ON i.tenant_id=h.tenant_id AND i.id=h.invoice_id WHERE o.tenant_id=$1 AND o.credit_id=$2 AND h.sealed AND ($3::uuid IS NULL OR i.partner_id=$3)",[u.tenantId,id,u.role==='CUSTOMER'?u.partnerId:null])).rows[0];if(!r)throw new NotFoundException('Validierte Gutschriftausgabe fehlt.');const data=r[kind] as Buffer;if(hash(data)!==r[kind+'_hash'])throw new ConflictException('Ausgabeintegrität verletzt.');await audit(db,u,corr,'CUSTOMER_CREDIT_DOWNLOADED',id,{kind,sha256:hash(data)});return {data,filename:r.snapshot.number+'.'+kind};});
 }
}
