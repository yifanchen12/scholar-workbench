(function(root){
  'use strict';
  const string=(x,max=4000)=>{if(typeof x!=='string'||!x.trim()||x.length>max)throw new Error('生成内容的文本字段无效。');return x;};
  const list=(x,max)=>{if(!Array.isArray(x)||x.length>max)throw new Error('生成内容的列表无效。');return x;};
  function validate(result,kind,pageNumbers){
    const allowed=new Set(pageNumbers),sources=x=>{const v=list(x,20);if(!v.length||v.some(p=>!Number.isInteger(p)||!allowed.has(p)))throw new Error('生成内容引用了未提供的页码，请重新生成。');return [...new Set(v)];};
    if(!result||typeof result!=='object')throw new Error('生成内容不是有效JSON对象。');
    if(kind==='outline'){
      const sections=list(result.sections,100).map(s=>{if(!s||!Number.isInteger(s.start)||!Number.isInteger(s.end)||s.start>s.end||!allowed.has(s.start)||!allowed.has(s.end))throw new Error('章节范围无效。');return {title:string(s.title,200),start:s.start,end:s.end,summary:string(s.summary,1200)};});
      if(!sections.length)throw new Error('模型未返回章节。');return {title:string(result.title,300),sections};
    }
    const concepts=list(result.concepts,15).map(c=>({title:string(c.title,200),text:string(c.text),pages:sources(c.pages)}));
    if(!concepts.length)throw new Error('模型未返回讲解。');
    const steps=list(result.steps||[],15).map(s=>({title:string(s.title,200),text:string(s.text),pages:sources(s.pages)}));
    const comparisons=list(result.comparisons||[],4).map(c=>({title:string(c.title,200),columns:list(c.columns,6).map(x=>string(x,100)),rows:list(c.rows,15).map(row=>{if(!Array.isArray(row)||row.length!==c.columns.length)throw new Error('对照表列数不一致。');return row.map(x=>string(x,1000));}),pages:sources(c.pages)}));
    const charts=list(result.charts||[],4).map(c=>{const labels=list(c.labels,20).map(x=>string(x,100)),values=list(c.values,20);if(!values.length||labels.length!==values.length||values.some(x=>!Number.isFinite(x)||Math.abs(x)>1e12))throw new Error('数值图表无效。');return {title:string(c.title,200),unit:typeof c.unit==='string'?c.unit.slice(0,100):'',labels,values,pages:sources(c.pages)};});
    const questions=list(result.questions||[],10).map(q=>({question:string(q.question,1000),answer:string(q.answer,3000),pages:sources(q.pages)}));
    return {title:string(result.title,300),summary:string(result.summary,2000),concepts,steps,comparisons,charts,questions};
  }
  const api={validate};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.TextbookSchema=api;
})(globalThis);
