# Build Future-Trading

Build Future-Trading: a TradingView-alert → webhook → broker execution arm
(Vercel serverless functions under `api/`, Tradovate + Schwab) grafted onto a
forked Pine Script strategy collection, with a Vite/React gallery (`src/`) that
browses the 54 scripts.

This directive was reconstructed from the repo as it actually exists on
2026-08-27. It is the canonical project prompt: every statement below is a
verified fact of the repo at `5786b9d` (GitHub `bill143/Future-Trading`,
branch `main`, even with `origin/main`), not an aspiration. This repo is a
mixed inheritance, and the directive says so: the strategy collection and
root-level README are upstream fork content
(`dearvn/trading-futures-tradingview-script`); the engineered, testable
project is the webhook under `api/` plus the gallery under `src/`. See
`CLAUDE.md` for the safety contract and the three fixed defects.

## Purpose & scope

It solves one problem: getting a TradingView alert into a real broker order
without any of the ways that kills an account — duplicate fills, expired
contract symbols, a kill switch that doesn't actually stop anything, or an
order that no risk limit ever looked at. Everything between the alert and the
broker is a gate that can refuse.

**Explicitly OUT of scope:**

- Signal generation. Signals originate in TradingView Pine scripts (or,
  in the intended future, the SENTINEL engine at `C:\dev\trading\SENTINEL`).
  This repo analyses nothing and predicts nothing — the `ai-*` files at the
  root are Pine scripts, not an ML system, and `ai-prediction` is a single
  Pine file, not a code directory.
- Wiring live execution. Per `CLAUDE.md`: not deployed to Vercel, Upstash not
  provisioned, nothing connected — and it must not be connected without an
  explicit instruction from Bill.
- An LLM in the order path. The intended architecture places an LLM
  supervisor strictly **after** the risk gate, read-only: veto or annotate,
  never originate a signal (`CLAUDE.md`, "Relationship to SENTINEL").
- Cleaning or curating the Pine collection. The 54 scripts (49 `.txt` + 5
  extensionless: `ai-prediction`, `es-futures`, `futures-2024`, `nq-future`,
  `price_action`) exist twice — repo root and `public/strategies/` — and
  `CLAUDE.md` explicitly warns not to assume the root copies are
  authoritative.

## Environment

Windows, Node 24 (v24.18.0 verified; `server/README.md` asks for 20+).
Lives at `C:\dev\trading\Future-Trading`. Target runtime is Vercel serverless
functions (`api/`) + a static Vite build (`vercel.json` rewrites non-`/api/`
routes to `index.html`). Frontend: Vite 6, React 18, react-router 6,
Tailwind 3, highlight.js, lucide-react. The `api/` code has **zero runtime
dependencies** — `node:crypto`, `fetch`, and the Upstash Redis REST API only.

Configuration is environment variables only, documented with placeholders in
`.env.example` (no `.env` exists in the repo; nothing real is committed):

- `WEBHOOK_SECRET` — shared secret for every authenticated route
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` — the durable store;
  without them every order is refused by design
- `ALLOW_MEMORY_STORE` — local tests only; **never** in Vercel
- `TRADOVATE_USERNAME/PASSWORD/APP_ID/APP_VERSION/CID/SEC/ACCOUNT_ID/DEMO`
- `SCHWAB_CLIENT_ID/CLIENT_SECRET/REFRESH_TOKEN/ACCOUNT_HASH`
- `RISK_MAX_QTY_PER_ORDER`, `RISK_MAX_OPEN_CONTRACTS`,
  `RISK_MAX_ORDERS_PER_DAY`, `RISK_ALLOW_FULL_SIZE`, `RISK_SESSION_START`,
  `RISK_SESSION_END`, `RISK_FLAT_BY`, `RISK_ENFORCE_SESSION`
- `CONTRACT_<ROOT>` (e.g. `CONTRACT_MNQ=MNQZ6`) to pin a symbol during roll
  week; `CONTRACT_YEAR_DIGITS` for Tradovate symbol format

## Architecture

Backend `api/` (one Vercel function per file):

- `webhook.js` — POST `/api/webhook`, the nine-stage pipeline in strict
  order: method+parse → timing-safe secret → field validation → idempotency
  (`signalId`, 300 s TTL) → kill switch → risk engine → contract resolution →
  broker dispatch → durable logging + risk accounting
- `kill.js` — set/read kill state per broker or `all`; **reads back after
  writing** and returns 500 on an unverified write
- `trades.js` — durable trade log (secret-protected)
- `health.js` — unauthenticated; reports store reachability, kill state,
  risk config, resolved contracts; `ready: false` when the store is down
- `utils/store.js` — Upstash Redis over REST; kill state, trade log,
  idempotency keys, risk counters; in-memory map only under
  `ALLOW_MEMORY_STORE=true`, and every such read logs a warning
- `utils/logger.js` — async durable trade log + `isKilled()`/`setKill()`;
  the old synchronous in-memory API is intentionally gone
- `utils/risk.js` — per-order qty cap, open-exposure cap, daily order cap,
  full-size block (ES/NQ/RTY/YM/GC), session window in Central time,
  flat-by cutoff, weekend refusal; `close` always permitted
- `utils/contracts.js` — front month computed from the current date
  (quarterly H/M/U/Z for equity index with roll 8 days before third Friday;
  G/J/M/Q/V/Z for gold), env-pinnable, unknown products rejected
- `brokers/tradovate.js`, `brokers/schwab.js` — order placement;
  credentials from env only
- `__tests__/safety.test.js` — 21 `node:test` safety tests, no deps
- `__tests__/legacy-killswitch.test.js` + `fixtures/logger.legacy.js` —
  keeps the *broken* original implementation as a fixture and demonstrates
  its failure; if it starts failing, someone touched the fixture

Frontend `src/` — pages (`Dashboard`, `StrategiesPage`, `StrategyDetail`,
`GalleryPage`, `AboutPage`, `NotFoundPage`), components (code viewer, cards,
skeleton, error boundary), and `data/strategies.js`: 54 entries, one per file
in `public/strategies/` (verified 1:1). `public/screenshots/` holds the
gallery images.

Also present, as-is: `server/README.md` (setup guide for the webhook — partly
stale, see Non-negotiables), `AI-COMMAND-CENTER-RESEARCH.md` (a standalone
research memo on AI dashboard platforms with no implementation in this repo),
and ~26 root-level `.png` chart screenshots duplicated in
`public/screenshots/`.

## Non-negotiables

All carried from `CLAUDE.md` and verified present in the code:

- **Everything fails closed.** An unevaluable limit rejects the order:
  `isKilled()` returns `true` on any store error (`api/utils/logger.js`),
  `risk.evaluate()` returns `allowed: false` on any store error
  (`api/utils/risk.js`), `/api/webhook` returns 503 when the idempotency
  store is unreachable rather than risk a duplicate (`api/webhook.js` §4),
  and an unconfigured store refuses every order (`api/utils/store.js`).
- **Never reintroduce a hardcoded contract map.** Defect #1 was
  `{ ES: "ESM5", ... }` — expired symbols, no micros. Front month is
  computed in `api/utils/contracts.js`; micros MNQ/MYM/M2K/MGC must resolve.
- **Never make the kill switch synchronous or in-memory again.** Defect #2:
  module-level state on stateless, horizontally scaled functions. The API is
  async on purpose; `ALLOW_MEMORY_STORE=true` in Vercel silently reinstates
  the bug. `/api/kill` verifies its own write by read-back (`api/kill.js`).
- **Nothing reaches a broker without passing the risk engine.** Defect #3
  was its absence. Pipeline order in `api/webhook.js` is load-bearing.
- **Timing-safe secret comparison** (`node:crypto.timingSafeEqual`) on every
  authenticated route (`api/webhook.js`, `api/kill.js`, `api/trades.js`);
  a missing `WEBHOOK_SECRET` yields 503, never open access.
- **Keep the legacy-killswitch test in place** — it is a tripwire, not
  coverage (`api/__tests__/legacy-killswitch.test.js`).
- **Any change to the safety path needs a test**, because all three fixed
  defects read as correct on casual review (`CLAUDE.md`, Testing).
- **Keep `RISK_ALLOW_FULL_SIZE=false` on a combine** — one full-size NQ is
  10x a MNQ against a micro-sized drawdown limit.
- **Trust `CLAUDE.md` over the READMEs.** The root `README.md` is the
  upstream fork's document (Patreon/donation links, upstream image URLs, a
  third party's contact addresses) and describes none of this code.
  `server/README.md` predates the safety rework: it still calls
  `api/utils/logger.js` an "in-memory trade log + kill-switch state" — the
  exact defect that was fixed — and its env table omits the Upstash, risk,
  and contract variables.

## Deliverables

- `api/` — the 10 modules and 3 test files above; no runtime dependencies.
- `src/` + `index.html` + `public/` — the strategy gallery; `vercel.json`,
  `vite.config.js`, `tailwind.config.js`, `postcss.config.js`.
- `.env.example` — every variable the code reads, placeholder values only.
- `CLAUDE.md` — the safety contract; append to it when the contract grows.
- The Pine collection stays as inherited (root + `public/strategies/`
  duplication acknowledged, not resolved).

Run commands:

```
npm test              # 21 safety tests, node:test, runs with zero installs
npm run test:safety   # safety suite only
npm run dev           # Vite gallery (requires npm install first)
```

## Definition of done

This repo is **not a finished deployed system**; it is a safe-by-construction
execution arm awaiting deliberate activation. Done, for what exists, means:

- `npm test` green with no `node_modules` installed — **verified 2026-08-27:
  21/21 pass** (contract computation, cold-start kill visibility, fail-closed
  store behaviour, idempotency, every risk limit, weekend refusal).
- `src/data/strategies.js` entries match `public/strategies/` 1:1 —
  **verified: 54 = 54**.
- No secret, token, or account id committed anywhere — **verified: env reads
  only; `.env.example` is placeholders; no `.env` in the tree**.
- Deployment (Vercel project, Upstash provisioning, TradingView alert
  wiring, `TRADOVATE_DEMO=false`) is each a separate, explicit decision by
  Bill — none has been taken as of `5786b9d`, and taking any of them is
  outside this directive.

Not verified and honestly so: the Vite frontend build (`npm run build`) was
not executed on 2026-08-27 because `node_modules` is not installed; broker
modules have never been exercised against a live or demo API from this repo.
