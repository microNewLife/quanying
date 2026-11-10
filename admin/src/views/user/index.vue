<template>
  <div class="user-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>用户资源库与学习进度管理</span>
          <el-button type="primary" @click="openUserDialog()"
            >+ 手工添加用户</el-button
          >
        </div>
      </template>

      <el-table :data="usersList" v-loading="loading" style="width: 100%">
        <el-table-column
          prop="phone"
          label="手机号"
          width="120"
        ></el-table-column>
        <el-table-column
          prop="display_name"
          label="用户姓名/昵称"
          width="150"
        ></el-table-column>
        <el-table-column prop="member_level" label="会员等级" width="120">
          <template #default="scope">
            <el-tag>{{ scope.row.member_level }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="scope">
            <el-button size="small" @click="openUserDialog(scope.row)"
              >编辑</el-button
            >
            <el-button
              size="small"
              type="success"
              @click="openProgressDialog(scope.row)"
              >课程进度卡</el-button
            >
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 用户基本资料编辑 -->
    <el-dialog
      :title="isEditUser ? '编辑用户资料' : '手工建档'"
      v-model="userDialogVisible"
      width="500px"
    >
      <el-form
        :model="userForm"
        ref="userFormRef"
        :rules="userRules"
        label-width="100px"
      >
        <el-form-item label="手机号" prop="phone">
          <el-input
            v-model="userForm.phone"
            :disabled="isEditUser"
            placeholder="建档必须绑定手机号"
          />
        </el-form-item>
        <el-form-item label="姓名/昵称" prop="display_name">
          <el-input v-model="userForm.display_name" />
        </el-form-item>
        <el-form-item label="会员等级" prop="member_level">
          <el-select v-model="userForm.member_level" placeholder="请选择">
            <el-option label="普通会员" value="普通会员" />
            <el-option label="高级学员" value="高级学员" />
            <el-option label="尊享 VIP" value="尊享 VIP" />
          </el-select>
        </el-form-item>
        <el-form-item label="头像地址">
          <el-input v-model="userForm.avatar_url" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="userDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="saveUser">保存</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 用户的专属进度面板 -->
    <el-dialog
      :title="`课程进度打卡 - ${currentUser?.display_name || currentUser?.phone}`"
      v-model="progressDialogVisible"
      width="700px"
    >
      <div style="margin-bottom: 10px">
        <el-button
          type="primary"
          plain
          @click="openAddProgressItem"
          size="small"
          >+ 添加新课程追踪</el-button
        >
      </div>

      <el-table :data="progressList" v-loading="progressLoading">
        <el-table-column label="关联课程" width="150">
          <template #default="scope">
            {{ getCourseName(scope.row.course_id) }}
          </template>
        </el-table-column>
        <el-table-column
          prop="progress_text"
          label="展示给用户的进度"
        ></el-table-column>
        <el-table-column
          prop="remarks"
          label="后台备注"
          show-overflow-tooltip
        ></el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="scope">
            <el-button
              size="small"
              type="text"
              @click="editProgressItem(scope.row)"
              >编辑</el-button
            >
            <el-popconfirm
              title="确定删除？"
              @confirm="deleteProgress(scope.row.id)"
            >
              <template #reference>
                <el-button size="small" type="text" style="color: #f56c6c"
                  >删除</el-button
                >
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>

      <!-- 单条进度编辑框 (内嵌/套娃方式简写) -->
      <el-form
        v-if="editingProgress"
        :model="progressForm"
        label-width="120px"
        style="margin-top: 20px; border-top: 1px solid #ccc; padding-top: 20px"
      >
        <el-form-item label="指定课程">
          <el-select v-model="progressForm.course_id" style="width: 100%">
            <el-option
              v-for="c in courseList"
              :key="c.id"
              :label="c.title"
              :value="c.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="展示前台的进度">
          <el-input
            v-model="progressForm.progress_text"
            placeholder="例如: 已学完第一章，正在复盘打卡..."
          />
        </el-form-item>
        <el-form-item label="内部备注">
          <el-input
            type="textarea"
            v-model="progressForm.remarks"
            placeholder="内部管理留底用，客户端不可见"
          />
        </el-form-item>
        <el-form-item>
          <el-button @click="editingProgress = false">取消修改</el-button>
          <el-button type="success" @click="saveProgress"
            >提交该条进度</el-button
          >
        </el-form-item>
      </el-form>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { ElMessage } from "element-plus";
import { supabase } from "../../utils/supabase";

// 1. 基本的用户 CRUD
const loading = ref(false);
const usersList = ref<any[]>([]);
const userDialogVisible = ref(false);
const isEditUser = ref(false);
const currentUser = ref<any>(null);

const userFormRef = ref();
const userForm = ref({
  id: "",
  phone: "",
  display_name: "",
  avatar_url: "",
  member_level: "普通会员",
});
const userRules = {
  phone: [{ required: true, message: "必须输入手机号", trigger: "blur" }],
};

const fetchUsers = async () => {
  loading.value = true;
  const { data, error } = await supabase
    .from("users_profile")
    .select("*")
    .order("created_at", { ascending: false });
  loading.value = false;
  if (error) {
    ElMessage.error(error.message);
  } else {
    usersList.value = data || [];
  }
};

const openUserDialog = (row?: any) => {
  if (row) {
    isEditUser.value = true;
    userForm.value = { ...row };
  } else {
    isEditUser.value = false;
    userForm.value = {
      id: "",
      phone: "",
      display_name: "新用户",
      avatar_url: "",
      member_level: "普通会员",
    };
  }
  userDialogVisible.value = true;
};

const saveUser = async () => {
  userFormRef.value.validate(async (valid: boolean) => {
    if (valid) {
      loading.value = true;
      let err;

      const payload: any = {
        display_name: userForm.value.display_name,
        avatar_url: userForm.value.avatar_url,
        member_level: userForm.value.member_level,
      };

      if (isEditUser.value) {
        const { error } = await supabase
          .from("users_profile")
          .update(payload)
          .eq("id", userForm.value.id);
        err = error;
      } else {
        payload.phone = userForm.value.phone; // 新增时写入
        const { error } = await supabase
          .from("users_profile")
          .insert([payload]);
        err = error;
      }

      loading.value = false;
      if (err) {
        ElMessage.error(err.message);
      } else {
        ElMessage.success("保存成功");
        userDialogVisible.value = false;
        fetchUsers();
      }
    }
  });
};

// 2. 进度管理相关
const progressDialogVisible = ref(false);
const courseList = ref<any[]>([]);
const progressList = ref<any[]>([]);
const progressLoading = ref(false);
const editingProgress = ref(false);

const progressForm = ref({
  id: "",
  course_id: "",
  progress_text: "",
  remarks: "",
});

// 拉取公用的课程名册
const fetchCoursesInfo = async () => {
  const { data } = await supabase.from("courses").select("id, title");
  if (data) courseList.value = data;
};

const getCourseName = (course_id: string) => {
  const f = courseList.value.find((c) => c.id === course_id);
  return f ? f.title : "未知课程";
};

const openProgressDialog = async (row: any) => {
  currentUser.value = row;
  progressDialogVisible.value = true;
  editingProgress.value = false;
  if (courseList.value.length === 0) {
    await fetchCoursesInfo();
  }
  fetchProgressList();
};

const fetchProgressList = async () => {
  if (!currentUser.value) return;
  progressLoading.value = true;
  const { data, error } = await supabase
    .from("user_course_progress")
    .select("*")
    .eq("user_id", currentUser.value.id);

  progressLoading.value = false;
  if (error) {
    ElMessage.error("拉取进度失败: " + error.message);
  } else {
    progressList.value = data || [];
  }
};

const openAddProgressItem = () => {
  editingProgress.value = true;
  progressForm.value = {
    id: "",
    course_id: "",
    progress_text: "",
    remarks: "",
  };
};

const editProgressItem = (row: any) => {
  editingProgress.value = true;
  progressForm.value = { ...row };
};

const saveProgress = async () => {
  if (!progressForm.value.course_id || !progressForm.value.progress_text) {
    ElMessage.warning("需选择课程并填写前台进度展示文本");
    return;
  }

  progressLoading.value = true;
  let err;

  const payload = {
    user_id: currentUser.value.id,
    course_id: progressForm.value.course_id,
    progress_text: progressForm.value.progress_text,
    remarks: progressForm.value.remarks,
  };

  if (progressForm.value.id) {
    // 编辑
    const { error } = await supabase
      .from("user_course_progress")
      .update(payload)
      .eq("id", progressForm.value.id);
    err = error;
  } else {
    // 新增
    const { error } = await supabase
      .from("user_course_progress")
      .insert([payload]);
    err = error;
  }

  progressLoading.value = false;
  if (err) {
    ElMessage.error(err.message);
  } else {
    ElMessage.success("更新进度成功");
    editingProgress.value = false;
    fetchProgressList();
  }
};

const deleteProgress = async (id: string) => {
  progressLoading.value = true;
  const { error } = await supabase
    .from("user_course_progress")
    .delete()
    .eq("id", id);
  progressLoading.value = false;
  if (error) {
    ElMessage.error(error.message);
  } else {
    ElMessage.success("删除成功");
    fetchProgressList();
  }
};

onMounted(() => {
  fetchUsers();
});
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
