sap.ui.define(['sap/m/Dialog','sap/m/Button','sap/m/Label','sap/m/Text','sap/ui/core/Title','sap/ui/layout/form/SimpleForm','netfusion/erp/util/Workspace'],function(Dialog,Button,Label,Text,Title,SimpleForm,Workspace){
 'use strict';
 return function(controller,item,order,internal){
  var f=controller.formatter,content=[],dialog;
  function field(label,value){content.push(new Label({text:label}),new Text({text:value||'—',wrapping:true}));}
  content.push(new Title({text:'Positionsdaten'}));
  field('Artikel',item.product.sku+' · '+item.product.name);field('Beschreibung',item.description);
  field('Überposition',String(item.parentPosition||'—'));field('Kundenmaterial',item.customerMaterial);
  field('Geplante Menge',f.decimal(item.quantity)+' '+item.unit);field('Abrechnung',f.billingRule(item.billingRule));
  field('Einzelpreis netto',f.unitPrice(item.unitNet)+' '+order.currency);field('Nettowert',f.currencyValue(item.net,order.digits)+' '+order.currency);
  field('Steuer',f.decimal(item.taxRate)+' % · '+f.currencyValue(item.tax,order.digits)+' '+order.currency);
  field('Bruttowert',f.currencyValue(item.gross,order.digits)+' '+order.currency);field('Wunschtermin',f.dateOnly(item.requestedOn));
  content.push(new Title({text:'Texte und Sperren'}));field('Positionstext',item.itemText);field('Liefersperre',item.deliveryBlock);field('Fakturasperre',item.billingBlock);field('Absagegrund',item.rejectionReason);
  if(internal){content.push(new Title({text:'Kontierung'}));field('Kostenstelle',item.costCenter);field('Kostenträger',item.costObject);field('Profitcenter',item.profitCenter);field('Projekt',item.projectReference);}
  var buttons=(order.canEdit?[new Button({text:'Position bearbeiten',type:'Emphasized',press:function(){dialog.close();controller.editItem(item);}})]:[]).concat([new Button({text:'Zurück zum Vorgang',press:function(){dialog.close();}})]);dialog=Workspace.open(controller,{title:'Positionsdetails · '+item.position+' · '+item.product.sku,content:[new SimpleForm({layout:'ResponsiveGridLayout',columnsXL:2,columnsL:2,columnsM:1,editable:false,content:content})],buttons:buttons});return dialog;
 };
});
