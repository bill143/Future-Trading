/**
 * @fileoverview POST /api/webhook — TradingView alert ingestion endpoint.
 *
 * Validates the incoming JSON payload, checks the per-broker kill switch,
 * routes the order to the correct broker module, logs the result, and
 * returns a structured JSON response.
 *
 * Expected request body:
 * {
 *   secret:    string,               // must match WEBHOOK_SECRET env var
 *   broker:    "tradovate"|"schwab", // target broker
 *   action:    "buy"|"sell"|"close", // trade direction
 *   ticker:    string,               // instrument symbol
 *   qty:       number,               // order quantity
 *   orderType: "Market"|"Limit",     // order type
 *   price:     number,               // limit price (required for Limit orders)
 *   comment:   string                // optional free-text annotation
 * }
 */

import { placeOrder as tradovatePlaceOrder, closePosition } from "./brokers/tradovate.js";
import { placeOrder as schwabPlaceOrder } from "./brokers/schwab.js";
import { logTrade, getKill } from "./utils/logger.js";

/**
 * Vercel Serverless Function handler for POST /api/webhook.
 *
 * @param {import("@vercel/node").VercelRequest}  req
 * @param {import("@vercel/node").VercelResponse} res
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ status: "error", message: "Method Not Allowed" });
  }

  const timestamp = new Date().toISOString();

  // ── 1. Parse body ──────────────────────────────────────────────────────────
  let payload;
  try {
    payload = typeof req.body === "object" ? req.body : JSON.parse(req.body);
  } catch {
    return res.status(400).json({ status: "error", message: "Invalid JSON body" });
  }

  const { secret, broker, action, ticker, qty, orderType, price, comment } = payload ?? {};

  // ── 2. Validate secret ─────────────────────────────────────────────────────
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    logTrade({ timestamp, broker, action, ticker, qty, orderType, status: "rejected", error: "Unauthorized", comment });
    return res.status(401).json({ status: "error", message: "Unauthorized" });
  }

  // ── 3. Validate required fields ────────────────────────────────────────────
  if (!broker || !action || !ticker || qty == null || !orderType) {
    return res.status(400).json({
      status: "error",
      message: "Missing required fields: broker, action, ticker, qty, orderType",
    });
  }

  if (!["tradovate", "schwab"].includes(broker)) {
    return res.status(400).json({ status: "error", message: `Unknown broker: ${broker}` });
  }

  if (!["buy", "sell", "close"].includes(action)) {
    return res.status(400).json({ status: "error", message: `Unknown action: ${action}` });
  }

  // ── 4. Kill-switch check ───────────────────────────────────────────────────
  if (getKill(broker)) {
    logTrade({ timestamp, broker, action, ticker, qty, orderType, status: "killed", comment });
    return res.status(503).json({ status: "error", message: `Kill switch active for broker: ${broker}` });
  }

  // ── 5. Route to broker ─────────────────────────────────────────────────────
  try {
    let orderId;

    if (broker === "tradovate") {
      if (action === "close") {
        orderId = await closePosition(ticker);
      } else {
        orderId = await tradovatePlaceOrder(action, ticker, qty, orderType, price);
      }
    } else if (broker === "schwab") {
      // Schwab does not expose a closePosition shortcut; map close → sell.
      const effectiveAction = action === "close" ? "sell" : action;
      orderId = await schwabPlaceOrder(effectiveAction, ticker, qty, orderType, price);
    }

    logTrade({ timestamp, broker, action, ticker, qty, orderType, status: "ok", orderId, comment });

    return res.status(200).json({ status: "ok", orderId, broker, ticker, action });
  } catch (err) {
    logTrade({
      timestamp,
      broker,
      action,
      ticker,
      qty,
      orderType,
      status: "error",
      error: err.message,
      comment,
    });

    return res.status(500).json({ status: "error", message: err.message });
  }
}
