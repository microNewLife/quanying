<template>
  <div class="image-uploader">
    <el-upload
      class="avatar-uploader"
      action="#"
      :show-file-list="false"
      :http-request="customUpload"
      :before-upload="beforeUpload"
    >
      <img v-if="imageUrl" :src="imageUrl" class="avatar" />
      <el-icon v-else class="avatar-uploader-icon" v-loading="loading"
        ><Plus
      /></el-icon>
    </el-upload>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { Plus } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import { supabase } from "../utils/supabase";
import type { UploadRequestOptions, UploadRawFile } from "element-plus";
import { v4 as uuidv4 } from "uuid";

const props = defineProps<{
  modelValue: string;
  bucket?: string; // Supabase storage bucket name, default is 'public'
}>();

const emit = defineEmits(["update:modelValue"]);

const imageUrl = ref(props.modelValue);
const loading = ref(false);

watch(
  () => props.modelValue,
  (newVal) => {
    imageUrl.value = newVal;
  },
);

const beforeUpload = (file: UploadRawFile) => {
  const isImage = file.type.startsWith("image/");
  const isLt5M = file.size / 1024 / 1024 < 5;

  if (!isImage) {
    ElMessage.error("只能上传图片格式的文件!");
    return false;
  }
  if (!isLt5M) {
    ElMessage.error("图片大小不能超过 5MB!");
    return false;
  }
  return true;
};

const customUpload = async (options: UploadRequestOptions) => {
  try {
    loading.value = true;
    const file = options.file;
    const fileExt = file.name.split(".").pop();
    const fileName = `${uuidv4()}.${fileExt}`;
    const bucketName = props.bucket || "images";

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    // Get public URL
    const { data } = supabase.storage.from(bucketName).getPublicUrl(fileName);

    const finalUrl = data.publicUrl;
    imageUrl.value = finalUrl;
    emit("update:modelValue", finalUrl);
    ElMessage.success("上传成功!");
    options.onSuccess?.(finalUrl);
  } catch (error: any) {
    ElMessage.error("上传图片失败：" + error.message);
    options.onError?.(error);
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.avatar-uploader .avatar {
  width: 120px;
  height: 120px;
  display: block;
  object-fit: cover;
  border-radius: 4px;
}
</style>

<style>
.avatar-uploader .el-upload {
  border: 1px dashed var(--el-border-color);
  border-radius: 6px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: var(--el-transition-duration-fast);
}

.avatar-uploader .el-upload:hover {
  border-color: var(--el-color-primary);
}

.el-icon.avatar-uploader-icon {
  font-size: 28px;
  color: #8c939d;
  width: 120px;
  height: 120px;
  text-align: center;
}
</style>
