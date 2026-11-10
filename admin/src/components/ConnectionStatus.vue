<template>
  <footer class="connection" role="status">
    <span class="connection-dot" :class="{healthy:message==='数据库连接正常',checking}" />
    <span class="connection-message">{{message}}</span>
    <span v-if="lastSuccess" class="connection-time">最近连接 {{lastSuccess}}</span>
    <el-button text size="small" :loading="checking" @click="check">重新检查</el-button>
  </footer>
</template>
<script setup lang="ts">
import {onMounted,ref} from 'vue';
import {supabase,configurationError} from '../utils/supabase';
const checking=ref(false),message=ref('正在检查数据库连接…');
const lastSuccess=ref(localStorage.getItem('supabase_last_success') || '');
async function check(){
  if(checking.value)return;
  if(configurationError){message.value=configurationError;return;}
  checking.value=true;
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),10000);
  try{
    const {error,status}=await supabase.from('organization_info').select('id').limit(1).abortSignal(controller.signal);
    if(error){
      message.value=status===401||status===403?'连接被拒绝，请检查登录或访问权限':status>=500?'服务暂时不可用，请稍后重试；如已暂停，请到 Supabase 控制台恢复':'连接失败，请检查网络和服务状态';
    }else{message.value='数据库连接正常';lastSuccess.value=new Date().toLocaleString();localStorage.setItem('supabase_last_success',lastSuccess.value);}
  }catch{message.value='连接超时或网络不可用，请重试';}finally{clearTimeout(timer);checking.value=false;}
}
onMounted(check);
</script>
<style scoped>.connection{display:flex;align-items:center;gap:8px;flex:0 0 34px;box-sizing:border-box;padding:0 22px;background:#fafbf8;color:#89958c;font-size:10px;border-top:1px solid #e5e9e1}.connection-dot{width:5px;height:5px;border-radius:50%;background:#bc8552;flex-shrink:0}.connection-dot.healthy{background:#6b9166}.connection-dot.checking{background:#a7b1a0}.connection-time{margin-left:auto;white-space:nowrap;color:#9aa398}.connection-message{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.connection .el-button{font-size:10px;color:#758573}@media(max-width:1000px){.connection-time{display:none}.connection .el-button{margin-left:auto}}</style>
