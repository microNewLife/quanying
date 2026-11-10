import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISH_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn("⚠️ Supabase 环境变量缺失，请检查项目根目录的 .env 文件！");
}

let invalidKey = false;
try {
  invalidKey = supabaseKey?.startsWith('sb_secret_') || (supabaseKey?.split('.').length === 3 && JSON.parse(atob(supabaseKey.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role === 'service_role');
} catch { invalidKey = true; }
let validUrl=false;
try {validUrl=new URL(supabaseUrl).protocol==='https:';} catch {validUrl=false;}
export const configurationError = !supabaseUrl || !supabaseKey ? '缺少 Supabase 配置，请配置后重新构建' : !validUrl ? 'Supabase 地址必须是有效的 HTTPS 地址' : invalidKey ? '客户端禁止使用管理密钥，请改用 publishable/anon key' : '';
export const supabase = createClient(configurationError ? 'https://invalid.supabase.co' : supabaseUrl, configurationError ? 'configuration-missing' : supabaseKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  global: { fetch: (input, init) => fetch(input, { ...init, signal: init?.signal || AbortSignal.timeout(20000) }) },
});
