/**
 * 前端同版计算逻辑
 * 与后端 utils/calculator.js 保持一致, 用于前端即时预览
 *
 * 公式规则 (v1.0.10 起):
 *   理论最大收益率 = (理论高点 - 理论低点) / 理论低点
 *   理论最大回撤率 = (理论低点 - 理论高点) / 理论高点
 *   基准收益  = (理论高点 - 近期均值) / 近期均值   (自动计算)
 *   基准风险  = (理论低点 - 近期均值) / 近期均值   (自动计算)
 *   差额收益率 = 基准收益 + 基准风险
 *   参考点位  = (理论高点 + 理论低点) / 2.2
 */

function calcMaxReturn(high, low) {
  if (!low || low <= 0 || !high) return 0;
  return Math.round(((high - low) / low) * 10000) / 10000;
}

function calcMaxDrawdown(low, high) {
  if (!high || high <= 0 || !low) return 0;
  return Math.round(((low - high) / high) * 10000) / 10000;
}

function calcBaseReturn(high, avg) {
  if (!avg || avg <= 0 || !high) return 0;
  return Math.round(((high - avg) / avg) * 10000) / 10000;
}

function calcBaseRisk(low, avg) {
  if (!avg || avg <= 0 || !low) return 0;
  return Math.round(((low - avg) / avg) * 10000) / 10000;
}

function calcSpreadReturn(baseReturn, baseRisk) {
  return Math.round((Number(baseReturn || 0) + Number(baseRisk || 0)) * 10000) / 10000;
}

function calcReferencePrice(high, low) {
  if (!high || !low || low <= 0) return 0;
  return Math.round(((high + low) / 2.2) * 100) / 100;
}

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

export function enrichSymbol(row) {
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
    max_return: maxReturn,
    max_drawdown: maxDrawdown,
    base_return: baseReturn,
    base_risk: baseRisk,
    spread_return: calcSpreadReturn(baseReturn, baseRisk),
    reference_price: calcReferencePrice(high, low),
    warn_status: calcWarnStatus(current, avg, high, low, warnHigh, warnLow),
  };
}

export const CALC = { calcMaxReturn, calcMaxDrawdown, calcBaseReturn, calcBaseRisk, calcSpreadReturn, calcReferencePrice, calcWarnStatus };
