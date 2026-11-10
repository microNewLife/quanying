<template>
  <div class="course-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>展示课程库管理</span>
          <el-button type="primary" @click="openDialog()">+ 新增课程</el-button>
        </div>
      </template>

      <el-table :data="tableData" v-loading="loading" style="width: 100%">
        <el-table-column
          prop="sort_order"
          label="推荐权重"
          width="100"
        ></el-table-column>
        <el-table-column label="封面" width="100">
          <template #default="scope">
            <el-image
              :src="scope.row.cover_url"
              style="width: 60px; height: 60px; border-radius: 4px"
            />
          </template>
        </el-table-column>
        <el-table-column
          prop="title"
          label="课程名称"
          width="200"
        ></el-table-column>
        <el-table-column label="详情及外链" show-overflow-tooltip>
          <template #default="scope">
            <span v-if="scope.row.external_link"
              >链接：{{ scope.row.external_link }}</span
            >
            <span v-else>无外联</span>
            | 简介：{{ scope.row.description }}
          </template>
        </el-table-column>
        <el-table-column label="上架状态" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.is_published ? 'success' : 'info'">
              {{ scope.row.is_published ? "上架中" : "已归档" }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="scope">
            <el-button size="small" @click="openDialog(scope.row)"
              >编辑</el-button
            >
            <el-popconfirm
              title="确定要删除这门课程吗？"
              @confirm="handleDelete(scope.row.id)"
            >
              <template #reference>
                <el-button size="small" type="danger">删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog
      :title="isEdit ? '编辑课程' : '新增课程'"
      v-model="dialogVisible"
      width="550px"
    >
      <el-form :model="form" ref="formRef" :rules="rules" label-width="100px">
        <el-form-item label="课程标题" prop="title">
          <el-input v-model="form.title" placeholder="主要吸睛主标题" />
        </el-form-item>
        <el-form-item label="封面大图" prop="cover_url">
          <ImageUploader v-model="form.cover_url" bucket="images" />
        </el-form-item>
        <el-form-item label="课程正文介绍" prop="description">
          <el-input
            type="textarea"
            :rows="4"
            v-model="form.description"
            placeholder="此内容会在小程序内部的内部详情页完整展示。"
          />
        </el-form-item>
        <el-form-item label="外部引导链接" prop="external_link">
          <el-input
            v-model="form.external_link"
            placeholder="例如微店链接、推文链接"
          />
        </el-form-item>
        <el-form-item label="展示排序" prop="sort_order">
          <el-input-number v-model="form.sort_order" />
        </el-form-item>
        <el-form-item label="是否上架">
          <el-switch v-model="form.is_published" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="handleSave">保存</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { ElMessage } from "element-plus";
import { supabase } from "../../utils/supabase";
import ImageUploader from "../../components/ImageUploader.vue";

const loading = ref(false);
const tableData = ref<any[]>([]);

const dialogVisible = ref(false);
const isEdit = ref(false);
const currentId = ref("");

const formRef = ref();
const form = ref({
  title: "",
  cover_url: "",
  description: "",
  external_link: "",
  sort_order: 0,
  is_published: true,
});

const rules = {
  title: [{ required: true, message: "请填写课程名", trigger: "blur" }],
};

const fetchData = async () => {
  loading.value = true;
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    ElMessage.error("拉取失败: " + error.message);
  } else {
    tableData.value = data || [];
  }
  loading.value = false;
};

const openDialog = (row?: any) => {
  if (row) {
    isEdit.value = true;
    currentId.value = row.id;
    form.value = { ...row };
  } else {
    isEdit.value = false;
    currentId.value = "";
    form.value = {
      title: "",
      cover_url: "",
      description: "",
      external_link: "",
      sort_order: 0,
      is_published: true,
    };
  }
  dialogVisible.value = true;
};

const handleSave = async () => {
  formRef.value.validate(async (valid: boolean) => {
    if (valid) {
      loading.value = true;
      let operationError = null;

      if (isEdit.value) {
        const { error } = await supabase
          .from("courses")
          .update(form.value)
          .eq("id", currentId.value);
        operationError = error;
      } else {
        const { error } = await supabase.from("courses").insert([form.value]);
        operationError = error;
      }

      loading.value = false;
      if (operationError) {
        ElMessage.error("保存失败: " + operationError.message);
      } else {
        ElMessage.success("保存成功");
        dialogVisible.value = false;
        fetchData();
      }
    }
  });
};

const handleDelete = async (id: string) => {
  loading.value = true;
  const { error } = await supabase.from("courses").delete().eq("id", id);
  loading.value = false;

  if (error) {
    ElMessage.error("删除失败: " + error.message);
  } else {
    ElMessage.success("删除成功");
    fetchData();
  }
};

onMounted(() => {
  fetchData();
});
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
