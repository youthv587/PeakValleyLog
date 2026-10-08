/**
 * 指标计算纯函数
 * 前后端共用同一套逻辑，保证结果一致
 */

/**
 * 理论最大收益 = (理论高点 - 近期均值) / 近期均值
 * @param {number} high 理论高点
 * @param {number} avg  近期均值
 * @returns {number} 小数形式的收益率, 保留4位小数
 */
function calcMaxReturn(high, avg) {
  if (!avg || avg <= 0 || !high) return 0;
  return Math.round(((high - avg) / avg) * 10000) / 10000;
}

/**
 * 理论最大回撤 = (理论低点 - 近期均值) / 近期均值
 * @param {number} low 理论低点
 * @param {number} avg 近期均值
 * @returns {number} 小数形式的回撤率, 保留4位小数
 */
function calcMaxDrawdown(low, avg) {
  if (!avg || avg <= 0 || !low) return 0;
  return Math.round(((low - avg) / avg) * 10000) / 10000;
}

/**
 * 差额收益率 = 理论最大收益 - 基准收益
 * @param {number} maxReturn 理论最大收益(小数)
 * @param {number} baseReturn 基准收益(小数)
 * @returns {number} 保留4位小数
 */
function calcSpreadReturn(maxReturn, baseReturn) {
  return Math.round((maxReturn - (baseReturn || 0)) * 10000) / 10000;
}

/**
 * 参考点位 = 差额收益率为20%时的指数点位
 * 推导: (high - P) / P - baseReturn = 0.2  =>  P = high / (1.2 + baseReturn)
 * @param {number} high 理论高点
 * @param {number} baseReturn 基准收益(小数)
 * @returns {number} 保留4位小数
 */
function calcReferencePrice(high, baseReturn) {
  if (!high || high <= 0) return 0;
  const denom = 1.2 + Number(baseReturn || 0);
  if (denom <= 0) return 0;
  return Math.round((high / denom) * 100) / 100;
}

/**
 * 根据实时点位与预警线生成预警状态
 * @param {number} current  实时点位
 * @param {number} avg      近期均值
 * @param {number} high     理论高点
 * @param {number} low      理论低点
 * @param {number} warnHigh 预警高点(可选)
 * @param {number} warnLow  预警低点(可选)
 * @returns {'break_high'|'break_low'|'near_high'|'near_low'|'normal'}
 */
function calcWarnStatus(current, avg, high, low, warnHigh, warnLow) {
  if (!current || !avg) return 'normal';

  const upperWarn = warnHigh || high;
  const lowerWarn = warnLow  || low;

  // 突破预警线
  if (current >= upperWarn) return 'break_high';
  if (current <= lowerWarn) return 'break_low';

  // 临近预警线 (距离预警线 ≤ 均值的 1%)
  const threshold = avg * 0.01;
  if (current >= upperWarn - threshold) return 'near_high';
  if (current <= lowerWarn + threshold) return 'near_low';

  return 'normal';
}

/**
 * 为一条标的记录填充所有衍生指标
 * @param {object} row 数据库原始字段
 * @returns {object} 带衍生指标的完整记录
 */
function enrichSymbol(row) {
  if (!row) return row;
  const avg = Number(row.avg_price);
  const high = Number(row.high_theory);
  const low = Number(row.low_theory);
  const baseReturn = Number(row.base_return || 0);
  const current = row.current_price ? Number(row.current_price) : null;
  const warnHigh = row.warn_high ? Number(row.warn_high) : null;
  const warnLow  = row.warn_low  ? Number(row.warn_low)  : null;

  const maxReturn = calcMaxReturn(high, avg);
  const maxDrawdown = calcMaxDrawdown(low, avg);

  return {
    ...row,
    avg,
    high,
    low,
    current,
    max_return: maxReturn,
    max_drawdown: maxDrawdown,
    spread_return: calcSpreadReturn(maxReturn, baseReturn),
    reference_price: calcReferencePrice(high, baseReturn),
    warn_status: calcWarnStatus(current, avg, high, low, warnHigh, warnLow),
  };
}

module.exports = {
  calcMaxReturn,
  calcMaxDrawdown,
  calcSpreadReturn,
  calcReferencePrice,
  calcWarnStatus,
  enrichSymbol,
};
