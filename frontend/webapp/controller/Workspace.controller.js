sap.ui.define(['netfusion/erp/controller/Base.controller','sap/m/MessageStrip','sap/m/Button'],function(Base,MessageStrip,Button){
 'use strict';return Base.extend('netfusion.erp.controller.Workspace',{
  onInit:function(){this.model({title:'Bearbeitung'});this.getOwnerComponent().getRouter().getRoute('workspace').attachPatternMatched(this.load,this);},
  load:async function(e){if(!await this.guard())return;var id=e.getParameter('arguments').id,entry=(this.getOwnerComponent().workspaces||{})[id],body=this.byId('workspaceContent'),actions=this.byId('workspaceActions');body.removeAllItems();actions.removeAllContent();this.entry=null;
   if(!entry||entry.userId!==this.state('/user/id')){this.vm().setProperty('/title','Bearbeitung nicht mehr geöffnet');body.addItem(new MessageStrip({text:'Diese Bearbeitung wurde abgeschlossen, abgebrochen oder gehört zu einer beendeten Sitzung. Den Vorgang erneut über die App-Zentrale öffnen.',showIcon:true}));actions.addContent(new Button({text:'App-Zentrale',press:this.onHome.bind(this)}));return;}
   this.entry=entry;this.vm().setProperty('/title',entry.title);Object.keys(entry.models).forEach(function(name){body.setModel(entry.models[name],name);});entry.content.forEach(function(c){body.addItem(c);});entry.buttons.forEach(function(b){actions.addContent(b);});
  },
  onBack:function(){if(this.entry)this.entry.close();else this.onHome();}
 });
});
