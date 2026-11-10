<template>
  <el-card>
    <template #header><strong>认证名单增量导入</strong></template>
    <p>选择新版体系名单。已有数据保留，新增人员待发布。历史表和学号对照表不导入。</p>
    <input type="file" accept=".xlsx" :disabled="busy || uncertain" @change="chooseFile" />
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
    <template v-if="parsed">
      <p>文件：{{ fileName }} · 文件内重复 {{ parsed.duplicates }} 条 · 忽略工作表：{{ parsed.ignored.join('、') || '无' }}</p>
      <p>{{ summary }}</p>
      <el-alert v-if="uncertain" title="上次提交结果未确认，请点击重试确认。重试使用同一提交编号，不会重复写入。" type="warning" :closable="false" />
      <div class="actions">
        <el-button :loading="busy" :disabled="uncertain" @click="preview">重新对比</el-button>
        <el-button type="primary" :loading="busy" :disabled="!canCommit" @click="commit">{{ uncertain ? '重试确认结果' : '确认新增' }}</el-button>
        <el-button @click="downloadJson('导入核对结果.json', {fileName, rows: displayRows})">导出核对结果</el-button>
      </div>
      <el-table :data="displayRows" max-height="480" stripe>
        <el-table-column prop="sheet" label="工作表" width="110" /><el-table-column prop="row" label="行" width="60" />
        <el-table-column prop="name" label="姓名" width="100" /><el-table-column prop="certificate_no" label="证书编号" min-width="220" />
        <el-table-column label="结果" width="100"><template #default="{row}">{{ labels[row.status] || row.status }}</template></el-table-column>
        <el-table-column prop="reason" label="说明" min-width="260" />
      </el-table>
    </template>
  </el-card>
  <el-card class="history">
    <template #header>导入与合并历史 <el-button text @click="loadHistory">刷新</el-button></template>
    <el-table :data="history">
      <el-table-column prop="file_name" label="操作/文件" /><el-table-column prop="created_at" label="时间" />
      <el-table-column label="操作"><template #default="{row}"><el-button text @click="exportBackup(row.id)">导出操作前快照</el-button><el-button text @click="downloadJson('操作结果.json', row.result)">导出结果</el-button></template></el-table-column>
    </el-table>
    <p>快照保存在数据库中，建议导出到电脑另存。这里只保存名单数据，不包含图片文件和其他业务表。</p>
  </el-card>
</template>
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { supabase } from '../../utils/supabase';
import { parseWorkbook, type ParsedWorkbook, type ImportRow } from '../../utils/importWorkbook';
import { downloadJson } from '../../utils/download';
const parsed = ref<ParsedWorkbook>(); const fileName = ref(''); const busy = ref(false); const error = ref('');
const resultRows = ref<ImportRow[]>([]); const history = ref<any[]>([]); const uncertain = ref(false); const committed = ref(false); const reviewed = ref(false);
let requestId = crypto.randomUUID();
const pendingKey = 'pending_certification_import';
const labels: Record<string,string> = {new:'新增',skipped:'已存在',conflict:'冲突',invalid:'无效',duplicate:'重复'};
const displayRows = computed(() => [...resultRows.value, ...(parsed.value?.issues || [])]);
const summary = computed(() => Object.entries(labels).map(([key,label]) => `${label} ${displayRows.value.filter(r => r.status === key).length} 条`).join(' · '));
const canCommit = computed(() => uncertain.value || (reviewed.value && !committed.value && resultRows.value.some(r => r.status === 'new')));
async function chooseFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]; if (!file) return;
  busy.value = true; error.value = ''; parsed.value = undefined; resultRows.value = []; reviewed.value = false; committed.value = false;
  try {
    if (!file.name.toLowerCase().endsWith('.xlsx')) throw new Error('请选择 .xlsx 文件');
    if (file.size > 10*1024*1024) throw new Error('文件不能超过 10 MB');
    parsed.value = await parseWorkbook(await file.arrayBuffer()); fileName.value = file.name;
    requestId = crypto.randomUUID(); await compare();
  } catch(e) { error.value = (e as Error).message; } finally { busy.value = false; }
}
async function callImport(preview: boolean) {
  const {data,error: err} = await supabase.rpc('import_certifications', {p_rows:parsed.value!.rows,p_file_name:fileName.value,p_file_hash:parsed.value!.hash,p_request_id:requestId,p_preview:preview});
  if(err) throw err; return data;
}
async function compare() { const data = await callImport(true); resultRows.value = data.rows; reviewed.value = true; }
async function preview() {
  busy.value = true; error.value = ''; reviewed.value = false;
  try { requestId = crypto.randomUUID(); committed.value = false; await compare(); } catch(e) { error.value = (e as Error).message; } finally {busy.value=false;}
}
async function commit() {
  if (!canCommit.value || busy.value) return;
  if (!uncertain.value) {
    try {await ElMessageBox.confirm('仅新增可导入证书；冲突和无效行保留在核对结果中。新人员默认待发布。确定执行？','确认增量导入',{confirmButtonText:'确定',cancelButtonText:'取消'});} catch {return;}
  }
  busy.value=true; error.value='';
  try {
    // Persist before dispatch; a window close/network timeout must not lose the retry identity.
    localStorage.setItem(pendingKey,JSON.stringify({parsed:parsed.value,fileName:fileName.value,requestId}));
    uncertain.value=true;
    const data=await callImport(false); resultRows.value=data.rows; uncertain.value=false; committed.value=true;
    localStorage.removeItem(pendingKey); ElMessage.success(`已完成，本次实际新增 ${data.inserted} 张证书`); await loadHistory();
  } catch(e) {error.value=(e as Error).message;} finally {busy.value=false;}
}
async function loadHistory() {
  const {data,error:err}=await supabase.from('import_batches').select('id,file_name,created_at,result').order('created_at',{ascending:false}).limit(30);
  if(err) {error.value=err.message;return;} history.value=data || [];
}
async function exportBackup(id: string) {
  const {data,error:err}=await supabase.from('import_batches').select('*').eq('id',id).single();
  if(err) {ElMessage.error(err.message);return;} downloadJson(`名单操作前快照-${id}.json`,data);
}
onMounted(() => {
  try {const raw=localStorage.getItem(pendingKey); if(raw) {const p=JSON.parse(raw);parsed.value=p.parsed;fileName.value=p.fileName;requestId=p.requestId;uncertain.value=true;}}
  catch {error.value='无法读取待确认提交记录，请保留本地数据并联系维护人员';}
  loadHistory();
});
</script>
<style scoped>.actions{display:flex;gap:12px;margin:20px 0}.history{margin-top:20px}.el-alert{margin:16px 0}p{color:#606266;line-height:1.7}</style>
