import {
  createRouter,
  createWebHashHistory,
  type RouteRecordRaw,
} from "vue-router";
import { supabase, configurationError } from '../utils/supabase';

const routes: Array<RouteRecordRaw> = [
  {
    path: "/login",
    name: "Login",
    component: () => import("../views/login/index.vue"),
    meta: {
      title: "登录",
    },
  },
  {
    path: "/",
    name: "Layout",
    component: () => import("../layout/index.vue"),
    redirect: "/dashboard",
    children: [
      { path: 'import', name: 'Import', component: () => import('../views/import/index.vue'), meta: { title: '名单导入' } },
      {
        path: "dashboard",
        name: "Dashboard",
        component: () => import("../views/dashboard/index.vue"),
        meta: { title: "首页概览", icon: "House" },
      },
      {
        path: "org",
        name: "Organization",
        component: () => import("../views/org/index.vue"),
        meta: { title: "机构信息", icon: "OfficeBuilding" },
      },
      {
        path: "teacher",
        name: "Teacher",
        component: () => import("../views/teacher/index.vue"),
        meta: { title: "讲师管理", icon: "Avatar" },
      },
      {
        path: "course",
        name: "Course",
        component: () => import("../views/course/index.vue"),
        meta: { title: "课程管理", icon: "Reading" },
      },
      {
        path: "user",
        name: "User",
        component: () => import("../views/user/index.vue"),
        meta: { title: "用户与进度", icon: "User" },
      },
    ],
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

// Protected routes verify the real user and administrator allowlist.
router.beforeEach(async (to) => {
  if (to.path === '/login') return true;
  if (configurationError) return {path:'/login',query:{reason:configurationError}};
  try {
    const {data:{user},error} = await supabase.auth.getUser();
    if(error?.name === 'AuthSessionMissingError' || (!error && !user)) return {path:'/login'};
    if(error || !user) return {path:'/login',query:{reason:'请重新登录'}};
    const {data:admin,error:roleError}=await supabase.rpc('is_admin');
    if(roleError || !admin) return {path:'/login',query:{reason:roleError ? '无法验证管理员权限，请检查连接及数据库迁移' : '该账号没有管理员权限'}};
    return true;
  } catch {return {path:'/login',query:{reason:'无法连接，请检查网络后重试'}};}
});
supabase.auth.onAuthStateChange(event => {
  if(event === 'SIGNED_OUT') {
    localStorage.removeItem('supabase_admin_token');
    void router.replace('/login');
  }
});

export default router;
