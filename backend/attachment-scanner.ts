import {createConnection} from 'node:net';
export interface ScanResult {status:'CLEAN'|'INFECTED'|'UNAVAILABLE';engine:string;detail:string;}
// ClamAV INSTREAM. Missing configuration and every protocol/network failure fail closed.
export async function scanPdf(content:Buffer):Promise<ScanResult>{
 const host=process.env.ERP_CLAMAV_HOST;
 if(!host)return {status:'UNAVAILABLE',engine:'ClamAV INSTREAM',detail:'Kein Virenprüfdienst konfiguriert; Datei bleibt in Quarantäne.'};
 const port=Number(process.env.ERP_CLAMAV_PORT||3310);
 if(!/^[a-zA-Z0-9.-]{1,253}$/.test(host)||!Number.isInteger(port)||port<1||port>65535)return {status:'UNAVAILABLE',engine:'ClamAV INSTREAM',detail:'Prüfdienstkonfiguration ungültig.'};
 return new Promise(resolve=>{
  let result='',finished=false;const socket=createConnection({host,port});
  const deadline=setTimeout(()=>done({status:'UNAVAILABLE',engine:'ClamAV INSTREAM',detail:'Zeitlimit der Virenprüfung erreicht.'}),8000);
  const done=(r:ScanResult)=>{if(finished)return;finished=true;clearTimeout(deadline);socket.destroy();resolve(r);};
  socket.setTimeout(8000,()=>done({status:'UNAVAILABLE',engine:'ClamAV INSTREAM',detail:'Zeitüberschreitung der Virenprüfung.'}));
  socket.on('error',()=>done({status:'UNAVAILABLE',engine:'ClamAV INSTREAM',detail:'Virenprüfdienst nicht erreichbar.'}));
  socket.on('data',data=>{result+=data.toString('utf8');if(result.length>2048)return done({status:'UNAVAILABLE',engine:'ClamAV INSTREAM',detail:'Ungültige Antwort des Prüfdiensts.'});if(result.includes('\0'))finish();});
  function finish(){const response=result.replace(/\0/g,'').trim();if(response==='stream: OK')done({status:'CLEAN',engine:'ClamAV INSTREAM',detail:'Inhalt zum Scanzeitpunkt ohne Virenfund.'});else if(/^stream: .+ FOUND$/.test(response))done({status:'INFECTED',engine:'ClamAV INSTREAM',detail:response.slice(0,1000)});else done({status:'UNAVAILABLE',engine:'ClamAV INSTREAM',detail:'Keine bestätigte Freigabe vom Virenprüfdienst.'});}
  socket.on('end',finish);socket.on('close',()=>{if(!finished)finish();});
  socket.on('connect',()=>{socket.write('zINSTREAM\0');for(let offset=0;offset<content.length;offset+=16384){const chunk=content.subarray(offset,offset+16384),length=Buffer.alloc(4);length.writeUInt32BE(chunk.length);socket.write(length);socket.write(chunk);}socket.write(Buffer.alloc(4));});
 });
}
