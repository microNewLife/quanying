// One-time operator task. Password is read from a protected temporary file and never logged.
import fs from 'node:fs/promises';
import {connection,env} from './live-connection.mjs';
if(process.argv[2]!=='--bind-existing-admin' || !process.argv[3])throw new Error('An explicitly approved account operation and password file are required');
const passwordFile=process.argv[3];
const password=await fs.readFile(passwordFile,'utf8');
const client=connection();let transaction=false;
try{
 await client.connect();await client.query('BEGIN');transaction=true;
 const account=(await client.query("SELECT u.id FROM auth.users u JOIN public.admin_users a ON a.user_id=u.id WHERE u.email=$1 FOR UPDATE",['micro0410@gmail.com'])).rows;
 if(account.length!==1 || account[0].id!=='626c6f8d-f096-4656-b107-7e1f169ad59a')throw new Error('Existing administrator identity does not match');
 const column=(await client.query("SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='admin_users' AND column_name='username'")).rows;
 if(!column.length){
  const sql=await fs.readFile(new URL('../../supabase/migrations/202609140003_admin_username.sql',import.meta.url),'utf8');
  await client.query(sql.replace(/^BEGIN;\s*/m,'').replace(/^COMMIT;\s*/m,''));
 }
 await client.query('UPDATE public.admin_users SET username=$1 WHERE user_id=$2',['admin',account[0].id]);
 // Supabase Auth stores bcrypt hashes; only this explicitly selected account is changed.
 await client.query("UPDATE auth.users SET encrypted_password=extensions.crypt($1,extensions.gen_salt('bf',10)),updated_at=now() WHERE id=$2",[password,account[0].id]);
 await client.query("NOTIFY pgrst, 'reload schema'");
 await client.query('COMMIT');transaction=false;
 const apikey=env.VITE_SUPABASE_ANON_KEY||env.VITE_SUPABASE_PUBLISH_KEY;
 const response=await fetch(`${env.VITE_SUPABASE_URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey,'Content-Type':'application/json'},body:JSON.stringify({email:'micro0410@gmail.com',password}),signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw new Error(`Account updated; login verification returned HTTP ${response.status}`);
 const session=await response.json();
 const role=await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/rpc/is_admin`,{method:'POST',headers:{apikey,Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:'{}'});
 if(!role.ok || await role.json()!==true)throw new Error('Administrator verification failed');
 await fetch(`${env.VITE_SUPABASE_URL}/auth/v1/logout?scope=local`,{method:'POST',headers:{apikey,Authorization:`Bearer ${session.access_token}`}});
 console.log(JSON.stringify({bound:true,username:'admin',email:'micro0410@gmail.com',passwordLoginVerified:true,administratorVerified:true}));
}catch(e){if(transaction)await client.query('ROLLBACK').catch(()=>{});console.error(JSON.stringify({code:e.code,message:e.message}));process.exitCode=1;}
finally{await client.end().catch(()=>{});await fs.rm(passwordFile,{force:true});}
