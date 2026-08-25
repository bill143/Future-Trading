/**
 * @fileoverview Regression proof for the serverless kill-switch defect.
 *
 * Loads the ORIGINAL in-memory logger (preserved at fixtures/logger.legacy.js)
 * and demonstrates that kill state does not survive a cold start. This test is
 * expected to show the failure — it exists so the bug can never be dismissed
 * as theoretical, and so a future refactor back to module-level state is
 * caught immediately.
 *
 * Run: node --test api/__tests__/legacy-killswitch.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

test("LEGACY: in-memory kill switch does NOT survive a cold start", async () => {
  const instanceA = await import("./fixtures/logger.legacy.js?legacy=a");
  instanceA.setKill("tradovate", true);
  assert.equal(instanceA.getKill("tradovate"), true,
    "same instance sees the kill — this is what made the bug invisible locally");

  // A separate module instance stands in for a second lambda invocation.
  const instanceB = await import("./fixtures/logger.legacy.js?legacy=b");
  const seenByColdInstance = instanceB.getKill("tradovate");

  assert.equal(seenByColdInstance, false,
    "if this ever passes, the legacy fixture changed");

  // Stated plainly: the cold instance would have permitted the order.
  assert.notEqual(seenByColdInstance, instanceA.getKill("tradovate"),
    "kill state diverges across instances — the stop was never real");
});

test("LEGACY: in-memory trade log is also lost across instances", async () => {
  const instanceA = await import("./fixtures/logger.legacy.js?log=a");
  instanceA.logTrade({ broker: "tradovate", action: "buy", ticker: "NQ",
                       qty: 1, orderType: "Market", status: "ok" });
  assert.equal(instanceA.getTrades().length, 1);

  const instanceB = await import("./fixtures/logger.legacy.js?log=b");
  assert.equal(instanceB.getTrades().length, 0,
    "audit trail does not exist across invocations");
});
