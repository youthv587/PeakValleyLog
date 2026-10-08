/**
 * 实时行情代理
 * 后端统一请求公开行情接口，避免前端跨域
 * 当前使用 新浪财经 HTTP 接口 (免费, 无需 token)
 * 指数前缀: sh/sz + 代码, ETF: 同样 sh/sz 前缀
 */

const http = require('http');
const https = require('https');

/**
 * 根据标的代码构造新浪财经代码前缀
 * 上证指数: 000001 -> sh000001
 * 深证指数/ETF: 399xxx -> sz399xxx; 15xxxx -> sz15xxxx; 51xxxx -> sh51xxxx
 * 股票: 6xxxxx -> sh6xxxxx (沪市); 0xxxxx/3xxxxx -> sz0xxxxx/sz3xxxxx (深市); 8/4xxxxx -> bj (北交所)
 */
function buildSinaCode(code, category) {
  const c = String(code).trim();

  // 同花顺特殊代码前缀处理
  if (category === 'index') {
    if (/^1A0001$/.test(c)) return 'sh000001';       // 上证指数同花顺代码
    if (/^1B0688$/.test(c)) return 'sh000688';       // 科创50同花顺代码
    if (/^1B0680$/.test(c)) return 'sh000680';       // 科创综指同花顺代码
    if (/^1B0905$/.test(c)) return 'sh000905';       // 中证500同花顺代码
  }

  // 北证指数/北交所: 899xxx 归 bj 前缀
  if (/^899\d{3}$/.test(c)) return `bj${c}`;

  // ETF 51xxxx/52xxxx 上海, 15xxxx 深圳, 56xxxx 上海, 58xxxx 上海科创板ETF
  if (category === 'etf') {
    if (/^5[1268]\d{4}$/.test(c)) return `sh${c}`;
    if (/^15\d{4}$/.test(c))     return `sz${c}`;
    if (/^58\d{4}$/.test(c))     return `sh${c}`;  // 科创板ETF
  }

  // 股票: 6开头沪市, 0/3开头深市, 8/4开头北交所
  if (category === 'stock') {
    if (/^6/.test(c)) return `sh${c}`;
    if (/^[03]/.test(c)) return `sz${c}`;
    if (/^[84]/.test(c)) return `bj${c}`;
    return /^6/.test(c) ? `sh${c}` : `sz${c}`;
  }

  // 指数: 000xxx 上海, 399xxx 深圳
  if (/^000\d{3}$/.test(c)) return `sh${c}`;
  if (/^399\d{3}$/.test(c)) return `sz${c}`;
  // 93xxxx 中证行业主题指数, 归上海
  if (/^93\d{4}$/.test(c)) return `sh${c}`;

  // 兜底: 6 开头归上海, 其他归深圳
  return /^6/.test(c) ? `sh${c}` : `sz${c}`;
}

/**
 * HTTP GET 封装 (纯 Node, 无额外依赖)
 */
function httpGet(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    // 新浪接口要求 Referer 头, 否则返回空响应
    mod.get(url, {
      timeout: 5000,
      headers: {
        'Referer': 'https://finance.sina.com.cn/',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve(data));
    }).on('error', reject).on('timeout', function () {
      this.destroy();
      reject(new Error('request timeout'));
    });
  });
}

/**
 * 批量获取行情
 * @param {Array<{code:string, category:string}>} symbols
 * @returns {Promise<Map<string, number|null>>} code -> current_price
 */
async function batchFetchQuotes(symbols) {
  if (!symbols.length) return new Map();

  const sinaCodes = symbols.map((s) => buildSinaCode(s.code, s.category));
  const url = `http://hq.sinajs.cn/list=${sinaCodes.join(',')}`;

  let raw;
  try {
    raw = await httpGet(url);
  } catch (e) {
    // 新浪接口偶发不可用，对所有标的返回 null 让上层跳过刷新
    const m = new Map();
    symbols.forEach((s) => m.set(s.code, null));
    return m;
  }

  const result = new Map();
  const lines = raw.split('\n');
  lines.forEach((line, i) => {
    const match = line.match(/="([^"]*)"/);
    if (!match) { result.set(symbols[i]?.code, null); return; }
    const parts = match[1].split(',');
    // 新浪返回: 名称, 今开, 昨收, 现价, ...
    const price = parseFloat(parts[3]);
    result.set(symbols[i]?.code, Number.isFinite(price) ? price : null);
  });

  return result;
}

module.exports = { batchFetchQuotes, buildSinaCode };
