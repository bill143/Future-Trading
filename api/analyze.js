/**
 * @fileoverview GET|POST /api/analyze — LangChain multi-agent trading analysis endpoint.
 *
 * GET  /api/analyze?symbol=ES&timeframe=1h
 *   Returns a full multi-agent analysis without executing any trade.
 *
 * POST /api/analyze
 *   Body: { secret, symbol, timeframe, autoTrade, broker, qty, orderType }
 *   Runs analysis and, if ANALYSIS_ENABLED and confidence >= threshold,
 *   optionally forwards the signal to /api/webhook for execution.
 *
 * The analysis is performed by calling the Python analysis module via a
 * child_process.spawn() call.  If Python / the analysis module is not
 * available the endpoint returns a 503 with a clear error message.
 */

import { spawn } from "child_process";
import { logTrade } from "./utils/logger.js";

/** How long (ms) to wait for the Python analysis process before timing out. */
const ANALYSIS_TIMEOUT_MS = Number(process.env.ANALYSIS_TIMEOUT_MS) || 120_000;

/** Minimum confidence score required before auto-forwarding to /api/webhook. */
const AUTO_TRADE_MIN_CONFIDENCE = Number(process.env.AUTO_TRADE_MIN_CONFIDENCE) || 0.65;

/**
 * Run the Python analysis module as a subprocess.
 *
 * @param {string} symbol    - Futures short code (ES, NQ, YM …)
 * @param {string} timeframe - Bar timeframe (1m, 5m, 15m, 30m, 1h, 4h, 1d)
 * @param {object} [opts]    - Optional overrides { provider, model, bars }
 * @returns {Promise<object>} Parsed analysis result JSON.
 */
function runPythonAnalysis(symbol, timeframe, opts = {}) {
  return new Promise((resolve, reject) => {
    const args = [
      "-m", "analysis.main",
      "--symbol", symbol,
      "--timeframe", timeframe,
      "--output", "json",
    ];

    if (opts.bars)     args.push("--bars",     String(opts.bars));
    if (opts.provider) args.push("--provider", opts.provider);
    if (opts.model)    args.push("--model",    opts.model);
    if (opts.skipFundamental) args.push("--skip-fundamental");
    if (opts.skipSentiment)   args.push("--skip-sentiment");

    // Resolve working directory to repo root so `analysis` package is importable
    const cwd = process.cwd();

    const child = spawn("python3", args, {
      cwd,
      env: { ...process.env },
      timeout: ANALYSIS_TIMEOUT_MS,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

    child.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(`Python process exited with code ${code}:\n${stderr}`));
      }
      try {
        // Extract the last JSON object from stdout (log lines may precede it)
        const lastBrace = stdout.lastIndexOf("{");
        if (lastBrace === -1) {
          return reject(new Error(`No JSON found in Python output:\n${stdout}`));
        }
        resolve(JSON.parse(stdout.slice(lastBrace)));
      } catch (err) {
        reject(new Error(`Failed to parse Python output as JSON: ${err.message}\n${stdout}`));
      }
    });

    child.on("error", (err) => {
      reject(new Error(`Failed to spawn Python process: ${err.message}`));
    });
  });
}

/**
 * Vercel Serverless Function handler for /api/analyze.
 *
 * @param {import("@vercel/node").VercelRequest}  req
 * @param {import("@vercel/node").VercelResponse} res
 */
export default async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) {
    return res.status(405).json({ status: "error", message: "Method Not Allowed" });
  }

  const analysisEnabled = process.env.ANALYSIS_ENABLED !== "false";
  if (!analysisEnabled) {
    return res.status(503).json({
      status: "error",
      message: "Analysis layer is disabled (ANALYSIS_ENABLED=false)",
    });
  }

  // ── Parse parameters ─────────────────────────────────────────────────────
  let symbol, timeframe, secret, autoTrade, broker, qty, orderType, opts;

  if (req.method === "GET") {
    const q     = req.query || {};
    symbol      = q.symbol     || "ES";
    timeframe   = q.timeframe  || "1h";
    opts = {
      bars:            q.bars ? Number(q.bars) : undefined,
      provider:        q.provider,
      model:           q.model,
      skipFundamental: q.skipFundamental === "true",
      skipSentiment:   q.skipSentiment   === "true",
    };
  } else {
    let body;
    try {
      body = typeof req.body === "object" ? req.body : JSON.parse(req.body);
    } catch {
      return res.status(400).json({ status: "error", message: "Invalid JSON body" });
    }

    ({
      secret, symbol = "ES", timeframe = "1h",
      autoTrade, broker, qty, orderType,
    } = body ?? {});
    opts = {
      bars:            body?.bars,
      provider:        body?.provider,
      model:           body?.model,
      skipFundamental: body?.skipFundamental,
      skipSentiment:   body?.skipSentiment,
    };

    // Secret validation for POST requests that may trigger auto-trade
    if (autoTrade) {
      if (!secret || secret !== process.env.WEBHOOK_SECRET) {
        return res.status(401).json({ status: "error", message: "Unauthorized" });
      }
    }
  }

  const validTimeframes = ["1m","5m","15m","30m","1h","4h","1d"];
  if (!validTimeframes.includes(timeframe)) {
    return res.status(400).json({
      status: "error",
      message: `Invalid timeframe '${timeframe}'. Valid: ${validTimeframes.join(", ")}`,
    });
  }

  // ── Run analysis ──────────────────────────────────────────────────────────
  let analysis;
  try {
    analysis = await runPythonAnalysis(symbol, timeframe, opts);
  } catch (err) {
    return res.status(503).json({
      status: "error",
      message: `Analysis failed: ${err.message}`,
    });
  }

  // ── Optional auto-trade forwarding ────────────────────────────────────────
  if (autoTrade && broker && analysis) {
    const confidence = analysis.confidence ?? 0;
    const action     = analysis.trading_signal?.action;

    if (confidence >= AUTO_TRADE_MIN_CONFIDENCE && action && action !== "hold") {
      const entry     = analysis.trading_signal?.entry;
      const stopLoss  = analysis.trading_signal?.stop_loss;

      logTrade({
        timestamp: new Date().toISOString(),
        broker,
        action,
        ticker: symbol,
        qty: qty ?? 1,
        orderType: orderType ?? "Market",
        status: "analysis_signal",
        comment: `Auto from analysis | confidence=${confidence.toFixed(2)}`,
      });

      // Forward to webhook endpoint (same process – call the handler directly)
      // In production you may prefer an internal HTTP call or direct broker call.
      const forwardPayload = {
        secret: process.env.WEBHOOK_SECRET,
        broker,
        action,
        ticker: symbol,
        qty:    qty ?? 1,
        orderType: orderType ?? "Market",
        price:  entry,
        comment: `Analysis signal | confidence=${confidence.toFixed(2)} | stop=${stopLoss}`,
      };

      try {
        const { default: webhookHandler } = await import("./webhook.js");
        // Build minimal mock req/res objects for in-process call
        const mockReq = { method: "POST", body: forwardPayload };
        let webhookResult = null;
        let mockRes;
        mockRes = {
          status: (code) => ({
            json: (body) => { webhookResult = { code, body }; return mockRes; },
          }),
        };
        await webhookHandler(mockReq, mockRes);
        analysis._webhook = webhookResult;
      } catch (err) {
        analysis._webhook_error = err.message;
      }
    } else {
      analysis._auto_trade = {
        skipped: true,
        reason: confidence < AUTO_TRADE_MIN_CONFIDENCE
          ? `Confidence ${confidence.toFixed(2)} below threshold ${AUTO_TRADE_MIN_CONFIDENCE}`
          : `Action is '${action}' – no trade required`,
      };
    }
  }

  return res.status(200).json({ status: "ok", analysis });
}
