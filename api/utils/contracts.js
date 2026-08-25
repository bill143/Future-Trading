/**
 * @fileoverview CME futures contract resolution.
 *
 * Replaces the hardcoded { ES: "ESM5" } map, which pointed at June-2025
 * contracts and would fail every order placed after that expiry.
 *
 * Front-month is computed from the current date using each product's real
 * listing cycle and roll convention:
 *
 *   Equity index (ES/NQ/RTY/YM and micros) — quarterly H,M,U,Z.
 *     Roll on the 8th day before the third Friday of the contract month,
 *     which is the standard volume-migration point.
 *
 *   Gold (GC/MGC) — G,J,M,Q,V,Z. Roll at the end of the month preceding
 *     the contract month, when open interest moves.
 *
 * An explicit override is always available via env, e.g. CONTRACT_MNQ=MNQZ6,
 * for rollover weeks where you want to pin the contract by hand.
 */

/** CME month codes, index 0 = January. */
const MONTH_CODES = ["F", "G", "H", "J", "K", "M", "N", "Q", "U", "V", "X", "Z"];

/** Quarterly cycle used by all equity index futures (Mar, Jun, Sep, Dec). */
const QUARTERLY = [2, 5, 8, 11];

/** Gold cycle (Feb, Apr, Jun, Aug, Oct, Dec). */
const GOLD_CYCLE = [1, 3, 5, 7, 9, 11];

/**
 * Product definitions. `root` is the symbol prefix Tradovate expects.
 * `tickSize` and `pointValue` are used by the risk engine for exposure maths.
 *
 * @type {Record<string, {root: string, cycle: number[], roll: "index"|"gold", tickSize: number, pointValue: number, micro: boolean}>}
 */
const PRODUCTS = {
  // Full-size equity index
  ES:  { root: "ES",  cycle: QUARTERLY,  roll: "index", tickSize: 0.25, pointValue: 50,   micro: false },
  NQ:  { root: "NQ",  cycle: QUARTERLY,  roll: "index", tickSize: 0.25, pointValue: 20,   micro: false },
  RTY: { root: "RTY", cycle: QUARTERLY,  roll: "index", tickSize: 0.10, pointValue: 50,   micro: false },
  YM:  { root: "YM",  cycle: QUARTERLY,  roll: "index", tickSize: 1.0,  pointValue: 5,    micro: false },

  // Micro equity index — what Bill actually trades on a Topstep combine
  MES: { root: "MES", cycle: QUARTERLY,  roll: "index", tickSize: 0.25, pointValue: 5,    micro: true },
  MNQ: { root: "MNQ", cycle: QUARTERLY,  roll: "index", tickSize: 0.25, pointValue: 2,    micro: true },
  M2K: { root: "M2K", cycle: QUARTERLY,  roll: "index", tickSize: 0.10, pointValue: 5,    micro: true },
  MYM: { root: "MYM", cycle: QUARTERLY,  roll: "index", tickSize: 1.0,  pointValue: 0.5,  micro: true },

  // Metals
  GC:  { root: "GC",  cycle: GOLD_CYCLE, roll: "gold",  tickSize: 0.10, pointValue: 100,  micro: false },
  MGC: { root: "MGC", cycle: GOLD_CYCLE, roll: "gold",  tickSize: 0.10, pointValue: 10,   micro: true },
};

/**
 * Third Friday of a given month.
 *
 * @param {number} year
 * @param {number} month - 0-indexed.
 * @returns {Date} UTC date of the third Friday.
 */
function thirdFriday(year, month) {
  const first = new Date(Date.UTC(year, month, 1));
  // 5 = Friday. Offset to the first Friday, then add two weeks.
  const offset = (5 - first.getUTCDay() + 7) % 7;
  return new Date(Date.UTC(year, month, 1 + offset + 14));
}

/**
 * The date at which volume migrates off the given contract month.
 *
 * @param {number} year
 * @param {number} month - 0-indexed contract month.
 * @param {"index"|"gold"} convention
 * @returns {Date}
 */
function rollDate(year, month, convention) {
  if (convention === "gold") {
    // Roll at the end of the month before the contract month.
    return new Date(Date.UTC(year, month, 1) - 24 * 60 * 60 * 1000);
  }
  const friday = thirdFriday(year, month);
  return new Date(friday.getTime() - 8 * 24 * 60 * 60 * 1000);
}

/**
 * Resolve the active front-month contract symbol for a product.
 *
 * @param {string} ticker - Product root, e.g. "MNQ". Case-insensitive.
 * @param {Date}   [now]  - Reference date; defaults to the current time.
 * @returns {string} Tradovate contract symbol, e.g. "MNQZ6".
 * @throws {Error} If the ticker is not a supported product.
 */
function resolveContract(ticker, now = new Date()) {
  const key = String(ticker || "").toUpperCase();

  // Manual override wins — used to pin a contract during roll week.
  const override = process.env[`CONTRACT_${key}`];
  if (override) return override;

  const product = PRODUCTS[key];
  if (!product) {
    throw new Error(
      `Unsupported product: ${ticker}. Known: ${Object.keys(PRODUCTS).join(", ")}`
    );
  }

  // Walk forward from the current month until we find a contract that has
  // not yet passed its roll date.
  const year = now.getUTCFullYear();
  for (let step = 0; step < 24; step++) {
    const probe = new Date(Date.UTC(year, now.getUTCMonth() + step, 1));
    const py = probe.getUTCFullYear();
    const pm = probe.getUTCMonth();
    if (!product.cycle.includes(pm)) continue;
    if (now < rollDate(py, pm, product.roll)) {
      return `${product.root}${MONTH_CODES[pm]}${yearDigits(py)}`;
    }
  }
  throw new Error(`Could not resolve a front-month contract for ${key}`);
}

/**
 * Format the contract year. Tradovate uses a single digit by default;
 * set CONTRACT_YEAR_DIGITS=2 if your account expects "MNQZ26".
 *
 * @param {number} year
 * @returns {string}
 */
function yearDigits(year) {
  const digits = Number(process.env.CONTRACT_YEAR_DIGITS || 1);
  return digits === 2 ? String(year).slice(-2) : String(year).slice(-1);
}

/**
 * Contract metadata for a product, used by the risk engine.
 *
 * @param {string} ticker
 * @returns {{root: string, tickSize: number, pointValue: number, micro: boolean}}
 * @throws {Error} If the ticker is unsupported.
 */
function productInfo(ticker) {
  const key = String(ticker || "").toUpperCase();
  const product = PRODUCTS[key];
  if (!product) throw new Error(`Unsupported product: ${ticker}`);
  return {
    root: product.root,
    tickSize: product.tickSize,
    pointValue: product.pointValue,
    micro: product.micro,
  };
}

/**
 * @returns {string[]} Every supported product root.
 */
function supportedProducts() {
  return Object.keys(PRODUCTS);
}

export { resolveContract, productInfo, supportedProducts, PRODUCTS };
