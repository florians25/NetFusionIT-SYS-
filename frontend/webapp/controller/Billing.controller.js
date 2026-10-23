sap.ui.define(['netfusion/erp/controller/Base.controller','netfusion/erp/util/FormDialog','sap/ui/core/format/NumberFormat'],function(Base,form,NumberFormat){
 'use strict';var decimal=NumberFormat.getFloatInstance({parseAsString:true,maxFractionDigits:6});
 return Base.extend('netfusion.erp.controller.Billing',{
  onInit:function(){this.model({requests:[],due:[],invoices:[]});this.getOwnerComponent().getRouter().getRoute('billing').attachPatternMatched(this.load,this);},
  load:async function(){if(!await this.guard('billingInternal'))return this;return this.run(async function(){var data=await this.api('/api/billing/worklist');data.due.forEach(function(l){l.invoiceQuantity=decimal.format(l.remainingQuantity);});this.vm().setData(data);});},
  onRequest:function(e){this.route('billingRequest',{id:e.getParameter('listItem').getBindingContext('view').getProperty('id')});},
  onInvoice:function(e){this.route('invoice',{id:e.getParameter('listItem').getBindingContext('view').getProperty('id')});},
  onOrder:function(e){var row=e.getSource().getBindingContext('view').getObject();this.onDocument(row.orderKind,row.orderId);},
  onPost:function(){this.run(async function(){
   var selected=this.byId('billingDue').getSelectedItems().map(function(row){return row.getBindingContext('view').getObject();});if(!selected.length)throw new Error('Mindestens eine freigegebene Anforderungsposition auswählen.');if(selected.some(function(l){return l.orderId!==selected[0].orderId;}))throw new Error('Für diese Teilfaktura Positionen eines gemeinsamen Kunden- oder Serviceauftrags auswählen.');
   var context=await this.api('/api/billing/companies/'+selected[0].companyId+'/context'),periods=context.periods.filter(function(p){return p.status==='OPEN';});if(!periods.length)throw new Error('Keine offene Buchungsperiode vorhanden.');
   var now=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin'}).format(new Date()),dialog=form(this,'Rechnung verbindlich buchen',[
    {key:'periodId',label:'Buchungsperiode',type:'select',options:periods.map(function(p){return {key:p.id,text:p.year+' / '+p.period+' · '+this.formatter.servicePeriod(p.dateFrom,p.dateTo)};},this)},
    {key:'invoiceDate',label:'Rechnungsdatum',type:'date',required:true,value:now},{key:'postingDate',label:'Buchungsdatum',type:'date',required:true,value:now},{key:'buyerReference',label:'Kundenbestellreferenz'}
   ],async function(data,key){data.orderId=selected[0].orderId;data.lines=selected.map(function(l){return {requestLineId:l.id,quantity:decimal.parse(l.invoiceQuantity)};});var invoice=await this.api('/api/billing/invoices',{method:'POST',key:key,body:data});this.route('invoice',{id:invoice.id});});dialog.dialog.getBeginButton().setText('Rechnung buchen');
  });}
 });
});
