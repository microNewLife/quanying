<template>
  <el-card>
    <template #header><strong>人员与认证管理</strong> <el-button @click="$router.push('/import')">导入名单</el-button> <el-button @click="load">刷新</el-button></template>
    <el-alert title="一人维护一份资料、多张认证。新人员默认待发布；合并需要姓名和学号尾段一致，且已有资料无冲突。" type="info" :closable="false" />
    <div class="toolbar"><el-input v-model="search" placeholder="搜索姓名、昵称、证书编号" clearable /><el-button :disabled="selected.length !== 2" @click="merge">合并选中的两份档案</el-button></div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-table :data="filtered" v-loading="busy" @selection-change="selected=$event" stripe row-key="id">
      <el-table-column type="selection" width="45" />
      <el-table-column prop="certificate_name" label="姓名" width="100" /><el-table-column prop="nickname" label="昵称" width="120" />
      <el-table-column prop="student_no" label="学号尾段" width="110" />
      <el-table-column label="认证资格" min-width="260"><template #default="{row}"><div v-for="c in row.certifications" :key="c.id">{{c.qualification}} · {{c.certificate_no}} {{c.is_active?'':'（停用）'}}</div></template></el-table-column>
      <el-table-column label="状态" width="100"><template #default="{row}">{{row.is_active?'已发布':'待发布'}}</template></el-table-column>
      <el-table-column label="操作" width="100"><template #default="{row}"><el-button text @click="edit(row)">编辑</el-button></template></el-table-column>
    </el-table>
  </el-card>
  <el-dialog v-model="visible" title="人员资料与认证" width="760px">
    <el-form label-width="100px">
      <el-form-item label="姓名"><el-input v-model="form.certificate_name" maxlength="100" /></el-form-item>
      <el-form-item label="昵称"><el-input v-model="form.nickname" maxlength="100" /></el-form-item>
      <el-form-item label="学号尾段"><el-input :model-value="form.student_no" disabled /></el-form-item>
      <el-form-item label="公开展示"><el-switch v-model="form.is_active" /></el-form-item>
      <el-form-item label="排序"><el-input-number v-model="form.sort_order" :precision="0" /></el-form-item>
      <el-form-item label="照片"><ImageUploader v-model="form.photo_url" bucket="images" /></el-form-item>
      <el-form-item label="标签"><el-select v-model="form.tags" multiple filterable allow-create default-first-option style="width:100%" /></el-form-item>
      <el-form-item label="简介"><el-input v-model="form.description" type="textarea" :rows="4" /></el-form-item>
      <el-form-item label="微信二维码"><ImageUploader v-model="form.qrcode_url" bucket="images" /></el-form-item>
    </el-form>
    <el-divider>认证记录（单独保存）</el-divider>
    <div v-for="c in certificates" :key="c.id" class="cert">
      <strong>{{c.certificate_no}}</strong><el-input v-model="c.qualification" placeholder="资格" />
      <div>初始年份 <el-input-number v-model="c.initial_year" :min="1900" :max="2100" :precision="0" /> 最近年份 <el-input-number v-model="c.recent_year" :min="1900" :max="2100" :precision="0" /></div>
      <el-switch v-model="c.is_active" active-text="有效展示" /> <el-button :disabled="saving" @click="saveCertificate(c)">保存此认证</el-button>
    </div>
    <template #footer><el-button @click="visible=false">关闭</el-button><el-button type="primary" :loading="saving" @click="save">保存人员资料</el-button></template>
  </el-dialog>
</template>
<script setup lang="ts">
import {ref,computed,onMounted} from 'vue';
import {ElMessage,ElMessageBox} from 'element-plus';
import {supabase} from '../../utils/supabase';
import ImageUploader from '../../components/ImageUploader.vue';
const people=ref<any[]>([]), selected=ref<any[]>([]), certificates=ref<any[]>([]);
const busy=ref(false),saving=ref(false),visible=ref(false),search=ref(''),error=ref('');
const form=ref<any>({});
const filtered=computed(()=>people.value.filter(p=>[p.certificate_name,p.nickname,...p.certifications.map((c:any)=>c.certificate_no)].join(' ').toLowerCase().includes(search.value.trim().toLowerCase())));
async function load(){
  busy.value=true;error.value='';
  try {
    const all:any[]=[];
    for(let offset=0;;offset+=500){
      const {data,error:err}=await supabase.from('people').select('*,certifications(*)').order('sort_order').order('id').range(offset,offset+499);
      if(err)throw err;all.push(...data);if(data.length<500)break;
    }
    people.value=all;
  }catch(e){error.value=(e as Error).message;}finally{busy.value=false;}
}
function edit(p:any){const {certifications,...profile}=JSON.parse(JSON.stringify(p));form.value=profile;certificates.value=certifications;visible.value=true;}
async function save(){
  if(!form.value.certificate_name.trim()){ElMessage.error('姓名不能为空');return;}
  saving.value=true;
  const {id,certificate_name,nickname,photo_url,tags,description,qrcode_url,is_active,sort_order}=form.value;
  try {
    const {data,error:err}=await supabase.from('people').update({certificate_name:certificate_name.trim(),nickname,photo_url,tags,description,qrcode_url,is_active,sort_order}).eq('id',id).select('id').single();
    if(err || !data)throw err || new Error('档案已不存在');ElMessage.success('资料已保存');visible.value=false;await load();
  }catch(e){ElMessage.error((e as Error).message);}finally{saving.value=false;}
}
async function saveCertificate(c:any){
  if(!c.qualification.trim() || (c.recent_year && (!c.initial_year || c.recent_year<c.initial_year))){ElMessage.error('请检查资格和年份');return;}
  saving.value=true;
  try{const {error:err}=await supabase.from('certifications').update({qualification:c.qualification.trim(),initial_year:c.initial_year ?? null,recent_year:c.recent_year ?? null,is_active:c.is_active}).eq('id',c.id).select('id').single();if(err)throw err;ElMessage.success('认证已保存');await load();}
  catch(e){ElMessage.error((e as Error).message);}finally{saving.value=false;}
}
async function merge(){
  const [a,b]=selected.value;if(!a||!b)return;
  try{await ElMessageBox.confirm(`将 ${b.certificate_name}（${b.student_no}）的认证归入 ${a.certificate_name}（${a.student_no}）。旧链接保留，冲突资料不会覆盖。确认是同一人？`,'合并档案');}catch{return;}
  busy.value=true;
  try{const {error:err}=await supabase.rpc('merge_people',{p_keep:a.id,p_remove:b.id});if(err)throw err;ElMessage.success('已合并并保存操作前快照');selected.value=[];await load();}
  catch(e){ElMessage.error((e as Error).message);}finally{busy.value=false;}
}
onMounted(load);
</script>
<style scoped>.toolbar{display:flex;gap:16px;margin:20px 0}.toolbar .el-input{max-width:400px}.cert{padding:16px 0;border-bottom:1px solid #eee;display:grid;gap:12px}.el-alert{margin-bottom:12px}</style>
