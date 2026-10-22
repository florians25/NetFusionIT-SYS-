import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { hashPassword } from './password.mjs';
const {ERP_MIGRATION_URL:connectionString,ERP_BOOTSTRAP_TENANT:slug,ERP_BOOTSTRAP_COMPANY:company,ERP_BOOTSTRAP_EMAIL:email,ERP_BOOTSTRAP_NAME:name,ERP_BOOTSTRAP_PASSWORD:password}=process.env;
if(!connectionString||!slug||!/^[a-z0-9-]{2,48}$/.test(slug)||!company||!name||!email||!/^\S+@\S+\.\S+$/.test(email)||!password||password.length<14||password.length>128)throw new Error('Bootstrap benötigt Migrationsverbindung, Tenant-Slug, Firmenname, Adminname, E-Mail und Passwort (14–128 Zeichen). Werte sicher über Umgebung setzen.');
const db=new pg.Client({connectionString});await db.connect();
try{
  await db.query('BEGIN');
  await db.query('SELECT pg_advisory_xact_lock(884812)');
  if((await db.query('SELECT 1 FROM tenants WHERE slug=$1',[slug])).rowCount)throw new Error('Tenant existiert bereits. Bootstrap überschreibt keine bestehenden Daten.');
  const tenant=randomUUID(),org=randomUUID(),user=randomUUID();
  await db.query('INSERT INTO tenants VALUES($1,$2,$3)',[tenant,slug,company]);
  await db.query("INSERT INTO organizations(id,tenant_id,name,kind) VALUES($1,$2,'Serviceorganisation','SERVICE_ORGANIZATION')",[org,tenant]);
  await db.query("INSERT INTO users(id,tenant_id,email,name,password_hash,role) VALUES($1,$2,$3,$4,$5,'ADMIN')",[user,tenant,email.toLowerCase(),name,await hashPassword(password)]);
  await db.query('INSERT INTO user_organizations VALUES($1,$2,$3)',[tenant,user,org]);
  await db.query("INSERT INTO audit_events(id,tenant_id,actor_id,action,correlation_id) VALUES($1,$2,$3,'TENANT_BOOTSTRAPPED',$4)",[randomUUID(),tenant,user,randomUUID()]);
  await db.query('COMMIT');console.log('Tenant und initialer Administrator angelegt. Keine Passwörter ausgegeben.');
}catch(e){await db.query('ROLLBACK');throw e;}finally{await db.end();}
