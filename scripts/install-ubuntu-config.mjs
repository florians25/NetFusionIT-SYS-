// Runs in the existing Node initializer. Only non-secret metadata reaches stdout.
import {readFile,access} from 'node:fs/promises';
const state=process.argv[2]||'/run/netfusion-install';
const fields=[['host','ERP_DOMAIN','localhost'],['tenant','ERP_BOOTSTRAP_TENANT','netfusion'],['company','ERP_BOOTSTRAP_COMPANY','NetFusion IT'],['name','ERP_BOOTSTRAP_NAME','Administrator'],['email','ERP_BOOTSTRAP_EMAIL','admin@example.org']];
try{
 let stored=null;try{stored=JSON.parse(await readFile(state+'/configuration.json','utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 const requested=Object.fromEntries(fields.map(([key,env,fallback])=>[key,process.env[env]||fallback]));requested.host=requested.host.toLowerCase();requested.email=requested.email.toLowerCase();
 const explicit=new Set((process.env.ERP_INSTALL_EXPLICIT_KEYS||'').split(','));
 if(stored){
  if(stored.schema!==1||['postgresPassword','applicationPassword','sessionSecret','password'].some(k=>typeof stored[k]!=='string'||stored[k].length<20))throw new Error('Ungültiger gespeicherter Installationsstand.');
  for(const[key,env]of fields)if(explicit.has(env)&&stored[key]!==requested[key])throw new Error('Bestehende Installation verwendet andere Einstellungen ('+env+'). Bestehende Werte bleiben erhalten; abweichende Umgebungsvariable entfernen.');
 }else if(process.env.ERP_INSTALL_DOMAIN_CONFIGURED!=='1'&&process.env.ERP_INSTALL_AUTO_DOMAIN)requested.host=process.env.ERP_INSTALL_AUTO_DOMAIN.toLowerCase();
 if(!stored&&process.env.ERP_INSTALL_DATABASE_EXISTS==='1')throw new Error('Installationskonfiguration fehlt bei vorhandenem Datenbankvolume. Vorhandene Daten werden nicht neu initialisiert.');
 const protocol=process.env.ERP_INSTALL_PROTOCOL||stored?.protocol||(stored?.origin?.startsWith('http:')?'http':'https');if(!['http','https'].includes(protocol))throw new Error('ERP_INSTALL_PROTOCOL muss http oder https sein.');
 const chosen=stored||requested,host=chosen.host;
 if(typeof host!=='string'||host.length>253||!host.split('.').every(s=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(s)))throw new Error('ERP_DOMAIN muss Hostname oder IPv4-Adresse ohne Protokoll und Port sein.');
 if(!/^[a-z0-9-]{2,48}$/.test(chosen.tenant)||!chosen.company?.trim()||!chosen.name?.trim()||!/^\S+@\S+\.\S+$/.test(chosen.email))throw new Error('Mandant, Firma, Administratorname oder E-Mail ungültig.');
 let bootstrapped=false;try{await access(state+'/bootstrap.json');bootstrapped=true;}catch(e){if(e.code!=='ENOENT')throw e;}
 if(bootstrapped&&!stored)throw new Error('Installationskonfiguration fehlt trotz vorhandenem Erstinstallationsnachweis.');
 process.stdout.write(fields.map(([key])=>chosen[key]).concat(stored?'1':'0',bootstrapped?'1':'0',protocol).join('\0')+'\0');
}catch(e){console.error(e.message?.startsWith('Bestehende Installation')||e.message?.startsWith('ERP_DOMAIN')||e.message?.startsWith('ERP_INSTALL_PROTOCOL')||e.message?.startsWith('Mandant,')||e.message?.startsWith('Installationskonfiguration fehlt')?e.message:'Installationskonfiguration kann nicht sicher gelesen werden.');process.exitCode=1;}
