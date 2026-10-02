'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('./browser-runtime.cjs').playwright;
const base=process.env.STUDY_URL || 'http://127.0.0.1:5179';
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||undefined});
  try{
    const context=await browser.newContext();await context.addInitScript(()=>{
      window.modelLines=[];window.plotLabels=[];window.lossLabels=[];const p=CanvasRenderingContext2D.prototype;
      const begin=p.beginPath,move=p.moveTo,line=p.lineTo,stroke=p.stroke,fillText=p.fillText;
      p.beginPath=function(...args){this.testPath=[];return begin.apply(this,args);};
      p.moveTo=function(x,y){this.testPath.push([x,y]);return move.call(this,x,y);};
      p.lineTo=function(x,y){this.testPath.push([x,y]);return line.call(this,x,y);};
      p.stroke=function(...args){if(this.canvas.id==='fit-canvas' && this.strokeStyle==='#245cd8' && this.lineWidth===3)window.modelLines.push(this.testPath.map(point=>point.slice()));return stroke.apply(this,args);};
      p.fillText=function(text,x,y,...args){if(['fit-canvas','loss-canvas'].includes(this.canvas.id)){const m=this.measureText(text),labels=this.canvas.id==='fit-canvas'?window.plotLabels:window.lossLabels;labels.push({text,left:x-m.actualBoundingBoxLeft,right:x+m.actualBoundingBoxRight,top:y-m.actualBoundingBoxAscent,bottom:y+m.actualBoundingBoxDescent});}return fillText.call(this,text,x,y,...args);};
    });
    const page=await context.newPage();await page.goto(base+'/#ai');
    function readableLabels(labels,width,height){
      for(const label of labels)assert.ok(label.left>=0 && label.right<=width && label.top>=0 && label.bottom<=height,`Label clipped: ${label.text}`);
      for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++){
        const a=labels[i],b=labels[j],overlap=Math.min(a.right,b.right)>Math.max(a.left,b.left) && Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top);
        assert.equal(overlap,false,`Canvas labels overlap: ${a.text} / ${b.text}`);
      }
    }
    const labels=await page.evaluate(()=>window.plotLabels);assert.equal(labels.length,12);readableLabels(labels,840,390);readableLabels(await page.evaluate(()=>window.lossLabels),840,230);
    // Default observations define x=[-2.6,3.6], y=[-5.04,9.24] after plot padding.
    const zeroY=348-5.04/14.28*328;
    for(const [w,b,root]of [[1e8,1e8,-1],[-1e8,1e8,1]]){
      await page.locator('#ai-w').fill(String(w));await page.locator('#ai-b').fill(String(b));await page.evaluate(()=>window.modelLines=[]);await page.getByRole('button',{name:'应用手动参数',exact:true}).click();
      const paths=await page.evaluate(()=>window.modelLines);assert.equal(paths.length,1);assert.equal(paths[0].length,2);
      const [[x1,y1],[x2,y2]]=paths[0];assert.ok(paths[0].flat().every(Number.isFinite));assert.ok(y1>=20 && y1<=348 && y2>=20 && y2<=348);assert.ok(x1>=60 && x1<=815 && x2>=60 && x2<=815);
      const observedRoot=x1+(zeroY-y1)/(y2-y1)*(x2-x1),expectedRoot=60+(root+2.6)/6.2*755;
      assert.ok(Math.abs(observedRoot-expectedRoot)<1e-4,`Visible root: ${observedRoot} versus ${expectedRoot}`);
    }
    await page.locator('#ai-w').fill('0');await page.locator('#ai-b').fill('100000000');await page.evaluate(()=>window.modelLines=[]);await page.getByRole('button',{name:'应用手动参数',exact:true}).click();assert.deepEqual(await page.evaluate(()=>window.modelLines),[]);
    await page.locator('details:has(#ai-train) summary').click();await page.locator('#ai-train').fill('-100000,-100000\n100000,100000');await page.locator('#ai-test').fill('-90000,-90000\n90000,90000');await page.evaluate(()=>{window.plotLabels=[];window.lossLabels=[];});await page.getByRole('button',{name:'载入数据并归零',exact:true}).click();
    readableLabels(await page.evaluate(()=>window.plotLabels),840,390);readableLabels(await page.evaluate(()=>window.lossLabels),840,230);
    console.log('Regression plot checks passed: measured default/large-scale axis labels fit without overlap; positive/negative extreme slopes retain their mathematical zero crossing; endpoints stay inside the plot; a fully outside horizontal line is omitted.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exit(1);});
