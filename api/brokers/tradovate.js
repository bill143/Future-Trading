/**
 * @fileoverview Tradovate broker integration for futures order placement.
 *
 * Supports ES, NQ, and GC front-month contracts.
 * Uses the Tradovate REST API v1 with Bearer-token authentication.
 * Token is cached and refreshed automatically; a promise-lock prevents
 * concurrent refresh races.
 *
 * Environment variables required:
 *   TRADOVATE_USERNAME, TRADOVATE_PASSWORD, TRADOVATE_APP_ID,
 *   TRADOVATE_APP_VERSION, TRADOVATE_CID, TRADOVATE_SEC,
 *   TRADOVATE_ACCOUNT_ID, TRADOVATE_DEMO
 */

/** Base URL switches between demo and live depending on TRADOVATE_DEMO env var. */
const BASE_URL =
  process.env.TRADOVATE_DEMO === "true"
    ? "https://demo.tradovateapi.com/v1"
    : "https://live.tradovateapi.com/v1";

/**
 * Front-month contract symbols for supported tickers.
 * @type {Record<string, string>}
 */
const CONTRACT_MAP = {
  ES: "ESM5",
  NQ: "NQM5",
  GC: "GCM5",
};

/** @type {{ accessToken: string|null, expiry: number }} Cached token state */
let tokenCache = { accessToken: null, expiry: 0 };

/** @type {Promise<string>|null} In-flight token request promise (prevents concurrent refreshes) */
let pendingTokenRequest = null;

/**
 * Obtain a valid Tradovate access token, using the cached value when still valid.
 *
 * @returns {Promise<string>} A valid Bearer access token.
 * @throws {Error} If authentication fails.
 */
async function getAccessToken() {
  const now = Date.now();

  // Return cached token if it is still valid (with a 60-second safety margin).
  if (tokenCache.accessToken && now < tokenCache.expiry - 60_000) {
    return tokenCache.accessToken;
  }

  // If a refresh is already in progress, wait for it instead of making a duplicate request.
  if (pendingTokenRequest) {
    return pendingTokenRequest;
  }

  pendingTokenRequest = (async () => {
    try {
      const response = await fetch(`${BASE_URL}/auth/accesstokenrequest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: process.env.TRADOVATE_USERNAME,
          password: process.env.TRADOVATE_PASSWORD,
          appId: process.env.TRADOVATE_APP_ID,
          appVersion: process.env.TRADOVATE_APP_VERSION,
          cid: Number(process.env.TRADOVATE_CID),
          sec: process.env.TRADOVATE_SEC,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Tradovate auth failed (${response.status}): ${body}`);
      }

      const data = await response.json();

      if (!data["p-token"]) {
        throw new Error("Tradovate auth response missing p-token");
      }

      tokenCache = {
        accessToken: data["p-token"],
        // expiration-time is an ISO 8601 string
        expiry: data["expiration-time"]
          ? new Date(data["expiration-time"]).getTime()
          : now + 60 * 60 * 1000, // default 1-hour TTL
      };

      return tokenCache.accessToken;
    } finally {
      pendingTokenRequest = null;
    }
  })();

  return pendingTokenRequest;
}

/**
 * Place a futures order on Tradovate.
 *
 * @param {"buy"|"sell"|"close"} action  - Trade direction.
 * @param {string}               ticker  - Instrument ticker (ES, NQ, GC).
 * @param {number}               qty     - Number of contracts.
 * @param {"Market"|"Limit"}     orderType - Order type.
 * @param {number|undefined}     price   - Limit price (required when orderType is "Limit").
 * @returns {Promise<string|number>} The Tradovate order ID.
 * @throws {Error} If the order placement fails.
 */
async function placeOrder(action, ticker, qty, orderType, price) {
  const token = await getAccessToken();
  const symbol = CONTRACT_MAP[ticker];

  if (!symbol) {
    throw new Error(`Unsupported Tradovate ticker: ${ticker}`);
  }

  const body = {
    accountId: Number(process.env.TRADOVATE_ACCOUNT_ID),
    action: action === "buy" ? "Buy" : "Sell",
    symbol,
    orderQty: qty,
    orderType: orderType === "Limit" ? "Limit" : "Market",
  };

  if (orderType === "Limit" && price !== undefined) {
    body.price = price;
  }

  const response = await fetch(`${BASE_URL}/order/placeorder`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Tradovate placeOrder failed (${response.status}): ${errorBody}`
    );
  }

  const data = await response.json();
  return data.orderId ?? data.id;
}

/**
 * Close an open position for the given ticker by liquidating via Tradovate.
 *
 * @param {string} ticker - Instrument ticker (ES, NQ, GC).
 * @returns {Promise<string|number>} The liquidation order ID, or null if no position found.
 * @throws {Error} If the API calls fail.
 */
async function closePosition(ticker) {
  const token = await getAccessToken();
  const symbol = CONTRACT_MAP[ticker];

  if (!symbol) {
    throw new Error(`Unsupported Tradovate ticker: ${ticker}`);
  }

  // Retrieve all open positions.
  const positionsResponse = await fetch(`${BASE_URL}/position/list`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!positionsResponse.ok) {
    const errorBody = await positionsResponse.text();
    throw new Error(
      `Tradovate position/list failed (${positionsResponse.status}): ${errorBody}`
    );
  }

  const positions = await positionsResponse.json();
  const position = Array.isArray(positions)
    ? positions.find((p) => p.contractId && p.symbol === symbol)
    : null;

  if (!position) {
    // No open position — nothing to close.
    return null;
  }

  const liquidateResponse = await fetch(
    `${BASE_URL}/order/liquidateposition`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        accountId: Number(process.env.TRADOVATE_ACCOUNT_ID),
        contractId: position.contractId,
        admin: false,
      }),
    }
  );

  if (!liquidateResponse.ok) {
    const errorBody = await liquidateResponse.text();
    throw new Error(
      `Tradovate liquidateposition failed (${liquidateResponse.status}): ${errorBody}`
    );
  }

  const liquidateData = await liquidateResponse.json();
  return liquidateData.orderId ?? liquidateData.id;
}

export { placeOrder, closePosition };
