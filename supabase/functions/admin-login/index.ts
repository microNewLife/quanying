// Public login endpoint. Password verification and sessions remain in Supabase Auth.
const headers = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Cache-Control':'no-store','Content-Type':'application/json'};
const reply = (status: number, value: unknown) => new Response(JSON.stringify(value), {status, headers});
Deno.serve(async (request: Request) => {
 if (request.method === 'OPTIONS') return new Response(null, {status:204, headers});
 if (request.method !== 'POST') return reply(405, {error:'不支持的请求方式'});
 try {
  if (Number(request.headers.get('content-length')) > 4096) return reply(413, {error:'请求过长'});
  const text = await request.text();
  if (text.length > 4096) return reply(413, {error:'请求过长'});
  const body = JSON.parse(text);
  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
  if (!/^[a-z][a-z0-9_]{2,31}$/.test(username) || typeof body.password !== 'string' || !body.password || body.password.length > 1024) return reply(401, {error:'用户名或密码错误'});
  const url = Deno.env.get('SUPABASE_URL')!;
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const adminHeaders = {apikey:secret, Authorization:`Bearer ${secret}`};
  const records = await fetch(`${url}/rest/v1/admin_users?select=user_id&username=eq.${encodeURIComponent(username)}&limit=1`, {headers:adminHeaders, signal:AbortSignal.timeout(10000)});
  if (!records.ok) return reply(503, {error:'登录服务暂不可用，请稍后重试'});
  const matches = await records.json();
  if (!matches.length) return reply(401, {error:'用户名或密码错误'});
  const accountResponse = await fetch(`${url}/auth/v1/admin/users/${matches[0].user_id}`, {headers:adminHeaders, signal:AbortSignal.timeout(10000)});
  if (!accountResponse.ok) return reply(503, {error:'登录服务暂不可用，请稍后重试'});
  const account = await accountResponse.json();
  if (!account.email) return reply(401, {error:'用户名或密码错误'});
  const login = await fetch(`${url}/auth/v1/token?grant_type=password`, {method:'POST', headers:{apikey:anon,'Content-Type':'application/json'}, body:JSON.stringify({email:account.email,password:body.password}), signal:AbortSignal.timeout(10000)});
  if (!login.ok) return reply(login.status === 429 ? 429 : 401, {error:login.status === 429 ? '尝试次数过多，请稍后重试' : '用户名或密码错误'});
  const session = await login.json();
  // Check the current authorization again after authentication, including removal races.
  const allowed = await fetch(`${url}/rest/v1/rpc/is_admin`, {method:'POST',headers:{apikey:anon,Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(10000)});
  if (!allowed.ok || await allowed.json() !== true) {
   await fetch(`${url}/auth/v1/logout?scope=local`, {method:'POST',headers:{apikey:anon,Authorization:`Bearer ${session.access_token}`}});
   return reply(401, {error:'用户名或密码错误'});
  }
  return reply(200, {access_token:session.access_token,refresh_token:session.refresh_token});
 } catch {return reply(503, {error:'登录服务暂不可用，请稍后重试'});}
});
