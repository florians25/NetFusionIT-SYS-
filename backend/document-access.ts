import { Principal,ticketQuery,caseQuery } from './core';
import { can } from './permissions';
export function visibleDocuments(u:Principal){
 const tickets=ticketQuery(u),cases=caseQuery(u),values=tickets.values;
 const clauses:string[]=[];
 if(can(u.role,'service.read')){
  clauses.push(`(d.kind='TICKET' AND d.id IN(SELECT id FROM (${tickets.sql}) visible_tickets))`);
  clauses.push(`(d.kind='SERVICE_CASE' AND d.id IN(SELECT id FROM (${cases.sql}) visible_cases))`);
  clauses.push(`(d.kind='FIELD_VISIT' AND d.id IN(SELECT v.id FROM field_visits v WHERE v.tenant_id=$1 AND v.case_id IN(SELECT id FROM (${cases.sql}) visible_cases)${['TECHNICIAN','FIELD_TECHNICIAN'].includes(u.role)?' AND EXISTS(SELECT 1 FROM visit_technicians vt JOIN technicians t ON t.tenant_id=vt.tenant_id AND t.id=vt.technician_id WHERE vt.tenant_id=v.tenant_id AND vt.visit_id=v.id AND t.user_id=$3)':''}))`);
 }
 const partnerCondition=(alias:string)=>u.role==='CUSTOMER'?`${alias}.partner_id=$3`:['TECHNICIAN','FIELD_TECHNICIAN'].includes(u.role)?`${alias}.partner_id IN(SELECT "partnerId" FROM (${tickets.sql}) visible_tickets)`:'TRUE';
 if(can(u.role,'partner.read'))clauses.push(`(d.kind='BUSINESS_PARTNER' AND d.id IN(SELECT p.id FROM business_partners p WHERE p.tenant_id=$1${u.role==='CUSTOMER'?' AND p.id=$3':''}))`);
 if(can(u.role,'asset.read'))clauses.push(`(d.kind='TECHNICAL_OBJECT' AND d.id IN(SELECT a.id FROM technical_objects a WHERE a.tenant_id=$1 AND ${partnerCondition('a')}))`);
 if(can(u.role,'contract.read'))clauses.push(`(d.kind='SERVICE_CONTRACT' AND d.id IN(SELECT c.id FROM service_contracts c WHERE c.tenant_id=$1 AND ${partnerCondition('c')}))`);
 if(can(u.role,'quote.read'))clauses.push(`(d.kind='QUOTATION' AND d.id IN(SELECT q.id FROM service_quotes q WHERE q.tenant_id=$1${u.role==='CUSTOMER'?" AND q.partner_id=$3 AND q.status IN('PUBLISHED','ACCEPTED','DECLINED')":''}))`);
 if(can(u.role,'sales.read'))clauses.push(`(d.kind='SALES_ORDER' AND d.id IN(SELECT so.id FROM sales_orders so WHERE so.tenant_id=$1${u.role==='CUSTOMER'?" AND so.partner_id=$3 AND so.status='RELEASED'":''}))`);
 if(can(u.role,'sales.fulfillment.read')){
  const own=u.role==='CUSTOMER'?' AND h.partner_id=$3':'';
  clauses.push(`(d.kind='SALES_ORDER' AND d.id IN(SELECT h.id FROM sales_orders h WHERE h.tenant_id=$1 AND h.execution_mode='DIRECT_SALES' AND h.status='RELEASED'${own}))`);
  clauses.push(`(d.kind='GOODS_ISSUE' AND d.id IN(SELECT g.id FROM goods_issues g JOIN sales_orders h ON h.tenant_id=g.tenant_id AND h.id=g.sales_order_id WHERE g.tenant_id=$1 AND g.sealed AND h.status='RELEASED'${own}))`);
 }
 if(can(u.role,'sales.return.read'))clauses.push("d.kind IN('CUSTOMER_RETURN','CUSTOMER_RETURN_RECEIPT')");
 if(can(u.role,'sales.procurement.read')){
  clauses.push(`(d.kind='SALES_ORDER' AND d.id IN(SELECT h.id FROM sales_orders h WHERE h.tenant_id=$1 AND h.execution_mode='DIRECT_SALES' AND h.status='RELEASED'))`);
  clauses.push(`(d.kind IN ('MATERIAL_REQUIREMENT','REQUISITION','PURCHASE_ORDER') AND d.id IN(SELECT id FROM order_requirements WHERE tenant_id=$1 AND sales_order_id IS NOT NULL UNION ALL SELECT id FROM purchase_requisitions WHERE tenant_id=$1 AND sales_order_id IS NOT NULL UNION ALL SELECT id FROM purchase_orders WHERE tenant_id=$1 AND sales_order_id IS NOT NULL))`);
 }
 if(can(u.role,'inventory.read')&&can(u.role,'sales.procurement.read'))clauses.push(`(d.kind='GOODS_RECEIPT' AND d.id IN(SELECT g.id FROM goods_receipts g JOIN sales_orders h ON h.tenant_id=g.tenant_id AND h.id=g.sales_order_id WHERE g.tenant_id=$1 AND g.sealed AND h.status='RELEASED' AND h.execution_mode='DIRECT_SALES'))`);
 if(can(u.role,'inventory.read'))clauses.push(`d.kind IN ('MATERIAL','STOCK_TRANSFER','INVENTORY_COUNT')`);
 if(can(u.role,'service.read')&&u.role!=='CUSTOMER')clauses.push(`(d.kind='WORK_ORDER_TASK' AND d.id IN(SELECT w.id FROM work_order_tasks w WHERE w.tenant_id=$1 AND w.ticket_id IN(SELECT id FROM (${tickets.sql}) visible_tickets)))`);
 if(can(u.role,'order.read'))clauses.push(`(d.kind='SERVICE_ORDER' AND d.id IN(SELECT o.id FROM service_orders o WHERE o.tenant_id=$1 AND o.case_id IN(SELECT id FROM (${cases.sql}) visible_cases)))`);
 if(can(u.role,'order.read'))clauses.push(`(d.kind='SERVICE_REPORT' AND d.id IN(SELECT r.id FROM service_reports r JOIN service_orders o ON o.tenant_id=r.tenant_id AND o.id=r.order_id WHERE r.tenant_id=$1 AND o.case_id IN(SELECT id FROM (${cases.sql}) visible_cases)${u.role==='CUSTOMER'?" AND r.status IN ('IN_REVIEW','APPROVED')":''}))`);
 if(can(u.role,'requisition.read'))clauses.push(`(d.kind IN ('MATERIAL_REQUIREMENT','REQUISITION','PURCHASE_ORDER') AND d.id IN(SELECT r.id FROM order_requirements r WHERE r.tenant_id=$1 AND r.order_id IN(SELECT o.id FROM service_orders o WHERE o.tenant_id=$1 AND o.case_id IN(SELECT id FROM (${cases.sql}) visible_cases)) UNION ALL SELECT r.id FROM purchase_requisitions r WHERE r.tenant_id=$1 AND r.order_id IN(SELECT o.id FROM service_orders o WHERE o.tenant_id=$1 AND o.case_id IN(SELECT id FROM (${cases.sql}) visible_cases)) UNION ALL SELECT p.id FROM purchase_orders p WHERE p.tenant_id=$1 AND p.order_id IN(SELECT o.id FROM service_orders o WHERE o.tenant_id=$1 AND o.case_id IN(SELECT id FROM (${cases.sql}) visible_cases))))`);
 if(can(u.role,'inventory.read'))clauses.push(`(d.kind='GOODS_RECEIPT' AND d.id IN(SELECT g.id FROM goods_receipts g JOIN service_orders o ON o.tenant_id=g.tenant_id AND o.id=g.order_id WHERE g.tenant_id=$1 AND o.case_id IN(SELECT id FROM (${cases.sql}) visible_cases)))`);
 if(can(u.role,'inventory.read'))clauses.push(`(d.kind='GOODS_ISSUE' AND d.id IN(SELECT g.id FROM goods_issues g JOIN service_orders o ON o.tenant_id=g.tenant_id AND o.id=g.order_id WHERE g.tenant_id=$1 AND o.case_id IN(SELECT id FROM (${cases.sql}) visible_cases)))`);
 if(can(u.role,'ap.read'))clauses.push("d.kind IN ('SUPPLIER_INVOICE','SUPPLIER_INVOICE_REVERSAL')");
 if(can(u.role,'billing.read.internal'))clauses.push("d.kind='BILLING_REQUEST'");
 if(can(u.role,'partner.account.read'))clauses.push("d.kind IN ('PARTNER_ACCOUNT','COMPANY_BILLING_PROFILE')");
 if(can(u.role,'billing.read'))clauses.push(`(d.kind='INVOICE' AND d.id IN(SELECT i.id FROM invoices i WHERE i.tenant_id=$1 AND i.sealed${u.role==='CUSTOMER'?' AND i.partner_id=$3':''}))`);
 if(can(u.role,'billing.credit.read'))clauses.push("d.kind='CREDIT_NOTE'");
 if(u.role==='CUSTOMER')clauses.push("(d.kind='CREDIT_NOTE' AND d.id IN(SELECT h.id FROM customer_credit_memos h JOIN invoices i ON i.tenant_id=h.tenant_id AND i.id=h.invoice_id WHERE h.tenant_id=$1 AND h.sealed AND i.partner_id=$3))");
 if(can(u.role,'finance.read'))clauses.push("d.kind='ACCOUNTING'");
 return {sql:`SELECT d.id FROM documents d WHERE d.tenant_id=$1 AND d.organization_id=ANY($2::uuid[]) AND (${clauses.join(' OR ')||'FALSE'})`,values};
}
