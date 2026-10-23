sap.ui.define(["netfusion/erp/controller/Base.controller","netfusion/erp/util/FormDialog","netfusion/erp/util/MaterialPlanDialog","netfusion/erp/util/DeliveryDialog"],function(Base,form,materialPlanDialog,deliveryDialog){
 "use strict";
 return Base.extend("netfusion.erp.controller.Order",{
  onInit:function(){this.model({order:{items:[],totals:{},context:{}},material:{items:[],summary:{positions:0,ready:0,withoutStock:0},reservations:[]},procurement:{requirements:[],requisitions:[],purchaseOrders:[],receipts:[]},products:[],flow:[],trace:[]});this.vm().setSizeLimit(10000);this.getOwnerComponent().getRouter().getRoute("order").attachPatternMatched(function(e){this.id=e.getParameter("arguments").id;this.load();},this);},
  load:async function(){if(!await this.guard("orders"))return;return this.run(async function(){
   var result=this.materialResult;this.materialResult=null;var id=this.id,userId=this.state('/user/id'),canRead=this.state('/access/requisitionRead'),r=await Promise.all([
    this.api('/api/service/orders/'+id),this.api('/api/service/orders/'+id+'/execution'),this.api('/api/documents/'+id+'/flow'),
    canRead?this.api('/api/service/orders/'+id+'/procurement'):Promise.resolve({requirements:[],requisitions:[],purchaseOrders:[],receipts:[]}),
    canRead?this.api('/api/service/orders/'+id+'/material-planning'):Promise.resolve({items:[],summary:{positions:0,ready:0},reservations:[]}),
    this.state('/access/orderWrite')?this.api('/api/catalog/products'):Promise.resolve([]),canRead?this.api('/api/service/orders/'+id+'/deliveries'):Promise.resolve([])
   ]);if(this.id!==id||this.state('/user/id')!==userId)return;
   var o=r[0],execution=r[1],material=r[4],trace=[],canPlan=this.state('/access/inventoryReserve')&&['RELEASED','IN_PROGRESS'].includes(o.status)&&!execution.reports.some(function(x){return x.isFinal&&!['REJECTED','CANCELLED'].includes(x.status);});
   if(!canRead)material.status=o.materialStatus||'NOT_REQUIRED';
   o.items.forEach(function(i){(i.priceSnapshot&&i.priceSnapshot.trace||[]).forEach(function(t){trace.push(Object.assign({position:i.position},t));});i.actualQuantity=(execution.actual.find(function(a){return a.itemId===i.id;})||{}).quantity||'0';var m=material.items.find(function(m){return m.id===i.id;});if(m)i.supplyStatus=m.supplyStatus;});
   material.items.forEach(function(i){i.noStock=i.kind==='STOCK'&&Number(i.availableQuantity)===0&&Number(i.reservedQuantity)+Number(i.consumedQuantity||0)<Number(i.quantity);i.canUseStock=canPlan&&i.kind==='STOCK';i.hasUsableStock=!!material.companyId&&Number(i.availableQuantity)>0&&Number(i.physicalShortageQuantity)>0;i.canDeliver=canPlan&&this.state('/access/inventoryIssue')&&execution.deliveryTaskCount>0&&Number(i.reservedQuantity)>0;i.canRequest=canPlan&&this.state('/access/requisitionWrite');i.hasUnrequestedNeed=!!material.companyId&&Number(i.uncoveredQuantity)>0;},this);material.reservations.forEach(function(r){r.canRelease=canPlan&&r.status==='ACTIVE';});
   this.vm().setData({order:o,execution:execution,material:material,procurement:r[3],deliveries:r[6],flow:this.documentFlow(r[2],o,'SERVICE_ORDER'),trace:trace,products:r[5].filter(function(p){return p.status==='ACTIVE'&&p.organizationId===o.organizationId;}),canSubmit:this.state('/access/orderWrite')&&['DRAFT','REJECTED'].includes(o.status),canEdit:this.state('/access/orderWrite')&&!o.sourceSalesOrderId&&['DRAFT','REJECTED'].includes(o.status),canMaterial:canPlan,canDeliver:canPlan&&this.state('/access/inventoryIssue'),hasDeliverable:execution.deliveryTaskCount>0&&material.items.some(function(i){return Number(i.reservedQuantity)>0;}),deliveryNeedsTask:canPlan&&this.state('/access/inventoryIssue')&&!execution.deliveryTaskCount&&material.items.some(function(i){return Number(i.reservedQuantity)>0;}),canRequestParts:canPlan&&this.state('/access/requisitionWrite'),hasUnrequestedNeed:material.items.some(function(i){return i.hasUnrequestedNeed;}),hasUsableStock:material.items.some(function(i){return i.hasUsableStock;}),materialResult:result||null,ownTimer:!!execution.timer&&execution.timer.orderId===id,reportSummary:execution.reports.filter(function(r){return r.status==='APPROVED';}).length+' / '+execution.reports.length});
  });},
  onSourceSalesOrder:function(){this.route('salesOrder',{id:this.vm().getProperty('/order/sourceSalesOrderId')});},
  onAddItem:function(){this.run(function(){var o=this.vm().getProperty("/order"),products=this.vm().getProperty("/products");if(!products.length)throw new Error("Zuerst einen Artikel anlegen und freigeben.");var rules=[{key:"NON_BILLABLE",text:"Nicht fakturierbar"}];if(!["WARRANTY","INTERNAL","GOODWILL"].includes(o.kind))rules=[{key:"TIME_MATERIAL",text:"Zeit und Material"},{key:"FIXED_PRICE",text:"Festpreis"}].concat(rules);
   form(this,"Auftragsposition anlegen",[{key:"productId",label:"Artikel",type:"select",options:products.map(function(p){return {key:p.id,text:p.sku+" · "+p.name};})},{key:"description",label:"Positionsbeschreibung",required:true},{key:"quantity",label:"Geplante Menge",required:true},{key:"requiredOn",label:"Bedarfstermin (Material)",type:"date",nullable:true},{key:"billingRule",label:"Abrechnungsregel",type:"select",options:rules},{key:"costCenter",label:"Kostenstelle",required:true},{key:"costObject",label:"Kostenträger",required:true}],async function(data,key){data.version=o.version;await this.api("/api/service/orders/"+this.id+"/items",{method:"POST",key:key,body:data});},{page:true});
  });},
  onSubmit:function(){this.run(async function(){await this.api("/api/workflow/submit/"+this.id,{method:"POST",key:crypto.randomUUID(),body:{version:this.vm().getProperty("/order/version")}});this.load();});},
  onTicketWork:function(){var ids=this.vm().getProperty("/execution/ticketIds");if(ids.length)this.route("ticket",{id:ids[0]});},
  onTimeTicket:function(e){this.route("ticket",{id:e.getSource().getBindingContext("view").getProperty("ticketId")});},
  onReport:function(e){this.route("report",{id:e.getSource().getBindingContext("view").getProperty("id")});},
  onDeliver:function(e){var ctx=e.getSource().getBindingContext('view');deliveryDialog(this,this.id,ctx&&ctx.getObject());},
  onGoodsIssue:function(e){this.route('goodsIssue',{id:e.getSource().getBindingContext('view').getProperty('id')});},
  onUseStock:function(e){var ctx=e.getSource().getBindingContext('view');materialPlanDialog(this,'USE_STOCK',ctx&&ctx.getObject());},
  onRequestParts:function(e){var ctx=e.getSource().getBindingContext('view');materialPlanDialog(this,'REQUEST_PARTS',ctx&&ctx.getObject());},
  onReleaseReservation:function(e){var r=e.getSource().getBindingContext('view').getObject();form(this,'Reservierung freigeben',[{key:'reason',label:'Begründung',type:'textarea',required:true}],async function(data,key){data.version=r.version;await this.api('/api/service/orders/'+this.id+'/reservations/'+r.id+'/release',{method:'POST',key:key,body:data});});},
  onCase:function(){this.route('case',{id:this.vm().getProperty('/order/caseId')});},
  onGoodsReceipt:function(e){this.route("goodsReceipt",{id:e.getSource().getBindingContext("view").getProperty("id")});},
  onProcurement:function(e){this.route('procurement',{id:e.getSource().getBindingContext('view').getProperty('id')});},
  onComplete:function(){this.run(async function(){await this.api("/api/service/orders/"+this.id+"/complete",{method:"POST",key:crypto.randomUUID(),body:{version:this.vm().getProperty("/order/version")}});this.load();});},
  onBillingRequest:function(){this.route("billingSource",{id:this.id});},
  onBillingReady:function(){this.run(async function(){await this.api("/api/service/orders/"+this.id+"/billing-ready",{method:"POST",key:crypto.randomUUID(),body:{version:this.vm().getProperty("/order/version")}});this.load();});},

 });
});
