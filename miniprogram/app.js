// app.js
App({
  onLaunch() {
    console.log('犬影村小程序启动');

    // 我们可以在此做一些全局的初始状态管理，例如将用户信息挂载在 globalData
    const systemInfo = wx.getSystemInfoSync();
    this.globalData.systemInfo = systemInfo;
  },

  globalData: {
    userInfo: null,
    systemInfo: null,
    // 保存用户的 Supabase Session (如适用)
    session: null
  }
})
