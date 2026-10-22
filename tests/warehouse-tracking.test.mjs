import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {harness} from '../scripts/test-harness.mjs';
import {warehouseFixture} from './helpers/warehouse-fixture.mjs';
import {cmd,ok} from './helpers/service-fixture.mjs';
let h,f,first,original;
before(async()=>{h=await harness(3142);f=await warehouseFixture(h,{tracked:true});});after(async()=>{if(h)await h.close();});
test('Serienidentität bleibt bei der Einlagerung genau einmal und im tatsächlichen Fach aktiv',async()=>{
 assert.equal((await f.transfer([f.line(f.buffer.id,f.bins[0].id,'2','WH-BATCH-A','WH-SERIAL-1')])).status,409);
 assert.equal((await f.transfer([f.line(f.buffer.id,f.bins[0].id,'1','WH-BATCH-A','FALSCHE-SERIE')])).status,409);
 first=ok(await f.transfer([f.line(f.buffer.id,f.bins[0].id,'1','WH-BATCH-A','WH-SERIAL-1')]));original=ok(await f.warehouse('/api/warehouse/transfers/'+first.id),200);const rows=(await h.admin.query("SELECT bin_id,quantity::text FROM warehouse_bin_balances WHERE serial='WH-SERIAL-1' AND quantity>0")).rows;assert.deepEqual(rows,[{bin_id:f.bins[0].id,quantity:'1.000000'}]);
 const issue=ok(await f.delivery(c=>{const i=c.items.find(i=>i.serial==='WH-SERIAL-1');return [{reservationId:i.reservationId,binId:f.bins[0].id,quantity:'1'}];}));assert.equal((await h.admin.query("SELECT count(*) FROM warehouse_bin_balances WHERE serial='WH-SERIAL-1' AND quantity>0")).rows[0].count,'0');ok(await f.warehouse('/api/inventory/issues/'+issue.id+'/reverse',cmd({periodId:f.period.id,postingDate:'2026-10-22',documentDate:'2026-10-22',reason:'Serienartikel physisch in das ursprüngliche Entnahmefach zurücklegen.'})));assert.equal((await h.admin.query("SELECT bin_id FROM warehouse_bin_balances WHERE serial='WH-SERIAL-1' AND quantity>0")).rows[0].bin_id,f.bins[0].id);
});
test('Chargenvermischung ist gesperrt und benötigt eine ausdrückliche versionierte Platzregel',async()=>{
 const b=await f.body(f.pos[0],'1');b.items[0].batch='WH-BATCH-B';b.items[0].serial='WH-SERIAL-3';ok(await f.warehouse('/api/procurement/documents/'+f.pos[0].id+'/receipts',cmd(b)));
 assert.equal((await f.transfer([f.line(f.buffer.id,f.bins[0].id,'1','WH-BATCH-B','WH-SERIAL-3')])).status,409);
 ok(await f.warehouse('/api/warehouse/structure/bins/'+f.bins[0].id,{method:'PATCH',headers:{'Idempotency-Key':randomUUID()},body:{version:1,name:'Fach mit ausdrücklicher Chargenfreigabe',blocked:false,capacity:'4',capacityUnit:'EA',allowMixedProducts:false,allowMixedBatches:true,reason:'Unterschiedliche Chargen dieses Artikels im gekennzeichneten Fach zulassen.'}}),200);
 ok(await f.transfer([f.line(f.buffer.id,f.bins[0].id,'1','WH-BATCH-B','WH-SERIAL-3')]));const c=ok(await f.context(),200);assert.equal(c.balances.filter(b=>b.binId===f.bins[0].id).length,2);
});
test('Platzwechsel über Lagerorte ist gesperrt; neue Lagerorte beginnen mit leerem Systempuffer',async()=>{
 const l=ok(await f.warehouse('/api/inventory/companies/'+f.company.id+'/locations',cmd({plantId:f.plant.id,code:'0002',name:'Separates Werkstattlager',kind:'WORKSHOP'}))),c=ok(await f.context(),200),buffer=c.bins.find(b=>b.locationId===l.id&&b.systemBuffer);assert.ok(buffer);assert.equal(c.balances.filter(b=>b.binId===buffer.id).length,0);assert.equal((await f.transfer([f.line(f.bins[0].id,buffer.id,'1','WH-BATCH-A','WH-SERIAL-1')],'BIN_TRANSFER')).status,409);
});
test('Gebuchte Platzbelege behalten Produkt- und Firmenstand und akzeptieren keine nachträglichen Positionen',async()=>{
 const source=(await h.admin.query('SELECT * FROM warehouse_transfer_items WHERE transfer_id=$1',[first.id])).rows[0];await assert.rejects(h.admin.query('INSERT INTO warehouse_transfer_items(id,tenant_id,transfer_id,position,from_bin_id,to_bin_id,product_id,quantity,batch,serial,snapshot) VALUES($1,$2,$3,20,$4,$5,$6,$7,$8,$9,$10)',[randomUUID(),source.tenant_id,first.id,source.from_bin_id,source.to_bin_id,source.product_id,source.quantity,source.batch,source.serial,source.snapshot]),/unveränderlich/);
 await h.admin.query("UPDATE products SET name='Geänderte aktuelle Artikelbezeichnung' WHERE id=$1",[f.product.id]);await h.admin.query("UPDATE company_codes SET name='Geänderter aktueller Firmenname' WHERE id=$1",[f.company.id]);assert.deepEqual(ok(await f.warehouse('/api/warehouse/transfers/'+first.id),200).items,original.items);
 const a=ok(await f.warehouse('/api/documents/'+first.id+'/attachments/generate',cmd({version:1,documentType:'RECORD',visibility:'INTERNAL'}))),pdf=ok(await f.warehouse('/api/documents/'+first.id+'/attachments/'+a.id+'/download',{binary:true}),200);assert.ok(pdf.subarray(0,5).equals(Buffer.from('%PDF-')));const snap=(await h.admin.query('SELECT source_snapshot FROM document_attachments WHERE id=$1',[a.id])).rows[0].source_snapshot;assert.equal(snap.issuer.name,'NetFusion Testgesellschaft');assert.equal(snap.rows[0][1].includes('Netzwerk-Ersatzteil'),true);assert.equal(snap.rows[0][1].includes('Geänderte'),false);
});
