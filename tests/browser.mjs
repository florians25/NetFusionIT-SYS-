import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { harness,client } from '../scripts/test-harness.mjs';
import { randomUUID } from 'node:crypto';
const h=await harness(3102);
let browser,page;
const errors=[];
try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  page=await browser.newPage({viewport:{width:1440,height:1080}});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+new URL(r.url()).pathname);});
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  async function go(hash){await page.goto(h.base+'/#'+hash);}
  async function login(role){
    const a=h.accounts.find(a=>a.role===role);await go('login');
    await page.getByRole('textbox',{name:'E-Mail-Adresse',exact:true}).fill(a.email);
    await page.getByRole('textbox',{name:'Passwort',exact:true}).fill(a.password);
    await page.getByRole('button',{name:'Anmelden',exact:true}).click();
    await page.getByRole('heading',{name:'Service-Cockpit',exact:true}).waitFor();
  }
  async function logout(){
    const name=await page.evaluate(async()=>{const s=await (await fetch('/api/auth/session')).json();return s.user.name;});
    await page.getByTitle(name,{exact:true}).click();
    await page.getByRole('button',{name:'Abmelden',exact:true}).click();
    await page.getByRole('heading',{name:'Willkommen zurück'}).waitFor();
  }
  await login('CUSTOMER');
  await page.getByRole('button',{name:/Ticket anlegen/}).click();
  await page.getByRole('textbox',{name:'Betreff',exact:true}).fill('VPN-Verbindung am Standort Berlin unterbrochen');
  await page.getByRole('textbox',{name:/Beschreibung/}).fill('Seit heute Morgen können sich mehrere Mitarbeitende nicht über VPN verbinden. Bitte prüfen Sie die Firewall und den VPN-Zugang.');
  await page.getByRole('button',{name:'Ticket speichern',exact:true}).click();
  await page.getByRole('dialog').getByText(/wurden gespeichert/).waitFor();
  await page.getByRole('button',{name:'OK',exact:true}).click();
  await page.getByRole('heading',{name:'VPN-Verbindung am Standort Berlin unterbrochen',exact:true}).waitFor();
  const ticketHash=new URL(page.url()).hash;
  assert.match(ticketHash,/#\/?tickets\/[a-f0-9-]{36}/);
  await page.getByRole('tab',{name:'Belegfluss',exact:true}).click();
  await page.getByRole('link',{name:/SVC-/}).last().click();
  await page.getByRole('heading',{name:'Verknüpfte Tickets'}).waitFor();
  await logout();await login('DISPATCHER');
  await page.locator('[id$="--unassignedKpi"]').click();
  await page.locator('[id$="--worklist"]').getByText('VPN-Verbindung am Standort Berlin unterbrochen',{exact:true}).waitFor();
  await page.getByTitle('Techniker direkt zuweisen',{exact:true}).click();
  await page.getByRole('button',{name:'Zuweisen',exact:true}).click();
  await page.getByRole('dialog').waitFor({state:'hidden'});
  await page.locator('[id$="--queueHeader"]').getByRole('tab',{name:/^Alle/}).click();
  await page.locator('[id$="--worklist"]').getByText('VPN-Verbindung am Standort Berlin unterbrochen',{exact:true}).click();
  await page.getByText('Jonas Weber',{exact:true}).last().waitFor();
  await page.getByRole('tab',{name:'Historie',exact:true}).click();
  await page.getByText('Techniker zugewiesen',{exact:true}).last().waitFor();
  await logout();await login('TECHNICIAN');
  await go(ticketHash.slice(1));
  await page.getByRole('tab',{name:'Bearbeitung',exact:true}).click();
  await page.getByRole('button',{name:'Status übernehmen',exact:true}).click();
  await page.getByText('In Bearbeitung',{exact:true}).first().waitFor();
  await logout();await login('ADMIN');
  // Ausschließlich isolierte Browser-Testdaten: echte API-Kommandos, keine
  // vorgegebenen Dashboardzahlen und keine Änderungen an der Entwicklungs-DB.
  const fixtureApi=await client(h.base,h.accounts.find(a=>a.role==='ADMIN'));
  const partnerId=(await fixtureApi('/api/partners')).data[0].id;
  for(const [title,priority,type] of [
    ['Benutzerzugang für neue Mitarbeiterin einrichten','LOW','SERVICE_REQUEST'],
    ['Druckerserver am Standort Hamburg nicht verfügbar','MEDIUM','INCIDENT'],
    ['E-Mail-Zustellung im Vertrieb stark verzögert','HIGH','INCIDENT'],
    ['Firewall am Hauptstandort meldet Verbindungsabbruch','CRITICAL','INCIDENT']
  ]){
    const r=await fixtureApi('/api/tickets',{method:'POST',headers:{'Idempotency-Key':randomUUID()},body:{title,priority,type,partnerId,description:'Isolierter Browser-Testfall für den Ticket-Eingang und die Prioritätsverteilung. Keine Produktivdaten.'}});assert.equal(r.status,201);
  }
  await page.getByRole('tab',{name:'Kunden',exact:true}).click();
  await page.getByRole('button',{name:'Kunde anlegen',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByRole('textbox',{name:'Name',exact:true}).fill('Browser-Testkunde GmbH');
  await dialog.getByRole('textbox',{name:'E-Mail',exact:true}).fill('browser@example.test');
  await dialog.getByRole('button',{name:'Speichern',exact:true}).click();
  await page.getByText('Browser-Testkunde GmbH',{exact:true}).waitFor();
  await page.getByRole('tab',{name:'Administration',exact:true}).click();
  await page.getByRole('heading',{name:'Benutzer & Organisation'}).waitFor();
  await page.getByRole('tab',{name:'Service-Cockpit',exact:true}).click();
  await page.getByRole('heading',{name:'Service-Cockpit',exact:true}).waitFor();
  await mkdir('test-results',{recursive:true});
  await page.waitForLoadState('networkidle');
  await page.screenshot({path:'test-results/cockpit-desktop.png',fullPage:true});
  await page.getByRole('tab',{name:'Mein Arbeitsplatz',exact:true}).click();
  await page.getByRole('heading',{name:/Guten Tag/}).waitFor();await page.waitForLoadState('networkidle');
  assert.equal(await page.getByText('Zuletzt eingegangene Tickets',{exact:true}).count(),0);
  await page.screenshot({path:'test-results/workspace-desktop.png',fullPage:true});
  await go(ticketHash.slice(1));await page.getByRole('heading',{name:'VPN-Verbindung am Standort Berlin unterbrochen',exact:true}).waitFor();await page.waitForLoadState('networkidle');
  await page.screenshot({path:'test-results/ticket-desktop.png',fullPage:true});
  const mobileContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',storageState:await page.context().storageState()});
  const mobile=await mobileContext.newPage();mobile.on('pageerror',e=>errors.push(e.message));
  await mobile.goto(h.base+'/'+ticketHash);await mobile.getByRole('heading',{name:'VPN-Verbindung am Standort Berlin unterbrochen',exact:true}).waitFor();await mobile.waitForLoadState('networkidle');
  await mobile.screenshot({path:'test-results/ticket-mobile.png',fullPage:true});
  assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Mobile Seite darf nicht horizontal überlaufen.');
  await mobile.goto(h.base+'/');await mobile.getByRole('heading',{name:'Service-Cockpit',exact:true}).waitFor();await mobile.waitForLoadState('networkidle');
  await mobile.screenshot({path:'test-results/cockpit-mobile.png',fullPage:true});
  assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Mobiles Cockpit darf nicht horizontal überlaufen.');
  await mobileContext.close();
  assert.deepEqual(errors,[],'Browserfehler: '+errors.join('\n'));
  console.log('Browserprozess bestanden: Kundenformular → Ticket/Fall → OData-Listen → Dispatcherzuweisung → Technikerstatus; Kundenanlage, Administration und mobile Darstellung.');
}catch(e){
  await mkdir('test-results',{recursive:true});
  if(page){await page.screenshot({path:'test-results/browser-failure.png',fullPage:true});console.error('Sichtbarer Text:',(await page.locator('body').innerText()).slice(0,3000));}
  console.error('Browserdiagnose:',errors.join('\n'));throw e;
}finally{if(browser)await browser.close();await h.close();}
