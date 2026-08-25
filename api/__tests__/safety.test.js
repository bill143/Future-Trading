/**
 * @fileoverview Safety tests for the webhook trading layer.
 *
 * Run: node --test api/__tests__/safety.test.js
 *
 * The central test is COLD START: it proves kill-switch state set by one
 * lambda instance is visible to a different, freshly-imported instance. The
 * previous in-memory implementation fails this test, which is exactly why the
 * stop did not work in production.
 */

import test from "node:test";
import assert from "node:assert/strict";

process.env.ALLOW_MEMORY_STORE = "true";
process.env.WEBHOOK_SECRET = "test-secret";

import { resolveContract, productInfo, supportedProducts } from "../utils/contracts.js";
import * as store from "../utils/store.js";
import * as risk from "../utils/risk.js";

// ─────────────────────────────────────────────────────────────────────────────
// Contract resolution
// ─────────────────────────────────────────────────────────────────────────────

test("front month is computed, never a 2025 expiry", () => {
  const symbol = resolveContract("MNQ", new Date("2026-08-25T12:00:00Z"));
  assert.match(symbol, /^MNQ[HMUZ]\d$/, `unexpected symbol: ${symbol}`);
  assert.ok(!symbol.endsWith("5"), "must not resolve to a 2025 contract");
});

test("micro products Bill actually trades are all supported", () => {
  for (const root of ["MNQ", "MYM", "M2K", "MGC", "MES"]) {
    assert.ok(supportedProducts().includes(root), `${root} missing`);
    assert.equal(productInfo(root).micro, true, `${root} should be a micro`);
  }
});

test("equity index rolls to the next quarterly after the roll date", () => {
  const before = resolveContract("MNQ", new Date("2026-09-01T12:00:00Z"));
  const after = resolveContract("MNQ", new Date("2026-09-15T12:00:00Z"));
  assert.equal(before, "MNQU6", `expected Sep contract, got ${before}`);
  assert.equal(after, "MNQZ6", `expected Dec contract, got ${after}`);
});

test("gold uses its own cycle, not the quarterly one", () => {
  const gold = resolveContract("MGC", new Date("2026-08-25T12:00:00Z"));
  assert.match(gold, /^MGC[GJMQVZ]\d$/, `unexpected gold symbol: ${gold}`);
});

test("unknown products are rejected, not silently passed through", () => {
  assert.throws(() => resolveContract("BANANA"), /Unsupported product/);
});

test("env override pins a contract during roll week", () => {
  process.env.CONTRACT_MNQ = "MNQH7";
  assert.equal(resolveContract("MNQ"), "MNQH7");
  delete process.env.CONTRACT_MNQ;
});

// ─────────────────────────────────────────────────────────────────────────────
// Kill switch — the bug that mattered
// ─────────────────────────────────────────────────────────────────────────────

test("COLD START: kill state set in one instance is visible to another", async () => {
  const instanceA = await import("../utils/logger.js?cold=a");
  await instanceA.setKill("tradovate", true);

  const instanceB = await import("../utils/logger.js?cold=b");
  const killed = await instanceB.isKilled("tradovate");

  assert.equal(killed, true,
    "kill switch did not survive a cold start — trading would resume unstopped");

  await instanceA.setKill("tradovate", false);
  assert.equal(await instanceB.isKilled("tradovate"), false);
});

test("kill switch FAILS CLOSED when the store is unreachable", async () => {
  delete process.env.ALLOW_MEMORY_STORE;
  const logger = await import("../utils/logger.js?fc=1");
  const killed = await logger.isKilled("tradovate");
  assert.equal(killed, true,
    "an unreadable safety state must halt trading, not permit it");
  process.env.ALLOW_MEMORY_STORE = "true";
});

test("kill switch is per broker, not global", async () => {
  const logger = await import("../utils/logger.js?perbroker=1");
  await logger.setKill("tradovate", true);
  await logger.setKill("schwab", false);
  assert.equal(await logger.isKilled("tradovate"), true);
  assert.equal(await logger.isKilled("schwab"), false);
  await logger.setKill("all", false);
});

// ─────────────────────────────────────────────────────────────────────────────
// Idempotency
// ─────────────────────────────────────────────────────────────────────────────

test("a repeated signal id is only accepted once", async () => {
  store._resetMemory();
  const first = await store.setIfAbsent("idem:sig-1", "t0", 300);
  const second = await store.setIfAbsent("idem:sig-1", "t1", 300);
  assert.equal(first, true, "first sighting must be accepted");
  assert.equal(second, false, "duplicate must be rejected — one signal, one order");
});

// ─────────────────────────────────────────────────────────────────────────────
// Risk engine
// ─────────────────────────────────────────────────────────────────────────────

const MIDDAY = new Date("2026-08-25T15:00:00Z"); // 10:00 CT, inside the session

test("oversized orders are rejected", async () => {
  store._resetMemory();
  process.env.RISK_MAX_QTY_PER_ORDER = "3";
  const verdict = await risk.evaluate(
    { broker: "tradovate", action: "buy", ticker: "MNQ", qty: 10, orderType: "Market" },
    MIDDAY);
  assert.equal(verdict.allowed, false);
  assert.match(verdict.reason, /exceeds RISK_MAX_QTY_PER_ORDER/);
});

test("full-size contracts are blocked by default", async () => {
  store._resetMemory();
  const verdict = await risk.evaluate(
    { broker: "tradovate", action: "buy", ticker: "NQ", qty: 1, orderType: "Market" },
    MIDDAY);
  assert.equal(verdict.allowed, false);
  assert.match(verdict.reason, /full-size/);
});

test("a normal micro order inside the session is allowed", async () => {
  store._resetMemory();
  const verdict = await risk.evaluate(
    { broker: "tradovate", action: "buy", ticker: "MNQ", qty: 1, orderType: "Market" },
    MIDDAY);
  assert.equal(verdict.allowed, true, `unexpectedly rejected: ${verdict.reason}`);
});

test("entries are refused outside the session window", async () => {
  store._resetMemory();
  const preMarket = new Date("2026-08-25T10:00:00Z"); // 05:00 CT
  const verdict = await risk.evaluate(
    { broker: "tradovate", action: "buy", ticker: "MNQ", qty: 1, orderType: "Market" },
    preMarket);
  assert.equal(verdict.allowed, false);
  assert.match(verdict.reason, /entries not accepted before/);
});

test("close is still permitted after the flat-by time", async () => {
  store._resetMemory();
  const late = new Date("2026-08-25T21:30:00Z"); // 16:30 CT
  process.env.RISK_ENFORCE_SESSION = "false";
  const verdict = await risk.evaluate(
    { broker: "tradovate", action: "close", ticker: "MNQ", qty: 1, orderType: "Market" },
    late);
  assert.equal(verdict.allowed, true);
  process.env.RISK_ENFORCE_SESSION = "true";
});

test("the daily order cap halts further entries", async () => {
  store._resetMemory();
  process.env.RISK_MAX_ORDERS_PER_DAY = "2";
  const order = { broker: "tradovate", action: "buy", ticker: "MNQ", qty: 1, orderType: "Market" };

  assert.equal((await risk.evaluate(order, MIDDAY)).allowed, true);
  await risk.recordFill(order, MIDDAY);
  await risk.recordFill(order, MIDDAY);

  const blocked = await risk.evaluate(order, MIDDAY);
  assert.equal(blocked.allowed, false);
  assert.match(blocked.reason, /daily order cap reached/);
  process.env.RISK_MAX_ORDERS_PER_DAY = "40";
});

test("open exposure is capped", async () => {
  store._resetMemory();
  process.env.RISK_MAX_OPEN_CONTRACTS = "2";
  const order = { broker: "tradovate", action: "buy", ticker: "MNQ", qty: 2, orderType: "Market" };
  await risk.recordFill(order, MIDDAY);

  const blocked = await risk.evaluate(order, MIDDAY);
  assert.equal(blocked.allowed, false);
  assert.match(blocked.reason, /exceeds RISK_MAX_OPEN_CONTRACTS/);
  process.env.RISK_MAX_OPEN_CONTRACTS = "3";
});

test("risk engine FAILS CLOSED when the store is unreachable", async () => {
  delete process.env.ALLOW_MEMORY_STORE;
  const verdict = await risk.evaluate(
    { broker: "tradovate", action: "buy", ticker: "MNQ", qty: 1, orderType: "Market" },
    MIDDAY);
  assert.equal(verdict.allowed, false);
  assert.match(verdict.reason, /failing closed/);
  process.env.ALLOW_MEMORY_STORE = "true";
});

test("weekends are refused", async () => {
  store._resetMemory();
  const saturday = new Date("2026-08-29T15:00:00Z");
  const verdict = await risk.evaluate(
    { broker: "tradovate", action: "buy", ticker: "MNQ", qty: 1, orderType: "Market" },
    saturday);
  assert.equal(verdict.allowed, false);
  assert.match(verdict.reason, /weekend/);
});
