sap.ui.define(["netfusion/erp/controller/Base.controller","sap/ui/model/Filter","sap/ui/model/FilterOperator"],function(Base,Filter,Op){
  "use strict";
  return Base.extend("netfusion.erp.controller.Tickets",{
    onInit:function(){this.model({status:"",priority:"",search:""});this.getOwnerComponent().getRouter().getRoute("tickets").attachPatternMatched(async function(){if(!await this.guard())return;this.onFilter();}.bind(this));},
    onFilter:function(){
      var binding=this.byId("ticketTable").getBinding("items"),v=this.vm().getData(),filters=[];
      if(!binding)return;
      if(v.search)filters.push(new Filter({filters:[new Filter("title",Op.Contains,v.search),new Filter("number",Op.Contains,v.search),new Filter("partnerName",Op.Contains,v.search)],and:false}));
      if(v.status)filters.push(new Filter("status",Op.EQ,v.status));if(v.priority)filters.push(new Filter("priority",Op.EQ,v.priority));
      binding.filter(filters);binding.refresh();
    },
    onSearch:function(e){this.vm().setProperty("/search",e.getParameter("query"));this.onFilter();},
    onReset:function(){this.vm().setData({status:"",priority:"",search:""});this.onFilter();},
    onRefresh:function(){this.byId("ticketTable").getBinding("items").refresh();}
  });
});
