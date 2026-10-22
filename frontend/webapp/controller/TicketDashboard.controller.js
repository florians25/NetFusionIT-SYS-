sap.ui.define(["netfusion/erp/controller/Base.controller","sap/ui/model/Filter","sap/ui/model/FilterOperator","sap/m/Dialog","sap/m/Select","sap/ui/core/Item","sap/m/Button","sap/m/MessageToast"],function(Base,Filter,Op,Dialog,Select,Item,Button,Toast){
  "use strict";
  var inactive=["CLOSED","CANCELLED","COMMERCIALLY_CLOSED","TECHNICALLY_RESOLVED"];
  var titles={NEW:"Neue Tickets",UNASSIGNED:"Nicht zugewiesen",CRITICAL:"Hohe Priorität",ACTIVE:"In Bearbeitung",ALL:"Alle Tickets"};
  return Base.extend("netfusion.erp.controller.TicketDashboard",{
    onInit:function(){
      this.model({queue:"NEW",queueTitle:titles.NEW,queueCount:0,search:"",priority:"",type:"",dashboard:{newCount:0,unassigned:0,critical:0,inProgress:0,total:0,open:0,last24h:0,waiting:0,distribution:[]}});
      this.getOwnerComponent().getRouter().getRoute("cockpit").attachPatternMatched(this.load,this);
    },
    load:async function(){if(!await this.guard())return;this.run(async function(){var binding=this.byId("worklist").getBinding("items");if(!this.listening){binding.attachDataReceived(this.onDataReceived,this);this.listening=true;}this.vm().setProperty("/dashboard",await this.api("/api/dashboard"));this.applyFilters();});},
    onDataReceived:function(){var binding=this.byId("worklist").getBinding("items");if(binding.isLengthFinal())this.vm().setProperty("/queueCount",binding.getLength());},
    setQueue:function(queue){this.vm().setProperty("/queue",queue);this.vm().setProperty("/queueTitle",titles[queue]);this.applyFilters();},
    onQueue:function(e){this.setQueue(e.getParameter("key"));},
    onNewQueue:function(){this.setQueue("NEW");},onUnassignedQueue:function(){this.setQueue("UNASSIGNED");},onCriticalQueue:function(){this.setQueue("CRITICAL");},onActiveQueue:function(){this.setQueue("ACTIVE");},
    onSearch:function(e){this.vm().setProperty("/search",e.getParameter("query"));this.applyFilters();},
    onClear:function(){this.vm().setProperty("/search","");this.vm().setProperty("/priority","");this.vm().setProperty("/type","");this.applyFilters();},
    applyFilters:function(){
      var v=this.vm().getData(),filters=[];
      if(v.queue==="NEW")filters.push(new Filter("status",Op.EQ,"NEW"));
      if(v.queue==="ACTIVE")filters.push(new Filter("status",Op.EQ,"IN_PROGRESS"));
      if(["UNASSIGNED","CRITICAL"].includes(v.queue))inactive.forEach(function(status){filters.push(new Filter("status",Op.NE,status));});
      if(v.queue==="UNASSIGNED")filters.push(new Filter("technicianId",Op.EQ,null));
      if(v.queue==="CRITICAL")filters.push(new Filter({filters:[new Filter("priority",Op.EQ,"HIGH"),new Filter("priority",Op.EQ,"CRITICAL")],and:false}));
      if(v.priority)filters.push(new Filter("priority",Op.EQ,v.priority));
      if(v.type)filters.push(new Filter("type",Op.EQ,v.type));
      if(v.search)filters.push(new Filter({filters:[new Filter("title",Op.Contains,v.search),new Filter("number",Op.Contains,v.search),new Filter("partnerName",Op.Contains,v.search)],and:false}));
      this.vm().setProperty("/queueCount",0);
      var binding=this.byId("worklist").getBinding("items");binding.filter(filters.length?new Filter({filters:filters,and:true}):[]);binding.refresh();
    },
    onAssignRow:function(e){
      var ticket=e.getSource().getBindingContext().getObject();
      this.run(async function(){
        var techs=(await this.api("/api/technicians")).filter(function(t){return t.organizationId===ticket.organizationId;});
        if(!techs.length)throw new Error("Kein aktiver Techniker dieser Organisation verfügbar.");
        var select=new Select({width:"100%",items:techs.map(function(t){return new Item({key:t.id,text:t.name+" · "+t.assignedCount+" offene Zuordnungen"});})}),key=crypto.randomUUID(),selected="";
        var dialog=new Dialog({title:"Techniker zuweisen · "+ticket.number,contentWidth:"420px",content:[select],beginButton:new Button({text:"Zuweisen",type:"Emphasized",press:function(){dialog.setBusy(true);this.run(async function(){try{if(selected!==select.getSelectedKey()){selected=select.getSelectedKey();key=crypto.randomUUID();}await this.api("/api/tickets/"+ticket.id+"/assign",{method:"POST",body:{technicianId:selected,version:ticket.version},key:key});dialog.close();Toast.show("Techniker zugewiesen");this.load();}finally{dialog.setBusy(false);}});}.bind(this)}),endButton:new Button({text:"Abbrechen",press:function(){dialog.close();}}),afterClose:function(){dialog.destroy();}});
        dialog.addStyleClass("sapUiContentPadding");this.getView().addDependent(dialog);dialog.open();
      });
    }
  });
});
