<template>
  <div class="workspace">
    <aside class="workspace-sidebar">
      <div class="sidebar-heading"><span class="brand-mark">Q</span><div><strong>犬影村</strong><small>让每一份专业被看见</small></div></div>
      <span class="nav-caption">工作空间</span>
      <nav aria-label="主要导航">
        <router-link v-for="item in navigation" :key="item.path" :to="item.path" class="nav-item" :class="{active:route.path===item.path}"><el-icon><component :is="item.icon" /></el-icon><span>{{item.title}}</span><span v-if="route.path===item.path" class="nav-indicator" /></router-link>
      </nav>
      <div class="sidebar-bottom"><div class="account-avatar">管</div><div class="account-copy"><strong>管理员</strong><small>机构管理工作空间</small></div><el-button text circle aria-label="退出登录" title="退出登录" @click="handleLogout"><el-icon><SwitchButton /></el-icon></el-button></div>
    </aside>
    <section class="workspace-body">
      <header class="page-heading"><div><span class="eyebrow">{{current?.eyebrow || 'WORKSPACE'}}</span><h1>{{current?.title || '管理工作台'}}</h1><p>{{current?.description}}</p></div><span class="workspace-tag"><span />机构工作空间</span></header>
      <main class="workspace-content"><router-view /></main>
    </section>
  </div>
</template>
<script setup lang="ts">
import {computed} from 'vue';
import {useRouter,useRoute} from 'vue-router';
import {House,OfficeBuilding,Avatar,Reading,User,Upload,SwitchButton} from '@element-plus/icons-vue';
import {supabase} from '../utils/supabase';
import {ElMessage} from 'element-plus';
const router=useRouter(),route=useRoute();
const navigation=[
 {path:'/dashboard',title:'工作概览',icon:House,eyebrow:'OVERVIEW',description:'人员、认证与课程，在这里有序管理。'},
 {path:'/teacher',title:'人员与认证',icon:Avatar,eyebrow:'PEOPLE & CERTIFICATIONS',description:'维护专业档案，让每一项认证清晰可查。'},
 {path:'/import',title:'名单导入',icon:Upload,eyebrow:'IMPORT CENTER',description:'导入最新名单，核对变化，保留已有资料。'},
 {path:'/course',title:'课程库',icon:Reading,eyebrow:'COURSES',description:'整理课程内容，持续传递专业知识。'},
 {path:'/user',title:'用户与进度',icon:User,eyebrow:'LEARNING',description:'查看用户资料与课程学习进度。'},
 {path:'/org',title:'机构信息',icon:OfficeBuilding,eyebrow:'ORGANIZATION',description:'维护机构介绍与对外展示信息。'},
];
const current=computed(()=>navigation.find(item=>item.path===route.path));
async function handleLogout(){const {error}=await supabase.auth.signOut({scope:'local'});if(error){ElMessage.error('退出失败，请重试');return;}localStorage.removeItem('supabase_admin_token');router.push('/login');}
</script>
<style scoped>
.workspace{display:flex;flex:1;min-height:0}.workspace-sidebar{width:224px;flex-shrink:0;background:#fafbf8;border-right:1px solid var(--line);display:flex;flex-direction:column;padding:32px 16px 16px;box-sizing:border-box}.sidebar-heading{display:flex;gap:12px;align-items:center;margin:0 10px 40px}.sidebar-heading strong{font-size:19px;letter-spacing:.12em}.sidebar-heading small{display:block;color:#89958b;font-size:10px;margin-top:6px}.nav-caption{font-size:10px;color:#99a299;letter-spacing:.15em;padding:0 16px;margin-bottom:12px}.nav-item{display:flex;align-items:center;gap:13px;height:46px;margin-bottom:6px;padding:0 16px;color:#718075;text-decoration:none;border-radius:10px;font-size:13px;transition:background .15s,color .15s}.nav-item .el-icon{font-size:18px}.nav-item:hover{background:#eef2ec;color:#294d3f}.nav-item.active{background:#e6eee6;color:#244b39;font-weight:650}.nav-indicator{width:5px;height:5px;border-radius:50%;background:#3e6b4e;margin-left:auto}.sidebar-bottom{margin-top:auto;padding:18px 4px 0;border-top:1px solid var(--line);display:flex;align-items:center;gap:9px}.account-avatar{width:34px;height:34px;border-radius:50%;background:#e9ede4;color:#587052;display:grid;place-items:center;font-size:12px}.account-copy{flex:1}.account-copy strong{font-size:12px;font-weight:500}.account-copy small{display:block;font-size:9px;color:#8b968e;margin-top:4px}.workspace-body{flex:1;min-width:0;display:flex;flex-direction:column;overflow:hidden}.page-heading{padding:32px 36px 24px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0}.eyebrow{font-size:9px;letter-spacing:.2em;color:#869487}.page-heading h1{font-size:25px;letter-spacing:.03em;font-weight:600;margin:9px 0}.page-heading p{font-size:12px;color:#89948d;margin:0}.workspace-tag{font-size:10px;color:#77857a;display:flex;gap:7px;align-items:center}.workspace-tag span{width:5px;height:5px;border-radius:50%;background:#91a986}.workspace-content{overflow:auto;flex:1;min-height:0;padding:0 36px 32px}@media(max-width:1100px){.workspace-sidebar{width:200px}.page-heading{padding:24px}.workspace-content{padding:0 24px 24px}.workspace-tag{display:none}}
</style>
