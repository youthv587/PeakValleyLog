/**
 * 数据校验纯函数
 * 金融字段合法性检查 + Excel导入字段映射校验
 */

// 必填且为正的数值字段
const POSITIVE_FIELDS = ['avg_price', 'high_theory', 'low_theory'];
// 可选数值字段
const OPTIONAL_NUM_FIELDS = ['base_return', 'base_risk', 'warn_high', 'warn_low', 'current_price'];

/**
 * 校验单条标的数据
 * @param {object} data 标的数据
 * @returns {string|null} 错误信息，null表示通过
 */
function validateSymbol(data) {
  if (!data.name || !String(data.name).trim()) return '标的名称不能为空';
  if (!data.code || !String(data.code).trim()) return '标的代码不能为空';
  if (!['index', 'etf', 'stock'].includes(data.category)) return '分类必须为 index / etf / stock';

  for (const f of POSITIVE_FIELDS) {
    const v = Number(data[f]);
    if (!v || v <= 0 || Number.isNaN(v)) return `${f} 必须为正数`;
  }
  for (const f of OPTIONAL_NUM_FIELDS) {
    if (data[f] === undefined || data[f] === null || data[f] === '') continue;
    const v = Number(data[f]);
    if (Number.isNaN(v)) return `${f} 必须为有效数字`;
  }
  return null;
}

/**
 * Excel 表头 -> 数据库字段映射
 * 注意: base_return / base_risk 已改为自动计算(v1.0.10), 导入时忽略
 */
const EXCEL_HEADER_MAP = {
  '名称': 'name',
  '代码': 'code',
  '分类': 'category',
  '近期均值': 'avg_price',
  '理论高点': 'high_theory',
  '理论低点': 'low_theory',
  '预警高点': 'warn_high',
  '预警低点': 'warn_low',
  '备注': 'note',
};

/**
 * 把 Excel 行数据转为数据库字段
 * @param {object} row Excel 单行 (xlsx 解析后)
 * @returns {object|null} 转换后的对象，无法转换返回 null
 */
function mapExcelRow(row) {
  const mapped = {};
  for (const [cn, en] of Object.entries(EXCEL_HEADER_MAP)) {
    if (row[cn] !== undefined && row[cn] !== null && row[cn] !== '') {
      mapped[en] = row[cn];
    }
  }
  if (mapped.category) {
    const c = String(mapped.category).toLowerCase();
    if (c.includes('etf')) mapped.category = 'etf';
    else if (c.includes('股票') || c.includes('stock')) mapped.category = 'stock';
    else mapped.category = 'index';
  }
  return mapped;
}

/**
 * 反向映射: 数据库记录 -> Excel 行
 * @param {object} row 数据库记录
 * @returns {object}
 */
function mapToExcelRow(row) {
  return {
    '名称': row.name,
    '代码': row.code,
    '分类': row.category === 'index' ? '指数' : row.category === 'stock' ? '股票' : 'ETF',
    '近期均值': row.avg_price,
    '理论高点': row.high_theory,
    '理论低点': row.low_theory,
    '基准收益(自动)': row.base_return ?? '',
    '基准风险(自动)': row.base_risk ?? '',
    '预警高点': row.warn_high,
    '预警低点': row.warn_low,
    '参考点位': row.reference_price ?? '',
    '理论最大收益率': row.max_return ?? '',
    '理论最大回撤率': row.max_drawdown ?? '',
    '差额收益率': row.spread_return ?? '',
    '实时点位': row.current_price ?? '',
    '预警状态': { break_high: '突破高点', break_low: '突破低点', near_high: '临近高点', near_low: '临近低点', normal: '正常' }[row.warn_status] || '正常',
    '备注': row.note || '',
  };
}

module.exports = {
  validateSymbol,
  EXCEL_HEADER_MAP,
  mapExcelRow,
  mapToExcelRow,
};
