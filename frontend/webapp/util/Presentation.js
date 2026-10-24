sap.ui.define(['sap/ui/Device','netfusion/erp/util/TableTools'],function(Device,Tables){
 'use strict';var configured=new WeakSet();
 return {apply:function(controller){var view=controller.getView();view.toggleStyleClass('sapUiSizeCompact',!Device.system.phone);view.toggleStyleClass('sapUiSizeCozy',Device.system.phone);view.findAggregatedObjects(true).forEach(function(c){var owner=c;while(owner&&!owner.isA('sap.ui.core.mvc.View'))owner=owner.getParent();if(owner!==view)return;
  if(c.isA('sap.m.Table')){Tables.prepare(controller,c);if(!configured.has(c)){c.setAutoPopinMode(true);c.setPopinLayout('GridSmall');c.setAlternateRowColors(true);c.setSticky(['HeaderToolbar','ColumnHeaders']);c.getColumns().forEach(function(column,n){column.setAutoPopinWidth(n===0?20:9);if(!column.getBindingInfo('importance'))column.setImportance(n===0?'High':'Medium');var h=column.getHeader();if(h&&h.setWrapping)h.setWrapping(false);});}}
  if(configured.has(c))return;configured.add(c);
  if(c.isA('sap.ui.layout.form.SimpleForm')&&view.getViewName()!=='netfusion.erp.view.Login'){c.setWidth('100%');c.setAdjustLabelSpan(false);c.setEmptySpanXL(0);c.setEmptySpanL(0);c.setEmptySpanM(0);if(c.getContent().filter(function(x){return x.isA('sap.ui.core.Title');}).length>1){c.setColumnsXL(3);c.setColumnsL(2);c.setColumnsM(1);c.setLabelSpanXL(4);c.setLabelSpanL(4);c.setLabelSpanM(3);}}
  if(c.isA('sap.m.Dialog')){c.setStretch(Device.system.phone);c.setResizable(true);}
  if(c.isA('sap.m.DateTimePicker')){if(!/^dd\.MM\.yyyy/.test(c.getDisplayFormat()))c.setDisplayFormat('dd.MM.yyyy HH:mm:ss');}else if(c.isA('sap.m.DatePicker'))c.setDisplayFormat('dd.MM.yyyy');
  if(c.isA('sap.m.Text')){var b=c.getBindingInfo('text');if(b&&b.parts&&b.parts.some(function(p){return /(?:Date|At|On|Until|From|To|date)$/.test(p.path||'');}))c.setWrapping(false);}
 });}};
});
