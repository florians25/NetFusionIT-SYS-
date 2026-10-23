sap.ui.define(['netfusion/erp/controller/Base.controller','netfusion/erp/util/FormDialog'],function(Base,form){
 'use strict';return Base.extend('netfusion.erp.controller.WarehouseTransfer',{
  onInit:function(){this.model({document:{items:[]}});this.getOwnerComponent().getRouter().getRoute('warehouseTransfer').attachPatternMatched(function(e){this.id=e.getParameter('arguments').id;this.load();},this);},
  load:async function(){if(!await this.guard('inventory'))return;return this.run(async function(){var id=this.id,userId=this.state('/user/id'),r=await Promise.all([this.api('/api/warehouse/transfers/'+id),this.api('/api/documents/'+id+'/flow')]),d=r[0];if(this.id!==id||this.state('/user/id')!==userId)return;this.vm().setData({document:d,flow:this.documentFlow(r[1],d,'STOCK_TRANSFER'),canReverse:d.canReverse&&this.state('/access/inventoryWrite')});});},
  onReverse:function(){form(this,this.vm().getProperty('/document/destinationLocationId')?'Umlagerung zurücknehmen':'Platzwechsel zurücknehmen',[{key:'reason',label:'Rücknahmegrund',type:'textarea',required:true}],async function(data,key){var r=await this.api('/api/warehouse/transfers/'+this.id+'/reverse',{method:'POST',key:key,body:data});this.route('warehouseTransfer',{id:r.id});});},
  onOriginal:function(){this.route('warehouseTransfer',{id:this.vm().getProperty('/document/reversesId')});},onReversal:function(){this.route('warehouseTransfer',{id:this.vm().getProperty('/document/reversal/id')});}
 });
});
