sap.ui.define([],function(){
 "use strict";
 // The API already authorizes both ends of every edge. Build a spanning tree
 // from the current document; retain each additional edge as a finite reference.
 function build(edges,current){
  var documents=new Map(),relations=new Map(),adjacent=new Map(),roots=[],seen=new Set(),used=new Set(),queue=[],maxDepth=0;
  function remember(id,number,kind){if(!documents.has(id)){documents.set(id,{id:id,number:number||id,kind:kind||""});adjacent.set(id,[]);}}
  (edges||[]).forEach(function(edge){
   if(!edge.sourceId||!edge.targetId)return;
   var key=JSON.stringify([edge.sourceId,edge.targetId,edge.kind]);if(relations.has(key))return;
   remember(edge.sourceId,edge.sourceNumber,edge.sourceKind);remember(edge.targetId,edge.targetNumber,edge.targetKind);
   var relation={key:key,sourceId:edge.sourceId,targetId:edge.targetId,kind:edge.kind};relations.set(key,relation);
   adjacent.get(edge.sourceId).push(relation);if(edge.targetId!==edge.sourceId)adjacent.get(edge.targetId).push(relation);
  });
  remember(current.id,current.number,current.kind);
  function node(id,relation,direction,reference){return Object.assign({},documents.get(id),{relation:relation||"",direction:direction||"",current:id===current.id,reference:!!reference,children:[]});}
  function addRoot(id){var root=node(id);roots.push(root);seen.add(id);queue.push({node:root,depth:0});}
  function visit(){for(var index=0;index<queue.length;index++){
   var entry=queue[index],parent=entry.node;
   adjacent.get(parent.id).slice().sort(function(a,b){
    var ad=a.targetId===parent.id?0:1,bd=b.targetId===parent.id?0:1;
    return ad-bd||documents.get(a.sourceId===parent.id?a.targetId:a.sourceId).number.localeCompare(documents.get(b.sourceId===parent.id?b.targetId:b.sourceId).number,"de",{numeric:true})||a.key.localeCompare(b.key);
   }).forEach(function(edge){
    if(used.has(edge.key))return;used.add(edge.key);
    var next=edge.sourceId===parent.id?edge.targetId:edge.sourceId,reference=seen.has(next),child=node(next,edge.kind,edge.sourceId===parent.id?"Nachfolger":"Vorgänger",reference);
    parent.children.push(child);maxDepth=Math.max(maxDepth,entry.depth+1);
    if(!reference){seen.add(next);queue.push({node:child,depth:entry.depth+1});}
   });
  }}
  addRoot(current.id);visit();
  // Keep authorized disconnected components if supplied; never silently drop an edge.
  documents.forEach(function(document){if(!seen.has(document.id)){queue=[];addRoot(document.id);visit();}});
  return {roots:roots,documentCount:documents.size,relationCount:relations.size,itemCount:roots.length+relations.size,maxDepth:maxDepth};
 }
 return {build:build};
});
