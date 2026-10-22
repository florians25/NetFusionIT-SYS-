import { spawn } from 'node:child_process';
import { configuration,startDatabase,databaseUrls,root } from './local.mjs';
import { migrate } from './migrate.mjs';
const config=await configuration();
const db=await startDatabase(config);
let server,stopping=false;
async function stop(code=0) {
  if(stopping)return; stopping=true;
  if(server && server.exitCode===null){server.kill('SIGTERM'); await new Promise(r=>server.once('exit',r));}
  await db.stop(); process.exitCode=code;
}
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
try {
  await migrate(databaseUrls(config).admin);
  server=spawn(process.execPath,['dist/main.js'],{cwd:root,stdio:'inherit',env:{...process.env,NODE_ENV:'development',DATABASE_URL:databaseUrls(config).app,ERP_SESSION_SECRET:config.sessionSecret,ERP_HOST:'127.0.0.1'}});
  server.on('exit',code=>stop(code??1));
} catch(e){await stop(1); throw e;}
