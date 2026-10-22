sap.ui.define(["netfusion/erp/controller/Base.controller","sap/m/MessageBox"],function(Base,MessageBox){
  "use strict";
  return Base.extend("netfusion.erp.controller.NewTicket",{
    onInit:function(){this.model();this.getOwnerComponent().getRouter().getRoute("newTicket").attachPatternMatched(this.load,this);},
    load:async function(){if(!await this.guard("create"))return;this.run(async function(){var partners=await this.api("/api/partners");this.vm().setData({title:"",description:"",type:"INCIDENT",priority:"MEDIUM",partnerId:partners[0]&&partners[0].id,partners:partners,error:""});this.lastPayload=null;this.key=null;});},
    onSave:function(){this.run(async function(){
      var v=this.vm().getData();
      if(v.title.trim().length<5||v.description.trim().length<10||!v.partnerId){this.vm().setProperty("/error","Bitte Kunde, Betreff (mindestens 5 Zeichen) und Beschreibung (mindestens 10 Zeichen) ausfüllen.");return;}
      var payload={title:v.title,description:v.description,type:v.type,priority:v.priority};
      if(!this.state("/access/customer"))payload.partnerId=v.partnerId;
      var signature=JSON.stringify(payload);if(signature!==this.lastPayload){this.lastPayload=signature;this.key=crypto.randomUUID();}
      var result=await this.api("/api/tickets",{method:"POST",body:payload,key:this.key});
      this.getOwnerComponent().getModel().refresh();
      MessageBox.success("Ticket "+result.number+" und Servicefall "+result.caseNumber+" wurden gespeichert.\nKorrelations-ID: "+result.correlationId,{onClose:function(){this.route("ticket",{id:result.id});}.bind(this)});
    });},onCancel:function(){this.route("tickets");}
  });
});
