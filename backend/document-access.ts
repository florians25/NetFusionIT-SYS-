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
 return {sql:`SELECT d.id FROM documents d WHERE d.tenant_id=$1 AND d.organization_id=ANY($2::uuid[]) AND (${clauses.join(' OR ')||'FALSE'})`,values};
}
