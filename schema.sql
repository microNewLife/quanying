-- 犬影村 Supabase 数据表初始化脚本
-- 请将此脚本内容复制到 Supabase 的 SQL Editor 中执行。

-- 1. 创建机构信息表 (organization_info)
CREATE TABLE organization_info (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text DEFAULT '犬影村',
  description text,
  address text,
  contact_phone text,
  logo_url text,
  media_urls jsonb DEFAULT '[]'::jsonb,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- 插入一条预设数据供后续展示
INSERT INTO organization_info (name, description, contact_phone, address)
VALUES ('犬影村', '专注于犬类行为1v1咨询、人宠相处课程讲解及公益支持。', '400-xxx-xxxx', 'xxx市xxx区xxx街道');

-- 2. 创建认证讲师表 (teachers -> 对应 Excel 柔丝辅导师及好家长认证名单)
CREATE TABLE teachers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  certificate_name text NOT NULL,        -- 证书姓名
  qualification text,                    -- 认证资格
  certificate_no text UNIQUE NOT NULL,   -- 证书编号 (唯一凭证)
  certified_at text,                     -- 认证时间 (源文件部分为各种格式文本)
  photo_url text DEFAULT '',             -- 讲师照片
  tags jsonb DEFAULT '[]'::jsonb,        -- 讲师标签 (数组格式)
  description text DEFAULT '',           -- 讲师说明文字
  qrcode_url text DEFAULT '',            -- 个人微信二维码内容
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- 3. 创建课程目录表 (courses)
CREATE TABLE courses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  cover_url text,
  description text,
  external_link text,
  is_published boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- 4. 创建用户档案表 (users_profile)
CREATE TABLE users_profile (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  phone text UNIQUE NOT NULL,
  display_name text,
  avatar_url text,
  member_level text DEFAULT '普通会员',
  contact_info jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- 5. 创建用户课程进度表 (user_course_progress)
CREATE TABLE user_course_progress (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES users_profile(id) ON DELETE CASCADE,
  course_id uuid REFERENCES courses(id) ON DELETE CASCADE,
  progress_text text,
  remarks text,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- 6. [可选] 创建简单的 RLS (Row Level Security) 策略
-- 鉴权系统在 MVP 默认放开基本读取（因为主要作展示用）。
-- 客户端禁止使用 service_role。部署时必须继续执行 supabase/migrations 中的迁移以启用管理员白名单。

-- 默认开启 RLS
ALTER TABLE organization_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE users_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_course_progress ENABLE ROW LEVEL SECURITY;

-- 收紧数据权限：匹配最新的方案 A（认证系统对接）
-- DROP 旧策略（为了方便反复执行，可以先忽略）
-- 允许所有人读取前端展示所需的数据（C端访问）
CREATE POLICY "Public Read on organization_info" ON organization_info FOR SELECT USING (true);
CREATE POLICY "Public Read on teachers" ON teachers FOR SELECT USING (is_active);
CREATE POLICY "Public Read on courses" ON courses FOR SELECT USING (is_published);

-- 初始化阶段禁止写入。后续迁移建立真正的管理员白名单。
CREATE POLICY "Auth All on organization_info" ON organization_info FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Auth All on teachers" ON teachers FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Auth All on courses" ON courses FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Auth All on users_profile" ON users_profile FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Auth All on user_course_progress" ON user_course_progress FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- 7. [存储桶安全策略] Storage RLS (针对 images 桶)
-- 请确保在 Supabase Storage 中已创建名为 'images' 的公开存储桶 (Public bucket)
-- 允许所有人读取 images 桶中的文件
CREATE POLICY "Public Read" ON storage.objects FOR SELECT USING (bucket_id = 'images');
-- 仅允许拥有认证登录身份的账户(Admin)向 images 桶插入或更新文件
CREATE POLICY "Auth Insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "Auth Update" ON storage.objects FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
-- 可选：仅管理员可以删除文件
CREATE POLICY "Auth Delete" ON storage.objects FOR DELETE TO authenticated USING (false);
