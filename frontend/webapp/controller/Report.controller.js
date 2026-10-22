sap.ui.define(["netfusion/erp/controller/Base.controller","netfusion/erp/util/FormDialog"],function(Base,form){
 "use strict";
 return Base.extend("netfusion.erp.controller.Report",{
  onInit:function(){this.model({report:{lines:[]},flow:[]});this.getOwnerComponent().getRouter().getRoute("report").attachPatternMatched(function(e){this.id=e.getParameter("arguments").id;this.load();},this);},
  load:async function(){if(!await this.guard("orders"))return;this.run(async function(){this.vm().setData({report:await this.api("/api/service/reports/"+this.id),flow:await this.api("/api/documents/"+this.id+"/flow")});});},
  onTicket:function(){this.route("ticket",{id:this.vm().getProperty("/report/ticketId")});},
  onOrder:function(){this.route("order",{id:this.vm().getProperty("/report/orderId")});},
  onSubmit:function(){this.run(async function(){await this.api("/api/workflow/submit/"+this.id,{method:"POST",key:crypto.randomUUID(),body:{version:this.vm().getProperty("/report/version")}});this.load();});},
  onConfirm:function(){form(this,"Leistung bestätigen",[{key:"comment",label:"Kundenbestätigung",type:"textarea",required:true}],async function(data,key){data.version=this.vm().getProperty("/report/version");await this.api("/api/service/reports/"+this.id+"/confirm",{method:"POST",key:key,body:data});});},
  onCancel:function(){form(this,"Nachweisentwurf verwerfen",[{key:"reason",label:"Begründung",type:"textarea",required:true}],async function(data,key){data.version=this.vm().getProperty("/report/version");await this.api("/api/service/reports/"+this.id+"/cancel",{method:"POST",key:key,body:data});});}
 });
});
