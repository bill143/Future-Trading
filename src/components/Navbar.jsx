import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  TrendingUp,
  LayoutDashboard,
  BookOpen,
  Image,
  Info,
  Menu,
  X,
  ExternalLink,
  ChevronRight,
} from 'lucide-react'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/strategies', label: 'Strategies', icon: BookOpen },
  { to: '/gallery', label: 'Gallery', icon: Image },
  { to: '/about', label: 'About', icon: Info },
]

export default function Navbar() {
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isActive = (path) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)

  return (
    <>
      {/* Top ticker bar */}
      <div className="h-7 bg-dark-900 border-b border-dark-600 overflow-hidden relative flex items-center">
        <div className="absolute left-0 top-0 h-full w-16 bg-gradient-to-r from-dark-900 to-transparent z-10 flex items-center pl-3">
          <span className="text-xs font-semibold text-brand-blue tracking-widest">LIVE</span>
        </div>
        <div className="ticker-scroll whitespace-nowrap flex items-center gap-8 pl-16 text-xs">
          {[
            { sym: 'ES1!', val: '5,284.50', chg: '+12.25', up: true },
            { sym: 'NQ1!', val: '18,422.75', chg: '+48.50', up: true },
            { sym: 'GC1!', val: '2,631.40', chg: '-4.20', up: false },
            { sym: 'SPX', val: '5,277.51', chg: '+9.14', up: true },
            { sym: 'SPY', val: '527.34', chg: '+0.89', up: true },
            { sym: 'VIX', val: '14.82', chg: '+0.23', up: false },
            { sym: 'ES1!', val: '5,284.50', chg: '+12.25', up: true },
            { sym: 'NQ1!', val: '18,422.75', chg: '+48.50', up: true },
            { sym: 'GC1!', val: '2,631.40', chg: '-4.20', up: false },
            { sym: 'SPX', val: '5,277.51', chg: '+9.14', up: true },
            { sym: 'SPY', val: '527.34', chg: '+0.89', up: true },
            { sym: 'VIX', val: '14.82', chg: '+0.23', up: false },
          ].map((item, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <span className="text-gray-400 font-medium">{item.sym}</span>
              <span className="text-gray-200">{item.val}</span>
              <span className={item.up ? 'ticker-up' : 'ticker-down'}>
                {item.chg}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* Main navbar */}
      <nav className="sticky top-0 z-50 bg-dark-800/90 backdrop-blur-xl border-b border-dark-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-blue to-brand-green flex items-center justify-center shadow-lg">
                <TrendingUp className="w-4.5 h-4.5 text-white" size={16} />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-base font-bold text-white tracking-tight">FuturePro</span>
                <span className="hidden sm:inline text-xs text-gray-500 font-medium">TRADING</span>
              </div>
            </Link>

            {/* Desktop navigation */}
            <div className="hidden md:flex items-center gap-1">
              {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive(to)
                      ? 'bg-brand-blue/15 text-brand-blue'
                      : 'text-gray-400 hover:text-gray-100 hover:bg-dark-600'
                  }`}
                >
                  <Icon size={15} />
                  {label}
                </Link>
              ))}
            </div>

            {/* Right side actions */}
            <div className="hidden md:flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-green/10 border border-brand-green/20">
                <span className="live-dot" />
                <span className="text-xs font-medium text-brand-green">Market Open</span>
              </div>
              <a
                href="https://www.tradingview.com"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary text-xs py-1.5"
              >
                TradingView <ExternalLink size={11} />
              </a>
            </div>

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-dark-600 transition-colors"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-dark-600 bg-dark-800 animate-fade-in">
            <div className="px-4 py-3 space-y-1">
              {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive(to)
                      ? 'bg-brand-blue/15 text-brand-blue'
                      : 'text-gray-300 hover:text-white hover:bg-dark-600'
                  }`}
                  onClick={() => setMobileOpen(false)}
                >
                  <span className="flex items-center gap-2">
                    <Icon size={16} />
                    {label}
                  </span>
                  <ChevronRight size={14} className="text-gray-600" />
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>
    </>
  )
}
