sap.ui.define(['netfusion/erp/controller/Base.controller'],function(Base){'use strict';return Base.extend('netfusion.erp.controller.CustomerSettlements',{
 onInit:function(){this.model({rows:[],summary:{}});this.getOwnerComponent().getRouter().getRoute('customerSettlements').attachPatternMatched(this.load,this);},
 load:async function(){if(!await this.guard('settlements'))return;this.run(async function(){var user=this.state('/user/id'),r=await this.api('/api/customer-settlements');if(user!==this.state('/user/id'))return;this.vm().setData({rows:r,summary:{total:r.length,draft:r.filter(function(x){return x.status==='DRAFT';}).length,approved:r.filter(function(x){return x.status==='APPROVED';}).length,posted:r.filter(function(x){return x.status==='POSTED';}).length}});});},
 onOpen:function(e){this.route('customerSettlement',{id:e.getSource().getBindingContext('view').getProperty('id')});}
});});
