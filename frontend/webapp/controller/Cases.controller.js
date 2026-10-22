sap.ui.define(["netfusion/erp/controller/Base.controller"],function(Base){"use strict";return Base.extend("netfusion.erp.controller.Cases",{
  onInit:function(){this.getOwnerComponent().getRouter().getRoute("cases").attachPatternMatched(async function(){if(await this.guard())this.byId("casesTable").getBinding("items").refresh();}.bind(this));},
  onCasePress:function(e){this.route("case",{id:e.getParameter("listItem").getBindingContext().getProperty("id")});}
});});
