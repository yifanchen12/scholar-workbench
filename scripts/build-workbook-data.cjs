'use strict';
const fs=require('node:fs'),path=require('node:path'),C=require('../core');
const problems=[
  {id:'corners',title:'练习1：跨边界的四角',n:4,ones:[0,2,8,10],dc:[],prompt:'画出卡诺图，标出一个四格组，写出被消去的变量。',reason:'四角中B=0、D=0恒定；A和C在组内变化，因此消去A和C。'},
  {id:'overlap',title:'练习2：同一格可以重复使用',n:4,ones:[5,6,7,10,11,14,15],dc:[],prompt:'用尽可能少的乘积项覆盖全部1。说明为什么重叠分组是允许的。',reason:'其中AC、BC各为一个四格组；m5与m7形成一组，得到A\'BD。m7、m14、m15等可参与不止一个组。'},
  {id:'dontcares',title:'练习3：利用无关项',n:3,ones:[0,1,2,4],dc:[5,6],prompt:'只使用能帮助扩组的无关项，写出最简与或式。检查无关项输出是否必须为1。',reason:'m5帮助B\'扩成四格，m6帮助C\'扩成四格。无关项上的输出无需强制等于0或1，不必全部覆盖。'}
].map(p=>({...p,result:C.minimize(p.n,p.ones,p.dc)}));
const train=[{x:-2,y:-3},{x:-1,y:-.8},{x:0,y:1},{x:1,y:3.1},{x:2,y:4.8},{x:3,y:7.2}],first=C.gradientStep(train,0,0,.1),optimal=C.leastSquares(train);
const data={problems,ai:{train,initial:C.regression(train,0,0),first,optimal,bound:C.learningRateBound(train)}};
fs.mkdirSync(path.resolve(__dirname,'../output/pdf'),{recursive:true});
fs.writeFileSync(path.resolve(__dirname,'../docs/workbook-data.json'),JSON.stringify(data,null,2)+'\n');
for(const p of problems)fs.writeFileSync(path.resolve(__dirname,`../examples/kmap-${p.id}.svg`),C.toSvg(p.result));
const md=['# 数字逻辑与AI基础速练册','','适用：北邮2025级人工智能专业学生的自主复习。全部练习为自编，不是教材原题。','','## 使用方法','','先做题再看答案，用工作台核验；把没讲清的概念存为错题卡。','',...problems.flatMap(p=>[`## ${p.title}`,'',`F=Σm(${p.ones.join(',')})${p.dc.length?`；d=Σd(${p.dc.join(',')})`:''}`,p.prompt,'','作答：分组____；固定变量____；最简式____。','']), '## 答案与过程','',...problems.flatMap(p=>[`### ${p.title}`,'',p.reason,'',C.toMarkdown(p.result),'',`分组图：[SVG](../examples/kmap-${p.id}.svg)`,'']),'## 线性回归第一步','','默认数据：'+train.map(p=>`(${p.x},${p.y})`).join('，'),'','模型ŷ=wx+b，L=Σ(ŷ−y)²/(2m)，w=b=0，η=0.1。',`初始L=${data.ai.initial.loss}；dw=${data.ai.initial.dw}；db=${data.ai.initial.db}。`,`同步更新后w=${first.w}，b=${first.b}，L=${first.after.loss}。`,`最小二乘参考w=${optimal.w}，b=${optimal.b}，L=${optimal.loss}。`,'','## 三个实验','','1. η从0.1改为0.8，先预测，再看1步和20步的损失。','2. x放大50倍，说明斜率和稳定学习率为什么改变。','3. 加入离群点，比较训练最优与测试MSE。','','## 易错点','','- 卡诺图的首尾相邻；同一个1可以参与多个组。','- 无关项的输出没有强制要求，只有题目明确允许才能使用。','- 梯度必须从同一组旧参数计算。','- 测试数据不参与训练，也不应用作反复调参后的独立最终评估。','- 草稿字数口径要与申报系统一致；经历需保留证据。','','## 基础参考','','[MIT数字逻辑讲义](https://ocw.mit.edu/courses/6-004-computation-structures-spring-2017/pages/c4/c4s1/)；[Stanford CS229线性回归讲义](https://cs229.stanford.edu/summer2023/cs229-notes1.pdf)。','参考用于概念复核，代码、演示数据和练习题为本项目自编。'].join('\n');
fs.writeFileSync(path.resolve(__dirname,'../docs/学习练习册.md'),md);
console.log('Computed worksheet answers and matching Markdown saved.');
