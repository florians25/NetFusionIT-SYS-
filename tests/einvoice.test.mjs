import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {renderInvoiceXml,createValidatedEInvoice,eInvoiceUnit,EInvoiceBusyError}=createRequire(import.meta.url)('../dist/einvoice.js');
const sample=()=>({number:'RE-45000001',date:'2026-10-22',dueDate:'2026-11-21',currency:'EUR',buyerReference:'PO-123',orderNumber:'SA-61000001',seller:{contact:{firstName:'Martina',lastName:'Musterfrau',email:'martina.musterfrau@example.test',phone:'+4930123456'},name:'Testgesellschaft GmbH',street:'Werkstraße 1',postalCode:'10115',city:'Berlin',country:'DE',vatId:'DE123456789',iban:'DE89370400440532013000',bic:'COBADEFFXXX',email:'rechnung@example.test',phone:'+4930123456'},buyer:{name:'Kunde GmbH',number:'KD-10000001',street:'Kundenstraße 2',postalCode:'20095',city:'Hamburg',country:'DE',vatId:''},items:[{position:10,sku:'DL-32000001',description:'Netzwerkprüfung',quantity:'1',unit:'H',unitNet:'100.00',net:'100.00',taxRate:'19',serviceFrom:'2026-10-01',serviceTo:'2026-10-02'}],taxes:[{rate:'19',basis:'100.00',amount:'19.00'}],net:'100.00',tax:'19.00',gross:'119.00'});
test('CII maskiert Geschäftstexte und behält getrennte Leistungsdaten; ungeeignete Einheiten/Steuerzeichen werden abgewiesen',()=>{
 const i=sample();i.items[0].description='Router <Core> & "Switch"';const xml=renderInvoiceXml(i);assert.ok(xml.includes('Router &lt;Core&gt; &amp; &quot;Switch&quot;'));assert.ok(xml.includes('20261001'));assert.ok(xml.includes('20261002'));assert.equal(eInvoiceUnit('H'),'HUR');assert.throws(()=>eInvoiceUnit('"><evil>'));i.items[0].description='schlecht\u0000';assert.throws(()=>renderInvoiceXml(i),/Steuerzeichen/);
});
test('Echter Validator blockiert rechnerisch falsche E-Rechnung; parallele Java-Aufrufe sind begrenzt und der Slot wird freigegeben',async()=>{
 const bad=sample();bad.gross='120.00';const running=createValidatedEInvoice(bad,'DO-87000001');await assert.rejects(createValidatedEInvoice(sample(),'DO-87000002'),EInvoiceBusyError);await assert.rejects(running,/Validierung|Command failed/);
 const valid=await createValidatedEInvoice(sample(),'DO-87000003');assert.ok(valid.validation.includes('status="valid"'));assert.ok(valid.pdf.length>10000);assert.ok(valid.xml.toString().includes('<ram:GrandTotalAmount>119.00'));
});
