sap.ui.define(['netfusion/erp/controller/Base.controller','netfusion/erp/util/FormDialog','netfusion/erp/util/ReturnWorkspace'],function(Base,form,returnWorkspace){
 'use strict';return Base.extend('netfusion.erp.controller.SalesDelivery',{
  onInit:function(){this.model({internal:false,document:{lines:[]},flow:[]});this.getOwnerComponent().getRouter().getRoute('salesDelivery').attachPatternMatched(function(e){this.id=e.getParameter('arguments').id;this.load();},this);},
  load:async function(){if(!await this.guard('salesFulfillment'))return;return this.run(async function(){var id=this.id,userId=this.state('/user/id'),result=await Promise.all([this.api('/api/sales/deliveries/'+id),this.api('/api/documents/'+id+'/flow')]);if(this.id!==id||this.state('/user/id')!==userId)return;this.vm().setData({document:result[0],flow:this.documentFlow(result[1],result[0],'GOODS_ISSUE'),internal:this.state('/access/internal')});});},
  onCreateReturn:function(){return returnWorkspace(this,false);},
  onBillingRequest:function(){this.route('billingSource',{id:this.vm().getProperty('/document/orderId')});},
  onOrder:function(){this.route('salesFulfillment',{id:this.vm().getProperty('/document/orderId')});},
  onReverse:function(){this.run(async function(){var d=this.vm().getProperty('/document'),c=await this.api('/api/sales/orders/'+d.orderId+'/fulfillment'),today=new Date().toLocaleDateString('sv-SE',{timeZone:'Europe/Berlin'});if(!c.periods.length)throw new Error('Offene Buchungsperiode für die Rücknahme erforderlich.');form(this,'Vertriebsauslieferung zurücknehmen',[{key:'periodId',label:'Buchungsperiode',type:'select',options:c.periods.map(function(p){return {key:p.id,text:p.year+' / '+p.period};})},{key:'postingDate',label:'Buchungsdatum',type:'date',value:today},{key:'documentDate',label:'Belegdatum',type:'date',value:today},{key:'reason',label:'Rücknahmegrund',type:'textarea',required:true}],async function(data,key){var result=await this.api('/api/inventory/issues/'+this.id+'/reverse',{method:'POST',key:key,body:data});this.route('salesDelivery',{id:result.id});});});},
  onJournal:function(){this.route('journal',{id:this.vm().getProperty('/document/journal/id')});},

 });
});
