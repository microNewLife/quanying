<template>
  <main class="login-container">
    <section class="login-story">
      <div class="story-brand"><span class="brand-mark">Q</span><span>QUANYING</span></div>
      <div class="story-art" aria-hidden="true"><div class="orbit orbit-one"/><div class="orbit orbit-two"/><div class="orbit orbit-three"/><span class="art-seed"/><span class="art-dot"/></div>
      <div class="story-copy"><span class="story-kicker">CARE · KNOWLEDGE · CONNECTION</span><h1>让专业生长，<br>让联结发生。</h1><p>每一份认证，都是信任的起点。<br>在这里，一起照顾更好的日常。</p></div>
      <span class="story-footer">犬影村 · 机构管理工作空间</span>
    </section>
    <section class="login-panel"><div class="login-content">
      <span class="login-eyebrow">WELCOME BACK</span><h2>欢迎回到犬影村</h2><p class="login-description">登录工作台，开始今天的管理工作。</p>
      <el-alert v-if="route.query.reason" :title="String(route.query.reason)" type="warning" :closable="false" />
      <el-form :model="loginForm" :rules="rules" ref="loginFormRef" label-position="top" class="login-form" size="large">
        <el-form-item label="用户名或邮箱" prop="email"><el-input v-model="loginForm.email" autocomplete="username" placeholder="请输入用户名或邮箱" /></el-form-item>
        <el-form-item label="密码" prop="password"><el-input type="password" v-model="loginForm.password" autocomplete="current-password" show-password @keyup.enter="handleLogin" placeholder="请输入管理员密码" /></el-form-item>
        <el-button type="primary" class="login-btn" :loading="loading" @click="handleLogin">登录<el-icon><ArrowRight /></el-icon></el-button>
      </el-form><p class="login-note"><span />仅限已授权的机构管理员访问</p>
    </div><span class="login-footer">QUANYING WORKSPACE</span></section>
  </main>
</template>
<script setup lang="ts">
import { ref } from "vue";
import { useRouter, useRoute } from "vue-router";
import { ElMessage } from "element-plus";
import { supabase, configurationError } from "../../utils/supabase";

const router = useRouter();
const route = useRoute();
const loginFormRef = ref();
const loading = ref(false);

const loginForm = ref({
  email: "",
  password: "",
});

const rules = {
  email: [
    { required: true, message: "请输入用户名或邮箱", trigger: "blur" },
  ],
  password: [{ required: true, message: "请输入管理员密码", trigger: "blur" }],
};

const handleLogin = () => {
  loginFormRef.value?.validate(async (valid: boolean) => {
    if (valid) {
      try {
        loading.value = true;
        if(configurationError) throw new Error(configurationError);

        const identifier = loginForm.value.email.trim();
        let loginResult;
        if (identifier.includes('@')) {
          loginResult = await supabase.auth.signInWithPassword({
            email: identifier, password: loginForm.value.password,
          });
        } else {
          const {data: tokens, error: loginError} = await supabase.functions.invoke('admin-login', {
            body: {username: identifier.toLowerCase(), password: loginForm.value.password},
          });
          if (loginError || !tokens?.access_token || !tokens?.refresh_token) {
            let message = '登录失败，请检查用户名、密码或网络连接';
            if (loginError?.context instanceof Response) {
              const details = await loginError.context.json().catch(() => null);
              if (details?.error) message = details.error;
            }
            throw new Error(message);
          }
          loginResult = await supabase.auth.setSession(tokens);
        }
        const {data, error} = loginResult;

        if (error) {
          throw error;
        }

        if (data.session) {
          const { data: admin, error: roleError } = await supabase.rpc('is_admin');
          if(roleError || !admin) {
            await supabase.auth.signOut({scope:'local'});
            throw new Error(roleError ? '管理员验证失败，请检查数据库迁移和连接' : '该账号没有管理员权限');
          }
          ElMessage.success("登录成功");
          router.push("/");
        }
      } catch (error: any) {
        ElMessage.error(error.message || "登录失败，请检查账号密码！");
      } finally {
        loading.value = false;
      }
    }
  });
};
</script>

<style scoped>
.login-container{display:flex;flex:1;min-height:0;overflow:auto;padding:24px;gap:24px;box-sizing:border-box}.login-story{position:relative;flex:1;min-width:340px;overflow:hidden;border-radius:20px;background:#e6ecdf;padding:38px 42px;display:flex;flex-direction:column;box-sizing:border-box}.story-brand{display:flex;align-items:center;gap:12px;font-size:11px;letter-spacing:.22em;color:#446045}.story-art{position:absolute;width:420px;height:420px;right:-70px;top:0;opacity:.8}.orbit{position:absolute;border:1px solid #acbda2;border-radius:50%;width:290px;height:370px;transform:rotate(35deg);right:0;top:20px}.orbit-two{transform:rotate(65deg);right:55px;top:-20px}.orbit-three{transform:rotate(95deg);right:0;top:-65px}.art-seed{position:absolute;top:95px;right:148px;width:110px;height:155px;background:linear-gradient(140deg,#b4c6a0,#75926c);border-radius:100% 0 100% 0;transform:rotate(18deg)}.art-dot{position:absolute;right:100px;top:285px;width:19px;height:19px;background:#d3b57a;border-radius:50%}.story-copy{position:relative;margin-top:auto;padding-top:190px;z-index:1}.story-kicker{font-size:8px;letter-spacing:.2em;color:#738768}.story-copy h1{font-family:'Songti SC','Noto Serif SC',serif;font-size:40px;line-height:1.5;font-weight:500;letter-spacing:.06em;margin:20px 0;color:#354b36}.story-copy p{font-size:12px;color:#7d8d73;line-height:1.9}.story-footer{font-size:9px;color:#98a28e;letter-spacing:.12em;margin-top:42px}.login-panel{flex:1;min-width:380px;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative}.login-content{width:340px;max-width:calc(100% - 40px)}.login-eyebrow{font-size:9px;color:#8a9a86;letter-spacing:.2em}.login-content h2{font-size:27px;font-weight:550;color:#344638;margin:16px 0 12px;letter-spacing:.03em}.login-description{font-size:12px;color:#919a90;margin-bottom:38px}.login-form :deep(.el-form-item__label){font-size:12px;color:#667660}.login-form :deep(.el-input__wrapper){background:#fcfdfb;min-height:40px}.login-form :deep(.el-input__inner){font-size:12px}.login-btn{width:100%;height:46px;margin-top:8px;letter-spacing:.15em}.login-btn .el-icon{margin-left:12px}.login-note{font-size:10px;color:#9aa495;text-align:center;margin-top:22px;display:flex;justify-content:center;align-items:center;gap:7px}.login-note span{width:4px;height:4px;background:#93a488;border-radius:50%}.login-footer{position:absolute;bottom:22px;font-size:8px;letter-spacing:.22em;color:#b0b9a9}@media(max-height:760px){.story-copy{padding-top:100px}.story-copy h1{font-size:32px}.story-footer{margin-top:20px}}@media(max-width:1000px){.login-story{padding:30px}.story-copy h1{font-size:30px}.login-panel{min-width:340px}}
</style>
