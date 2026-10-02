'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const C=require('../core');
const start=Date.now();let functions=0,rows=0;
function independentValue(pattern,value,n){let mask=0,bits=0;for(let i=0;i<n;i++){if(pattern[i]==='-')continue;mask|=1<<(n-1-i);if(pattern[i]==='1')bits|=1<<(n-1-i);}return (value & mask)===bits;}
// Independent forward DP over truth-table unions, NOT the solver's prime-cover
// recurrence. A cube adds its whole truth mask by OR, allowing overlapping groups.
// OR can only increase the numeric mask, so ascending masks form a DAG.
// Cost = 100*terms + literals: even 16 singleton terms have <=64 literals.
function independentOptimums(n){
  const cubes=[];
  for(let code=0;code<3**n;code++){
    let v=code,fixed=0,bits=0,literals=0;
    for(let j=0;j<n;j++){const trit=v%3;v=Math.floor(v/3);if(trit!==2){fixed|=1<<j;if(trit===1)bits|=1<<j;literals++;}}
    let mask=0;for(let input=0;input<2**n;input++)if((input&fixed)===bits)mask|=1<<input;
    cubes.push({mask,cost:100+literals});
  }
  const costs=new Uint16Array(2**(2**n));costs.fill(65535);costs[0]=0;
  for(let mask=0;mask<costs.length;mask++)for(const cube of cubes){const next=mask|cube.mask;if(next!==mask)costs[next]=Math.min(costs[next],costs[mask]+cube.cost);}
  return costs;
}
const optimal4=independentOptimums(4),optimal3=independentOptimums(3);
assert.equal(optimal4[0],0);assert.equal(optimal4[65535],100);assert.equal(optimal4[1],104);
for(let truth=0;truth<65536;truth++){
  const ones=[];for(let i=0;i<16;i++)if(truth & (1<<i))ones.push(i);
  const r=C.minimize(4,ones);assert.ok(r.verified);
  assert.equal(r.selected.length*100+r.literals,optimal4[truth],`Independent optimal cost for truth mask ${truth}`);
  for(let i=0;i<16;i++){assert.equal(r.selected.some(g=>independentValue(g.pattern,i,4)),Boolean(truth & (1<<i)));rows++;}
  for(const g of r.selected){assert.ok([1,2,4,8,16].includes(g.cells.length));assert.ok(g.cells.every(i=>ones.includes(i)));}
  functions++;
  if(functions%8192===0)console.log(`Verified ${functions}/65536 four-variable functions`);
}
// 三变量每个输入取0、1、无关项，覆盖所有3^8种输入约束。
let ternary=0;
for(let code=0;code<6561;code++){
  const ones=[],dc=[];let v=code;for(let i=0;i<8;i++){const trit=v%3;v=Math.floor(v/3);if(trit===1)ones.push(i);else if(trit===2)dc.push(i);}
  const r=C.minimize(3,ones,dc);for(let i=0;i<8;i++)if(!dc.includes(i)){assert.equal(r.selected.some(g=>independentValue(g.pattern,i,3)),ones.includes(i));rows++;}
  const onesMask=ones.reduce((mask,i)=>mask|(1<<i),0);let best=65535;
  for(let choice=0;choice<2**dc.length;choice++){let mask=onesMask;for(let j=0;j<dc.length;j++)if(choice&(1<<j))mask|=1<<dc[j];best=Math.min(best,optimal3[mask]);}
  assert.equal(r.selected.length*100+r.literals,best,`Independent optimal cost for ternary constraint ${code}`);ternary++;
}
const report={fourVariableFunctions:functions,threeVariableTernaryConstraints:ternary,truthRowsIndependentlyChecked:rows,optimalCostsIndependentlyChecked:functions+ternary,independentOptimalityMethod:'Forward DP over all truth-mask unions of elementary cubes; 100*terms+literals. Ternary constraints minimize over all allowed completions.',elapsedSeconds:(Date.now()-start)/1000,passed:true};
fs.writeFileSync(path.resolve(__dirname,'../docs/exhaustive-results.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
