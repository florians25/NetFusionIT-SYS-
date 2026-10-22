import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calendarSchema,addBusinessMinutes,businessMilliseconds } from '../dist/calendar.js';
const weekdays={timeZone:'Europe/Berlin',weekly:[1,2,3,4,5].map(day=>({day,start:'08:00',end:'16:00'})),holidays:[]};
const always={timeZone:'Europe/Berlin',weekly:[1,2,3,4,5,6,7].map(day=>({day,start:'00:00',end:'24:00'})),holidays:[]};
test('Geschäftszeiten überspringen Wochenende und rechnen über den Winterzeitwechsel korrekt',()=>{assert.equal(addBusinessMinutes('2026-10-23T13:30:00Z',60,weekdays),'2026-10-26T07:30:00.000Z');});
test('Feiertage und geteilte Arbeitszeitfenster pausieren die Geschäftszeit',()=>{
 assert.equal(addBusinessMinutes('2026-10-23T13:30:00Z',60,{...weekdays,holidays:['2026-10-26']}),'2026-10-27T07:30:00.000Z');
 const split={timeZone:'UTC',weekly:[{day:1,start:'08:00',end:'12:00'},{day:1,start:'13:00',end:'17:00'}],holidays:[]};
 assert.equal(addBusinessMinutes('2026-10-26T11:30:00Z',60,split),'2026-10-26T13:30:00.000Z');
});
test('24-Stunden-Kalender zählen echte Zeit trotz Sommerzeitlücke und doppelter Herbststunde',()=>{
 assert.equal(addBusinessMinutes('2026-03-29T00:30:00Z',120,always),'2026-03-29T02:30:00.000Z');
 assert.equal(addBusinessMinutes('2026-10-25T00:30:00Z',120,always),'2026-10-25T02:30:00.000Z');
});
test('Pausierte Geschäftsdauer ist reproduzierbar und erhält Millisekunden',()=>{
 assert.equal(businessMilliseconds('2026-10-23T13:30:00Z','2026-10-26T08:00:00Z',weekdays),90*60000);
 assert.equal(businessMilliseconds('2026-10-22T08:00:00.123Z','2026-10-22T08:00:01.456Z',always),1333);
});
test('Überlappende Fenster, ungültige Zeitzonen und negative Dauern werden abgewiesen',()=>{
 assert.equal(calendarSchema.safeParse({...weekdays,timeZone:'Mars/Base'}).success,false);
 assert.equal(calendarSchema.safeParse({...weekdays,weekly:[{day:1,start:'08:00',end:'12:00'},{day:1,start:'11:00',end:'14:00'}]}).success,false);
 assert.throws(()=>addBusinessMinutes('2026-10-22T08:00:00Z',-1,always));
});
