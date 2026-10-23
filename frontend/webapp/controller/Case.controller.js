sap.ui.define(["netfusion/erp/controller/Base.controller"],function(Base){"use strict";return Base.extend("netfusion.erp.controller.Case",{
 onInit:function(){this.model({serviceCase:{tickets:[]},orders:[],flow:[]});this.getOwnerComponent().getRouter().getRoute('case').attachPatternMatched(function(e){this.id=e.getParameter('arguments').id;this.load();},this);},
 load:async function(){if(!await this.guard('service'))return;return this.run(async function(){var id=this.id,r=await Promise.all([this.api('/api/cases/'+id),this.api('/api/service/orders'),this.api('/api/documents/'+id+'/flow')]);if(this.id!==id)return;var orders=r[1].filter(function(o){return o.caseId===id;});this.vm().setData({serviceCase:r[0],orders:orders,flow:this.documentFlow(r[2],r[0],'SERVICE_CASE'),summary:{tickets:r[0].tickets.length,orders:orders.length,relations:r[2].length}});});},
 onOrder:function(e){this.route('order',{id:e.getParameter('listItem').getBindingContext('view').getProperty('id')});},

});});
