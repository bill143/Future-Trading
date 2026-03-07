/**
 * @fileoverview POST /api/kill — Activate or deactivate a broker kill switch.
 *
 * Request body:
 * {
 *   secret: string,                         // WEBHOOK_SECRET
 *   broker: "all"|"tradovate"|"schwab",     // target broker(s)
 *   action: "kill"|"resume"                 // desired state
 * }
 *
 * Response: { status: "ok", killSwitch: { tradovate: boolean, schwab: boolean } }
 */

import { setKill, getKill } from "./utils/logger.js";

/**
 * Vercel Serverless Function handler for POST /api/kill.
 *
 * @param {import("@vercel/node").VercelRequest}  req
 * @param {import("@vercel/node").VercelResponse} res
 */
export default async function handler(req, res) {
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

  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ status: "error", message: "Unauthorized" });
  }

  if (!["all", "tradovate", "schwab"].includes(broker)) {
    return res.status(400).json({ status: "error", message: `Unknown broker: ${broker}` });
  }

  if (!["kill", "resume"].includes(action)) {
    return res.status(400).json({ status: "error", message: `Unknown action: ${action}. Use "kill" or "resume"` });
  }

  setKill(broker, action === "kill");

  return res.status(200).json({
    status: "ok",
    killSwitch: {
      tradovate: getKill("tradovate"),
      schwab: getKill("schwab"),
    },
  });
}
