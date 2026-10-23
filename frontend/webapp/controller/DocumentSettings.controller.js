sap.ui.define(['netfusion/erp/controller/Base.controller','netfusion/erp/util/FormDialog'],function(Base,form){
 'use strict';return Base.extend('netfusion.erp.controller.DocumentSettings',{
  onInit:function(){this.model({companies:[]});this.getOwnerComponent().getRouter().getRoute('documentSettings').attachPatternMatched(this.load,this);},
  load:async function(){if(!await this.guard('documentConfigRead'))return;return this.run(async function(){this.vm().setProperty('/companies',await this.api('/api/document-settings'));});},
  onEdit:function(e){var c=e.getSource().getBindingContext('view').getObject();form(this,'Dokumentansprechpartner · '+c.code,[
   {key:'firstName',label:'Vorname',value:c.firstName,required:true,maxLength:60,section:'Ansprechpartner im Belegkopf'},
   {key:'lastName',label:'Nachname',value:c.lastName,required:true,maxLength:80},
   {key:'email',label:'E-Mail',value:c.email,required:true,maxLength:160},
   {key:'phone',label:'Telefon',value:c.phone,maxLength:50},
   {key:'active',label:'Für neue Geschäftsunterlagen aktiv',type:'boolean',value:c.version?c.active:true,section:'Verwendung und Nachweis'},
   {key:'reason',label:'Änderungsgrund',type:'textarea',required:true}
  ],async function(body,key){body.version=c.version;await this.api('/api/document-settings/'+c.id,{method:'PUT',key:key,body:body});},{page:true});}
 });
});
