import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,writeFile,readFile,rm,access} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import Decimal from 'decimal.js';
import {renderBusinessPdf,BusinessPdf} from './business-pdf';
const exec=promisify(execFile);
let validationRunning=false;
export class EInvoiceBusyError extends Error {}
export const E_INVOICE_TOOL_VERSION='2.26.0';
export const E_INVOICE_TOOL_SHA256='42d7868cb68264874a7b8cab4c3587b03b23ccc7cd72373da917f66758bb9736';
export interface InvoiceData {
 number:string;date:string;dueDate:string;currency:string;buyerReference:string;orderNumber:string;
 seller:{name:string;street:string;postalCode:string;city:string;country:string;vatId:string;iban:string;bic:string;email:string;phone:string};
 buyer:{name:string;street:string;postalCode:string;city:string;country:string;vatId:string;number:string};
 items:{position:number;sku:string;description:string;quantity:string;unit:string;unitNet:string;net:string;taxRate:string;serviceFrom:string;serviceTo:string}[];
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
<rsm:ExchangedDocument><ram:ID>${xml(i.number)}</ram:ID><ram:TypeCode>380</ram:TypeCode><ram:IssueDateTime>${date(i.date)}</ram:IssueDateTime></rsm:ExchangedDocument>
<rsm:SupplyChainTradeTransaction>
${i.items.map(l=>`<ram:IncludedSupplyChainTradeLineItem><ram:AssociatedDocumentLineDocument><ram:LineID>${l.position}</ram:LineID></ram:AssociatedDocumentLineDocument><ram:SpecifiedTradeProduct>${l.sku?`<ram:SellerAssignedID>${xml(l.sku)}</ram:SellerAssignedID>`:''}<ram:Name>${xml(l.description)}</ram:Name></ram:SpecifiedTradeProduct><ram:SpecifiedLineTradeAgreement><ram:NetPriceProductTradePrice><ram:ChargeAmount>${l.unitNet}</ram:ChargeAmount><ram:BasisQuantity unitCode="${eInvoiceUnit(l.unit)}">1</ram:BasisQuantity></ram:NetPriceProductTradePrice></ram:SpecifiedLineTradeAgreement><ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="${eInvoiceUnit(l.unit)}">${l.quantity}</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery><ram:SpecifiedLineTradeSettlement>${tax(l.taxRate)}<ram:BillingSpecifiedPeriod><ram:StartDateTime>${date(l.serviceFrom)}</ram:StartDateTime><ram:EndDateTime>${date(l.serviceTo)}</ram:EndDateTime></ram:BillingSpecifiedPeriod><ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>${l.net}</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation></ram:SpecifiedLineTradeSettlement></ram:IncludedSupplyChainTradeLineItem>`).join('\n')}
<ram:ApplicableHeaderTradeAgreement>${i.buyerReference?`<ram:BuyerReference>${xml(i.buyerReference)}</ram:BuyerReference>`:''}<ram:SellerTradeParty><ram:Name>${xml(i.seller.name)}</ram:Name>${address(i.seller)}${vat(i.seller.vatId)}</ram:SellerTradeParty><ram:BuyerTradeParty><ram:ID>${xml(i.buyer.number)}</ram:ID><ram:Name>${xml(i.buyer.name)}</ram:Name>${address(i.buyer)}${vat(i.buyer.vatId)}</ram:BuyerTradeParty></ram:ApplicableHeaderTradeAgreement>
<ram:ApplicableHeaderTradeDelivery/>
<ram:ApplicableHeaderTradeSettlement><ram:PaymentReference>${xml(i.number)}</ram:PaymentReference><ram:InvoiceCurrencyCode>${i.currency}</ram:InvoiceCurrencyCode><ram:SpecifiedTradeSettlementPaymentMeans><ram:TypeCode>58</ram:TypeCode><ram:PayeePartyCreditorFinancialAccount><ram:IBANID>${xml(i.seller.iban)}</ram:IBANID></ram:PayeePartyCreditorFinancialAccount>${i.seller.bic?`<ram:PayeeSpecifiedCreditorFinancialInstitution><ram:BICID>${xml(i.seller.bic)}</ram:BICID></ram:PayeeSpecifiedCreditorFinancialInstitution>`:''}</ram:SpecifiedTradeSettlementPaymentMeans>${i.taxes.map(t=>tax(t.rate,t.basis,t.amount)).join('')}<ram:BillingSpecifiedPeriod><ram:StartDateTime>${date(first)}</ram:StartDateTime><ram:EndDateTime>${date(last)}</ram:EndDateTime></ram:BillingSpecifiedPeriod><ram:SpecifiedTradePaymentTerms><ram:Description>Zahlbar ohne Abzug bis ${xml(i.dueDate)}.</ram:Description><ram:DueDateDateTime>${date(i.dueDate)}</ram:DueDateDateTime></ram:SpecifiedTradePaymentTerms><ram:SpecifiedTradeSettlementHeaderMonetarySummation><ram:LineTotalAmount>${i.net}</ram:LineTotalAmount><ram:ChargeTotalAmount>0.00</ram:ChargeTotalAmount><ram:AllowanceTotalAmount>0.00</ram:AllowanceTotalAmount><ram:TaxBasisTotalAmount>${i.net}</ram:TaxBasisTotalAmount><ram:TaxTotalAmount currencyID="${i.currency}">${i.tax}</ram:TaxTotalAmount><ram:GrandTotalAmount>${i.gross}</ram:GrandTotalAmount><ram:DuePayableAmount>${i.gross}</ram:DuePayableAmount></ram:SpecifiedTradeSettlementHeaderMonetarySummation></ram:ApplicableHeaderTradeSettlement>
</rsm:SupplyChainTradeTransaction></rsm:CrossIndustryInvoice>`;
}
export function invoicePdfData(i:InvoiceData):BusinessPdf{
 const money=(v:string)=>{const [a,b='']=new Decimal(v).toFixed().split('.');return a+','+b.padEnd(2,'0')+' '+i.currency;};
 return {title:'Rechnung',number:i.number,sourceNumber:i.orderNumber,status:'Gebucht',date:i.date,issuer:i.seller,recipient:i.buyer,fields:[['Kundennummer',i.buyer.number],['Serviceauftrag',i.orderNumber],['Zahlbar bis',i.dueDate],...(i.buyerReference?[['Ihre Referenz',i.buyerReference] as [string,string]]:[])],columns:[{title:'Pos.',width:40},{title:'Material / Leistung',width:200},{title:'Menge',width:60},{title:'Preis netto',width:85},{title:'Gesamt\nnetto',width:85},{title:'MwSt.',width:50}],rows:i.items.map(l=>[String(l.position),[l.sku,l.description,'Leistungszeitraum: '+l.serviceFrom+' bis '+l.serviceTo].filter(Boolean).join('\n'),l.quantity.replace('.',',')+' '+l.unit,money(l.unitNet),money(l.net),l.taxRate+' %']),totals:[['Gesamt netto',money(i.net)],...i.taxes.map(t=>['Umsatzsteuer '+t.rate+' % auf '+money(t.basis),money(t.amount)] as [string,string]),['Rechnungsbetrag',money(i.gross)]],paragraphs:[['Zahlungsinformationen','Bitte überweisen Sie '+money(i.gross)+' bis '+i.dueDate+' unter Angabe der Rechnungsnummer '+i.number+'.\nIBAN: '+i.seller.iban+(i.seller.bic?' · BIC: '+i.seller.bic:'')]],notice:'Die Rechnung enthält die nachstehend aufgeführten freigegebenen Leistungen.'};
}
export async function createValidatedEInvoice(i:InvoiceData,archiveNumber:string){
 if(validationRunning)throw new EInvoiceBusyError('E-Rechnungsvalidierung ist ausgelastet; Ausgabe erneut anfordern.');
 validationRunning=true;
 try{return await createOutput(i,archiveNumber);}finally{validationRunning=false;}
}
async function createOutput(i:InvoiceData,archiveNumber:string){
 const jar=process.env.ERP_EINVOICE_VALIDATOR_JAR||path.resolve(__dirname,'../.local/tools/Mustang-CLI-'+E_INVOICE_TOOL_VERSION+'.jar');await access(jar);
 if(createHash('sha256').update(await readFile(jar)).digest('hex')!==E_INVOICE_TOOL_SHA256)throw new Error('Prüfsumme des E-Rechnungswerkzeugs ist ungültig.');
 const folder=await mkdtemp(path.join(os.tmpdir(),'erp-einvoice-'));
 try{
  const data=renderInvoiceXml(i),base=await renderBusinessPdf(invoicePdfData(i),archiveNumber,{pdfa:true});await writeFile(path.join(folder,'base.pdf'),base,{mode:0o600});await writeFile(path.join(folder,'factur-x.xml'),data,{mode:0o600});
  const run=async(args:string[])=>exec('java',['-Xmx512m','-Dfile.encoding=UTF-8','-jar',jar,'--disable-file-logging',...args],{cwd:folder,timeout:90000,maxBuffer:2*1024*1024});
  await run(['--action','combine','--source','base.pdf','--source-xml','factur-x.xml','--out','invoice.pdf','--format','fx','--version','2','--profile','E','--no-additional-attachments']);
  const report=await run(['--action','validate','--source','invoice.pdf']);
  if(!/<summary[^>]*status="valid"/.test(report.stdout)||/<(?:error|exception)\b/.test(report.stdout))throw new Error('ZUGFeRD-/PDF-A-Validierung fehlgeschlagen: '+report.stdout.slice(-1500));
  return {pdf:await readFile(path.join(folder,'invoice.pdf')),xml:Buffer.from(data),validation:report.stdout,validator:'Mustang-CLI '+E_INVOICE_TOOL_VERSION};
 }finally{await rm(folder,{recursive:true,force:true});}
}
