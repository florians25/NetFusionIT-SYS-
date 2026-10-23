sap.ui.define(["sap/ui/core/mvc/Controller","sap/m/MessageBox","sap/ui/model/json/JSONModel","netfusion/erp/model/formatter","sap/ui/model/Filter","sap/ui/model/FilterOperator","netfusion/erp/util/AttachmentsDialog","netfusion/erp/model/DocumentFlow"],function(Controller,MessageBox,JSONModel,formatter,Filter,Op,attachments,DocumentFlow){
  "use strict";
  return Controller.extend("netfusion.erp.controller.Base",{
    formatter:formatter,
    model:function(data){this.getView().setModel(new JSONModel(data||{}),"view");return this.getView().getModel("view");},
    vm:function(){return this.getView().getModel("view");},
    state:function(path){return this.getOwnerComponent().getModel("state").getProperty(path);},
    route:function(name,args){this.navigationVersion=(this.navigationVersion||0)+1;this.getOwnerComponent().getRouter().navTo(name,args||{});},
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
    summarize:function(rows){return {total:rows.length,draft:rows.filter(function(r){return ['DRAFT','REJECTED'].includes(r.status);}).length,inReview:rows.filter(function(r){return ['IN_REVIEW','PENDING'].includes(r.status);}).length,active:rows.filter(function(r){return r.active===true||r.status==='ACTIVE';}).length,released:rows.filter(function(r){return ['RELEASED','IN_PROGRESS'].includes(r.status);}).length,shortage:rows.filter(function(r){return !!r.materialStatus&&!['NOT_REQUIRED','MATERIAL_READY','MATERIAL_DELIVERED'].includes(r.materialStatus);}).length};},
    onWorklistFilter:function(e){var source=e.getSource(),table=this.byId(source.data('targetTable')),filters=this.worklistFilters||(this.worklistFilters={}),key=table.getId(),state=filters[key]||(filters[key]={}),field=source.data('filterField');if(field)state[field]=source.getSelectedKey();else{state.query=e.getParameter('newValue')||e.getParameter('query')||'';state.fields=(source.data('fields')||'title,number').split(',');}var active=[];if(state.query)active.push(new Filter({filters:state.fields.map(function(f){return new Filter(f,Op.Contains,state.query);}),and:false}));Object.keys(state).filter(function(k){return !['query','fields'].includes(k)&&state[k];}).forEach(function(f){active.push(new Filter(f,Op.EQ,state[f]));});table.getBinding('items').filter(active,'Application');},
    onWorklistUpdate:function(e){if(this.vm())this.vm().setProperty('/filteredCount',e.getParameter('total'));},
    documentFlow:function(edges,record,kind){var flow=DocumentFlow.build(edges,{id:this.id,number:record.number||(record.snapshot&&record.snapshot.number),kind:kind});this.vm().setSizeLimit(Math.max(10000,flow.itemCount));return flow;},
    onDocumentFlowUpdate:function(e){var flow=this.vm().getProperty('/flow'),tree=e.getSource();if(!flow||!flow.roots||this.documentFlowState===flow)return;this.documentFlowState=flow;tree.collapseAll();tree.expandToLevel(2);},
    onDocumentFlowExpand:function(){var flow=this.vm().getProperty('/flow');this.documentFlowState=flow;this.byId('documentFlowTree').expandToLevel(flow.maxDepth+1);},
    onDocumentFlowCollapse:function(){this.documentFlowState=this.vm().getProperty('/flow');this.byId('documentFlowTree').collapseAll();},
    onDocumentFlowToggle:function(){this.documentFlowState=this.vm().getProperty('/flow');},
    onFlowDocument:function(e){var node=e.getSource().getBindingContext('view').getObject();this.onDocument(node.kind,node.id);},
    onHome:function(){this.route("home");},onCockpit:function(){this.route("cockpit");},onTickets:function(){this.route("tickets");},onCases:function(){this.route("cases");},onDispatch:function(){this.route("dispatch");},onPartners:function(){this.route("partners");},onAdmin:function(){this.route("admin");},onWorkflow:function(){this.route("workflow");},onRoadmap:function(){this.route("roadmap");},onNew:function(){this.route("newTicket");},
    onEstimates:function(){this.route("estimates");},onQuotes:function(){this.route("quotes");},onSalesOrders:function(){this.route("salesOrders");},onSalesProcurements:function(){this.route("salesProcurements");},onSalesFulfillments:function(){this.route("salesFulfillments");},onDocumentSettings:function(){this.route("documentSettings");},onPurchasingSetup:function(){this.route("purchasingSetup");},onSalesSetup:function(){this.route("salesSetup");},
    onInventoryCounts:function(){this.route("inventoryCounts");},
    onWarehouse:function(){this.route("warehouse");},
    onInventory:function(){this.route("inventory");},
    onAttachments:function(e){var source=e.getSource(),ctx=source.getBindingContext('view')||source.getBindingContext(),id=source.data('documentId')||(ctx&&ctx.getProperty('id'))||this.id;this.run(function(){if(!id)throw new Error('Zuerst einen Vorgang auswählen.');return attachments(this,id);});},
    onSuppliers:function(){this.route("suppliers");},
    onIncomingInvoices:function(){this.route("incomingInvoices");},
    onCustomerCredits:function(){this.route("customerCredits");},
    onBilling:function(){this.route("billing");},
    onFinance:function(){this.route("finance");},
    onOrders:function(){this.route("orders");},onCatalog:function(){this.route("catalog");},onPricing:function(){this.route("pricing");},onPlanning:function(){this.route("planning");},onServiceMaster:function(){this.route("serviceMaster");},onServiceSetup:function(){this.route("serviceSetup");},
    onDocument:function(kind,id){if(kind==="GOODS_ISSUE"){this.run(async function(){var g=await this.api("/api/inventory/issues/"+id);this.route(g.orderKind==="SALES_ORDER"?"salesDelivery":"goodsIssue",{id:id});});return;}if(kind==="SALES_ORDER"&&!this.state("/access/salesRead")&&this.state("/access/salesProcurementRead")&&!this.state("/access/salesFulfillment")){this.route("salesProcurement",{id:id});return;}if(kind==="SALES_ORDER"&&!this.state("/access/salesRead")&&this.state("/access/salesFulfillment")){this.route("salesFulfillment",{id:id});return;}if(kind==="QUOTATION"){this.run(async function(){var q=await this.api("/api/quotes/"+id);this.route(q.purpose==="SERVICE_ESTIMATE"?"estimate":"quote",{id:id});});return;}if(kind==="WORK_ORDER_TASK"){this.run(async function(){var task=await this.api("/api/service/tasks/"+id);this.route("ticket",{id:task.ticketId});});return;}var route={CREDIT_NOTE:"customerCredit",QUOTATION:"quote",SALES_ORDER:"salesOrder",INVENTORY_COUNT:"inventoryCount",STOCK_TRANSFER:"warehouseTransfer",SUPPLIER_INVOICE_REVERSAL:"supplierReversal",SUPPLIER_INVOICE:"incomingInvoice",BILLING_REQUEST:"billingRequest",INVOICE:"invoice",GOODS_RECEIPT:"goodsReceipt",GOODS_ISSUE:"goodsIssue",MATERIAL_REQUIREMENT:"procurement",REQUISITION:"procurement",PURCHASE_ORDER:"procurement",ACCOUNTING:"journal",SERVICE_ORDER:"order",SERVICE_REPORT:"report",MATERIAL:"catalog",TICKET:"ticket",SERVICE_CASE:"case",BUSINESS_PARTNER:"partner",TECHNICAL_OBJECT:"serviceMaster",SERVICE_CONTRACT:"serviceMaster",FIELD_VISIT:"planning"}[kind];if(route)this.route(route,{id:id});},
    onTicketPress:function(e){var item=e.getParameter("listItem")||e.getSource(),ctx=item.getBindingContext()||item.getBindingContext("view");if(ctx)this.route("ticket",{id:ctx.getProperty("id")});}
  });
});
