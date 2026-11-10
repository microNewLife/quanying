const { createClient } = require('supabase-wechat-stable-v2');
const { ENV } = require('../env.js');

// 初始化 Supabase 客户端，使用专门支持微信小程序的 storage 配置持久化 Session
const supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY, {
  auth: {
    storage: wx, // 微信特有的 Storage API 适配
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});

module.exports = { supabase };
