<template>
  <div class="dashboard">
    <section class="overview-welcome"><div><span class="welcome-kicker">YOUR DAILY WORKSPACE</span><h2>把日常管理，打理得井井有条。</h2><p>从一份新名单开始，让专业档案持续更新。</p><el-button type="primary" @click="$router.push('/import')">导入认证名单<el-icon><ArrowRight /></el-icon></el-button></div><div class="welcome-art" aria-hidden="true"><span/><i/><b/></div></section>
    <div class="section-heading"><h3>数据一览</h3><el-button text size="small" :loading="loading" @click="load">刷新数据</el-button></div>
    <el-alert v-if="error" :title="error" type="warning" :closable="false" />
    <section class="stats-grid"><article v-for="stat in stats" :key="stat.table" class="stat-card"><div class="stat-title">{{stat.title}}<el-icon><component :is="stat.icon" /></el-icon></div><strong>{{loading?'—':stat.value??'—'}}</strong><span class="stat-note">{{stat.note}}</span></article></section>
    <div class="section-heading quick-heading"><h3>常用工作</h3><span>让每一次维护，都更从容</span></div>
    <section class="quick-grid"><router-link to="/teacher" class="quick-card"><span class="quick-icon"><Avatar /></span><div><h4>完善人员档案</h4><p>整理照片、简介与认证，核对后公开展示。</p></div><el-icon><ArrowRight /></el-icon></router-link><router-link to="/course" class="quick-card"><span class="quick-icon"><Reading /></span><div><h4>维护课程内容</h4><p>更新课程介绍，管理机构的知识与经验。</p></div><el-icon><ArrowRight /></el-icon></router-link></section>
  </div>
</template>
<script setup lang="ts">
import {ref,onMounted,markRaw} from 'vue';
import {Avatar,Reading,User,Medal,ArrowRight} from '@element-plus/icons-vue';
import {supabase} from '../../utils/supabase';
const stats=ref([
 {title:'人员档案',table:'people',value:null as number|null,icon:markRaw(Avatar),note:'包含已发布与待发布档案'},
 {title:'认证记录',table:'certifications',value:null as number|null,icon:markRaw(Medal),note:'已收录的全部认证记录'},
 {title:'课程内容',table:'courses',value:null as number|null,icon:markRaw(Reading),note:'包含已发布课程与草稿'},
 {title:'用户资料',table:'users_profile',value:null as number|null,icon:markRaw(User),note:'已建立的用户档案'},
]);
const loading=ref(false),error=ref('');
async function load(){if(loading.value)return;loading.value=true;error.value='';try{await Promise.all(stats.value.map(async stat=>{const {count,error:err}=await supabase.from(stat.table).select('*',{count:'exact',head:true});stat.value=err?null:count;if(err)error.value='部分数据暂未加载成功，请稍后刷新。';}));}catch{error.value='数据暂未加载成功，请检查网络后刷新。';}finally{loading.value=false;}}
onMounted(load);
</script>
<style scoped>
.overview-welcome{background:#eaf0e4;border:1px solid #e1e9da;border-radius:16px;padding:30px 32px;position:relative;overflow:hidden;min-height:170px;box-sizing:border-box}.welcome-kicker{font-size:8px;color:#91a087;letter-spacing:.18em}.overview-welcome h2{font-size:23px;font-weight:500;letter-spacing:.025em;margin:15px 0 9px;position:relative;z-index:1}.overview-welcome p{color:#86937e;font-size:12px;margin-bottom:22px}.overview-welcome .el-button{font-size:12px;height:36px}.overview-welcome .el-icon{margin-left:10px}.welcome-art{position:absolute;right:25px;top:5px;width:180px;height:215px;pointer-events:none}.welcome-art span,.welcome-art i{position:absolute;width:145px;height:185px;border:1px solid #c1d0b5;border-radius:50%;transform:rotate(35deg)}.welcome-art i{transform:rotate(75deg);right:20px;top:30px}.welcome-art b{position:absolute;right:34px;top:75px;width:68px;height:100px;background:linear-gradient(135deg,#c0d1af,#94ad81);border-radius:100% 0 100% 0;transform:rotate(20deg)}.section-heading{display:flex;align-items:center;justify-content:space-between;margin:23px 0 12px}.section-heading h3{font-size:13px;font-weight:550;margin:0}.section-heading>span{color:#a0aa9a;font-size:10px}.stats-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.stat-card{background:#fff;border:1px solid var(--line);border-radius:12px;padding:19px}.stat-title{font-size:11px;color:#7e8d7b;display:flex;justify-content:space-between;align-items:center}.stat-title .el-icon{font-size:16px;color:#a3b09d}.stat-card strong{font-size:32px;line-height:1.2;font-weight:500;display:block;margin:20px 0 12px;font-variant-numeric:tabular-nums;color:#3b5140}.stat-note{font-size:9px;color:#9da799}.quick-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.quick-card{display:flex;align-items:center;gap:14px;text-decoration:none;color:inherit;border:1px solid var(--line);background:#fff;padding:22px;border-radius:12px;transition:background .15s}.quick-card:hover{background:#f1f5ec}.quick-icon{display:grid;place-items:center;width:37px;height:42px;color:#6e8767;background:#f0f4ec;border-radius:10px;flex-shrink:0}.quick-icon svg{width:21px}.quick-card h4{font-size:12px;font-weight:550;margin:0 0 7px}.quick-card p{font-size:10px;color:#9aa394;margin:0}.quick-card>.el-icon{margin-left:auto;color:#93a18c}@media(max-width:1100px){.welcome-art{opacity:.4;right:-35px}.overview-welcome h2{font-size:20px}.stat-card{padding:14px}.quick-card{padding:16px;gap:10px}.stat-note{font-size:8px}}
</style>
