<template>
  <div class="app-container">
    <!-- 顶部栏 -->
    <header class="app-header">
      <h1 class="app-title">
        📊 PeakValleyLog 盯盘工具
        <el-tag size="small" type="info" class="app-version" @click="showChangelog = true">
          {{ currentVersion }}
        </el-tag>
      </h1>
      <div class="app-actions">
        <el-tooltip content="拉取最新净值并直接放入近期均值，所有衍生指标基于新均值重算。会覆盖原录入值，建议先导出备份" placement="bottom">
          <el-button type="warning" :icon="MagicStick" :loading="recomputing" @click="handleRefreshRecompute">一键更新</el-button>
        </el-tooltip>
        <el-tooltip content="手动新增一条标的记录，录入均值/高低点后自动计算衍生指标" placement="bottom">
          <el-button :icon="Plus" @click="openDialog()">新增标的</el-button>
        </el-tooltip>
        <el-tooltip content="将全部标的导出为Excel文件，含参考点位/最大收益/最大回撤/差额收益率等自动计算指标" placement="bottom">
          <el-button :icon="Download" @click="handleExport">导出Excel</el-button>
        </el-tooltip>
        <el-tooltip content="从Excel文件导入标的数据，支持覆盖已有代码或增量新增" placement="bottom">
          <el-button :icon="Upload" @click="triggerImport">导入Excel</el-button>
        </el-tooltip>
        <input ref="importInput" type="file" accept=".xlsx,.xls" style="display:none" @change="handleImport" />
      </div>
    </header>

    <!-- 表格 -->
    <main class="app-main">
      <SymbolTable
        ref="tableRef"
        @edit="openDialog"
        @delete="handleDelete"
      />
    </main>

    <!-- 编辑弹窗 -->
    <EditDialog ref="editDialogRef" @saved="onSaved" />

    <!-- 更新日志 -->
    <ChangelogDialog v-model:visible="showChangelog" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Download, Upload, MagicStick } from '@element-plus/icons-vue';
import SymbolTable from './components/SymbolTable.vue';
import EditDialog from './components/EditDialog.vue';
import ChangelogDialog from './components/ChangelogDialog.vue';
import api from './api';
import * as XLSX from 'xlsx';
import rawLogs from './changelog.json';

const showChangelog = ref(false);
const currentVersion = computed(() => {
  const sorted = [...rawLogs].sort((a, b) => b.version.localeCompare(a.version));
  return sorted[0]?.version || 'v1.0.0';
});

const recomputing = ref(false);
const tableRef = ref(null);
const editDialogRef = ref(null);
const importInput = ref(null);

// 一键更新: 用最新净值覆盖近期均值, 触发衍生指标重算
async function handleRefreshRecompute() {
  try {
    await ElMessageBox.confirm(
      '将拉取最新行情并覆盖"近期均值"字段, 所有衍生指标(理论最大收益/回撤/差额收益率)都会基于最新价重新计算。\n此操作会覆盖您原录入的均值, 建议先导出Excel备份。是否继续?',
      '一键更新确认',
      { confirmButtonText: '确认更新', cancelButtonText: '取消', type: 'warning' },
    );
  } catch (e) {
    return;
  }
  recomputing.value = true;
  try {
    const { data } = await api.refreshRecompute();
    if (data.failed > 0 && data.failed_list?.length) {
      const failedNames = data.failed_list.map((f) => `${f.name}(${f.code})`).join('、');
      if (data.success > 0) {
        ElMessage.success(`一键更新完成: 成功 ${data.success} 条, 失败 ${data.failed} 条`);
      }
      await ElMessageBox.alert(
        `以下 ${data.failed} 条行情接口未覆盖, 已保留原值:\n\n${failedNames}`,
        data.success > 0 ? '部分更新失败' : '一键更新失败',
        { confirmButtonText: '知道了', type: data.success > 0 ? 'warning' : 'error' },
      );
    } else {
      ElMessage.success(`一键更新完成: 成功 ${data.success} 条, 衍生指标已重算`);
    }
    tableRef.value?.loadData();
  } catch (e) {
    if (e === 'cancel' || e === 'close') return; // 取消确认弹框
    ElMessage.error('一键更新失败: ' + (e?.response?.data?.error || e.message));
  } finally {
    recomputing.value = false;
  }
}

// 导出
async function handleExport() {
  try {
    const { data } = await api.exportExcel();
    const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `peakvalley_log_${Date.now()}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    ElMessage.success('导出成功');
  } catch (e) {
    ElMessage.error('导出失败');
  }
}

// 导入
function triggerImport() {
  importInput.value?.click();
}
async function handleImport(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  importInput.value.value = '';
  try {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws);

    const mode = await ElMessageBox.confirm(
      '导入模式: 点"确定"覆盖已存在代码, 点"取消"仅新增不重复项',
      '选择导入模式',
      { confirmButtonText: '覆盖导入', cancelButtonText: '增量新增', type: 'info' },
    ).then(() => 'overwrite').catch(() => 'append');

    const { data } = await api.importExcel(rows, mode);
    const msg = `成功 ${data.success} 条, 跳过 ${data.skipped} 条, 错误 ${data.errors.length} 条`;
    if (data.errors.length) {
      ElMessageBox.alert(
        data.errors.map((e) => `第${e.row}行: ${e.error}`).join('\n'),
        `导入结果: ${msg}`,
        { type: 'warning' },
      );
    } else {
      ElMessage.success('导入完成: ' + msg);
    }
    tableRef.value?.loadData();
  } catch (err) {
    if (err === 'cancel') return;
    ElMessage.error('导入失败: ' + (err?.response?.data?.error || err.message));
  }
}

// 编辑弹窗
function openDialog(row = null) {
  editDialogRef.value?.open(row);
}
function onSaved() {
  tableRef.value?.loadData();
}

// 删除
async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`确定删除 ${row.name}(${row.code}) ?`, '二次确认', { type: 'warning' });
    await api.remove(row.id);
    ElMessage.success('已删除');
    tableRef.value?.loadData();
  } catch (e) {
    if (e === 'cancel') return;
    ElMessage.error('删除失败');
  }
}
</script>

<style scoped>
.app-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
.app-header {
  background: #fff;
  padding: 12px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #ebeef5;
  flex-wrap: wrap;
  gap: 8px;
}
.app-title {
  margin: 0;
  font-size: 18px;
  color: #303133;
  display: flex;
  align-items: center;
  gap: 10px;
}
.app-version {
  cursor: pointer;
  font-weight: 500;
}
.app-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.app-main {
  flex: 1;
  padding: 16px;
}
@media (max-width: 768px) {
  .app-header { padding: 10px; }
  .app-title { font-size: 16px; }
  .app-main { padding: 8px; }
}
</style>
