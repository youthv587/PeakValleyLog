/**
 * PeakValleyLog 盯盘工具 后端入口
 */
const express = require('express');
const cors = require('cors');
const symbolsRouter = require('./routes/symbols');

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// 健康检查
app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// 标的路由 —— 每个路由内部 try/catch 保护，DB 不可用时返回 500 友好提示
app.use('/api/symbols', symbolsRouter);

// 全局错误处理 (兜底)
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// 防止未捕获的 Promise 崩溃进程
process.on('unhandledRejection', (err) => {
  console.error('[FATAL] Unhandled rejection:', err?.message || err);
});

app.listen(PORT, () => {
  console.log(`[PeakValleyLog] Backend running on http://localhost:${PORT}`);
});
