import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const {parseIncomingInvoiceXml,IncomingInvoiceXmlError}=createRequire(import.meta.url)('../dist/incoming-invoice-xml.js');
const cii=await readFile('tests/fixtures/incoming-invoices/cii.xml','utf8'),ubl=await readFile('tests/fixtures/incoming-invoices/ubl.xml','utf8');
const parse=s=>parseIncomingInvoiceXml(Buffer.from(s));
const rejects=(value,kind)=>assert.throws(()=>parse(value),e=>e instanceof IncomingInvoiceXmlError&&(!kind||e.kind===kind));
test('Unabhängig konvertierte CII/UBL-Originale liefern dieselben Rechnungswerte, Parteien, Mengen und tatsächlichen Leistungsdaten',()=>{
 const a=parse(cii),b=parse(ubl);assert.equal(a.format,'CII');assert.equal(b.format,'UBL');for(const field of ['number','date','currency','net','tax','gross','payable'])assert.equal(a[field],b[field],field);assert.equal(a.number,'RE-45000000');assert.equal(a.gross,'119.00');assert.equal(a.items[0].quantity,'1');assert.equal(a.items[0].unitNet,'100.000000000000');assert.equal(a.items[0].serviceFrom,'2020-02-01');assert.deepEqual(a.items,b.items);assert.equal(a.seller.vatId,'DE123456789');assert.equal(b.seller.iban,a.seller.iban);assert.equal(a.buyer.city,'Hamburg');
});
test('XML-Kodierung wird streng verarbeitet, einschließlich UTF16-BOM; das Original wird nicht verändert',()=>{
 const text=cii.replace('encoding="UTF-8"','encoding="UTF-16"'),original=Buffer.from('\ufeff'+text,'utf16le'),copy=Buffer.from(original);assert.equal(parseIncomingInvoiceXml(original).number,'RE-45000000');assert.deepEqual(original,copy);assert.throws(()=>parseIncomingInvoiceXml(Buffer.from([0xff,0xc0,0xff,0xc0,0xff,0xc0,0xff,0xc0,0xff,0xc0,0xff,0xc0,0xff,0xc0,0xff,0xc0])),IncomingInvoiceXmlError);
});
test('DTD, externe Dateientitäten, HTTP-Entitäten und Stylesheet-Verarbeitungsanweisungen werden vor fachlicher Verarbeitung abgewiesen',()=>{
 for(const entity of ['file:///etc/passwd','https://example.invalid/secret'])rejects(cii.replace('<rsm:CrossIndustryInvoice','<!DOCTYPE invoice [<!ENTITY external SYSTEM "'+entity+'">]><rsm:CrossIndustryInvoice'),'INVALID');rejects(cii.replace('<rsm:CrossIndustryInvoice','<?xml-stylesheet type="text/xsl" href="https://example.invalid/stylesheet"?><rsm:CrossIndustryInvoice'),'INVALID');
});
test('Unbekannte Namespaces und doppelte Kopffelder werden nicht mit ähnlich benannten Rechnungsfeldern verwechselt',()=>{
 rejects(cii.replace('xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"','xmlns:ram="urn:fake:invoice"'));rejects(cii.replace('<ram:ID>RE-45000000</ram:ID>','<ram:ID>RE-45000000</ram:ID><ram:ID>ANDERE-NUMMER</ram:ID>'),'INVALID');rejects(cii+'<second/>','INVALID');
});
test('Zu tiefe/große XML-Strukturen werden begrenzt; syntaktisch defekte Originale liefern einen kontrollierten Fehler',()=>{
 rejects('<root>'+('<nested>'.repeat(55))+'text'+('</nested>'.repeat(55))+'</root>','INVALID');assert.throws(()=>parseIncomingInvoiceXml(Buffer.alloc(5*1024*1024+1)),IncomingInvoiceXmlError);rejects(cii.slice(0,-35),'INVALID');rejects(cii.replace('Netzwerk geprüft','Netzwerk &unbekannteEntitaet; geprüft'),'INVALID');
});
test('Falsche Summen und Steuerbeträge werden nicht still korrigiert oder übernommen',()=>{
 rejects(cii.replace('<ram:GrandTotalAmount>119.00','<ram:GrandTotalAmount>120.00'),'INVALID');rejects(cii.replace('<ram:CalculatedAmount>19.00','<ram:CalculatedAmount>18.00'),'INVALID');rejects(cii.replace('<ram:DuePayableAmount>119.00','<ram:DuePayableAmount>118.00'),'INVALID');
});
test('Nicht implementierte Rechnungsarten, Steuerfälle und Währungsumrechnungen werden als eigener Klärungsbedarf erkannt',()=>{
 rejects(cii.replace('<ram:TypeCode>380','<ram:TypeCode>381'),'UNSUPPORTED');rejects(cii.replaceAll('<ram:CategoryCode>S','<ram:CategoryCode>AE'),'UNSUPPORTED');rejects(cii.replace('currencyID="EUR"','currencyID="USD"'),'UNSUPPORTED');rejects(cii.replace('urn:cen.eu:en16931:2017','urn:factur-x.eu:1p0:minimum'),'UNSUPPORTED');rejects(cii.replace('urn:cen.eu:en16931:2017','urn:fake:en16931:2017'),'UNSUPPORTED');
});
test('Preisbasis, Einheiten und Zahlenpräzision werden explizit geprüft',()=>{
 rejects(cii.replace('unitCode="HUR">1</ram:BasisQuantity>','unitCode="C62">1</ram:BasisQuantity>'),'UNSUPPORTED');rejects(cii.replace('<ram:ChargeAmount>100.000000000000','<ram:ChargeAmount>10000000000000000.000000000000'),'INVALID');rejects(cii.replace('unitCode="HUR">1</ram:BilledQuantity>','unitCode="HUR">0</ram:BilledQuantity>'),'INVALID');
});


test('Schema-, XInclude- und externe Signaturreferenzen werden vor der Java-Validierung kontrolliert abgefangen',()=>{
 rejects(cii.replace('<rsm:CrossIndustryInvoice','<rsm:CrossIndustryInvoice xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:test file:///etc/passwd"'),'UNSUPPORTED');rejects(cii.replace('<ram:BuyerReference>','<xi:include xmlns:xi="http://www.w3.org/2001/XInclude" href="file:///etc/passwd"/><ram:BuyerReference>'),'UNSUPPORTED');rejects(cii.replace('<ram:BuyerReference>','<ds:Reference xmlns:ds="http://www.w3.org/2000/09/xmldsig#" URI="https://example.invalid/secret"/><ram:BuyerReference>'),'UNSUPPORTED');
});

test('XML-Basis-URLs können lokale Signaturreferenzen nicht auf fremde Ressourcen umlenken',()=>{rejects(cii.replace('<rsm:CrossIndustryInvoice ','<rsm:CrossIndustryInvoice xml:base="file:///etc/passwd" '),'UNSUPPORTED');});
test('Zeichenkodierungsdeklaration darf die normative Interpretation nicht von den übernommenen Daten trennen',()=>{
 const xml=cii.toString();assert.throws(()=>parse(Buffer.from(xml.replace('encoding="UTF-8"','encoding="ISO-8859-1"'))),/Zeichenkodierungsdeklaration/);
});
