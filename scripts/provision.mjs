import pg from 'pg';
import { pathToFileURL } from 'node:url';
export async function provision(){
  if(!process.env.ERP_MIGRATION_URL||!process.env.DATABASE_URL)throw new Error('Migrations- und Laufzeitverbindung fehlen.');
  const url=new URL(process.env.DATABASE_URL),role=decodeURIComponent(url.username),password=decodeURIComponent(url.password);
  if(!/^[a-z_][a-z0-9_]*$/.test(role)||role==='postgres'||password.length<24)throw new Error('Eigene Laufzeitrolle und mindestens 24 Zeichen DB-Passwort erforderlich.');
  if(process.env.ERP_DB_ROLE&&process.env.ERP_DB_ROLE!==role)throw new Error('ERP_DB_ROLE stimmt nicht mit DATABASE_URL überein.');
  process.env.ERP_DB_ROLE=role;
  const db=new pg.Client({connectionString:process.env.ERP_MIGRATION_URL});await db.connect();
  try{
    const prior=await db.query('SELECT rolsuper,rolbypassrls,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=$1',[role]);
    if(prior.rowCount){if(Object.values(prior.rows[0]).some(Boolean))throw new Error('Unsichere bestehende Laufzeitrolle.');}
    else await db.query(`CREATE ROLE "${role}" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD ${pg.escapeLiteral(password)}`);
  }finally{await db.end();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){await provision();console.log('Laufzeitrolle geprüft/angelegt.');}
