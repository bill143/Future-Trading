/**
 * @fileoverview In-memory trade logger and kill-switch manager.
 * Stores up to 100 recent trades and provides per-broker kill switches.
 */

/** @type {Array<Object>} Circular buffer of recent trade log entries (max 100) */
const recentTrades = [];

/** @type {{ tradovate: boolean, schwab: boolean }} Per-broker kill switch state */
const killSwitch = {
  tradovate: false,
  schwab: false,
};

/**
 * Log a trade event. Oldest entry is dropped when the buffer exceeds 100 items.
 *
 * @param {{ timestamp?: string, broker: string, action: string, ticker: string,
 *           qty: number, orderType: string, status: string, orderId?: string|number,
 *           error?: string, comment?: string }} entry
 */
function logTrade(entry) {
  const record = {
    timestamp: entry.timestamp || new Date().toISOString(),
    broker: entry.broker,
    action: entry.action,
    ticker: entry.ticker,
    qty: entry.qty,
    orderType: entry.orderType,
    status: entry.status,
    orderId: entry.orderId ?? null,
    error: entry.error ?? null,
    comment: entry.comment ?? null,
  };

  if (recentTrades.length >= 100) {
    recentTrades.shift();
  }
  recentTrades.push(record);
}

/**
 * Return a snapshot of all recent trade log entries.
 *
 * @returns {Array<Object>}
 */
function getTrades() {
  return [...recentTrades];
}

/**
 * Activate or deactivate a broker's kill switch.
 *
 * @param {"tradovate"|"schwab"|"all"} broker - Broker name, or "all" for every broker.
 * @param {boolean} value - true to kill (halt trading), false to resume.
 */
function setKill(broker, value) {
  if (broker === "all") {
    killSwitch.tradovate = value;
    killSwitch.schwab = value;
  } else if (broker in killSwitch) {
    killSwitch[broker] = value;
  }
}

/**
 * Return the current kill-switch state for a broker.
 *
 * @param {"tradovate"|"schwab"} broker
 * @returns {boolean}
 */
function getKill(broker) {
  return killSwitch[broker] ?? false;
}

export { logTrade, getTrades, setKill, getKill };
