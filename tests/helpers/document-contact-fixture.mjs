import {cmd,ok} from './service-fixture.mjs';
export const testDocumentContact={firstName:'Martina',lastName:'Musterfrau',email:'martina.musterfrau@example.test',phone:'+4930123456'};
export async function configureDocumentContact(admin,companyId){const p=ok(await admin('/api/document-settings'),200).find(c=>c.id===companyId);if(!p?.active)ok(await admin('/api/document-settings/'+companyId,{...cmd({version:p?.version||0,...testDocumentContact,active:true,reason:'Explizite Ansprechpartnerin der isolierten Testgesellschaft.'}),method:'PUT'}),200);}
