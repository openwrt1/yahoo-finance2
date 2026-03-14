# Yahoo Finance Proxy API 测试指南

本文档用于测试部署在 `64.69.34.176` 上的 Yahoo Finance 代理服务接口。
**基础 URL:** `http://64.69.34.176:3007`

---

## 核心调试命令

`deno run -A --node-modules-dir=false my-server.ts`

---

## 1. 公司深度分析 (Analysis)

获取公司的基本面、市值、市盈率、财务摘要及财报日历。

- **测试地址 (AAPL):** http://64.69.34.176:3007/analysis/AAPL
- **接口路径:** `/analysis/:symbol`
- **包含数据:**
  - `price`: 实时价格、公司全称、交易所信息。
  - `assetProfile`: 行业、板块、员工人数、公司简介。
  - `summaryDetail`: 市值、市盈率 (PE)、股息率、52周高低点。
  - `defaultKeyStatistics`: 利润率、ROE、企业价值 (EV)。
  - `financialData`: 目标价、营收增长、现金流、推荐评级。
  - `calendarEvents`: 下次财报发布日期。

---

## 2. 历史财报数据 (Earnings)

获取过去几个季度的每股收益 (EPS) 和 营收 (Revenue) 实际值与预测值。

- **测试地址 (TSLA):** http://64.69.34.176:3007/earnings/TSLA
- **接口路径:** `/earnings/:symbol`
- **包含数据:**
  - `date`: 财报截止日期。
  - `epsActual` / `epsEstimate`: 实际 EPS 与 预测 EPS。
  - `revenueActual`: 实际季度营收。
  - `quarter`: 对应季度。

---

## 3. 同业推荐 (Peers)

获取与指定股票业务相似的其他公司代码列表。

- **测试地址 (NVDA):** http://64.69.34.176:3007/peers/NVDA
- **接口路径:** `/peers/:symbol`
- **返回数据:** 字符串数组，例如 `["AMD", "AVGO", "INTC", ...]`。

---

## 5. 实时行情与图表

- **实时报价 (Quote):** http://64.69.34.176:3007/quote/AAPL
- **历史价格 (Historical):** http://64.69.34.176:3007/historical/TSLA
- **K线图原始数据 (Chart):** http://64.69.34.176:3007/chart/NVDA

---

## 6. 搜索与发现

- **全局搜索 (Search):** 搜索 "Bitcoin" `http://64.69.34.176:3007/search/Bitcoin`
- **自动补全 (Autoc):** 输入 "App" `http://64.69.34.176:3007/autoc/App`
- **地区热搜 (Trending):** 美国热搜 `http://64.69.34.176:3007/trending/US`

---

## 7. 衍生品与深度洞察

- **期权链 (Options - 默认最近到期):** http://64.69.34.176:3007/options/AAPL
- **期权链 (Options - 指定日期):** http://64.69.34.176:3007/options/AAPL?date=2025-03-21
- **市场洞察 (Insights):** http://64.69.34.176:3007/insights/MSFT
- **原始财务序列:** http://64.69.34.176:3007/fundamentals/GOOG

---

## 8. 市场排行榜

- **今日涨幅榜:** http://64.69.34.176:3007/daily-gainers
- **今日跌幅榜:** http://64.69.34.176:3007/daily-losers

## 9. 财务摘要完整模块 (quoteSummary)

这是最强大的接口，支持通过 `modules` 参数获取指定的子模块数据（支持多个模块逗号分隔）。

- **接口路径:** `/quote-summary/:symbol?modules=module1,module2`
- **盈利趋势测试 (TSLA):** http://64.69.34.176:3007/quote-summary/TSLA?modules=earningsTrend
- **财务报表测试 (TSLA):** http://64.69.34.176:3007/quote-summary/TSLA?modules=balanceSheetHistory,cashflowStatementHistory
- **全量预测数据 (TSLA):** http://64.69.34.176:3007/quote-summary/TSLA?modules=earningsTrend,earningsHistory,financialData

- **未来财报日期与发布时间 (TSLA):** http://64.69.34.176:3007/quote-summary/TSLA?modules=calendarEvents

- **回报率对比 (YTD/1y/3y/5y - 以 SPY 为例):** http://64.69.34.176:3007/quote-summary/SPY?modules=fundPerformance
- **公司业务简介与行业 (AAPL):** http://64.69.34.176:3007/quote-summary/AAPL?modules=assetProfile
- **个股关键统计与回报 (TSLA 1年涨幅):** http://64.69.34.176:3007/quote-summary/TSLA?modules=defaultKeyStatistics
- **做空人数统计 (TSLA):** http://64.69.34.176:3007/short-interest/TSLA

**可用子模块 (Modules) 分类列表:**

- **盈利与预测:**
  - `earningsTrend`: 盈利趋势（分析师预测、EPS 趋势）。
  - `earnings`: 历史盈利数据。
  - `earningsHistory`: 季度盈利历史（实际 vs 预测）。
  - `financialData`: 财务核心指标（目标价、营收增长、现金流等）。
- **财务报表:**
  - `fundPerformance`: 历史回报率（YTD, 1y, 3y, 5y trailing returns）。
  - 年度: `incomeStatementHistory`, `balanceSheetHistory`, `cashflowStatementHistory`
  - 季度: `incomeStatementHistoryQuarterly`, `balanceSheetHistoryQuarterly`, `cashflowStatementHistoryQuarterly`
- **持仓与股东:**
  - `majorHoldersBreakdown`, `insiderHolders`, `insiderTransactions`, `institutionOwnership`, `fundOwnership`.
- **公司概况与统计:**
  - `assetProfile` (简介), `defaultKeyStatistics` (关键统计), `summaryDetail` (摘要详情), `price` (价格), `quoteType` (类型).
- **趋势与评级:**
  - `recommendationTrend` (推荐趋势), `upgradeDowngradeHistory` (评级调整历史), `indexTrend`, `sectorTrend`.

> **提示 - 如何看盘前/盘后:**
>
> 1. 访问上面的 **未来财报日期** 链接。
> 2. 在 `calendarEvents.earnings.earningsDate` 中查看第一个时间戳。
> 3. 将该时间戳转换为美东时间：
>    - 若在 09:30 AM 之前，即为 **盘前 (BMO)**。
>    - 若在 04:00 PM 之后，即为 **盘后 (AMC)**。

---

## 4. 选股器 (Screener)

获取市场热门列表，如涨幅榜、最活跃股票、核心资产等。

- **今日涨幅榜:** http://64.69.34.176:3007/screener?scrIds=day_gainers
- **今日跌幅榜:** http://64.69.34.176:3007/screener?scrIds=day_losers
- **最活跃股票:** http://64.69.34.176:3007/screener?scrIds=most_actives
- **低估值增长股:** http://64.69.34.176:3007/screener?scrIds=undervalued_growth_stocks
- **核心资产 (Mutual Funds):** http://64.69.34.176:3007/screener?scrIds=portfolio_anchors
- **高收益债券基金:** http://64.69.34.176:3007/screener?scrIds=high_yield_bond
- **接口路径:** `/screener`
- **可选参数:**
  - `scrIds`: 选股器 ID (可选: `day_gainers`, `most_actives`, `undervalued_growth_stocks`, `portfolio_anchors` 等)。
  - `count`: 返回数量 (默认 25)。

---

## 10. 股票图标 (Logo)

获取股票或公司的图标/头像 URL。该接口会优先尝试从 Yahoo 搜索结果中提取，如果不存在，则通过公司官网域名结合 Clearbit 服务生成。

- **测试地址 (AAPL):** http://64.69.34.176:3007/logo/AAPL
- **测试地址 (TSLA):** http://64.69.34.176:3007/logo/TSLA
- **接口路径:** `/logo/:symbol`
- **返回数据:** JSON 对象，包含 `url` 和 `source` (yahoo 或 clearbit)。

---

## 11. 盘前/盘后首笔价格 (Session Price)

获取指定日期盘前或盘后的第一笔成交价格。

- **VPS 测试地址 (AAPL 盘前):** http://64.69.34.176:3007/session-price/AAPL?date=2026-02-27&type=pre
- **本地测试地址 (AAPL 盘前):** http://localhost:3007/session-price/AAPL?date=2026-02-27&type=pre
- **本地测试地址 (AAPL 盘中开盘):** http://localhost:3007/session-price/AAPL?date=2026-02-27&type=regular
- **接口路径:** `/session-price/:symbol`
- **参数说明:**
  - `date`: 查询日期 (格式: YYYY-MM-DD)
  - `type`: 交易时段 (可选值: `pre` 盘前, `regular` 盘中, `post` 盘后)

---

## 12. 盘前/盘后全量数据 (Session All Data)

获取指定日期全天（盘前、盘中、盘后）的所有分钟级成交记录，按时段分类返回。

- **VPS 测试地址:** http://64.69.34.176:3007/session-all/AAPL?date=2026-02-27
- **本地测试地址:** http://localhost:3007/session-all/AAPL?date=2026-02-27
- **接口路径:** `/session-all/:symbol`
- **参数说明:**
  - `date`: 查询日期 (格式: YYYY-MM-DD)

---

## 13. 批量获取财报 (Bulk Calendar)

针对大量股票（如 250 个）优化的接口。使用雅虎批量行情接口，速度比单个请求快 50 倍以上。支持美股、港股、A股、加密货币等混合查询。

- **测试地址 (多品种混合):** http://64.69.34.176:3007/bulk-calendar?symbols=AAPL,TSLA,NVDA,FLY
- **接口路径:** `/bulk-calendar`
- **参数说明:**
  - `symbols`: 股票代码列表，用英文逗号分隔。
- **返回数据:** 包含 `symbol`, `quoteType`, `earningsTimestamp`, `earningsTimeCategory` (BMO盘前/AMC盘后), `marketState` 和 `displayName`。

> **提示:** 对于加密货币或 ETF，`earningsTimestamp` 会返回 `null`。

---

## 故障排查

1.  **连接超时/拒绝**: 请检查宝塔面板【安全】选项卡中是否放行了 `3007` 端口。
2.  **403 Forbidden**: 说明 Yahoo 识别到了 VPS 的 IP。由于我们已经配置了 `getCrumb` 隐身逻辑，通常重启服务即可解决：`pm2 restart yahoo-proxy-deno`。
3.  **数据缺失**: 部分小型股或刚上市的公司可能没有完整的 `analysis` 数据。

---

_Generated by Gemini Code Assist for openwrt1_
