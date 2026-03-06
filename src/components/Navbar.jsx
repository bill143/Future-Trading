import { useState, useEffect, useRef } from 'react'
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
import { useMarketStatus } from '../hooks/useMarketStatus.js'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/strategies', label: 'Strategies', icon: BookOpen },
  { to: '/gallery', label: 'Gallery', icon: Image },
  { to: '/about', label: 'About', icon: Info },
]

const MARKET_STYLES = {
  open:    { dot: 'bg-brand-green', text: 'text-brand-green', bg: 'bg-brand-green/10 border-brand-green/20' },
  futures: { dot: 'bg-brand-gold',  text: 'text-brand-gold',  bg: 'bg-brand-gold/10  border-brand-gold/20'  },
  closed:  { dot: 'bg-gray-500',    text: 'text-gray-400',    bg: 'bg-dark-600         border-dark-500'       },
}

export default function Navbar() {
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const menuButtonRef = useRef(null)
  const marketStatus = useMarketStatus()

  const isActive = (path) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  // Esc key closes the mobile menu and restores focus to the toggle button
  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setMobileOpen(false)
        menuButtonRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  const mStyle = MARKET_STYLES[marketStatus.variant]

  return (
    <>
      {/* Top ticker bar */}
      <div
        className="h-7 bg-dark-900 border-b border-dark-600 overflow-hidden relative flex items-center"
        aria-hidden="true"
      >
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
      <nav
        className="sticky top-0 z-50 bg-dark-800/90 backdrop-blur-xl border-b border-dark-600"
        aria-label="Main navigation"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 group" aria-label="FuturePro Trading — home">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-blue to-brand-green flex items-center justify-center shadow-lg">
                <TrendingUp className="w-4.5 h-4.5 text-white" size={16} aria-hidden="true" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-base font-bold text-white tracking-tight">FuturePro</span>
                <span className="hidden sm:inline text-xs text-gray-500 font-medium">TRADING</span>
              </div>
            </Link>

            {/* Desktop navigation */}
            <div className="hidden md:flex items-center gap-1" role="list">
              {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
                const active = isActive(to)
                return (
                  <Link
                    key={to}
                    to={to}
                    role="listitem"
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 focus-visible:ring-offset-dark-800 ${
                      active
                        ? 'bg-brand-blue/15 text-brand-blue'
                        : 'text-gray-400 hover:text-gray-100 hover:bg-dark-600'
                    }`}
                  >
                    <Icon size={15} aria-hidden="true" />
                    {label}
                  </Link>
                )
              })}
            </div>

            {/* Right side actions */}
            <div className="hidden md:flex items-center gap-3">
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${mStyle.bg}`}
                aria-label={`Trading status: ${marketStatus.label}`}
                title={marketStatus.label}
              >
                <span className={`live-dot ${mStyle.dot}`} aria-hidden="true" />
                <span className={`text-xs font-medium ${mStyle.text}`}>{marketStatus.label}</span>
              </div>
              <a
                href="https://www.tradingview.com"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary text-xs py-1.5"
                aria-label="Open TradingView (opens in new tab)"
              >
                TradingView <ExternalLink size={11} aria-hidden="true" />
              </a>
            </div>

            {/* Mobile menu button */}
            <button
              ref={menuButtonRef}
              className="md:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-dark-600 transition-colors
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
              aria-controls="mobile-menu"
            >
              {mobileOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <div
          id="mobile-menu"
          className={`md:hidden border-t border-dark-600 bg-dark-800 overflow-hidden transition-all duration-200
            ${mobileOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}
          aria-hidden={!mobileOpen}
        >
          <div className="px-4 py-3 space-y-1">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
              const active = isActive(to)
              return (
                <Link
                  key={to}
                  to={to}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue ${
                    active
                      ? 'bg-brand-blue/15 text-brand-blue'
                      : 'text-gray-300 hover:text-white hover:bg-dark-600'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Icon size={16} aria-hidden="true" />
                    {label}
                  </span>
                  <ChevronRight size={14} className="text-gray-600" aria-hidden="true" />
                </Link>
              )
            })}
            {/* Market status in mobile menu */}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border mt-2 ${mStyle.bg}`}>
              <span className={`w-2 h-2 rounded-full ${mStyle.dot}`} aria-hidden="true" />
              <span className={`text-xs font-medium ${mStyle.text}`}>{marketStatus.label}</span>
            </div>
          </div>
        </div>
      </nav>
    </>
  )
}
