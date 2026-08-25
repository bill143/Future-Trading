/**
 * @fileoverview POST /api/webhook — trading signal ingestion endpoint.
 *
 * Pipeline, in order. Every stage can reject; nothing reaches a broker until
 * all of them pass.
 *
 *   1. Method + JSON parse
 *   2. Shared-secret authentication (timing-safe)
 *   3. Payload validation
 *   4. Idempotency — a repeated signalId inside the TTL is a no-op
 *   5. Kill switch (fails closed)
 *   6. Risk engine (fails closed)
 *   7. Contract resolution — front month computed, never hardcoded
 *   8. Broker dispatch
 *   9. Durable logging + risk accounting
 *
 * Expected request body:
 * {
 *   secret:    string,                // WEBHOOK_SECRET
 *   broker:    "tradovate"|"schwab",
 *   action:    "buy"|"sell"|"close",
 *   ticker:    string,                // product root, e.g. "MNQ"
 *   qty:       number,
 *   orderType: "Market"|"Limit",
 *   price:     number,                // required for Limit
 *   signalId:  string,                // optional; enables idempotency
 *   comment:   string
 * }
 */

import { timingSafeEqual } from "node:crypto";

import { placeOrder as tradovatePlaceOrder, closePosition } from "./brokers/tradovate.js";
import { placeOrder as schwabPlaceOrder } from "./brokers/schwab.js";
import { logTrade, isKilled } from "./utils/logger.js";
import { resolveContract } from "./utils/contracts.js";
import * as risk from "./utils/risk.js";
import * as store from "./utils/store.js";

/** Idempotency window — a duplicate signalId within this many seconds is dropped. */
const IDEMPOTENCY_TTL_SECONDS = 300;

/**
 * Constant-time secret comparison, so the endpoint does not leak the secret
 * through response timing.
 *
 * @param {string} provided
 * @param {string} expected
 * @returns {boolean}
 */
function secretMatches(provided, expected) {
  if (typeof provided !== "string" || typeof expected !== "string") return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

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

  // ── 1. Parse ─────────────────────────────────────────────────────────────
  let payload;
  try {
    payload = typeof req.body === "object" ? req.body : JSON.parse(req.body);
  } catch {
    return res.status(400).json({ status: "error", message: "Invalid JSON body" });
  }

  const { secret, broker, action, ticker, qty, orderType, price, comment, signalId } =
    payload ?? {};

  // ── 2. Authenticate ──────────────────────────────────────────────────────
  if (!process.env.WEBHOOK_SECRET) {
    console.error("[webhook] WEBHOOK_SECRET is not set — refusing all requests");
    return res.status(503).json({ status: "error", message: "Endpoint not configured" });
  }
  if (!secretMatches(secret, process.env.WEBHOOK_SECRET)) {
    await logTrade({ timestamp, broker, action, ticker, qty, orderType,
                     status: "rejected", error: "Unauthorized", comment });
    return res.status(401).json({ status: "error", message: "Unauthorized" });
  }

  // ── 3. Validate ──────────────────────────────────────────────────────────
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
  if (orderType === "Limit" && (price == null || !Number.isFinite(Number(price)))) {
    return res.status(400).json({ status: "error", message: "Limit orders require a numeric price" });
  }

  // ── 4. Idempotency ───────────────────────────────────────────────────────
  // TradingView retries and double-fires are routine. Without this, one signal
  // becomes two positions.
  if (signalId) {
    try {
      const first = await store.setIfAbsent(
        `idem:${signalId}`, timestamp, IDEMPOTENCY_TTL_SECONDS);
      if (!first) {
        await logTrade({ timestamp, broker, action, ticker, qty, orderType,
                         status: "duplicate", comment });
        return res.status(200).json({
          status: "ok", duplicate: true, signalId,
          message: "Signal already processed; no order placed",
        });
      }
    } catch (err) {
      await logTrade({ timestamp, broker, action, ticker, qty, orderType,
                       status: "rejected", error: `idempotency store: ${err.message}`, comment });
      return res.status(503).json({
        status: "error",
        message: "Idempotency store unreachable; refusing to risk a duplicate order",
      });
    }
  }

  // ── 5. Kill switch (fails closed) ────────────────────────────────────────
  if (await isKilled(broker)) {
    await logTrade({ timestamp, broker, action, ticker, qty, orderType,
                     status: "killed", comment });
    return res.status(503).json({
      status: "error", message: `Kill switch active for broker: ${broker}`,
    });
  }

  // ── 6. Risk engine (fails closed) ────────────────────────────────────────
  const verdict = await risk.evaluate({ broker, action, ticker, qty, orderType });
  if (!verdict.allowed) {
    await logTrade({ timestamp, broker, action, ticker, qty, orderType,
                     status: "risk_rejected", error: verdict.reason, comment });
    return res.status(403).json({
      status: "error", message: `Risk rejected: ${verdict.reason}`, checks: verdict.checks,
    });
  }

  // ── 7. Resolve contract ──────────────────────────────────────────────────
  let contract;
  try {
    contract = resolveContract(ticker);
  } catch (err) {
    await logTrade({ timestamp, broker, action, ticker, qty, orderType,
                     status: "rejected", error: err.message, comment });
    return res.status(400).json({ status: "error", message: err.message });
  }

  // ── 8. Dispatch ──────────────────────────────────────────────────────────
  try {
    let orderId;
    if (broker === "tradovate") {
      orderId = action === "close"
        ? await closePosition(contract)
        : await tradovatePlaceOrder(action, contract, qty, orderType, price);
    } else {
      const effectiveAction = action === "close" ? "sell" : action;
      orderId = await schwabPlaceOrder(effectiveAction, ticker, qty, orderType, price);
    }

    // ── 9. Account for it ──────────────────────────────────────────────────
    await risk.recordFill({ action, ticker, qty });
    await logTrade({ timestamp, broker, action, ticker, contract, qty, orderType,
                     status: "ok", orderId, comment });

    return res.status(200).json({
      status: "ok", orderId, broker, ticker, contract, action, qty,
    });
  } catch (err) {
    await logTrade({ timestamp, broker, action, ticker, contract, qty, orderType,
                     status: "error", error: err.message, comment });
    return res.status(500).json({ status: "error", message: err.message });
  }
}
