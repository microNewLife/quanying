import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {connection,env} from './live-connection.mjs';
const directory=new URL('../../backups/2026-09-14T09-18-28.861Z-before-migration/',import.meta.url);
const plan=JSON.parse(await fs.readFile(new URL('migration-plan.json',directory),'utf8'));
const snapshot=JSON.parse(await fs.readFile(new URL('database-snapshot.json',directory),'utf8'));
const client=connection();
const report={verifiedAt:new Date().toISOString()};
try {
 await client.connect();
 await client.query('BEGIN READ ONLY');
 report.counts=(await client.query('SELECT (SELECT count(*) FROM people)::int AS people,(SELECT count(*) FROM certifications)::int AS certificates,(SELECT count(*) FROM teachers_legacy_backup)::int AS legacy_rows,(SELECT count(*) FROM teachers)::int AS public_certificates')).rows[0];
 assert.deepEqual(report.counts,plan.expected);
 const legacy=JSON.parse(JSON.stringify((await client.query('SELECT * FROM teachers_legacy_backup ORDER BY id')).rows));
 assert.deepEqual(legacy,[...snapshot.tables.teachers].sort((a,b)=>a.id.localeCompare(b.id)));
 await client.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[plan.adminId]);
 assert.equal((await client.query('SELECT public.is_admin() AS value')).rows[0].value,true);
 const preview=(await client.query('SELECT public.import_certifications($1::jsonb,$2,$3,$4,true) AS result',[JSON.stringify(plan.rows),plan.fileName,plan.fileHash,'ad46f234-ed73-4bf5-ae8e-1d9d45aba39f'])).rows[0].result;
 report.repeatPreview=preview.rows.reduce((out,r)=>{out[r.status]=(out[r.status]||0)+1;return out;},{});
 assert.equal(report.repeatPreview.new||0,0);
 await client.query("SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true)");
 assert.equal((await client.query('SELECT public.is_admin() AS value')).rows[0].value,false);
 await client.query('SET LOCAL ROLE anon');
 assert.equal((await client.query('SELECT count(*)::int AS count FROM teachers_legacy_backup')).rows[0].count,0);
 assert.equal((await client.query('SELECT count(*)::int AS count FROM people')).rows[0].count,25);
 await client.query('ROLLBACK');
 const headers={apikey:env.VITE_SUPABASE_ANON_KEY||env.VITE_SUPABASE_PUBLISH_KEY};
 for(const [label,query,expected] of [['legacyApi','teachers?select=*',52],['peopleApi','people?select=id,certifications(id)',25],['privateBackupApi','teachers_legacy_backup?select=id',0]]){
  const response=await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/${query}`,{headers,signal:AbortSignal.timeout(20000)});
  assert.equal(response.status,200,label);
  const rows=await response.json();assert.equal(rows.length,expected,label);
  if(label==='legacyApi') for(const old of snapshot.tables.teachers.filter(r=>r.is_active)){
   const current=rows.find(r=>r.id===old.id);assert.ok(current,'old link preserved');
   for(const field of ['photo_url','description','qrcode_url'])assert.equal(current[field],old[field]);
  }
  report[label]={status:response.status,rows:rows.length};
 }
 report.originalProfilesPreserved=true;report.adminPermissionsVerified=true;
 await fs.writeFile(new URL('verification-result.json',directory),JSON.stringify(report,null,2),{mode:0o600});
 console.log(JSON.stringify(report));
} catch(e){console.error(JSON.stringify({code:e.code,message:e.code==='ERR_ASSERTION'?'Verification assertion failed':e.message,stack:e.stack?.split('\n').find(line=>line.includes('verify-live.mjs'))}));process.exitCode=1;}
finally{await client.end();}
