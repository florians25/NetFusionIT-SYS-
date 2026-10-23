import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,writeFile,readFile,rm,access,stat} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import Decimal from 'decimal.js';
import {renderBusinessPdf,BusinessPdf,DocumentContact} from './business-pdf';
import {parseIncomingInvoiceXml,IncomingInvoiceData,IncomingInvoiceXmlError} from './incoming-invoice-xml';
const exec=promisify(execFile);
let validationRunning=false;
export class EInvoiceBusyError extends Error {}
export class IncomingOriginalValidationError extends Error{constructor(message:string,public readonly report:string){super(message);this.name='IncomingOriginalValidationError';}}
export const E_INVOICE_TOOL_VERSION='2.26.0';
export const E_INVOICE_TOOL_SHA256='42d7868cb68264874a7b8cab4c3587b03b23ccc7cd72373da917f66758bb9736';
export interface InvoiceData {
 orderKind?:'SALES_ORDER';deliveryNumbers?:string[];salesOrderNumber?:string;customerOrderReference?:string;ticketNumbers?:string[];number:string;date:string;dueDate:string;currency:string;buyerReference:string;orderNumber:string;
 seller:{contact?:DocumentContact;name:string;street:string;postalCode:string;city:string;country:string;vatId:string;iban:string;bic:string;email:string;phone:string};
 buyer:{name:string;street:string;postalCode:string;city:string;country:string;vatId:string;number:string};
 items:{deliveryNumber?:string;ticketNumbers?:string[];position:number;sku:string;description:string;quantity:string;unit:string;unitNet:string;net:string;taxRate:string;serviceFrom:string;serviceTo:string}[];
 taxes:{rate:string;basis:string;amount:string}[];net:string;tax:string;gross:string;
}
function xml(value:string|number){const s=String(value);if(/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(s))throw new Error('Nicht zulässiges XML-Steuerzeichen in Rechnungsdaten.');return s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');}
const date=(value:string)=>'<udt:DateTimeString format="102">'+value.replaceAll('-','')+'</udt:DateTimeString>';
export function eInvoiceUnit(unit:string){const code=({EA:'C62',ST:'C62',PC:'C62',H:'HUR',STD:'HUR',KM:'KMT'} as Record<string,string>)[unit]||unit;if(!/^[A-Z0-9]{2,3}$/.test(code))throw new Error('Rechnungseinheit benötigt einen UN/ECE-Code.');return code;}
export function renderInvoiceXml(i:InvoiceData){
 const address=(p:InvoiceData['buyer']|InvoiceData['seller'])=>`<ram:PostalTradeAddress><ram:PostcodeCode>${xml(p.postalCode)}</ram:PostcodeCode><ram:LineOne>${xml(p.street)}</ram:LineOne><ram:CityName>${xml(p.city)}</ram:CityName><ram:CountryID>${xml(p.country)}</ram:CountryID></ram:PostalTradeAddress>`;
 const vat=(value:string)=>value?`<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${xml(value)}</ram:ID></ram:SpecifiedTaxRegistration>`:'';
 const tax=(rate:string,basis?:string,amount?:string)=>`<ram:ApplicableTradeTax>${amount===undefined?'':`<ram:CalculatedAmount>${amount}</ram:CalculatedAmount>`}<ram:TypeCode>VAT</ram:TypeCode>${basis===undefined?'':`<ram:BasisAmount>${basis}</ram:BasisAmount>`}<ram:CategoryCode>S</ram:CategoryCode><ram:RateApplicablePercent>${xml(rate)}</ram:RateApplicablePercent></ram:ApplicableTradeTax>`;
 const first=[...i.items.map(l=>l.serviceFrom)].sort()[0],last=[...i.items.map(l=>l.serviceTo)].sort().at(-1)!;
 return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100" xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100">
<rsm:ExchangedDocumentContext><ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>urn:cen.eu:en16931:2017</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter></rsm:ExchangedDocumentContext>
<rsm:ExchangedDocument><ram:ID>${xml(i.number)}</ram:ID><ram:TypeCode>380</ram:TypeCode><ram:IssueDateTime>${date(i.date)}</ram:IssueDateTime>${i.deliveryNumbers?.length?`<ram:IncludedNote><ram:Content>Lieferscheine: ${xml(i.deliveryNumbers.join(', '))}</ram:Content></ram:IncludedNote>`:''}${i.ticketNumbers?.length?`<ram:IncludedNote><ram:Content>Servicetickets: ${xml(i.ticketNumbers.join(', '))}</ram:Content></ram:IncludedNote>`:''}</rsm:ExchangedDocument>
<rsm:SupplyChainTradeTransaction>
${i.items.map(l=>`<ram:IncludedSupplyChainTradeLineItem><ram:AssociatedDocumentLineDocument><ram:LineID>${l.position}</ram:LineID></ram:AssociatedDocumentLineDocument><ram:SpecifiedTradeProduct>${l.sku?`<ram:SellerAssignedID>${xml(l.sku)}</ram:SellerAssignedID>`:''}<ram:Name>${xml(l.description)}</ram:Name></ram:SpecifiedTradeProduct><ram:SpecifiedLineTradeAgreement><ram:NetPriceProductTradePrice><ram:ChargeAmount>${l.unitNet}</ram:ChargeAmount><ram:BasisQuantity unitCode="${eInvoiceUnit(l.unit)}">1</ram:BasisQuantity></ram:NetPriceProductTradePrice></ram:SpecifiedLineTradeAgreement><ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="${eInvoiceUnit(l.unit)}">${l.quantity}</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery><ram:SpecifiedLineTradeSettlement>${tax(l.taxRate)}<ram:BillingSpecifiedPeriod><ram:StartDateTime>${date(l.serviceFrom)}</ram:StartDateTime><ram:EndDateTime>${date(l.serviceTo)}</ram:EndDateTime></ram:BillingSpecifiedPeriod><ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>${l.net}</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation></ram:SpecifiedLineTradeSettlement></ram:IncludedSupplyChainTradeLineItem>`).join('\n')}
<ram:ApplicableHeaderTradeAgreement>${i.buyerReference?`<ram:BuyerReference>${xml(i.buyerReference)}</ram:BuyerReference>`:''}<ram:SellerTradeParty><ram:Name>${xml(i.seller.name)}</ram:Name>${i.seller.contact?`<ram:DefinedTradeContact><ram:PersonName>${xml(i.seller.contact.firstName+' '+i.seller.contact.lastName)}</ram:PersonName>${i.seller.contact.phone?`<ram:TelephoneUniversalCommunication><ram:CompleteNumber>${xml(i.seller.contact.phone)}</ram:CompleteNumber></ram:TelephoneUniversalCommunication>`:''}<ram:EmailURIUniversalCommunication><ram:URIID>${xml(i.seller.contact.email)}</ram:URIID></ram:EmailURIUniversalCommunication></ram:DefinedTradeContact>`:''}${address(i.seller)}${vat(i.seller.vatId)}</ram:SellerTradeParty><ram:BuyerTradeParty><ram:ID>${xml(i.buyer.number)}</ram:ID><ram:Name>${xml(i.buyer.name)}</ram:Name>${address(i.buyer)}${vat(i.buyer.vatId)}</ram:BuyerTradeParty>${i.salesOrderNumber?`<ram:SellerOrderReferencedDocument><ram:IssuerAssignedID>${xml(i.salesOrderNumber)}</ram:IssuerAssignedID></ram:SellerOrderReferencedDocument>`:''}${i.customerOrderReference?`<ram:BuyerOrderReferencedDocument><ram:IssuerAssignedID>${xml(i.customerOrderReference)}</ram:IssuerAssignedID></ram:BuyerOrderReferencedDocument>`:''}</ram:ApplicableHeaderTradeAgreement>
<ram:ApplicableHeaderTradeDelivery/>
<ram:ApplicableHeaderTradeSettlement><ram:PaymentReference>${xml(i.number)}</ram:PaymentReference><ram:InvoiceCurrencyCode>${i.currency}</ram:InvoiceCurrencyCode><ram:SpecifiedTradeSettlementPaymentMeans><ram:TypeCode>58</ram:TypeCode><ram:PayeePartyCreditorFinancialAccount><ram:IBANID>${xml(i.seller.iban)}</ram:IBANID></ram:PayeePartyCreditorFinancialAccount>${i.seller.bic?`<ram:PayeeSpecifiedCreditorFinancialInstitution><ram:BICID>${xml(i.seller.bic)}</ram:BICID></ram:PayeeSpecifiedCreditorFinancialInstitution>`:''}</ram:SpecifiedTradeSettlementPaymentMeans>${i.taxes.map(t=>tax(t.rate,t.basis,t.amount)).join('')}<ram:BillingSpecifiedPeriod><ram:StartDateTime>${date(first)}</ram:StartDateTime><ram:EndDateTime>${date(last)}</ram:EndDateTime></ram:BillingSpecifiedPeriod><ram:SpecifiedTradePaymentTerms><ram:Description>Zahlbar ohne Abzug bis ${xml(i.dueDate)}.</ram:Description><ram:DueDateDateTime>${date(i.dueDate)}</ram:DueDateDateTime></ram:SpecifiedTradePaymentTerms><ram:SpecifiedTradeSettlementHeaderMonetarySummation><ram:LineTotalAmount>${i.net}</ram:LineTotalAmount><ram:ChargeTotalAmount>0.00</ram:ChargeTotalAmount><ram:AllowanceTotalAmount>0.00</ram:AllowanceTotalAmount><ram:TaxBasisTotalAmount>${i.net}</ram:TaxBasisTotalAmount><ram:TaxTotalAmount currencyID="${i.currency}">${i.tax}</ram:TaxTotalAmount><ram:GrandTotalAmount>${i.gross}</ram:GrandTotalAmount><ram:DuePayableAmount>${i.gross}</ram:DuePayableAmount></ram:SpecifiedTradeSettlementHeaderMonetarySummation></ram:ApplicableHeaderTradeSettlement>
</rsm:SupplyChainTradeTransaction></rsm:CrossIndustryInvoice>`;
}
export function invoicePdfData(i:InvoiceData):BusinessPdf{
 const germanDate=(v:string)=>v.slice(8,10)+'.'+v.slice(5,7)+'.'+v.slice(0,4);const performance=(a:string,b:string)=>germanDate(a)+(a===b?'':' – '+germanDate(b));
 const money=(v:string)=>{const [a,b='']=new Decimal(v).toFixed().split('.');return a+','+b.padEnd(2,'0')+' '+i.currency;};
 return {contact:i.seller.contact,title:'Rechnung',number:i.number,sourceNumber:i.orderNumber,status:'Gebucht',date:i.date,issuer:i.seller,recipient:i.buyer,fields:[['Kundennummer',i.buyer.number],[i.orderKind==='SALES_ORDER'?'Kundenauftrag':'Serviceauftrag',i.orderNumber],...(i.salesOrderNumber&&i.salesOrderNumber!==i.orderNumber?[['Kundenauftrag',i.salesOrderNumber] as [string,string]]:[]),...(i.customerOrderReference?[['Ihre Bestellung',i.customerOrderReference] as [string,string]]:[]),['Zahlbar bis',i.dueDate],...(i.ticketNumbers?.length?[[i.ticketNumbers.length===1?'Ticket':'Tickets',i.ticketNumbers.join(', ')] as [string,string]]:[]),...(i.buyerReference&&i.buyerReference!==i.customerOrderReference?[['Ihre Referenz',i.buyerReference] as [string,string]]:[])],columns:[{title:'Pos.',width:40},{title:'Material / Leistung',width:200},{title:'Menge',width:60},{title:'Preis netto',width:85},{title:'Gesamt\nnetto',width:85},{title:'MwSt.',width:50}],rows:i.items.map(l=>[String(l.position),[l.sku,l.description,...(l.deliveryNumber?['Lieferschein: '+l.deliveryNumber]:[]),(i.orderKind==='SALES_ORDER'?'Lieferdatum: ':'Leistung: ')+performance(l.serviceFrom,l.serviceTo)].filter(Boolean).join('\n'),l.quantity.replace('.',',')+' '+l.unit,money(l.unitNet),money(l.net),l.taxRate+' %']),totals:[['Gesamt netto',money(i.net)],...i.taxes.map(t=>['USt. '+t.rate+' % auf '+money(t.basis),money(t.amount)] as [string,string]),['Rechnungsbetrag',money(i.gross)]],paragraphs:[['Zahlungsinformationen','Bitte überweisen Sie '+money(i.gross)+' bis '+germanDate(i.dueDate)+' unter Angabe der Rechnungsnummer '+i.number+'.\nIBAN: '+i.seller.iban+(i.seller.bic?' · BIC: '+i.seller.bic:'')]],notice:i.orderKind==='SALES_ORDER'?'Für die gelieferten Waren berechnen wir Ihnen:':'Für die erbrachten Leistungen berechnen wir Ihnen:'};
}
export async function createValidatedEInvoice(i:InvoiceData,archiveNumber:string,templateVersion:5|6=6){
 if(validationRunning)throw new EInvoiceBusyError('E-Rechnungsvalidierung ist ausgelastet; Ausgabe erneut anfordern.');
 validationRunning=true;
 try{return await createOutput(i,archiveNumber,templateVersion);}finally{validationRunning=false;}
}
async function verifiedValidatorJar(){
 const jar=process.env.ERP_EINVOICE_VALIDATOR_JAR||path.resolve(__dirname,'../.local/tools/Mustang-CLI-'+E_INVOICE_TOOL_VERSION+'.jar');await access(jar);
 if(createHash('sha256').update(await readFile(jar)).digest('hex')!==E_INVOICE_TOOL_SHA256)throw new Error('Prüfsumme des E-Rechnungswerkzeugs ist ungültig.');
 return jar;
}
function validatorRunner(folder:string,jar:string){
 // The vendor's bundled schema includes need local file/JAR resolution. The
 // strict invoice parser rejects DTD, schema hints, XInclude and external
 // signature references before untrusted XML reaches this subprocess.
 return (args:string[])=>exec('java',['-Xmx512m','-Dfile.encoding=UTF-8','-Djavax.xml.accessExternalDTD=','-Djavax.xml.accessExternalSchema=file,jar:file','-Djavax.xml.accessExternalStylesheet=jar:file','-jar',jar,'--disable-file-logging',...args],{cwd:folder,timeout:90000,maxBuffer:2*1024*1024});
}
function validReport(report:string){return /<summary[^>]*status="valid"/.test(report)&&!report.includes('status="invalid"')&&!/<(?:error|exception)\b/.test(report);}
async function createOutput(i:InvoiceData,archiveNumber:string,templateVersion:5|6){
 const jar=await verifiedValidatorJar();
 const folder=await mkdtemp(path.join(os.tmpdir(),'erp-einvoice-'));
 try{
  const data=renderInvoiceXml(i),base=await renderBusinessPdf(invoicePdfData(i),archiveNumber,{pdfa:true,templateVersion});await writeFile(path.join(folder,'base.pdf'),base,{mode:0o600});await writeFile(path.join(folder,'factur-x.xml'),data,{mode:0o600});
  const run=validatorRunner(folder,jar);
  await run(['--action','combine','--source','base.pdf','--source-xml','factur-x.xml','--out','invoice.pdf','--format','fx','--version','2','--profile','E','--no-additional-attachments']);
  const report=await run(['--action','validate','--source','invoice.pdf']);
  if(!validReport(report.stdout))throw new Error('ZUGFeRD-/PDF-A-Validierung fehlgeschlagen: '+report.stdout.slice(-1500));
  return {pdf:await readFile(path.join(folder,'invoice.pdf')),xml:Buffer.from(data),validation:report.stdout,validator:'Mustang-CLI '+E_INVOICE_TOOL_VERSION};
 }finally{await rm(folder,{recursive:true,force:true});}
}

export async function validateIncomingInvoiceOriginal(content:Buffer,mediaType:'application/xml'|'application/pdf'):Promise<{xml:Buffer;data:IncomingInvoiceData;validation:string;validator:string}>{
 if(content.length<1||content.length>5*1024*1024)throw new IncomingInvoiceXmlError('Originaldatei überschreitet die zulässige Größe.');
 if(validationRunning)throw new EInvoiceBusyError('E-Rechnungsprüfung ist ausgelastet; der Eingang bleibt zur späteren Prüfung erhalten.');
 validationRunning=true;let folder:string|undefined;
 try{
  // Reject active or ambiguous XML before Java is invoked. Hybrid PDFs require
  // a separate successful malware scan in the intake service before this call.
  let data:IncomingInvoiceData|undefined,xml:Buffer=content;
  if(mediaType==='application/xml')data=parseIncomingInvoiceXml(content);
  const jar=await verifiedValidatorJar();folder=await mkdtemp(path.join(os.tmpdir(),'erp-incoming-invoice-'));const run=validatorRunner(folder,jar),source=mediaType==='application/pdf'?'source.pdf':'source.xml';await writeFile(path.join(folder,source),content,{mode:0o600});
  if(mediaType==='application/pdf'){
   if(!content.subarray(0,5).equals(Buffer.from('%PDF-')))throw new IncomingInvoiceXmlError('Original ist keine PDF-Datei.');
   await run(['--action','extract','--source',source,'--out','extracted.xml']);let size=0;
   try{size=(await stat(path.join(folder,'extracted.xml'))).size;}catch{throw new IncomingInvoiceXmlError('PDF enthält kein unterstütztes strukturiertes Rechnungsoriginal.','UNSUPPORTED');}
   if(size>5*1024*1024)throw new IncomingInvoiceXmlError('Eingebettetes XML überschreitet die Verarbeitungsgrenze.');xml=await readFile(path.join(folder,'extracted.xml'));data=parseIncomingInvoiceXml(xml);
  }
  let report:string;try{report=(await run(['--action','validate','--source',source])).stdout;}catch(e){const output=(e as {stdout?:string}).stdout;if(output?.includes('<validation'))report=output;else throw e;}
  if(!validReport(report))throw new IncomingOriginalValidationError('Normative Rechnungsvalidierung fehlgeschlagen. Original bleibt zur Klärung erhalten.',report);
  return {xml,data:data!,validation:report,validator:'Mustang-CLI '+E_INVOICE_TOOL_VERSION};
 }finally{if(folder)await rm(folder,{recursive:true,force:true});validationRunning=false;}
}
