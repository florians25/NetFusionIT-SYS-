sap.ui.define(["netfusion/erp/controller/Base.controller","sap/m/Dialog","sap/m/Input","sap/m/TextArea","sap/m/DatePicker","sap/m/Select","sap/m/Label","sap/m/Button","sap/ui/core/Item","sap/ui/layout/form/SimpleForm","sap/m/MessageToast"],function(Base,Dialog,Input,TextArea,DatePicker,Select,Label,Button,Item,SimpleForm,Toast){
 "use strict";
 function options(list,key,text){return list.map(function(o){return {key:o[key||"id"],text:o[text||"name"]};});}
 function enums(values){return values.map(function(v){return {key:v[0],text:v[1]};});}
 return Base.extend("netfusion.erp.controller.ServiceMaster",{
  onInit:function(){this.model({assets:[],contracts:[],partners:[],organizations:[],policies:[]});this.getOwnerComponent().getRouter().getRoute("serviceMaster").attachPatternMatched(this.load,this);},
  load:async function(){if(!await this.guard())return;if(!this.state("/access/assetRead")&&!this.state("/access/contractRead")){this.onHome();return;}this.run(async function(){this.vm().setData({assets:this.state("/access/assetRead")?await this.api("/api/service/assets"):[],contracts:this.state("/access/contractRead")?await this.api("/api/service/contracts"):[],partners:this.state("/access/partners")?(await this.api("/api/partners")).filter(function(p){return p.status==="ACTIVE";}):this.state("/access/assetWrite")?await this.api("/api/service/context-partners"):[],organizations:await this.api("/api/organization"),policies:this.state("/access/serviceConfig")?await this.api("/api/service/sla-policies"):[]});});},
  form:function(title,fields,save){
   var controls={},content=[];
   fields.forEach(function(f){var control;
    if(f.type==="select")control=new Select({width:"100%",items:f.options.map(function(o){return new Item({key:o.key,text:o.text});}),selectedKey:f.value||f.options[0]&&f.options[0].key||""});
    else if(f.type==="date")control=new DatePicker({width:"100%",valueFormat:"yyyy-MM-dd",displayFormat:"medium",value:f.value||""});
    else if(f.type==="textarea")control=new TextArea({width:"100%",rows:4,value:f.value||""});
    else control=new Input({width:"100%",value:f.value||"",maxLength:f.maxLength||250});
    controls[f.key]={control:control,field:f};content.push(new Label({text:f.label,labelFor:control,required:!!f.required}),control);
   });
   var dialog=new Dialog({title:title,contentWidth:"680px",content:[new SimpleForm({editable:true,layout:"ResponsiveGridLayout",content:content})],beginButton:new Button({text:"Speichern",type:"Emphasized",press:function(){dialog.setBusy(true);this.run(async function(){try{var data={};Object.keys(controls).forEach(function(k){var c=controls[k];data[k]=c.field.type==="select"?c.control.getSelectedKey():c.control.getValue();if(c.field.nullable&&!data[k])data[k]=null;});await save.call(this,data);dialog.close();Toast.show("Gespeichert");this.load();}finally{dialog.setBusy(false);}});}.bind(this)}),endButton:new Button({text:"Abbrechen",press:function(){dialog.close();}}),afterClose:function(){dialog.destroy();}});this.getView().addDependent(dialog);dialog.open();
  },
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
