sap.ui.define([],function(){
 'use strict';
 function scaled(v){if(!/^\d+(\.\d{1,6})?$/.test(String(v)))throw new Error('Menge mit höchstens sechs Nachkommastellen eingeben.');var parts=String(v).split('.');return BigInt(parts[0])*1000000n+BigInt((parts[1]||'').padEnd(6,'0'));}
 return {positive:function(v){return scaled(v)>0n;},min:function(a,b){return scaled(a)<=scaled(b)?String(a):String(b);}};
});
