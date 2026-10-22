sap.ui.define(["netfusion/erp/controller/Base.controller","sap/m/ActionSheet","sap/m/Button","sap/m/MessageBox"],function(Base,ActionSheet,Button,MessageBox){
  "use strict";
  return Base.extend("netfusion.erp.controller.App",{
    onInit:function(){this.getOwnerComponent().getRouter().attachRouteMatched(function(e){var name=e.getParameter("name"),key=["ticket","newTicket","cases","case"].includes(name)?"tickets":name;this.getOwnerComponent().getModel("state").setProperty("/navKey",key);}.bind(this));},
    onNav:function(e){this.route(e.getParameter("key"));},
    onProfile:function(e){
      if(!this.profile){this.profile=new ActionSheet({placement:"Bottom",buttons:[new Button({text:"Abmelden",icon:"sap-icon://log",press:this.onLogout.bind(this)})]});this.getView().addDependent(this.profile);}
      this.profile.openBy(e.getSource());
    },
    onLogout:function(){this.run(async function(){await this.api("/api/auth/logout",{method:"POST"});this.getOwnerComponent().endSession();});}
  });
});
