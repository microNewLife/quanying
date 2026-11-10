// pages/webview/webview.js
Page({
  data: {
    webviewUrl: ''
  },

  onLoad(options) {
    if (options.url) {
      const url = decodeURIComponent(options.url);
      this.setData({ webviewUrl: url });
      wx.setNavigationBarTitle({ title: '正在打开...' });
    } else {
      wx.showToast({ title: '链接无效', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
    }
  }
});
