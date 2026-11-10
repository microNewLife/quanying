const { getPerson } = require('../../utils/people');

Page({
  data: {
    id: '',
    teacher: null,
    loading: true,
    loadError: '',
    shareCardPath: '',
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ id: options.id });
      this.fetchTeacherDetail(options.id);
    } else {
      wx.showToast({
        title: '参数错误',
        icon: 'error'
      });
      setTimeout(() => wx.navigateBack(), 1500);
    }
  },

  async fetchTeacherDetail(id) {
    this.setData({ loading: true, loadError: '', teacher: null });
    try {
      const data = await getPerson(id);

      this.setData({ teacher: data });
      wx.setNavigationBarTitle({
        title: `${data.certificate_name} 老师`
      });

    } catch (err) {
      this.setData({loadError:'档案暂时不可用，可能尚未发布或网络连接失败。'});
      console.error('获取讲师详情失败:', err);
      wx.showToast({
        title: '加载详情失败',
        icon: 'error'
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  retryLoad() { this.fetchTeacherDetail(this.data.id); },
  // 生成分享卡片
  generateShareCard() {
    const { teacher } = this.data;
    if (!teacher) return;

    wx.showLoading({ title: '正在生成...', mask: true });

    this._generateShareCardAsync(teacher).then(() => {
      // success - hideLoading handled in _exportCanvas
    }).catch((err) => {
      console.error('生成分享卡片失败:', err);
      wx.hideLoading();
      wx.showToast({ title: '生成失败，请重试', icon: 'none' });
    });
  },

  // 获取图片信息
  _getImageInfoPromise(bPath) {
    return new Promise((resolve) => {
      if (!bPath) {
        resolve(null);
        return;
      }
      wx.getImageInfo({
        src: bPath,
        success: resolve,
        fail: (err) => {
          console.error('获取图片信息失败:', err);
          resolve(null);
        }
      });
    });
  },

  // 绘制 Cover 背景图（自动裁剪，规避浮点数 bug）
  _drawCoverImage(ctx, path, info, x, y, w, h) {
    if (!info || !info.width || !info.height) {
      ctx.drawImage(path, x, y, w, h);
      return;
    }
    const imgW = info.width;
    const imgH = info.height;
    const targetRatio = w / h;
    const imgRatio = imgW / imgH;
    let sWidth = imgW;
    let sHeight = imgH;
    let sx = 0, sy = 0;

    if (imgRatio > targetRatio) {
      sWidth = imgH * targetRatio;
      sx = (imgW - sWidth) / 2;
    } else {
      sHeight = imgW / targetRatio;
      sy = (imgH - sHeight) / 2;
    }

    // Canvas 老旧 API 可能在部分安卓机不支持带小数的剪裁参数
    sx = Math.floor(sx);
    sy = Math.floor(sy);
    sWidth = Math.floor(sWidth);
    sHeight = Math.floor(sHeight);

    ctx.drawImage(path, sx, sy, sWidth, sHeight, x, y, w, h);
  },

  // 异步生成分享卡片（返回 Promise）
  async _generateShareCardAsync(teacher) {
    const photoUrl = teacher.photo_url || 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?q=80&w=600';
    let avatarInfo = await this._getImageInfoPromise(photoUrl);

    // 兜底下载（以防getImageInfo失败）
    if (!avatarInfo || !avatarInfo.path) {
      try {
        const downRes = await wx.downloadFile({ url: photoUrl });
        if (downRes.statusCode === 200) {
          avatarInfo = { path: downRes.tempFilePath };
        }
      } catch (e) {
        console.error('头像全部下载方式均失败:', e);
      }
    }

    let qrInfo = null;
    if (teacher.qrcode_url) {
      qrInfo = await this._getImageInfoPromise(teacher.qrcode_url);
      if (!qrInfo || !qrInfo.path) {
        try {
          const qrRes = await wx.downloadFile({ url: teacher.qrcode_url });
          if (qrRes.statusCode === 200) {
            qrInfo = { path: qrRes.tempFilePath };
          }
        } catch (e) {
          console.error('二维码兜底下载失败:', e);
        }
      }
    } else {
      // 未提供联系方式时不生成测试二维码。
      qrInfo = null;
    }

    const dpr = wx.getSystemInfoSync().pixelRatio;
    const canvasWidth = 750;
    const canvasHeight = 1200;

    const ctx = wx.createCanvasContext('shareCanvas', this);

    // === 绘制背景 ===
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // === 顶部大图 ===
    if (avatarInfo && avatarInfo.path) {
      try {
        this._drawCoverImage(ctx, avatarInfo.path, avatarInfo, 0, 0, canvasWidth, 800);
      } catch (e) {
        const fallbackGrad = ctx.createLinearGradient(0, 0, 0, 800);
        fallbackGrad.addColorStop(0, '#ff9a44');
        fallbackGrad.addColorStop(1, '#fc6076');
        ctx.fillStyle = fallbackGrad;
        ctx.fillRect(0, 0, canvasWidth, 800);
      }
    } else {
      // 网络限制拉取不到图片时的优雅兜底渐变
      const fallbackGrad = ctx.createLinearGradient(0, 0, 0, 800);
      fallbackGrad.addColorStop(0, '#ffd8b1');
      fallbackGrad.addColorStop(1, '#ff9a44');
      ctx.fillStyle = fallbackGrad;
      ctx.fillRect(0, 0, canvasWidth, 800);
    }
    // === 渐变遮罩融合 ===
    const grad = ctx.createLinearGradient(0, 500, 0, 800);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(1, '#ffffff');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 500, canvasWidth, 300);

    // === 讲师名称 ===
    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'bold 56px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(teacher.certificate_name || '讲师', 50, 840);

    // === 认证资质 ===
    ctx.fillStyle = '#F28F3B';
    ctx.font = '32px sans-serif';
    const qualifications = teacher.qualifications || [teacher.qualification || '体系认证'];
    const qualificationLine = qualifications.length > 2 ? `${qualifications.slice(0,2).join('、')} 等 ${qualifications.length} 项认证` : qualifications.join('、');
    ctx.fillText(qualificationLine, 50, 900, 650);

    // === 分割线 ===
    ctx.beginPath();
    ctx.moveTo(50, 950);
    ctx.lineTo(700, 950);
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 2;
    ctx.stroke();

    // === 底部左侧：品牌与宣传语 ===
    ctx.fillStyle = '#333333';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText('犬影村 · 专业化犬类行为咨询服务', 50, 1020);

    ctx.fillStyle = '#888888';
    ctx.font = '26px sans-serif';
    ctx.fillText('长按识别二维码，立即预约', 50, 1070);

    ctx.fillStyle = '#bbbbbb';
    ctx.font = '24px sans-serif';
    ctx.fillText('为您和爱犬量身定制专属方案', 50, 1120);

    // === 底部右侧：二维码 ===
    const qrSize = 180;
    const qrX = 520;
    const qrY = 980;

    this._roundRect(ctx, qrX - 10, qrY - 10, qrSize + 20, qrSize + 20, 16, '#ffffff', '#eeeeee');

    if (qrInfo && qrInfo.path) {
      try {
        await this._drawImagePromise(ctx, qrInfo.path, qrX, qrY, qrSize, qrSize);
      } catch (e) {
        this._drawQrPlaceholder(ctx, qrX, qrY, qrSize);
      }
    } else {
      this._drawQrPlaceholder(ctx, qrX, qrY, qrSize);
    }

    ctx.draw(false, () => {
      setTimeout(() => {
        this._exportCanvasPromise('shareCanvas', dpr, canvasWidth, canvasHeight);
      }, 500);
    });
  },

  // Promise 版本的图片绘制（旧版 API ctx.drawImage 直接接受本地路径）
  _drawImagePromise(ctx, path, x, y, w, h) {
    return new Promise((resolve, reject) => {
      try {
        ctx.drawImage(path, x, y, w, h);
        resolve();
      } catch (e) {
        reject(e);
      }
    });
  },

  // Canvas 导出为图片
  _exportCanvasPromise(canvasId, dpr, w, h) {
    wx.canvasToTempFilePath({
      canvasId: canvasId,
      x: 0,
      y: 0,
      width: w,
      height: h,
      destWidth: w * dpr,
      destHeight: h * dpr,
      fileType: 'png',
      quality: 0.9,
      success: (res) => {
        wx.hideLoading();
        this.setData({ shareCardPath: res.tempFilePath });
      },
      fail: (err) => {
        console.error('导出失败:', err);
        wx.hideLoading();
        wx.showToast({ title: '生成失败，请重试', icon: 'none' });
      }
    });
  },

  // 导出 Canvas 为图片
  _exportCanvas(dpr, w, h) {
    wx.canvasToTempFilePath({
      canvasId: 'shareCanvas',
      x: 0,
      y: 0,
      width: w,
      height: h,
      destWidth: w * dpr,
      destHeight: h * dpr,
      fileType: 'png',
      quality: 0.9,
      success: (res) => {
        wx.hideLoading();
        this.setData({ shareCardPath: res.tempFilePath });
      },
      fail: (err) => {
        console.error('导出失败:', err);
        wx.hideLoading();
        wx.showToast({ title: '生成失败，请重试', icon: 'none' });
      }
    });
  },

  // 圆角矩形（统一用 arc 方式，兼容所有小程序环境）
  _roundRect(ctx, x, y, w, h, r, fillColor, strokeColor) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
    if (fillColor) { ctx.fillStyle = fillColor; ctx.fill(); }
    if (strokeColor) { ctx.strokeStyle = strokeColor; ctx.stroke(); }
  },

  // 顶部圆角矩形（底部直角，统一用 arc 方式）
  _roundRectTop(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
    ctx.fill();
  },

  // 画圆形头像
  _drawCircleImage(ctx, path, x, y, size) {
    return new Promise((resolve, reject) => {
      try {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(path, x, y, size, size);
        ctx.restore();
        resolve();
      } catch (e) {
        reject(e);
      }
    });
  },

  // 二维码兜底方块
  _drawQrPlaceholder(ctx, x, y, size) {
    ctx.fillStyle = '#f5f5f5';
    ctx.strokeStyle = '#d0d0d0';
    ctx.lineWidth = 2;
    this._roundRect(ctx, x, y, size, size, 12, '#f5f5f5', '#d0d0d0');
  },

  // 换行文字
  _wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const chars = text.split('');
    let line = '';
    let posY = y;
    const canvasWidth = 690;
    for (let i = 0; i < chars.length; i++) {
      const testLine = line + chars[i];
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && i > 0) {
        ctx.fillText(line, x, posY);
        line = chars[i];
        posY += lineHeight;
      } else {
        line = testLine;
      }
    }
    if (line) ctx.fillText(line, x, posY);
  },

  // 关闭预览
  closeSharePreview() {
    this.setData({ shareCardPath: '' });
  },

  // 阻止事件冒泡
  preventBubble() {},

  // 保存到相册
  saveShareCard() {
    const { shareCardPath } = this.data;
    if (!shareCardPath) return;
    wx.saveImageToPhotosAlbum({
      filePath: shareCardPath,
      success: () => wx.showToast({ title: '已保存到相册', icon: 'success' }),
      fail: (err) => {
        if (err.errMsg && err.errMsg.includes('auth deny')) {
          wx.showToast({ title: '请允许保存到相册权限', icon: 'none' });
        } else {
          wx.showToast({ title: '保存失败，请重试', icon: 'none' });
        }
      }
    });
  },

  // 二维码图片加载失败时忽略（保持占位背景）
  onQrError(e) {
    // 占位图，不做处理
  },

  /** 分享到朋友圈和好友 */
  onShareAppMessage() {
    const { teacher } = this.data;
    if (!teacher) return {};
    return {
      title: `${teacher.certificate_name} - 犬影 ${teacher.qualification}`,
      path: `/pages/teacher_detail/teacher_detail?id=${teacher.id}`
    };
  }
});
