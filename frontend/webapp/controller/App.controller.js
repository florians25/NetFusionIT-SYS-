sap.ui.define(["netfusion/erp/controller/Base.controller","sap/m/ActionSheet","sap/m/Button","sap/m/MessageBox"],function(Base,ActionSheet,Button,MessageBox){
  "use strict";
  return Base.extend("netfusion.erp.controller.App",{
    onInit:function(){this.getOwnerComponent().getRouter().attachRouteMatched(this.onRoute,this);},
    onRoute:function(e){
      var name=e.getParameter("name"),group,title,tabs=[],selected=name;
      if(["cockpit","tickets","newTicket","ticket","cases","case"].includes(name)){
        group="service";title="Service Desk";tabs=[{key:"cockpit",text:"Service-Cockpit"},{key:"tickets",text:"Tickets"},{key:"cases",text:"Servicefälle"}];selected=["ticket","newTicket"].includes(name)?"tickets":name==="case"?"cases":name;
      }else if(["salesOrders","salesOrder","salesSetup"].includes(name)){
        group="sales";title="Vertrieb & Kundenaufträge";if(this.state("/access/salesRead"))tabs.push({key:"salesOrders",text:"Kundenaufträge"});if(this.state("/access/salesConfigRead"))tabs.push({key:"salesSetup",text:"Vertriebsstammdaten"});selected=name==="salesOrder"?"salesOrders":name;
      }else if(["billing","billingSource","billingRequest","invoice"].includes(name)){
        group="billing";title="Faktura";if(this.state("/access/billingInternal"))tabs=[{key:"billing",text:"Fakturavorrat"}];selected="billing";
      }else if(["incomingInvoices","incomingInvoice","supplierReversal"].includes(name)){
        group="incoming";title="Rechnungseingang";tabs=[{key:"incomingInvoices",text:"Rechnungseingang"}];selected="incomingInvoices";
      }else if(["warehouse","warehouseTransfer","inventoryCounts","inventoryCount"].includes(name)){
        group="warehouse";title="Lagerplätze & Einlagerung";tabs=[{key:"warehouse",text:"Lagerarbeitsplatz"},{key:"inventoryCounts",text:"Inventuren"}];selected=["inventoryCounts","inventoryCount"].includes(name)?"inventoryCounts":"warehouse";
      }else if(["dispatch","planning"].includes(name)){
        group="dispatch";title="Disposition & Einsätze";if(this.state("/access/assign"))tabs.push({key:"dispatch",text:"Ticketzuweisung"});tabs.push({key:"planning",text:"Einsatzplanung"});
      }else{
        group=name;title={inventory:"Lager & Materialbewegungen",goodsReceipt:"Wareneingang",goodsIssue:"Materialauslieferung",suppliers:"Lieferanten",procurement:"Auftragsbeschaffung",finance:"Finanzbuchhaltung",journal:"Finanzbuchhaltung",home:"App-Zentrale",login:"Anmeldung",serviceMaster:"Technische Objekte & Serviceverträge",serviceSetup:"Servicekonfiguration",orders:"Serviceaufträge",order:"Serviceaufträge",report:"Serviceaufträge",catalog:"Artikel & Servicekatalog",pricing:"Preisfindung",partners:"Geschäftspartner",partner:"Geschäftspartner",workflow:"Genehmigungen",admin:"Administration",roadmap:"Ausbauplan"}[name]||"App-Zentrale";
      }
      this.getOwnerComponent().getModel("state").setProperty("/navigation",{group:group,title:title,tabs:tabs,selectedKey:selected,active:!["home","login"].includes(name)});
    },
    onNav:function(e){this.route(e.getParameter("key"));},
    onProfile:function(e){
      if(!this.profile){this.profile=new ActionSheet({placement:"Bottom",buttons:[new Button({text:"Abmelden",icon:"sap-icon://log",press:this.onLogout.bind(this)})]});this.getView().addDependent(this.profile);}
      this.profile.openBy(e.getSource());
    },
    onLogout:function(){this.run(async function(){await this.api("/api/auth/logout",{method:"POST"});this.getOwnerComponent().endSession();});}
  });
});
