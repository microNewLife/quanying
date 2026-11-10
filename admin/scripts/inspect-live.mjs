import {connection} from './live-connection.mjs';
const client=connection();
try {
 await client.connect();
 await client.query('BEGIN READ ONLY');
 const tables=await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
 const counts=tables.rows.some(r=>r.tablename==='teachers')?await client.query('SELECT count(*)::int AS teachers FROM public.teachers'):{rows:[]};
 const admins=await client.query('SELECT id,email,last_sign_in_at FROM auth.users ORDER BY created_at');
 console.log(JSON.stringify({tables:tables.rows,counts:counts.rows,accounts:admins.rows}));
 await client.query('ROLLBACK');
}catch(e){console.error(JSON.stringify({code:e.code,message:e.message}));process.exitCode=1;}
finally{await client.end().catch(()=>{});}
