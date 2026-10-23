sap.ui.define(['sap/ui/core/routing/HashChanger'],function(HashChanger){
 'use strict';
 function dispose(entry){entry.content.forEach(function(c){if(!c.bIsDestroyed)c.destroy();});entry.buttons.forEach(function(b){if(!b.bIsDestroyed)b.destroy();});Object.values(entry.models).forEach(function(m){m.destroy();});}
 return {
  open:function(controller,options){var component=controller.getOwnerComponent(),id=crypto.randomUUID(),hash=HashChanger.getInstance(),entries=component.workspaces||(component.workspaces={}),entry={id:id,sourceId:controller.id,userId:component.getModel('state').getProperty('/user/id'),title:options.title,content:options.content||[],buttons:options.buttons||[],returnHash:hash.getHash(),models:options.models||{},onCancel:options.onCancel};
   entry.ensureCurrent=function(){if(entries[id]!==entry||hash.getHash().replace(/^\//,'')!=='workspace/'+id||component.getModel('state').getProperty('/user/id')!==entry.userId||controller.id!==entry.sourceId)throw new Error('Diese Bearbeitung gehört nicht mehr zum geöffneten Vorgang. Bitte den Vorgang erneut öffnen.');};
   entry.close=function(){if(entries[id]!==entry)return;delete entries[id];if(hash.getHash().replace(/^\//,'')==='workspace/'+id)hash.replaceHash(entry.returnHash);setTimeout(function(){dispose(entry);},0);};entries[id]=entry;component.getRouter().navTo('workspace',{id:id});return entry;
  },
  clear:function(component){Object.values(component.workspaces||{}).forEach(dispose);component.workspaces={};}
 };
});
