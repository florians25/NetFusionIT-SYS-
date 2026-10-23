import {lockCustomerCredit,validateCustomerCredit,customerCreditReviewer,approveCustomerCredit} from './customer-credits';
import {lockServiceQuote,prepareServiceQuoteReview,validateServiceQuoteReview,serviceQuoteReviewer,approveServiceQuote,serviceQuoteContributors} from './service-quotes';
import {lockSalesOrder,prepareSalesOrderReview,validateSalesOrderReview,salesOrderReviewer,approveSalesOrder,salesOrderContributors} from './sales-orders';
import {lockInventoryCount,validateInventoryCount,inventoryCountReviewer,approveInventoryCount,inventoryCountContributors} from './inventory-counts';
import {lockSupplierReversal,validateSupplierReversal,supplierReversalReviewer,approveSupplierReversal} from './supplier-reversals';
import {lockSupplierPosting,validateSupplierPosting,supplierReviewer,approveSupplierTax} from './supplier-posting';
import {lockBillingSubject,validateBillingRequest} from './billing';
import {validateFinancialMaster} from './partner-finance';
import { ensureOrderRequirements,refreshMaterialStatus } from './material-state';
import { Injectable,ConflictException,ForbiddenException,NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Db,Principal,parse,uuid,audit,idempotent } from './core';
import { ROLES,requirePermission } from './permissions';
import { checkOrg,document,notify,version } from './business';
import { submitReport,decideReport,lockReportSubject } from './work';
import { procurementSubject,lockProcurementSubject,validateProcurementApproval,refreshRequisition,checkPurchasingResponsibility } from './procurement';
export const approvalSubjects:Record<string,{table:string,pending:string,approved:string,rejected:string,permission:string}>={CREDIT_NOTE:{table:'customer_credit_memos',pending:'IN_REVIEW',approved:'APPROVED',rejected:'REJECTED',permission:'billing.credit.write'},QUOTATION:{table:'service_quotes',pending:'IN_REVIEW',approved:'APPROVED',rejected:'REJECTED',permission:'quote.write'},SALES_ORDER:{table:'sales_orders',pending:'IN_REVIEW',approved:'RELEASED',rejected:'REJECTED',permission:'sales.write'},INVENTORY_COUNT:{table:'inventory_counts',pending:'IN_REVIEW',approved:'APPROVED',rejected:'REJECTED',permission:'inventory.count.prepare'},SUPPLIER_INVOICE_REVERSAL:{table:'supplier_invoice_reversals',pending:'IN_REVIEW',approved:'APPROVED',rejected:'REJECTED',permission:'ap.post'},SUPPLIER_INVOICE:{table:'supplier_invoices',pending:'IN_REVIEW',approved:'APPROVED',rejected:'REJECTED',permission:'ap.post'},BILLING_REQUEST:{table:'billing_requests',pending:'IN_REVIEW',approved:'RELEASED',rejected:'REJECTED',permission:'billing.release'},PARTNER_ACCOUNT:{table:'partner_company_accounts',pending:'IN_REVIEW',approved:'ACTIVE',rejected:'REJECTED',permission:'partner.account.write'},COMPANY_BILLING_PROFILE:{table:'company_billing_profiles',pending:'IN_REVIEW',approved:'ACTIVE',rejected:'REJECTED',permission:'partner.account.write'},BUSINESS_PARTNER:{table:'business_partners',pending:'IN_REVIEW',approved:'ACTIVE',rejected:'REJECTED',permission:'partner.write'},MATERIAL:{table:'products',pending:'IN_REVIEW',approved:'ACTIVE',rejected:'REJECTED',permission:'material.write'},SERVICE_ORDER:{table:'service_orders',pending:'IN_REVIEW',approved:'RELEASED',rejected:'REJECTED',permission:'order.write'},REQUISITION:{table:'purchase_requisitions',pending:'IN_REVIEW',approved:'RELEASED',rejected:'REJECTED',permission:'requisition.write'},PURCHASE_ORDER:{table:'purchase_orders',pending:'IN_REVIEW',approved:'RELEASED',rejected:'REJECTED',permission:'procurement.write'},ACCOUNTING:{table:'journals',pending:'IN_REVIEW',approved:'APPROVED',rejected:'REJECTED',permission:'finance.write'},SERVICE_REPORT:{table:'service_reports',pending:'IN_REVIEW',approved:'APPROVED',rejected:'REJECTED',permission:'order.execute'}};
@Injectable()
export class Workflow {
 constructor(private db:Db){}
 async definitions(u:Principal){return this.db.as(u,async db=>(await db.query('SELECT id,name,subject_kind AS "subjectKind",organization_id AS "organizationId",version,steps,four_eyes AS "fourEyes",active FROM approval_definitions WHERE tenant_id=$1 AND organization_id=ANY($2::uuid[]) ORDER BY subject_kind,version DESC',[u.tenantId,u.orgIds])).rows);}
 async configure(u:Principal,raw:unknown,key:unknown,correlation:string){
  requirePermission(u.role,'workflow.configure');
  const input=parse(z.object({name:z.string().trim().min(3).max(100),organizationId:uuid,subjectKind:z.enum(Object.keys(approvalSubjects) as [string,...string[]]),fourEyes:z.boolean(),steps:z.array(z.object({name:z.string().trim().min(2).max(80),roles:z.array(z.enum(ROLES)).min(1).max(16).refine(r=>!r.includes('CUSTOMER'),'Kunden sind keine internen Freigeber')}).strict()).min(1).max(10)}).strict(),raw);
  checkOrg(u,input.organizationId);
  if(['SALES_ORDER','QUOTATION'].includes(input.subjectKind)&&(!input.fourEyes||input.steps.some(s=>s.roles.some(r=>!['ADMIN','SERVICE_MANAGER','SALES','EXECUTIVE'].includes(r)))))throw new ConflictException('Kundenaufträge benötigen unabhängige Vertriebs-/Geschäftsführungsfreigabe.');
  if(input.subjectKind==='SERVICE_REPORT'&&(!input.fourEyes||input.steps.some(s=>s.roles.some(r=>!['ADMIN','SERVICE_MANAGER'].includes(r)))))throw new ConflictException('Leistungsnachweise benötigen Vier-Augen-Prüfung durch Serviceleitung oder Administration.');
  if(['BILLING_REQUEST','PARTNER_ACCOUNT','COMPANY_BILLING_PROFILE'].includes(input.subjectKind)&&(!input.fourEyes||input.steps.some(s=>s.roles.some(r=>!(input.subjectKind==='BILLING_REQUEST'?['ADMIN','SERVICE_MANAGER','ACCOUNTANT']:['ADMIN','ACCOUNTANT']).includes(r)))))throw new ConflictException('Faktura-/Finanzstammfreigabe benötigt unabhängige berechtigte Prüfung.');
  if(['CREDIT_NOTE','INVENTORY_COUNT','ACCOUNTING','SUPPLIER_INVOICE','SUPPLIER_INVOICE_REVERSAL'].includes(input.subjectKind)&&(!input.fourEyes||input.steps.some(s=>s.roles.some(r=>!['ADMIN','ACCOUNTANT'].includes(r)))))throw new ConflictException('Finanzbelege benötigen Vier-Augen-Prüfung durch Buchhaltung oder Administration.');
  if(['REQUISITION','PURCHASE_ORDER'].includes(input.subjectKind)&&(!input.fourEyes||input.steps.some(s=>s.roles.some(r=>!(input.subjectKind==='REQUISITION'?['ADMIN','SERVICE_MANAGER','PURCHASING_MANAGER']:['ADMIN','PURCHASING_MANAGER']).includes(r)))))throw new ConflictException('Beschaffungsfreigaben benötigen Vier-Augen-Prüfung durch Service-/Einkaufsleitung oder Administration.');
  return this.db.as(u,db=>idempotent(db,u,'WORKFLOW_CONFIGURE',key,input,async()=>{
   await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`WORKFLOW:${u.tenantId}:${input.organizationId}:${input.subjectKind}`]);
   const prior=await db.query('UPDATE approval_definitions SET active=false WHERE tenant_id=$1 AND organization_id=$2 AND subject_kind=$3 AND active RETURNING version',[u.tenantId,input.organizationId,input.subjectKind]);
   const id=randomUUID(),revision=(prior.rows[0]?.version||0)+1;
   await db.query('INSERT INTO approval_definitions(id,tenant_id,organization_id,name,subject_kind,version,steps,four_eyes) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[id,u.tenantId,input.organizationId,input.name,input.subjectKind,revision,JSON.stringify(input.steps),input.fourEyes]);
   await audit(db,u,correlation,'WORKFLOW_CONFIGURED',null,{definitionId:id,version:revision,subjectKind:input.subjectKind});
   return {id,version:revision};
  }));
 }
 async submitWithin(db:PoolClient,u:Principal,id:string,expected:number,correlation:string){
  await lockCustomerCredit(db,u,id);await lockServiceQuote(db,u,id);await lockSalesOrder(db,u,id);await lockInventoryCount(db,u,id);await lockSupplierReversal(db,u,id);await lockSupplierPosting(db,u,id);await lockBillingSubject(db,u,id);await lockProcurementSubject(db,u,id);await lockReportSubject(db,u,id);
  const doc=await document(db,u,id,true),subject=approvalSubjects[doc.kind];
  if(!subject)throw new ConflictException('Dieser Belegtyp unterstützt noch keinen Freigabeprozess.');
  const directRequest=doc.kind==='REQUISITION'&&(await db.query('SELECT 1 FROM purchase_requisitions WHERE tenant_id=$1 AND id=$2 AND sales_order_id IS NOT NULL',[u.tenantId,id])).rowCount;
  requirePermission(u.role,directRequest?'sales.procurement.plan':subject.permission);
  const r=await db.query(`SELECT * FROM ${subject.table} WHERE tenant_id=$1 AND id=$2 FOR UPDATE`,[u.tenantId,id]);
  if(!r.rowCount)throw new NotFoundException('Fachbeleg nicht gefunden.');
  version(r.rows[0].version,expected);
  if(!['DRAFT','REJECTED'].includes(r.rows[0].status))throw new ConflictException('Nur Entwurf oder abgelehnter Beleg kann eingereicht werden.');
  if(doc.kind==='SERVICE_ORDER'&&!(await db.query('SELECT 1 FROM service_order_items WHERE tenant_id=$1 AND order_id=$2',[u.tenantId,id])).rowCount)throw new ConflictException('Serviceauftrag benötigt mindestens eine Position.');
  if(['REQUISITION','PURCHASE_ORDER'].includes(doc.kind))await validateProcurementApproval(db,u,id,doc.kind);
  if(doc.kind==='QUOTATION')await prepareServiceQuoteReview(db,u,id);
  if(doc.kind==='SALES_ORDER')await prepareSalesOrderReview(db,u,id);
  if(doc.kind==='INVENTORY_COUNT')await validateInventoryCount(db,u,id);
  if(doc.kind==='SUPPLIER_INVOICE')await validateSupplierPosting(db,u,id);
  if(doc.kind==='CREDIT_NOTE')await validateCustomerCredit(db,u,id);
  if(doc.kind==='SUPPLIER_INVOICE_REVERSAL')await validateSupplierReversal(db,u,id);
  if(doc.kind==='BILLING_REQUEST')await validateBillingRequest(db,u,id);
  if(['PARTNER_ACCOUNT','COMPANY_BILLING_PROFILE'].includes(doc.kind))await validateFinancialMaster(db,u,id,doc.kind);
  if(doc.kind==='SERVICE_REPORT')await submitReport(db,u,r.rows[0]);
  const definition=(await db.query('SELECT * FROM approval_definitions WHERE tenant_id=$1 AND organization_id=$2 AND subject_kind=$3 AND active',[u.tenantId,doc.organization_id,doc.kind])).rows[0];
  if(!definition)throw new ConflictException('Zuerst eine fachlich bestätigte Freigabedefinition für diesen Belegtyp und diese Organisation konfigurieren.');
  const contributors=doc.kind==='QUOTATION'?await serviceQuoteContributors(db,u,id):doc.kind==='INVENTORY_COUNT'?await inventoryCountContributors(db,u,id):doc.kind==='SALES_ORDER'?await salesOrderContributors(db,u,id):[];
  for(const step of definition.steps){
   const candidates=await db.query('SELECT DISTINCT usr.id FROM users usr JOIN user_organizations o ON o.tenant_id=usr.tenant_id AND o.user_id=usr.id WHERE usr.tenant_id=$1 AND o.organization_id=$2 AND usr.role=ANY($3::text[]) AND usr.active AND ($4::boolean=false OR (usr.id<>$5 AND usr.id<>$6)) AND NOT usr.id=ANY($7::uuid[])',[u.tenantId,doc.organization_id,step.roles,definition.four_eyes,u.id,doc.created_by,contributors]);
   if(!candidates.rowCount)throw new ConflictException('Kein berechtigter aktiver Freigeber für Stufe '+step.name+'.');
  }
  const instanceId=randomUUID();
  await db.query(`UPDATE ${subject.table} SET status=$3,version=version+1 WHERE tenant_id=$1 AND id=$2`,[u.tenantId,id,subject.pending]);
  await db.query("INSERT INTO approval_instances(id,tenant_id,definition_id,organization_id,document_id,submitted_by,status,steps_snapshot,four_eyes,subject_version) VALUES($1,$2,$3,$4,$5,$6,'PENDING',$7,$8,$9)",[instanceId,u.tenantId,definition.id,doc.organization_id,id,u.id,JSON.stringify(definition.steps),definition.four_eyes,expected+1]);
  await audit(db,u,correlation,'APPROVAL_SUBMITTED',id,{instanceId,definitionId:definition.id,definitionVersion:definition.version});
  return {id:instanceId,documentId:id,status:'PENDING',version:1};
 }
 async submit(u:Principal,id:string,raw:unknown,key:unknown,correlation:string){
  parse(uuid,id);const input=parse(z.object({version:z.number().int().positive()}).strict(),raw);
  return this.db.as(u,db=>idempotent(db,u,'APPROVAL_SUBMIT:'+id,key,input,()=>this.submitWithin(db,u,id,input.version,correlation)));
 }
 async inbox(u:Principal){
  return this.db.as(u,async db=>(await db.query(`SELECT i.id,i.document_id AS "documentId",d.number,d.kind,i.status,i.current_step AS "currentStep",i.steps_snapshot AS steps,i.submitted_by AS "submittedBy",usr.name AS "submittedByName",i.version,i.created_at AS "createdAt",i.four_eyes AS "fourEyes",d.created_by AS "createdBy",coalesce((SELECT prepared_by FROM customer_credit_memos cm WHERE cm.tenant_id=d.tenant_id AND cm.id=d.id),(SELECT prepared_by FROM supplier_invoices si WHERE si.tenant_id=d.tenant_id AND si.id=d.id),(SELECT prepared_by FROM supplier_invoice_reversals sr WHERE sr.tenant_id=d.tenant_id AND sr.id=d.id),(SELECT prepared_by FROM inventory_counts ic WHERE ic.tenant_id=d.tenant_id AND ic.id=d.id)) AS "preparedBy",ARRAY(SELECT qe.actor_id FROM service_quote_events qe WHERE qe.tenant_id=d.tenant_id AND qe.quote_id=d.id UNION SELECT se.actor_id FROM sales_order_events se WHERE se.tenant_id=d.tenant_id AND se.order_id=d.id UNION SELECT qe.actor_id FROM sales_orders so JOIN service_quote_events qe ON qe.tenant_id=so.tenant_id AND qe.quote_id=so.source_quote_id WHERE so.tenant_id=d.tenant_id AND so.id=d.id UNION SELECT e.actor_id FROM inventory_count_entries e WHERE e.tenant_id=d.tenant_id AND e.count_id=d.id UNION SELECT l.created_by FROM inventory_count_lines l WHERE l.tenant_id=d.tenant_id AND l.count_id=d.id UNION SELECT p.prepared_by FROM inventory_count_preparations p WHERE p.tenant_id=d.tenant_id AND p.count_id=d.id) AS "contributorIds",(SELECT matched_by FROM supplier_invoices si WHERE si.tenant_id=d.tenant_id AND si.id=d.id) AS "matchedBy" FROM approval_instances i JOIN documents d ON d.tenant_id=i.tenant_id AND d.id=i.document_id JOIN users usr ON usr.tenant_id=i.tenant_id AND usr.id=i.submitted_by WHERE i.tenant_id=$1 AND i.organization_id=ANY($2::uuid[]) AND (i.submitted_by=$3 OR (i.steps_snapshot->i.current_step->'roles') ? $4 OR $4='ADMIN' OR EXISTS(SELECT 1 FROM approval_decisions ad WHERE ad.tenant_id=i.tenant_id AND ad.instance_id=i.id AND ad.actor_id=$3)) ORDER BY i.created_at DESC LIMIT 100`,[u.tenantId,u.orgIds,u.id,u.role])).rows);
 }
 async decisions(u:Principal,id:string){
  parse(uuid,id);return this.db.as(u,async db=>{
   const instance=(await db.query('SELECT * FROM approval_instances WHERE tenant_id=$1 AND id=$2 AND organization_id=ANY($3::uuid[])',[u.tenantId,id,u.orgIds])).rows[0];
   if(!instance)throw new NotFoundException('Genehmigung nicht gefunden.');
   if(instance.submitted_by!==u.id&&u.role!=='ADMIN'&&!instance.steps_snapshot.some((s:any)=>s.roles.includes(u.role)))throw new ForbiddenException('Kein Zugriff auf Genehmigung.');
   return (await db.query('SELECT a.id,a.step,a.decision,a.comment,a.created_at AS "createdAt",u.name AS "actorName" FROM approval_decisions a JOIN users u ON u.tenant_id=a.tenant_id AND u.id=a.actor_id WHERE a.tenant_id=$1 AND a.instance_id=$2 ORDER BY a.created_at,a.id',[u.tenantId,id])).rows;
  });
 }
 async decide(u:Principal,id:string,raw:unknown,key:unknown,correlation:string){
  parse(uuid,id);const input=parse(z.object({decision:z.enum(['APPROVE','REJECT','REQUEST_INFORMATION','RESUBMIT']),comment:z.string().trim().min(3).max(2000),version:z.number().int().positive(),inputTaxChecked:z.boolean().optional()}).strict(),raw);
  return this.db.as(u,db=>idempotent(db,u,'APPROVAL_DECIDE:'+id,key,input,async()=>{
   const i=(await db.query('SELECT * FROM approval_instances WHERE tenant_id=$1 AND id=$2 AND organization_id=ANY($3::uuid[]) FOR UPDATE',[u.tenantId,id,u.orgIds])).rows[0];
   if(!i)throw new NotFoundException('Genehmigung nicht gefunden.');version(i.version,input.version);
   await lockCustomerCredit(db,u,i.document_id);await lockServiceQuote(db,u,i.document_id);await lockSalesOrder(db,u,i.document_id);await lockInventoryCount(db,u,i.document_id);await lockSupplierReversal(db,u,i.document_id);await lockSupplierPosting(db,u,i.document_id);await lockBillingSubject(db,u,i.document_id);await lockProcurementSubject(db,u,i.document_id);await lockReportSubject(db,u,i.document_id);
   const doc=await document(db,u,i.document_id,true),subject=approvalSubjects[doc.kind];
   if(!subject)throw new ConflictException('Freigabe-Belegtyp fehlt.');
   if(input.inputTaxChecked!==undefined&&doc.kind!=='SUPPLIER_INVOICE')throw new ConflictException('Vorsteuerbestätigung gehört ausschließlich zur Eingangsrechnungsfreigabe.');
   if(doc.kind==='PURCHASE_ORDER')await checkPurchasingResponsibility(db,u,i.document_id);
   if(doc.kind==='QUOTATION'&&input.decision!=='RESUBMIT')await serviceQuoteReviewer(db,u,i.document_id);
   if(doc.kind==='SALES_ORDER'&&input.decision!=='RESUBMIT')await salesOrderReviewer(db,u,i.document_id);
   if(doc.kind==='INVENTORY_COUNT'&&input.decision!=='RESUBMIT')await inventoryCountReviewer(db,u,i.document_id);
   if(doc.kind==='SUPPLIER_INVOICE'&&input.decision!=='RESUBMIT')await supplierReviewer(db,u,i.document_id);
   if(doc.kind==='CREDIT_NOTE'&&input.decision!=='RESUBMIT')await customerCreditReviewer(db,u,i.document_id);
   if(doc.kind==='SUPPLIER_INVOICE_REVERSAL'&&input.decision!=='RESUBMIT')await supplierReversalReviewer(db,u,i.document_id);
   const s=(await db.query(`SELECT version FROM ${subject.table} WHERE tenant_id=$1 AND id=$2 FOR UPDATE`,[u.tenantId,i.document_id])).rows[0];version(s.version,i.subject_version);
   let status=i.status,nextStep=i.current_step;
   if(input.decision==='RESUBMIT'){
    if(i.status!=='INFORMATION_REQUIRED'||i.submitted_by!==u.id)throw new ForbiddenException('Nur der Einreicher kann eine Rückfrage beantworten.');status='PENDING';
   }else{
    if(i.status!=='PENDING')throw new ConflictException('Genehmigung ist nicht entscheidbar.');
    if(!i.steps_snapshot[i.current_step].roles.includes(u.role))throw new ForbiddenException('Keine Freigabeberechtigung für diese Stufe.');
    if(i.four_eyes&&(i.submitted_by===u.id||doc.created_by===u.id))throw new ForbiddenException('Vier-Augen-Prinzip: keine eigene Freigabe.');
    if(input.decision==='APPROVE'){nextStep++;status=nextStep>=i.steps_snapshot.length?'APPROVED':'PENDING';}
    if(input.decision==='REJECT')status='REJECTED';
    if(input.decision==='REQUEST_INFORMATION')status='INFORMATION_REQUIRED';
   }
   if(doc.kind==='QUOTATION'&&input.decision==='APPROVE'){if(status==='APPROVED')await approveServiceQuote(db,u,i.document_id,input.comment);else await validateServiceQuoteReview(db,u,i.document_id);}
   if(doc.kind==='SALES_ORDER'&&input.decision==='APPROVE'){if(status==='APPROVED')await approveSalesOrder(db,u,i.document_id,input.comment);else await validateSalesOrderReview(db,u,i.document_id);}
   if(doc.kind==='SERVICE_ORDER'&&status==='APPROVED'){
    if(!(await db.query("SELECT 1 FROM service_orders o JOIN business_partners p ON p.tenant_id=o.tenant_id AND p.id=o.partner_id WHERE o.tenant_id=$1 AND o.id=$2 AND p.status='ACTIVE'",[u.tenantId,i.document_id])).rowCount)throw new ConflictException('Kunde ist nicht mehr aktiv; Auftrag kann nicht freigegeben werden.');
    if((await db.query("SELECT 1 FROM service_order_items i JOIN products p ON p.tenant_id=i.tenant_id AND p.id=i.product_id WHERE i.tenant_id=$1 AND i.order_id=$2 AND p.status<>'ACTIVE'",[u.tenantId,i.document_id])).rowCount)throw new ConflictException('Ein Auftragsartikel ist nicht mehr freigegeben.');
   }
   if(['REQUISITION','PURCHASE_ORDER'].includes(doc.kind)&&input.decision==='APPROVE')await validateProcurementApproval(db,u,i.document_id,doc.kind);
   if(doc.kind==='BILLING_REQUEST'&&status==='APPROVED')await validateBillingRequest(db,u,i.document_id);
   if(['PARTNER_ACCOUNT','COMPANY_BILLING_PROFILE'].includes(doc.kind)&&status==='APPROVED')await validateFinancialMaster(db,u,i.document_id,doc.kind);
   if(doc.kind==='INVENTORY_COUNT'&&status==='APPROVED')await approveInventoryCount(db,u,i.document_id,input.comment);
   if(doc.kind==='SUPPLIER_INVOICE'&&status==='APPROVED')await approveSupplierTax(db,u,i.document_id,input.inputTaxChecked,input.comment);
   if(doc.kind==='CREDIT_NOTE'&&status==='APPROVED')await approveCustomerCredit(db,u,i.document_id,input.comment);
   if(doc.kind==='SUPPLIER_INVOICE_REVERSAL'&&status==='APPROVED')await approveSupplierReversal(db,u,i.document_id,input.comment);
   if(doc.kind==='SERVICE_REPORT'&&input.decision!=='RESUBMIT')await decideReport(db,u,i.document_id,status);
   const decisionContext=['CREDIT_NOTE','QUOTATION','SALES_ORDER','INVENTORY_COUNT','SUPPLIER_INVOICE','SUPPLIER_INVOICE_REVERSAL'].includes(doc.kind)&&status==='APPROVED'?{...(doc.kind==='SUPPLIER_INVOICE'?{inputTaxChecked:true}:{}),role:u.role,preparedHash:(await db.query(`SELECT encode(sha256(convert_to(${['QUOTATION','SALES_ORDER'].includes(doc.kind)?'approval_snapshot':'prepared_snapshot'}::text,'UTF8')),'hex') AS hash FROM ${subject.table} WHERE tenant_id=$1 AND id=$2`,[u.tenantId,i.document_id])).rows[0].hash}:{};
   await db.query('INSERT INTO approval_decisions(id,tenant_id,instance_id,step,actor_id,decision,comment,context) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[randomUUID(),u.tenantId,id,i.current_step,u.id,input.decision,input.comment,JSON.stringify(decisionContext)]);
   await db.query('UPDATE approval_instances SET status=$3,current_step=$4,version=version+1 WHERE tenant_id=$1 AND id=$2',[u.tenantId,id,status,nextStep]);
   if(['APPROVED','REJECTED'].includes(status))await db.query(`UPDATE ${subject.table} SET status=$3,version=version+1 WHERE tenant_id=$1 AND id=$2`,[u.tenantId,i.document_id,status==='APPROVED'?subject.approved:subject.rejected]);
   if(doc.kind==='SERVICE_ORDER'&&status==='APPROVED'){await ensureOrderRequirements(db,u,i.document_id,correlation);await refreshMaterialStatus(db,u,i.document_id,correlation);}
   if(doc.kind==='PURCHASE_ORDER'&&status==='APPROVED'){const p=(await db.query('SELECT requisition_id FROM purchase_orders WHERE tenant_id=$1 AND id=$2',[u.tenantId,i.document_id])).rows[0];await refreshRequisition(db,u,p.requisition_id);}
   if(['REQUISITION','PURCHASE_ORDER'].includes(doc.kind)&&['APPROVED','REJECTED'].includes(status)){const p=await procurementSubject(db,u,i.document_id,doc.kind);await refreshMaterialStatus(db,u,p.sales_order_id||p.order_id,correlation);}
   await audit(db,u,correlation,'APPROVAL_'+input.decision,i.document_id,{instanceId:id,step:i.current_step,comment:input.comment,status});
   await notify(db,u,[i.submitted_by],'APPROVAL_'+status,i.document_id,{instanceId:id});
   return {id,status,version:i.version+1,currentStep:nextStep};
  }));
 }
}
