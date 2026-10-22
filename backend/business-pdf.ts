import PDFDocument from 'pdfkit';
import path from 'node:path';
export interface BusinessPdf {
 title:string;number:string;sourceNumber:string;status:string;date:string;
 issuer:{name:string;street?:string;postalCode?:string;city?:string;country?:string;vatId?:string};
 recipient?:{name:string;street?:string;postalCode?:string;city?:string;country?:string};
 fields:[string,string][];columns:{title:string;width:number;align?:'left'|'right'}[];rows:string[][];
 totals?:[string,string][];paragraphs?:[string,string][];notice?:string;
}
// DIN 5008 Form B: dimensions in mm, then converted to PDF points.
export const BUSINESS_PDF_TEMPLATE_VERSION=2;
export class BusinessPdfLayoutError extends Error {}
export async function renderBusinessPdf(data:BusinessPdf,archiveNumber:string):Promise<Buffer>{
 const mm=(v:number)=>v*72/25.4,left=mm(25),width=mm(165),bottom=mm(268),ink='#203344',rule='#bec6cc';
 const doc=new PDFDocument({size:'A4',margins:{top:mm(15),left,right:mm(20),bottom:mm(29)},bufferPages:true,info:{Title:data.title+' '+data.number,Author:data.issuer.name,Subject:data.sourceNumber,Creator:'NetFusion ERP / PDFKit',Keywords:archiveNumber}});
 const normal=path.resolve(__dirname,'../assets/fonts/DejaVuSans.ttf'),bold=path.resolve(__dirname,'../assets/fonts/DejaVuSans-Bold.ttf');
 doc.registerFont('Business',normal);doc.registerFont('BusinessBold',bold);doc.font('Business');
 const chunks:Buffer[]=[];const result=new Promise<Buffer>((resolve,reject)=>{doc.on('data',c=>chunks.push(c));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);});
 let y=0;
 function font(size:number,strong=false){doc.font(strong?'BusinessBold':'Business').fontSize(size).fillColor(ink);}
 function line(value:string,x:number,top:number,w:number,size=9,strong=false,align:'left'|'right'='left'){
  font(size,strong);doc.text(value,x,top,{width:w,lineBreak:false,align});
 }
 function lines(value:string,w:number,size=9,strong=false){
  font(size,strong);const out:string[]=[];let current='';
  // Word wrapping also preserves long serial numbers and unbroken identifiers.
  for(const paragraph of value.split('\n')){current='';for(const character of paragraph){if(current&&doc.widthOfString(current+character)>w){const space=current.lastIndexOf(' ');if(space>current.length/2){out.push(current.slice(0,space));current=current.slice(space+1);}else{out.push(current);current='';}}current+=character;}out.push(current);}
  return out;
 }
 function drawLines(values:string[],x:number,top:number,w:number,size=9,strong=false,align:'left'|'right'='left',pitch=12){values.forEach((v,i)=>line(v,x,top+i*pitch,w,size,strong,align));}
 function stroke(x:number,top:number,w:number,color=rule){doc.moveTo(x,top).lineTo(x+w,top).lineWidth(.5).strokeColor(color).stroke();}
 function continuation(){doc.addPage();line(data.issuer.name,left,mm(15),width*.62,10,true);line(data.number,left+width*.63,mm(15),width*.37,10,true,'right');line(data.title+' · Fortsetzung',left,mm(23),width,9);stroke(left,mm(31),width);y=mm(38);}
 function page(height:number){if(y+height>bottom)continuation();}
 const address=(a:NonNullable<BusinessPdf['recipient']>)=>[a.name,a.street,[a.postalCode,a.city].filter(Boolean).join(' '),a.country].filter(Boolean) as string[];
 const issuerAddress=[data.issuer.street,[data.issuer.postalCode,data.issuer.city].filter(Boolean).join(' '),data.issuer.country].filter(Boolean).join(' · ');
 // Letterhead stays above the 45 mm return-address strip.
 const issuerLines=lines(data.issuer.name,width,16,true);if(issuerLines.length>3)throw new BusinessPdfLayoutError('Firmenname überschreitet den Briefkopf.');
 drawLines(issuerLines,left,mm(13),width,16,true,'left',19);stroke(left,mm(38),width,ink);
 // Form-B folding and punching aids remain outside the text area.
 for(const mark of [105,148.5,210])stroke(mm(5),mm(mark),mm(mark===148.5?3:5));
 const sender=data.issuer.name+(issuerAddress?' · '+issuerAddress:''),senderLines=lines(sender,mm(85),6.5);if(senderLines.length>2)throw new BusinessPdfLayoutError('Absenderangabe überschreitet das DIN-Anschriftfeld.');
 drawLines(senderLines,mm(20),mm(45),mm(85),6.5,false,'left',7);
 if(data.recipient){const recipientLines=address(data.recipient).flatMap(v=>lines(v,mm(85),10));if(recipientLines.length>6)throw new BusinessPdfLayoutError('Empfängeranschrift überschreitet sechs Zeilen im DIN-Anschriftfeld.');drawLines(recipientLines,mm(20),mm(62.7),mm(85),10,false,'left',mm(4.23));}
 // Information block right of the window address; no invented SAP logo.
 const infoX=mm(125),infoW=mm(65),labelW=mm(23);let infoY=mm(50);
 const date=/^\d{4}-\d{2}-\d{2}$/.test(data.date)?data.date.slice(8,10)+'.'+data.date.slice(5,7)+'.'+data.date.slice(0,4):data.date;
 for(const [label,value] of [['Belegnummer',data.number],['Belegdatum',date],['Ursprung',data.sourceNumber],['Status',data.status]]){
  const valueLines=lines(value,infoW-labelW,8.5,label==='Belegnummer');line(label,infoX,infoY,labelW-4,8);drawLines(valueLines,infoX+labelW,infoY,infoW-labelW,8.5,label==='Belegnummer','left',11);infoY+=Math.max(1,valueLines.length)*11+7;
 }
 y=Math.max(mm(98.5),infoY+mm(8));const subject=lines(data.title,width,12,true);drawLines(subject,left,y,width,12,true,'left',16);y+=subject.length*16+mm(5);
 // Compact business references in two columns.
 for(let i=0;i<data.fields.length;i+=2){const pair=data.fields.slice(i,i+2).map(([k,v])=>({k,values:lines(v||'–',width/2-mm(7),10)}));const h=Math.max(...pair.map(p=>p.values.length))*14+19;page(h);pair.forEach((p,j)=>{const x=left+j*(width/2);line(p.k,x,y,width/2-mm(7),8,true);drawLines(p.values,x,y+13,width/2-mm(7),10,false,'left',14);});y+=h;}
 if(data.fields.length)y+=8;
 if(data.notice){for(const v of lines(data.notice,width,10)){page(14);line(v,left,y,width,10);y+=14;}y+=12;}
 if(data.columns.length){
  const sum=data.columns.reduce((v,c)=>v+c.width,0),colWidths=data.columns.map(c=>c.width/sum*width),pitch=11,pad=4;
  const alignment=(i:number):'left'|'right'=>data.columns[i].align||(/Menge|Istmenge|Netto|Brutto|Preis|Wert|Betrag/i.test(data.columns[i].title)?'right':'left');
  function cells(values:string[],heading=false){return data.columns.map((_,i)=>{let value=values[i]||'–';if(/^\d{4}-\d{2}-\d{2}$/.test(value))value=value.slice(8,10)+'.'+value.slice(5,7)+'.'+value.slice(0,4);return lines(value,colWidths[i]-pad*2,8,heading);});}
  function draw(values:string[][],height:number,heading=false){
   if(heading)doc.rect(left,y,width,height).fill('#e8ecef');let x=left;
   values.forEach((v,i)=>{drawLines(v,x+pad,y+pad,colWidths[i]-pad*2,8,heading,alignment(i),pitch);if(i)doc.moveTo(x,y).lineTo(x,y+height).lineWidth(.3).strokeColor('#dce1e5').stroke();x+=colWidths[i];});stroke(left,y+height,width);y+=height;
  }
  const header=cells(data.columns.map(c=>c.title),true),headerHeight=Math.max(...header.map(c=>c.length))*pitch+pad*2;
  page(headerHeight+pitch+pad*2);draw(header,headerHeight,true);
  for(const values of data.rows){const wrapped=cells(values),count=Math.max(...wrapped.map(c=>c.length));let offset=0;
   while(offset<count){let capacity=Math.floor((bottom-y-pad*2)/pitch);if(capacity<1){continuation();draw(header,headerHeight,true);capacity=Math.floor((bottom-y-pad*2)/pitch);}const take=Math.min(capacity,count-offset);draw(wrapped.map(c=>c.slice(offset,offset+take)),take*pitch+pad*2);offset+=take;}
  }y+=14;
 }
 for(let i=0;i<(data.totals||[]).length;i++){const [label,value]=data.totals![i],last=i===data.totals!.length-1,w=width*.65,x=left+width-w;const labels=lines(label,w*.52,9,last),values=lines(value,w*.45,10,last),h=Math.max(labels.length,values.length)*13+12;page(h);if(last)stroke(x,y-3,w,ink);drawLines(labels,x,y,w*.52,9,last);drawLines(values,x+w*.55,y,w*.45,10,last,'right',13);y+=h;}
 for(const [title,value] of data.paragraphs||[]){page(36);line(title,left,y,width,10,true);y+=20;for(const v of lines(value,width,10)){page(14);line(v,left,y,width,10);y+=14;}y+=12;}
 const pages=doc.bufferedPageRange();for(let i=pages.start;i<pages.start+pages.count;i++){
  doc.switchToPage(i);const margin=doc.page.margins.bottom;doc.page.margins.bottom=0;
  stroke(left,mm(278),width);line(data.issuer.name,left,mm(280),width,7,true);line([issuerAddress,data.issuer.vatId?'USt-IdNr. '+data.issuer.vatId:''].filter(Boolean).join(' · '),left,mm(284),width,6.5);
  line(archiveNumber+' · Vorlagenstand '+BUSINESS_PDF_TEMPLATE_VERSION,left,mm(290),width*.7,7);line(`Seite ${i+1} / ${pages.count}`,left+width*.7,mm(290),width*.3,7,false,'right');doc.page.margins.bottom=margin;
 }
 doc.end();return result;
}
