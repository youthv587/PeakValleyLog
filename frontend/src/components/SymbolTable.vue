<template>
  <div class="symbol-table-wrap">
    <!-- 搜索筛选 -->
    <div class="filter-bar">
      <el-input
        v-model="query.keyword"
        placeholder="搜索名称/代码"
        clearable
        style="width:200px"
        @keyup.enter="loadData"
        @clear="loadData"
      />
      <el-select v-model="query.category" placeholder="分类" clearable style="width:120px" @change="loadData">
        <el-option label="指数" value="index" />
        <el-option label="ETF"  value="etf" />
        <el-option label="股票" value="stock" />
      </el-select>
      <el-select v-model="query.sort" placeholder="排序" clearable style="width:160px" @change="loadData">
        <el-option label="差额收益率 升序" value="spread_return:asc" />
        <el-option label="差额收益率 降序" value="spread_return:desc" />
        <el-option label="更新时间 降序" value="updated_at:desc" />
      </el-select>
      <el-tag type="info">共 {{ total }} 条</el-tag>
    </div>

    <!-- PC端表格 -->
    <el-table
      :data="rows"
      row-key="id"
      :row-class-name="rowClassName"
      stripe
      border
      size="default"
      style="width:100%"
      v-loading="loading"
      :default-sort="defaultSort"
      @sort-change="handleSortChange"
    >
      <el-table-column label="状态" width="80" class-name="pc-only">
        <template #header>
          <el-tooltip :content="headerTips.warn_status" placement="top">
            <span class="th-with-tip">状态 ⓘ</span>
          </el-tooltip>
        </template>
        <template #default="{ row }">
          <span class="status-dot" :class="`dot-${row.warn_status}`"></span>
          {{ statusText(row.warn_status) }}
        </template>
      </el-table-column>
      <el-table-column prop="name" label="名称" width="140" fixed />
      <el-table-column prop="code" label="代码" width="100" />
      <el-table-column label="分类" width="70">
        <template #default="{ row }">
          <el-tag size="small" :type="categoryTagType(row.category)">
            {{ categoryLabel(row.category) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="avg" width="130" align="right" class-name="pc-only">
        <template #header>
          <el-tooltip :content="headerTips.avg" placement="top">
            <span class="th-with-tip">近期均值 ⓘ</span>
          </el-tooltip>
        </template>
        <template #default="{ row }">
          <div
            v-if="editingCell.id === row.id && editingCell.field === 'avg_price'"
            @click.stop
          >
            <el-input-number
              v-model="editingCell.value"
              :precision="2"
              :min="0.01"
              size="small"
              controls-position="right"
              style="width:110px"
              @keyup.enter="saveInlineEdit(row, 'avg_price')"
              @keyup.esc="cancelInlineEdit"
              @blur="saveInlineEdit(row, 'avg_price')"
            />
          </div>
          <div v-else class="editable-cell" @click="startInlineEdit(row, 'avg_price')">
            {{ fmt2(row.avg) }}
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="high" width="130" align="right" class-name="pc-only">
        <template #header>
          <el-tooltip :content="headerTips.high" placement="top">
            <span class="th-with-tip">理论高点 ⓘ</span>
          </el-tooltip>
        </template>
        <template #default="{ row }">
          <div
            v-if="editingCell.id === row.id && editingCell.field === 'high_theory'"
            @click.stop
          >
            <el-input-number
              v-model="editingCell.value"
              :precision="2"
              :min="0.01"
              size="small"
              controls-position="right"
              style="width:110px"
              @keyup.enter="saveInlineEdit(row, 'high_theory')"
              @keyup.esc="cancelInlineEdit"
              @blur="saveInlineEdit(row, 'high_theory')"
            />
          </div>
          <div v-else class="editable-cell" @click="startInlineEdit(row, 'high_theory')">
            {{ fmt2(row.high) }}
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="low" width="130" align="right" class-name="pc-only">
        <template #header>
          <el-tooltip :content="headerTips.low" placement="top">
            <span class="th-with-tip">理论低点 ⓘ</span>
          </el-tooltip>
        </template>
        <template #default="{ row }">
          <div
            v-if="editingCell.id === row.id && editingCell.field === 'low_theory'"
            @click.stop
          >
            <el-input-number
              v-model="editingCell.value"
              :precision="2"
              :min="0.01"
              size="small"
              controls-position="right"
              style="width:110px"
              @keyup.enter="saveInlineEdit(row, 'low_theory')"
              @keyup.esc="cancelInlineEdit"
              @blur="saveInlineEdit(row, 'low_theory')"
            />
          </div>
          <div v-else class="editable-cell" @click="startInlineEdit(row, 'low_theory')">
            {{ fmt2(row.low) }}
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="reference_price" width="110" align="right">
        <template #header>
          <el-tooltip :content="headerTips.reference_price" placement="top">
            <span class="th-with-tip">参考点位 ⓘ</span>
          </el-tooltip>
        </template>
        <template #default="{ row }">
          <span class="text-bold text-blue">
            {{ row.reference_price != null ? fmt2(row.reference_price) : '-' }}
          </span>
        </template>
      </el-table-column>
      <el-table-column prop="max_return" width="120" align="right" class-name="pc-only">
        <template #header>
          <el-tooltip :content="headerTips.max_return" placement="top">
            <span class="th-with-tip">理论最大收益 ⓘ</span>
          </el-tooltip>
        </template>
        <template #default="{ row }">{{ pct(row.max_return) }}</template>
      </el-table-column>
      <el-table-column prop="max_drawdown" width="120" align="right" class-name="pc-only">
        <template #header>
          <el-tooltip :content="headerTips.max_drawdown" placement="top">
            <span class="th-with-tip">理论最大回撤 ⓘ</span>
          </el-tooltip>
        </template>
        <template #default="{ row }">{{ pct(row.max_drawdown) }}</template>
      </el-table-column>
      <el-table-column prop="spread_return" width="120" align="right" header-align="right" sortable="custom">
        <template #header>
          <el-tooltip :content="headerTips.spread_return" placement="top">
            <span class="th-with-tip">差额收益率 ⓘ</span>
          </el-tooltip>
        </template>
        <template #default="{ row }">
          <span :class="row.spread_return >= 0 ? 'text-green' : 'text-red'">
            {{ pct(row.spread_return) }}
          </span>
        </template>
      </el-table-column>
      <el-table-column prop="note" label="备注" min-width="160" show-overflow-tooltip class-name="pc-only" />
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button size="small" type="primary" link @click="$emit('edit', row)">编辑</el-button>
          <el-button size="small" type="success" link :loading="updatingId === row.id" @click="handleUpdateRow(row)">更新</el-button>
          <el-button size="small" type="danger"  link @click="$emit('delete', row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 移动端卡片 -->
    <div class="mobile-card-list mobile-only" v-loading="loading">
      <div
        v-for="row in rows"
        :key="row.id"
        class="mobile-card"
        :class="`card-${row.warn_status}`"
      >
        <div class="mc-header">
          <div class="mc-name">{{ row.name }} <span class="mc-code">{{ row.code }}</span></div>
          <div class="mc-current text-blue">
            {{ row.reference_price != null ? fmt2(row.reference_price) : '-' }}
          </div>
        </div>
        <div class="mc-body">
          <div>均值: {{ fmt2(row.avg) }}</div>
          <div>高: {{ fmt2(row.high) }}</div>
          <div>低: {{ fmt2(row.low) }}</div>
          <div class="mc-spread">差额: {{ pct(row.spread_return) }}</div>
        </div>
        <div class="mc-actions">
          <el-button size="small" @click="$emit('edit', row)">编辑</el-button>
          <el-button size="small" type="success" :loading="updatingId === row.id" @click="handleUpdateRow(row)">更新</el-button>
          <el-button size="small" type="danger" @click="$emit('delete', row)">删除</el-button>
        </div>
      </div>
      <el-empty v-if="!loading && rows.length === 0" description="暂无数据" />
    </div>

    <!-- 分页 -->
    <el-pagination
      v-if="total > 0"
      class="pagination"
      background
      layout="total, sizes, prev, pager, next"
      :total="total"
      v-model:current-page="query.page"
      v-model:page-size="query.page_size"
      :page-sizes="[20, 50, 100]"
      @current-change="loadData"
      @size-change="loadData"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import api from '../api';

const emit = defineEmits(['edit', 'delete']);

const loading = ref(false);
const updatingId = ref(null);
const rows = ref([]);
const total = ref(0);

// 内联编辑状态
const editingCell = reactive({ id: null, field: null, value: null });
const query = reactive({
  keyword: '',
  category: '',
  sort: '',
  page: 1,
  page_size: 50,
});

// 各指标列悬停描述 (计算规则 / 含义)
const headerTips = {
  warn_status: '预警状态：根据实时点位与预警线比较生成。突破高点=深绿，突破低点=深红，临近预警线=黄，正常=透明。',
  avg: '近期均值：用户录入的近期价格均值，作为基准收益/基准风险的计算基准。',
  high: '理论高点：用户预期的理论最高点位。',
  low: '理论低点：用户预期的理论最低点位。',
  reference_price: '参考点位 = (理论高点 + 理论低点) / 2.2，即差额收益率=20%时的指数点位。',
  max_return: '理论最大收益率 = (理论高点 - 理论低点) / 理论低点。从低点到高点的预期最大涨幅。',
  max_drawdown: '理论最大回撤率 = (理论低点 - 理论高点) / 理论高点。从高点到低点的预期最大跌幅（负数）。',
  spread_return: '差额收益率 = 基准收益 + 基准风险 = (高点-均值)/均值 + (低点-均值)/均值。点击表头可排序。',
};

// 列头排序映射 (prop -> 后端 sort 参数)
const sortableProps = ['spread_return', 'updated_at', 'avg_price', 'high_theory', 'low_theory'];

// el-table default-sort 绑定 (从 query.sort 反向解析)
const defaultSort = computed(() => {
  if (!query.sort) return {};
  const [prop, order] = query.sort.split(':');
  return { prop, order: order === 'desc' ? 'descending' : 'ascending' };
});

function handleSortChange({ prop, order }) {
  if (!prop || !order || !sortableProps.includes(prop)) {
    query.sort = '';
  } else {
    query.sort = `${prop}:${order === 'ascending' ? 'asc' : 'desc'}`;
  }
  query.page = 1;
  loadData();
}

async function loadData() {
  loading.value = true;
  try {
    const { data } = await api.list({ ...query });
    // 后端已通过 enrichSymbol 计算衍生指标, 此处直接使用
    rows.value = data.data || [];
    total.value = data.total || 0;
  } catch (e) {
    ElMessage.error('加载失败: ' + (e?.response?.data?.error || e.message));
  } finally {
    loading.value = false;
  }
}

function rowClassName({ row }) {
  return `warn-${row.warn_status}`;
}

// 行内更新: 只拉取该行标的最新净值, 覆盖近期均值并重算指标
async function handleUpdateRow(row) {
  updatingId.value = row.id;
  try {
    const { data } = await api.refreshRecompute(row.id);
    if (data.success > 0) {
      ElMessage.success(`${row.name} 已用最新净值更新, 衍生指标已重算`);
    } else {
      ElMessage.warning(`${row.name}(${row.code}) 行情接口未覆盖, 已保留原值`);
    }
    await loadData();
  } catch (e) {
    ElMessage.error('更新失败: ' + (e?.response?.data?.error || e.message));
  } finally {
    updatingId.value = null;
  }
}

// 分类三元映射 (替代原二元判断)
const categoryLabelMap = { index: '指数', etf: 'ETF', stock: '股票' };
const categoryTagTypeMap = { index: '', etf: 'success', stock: 'warning' };
function categoryLabel(c) { return categoryLabelMap[c] || c; }
function categoryTagType(c) { return categoryTagTypeMap[c] || ''; }

function statusText(s) {
  return ({ break_high: '突破高点', break_low: '突破低点', near_high: '临近高点', near_low: '临近低点', normal: '正常' })[s] || '正常';
}
function pct(v) {
  if (v === null || v === undefined || Number.isNaN(v)) return '-';
  return (Number(v) * 100).toFixed(2) + '%';
}
// 数值保留2位小数显示
function fmt2(v) {
  if (v === null || v === undefined || Number.isNaN(v)) return '-';
  return Number(v).toFixed(2);
}

// ===== 内联编辑 (点击单元格 → el-input-number → 失焦/Enter 保存) =====
function startInlineEdit(row, field) {
  // 映射字段: DB 字段名 → 前端别名
  const aliasMap = { avg_price: 'avg', high_theory: 'high', low_theory: 'low' };
  editingCell.id = row.id;
  editingCell.field = field;
  editingCell.value = Number(row[aliasMap[field] || row[field]]);
}
function cancelInlineEdit() {
  editingCell.id = null;
  editingCell.field = null;
  editingCell.value = null;
}
async function saveInlineEdit(row, field) {
  const val = editingCell.value;
  cancelInlineEdit();
  if (val === null || val === undefined) return;
  try {
    const { data } = await api.update(row.id, { [field]: val });
    // 后端 enrichSymbol 已重算所有衍生指标, 本地直接更新该行
    const idx = rows.value.findIndex((r) => r.id === row.id);
    if (idx >= 0) rows.value.splice(idx, 1, data);
    ElMessage.success(`${row.name} 已更新, 衍生指标已重算`);
  } catch (e) {
    ElMessage.error('保存失败: ' + (e?.response?.data?.error || e.message));
    await loadData();
  }
}

defineExpose({ loadData });
onMounted(loadData);
</script>

<style scoped>
.filter-bar {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.pagination { margin-top: 12px; justify-content: flex-end; display: flex; }
.text-bold { font-weight: 700; }
.text-green { color: #67c23a; }
.text-red { color: #f56c6c; }
.text-blue { color: #409eff; }
.th-with-tip { cursor: help; border-bottom: 1px dashed #909399; }

/* 内联编辑单元格 */
.editable-cell {
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.15s;
}
.editable-cell:hover {
  background: #ecf5ff;
  color: #409eff;
  font-weight: 600;
}

/* 移动端卡片 */
.mobile-card-list { display: flex; flex-direction: column; gap: 10px; }
.mobile-card {
  background: #fff;
  border-radius: 8px;
  padding: 12px;
  border-left: 4px solid #c0c4cc;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
.mobile-card.card-break-high { border-left-color: #67c23a; background: #f0f9eb; }
.mobile-card.card-break-low  { border-left-color: #f56c6c; background: #fef0f0; }
.mobile-card.card-near-high,
.mobile-card.card-near-low  { border-left-color: #e6a23c; background: #fdf6ec; }

.mc-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.mc-name { font-size: 15px; font-weight: 600; }
.mc-code { font-size: 12px; color: #909399; margin-left: 6px; }
.mc-current { font-size: 20px; font-weight: 700; }
.mc-body { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px 12px; font-size: 13px; color: #606266; }
.mc-spread { font-weight: 600; }
.mc-actions { margin-top: 10px; display: flex; gap: 8px; }
</style>
