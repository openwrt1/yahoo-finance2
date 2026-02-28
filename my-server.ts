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
  try {
    const result = await yahooFinance.options(req.params.symbol);
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

// --- 你的接口代码结束 ---

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Yahoo Proxy Server (Source Mode) running on http://0.0.0.0:${PORT}`,
  );
});
