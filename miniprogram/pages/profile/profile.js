// pages/profile/profile.js
const { supabase } = require('../../utils/supabase');

Page({
  data: {
    isLogin: false,
    userInfo: null,
    progressList: [],
    loading: false
  },

  onShow() {
    this.checkLoginStatus();
  },

  onPullDownRefresh() {
    this.checkLoginStatus().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  async checkLoginStatus() {
    // 简化 MVP：基于本地 storage 中是否有手机号/用户ID判定
    const localUser = wx.getStorageSync('quanying_user');
    if (localUser && localUser.phone) {
      this.setData({
        isLogin: true,
        userInfo: localUser
      });
      // 登录后抓取进度
      await this.fetchProgress(localUser.id);
    } else {
      this.setData({
        isLogin: false,
        userInfo: null,
        progressList: []
      });
    }
  },

  async onGetPhoneNumber(e) {
    // 这里是微信官方获取手机号的回调 e.detail.code
    // 在真实生产环境，需要将 code 发往你的后端换取真实手机号
    // 在此演示 MVP 版本中，我们弹窗模拟用户输入一个固定测试手机号关联
    console.log('获取手机号 code:', e.detail.code);

    if (e.detail.errMsg !== "getPhoneNumber:ok") {
      wx.showToast({ title: '已取消授权', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '登录中...' });

    try {
      // ===== 开发阶段 Mock 逻辑 (跳过后端解密，直接假设获取到一个固定手机号) =====
      const mockPhone = '13800138000'; // 可在后台配置进 users_profile

      // 去 Supabase 查一下这个手机号绑定的档案
      let { data: userProfile, error } = await supabase
        .from('users_profile')
        .select('*')
        .eq('phone', mockPhone)
        .single();

      // 如果这个新用户没在系统里被创建，自动帮他建一个初始档案
      if (!userProfile) {
        const { data: newUser, error: insertError } = await supabase
          .from('users_profile')
          .insert([{ phone: mockPhone, member_level: '首遇萌新' }])
          .select()
          .single();

        if (insertError) throw insertError;
        userProfile = newUser;
      }

      // 保存登录态
      wx.setStorageSync('quanying_user', userProfile);

      this.setData({
        isLogin: true,
        userInfo: userProfile
      });

      await this.fetchProgress(userProfile.id);

      wx.showToast({ title: '登录成功', icon: 'success' });
    } catch (err) {
      console.error('登录流程异常:', err);
      wx.showToast({ title: '登录失败，请重试', icon: 'error' });
    } finally {
      wx.hideLoading();
    }
  },

  async fetchProgress(userId) {
    if (!userId) return;

    try {
      // 联合查询 user_course_progress 和 courses 的 title
      const { data, error } = await supabase
        .from('user_course_progress')
        .select(`
          id,
          progress_text,
          remarks,
          updated_at,
          courses ( title )
        `)
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // 格式化时间显示
      const formattedData = (data || []).map(item => ({
        ...item,
        updated_at: item.updated_at ? item.updated_at.split('T')[0] : '未知时间'
      }));

      this.setData({ progressList: formattedData });
    } catch (err) {
      console.error('获取进度失败:', err);
    }
  }
})
