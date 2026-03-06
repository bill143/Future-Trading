import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import ScrollToTop from './components/ScrollToTop.jsx'
import BackToTop from './components/BackToTop.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import PageSkeleton from './components/PageSkeleton.jsx'

// Route-level code splitting — each page chunk is fetched on demand
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'))
const StrategiesPage = lazy(() => import('./pages/StrategiesPage.jsx'))
const StrategyDetail = lazy(() => import('./pages/StrategyDetail.jsx'))
const GalleryPage = lazy(() => import('./pages/GalleryPage.jsx'))
const AboutPage = lazy(() => import('./pages/AboutPage.jsx'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage.jsx'))

export default function App() {
  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col">
        {/* Accessibility: skip navigation for keyboard / screen reader users */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100]
            focus:px-4 focus:py-2 focus:rounded-lg focus:bg-brand-blue focus:text-white
            focus:text-sm focus:font-medium focus:shadow-lg focus:outline-none"
        >
          Skip to main content
        </a>

        <ScrollToTop />
        <Navbar />

        <main id="main-content" className="flex-1">
          <Suspense fallback={<PageSkeleton />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/strategies" element={<StrategiesPage />} />
              <Route path="/strategies/:id" element={<StrategyDetail />} />
              <Route path="/gallery" element={<GalleryPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </main>

        <footer className="border-t border-dark-600 bg-dark-800 py-4 mt-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-600">
            <span>© {new Date().getFullYear()} FuturePro Trading — Pine Script Strategy Platform</span>
            <span>
              Strategies by{' '}
              <a
                href="https://www.patreon.com/donaldit"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-brand-blue transition-colors"
              >
                Donald Nguyen
              </a>
            </span>
          </div>
        </footer>

        <BackToTop />
      </div>
    </ErrorBoundary>
  )
}
