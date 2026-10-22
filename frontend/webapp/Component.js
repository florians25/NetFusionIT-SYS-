sap.ui.define(["sap/ui/core/UIComponent","sap/ui/model/json/JSONModel","sap/ui/Device"],function(UIComponent,JSONModel,Device){
  "use strict";
  return UIComponent.extend("netfusion.erp.Component",{
    metadata:{manifest:"json"},
    init:function(){
      UIComponent.prototype.init.apply(this,arguments);
      this.setModel(new JSONModel(Device),"device");
      this.setModel(new JSONModel({user:null,csrfToken:null,access:{},navigation:{title:"App-Zentrale",tabs:[],active:false,selectedKey:""}}),"state");
      this.ready=fetch("/api/auth/session",{credentials:"same-origin"}).then(function(r){if(!r.ok)throw new Error("Sitzung konnte nicht geladen werden.");return r.json();}).then(this.setSession.bind(this)).catch(function(e){this.getModel("state").setProperty("/connectionError",e.message);}.bind(this));
      this.getRouter().attachBypassed(function(){this.getRouter().navTo("home",{},true);}.bind(this));
      this.ready.then(function(){
        if(!this.getModel("state").getProperty("/user"))this.getRouter().getHashChanger().replaceHash("login");
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
      model.setProperty("/access",{admin:role==="ADMIN",assign:has("service.assign"),internal:!!role&&role!=="CUSTOMER",customer:role==="CUSTOMER",partners:has("partner.read")&&role!=="CUSTOMER",partnerWrite:has("partner.write"),service:has("service.read"),workflow:has("workflow.read"),create:has("service.create"),inventory:has("inventory.read"),materialWrite:has("material.write"),orders:has("order.read"),orderWrite:has("order.write"),pricing:has("pricing.write"),financeWrite:has("finance.write"),financeRead:has("finance.read"),supplierRead:has("supplier.read"),requisitionRead:has("requisition.read"),requisitionWrite:has("requisition.write"),procurementWrite:has("procurement.write"),salesWrite:has("sales.write"),assetRead:has("asset.read"),assetWrite:has("asset.write"),contractRead:has("contract.read"),contractWrite:has("contract.write"),serviceConfig:has("service.config.read"),serviceManage:has("service.manage")});
      model.setProperty("/connectionError",null);
      if(data.user)this.getModel().refresh();
      return data;
    }
  });
});
