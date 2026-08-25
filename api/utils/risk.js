/**
 * @fileoverview Pre-trade risk engine. Fails closed.
 *
 * Enforces the account constraints a prop-firm evaluation imposes, before any
 * order reaches a broker. Every check returns a structured verdict rather than
 * throwing, so a rejection is logged with a reason instead of surfacing as a
 * 500.
 *
 * Design invariant: if a limit cannot be evaluated — store unreachable, clock
 * unavailable, product unknown — the order is REJECTED. Permitting an order
 * whose risk is unknown is the failure mode this module exists to prevent.
 *
 * Configuration (env):
 *   RISK_MAX_QTY_PER_ORDER   default 3    contracts in a single order
 *   RISK_MAX_OPEN_CONTRACTS  default 3    net contracts across all orders
 *   RISK_MAX_ORDERS_PER_DAY  default 40   order count per trading day
 *   RISK_ALLOW_FULL_SIZE     default false  block ES/NQ/GC, permit micros only
 *   RISK_SESSION_START       default 08:30  CT, entries not accepted before
 *   RISK_SESSION_END         default 15:00  CT, entries not accepted after
 *   RISK_FLAT_BY             default 15:55  CT, only "close" accepted after
 *   RISK_ENFORCE_SESSION     default true
 */

import * as store from "./store.js";
import { productInfo } from "./contracts.js";

const CT_TIMEZONE = "America/Chicago";

/**
 * @returns {{maxQtyPerOrder: number, maxOpenContracts: number,
 *            maxOrdersPerDay: number, allowFullSize: boolean,
 *            sessionStart: string, sessionEnd: string, flatBy: string,
 *            enforceSession: boolean}}
 */
function config() {
  return {
    maxQtyPerOrder: Number(process.env.RISK_MAX_QTY_PER_ORDER || 3),
    maxOpenContracts: Number(process.env.RISK_MAX_OPEN_CONTRACTS || 3),
    maxOrdersPerDay: Number(process.env.RISK_MAX_ORDERS_PER_DAY || 40),
    allowFullSize: process.env.RISK_ALLOW_FULL_SIZE === "true",
    sessionStart: process.env.RISK_SESSION_START || "08:30",
    sessionEnd: process.env.RISK_SESSION_END || "15:00",
    flatBy: process.env.RISK_FLAT_BY || "15:55",
    enforceSession: process.env.RISK_ENFORCE_SESSION !== "false",
  };
}

/**
 * Current wall-clock time in Central, as { day, minutes, key }.
 *
 * @param {Date} [now]
 * @returns {{day: number, minutes: number, key: string}}
 */
function centralNow(now = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: CT_TIMEZONE,
    weekday: "short", hour: "2-digit", minute: "2-digit",
    year: "numeric", month: "2-digit", day: "2-digit", hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  const dayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  return {
    day: dayIndex,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    key: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

/**
 * @param {string} hhmm - "HH:MM"
 * @returns {number} Minutes since midnight.
 */
function toMinutes(hhmm) {
  const [h, m] = String(hhmm).split(":").map(Number);
  return h * 60 + (m || 0);
}

/**
 * Evaluate an order against every risk rule.
 *
 * @param {{broker: string, action: "buy"|"sell"|"close", ticker: string,
 *          qty: number, orderType: string}} order
 * @param {Date} [now]
 * @returns {Promise<{allowed: boolean, reason?: string, checks: Object}>}
 */
async function evaluate(order, now = new Date()) {
  const cfg = config();
  const checks = {};

  // ── Product must be known ────────────────────────────────────────────────
  let info;
  try {
    info = productInfo(order.ticker);
    checks.product = info.root;
  } catch (err) {
    return { allowed: false, reason: `unknown product: ${order.ticker}`, checks };
  }

  // ── Full-size guard ──────────────────────────────────────────────────────
  if (!info.micro && !cfg.allowFullSize) {
    return {
      allowed: false,
      reason: `full-size ${info.root} blocked; set RISK_ALLOW_FULL_SIZE=true to permit`,
      checks,
    };
  }
  checks.micro = info.micro;

  // ── Quantity ─────────────────────────────────────────────────────────────
  const qty = Number(order.qty);
  if (!Number.isFinite(qty) || qty <= 0 || !Number.isInteger(qty)) {
    return { allowed: false, reason: `invalid qty: ${order.qty}`, checks };
  }
  if (qty > cfg.maxQtyPerOrder) {
    return {
      allowed: false,
      reason: `qty ${qty} exceeds RISK_MAX_QTY_PER_ORDER (${cfg.maxQtyPerOrder})`,
      checks,
    };
  }
  checks.qty = qty;

  // ── Session window ───────────────────────────────────────────────────────
  const ct = centralNow(now);
  checks.centralMinutes = ct.minutes;
  checks.tradingDay = ct.key;

  if (cfg.enforceSession) {
    if (ct.day === 0 || ct.day === 6) {
      return { allowed: false, reason: "market closed (weekend)", checks };
    }
    const isEntry = order.action !== "close";
    if (isEntry && ct.minutes < toMinutes(cfg.sessionStart)) {
      return {
        allowed: false,
        reason: `entries not accepted before ${cfg.sessionStart} CT`,
        checks,
      };
    }
    if (isEntry && ct.minutes >= toMinutes(cfg.sessionEnd)) {
      return {
        allowed: false,
        reason: `entries not accepted after ${cfg.sessionEnd} CT`,
        checks,
      };
    }
    if (isEntry && ct.minutes >= toMinutes(cfg.flatBy)) {
      return {
        allowed: false,
        reason: `flat-by ${cfg.flatBy} CT reached; only close is accepted`,
        checks,
      };
    }
  }

  // ── Daily order count ────────────────────────────────────────────────────
  // Counters live in the durable store. A store failure rejects the order.
  try {
    const countKey = `risk:orders:${ct.key}`;
    const used = Number((await store.get(countKey)) ?? 0);
    checks.ordersToday = used;
    if (used >= cfg.maxOrdersPerDay) {
      return {
        allowed: false,
        reason: `daily order cap reached (${used}/${cfg.maxOrdersPerDay})`,
        checks,
      };
    }
  } catch (err) {
    return {
      allowed: false,
      reason: `risk store unreachable, failing closed: ${err.message}`,
      checks,
    };
  }

  // ── Open contract exposure ───────────────────────────────────────────────
  try {
    const openKey = `risk:open:${info.root}`;
    const open = Number((await store.get(openKey)) ?? 0);
    checks.openContracts = open;
    if (order.action !== "close" && Math.abs(open) + qty > cfg.maxOpenContracts) {
      return {
        allowed: false,
        reason: `open exposure ${Math.abs(open)} + ${qty} exceeds RISK_MAX_OPEN_CONTRACTS (${cfg.maxOpenContracts})`,
        checks,
      };
    }
  } catch (err) {
    return {
      allowed: false,
      reason: `risk store unreachable, failing closed: ${err.message}`,
      checks,
    };
  }

  return { allowed: true, checks };
}

/**
 * Record a filled order against the daily counters.
 * Best-effort — never throws, because the order already exists at the broker
 * and an accounting failure must not mask that.
 *
 * @param {{action: string, ticker: string, qty: number}} order
 * @param {Date} [now]
 * @returns {Promise<void>}
 */
async function recordFill(order, now = new Date()) {
  const ct = centralNow(now);
  try {
    await store.increment(`risk:orders:${ct.key}`, 36 * 60 * 60);

    const info = productInfo(order.ticker);
    const openKey = `risk:open:${info.root}`;
    const current = Number((await store.get(openKey)) ?? 0);

    let next;
    if (order.action === "close") next = 0;
    else if (order.action === "buy") next = current + Number(order.qty);
    else next = current - Number(order.qty);

    await store.set(openKey, String(next));
  } catch (err) {
    console.error("[risk] fill accounting failed:", err.message);
  }
}

/**
 * Current risk posture, for the health endpoint.
 *
 * @param {Date} [now]
 * @returns {Promise<Object>}
 */
async function status(now = new Date()) {
  const cfg = config();
  const ct = centralNow(now);
  const out = { config: cfg, tradingDay: ct.key, centralMinutes: ct.minutes };
  try {
    out.ordersToday = Number((await store.get(`risk:orders:${ct.key}`)) ?? 0);
  } catch (err) {
    out.ordersToday = null;
    out.storeError = err.message;
  }
  return out;
}

export { evaluate, recordFill, status, config, centralNow };
