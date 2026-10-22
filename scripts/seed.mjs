import pg from 'pg';
import { randomBytes, randomUUID } from 'node:crypto';
import { hashPassword } from './password.mjs';
export async function seed(connectionString) {
  const db=new pg.Client({connectionString}); await db.connect();
  try {
    if((await db.query("SELECT 1 FROM tenants WHERE slug='netfusion'")).rowCount) return null;
    const tenant=randomUUID(), org=randomUUID(), partner=randomUUID();
    const accounts=[];
    await db.query('BEGIN');
    await db.query("INSERT INTO tenants VALUES($1,'netfusion','NetFusion IT · Entwicklung')",[tenant]);
    await db.query("INSERT INTO organizations(id,tenant_id,name,kind) VALUES($1,$2,'Service Deutschland','SERVICE_ORGANIZATION')",[org,tenant]);
    await db.query("INSERT INTO business_partners(id,tenant_id,organization_id,number,name,email) VALUES($1,$2,$3,'10000001','Entwicklungskunde','kunde@example.test')",[partner,tenant,org]);
    for(const [role,email,name] of [
      ['ADMIN','admin@netfusion.test','Florian · Administration'],
      ['DISPATCHER','dispatch@netfusion.test','Mara · Disposition'],
      ['TECHNICIAN','technik@netfusion.test','Jonas Weber'],
      ['SUPPORT','support@netfusion.test','Lea · Support'],
      ['CUSTOMER','kunde@example.test','Alex · Kundenportal']]) {
      const id=randomUUID(),password=randomBytes(18).toString('base64url');
      await db.query('INSERT INTO users(id,tenant_id,email,name,password_hash,role,partner_id) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,tenant,email,name,await hashPassword(password),role,role==='CUSTOMER'?partner:null]);
      await db.query('INSERT INTO user_organizations VALUES($1,$2,$3)',[tenant,id,org]);
      if(role==='TECHNICIAN') await db.query("INSERT INTO technicians(id,tenant_id,user_id,organization_id,name,skills) VALUES($1,$2,$3,$4,$5,ARRAY['IT-Support','Netzwerk'])",[randomUUID(),tenant,id,org,name]);
      accounts.push({tenant:'netfusion',email,password,role,id});
    }
    await db.query('COMMIT');
    return accounts;
  } catch(e){await db.query('ROLLBACK'); throw e;} finally{await db.end();}
}
