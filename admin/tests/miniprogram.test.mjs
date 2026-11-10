import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
test('mini program groups qualifications, preserves year precision and excludes inactive certifications',async()=>{
 const source=await fs.readFile(new URL('../../miniprogram/utils/people.js',import.meta.url),'utf8');
 const module={exports:{}};vm.runInNewContext(source,{module,require:()=>({supabase:{}})});
 const person=module.exports.presentPerson({id:'one',certificate_name:'甲',certifications:[
  {id:'1',certificate_no:'DEA-RK-2016001',qualification:'科普师',initial_year:2025,is_active:true},
  {id:'2',certificate_no:'DEA-RFD-2016001',qualification:'辅导师',initial_year:2024,recent_year:2026,is_active:true},
  {id:'3',certificate_no:'DEA-RZX-2016001',qualification:'咨询师',initial_year:2023,is_active:false},
 ]});
 assert.equal(person.certifications.length,2);assert.equal(person.qualifications.length,2);assert.equal(person.certifications.find(c=>c.id==='1').date_text,'2025年');assert.equal(person.certifications.find(c=>c.id==='2').recent_text,'2026年');
 assert.ok(!person.qualification.includes('咨询师'));
});
