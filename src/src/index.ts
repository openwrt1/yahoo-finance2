/**
 * @module YahooFinance
 */
import createYahooFinance, {
  type YahooFinanceWithModules,
} from "./createYahooFinance.js";
import * as modules from "./modules/index.js";
import * as other from "./other/index.js";

const allModules = { ...modules, ...other } as const;
const createOpts = { modules: allModules } as const;

/**
 * The full Yahoo Finance API client with all modules: `quote()`, `search()`, etc.
 *
 * @example
 * ```ts
 * import YahooFinance from "yahoo-finance2";
 *
 * const yahooFinance = new YahooFinance();
 * console.log(await yahooFinance.quote("AAPL"));
 * ```
 *
 * @see {@linkcode [createYahooFinance].YahooFinance YahooFinance} for instantiation options.
 * @see The full list of {@link [modules] main modules} and {@link [other] other modules}.
 * @see {@linkcode [createYahooFinance].createYahooFinance createYahooFinance} for creating an API client with custom modules (advanced use-cases only).
 */
const YahooFinance: YahooFinanceWithModules<typeof createOpts> =
  createYahooFinance(createOpts);

export default YahooFinance;
