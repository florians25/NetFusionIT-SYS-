sap.ui.define(["netfusion/erp/controller/Base.controller","netfusion/erp/util/FormDialog"],function(Base,form){
 "use strict";
 return Base.extend("netfusion.erp.controller.Report",{
  onInit:function(){this.model({report:{lines:[]},flow:[]});this.getOwnerComponent().getRouter().getRoute("report").attachPatternMatched(function(e){this.id=e.getParameter("arguments").id;this.load();},this);},
  load:async function(){if(!await this.guard("orders"))return;this.run(async function(){var id=this.id,userId=this.state("/user/id"),r=await Promise.all([this.api("/api/service/reports/"+id),this.api("/api/documents/"+id+"/flow")]);if(this.id!==id||this.state("/user/id")!==userId)return;this.vm().setData({report:r[0],flow:r[1]});});},
  onMaterialSource:function(e){this.route('goodsIssue',{id:e.getSource().getBindingContext('view').getProperty('snapshot/issueId')});},
  onTicket:function(){this.route("ticket",{id:this.vm().getProperty("/report/ticketId")});},
  onOrder:function(){this.route("order",{id:this.vm().getProperty("/report/orderId")});},
  onSubmit:function(){this.run(async function(){await this.api("/api/workflow/submit/"+this.id,{method:"POST",key:crypto.randomUUID(),body:{version:this.vm().getProperty("/report/version")}});this.load();});},
  onConfirm:function(){form(this,"Leistung bestätigen",[{key:"comment",label:"Kundenbestätigung",type:"textarea",required:true}],async function(data,key){data.version=this.vm().getProperty("/report/version");await this.api("/api/service/reports/"+this.id+"/confirm",{method:"POST",key:key,body:data});});},
  onCancel:function(){form(this,"Nachweisentwurf verwerfen",[{key:"reason",label:"Begründung",type:"textarea",required:true}],async function(data,key){data.version=this.vm().getProperty("/report/version");await this.api("/api/service/reports/"+this.id+"/cancel",{method:"POST",key:key,body:data});});}
 });
});
