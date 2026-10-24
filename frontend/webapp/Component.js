sap.ui.define(["sap/ui/core/UIComponent","sap/ui/model/json/JSONModel","sap/ui/Device","netfusion/erp/util/HttpTestCrypto"],function(UIComponent,JSONModel,Device){
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
      model.setProperty("/access",{documentConfigRead:has("document.config.read"),documentConfigure:has("document.configure"),admin:role==="ADMIN",assign:has("service.assign"),internal:!!role&&role!=="CUSTOMER",customer:role==="CUSTOMER",partners:has("partner.read")&&role!=="CUSTOMER",partnerWrite:has("partner.write"),ticketIntake:has("ticket.intake.read"),ticketIntakeWrite:has("ticket.intake.write"),service:has("service.read"),workflow:has("workflow.read"),create:has("service.create"),inventory:has("inventory.read"),inventoryWrite:has("inventory.write"),inventoryIssue:has("inventory.issue"),inventoryReserve:has("inventory.reserve"),materialWrite:has("material.write"),orders:has("order.read"),orderWrite:has("order.write"),pricing:has("pricing.write"),apPost:has("ap.post"),apRead:has("ap.read"),apReceive:has("ap.receive"),settlements:has("settlement.read"),settlementWrite:has("settlement.write"),reportingOperations:has("reporting.operations.read"),reportingAging:has("reporting.aging.read"),reportingSales:has("reporting.sales.read"),reportingCosts:has("reporting.cost.read"),billingCreditRead:has("billing.credit.read"),billingCreditWrite:has("billing.credit.write"),billingInternal:has("billing.read.internal"),billingRelease:has("billing.release"),billingRead:has("billing.read"),billingWrite:has("billing.write"),partnerAccountRead:has("partner.account.read"),partnerAccountWrite:has("partner.account.write"),financeWrite:has("finance.write"),financeRead:has("finance.read"),supplierRead:has("supplier.read"),serviceRequisitionRead:has("requisition.read"),requisitionRead:has("requisition.read")||has("sales.procurement.read"),requisitionWrite:has("requisition.write"),procurementWrite:has("procurement.write"),quoteRead:has("quote.read"),quoteWrite:has("quote.write"),quoteDecide:has("quote.decide"),salesRead:has("sales.read"),salesProcurementRead:has("sales.procurement.read"),salesProcurementPlan:has("sales.procurement.plan"),salesFulfillment:has("sales.fulfillment.read"),customerReturns:has("sales.return.read"),returnWrite:has("sales.return.write"),returnReceive:has("sales.return.receive"),salesReserve:has("sales.reserve"),salesDeliver:has("sales.deliver"),procurementConfigRead:has("procurement.config.read"),procurementConfigure:has("procurement.configure"),salesConfigRead:has("sales.config.read"),salesConfigure:has("sales.configure"),salesWrite:has("sales.write"),assetRead:has("asset.read"),assetWrite:has("asset.write"),contractRead:has("contract.read"),contractWrite:has("contract.write"),serviceConfig:has("service.config.read"),serviceManage:has("service.manage")});
      model.setProperty("/connectionError",null);
      if(data.user)this.getModel().refresh();
      return data;
    }
  });
});
