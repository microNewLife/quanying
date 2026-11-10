<template>
  <el-config-provider>
    <WindowBar />
    <router-view />
    <ConnectionStatus />
  </el-config-provider>
</template>

<script setup lang="ts">
import ConnectionStatus from './components/ConnectionStatus.vue';
import WindowBar from './components/WindowBar.vue';
</script>

<style>
/* 全局重置基础样式 */
html,
body,
#app {
  height: 100%;
  margin: 0;
  padding: 0;
}
</style>
