sap.ui.define(["netfusion/erp/controller/Base.controller","sap/m/MessageBox","sap/ui/model/json/JSONModel","netfusion/erp/util/TicketIntake"],function(Base,MessageBox,JSONModel,Intake){
  "use strict";
  return Base.extend("netfusion.erp.controller.NewTicket",{
    onInit:function(){this.model();this.getView().setModel(new JSONModel(Intake.initial()),"intake");this.getOwnerComponent().getRouter().getRoute("newTicket").attachPatternMatched(this.load,this);},
    load:async function(){if(!await this.guard("create"))return;this.run(async function(){var partners=(await this.api("/api/partners")).filter(function(p){return p.status==="ACTIVE";});this.vm().setData({title:"",description:"",type:"INCIDENT",priority:"MEDIUM",partnerId:partners[0]&&partners[0].id,partners:partners,allAssets:await this.api("/api/service/assets"),allContracts:await this.api("/api/service/contracts"),error:""});await this.onPartnerChange();this.lastPayload=null;this.key=null;});},
    onPartnerChange:async function(){var v=this.vm().getData(),empty={id:"",name:"Keine Zuordnung"};this.vm().setProperty("/technicalObjectId","");this.vm().setProperty("/contractId","");this.vm().setProperty("/assets",[empty].concat(v.allAssets.filter(function(a){return a.partnerId===v.partnerId;})));this.vm().setProperty("/contracts",[empty].concat(v.allContracts.filter(function(c){return c.partnerId===v.partnerId&&c.status==="ACTIVE";})));this.onContextChange();if(this.state("/access/ticketIntake")&&v.partnerId){var partner=v.partnerId,user=this.state("/user/id"),c=await this.api("/api/ticket-intake/new?partnerId="+partner);if(this.vm().getProperty("/partnerId")!==partner||this.state("/user/id")!==user)return;this.getView().getModel("intake").setData(Object.assign(Intake.initial(),c));Intake.update(this.getView().getModel("intake"));}},
    onContextChange:function(){var v=this.vm().getData();this.vm().setProperty("/selectedAsset",v.allAssets.find(function(a){return a.id===v.technicalObjectId;})||{});this.vm().setProperty("/selectedContract",v.allContracts.find(function(c){return c.id===v.contractId;})||{});},
    onIntakeChange:function(){Intake.update(this.getView().getModel("intake"));},
    onSave:function(){this.run(async function(){
      var v=this.vm().getData();
      if(v.title.trim().length<5||v.description.trim().length<10||!v.partnerId){this.vm().setProperty("/error","Bitte Kunde, Betreff (mindestens 5 Zeichen) und Beschreibung (mindestens 10 Zeichen) ausfüllen.");return;}
      var payload={title:v.title,description:v.description,type:v.type,priority:v.priority};
      if(v.contractId)payload.contractId=v.contractId;if(v.technicalObjectId)payload.technicalObjectId=v.technicalObjectId;
      if(!this.state("/access/customer")){payload.partnerId=v.partnerId;payload.intake=Intake.body(this.getView().getModel("intake"));payload.assetIds=this.getView().getModel("intake").getProperty("/assetIds");payload.priority=Intake.update(this.getView().getModel("intake"))||this.getView().getModel("intake").getProperty("/priority");}
      var signature=JSON.stringify(payload);if(signature!==this.lastPayload){this.lastPayload=signature;this.key=crypto.randomUUID();}
      var result=await this.api("/api/tickets",{method:"POST",body:payload,key:this.key});
      this.getOwnerComponent().getModel().refresh();
      MessageBox.success("Ticket "+result.number+" und Servicefall "+result.caseNumber+" wurden gespeichert.\nKorrelations-ID: "+result.correlationId,{onClose:function(){this.route("ticket",{id:result.id});}.bind(this)});
    });},onCancel:function(){this.route("tickets");}
  });
});
