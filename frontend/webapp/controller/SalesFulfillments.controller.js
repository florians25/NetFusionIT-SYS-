sap.ui.define(['netfusion/erp/controller/Base.controller'],function(Base){
 'use strict';return Base.extend('netfusion.erp.controller.SalesFulfillments',{
  onInit:function(){this.model({orders:[],filtered:[],query:'',from:'',to:'',onlyStarted:false,summary:{total:0,started:0}});this.getOwnerComponent().getRouter().getRoute('salesFulfillments').attachPatternMatched(this.load,this);},
  load:async function(){if(!await this.guard('salesFulfillment'))return;return this.run(async function(){this.vm().setProperty('/orders',await this.api('/api/sales/fulfillment'));this.onFilter();});},
  onFilter:function(){var m=this.vm(),query=(m.getProperty('/query')||'').toLocaleLowerCase('de-DE'),from=m.getProperty('/from'),to=m.getProperty('/to'),started=m.getProperty('/onlyStarted'),rows=m.getProperty('/orders').filter(function(o){return (!query||[o.number,o.title,o.partnerName,o.customerReference].join(' ').toLocaleLowerCase('de-DE').includes(query))&&(!from||o.requestedOn>=from)&&(!to||o.requestedOn<=to)&&(!started||o.hasDelivery);});m.setProperty('/filtered',rows);m.setProperty('/summary',{total:rows.length,started:rows.filter(function(o){return o.hasDelivery;}).length});},
  onOpen:function(e){this.route('salesFulfillment',{id:(e.getParameter('listItem')||e.getSource()).getBindingContext('view').getProperty('id')});}
 });
});
