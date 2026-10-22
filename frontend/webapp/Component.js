sap.ui.define(["sap/ui/core/UIComponent","sap/ui/model/json/JSONModel","sap/ui/Device"],function(UIComponent,JSONModel,Device){
  "use strict";
  return UIComponent.extend("netfusion.erp.Component",{
    metadata:{manifest:"json"},
    init:function(){
      UIComponent.prototype.init.apply(this,arguments);
      this.setModel(new JSONModel(Device),"device");
      this.setModel(new JSONModel({user:null,csrfToken:null,access:{},navKey:"home"}),"state");
      this.ready=fetch("/api/auth/session",{credentials:"same-origin"}).then(function(r){if(!r.ok)throw new Error("Sitzung konnte nicht geladen werden.");return r.json();}).then(this.setSession.bind(this)).catch(function(e){this.getModel("state").setProperty("/connectionError",e.message);}.bind(this));
      this.ready.then(function(){
        if(!this.getModel("state").getProperty("/user"))this.getRouter().getHashChanger().replaceHash("login");
        else if(!this.getModel("state").getProperty("/access/service") && !this.getRouter().getHashChanger().getHash().replace(/^\//,""))this.getRouter().getHashChanger().replaceHash("apps");
        this.getRouter().initialize();
      }.bind(this));
    },
    endSession:function(){
      if(this.endingSession)return;this.endingSession=true;
      this.getModel("state").setProperty("/user",null);
      // Vollständiger Neuaufbau entfernt auch alte OData-/Objektseiten-Caches.
      window.location.hash="/login";window.location.reload();
    },
    setSession:function(data){
      var model=this.getModel("state"),role=data.user&&data.user.role,has=function(p){return !!data.user&&(data.user.permissions||[]).includes(p);};
      model.setProperty("/user",data.user);model.setProperty("/csrfToken",data.csrfToken);
      model.setProperty("/access",{admin:role==="ADMIN",assign:has("service.assign"),internal:!!role&&role!=="CUSTOMER",customer:role==="CUSTOMER",partners:has("partner.read")&&role!=="CUSTOMER",partnerWrite:has("partner.write"),service:has("service.read"),workflow:has("workflow.read"),create:has("service.create")});
      model.setProperty("/connectionError",null);
      if(data.user)this.getModel().refresh();
      return data;
    }
  });
});
