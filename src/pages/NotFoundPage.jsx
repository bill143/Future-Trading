import { Link } from 'react-router-dom'
import { Home, BookOpen, TrendingUp } from 'lucide-react'
import { usePageTitle } from '../hooks/usePageTitle.js'

export default function NotFoundPage() {
  usePageTitle('Page Not Found')

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-20 animate-fade-in">
      <div className="text-center max-w-md">
        {/* Large 404 display */}
        <div className="relative mb-8">
          <div className="text-[8rem] font-extrabold leading-none text-dark-700 select-none">
            404
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <TrendingUp size={48} className="text-brand-blue/40" aria-hidden="true" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-white mb-3">Page not found</h1>
        <p className="text-gray-400 text-sm leading-relaxed mb-8">
          The page you're looking for doesn't exist. It may have been moved or the URL might be incorrect.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/" className="btn-primary">
            <Home size={14} aria-hidden="true" /> Go to Dashboard
          </Link>
          <Link to="/strategies" className="btn-secondary">
            <BookOpen size={14} aria-hidden="true" /> Browse Strategies
          </Link>
        </div>
      </div>
    </div>
  )
}
