sap.ui.define(["netfusion/erp/controller/Base.controller","netfusion/erp/util/FormDialog","sap/ui/model/Filter","sap/ui/model/FilterOperator"],function(Base,form,Filter,Op){
 "use strict";
 var kinds=[["SERVICE","Serviceleistung"],["STOCK","Lagerartikel"],["NON_STOCK","Nichtlagerartikel"],["SOFTWARE","Software"],["LICENSE","Lizenz"],["TRAVEL","Reiseleistung"],["EXPENSE","Ausgabe"],["INTERNAL","Interne Leistung"],["MAINTENANCE","Wartung"],["EXTERNAL_SERVICE","Externe Serviceleistung"]];
 return Base.extend("netfusion.erp.controller.Catalog",{
  onInit:function(){this.model({products:[],organizations:[],currencies:[]});this.getOwnerComponent().getRouter().getRoute("catalog").attachPatternMatched(this.load,this);},
  load:async function(){if(!await this.guard("inventory"))return;this.run(async function(){var rows=await this.api("/api/catalog/products");this.vm().setData({products:rows,summary:this.summarize(rows),organizations:await this.api("/api/organization"),currencies:await this.api("/api/catalog/currencies")});});},
  onSearch:function(e){var q=e.getParameter("newValue")||e.getParameter("query")||"";this.byId("products").getBinding("items").filter(q?[new Filter({filters:[new Filter("sku",Op.Contains,q),new Filter("name",Op.Contains,q)],and:false})]:[]);},
  onNewProduct:function(){form(this,"Artikel anlegen",[
   {key:"organizationId",label:"Organisation",type:"select",options:this.vm().getProperty("/organizations").map(function(o){return {key:o.id,text:o.name};})},
   {key:"numberPrefix",label:"Nummernkreis",type:"select",nullable:true,options:[{key:"",text:"Automatisch nach Artikelart"},{key:"HW",text:"HW · Hardware"},{key:"SW",text:"SW · Software"},{key:"DL",text:"DL · Dienstleistung"},{key:"LI",text:"LI · Lizenz"},{key:"ER",text:"ER · Ersatzteil"},{key:"ZU",text:"ZU · Zubehör"}]},{key:"sku",label:"Artikelnummer",required:true},{key:"name",label:"Bezeichnung",required:true},{key:"kind",label:"Artikelart",type:"select",options:kinds.map(function(k){return {key:k[0],text:k[1]};})},{key:"unit",label:"Basiseinheit",placeholder:"z. B. HUR oder ST",required:true},{key:"taxCode",label:"Steuerkennzeichen",required:true},{key:"productGroup",label:"Artikelgruppe"},{key:"description",label:"Beschreibung",type:"textarea"}
  ],async function(data,key){await this.api("/api/catalog/products",{method:"POST",key:key,body:data});});},
  onSubmit:function(e){var p=e.getSource().getBindingContext("view").getObject();this.run(async function(){await this.api("/api/workflow/submit/"+p.id,{method:"POST",key:crypto.randomUUID(),body:{version:p.version}});this.load();});},
  onCurrency:function(){form(this,"Währung konfigurieren",[{key:"code",label:"Währungscode",required:true},{key:"digits",label:"Nachkommastellen",type:"integer",required:true}],async function(data,key){await this.api("/api/catalog/currencies",{method:"POST",key:key,body:data});});}
 });
});
