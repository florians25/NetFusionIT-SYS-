import {ConflictException} from '@nestjs/common';
import {PoolClient} from 'pg';
import {numberCatalog} from './number-catalog';
const aliases:Record<string,string>={BP:'KD',SUP:'LF',TCK:'TI',SVO:'SA',CTR:'KV',EQP:'AS',VIS:'TE',MAT:'DL',PRQ:'BA',PUR:'BE',GR:'WE',GRC:'SB',JRD:'DO',JRN:'BU',SRM:'TN'};
export async function ensureNumberSeries(db:PoolClient,tenant:string,prefix?:string){
 for(const s of numberCatalog.filter(s=>!prefix||s.prefix===prefix))await db.query('INSERT INTO business_number_series(tenant_id,prefix,name,range_start,range_end,current_value) VALUES($1,$2,$3,$4,$5,$4::integer-1) ON CONFLICT DO NOTHING',[tenant,s.prefix,s.name,s.start,s.end]);
}
export async function businessNumber(db:PoolClient,tenant:string,kind:string){
 const prefix=aliases[kind]||kind;if(!numberCatalog.some(s=>s.prefix===prefix))return null;
 await ensureNumberSeries(db,tenant,prefix);const r=(await db.query('UPDATE business_number_series SET current_value=current_value+1,version=version+1 WHERE tenant_id=$1 AND prefix=$2 AND active AND current_value<range_end RETURNING current_value',[tenant,prefix])).rows[0];
 if(!r)throw new ConflictException('Nummernkreis '+prefix+' ist gesperrt oder ausgeschöpft.');return prefix+'-'+r.current_value;
}
