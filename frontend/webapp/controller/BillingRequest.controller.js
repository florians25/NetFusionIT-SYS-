sap.ui.define(['netfusion/erp/controller/Base.controller','netfusion/erp/util/FormDialog'],function(Base,form){
 'use strict';return Base.extend('netfusion.erp.controller.BillingRequest',{
  onInit:function(){this.model({request:{lines:[]}});this.getOwnerComponent().getRouter().getRoute('billingRequest').attachPatternMatched(function(e){this.id=e.getParameter('arguments').id;this.load();},this);},
  load:async function(){if(!await this.guard('billingInternal'))return;return this.run(async function(){this.vm().setProperty('/request',await this.api('/api/billing/requests/'+this.id));});},
  onSubmit:function(){this.run(async function(){await this.api('/api/workflow/submit/'+this.id,{method:'POST',key:crypto.randomUUID(),body:{version:this.vm().getProperty('/request/version')}});await this.load();});},
  onCancel:function(){form(this,'Fakturaanforderung zurücknehmen',[{key:'reason',label:'Begründung',type:'textarea',required:true}],async function(data,key){data.version=this.vm().getProperty('/request/version');await this.api('/api/billing/requests/'+this.id+'/cancel',{method:'POST',key:key,body:data});});},
  onOrder:function(){this.route('order',{id:this.vm().getProperty('/request/order_id')});}
 });
});
