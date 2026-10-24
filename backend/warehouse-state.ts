import {ConflictException,NotFoundException} from '@nestjs/common';
import {PoolClient} from 'pg';
import Decimal from 'decimal.js';
import {Principal} from './core';
import {companyWithin} from './finance';
const D=Decimal.clone({precision:60});
export const binSelect=`SELECT b.*,l.code AS location_code,l.name AS location_name,p.code AS plant_code,r.code AS rack_code,r.name AS rack_name,r.aisle,r.version AS rack_version,r.blocked AS rack_blocked,a.code AS area_code,a.name AS area_name,a.version AS area_version,a.blocked AS area_blocked,ic.count_id AS active_count_id,ic.number AS active_count_number FROM warehouse_bins b JOIN storage_locations l ON l.tenant_id=b.tenant_id AND l.id=b.location_id JOIN plants p ON p.tenant_id=l.tenant_id AND p.id=l.plant_id LEFT JOIN warehouse_racks r ON r.tenant_id=b.tenant_id AND r.id=b.rack_id LEFT JOIN warehouse_areas a ON a.tenant_id=r.tenant_id AND a.id=r.area_id LEFT JOIN LATERAL(SELECT cs.count_id,d.number FROM inventory_count_scopes cs JOIN documents d ON d.tenant_id=cs.tenant_id AND d.id=cs.count_id WHERE cs.tenant_id=b.tenant_id AND cs.bin_id=b.id AND cs.released_at IS NULL) ic ON true`;
// Decimal UUID encoding lets Code128 use its numeric code set. It preserves all
// 128 bits while making the physical bars wider than a hexadecimal payload.
export function binCode(id:string){return 'LP-'+BigInt('0x'+id.replaceAll('-','')).toString().padStart(40,'0');}
export function warehouseToday(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin'}).format(new Date());}
export async function physicalBin(db:PoolClient,u:Principal,id:string,lock=false){
 const b=(await db.query(binSelect+` WHERE b.tenant_id=$1 AND b.id=$2${lock?' FOR UPDATE OF b':''}`,[u.tenantId,id])).rows[0];if(!b)throw new NotFoundException('Lagerplatz fehlt.');await companyWithin(db,u,b.company_id);return b;
}
export function assertBinOpen(b:any,ownCountId?:string){if(b.active_count_id&&b.active_count_id!==ownCountId)throw new ConflictException('Lagerplatz ist durch Inventur '+b.active_count_number+' für Bewegungen gesperrt.');if(b.blocked||b.rack_blocked||b.area_blocked)throw new ConflictException('Lagerplatz, Regal oder Bereich ist gesperrt.');}
export async function assertBinSource(db:PoolClient,u:Principal,b:any,productId:string,quantity:string,batch:string,serial:string,ownCountId?:string){
 // The caller holds the company and bin locks. The projection itself keeps
 // SELECT-only application privileges; a row lock would require UPDATE rights.
 assertBinOpen(b,ownCountId);if((await db.query('SELECT return_bin_held($1,$2)>0 AS held',[u.tenantId,b.id])).rows[0].held)throw new ConflictException('Fach enthält gesperrten Kunden-Prüfbestand; getrenntes Zielfach wählen.');const stock=(await db.query('SELECT quantity::text FROM warehouse_bin_balances WHERE tenant_id=$1 AND bin_id=$2 AND product_id=$3 AND batch=$4 AND serial=$5',[u.tenantId,b.id,productId,batch,serial])).rows[0];
 if(!stock||new D(stock.quantity).lt(quantity))throw new ConflictException('Die tatsächliche Menge dieses Artikels, dieser Charge und Seriennummer reicht auf dem gewählten Platz nicht aus.');
}
export async function assertBinTarget(db:PoolClient,u:Principal,b:any,product:any,quantity:string,batch:string,ownCountId?:string){
 assertBinOpen(b,ownCountId);if((await db.query('SELECT return_bin_held($1,$2)>0 AS held',[u.tenantId,b.id])).rows[0].held)throw new ConflictException('Fach enthält gesperrten Kunden-Prüfbestand; getrenntes Zielfach wählen.');const stock=(await db.query('SELECT s.product_id,s.batch,s.quantity::text,p.unit FROM warehouse_bin_balances s JOIN products p ON p.tenant_id=s.tenant_id AND p.id=s.product_id WHERE s.tenant_id=$1 AND s.bin_id=$2 AND s.quantity>0',[u.tenantId,b.id])).rows;
 if(!b.allow_mixed_products&&stock.some(s=>s.product_id!==product.id))throw new ConflictException('Dieser Platz erlaubt keine Artikelvermischung.');
 if(!b.allow_mixed_batches&&stock.some(s=>s.product_id===product.id&&s.batch!==batch))throw new ConflictException('Dieser Platz erlaubt keine Chargenvermischung dieses Artikels.');
 if(b.capacity!==null&&(b.capacity_unit!==product.unit||stock.some(s=>s.unit!==b.capacity_unit)||stock.reduce((v,s)=>v.plus(s.quantity),new D(quantity)).gt(b.capacity)))throw new ConflictException('Menge oder Einheit überschreitet die konfigurierte Platzkapazität.');
}
export async function assertReceiptBuffer(db:PoolClient,u:Principal,receiptId:string){
 const rows=(await db.query('SELECT gi.product_id,gi.location_id,gi.batch,gi.serial,sum(gi.quantity)::text AS quantity,b.id AS bin_id FROM goods_receipt_items gi JOIN goods_receipts g ON g.tenant_id=gi.tenant_id AND g.id=gi.receipt_id JOIN warehouse_bins b ON b.tenant_id=gi.tenant_id AND b.company_id=g.company_id AND b.location_id=gi.location_id AND b.system_buffer WHERE gi.tenant_id=$1 AND gi.receipt_id=$2 GROUP BY gi.product_id,gi.location_id,gi.batch,gi.serial,b.id',[u.tenantId,receiptId])).rows;
 for(const row of rows){const b=await physicalBin(db,u,row.bin_id,true);try{await assertBinSource(db,u,b,row.product_id,row.quantity,row.batch,row.serial);}catch(e){if(e instanceof ConflictException)throw new ConflictException('Wareneingang liegt nicht vollständig im Eingangspuffer. Einlagerung bzw. spätere Platzwechsel zuerst nachvollziehbar zurücknehmen; anschließend WE-Storno erneut prüfen.');throw e;}}
}

export async function assertLocationBufferOpen(db:PoolClient,u:Principal,locationId:string){const b=(await db.query(binSelect+' WHERE b.tenant_id=$1 AND b.location_id=$2 AND b.system_buffer',[u.tenantId,locationId])).rows[0];if(!b)throw new NotFoundException('Eingangspuffer fehlt.');assertBinOpen(b);}
