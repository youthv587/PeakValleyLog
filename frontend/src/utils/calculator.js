/**
 * 前端同版计算逻辑
 * 与后端 utils/calculator.js 保持一致, 用于前端即时预览
 */

function calcMaxReturn(high, avg) {
  if (!avg || avg <= 0 || !high) return 0;
  return Math.round(((high - avg) / avg) * 10000) / 10000;
}

function calcMaxDrawdown(low, avg) {
  if (!avg || avg <= 0 || !low) return 0;
  return Math.round(((low - avg) / avg) * 10000) / 10000;
}

function calcSpreadReturn(maxReturn, baseReturn) {
  return Math.round((maxReturn - (baseReturn || 0)) * 10000) / 10000;
}

/**
 * 参考点位 = 差额收益率为20%时的指数点位
 * 推导: (high - P) / P - baseReturn = 0.2  =>  P = high / (1.2 + baseReturn)
 */
function calcReferencePrice(high, baseReturn) {
  if (!high || high <= 0) return 0;
  const denom = 1.2 + Number(baseReturn || 0);
  if (denom <= 0) return 0;
  return Math.round((high / denom) * 100) / 100;
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
  const baseReturn = Number(row.base_return || 0);
  const current = row.current_price ? Number(row.current_price) : null;
  const warnHigh = row.warn_high ? Number(row.warn_high) : null;
  const warnLow  = row.warn_low  ? Number(row.warn_low)  : null;

  const maxReturn = calcMaxReturn(high, avg);
  const maxDrawdown = calcMaxDrawdown(low, avg);
  return {
    ...row,
    max_return: maxReturn,
    max_drawdown: maxDrawdown,
    spread_return: calcSpreadReturn(maxReturn, baseReturn),
    reference_price: calcReferencePrice(high, baseReturn),
    warn_status: calcWarnStatus(current, avg, high, low, warnHigh, warnLow),
  };
}

export const CALC = { calcMaxReturn, calcMaxDrawdown, calcSpreadReturn, calcReferencePrice, calcWarnStatus };
