/**
 * @fileoverview GET /api/health — service health check.
 *
 * Unauthenticated and deliberately non-sensitive: it reports whether the
 * durable store is reachable, whether the kill switches are engaged, and which
 * contracts would be used right now. No credentials or account data.
 *
 * The `ready` flag is the one to watch. It is false whenever the store is
 * unreachable, because in that state every order is refused by design.
 */

import * as store from "./utils/store.js";
import { killState } from "./utils/logger.js";
import { resolveContract, supportedProducts } from "./utils/contracts.js";
import * as risk from "./utils/risk.js";

/**
 * Vercel Serverless Function handler for GET /api/health.
 *
 * @param {import("@vercel/node").VercelRequest}  req
 * @param {import("@vercel/node").VercelResponse} res
 */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ status: "error", message: "Method Not Allowed" });
  }

  const storeHealth = await store.health();

  let kill = null;
  try {
    kill = await killState();
  } catch (err) {
    kill = { error: err.message };
  }

  const contracts = {};
  for (const root of supportedProducts()) {
    try {
      contracts[root] = resolveContract(root);
    } catch (err) {
      contracts[root] = `error: ${err.message}`;
    }
  }

  let riskStatus = null;
  try {
    riskStatus = await risk.status();
  } catch (err) {
    riskStatus = { error: err.message };
  }

  const ready = storeHealth.ok && !!process.env.WEBHOOK_SECRET;

  return res.status(ready ? 200 : 503).json({
    status: ready ? "ok" : "degraded",
    ready,
    timestamp: new Date().toISOString(),
    brokers: ["tradovate", "schwab"],
    demo: process.env.TRADOVATE_DEMO === "true",
    secretConfigured: !!process.env.WEBHOOK_SECRET,
    store: storeHealth,
    killSwitch: kill,
    risk: riskStatus,
    contracts,
  });
}
