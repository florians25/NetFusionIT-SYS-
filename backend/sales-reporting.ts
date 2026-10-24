import {ConflictException,Injectable} from '@nestjs/common';
import {PoolClient} from 'pg';
import Decimal from 'decimal.js';
import {z} from 'zod';
import {Db,Principal,parse,uuid,audit} from './core';
import {companyWithin} from './finance';
import {can,requirePermission} from './permissions';

const D=Decimal.clone({precision:60,rounding:Decimal.ROUND_HALF_UP});
const day=z.iso.date(),optionalId=z.preprocess(v=>v===''?undefined:v,uuid.optional());
const query=z.object({companyId:uuid,from:day,to:day,compareFrom:day.optional(),compareTo:day.optional(),partnerId:optionalId,productId:optionalId,salesAreaId:optionalId,orderId:optionalId,process:z.enum(['ALL','DIRECT_SALES','SERVICE']).default('DIRECT_SALES'),groupBy:z.enum(['DAY','MONTH','QUARTER','YEAR','CUSTOMER','PRODUCT','ORDER']).default('MONTH'),offset:z.coerce.number().int().min(0).max(100000).default(0),pageSize:z.coerce.number().int().min(1).max(200).default(50)}).strict().superRefine((i,c)=>{
 if(i.to<i.from||new Date(i.to).getTime()-new Date(i.from).getTime()>366*5*86400000)c.addIssue({code:'custom',message:'Zeitraum muss geordnet sein und darf höchstens fünf Jahre umfassen.'});
 if(!!i.compareFrom!==!!i.compareTo)c.addIssue({code:'custom',message:'Vergleich benötigt Beginn und Ende.'});
 if(i.compareFrom&&i.compareTo&&(i.compareTo<i.compareFrom||new Date(i.to).getTime()-new Date(i.from).getTime()!==new Date(i.compareTo).getTime()-new Date(i.compareFrom).getTime()))c.addIssue({code:'custom',message:'Vergleichszeitraum benötigt dieselbe Anzahl Kalendertage.'});
});
type Filters=z.infer<typeof query>;

// Windows run before product/customer/date filters. This allocates the original
// invoice tax and historical WA value without multiplying joins or losing the
// last cent across partial invoices. Credits reuse exactly that allocation.
const eventsSql=`WITH original AS (
 SELECT i.id AS invoice_id,i.sales_order_id,i.order_id,i.partner_id,i.posting_date,i.invoice_date,i.currency,i.snapshot,d.number,ii.id AS line_id,ii.position,ii.quantity,ii.net,ii.tax_rate,bl.snapshot AS line_snapshot,
 coalesce(si.product_id,oi.product_id) AS product_id,coalesce(so.sales_area_id,service_so.sales_area_id) AS sales_area_id,
 round(sum(ii.net) OVER(PARTITION BY ii.invoice_id,ii.tax_rate ORDER BY ii.position ROWS UNBOUNDED PRECEDING)*ii.tax_rate/100,2)-round((sum(ii.net) OVER(PARTITION BY ii.invoice_id,ii.tax_rate ORDER BY ii.position ROWS UNBOUNDED PRECEDING)-ii.net)*ii.tax_rate/100,2) AS line_tax,
 CASE WHEN i.sales_order_id IS NOT NULL AND gi.id IS NOT NULL THEN
 round(gi.value*sum(ii.quantity) OVER(PARTITION BY gi.id ORDER BY d.number,ii.position ROWS UNBOUNDED PRECEDING)/gi.quantity,2)-round(gi.value*(sum(ii.quantity) OVER(PARTITION BY gi.id ORDER BY d.number,ii.position ROWS UNBOUNDED PRECEDING)-ii.quantity)/gi.quantity,2) END AS billed_cost
 FROM invoices i JOIN documents d ON d.tenant_id=i.tenant_id AND d.id=i.id JOIN invoice_items ii ON ii.tenant_id=i.tenant_id AND ii.invoice_id=i.id
 JOIN billing_request_lines bl ON bl.tenant_id=ii.tenant_id AND bl.id=ii.request_line_id
 LEFT JOIN goods_issue_items gi ON gi.tenant_id=bl.tenant_id AND gi.id=bl.goods_issue_item_id
 LEFT JOIN sales_order_items si ON si.tenant_id=bl.tenant_id AND si.id=bl.sales_item_id LEFT JOIN service_order_items oi ON oi.tenant_id=bl.tenant_id AND oi.id=bl.item_id
 LEFT JOIN sales_orders so ON so.tenant_id=i.tenant_id AND so.id=i.sales_order_id LEFT JOIN service_orders srv ON srv.tenant_id=i.tenant_id AND srv.id=i.order_id LEFT JOIN sales_orders service_so ON service_so.tenant_id=srv.tenant_id AND service_so.id=srv.source_sales_order_id
 WHERE i.tenant_id=$1 AND i.company_id=$2 AND d.organization_id=ANY($3::uuid[]) AND i.sealed
),events AS (
 SELECT o.invoice_id AS document_id,o.number AS document_number,'INVOICE'::text AS document_kind,'INVOICE'::text AS event_kind,o.line_id,o.position,o.posting_date,o.invoice_date AS document_date,o.invoice_id,o.number AS invoice_number,
 coalesce(o.sales_order_id,o.order_id) AS order_id,o.snapshot->>'orderNumber' AS order_number,CASE WHEN o.sales_order_id IS NULL THEN 'SERVICE' ELSE 'DIRECT_SALES' END AS process,
 o.partner_id,o.snapshot->'buyer'->>'name' AS partner_name,o.product_id,o.sales_area_id,o.line_snapshot->>'sku' AS sku,o.line_snapshot->>'description' AS description,o.quantity,o.line_snapshot->>'unit' AS unit,o.net,o.line_tax AS tax,o.billed_cost,0::numeric AS stock_expense
 FROM original o
 UNION ALL
 SELECT cm.id,d.number,'CREDIT_NOTE','CREDIT_NOTE',o.line_id,o.position,cm.posting_date,cm.document_date,o.invoice_id,o.number,coalesce(o.sales_order_id,o.order_id),o.snapshot->>'orderNumber',CASE WHEN o.sales_order_id IS NULL THEN 'SERVICE' ELSE 'DIRECT_SALES' END,
 o.partner_id,o.snapshot->'buyer'->>'name',o.product_id,o.sales_area_id,o.line_snapshot->>'sku',o.line_snapshot->>'description',-o.quantity,o.line_snapshot->>'unit',-o.net,-o.line_tax,-o.billed_cost,0::numeric
 FROM original o JOIN customer_credit_memos cm ON cm.tenant_id=$1 AND cm.invoice_id=o.invoice_id AND cm.sealed JOIN documents d ON d.tenant_id=cm.tenant_id AND d.id=cm.id
 WHERE cm.correction_mode='FULL' OR EXISTS(SELECT 1 FROM customer_credit_lines cl WHERE cl.tenant_id=cm.tenant_id AND cl.credit_id=cm.id AND cl.invoice_item_id=o.line_id)
 UNION ALL
 SELECT g.id,d.number,'GOODS_ISSUE',CASE g.movement_type WHEN 'ISSUE' THEN 'STOCK_ISSUE' ELSE 'STOCK_RETURN' END,gi.id,gi.position,g.posting_date,g.document_date,NULL::uuid,NULL::text,h.id,od.number,'DIRECT_SALES',h.partner_id,
 coalesce((SELECT p->>'name' FROM jsonb_array_elements(h.released_snapshot->'commercial'->'partners') p WHERE p->>'role'='SOLD_TO'),h.released_snapshot->'commercial'->'header'->>'partnerName'),gi.product_id,h.sales_area_id,si.price_snapshot->'product'->>'sku',si.description,
 CASE g.movement_type WHEN 'ISSUE' THEN gi.quantity ELSE -gi.quantity END,si.unit,0::numeric,0::numeric,0::numeric,CASE g.movement_type WHEN 'ISSUE' THEN gi.value ELSE -gi.value END
 FROM goods_issues g JOIN documents d ON d.tenant_id=g.tenant_id AND d.id=g.id JOIN goods_issue_items gi ON gi.tenant_id=g.tenant_id AND gi.issue_id=g.id JOIN sales_orders h ON h.tenant_id=g.tenant_id AND h.id=g.sales_order_id
 JOIN documents od ON od.tenant_id=h.tenant_id AND od.id=h.id JOIN sales_order_items si ON si.tenant_id=gi.tenant_id AND si.id=gi.sales_item_id
 WHERE g.tenant_id=$1 AND g.company_id=$2 AND d.organization_id=ANY($3::uuid[]) AND g.sealed AND $8::boolean
),filtered AS (
 SELECT * FROM events WHERE posting_date BETWEEN $4::date AND $5::date AND ($6::uuid IS NULL OR partner_id=$6) AND ($7::uuid IS NULL OR product_id=$7) AND ($9::text='ALL' OR process=$9) AND ($10::uuid IS NULL OR sales_area_id=$10) AND ($11::uuid IS NULL OR order_id=$11)
)`;
const sumSql=`count(*)::int AS "lineCount",count(DISTINCT document_id) FILTER(WHERE event_kind='INVOICE')::int AS "invoiceCount",count(DISTINCT document_id) FILTER(WHERE event_kind='CREDIT_NOTE')::int AS "creditCount",
 coalesce(sum(net) FILTER(WHERE event_kind='INVOICE'),0)::numeric(30,2)::text AS "invoiceNet",(-coalesce(sum(net) FILTER(WHERE event_kind='CREDIT_NOTE'),0))::numeric(30,2)::text AS "creditNet",coalesce(sum(net),0)::numeric(30,2)::text AS "netRevenue",coalesce(sum(tax),0)::numeric(30,2)::text AS tax,
 coalesce(sum(net+tax),0)::numeric(30,2)::text AS gross,coalesce(sum(billed_cost),0)::numeric(30,2)::text AS "billedCost",coalesce(sum(stock_expense),0)::numeric(30,2)::text AS "stockExpense",count(*) FILTER(WHERE billed_cost IS NULL)::int AS "unknownCostLines"`;
const detailsSql=`document_id AS "documentId",document_number AS "documentNumber",document_kind AS "documentKind",event_kind AS "eventKind",line_id AS "lineId",position,posting_date::text AS "postingDate",document_date::text AS "documentDate",invoice_id AS "invoiceId",invoice_number AS "invoiceNumber",order_id AS "orderId",order_number AS "orderNumber",process,partner_id AS "partnerId",partner_name AS "partnerName",product_id AS "productId",sku,description,quantity::text,unit,net::numeric(30,2)::text,tax::numeric(30,2)::text,billed_cost::numeric(30,2)::text AS "billedCost",stock_expense::numeric(30,2)::text AS "stockExpense"`;
const groupExpressions:Record<Filters['groupBy'],{key:string;label:string}>={
 DAY:{key:"posting_date::text",label:"to_char(posting_date,'DD.MM.YYYY')"},MONTH:{key:"to_char(posting_date,'YYYY-MM')",label:"to_char(posting_date,'MM.YYYY')"},QUARTER:{key:"to_char(posting_date,'YYYY-Q')",label:"'Q'||to_char(posting_date,'Q YYYY')"},YEAR:{key:"to_char(posting_date,'YYYY')",label:"to_char(posting_date,'YYYY')"},
 CUSTOMER:{key:'partner_id::text',label:'partner_name'},PRODUCT:{key:'product_id::text',label:"coalesce(sku,'Ohne Artikelzuordnung')"},ORDER:{key:'order_id::text',label:'order_number'}
};
function financial(s:any,costs:boolean){
 const complete=costs&&s.unknownCostLines===0;
 return {...s,billedCost:costs?s.billedCost:null,stockExpense:costs?s.stockExpense:null,billingMargin:complete?new D(s.netRevenue).minus(s.billedCost).toFixed(2):null,billingMarginPercent:complete&&new D(s.netRevenue).gt(0)?new D(s.netRevenue).minus(s.billedCost).div(s.netRevenue).times(100).toFixed(2):null,periodContribution:complete?new D(s.netRevenue).minus(s.stockExpense).toFixed(2):null,costCoverage:costs?(complete?'COMPLETE_DIRECT_STOCK':'INCOMPLETE_SERVICE_COST'):'REVENUE_ONLY'};
}
export function reportingCsvCell(v:unknown,numeric=false){let s=v===null||v===undefined?'':String(v);if(!numeric&&/^[\s]*[=+\-@\t\r\n]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
@Injectable()
export class SalesReporting{
 constructor(private db:Db){}
 async configuration(u:Principal){requirePermission(u.role,'reporting.sales.read');return this.db.snapshot(u,async db=>({companies:(await db.query('SELECT id,organization_id AS "organizationId",code,name,currency FROM company_codes WHERE tenant_id=$1 AND organization_id=ANY($2::uuid[]) ORDER BY code',[u.tenantId,u.orgIds])).rows,canReadCosts:can(u.role,'reporting.cost.read')}));}
 async context(u:Principal,raw:unknown){requirePermission(u.role,'reporting.sales.read');const {companyId}=parse(z.object({companyId:uuid}).strict(),raw);return this.db.snapshot(u,async db=>{
  const c=await companyWithin(db,u,companyId);return {partners:(await db.query("SELECT id,number,name FROM business_partners WHERE tenant_id=$1 AND organization_id=$2 AND 'CUSTOMER'=ANY(roles) ORDER BY name,id LIMIT 500",[u.tenantId,c.organization_id])).rows,products:(await db.query('SELECT p.id,p.sku,p.name FROM products p JOIN documents d ON d.tenant_id=p.tenant_id AND d.id=p.id WHERE p.tenant_id=$1 AND d.organization_id=$2 ORDER BY p.sku,p.id LIMIT 500',[u.tenantId,c.organization_id])).rows,areas:(await db.query('SELECT a.id,s.code AS "salesOrgCode",ch.code AS "channelCode",di.code AS "divisionCode" FROM sd_sales_areas a JOIN sd_org_units s ON s.tenant_id=a.tenant_id AND s.id=a.sales_org_id JOIN sd_org_units ch ON ch.tenant_id=a.tenant_id AND ch.id=a.channel_id JOIN sd_org_units di ON di.tenant_id=a.tenant_id AND di.id=a.division_id WHERE a.tenant_id=$1 AND s.company_id=$2 AND a.organization_id=$3 ORDER BY s.code,ch.code,di.code',[u.tenantId,c.id,c.organization_id])).rows,selectionLimit:500};
 });}
 private parameters(u:Principal,i:Filters,costs:boolean,from=i.from,to=i.to){return [u.tenantId,i.companyId,u.orgIds,from,to,i.partnerId||null,i.productId||null,costs,i.process,i.salesAreaId||null,i.orderId||null];}
 private async scope(db:PoolClient,u:Principal,i:Filters){
  const c=await companyWithin(db,u,i.companyId);await db.query("SET LOCAL statement_timeout='8s'");
  if(i.partnerId&&!(await db.query('SELECT 1 FROM business_partners WHERE tenant_id=$1 AND id=$2 AND organization_id=$3',[u.tenantId,i.partnerId,c.organization_id])).rowCount)throw new ConflictException('Kunde gehört nicht zum berechtigten Buchungskreis.');
  if(i.productId&&!(await db.query('SELECT 1 FROM products p JOIN documents d ON d.tenant_id=p.tenant_id AND d.id=p.id WHERE p.tenant_id=$1 AND p.id=$2 AND d.organization_id=$3',[u.tenantId,i.productId,c.organization_id])).rowCount)throw new ConflictException('Artikel gehört nicht zur berechtigten Organisation.');
  if(i.salesAreaId&&!(await db.query('SELECT 1 FROM sd_sales_areas a JOIN sd_org_units s ON s.tenant_id=a.tenant_id AND s.id=a.sales_org_id WHERE a.tenant_id=$1 AND a.id=$2 AND a.organization_id=$3 AND s.company_id=$4',[u.tenantId,i.salesAreaId,c.organization_id,c.id])).rowCount)throw new ConflictException('Vertriebsbereich gehört nicht zum Buchungskreis.');if(i.orderId&&!(await db.query('SELECT 1 FROM sales_orders WHERE tenant_id=$1 AND id=$2 AND company_id=$3 AND organization_id=$4 UNION ALL SELECT 1 FROM service_orders so JOIN documents d ON d.tenant_id=so.tenant_id AND d.id=so.id WHERE so.tenant_id=$1 AND so.id=$2 AND d.organization_id=$4',[u.tenantId,i.orderId,c.id,c.organization_id])).rowCount)throw new ConflictException('Auftrag gehört nicht zur berechtigten Organisation.');return c;
 }
 async sales(u:Principal,raw:unknown){
  requirePermission(u.role,'reporting.sales.read');const i=parse(query,raw),costs=can(u.role,'reporting.cost.read');
  return this.db.snapshot(u,async db=>{
   const c=await this.scope(db,u,i),params=this.parameters(u,i,costs),s=(await db.query(eventsSql+' SELECT '+sumSql+' FROM filtered',params)).rows[0],group=groupExpressions[i.groupBy];
   const groups=(await db.query(eventsSql+` SELECT coalesce(${group.key},'UNASSIGNED') AS key,min(${group.label}) AS label,${sumSql} FROM filtered GROUP BY 1 ORDER BY 1 LIMIT 501`,params)).rows;
   const rows=(await db.query(eventsSql+` SELECT ${detailsSql} FROM filtered ORDER BY posting_date,document_number,position LIMIT $12 OFFSET $13`,[...params,i.pageSize,i.offset])).rows.map(r=>({...r,billedCost:costs?r.billedCost:null,stockExpense:costs?r.stockExpense:null}));
   let comparison:any=null;if(i.compareFrom&&i.compareTo){const previous=financial((await db.query(eventsSql+' SELECT '+sumSql+' FROM filtered',this.parameters(u,i,costs,i.compareFrom,i.compareTo))).rows[0],costs),delta=new D(s.netRevenue).minus(previous.netRevenue);comparison={from:i.compareFrom,to:i.compareTo,summary:previous,revenueDelta:delta.toFixed(2),revenueDeltaPercent:new D(previous.netRevenue).isZero()?null:delta.div(new D(previous.netRevenue).abs()).times(100).toFixed(2)};}
   return {asOf:new Date().toISOString(),dateBasis:'FI_POSTING_DATE',company:{id:c.id,code:c.code,name:c.name,currency:c.currency},filters:i,canReadCosts:costs,summary:financial(s,costs),comparison,groups:groups.slice(0,500).map(g=>financial(g,costs)),groupsTruncated:groups.length>500,rows,totalRows:s.lineCount,hasMore:i.offset+rows.length<s.lineCount,
    definitions:{revenue:'Gebuchte Rechnungspositionen minus gebuchte Gutschriften am jeweiligen FI-Buchungsdatum. Steuer und Zahlung sind kein Nettoumsatz.',billingMargin:'Rechnungsbezogener Deckungsbeitrag I: Nettoumsatz minus anteiliger ursprünglicher WA-Wert der fakturierten Warenmenge. Gutschriften korrigieren genau diese analytische Zuordnung.',stockExpense:'Tatsächlicher Warenaufwand aus WA und physischen Gegenbewegungen im Buchungszeitraum, einschließlich noch unfakturierter Lieferungen.',periodContribution:'Nettoumsatz minus tatsächlichem Warenaufwand im Zeitraum. Service-, Personal- und Gemeinkosten sind keine automatisch mit Null angesetzten Kosten.',coverage:'Kostenbasis für den vorhandenen Direktvertrieb mit Lagerartikeln. Service-Istkosten und geplante Kalkulation fehlen; entsprechende Deckungsbeiträge bleiben leer.'}};
  });
 }
 async csv(u:Principal,raw:unknown,corr:string){
  requirePermission(u.role,'reporting.sales.read');const i=parse(query,raw),costs=can(u.role,'reporting.cost.read');
  const result=await this.db.snapshot(u,async db=>{const c=await this.scope(db,u,i),rows=(await db.query(eventsSql+` SELECT ${detailsSql} FROM filtered ORDER BY posting_date,document_number,position LIMIT 10001`,this.parameters(u,i,costs))).rows;if(rows.length>10000)throw new ConflictException('Export auf höchstens10.000 Quellenpositionen eingrenzen.');
   const germanDate=(s:string)=>s.slice(8,10)+'.'+s.slice(5,7)+'.'+s.slice(0,4),number=(s:string|null)=>s===null?'':s.replace('.',','),labels:Record<string,string>={INVOICE:'Rechnung',CREDIT_NOTE:'Rechnungskorrektur',STOCK_ISSUE:'Warenabgang',STOCK_RETURN:'Warenrücknahme'};
   const header=['Buchungsdatum','Belegdatum','Quelle','Belegnummer','Position','Kundenauftrag / Serviceauftrag','Kunde','Artikel','Bezeichnung','Belegmenge','Einheit','Nettoumsatz','Umsatzsteuer',...(costs?['Fakturabezogener Warenwert','Tatsächlicher Warenaufwand']:[]),'Währung'];
   const lines=rows.map(r=>[germanDate(r.postingDate),germanDate(r.documentDate),labels[r.eventKind],r.documentNumber,r.position,r.orderNumber,r.partnerName,r.sku,r.description,number(r.quantity),r.unit,number(r.net),number(r.tax),...(costs?[number(r.billedCost),number(r.stockExpense)]:[]),c.currency].map((v,n)=>reportingCsvCell(v,[4,9,11,12,...(costs?[13,14]:[])].includes(n))).join(';'));
   return {data:Buffer.from('\ufeff'+header.map(v=>reportingCsvCell(v)).join(';')+'\r\n'+lines.join('\r\n')+'\r\n','utf8'),filename:'Umsatz-'+c.code+'-'+i.from+'-'+i.to+'.csv',rows:rows.length};
  });await this.db.as(u,db=>audit(db,u,corr,'SALES_REPORT_EXPORTED',null,{filters:i,rows:result.rows,costs}));return result;
 }
}
