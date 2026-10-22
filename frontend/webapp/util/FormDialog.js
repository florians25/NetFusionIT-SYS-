sap.ui.define(["sap/m/Dialog","sap/m/Input","sap/m/TextArea","sap/m/DatePicker","sap/m/DateTimePicker","sap/m/MultiComboBox","sap/m/Select","sap/m/Label","sap/m/Button","sap/ui/core/Item","sap/ui/layout/form/SimpleForm","sap/m/MessageToast"],function(Dialog,Input,TextArea,DatePicker,DateTimePicker,MultiComboBox,Select,Label,Button,Item,SimpleForm,Toast){
 "use strict";
 return function(controller,title,fields,save){
  var controls={},content=[];
  fields.forEach(function(f){var c;
   if(f.type==="select")c=new Select({width:"100%",selectedKey:f.value||f.options[0]&&f.options[0].key||"",items:f.options.map(function(o){return new Item({key:o.key,text:o.text});})});
   else if(f.type==="multiselect")c=new MultiComboBox({width:"100%",selectedKeys:f.value||[],items:f.options.map(function(o){return new Item({key:o.key,text:o.text});})});
   else if(f.type==="datetime")c=new DateTimePicker({width:"100%",displayFormat:"dd.MM.yyyy HH:mm:ss",dateValue:f.value?new Date(f.value):null});
   else if(f.type==="date")c=new DatePicker({width:"100%",valueFormat:"yyyy-MM-dd",displayFormat:"medium",value:f.value||""});
   else if(f.type==="textarea")c=new TextArea({width:"100%",rows:4,value:f.value||""});
   else if(f.type==="boolean")c=new Select({width:"100%",selectedKey:f.value?"true":"false",items:(f.options||[{key:"true",text:"Ja"},{key:"false",text:"Nein"}]).map(function(o){return new Item({key:o.key,text:o.text});})});
   else c=new Input({width:"100%",value:f.value===undefined?"":String(f.value),type:f.type==="integer"?"Number":"Text",placeholder:f.placeholder||"",maxLength:f.maxLength||2000});
   controls[f.key]=c;content.push(new Label({text:f.label,labelFor:c,required:!!f.required}),c);
  });
  var signature,key;
  var dialog=new Dialog({title:title,contentWidth:"720px",content:[new SimpleForm({editable:true,layout:"ResponsiveGridLayout",content:content})],beginButton:new Button({text:"Speichern",type:"Emphasized",press:function(){dialog.setBusyIndicatorDelay(0);dialog.setBusy(true);dialog.getBeginButton().setEnabled(false);controller.run(async function(){try{var data={};fields.forEach(function(f){var c=controls[f.key],v=f.type==="select"?c.getSelectedKey():f.type==="multiselect"?c.getSelectedKeys():f.type==="boolean"?c.getSelectedKey()==="true":f.type==="datetime"?(c.getDateValue()?c.getDateValue().toISOString():null):c.getValue();data[f.key]=f.nullable&&!v?null:f.type==="integer"?(v.trim()?Number(v):null):v;});var next=JSON.stringify(data);if(next!==signature){signature=next;key=crypto.randomUUID();}await save.call(controller,data,key);dialog.close();Toast.show("Gespeichert");controller.load();}finally{dialog.setBusy(false);dialog.getBeginButton().setEnabled(true);}});}}),endButton:new Button({text:"Abbrechen",press:function(){dialog.close();}}),afterClose:function(){dialog.destroy();}});controller.getView().addDependent(dialog);dialog.open();return {dialog:dialog,controls:controls};
 };
});
