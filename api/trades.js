/**
 * @fileoverview GET /api/trades — Return recent trade log entries.
 *
 * Query parameter:
 *   secret  string  Must match WEBHOOK_SECRET env var.
 *
 * Response: { status: "ok", trades: [...] }
 */

import { getTrades } from "./utils/logger.js";

/**
 * Vercel Serverless Function handler for GET /api/trades.
 *
 * @param {import("@vercel/node").VercelRequest}  req
 * @param {import("@vercel/node").VercelResponse} res
 */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ status: "error", message: "Method Not Allowed" });
  }

  const { secret } = req.query ?? {};

  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ status: "error", message: "Unauthorized" });
  }

  return res.status(200).json({ status: "ok", trades: getTrades() });
}
