import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {connection,projectRef} from './live-connection.mjs';
if(process.argv[2]!=='--apply-reviewed-plan' || !process.argv[3])throw new Error('需要指定已演练的迁移计划');
const planPath=path.resolve(process.argv[3]);
const plan=JSON.parse(await fs.readFile(planPath,'utf8'));
if(plan.projectRef!==projectRef)throw new Error('目标项目不匹配');
if(createHash('sha256').update(plan.migrationSql).digest('hex')!==plan.migrationSha256)throw new Error('迁移脚本校验失败');
const raw=await fs.readFile(path.join(plan.backupDirectory,'database-snapshot.json'),'utf8');
if(createHash('sha256').update(raw).digest('hex')!==plan.snapshotSha256)throw new Error('备份校验失败');
const before=JSON.parse(raw);
const sortObject=x=>Array.isArray(x)?x.map(sortObject):x && typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,sortObject(x[k])])):x;
const canonical=rows=>JSON.stringify(sortObject([...rows].sort((a,b)=>String(a.id).localeCompare(String(b.id)))));
const client=connection();let transaction=false;
try{
 await client.connect();
 // Preserve the sole existing application account; no credential change or new recipient.
 const accounts=(await client.query('SELECT id,email FROM auth.users')).rows;
 if(accounts.length!==1 || accounts[0].id!==plan.adminId || accounts[0].email!==plan.adminEmail)throw new Error('原管理员账号发生变化，需要重新核对');
 const exists=await client.query("SELECT to_regclass('public.import_batches') AS relation");
 if(exists.rows[0].relation){
  const batch=await client.query('SELECT result FROM public.import_batches WHERE request_id=$1',[plan.requestId]);
  if(batch.rows.length){console.log(JSON.stringify({status:'already-applied',result:batch.rows[0].result.inserted}));process.exitCode=0;}
  else throw new Error('线上已有新结构但无本次导入记录，需要核对后继续');
 }else{
  await client.query('BEGIN');transaction=true;
  await client.query("SET LOCAL lock_timeout='8s'; SET LOCAL statement_timeout='90s'");
  await client.query('LOCK TABLE public.courses,public.organization_info,public.teachers,public.user_course_progress,public.users_profile IN SHARE ROW EXCLUSIVE MODE');
  for(const [table,rows] of Object.entries(before.tables)){
   if(!/^[a-z_]+$/.test(table))throw new Error('表名不符合预期');
   const current=(await client.query(`SELECT * FROM public.${table}`)).rows;
   // pg returns timestamps as Date. Normalize the same way JSON snapshots were serialized.
   if(canonical(JSON.parse(JSON.stringify(current)))!==canonical(rows))throw new Error(`备份后 ${table} 数据有变化，已停止迁移`);
  }
  const policies=(await client.query("SELECT * FROM pg_policies WHERE schemaname IN ('public','storage')")).rows;
  const policySort=arr=>JSON.stringify(arr.map(sortObject).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
  if(policySort(policies)!==policySort(before.policies))throw new Error('备份后权限策略有变化，已停止迁移');
  await client.query(plan.migrationSql);
  await client.query('INSERT INTO public.admin_users(user_id) VALUES($1)',[plan.adminId]);
  await client.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[plan.adminId]);
  for(const merge of plan.merges)await client.query('SELECT public.merge_people($1,$2)',[merge.keep,merge.remove]);
  const result=(await client.query('SELECT public.import_certifications($1::jsonb,$2,$3,$4,false) AS result',[JSON.stringify(plan.rows),plan.fileName,plan.fileHash,plan.requestId])).rows[0].result;
  const counts=(await client.query('SELECT (SELECT count(*) FROM people)::int AS people,(SELECT count(*) FROM certifications)::int AS certificates,(SELECT count(*) FROM teachers_legacy_backup)::int AS legacy_rows,(SELECT count(*) FROM teachers)::int AS public_certificates')).rows[0];
  if(JSON.stringify(counts)!==JSON.stringify(plan.expected))throw new Error('线上迁移结果与演练不符，整批回滚');
  if(canonical((await client.query('SELECT * FROM teachers_legacy_backup')).rows.map(r=>JSON.parse(JSON.stringify(r))))!==canonical(before.tables.teachers))throw new Error('旧名单备份发生变化，整批回滚');
  await client.query("NOTIFY pgrst, 'reload schema'");
  await client.query('COMMIT');transaction=false;
  await fs.writeFile(path.join(plan.backupDirectory,'applied-result.json'),JSON.stringify({appliedAt:new Date().toISOString(),projectRef,counts,result},null,2),{mode:0o600});
  console.log(JSON.stringify({status:'committed',counts,inserted:result.inserted,conflicts:result.rows.filter(r=>r.status==='conflict').length}));
 }
}catch(e){if(transaction)await client.query('ROLLBACK').catch(()=>{});console.error(JSON.stringify({code:e.code,message:e.message}));process.exitCode=1;}
finally{await client.end().catch(()=>{});}
