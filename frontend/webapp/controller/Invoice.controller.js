sap.ui.define(['netfusion/erp/controller/Base.controller','sap/m/library'],function(Base,mobileLibrary){
 'use strict';return Base.extend('netfusion.erp.controller.Invoice',{
  onInit:function(){this.model({invoice:{snapshot:{items:[],taxes:[],seller:{},buyer:{}}}});this.getOwnerComponent().getRouter().getRoute('invoice').attachPatternMatched(function(e){this.id=e.getParameter('arguments').id;this.load();},this);},
  load:async function(){if(!await this.guard('billingRead'))return;return this.run(async function(){var id=this.id,userId=this.state('/user/id'),r=await Promise.all([this.api('/api/billing/invoices/'+id),this.api('/api/documents/'+id+'/flow')]);if(this.id!==id||this.state('/user/id')!==userId)return;this.vm().setData({invoice:r[0],flow:this.documentFlow(r[1],r[0],'INVOICE')});});},
  onOutput:function(){this.run(async function(){await this.api('/api/billing/invoices/'+this.id+'/output',{method:'POST',body:{}});await this.load();});},
  onPdf:function(){mobileLibrary.URLHelper.redirect('/api/billing/invoices/'+this.id+'/pdf',true);},onXml:function(){mobileLibrary.URLHelper.redirect('/api/billing/invoices/'+this.id+'/xml',true);},
  onJournal:function(){this.route('journal',{id:this.vm().getProperty('/invoice/journalId')});}
 });
});
