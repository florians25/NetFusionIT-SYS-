import {mkdir,readFile,writeFile,rename,rm} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const version='2.26.0',sha256='42d7868cb68264874a7b8cab4c3587b03b23ccc7cd72373da917f66758bb9736';
export const filename='Mustang-CLI-'+version+'.jar';
const destination=process.argv[2]||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../.local/tools',filename);
const checksum=b=>createHash('sha256').update(b).digest('hex');
let exists=false;try{exists=checksum(await readFile(destination))===sha256;}catch(e){if(e.code!=='ENOENT')throw e;}
if(!exists){const response=await fetch('https://repo.maven.apache.org/maven2/org/mustangproject/Mustang-CLI/'+version+'/'+filename,{signal:AbortSignal.timeout(120000)});if(!response.ok)throw new Error('Offizielles E-Rechnungswerkzeug nicht abrufbar: HTTP '+response.status);const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>100*1024*1024||checksum(bytes)!==sha256)throw new Error('Prüfsumme des E-Rechnungswerkzeugs stimmt nicht überein.');await mkdir(path.dirname(destination),{recursive:true});const temporary=destination+'.'+randomUUID();try{await writeFile(temporary,bytes,{mode:0o644,flag:'wx'});await rename(temporary,destination);}finally{await rm(temporary,{force:true});}}
console.log('Offizielle Mustang-CLI '+version+' mit festgelegter SHA-256 verifiziert.');
