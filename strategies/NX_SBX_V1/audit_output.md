# NX-SBX v1 audit (TradingView CSV recompute vs panel)

## Run A (Both): MATCH
- CSV: 0 exit rows -> 0 positions, PF ALL None, PF IS None, PF OOS None, BE 0, net $0.00
- Panel: PF None, closed trades 0, table positions 0, net $0

## Run B (Short Only): MATCH
- CSV: 0 exit rows -> 0 positions, PF ALL None, PF IS None, PF OOS None, BE 0, net $0.00
- Panel: PF None, closed trades 0, table positions 0, net $0

## Run C (Long Only): MATCH
- CSV: 0 exit rows -> 0 positions, PF ALL None, PF IS None, PF OOS None, BE 0, net $0.00
- Panel: PF None, closed trades 0, table positions 0, net $0

Note: TradingView's List of Trades export is disabled with zero trades; trades_A/B/C.csv carry the export header only.
