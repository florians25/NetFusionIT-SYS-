sap.ui.define(['netfusion/erp/controller/Base.controller','sap/m/library'],function(Base,mobileLibrary){
 'use strict';return Base.extend('netfusion.erp.controller.Invoice',{
  onInit:function(){this.model({invoice:{snapshot:{items:[],taxes:[],seller:{},buyer:{}}}});this.getOwnerComponent().getRouter().getRoute('invoice').attachPatternMatched(function(e){this.id=e.getParameter('arguments').id;this.load();},this);},
  load:async function(){if(!await this.guard('billingRead'))return;return this.run(async function(){this.vm().setProperty('/invoice',await this.api('/api/billing/invoices/'+this.id));});},
  onOutput:function(){this.run(async function(){await this.api('/api/billing/invoices/'+this.id+'/output',{method:'POST',body:{}});await this.load();});},
  onPdf:function(){mobileLibrary.URLHelper.redirect('/api/billing/invoices/'+this.id+'/pdf',true);},onXml:function(){mobileLibrary.URLHelper.redirect('/api/billing/invoices/'+this.id+'/xml',true);},
  onJournal:function(){this.route('journal',{id:this.vm().getProperty('/invoice/journalId')});}
 });
});
