import { writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { configuration,startDatabase,databaseUrls,local } from './local.mjs';
import { migrate } from './migrate.mjs';
import { seed } from './seed.mjs';
import pg from 'pg';
if(process.env.NODE_ENV==='production') throw new Error('Entwicklungssetup ist in Produktion gesperrt.');
const config=await configuration();
let database=null;
const probe=new pg.Client({connectionString:databaseUrls(config).admin,connectionTimeoutMillis:1500});
try{await probe.connect();}catch(e){if(e.code!=='ECONNREFUSED')throw e;database=await startDatabase(config);}finally{await probe.end();}
try {
  for(const name of ['erp','erp_test']) {
    const urls=databaseUrls(config,name);
    await migrate(urls.admin);
    const file=path.join(local,name==='erp'?'accounts.json':'test-accounts.json');
    const accounts=await seed(urls.admin);
    if(accounts) await writeFile(file,JSON.stringify(accounts,null,2),{mode:0o600,flag:'wx'});
    await access(file);
  }
  console.log('PostgreSQL und Migrationen bereit. Zufällige Entwicklungszugänge: .local/accounts.json (nicht einchecken).');
} finally { if(database)await database.stop(); }
