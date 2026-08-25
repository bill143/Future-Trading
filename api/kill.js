/**
 * @fileoverview POST /api/kill — activate or deactivate a broker kill switch.
 *
 * The write goes to durable storage and is READ BACK before responding. A kill
 * command that silently failed to persist is a safety incident, so this
 * endpoint returns 500 rather than reporting success it has not verified.
 *
 * Request body: { secret, broker: "all"|"tradovate"|"schwab", action: "kill"|"resume" }
 * Response:     { status, killSwitch: { tradovate, schwab }, verified }
 *
 * GET returns the current state without changing it.
 */

import { timingSafeEqual } from "node:crypto";

import { setKill, killState } from "./utils/logger.js";

/**
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
 * Vercel Serverless Function handler for /api/kill.
 *
 * @param {import("@vercel/node").VercelRequest}  req
 * @param {import("@vercel/node").VercelResponse} res
 */
export default async function handler(req, res) {
  if (!process.env.WEBHOOK_SECRET) {
    return res.status(503).json({ status: "error", message: "Endpoint not configured" });
  }

  // ── Read-only status ─────────────────────────────────────────────────────
  if (req.method === "GET") {
    const provided = req.query?.secret ?? req.headers["x-webhook-secret"];
    if (!secretMatches(provided, process.env.WEBHOOK_SECRET)) {
      return res.status(401).json({ status: "error", message: "Unauthorized" });
    }
    return res.status(200).json({ status: "ok", killSwitch: await killState() });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ status: "error", message: "Method Not Allowed" });
  }

  let payload;
  try {
    payload = typeof req.body === "object" ? req.body : JSON.parse(req.body);
  } catch {
    return res.status(400).json({ status: "error", message: "Invalid JSON body" });
  }

  const { secret, broker, action } = payload ?? {};

  if (!secretMatches(secret, process.env.WEBHOOK_SECRET)) {
    return res.status(401).json({ status: "error", message: "Unauthorized" });
  }
  if (!["all", "tradovate", "schwab"].includes(broker)) {
    return res.status(400).json({ status: "error", message: `Unknown broker: ${broker}` });
  }
  if (!["kill", "resume"].includes(action)) {
    return res.status(400).json({
      status: "error", message: `Unknown action: ${action}. Use "kill" or "resume"`,
    });
  }

  const desired = action === "kill";

  try {
    await setKill(broker, desired);
  } catch (err) {
    console.error("[kill] write failed:", err.message);
    return res.status(500).json({
      status: "error",
      message: `Kill switch write FAILED — state unchanged: ${err.message}`,
    });
  }

  // Verify the write actually landed. Trading halts on an unreadable state
  // anyway (isKilled fails closed), but a "resume" that silently failed would
  // leave the operator believing trading is live when it is not.
  const state = await killState();
  const targets = broker === "all" ? ["tradovate", "schwab"] : [broker];
  const verified = targets.every((t) => state[t] === desired);

  if (!verified) {
    return res.status(500).json({
      status: "error",
      message: "Kill switch write could not be verified after read-back",
      killSwitch: state,
      verified: false,
    });
  }

  return res.status(200).json({ status: "ok", killSwitch: state, verified: true });
}
