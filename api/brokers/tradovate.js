/**
 * @fileoverview Tradovate broker integration for futures order placement.
 *
 * Contract symbols are supplied by the caller (resolved via utils/contracts.js)
 * rather than looked up from a hardcoded map — the previous CONTRACT_MAP was
 * pinned to June-2025 expiries and could not place a micro contract at all.
 *
 * Environment variables required:
 *   TRADOVATE_USERNAME, TRADOVATE_PASSWORD, TRADOVATE_APP_ID,
 *   TRADOVATE_APP_VERSION, TRADOVATE_CID, TRADOVATE_SEC,
 *   TRADOVATE_ACCOUNT_ID, TRADOVATE_DEMO
 */

/** Base URL switches between demo and live depending on TRADOVATE_DEMO. */
const BASE_URL =
  process.env.TRADOVATE_DEMO === "true"
    ? "https://demo.tradovateapi.com/v1"
    : "https://live.tradovateapi.com/v1";

/** @type {{accessToken: string|null, expiry: number}} */
let tokenCache = { accessToken: null, expiry: 0 };

/** @type {Promise<string>|null} In-flight token request (prevents refresh races). */
let pendingTokenRequest = null;

/**
 * Obtain a valid Tradovate access token, reusing the cached value when fresh.
 *
 * @returns {Promise<string>}
 * @throws {Error} If authentication fails.
 */
async function getAccessToken() {
  const now = Date.now();

  if (tokenCache.accessToken && now < tokenCache.expiry - 60_000) {
    return tokenCache.accessToken;
  }
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
        throw new Error(`Tradovate auth failed (${response.status}): ${await response.text()}`);
      }

      const data = await response.json();
      if (!data["p-token"]) {
        throw new Error("Tradovate auth response missing p-token");
      }

      tokenCache = {
        accessToken: data["p-token"],
        expiry: data["expiration-time"]
          ? new Date(data["expiration-time"]).getTime()
          : now + 60 * 60 * 1000,
      };
      return tokenCache.accessToken;
    } finally {
      pendingTokenRequest = null;
    }
  })();

  return pendingTokenRequest;
}

/**
 * Place a futures order.
 *
 * @param {"buy"|"sell"}     action   - Trade direction.
 * @param {string}           contract - Resolved contract symbol, e.g. "MNQZ6".
 * @param {number}           qty      - Contract count.
 * @param {"Market"|"Limit"} orderType
 * @param {number}           [price]  - Required for Limit orders.
 * @returns {Promise<string|number>} Tradovate order id.
 * @throws {Error} If placement fails.
 */
async function placeOrder(action, contract, qty, orderType, price) {
  if (!contract) throw new Error("placeOrder requires a resolved contract symbol");

  const token = await getAccessToken();
  const body = {
    accountId: Number(process.env.TRADOVATE_ACCOUNT_ID),
    action: action === "buy" ? "Buy" : "Sell",
    symbol: contract,
    orderQty: qty,
    orderType: orderType === "Limit" ? "Limit" : "Market",
    isAutomated: true,
  };
  if (orderType === "Limit" && price !== undefined) {
    body.price = Number(price);
  }

  const response = await fetch(`${BASE_URL}/order/placeorder`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Tradovate placeOrder failed (${response.status}): ${await response.text()}`);
  }

  const data = await response.json();
  if (data.failureReason) {
    throw new Error(`Tradovate rejected order: ${data.failureReason} ${data.failureText ?? ""}`.trim());
  }
  return data.orderId ?? data.id;
}

/**
 * Flatten an open position for a contract.
 *
 * @param {string} contract - Resolved contract symbol, e.g. "MNQZ6".
 * @returns {Promise<string|number|null>} Liquidation order id, or null when flat.
 * @throws {Error} If the API calls fail.
 */
async function closePosition(contract) {
  if (!contract) throw new Error("closePosition requires a resolved contract symbol");

  const token = await getAccessToken();
  const positionsResponse = await fetch(`${BASE_URL}/position/list`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!positionsResponse.ok) {
    throw new Error(
      `Tradovate position/list failed (${positionsResponse.status}): ${await positionsResponse.text()}`
    );
  }

  const positions = await positionsResponse.json();
  const position = Array.isArray(positions)
    ? positions.find((p) => p.contractId && p.symbol === contract && p.netPos !== 0)
    : null;

  if (!position) return null;

  const liquidateResponse = await fetch(`${BASE_URL}/order/liquidateposition`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      accountId: Number(process.env.TRADOVATE_ACCOUNT_ID),
      contractId: position.contractId,
      admin: false,
    }),
  });

  if (!liquidateResponse.ok) {
    throw new Error(
      `Tradovate liquidateposition failed (${liquidateResponse.status}): ${await liquidateResponse.text()}`
    );
  }

  const data = await liquidateResponse.json();
  return data.orderId ?? data.id;
}

/** Test seam — clears the cached token. */
function _resetTokenCache() {
  tokenCache = { accessToken: null, expiry: 0 };
  pendingTokenRequest = null;
}

export { placeOrder, closePosition, _resetTokenCache };
