import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Search, Filter, X, TrendingUp, BarChart2, Activity, Cpu, Zap, ChevronDown } from 'lucide-react'
import StrategyCard from '../components/StrategyCard.jsx'
import { strategies, CATEGORIES } from '../data/strategies.js'

const CATEGORY_ICONS = {
  futures: TrendingUp,
  options: BarChart2,
  indicators: Activity,
  'ai-ml': Cpu,
  utilities: Zap,
}

const SORT_OPTIONS = [
  { value: 'featured', label: 'Featured first' },
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'accuracy', label: 'Accuracy' },
  { value: 'category', label: 'Category' },
]

export default function StrategiesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('featured')
  const [showFilters, setShowFilters] = useState(false)
  const activeCategory = searchParams.get('category') || 'all'

  const setCategory = (cat) => {
    if (cat === 'all') {
      searchParams.delete('category')
    } else {
      searchParams.set('category', cat)
    }
    setSearchParams(searchParams)
  }

  const filtered = useMemo(() => {
    let list = [...strategies]

    if (activeCategory !== 'all') {
      list = list.filter((s) => s.category === activeCategory)
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.tags.some((t) => t.includes(q)) ||
          s.tickers.some((t) => t.toLowerCase().includes(q))
      )
    }

    if (sortBy === 'featured') {
      list = list.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0))
    } else if (sortBy === 'name') {
      list = list.sort((a, b) => a.name.localeCompare(b.name))
    } else if (sortBy === 'accuracy') {
      list = list.sort((a, b) => {
        const pA = a.accuracy === '—' ? -1 : parseFloat(a.accuracy)
        const pB = b.accuracy === '—' ? -1 : parseFloat(b.accuracy)
        return pB - pA
      })
    } else if (sortBy === 'category') {
      list = list.sort((a, b) => a.category.localeCompare(b.category))
    }

    return list
  }, [search, activeCategory, sortBy])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white tracking-tight">Strategy Library</h1>
        <p className="text-gray-400 text-sm mt-1">
          {strategies.length} Pine Script strategies for TradingView — futures, options, AI/ML and more.
        </p>
      </div>

      {/* Search + Sort row */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name, ticker, tag…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="input-field pr-8 appearance-none cursor-pointer sm:w-44"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        </div>
      </div>

      {/* Category filter pills */}
      <div className="flex flex-wrap gap-2 mb-8">
        <button
          onClick={() => setCategory('all')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
            activeCategory === 'all'
              ? 'bg-brand-blue text-white'
              : 'bg-dark-700 border border-dark-600 text-gray-400 hover:text-gray-100 hover:border-dark-400'
          }`}
        >
          All
          <span className="text-xs opacity-70">({strategies.length})</span>
        </button>
        {Object.values(CATEGORIES).map((cat) => {
          const Icon = CATEGORY_ICONS[cat.id] || Activity
          const count = strategies.filter((s) => s.category === cat.id).length
          const colorMap = {
            blue: 'bg-brand-blue/15 text-brand-blue border-brand-blue/30',
            gold: 'bg-brand-gold/15 text-brand-gold border-brand-gold/30',
            green: 'bg-brand-green/15 text-brand-green border-brand-green/30',
            purple: 'bg-brand-purple/15 text-brand-purple border-brand-purple/30',
            gray: 'bg-dark-600 text-gray-300 border-dark-500',
          }
          const inactiveClass = 'bg-dark-700 border border-dark-600 text-gray-400 hover:text-gray-100 hover:border-dark-400'
          const activeClass = colorMap[cat.color] + ' border'
          return (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                activeCategory === cat.id ? activeClass : inactiveClass
              }`}
            >
              <Icon size={12} />
              {cat.shortLabel}
              <span className="text-xs opacity-70">({count})</span>
            </button>
          )
        })}
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          {filtered.length === strategies.length
            ? `All ${filtered.length} strategies`
            : `${filtered.length} of ${strategies.length} strategies`}
          {search && <span className="ml-1">matching <span className="text-gray-300">"{search}"</span></span>}
        </p>
        {(search || activeCategory !== 'all') && (
          <button
            onClick={() => { setSearch(''); setCategory('all') }}
            className="text-xs text-brand-blue hover:text-brand-blue-light flex items-center gap-1"
          >
            <X size={11} /> Clear filters
          </button>
        )}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Search size={40} className="text-gray-700 mb-4" />
          <h3 className="text-gray-400 font-medium mb-1">No strategies found</h3>
          <p className="text-sm text-gray-600">Try a different search term or category filter</p>
          <button
            onClick={() => { setSearch(''); setCategory('all') }}
            className="btn-secondary mt-4 text-xs"
          >
            Clear search
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((s) => (
            <StrategyCard key={s.id} strategy={s} />
          ))}
        </div>
      )}
    </div>
  )
}
