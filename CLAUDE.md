# Future-Trading — Project Context

TradingView alert → webhook → broker execution. Vercel serverless functions in
`api/`, plus a Vite/React strategy-gallery front end.

**This code places real orders.** Read the safety section before changing
anything under `api/`.

---

## The three defects that were fixed (2026-08-25)

Understand these before modifying the safety path — each was live in production
and each looked fine on inspection.

### 1. Contract symbols were expired and micros were impossible

```js
const CONTRACT_MAP = { ES: "ESM5", NQ: "NQM5", GC: "GCM5" };   // June 2025
```

Every order after that expiry failed. Worse, the map held only full-size
contracts — Bill trades **MNQ / MYM / M2K / MGC** on a prop-firm combine, so no
order he actually wanted could be placed at all.

`api/utils/contracts.js` now computes front month from the current date:
quarterly H/M/U/Z for equity index, rolling 8 days before the third Friday;
G/J/M/Q/V/Z for gold, rolling at the end of the preceding month.
`CONTRACT_<ROOT>=MNQZ6` pins a symbol during roll week.

**Never reintroduce a hardcoded contract map.**

### 2. The kill switch did not work

`killSwitch` and `recentTrades` were module-level variables. Vercel functions
are **stateless and horizontally scaled** — a kill applied to one instance was
invisible to the next cold instance, which placed the order anyway. The audit
trail had the same defect: trades were visible only to the instance that wrote
them.

`api/__tests__/legacy-killswitch.test.js` keeps the original implementation as a
fixture and **demonstrates the failure**. Leave that test in place. If it ever
starts failing, someone changed the fixture.

### 3. There was no risk engine

Nothing stood between a webhook payload and a broker. `api/utils/risk.js` now
does.

---

## Safety invariants — do not weaken these

**Everything fails closed.** If a limit cannot be evaluated — store unreachable,
clock unavailable, product unknown — the order is **rejected**. This is the
inversion that mattered: previously an unreadable state *permitted* the trade.

- `isKilled()` returns `true` on any store error
- `risk.evaluate()` returns `allowed: false` on any store error
- `/api/webhook` returns 503 if the idempotency store is unreachable, rather
  than risk a duplicate order
- `/api/kill` **reads back after writing** and returns 500 on an unverified
  write. A kill command that silently failed is a safety incident.

**Never make the kill switch synchronous again.** A synchronous `getKill()`
cannot be correct on serverless. The API is async on purpose.

**Never set `ALLOW_MEMORY_STORE=true` in Vercel.** It substitutes a
non-durable in-process map and silently reinstates defect #2. Local tests only.

---

## Request pipeline (`api/webhook.js`)

Order matters. Nothing reaches a broker until every stage passes.

1. Method + JSON parse
2. Shared secret — **timing-safe** comparison
3. Field validation
4. **Idempotency** — repeated `signalId` inside 300s is a no-op. TradingView
   retries and double-fires are routine; without this one signal becomes two
   positions.
5. **Kill switch** — fails closed
6. **Risk engine** — fails closed
7. Contract resolution — computed, never hardcoded
8. Broker dispatch
9. Durable logging + risk accounting

---

## Risk engine (`api/utils/risk.js`)

| Env | Default | Purpose |
|---|---|---|
| `RISK_MAX_QTY_PER_ORDER` | 3 | Contracts per order |
| `RISK_MAX_OPEN_CONTRACTS` | 3 | Net open per product |
| `RISK_MAX_ORDERS_PER_DAY` | 40 | Daily order count |
| `RISK_ALLOW_FULL_SIZE` | false | Blocks ES/NQ/RTY/YM/GC |
| `RISK_SESSION_START` | 08:30 | Central time |
| `RISK_SESSION_END` | 15:00 | Central time |
| `RISK_FLAT_BY` | 15:55 | Only `close` accepted after |

`close` is **always** permitted regardless of session, so a position can be
flattened at any hour. Weekends are rejected.

Keep `RISK_ALLOW_FULL_SIZE=false` while on a combine — one full-size NQ is 10x a
MNQ and will breach a micro-sized drawdown limit in a single trade.

---

## Store (`api/utils/store.js`)

Upstash Redis over its REST API — no SDK, no TCP pooling, works inside a
serverless function. Holds kill state, trade log, idempotency keys, risk
counters.

```
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

Without these the endpoint refuses every order **by design**, and
`/api/health` returns 503 `degraded`. That is correct behaviour, not a failure.

---

## Endpoints

| Route | Method | Notes |
|---|---|---|
| `/api/webhook` | POST | Signal ingestion. Full pipeline above. |
| `/api/kill` | POST / GET | Set or read kill state. Verifies its own write. |
| `/api/trades` | GET | Durable trade log. |
| `/api/health` | GET | Unauthenticated. Store, kill state, risk, contracts. |

`/api/health` reports `ready: false` whenever the store is unreachable. That is
the flag to watch.

---

## Testing

```bat
npm test              :: 21 safety tests, node:test, no deps
npm run test:safety   :: safety suite only
```

Tests run without Redis via `ALLOW_MEMORY_STORE=true`, set inside the test file.

**Any change to the safety path needs a test.** The bugs above all survived
casual review because they read as correct.

---

## Repo layout warning

Roughly 120 loose `.txt` Pine scripts and `.png` screenshots are duplicated at
the repo root **and** in `public/`. Two copies of everything. Not yet cleaned up
— don't assume the root copies are authoritative.

---

## Relationship to SENTINEL

`C:\dev\trading\SENTINEL` is the analysis engine — deterministic, backtestable,
stateful, but with **no execution path**. This repo is the execution arm with
**no analysis**. Together they form one system.

Intended architecture when connected:

```
SENTINEL engine   deterministic signal   ← backtestable
      ↓
Risk engine       fails closed           ← hard gate
      ↓
LLM supervisor    READ-ONLY: veto or annotate, never originate
      ↓
/api/webhook      direct HTTPS, idempotency key
      ↓
Tradovate
```

The LLM sits **after** the risk gate and may only downgrade or annotate. It must
never generate signals — that inverts the read-only invariant Bill enforces
across NEXUS, and an LLM-generated signal cannot be backtested.

**They are not connected yet.** Do not wire execution without an explicit
instruction from Bill.

---

## Status (2026-08-25)

Commit `aae7ca1` pushed to `bill143/Future-Trading` (public repo, no secrets).
21/21 tests passing. Not deployed to Vercel — no `.vercel` link exists. Upstash
not yet provisioned. Nothing is wired to execution.
