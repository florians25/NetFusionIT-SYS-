import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Db,Principal,ticketQuery,caseQuery,uuid,parse } from './core';
import { requirePermission } from './permissions';
type Fields=Record<string,string>;
export const entityFields:Record<string,Fields>={
  Tickets:{id:'Guid',number:'String',title:'String',description:'String',type:'String',priority:'String',status:'String',version:'Int32',source:'String',correlationId:'Guid',contractId:'Guid',caseId:'Guid',caseNumber:'String',partnerId:'Guid',partnerName:'String',partnerEmail:'String',organizationId:'Guid',createdAt:'DateTimeOffset',updatedAt:'DateTimeOffset',technicianId:'Guid',technicianName:'String'},
  ServiceCases:{id:'Guid',number:'String',title:'String',status:'String',technicalStatus:'String',commercialStatus:'String',version:'Int32',partnerName:'String',createdAt:'DateTimeOffset'},
  BusinessPartners:{id:'Guid',number:'String',name:'String',email:'String',status:'String',organizationId:'Guid'},
  Technicians:{id:'Guid',name:'String',organizationId:'Guid'}
};
function bad():never{throw new BadRequestException('OData-Abfrage nicht unterstützt oder ungültig.');}
function field(name:string,fields:Fields){if(!Object.hasOwn(fields,name))bad();return `"${name}"`;}
// Bewusst kleiner, dokumentierter OData-Ausdrucksparser. Niemals rohe Filter in SQL.
function filterSQL(raw:string,fields:Fields,values:unknown[]){
  if(raw.length>2048)bad();
  const regex=/\s+|'(?:[^']|'')*'|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|[A-Za-z_][A-Za-z_0-9]*|\d+|[(),]/gy;
  const tokens:string[]=[];let cursor=0;
  while(cursor<raw.length){regex.lastIndex=cursor;const m=regex.exec(raw);if(!m)bad();cursor=regex.lastIndex;if(m[0].trim())tokens.push(m[0]);if(tokens.length>200)bad();}
  let i=0,depth=0;
  const take=()=>tokens[i++]||bad();
  const expect=(s:string)=>{if(take()!==s)bad();};
  function literal(name:string){
    const token=take();let value:unknown;
    if(token==='null')return 'NULL';
    if(fields[name]==='Int32'){if(!/^\d+$/.test(token))bad();value=Number(token);}
    else if(fields[name]==='Guid'){value=parse(uuid,token.replace(/^'|'$/g,''));}
    else {if(!token.startsWith("'"))bad();value=token.slice(1,-1).replace(/''/g,"'");}
    values.push(value);return `$${values.length}`;
  }
  function atom():string{
    if(++depth>20)bad();
    try{
      if(tokens[i]==='('){i++;const result=or();expect(')');return `(${result})`;}
      if(tokens[i]==='contains'){
        i++;expect('(');const name=take(),column=field(name,fields);if(fields[name]!=='String')bad();expect(',');const lit=literal(name);if(lit==='NULL')bad();expect(')');
        return `strpos(lower(${column}),lower(${lit}::text))>0`;
      }
      const name=take(),column=field(name,fields),operator=take();if(!['eq','ne'].includes(operator))bad();
      const lit=literal(name);
      return lit==='NULL'?`${column} IS ${operator==='ne'?'NOT ':''}NULL`:`${column}${operator==='eq'?'=':'<>'}${lit}`;
    }finally{depth--;}
  }
  function and():string{let left=atom();while(tokens[i]==='and'){i++;left=`(${left} AND ${atom()})`;}return left;}
  function or():string{let left=and();while(tokens[i]==='or'){i++;left=`(${left} OR ${and()})`;}return left;}
  const result=or();if(i!==tokens.length)bad();return result;
}
export function metadata(){
  const types=Object.entries(entityFields).map(([set,fields])=>`<EntityType Name="${set}"><Key><PropertyRef Name="id"/></Key>${Object.entries(fields).map(([name,type])=>`<Property Name="${name}" Type="Edm.${type}"${type==='DateTimeOffset'?' Precision="3"':''} Nullable="${['technicianId','contractId'].includes(name)?'true':'false'}"/>`).join('')}</EntityType>`).join('');
  const sets=Object.keys(entityFields).map(set=>`<EntitySet Name="${set}" EntityType="NetFusion.${set}"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx"><edmx:DataServices><Schema Namespace="NetFusion" xmlns="http://docs.oasis-open.org/odata/ns/edm">${types}<EntityContainer Name="Service">${sets}</EntityContainer></Schema></edmx:DataServices></edmx:Edmx>`;
}
@Injectable()
export class OData {
  constructor(private db:Db){}
  async read(u:Principal,path:string,query:Record<string,unknown>){
    const match=/^(Tickets|ServiceCases|BusinessPartners|Technicians)(?:\(([a-fA-F0-9-]{36})\))?$/.exec(path);
    if(!match)throw new NotFoundException('OData-Ressource nicht verfügbar.');
    const [,set,id]=match,fields=entityFields[set];
    requirePermission(u.role,set==='BusinessPartners'?'partner.read':'service.read');
    for(const key of Object.keys(query))if(!['$top','$skip','$select','$orderby','$filter','$count'].includes(key)||typeof query[key]!=='string')bad();
    if(set==='Technicians'&&u.role==='CUSTOMER')throw new ForbiddenException('Keine Berechtigung.');
    if(set==='BusinessPartners'&&u.role==='TECHNICIAN')throw new ForbiddenException('Keine Berechtigung.');
    let base;
    if(set==='Tickets')base=ticketQuery(u);
    else if(set==='ServiceCases')base=caseQuery(u);
    else if(set==='BusinessPartners')base={sql:'SELECT id,number,name,email,status,organization_id AS "organizationId" FROM business_partners WHERE tenant_id=$1 AND organization_id=ANY($2::uuid[])'+(u.role==='CUSTOMER'?' AND id=$3':''),values:u.role==='CUSTOMER'?[u.tenantId,u.orgIds,u.partnerId]:[u.tenantId,u.orgIds]};
    else base={sql:"SELECT t.id,t.name,t.organization_id AS \"organizationId\" FROM technicians t JOIN users u ON u.tenant_id=t.tenant_id AND u.id=t.user_id WHERE t.tenant_id=$1 AND t.organization_id=ANY($2::uuid[]) AND t.active AND u.active AND u.role IN ('TECHNICIAN','FIELD_TECHNICIAN')",values:[u.tenantId,u.orgIds]};
    const values:unknown[]=[...base.values];
    let where='TRUE';
    if(id){parse(uuid,id);values.push(id);where=`id=$${values.length}`;}
    if(query.$filter)where+=` AND (${filterSQL(String(query.$filter),fields,values)})`;
    let select='*';
    if(query.$select){const selected=String(query.$select).split(',').map(s=>s.trim());if(!selected.includes('id'))selected.unshift('id');select=selected.map(s=>field(s,fields)).join(',');}
    const order=query.$orderby?String(query.$orderby).split(',').map(part=>{
      const [name,direction='asc',...extra]=part.trim().split(/\s+/);if(extra.length||!['asc','desc'].includes(direction))bad();return `${field(name,fields)} ${direction}`;
    }).join(',')+',id':'id';
    const numeric=(v:unknown,fallback:number)=>{if(v===undefined)return fallback;if(typeof v!=='string'||!/^\d{1,8}$/.test(v))bad();return Number(v);};
    const top=numeric(query.$top,50),skip=numeric(query.$skip,0);if(top>100||skip>1000000)bad();
    if(query.$count!==undefined&&!['true','false'].includes(String(query.$count)))bad();
    return this.db.as(u,async db=>{
      const result=await db.query(`SELECT ${select} FROM (${base.sql}) q WHERE ${where} ORDER BY ${order} LIMIT ${top} OFFSET ${skip}`,values);
      if(id){if(!result.rowCount)throw new NotFoundException('Datensatz nicht gefunden.');return {'@odata.context':`/odata/$metadata#${set}/$entity`,...result.rows[0]};}
      const response:Record<string,unknown>={'@odata.context':`/odata/$metadata#${set}`,value:result.rows};
      if(query.$count==='true')response['@odata.count']=Number((await db.query(`SELECT count(*) AS count FROM (${base.sql}) q WHERE ${where}`,values)).rows[0].count);
      return response;
    });
  }
}
