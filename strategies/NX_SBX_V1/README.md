# NX-SBX v1 (NEXUS SignalBox Rebuild v1) — MNQ 5m backtest — REJECTED

Date: 2026-09-15. Gate: PF ALL >= 1.30 AND positions >= 40 AND PF OOS >= 1.30, costs included.

## Verdict: FAIL

| Run | Source | Positions | PF ALL | PF IS | PF OOS | Win % | BE | Net $ | Max DD $ | Gate |
|---|---|---|---|---|---|---|---|---|---|---|
| A Both | TradingView (MNQ1! 5m, 21,108 bars, 2026-05-31 -> 2026-09-15, bar magnifier on) | 0 | - | - | - | - | 0 | 0 | 0 | FAIL |
| B Short Only | TradingView | 0 | - | - | - | - | 0 | 0 | 0 | FAIL |
| C Long Only | TradingView | 0 | - | - | - | - | 0 | 0 | 0 | FAIL |
| A Both | Offline Databento MNQ.c.0 5m, 2022-11-29 -> 2026-09-02 (264,621 bars) | 123 | 0.87 | 0.88 | 0.85 | 48.8 | 1 | -1,390 | -1,658 | FAIL |
| A Both | Offline, TradingView window only (2026-05-31 -> 2026-09-02) | 1 | 0.00 | - | - | 0.0 | 0 | -222 | -222 | FAIL |
| B Short Only | Offline Databento, full history | 53 | 0.90 | 1.16 | 0.57 | 50.9 | 1 | -421 | -1,798 | FAIL |
| C Long Only | Offline Databento, full history | 72 | 0.90 | 0.79 | 1.11 | 48.6 | 0 | -653 | -1,439 | FAIL |

## Reason

1. On TradingView the strategy produced zero trades over the maximum available
   5m history (Premium limit, ~21k bars back to 2026-05-31) in all three
   direction modes. The on-chart panel showed Positions 0 / GATE FAIL and the
   Strategy Tester reported "This report requires trade data".
2. The offline replication on 3.75 years of Databento MNQ 5m data (same costs,
   America/Chicago session, next-bar-open fills, stop-first on touch of both)
   produced 123 positions with PF 0.87 (IS 0.88, OOS 0.85): sample size passes,
   profitability fails in every window and every direction mode. Not overfit
   (IS ~= OOS), simply not an edge after costs.
3. TradingView vs offline in the overlapping window: 0 vs 1 position. The one
   offline position (2026-06-15) is a stop-out; the difference is consistent
   with feed differences (MNQ1! chart vs MNQ.c.0 continuous) and the HMA/pivot
   assumptions documented in nx_sbx_offline.py, not with a missed edge.

## Files

- `NEXUS_SignalBox_Rebuild_v1.pine` — script as tested (byte-identical to the relay SOURCE block; no compile fixes).
- `trades_A.csv`, `trades_B.csv`, `trades_C.csv` — TradingView List of Trades export format; header only (export is disabled with zero trades).
- `tv_panel.json` — TradingView panel readings, history and settings actually used.
- `audit_output.json`, `audit_output.md` — pandas recompute of the TradingView CSVs vs panel (MATCH, 0 = 0).
- `nx_sbx_offline.py`, `test_nx_sbx_offline.py` — offline replication + 3 behavioural tests (all pass).
- `offline_A.json`, `offline_B.json`, `offline_C.json`, `offline_A_tvwindow.json` — offline metrics.
- `offline_trades_*.csv` — offline positions (one row per entry, partial exits listed).
- `offline_signals_A.csv` — per-bar signal diagnostics for run A.

## TradingView state

- Script `NX-SBX v1` (USER;95d51c682b4b42c991193889f4b17951 v1.0) left saved in the account.
- Strategy removed from the chart. No alerts, webhooks, or TradersPost changes.
- SENTINEL's EdgeX Pulse Layout panes were not modified; the test ran in a separate chart tab.
