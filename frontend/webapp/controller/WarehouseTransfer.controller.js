sap.ui.define(['netfusion/erp/controller/Base.controller','netfusion/erp/util/FormDialog'],function(Base,form){
 'use strict';return Base.extend('netfusion.erp.controller.WarehouseTransfer',{
  onInit:function(){this.model({document:{items:[]}});this.getOwnerComponent().getRouter().getRoute('warehouseTransfer').attachPatternMatched(function(e){this.id=e.getParameter('arguments').id;this.load();},this);},
  load:async function(){if(!await this.guard('inventory'))return;return this.run(async function(){var id=this.id,d=await this.api('/api/warehouse/transfers/'+id);if(this.id!==id)return;this.vm().setData({document:d,canReverse:d.canReverse&&this.state('/access/inventoryWrite')});});},
  onReverse:function(){form(this,this.vm().getProperty('/document/destinationLocationId')?'Umlagerung zurücknehmen':'Platzwechsel zurücknehmen',[{key:'reason',label:'Rücknahmegrund',type:'textarea',required:true}],async function(data,key){var r=await this.api('/api/warehouse/transfers/'+this.id+'/reverse',{method:'POST',key:key,body:data});this.route('warehouseTransfer',{id:r.id});});},
  onOriginal:function(){this.route('warehouseTransfer',{id:this.vm().getProperty('/document/reversesId')});},onReversal:function(){this.route('warehouseTransfer',{id:this.vm().getProperty('/document/reversal/id')});}
 });
});
