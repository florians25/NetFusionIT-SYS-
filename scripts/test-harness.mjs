import pg from 'pg';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { configuration,databaseUrls,startDatabase,root } from './local.mjs';
import { migrate } from './migrate.mjs';
import { seed } from './seed.mjs';
export async function harness(port=3101){
  const offset=Number(process.env.ERP_TEST_PORT_OFFSET||0);if(!Number.isInteger(offset)||offset<0||port+offset>65535)throw new Error('Ungültiger isolierter Testport-Versatz.');port+=offset;
  const config=await configuration();let ownedDatabase=null,server=null,admin=null,closed=false,logs='';
  const cluster=new pg.Client({connectionString:databaseUrls(config,'postgres').admin,connectionTimeoutMillis:1000});
  try{await cluster.connect();}catch{ownedDatabase=await startDatabase(config);}finally{await cluster.end().catch(()=>{});}
  const control=new pg.Client({connectionString:databaseUrls(config,'postgres').admin}),name='erp_spec_'+randomBytes(5).toString('hex'),urls=databaseUrls(config,name);
  async function stop(){if(server&&server.exitCode===null){server.kill('SIGTERM');await new Promise(r=>server.once('exit',r));}}
  async function close(){if(closed)return;closed=true;try{await stop();await admin?.end();await control.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);}finally{await control.end().catch(()=>{});if(ownedDatabase)await ownedDatabase.stop();}}
  async function start(){
    server=spawn(process.execPath,['dist/main.js'],{cwd:root,env:{...process.env,NODE_ENV:'test',DATABASE_URL:urls.app,ERP_SESSION_SECRET:config.sessionSecret,PORT:String(port),ERP_HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});
    logs='';server.stdout.on('data',b=>{logs+=b;});server.stderr.on('data',b=>{logs+=b;});
    for(let i=0;i<100;i++){
      if(server.exitCode!==null)throw new Error('Testserver-Start fehlgeschlagen: '+logs);
      try{const r=await fetch(`http://127.0.0.1:${port}/health/ready`);if(r.ok)return;}catch{}
      await delay(100);
    }
    throw new Error('Testserver nicht bereit: '+logs);
  }
  try{
    await control.connect();await control.query(`CREATE DATABASE ${name}`);await migrate(urls.admin);const accounts=await seed(urls.admin);admin=new pg.Client({connectionString:urls.admin});await admin.connect();await start();
    return {base:`http://127.0.0.1:${port}`,accounts,admin,urls,logs:()=>logs,restart:async()=>{await stop();await start();},close};
  }catch(e){await close().catch(()=>{});throw e;}
}
export async function client(base,account){
  let cookie='',csrf='';
  async function request(path,options={}){
    const headers={...(cookie?{Cookie:cookie}:{}),...(options.method&&options.method!=='GET'?{'Content-Type':'application/json','X-CSRF-Token':csrf}:{}),...options.headers};
    const response=await fetch(base+path,{method:options.method||'GET',headers,body:options.body===undefined?undefined:Buffer.isBuffer(options.body)?options.body:JSON.stringify(options.body)});
    const set=response.headers.get('set-cookie');if(set)cookie=set.split(';')[0];
    let data;if(options.binary)data=Buffer.from(await response.arrayBuffer());else{const content=await response.text();try{data=JSON.parse(content);}catch{data=content;}}
    if(data.csrfToken)csrf=data.csrfToken;
    return {status:response.status,data,headers:response.headers};
  }
  await request('/api/auth/session');
  if(account){const result=await request('/api/auth/login',{method:'POST',body:{tenant:account.tenant,email:account.email,password:account.password}});if(result.status!==200)throw new Error('Testanmeldung fehlgeschlagen: '+JSON.stringify(result.data));}
  return request;
}
