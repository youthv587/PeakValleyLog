/**
 * 指标计算纯函数
 * 前后端共用同一套逻辑，保证结果一致
 *
 * 公式规则 (v1.0.10 起):
 *   理论最大收益率 = (理论高点 - 理论低点) / 理论低点
 *   理论最大回撤率 = (理论低点 - 理论高点) / 理论高点
 *   基准收益  = (理论高点 - 近期均值) / 近期均值   (自动计算)
 *   基准风险  = (理论低点 - 近期均值) / 近期均值   (自动计算)
 *   差额收益率 = 基准收益 + 基准风险
 *   参考点位  = 差额收益率为 20% 时的点位 = (理论高点 + 理论低点) / 2.2
 */

/**
 * 理论最大收益率 = (理论高点 - 理论低点) / 理论低点
 * @param {number} high 理论高点
 * @param {number} low  理论低点
 * @returns {number} 小数形式, 保留4位小数
 */
function calcMaxReturn(high, low) {
  if (!low || low <= 0 || !high) return 0;
  return Math.round(((high - low) / low) * 10000) / 10000;
}

/**
 * 理论最大回撤率 = (理论低点 - 理论高点) / 理论高点
 * @param {number} low  理论低点
 * @param {number} high 理论高点
 * @returns {number} 小数形式(负数), 保留4位小数
 */
function calcMaxDrawdown(low, high) {
  if (!high || high <= 0 || !low) return 0;
  return Math.round(((low - high) / high) * 10000) / 10000;
}

/**
 * 基准收益 = (理论高点 - 近期均值) / 近期均值
 * @param {number} high 理论高点
 * @param {number} avg  近期均值
 * @returns {number} 小数形式, 保留4位小数
 */
function calcBaseReturn(high, avg) {
  if (!avg || avg <= 0 || !high) return 0;
  return Math.round(((high - avg) / avg) * 10000) / 10000;
}

/**
 * 基准风险 = (理论低点 - 近期均值) / 近期均值
 * @param {number} low 理论低点
 * @param {number} avg 近期均值
 * @returns {number} 小数形式(通常为负), 保留4位小数
 */
function calcBaseRisk(low, avg) {
  if (!avg || avg <= 0 || !low) return 0;
  return Math.round(((low - avg) / avg) * 10000) / 10000;
}

/**
 * 差额收益率 = 基准收益 + 基准风险
 * @param {number} baseReturn 基准收益(小数)
 * @param {number} baseRisk   基准风险(小数)
 * @returns {number} 保留4位小数
 */
function calcSpreadReturn(baseReturn, baseRisk) {
  return Math.round((Number(baseReturn || 0) + Number(baseRisk || 0)) * 10000) / 10000;
}

/**
 * 参考点位 = 差额收益率为 20% 时的指数点位
 * 推导: (high + low - 2P) / P = 0.2  =>  P = (high + low) / 2.2
 * @param {number} high 理论高点
 * @param {number} low  理论低点
 * @returns {number} 保留2位小数
 */
function calcReferencePrice(high, low) {
  if (!high || !low || low <= 0) return 0;
  const denom = 2.2;
  return Math.round(((high + low) / denom) * 100) / 100;
}

/**
 * 根据实时点位与预警线生成预警状态
 */
function calcWarnStatus(current, avg, high, low, warnHigh, warnLow) {
  if (!current || !avg) return 'normal';

  const upperWarn = warnHigh || high;
  const lowerWarn = warnLow  || low;

  if (current >= upperWarn) return 'break_high';
  if (current <= lowerWarn) return 'break_low';

  const threshold = avg * 0.01;
  if (current >= upperWarn - threshold) return 'near_high';
  if (current <= lowerWarn + threshold) return 'near_low';

  return 'normal';
}

/**
 * 为一条标的记录填充所有衍生指标
 * 注意: base_return / base_risk 始终从 avg/high/low 自动重算, 忽略 DB 存储值
 */
function enrichSymbol(row) {
  if (!row) return row;
  const avg = Number(row.avg_price);
  const high = Number(row.high_theory);
  const low = Number(row.low_theory);
  const current = row.current_price ? Number(row.current_price) : null;
  const warnHigh = row.warn_high ? Number(row.warn_high) : null;
  const warnLow  = row.warn_low  ? Number(row.warn_low)  : null;

  const maxReturn = calcMaxReturn(high, low);
  const maxDrawdown = calcMaxDrawdown(low, high);
  const baseReturn = calcBaseReturn(high, avg);
  const baseRisk = calcBaseRisk(low, avg);

  return {
    ...row,
    avg,
    high,
    low,
    current,
    max_return: maxReturn,
    max_drawdown: maxDrawdown,
    base_return: baseReturn,   // 覆盖 DB 值, 自动计算
    base_risk: baseRisk,       // 覆盖 DB 值, 自动计算
    spread_return: calcSpreadReturn(baseReturn, baseRisk),
    reference_price: calcReferencePrice(high, low),
    warn_status: calcWarnStatus(current, avg, high, low, warnHigh, warnLow),
  };
}

module.exports = {
  calcMaxReturn,
  calcMaxDrawdown,
  calcBaseReturn,
  calcBaseRisk,
  calcSpreadReturn,
  calcReferencePrice,
  calcWarnStatus,
  enrichSymbol,
};
