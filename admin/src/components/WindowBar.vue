<template>
  <header class="window-bar" :class="{'on-mac':onMac}" aria-label="窗口标题栏">
    <div class="window-brand"><span class="brand-mark" aria-hidden="true">Q</span><span>犬影村<span class="window-divider">/</span><span class="window-subtitle">管理工作台</span></span></div>
    <span class="window-edition">QUANYING · WORKSPACE</span>
  </header>
</template>
<script setup lang="ts">
const onMac = /Mac/i.test(navigator.platform) && /Electron/i.test(navigator.userAgent);
</script>
<style scoped>
.window-bar{height:52px;flex:0 0 52px;box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;padding:0 156px 0 22px;background:#f7f8f5;border-bottom:1px solid #e5e8e2;-webkit-app-region:drag;app-region:drag;user-select:none}
.window-bar.on-mac{padding-left:100px;padding-right:24px}.window-brand{display:flex;align-items:center;gap:10px;font-size:12px;font-weight:650;letter-spacing:.05em}.window-brand .brand-mark{width:25px;height:25px;font-size:18px;border-radius:8px}.window-divider{padding:0 12px;color:#bdc5bf;font-weight:400}.window-subtitle{color:#6e7c73;font-weight:400}.window-edition{font-size:9px;letter-spacing:.18em;color:#8b958d}@media(max-width:1050px){.window-edition{display:none}}
</style>
