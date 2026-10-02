'use strict';
const assert=require('node:assert/strict');
const C=require('../core');
const s=C.initialState(),text=n=>'\u0000'.repeat(n),id=(prefix,i)=>(prefix+i).padEnd(100,'a'),stamp=8640000000000000;
// An escaped code unit can require six UTF-8 bytes in JSON. IDs remain ASCII.
s.tasks=Array.from({length:1000},(_,i)=>({id:id('task',i),title:text(300),course:text(100),due:'9999-12-31',priority:'normal',done:false,createdAt:stamp}));
s.cards=Array.from({length:500},(_,i)=>({id:id('card',i),question:text(1000),answer:text(4000),topic:text(100)}));
s.sessions=Array.from({length:5000},(_,i)=>({id:id('session',i),endedAt:stamp,minutes:180,topic:text(300)}));
s.experiences=Array.from({length:1000},(_,i)=>({id:id('experience',i),title:text(300),category:'学生工作',date:'9999-12-31',detail:text(4000),evidence:text(1000)}));
s.reviews=Object.fromEntries(Array.from({length:1000},(_,i)=>[id('review',i),{level:6,dueAt:stamp,lastAt:stamp,attempts:1000000,lapses:1000000}]));
s.drafts=text(30000);s.settings={focusMinutes:180,name:text(100)};s.timer={id:id('timer',0),status:'running',endsAt:stamp,remainingSeconds:10800,minutes:180,topic:text(300)};
C.validateState(s);
const bytes=Buffer.byteLength(JSON.stringify({...s,exportedAt:new Date().toISOString()},null,2));assert.ok(bytes<C.BACKUP_FILE_LIMIT,`${bytes} exceeds ${C.BACKUP_FILE_LIMIT}`);
console.log(`Backup size bound passed: all field/count maxima with six-byte escaping produce ${bytes} bytes, within the ${C.BACKUP_FILE_LIMIT}-byte import limit.`);
