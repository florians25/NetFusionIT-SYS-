import PDFDocument from 'pdfkit';
import path from 'node:path';
import bwipjs from 'bwip-js';
import {BusinessPdfLayoutError} from './business-pdf';
export interface WarehouseLabel{
 barcode:string;code:string;name:string;companyName:string;plantCode:string;locationCode:string;areaCode:string;rackCode:string;aisle:string;level:string;compartment:string;version:number;blocked:boolean;
}
// A physical 100 x 70 mm label. This is intentionally a label format; invoices
// and other commercial correspondence continue to use the DIN business form.
export async function renderWarehouseLabel(data:WarehouseLabel,archiveNumber:string):Promise<Buffer>{
 if(!/^LP-[0-9]{40}$/.test(data.barcode))throw new BusinessPdfLayoutError('Lagerplatzidentität ist für Code128 ungültig.');
 const symbol=bwipjs.raw({bcid:'code128',text:data.barcode})[0];if(!('sbs' in symbol))throw new BusinessPdfLayoutError('Lagerplatzbarcode konnte nicht erzeugt werden.');
 const mm=(v:number)=>v*72/25.4,margin=mm(6),width=mm(88),modules=symbol.sbs.reduce((v,n)=>v+n,0),module=width/(modules+20);
 if(module<.71)throw new BusinessPdfLayoutError('Lagerplatzbarcode unterschreitet die druckbare Modulbreite von 0,25 mm.');
 const doc=new PDFDocument({size:[mm(100),mm(70)],margins:{top:margin,left:margin,right:margin,bottom:mm(3)},info:{Title:'Lagerplatz '+data.code,Author:data.companyName,Subject:data.barcode,Creator:'NetFusion ERP / PDFKit',Keywords:archiveNumber}}),chunks:Buffer[]=[];
 const output=new Promise<Buffer>((resolve,reject)=>{doc.on('data',b=>chunks.push(b));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);});
 doc.registerFont('Label',path.resolve(__dirname,'../assets/fonts/DejaVuSans.ttf'));doc.registerFont('LabelBold',path.resolve(__dirname,'../assets/fonts/DejaVuSans-Bold.ttf'));
 doc.fillColor('#000000').font('Label').fontSize(7).text(data.companyName,margin,mm(4),{width,height:mm(7),ellipsis:true});
 doc.font('LabelBold').fontSize(9).text(data.blocked?'LAGERPLATZ · GESPERRT':'LAGERPLATZ',margin,mm(12),{width,lineBreak:false});
 let size=22;doc.fontSize(size);while(size>8&&doc.widthOfString(data.code)>width)doc.fontSize(--size);doc.text(data.code,margin,mm(18),{width,lineBreak:false});
 const hierarchy=[data.plantCode+' / '+data.locationCode,data.areaCode&&'Bereich '+data.areaCode,data.rackCode&&'Gang '+data.aisle+' · Regal '+data.rackCode,[data.level&&'Ebene '+data.level,data.compartment&&'Fach '+data.compartment].filter(Boolean).join(' · ')].filter(Boolean).join('\n');
 doc.font('Label').fontSize(8).text(hierarchy,margin,mm(29),{width,height:mm(15),ellipsis:true});
 doc.fontSize(7).text(data.name,margin,mm(45),{width,height:mm(6),ellipsis:true});
 let x=margin+10*module;symbol.sbs.forEach((n,index)=>{if(index%2===0)doc.rect(x,mm(53),n*module,mm(7)).fill('#000000');x+=n*module;});
 doc.font('Label').fontSize(6).text(data.barcode,margin,mm(61),{width,align:'center',lineBreak:false});
 doc.fontSize(5.5).text(archiveNumber+' · Platzversion '+data.version,margin,mm(64.5),{width,lineBreak:false});doc.end();return output;
}
