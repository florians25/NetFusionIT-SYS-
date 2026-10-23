import {ConflictException} from '@nestjs/common';
import {PoolClient} from 'pg';
import {Principal} from './core';

// A trusted accepted commercial source, never an API-supplied pricing override.
export async function acceptedQuoteForOrder(db:PoolClient,u:Principal,h:any){
 if(!h.source_quote_id)return null;
 await db.query('SELECT assert_quote_order_source($1,$2)',[u.tenantId,h.id]);
 const q=(await db.query(`SELECT q.*,d.number,encode(sha256(convert_to(q.approved_snapshot::text,'UTF8')),'hex') AS "approvalHash",encode(sha256(convert_to(q.acceptance_snapshot::text,'UTF8')),'hex') AS "acceptanceHash" FROM service_quotes q JOIN documents d ON d.tenant_id=q.tenant_id AND d.id=q.id WHERE q.tenant_id=$1 AND q.id=$2 AND q.organization_id=ANY($3::uuid[])`,[u.tenantId,h.source_quote_id,u.orgIds])).rows[0];
 if(!q||q.status!=='ACCEPTED'||q.converted_order_id!==h.id)throw new ConflictException('AU benötigt seine tatsächliche angenommene AG und einmalige Quellenübernahme.');
 return {...q,commercial:q.approved_snapshot.commercial};
}

export function quoteOrderPrice(price:any,source:{id:string,number:string,approvalHash:string,acceptanceHash:string},order:{id:string,number:string},itemId:string){
 return {...price,context:{...price.context,sourceId:order.id,sourceNumber:order.number},sourceQuote:{id:source.id,number:source.number,itemId,approvalHash:source.approvalHash,acceptanceHash:source.acceptanceHash}};
}

export async function acceptedPartner(db:PoolClient,current:any,source:any,missing:string[]){
 if(!source){missing.push('Angenommene AG-Partnerrolle fehlt.');return current;}
 const value=(p:any)=>{const {version,customerGroup,...rest}=p;const {version:addressVersion,...address}=rest.address;const contact=rest.contact?(({version,...c}:any)=>c)(rest.contact):null;return {...rest,address,contact};};
 const equal=(await db.query('SELECT $1::jsonb=$2::jsonb AS equal',[JSON.stringify(value(current)),JSON.stringify(value(source))])).rows[0].equal;
 if(!equal)missing.push('Vereinbarte Identität, Anschrift oder Ansprechpartner für '+current.role+' wurde geändert; gesonderten Änderungsprozess verwenden.');
 return {...source,version:current.version,address:{...source.address,version:current.address.version},contact:source.contact?{...source.contact,version:current.contact?.version}:null};
}
