/**
 * @fileoverview GET /api/health — Service health check endpoint.
 *
 * No authentication required. Returns broker availability and demo-mode flag.
 *
 * Response: { status: "ok", timestamp, brokers, demo }
 */

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

  return res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    brokers: ["tradovate", "schwab"],
    demo: process.env.TRADOVATE_DEMO === "true",
  });
}
