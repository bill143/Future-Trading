import { ExternalLink, Github, Heart, Mail, Coffee, BookOpen, Zap, TrendingUp, Shield } from 'lucide-react'
import { usePageTitle } from '../hooks/usePageTitle.js'

export default function AboutPage() {
  usePageTitle('About')
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-fade-in">
      {/* Hero */}
      <div className="text-center mb-12">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-blue to-brand-green mx-auto mb-4 flex items-center justify-center shadow-xl shadow-brand-blue/20">
          <TrendingUp size={36} className="text-white" />
        </div>
        <h1 className="text-3xl font-extrabold text-white mb-3">FuturePro Trading</h1>
        <p className="text-gray-400 text-base leading-relaxed max-w-xl mx-auto">
          Professional Pine Script trading strategies for TradingView — futures, options, and AI-powered indicators
          for ES, NQ, SPX and GOLD markets.
        </p>
        <div className="flex items-center justify-center gap-3 mt-6">
          <a
            href="https://www.patreon.com/donaldit"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary"
          >
            <Heart size={14} /> Support on Patreon
          </a>
          <a
            href="https://github.com/dearvn/trading-futures-tradingview-script"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
          >
            <Github size={14} /> GitHub <ExternalLink size={11} />
          </a>
        </div>
      </div>

      {/* About the author */}
      <div className="card mb-8">
        <h2 className="text-lg font-bold text-white mb-4">About the Author</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3 text-sm text-gray-300 leading-relaxed">
            <p>
              <strong className="text-white">Donald Nguyen</strong> is a professional trader and Pine Script developer
              specializing in US equity index futures and options. With years of live trading experience on ES (S&amp;P 500 E-mini)
              and NQ (Nasdaq E-mini) futures, Donald has developed and refined a comprehensive suite of algorithmic
              trading strategies.
            </p>
            <p>
              All strategies are actively used in live trading and have been backtested extensively on TradingView.
              The ES/NQ futures strategies achieve <strong className="text-brand-green">70–90% accuracy</strong> depending
              on market conditions and timeframe.
            </p>
            <p>
              Premium strategies including fully automated bot-ready versions are available via Patreon.
              Custom strategy development is available via email.
            </p>
          </div>
          <div className="space-y-3">
            {[
              { icon: Mail, label: 'Email', value: 'donald.nguyen.it@gmail.com', href: 'mailto:donald.nguyen.it@gmail.com' },
              { icon: ExternalLink, label: 'Website', value: 'donaldit.net', href: 'https://donaldit.net' },
              { icon: Heart, label: 'Patreon', value: 'patreon.com/donaldit', href: 'https://www.patreon.com/donaldit' },
              { icon: Github, label: 'GitHub', value: 'dearvn', href: 'https://github.com/dearvn' },
              { icon: Coffee, label: 'Support', value: 'PayPal: clickclone@gmail.com', href: 'https://paypal.me' },
            ].map(({ icon: Icon, label, value, href }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-lg bg-dark-700 hover:bg-dark-600 border border-dark-600 hover:border-dark-400 transition-all group"
              >
                <Icon size={15} className="text-gray-400 group-hover:text-brand-blue transition-colors" />
                <div>
                  <div className="text-xs text-gray-500">{label}</div>
                  <div className="text-sm text-gray-200 group-hover:text-white transition-colors">{value}</div>
                </div>
                <ExternalLink size={11} className="ml-auto text-gray-600 group-hover:text-gray-400" />
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Strategy philosophy */}
      <div className="card mb-8">
        <h2 className="text-lg font-bold text-white mb-4">Trading Philosophy</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              icon: Shield,
              title: 'Risk-First Approach',
              description:
                'Every strategy includes defined stop-loss and take-profit levels. No signal is taken without a risk/reward calculation.',
              color: 'text-brand-green bg-brand-green/10 border-brand-green/20',
            },
            {
              icon: Zap,
              title: 'Point-Based Logic',
              description:
                'Rather than relying on lagging indicators alone, strategies use price-point calculations for precise entry and exit timing.',
              color: 'text-brand-blue bg-brand-blue/10 border-brand-blue/20',
            },
            {
              icon: BookOpen,
              title: 'Constant Refinement',
              description:
                'All scripts are continuously updated based on live market feedback. The v1.x series shows the evolution of the ES strategy.',
              color: 'text-brand-purple bg-brand-purple/10 border-brand-purple/20',
            },
          ].map((item) => (
            <div key={item.title} className="flex flex-col gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center border ${item.color}`}>
                <item.icon size={16} />
              </div>
              <h3 className="font-semibold text-gray-100">{item.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Platform integrations */}
      <div className="card mb-8">
        <h2 className="text-lg font-bold text-white mb-4">Supported Platforms &amp; Integrations</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { name: 'TradingView', desc: 'Primary charting platform', href: 'https://tradingview.com' },
            { name: 'Tradovate', desc: 'ES/NQ futures execution', href: 'https://tradovate.com' },
            { name: 'Tradier', desc: 'Options data & execution', href: 'https://tradier.com' },
            { name: 'Schwab API', desc: 'via alexgolec/schwab-py', href: 'https://github.com/alexgolec/schwab-py' },
            { name: 'Binance Futures', desc: 'Crypto futures trading', href: 'https://github.com/dearvn/tradingview-pinscript-futures-binance' },
            { name: 'WordPress Plugin', desc: 'TradingView alerts', href: 'https://github.com/dearvn/tradingview-alerts' },
          ].map((p) => (
            <a
              key={p.name}
              href={p.href}
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 rounded-lg bg-dark-700 border border-dark-600 hover:border-dark-400 hover:bg-dark-600 transition-all group"
            >
              <div className="text-sm font-medium text-gray-200 group-hover:text-white mb-1">{p.name}</div>
              <div className="text-xs text-gray-500">{p.desc}</div>
            </a>
          ))}
        </div>
      </div>

      {/* Premium */}
      <div className="rounded-2xl bg-gradient-to-r from-brand-blue/10 to-brand-green/10 border border-brand-blue/20 p-8 text-center">
        <Coffee size={32} className="text-brand-gold mx-auto mb-3" />
        <h2 className="text-xl font-bold text-white mb-2">Support This Project</h2>
        <p className="text-sm text-gray-400 leading-relaxed max-w-md mx-auto mb-6">
          If these strategies have helped your trading, consider supporting via Patreon to access premium
          scripts and automated bot-ready versions. Every coffee keeps the development going! ☕
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <a
            href="https://www.patreon.com/donaldit"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary"
          >
            <Heart size={14} /> Subscribe on Patreon
          </a>
          <a
            href="https://www.patreon.com/donaldit/shop"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
          >
            View Premium Scripts <ExternalLink size={11} />
          </a>
        </div>
      </div>
    </div>
  )
}
