'use strict';
const assert=require('node:assert/strict');
const C=require('../core');
const reference=require('./metrics-reference.json');
for(const {counts,metrics} of reference.cases){const actual=C.classificationMetrics(counts);for(const [key,value] of Object.entries(metrics)){if(value===null)assert.equal(actual[key],null,`${key} zero denominator`);else assert.ok(Math.abs(actual[key]-value)<1e-12,`${key} ${JSON.stringify(counts)}`);}assert.equal(actual.total,actual.actualPositive+actual.actualNegative);assert.equal(actual.total,actual.predictedPositive+actual.predictedNegative);}
const majority=C.classificationMetrics({tp:0,fp:0,fn:10,tn:990});assert.equal(majority.accuracy,.99);assert.equal(majority.recall,0);assert.equal(majority.precision,null);assert.equal(majority.f1,0);assert.equal(majority.balancedAccuracy,.5);
const recovered=C.classificationMetrics({tp:8,fp:12,fn:2,tn:978});assert.equal(recovered.accuracy,.986);assert.equal(recovered.recall,.8);assert.equal(recovered.precision,.4);assert.equal(recovered.f1,16/30);
for(const value of [-1,.5,1e9+1,'1',Infinity,NaN,undefined])assert.throws(()=>C.classificationMetrics({tp:value,fp:0,fn:0,tn:0}));assert.throws(()=>C.classificationMetrics(null));
const large=C.classificationMetrics({tp:1e9,fp:1e9,fn:1e9,tn:1e9});assert.equal(large.total,4e9);assert.equal(large.f1,.5);
const empty=C.classificationMetrics({tp:0,fp:0,fn:0,tn:0});for(const key of ['accuracy','precision','recall','f1','specificity','balancedAccuracy','prevalence','majorityBaseline'])assert.equal(empty[key],null);
console.log(`Metric checks passed: ${reference.cases.length} count matrices agree with independent sklearn precision/recall/F1/accuracy and supported two-class balanced accuracy; undefined denominators and input limits verified.`);
