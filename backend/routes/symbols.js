const express = require('express');
const pool = require('../db');
const { enrichSymbol } = require('../utils/calculator');
const { validateSymbol, mapExcelRow, mapToExcelRow } = require('../utils/validator');
const { batchFetchQuotes } = require('../utils/quote');
const XLSX = require('xlsx');

const router = express.Router();

// 统一的 DB 异常处理
const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch((e) => {
    console.error('[DB Error]', e.message);
    res.status(500).json({ error: e.message });
  });

// ===== CRUD =====

router.get('/', wrap(async (req, res) => {
  const { keyword = '', category = '', sort = '', page = 1, page_size = 50 } = req.query;
  const offset = (Number(page) - 1) * Number(page_size);

  // 独立构建 WHERE 条件, 供计数与查询共用 (避免对已拼接 SQL 做字符串切割)
  let whereSql = ' WHERE 1=1';
  const params = [];

  if (keyword) {
    whereSql += ' AND (name LIKE ? OR code LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`);
  }
  if (category) {
    whereSql += ' AND category = ?';
    params.push(category);
  }

  // spread_return 为计算字段, 需全量取出后在内存排序
  if (sort.startsWith('spread_return:')) {
    const order = sort.endsWith(':desc') ? 'desc' : 'asc';
    const [rows] = await pool.query(`SELECT * FROM symbols${whereSql}`, params);
    const enriched = rows.map(enrichSymbol);
    enriched.sort((a, b) => (order === 'desc' ? b.spread_return - a.spread_return : a.spread_return - b.spread_return));
    const total = enriched.length;
    const paged = enriched.slice(offset, offset + Number(page_size));
    return res.json({ data: paged, total, page: Number(page), page_size: Number(page_size) });
  }

  // 计数与查询共用同一 WHERE
  const [countRows] = await pool.query(`SELECT COUNT(*) AS c FROM symbols${whereSql}`, params);
  const total = countRows[0].c;

  let orderSql = ' ORDER BY id DESC';
  if (sort) {
    const [field, order] = sort.split(':');
    const safeField = ['id', 'avg_price', 'high_theory', 'low_theory', 'current_price', 'created_at', 'updated_at'].includes(field) ? field : 'id';
    const safeOrder = order === 'desc' ? 'DESC' : 'ASC';
    orderSql = ` ORDER BY ${safeField} ${safeOrder}`;
  }

  const sql = `SELECT * FROM symbols${whereSql}${orderSql} LIMIT ? OFFSET ?`;
  const [rows] = await pool.query(sql, [...params, Number(page_size), offset]);

  res.json({ data: rows.map(enrichSymbol), total, page: Number(page), page_size: Number(page_size) });
}));

router.post('/', wrap(async (req, res) => {
  const err = validateSymbol(req.body);
  if (err) return res.status(400).json({ error: err });

  const { name, code, category, avg_price, high_theory, low_theory,
          base_return = 0, base_risk = 0, warn_high = null, warn_low = null, note = '' } = req.body;

  try {
    const [result] = await pool.query(
      `INSERT INTO symbols (name, code, category, avg_price, high_theory, low_theory,
         base_return, base_risk, warn_high, warn_low, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, code, category, avg_price, high_theory, low_theory,
       base_return, base_risk, warn_high, warn_low, note],
    );
    const [[row]] = await pool.query('SELECT * FROM symbols WHERE id = ?', [result.insertId]);
    res.json(enrichSymbol(row));
  } catch (e) {
    if (String(e.message).includes('UNIQUE constraint')) return res.status(409).json({ error: '该分类下代码已存在' });
    throw e;
  }
}));

router.put('/:id', wrap(async (req, res) => {
  const { id } = req.params;
  const err = validateSymbol(req.body);
  if (err) return res.status(400).json({ error: err });

  const { name, code, category, avg_price, high_theory, low_theory,
          base_return = 0, base_risk = 0, warn_high = null, warn_low = null, note = '' } = req.body;

  try {
    await pool.query(
      `UPDATE symbols SET name=?, code=?, category=?, avg_price=?, high_theory=?, low_theory=?,
         base_return=?, base_risk=?, warn_high=?, warn_low=?, note=?, updated_at=datetime('now','localtime') WHERE id=?`,
      [name, code, category, avg_price, high_theory, low_theory,
       base_return, base_risk, warn_high, warn_low, note, id],
    );
    const [[row]] = await pool.query('SELECT * FROM symbols WHERE id = ?', [id]);
    if (!row) return res.status(404).json({ error: '标的不存在' });
    res.json(enrichSymbol(row));
  } catch (e) {
    if (String(e.message).includes('UNIQUE constraint')) return res.status(409).json({ error: '该分类下代码已存在' });
    throw e;
  }
}));

router.delete('/:id', wrap(async (req, res) => {
  const { id } = req.params;
  const [result] = await pool.query('DELETE FROM symbols WHERE id = ?', [id]);
  if (!result.affectedRows) return res.status(404).json({ error: '标的不存在' });
  res.json({ ok: true });
}));

// ===== 一键更新: 拉取最新净值并直接放入近期均值, 触发所有衍生指标重算 =====
// body 传可选 id: 只更新该标的 (行内更新按钮); 不传则更新全部
router.post('/refresh-recompute', wrap(async (req, res) => {
  const { id } = req.body || {};
  let rows;
  if (id) {
    [rows] = await pool.query('SELECT id, category, code FROM symbols WHERE id = ?', [Number(id)]);
    if (!rows.length) return res.status(404).json({ error: '标的不存在' });
  } else {
    [rows] = await pool.query('SELECT id, category, code FROM symbols');
  }
  if (!rows.length) return res.json({ success: 0, failed: 0, skipped: 0 });

  const quotes = await batchFetchQuotes(rows);
  let success = 0, failed = 0, skipped = 0;
  for (const row of rows) {
    const price = quotes.get(row.code);
    if (!price || price <= 0) {
      failed++;
      skipped++;
      continue;
    }
    // 同时更新 current_price 和 avg_price(近期均值), 衍生指标(max_return/max_drawdown/spread_return) 自动重算
    await pool.query(
      `UPDATE symbols SET current_price=?, avg_price=?, updated_at=datetime('now','localtime') WHERE id=?`,
      [price, price, row.id],
    );
    success++;
  }
  res.json({ success, failed, skipped, message: '已用最新行情覆盖近期均值, 衍生指标已重算' });
}));

// ===== Excel 导入导出 =====

router.get('/export/excel', wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM symbols ORDER BY category, code');
  const excelRows = rows.map(enrichSymbol).map(mapToExcelRow);

  const ws = XLSX.utils.json_to_sheet(excelRows);
  ws['!cols'] = [
    { wch: 14 }, { wch: 10 }, { wch: 8 },
    { wch: 12 }, { wch: 12 }, { wch: 12 },
    { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 12 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    { wch: 12 }, { wch: 30 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '盯盘标的');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=peakvalley_log_${Date.now()}.xlsx`);
  res.send(buffer);
}));

router.post('/import/excel', wrap(async (req, res) => {
  const { rows = [], mode = 'append' } = req.body;
  if (!rows.length) return res.status(400).json({ error: '没有可导入的数据' });

  const results = { success: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const mapped = mapExcelRow(rows[i]);
    const err = validateSymbol(mapped);
    if (err) { results.errors.push({ row: i + 2, error: err }); continue; }

    try {
      if (mode === 'overwrite') {
        const [dup] = await pool.query('SELECT id FROM symbols WHERE category=? AND code=?', [mapped.category, mapped.code]);
        if (dup.length) {
          await pool.query(
            `UPDATE symbols SET name=?, avg_price=?, high_theory=?, low_theory=?,
               base_return=?, base_risk=?, warn_high=?, warn_low=?, note=?, updated_at=datetime('now','localtime')
             WHERE category=? AND code=?`,
            [mapped.name, mapped.avg_price, mapped.high_theory, mapped.low_theory,
             mapped.base_return || 0, mapped.base_risk || 0, mapped.warn_high || null, mapped.warn_low || null, mapped.note || '',
             mapped.category, mapped.code],
          );
        } else {
          await pool.query(
            `INSERT INTO symbols (name, code, category, avg_price, high_theory, low_theory,
               base_return, base_risk, warn_high, warn_low, note)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [mapped.name, mapped.code, mapped.category, mapped.avg_price, mapped.high_theory, mapped.low_theory,
             mapped.base_return || 0, mapped.base_risk || 0, mapped.warn_high || null, mapped.warn_low || null, mapped.note || ''],
          );
        }
      } else {
        const [dup] = await pool.query('SELECT id FROM symbols WHERE category=? AND code=?', [mapped.category, mapped.code]);
        if (dup.length) { results.skipped++; continue; }
        await pool.query(
          `INSERT INTO symbols (name, code, category, avg_price, high_theory, low_theory,
             base_return, base_risk, warn_high, warn_low, note)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [mapped.name, mapped.code, mapped.category, mapped.avg_price, mapped.high_theory, mapped.low_theory,
           mapped.base_return || 0, mapped.base_risk || 0, mapped.warn_high || null, mapped.warn_low || null, mapped.note || ''],
        );
      }
      results.success++;
    } catch (e) {
      results.errors.push({ row: i + 2, error: e.message });
    }
  }

  res.json(results);
}));

module.exports = router;
