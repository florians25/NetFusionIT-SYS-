sap.ui.define(['netfusion/erp/controller/Base.controller','sap/m/library','netfusion/erp/util/FormDialog','netfusion/erp/util/CreditPreparation','netfusion/erp/util/SettlementPreparation'],function(Base,mobileLibrary,form,creditPreparation,settlementPreparation){
 'use strict';return Base.extend('netfusion.erp.controller.Invoice',{
  onInit:function(){this.model({invoice:{snapshot:{items:[],taxes:[],seller:{},buyer:{}}}});this.getOwnerComponent().getRouter().getRoute('invoice').attachPatternMatched(function(e){this.id=e.getParameter('arguments').id;this.load();},this);},
  load:async function(){if(!await this.guard('billingRead'))return;return this.run(async function(){var id=this.id,userId=this.state('/user/id'),r=await Promise.all([this.api('/api/billing/invoices/'+id),this.api('/api/documents/'+id+'/flow')]);if(this.id!==id||this.state('/user/id')!==userId)return;if(this.state('/access/settlements'))r[0].settlements=await this.api('/api/customer-settlements?invoiceId='+id);if(this.id!==id||this.state('/user/id')!==userId)return;this.vm().setData({invoice:r[0],flow:this.documentFlow(r[1],r[0],'INVOICE')});});},
  onReceipt:function(){return settlementPreparation(this,'RECEIPT');},onRefund:function(){return settlementPreparation(this,'REFUND');},onSettlement:function(e){this.route('customerSettlement',{id:e.getSource().getBindingContext('view').getProperty('id')});},
  onCreatePriceCredit:function(){return creditPreparation(this,'PRICE');},
  onCreateResidualCredit:function(){this.onCreateCredit(true);},
  onCreateQuantityCredit:function(){return creditPreparation(this,true);},
  onCreateSelectedCredit:function(){creditPreparation(this);},
  onCreditRow:function(e){var id=e.getSource().getBindingContext('view').getProperty('id');this.route('customerCredit',{id:id});},
  onCreditRowPdf:function(e){var id=e.getSource().getBindingContext('view').getProperty('id');mobileLibrary.URLHelper.redirect('/api/customer-credits/'+id+'/pdf',true);},
  onCreateCredit:function(residual){residual=residual===true;var d=this.vm().getProperty('/invoice'),periods=d.periods||[],today=new Date().toLocaleDateString('sv-SE',{timeZone:'Europe/Berlin'});if(!periods.length)return this.run(function(){throw new Error('Offene Buchungsperiode für die Gutschrift erforderlich.');});form(this,residual?'Verbleibenden Rechnungswert gutschreiben':'Vollständige Rechnungskorrektur vorbereiten',[{key:'periodId',label:'Buchungsperiode',type:'select',options:periods.map(function(p){return {key:p.id,text:p.year+' / '+p.period};})},{key:'postingDate',label:'Buchungsdatum',type:'date',value:today,required:true},{key:'documentDate',label:'Gutschriftdatum',type:'date',value:today,required:true},{key:'reason',label:'Grund der vollständigen Rechnungskorrektur',type:'textarea',required:true}],async function(data,key){data.version=d.version;if(residual)data.residual=true;var r=await this.api('/api/customer-credits/invoices/'+this.id,{method:'POST',key:key,body:data});this.route('customerCredit',{id:r.id});});},
  onCredit:function(){this.route('customerCredit',{id:this.vm().getProperty('/invoice/creditRequest/id')||this.vm().getProperty('/invoice/creditId')});},
  onCreditPdf:function(){mobileLibrary.URLHelper.redirect('/api/customer-credits/'+this.vm().getProperty('/invoice/creditId')+'/pdf',true);},
  onCreditXml:function(){mobileLibrary.URLHelper.redirect('/api/customer-credits/'+this.vm().getProperty('/invoice/creditId')+'/xml',true);},
  onOutput:function(){this.run(async function(){await this.api('/api/billing/invoices/'+this.id+'/output',{method:'POST',body:{}});await this.load();});},
  onPdf:function(){mobileLibrary.URLHelper.redirect('/api/billing/invoices/'+this.id+'/pdf',true);},onXml:function(){mobileLibrary.URLHelper.redirect('/api/billing/invoices/'+this.id+'/xml',true);},
  onJournal:function(){this.route('journal',{id:this.vm().getProperty('/invoice/journalId')});}
 });
});
