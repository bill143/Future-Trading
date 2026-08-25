/**
 * @fileoverview Durable key-value store for kill-switch state, trade log and
 * idempotency keys.
 *
 * WHY THIS EXISTS
 * The previous implementation held killSwitch and recentTrades in module-level
 * variables. Vercel serverless functions are stateless and horizontally scaled:
 * flipping the kill switch mutates one lambda instance, and the very next
 * request may land on a cold instance where killSwitch.tradovate === false.
 * The stop looked functional and was not.
 *
 * FAIL-CLOSED CONTRACT
 * If the backing store is unreachable or misconfigured, isKilled() returns
 * TRUE. An unknown safety state must halt trading, never permit it. This is
 * the opposite of the old behaviour, where an unreadable state permitted the
 * order.
 *
 * BACKEND
 * Upstash Redis over its REST API — no SDK, no TCP pooling, works inside a
 * serverless function. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.
 * When ALLOW_MEMORY_STORE=true (local development only) an in-process map is
 * used instead, and every read logs a warning.
 */

const MEMORY = new Map();

/**
 * @returns {{url: string, token: string}|null} REST credentials, or null when unset.
 */
function credentials() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

/**
 * @returns {boolean} True when the in-memory development store is permitted.
 */
function memoryAllowed() {
  return process.env.ALLOW_MEMORY_STORE === "true";
}

/**
 * Execute a Redis command over the Upstash REST API.
 *
 * @param {Array<string|number>} command - e.g. ["SET", "key", "value"]
 * @returns {Promise<any>} The command result.
 * @throws {Error} If the store is unreachable or returns an error.
 */
async function redis(command) {
  const creds = credentials();
  if (!creds) throw new Error("Redis store not configured");

  const response = await fetch(creds.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${creds.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });

  if (!response.ok) {
    throw new Error(`Redis ${command[0]} failed (${response.status}): ${await response.text()}`);
  }
  const data = await response.json();
  if (data.error) throw new Error(`Redis ${command[0]} error: ${data.error}`);
  return data.result;
}

/**
 * Read a value.
 *
 * @param {string} key
 * @returns {Promise<string|null>}
 */
async function get(key) {
  if (credentials()) return redis(["GET", key]);
  if (memoryAllowed()) {
    console.warn(`[store] MEMORY MODE — ${key} is not durable`);
    return MEMORY.get(key) ?? null;
  }
  throw new Error("No durable store configured (set UPSTASH_REDIS_REST_* env vars)");
}

/**
 * Write a value, optionally with a TTL.
 *
 * @param {string} key
 * @param {string} value
 * @param {number} [ttlSeconds]
 * @returns {Promise<void>}
 */
async function set(key, value, ttlSeconds) {
  if (credentials()) {
    const cmd = ttlSeconds ? ["SET", key, value, "EX", ttlSeconds] : ["SET", key, value];
    await redis(cmd);
    return;
  }
  if (memoryAllowed()) {
    MEMORY.set(key, value);
    return;
  }
  throw new Error("No durable store configured (set UPSTASH_REDIS_REST_* env vars)");
}

/**
 * Set a key only if it does not already exist. Used for idempotency.
 *
 * @param {string} key
 * @param {string} value
 * @param {number} ttlSeconds
 * @returns {Promise<boolean>} True when this call created the key (first sighting).
 */
async function setIfAbsent(key, value, ttlSeconds) {
  if (credentials()) {
    const result = await redis(["SET", key, value, "NX", "EX", ttlSeconds]);
    return result === "OK";
  }
  if (memoryAllowed()) {
    if (MEMORY.has(key)) return false;
    MEMORY.set(key, value);
    return true;
  }
  throw new Error("No durable store configured (set UPSTASH_REDIS_REST_* env vars)");
}

/**
 * Append to a capped list (newest first).
 *
 * @param {string} key
 * @param {Object} entry
 * @param {number} [cap=200]
 * @returns {Promise<void>}
 */
async function pushCapped(key, entry, cap = 200) {
  const payload = JSON.stringify(entry);
  if (credentials()) {
    await redis(["LPUSH", key, payload]);
    await redis(["LTRIM", key, 0, cap - 1]);
    return;
  }
  if (memoryAllowed()) {
    const list = MEMORY.get(key) ?? [];
    list.unshift(payload);
    MEMORY.set(key, list.slice(0, cap));
    return;
  }
  throw new Error("No durable store configured (set UPSTASH_REDIS_REST_* env vars)");
}

/**
 * Read a capped list.
 *
 * @param {string} key
 * @param {number} [limit=200]
 * @returns {Promise<Object[]>}
 */
async function readList(key, limit = 200) {
  let raw;
  if (credentials()) {
    raw = await redis(["LRANGE", key, 0, limit - 1]);
  } else if (memoryAllowed()) {
    raw = MEMORY.get(key) ?? [];
  } else {
    return [];
  }
  return (raw ?? []).map((item) => {
    try { return JSON.parse(item); } catch { return { raw: item }; }
  });
}

/**
 * Atomically increment a counter with a TTL on first write.
 *
 * @param {string} key
 * @param {number} ttlSeconds
 * @returns {Promise<number>} The value after incrementing.
 */
async function increment(key, ttlSeconds) {
  if (credentials()) {
    const value = await redis(["INCR", key]);
    if (value === 1) await redis(["EXPIRE", key, ttlSeconds]);
    return Number(value);
  }
  if (memoryAllowed()) {
    const next = Number(MEMORY.get(key) ?? 0) + 1;
    MEMORY.set(key, next);
    return next;
  }
  throw new Error("No durable store configured (set UPSTASH_REDIS_REST_* env vars)");
}

/**
 * Health probe for the store.
 *
 * @returns {Promise<{ok: boolean, backend: string, error?: string}>}
 */
async function health() {
  if (credentials()) {
    try {
      await redis(["PING"]);
      return { ok: true, backend: "upstash-redis" };
    } catch (err) {
      return { ok: false, backend: "upstash-redis", error: err.message };
    }
  }
  if (memoryAllowed()) return { ok: true, backend: "memory (NOT DURABLE)" };
  return { ok: false, backend: "none", error: "No store configured" };
}

/** Test seam — clears the in-memory backend. */
function _resetMemory() {
  MEMORY.clear();
}

export { get, set, setIfAbsent, pushCapped, readList, increment, health, _resetMemory };
