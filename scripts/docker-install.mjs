// One-command, persistent Docker installation. Never print generated credentials.
import {randomBytes} from 'node:crypto';
import {readFile,writeFile,mkdir,chmod,chown} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {once} from 'node:events';

const state='/run/netfusion-install',app='/run/netfusion-app',database='/run/netfusion-db';
const mode=process.argv[2];
const read=async file=>JSON.parse(await readFile(file,'utf8'));
async function optional(file){try{return await read(file);}catch(e){if(e.code==='ENOENT')return null;throw e;}}
async function owned(file,contents,permissions=0o400){
  await writeFile(file,contents,{mode:permissions});await chmod(file,permissions);await chown(file,1000,1000);
}
async function child(script,env){
  const processChild=spawn(process.execPath,[script],{env:{...process.env,...env},stdio:'inherit'});
  for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>processChild.kill(signal));
  const [code,signal]=await once(processChild,'exit');
  if(signal||code!==0)throw new Error('Installationsschritt fehlgeschlagen: '+script);
}
function configuration(){
  const host=(process.env.ERP_DOMAIN||'localhost').toLowerCase();
  if(host.length>253||!host.split('.').every(label=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)))throw new Error('ERP_DOMAIN muss ein Hostname oder eine IPv4-Adresse ohne Protokoll und Port sein.');
  const tenant=process.env.ERP_BOOTSTRAP_TENANT||'netfusion',company=process.env.ERP_BOOTSTRAP_COMPANY||'NetFusion IT',name=process.env.ERP_BOOTSTRAP_NAME||'Administrator',email=(process.env.ERP_BOOTSTRAP_EMAIL||'admin@example.org').toLowerCase();
  if(!/^[a-z0-9-]{2,48}$/.test(tenant)||!company.trim()||!name.trim()||!/^\S+@\S+\.\S+$/.test(email))throw new Error('Mandant, Firma, Administratorname oder E-Mail ungültig.');
  return {host,tenant,company,name,email};
}
async function initialize(){
  const requested=configuration();
  await mkdir(state,{recursive:true});await chmod(state,0o700);await chown(state,1000,1000);
  await mkdir(app,{recursive:true});await chmod(app,0o700);await chown(app,1000,1000);
  await mkdir(database,{recursive:true});await chmod(database,0o755);
  let config=await optional(state+'/configuration.json');
  if(config){
    for(const key of Object.keys(requested))if(config[key]!==requested[key])throw new Error('Bestehende Installation verwendet andere Einstellungen ('+key+'). Vorhandene Daten und Zugangsdaten werden nicht überschrieben.');
  }else{
    config={schema:1,...requested,origin:'https://'+requested.host+':8070',postgresPassword:randomBytes(32).toString('hex'),applicationPassword:randomBytes(32).toString('hex'),sessionSecret:randomBytes(48).toString('hex'),password:randomBytes(24).toString('base64url')};
    await owned(state+'/configuration.json',JSON.stringify(config)+'\n');
  }
  if(config.schema!==1)throw new Error('Nicht unterstützter Installationsstand.');
  // These volumes are mounted separately: the API never receives DB-admin or bootstrap secrets.
  await owned(database+'/password',config.postgresPassword+'\n',0o444);
  await owned(app+'/environment.json',JSON.stringify({NODE_ENV:'production',ERP_HOST:'0.0.0.0',PORT:'3000',DATABASE_URL:'postgresql://erp_app:'+config.applicationPassword+'@db:5432/erp',ERP_SESSION_SECRET:config.sessionSecret,ERP_PUBLIC_ORIGIN:config.origin,ERP_TRUST_PROXY:'1'})+'\n');
  await owned(state+'/access.json',JSON.stringify({url:config.origin,tenant:config.tenant,email:config.email,password:config.password},null,2)+'\n');
  console.log('Docker-Installation vorbereitet; zufällige Geheimnisse bleiben in geschützten Docker-Volumes.');
}
async function bootstrap(config,env){
  const {default:pg}=await import('pg');
  const {verifyPassword}=await import('./password.mjs');
  const db=new pg.Client({connectionString:env.ERP_MIGRATION_URL});await db.connect();
  try{
    const marker=await optional(state+'/bootstrap.json');
    const tenant=(await db.query('SELECT id,name FROM tenants WHERE slug=$1',[config.tenant])).rows[0];
    if(marker){
      if(!tenant||tenant.id!==marker.tenantId)throw new Error('Installationsnachweis und Datenbank gehören nicht zusammen.');
      console.log('Vorhandener Mandant bleibt erhalten; Administrator und Passwort werden nicht zurückgesetzt.');return;
    }
    if(!tenant){await child('scripts/bootstrap.mjs',{...env,ERP_BOOTSTRAP_TENANT:config.tenant,ERP_BOOTSTRAP_COMPANY:config.company,ERP_BOOTSTRAP_NAME:config.name,ERP_BOOTSTRAP_EMAIL:config.email,ERP_BOOTSTRAP_PASSWORD:config.password});}
    const actual=(await db.query("SELECT t.id AS tenant_id,t.name,u.id AS user_id,u.password_hash FROM tenants t JOIN users u ON u.tenant_id=t.id AND u.email=$2 AND u.role='ADMIN' WHERE t.slug=$1",[config.tenant,config.email])).rows[0];
    if(!actual||actual.name!==config.company||!await verifyPassword(config.password,actual.password_hash))throw new Error('Vorhandener Mandant passt nicht zur Erstinstallation; keine Konten überschrieben.');
    await writeFile(state+'/bootstrap.json',JSON.stringify({tenantId:actual.tenant_id,adminId:actual.user_id})+'\n',{mode:0o600,flag:'wx'});
    console.log('Erstinstallation abgeschlossen; Zugangsdaten ausschließlich über access.json abrufen.');
  }finally{await db.end();}
}
try{
  if(mode==='initialize')await initialize();
  else if(mode==='api')await child('dist/main.js',await read(app+'/environment.json'));
  else if(mode==='migrate'||mode==='bootstrap'){
    const config=await read(state+'/configuration.json');
    const env={DATABASE_URL:'postgresql://erp_app:'+config.applicationPassword+'@db:5432/erp',ERP_MIGRATION_URL:'postgresql://postgres:'+config.postgresPassword+'@db:5432/erp'};
    if(mode==='migrate')await child('scripts/release.mjs',env);else await bootstrap(config,env);
  }else throw new Error('Unbekannter Installationsschritt.');
}catch(error){
  // Driver/process errors can carry connection details: never dump raw objects or stacks.
  console.error('Docker-Installation fehlgeschlagen. '+(error.code?'Fehlercode '+error.code: String(error.message).replace(/postgresql:\/\/\S+/g,'[DB-Verbindung]')));process.exitCode=1;
}
