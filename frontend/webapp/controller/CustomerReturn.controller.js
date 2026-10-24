sap.ui.define(['netfusion/erp/controller/Base.controller','netfusion/erp/util/FormDialog','netfusion/erp/util/ReturnWorkspace','netfusion/erp/util/InspectionWorkspace'],function(Base,form,returnWorkspace,inspectionWorkspace){'use strict';return Base.extend('netfusion.erp.controller.CustomerReturn',{
 onInit:function(){this.model({items:[],receipts:[],flow:[]});this.getOwnerComponent().getRouter().getRoute('customerReturn').attachPatternMatched(function(e){this.id=e.getParameter('arguments').id;this.load();},this);},
 load:async function(){if(!await this.guard('customerReturns'))return;return this.run(async function(){var id=this.id,user=this.state('/user/id'),r=await Promise.all([this.api('/api/customer-returns/'+id),this.api('/api/documents/'+id+'/flow'),this.api('/api/return-inspection/returns/'+id)]);if(this.id!==id||this.state('/user/id')!==user)return;this.vm().setData(Object.assign(r[0],{custody:r[2],flow:this.documentFlow(r[1],r[0],'CUSTOMER_RETURN')}));});},
 onArrival:function(){return inspectionWorkspace(this,'arrival');},
 onInspect:function(e){return inspectionWorkspace(this,'inspect',e.getSource().getBindingContext('view').getObject());},
 onCustodyRelease:function(e){return inspectionWorkspace(this,'release',e.getSource().getBindingContext('view').getObject());},
 onDispatch:function(e){return inspectionWorkspace(this,'dispatch',e.getSource().getBindingContext('view').getObject());},
 onReverseCustody:function(e){return inspectionWorkspace(this,'reverse-custody',e.getSource().getBindingContext('view').getObject());},
 onReverseInspection:function(e){return inspectionWorkspace(this,'reverse-inspection',e.getSource().getBindingContext('view').getObject());},
 onCustodyRecord:function(e){this.route('returnInspection',{id:e.getSource().getBindingContext('view').getProperty('id')});},
 onReceive:function(){return returnWorkspace(this,true);},
 onRelease:function(){this.transition('release','Retourenanmeldung freigeben');},onCancel:function(){this.transition('cancel','Retourenanmeldung verwerfen');},
 transition:function(action,title){var d=this.vm().getData(),id=this.id;form(this,title,[{key:'reason',label:'Begründung',type:'textarea',required:true}],async function(body,key){body.version=d.version;await this.api('/api/customer-returns/'+id+'/'+action,{method:'POST',key:key,body:body});await this.load();});},
 onReceipt:function(e){this.route('customerReturnReceipt',{id:e.getSource().getBindingContext('view').getProperty('id')});},onDelivery:function(){this.route('salesDelivery',{id:this.vm().getProperty('/issue_id')});},onOrder:function(){this.route('salesFulfillment',{id:this.vm().getProperty('/sales_order_id')});}
});});
