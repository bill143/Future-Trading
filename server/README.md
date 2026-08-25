# Automated Trading Webhook Backend

A Vercel Serverless Functions backend that receives TradingView alerts and
automatically places trades on **Tradovate** (ES, NQ, GC futures) or
**Schwab** (SPX, SPY options & equities).

---

## Architecture

```
TradingView Alert
      │
      │  POST /api/webhook  { secret, broker, action, ticker, qty, … }
      ▼
┌─────────────────────┐
│   api/webhook.js    │  ← validates secret, checks kill switch
└────────┬────────────┘
         │
    ┌────┴─────┐
    │          │
    ▼          ▼
api/brokers/  api/brokers/
tradovate.js  schwab.js
    │              │
    ▼              ▼
Tradovate REST   Schwab Trader
   API v1           API
    │              │
    └──────┬───────┘
           ▼
     Trade Executed
```

### Module overview

| File | Purpose |
|------|---------|
| `api/webhook.js` | Main entry point – validates, routes, logs |
| `api/health.js` | Health check (no auth) |
| `api/trades.js` | Return recent trade log (secret-protected) |
| `api/kill.js` | Activate / deactivate broker kill switches |
| `api/brokers/tradovate.js` | Tradovate order placement & position close |
| `api/brokers/schwab.js` | Schwab order placement |
| `api/utils/logger.js` | In-memory trade log + kill-switch state |

---

## Setup Guide

### Prerequisites

- Node.js 20+
- A [Vercel](https://vercel.com) account linked to this repository
- A Tradovate account (live or demo) with API access
- A Schwab brokerage account with Developer Portal access

---

### Tradovate API Credentials

1. Log in to [https://trader.tradovate.com](https://trader.tradovate.com).
2. Go to **API** → **My Apps** → **Create New App**.
3. Set the App Name (this becomes `TRADOVATE_APP_ID`).
4. Note the **Client ID** (`TRADOVATE_CID`) and **Client Secret** (`TRADOVATE_SEC`).
5. Set `TRADOVATE_APP_VERSION` to the version string you registered (e.g. `1.0`).
6. Your account number is shown under **Account** in the Tradovate UI
   (also available via `GET /account/list`). Use this as `TRADOVATE_ACCOUNT_ID`.
7. Use `TRADOVATE_DEMO=true` and the demo endpoint while testing.
   Switch to `TRADOVATE_DEMO=false` only when you are ready for live trading.

---

### Schwab OAuth2 Refresh Token

Schwab uses OAuth2 Authorization Code flow. A **refresh token** provides
long-lived API access without requiring the user to log in repeatedly.

1. Go to [https://developer.schwab.com](https://developer.schwab.com) and
   sign in with your Schwab brokerage account.
2. Create a new app. Set the callback URL to `https://127.0.0.1` for local
   setup.
3. Note the **App Key** (`SCHWAB_CLIENT_ID`) and **App Secret**
   (`SCHWAB_CLIENT_SECRET`).
4. Generate the initial authorization URL:
   ```
   https://api.schwabapi.com/v1/oauth/authorize
     ?response_type=code
     &client_id=<SCHWAB_CLIENT_ID>
     &redirect_uri=https://127.0.0.1
   ```
5. Open the URL in a browser, log in, and approve access.
6. After approval you will be redirected to
   `https://127.0.0.1/?code=<AUTH_CODE>&session=…` — copy the `code` value.
7. Exchange the code for tokens:
   ```bash
   curl -X POST https://api.schwabapi.com/v1/oauth/token \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -H "Authorization: Basic $(echo -n '<SCHWAB_CLIENT_ID>:<SCHWAB_CLIENT_SECRET>' | base64)" \
     -d "grant_type=authorization_code&code=<AUTH_CODE>&redirect_uri=https://127.0.0.1"
   ```
8. Copy `refresh_token` from the response → this is `SCHWAB_REFRESH_TOKEN`.
9. Obtain your encrypted account hash:
   ```bash
   curl https://api.schwabapi.com/trader/v1/accounts \
     -H "Authorization: Bearer <access_token>"
   ```
   Use the `hashValue` field as `SCHWAB_ACCOUNT_HASH`.

> **Note:** Schwab refresh tokens are valid for **7 days** of inactivity.
> The webhook server automatically refreshes the access token on each request,
> which resets the 7-day clock. Set up a daily health-check ping if trading
> activity may be irregular.

---

## Environment Variables

| Variable | Description | Where to find it | Example |
|----------|-------------|-----------------|---------|
| `WEBHOOK_SECRET` | Shared secret to authenticate TradingView alerts | Generate randomly | `openssl rand -hex 32` |
| `TRADOVATE_USERNAME` | Tradovate login email | Tradovate account | `trader@example.com` |
| `TRADOVATE_PASSWORD` | Tradovate login password | Tradovate account | `Str0ngP@ss!` |
| `TRADOVATE_APP_ID` | App name registered in Tradovate Developer Portal | Tradovate → API → My Apps | `MyAlgoBot` |
| `TRADOVATE_APP_VERSION` | App version string | Tradovate → API → My Apps | `1.0` |
| `TRADOVATE_CID` | Numeric client ID | Tradovate → API → My Apps | `12345` |
| `TRADOVATE_SEC` | Client secret | Tradovate → API → My Apps | `abc123…` |
| `TRADOVATE_ACCOUNT_ID` | Numeric Tradovate account ID | Tradovate UI or `/account/list` | `654321` |
| `TRADOVATE_DEMO` | Use demo environment | Set manually | `true` |
| `SCHWAB_CLIENT_ID` | Schwab app key | Schwab Developer Portal | `…` |
| `SCHWAB_CLIENT_SECRET` | Schwab app secret | Schwab Developer Portal | `…` |
| `SCHWAB_REFRESH_TOKEN` | Long-lived OAuth2 refresh token | Auth flow (see above) | `…` |
| `SCHWAB_ACCOUNT_HASH` | Encrypted Schwab account ID | `GET /trader/v1/accounts` | `…` |

---

## TradingView Alert Setup

In TradingView, open **Alerts** → **Create Alert** → set the **Webhook URL**
to your deployed endpoint:

```
https://<your-vercel-domain>/api/webhook
```

Set **Message** to one of the JSON templates below.

### ES Futures — Buy (Tradovate)

```json
{
  "secret": "{{YOUR_WEBHOOK_SECRET}}",
  "broker": "tradovate",
  "action": "buy",
  "ticker": "ES",
  "qty": 1,
  "orderType": "Market",
  "comment": "{{strategy.order.comment}}"
}
```

### ES Futures — Sell (Tradovate)

```json
{
  "secret": "{{YOUR_WEBHOOK_SECRET}}",
  "broker": "tradovate",
  "action": "sell",
  "ticker": "ES",
  "qty": 1,
  "orderType": "Market",
  "comment": "{{strategy.order.comment}}"
}
```

### ES Futures — Close Position (Tradovate)

```json
{
  "secret": "{{YOUR_WEBHOOK_SECRET}}",
  "broker": "tradovate",
  "action": "close",
  "ticker": "ES",
  "qty": 1,
  "orderType": "Market",
  "comment": "{{strategy.order.comment}}"
}
```

### NQ Futures — Buy with Limit Price (Tradovate)

```json
{
  "secret": "{{YOUR_WEBHOOK_SECRET}}",
  "broker": "tradovate",
  "action": "buy",
  "ticker": "NQ",
  "qty": 1,
  "orderType": "Limit",
  "price": {{close}},
  "comment": "{{strategy.order.comment}}"
}
```

### SPX Options — Buy (Schwab)

```json
{
  "secret": "{{YOUR_WEBHOOK_SECRET}}",
  "broker": "schwab",
  "action": "buy",
  "ticker": "SPXW  260117C05500000",
  "qty": 1,
  "orderType": "Market",
  "comment": "{{strategy.order.comment}}"
}
```

### SPY Equity — Sell (Schwab)

```json
{
  "secret": "{{YOUR_WEBHOOK_SECRET}}",
  "broker": "schwab",
  "action": "sell",
  "ticker": "SPY",
  "qty": 10,
  "orderType": "Limit",
  "price": {{close}},
  "comment": "{{strategy.order.comment}}"
}
```

> Replace `{{YOUR_WEBHOOK_SECRET}}` with your actual `WEBHOOK_SECRET` value.
> TradingView placeholders like `{{close}}` are expanded automatically.

---

## curl Test Examples

### Health check (no auth)

```bash
curl https://<your-vercel-domain>/api/health
```

Expected response:
```json
{ "status": "ok", "timestamp": "2024-01-01T00:00:00.000Z", "brokers": ["tradovate", "schwab"], "demo": true }
```

---

### Fire a test webhook (Tradovate buy)

```bash
curl -X POST https://<your-vercel-domain>/api/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "secret": "your-random-secret-here",
    "broker": "tradovate",
    "action": "buy",
    "ticker": "ES",
    "qty": 1,
    "orderType": "Market",
    "comment": "test"
  }'
```

---

### View recent trades

```bash
curl "https://<your-vercel-domain>/api/trades?secret=your-random-secret-here"
```

---

### Kill switch — halt all trading

```bash
curl -X POST https://<your-vercel-domain>/api/kill \
  -H "Content-Type: application/json" \
  -d '{
    "secret": "your-random-secret-here",
    "broker": "all",
    "action": "kill"
  }'
```

### Kill switch — resume a specific broker

```bash
curl -X POST https://<your-vercel-domain>/api/kill \
  -H "Content-Type: application/json" \
  -d '{
    "secret": "your-random-secret-here",
    "broker": "tradovate",
    "action": "resume"
  }'
```

---

## Deploying to Vercel

### 1. Import the repository

1. Go to [https://vercel.com/new](https://vercel.com/new).
2. Import the **Future-Trading** GitHub repository.
3. Leave the framework preset as **Other** (Vercel auto-detects Vite).
4. Click **Deploy**.

### 2. Add environment variables

1. In your Vercel project, go to **Settings** → **Environment Variables**.
2. Add each variable from the table above (or from `.env.example`).
3. Set **Environment** to **Production** (and optionally Preview).
4. Click **Save** and then **Redeploy** to apply the new variables.

---

## Security Notes

- **Rotate `WEBHOOK_SECRET` regularly** — treat it like a password. Rotate it
  whenever you suspect it has been exposed (e.g. accidentally committed or
  logged). Update TradingView alerts and Vercel env vars simultaneously.

- **Always use `TRADOVATE_DEMO=true` for testing** — demo trades have no real
  monetary impact. Only switch to `false` after thorough end-to-end validation.

- **Never commit `.env`** — `.env`, `.env.local`, and `.env.production` are
  already listed in `.gitignore`. Commit only `.env.example` (with placeholder
  values, never real secrets).

- **Token masking** — the logger never records raw access tokens. If you add
  custom logging, always mask tokens as `***` before writing them anywhere.

- **Kill switch** — use `POST /api/kill` to instantly halt all automated
  trading during unexpected market events or system issues.

---

## LangChain Multi-Agent Analysis Integration

The `analysis/` Python module adds AI-powered technical, market structure,
sentiment, and fundamental analysis for ES, NQ, and YM futures.

### New endpoint: `/api/analyze`

| Method | Usage |
|--------|-------|
| `GET`  | Manual analysis (returns JSON, no trade) |
| `POST` | Analysis with optional auto-trade forwarding |

### Quick start

```bash
# Install Python dependencies
pip install -r analysis/requirements.txt

# Manual analysis via API
curl "https://<your-vercel-domain>/api/analyze?symbol=ES&timeframe=1h"

# Run Python module directly
python -m analysis.main --symbol NQ --timeframe 15m --skip-fundamental --skip-sentiment
```

See **[ANALYSIS.md](../ANALYSIS.md)** for the full architecture guide,
agent descriptions, configuration options, and customisation instructions.
