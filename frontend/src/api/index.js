/**
 * 前端 API 封装
 */
import axios from 'axios';

const api = axios.create({
  baseURL: '', // Vite dev proxy 走 /api, 生产同域部署
  timeout: 15000,
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    console.error('[API Error]', err?.response?.data || err.message);
    return Promise.reject(err);
  },
);

export default {
  // 列表
  list(params = {}) {
    return api.get('/api/symbols', { params });
  },
  // 新增
  create(data) {
    return api.post('/api/symbols', data);
  },
  // 编辑
  update(id, data) {
    return api.put(`/api/symbols/${id}`, data);
  },
  // 删除
  remove(id) {
    return api.delete(`/api/symbols/${id}`);
  },
  // 一键更新: 拉取最新行情并覆盖近期均值, 触发衍生指标重算 (传 id 则只更新该条)
  refreshRecompute(id = null) {
    return api.post('/api/symbols/refresh-recompute', id ? { id } : {});
  },
  // 导出
  exportExcel() {
    return api.get('/api/symbols/export/excel', { responseType: 'blob' });
  },
  // 导入
  importExcel(rows, mode = 'append') {
    return api.post('/api/symbols/import/excel', { rows, mode });
  },
};
