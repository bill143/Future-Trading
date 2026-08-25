/**
 * @fileoverview Test harness and curl examples for /api/analyze.
 *
 * Run with:
 *   node api/test-analysis.js
 *
 * Or use the curl examples below directly from your terminal.
 */

/* eslint-disable no-console */

// ── Curl examples ─────────────────────────────────────────────────────────

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

const curlExamples = `
# ── GET: Manual analysis (no trade execution) ──────────────────────────────

# Analyse ES on 1h timeframe
curl "${BASE_URL}/api/analyze?symbol=ES&timeframe=1h"

# Analyse NQ on 15m timeframe
curl "${BASE_URL}/api/analyze?symbol=NQ&timeframe=15m"

# Analyse YM on daily timeframe, skip FRED data
curl "${BASE_URL}/api/analyze?symbol=YM&timeframe=1d&skipFundamental=true"

# Analyse MES (Micro E-mini S&P) on 5m timeframe
curl "${BASE_URL}/api/analyze?symbol=MES&timeframe=5m"


# ── POST: Analysis with optional auto-trade forwarding ─────────────────────

# Analyse only (no trade)
curl -X POST "${BASE_URL}/api/analyze" \\
  -H "Content-Type: application/json" \\
  -d '{
    "symbol": "ES",
    "timeframe": "1h"
  }'

# Analyse and auto-trade if confidence >= threshold
curl -X POST "${BASE_URL}/api/analyze" \\
  -H "Content-Type: application/json" \\
  -d '{
    "secret": "your-webhook-secret",
    "symbol": "ES",
    "timeframe": "1h",
    "autoTrade": true,
    "broker": "tradovate",
    "qty": 1,
    "orderType": "Market"
  }'

# Use Groq as LLM provider for faster inference
curl -X POST "${BASE_URL}/api/analyze" \\
  -H "Content-Type: application/json" \\
  -d '{
    "symbol": "NQ",
    "timeframe": "15m",
    "provider": "groq",
    "model": "llama3-70b-8192"
  }'
`;

console.log("=== /api/analyze Curl Examples ===\n");
console.log(curlExamples);

// ── Node.js fetch test ─────────────────────────────────────────────────────

async function testAnalysisEndpoint() {
  console.log("=== Running Node.js fetch test ===\n");

  const url = `${BASE_URL}/api/analyze?symbol=ES&timeframe=1h`;
  console.log(`Calling: GET ${url}\n`);

  try {
    const resp = await fetch(url);
    const data = await resp.json();

    console.log("HTTP Status:", resp.status);

    if (resp.ok && data.analysis) {
      const a = data.analysis;
      console.log(`Symbol:         ${a.symbol}`);
      console.log(`Timeframe:      ${a.timeframe}`);
      console.log(`Consensus Bias: ${a.consensus_bias}`);
      console.log(`Confidence:     ${(a.confidence * 100).toFixed(1)}%`);
      console.log(`Signal Action:  ${a.trading_signal?.action}`);
      console.log(`Entry:          ${a.trading_signal?.entry}`);
      console.log(`Stop Loss:      ${a.trading_signal?.stop_loss}`);
      console.log(`Take Profit:    ${a.trading_signal?.take_profit}`);
      console.log(`Risk/Reward:    ${a.trading_signal?.risk_reward}`);
      console.log(`\nReasoning:\n${a.reasoning}`);

      console.log("\n--- Individual Agent Biases ---");
      for (const agent of a.agents || []) {
        console.log(
          `  ${(agent.agent || "unknown").padEnd(30)} bias=${(agent.bias || "?").padEnd(8)} conf=${((agent.confidence || 0) * 100).toFixed(0)}%`
        );
      }
    } else {
      console.log("Response:", JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error("Test failed:", err.message);
    console.log("(Is the dev server running at", BASE_URL, "?)");
  }
}

// Run the Node fetch test if called directly (Node 18+ has built-in fetch)
if (process.argv[1] && process.argv[1].includes("test-analysis")) {
  testAnalysisEndpoint();
}
