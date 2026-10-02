'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('./browser-runtime.cjs').playwright;
const base=process.env.STUDY_URL || 'http://127.0.0.1:5179';
function luminance(rgb){const v=rgb.map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;});return v[0]*.2126+v[1]*.7152+v[2]*.0722;}
function ratio(fg,bg){const [a,b]=[luminance(fg),luminance(bg)].sort((a,b)=>a-b);return (b+.05)/(a+.05);}
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||undefined}),records=[];
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    async function check(selector,label,{pseudo=null,svg=false}={}){
      const colors=await page.locator(selector).evaluateAll((nodes,{pseudo,svg})=>nodes.map(el=>{
        const parse=value=>{const match=value.match(/^rgba?\(([^)]+)\)$/);if(!match)throw new Error('Expected resolved RGB: '+value);return match[1].split(',').map(Number);};
        const style=getComputedStyle(el,pseudo),fg=parse(svg?style.fill:style.color);let background=null,opacity=1;
        for(let parent=el;parent;parent=parent.parentElement){const s=getComputedStyle(parent);opacity*=Number(s.opacity);const bg=parse(s.backgroundColor);if(!background && bg[3]!==0){if(bg.length===4 && bg[3]!==1)throw new Error('Partial background needs a separate composite check.');background=bg.slice(0,3);}}
        return {foreground:fg.slice(0,3),background:background||[255,255,255],opacity,fontSize:style.fontSize};
      }),{pseudo,svg});
      assert.ok(colors.length,label+' missing');
      for(const color of colors){const contrast=ratio(color.foreground,color.background);assert.equal(color.opacity,1,label+' unexpectedly faded');assert.ok(contrast>=4.5,label+': '+contrast);records.push({label,...color,contrast});}
    }
    await page.goto(base+'/#today');await check('#focus-topic','深色专注输入提示',{pseudo:'::placeholder'});await check('.timer-label','专注状态');
    await page.goto(base+'/#materials');await check('.counter span','字数计数说明');await check('.source-note','材料页说明');
    await page.goto(base+'/#logic');await check('#logic-ones','逻辑输入提示',{pseudo:'::placeholder'});await page.locator('#logic-ones').fill('1,2,4,7,8,11,13,14');await page.getByRole('button',{name:'化简并验证',exact:true}).click();assert.equal(await page.locator('.group-number').count(),8);await check('.group-number','八种分组编号');
    await page.locator('[data-action="logic-group"][data-index="0"]').click();await check('.kmap td.dim .cell-index','选组后其他格子的编号');await check('.kmap td.dim .cell-value','选组后其他格子的真值');
    await page.locator('.circuit-section summary').click();await check('.circuit-diagram svg text','电路文字，包括0状态',{svg:true});
    const report={scope:'Targeted opaque-background text checks only; not full WCAG certification or assistive-device testing.',source:'https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html',minimum:Math.min(...records.map(row=>row.contrast)),checks:records.length,records};
    fs.writeFileSync(path.resolve(__dirname,'../docs/contrast-results.json'),JSON.stringify(report,null,2)+'\n');
    console.log(`Readability checks passed: ${records.length} computed text colors have contrast >=4.5 on their opaque backgrounds; selected-map cells retain full opacity. Minimum ${report.minimum.toFixed(3)}.`);
  }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exit(1);});
