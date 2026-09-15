"""
NX-SBX v1 offline replication (NEXUS SignalBox Rebuild v1) on Databento MNQ 5m.

Replicates NEXUS_SignalBox_Rebuild_v1.pine bar-for-bar on the local Databento
MNQ.c.0 5-minute file, following the NEXUS offline runner conventions
(NEXUS_AUTO/offline): canonical America/Chicago frame from data.py, entries fill
at the next bar open, and when one bar touches both the stop and a target the
STOP is taken first (pessimistic).

Costs match the Pine defaults: 2 contracts, $0.75 commission per contract per
fill, 1 tick slippage on market and stop fills (none on limit fills), $50,000
initial capital.

Pine details reproduced deliberately:
  * Exit levels on the fill bar are anchored to the SIGNAL bar close (Pine
    places strategy.exit on the signal bar with base=close); from the next bar
    they are anchored to the fill price (strategy.position_avg_price).
  * TP1 closes 50% at 1R; the stop moves to breakeven (+1 tick) only from the
    bar AFTER TP1 fills (Pine re-issues the exit on bar close).
  * TP2 = opposing FVG edge when it lies beyond TP1, else 2R.
  * Flatten at the first bar starting >= 14:55 CT at that bar's close.
  * strategy.risk.max_intraday_loss(1000): realised + open P&L <= -1000 at a
    bar close flattens and locks the calendar day.
  * A position is counted once (entry), not per partial exit. |net| <= $10 is
    breakeven, not a win. IS = first two-thirds of positions, OOS = final third.

Assumption (not verifiable against Pine internals): ta.hma(21) is computed as
wma(2*wma(c,10) - wma(c,21), 5).
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from dataclasses import dataclass, asdict
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, r"C:\dev\Trading\NEXUS_AUTO\offline")
import data as dataio  # noqa: E402

TICK = 0.25
TICK_VALUE = 0.50          # MNQ: $2 per point -> $0.50 per 0.25 tick
PT_VALUE = 2.0


@dataclass
class Params:
    dir_mode: str = "Both"          # Both | Long Only | Short Only
    qty: int = 2
    win_start: int = 8 * 60 + 30    # minutes, CT
    win_end: int = 14 * 60 + 45     # exclusive (session 0830-1445)
    flat_hhmm: int = 1455
    max_trades: int = 3
    daily_loss: float = 1000.0
    hma_len: int = 21
    swing_len: int = 3
    sweep_win: int = 6
    atr_len: int = 14
    disp_mult: float = 0.8
    need_mss: bool = False
    buf_ticks: int = 4
    atr_floor: float = 1.0
    max_stop_pt: float = 60.0
    tp1_r: float = 1.0
    tp2_r: float = 2.0
    be_ticks: int = 1
    use_fvg_tp: bool = True
    commission: float = 0.75        # per contract per fill
    slippage_ticks: int = 1
    initial_capital: float = 50_000.0
    be_tol: float = 10.0


# ───────────────────────── indicators ─────────────────────────
def wma(x: np.ndarray, n: int) -> np.ndarray:
    out = np.full(len(x), np.nan)
    if n <= 0 or len(x) < n:
        return out
    w = np.arange(1, n + 1, dtype=float)
    ws = w.sum()
    for i in range(n - 1, len(x)):
        seg = x[i - n + 1:i + 1]
        if np.isnan(seg).any():
            continue
        out[i] = float(np.dot(seg, w) / ws)
    return out


def hma(x: np.ndarray, n: int) -> np.ndarray:
    half = int(n / 2)
    sq = int(round(math.sqrt(n)))
    return wma(2.0 * wma(x, half) - wma(x, n), sq)


def atr_rma(h: np.ndarray, l: np.ndarray, c: np.ndarray, n: int) -> np.ndarray:
    tr = np.empty(len(h))
    tr[0] = h[0] - l[0]
    for i in range(1, len(h)):
        tr[i] = max(h[i] - l[i], abs(h[i] - c[i - 1]), abs(l[i] - c[i - 1]))
    out = np.full(len(h), np.nan)
    if len(h) < n:
        return out
    out[n - 1] = tr[:n].mean()
    for i in range(n, len(h)):
        out[i] = (out[i - 1] * (n - 1) + tr[i]) / n
    return out


def pivots(high: np.ndarray, low: np.ndarray, k: int):
    """ta.pivothigh/pivotlow(k, k): value known at bar i for centre i-k.
    Left side strictly higher/lower, right side higher-or-equal/lower-or-equal."""
    n = len(high)
    ph = np.full(n, np.nan)
    pl = np.full(n, np.nan)
    for i in range(2 * k, n):
        c = i - k
        hc, lc = high[c], low[c]
        okh = all(hc > high[c - j] for j in range(1, k + 1)) and all(hc >= high[c + j] for j in range(1, k + 1))
        okl = all(lc < low[c - j] for j in range(1, k + 1)) and all(lc <= low[c + j] for j in range(1, k + 1))
        if okh:
            ph[i] = hc
        if okl:
            pl[i] = lc
    return ph, pl


# ───────────────────────── signals ─────────────────────────
def build_signals(df: pd.DataFrame, p: Params) -> pd.DataFrame:
    """Per-bar signal evaluation mirroring the Pine script (state carried bar to bar).
    Entry gating that depends on execution state (flat, tradesToday, daily lock)
    is applied in run(); this returns the raw + session-gated conditions."""
    o = df["open"].values.astype(float)
    h = df["high"].values.astype(float)
    l = df["low"].values.astype(float)
    c = df["close"].values.astype(float)
    n = len(df)
    idx = df.index
    mins = (idx.hour * 60 + idx.minute).values
    hhmm = (idx.hour * 100 + idx.minute).values
    in_window = (mins >= p.win_start) & (mins < p.win_end)

    atr = atr_rma(h, l, c, p.atr_len)
    hm = hma(c, p.hma_len)
    trend_up = np.zeros(n, bool)
    trend_dn = np.zeros(n, bool)
    trend_up[1:] = (hm[1:] > hm[:-1])
    trend_dn[1:] = (hm[1:] < hm[:-1])
    ph, pl = pivots(h, l, p.swing_len)

    body = np.abs(c - o)
    disp_dn = (c < o) & (body >= p.disp_mult * atr)
    disp_up = (c > o) & (body >= p.disp_mult * atr)
    bear_fvg = np.zeros(n, bool)
    bull_fvg = np.zeros(n, bool)
    bear_fvg[2:] = h[2:] < l[:-2]
    bull_fvg[2:] = l[2:] > h[:-2]

    sh_lvl = sh_ext = np.nan
    sh_bar = None
    sl_lvl = sl_ext = np.nan
    sl_bar = None
    bull_top = bull_bot = np.nan
    bear_bot = bear_top = np.nan

    raw_short = np.zeros(n, bool)
    raw_long = np.zeros(n, bool)
    s_risk = np.full(n, np.nan)
    l_risk = np.full(n, np.nan)
    s_stop = np.full(n, np.nan)
    l_stop = np.full(n, np.nan)
    s_fvg_tp = np.full(n, np.nan)
    l_fvg_tp = np.full(n, np.nan)
    swept_hi_arr = np.zeros(n, bool)
    swept_lo_arr = np.zeros(n, bool)
    reset_short = np.zeros(n, bool)
    reset_long = np.zeros(n, bool)

    for i in range(n):
        if not np.isnan(ph[i]):
            sh_lvl, sh_bar, sh_ext = ph[i], None, np.nan
        if not np.isnan(pl[i]):
            sl_lvl, sl_bar, sl_ext = pl[i], None, np.nan

        if not np.isnan(sh_lvl) and sh_bar is None and h[i] > sh_lvl:
            sh_bar, sh_ext = i, h[i]
        elif sh_bar is not None:
            sh_ext = max(sh_ext, h[i])
        if not np.isnan(sl_lvl) and sl_bar is None and l[i] < sl_lvl:
            sl_bar, sl_ext = i, l[i]
        elif sl_bar is not None:
            sl_ext = min(sl_ext, l[i])

        swept_high = sh_bar is not None and (i - sh_bar) <= p.sweep_win and c[i] < sh_lvl
        swept_low = sl_bar is not None and (i - sl_bar) <= p.sweep_win and c[i] > sl_lvl
        swept_hi_arr[i], swept_lo_arr[i] = swept_high, swept_low

        mss_dn = (not np.isnan(sl_lvl)) and c[i] < sl_lvl
        mss_up = (not np.isnan(sh_lvl)) and c[i] > sh_lvl
        struct_dn = mss_dn if p.need_mss else (mss_dn or bear_fvg[i])
        struct_up = mss_up if p.need_mss else (mss_up or bull_fvg[i])

        # opposing FVG targets (set, then invalidate, same bar order as Pine)
        if bull_fvg[i]:
            bull_top, bull_bot = l[i], h[i - 2]
        if bear_fvg[i]:
            bear_bot, bear_top = h[i], l[i - 2]
        if not np.isnan(bull_bot) and l[i] <= bull_bot:
            bull_top = bull_bot = np.nan
        if not np.isnan(bear_top) and h[i] >= bear_top:
            bear_bot = bear_top = np.nan

        a = atr[i]
        if not np.isnan(a):
            ss = max((sh_ext if not np.isnan(sh_ext) else h[i]) + p.buf_ticks * TICK, c[i] + p.atr_floor * a)
            ls = min((sl_ext if not np.isnan(sl_ext) else l[i]) - p.buf_ticks * TICK, c[i] - p.atr_floor * a)
            s_stop[i], l_stop[i] = ss, ls
            s_risk[i], l_risk[i] = ss - c[i], c[i] - ls

        raw_short[i] = bool(swept_high and disp_dn[i] and struct_dn and trend_dn[i])
        raw_long[i] = bool(swept_low and disp_up[i] and struct_up and trend_up[i])

        if raw_short[i] and not np.isnan(s_risk[i]):
            s_fvg_tp[i] = bull_top if (p.use_fvg_tp and not np.isnan(bull_top)
                                       and bull_top < c[i] - p.tp1_r * s_risk[i]) else np.nan
        if raw_long[i] and not np.isnan(l_risk[i]):
            l_fvg_tp[i] = bear_bot if (p.use_fvg_tp and not np.isnan(bear_bot)
                                       and bear_bot > c[i] + p.tp1_r * l_risk[i]) else np.nan

        # Pine clears the swept level once an entry fires (shBar/shLvl := na).
        # The only execution-state gates not known here are flat/tradesToday/
        # daily lock; the clear is mirrored on every bar where an entry is
        # otherwise possible so the level state machine stays identical.
        can_trade = in_window[i] and hhmm[i] < p.flat_hhmm
        if can_trade and raw_short[i] and not np.isnan(s_risk[i]) and s_risk[i] <= p.max_stop_pt \
                and p.dir_mode != "Long Only":
            sh_bar, sh_lvl = None, np.nan
            reset_short[i] = True
        elif can_trade and raw_long[i] and not np.isnan(l_risk[i]) and l_risk[i] <= p.max_stop_pt \
                and p.dir_mode != "Short Only":
            sl_bar, sl_lvl = None, np.nan
            reset_long[i] = True

    out = pd.DataFrame(index=df.index)
    out["atr"] = atr
    out["hma"] = hm
    out["trend_up"], out["trend_dn"] = trend_up, trend_dn
    out["disp_dn"], out["disp_up"] = disp_dn, disp_up
    out["swept_high"], out["swept_low"] = swept_hi_arr, swept_lo_arr
    out["raw_short"], out["raw_long"] = raw_short, raw_long
    out["s_risk"], out["l_risk"] = s_risk, l_risk
    out["s_stop"], out["l_stop"] = s_stop, l_stop
    out["s_fvg_tp"], out["l_fvg_tp"] = s_fvg_tp, l_fvg_tp
    out["in_window"] = in_window
    out["hhmm"] = hhmm
    out["can_trade"] = in_window & (hhmm < p.flat_hhmm)
    return out


# ───────────────────────── execution ─────────────────────────
def _rt(x: float) -> float:
    return round(x / TICK) * TICK


def run(df: pd.DataFrame, p: Params) -> pd.DataFrame:
    """Execute the strategy. Returns one row per POSITION (entry), with legs."""
    sig = build_signals(df, p)
    o = df["open"].values.astype(float)
    h = df["high"].values.astype(float)
    l = df["low"].values.astype(float)
    c = df["close"].values.astype(float)
    n = len(df)
    idx = df.index
    day = idx.normalize()
    hhmm = sig["hhmm"].values
    can_trade = sig["can_trade"].values
    raw_s, raw_l = sig["raw_short"].values, sig["raw_long"].values
    s_risk, l_risk = sig["s_risk"].values, sig["l_risk"].values
    s_fvg, l_fvg = sig["s_fvg_tp"].values, sig["l_fvg_tp"].values
    slip = p.slippage_ticks * TICK
    allow_long = p.dir_mode != "Short Only"
    allow_short = p.dir_mode != "Long Only"

    positions = []
    st = dict(pos=0, qty_open=0, fill_px=0.0, sig_close=0.0, t_risk=0.0, t_fvg=np.nan,
              tp1_done=False, tp1_bar=-1, entry_i=-1, legs=[], equity=p.initial_capital,
              day_realised=0.0)
    pending = 0
    pending_risk = 0.0
    pending_fvg = np.nan
    pending_sigclose = 0.0
    cur_day = None
    trades_today = 0
    day_locked = False

    def leg_pnl(direction, q, entry, exit_px):
        return (exit_px - entry) * direction * PT_VALUE * q

    def close_position(i, reason):
        legs = st["legs"]
        gross = sum(g for (_, _, _, _, g, _) in legs)
        comm = sum(cm for (_, _, _, _, _, cm) in legs) + p.commission * p.qty  # entry commission
        net = gross - comm
        st["equity"] += net
        st["day_realised"] += net
        positions.append(dict(
            entry_time=idx[st["entry_i"]], exit_time=idx[i], dir=("LONG" if st["pos"] > 0 else "SHORT"),
            contracts=p.qty, entry_px=st["fill_px"], risk_pts=round(st["t_risk"], 2),
            exits=";".join("%s@%.2fx%d" % (r, px, q) for (_, q, px, r, _, _) in legs),
            reason=reason, gross=round(gross, 2), commission=round(comm, 2), net=round(net, 2),
            equity=round(st["equity"], 2), bars_held=int(i - st["entry_i"])))
        st["pos"], st["qty_open"], st["legs"] = 0, 0, []

    for i in range(n):
        d = day[i]
        if d != cur_day:
            cur_day, trades_today, day_locked = d, 0, False
            st["day_realised"] = 0.0

        # ---- fill a pending entry at this bar's open --------------------
        if pending != 0 and st["pos"] == 0:
            st["pos"] = pending
            st["fill_px"] = _rt(o[i] + pending * slip)
            st["qty_open"] = p.qty
            st["t_risk"], st["t_fvg"], st["sig_close"] = pending_risk, pending_fvg, pending_sigclose
            st["tp1_done"], st["tp1_bar"], st["entry_i"], st["legs"] = False, -1, i, []
            pending = 0
            trades_today += 1

        # ---- manage an open position (levels active during this bar) ----
        if st["pos"] != 0:
            pos = st["pos"]
            base = st["sig_close"] if i == st["entry_i"] else st["fill_px"]
            t_risk = st["t_risk"]
            stop_init = _rt(base - pos * t_risk)
            tp1 = _rt(base + pos * p.tp1_r * t_risk)
            tp2 = _rt(st["t_fvg"]) if not np.isnan(st["t_fvg"]) else _rt(base + pos * p.tp2_r * t_risk)
            be_stop = _rt(base + pos * p.be_ticks * TICK)
            be_active = st["tp1_done"] and i > st["tp1_bar"]
            stop_lvl = be_stop if be_active else stop_init
            stop_reason = "BE" if be_active else "SL"

            stop_hit = (l[i] <= stop_lvl) if pos > 0 else (h[i] >= stop_lvl)
            if stop_hit:
                raw_px = o[i] if ((pos > 0 and o[i] < stop_lvl) or (pos < 0 and o[i] > stop_lvl)) else stop_lvl
                px = _rt(raw_px - pos * slip)
                q = st["qty_open"]
                st["legs"].append((idx[i], q, px, stop_reason, leg_pnl(pos, q, st["fill_px"], px), p.commission * q))
                close_position(i, stop_reason)
            else:
                if not st["tp1_done"]:
                    tp1_hit = (h[i] >= tp1) if pos > 0 else (l[i] <= tp1)
                    if tp1_hit:
                        raw_px = o[i] if ((pos > 0 and o[i] > tp1) or (pos < 0 and o[i] < tp1)) else tp1
                        q1 = p.qty // 2
                        st["legs"].append((idx[i], q1, raw_px, "TP1", leg_pnl(pos, q1, st["fill_px"], raw_px), p.commission * q1))
                        st["qty_open"] -= q1
                        st["tp1_done"], st["tp1_bar"] = True, i
                if st["pos"] != 0 and st["qty_open"] > 0:
                    tp2_hit = (h[i] >= tp2) if pos > 0 else (l[i] <= tp2)
                    if tp2_hit:
                        raw_px = o[i] if ((pos > 0 and o[i] > tp2) or (pos < 0 and o[i] < tp2)) else tp2
                        q = st["qty_open"]
                        st["legs"].append((idx[i], q, raw_px, "TP2", leg_pnl(pos, q, st["fill_px"], raw_px), p.commission * q))
                        close_position(i, "TP2")
            # ---- end-of-day flatten at this bar's close ----------------------
            if st["pos"] != 0 and hhmm[i] >= p.flat_hhmm:
                pos = st["pos"]
                px = _rt(c[i] - pos * slip)
                q = st["qty_open"]
                st["legs"].append((idx[i], q, px, "EOD", leg_pnl(pos, q, st["fill_px"], px), p.commission * q))
                close_position(i, "EOD")
            # ---- max intraday loss (realised + open) at bar close -----------
            if st["pos"] != 0:
                pos = st["pos"]
                open_pl = leg_pnl(pos, st["qty_open"], st["fill_px"], c[i]) + sum(g for (_, _, _, _, g, _) in st["legs"])
                if st["day_realised"] + open_pl <= -p.daily_loss:
                    px = _rt(c[i] - pos * slip)
                    q = st["qty_open"]
                    st["legs"].append((idx[i], q, px, "RISK", leg_pnl(pos, q, st["fill_px"], px), p.commission * q))
                    close_position(i, "RISK")
                    day_locked = True
        if st["pos"] == 0 and st["day_realised"] <= -p.daily_loss:
            day_locked = True

        # ---- new signal on this bar's close -> fill next open --------------
        if st["pos"] == 0 and pending == 0 and can_trade[i] and trades_today < p.max_trades and not day_locked:
            short_sig = allow_short and raw_s[i] and not np.isnan(s_risk[i]) and s_risk[i] <= p.max_stop_pt
            long_sig = allow_long and raw_l[i] and not np.isnan(l_risk[i]) and l_risk[i] <= p.max_stop_pt and not short_sig
            if short_sig or long_sig:
                pending = -1 if short_sig else 1
                pending_risk = s_risk[i] if short_sig else l_risk[i]
                pending_fvg = s_fvg[i] if short_sig else l_fvg[i]
                pending_sigclose = c[i]

    return pd.DataFrame(positions)


# ───────────────────────── audit metrics ─────────────────────────
def classify(net: float, tol: float) -> str:
    if net > tol:
        return "WIN"
    if net < -tol:
        return "LOSS"
    return "BE"


def pf(nets) -> float | None:
    nets = np.asarray(list(nets), dtype=float)
    gp = nets[nets > 0].sum()
    gl = -nets[nets < 0].sum()
    if gl > 0:
        return float(gp / gl)
    return None


def metrics(t: pd.DataFrame, tol: float) -> dict:
    if t is None or not len(t):
        return dict(positions=0, pf_all=None, pf_is=None, pf_oos=None, win_pct=None, be=0,
                    wins=0, losses=0, net=0.0, max_dd=0.0, is_positions=0, oos_positions=0)
    nets = t["net"].values.astype(float)
    n = len(nets)
    is_n = n - int(math.floor(n / 3.0))
    cls = [classify(x, tol) for x in nets]
    eq = np.concatenate([[0.0], np.cumsum(nets)])      # peak starts at initial equity
    dd = float((eq - np.maximum.accumulate(eq)).min())
    return dict(
        positions=n, pf_all=pf(nets), pf_is=pf(nets[:is_n]), pf_oos=pf(nets[is_n:]),
        win_pct=100.0 * cls.count("WIN") / n, be=cls.count("BE"), wins=cls.count("WIN"),
        losses=cls.count("LOSS"), net=float(nets.sum()), max_dd=dd,
        is_positions=is_n, oos_positions=n - is_n)


def gate(m: dict, pf_min=1.30, n_min=40) -> str:
    ok = (m["pf_all"] or 0) >= pf_min and m["positions"] >= n_min and (m["pf_oos"] or 0) >= pf_min
    return "PASS" if ok else "FAIL"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("csv", type=Path)
    ap.add_argument("--tz-source", default=None)
    ap.add_argument("--start", default=None)
    ap.add_argument("--end", default=None)
    ap.add_argument("--direction", default="Both", choices=["Both", "Long Only", "Short Only"])
    ap.add_argument("--trades", type=Path)
    ap.add_argument("--json", type=Path)
    ap.add_argument("--signals", type=Path, help="write per-bar signal diagnostics")
    a = ap.parse_args()

    df = dataio.load(a.csv, a.tz_source)
    chk = dataio.integrity(df)
    if chk["bars_high_lt_low"] or chk["bars_oc_outside_hl"]:
        raise SystemExit("corrupt feed, refusing to run: %s" % chk)
    if a.start:
        df = df.loc[str(a.start):]
    if a.end:
        df = df.loc[:str(a.end)]
    p = Params(dir_mode=a.direction)
    t = run(df, p)
    m = metrics(t, p.be_tol)
    m["gate"] = gate(m)
    m["direction"] = a.direction
    m["bars"] = int(len(df))
    m["first_bar"] = str(df.index.min())
    m["last_bar"] = str(df.index.max())
    if len(t):
        m["first_trade"] = str(t["entry_time"].iloc[0])
        m["last_trade"] = str(t["exit_time"].iloc[-1])
        m["exit_reasons"] = {k: int(v) for k, v in t["reason"].value_counts().items()}
    if a.signals:
        s = build_signals(df, p)
        s["raw_any"] = s["raw_short"] | s["raw_long"]
        m["raw_signals"] = int(s["raw_any"].sum())
        m["raw_signals_in_window"] = int((s["raw_any"] & s["can_trade"]).sum())
        m["swept_high_bars"] = int(s["swept_high"].sum())
        m["swept_low_bars"] = int(s["swept_low"].sum())
        m["disp_bars"] = int((s["disp_dn"] | s["disp_up"]).sum())
        s.to_csv(a.signals)
    print(json.dumps(m, indent=2, default=str))
    if a.trades:
        t.to_csv(a.trades, index=False)
    if a.json:
        a.json.write_text(json.dumps(dict(m, params=asdict(p)), indent=2, default=str), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
