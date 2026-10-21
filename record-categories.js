(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RecordCategories=api;})(globalThis,function(){
  'use strict';
  const categories=['思想成长','学术创新','身心健康','美育素养','劳动素养','组织协调能力','其他'],levels=['S','A+','A','B+','B'],activityLevels=['年级','院级','校级','市级','国家级','校级及以上','市级及以上'];
  function competitionLevel(value){if(value===undefined||value==='')return '';if(typeof value!=='string'||!levels.includes(value))throw new Error('竞赛级别应为 S、A+、A、B+、B 或待确认。');return value;}
  function activityLevel(value){if(value===undefined||value==='')return '';if(typeof value!=='string'||!activityLevels.includes(value))throw new Error('活动级别无效，请选择年级、院级、校级、市级、国家级或相应范围。');return value;}
  return {categories,levels,activityLevels,competitionLevel,activityLevel,source:'人工智能学院2025级综测细则（2025—2026学年）；发展素质六类，分数以年级认定为准'};
});
