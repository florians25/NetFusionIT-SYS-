sap.ui.define(['netfusion/erp/controller/Base.controller'],function(Base){'use strict';return Base.extend('netfusion.erp.controller.SalesProcurements',{
 onInit:function(){this.model({orders:[]});this.getOwnerComponent().getRouter().getRoute('salesProcurements').attachPatternMatched(this.load,this);},
 load:async function(){if(!await this.guard('salesProcurementRead'))return;return this.run(async function(){this.vm().setProperty('/orders',await this.api('/api/sales/procurement'));});},
 onOpen:function(e){this.route('salesProcurement',{id:(e.getParameter('listItem')||e.getSource()).getBindingContext('view').getProperty('id')});}
});});
