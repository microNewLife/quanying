import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {syntheticWorkbook} from './workbook-fixture.mjs';
import {PGlite} from '@electric-sql/pglite';
import {parseWorkbook} from '../src/utils/importWorkbook.ts';
const admin='11111111-1111-4111-8111-111111111111', user='22222222-2222-4222-8222-222222222222';
test('migration, RLS, transactional imports, retries, conflicts, merge and snapshots',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA auth;CREATE SCHEMA storage;
 CREATE TABLE auth.users(id uuid PRIMARY KEY); INSERT INTO auth.users VALUES('${admin}'),('${user}');
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 GRANT USAGE ON SCHEMA auth,public TO anon,authenticated;
 CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(),bucket_id text,name text);ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
 GRANT USAGE ON SCHEMA storage TO anon,authenticated;GRANT ALL ON storage.objects TO anon,authenticated;`);
 await db.exec(await fs.readFile(new URL('../../schema.sql',import.meta.url),'utf8'));
 await db.exec(`GRANT ALL ON ALL TABLES IN SCHEMA public TO anon,authenticated;
 INSERT INTO teachers(id,certificate_name,certificate_no,qualification,certified_at,photo_url) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','甲','DEA-RFD-2016001','柔丝辅导师','2025年01月','https://example.com/photo.png'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','甲','DEA-RK-2016001','柔丝科普师','2025年','');
 INSERT INTO courses(title,is_published) VALUES('公开',true),('草稿',false);`);
 const migration=await fs.readFile(new URL('../../supabase/migrations/202609140001_people_import.sql',import.meta.url),'utf8');
 try{await db.exec(migration);}catch(e){console.error({position:e.position,internalPosition:e.internalPosition,internalQuery:e.internalQuery,where:e.where});throw e;}
 await db.exec(await fs.readFile(new URL('../../supabase/migrations/202609140002_legacy_read_compatibility.sql',import.meta.url),'utf8'));
 await db.exec(`INSERT INTO admin_users VALUES('${admin}',now());`);
 async function as(role,id=''){await db.exec(`RESET ROLE; SET request.jwt.claim.sub='${id}';SET ROLE ${role};`);}
 async function query(sql,params=[]){return (await db.query(sql,params)).rows;}
 const row={name:'乙',nickname:'昵称',certificate_no:'DEA-RK-2016002',qualification:'科普师',initial_year:2025,recent_year:null,sheet:'科普师',row:2};
 const hash='a'.repeat(64);
 async function imp(rows,preview=false,id=crypto.randomUUID()){return (await query('SELECT public.import_certifications($1::jsonb,$2,$3,$4::uuid,$5) AS result',[JSON.stringify(rows),'名单.xlsx',hash,id,preview]))[0].result;}
 await as('authenticated',user);
 assert.equal((await query('SELECT public.is_admin() AS value'))[0].value,false);
 await assert.rejects(()=>imp([row]),/管理员权限/);
 assert.equal((await query('SELECT * FROM users_profile')).length,0);
 assert.equal((await query('SELECT * FROM import_batches')).length,0);
 await assert.rejects(()=>query("INSERT INTO courses(title) VALUES('越权')"),/row-level security/);
 await assert.rejects(()=>query("INSERT INTO storage.objects(bucket_id,name) VALUES('images','bad')"),/row-level security/);
 assert.equal((await query('SELECT * FROM courses')).length,1);
 assert.equal((await query('SELECT * FROM teachers')).length,2);
 assert.equal((await query('SELECT * FROM teachers_legacy_backup')).length,0);
 await as('authenticated',admin);
 const preview=await imp([row],true);assert.equal(preview.rows[0].status,'new');assert.equal((await query('SELECT * FROM certifications')).length,2);
 const id=crypto.randomUUID();const result=await imp([row],false,id);assert.equal(result.inserted,1);
 assert.deepEqual(await imp([row],false,id),result);
 await assert.rejects(()=>imp([{...row,name:'另一个人'}],false,id),/另一组数据/);
 assert.equal((await imp([row])).rows[0].status,'skipped');
 assert.equal((await imp([{...row,initial_year:2026}])).rows[0].status,'conflict');
 assert.equal((await query('SELECT backup FROM import_batches WHERE request_id=$1',[id]))[0].backup.people.length,2);
 assert.equal((await query("SELECT is_active FROM people WHERE certificate_name='乙'"))[0].is_active,false);
 const duplicate=[{...row,certificate_no:'DEA-RK-2016003',name:'丙'},{...row,certificate_no:'DEA-RK-2016003',name:'丁'}];
 assert.ok((await imp(duplicate)).rows.every(r=>r.status==='conflict'));
 const two=[{...row,certificate_no:'DEA-RK-2016004',name:'戊'},{...row,certificate_no:'DEA-RFD-2016004',qualification:'辅导师',name:'戊'}];
 assert.equal((await imp(two)).inserted,2);assert.equal((await query("SELECT * FROM people WHERE certificate_name='戊'")).length,1);
 assert.equal((await imp([{...row,name:'甲',certificate_no:'DEA-RZX-2016001',qualification:'咨询师'}])).rows[0].status,'conflict');
 await query("SELECT merge_people('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')");
 assert.equal((await query("SELECT * FROM people WHERE certificate_name='甲'")).length,1);
 assert.equal((await query("SELECT photo_url FROM people WHERE certificate_name='甲'"))[0].photo_url,'https://example.com/photo.png');
 assert.equal((await query("SELECT person_id FROM person_aliases WHERE old_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'"))[0].person_id,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
 assert.equal((await query("SELECT id FROM teachers WHERE certificate_no='DEA-RK-2016001'"))[0].id,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
 assert.equal((await imp([{...row,name:'甲',certificate_no:'DEA-RZX-2016001',qualification:'咨询师'}])).inserted,1);
 // A genuine database constraint failure rolls back all rows and the batch snapshot.
 await db.exec('RESET ROLE');
 await db.exec("ALTER TABLE certifications ADD CONSTRAINT test_reject CHECK(certificate_no<>'DEA-RK-2016006')");
 await as('authenticated',admin);
 await assert.rejects(()=>imp([{...row,name:'己',certificate_no:'DEA-RK-2016005'},{...row,name:'庚',certificate_no:'DEA-RK-2016006'}]),/test_reject/);
 assert.equal((await query("SELECT * FROM people WHERE certificate_name='己'")).length,0);
 await query("UPDATE people SET is_active=false WHERE certificate_name='甲'");
 await as('anon');assert.equal((await query('SELECT * FROM people')).length,0);assert.equal((await query('SELECT * FROM certifications')).length,0);assert.equal((await query('SELECT * FROM person_aliases')).length,0);assert.equal((await query('SELECT * FROM teachers')).length,0);
 await db.exec('RESET ROLE; TRUNCATE public.certifications,public.person_aliases,public.people;');
 await as('authenticated',admin);
 const actual=await syntheticWorkbook();
 const parsed=await parseWorkbook(actual.buffer.slice(actual.byteOffset,actual.byteOffset+actual.byteLength));
 const actualResult=await imp(parsed.rows);
 assert.equal(actualResult.inserted,76,JSON.stringify(actualResult.rows.filter(r=>r.status!=='new')));
 assert.equal((await query('SELECT * FROM people')).length,45);
 assert.equal((await imp(parsed.rows)).inserted,0);
 }finally{await db.close();}
});
