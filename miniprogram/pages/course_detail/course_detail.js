// pages/course_detail/course_detail.js
const { supabase } = require('../../utils/supabase');

Page({
  /**
   * 页面的初始数据
   */
  data: {
    courseId: '',
    course: null,
    loading: true
  },

  /**
   * 生命周期函数--监听页面加载
   */
  async onLoad(options) {
    if (options.id) {
      this.setData({ courseId: options.id });
      await this.fetchCourseDetail(options.id);
    } else {
      wx.showToast({
        title: '参数错误',
        icon: 'error'
      });
      setTimeout(() => wx.navigateBack(), 1500);
    }
  },

  /**
   * 从 Supabase 获取课程详情
   */
  async fetchCourseDetail(id) {
    this.setData({ loading: true });
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('id', id)
        .eq('is_published', true)
        .single();

      if (error) throw error;

      this.setData({ course: data });

      // 设置动态标题
      if (data.title) {
        wx.setNavigationBarTitle({
          title: data.title
        });
      }
    } catch (err) {
      console.error('获取课程详情失败:', err);
      wx.showToast({
        title: '加载失败',
        icon: 'error'
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 处理行动按钮点击
   */
  handleAction() {
    const { course } = this.data;
    if (!course || !course.external_link) return;

    const link = course.external_link.trim();

    // 重点：处理小程序短链接跳转喵！
    if (link.startsWith('#小程序://')) {
      wx.navigateToMiniProgram({
        shortLink: link,
        success(res) {
          console.log('跳转微店成功:', res);
        },
        fail(err) {
          console.error('跳转跳转失败:', err);
          wx.showModal({
            title: '跳转失败',
            content: '无法直接打开该小程序链接，请检查链接是否正确。',
            showCancel: false
          });
        }
      });
    } else if (link.startsWith('http')) {
      // 如果是个网页链接，小程序无法直接打开非业务域名，提示复制
      wx.setClipboardData({
        data: link,
        success: () => {
          wx.showModal({
            title: '已复制链接',
            content: '小程序暂不支持直接打开外部网页，链接已复制，请前往浏览器打开。',
            showCancel: false
          });
        }
      });
    } else {
      wx.showToast({
        title: '暂未支持此链接类型',
        icon: 'none'
      });
    }
  },

  /**
   * 返回首页
   */
  goHome() {
    wx.reLaunch({
      url: '/pages/index/index'
    });
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {
    return {
      title: this.data.course ? this.data.course.title : '精品课程',
      path: '/pages/course_detail/course_detail?id=' + this.data.courseId
    };
  }
})
