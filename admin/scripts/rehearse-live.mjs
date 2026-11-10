import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {parseWorkbook} from '../src/utils/importWorkbook.ts';
const dir=path.resolve(process.argv[2] || '');
if(!process.argv[2])throw new Error('请指定已完成的备份目录');
const snapshotText=await fs.readFile(path.join(dir,'database-snapshot.json'),'utf8');
const snapshot=JSON.parse(snapshotText),manifest=JSON.parse(await fs.readFile(path.join(dir,'manifest.json'),'utf8'));
if(createHash('sha256').update(snapshotText).digest('hex')!==manifest.snapshotSha256)throw new Error('备份校验失败');
if(snapshot.authUsers.length!==1)throw new Error('需要明确指定现有管理员');
const admin=snapshot.authUsers[0];
const file=await fs.readFile(new URL('../../local-data/柔丝体系认证名单_截至20260808.xlsx',import.meta.url));
const parsed=await parseWorkbook(file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength));
if(parsed.issues.length)throw new Error('文件仍有未处理解析错误');
const migrations=await Promise.all(['202609140001_people_import.sql','202609140002_legacy_read_compatibility.sql'].map(n=>fs.readFile(new URL('../../supabase/migrations/'+n,import.meta.url),'utf8')));
const migrationSql=migrations.map(s=>s.replace(/^BEGIN;\s*$/m,'').replace(/^COMMIT;\s*$/m,'')).join('\n');
const groups=Map.groupBy(snapshot.tables.teachers,r=>r.certificate_name+'|'+r.certificate_no.split('-').at(-1));
const merges=[];
for(const rows of groups.values()){
 if(rows.length<2)continue;
 const fields=['photo_url','description','qrcode_url','is_active','sort_order'];
 if(fields.some(f=>new Set(rows.map(r=>r[f]).filter(v=>v!=='' && v!==null && v!==undefined)).size>1))continue;
 const ids=rows.map(r=>r.id).sort();for(const remove of ids.slice(1))merges.push({keep:ids[0],remove,name:rows[0].certificate_name});
}
const db=new PGlite();
try{
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA auth;CREATE SCHEMA storage;CREATE TABLE auth.users(id uuid PRIMARY KEY);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;GRANT USAGE ON SCHEMA auth,public TO anon,authenticated;CREATE TABLE storage.objects(id uuid,bucket_id text,name text);ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;`);
 await db.query('INSERT INTO auth.users(id) VALUES($1)',[admin.id]);
 await db.exec(await fs.readFile(new URL('../../schema.sql',import.meta.url),'utf8'));
 await db.exec('TRUNCATE organization_info; GRANT ALL ON ALL TABLES IN SCHEMA public TO anon,authenticated;');
 for(const [table,rows] of Object.entries(snapshot.tables)){
  if(!/^[a-z_]+$/.test(table))throw new Error('表名不符合预期');
  await db.query(`INSERT INTO public.${table} SELECT * FROM jsonb_populate_recordset(null::public.${table},$1::jsonb)`,[JSON.stringify(rows)]);
 }
 // Recreate the actual live policies, including the temporary public insert policy.
 const policies=(await db.query("SELECT schemaname,tablename,policyname FROM pg_policies WHERE schemaname IN ('public','storage')")).rows;
 const q=s=>'"'+s.replaceAll('"','""')+'"';
 for(const p of policies)await db.exec(`DROP POLICY ${q(p.policyname)} ON ${q(p.schemaname)}.${q(p.tablename)}`);
 for(const p of snapshot.policies){
  const roles=p.roles.replace(/[{}]/g,'').split(',').map(r=>r==='public'?'PUBLIC':q(r)).join(',');
  await db.exec(`CREATE POLICY ${q(p.policyname)} ON ${q(p.schemaname)}.${q(p.tablename)} AS ${p.permissive} FOR ${p.cmd} TO ${roles}${p.qual?' USING('+p.qual+')':''}${p.with_check?' WITH CHECK('+p.with_check+')':''}`);
 }
 await db.exec('BEGIN;'+migrationSql);
 await db.query('INSERT INTO public.admin_users(user_id) VALUES($1)',[admin.id]);
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[admin.id]);
 for(const m of merges)await db.query('SELECT public.merge_people($1,$2)',[m.keep,m.remove]);
 const requestId=crypto.randomUUID();
 const args=[JSON.stringify(parsed.rows),'柔丝体系认证名单_截至20260808.xlsx',parsed.hash,requestId];
 const preview=(await db.query('SELECT public.import_certifications($1::jsonb,$2,$3,$4,true) AS result',args)).rows[0].result;
 const result=(await db.query('SELECT public.import_certifications($1::jsonb,$2,$3,$4,false) AS result',args)).rows[0].result;
 const counts=(await db.query('SELECT (SELECT count(*) FROM people)::int AS people,(SELECT count(*) FROM certifications)::int AS certificates,(SELECT count(*) FROM teachers_legacy_backup)::int AS legacy_rows,(SELECT count(*) FROM teachers)::int AS public_certificates')).rows[0];
 if(counts.legacy_rows!==snapshot.tables.teachers.length)throw new Error('旧名单未完整保留');
 const lost=(await db.query(`SELECT t.id FROM teachers_legacy_backup t JOIN person_aliases a ON a.old_id=t.id JOIN people p ON p.id=a.person_id WHERE (coalesce(t.photo_url,'')<>'' AND p.photo_url<>t.photo_url) OR (coalesce(t.description,'')<>'' AND p.description<>t.description) OR (coalesce(t.qrcode_url,'')<>'' AND p.qrcode_url<>t.qrcode_url)`)).rows;
 if(lost.length)throw new Error('人工资料发生丢失');
 await db.exec('COMMIT; SET ROLE anon;');
 const visible=(await db.query('SELECT count(*)::int AS count FROM teachers')).rows[0].count;
 if(visible<snapshot.tables.teachers.filter(t=>t.is_active).length)throw new Error('旧版公开名单减少');
 let denied=false;try{await db.exec("INSERT INTO teachers_legacy_backup(certificate_name,certificate_no) VALUES('test','test')");}catch{denied=true;}if(!denied)throw new Error('旧临时公开写权限仍存在');
 const plan={projectRef:snapshot.projectRef,backupDirectory:dir,snapshotSha256:manifest.snapshotSha256,migrationSql,migrationSha256:createHash('sha256').update(migrationSql).digest('hex'),adminId:admin.id,adminEmail:admin.email,merges,rows:parsed.rows,fileHash:parsed.hash,fileName:args[1],requestId,expected:counts,preview};
 await fs.writeFile(path.join(dir,'migration-plan.json'),JSON.stringify(plan,null,2),{mode:0o600});
 await fs.writeFile(path.join(dir,'import-preview.json'),JSON.stringify(preview,null,2),{mode:0o600});
 console.log(JSON.stringify({counts,merges:merges.length,importCounts:Object.fromEntries([...new Set(result.rows.map(r=>r.status))].map(s=>[s,result.rows.filter(r=>r.status===s).length])),conflicts:result.rows.filter(r=>r.status==='conflict').map(r=>({name:r.name,certificate:r.certificate_no,reason:r.reason})),planPath:path.join(dir,'migration-plan.json')}));
}finally{await db.close();}
