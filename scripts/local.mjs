import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const local=path.join(root,'.local');
export async function configuration() {
  await mkdir(local,{recursive:true,mode:0o700});
  const file=path.join(local,'runtime.json');
  try { return JSON.parse(await readFile(file,'utf8')); } catch(e) { if(e.code!=='ENOENT') throw e; }
  const config={adminPassword:randomBytes(32).toString('base64url'),appPassword:randomBytes(32).toString('base64url'),sessionSecret:randomBytes(48).toString('base64url')};
  await writeFile(file,JSON.stringify(config,null,2),{mode:0o600,flag:'wx'});
  return config;
}
export function databaseUrls(config,database='erp') {
  return {admin:`postgresql://postgres:${config.adminPassword}@127.0.0.1:55432/${database}`,app:`postgresql://erp_app:${config.appPassword}@127.0.0.1:55432/${database}`};
}
export async function startDatabase(config) {
  const databaseDir=path.join(local,'postgres');
  const instance=new EmbeddedPostgres({databaseDir,user:'postgres',password:config.adminPassword,port:55432,persistent:true,
    initdbFlags:['--auth-host=scram-sha-256','--auth-local=scram-sha-256','--encoding=UTF8','--locale=C'],
    postgresFlags:['-h','127.0.0.1'],onLog:()=>{},onError:message=>process.stderr.write(String(message)+'\n')});
  try { await access(path.join(databaseDir,'PG_VERSION')); } catch { await instance.initialise(); }
  await instance.start();
  const admin=new pg.Client({connectionString:databaseUrls(config,'postgres').admin});
  await admin.connect();
  try {
    if (!(await admin.query("SELECT 1 FROM pg_roles WHERE rolname='erp_app'")).rowCount) {
      await admin.query(`CREATE ROLE erp_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD ${pg.escapeLiteral(config.appPassword)}`);
    }
    for(const db of ['erp','erp_test']) {
      if(!(await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[db])).rowCount) await admin.query(`CREATE DATABASE ${db}`);
    }
  } catch(e) { await instance.stop(); throw e; } finally { await admin.end(); }
  return instance;
}
