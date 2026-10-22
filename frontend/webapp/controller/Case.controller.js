sap.ui.define(["netfusion/erp/controller/Base.controller"],function(Base){"use strict";return Base.extend("netfusion.erp.controller.Case",{
  onInit:function(){this.model({serviceCase:{tickets:[]}});this.getOwnerComponent().getRouter().getRoute("case").attachPatternMatched(async function(e){if(!await this.guard())return;this.run(async function(){this.vm().setProperty("/serviceCase",await this.api("/api/cases/"+e.getParameter("arguments").id));});}.bind(this));}
});});
