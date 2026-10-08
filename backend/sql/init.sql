-- PeakValleyLog 盯盘工具 数据库初始化脚本
-- MySQL 8.0+

CREATE DATABASE IF NOT EXISTS peakvalley_log
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE peakvalley_log;

-- 标的表
CREATE TABLE IF NOT EXISTS symbols (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(64)  NOT NULL COMMENT '标的名称',
  code            VARCHAR(32)  NOT NULL COMMENT '标的代码',
  category        ENUM('index', 'etf') NOT NULL DEFAULT 'etf' COMMENT '分类: index指数 / etf',
  avg_price       DECIMAL(12,4) NOT NULL COMMENT '近期均值',
  high_theory     DECIMAL(12,4) NOT NULL COMMENT '理论高点',
  low_theory      DECIMAL(12,4) NOT NULL COMMENT '理论低点',
  base_return     DECIMAL(8,4)  NOT NULL DEFAULT 0 COMMENT '基准收益(小数,如0.15=15%)',
  base_risk       DECIMAL(8,4)  NOT NULL DEFAULT 0 COMMENT '基准风险(小数)',
  warn_high       DECIMAL(12,4) DEFAULT NULL COMMENT '预警高点',
  warn_low        DECIMAL(12,4) DEFAULT NULL COMMENT '预警低点',
  current_price   DECIMAL(12,4) DEFAULT NULL COMMENT '实时点位',
  note            TEXT          DEFAULT NULL COMMENT '备注/交易思路',
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_category_code (category, code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='盯盘标的表';
