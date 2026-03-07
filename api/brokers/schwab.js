/**
 * @fileoverview Schwab broker integration for options and equity order placement.
 *
 * Supports SPX, SPY, and any valid Schwab-listed equity or option symbol.
 * Uses the Schwab Trader API with OAuth2 refresh-token flow.
 * Token is cached and refreshed automatically; a promise-lock prevents
 * concurrent refresh races.
 *
 * Environment variables required:
 *   SCHWAB_CLIENT_ID, SCHWAB_CLIENT_SECRET, SCHWAB_REFRESH_TOKEN,
 *   SCHWAB_ACCOUNT_HASH
 */

const SCHWAB_API_BASE = "https://api.schwabapi.com";

/** @type {{ accessToken: string|null, expiry: number }} Cached token state */
let tokenCache = { accessToken: null, expiry: 0 };

/** @type {Promise<string>|null} In-flight token request (prevents concurrent refreshes) */
let pendingTokenRequest = null;

/**
 * Obtain a valid Schwab access token, using the cached value when still valid.
 *
 * @returns {Promise<string>} A valid Bearer access token.
 * @throws {Error} If token refresh fails.
 */
async function getAccessToken() {
  const now = Date.now();

  // Return cached token with a 60-second safety margin.
  if (tokenCache.accessToken && now < tokenCache.expiry - 60_000) {
    return tokenCache.accessToken;
  }

  if (pendingTokenRequest) {
    return pendingTokenRequest;
  }

  pendingTokenRequest = (async () => {
    try {
      const credentials = Buffer.from(
        `${process.env.SCHWAB_CLIENT_ID}:${process.env.SCHWAB_CLIENT_SECRET}`
      ).toString("base64");

      const body = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: process.env.SCHWAB_REFRESH_TOKEN,
      });

      const response = await fetch(`${SCHWAB_API_BASE}/v1/oauth/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${credentials}`,
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          `Schwab token refresh failed (${response.status}): ${errorBody}`
        );
      }

      const data = await response.json();

      if (!data.access_token) {
        throw new Error("Schwab token response missing access_token");
      }

      tokenCache = {
        accessToken: data.access_token,
        // expires_in is in seconds
        expiry: now + (data.expires_in ?? 1800) * 1000,
      };

      return tokenCache.accessToken;
    } finally {
      pendingTokenRequest = null;
    }
  })();

  return pendingTokenRequest;
}

/**
 * Place an equity or options order on Schwab.
 *
 * Asset type is inferred from the ticker length: symbols longer than 6
 * characters are treated as OCC-format option symbols (OPTION); all others
 * are treated as EQUITY.
 *
 * @param {"buy"|"sell"|"close"} action    - Trade direction.
 * @param {string}               ticker    - Equity or OCC option symbol.
 * @param {number}               qty       - Number of shares / contracts.
 * @param {"Market"|"Limit"}     orderType - Order type.
 * @param {number|undefined}     price     - Limit price (required for Limit orders).
 * @returns {Promise<string>} The Schwab order ID extracted from the Location header.
 * @throws {Error} If the order placement fails.
 */
async function placeOrder(action, ticker, qty, orderType, price) {
  const token = await getAccessToken();
  const accountHash = process.env.SCHWAB_ACCOUNT_HASH;

  const orderBody = {
    orderType: orderType === "Limit" ? "LIMIT" : "MARKET",
    session: "NORMAL",
    duration: "DAY",
    orderStrategyType: "SINGLE",
    orderLegCollection: [
      {
        instruction: action === "buy" ? "BUY" : "SELL",
        quantity: qty,
        instrument: {
          symbol: ticker,
          assetType: ticker.length > 6 ? "OPTION" : "EQUITY",
        },
      },
    ],
  };

  if (orderType === "Limit" && price !== undefined) {
    orderBody.price = String(price);
  }

  const response = await fetch(
    `${SCHWAB_API_BASE}/trader/v1/accounts/${accountHash}/orders`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(orderBody),
    }
  );

  // Schwab returns 201 Created with a Location header containing the order ID.
  if (response.status !== 201) {
    const errorBody = await response.text();
    throw new Error(
      `Schwab placeOrder failed (${response.status}): ${errorBody}`
    );
  }

  const location = response.headers.get("Location") ?? "";
  // Location: .../orders/1234567890
  const orderId = location.split("/").pop() || null;
  return orderId;
}

export { placeOrder };
