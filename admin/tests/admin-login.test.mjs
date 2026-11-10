import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
const source=await fs.readFile(new URL('../../supabase/functions/admin-login/index.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
function server(responses){
 let handler;const calls=[];
 vm.runInNewContext(compiled,{Request,Response,AbortSignal,Deno:{env:{get:k=>({SUPABASE_URL:'https://project.test',SUPABASE_SERVICE_ROLE_KEY:'private-key',SUPABASE_ANON_KEY:'public-key'})[k]},serve:h=>handler=h},fetch:async(url,options)=>{calls.push({url,options});const response=responses.shift();assert.ok(response,'Unexpected network call');return new Response(JSON.stringify(response.body),{status:response.status||200});}});
 return {calls,login:body=>handler(new Request('https://project.test/functions/v1/admin-login',{method:'POST',body:JSON.stringify(body)}))};
}
test('username login delegates password checks to Auth and returns no private key',async()=>{
 const s=server([{body:[{user_id:'user-id'}]},{body:{email:'admin@example.test'}},{body:{access_token:'token',refresh_token:'refresh'}},{body:true}]);
 const r=await s.login({username:' ADMIN ',password:'example-password'});
 assert.equal(r.status,200);assert.deepEqual(await r.json(),{access_token:'token',refresh_token:'refresh'});
 assert.ok(s.calls[0].url.includes('username=eq.admin'));
 assert.deepEqual(JSON.parse(s.calls[2].options.body),{email:'admin@example.test',password:'example-password'});
 assert.equal(s.calls[2].options.headers.apikey,'public-key');
 assert.equal(r.headers.get('cache-control'),'no-store');
});
test('unknown username, wrong password and removed admin cannot obtain a session',async()=>{
 const cases=[[],[{body:[]}],[{body:[{user_id:'user-id'}]},{body:{email:'admin@example.test'}},{status:400,body:{error:'bad'}}],[{body:[{user_id:'user-id'}]},{body:{email:'admin@example.test'}},{body:{access_token:'token',refresh_token:'refresh'}},{body:false},{body:{}}]];
 for(let i=0;i<cases.length;i++){
  const s=server(cases[i]);const r=await s.login({username:i===0?'bad@name':'admin',password:'wrong'});
  assert.equal(r.status,401);assert.deepEqual(await r.json(),{error:'用户名或密码错误'});
 }
});
test('username binding is unique and not readable by anonymous users',async()=>{
 const db=new PGlite();try{
  await db.exec('CREATE ROLE anon; CREATE ROLE service_role BYPASSRLS; CREATE TABLE admin_users(user_id uuid PRIMARY KEY); ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY; GRANT SELECT ON admin_users TO anon;');
  await db.exec(await fs.readFile(new URL('../../supabase/migrations/202609140003_admin_username.sql',import.meta.url),'utf8'));
  await db.exec("INSERT INTO admin_users VALUES('11111111-1111-4111-8111-111111111111','admin')");
  await assert.rejects(()=>db.exec("INSERT INTO admin_users VALUES('22222222-2222-4222-8222-222222222222','admin')"),/unique/);
  await assert.rejects(()=>db.exec("UPDATE admin_users SET username='ADMIN'"),/check/);
  await db.exec('SET ROLE anon');assert.equal((await db.query('SELECT * FROM admin_users')).rows.length,0);
  await db.exec('RESET ROLE; SET ROLE service_role');assert.equal((await db.query('SELECT * FROM admin_users')).rows.length,1);
 }finally{await db.close();}
});
