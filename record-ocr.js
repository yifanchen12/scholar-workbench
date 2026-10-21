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
    const taxonomy=typeof module==='object'&&module.exports?require('./record-categories.js'):RecordCategories;
    const category=labelled('分类|活动类别|Category');if(taxonomy.categories.includes(category))result.category=category;
    else{const subject=result.title||text;if(/学生会|班委|学生工作|任职|团支书|职业素质|职业能力|组织协调|宿舍长/.test(subject))result.category='组织协调能力';else if(/志愿|义工|公益服务|献血|劳动|社会实践|返家乡/.test(subject))result.category='劳动素养';else if(/运动会|体育|篮球|足球|羽毛球|跑步|心理|健康|体测/.test(subject))result.category='身心健康';else if(/文艺|美育|艺术|歌唱|合唱|舞蹈|话剧|观影|音乐|美术|书法/.test(subject))result.category='美育素养';else if(/班会|团日|升旗|思想成长|主题讲座|通报表扬/.test(subject))result.category='思想成长';else if(/学术|科研|论文|专利|研究项目|竞赛|比赛|挑战杯|创新|建模|雏雁|大创/.test(subject))result.category='学术创新';}
    const eventLevel=labelled('活动级别|Activity level|Event level').replace(/\s/g,'')||((award||'').match(/^(国家级|市级|校级|院级|年级)/)||[])[0];if(taxonomy.activityLevels.includes(eventLevel))result.activityLevel=eventLevel;
    const level=(labelled('竞赛级别|竞赛档次|Competition (?:tier|level)|Tier')||labelled('活动级别')).toUpperCase().replace(/\s|级/g,'');if(taxonomy.levels.includes(level)&&(!result.category||result.category==='学术创新')){result.category='学术创新';result.competitionLevel=level;}
    const notes=labelled('个人贡献|备注|参与情况|Notes');if(notes)result.notes=notes.slice(0,6000);
    return result;
  }
  return {parse};
});
