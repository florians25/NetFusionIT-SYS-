// Real isolated HTTPS installation on the requested host port; no live volumes.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {request} from 'node:https';
import {randomBytes} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const exec=promisify(execFile),project='netfusion-install-smoke-'+randomBytes(5).toString('hex');
const env={...process.env,ERP_DOMAIN:'localhost',ERP_BOOTSTRAP_TENANT:'install-smoke',ERP_BOOTSTRAP_COMPANY:'Isolierte Installationsprüfung',ERP_BOOTSTRAP_NAME:'Installationsprüfung',ERP_BOOTSTRAP_EMAIL:'install@example.test'};
const args=['compose','-f','compose.quickstart.yaml','-p',project];
async function compose(extra){try{return await exec('docker',[...args,...extra],{env,timeout:240000,maxBuffer:1024*1024});}catch(error){if(['config','up','down'].includes(extra[0]))console.error(String(error.stderr||'').slice(-4000));throw error;}}
let access,ca,cookie='',csrf='';
function call(path,body){return new Promise((resolve,reject)=>{
 const req=request({hostname:'localhost',port:8070,path,ca,method:body?'POST':'GET',headers:{Origin:'https://localhost:8070',Cookie:cookie,'Content-Type':'application/json','X-CSRF-Token':csrf}},res=>{const bytes=[];res.on('data',b=>bytes.push(b));res.on('end',()=>{const text=Buffer.concat(bytes).toString();let data;try{data=JSON.parse(text);}catch{data=text;}if(res.headers['set-cookie'])cookie=res.headers['set-cookie'][0].split(';')[0];if(data?.csrfToken)csrf=data.csrfToken;resolve({status:res.statusCode,data,headers:res.headers});});});req.on('error',reject);req.setTimeout(10000,()=>req.destroy(new Error('HTTPS timeout')));req.end(body?JSON.stringify(body):undefined);
});}
async function waitReady(){for(let i=0;i<60;i++){try{if((await call('/health/ready')).status===200)return;}catch{}await new Promise(r=>setTimeout(r,500));}throw new Error('HTTPS-Readiness nicht erreicht.');}
async function login(password){cookie='';csrf='';const anon=await call('/api/auth/session');assert.equal(anon.status,200);assert.match(anon.headers['set-cookie'].join(';'),/Secure/);assert.equal((await call('/api/auth/login',{tenant:access.tenant,email:access.email,password})).status,200);assert.equal((await call('/api/auth/session')).data.user.role,'ADMIN');}
try{
 await compose(['config','--quiet']);console.log('Konfiguration gültig; Erststart auf Port 8070.');await compose(['up','-d','--no-build']);console.log('Container bereit; tatsächliche TLS-Anmeldung prüfen.');
 access=JSON.parse((await compose(['run','--rm','--no-deps','install','cat','/run/netfusion-install/access.json'])).stdout);
 ca=(await compose(['exec','-T','caddy','cat','/data/caddy/pki/authorities/local/root.crt'])).stdout;
 await waitReady();
 await login(access.password);assert.equal((await call('/api/quotes')).data.length,0);assert.equal((await call('/')).status,200);
 const session=await call('/api/auth/session'),userId=session.data.user.id;
 // Change the actual initial administrator password, then recreate the entire stack.
 const nextPassword=randomBytes(24).toString('base64url');
 const updateCode="const pg=require('pg');(async()=>{const c=JSON.parse(require('fs').readFileSync('/run/netfusion-install/configuration.json'));const db=new pg.Client({connectionString:'postgresql://postgres:'+c.postgresPassword+'@db:5432/erp'});await db.connect();const {hashPassword}=await import('./scripts/password.mjs');await db.query('UPDATE users SET password_hash=$1 WHERE id=$2',[await hashPassword("+JSON.stringify(nextPassword)+"),"+JSON.stringify(userId)+"]);await db.end();})().catch(()=>process.exit(1));";
 await compose(['run','--rm','--no-deps','install','node','-e',updateCode]);
 console.log('Administratorpasswort geändert; Stack mit bestehenden Volumes neu anlegen.');await compose(['down']);await compose(['up','-d','--no-build']);await waitReady();await login(nextPassword);
 assert.equal((await call('/api/auth/session')).data.user.id,userId);
 const boundary=(await compose(['exec','-T','api','node','-e',"const fs=require('fs');const a=JSON.parse(fs.readFileSync('/run/netfusion-app/environment.json'));if(process.getuid()!==1000||a.NODE_ENV!=='production'||fs.existsSync('/run/netfusion-install/configuration.json')||fs.existsSync('/run/netfusion-db/password'))process.exit(1);console.log('API secret boundary passed');"])).stdout;assert.match(boundary,/passed/);
 // A changed hostname must fail without rotating the persisted credentials.
 let rejected=false;try{await compose(['run','--rm','--no-deps','-e','ERP_DOMAIN=other.example.test','initialize']);}catch{rejected=true;}assert.ok(rejected);await login(nextPassword);
 const image=(await compose(['images','-q','api'])).stdout.trim();
 const proof={time:new Date().toISOString(),port:8070,origin:'https://localhost:8070',imageId:image,realCaddyTLS:true,certificateVerification:true,secureSessionCookie:true,automaticMigrationsAndBootstrap:true,authenticatedRole:'ADMIN',originalAdminPreservedAfterRecreation:true,changedPasswordPreserved:true,separateAPISecrets:true,changedHostnameRejected:true,emptyQuoteWorklist:true};
 await mkdir('test-results',{recursive:true});await writeFile('test-results/docker-install-8070.json',JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
}catch(error){
 // No child output is printed: one command intentionally retrieves the first-login credentials.
 console.error('Docker-Installationsprüfung fehlgeschlagen: '+(error.code||error.name));console.error(String(error.stack||'').split('\n').filter(line=>/^\s+at /.test(line)).join('\n'));throw new Error('Isolierte 8070-Installation fehlgeschlagen; keine Zugangsdaten ausgegeben.');
}finally{await compose(['down','--volumes','--remove-orphans']);console.log('Nur isolierte Installations-Testcontainer und Testvolumes entfernt.');}
