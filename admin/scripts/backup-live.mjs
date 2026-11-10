import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {connection,env,projectRef} from './live-connection.mjs';
const client=connection();
const quote=s=>'"'+s.replaceAll('"','""')+'"';
const stamp=new Date().toISOString().replaceAll(':','-');
const dir=path.resolve('../backups',stamp+'-before-migration');
await fs.mkdir(dir,{recursive:true,mode:0o700});
try{
 await client.connect();await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 const snapshot={projectRef,createdAt:new Date().toISOString(),tables:{}};
 const tables=(await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows;
 for(const {tablename} of tables)snapshot.tables[tablename]=(await client.query(`SELECT * FROM public.${quote(tablename)}`)).rows;
 snapshot.columns=(await client.query("SELECT * FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position")).rows;
 snapshot.constraints=(await client.query("SELECT conrelid::regclass::text AS table_name,conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE connamespace='public'::regnamespace")).rows;
 snapshot.indexes=(await client.query("SELECT * FROM pg_indexes WHERE schemaname='public'")).rows;
 snapshot.policies=(await client.query("SELECT * FROM pg_policies WHERE schemaname IN ('public','storage')")).rows;
 snapshot.grants=(await client.query("SELECT * FROM information_schema.role_table_grants WHERE table_schema IN ('public','storage')")).rows;
 snapshot.functions=(await client.query("SELECT p.oid::regprocedure::text AS name,pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid WHERE n.nspname='public' AND p.prokind IN ('f','p')")).rows;
 snapshot.authUsers=(await client.query('SELECT id,email,created_at,last_sign_in_at FROM auth.users')).rows;
 snapshot.buckets=(await client.query('SELECT * FROM storage.buckets')).rows;
 snapshot.storageObjects=(await client.query('SELECT * FROM storage.objects')).rows;
 await client.query('COMMIT');
 const raw=JSON.stringify(snapshot,null,2);
 await fs.writeFile(path.join(dir,'database-snapshot.json'),raw,{mode:0o600,flag:'wx'});
 const manifest={projectRef,snapshotSha256:createHash('sha256').update(raw).digest('hex'),tables:Object.fromEntries(Object.entries(snapshot.tables).map(([k,v])=>[k,v.length])),objects:[]};
 // Back up only the project's own public storage objects; never fetch external profile URLs.
 for(const object of snapshot.storageObjects){
  const bucket=snapshot.buckets.find(b=>b.id===object.bucket_id);
  if(!bucket?.public)throw new Error('存在非公开存储桶，需要另行完成文件备份后再迁移');
  const url=env.VITE_SUPABASE_URL+'/storage/v1/object/public/'+encodeURIComponent(object.bucket_id)+'/'+object.name.split('/').map(encodeURIComponent).join('/');
  const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error(`存储文件备份失败：HTTP ${response.status}`);
  const bytes=Buffer.from(await response.arrayBuffer());
  if(object.metadata?.size && Number(object.metadata.size)!==bytes.length)throw new Error('存储文件大小不匹配');
  const file=object.id+'.bin';await fs.writeFile(path.join(dir,file),bytes,{mode:0o600,flag:'wx'});
  manifest.objects.push({bucket:object.bucket_id,name:object.name,file,size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
 }
 await fs.writeFile(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2),{mode:0o600,flag:'wx'});
 console.log(JSON.stringify({backupDirectory:dir,tables:manifest.tables,storageObjects:manifest.objects.length,policies:snapshot.policies.map(p=>({table:p.tablename,name:p.policyname,cmd:p.cmd,roles:p.roles,using:p.qual,check:p.with_check})),teacherColumns:snapshot.columns.filter(c=>c.table_name==='teachers').map(c=>c.column_name)}));
}catch(e){console.error(JSON.stringify({code:e.code,message:e.message}));process.exitCode=1;}
finally{await client.end().catch(()=>{});}
