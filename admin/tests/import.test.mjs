import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {syntheticWorkbook} from './workbook-fixture.mjs';
import ExcelJS from 'exceljs';
import {parseWorkbook} from '../src/utils/importWorkbook.ts';
async function buffer(workbook){const b=await workbook.xlsx.writeBuffer();return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);}
test('synthetic workbook: seven categories, exact duplicate removed, metadata sheets excluded',async()=>{
 const b=await syntheticWorkbook();
 const result=await parseWorkbook(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));
 assert.equal(result.rows.length,76);assert.equal(result.duplicates,1);assert.equal(result.issues.length,0);assert.equal(result.ignored.length,2);
 assert.equal(result.rows.find(r=>r.nickname==='321').nickname,'321');assert.ok(result.rows.every(r=>r.recent_year===null));
 assert.equal(new Set(result.rows.map(r=>r.name)).size,45);
});
test('contradictory duplicate is fully excluded; invalid dates are reported',async()=>{
 const w=new ExcelJS.Workbook();const s=w.addWorksheet('科普师');
 s.addRows([['姓名','昵称','证书编号','初始认证年份','最近认证年份'],['甲','','DEA-RK-2016001',2025,'NA'],['乙','','DEA-RK-2016001',2025,null],['丙','','DEA-RK-2016002',2025,2024]]);
 const result=await parseWorkbook(await buffer(w));assert.equal(result.rows.length,0);assert.equal(result.issues.length,3);
});
test('unknown template and formula cells fail clearly',async()=>{
 const w=new ExcelJS.Workbook();const s=w.addWorksheet('科普师');s.addRows([['姓名','证书编号'],['甲','DEA-RK-2016001']]);
 await assert.rejects(async()=>parseWorkbook(await buffer(w)),/缺少列/);
 s.getRow(1).values=['姓名','昵称','证书编号','初始认证年份','最近认证年份'];
 s.getRow(2).values=['甲','','DEA-RK-2016001',{formula:'2025',result:2025},null];
 const parsed=await parseWorkbook(await buffer(w));assert.equal(parsed.issues.length,1);assert.match(parsed.issues[0].reason,/不支持公式/);
});

const privateWorkbook = new URL('../../local-data/柔丝体系认证名单_截至20260808.xlsx', import.meta.url);
test('optional local real roster regression', {skip: !existsSync(privateWorkbook)}, async () => {
 const b = await fs.readFile(privateWorkbook);
 const result = await parseWorkbook(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
 assert.equal(result.rows.length, 76);
 assert.equal(result.duplicates, 1);
 assert.equal(result.issues.length, 0);
 assert.equal(new Set(result.rows.map(r => r.name)).size, 45);
});
