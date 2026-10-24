sap.ui.define(['netfusion/erp/controller/Base.controller'],function(Base){'use strict';return Base.extend('netfusion.erp.controller.ReturnInspection',{
 onInit:function(){this.model({flow:[]});this.getOwnerComponent().getRouter().getRoute('returnInspection').attachPatternMatched(function(e){this.id=e.getParameter('arguments').id;this.load();},this);},
 load:async function(){if(!await this.guard('customerReturns'))return;return this.run(async function(){var id=this.id,user=this.state('/user/id'),r=await Promise.all([this.api('/api/return-inspection/records/'+id),this.api('/api/documents/'+id+'/flow')]);if(this.id!==id||this.state('/user/id')!==user)return;this.vm().setData(Object.assign(r[0],{flow:this.documentFlow(r[1],r[0],r[0].kind)}));});},
 onReturn:function(){this.route('customerReturn',{id:this.vm().getProperty('/return_id')});}
});});
