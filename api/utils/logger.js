/**
 * @fileoverview Durable trade log and kill switch.
 *
 * Every function here is async and backed by the durable store. The previous
 * synchronous, in-memory API is intentionally gone — a synchronous getKill()
 * cannot be correct on serverless, and keeping the signature would have
 * invited the same bug back.
 */

import * as store from "./store.js";

const KILL_KEY = (broker) => `kill:${broker}`;
const TRADE_LOG_KEY = "trades:recent";
const TRADE_LOG_CAP = 200;

/**
 * Log a trade event to durable storage.
 * Never throws — a logging failure must not abort an in-flight order.
 *
 * @param {{timestamp?: string, broker: string, action: string, ticker: string,
 *          contract?: string, qty: number, orderType: string, status: string,
 *          orderId?: string|number, error?: string, comment?: string}} entry
 * @returns {Promise<void>}
 */
async function logTrade(entry) {
  const record = {
    timestamp: entry.timestamp || new Date().toISOString(),
    broker: entry.broker ?? null,
    action: entry.action ?? null,
    ticker: entry.ticker ?? null,
    contract: entry.contract ?? null,
    qty: entry.qty ?? null,
    orderType: entry.orderType ?? null,
    status: entry.status,
    orderId: entry.orderId ?? null,
    error: entry.error ?? null,
    comment: entry.comment ?? null,
  };
  try {
    await store.pushCapped(TRADE_LOG_KEY, record, TRADE_LOG_CAP);
  } catch (err) {
    console.error("[logger] trade log write failed:", err.message, record);
  }
}

/**
 * @param {number} [limit=200]
 * @returns {Promise<Object[]>} Recent trade records, newest first.
 */
async function getTrades(limit = TRADE_LOG_CAP) {
  return store.readList(TRADE_LOG_KEY, limit);
}

/**
 * Set a broker's kill switch.
 *
 * @param {"tradovate"|"schwab"|"all"} broker
 * @param {boolean} killed
 * @returns {Promise<void>}
 * @throws {Error} If the write fails — the caller must surface this, because a
 *                 kill command that silently failed is a safety incident.
 */
async function setKill(broker, killed) {
  const targets = broker === "all" ? ["tradovate", "schwab"] : [broker];
  for (const target of targets) {
    await store.set(KILL_KEY(target), killed ? "1" : "0");
  }
}

/**
 * Read a broker's kill state.
 *
 * FAILS CLOSED: any store error returns true (trading halted). An unknown
 * safety state must never permit an order.
 *
 * @param {"tradovate"|"schwab"} broker
 * @returns {Promise<boolean>} True when trading is halted.
 */
async function isKilled(broker) {
  try {
    const value = await store.get(KILL_KEY(broker));
    return value === "1";
  } catch (err) {
    console.error(
      `[logger] kill-switch read failed for ${broker}, failing CLOSED:`,
      err.message
    );
    return true;
  }
}

/**
 * Read both kill switches for status display.
 *
 * @returns {Promise<{tradovate: boolean, schwab: boolean}>}
 */
async function killState() {
  return {
    tradovate: await isKilled("tradovate"),
    schwab: await isKilled("schwab"),
  };
}

export { logTrade, getTrades, setKill, isKilled, killState };
