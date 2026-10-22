sap.ui.define([],function(){
  "use strict";
  var status={DRAFT:"Entwurf",SUBMITTED:"Eingereicht",IN_REVIEW:"In Prüfung",APPROVED:"Freigegeben",REJECTED:"Abgelehnt",PENDING:"In Genehmigung",INFORMATION_REQUIRED:"Rückfrage",NEW:"Neu",QUALIFYING:"Qualifizierung",ASSIGNED:"Zugewiesen",IN_PROGRESS:"In Bearbeitung",WAITING_CUSTOMER:"Wartet auf Kunde",WAITING_MATERIAL:"Wartet auf Material",WAITING_VENDOR:"Wartet auf Hersteller",TECHNICALLY_RESOLVED:"Technisch gelöst",COMMERCIALLY_CLOSED:"Kaufmännisch abgeschlossen",CLOSED:"Geschlossen",ESCALATED:"Eskaliert",CANCELLED:"Storniert",REOPENED:"Wiedereröffnet",OPEN:"Offen",ACTIVE:"Aktiv",BLOCKED:"Gesperrt"};
  var types={INCIDENT:"Störung",SERVICE_REQUEST:"Serviceanfrage",PROBLEM:"Problem",CHANGE:"Änderung",MAINTENANCE:"Wartung",REPAIR:"Reparatur",INSTALLATION:"Installation",COMPLAINT:"Reklamation",WARRANTY:"Garantie",INTERNAL:"Interner IT-Auftrag"};
  var priority={LOW:"Niedrig",MEDIUM:"Normal",HIGH:"Hoch",CRITICAL:"Kritisch"};
  var roles={SERVICE_MANAGER:"Serviceleitung",FIELD_TECHNICIAN:"Field-Service-Techniker",MASTER_DATA:"Stammdatenverwaltung",BUYER:"Einkauf",PURCHASING_MANAGER:"Einkaufsleitung",WAREHOUSE:"Lager",SALES:"Vertrieb",BILLING:"Faktura",ACCOUNTANT:"Buchhaltung",CONTROLLER:"Controlling",EXECUTIVE:"Geschäftsführung",ADMIN:"Administration",DISPATCHER:"Disposition",SUPPORT:"IT-Support",TECHNICIAN:"Techniker",CUSTOMER:"Kundenbenutzer"};
  return {
    status:function(v){return status[v]||v;},type:function(v){return types[v]||v;},priority:function(v){return priority[v]||v;},role:function(v){return roles[v]||v;},
    statusState:function(v){return ["ESCALATED","CANCELLED","BLOCKED"].includes(v)?"Error":["IN_PROGRESS","ASSIGNED","QUALIFYING"].includes(v)?"Information":["CLOSED","TECHNICALLY_RESOLVED","ACTIVE"].includes(v)?"Success":"None";},
    priorityState:function(v){return v==="CRITICAL"?"Error":v==="HIGH"?"Warning":"None";},
    date:function(v){return v?new Date(v).toLocaleString("de-DE",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",timeZone:"Europe/Berlin"}):"–";},
    initials:function(name){return (name||"Net Fusion").split(/\s+/).filter(function(n){return /^[A-Za-zÄÖÜäöü]/.test(n);}).slice(0,2).map(function(n){return n[0];}).join("");},
    event:function(action){return {TICKET_CREATED:"Ticket angelegt",TECHNICIAN_ASSIGNED:"Techniker zugewiesen",STATUS_CHANGED:"Status geändert",SERVICE_CASE_CREATED:"Servicefall angelegt"}[action]||action;},
    eventDetail:function(detail){if(!detail)return "";return detail.from?((status[detail.from]||detail.from)+" → "+(status[detail.to]||detail.to)):detail.toStatus?(status[detail.toStatus]||detail.toStatus):detail.source==="CUSTOMER_PORTAL"?"Eingang über Kundenportal":"";},
    transitionItems:function(items){return (items||[]).map(function(s){return {key:s,text:status[s]||s};});}
  };
});
