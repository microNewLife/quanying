import {_electron as electron,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
const profile=await fs.mkdtemp(path.join(os.tmpdir(),'quanying-desktop-test-'));
const user={id:'11111111-1111-4111-8111-111111111111',email:'admin@example.test',aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{}};
const jwt=['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',Buffer.from(JSON.stringify({sub:user.id,aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})).toString('base64url'),'test'].join('.');
let commits=0;
const app=await electron.launch({args:['.'],cwd:process.cwd(),env:{...process.env,QUANYING_TEST_PROFILE:profile}});
try{
 await app.context().route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.protocol==='quanying:')return route.continue();
  let data;
  if(url.pathname==='/auth/v1/token')data={access_token:jwt,refresh_token:'test-refresh',expires_in:3600,token_type:'bearer',user};
  else if(url.pathname==='/functions/v1/admin-login'){
   const body=route.request().postDataJSON();
   if(body.username!=='admin')throw new Error('Unexpected username');
   data={access_token:jwt,refresh_token:'test-refresh'};
  }
  else if(url.pathname==='/auth/v1/user')data=user;
  else if(url.pathname==='/auth/v1/logout')data={};
  else if(url.pathname==='/rest/v1/rpc/is_admin')data=true;
  else if(url.pathname==='/rest/v1/organization_info')data=[{id:'org'}];
  else if(url.pathname==='/rest/v1/import_batches')data=[];
  else if(url.pathname==='/rest/v1/rpc/import_certifications'){
   const payload=route.request().postDataJSON();
   if(!payload.p_preview)commits++;
   data={rows:payload.p_rows.map(r=>({...r,status:'new',reason:''})),inserted:payload.p_preview?0:payload.p_rows.length};
  }else return route.abort();
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 const page=await app.firstWindow();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.reload();
 await expect(page.getByText('数据库连接正常',{exact:true})).toBeVisible();
 assertRenderer: {
  const exposed=await page.evaluate(()=>typeof window.require);if(exposed!=='undefined')throw new Error('Node exposed to renderer');
 }
 await page.getByPlaceholder('请输入用户名或邮箱').fill('ADMIN');
 await page.getByPlaceholder('请输入管理员密码').fill('test-password');
 await page.getByRole('button',{name:'登录',exact:true}).click();
 await page.getByText('名单导入',{exact:true}).click();
 await page.locator('input[type=file]').setInputFiles('../local-data/柔丝体系认证名单_截至20260808.xlsx');
 await expect(page.getByText(/新增 76 条/)).toBeVisible();
 await expect(page.getByText(/文件内重复 1 条/)).toBeVisible();
 await page.getByRole('button',{name:'确认新增',exact:true}).click();
 await page.getByRole('button',{name:'OK',exact:true}).or(page.getByRole('button',{name:'确定',exact:true})).click();
 await expect(page.getByText('已完成，本次实际新增 76 张证书')).toBeVisible();
 if(commits!==1)throw new Error(`Unexpected commits: ${commits}`);
 await fs.mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/desktop-import.png',fullPage:true});
 await page.getByRole('button',{name:'退出登录'}).click();
 await expect(page.getByRole('button',{name:'登录',exact:true})).toBeVisible();
 if(errors.length)throw new Error(errors.join('\n'));
 console.log('PASS: Electron isolated renderer, connection check, login, workbook preview, confirmed import and logout (mock API).');
}finally{await app.close();await fs.rm(profile,{recursive:true,force:true});}
