sap.ui.define(["netfusion/erp/util/DocumentDialog"],function(documentDialog){
 "use strict";return function(controller,poId){return controller.run(async function(){
  var c=await this.api('/api/procurement/documents/'+poId+'/receiving-context');
  if(!c.periods.length)throw new Error('Zuerst eine offene Buchungsperiode konfigurieren.');if(!c.locations.length)throw new Error('Zuerst Werk und Lagerort für diesen Buchungskreis anlegen.');
  var items=c.items.filter(function(i){return i.kind==='STOCK'&&Number(i.maximumRemainingQuantity)>0;});if(!items.length)throw new Error('Keine offene Lagerartikelmenge in dieser Bestellung.');
  if(items.some(function(i){return !i.configured;}))throw new Error('Zuerst Bewertungsverfahren und Serien-/Chargenführung im Lagerarbeitsplatz konfigurieren.');
  documentDialog(this,{title:'Wareneingang · '+c.number,header:{periodId:c.periods[0].id,postingDate:'',documentDate:'',deliveryNote:''},fields:[{key:'periodId',label:'Buchungsperiode',type:'select',options:c.periods.map(function(p){return {key:p.id,text:p.year+' / '+p.period};})},{key:'postingDate',label:'Buchungsdatum',type:'date',required:true},{key:'documentDate',label:'Belegdatum',type:'date',required:true},{key:'deliveryNote',label:'Lieferscheinnummer',required:true}],
   rows:items.map(function(i){return {purchaseOrderItemId:i.id,description:i.position+' · '+i.description,quantity:i.serialRequired?'1':Number(i.remainingQuantity)>0?i.remainingQuantity:i.maximumRemainingQuantity,unit:i.unit,locationId:c.locations[0].id,batch:'',serial:'',serialRequired:i.serialRequired};}),
   columns:[{key:'description',label:'Bestellposition',readonly:true},{key:'quantity',label:'Eingangsmenge',type:'decimal'},{key:'unit',label:'Einheit',readonly:true},{key:'locationId',label:'Lagerort',type:'select',options:c.locations.map(function(l){return {key:l.id,text:l.plantCode+' / '+l.code+' · '+l.name};}),popin:true},{key:'batch',label:'Charge',popin:true},{key:'serial',label:'Seriennummer',popin:true}],
   duplicateRow:function(r){return Object.assign({},r,{quantity:r.serialRequired?'1':r.quantity,serial:''});},
   payload:function(header,rows){return Object.assign({},header,{version:c.version,items:rows.map(function(r){return {purchaseOrderItemId:r.purchaseOrderItemId,locationId:r.locationId,quantity:r.quantity,batch:r.batch,serial:r.serial};})});},
   saveText:'Wareneingang buchen',save:async function(data,key){return this.api('/api/procurement/documents/'+poId+'/receipts',{method:'POST',key:key,body:data});},saved:function(r){this.route('goodsReceipt',{id:r.id});}
  });
 });};
});
