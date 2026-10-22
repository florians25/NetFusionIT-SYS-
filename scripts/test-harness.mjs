import pg from 'pg';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { configuration,databaseUrls,startDatabase,root } from './local.mjs';
import { migrate } from './migrate.mjs';
import { seed } from './seed.mjs';
export async function harness(port=3101){
  const config=await configuration();
  let ownedDatabase=null,server=null;
  const cluster=new pg.Client({connectionString:databaseUrls(config,'postgres').admin,connectionTimeoutMillis:1000});
  try{await cluster.connect();}catch{await cluster.end();ownedDatabase=await startDatabase(config);}
  const control=new pg.Client({connectionString:databaseUrls(config,'postgres').admin});await control.connect();
  const name='erp_spec_'+randomBytes(5).toString('hex');
  await control.query(`CREATE DATABASE ${name}`);
  const urls=databaseUrls(config,name);
  await migrate(urls.admin);
  const accounts=await seed(urls.admin);
  const admin=new pg.Client({connectionString:urls.admin});await admin.connect();
  async function start(){
    server=spawn(process.execPath,['dist/main.js'],{cwd:root,env:{...process.env,NODE_ENV:'test',DATABASE_URL:urls.app,ERP_SESSION_SECRET:config.sessionSecret,PORT:String(port),ERP_HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});
    let logs='';server.stdout.on('data',b=>{logs+=b;});server.stderr.on('data',b=>{logs+=b;});
    for(let i=0;i<100;i++){
      if(server.exitCode!==null)throw new Error('Testserver-Start fehlgeschlagen: '+logs);
      try{const r=await fetch(`http://127.0.0.1:${port}/health/ready`);if(r.ok)return;}catch{}
      await delay(100);
    }
    throw new Error('Testserver nicht bereit: '+logs);
  }
  async function stop(){if(server&&server.exitCode===null){server.kill('SIGTERM');await new Promise(r=>server.once('exit',r));}}
  await start();
  await cluster.end().catch(()=>{});
  return {base:`http://127.0.0.1:${port}`,accounts,admin,urls,restart:async()=>{await stop();await start();},close:async()=>{await stop();await admin.end();await control.query(`DROP DATABASE ${name} WITH (FORCE)`);await control.end();if(ownedDatabase)await ownedDatabase.stop();}};
}
export async function client(base,account){
  let cookie='',csrf='';
  async function request(path,options={}){
    const headers={...(cookie?{Cookie:cookie}:{}),...(options.method&&options.method!=='GET'?{'Content-Type':'application/json','X-CSRF-Token':csrf}:{}),...options.headers};
    const response=await fetch(base+path,{method:options.method||'GET',headers,body:options.body===undefined?undefined:JSON.stringify(options.body)});
    const set=response.headers.get('set-cookie');if(set)cookie=set.split(';')[0];
    const content=await response.text();let data;try{data=JSON.parse(content);}catch{data=content;}
    if(data.csrfToken)csrf=data.csrfToken;
    return {status:response.status,data,headers:response.headers};
  }
  await request('/api/auth/session');
  if(account){const result=await request('/api/auth/login',{method:'POST',body:{tenant:account.tenant,email:account.email,password:account.password}});if(result.status!==200)throw new Error('Testanmeldung fehlgeschlagen: '+JSON.stringify(result.data));}
  return request;
}
