sap.ui.define(['netfusion/erp/controller/Base.controller','netfusion/erp/util/FormDialog','sap/m/library'],function(Base,form,mobile){
 'use strict';return Base.extend('netfusion.erp.controller.CustomerCredit',{
  onInit:function(){this.model({snapshot:{items:[],taxes:[],seller:{},buyer:{}},lines:[],decisions:[]});this.getOwnerComponent().getRouter().getRoute('customerCredit').attachPatternMatched(function(e){this.id=e.getParameter('arguments').id;this.load();},this);},
  load:async function(){if(!await this.guard('billingCreditRead'))return;return this.run(async function(){var id=this.id,user=this.state('/user/id'),r=await Promise.all([this.api('/api/customer-credits/'+id),this.api('/api/documents/'+id+'/flow')]);if(this.id!==id||this.state('/user/id')!==user)return;r[0].flow=this.documentFlow(r[1],r[0],'CREDIT_NOTE');this.vm().setData(r[0]);});},
  onCancel:function(){var d=this.vm().getData();form(this,'Ungebuchten Gutschrift-Prüfstand verwerfen',[{key:'reason',label:'Begründung',type:'textarea',required:true}],function(data,key){data.version=d.version;return this.api('/api/customer-credits/'+this.id+'/cancel',{method:'POST',key:key,body:data});});},
  onPrepare:function(){var d=this.vm().getData(),periods=d.periods.filter(function(p){return p.status==='OPEN';});if(!periods.length)return this.run(function(){throw new Error('Keine offene Buchungsperiode vorhanden.');});form(this,'Gutschrift-Prüfstand vorbereiten',[{key:'periodId',label:'Buchungsperiode',type:'select',value:d.periodId,options:periods.map(function(p){return {key:p.id,text:p.year+' / '+p.period};})},{key:'postingDate',label:'Buchungsdatum',type:'date',value:d.postingDate,required:true},{key:'documentDate',label:'Gutschriftdatum',type:'date',value:d.documentDate,required:true},{key:'reason',label:'Grund der vollständigen Rechnungskorrektur',type:'textarea',value:d.reason,required:true}],function(data,key){data.version=d.version;return this.api('/api/customer-credits/'+this.id+'/prepare',{method:'POST',key:key,body:data});});},
  onSubmit:function(){this.run(async function(){await this.api('/api/workflow/submit/'+this.id,{method:'POST',key:crypto.randomUUID(),body:{version:this.vm().getProperty('/version')}});await this.load();});},
  onWithdraw:function(){var d=this.vm().getData();form(this,'Gutschriftfreigabe zurückziehen',[{key:'reason',label:'Begründung der Rücknahme',type:'textarea',required:true}],function(data,key){data.version=d.version;return this.api('/api/customer-credits/'+this.id+'/withdraw',{method:'POST',key:key,body:data});});},
  onPost:function(){this.run(async function(){await this.api('/api/customer-credits/'+this.id+'/post',{method:'POST',key:crypto.randomUUID(),body:{version:this.vm().getProperty('/version')}});await this.load();});},
  onOutput:function(){this.run(async function(){await this.api('/api/customer-credits/'+this.id+'/output',{method:'POST',body:{}});await this.load();});},
  onInvoice:function(){this.route('invoice',{id:this.vm().getProperty('/invoiceId')});},
  onOrder:function(){this.route('salesOrder',{id:this.vm().getProperty('/orderId')});},
  onOriginalJournal:function(){this.route('journal',{id:this.vm().getProperty('/sourceJournal/id')});},
  onCounterJournal:function(){this.route('journal',{id:this.vm().getProperty('/journal/id')});},
  onPdf:function(){mobile.URLHelper.redirect('/api/customer-credits/'+this.id+'/pdf',true);},
  onXml:function(){mobile.URLHelper.redirect('/api/customer-credits/'+this.id+'/xml',true);}
 });
});
