'use strict';
const assert=require('node:assert/strict');
const C=require('../core');
for(const timestamp of [-1,.5,1e308,8640000000000001,Infinity,NaN]){
  const s=C.initialState();s.tasks=[{id:'t',title:'x',course:'',due:'',priority:'normal',done:false,createdAt:timestamp}];assert.throws(()=>C.validateState(s));
  s.tasks=[];s.sessions=[{id:'s',endedAt:timestamp,minutes:25,topic:''}];assert.throws(()=>C.validateState(s));
  s.sessions=[];s.reviews={r:{level:1,dueAt:timestamp,lastAt:1,attempts:1,lapses:0}};assert.throws(()=>C.validateState(s));
}
for(const minutes of [0,-1,.5,181]){const s=C.initialState();s.sessions=[{id:'s',endedAt:1,minutes,topic:''}];assert.throws(()=>C.validateState(s));}
for(const remainingSeconds of [-1,.5,61]){const s=C.initialState();s.timer={id:'t',status:'paused',endsAt:1,remainingSeconds,minutes:1,topic:''};assert.throws(()=>C.validateState(s));}
const s=C.initialState();s.timer={id:'t',status:'paused',endsAt:1,remainingSeconds:60,minutes:1,topic:''};assert.deepEqual(C.validateState(s),s);
for(const id of ['toString','valueOf','hasOwnProperty','toLocaleString','__defineGetter__','__lookupSetter__','__proto__','constructor','prototype']){
  const input=C.initialState();input.cards=[{id,question:'不能借用继承成员的ID',answer:'应拒绝导入',topic:'人工智能基础'}];assert.throws(()=>C.validateState(input));
  input.cards=[];input.reviews=Object.fromEntries([[id,{level:0,dueAt:1,lastAt:1,attempts:1,lapses:0}]]);assert.throws(()=>C.validateState(input));
}
console.log('State integrity checks passed: valid timestamp range/integer, completed-duration bounds, timer duration consistency and prototype-member IDs rejected.');
