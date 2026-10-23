sap.ui.define(["netfusion/erp/controller/Base.controller","sap/m/ActionSheet","sap/m/Button","sap/m/MessageBox"],function(Base,ActionSheet,Button,MessageBox){
  "use strict";
  return Base.extend("netfusion.erp.controller.App",{
    onInit:function(){this.getOwnerComponent().getRouter().attachRouteMatched(this.onRoute,this);},
    onRoute:function(e){
      var name=e.getParameter("name"),title={quotes:"Verkaufsangebote",quote:"Verkaufsangebote",estimates:"Kostenvoranschläge",estimate:"Kostenvoranschläge",salesOrders:"Kundenaufträge",salesProcurements:"Vertriebsbeschaffung",salesProcurement:"AU-Materialversorgung",salesFulfillments:"Vertriebsauslieferungen",salesFulfillment:"Vertriebsauslieferung",salesDelivery:"Warenausgang Vertrieb",salesOrder:"Kundenaufträge",salesSetup:"Vertriebsstammdaten",cockpit:"Service-Cockpit",tickets:"Tickets",newTicket:"Ticket anlegen",ticket:"Ticketbearbeitung",cases:"Servicefälle",case:"Servicefall",dispatch:"Ticketzuweisung",planning:"Einsatzplanung",inventory:"Lager & Materialbewegungen",goodsReceipt:"Wareneingang",goodsIssue:"Materialauslieferung",warehouse:"Lagerplätze & Einlagerung",warehouseTransfer:"Lagerumlagerung",inventoryCounts:"Inventuren",inventoryCount:"Inventur",suppliers:"Lieferanten",procurement:"Auftragsbeschaffung",billing:"Fakturavorrat",billingSource:"Fakturaanforderung",billingRequest:"Fakturaanforderung",invoice:"Rechnung",incomingInvoices:"Rechnungseingang",incomingInvoice:"Eingangsrechnung",supplierReversal:"Eingangsrechnungsstorno",finance:"Finanzbuchhaltung",journal:"Finanzbeleg",home:"App-Zentrale",login:"Anmeldung",serviceMaster:"Technische Objekte & Serviceverträge",serviceSetup:"Servicekonfiguration",orders:"Serviceaufträge",order:"Serviceauftrag",report:"Servicerückmeldung",catalog:"Artikel & Servicekatalog",pricing:"Preisfindung",partners:"Geschäftspartner",partner:"Geschäftspartner",workflow:"Genehmigungen",admin:"Administration",roadmap:"Ausbauplan"}[name]||"App-Zentrale";
      this.getOwnerComponent().getModel("state").setProperty("/navigation",{group:name,title:title,tabs:[],selectedKey:"",active:!["home","login"].includes(name)});
    },
    onProfile:function(e){
      if(!this.profile){this.profile=new ActionSheet({placement:"Bottom",buttons:[new Button({text:"Abmelden",icon:"sap-icon://log",press:this.onLogout.bind(this)})]});this.getView().addDependent(this.profile);}
      this.profile.openBy(e.getSource());
    },
    onLogout:function(){this.run(async function(){await this.api("/api/auth/logout",{method:"POST"});this.getOwnerComponent().endSession();});}
  });
});
