import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir,readFile } from 'node:fs/promises';
import path from 'node:path';
async function files(dir){const result=[];for(const entry of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())result.push(...await files(file));else result.push(file);}return result;}
test('Oberfläche verwendet nur OpenUI5-Standardcontrols und Standardklassen',async()=>{
  const source=await files('frontend/webapp');
  assert.ok(!source.some(f=>/\.(css|svg)$/.test(f)),'Kein eigenes CSS oder SVG.');
  const allowed=new Set(['sap.m','sap.f','sap.f.cards','sap.ui.layout','sap.ui.layout.form','sap.ui.core','sap.ui.core.mvc']);
  for(const file of source){
    const text=await readFile(file,'utf8');
    if(file.endsWith('.xml')){
      for(const [,namespace] of text.matchAll(/xmlns(?::\w+)?="([^"]+)"/g))assert.ok(allowed.has(namespace),file+': '+namespace);
      for(const [,classes] of text.matchAll(/class="([^"]*)"/g))assert.ok(classes.split(/\s+/).every(c=>c.startsWith('sapUi')),file+': nur UI5-Standardklassen');
      assert.ok(!/html:|<HTML|<svg|<canvas|style=/.test(text),file+': keine eigenen HTML-Elemente');
    }
    if(file.endsWith('.js'))assert.ok(!/Control\.extend|Renderer|\.innerHTML\s*=|document\.createElement/.test(text),file+': kein eigener Control-Renderer');
  }
});
