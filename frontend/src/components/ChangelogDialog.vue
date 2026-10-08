<template>
  <el-dialog
    :model-value="visible"
    :close-on-click-modal="true"
    width="600px"
    top="8vh"
    @update:model-value="emit('update:visible', $event)"
  >
    <template #header>
      <div class="cl-header">
        <span class="cl-title">📋 更新日志</span>
        <span class="cl-sub">当前版本 {{ currentVersion }}</span>
      </div>
    </template>
    <div class="cl-content">
      <el-timeline>
        <el-timeline-item
          v-for="(item, idx) in logs"
          :key="idx"
          :timestamp="item.date"
          :color="idx === 0 ? '#409eff' : '#909399'"
          placement="top"
        >
          <div class="cl-version">{{ item.version }}</div>
          <ul class="cl-features">
            <li v-for="(f, i) in item.features" :key="i">{{ f }}</li>
          </ul>
        </el-timeline-item>
      </el-timeline>
    </div>
    <template #footer>
      <el-button @click="emit('update:visible', false)">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed } from 'vue';
import rawLogs from '../changelog.json';

// 日志按版本降序 (最新在前)
const logs = computed(() => [...rawLogs].sort((a, b) => b.version.localeCompare(a.version)));
const currentVersion = computed(() => logs.value[0]?.version || 'v1.0.0');

defineProps({
  visible: { type: Boolean, default: false },
});
const emit = defineEmits(['update:visible']);
</script>

<style scoped>
.cl-header { display: flex; align-items: baseline; gap: 12px; }
.cl-title { font-size: 16px; font-weight: 600; }
.cl-sub { font-size: 12px; color: #909399; }
.cl-content { max-height: 60vh; overflow-y: auto; padding: 8px 4px; }
.cl-version { font-weight: 600; font-size: 14px; color: #303133; margin-bottom: 4px; }
.cl-features { margin: 0; padding-left: 18px; }
.cl-features li { font-size: 13px; color: #606266; line-height: 1.8; }
.cl-content::-webkit-scrollbar { width: 6px; }
.cl-content::-webkit-scrollbar-thumb { background: #dcdfe6; border-radius: 3px; }
</style>
