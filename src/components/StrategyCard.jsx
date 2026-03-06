import { Link } from 'react-router-dom'
import { ArrowRight, Clock, Tag } from 'lucide-react'
import { CATEGORIES } from '../data/strategies.js'

const COLOR_MAP = {
  blue: { badge: 'badge-blue', dot: 'bg-brand-blue', border: 'hover:border-brand-blue/40' },
  gold: { badge: 'badge-gold', dot: 'bg-brand-gold', border: 'hover:border-brand-gold/40' },
  green: { badge: 'badge-green', dot: 'bg-brand-green', border: 'hover:border-brand-green/40' },
  purple: { badge: 'badge-purple', dot: 'bg-brand-purple', border: 'hover:border-brand-purple/40' },
  gray: { badge: 'badge-gray', dot: 'bg-gray-500', border: 'hover:border-gray-500/40' },
}

export default function StrategyCard({ strategy, compact = false }) {
  const category = CATEGORIES[strategy.category?.toUpperCase().replace('-', '_')] ||
    Object.values(CATEGORIES).find((c) => c.id === strategy.category)
  const colors = COLOR_MAP[category?.color || 'gray']

  if (compact) {
    return (
      <Link
        to={`/strategies/${strategy.id}`}
        className={`flex items-center justify-between p-3 rounded-lg bg-dark-700 border border-dark-600 ${colors.border} hover:bg-dark-600 transition-all duration-200 group`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${colors.dot}`} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-200 truncate group-hover:text-white">{strategy.name}</p>
            <p className="text-xs text-gray-500">{strategy.subcategory} · {strategy.timeframes[0]}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          {strategy.accuracy !== '—' && (
            <span className="badge-green text-xs px-2 py-0.5">{strategy.accuracy}</span>
          )}
          <ArrowRight size={13} className="text-gray-600 group-hover:text-gray-300 transition-colors" />
        </div>
      </Link>
    )
  }

  return (
    <Link
      to={`/strategies/${strategy.id}`}
      className={`card-hover flex flex-col gap-4 group border ${colors.border} transition-all duration-200 animate-slide-up`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <div className={`w-2 h-2 rounded-full ${colors.dot} flex-shrink-0`} />
            <span className={`text-xs ${colors.badge}`}>{category?.shortLabel || strategy.category}</span>
            {strategy.featured && (
              <span className="badge bg-brand-gold/15 text-brand-gold border border-brand-gold/30 text-xs">⭐ Featured</span>
            )}
          </div>
          <h3 className="text-sm font-semibold text-gray-100 group-hover:text-white leading-tight">
            {strategy.name}
          </h3>
        </div>
        {strategy.accuracy !== '—' && (
          <div className="flex flex-col items-end flex-shrink-0">
            <span className="text-lg font-bold text-brand-green leading-none">{strategy.accuracy}</span>
            <span className="text-xs text-gray-500">accuracy</span>
          </div>
        )}
      </div>

      {/* Description */}
      <p className="text-xs text-gray-400 leading-relaxed line-clamp-3">
        {strategy.description}
      </p>

      {/* Meta */}
      <div className="flex flex-wrap items-center gap-2 mt-auto">
        <div className="flex items-center gap-1 text-gray-500">
          <Clock size={11} />
          <span className="text-xs">{strategy.timeframes.join(', ')}</span>
        </div>
        {strategy.tickers.slice(0, 3).map((ticker) => (
          <span key={ticker} className="badge-gray text-xs">{ticker}</span>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-dark-600">
        <div className="flex flex-wrap gap-1">
          {strategy.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="text-xs text-gray-600 bg-dark-600 px-2 py-0.5 rounded">
              #{tag}
            </span>
          ))}
        </div>
        <span className="text-xs text-brand-blue flex items-center gap-1 group-hover:gap-2 transition-all">
          View <ArrowRight size={11} />
        </span>
      </div>
    </Link>
  )
}
