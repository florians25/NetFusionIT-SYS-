import PDFDocument from 'pdfkit';
import path from 'node:path';
import bwipjs from 'bwip-js';
import {renderBusinessPdf as renderV5} from './business-pdf-v5';
export interface DocumentContact {firstName:string;lastName:string;email:string;phone:string;version?:number;}
export interface BusinessPdf {
 title:string;number:string;sourceNumber:string;status:string;date:string;
 contact?:DocumentContact;
 issuer:{name:string;street?:string;postalCode?:string;city?:string;country?:string;vatId?:string};
 recipient?:{name:string;street?:string;postalCode?:string;city?:string;country?:string};
 fields:[string,string][];columns:{title:string;width:number;align?:'left'|'right'}[];rows:string[][];
 totals?:[string,string][];paragraphs?:[string,string][];notice?:string;
}
// DIN 5008 Form B: dimensions in mm, then converted to PDF points.
export const BUSINESS_PDF_TEMPLATE_VERSION=6;
export class BusinessPdfLayoutError extends Error {}
export async function renderBusinessPdf(data:BusinessPdf,archiveNumber:string,options:{pdfa?:boolean;templateVersion?:5|6}={}):Promise<Buffer>{
 if(options.templateVersion===5)return renderV5(data,archiveNumber,{pdfa:options.pdfa});
 if(!data.contact?.firstName?.trim()||!data.contact?.lastName?.trim())throw new BusinessPdfLayoutError('Vorname und Nachname des Dokumentansprechpartners fehlen.');
 // BWIPP generates the Code 128 checksum and automatic code-set switches.
 // Keep vector bars for clean monochrome printing; no external image/URL is used.
 if(!/^[A-Za-z0-9][A-Za-z0-9._\/-]{0,47}$/.test(data.number))throw new BusinessPdfLayoutError('Belegnummer ist für den Belegbarcode nicht zulässig.');
 const symbol=bwipjs.raw({bcid:'code128',text:data.number})[0];
 if(!('sbs' in symbol))throw new BusinessPdfLayoutError('Code-128-Ausgabe konnte nicht erzeugt werden.');
 const modules=symbol.sbs.reduce((sum,n)=>sum+n,0),barcodeModule=Math.min(.85,80*72/25.4/(modules+20));
 if(barcodeModule<.55)throw new BusinessPdfLayoutError('Belegnummer überschreitet die druckbare Barcodebreite.');
 const mm=(v:number)=>v*72/25.4,left=mm(25),width=mm(165),bottom=mm(264),ink='#000000',rule='#000000';
 const doc=new PDFDocument({size:'A4',...(options.pdfa?{subset:'PDF/A-3b',pdfVersion:'1.7' as const}:{}),margins:{top:mm(15),left,right:mm(20),bottom:mm(29)},bufferPages:true,info:{Title:data.title+' '+data.number,Author:data.issuer.name,Subject:data.sourceNumber,Creator:'NetFusion ERP / PDFKit',Keywords:archiveNumber}});
 const normal=path.resolve(__dirname,'../assets/fonts/DejaVuSans.ttf'),bold=path.resolve(__dirname,'../assets/fonts/DejaVuSans-Bold.ttf');
 doc.registerFont('Business',normal);doc.registerFont('BusinessBold',bold);doc.font('Business');
 const chunks:Buffer[]=[];const result=new Promise<Buffer>((resolve,reject)=>{doc.on('data',c=>chunks.push(c));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);});
 let y=0;const pageFields:{page:number;y:number}[]=[];
 function font(size:number,strong=false){doc.font(strong?'BusinessBold':'Business').fontSize(size).fillColor(ink);}
 function line(value:string,x:number,top:number,w:number,size=9,strong=false,align:'left'|'right'='left'){
  font(size,strong);doc.text(value,x,top,{width:w,lineBreak:false,align});
 }
 function lines(value:string,w:number,size=9,strong=false){
  font(size,strong);const out:string[]=[];let current='';
  // Word wrapping also preserves long serial numbers and unbroken identifiers.
  for(const paragraph of value.split('\n')){current='';for(const character of paragraph){if(current&&doc.widthOfString(current+character)>w){const space=current.lastIndexOf(' ');if(space>0){out.push(current.slice(0,space));current=current.slice(space+1);}else{out.push(current);current='';}}current+=character;}out.push(current);}
  return out;
 }
 function drawLines(values:string[],x:number,top:number,w:number,size=9,strong=false,align:'left'|'right'='left',pitch=12){values.forEach((v,i)=>line(v,x,top+i*pitch,w,size,strong,align));}
 function stroke(x:number,top:number,w:number,color=rule,weight=.5){doc.moveTo(x,top).lineTo(x+w,top).lineWidth(weight).strokeColor(color).stroke();}
 function continuation(){doc.addPage();line(data.issuer.name,left,mm(15),width*.62,9,true);line(data.title,left,mm(23),width*.6,11,true);line(data.number,left+width*.6,mm(23),width*.27,9,true,'right');pageFields.push({page:doc.bufferedPageRange().count-1,y:mm(23)});line('Ihr Ansprechpartner: '+data.contact!.firstName+' '+data.contact!.lastName,left,mm(31),width,8);stroke(left,mm(37),width);y=mm(44);}
 function page(height:number){if(y+height>bottom)continuation();}
 const address=(a:NonNullable<BusinessPdf['recipient']>)=>[a.name,a.street,[a.postalCode,a.city].filter(Boolean).join(' '),a.country].filter(Boolean) as string[];
 const issuerAddress=[data.issuer.street,[data.issuer.postalCode,data.issuer.city].filter(Boolean).join(' '),data.issuer.country].filter(Boolean).join(' · ');
 // Classical monochrome form: small issuer, address at left, document block at right.
 const issuerLines=lines(data.issuer.name,mm(80),10,true);if(issuerLines.length>3)throw new BusinessPdfLayoutError('Firmenname überschreitet den Briefkopf.');
 drawLines(issuerLines,mm(110),mm(15),mm(80),10,true,'right',12);
 for(const mark of [105,148.5,210])stroke(mm(5),mm(mark),mm(mark===148.5?3:5));
 const sender=data.issuer.name+(issuerAddress?' · '+issuerAddress:''),senderLines=lines(sender,mm(85),6.5);if(senderLines.length>2)throw new BusinessPdfLayoutError('Absenderangabe überschreitet das DIN-Anschriftfeld.');
 drawLines(senderLines,mm(20),mm(45),mm(85),6.5,false,'left',7);
 // Plain DIN window address; no additional table or framed block.
 if(data.recipient){const recipientLines=address(data.recipient).flatMap(v=>lines(v,mm(85),10));if(recipientLines.length>6)throw new BusinessPdfLayoutError('Empfängeranschrift überschreitet sechs Zeilen im DIN-Anschriftfeld.');drawLines(recipientLines,mm(20),mm(62.7),mm(85),10,false,'left',mm(4.23));}
 const dateValue=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)?v.slice(8,10)+'.'+v.slice(5,7)+'.'+v.slice(0,4):v.replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\b/g,value=>new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',timeZoneName:'short'}).format(new Date(value)));
 const infoX=mm(110),infoW=mm(80),titleLines=lines(data.title,infoW,12,true);drawLines(titleLines,infoX,mm(38),infoW,12,true,'left',15);
 const primaryY=Math.max(mm(50),mm(38)+titleLines.length*15+8);
 line('Nummer',infoX,primaryY,mm(40),7);line(data.number,infoX,primaryY+11,mm(40),10,true);
 line('Datum',mm(153),primaryY,mm(25),7);line(dateValue(data.date),mm(153),primaryY+11,mm(25),9);

 const delivery=data.fields.find(([k])=>k==='Lieferanschrift'),version=data.fields.find(([k])=>k==='Vorgangsversion');
 const remaining=data.fields.filter(([k])=>!['Organisation','Vorgangsversion','Lieferanschrift'].includes(k));
 const reference=(k:string)=>/Bestellung|auftrag|referenz|nummer|Nummer|Referenz/.test(k);
 const important=new Set(['Kundennummer','Lieferanten-Nr.','Kundenreferenz','Ihre Bestellung','Kundenauftrag','Serviceauftrag','Bestellung','Bestellnummer','Zahlbar bis']);
 const header=remaining.filter(([k,v])=>important.has(k)&&v.length<70&&!v.includes('\n')).slice(0,3);
 if(data.sourceNumber!==data.number&&!header.some(([,v])=>v===data.sourceNumber))header.push(['Ursprungsbeleg',data.sourceNumber]);
 let infoY=primaryY+31;line('Ansprechpartner',infoX,infoY,infoW,7);const contactName=data.contact!.firstName+' '+data.contact!.lastName;let contactSize=9;font(contactSize);while(doc.widthOfString(contactName)>infoW&&contactSize>7){contactSize-=.25;font(contactSize);}const contactLines=lines(contactName,infoW,contactSize);if(contactLines.length>3)throw new BusinessPdfLayoutError('Vollständiger Ansprechpartner überschreitet den Belegkopf.');drawLines(contactLines,infoX,infoY+10,infoW,contactSize);infoY+=contactLines.length*12+17;
 for(const [label,value] of header){line(label,infoX,infoY,infoW,7);const values=lines(dateValue(value),infoW,9);drawLines(values,infoX,infoY+10,infoW,9,false,'left',11);infoY+=values.length*11+15;}
 let leftEnd=mm(90);
 if(delivery){const values=lines(delivery[1],mm(80),10);leftEnd=mm(96)+12+values.length*12;line('Lieferanschrift',left,mm(96),mm(80),7,true);drawLines(values,left,mm(96)+12,mm(80),10,false,'left',12);}
 y=Math.max(mm(delivery?123:104),infoY+14,leftEnd+18);
 // Long references and narratives stay below the two address/header columns.
 const details=remaining.filter(f=>!header.includes(f)),compact=details.filter(([label,value])=>value.length<100&&!value.includes('\n')&&!['Betreff','Bestelltext','Auslieferungstext','Ticket-Korrelation','Korrelations-ID'].includes(label));
 for(let i=0;i<compact.length;i+=2){const pair=compact.slice(i,i+2).map(([label,value])=>({label,values:lines(dateValue(value),width/2-12,9)})),height=Math.max(...pair.map(p=>p.values.length))*12+18;page(height);pair.forEach((p,j)=>{const x=left+j*width/2;line(p.label,x,y,width/2-12,7,true);drawLines(p.values,x,y+11,width/2-12,9,false,'left',12);});y+=height;}
 for(const [label,value] of details.filter(f=>!compact.includes(f))){const values=lines(dateValue(value),width,10),h=values.length*14+17;page(h);line(label,left,y,width,7,true);drawLines(values,left,y+11,width,10,false,'left',14);y+=h;}
 if(data.notice){for(const v of lines(data.notice,width,10)){page(14);line(v,left,y,width,10);y+=14;}y+=12;}
 if(data.columns.length){
  const sum=data.columns.reduce((v,c)=>v+c.width,0),colWidths=data.columns.map(c=>c.width/sum*width),pitch=11,pad=4;
  if(colWidths.length>1&&colWidths[0]<34){colWidths[1]-=34-colWidths[0];colWidths[0]=34;}
  const headingText=(v:string)=>v.replace(/-\n/g,'').replace(/\n/g,' ');
  const preferred=colWidths.map((w,i)=>{if(i===1)return w;const values=data.rows.map(r=>r[i]||'').filter(v=>v.length<=36&&!v.includes('\n')).map(v=>/^\d{4}-\d{2}-\d{2}$/.test(v)?v.slice(8,10)+'.'+v.slice(5,7)+'.'+v.slice(0,4):v);font(8);const cellWidth=Math.max(w,...values.map(v=>doc.widthOfString(v)+pad*2));font(8,true);return Math.max(cellWidth,doc.widthOfString(headingText(data.columns[i].title))+pad*2);}),extra=preferred.reduce((n,w,i)=>n+w-colWidths[i],0);if(colWidths.length>1&&colWidths[1]-extra>=100){preferred[1]-=extra;preferred.forEach((w,i)=>{colWidths[i]=w;});}
  const alignment=(i:number):'left'|'right'=>data.columns[i].align||(/Menge|Istmenge|Netto|Brutto|Preis|Wert|Betrag/i.test(data.columns[i].title)?'right':'left');
  function cells(values:string[],heading=false){return data.columns.map((_,i)=>{let value=heading?headingText(values[i]||'–'):values[i]||'–';if(!heading&&i===0&&/^(Pos|Auftrags)/.test(data.columns[0].title)&&/^\d+$/.test(value))value=value.padStart(4,'0');if(/^\d{4}-\d{2}-\d{2}$/.test(value))value=value.slice(8,10)+'.'+value.slice(5,7)+'.'+value.slice(0,4);return lines(value,colWidths[i]-pad*2,8,heading);});}
  function draw(values:string[][],height:number,heading=false){
   if(heading)stroke(left,y,width,ink,1);let x=left;
   values.forEach((v,i)=>{drawLines(v,x+pad,y+pad,colWidths[i]-pad*2,8,heading||i===0,alignment(i),pitch);x+=colWidths[i];});if(heading)stroke(left,y+height,width,ink,1);y+=height+(heading?0:6);
  }
  const header=cells(data.columns.map(c=>c.title),true),headerHeight=Math.max(...header.map(c=>c.length))*pitch+pad*2;
  page(headerHeight+pitch+pad*2);draw(header,headerHeight,true);
  for(const values of data.rows){const wrapped=cells(values),count=Math.max(...wrapped.map(c=>c.length));let offset=0;
   while(offset<count){let capacity=Math.floor((bottom-y-pad*2-6)/pitch);if(capacity<1){continuation();draw(header,headerHeight,true);capacity=Math.floor((bottom-y-pad*2-6)/pitch);}const take=Math.min(capacity,count-offset);draw(wrapped.map(c=>c.slice(offset,offset+take)),take*pitch+pad*2);offset+=take;}
  }y+=14;
 }
 const totalRows=(data.totals||[]).map(([label,value],i)=>{const last=i===data.totals!.length-1,w=width*.65,x=left+width-w,labels=lines(label,w*.52,9,last),values=lines(value,w*.45,10,last);return {last,w,x,labels,values,h:Math.max(labels.length,values.length)*13+12};}),totalHeight=totalRows.reduce((sum,r)=>sum+r.h,0);
 // Keep ordinary net/tax/gross blocks together. Oversized exceptional totals
 // still use the regular page guard and never overwrite the footer.
 if(totalHeight<=bottom-mm(38))page(totalHeight);
 for(const r of totalRows){page(r.h);if(r.last)stroke(r.x,y-3,r.w,ink);drawLines(r.labels,r.x,y,r.w*.52,9,r.last);drawLines(r.values,r.x+r.w*.55,y,r.w*.45,10,r.last,'right',13);y+=r.h;}
 for(const [title,value] of data.paragraphs||[]){page(36);line(title,left,y,width,10,true);y+=20;for(const v of lines(value,width,10)){page(14);line(v,left,y,width,10);y+=14;}y+=12;}
 const pages=doc.bufferedPageRange();for(let i=pages.start;i<pages.start+pages.count;i++){
  doc.switchToPage(i);const margin=doc.page.margins.bottom;doc.page.margins.bottom=0;
  // Reserve 10 narrow modules of white quiet zone on either side. The footer
  // is outside the address window and the last printable table line.
  const barcodeWidth=(modules+20)*barcodeModule,barcodeX=mm(190)-barcodeWidth,barcodeY=mm(268);
  let barX=barcodeX+10*barcodeModule;
  doc.fillColor(ink);symbol.sbs.forEach((n,index)=>{if(index%2===0)doc.rect(barX,barcodeY,n*barcodeModule,mm(6)).fill(ink);barX+=n*barcodeModule;});
  line(data.number,barcodeX,barcodeY+mm(6.5),barcodeWidth,6.5,false,'right');
  const top=mm(279),footerAddress=address(data.issuer).flatMap(v=>lines(v,mm(65),6.5));if(footerAddress.length>6)throw new BusinessPdfLayoutError('Firmenanschrift überschreitet die Formularfußzeile.');drawLines(footerAddress,left,top,mm(65),6.5,false,'left',8);
  const middle=[['Archiv',archiveNumber],['Vorlagenstand',String(BUSINESS_PDF_TEMPLATE_VERSION)],...(version?[['Vorgangsversion',version[1]]]:[])];middle.forEach(([k,v],j)=>line(k+': '+v,mm(96),top+j*9,mm(57),6.5));
  if(data.issuer.vatId){line('USt-IdNr.',mm(157),top,mm(33),6.5);line(data.issuer.vatId,mm(157),top+9,mm(33),7);}
  line(`Seite ${i+1} / ${pages.count}`,mm(157),mm(290),mm(33),7,false,'right');
  for(const field of pageFields.filter(f=>f.page===i))line(`${i+1} / ${pages.count}`,mm(180),field.y,mm(10),8,false,'right');doc.page.margins.bottom=margin;
 }
 doc.end();return result;
}
