import { useState } from 'react'
import { ZoomIn, X, TrendingUp, TrendingDown, DollarSign, Calendar } from 'lucide-react'

const SCREENSHOTS = [
  {
    file: 'NQ1m.png',
    title: 'NQ 1M Live Chart',
    description: 'NQ Nasdaq E-mini 1-minute chart with active trading signals.',
    category: 'Futures',
  },
  {
    file: 'trailing-nq.png',
    title: 'NQ Trailing Strategy',
    description: 'NQM2024 futures strategy with trailing stop — 70% accuracy on 5M timeframe.',
    category: 'Futures',
  },
  {
    file: 'trailing-es.png',
    title: 'ES Trailing Strategy',
    description: 'ES futures auto-trading strategy with trailing stop management.',
    category: 'Futures',
  },
  {
    file: 'trailing.png',
    title: 'SPX Trailing BUY/SELL',
    description: 'Lux Trailing indicator on SPX with BUY and SELL signal markers.',
    category: 'Indicators',
  },
  {
    file: 'best.png',
    title: 'ES 1M Best Strategy',
    description: 'Best-performing ES 1-minute strategy with entry signals.',
    category: 'Futures',
  },
  {
    file: 'strategy-es.png',
    title: 'ES Strategy Backtest',
    description: 'ES 1M strategy backtest results showing entry and exit points.',
    category: 'Futures',
  },
  {
    file: 'spx-options.png',
    title: 'SPX Options Signals',
    description: 'SPX 30M options with TOP (blue) and BOTTOM (white) level detection.',
    category: 'Options',
  },
  {
    file: 'supr-box.png',
    title: 'SPX Options Box',
    description: 'SPX 15M options trading with CALL/PUT signal boxes.',
    category: 'Options',
  },
  {
    file: 'color-trend.png',
    title: 'Color Trend Lite',
    description: 'Color trend indicator — BLUE for uptrend, RED for downtrend.',
    category: 'Indicators',
  },
  {
    file: 'best-indicator.png',
    title: 'Best Indicator (Weak Market)',
    description: 'GC/GP signals for weak/choppy market conditions on 5M.',
    category: 'Indicators',
  },
  {
    file: 'swing.png',
    title: 'Swing Indicator',
    description: 'Swing high/low indicator for timing CALL/PUT entries and exits.',
    category: 'Indicators',
  },
  {
    file: 'high-low.png',
    title: 'Super High/Low',
    description: 'Live high and low level indicator for ETH, SPX and ES.',
    category: 'Indicators',
  },
  {
    file: 'gold.png',
    title: 'GOLD Futures Strategy',
    description: 'Gold futures (XAUUSD/GC) strategy with entry signals.',
    category: 'Futures',
  },
  {
    file: 'alert.png',
    title: 'Alert Webhook Setup',
    description: 'TradingView alert configuration for webhook/bot integration.',
    category: 'Alerts',
  },
  {
    file: 'alerts.png',
    title: 'No-Repaint Alerts',
    description: 'ES 1M no-repaint strategy with confirmed alert signals.',
    category: 'Alerts',
  },
  {
    file: 'win100.png',
    title: 'Market Crash Strategy',
    description: 'Win-99 strategy for trading during market crash conditions.',
    category: 'Strategies',
  },
  {
    file: 'today.png',
    title: 'Daily Trade Summary',
    description: 'Winning vs losing trades daily performance overview.',
    category: 'Results',
  },
  {
    file: 'gain_loss_report.png',
    title: 'Gain/Loss Report',
    description: 'Comprehensive gain and loss trading performance report.',
    category: 'Results',
  },
  {
    file: 'nq.png',
    title: 'NQ Strategy Overview',
    description: 'NQ1 futures strategy with IN/OUT signal markers.',
    category: 'Futures',
  },
  {
    file: 'nq-2022-08-30_at_22.12.05.png',
    title: 'NQ 2022-08-30 — +253 Points',
    description: 'Historical gain: PUT trade yielding 253 points on NQ.',
    category: 'Results',
    gain: '+253 pts',
    up: true,
  },
  {
    file: 'nq_2022-30-31_at_17.34.17.png',
    title: 'NQ 2022-08-31 — Evidence',
    description: 'Historical trade evidence from August 31, 2022.',
    category: 'Results',
  },
  {
    file: 'nq_2022-09-01.png',
    title: 'NQ 2022-09-01 — Evidence',
    description: 'Historical trade evidence from September 1, 2022.',
    category: 'Results',
  },
  {
    file: 'nq_2022-09-02_at_10.13.06.png',
    title: 'NQ 2022-09-02 — Evidence',
    description: 'Historical trade evidence from September 2, 2022.',
    category: 'Results',
  },
  {
    file: 'nq-2022-09-06_at_11.02.17.png',
    title: 'NQ 2022-09-06 — Evidence',
    description: 'Historical trade evidence from September 6, 2022.',
    category: 'Results',
  },
  {
    file: 'new.png',
    title: 'Latest Update',
    description: 'New strategy update screenshot.',
    category: 'Strategies',
  },
  {
    file: 'private.png',
    title: 'Private Strategy',
    description: 'Premium private strategy — available via Patreon.',
    category: 'Premium',
  },
]

const ALL_CATS = ['All', ...new Set(SCREENSHOTS.map((s) => s.category))]

export default function GalleryPage() {
  const [activeFilter, setActiveFilter] = useState('All')
  const [lightbox, setLightbox] = useState(null)

  const filtered =
    activeFilter === 'All' ? SCREENSHOTS : SCREENSHOTS.filter((s) => s.category === activeFilter)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white tracking-tight">Trading Gallery</h1>
        <p className="text-sm text-gray-400 mt-1">
          Live chart screenshots, performance results, and strategy visualizations.
        </p>
      </div>

      {/* Performance summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { icon: TrendingUp, label: 'Best Accuracy', value: '90%', color: 'text-brand-green', bg: 'bg-brand-green/10 border-brand-green/20' },
          { icon: DollarSign, label: 'Best Trade', value: '+253 pts', color: 'text-brand-gold', bg: 'bg-brand-gold/10 border-brand-gold/20' },
          { icon: Calendar, label: 'Screenshots', value: `${SCREENSHOTS.length}`, color: 'text-brand-blue', bg: 'bg-brand-blue/10 border-brand-blue/20' },
          { icon: TrendingUp, label: 'Markets', value: 'ES · NQ · SPX', color: 'text-brand-purple', bg: 'bg-brand-purple/10 border-brand-purple/20' },
        ].map((item) => (
          <div key={item.label} className={`card flex items-center gap-3 border ${item.bg}`}>
            <item.icon size={20} className={item.color} />
            <div>
              <div className={`text-lg font-bold ${item.color}`}>{item.value}</div>
              <div className="text-xs text-gray-500">{item.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        {ALL_CATS.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveFilter(cat)}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
              activeFilter === cat
                ? 'bg-brand-blue text-white'
                : 'bg-dark-700 border border-dark-600 text-gray-400 hover:text-gray-100 hover:border-dark-400'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filtered.map((item, idx) => (
          <button
            key={item.file}
            onClick={() => setLightbox(item)}
            className="group relative bg-dark-800 rounded-xl border border-dark-600 hover:border-dark-400 overflow-hidden text-left transition-all duration-200 hover:shadow-xl hover:shadow-black/30"
          >
            <div className="aspect-video bg-dark-700 relative overflow-hidden">
              <img
                src={`/screenshots/${item.file}`}
                alt={item.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                onError={(e) => {
                  e.target.src = ''
                  e.target.parentNode.innerHTML = `<div class="w-full h-full flex items-center justify-center text-gray-700 text-sm">No preview</div>`
                }}
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                <ZoomIn size={24} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              {item.gain && (
                <div className={`absolute top-2 right-2 text-xs font-bold px-2 py-1 rounded ${item.up ? 'bg-brand-green text-dark-900' : 'bg-brand-red text-white'}`}>
                  {item.gain}
                </div>
              )}
            </div>
            <div className="p-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-xs font-semibold text-gray-200 group-hover:text-white leading-tight line-clamp-1">
                  {item.title}
                </h3>
                <span className="badge-gray text-xs flex-shrink-0">{item.category}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.description}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 text-gray-400 hover:text-white p-2 rounded-lg hover:bg-dark-700 transition-colors"
            onClick={() => setLightbox(null)}
          >
            <X size={20} />
          </button>
          <div
            className="max-w-5xl w-full bg-dark-800 rounded-2xl border border-dark-600 overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={`/screenshots/${lightbox.file}`}
              alt={lightbox.title}
              className="w-full object-contain max-h-[70vh]"
            />
            <div className="p-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-white mb-1">{lightbox.title}</h3>
                <p className="text-sm text-gray-400">{lightbox.description}</p>
              </div>
              <span className="badge-gray text-xs flex-shrink-0">{lightbox.category}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
