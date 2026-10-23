sap.ui.define(['netfusion/erp/controller/Base.controller','sap/ui/model/Filter','sap/ui/model/FilterOperator'],function(Base,Filter,Op){
 'use strict';return Base.extend('netfusion.erp.controller.CustomerCredits',{
  onInit:function(){this.model({rows:[],summary:{total:0,draft:0,review:0,posted:0}});this.getOwnerComponent().getRouter().getRoute('customerCredits').attachPatternMatched(this.load,this);},
  load:async function(){if(!await this.guard('billingCreditRead'))return;return this.run(async function(){var user=this.state('/user/id'),rows=await this.api('/api/customer-credits');if(user!==this.state('/user/id'))return;this.vm().setData({rows:rows,summary:{total:rows.length,draft:rows.filter(function(r){return ['DRAFT','REJECTED'].includes(r.status);}).length,review:rows.filter(function(r){return ['IN_REVIEW','APPROVED'].includes(r.status);}).length,posted:rows.filter(function(r){return r.status==='POSTED';}).length}});this.onFilter();});},
  onOpen:function(e){this.route('customerCredit',{id:e.getSource().getBindingContext('view').getProperty('id')});},
  onFilter:function(){var search=this.byId('creditSearch').getValue().trim(),status=this.byId('creditStatus').getSelectedKey(),filters=[];if(search)filters.push(new Filter({filters:['number','invoiceNumber','partnerName','orderNumber'].map(function(k){return new Filter(k,Op.Contains,search);}),and:false}));if(status)filters.push(new Filter('status',Op.EQ,status));this.byId('creditList').getBinding('items').filter(filters);}
 });
});
