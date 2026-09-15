"""Behavioural tests for the NX-SBX v1 offline replication (pytest)."""
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))
from nx_sbx_offline import Params, build_signals, run, metrics, classify  # noqa: E402

CT = "America/Chicago"


def make_df(bars, start="2024-01-03 09:00"):
    idx = pd.date_range(start, periods=len(bars), freq="5min", tz=CT)
    o, h, l, c = zip(*bars)
    return pd.DataFrame({"open": o, "high": h, "low": l, "close": c, "volume": 100.0}, index=idx)


def _params(**kw):
    base = dict(hma_len=2, atr_len=1, swing_len=2, sweep_win=2, disp_mult=0.1,
                atr_floor=0.01, buf_ticks=0, max_stop_pt=60.0)
    base.update(kw)
    return Params(**base)


def sweep_scenario(drift_bars: int, trigger=(105.3, 105.3, 90.0, 92.0)):
    """Swing high 105 (pivot confirmed 2 bars later), swing low 98, a break above
    105, `drift_bars` bars holding above 105, then a bearish displacement bar."""
    bars = [
        (100.0, 101.0, 99.0, 100.0),
        (100.0, 102.0, 99.0, 100.5),
        (100.5, 105.0, 98.0, 101.0),      # pivot high 105 / pivot low 98
        (101.0, 103.0, 99.0, 100.0),
        (100.0, 102.0, 99.0, 100.5),      # pivots confirmed here
        (100.5, 106.0, 100.0, 105.8),     # break above 105 -> sweep starts
    ]
    for k in range(drift_bars):
        hi = 106.2 + 0.2 * k
        bars.append((105.8, hi, 105.5, 105.7))
    bars.append(trigger)
    bars.append((92.0, 92.5, 91.0, 91.5))
    bars.append((91.5, 92.0, 90.5, 91.0))
    bars.append((91.0, 107.0, 90.5, 106.0))   # runs through the stop so any position closes
    return make_df(bars), 6 + drift_bars   # index of the trigger bar


def test_sweep_expires_after_window():
    p = _params(sweep_win=2)
    df_in, t_in = sweep_scenario(drift_bars=1)      # trigger 2 bars after the break
    s_in = build_signals(df_in, p)
    assert bool(s_in["swept_high"].iloc[t_in]) is True
    assert bool(s_in["raw_short"].iloc[t_in]) is True

    df_out, t_out = sweep_scenario(drift_bars=3)    # trigger 4 bars after the break
    s_out = build_signals(df_out, p)
    assert bool(s_out["swept_high"].iloc[t_out]) is False
    assert bool(s_out["raw_short"].iloc[t_out]) is False
    assert not s_out["raw_short"].any()
    assert len(run(df_out, p)) == 0


def test_skip_when_stop_exceeds_max():
    p = _params(max_stop_pt=60.0)
    # normal trigger -> one position
    df_ok, t_ok = sweep_scenario(drift_bars=1)
    s_ok = build_signals(df_ok, p)
    assert s_ok["s_risk"].iloc[t_ok] <= 60.0
    assert len(run(df_ok, p)) == 1
    # huge displacement: sweep extreme 106.2 vs close 25 -> stop distance 81 pts > 60
    df_big, t_big = sweep_scenario(drift_bars=1, trigger=(105.3, 105.3, 20.0, 25.0))
    s_big = build_signals(df_big, p)
    assert bool(s_big["raw_short"].iloc[t_big]) is True
    assert s_big["s_risk"].iloc[t_big] > 60.0
    assert len(run(df_big, p)) == 0


def test_be_after_tp1_not_counted_as_win():
    # classification: |net| <= tolerance is breakeven, never a win
    assert classify(1.30, 10.0) == "BE"
    assert classify(10.0, 10.0) == "BE"
    assert classify(10.01, 10.0) == "WIN"
    assert classify(-10.01, 10.0) == "LOSS"
    m = metrics(pd.DataFrame({"net": [5.0, 50.0, -30.0]}), 10.0)
    assert (m["wins"], m["be"], m["losses"]) == (1, 1, 1)
    assert abs(m["win_pct"] - 100.0 / 3.0) < 1e-9

    # execution: short with R = 2.6 pts; TP1 (1R = 101.4, tick-rounded to 101.5) fills,
    # then the +1 tick BE stop takes the second contract at a $0 leg.
    # Net = $4.50 TP1 - $3.00 commission = $1.50 -> BE, not a win.
    p = _params(sweep_win=3)
    bars = [
        (100.0, 101.0, 99.0, 100.0),
        (100.0, 102.0, 99.0, 100.5),
        (100.5, 105.0, 98.0, 101.0),
        (101.0, 103.0, 99.0, 100.0),
        (100.0, 102.0, 99.0, 100.5),
        (100.5, 106.0, 100.0, 105.8),     # break
        (105.8, 106.4, 105.5, 105.7),     # drift (low 105.5 -> bear FVG reference two bars later)
        (105.7, 106.6, 105.5, 105.6),     # drift, sweep extreme 106.6
        (105.3, 105.3, 103.0, 104.0),     # trigger: close < 105, high < low[2], displacement
        (104.0, 104.2, 101.3, 102.0),     # fill 103.75; TP1 @ 101.4 fills (levels from signal close 104)
        (102.0, 104.0, 101.8, 103.8),     # BE stop 103.5 hit -> exit 103.75 (with slippage) -> $0 leg
        (103.8, 104.0, 103.0, 103.5),
    ]
    df = make_df(bars)
    t = run(df, p)
    assert len(t) == 1
    row = t.iloc[0]
    assert row["dir"] == "SHORT"
    assert row["reason"] == "BE"
    assert "TP1@101.50x1" in row["exits"] and "BE@103.75x1" in row["exits"]
    assert abs(row["net"] - 1.50) < 1e-9
    m = metrics(t, p.be_tol)
    assert m["positions"] == 1 and m["wins"] == 0 and m["be"] == 1
    assert m["win_pct"] == 0.0
