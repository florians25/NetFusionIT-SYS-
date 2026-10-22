sap.ui.define(["sap/ui/core/mvc/Controller","sap/m/MessageBox","sap/ui/model/json/JSONModel","netfusion/erp/model/formatter"],function(Controller,MessageBox,JSONModel,formatter){
  "use strict";
  return Controller.extend("netfusion.erp.controller.Base",{
    formatter:formatter,
    model:function(data){this.getView().setModel(new JSONModel(data||{}),"view");return this.getView().getModel("view");},
    vm:function(){return this.getView().getModel("view");},
    state:function(path){return this.getOwnerComponent().getModel("state").getProperty(path);},
    route:function(name,args){this.getOwnerComponent().getRouter().navTo(name,args||{});},
    guard:async function(access){await this.getOwnerComponent().ready;if(!this.state("/user")){this.route("login");return false;}if(access&&!this.state("/access/"+access)){this.route("home");return false;}return true;},
    api:async function(path,options){
      options=options||{};var headers={Accept:"application/json"};
      if(options.method&&options.method!=="GET"){headers["Content-Type"]="application/json";headers["X-CSRF-Token"]=this.state("/csrfToken");}
      if(options.key)headers["Idempotency-Key"]=options.key;
      var response=await fetch(path,{method:options.method||"GET",headers:headers,body:options.body?JSON.stringify(options.body):undefined,credentials:"same-origin"});
      var data=(response.headers.get("content-type")||"").includes("application/json")?await response.json():{error:{message:"Anfrage fehlgeschlagen ("+response.status+")."}};
      if(!response.ok){if(response.status===401)this.getOwnerComponent().endSession();throw new Error((data.error&&data.error.message||"Anfrage fehlgeschlagen.")+(data.error&&data.error.correlationId?"\nReferenz: "+data.error.correlationId:""));}
      return data;
    },
    run:async function(fn){this.getView().setBusyIndicatorDelay(0);this.getView().setBusy(true);try{return await fn.call(this);}catch(e){MessageBox.error(e.message);}finally{this.getView().setBusy(false);}},
    onHome:function(){this.route("home");},onCockpit:function(){this.route("cockpit");},onTickets:function(){this.route("tickets");},onCases:function(){this.route("cases");},onDispatch:function(){this.route("dispatch");},onPartners:function(){this.route("partners");},onAdmin:function(){this.route("admin");},onWorkflow:function(){this.route("workflow");},onRoadmap:function(){this.route("roadmap");},onNew:function(){this.route("newTicket");},
    onSuppliers:function(){this.route("suppliers");},
    onFinance:function(){this.route("finance");},
    onOrders:function(){this.route("orders");},onCatalog:function(){this.route("catalog");},onPricing:function(){this.route("pricing");},onPlanning:function(){this.route("planning");},onServiceMaster:function(){this.route("serviceMaster");},onServiceSetup:function(){this.route("serviceSetup");},
    onDocument:function(kind,id){if(kind==="WORK_ORDER_TASK"){this.run(async function(){var task=await this.api("/api/service/tasks/"+id);this.route("ticket",{id:task.ticketId});});return;}var route={MATERIAL_REQUIREMENT:"procurement",REQUISITION:"procurement",PURCHASE_ORDER:"procurement",ACCOUNTING:"journal",SERVICE_ORDER:"order",SERVICE_REPORT:"report",MATERIAL:"catalog",TICKET:"ticket",SERVICE_CASE:"case",BUSINESS_PARTNER:"partner",TECHNICAL_OBJECT:"serviceMaster",SERVICE_CONTRACT:"serviceMaster",FIELD_VISIT:"planning"}[kind];if(route)this.route(route,{id:id});},
    onTicketPress:function(e){var item=e.getParameter("listItem")||e.getSource(),ctx=item.getBindingContext()||item.getBindingContext("view");if(ctx)this.route("ticket",{id:ctx.getProperty("id")});}
  });
});
