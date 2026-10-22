sap.ui.define(["netfusion/erp/controller/Base.controller","sap/m/Dialog","sap/m/Select","sap/ui/core/Item","sap/m/Button","sap/m/MessageToast","sap/ui/model/json/JSONModel"],function(Base,Dialog,Select,Item,Button,Toast,JSONModel){
  "use strict";
  return Base.extend("netfusion.erp.controller.Ticket",{
    onInit:function(){this.model({ticket:{events:[],allowedTransitions:[]},flow:[],transitions:[]});this.getOwnerComponent().getRouter().getRoute("ticket").attachPatternMatched(function(e){this.id=e.getParameter("arguments").id;this.load();},this);},
    load:async function(){if(!await this.guard())return;this.run(async function(){var t=await this.api("/api/tickets/"+this.id),flow=await this.api("/api/documents/"+this.id+"/flow");this.vm().setData({ticket:t,flow:flow,transitions:this.formatter.transitionItems(t.allowedTransitions),nextStatus:t.allowedTransitions[0]||""});});},
    onCase:function(){this.route("case",{id:this.vm().getProperty("/ticket/caseId")});},
    onFlowSource:function(e){var d=e.getSource().getBindingContext("view").getObject();this.route(d.sourceKind==="TICKET"?"ticket":"case",{id:d.sourceId});},
    onFlowTarget:function(e){var d=e.getSource().getBindingContext("view").getObject();this.route(d.targetKind==="TICKET"?"ticket":"case",{id:d.targetId});},
    onAssign:function(){this.run(async function(){
      var ticket=this.vm().getProperty("/ticket"),techs=(await this.api("/api/technicians")).filter(function(t){return t.organizationId===ticket.organizationId;});
      if(!techs.length)throw new Error("Kein aktiver Techniker dieser Organisation verfügbar. Administration prüfen.");
      var select=new Select({width:"100%",items:techs.map(function(t){return new Item({key:t.id,text:t.name+" · "+t.assignedCount+" offene Zuordnungen"});})});
      var dialog=new Dialog({title:"Techniker zuweisen",contentWidth:"420px",content:[select],beginButton:new Button({text:"Zuweisen",type:"Emphasized",press:function(){dialog.setBusy(true);this.run(async function(){try{await this.api("/api/tickets/"+this.id+"/assign",{method:"POST",body:{technicianId:select.getSelectedKey(),version:ticket.version},key:crypto.randomUUID()});dialog.close();Toast.show("Techniker zugewiesen");this.load();}finally{dialog.setBusy(false);}});}.bind(this)}),endButton:new Button({text:"Abbrechen",press:function(){dialog.close();}}),afterClose:function(){dialog.destroy();}});
      dialog.addStyleClass("sapUiContentPadding");this.getView().addDependent(dialog);dialog.open();
    });},
    onStatus:function(){this.run(async function(){var t=this.vm().getProperty("/ticket"),next=this.vm().getProperty("/nextStatus");await this.api("/api/tickets/"+this.id+"/status",{method:"POST",body:{status:next,version:t.version},key:crypto.randomUUID()});Toast.show("Status aktualisiert");this.load();});}
  });
});
