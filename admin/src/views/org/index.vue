<template>
  <div class="org-container">
    <el-card class="box-card" v-loading="loading">
      <template #header>
        <div class="card-header">
          <span>机构基本信息配置</span>
          <el-button type="primary" @click="handleSave">保存修改</el-button>
        </div>
      </template>

      <el-form :model="orgData" label-width="120px" v-if="orgData">
        <el-form-item label="机构名称">
          <el-input
            v-model="orgData.name"
            placeholder="例如：犬影村"
          ></el-input>
        </el-form-item>

        <el-form-item label="机构简介">
          <el-input
            type="textarea"
            :rows="4"
            v-model="orgData.description"
            placeholder="机构的详细介绍，对外展示用"
          ></el-input>
        </el-form-item>

        <el-form-item label="线下地址">
          <el-input
            v-model="orgData.address"
            placeholder="详细的联系地址"
          ></el-input>
        </el-form-item>

        <el-form-item label="联系电话">
          <el-input
            v-model="orgData.contact_phone"
            placeholder="咨询热线手机或固话"
          ></el-input>
        </el-form-item>

        <el-form-item label="机构 Logo">
          <div class="logo-upload-area">
            <ImageUploader
              v-model="orgData.logo_url"
              bucket="images"
              class="logo-uploader"
            />
            <div class="logo-upload-tip">
              <el-text type="info" size="small">
                点击图片区域可直接上传（支持 JPG/PNG，最大 5MB）
              </el-text>
              <el-divider content-position="left">或手动填写外链</el-divider>
              <el-input
                v-model="orgData.logo_url"
                placeholder="也可以直接粘贴图片 URL"
                clearable
              ></el-input>
            </div>
          </div>
        </el-form-item>
      </el-form>
      <el-empty v-else description="暂无机构信息，请先在数据库初始化数据" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { ElMessage } from "element-plus";
import { supabase } from "../../utils/supabase";
import ImageUploader from "../../components/ImageUploader.vue";

const loading = ref(false);
const orgData = ref<any>(null);

const fetchOrgInfo = async () => {
  loading.value = true;
  const { data, error } = await supabase
    .from("organization_info")
    .select("*")
    .limit(1)
    .single();

  if (error) {
    if (error.code !== "PGRST116") {
      // not found error
      ElMessage.error("获取机构信息失败: " + error.message);
    }
  } else {
    orgData.value = data;
  }
  loading.value = false;
};

const handleSave = async () => {
  if (!orgData.value) return;
  loading.value = true;

  const { error } = await supabase
    .from("organization_info")
    .update({
      name: orgData.value.name,
      description: orgData.value.description,
      address: orgData.value.address,
      contact_phone: orgData.value.contact_phone,
      logo_url: orgData.value.logo_url,
    })
    .eq("id", orgData.value.id);

  if (error) {
    ElMessage.error("保存失败: " + error.message);
  } else {
    ElMessage.success("保存成功！");
  }
  loading.value = false;
};

onMounted(() => {
  fetchOrgInfo();
});
</script>

<style scoped>
.org-container {
  max-width: 800px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.logo-upload-area {
  display: flex;
  align-items: flex-start;
  gap: 24px;
  width: 100%;
}
.logo-upload-tip {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
}
</style>
