// pages/teacher/teacher.js
const { listPeople } = require('../../utils/people');

Page({
  data: {
    teachers: [],         // 全量数据
    filteredTeachers: [], // 过滤后展示的数据
    loading: true,
    loadError: '',
    searchName: '',       // 姓名搜索词
    qualificationTags: [], // 所有可用的资格标签
    selectedTag: '',      // 当前选中的标签（空字符串=全部）
  },

  onLoad(options) {
    this.fetchTeachers();
  },

  onPullDownRefresh() {
    this.fetchTeachers().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  async fetchTeachers() {
    this.setData({ loading: true, loadError: '' });
    wx.showNavigationBarLoading();

    try {
      const teachers = await listPeople();

      // 提取所有不重复的 qualification 标签
      const tagSet = new Set();
      teachers.forEach(t => {
        t.qualifications.forEach(q => tagSet.add(q));
      });
      const qualificationTags = Array.from(tagSet);

      this.setData({
        teachers,
        qualificationTags,
        // 重置筛选条件
        searchName: '',
        selectedTag: '',
      });

      this._applyFilter();

    } catch (err) {
      this.setData({loadError:'名单暂时无法加载，请检查网络后重试。',teachers:[],filteredTeachers:[]});
      console.error('获取讲师列表失败:', err);
      wx.showToast({ title: '加载名师失败', icon: 'error' });
    } finally {
      this.setData({ loading: false });
      wx.hideNavigationBarLoading();
    }
  },

  /** 姓名搜索框输入 */
  onSearchInput(e) {
    this.setData({ searchName: e.detail.value });
    this._applyFilter();
  },

  /** 点击资格标签 */
  onTagTap(e) {
    const tag = e.currentTarget.dataset.tag;
    // 再次点击已选中的标签 → 取消选中（全部）
    const newTag = this.data.selectedTag === tag ? '' : tag;
    this.setData({ selectedTag: newTag });
    this._applyFilter();
  },

  /** 应用筛选逻辑（本地过滤） */
  _applyFilter() {
    const { teachers, searchName, selectedTag } = this.data;
    const keyword = searchName.trim().toLowerCase();

    const filtered = teachers.filter(t => {
      const nameMatch = !keyword || `${t.certificate_name} ${t.nickname || ''}`.toLowerCase().includes(keyword);
      const tagMatch = !selectedTag || t.qualifications.includes(selectedTag);
      return nameMatch && tagMatch;
    });

    this.setData({ filteredTeachers: filtered });
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/teacher_detail/teacher_detail?id=${id}`
    });
  }
})
