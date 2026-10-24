sap.ui.define(["netfusion/erp/controller/Base.controller","sap/m/Dialog","sap/m/Input","sap/m/TextArea","sap/m/DatePicker","sap/m/Select","sap/m/Label","sap/m/Button","sap/ui/core/Item","sap/ui/layout/form/SimpleForm","sap/m/MessageToast","netfusion/erp/util/FormDialog"],function(Base,Dialog,Input,TextArea,DatePicker,Select,Label,Button,Item,SimpleForm,Toast,Form){
 "use strict";
 function options(list,key,text){return list.map(function(o){return {key:o[key||"id"],text:o[text||"name"]};});}
 function enums(values){return values.map(function(v){return {key:v[0],text:v[1]};});}
 return Base.extend("netfusion.erp.controller.ServiceMaster",{
  onInit:function(){this.model({assets:[],contracts:[],partners:[],organizations:[],policies:[]});this.getOwnerComponent().getRouter().getRoute("serviceMaster").attachPatternMatched(this.load,this);},
  load:async function(){if(!await this.guard())return;if(!this.state("/access/assetRead")&&!this.state("/access/contractRead")){this.onHome();return;}this.run(async function(){this.vm().setData({assets:this.state("/access/assetRead")?await this.api("/api/service/assets"):[],contracts:this.state("/access/contractRead")?await this.api("/api/service/contracts"):[],partners:this.state("/access/partners")?(await this.api("/api/partners")).filter(function(p){return p.status==="ACTIVE";}):this.state("/access/assetWrite")?await this.api("/api/service/context-partners"):[],organizations:await this.api("/api/organization"),policies:this.state("/access/serviceConfig")?await this.api("/api/service/sla-policies"):[]});});},
  form:function(title,fields,save){return Form(this,title,fields,save,{page:true});},
  commonFields:function(){var v=this.vm().getData();if(!v.partners.length)throw new Error("Zuerst einen Kunden anlegen und freigeben.");return [{key:"organizationId",label:"Serviceorganisation",type:"select",options:options(v.organizations),required:true},{key:"partnerId",label:"Kunde",type:"select",options:options(v.partners),required:true},{key:"name",label:"Bezeichnung",required:true}];},
  onNewContract:function(){this.run(function(){this.form("Servicevertrag anlegen",this.commonFields().concat([
   {key:"kind",label:"Vertragsart",type:"select",options:enums([["MANAGED","Managed Service"],["MAINTENANCE","Wartung"],["HOURS","Stundenkontingent"],["FLATRATE","Flatrate"],["SLA","SLA-Vertrag"],["WARRANTY","Garantie"],["SINGLE","Einzelservice"]])},
   {key:"validFrom",label:"Gültig ab",type:"date",required:true},{key:"validTo",label:"Gültig bis",type:"date",required:true},
   {key:"slaPolicyId",label:"SLA-Policy",type:"select",nullable:true,options:[{key:"",text:"Ohne SLA-Policy"}].concat(options(this.vm().getProperty("/policies")))},{key:"scope",label:"Leistungsumfang",type:"textarea",required:true}
  ]),async function(data){await this.api("/api/service/contracts",{method:"POST",body:data,key:crypto.randomUUID()});});});},
  onActivateContract:function(e){var c=e.getSource().getBindingContext("view").getObject();this.run(async function(){await this.api("/api/service/contracts/"+c.id+"/status",{method:"POST",body:{version:c.version,status:c.status==="ACTIVE"?"BLOCKED":"ACTIVE"},key:crypto.randomUUID()});this.load();});},
  onNewAsset:function(){this.run(function(){this.form("Technisches Objekt anlegen",this.commonFields().concat([
   {key:"kind",label:"Objektart",type:"select",options:enums([["SERVER","Server"],["NOTEBOOK","Notebook"],["PC","PC"],["NETWORK","Netzwerkgerät"],["FIREWALL","Firewall"],["PRINTER","Drucker"],["SOFTWARE","Software"],["LICENSE","Lizenz"],["INFRASTRUCTURE","Infrastruktur"],["OTHER","Sonstiges"]])},
   {key:"manufacturer",label:"Hersteller"},{key:"model",label:"Modell"},{key:"serialNumber",label:"Seriennummer"},{key:"inventoryNumber",label:"Inventarnummer"},{key:"location",label:"Standort"},{key:"installedOn",label:"Installiert am",type:"date",nullable:true},{key:"warrantyUntil",label:"Garantie bis",type:"date",nullable:true},
   {key:"parentId",label:"Übergeordnetes Objekt",type:"select",nullable:true,options:[{key:"",text:"Kein übergeordnetes Objekt"}].concat(options(this.vm().getProperty("/assets")))},
   {key:"contractId",label:"Servicevertrag",type:"select",nullable:true,options:[{key:"",text:"Kein Vertrag"}].concat(options(this.vm().getProperty("/contracts")))}
  ]),async function(data){await this.api("/api/service/assets",{method:"POST",body:data,key:crypto.randomUUID()});});});}
 });
});
