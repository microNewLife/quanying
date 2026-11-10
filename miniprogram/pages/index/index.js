// pages/index/index.js
const { supabase } = require('../../utils/supabase');

Page({
  data: {
    orgInfo: {},
    courses: [],
    loading: true
  },

  onLoad(options) {
    this.fetchData();
  },

  onPullDownRefresh() {
    this.fetchData().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  async fetchData() {
    this.setData({ loading: true, courses: [] });
    wx.showNavigationBarLoading();

    try {
      // 1. 获取机构基本信息
      const { data: orgData, error: orgError } = await supabase
        .from('organization_info')
        .select('*')
        .limit(1)
        .single();

      if (orgError && orgError.code !== 'PGRST116') {
        throw orgError; // 除非是 0 returns 报 116 错误
      }

      // 2. 获取发布的课程列表，按排序权重
      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .select('*')
        .eq('is_published', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (courseError) throw courseError;

      this.setData({
        orgInfo: orgData || {},
        courses: courseData || []
      });

      // 更新导航栏标题为机构名（如果存在）
      if (orgData && orgData.name) {
        wx.setNavigationBarTitle({ title: orgData.name });
      }

    } catch (err) {
      console.error('获取首页数据失败:', err);
      wx.showToast({ title: '加载失败', icon: 'error' });
    } finally {
      this.setData({ loading: false });
      wx.hideNavigationBarLoading();
    }
  },

  // 跳转咨询师认证（复制链接到剪贴板）
  goAuth() {
    wx.setClipboardData({
      data: 'https://mp.weixin.qq.com/s/VYt7il0uT7c2xvt0JnXt9Q',
      success: () => wx.showToast({ title: '链接已复制，请在微信中打开', icon: 'none', duration: 2500 })
    });
  },

  // 跳转微店（直接用第一个课程的 external_link，跳转微店）
  goShop() {
    const course = this.data.courses[0];
    if (!course || !course.external_link) {
      wx.showToast({ title: '暂无可用购买链接', icon: 'none' });
      return;
    }

    const link = course.external_link.trim();

    // 小程序短链接 → 直接跳转其他小程序
    if (link.startsWith('#小程序://')) {
      wx.navigateToMiniProgram({
        shortLink: link,
        fail: () => wx.showToast({ title: '跳转失败，请稍后重试', icon: 'none' })
      });
    } else {
      // 普通链接 → 通过 webview 打开（需在微信公众平台配置业务域名）
      wx.navigateTo({
        url: `/pages/webview/webview?url=${encodeURIComponent(link)}`
      });
    }
  },

  // 点击课程跳详情
  goToDetails(e) {
    const id = e.currentTarget.dataset.id;
    if (id) {
      wx.navigateTo({
        url: `/pages/course_detail/course_detail?id=${id}`
      });
    }
  }
})
