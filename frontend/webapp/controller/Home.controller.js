sap.ui.define(["netfusion/erp/controller/Base.controller"],function(Base){
  "use strict";
  return Base.extend("netfusion.erp.controller.Home",{
    onInit:function(){this.model({dashboard:{recent:[],open:0,total:0,unassigned:0,critical:0,cases:0},date:"",greeting:""});this.getOwnerComponent().getRouter().getRoute("home").attachPatternMatched(this.load,this);},
    load:async function(){if(!await this.guard())return;this.run(async function(){this.vm().setProperty("/dashboard",this.state("/access/service")?await this.api("/api/dashboard"):{});this.vm().setProperty("/date",new Date().toLocaleDateString("de-DE",{weekday:"long",day:"numeric",month:"long",year:"numeric",timeZone:"Europe/Berlin"}));this.vm().setProperty("/greeting","Guten Tag, "+this.state("/user/name").split(" ")[0]+".");});},
    onRefresh:function(){this.load();}
  });
});
