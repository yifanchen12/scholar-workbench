'use strict';
const assert=require('node:assert/strict'),{parse}=require('../record-ocr.js');
assert.deepEqual(parse('活 动 名 称：创新杯人工智能竞赛\n举办单位：北京邮电大学\n获奖等级：校级一等奖\n日期：2026年10月21日\n备注：负责模型训练'),{title:'创新杯人工智能竞赛',organizer:'北京邮电大学',award:'校级一等奖',date:'2026-10-21',category:'竞赛',notes:'负责模型训练'});
assert.deepEqual(parse('Event: Campus AI Competition\nOrganizer: Test University\nAward: First Prize\nDate: 2026-10-21'),{title:'Campus AI Competition',organizer:'Test University',award:'First Prize',date:'2026-10-21'});
assert.deepEqual(parse('荣誉证书\n姓名：测试同学\n学号：12345678\n2026年2月30日'),{});
assert.equal(parse('Date: 2026 · 1 0 · 21').date,'2026-10-21');
assert.equal(parse('参加《校园志愿服务》\n北京邮电大学\n2026.10.21').category,'志愿服务');assert.throws(()=>parse('x'.repeat(100001)),/超过/);
console.log('Local OCR field parser passed: labeled Chinese/English, CJK spacing, valid dates, conservative missing fields and size bound.');
