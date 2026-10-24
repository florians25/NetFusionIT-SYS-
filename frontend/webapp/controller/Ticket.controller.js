sap.ui.define(["netfusion/erp/controller/Base.controller","sap/m/Dialog","sap/m/Select","sap/ui/core/Item","sap/m/Button","sap/m/MessageToast","sap/ui/model/json/JSONModel","netfusion/erp/util/TicketWork","netfusion/erp/util/TicketIntake"],function(Base,Dialog,Select,Item,Button,Toast,JSONModel,TicketWork,Intake){
  "use strict";
  return Base.extend("netfusion.erp.controller.Ticket",Object.assign({},TicketWork,{
    onInit:function(){this.model({ticket:{events:[],allowedTransitions:[]},transitions:[]});this.getOwnerComponent().getRouter().getRoute("ticket").attachPatternMatched(function(e){this.id=e.getParameter("arguments").id;this.load();},this);},
    load:async function(){if(!await this.guard())return;return this.run(async function(){
      var id=this.id,userId=this.state("/user/id"),internal=this.state("/access/internal"),results=await Promise.all([
        this.api("/api/tickets/"+id),
        internal?this.api("/api/tickets/"+id+"/execution"):Promise.resolve({tasks:[],times:[],charges:[],orders:[]}),
        this.state("/access/inventory")?this.api("/api/catalog/products"):Promise.resolve([]),
        this.api("/api/tickets/"+id+"/sla"),this.api("/api/tickets/"+id+"/comments"),this.state("/access/ticketIntake")?this.api("/api/ticket-intake/"+id):Promise.resolve({assets:[],assetHistory:[],intake:{}})
      ]);
      if(this.id!==id||this.state("/user/id")!==userId)return;
      var t=results[0],execution=results[1];execution.tasks.forEach(function(w){w.canEdit=w.workerId===userId&&["OPEN","IN_PROGRESS"].includes(w.status);});execution.times.concat(execution.charges).forEach(function(w){w.canEdit=w.workerId===userId&&w.status==="RECORDED"&&!w.reportId;w.canAllocate=w.canEdit&&!w.orderId;});
      this.vm().setData({execution:execution,ownTimer:!!execution.timer&&execution.timer.ticketId===id,workProducts:results[2],ticket:t,slaDetail:results[3],transitions:this.formatter.transitionItems(t.allowedTransitions),nextStatus:t.allowedTransitions[0]||"",comments:results[4],commentBody:"",intakeDetail:results[5],workSummary:{tasks:execution.tasks.length,times:execution.times.length,assets:results[5].assets.length,comments:results[4].length},commentVisibility:internal?"INTERNAL":"PUBLIC"});
    });},
    onQualify:function(){return Intake.open(this);},
    onComment:function(){this.run(async function(){var body={body:this.vm().getProperty("/commentBody"),visibility:this.vm().getProperty("/commentVisibility")},signature=JSON.stringify(body);if(this.commentSignature!==signature){this.commentSignature=signature;this.commentKey=crypto.randomUUID();}await this.api("/api/tickets/"+this.id+"/comments",{method:"POST",body:body,key:this.commentKey});this.commentSignature=null;return this.load();});},
    onCase:function(){this.route("case",{id:this.vm().getProperty("/ticket/caseId")});},
    onAssign:function(){this.run(async function(){
      var ticket=this.vm().getProperty("/ticket"),techs=(await this.api("/api/technicians")).filter(function(t){return t.organizationId===ticket.organizationId;});
      if(!techs.length)throw new Error("Kein aktiver Techniker dieser Organisation verfügbar. Administration prüfen.");
      var select=new Select({width:"100%",items:techs.map(function(t){return new Item({key:t.id,text:t.name+" · "+t.assignedCount+" offene Zuordnungen"});})});
      var dialog=new Dialog({title:"Techniker zuweisen",contentWidth:"420px",content:[select],beginButton:new Button({text:"Zuweisen",type:"Emphasized",press:function(){dialog.setBusy(true);this.run(async function(){try{await this.api("/api/tickets/"+this.id+"/assign",{method:"POST",body:{technicianId:select.getSelectedKey(),version:ticket.version},key:crypto.randomUUID()});dialog.close();Toast.show("Techniker zugewiesen");await this.load();}finally{dialog.setBusy(false);}});}.bind(this)}),endButton:new Button({text:"Abbrechen",press:function(){dialog.close();}}),afterClose:function(){dialog.destroy();}});
      dialog.addStyleClass("sapUiContentPadding");this.getView().addDependent(dialog);dialog.open();
    });},
    onStatus:function(){this.run(async function(){var t=this.vm().getProperty("/ticket"),next=this.vm().getProperty("/nextStatus");await this.api("/api/tickets/"+this.id+"/status",{method:"POST",body:{status:next,version:t.version},key:crypto.randomUUID()});Toast.show("Status aktualisiert");return this.load();});}
  }));
});
