import {enterAppCenter} from './helpers/ui5-navigation.mjs';
import {editingSurface} from './helpers/editing-surface.mjs';
import { chromium } from 'playwright-core';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { harness,client } from '../scripts/test-harness.mjs';
const h=await harness(3104),errors=[];
let browser,page;
try{
 const api=await client(h.base,h.accounts.find(a=>a.role==='ADMIN')),org=(await api('/api/organization')).data[0].id;
 const partner=(await api('/api/partners',{method:'POST',body:{name:'Browser Freigabekunde',email:'workflow-browser@example.test',organizationId:org}})).data;
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 page=await browser.newPage({viewport:{width:1440,height:1080}});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+new URL(r.url()).pathname);});
 async function login(role){const a=h.accounts.find(a=>a.role===role);await page.goto(h.base+'/#login');await page.getByRole('textbox',{name:'E-Mail-Adresse',exact:true}).fill(a.email);await page.getByRole('textbox',{name:'Passwort',exact:true}).fill(a.password);await page.getByRole('button',{name:'Anmelden',exact:true}).click();await enterAppCenter(page);}
 await login('ADMIN');await page.goto(h.base+'/#workflow');
 await page.getByRole('button',{name:'Definition konfigurieren',exact:true}).click();
 let dialog=editingSurface(page);await dialog.getByRole('textbox',{name:'Bezeichnung',exact:true}).fill('Kundenstammdatenprüfung');
 await dialog.getByRole('textbox').nth(1).fill('Stammdatenprüfung');
 await dialog.getByRole('textbox').nth(1).press('Tab');await page.waitForFunction(()=>!sap.ui.getCore().getUIDirty());const roles=dialog.getByRole('combobox').last(),roleId=await roles.getAttribute('id');await page.locator('[id="'+roleId.replace(/-inner$/,'-arrow')+'"]').click();await page.getByRole('option',{name:'IT-Support',exact:true}).filter({visible:true}).click();await roles.press('Escape');
 await dialog.getByRole('button',{name:'Neue Definition aktivieren',exact:true}).click();await dialog.waitFor({state:'hidden'});
 assert.equal((await api('/api/workflow/definitions')).data[0].steps[0].roles[0],'SUPPORT');
 await page.goto(h.base+'/#partners/'+partner.id);await page.getByRole('button',{name:'Zur Freigabe einreichen',exact:true}).click();await page.getByText('In Prüfung',{exact:true}).waitFor();
 const name=await page.evaluate(async()=>((await (await fetch('/api/auth/session')).json()).user.name));await page.getByTitle(name,{exact:true}).click();await page.getByRole('button',{name:'Abmelden',exact:true}).click();await page.getByRole('heading',{name:'Willkommen zurück',exact:true}).waitFor();
 await login('SUPPORT');await page.goto(h.base+'/#workflow');await page.getByRole('button',{name:'Freigeben',exact:true}).click();
 dialog=editingSurface(page);await dialog.getByRole('textbox').fill('Kundenstammdaten geprüft und bestätigt.');await dialog.getByRole('button',{name:'Entscheidung speichern',exact:true}).click();await dialog.waitFor({state:'hidden'});
 assert.equal((await api('/api/partners/'+partner.id)).data.status,'ACTIVE');
 await page.waitForLoadState('networkidle');await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/workflow-inbox.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('OpenUI5-Freigabeprozess bestanden: Definition konfigurieren → Kunde einreichen → Vier-Augen-Freigabe durch Support → Kunde aktiv.');
}catch(e){if(page){await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/workflow-browser-failure.png',fullPage:true});console.error((await page.locator('body').innerText()).slice(0,3500));}console.error(errors.join('\n'));throw e;}
finally{if(browser)await browser.close();await h.close();}
