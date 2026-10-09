<template>
  <el-dialog
    v-model="visible"
    :title="isEdit ? '编辑标的' : '新增标的'"
    width="620px"
    :close-on-click-modal="false"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="名称" prop="name">
            <el-input v-model="form.name" placeholder="如: 沪深300" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="代码" prop="code">
            <el-input v-model="form.code" placeholder="如: 000300" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="分类" prop="category">
            <el-radio-group v-model="form.category">
              <el-radio value="index">指数</el-radio>
              <el-radio value="etf">ETF</el-radio>
              <el-radio value="stock">股票</el-radio>
            </el-radio-group>
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="8">
          <el-form-item label="近期均值" prop="avg_price">
            <el-input-number v-model="form.avg_price" :precision="4" :step="0.1" controls-position="right" style="width:100%" />
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="理论高点" prop="high_theory">
            <el-input-number v-model="form.high_theory" :precision="4" :step="0.1" controls-position="right" style="width:100%" />
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="理论低点" prop="low_theory">
            <el-input-number v-model="form.low_theory" :precision="4" :step="0.1" controls-position="right" style="width:100%" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="8">
          <el-form-item label="基准收益">
            <div class="auto-calc-val" :class="preview.base_return >= 0 ? 'text-green' : 'text-red'">{{ pct(preview.base_return) }}</div>
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="基准风险">
            <div class="auto-calc-val text-red">{{ pct(preview.base_risk) }}</div>
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="预警高点">
            <el-input-number v-model="form.warn_high" :precision="4" :step="0.1" controls-position="right" style="width:100%" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="8">
          <el-form-item label="预警低点">
            <el-input-number v-model="form.warn_low" :precision="4" :step="0.1" controls-position="right" style="width:100%" />
          </el-form-item>
        </el-col>
      </el-row>

      <!-- 自动计算预览 -->
      <el-divider content-position="left">自动计算预览</el-divider>
      <el-row :gutter="16" class="calc-preview">
        <el-col :span="6"><div class="cp-item">理论最大收益<span class="cp-val" :class="preview.max_return >= 0 ? 'text-green' : 'text-red'">{{ pct(preview.max_return) }}</span></div></el-col>
        <el-col :span="6"><div class="cp-item">理论最大回撤<span class="cp-val text-red">{{ pct(preview.max_drawdown) }}</span></div></el-col>
        <el-col :span="6"><div class="cp-item">差额收益率<span class="cp-val" :class="preview.spread_return >= 0 ? 'text-green' : 'text-red'">{{ pct(preview.spread_return) }}</span></div></el-col>
        <el-col :span="6"><div class="cp-item">参考点位<span class="cp-val text-blue">{{ preview.reference_price || '-' }}</span></div></el-col>
        <el-col :span="6"><div class="cp-item">基准收益<span class="cp-val" :class="preview.base_return >= 0 ? 'text-green' : 'text-red'">{{ pct(preview.base_return) }}</span></div></el-col>
        <el-col :span="6"><div class="cp-item">基准风险<span class="cp-val text-red">{{ pct(preview.base_risk) }}</span></div></el-col>
      </el-row>

      <el-form-item label="备注">
        <el-input v-model="form.note" type="textarea" :rows="3" placeholder="交易思路 / 观察逻辑 / 计划点位" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submit">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue';
import { ElMessage } from 'element-plus';
import api from '../api';
import { CALC } from '../utils/calculator';

const emit = defineEmits(['saved']);

const visible = ref(false);
const isEdit = ref(false);
const saving = ref(false);
const formRef = ref(null);

const emptyForm = () => ({
  id: null,
  name: '', code: '', category: 'etf',
  avg_price: null, high_theory: null, low_theory: null,
  base_return: 0, base_risk: 0,
  warn_high: null, warn_low: null,
  note: '',
});

const form = reactive(emptyForm());

const rules = {
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  code: [{ required: true, message: '请输入代码', trigger: 'blur' }],
  category: [{ required: true, message: '请选择分类', trigger: 'change' }],
  avg_price:    [{ required: true, message: '请输入近期均值', trigger: 'blur' }],
  high_theory:  [{ required: true, message: '请输入理论高点', trigger: 'blur' }],
  low_theory:   [{ required: true, message: '请输入理论低点', trigger: 'blur' }],
};

// 实时计算预览 (新公式: v1.0.10)
const preview = computed(() => {
  const avg = Number(form.avg_price);
  const high = Number(form.high_theory);
  const low = Number(form.low_theory);
  const mr = CALC.calcMaxReturn(high, low);
  const md = CALC.calcMaxDrawdown(low, high);
  const br = CALC.calcBaseReturn(high, avg);
  const bk = CALC.calcBaseRisk(low, avg);
  return {
    max_return: mr,
    max_drawdown: md,
    base_return: br,
    base_risk: bk,
    spread_return: CALC.calcSpreadReturn(br, bk),
    reference_price: CALC.calcReferencePrice(high, low),
  };
});

function open(row = null) {
  isEdit.value = !!row;
  Object.assign(form, emptyForm(), row || {});
  visible.value = true;
  formRef.value?.clearValidate();
}

async function submit() {
  try {
    await formRef.value.validate();
  } catch { return; }
  saving.value = true;
  try {
    if (isEdit.value) {
      await api.update(form.id, { ...form });
      ElMessage.success('已更新');
    } else {
      await api.create({ ...form });
      ElMessage.success('已新增');
    }
    visible.value = false;
    emit('saved');
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || '保存失败');
  } finally {
    saving.value = false;
  }
}

function pct(v) {
  if (!v && v !== 0) return '-';
  return (Number(v) * 100).toFixed(2) + '%';
}

defineExpose({ open });
</script>

<style scoped>
.calc-preview { background: #f5f7fa; border-radius: 6px; padding: 10px; }
.cp-item { display: flex; justify-content: space-between; font-size: 13px; color: #606266; }
.cp-val { font-size: 14px; font-weight: 700; }
.text-green { color: #67c23a; }
.text-red { color: #f56c6c; }
.text-blue { color: #409eff; }

/* 自动计算只读值 */
.auto-calc-val {
  padding: 6px 12px;
  background: #f5f7fa;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  min-height: 32px;
  display: flex;
  align-items: center;
}
</style>
