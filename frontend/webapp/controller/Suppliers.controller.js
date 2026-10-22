sap.ui.define(["netfusion/erp/controller/Base.controller","netfusion/erp/util/FormDialog"],function(Base,form){
 "use strict";return Base.extend("netfusion.erp.controller.Suppliers",{
  onInit:function(){this.model({suppliers:[],organizations:[]});this.getOwnerComponent().getRouter().getRoute("suppliers").attachPatternMatched(this.load,this);},
  load:async function(){if(!await this.guard("supplierRead"))return;this.run(async function(){var rows=await this.api("/api/procurement/suppliers");this.vm().setData({suppliers:rows,summary:this.summarize(rows),organizations:await this.api("/api/organization")});});},
  onNew:function(){form(this,"Lieferant anlegen",[{key:"organizationId",label:"Organisation",type:"select",options:this.vm().getProperty("/organizations").map(function(o){return {key:o.id,text:o.name};})},{key:"name",label:"Lieferantenname",required:true},{key:"email",label:"E-Mail",required:true},{key:"street",label:"Straße",required:true},{key:"postalCode",label:"Postleitzahl",required:true},{key:"city",label:"Ort",required:true},{key:"country",label:"Ländercode",required:true},{key:"vatId",label:"Umsatzsteuer-ID"},{key:"paymentTermsDays",label:"Zahlungsziel in Tagen",type:"integer",required:true}],async function(data,key){await this.api("/api/procurement/suppliers",{method:"POST",key:key,body:data});});},
  onPartner:function(e){this.route("partner",{id:e.getSource().getBindingContext("view").getProperty("id")});},
  onSubmit:function(e){var p=e.getSource().getBindingContext("view").getObject();this.run(async function(){await this.api("/api/workflow/submit/"+p.id,{method:"POST",key:crypto.randomUUID(),body:{version:p.version}});this.load();});}
 });
});
