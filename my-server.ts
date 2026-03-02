import express from "express";
import cors from "cors";
// 直接从本地源码入口导入
import YahooFinance from "./src/index.ts";
import { ExtendedCookieJar } from "./src/lib/cookieJar.ts";
// 使用 deno.json 中定义的别名，去掉 npm: 前缀以符合 lint 规则
import FileCookieStorePkg from "tough-cookie-file-store";
import { existsSync, writeFileSync } from "node:fs";

// 基础配置
const fetchOptions = {
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  },
  // 如果需要强制走代理，可以在这里添加（Deno fetch 支持）
  // client: {
  //   proxy: "http://127.0.0.1:7890"
  // }
};

// 设置 Cookie 持久化存储
const cookiePath = "./cookies.json";

// 修正: 检查文件是否存在，不存在则创建，防止 FileCookieStore 报错
if (!existsSync(cookiePath)) {
  try {
    writeFileSync(cookiePath, "{}");
    console.log("Created empty cookies.json");
  } catch (err) {
    console.error("Failed to create cookies.json:", err);
  }
}

// 兼容 CJS 模块的导出格式
const FileCookieStore =
  FileCookieStorePkg.FileCookieStore ||
  FileCookieStorePkg.default ||
  FileCookieStorePkg;

const cookieJar = new ExtendedCookieJar(
  new (FileCookieStore as any)(cookiePath),
);
// 实例化。注意：直接导入源码时，YahooFinance 就是类本身
const yahooFinance = new YahooFinance({
  cookieJar,
  suppressNotices: ["yahooSurvey"],
  fetchOptions,
  // 建议添加队列配置，降低被封 IP 的概率
  queue: { concurrency: 1 },
  // 开启调试模式：提供一个自定义 logger 来捕获并打印 debug 信息
  logger: {
    info: (...args: unknown[]) => console.log(...args),
    warn: (...args: unknown[]) => console.warn(...args),
    error: (...args: unknown[]) => console.error(...args),
    debug: (...args: unknown[]) => console.log("[DEBUG]", ...args),
    dir: (obj: unknown) => console.dir(obj, { depth: null }),
  },
});

const app = express();
const PORT = 3007;

app.use(cors());

// --- 你的接口代码开始 ---

// 接口 1: 获取历史财报
app.get("/earnings/:symbol", async (req, res) => {
  const { symbol } = req.params;
  try {
    const quoteResult = await yahooFinance.quoteSummary(symbol, {
      modules: ["earningsHistory"],
    });
    const epsHistory = quoteResult.earningsHistory?.history || [];

    let financials = [];
    try {
      financials = await yahooFinance.fundamentalsTimeSeries(symbol, {
        period1: "2020-01-01",
        module: "financials",
        type: "quarterly",
      });
    } catch (_err) {
      console.warn(`Warning: Failed to fetch revenue for ${symbol}`);
    }

    const revenueMap = new Map();
    financials.forEach((item) => {
      if (item.date && item.totalRevenue) {
        const date = new Date(item.date);
        const key = `${date.getFullYear()}-${date.getMonth()}`;
        revenueMap.set(key, item.totalRevenue);
      }
    });

    const combined = epsHistory.map((epsItem) => {
      // 确保日期有效，防止 new Date(null) 产生 1970 年的数据
      const epsDate = epsItem.quarter ? new Date(epsItem.quarter) : new Date(0);
      const key = `${epsDate.getFullYear()}-${epsDate.getMonth()}`;
      const revenue = revenueMap.get(key) || null;
      return {
        date: epsItem.quarter
          ? epsItem.quarter.toISOString().split("T")[0]
          : null,
        year: epsDate.getFullYear(),
        quarter: Math.floor(epsDate.getMonth() / 3) + 1,
        epsActual: epsItem.epsActual,
        epsEstimate: epsItem.epsEstimate,
        revenueActual: revenue,
      };
    });

    combined.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
    res.json(combined);
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: String(error) });
    }
  }
});

// 接口 3: 获取公司深度分析
app.get("/analysis/:symbol", async (req, res) => {
  const { symbol } = req.params;
  try {
    const result = await yahooFinance.quoteSummary(symbol, {
      modules: [
        "price",
        "assetProfile",
        "summaryDetail",
        "defaultKeyStatistics",
        "financialData",
        "calendarEvents",
      ],
    });
    res.json(result);
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: String(error) });
    }
  }
});

// 接口 4: 获取同业/推荐股票
app.get("/peers/:symbol", async (req, res) => {
  const { symbol } = req.params;
  try {
    const result = await yahooFinance.recommendationsBySymbol(symbol);
    const recommendedSymbols = result.recommendedSymbols || [];
    res.json(recommendedSymbols.map((r) => r.symbol));
  } catch (_error) {
    res.json([]);
  }
});

// 接口 5: 获取选股器数据
app.get("/screener", async (req, res) => {
  const { scrIds, count } = req.query;
  try {
    const result = await yahooFinance.screener(
      {
        scrIds: (scrIds as string | string[]) || "day_gainers",
        count: count ? parseInt(count as string) : 25,
        region: "US",
        lang: "en-US",
      },
      undefined,
      { validateResult: false },
    );
    res.json(result);
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: String(error) });
    }
  }
});

// 接口 6: 实时报价 (Quote) - 获取最精简的实时价格数据
app.get("/quote/:symbol", async (req, res) => {
  try {
    const result = await yahooFinance.quote(req.params.symbol);
    res.json(result);
  } catch (error) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// 接口 7: 历史价格 (Historical) - 默认获取最近一个月
app.get("/historical/:symbol", async (req, res) => {
  try {
    const result = await yahooFinance.historical(req.params.symbol, {
      period1: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
    });
    res.json(result);
  } catch (error) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// 接口 8: K线图数据 (Chart) - 用于绘制图表
app.get("/chart/:symbol", async (req, res) => {
  try {
    const result = await yahooFinance.chart(req.params.symbol, {
      interval: "1d",
      period1: "2024-01-01",
    });
    res.json(result);
  } catch (error) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// 辅助函数：统一处理交易时段逻辑
const getTs = (val: any) =>
  (val instanceof Date ? val.getTime() : val * 1000) / 1000;

const findSessionByDate = (sessionArray: any[][], targetDate: string) => {
  if (!sessionArray) return null;
  return sessionArray.flat().find((s) => {
    const startDateObj =
      s.start instanceof Date ? s.start : new Date(s.start * 1000);
    const sDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(startDateObj);
    return sDate === targetDate;
  });
};

const formatToET = (val: any) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    dateStyle: "short",
    timeStyle: "medium",
  }).format(val instanceof Date ? val : new Date(val * 1000));

// 接口 20: 获取指定日期盘前或盘后的第一个价格
app.get("/session-price/:symbol", async (req, res) => {
  const { symbol } = req.params;
  const { date, type } = req.query; // type: 'pre' 或 'post'

  if (
    !date ||
    !type ||
    (type !== "pre" && type !== "post" && type !== "regular")
  ) {
    return res.status(400).json({
      error:
        "缺少参数。请提供 date (YYYY-MM-DD) 和 type ('pre', 'regular' 或 'post')",
    });
  }

  try {
    const startDate = new Date(`${date}T00:00:00Z`); // UTC 零点作为基准

    // 扩大查询范围到 48 小时，确保能抓到美东时间那一整天的所有 Session
    const period1 = new Date(startDate.getTime() - 12 * 60 * 60 * 1000); // 往前推 12 小时
    const period2 = new Date(startDate.getTime() + 36 * 60 * 60 * 1000); // 往后推 36 小时

    // 获取 1 分钟粒度数据，必须包含盘前盘后
    const result = await yahooFinance.chart(symbol, {
      period1,
      period2,
      interval: "1m",
      includePrePost: true,
    });

    // 调试代码：在控制台打印 Yahoo Finance 返回的完整原始数据
    // console.log(`\n[DEBUG] === Raw Chart Data for ${symbol} on ${date} ===`);
    // console.dir(result, { depth: null });

    const { meta, quotes = [] } = result;
    const referencePrice = meta.chartPreviousClose || meta.previousClose;

    // 检查是否为非交易日（如周末）
    const dayOfWeek = startDate.getUTCDay(); // 0 是周日, 6 是周六
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    if (quotes.length === 0) {
      return res.json({
        symbol,
        date,
        referencePrice,
        message: isWeekend
          ? "市场周六/周日休市"
          : "该日期无交易数据（可能是节假日）",
        data: null,
      });
    }

    // 解析 Yahoo 返回的交易时段范围
    const periods = meta.tradingPeriods;
    let sessionRange;

    if (type === "pre")
      sessionRange = findSessionByDate(periods.pre, date as string);
    else if (type === "post")
      sessionRange = findSessionByDate(periods.post, date as string);
    else if (type === "regular")
      sessionRange = findSessionByDate(periods.regular, date as string);

    if (!sessionRange) {
      return res.json({
        symbol,
        date,
        sessionType: type,
        referencePrice,
        data: null,
        message: `该日期没有 ${type} 交易时段。注意：对于未来的日期（如 2026 年），Yahoo 可能尚未提供交易时段计划。`,
      });
    }

    const sessionStartTs = getTs(sessionRange.start);
    const sessionEndTs = getTs(sessionRange.end);

    // 在 quotes 中寻找落在该时段内的第一个有效价格
    const firstQuote = quotes.find(
      (q) =>
        q.date.getTime() / 1000 >= sessionStartTs &&
        q.date.getTime() / 1000 < sessionEndTs &&
        q.close !== null,
    );

    res.json({
      symbol,
      date,
      sessionType: type,
      referencePrice, // 始终返回上一个交易时段的收盘价作为参考
      data: firstQuote || null,
      message: firstQuote
        ? "查询成功"
        : `该时段内无成交记录。为您提供上一个交易时段的收盘价(Reference Price)作为参考: ${referencePrice}`,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// 接口 21: 获取指定日期盘前或盘后的全量成交数据 (用于数据审计)
app.get("/session-all/:symbol", async (req, res) => {
  const { symbol } = req.params;
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({ error: "请提供 date (YYYY-MM-DD)" });
  }

  try {
    const startDate = new Date(`${date}T00:00:00Z`);

    // 扩大查询范围确保覆盖美东时间全天
    const period1 = new Date(startDate.getTime() - 12 * 60 * 60 * 1000);
    const period2 = new Date(startDate.getTime() + 36 * 60 * 60 * 1000);

    // 获取 1 分钟粒度数据
    const result = await yahooFinance.chart(symbol, {
      period1,
      period2,
      interval: "1m",
      includePrePost: true,
    });

    // 调试代码：为 session-all 接口增加原始数据打印
    console.log(
      `\n[DEBUG] === Raw ALL Session Data for ${symbol} on ${date} ===`,
    );
    console.dir(result, { depth: null });

    const { meta, quotes = [] } = result;
    const referencePrice = meta.chartPreviousClose || meta.previousClose;
    const periods = meta.tradingPeriods as any;

    // 内部辅助函数：根据类型过滤数据
    const getCategorizedData = (sessionType: "pre" | "regular" | "post") => {
      const sessionRange = findSessionByDate(
        periods?.[sessionType],
        date as string,
      );
      if (!sessionRange) {
        return { range: null, count: 0, quotes: [] };
      }

      const sessionStartTs = getTs(sessionRange.start);
      const sessionEndTs = getTs(sessionRange.end);

      const filtered = quotes.filter((q) => {
        const ts = q.date.getTime() / 1000;
        return ts >= sessionStartTs && ts < sessionEndTs;
      });

      return {
        range: {
          ...sessionRange,
          localStart: formatToET(sessionRange.start),
          localEnd: formatToET(sessionRange.end),
        },
        count: filtered.length,
        quotes: filtered,
      };
    };

    const pre = getCategorizedData("pre");
    const regular = getCategorizedData("regular");
    const post = getCategorizedData("post");

    res.json({
      symbol,
      date,
      referencePrice,
      pre,
      regular,
      post,
      message:
        pre.count + regular.count + post.count > 0
          ? "查询成功"
          : `该日期无成交记录。参考价: ${referencePrice}`,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// 接口 22: 批量获取未来财报日期 (优化版)
// 针对大量股票（如 250 个）的场景，使用雅虎的批量 quote 接口
// 这样可以将 250 次 HTTP 请求缩减为 5 次左右，极大提高前端加载速度并减少后端压力
app.get("/bulk-calendar", async (req, res) => {
  const { symbols } = req.query;
  if (!symbols) {
    return res.status(400).json({ error: "请提供 symbols 参数，用逗号分隔" });
  }

  const symbolList = (symbols as string)
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => s.length > 0);

  if (symbolList.length === 0) {
    return res.json([]);
  }

  try {
    const chunkSize = 50; // 雅虎 API 建议单次批量请求不超过 50-100 个
    const allResults = [];

    for (let i = 0; i < symbolList.length; i += chunkSize) {
      const chunk = symbolList.slice(i, i + chunkSize);
      // 使用 quote 接口支持批量查询，且包含财报时间戳
      const quoteResults = await yahooFinance.quote(chunk);
      const normalized = Array.isArray(quoteResults)
        ? quoteResults
        : [quoteResults];

      allResults.push(
        ...normalized
          .filter((q) => q && q.symbol)
          .map((q) => {
            // 自动判断盘前盘后逻辑
            let earningsTimeCategory = null;
            if (q.earningsTimestamp) {
              const hour = parseInt(
                new Intl.DateTimeFormat("en-US", {
                  timeZone: q.exchangeTimezoneName || "America/New_York",
                  hour: "numeric",
                  hour12: false,
                }).format(q.earningsTimestamp),
              );

              if (hour < 12)
                earningsTimeCategory = "BMO"; // Before Market Open (盘前)
              else if (hour >= 16) earningsTimeCategory = "AMC"; // After Market Close (盘后)
            }

            return {
              symbol: q.symbol,
              quoteType: q.quoteType,
              // 新增：格式化后的当地时间字符串，方便前端直接显示
              earningsTimeFormatted: q.earningsTimestamp
                ? new Intl.DateTimeFormat("en-US", {
                    timeZone: q.exchangeTimezoneName || "America/New_York",
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  }).format(q.earningsTimestamp)
                : null,
              earningsTimestamp: q.earningsTimestamp || null,
              earningsTimeCategory, // 新增：BMO (盘前) 或 AMC (盘后)
              earningsTimestampStart: q.earningsTimestampStart || null,
              earningsTimestampEnd: q.earningsTimestampEnd || null,
              marketState: q.marketState,
              displayName:
                q.displayName || q.shortName || q.longName || q.symbol,
            };
          }),
      );
    }

    res.json(allResults);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// 接口 9: 全局搜索 (Search) - 搜索股票、基金、新闻
app.get("/search/:query", async (req, res) => {
  try {
    const result = await yahooFinance.search(req.params.query);
    res.json(result);
  } catch (error) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// 接口 10: 自动补全 (Autoc) - 输入关键词自动提示代码
app.get("/autoc/:query", async (req, res) => {
  try {
    const result = await yahooFinance.autoc(req.params.query);
    res.json(result);
  } catch (error) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// 接口 11: 地区热搜 (Trending) - 看看某个国家大家都在搜什么
app.get("/trending/:region", async (req, res) => {
  try {
    const result = await yahooFinance.trendingSymbols(
      req.params.region || "US",
    );
    res.json(result);
  } catch (error) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// 接口 12: 期权链 (Options)
app.get("/options/:symbol", async (req, res) => {
  const { symbol } = req.params;
  const { date } = req.query;
  try {
    const queryOptions: any = {};
    if (date) {
      // 优先判断是否为纯数字时间戳（秒或毫秒）
      if (/^\d+$/.test(date as string)) {
        queryOptions.date = Number(date);
      } else {
        // 修正：确保日期字符串被解析为 UTC 时间，避免时区偏差导致 Yahoo 忽略参数
        const dateStr = date as string;
        // 如果已经是 ISO 格式则直接解析，否则拼接 T00:00:00Z 强制 UTC
        queryOptions.date = dateStr.includes("T")
          ? new Date(dateStr)
          : new Date(`${dateStr}T00:00:00Z`);
      }
    }
    const result = await yahooFinance.options(symbol, queryOptions);
    res.json(result);
  } catch (error) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// 接口 13: 市场洞察 (Insights) - 包含技术分析和评级
app.get("/insights/:symbol", async (req, res) => {
  try {
    const result = await yahooFinance.insights(req.params.symbol);
    res.json(result);
  } catch (error) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// 接口 14: 每日涨幅榜 (Daily Gainers)
app.get("/daily-gainers", async (_req, res) => {
  try {
    const result = await yahooFinance.screener(
      { scrIds: "day_gainers", count: 10, region: "US", lang: "en-US" },
      undefined,
      { validateResult: false },
    );
    res.json(result);
  } catch (error) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// 接口 15: 每日跌幅榜 (Daily Losers)
app.get("/daily-losers", async (_req, res) => {
  try {
    const result = await yahooFinance.screener(
      { scrIds: "day_losers", count: 10, region: "US", lang: "en-US" },
      undefined,
      { validateResult: false },
    );
    res.json(result);
  } catch (error) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// 接口 16: 财务时间序列 (Fundamentals Time Series)
app.get("/fundamentals/:symbol", async (req, res) => {
  try {
    const result = await yahooFinance.fundamentalsTimeSeries(
      req.params.symbol,
      {
        period1: "2023-01-01",
        type: "quarterly",
        module: "all",
      },
    );
    res.json(result);
  } catch (error) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// 接口 17: 通用财务摘要 (quoteSummary) - 支持所有子模块
app.get(
  ["/quoteSummary/:symbol", "/quote-summary/:symbol"],
  async (req, res) => {
    const { symbol } = req.params;
    const { modules, formatted } = req.query;

    try {
      const queryOptions: any = {};

      // 如果提供了 modules 参数，则按逗号分割成数组；如果是 "all" 则直接传递
      if (modules) {
        queryOptions.modules =
          modules === "all" ? "all" : (modules as string).split(",");
      }

      if (formatted) {
        queryOptions.formatted = formatted === "true";
      }

      const result = await yahooFinance.quoteSummary(symbol, queryOptions);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
);

// 接口 18: 做空数据分析 (Short Interest) - 当前统计 + 历史趋势
app.get("/short-interest/:symbol", async (req, res) => {
  const { symbol } = req.params;
  try {
    // 获取当前做空统计 (来自 quoteSummary，这是最可靠的数据源)
    const summary = await yahooFinance.quoteSummary(symbol, {
      modules: ["defaultKeyStatistics"],
      formatted: true, // 开启格式化，获取易读的字符串
    });

    const current = {
      sharesShort: summary.defaultKeyStatistics?.sharesShort, // 原始数值或带单位的字符串
      shortRatio: summary.defaultKeyStatistics?.shortRatio, // 补空天数
      shortPercentOfFloat: summary.defaultKeyStatistics?.shortPercentOfFloat, // 做空比例
      date:
        summary.defaultKeyStatistics?.dateShortInterest
          ?.toISOString()
          .split("T")[0] || null,
    };

    // 注意：由于 yahoo-finance2 库的验证限制，历史做空序列暂时无法通过 fundamentalsTimeSeries 获取。
    // 我们仅返回当前最准确的做空数据。
    res.json({ symbol, current, history: [] });
  } catch (error) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// 接口 19: 获取股票图标 (Logo/Avatar)
app.get("/logo/:symbol", async (req, res) => {
  const { symbol } = req.params;
  try {
    // 1. 尝试从 search 结果中获取 (Yahoo API 有时在某些区域会返回 logoUrl)
    const searchResult = await yahooFinance.search(symbol);
    const quote = searchResult.quotes.find(
      (q) => q.symbol === symbol.toUpperCase(),
    );

    if (quote && (quote as any).logoUrl) {
      return res.json({ url: (quote as any).logoUrl, source: "yahoo" });
    }

    // 2. 备选方案：通过 assetProfile 获取官网域名，使用第三方服务 (如 Clearbit)
    const summary = await yahooFinance.quoteSummary(symbol, {
      modules: ["assetProfile"],
    });
    const website = summary.assetProfile?.website;

    if (website) {
      const domain = new URL(website).hostname.replace("www.", "");
      return res.json({
        url: `https://logo.clearbit.com/${domain}`,
        source: "clearbit",
      });
    }

    res.status(404).json({ error: "Logo not found" });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// --- 你的接口代码结束 ---

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Yahoo Proxy Server (Source Mode) running on http://0.0.0.0:${PORT}`,
  );
});
