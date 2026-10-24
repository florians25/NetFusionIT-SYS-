// randomUUID is restricted to secure contexts. getRandomValues remains available
// on explicit HTTP test installations and supplies the same 122 random UUID bits.
sap.ui.define([],function(){
 'use strict';
 if(typeof crypto.randomUUID!=='function')crypto.randomUUID=function(){
  var bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  var hex=Array.from(bytes,function(b){return b.toString(16).padStart(2,'0');}).join('');
  return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
 };
 return {};
});
