import { readdir,readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { Pool } from 'pg';
const directory=path.resolve(__dirname,'..','backend','migrations');
const expected=readdir(directory).then(async names=>{
 const migrations=await Promise.all(names.filter(n=>n.endsWith('.sql')).sort().map(async name=>{const sql=await readFile(path.join(directory,name),'utf8');return {name,checksum:createHash('sha256').update(sql).digest('hex'),tables:Array.from(sql.matchAll(/CREATE TABLE\s+([a-z_]+)/gi),m=>m[1])};}));
 return {migrations,tables:Array.from(new Set(migrations.flatMap(m=>m.tables)))};
});
export async function schemaReady(pool:Pool){
 const manifest=await expected,rows=(await pool.query('SELECT name,checksum FROM schema_migrations')).rows;
 if(rows.length!==manifest.migrations.length||!manifest.migrations.every(m=>rows.some(r=>r.name===m.name&&r.checksum===m.checksum)))return false;
 return (await pool.query("SELECT bool_and(to_regclass('public.'||name) IS NOT NULL) AS ready FROM unnest($1::text[]) AS t(name)",[manifest.tables])).rows[0].ready===true;
}
