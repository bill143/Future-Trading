import { Link } from 'react-router-dom'
import {
  TrendingUp,
  BarChart2,
  Cpu,
  Zap,
  Activity,
  ArrowRight,
  Award,
  BookOpen,
  Target,
  Shield,
} from 'lucide-react'
import StatsCard from '../components/StatsCard.jsx'
import StrategyCard from '../components/StrategyCard.jsx'
import { strategies, getFeatured, CATEGORIES, STATS } from '../data/strategies.js'
import { usePageTitle } from '../hooks/usePageTitle.js'

const CATEGORY_ICONS = {
  futures: TrendingUp,
  options: BarChart2,
  indicators: Activity,
  'ai-ml': Cpu,
  utilities: Zap,
}

export default function Dashboard() {
  usePageTitle('Dashboard')
  const featured = getFeatured()

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10 animate-fade-in">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-2xl bg-dark-800 border border-dark-600 p-8 md:p-12">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-brand-blue/5 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-brand-green/5 blur-3xl" />
          {/* Grid pattern */}
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage: 'linear-gradient(rgba(59,130,246,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.06) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-3">
              <span className="live-dot" />
              <span className="text-xs font-medium text-brand-green tracking-wide">LIVE TRADING PLATFORM</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-white leading-tight tracking-tight mb-3">
              Elite Pine Script
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-blue to-brand-green">
                Trading Strategies
              </span>
            </h1>
            <p className="text-gray-400 text-base leading-relaxed max-w-xl">
              Professional-grade futures and options trading strategies for ES, NQ, SPX, and GOLD markets.
              Built with Pine Script v5 for TradingView. Accuracy-tested, no-repaint, and bot-ready.
            </p>
            <div className="flex flex-wrap gap-3 mt-6">
              <Link to="/strategies" className="btn-primary">
                Browse Strategies <ArrowRight size={14} />
              </Link>
              <Link to="/gallery" className="btn-secondary">
                View Results <BarChart2 size={14} />
              </Link>
            </div>
          </div>

          {/* Quick stats column */}
          <div className="grid grid-cols-2 gap-3 md:min-w-[220px]">
            {[
              { label: 'Strategies', value: STATS.totalStrategies, color: 'text-brand-blue' },
              { label: 'Futures', value: STATS.futuresCount, color: 'text-brand-green' },
              { label: 'Options', value: STATS.optionsCount, color: 'text-brand-gold' },
              { label: 'AI / ML', value: STATS.aiMlCount, color: 'text-brand-purple' },
            ].map((s) => (
              <div key={s.label} className="bg-dark-700/60 border border-dark-600 rounded-xl p-4 text-center">
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-gray-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Row */}
      <section>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatsCard
            title="Best Accuracy"
            value="90%"
            subtitle="trade-futures.txt"
            color="green"
            icon={Target}
          />
          <StatsCard
            title="Total Scripts"
            value={`${STATS.totalStrategies}`}
            subtitle="Pine Script v5"
            color="blue"
            icon={BookOpen}
          />
          <StatsCard
            title="Markets Covered"
            value="5"
            subtitle="ES, NQ, SPX, SPY, GOLD"
            color="gold"
            icon={Award}
          />
          <StatsCard
            title="No-Repaint"
            value="8+"
            subtitle="confirmed signal scripts"
            color="purple"
            icon={Shield}
          />
        </div>
      </section>

      {/* Categories overview */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <h2 className="section-title">Strategy Categories</h2>
          <Link to="/strategies" className="btn-ghost text-xs">
            View all <ArrowRight size={12} />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {Object.values(CATEGORIES).map((cat) => {
            const Icon = CATEGORY_ICONS[cat.id] || Activity
            const count = strategies.filter((s) => s.category === cat.id).length
            const colorClasses = {
              blue: 'text-brand-blue bg-brand-blue/10 border-brand-blue/20',
              gold: 'text-brand-gold bg-brand-gold/10 border-brand-gold/20',
              green: 'text-brand-green bg-brand-green/10 border-brand-green/20',
              purple: 'text-brand-purple bg-brand-purple/10 border-brand-purple/20',
              gray: 'text-gray-400 bg-dark-600 border-dark-500',
            }
            const textColor = {
              blue: 'text-brand-blue',
              gold: 'text-brand-gold',
              green: 'text-brand-green',
              purple: 'text-brand-purple',
              gray: 'text-gray-400',
            }
            return (
              <Link
                key={cat.id}
                to={`/strategies?category=${cat.id}`}
                className="card-hover group flex flex-col gap-3"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${colorClasses[cat.color]}`}>
                  <Icon size={18} />
                </div>
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-xl font-bold ${textColor[cat.color]}`}>{count}</span>
                    <span className="text-xs text-gray-600">scripts</span>
                  </div>
                  <h3 className="text-sm font-semibold text-gray-200 group-hover:text-white mt-0.5">
                    {cat.shortLabel}
                  </h3>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 mt-auto">
                  {cat.description}
                </p>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Featured Strategies */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <h2 className="section-title">Featured Strategies</h2>
          <Link to="/strategies" className="btn-ghost text-xs">
            All strategies <ArrowRight size={12} />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {featured.slice(0, 6).map((s) => (
            <StrategyCard key={s.id} strategy={s} />
          ))}
        </div>
      </section>

      {/* Key Highlights */}
      <section>
        <h2 className="section-title mb-5">Platform Highlights</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              icon: Shield,
              title: 'No-Repaint Signals',
              description:
                'Multiple ES futures strategies designed with no-repaint logic — signals trigger only on confirmed candle closes.',
              color: 'text-brand-green',
              bg: 'bg-brand-green/10 border-brand-green/20',
            },
            {
              icon: Cpu,
              title: 'AI / ML Enhanced',
              description:
                'Next-generation AI prediction systems combining RSI, MACD, EMA, and trend analysis in a single Pine Script dashboard.',
              color: 'text-brand-purple',
              bg: 'bg-brand-purple/10 border-brand-purple/20',
            },
            {
              icon: Zap,
              title: 'Webhook & Bot Ready',
              description:
                'Alert conditions built for webhook integration with Tradier, Schwab API, and custom auto-trading bots.',
              color: 'text-brand-blue',
              bg: 'bg-brand-blue/10 border-brand-blue/20',
            },
          ].map((h) => (
            <div key={h.title} className="card flex flex-col gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${h.bg}`}>
                <h.icon size={18} className={h.color} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-100 mb-1.5">{h.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{h.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Call to action */}
      <section className="rounded-2xl bg-gradient-to-r from-dark-800 to-dark-700 border border-dark-600 p-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h2 className="text-lg font-bold text-white mb-1">Ready to start trading?</h2>
          <p className="text-sm text-gray-400">
            Browse all {STATS.totalStrategies} strategies, view Pine Script code, and copy directly to TradingView.
          </p>
        </div>
        <div className="flex gap-3 flex-shrink-0">
          <Link to="/strategies" className="btn-primary">
            Explore Strategies <ArrowRight size={14} />
          </Link>
        </div>
      </section>
    </div>
  )
}
