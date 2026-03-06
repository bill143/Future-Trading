import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Clock,
  Tag,
  TrendingUp,
  BarChart2,
  Activity,
  Cpu,
  Zap,
  ExternalLink,
  Star,
  FileCode,
} from 'lucide-react'
import CodeViewer from '../components/CodeViewer.jsx'
import StrategyCard from '../components/StrategyCard.jsx'
import { getById, strategies, CATEGORIES } from '../data/strategies.js'
import { usePageTitle } from '../hooks/usePageTitle.js'

const CATEGORY_ICONS = {
  futures: TrendingUp,
  options: BarChart2,
  indicators: Activity,
  'ai-ml': Cpu,
  utilities: Zap,
}

const COLOR_MAP = {
  blue: {
    badge: 'badge-blue',
    iconBg: 'bg-brand-blue/10 border-brand-blue/20 text-brand-blue',
    accent: 'text-brand-blue',
    border: 'border-brand-blue/30',
  },
  gold: {
    badge: 'badge-gold',
    iconBg: 'bg-brand-gold/10 border-brand-gold/20 text-brand-gold',
    accent: 'text-brand-gold',
    border: 'border-brand-gold/30',
  },
  green: {
    badge: 'badge-green',
    iconBg: 'bg-brand-green/10 border-brand-green/20 text-brand-green',
    accent: 'text-brand-green',
    border: 'border-brand-green/30',
  },
  purple: {
    badge: 'badge-purple',
    iconBg: 'bg-brand-purple/10 border-brand-purple/20 text-brand-purple',
    accent: 'text-brand-purple',
    border: 'border-brand-purple/30',
  },
  gray: {
    badge: 'badge-gray',
    iconBg: 'bg-dark-600 border-dark-500 text-gray-400',
    accent: 'text-gray-400',
    border: 'border-dark-500',
  },
}

export default function StrategyDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const strategy = getById(id)
  usePageTitle(strategy?.name ?? 'Strategy not found')

  if (!strategy) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 flex flex-col items-center text-center">
        <FileCode size={48} className="text-gray-700 mb-4" />
        <h1 className="text-xl font-bold text-gray-300 mb-2">Strategy not found</h1>
        <p className="text-sm text-gray-500 mb-6">The strategy "{id}" doesn't exist in the library.</p>
        <Link to="/strategies" className="btn-primary">
          <ArrowLeft size={14} /> Back to Strategies
        </Link>
      </div>
    )
  }

  const category = CATEGORIES[strategy.category?.toUpperCase().replace('-', '_')] ||
    Object.values(CATEGORIES).find((c) => c.id === strategy.category)
  const colors = COLOR_MAP[category?.color || 'gray']
  const CategoryIcon = CATEGORY_ICONS[strategy.category] || Activity

  // Related strategies (same category, excluding current)
  const related = strategies
    .filter((s) => s.category === strategy.category && s.id !== strategy.id)
    .slice(0, 3)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link to="/strategies" className="hover:text-gray-300 flex items-center gap-1 transition-colors">
          <ArrowLeft size={13} /> Strategies
        </Link>
        <span>/</span>
        <span className={`font-medium ${colors.accent}`}>{category?.shortLabel}</span>
        <span>/</span>
        <span className="text-gray-300 truncate max-w-[200px]">{strategy.name}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header card */}
          <div className="card">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${colors.iconBg}`}>
                  <CategoryIcon size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs ${colors.badge}`}>{category?.shortLabel}</span>
                    {strategy.featured && (
                      <span className="badge-gold text-xs flex items-center gap-1">
                        <Star size={9} fill="currentColor" /> Featured
                      </span>
                    )}
                  </div>
                  <h1 className="text-xl font-bold text-white leading-tight">{strategy.name}</h1>
                </div>
              </div>
              {strategy.accuracy !== '—' && (
                <div className="text-right flex-shrink-0">
                  <div className="text-3xl font-extrabold text-brand-green leading-none">
                    {strategy.accuracy}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">accuracy</div>
                </div>
              )}
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">{strategy.description}</p>

            {/* Screenshot */}
            {strategy.screenshot && (
              <div className="mt-4 rounded-lg overflow-hidden border border-dark-600">
                <img
                  src={`/screenshots/${strategy.screenshot}`}
                  alt={strategy.name}
                  className="w-full object-cover"
                  loading="lazy"
                  decoding="async"
                  onError={(e) => { e.target.parentNode.style.display = 'none' }}
                />
              </div>
            )}
          </div>

          {/* Code Viewer */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <FileCode size={15} className="text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-300">Pine Script Source Code</h2>
            </div>
            <CodeViewer fileName={strategy.file} strategyName={strategy.name} />
          </div>
        </div>

        {/* Right: Sidebar info */}
        <div className="space-y-5">
          {/* Details card */}
          <div className="card space-y-4">
            <h2 className="text-sm font-semibold text-gray-300 border-b border-dark-600 pb-3">
              Strategy Details
            </h2>

            {[
              {
                label: 'Category',
                value: (
                  <span className={`badge text-xs ${colors.badge}`}>{category?.shortLabel}</span>
                ),
              },
              { label: 'Sub-category', value: strategy.subcategory },
              {
                label: 'Timeframes',
                value: (
                  <div className="flex flex-wrap gap-1">
                    {strategy.timeframes.map((tf) => (
                      <span key={tf} className="badge-gray text-xs">{tf}</span>
                    ))}
                  </div>
                ),
              },
              {
                label: 'Instruments',
                value: (
                  <div className="flex flex-wrap gap-1">
                    {strategy.tickers.map((t) => (
                      <span key={t} className="badge-blue text-xs">{t}</span>
                    ))}
                  </div>
                ),
              },
              { label: 'File', value: <code className="text-xs font-mono text-brand-green">{strategy.file}</code> },
              ...(strategy.accuracy !== '—'
                ? [{ label: 'Accuracy', value: <span className="text-brand-green font-bold">{strategy.accuracy}</span> }]
                : []),
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col gap-1">
                <span className="label text-gray-600">{label}</span>
                <div className="text-sm text-gray-300">{value}</div>
              </div>
            ))}

            {/* Tags */}
            {strategy.tags.length > 0 && (
              <div>
                <span className="label text-gray-600 block mb-2">Tags</span>
                <div className="flex flex-wrap gap-1.5">
                  {strategy.tags.map((tag) => (
                    <span key={tag} className="text-xs text-gray-500 bg-dark-600 px-2 py-0.5 rounded">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Usage card */}
          <div className="card space-y-3">
            <h2 className="text-sm font-semibold text-gray-300 border-b border-dark-600 pb-3">
              How to Use
            </h2>
            <ol className="space-y-2 text-sm text-gray-400">
              {[
                'Copy the Pine Script source code above',
                'Open TradingView Pine Script Editor',
                'Paste and click "Add to chart"',
                `Set timeframe to: ${strategy.timeframes[0]}`,
                `Apply to: ${strategy.tickers.slice(0, 2).join(', ')}`,
                'Configure alerts for webhook/bot integration',
              ].map((step, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-dark-600 text-xs text-gray-500 flex items-center justify-center font-medium">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <a
              href="https://www.tradingview.com/pine-script-docs/en/v5/"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary w-full justify-center mt-2 text-xs"
            >
              Pine Script Docs <ExternalLink size={11} />
            </a>
          </div>

          {/* Related strategies */}
          {related.length > 0 && (
            <div className="card space-y-3">
              <h2 className="text-sm font-semibold text-gray-300 border-b border-dark-600 pb-3">
                Related Strategies
              </h2>
              <div className="space-y-2">
                {related.map((s) => (
                  <StrategyCard key={s.id} strategy={s} compact />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
