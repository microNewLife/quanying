import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";

// https://vite.dev/config/
export default defineConfig(({mode}) => {
  const env=loadEnv(mode,process.cwd(),'VITE_');
  const key=env.VITE_SUPABASE_PUBLISH_KEY || env.VITE_SUPABASE_ANON_KEY || '';
  if(key) {
    let publicKey=key.startsWith('sb_publishable_');
    if(key.split('.').length===3) {
      try {publicKey=JSON.parse(Buffer.from(key.split('.')[1]!, 'base64url').toString()).role==='anon';} catch {publicKey=false;}
    }
    if(!publicKey) throw new Error('构建已停止：只允许 Supabase publishable/anon 密钥，禁止将管理密钥打包到客户端。');
  }
  return {
  base: './',
  plugins: [vue()],
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
  };
});
