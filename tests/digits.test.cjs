'use strict';
const assert=require('node:assert/strict'),C=require('../core');require('../digits-model');
const M=globalThis.DigitsModel,references=require('./digits-reference.json');let maxError=0;
for(const r of references)for(const kind of ['linear','network']){const actual=C.classifyDigit(r.pixels,M,kind),expected=r[kind];assert.equal(actual.prediction,expected.indexOf(Math.max(...expected)));assert.ok(Math.abs(actual.probabilities.reduce((a,b)=>a+b,0)-1)<1e-12);for(let i=0;i<10;i++)maxError=Math.max(maxError,Math.abs(actual.probabilities[i]-expected[i]));}
assert.ok(maxError<1e-7,`Python/JS probability mismatch ${maxError}`);assert.throws(()=>C.classifyDigit([1],M));assert.throws(()=>C.classifyDigit(Array(64).fill(NaN),M));assert.throws(()=>C.classifyDigit(Array(64).fill(17),M));
for(const sample of M.mistakes)assert.notEqual(C.classifyDigit(sample.pixels,M,'network').prediction,sample.label);
assert.equal(M.metadata.testSamples,360);assert.equal(M.metadata.testUsedForModelSelection,false);
console.log(`Digit model checks passed: 200 forward passes match Python, maximum probability error ${maxError.toExponential(3)}; ${M.mistakes.length} real mistakes reproduced.`);
