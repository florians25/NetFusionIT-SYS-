import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import pg from 'pg';
import {configuration,databaseUrls} from '../scripts/local.mjs';
import {migrate} from '../scripts/migrate.mjs';
import {seed} from '../scripts/seed.mjs';
const hash=v=>createHash('sha256').update(v).digest('hex');
test('Upgrade29 mit bereits archiviertem Angebots-PDF erhält Originalbytes und protokolliert die unveränderte030 plus eindeutige Vorwärtskorrektur',async()=>{
 const config=await configuration(),control=new pg.Client({connectionString:databaseUrls(config,'postgres').admin}),name='erp_spec_credit_upgrade_'+randomBytes(5).toString('hex');let db,created=false;
 try{
  await control.connect();await control.query('CREATE DATABASE '+name);created=true;const urls=databaseUrls(config,name);db=new pg.Client({connectionString:urls.admin});await db.connect();await db.query('CREATE TABLE schema_migrations(name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())');const dir=new URL('../backend/migrations/',import.meta.url);
  for(const file of (await readdir(dir)).filter(f=>f.endsWith('.sql')&&f<'030').sort()){const sql=await readFile(new URL(file,dir),'utf8');await db.query('BEGIN');try{await db.query(sql);await db.query('INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)',[file,hash(sql)]);await db.query('COMMIT');}catch(e){await db.query('ROLLBACK');throw e;}}
  const accounts=await seed(urls.admin),admin=accounts.find(a=>a.role==='ADMIN'),owner=(await db.query('SELECT u.tenant_id,o.organization_id FROM users u JOIN user_organizations o ON o.tenant_id=u.tenant_id AND o.user_id=u.id WHERE u.id=$1',[admin.id])).rows[0],id=randomUUID(),attachment=randomUUID();
  await db.query("INSERT INTO documents(id,tenant_id,organization_id,number,kind,created_by) VALUES($1,$2,$3,'AG-41000000','QUOTATION',$4)",[id,owner.tenant_id,owner.organization_id,admin.id]);
  const data={title:'Angebot',number:'AG-41000000',sourceNumber:'AG-41000000',status:'Bereitgestellt',date:'2026-10-22',contact:{firstName:'Martina',lastName:'Musterfrau',email:'martina.musterfrau@example.test',phone:''},issuer:{name:'Historische Testgesellschaft'},recipient:{name:'Historischer Testkunde'},fields:[],columns:[{title:'Position',width:80},{title:'Beschreibung',width:420}],rows:[['10','Unveränderliches historisches Angebotsoriginal']]},pdf=await createRequire(import.meta.url)('../dist/business-pdf.js').renderBusinessPdf(data,'DO-87000000');
  await db.query("INSERT INTO document_attachments(id,tenant_id,source_id,number,document_type,filename,visibility,origin,source_version,template_version,source_hash,source_snapshot,content,sha256,created_by) VALUES($1,$2,$3,'DO-87000000','QUOTATION','AG-41000000.pdf','CUSTOMER','GENERATED',1,6,$4,$5,$6,$7,$8)",[attachment,owner.tenant_id,id,hash(JSON.stringify(data)),JSON.stringify(data),pdf,hash(pdf),admin.id]);
  const prior=(await db.query('SELECT * FROM document_attachments WHERE id=$1',[attachment])).rows[0];await migrate(urls.admin);assert.deepEqual((await db.query('SELECT * FROM document_attachments WHERE id=$1',[attachment])).rows[0],prior);
  const applied=(await db.query("SELECT checksum,execution_patch FROM schema_migrations WHERE name='030_customer_credit_memos.sql'")).rows[0];assert.equal(applied.checksum,hash(await readFile(new URL('030_customer_credit_memos.sql',dir))));assert.equal(applied.execution_patch.migration,'033_preserve_quotation_output_compatibility.sql');assert.equal(applied.execution_patch.checksum,hash(await readFile(new URL(applied.execution_patch.migration,dir))));assert.notEqual(applied.execution_patch.originalStatementChecksum,applied.execution_patch.replacementStatementChecksum);
  const constraint=(await db.query("SELECT pg_get_constraintdef(oid) AS rule FROM pg_constraint WHERE conname='document_attachments_document_type_check'")).rows[0].rule;assert.ok(constraint.includes('QUOTATION'));assert.ok(constraint.includes('CREDIT_NOTE'));await migrate(urls.admin);assert.deepEqual((await db.query('SELECT * FROM document_attachments WHERE id=$1',[attachment])).rows[0],prior);
  await mkdir('test-results/customer-credits',{recursive:true});await writeFile('test-results/customer-credits/upgrade-verification.json',JSON.stringify({fromMigration:29,toMigration:36,quotationArchivePreserved:true,originalPdfHash:prior.sha256,originalSourceChecksum:applied.checksum,executionPatch:applied.execution_patch,idempotentUpgrade:true},null,2)+'\n');
  await db.query("UPDATE schema_migrations SET execution_patch=jsonb_set(execution_patch,'{checksum}',to_jsonb($1::text)) WHERE name='030_customer_credit_memos.sql'",['0'.repeat(64)]);await assert.rejects(migrate(urls.admin),/Ausführungskorrektur/);
 }finally{await db?.end();if(created)await control.query('DROP DATABASE '+name+' WITH (FORCE)');await control.end().catch(()=>{});}
});
