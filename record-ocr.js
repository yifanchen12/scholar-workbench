(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./core.js'):root.StudyCore);if(typeof module==='object'&&module.exports)module.exports=api;else root.RecordOCR=api;})(globalThis,function(core){
  'use strict';
  function parse(value){
    if(typeof value!=='string'||value.length>100000)throw new Error('识别文字无效或超过10万字。');
    const text=value.normalize('NFKC').replace(/(\d)[ \t]+(?=\d)/g,'$1').replace(/([\u3400-\u9fff])[ \t\u3000]+(?=[\u3400-\u9fff])/g,'$1'),lines=text.split(/[\r\n]+/).map(line=>line.trim()).filter(Boolean),result={};
    const labelled=pattern=>{for(const line of lines){const found=line.match(new RegExp('^(?:'+pattern+')\\s*[:：]\\s*(.+)$','i'));if(found)return found[1].trim();}return '';};
    const title=labelled('活动名称|项目名称|比赛名称|竞赛名称|活动名|Event(?: name)?|Activity(?: name)?');
    if(title)result.title=title.slice(0,300);
    else{const quoted=text.match(/(?:参加|参与|在)[^\n]{0,50}[《“「]([^》”」\n]{2,100})[》”」]/);if(quoted)result.title=quoted[1];}
    const organizer=labelled('举办单位|主办单位|颁发单位|组织单位|Organizer|Organiser|Issued by')||[...lines].reverse().find(line=>line.length<=80&&/^(?!.*(?:参加|在此|证明|荣获)).*(?:大学|学院|协会|委员会|中心|团委)$/.test(line));
    if(organizer)result.organizer=organizer.slice(0,300);
    const award=labelled('获奖等级|获奖级别|奖项|奖级|荣誉称号|Award(?: level)?')||(text.match(/(?:国家级|省级|市级|校级|院级)?(?:特等奖|[一二三123]等奖|优秀奖|优胜奖)|优秀(?:团员|干部|志愿者|个人)/)||[])[0];
    if(award)result.award=award.slice(0,200);
    const dates=[...text.matchAll(/(20\d{2}|19\d{2})\s*(?:年|[./·•-])\s*(\d{1,2})\s*(?:月|[./·•-])\s*(\d{1,2})\s*日?/g)];
    for(const date of dates.reverse()){const key=`${date[1]}-${date[2].padStart(2,'0')}-${date[3].padStart(2,'0')}`;if(core.validDate(key)){result.date=key;break;}}
    const category=labelled('分类|活动类别|Category');if(['学习','竞赛','学生工作','体育','志愿服务','科研','其他'].includes(category))result.category=category;
    else{const subject=result.title||text;if(/志愿|义工|公益服务/.test(subject))result.category='志愿服务';else if(/竞赛|比赛|挑战杯|创新杯|建模/.test(subject))result.category='竞赛';else if(/运动会|体育|篮球|足球|羽毛球|跑步/.test(subject))result.category='体育';else if(/学生会|团支部|班委|学生工作/.test(subject))result.category='学生工作';else if(/科研|论文|研究项目/.test(subject))result.category='科研';}
    const notes=labelled('个人贡献|备注|参与情况|Notes');if(notes)result.notes=notes.slice(0,6000);
    return result;
  }
  return {parse};
});
