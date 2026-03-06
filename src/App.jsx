import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import Dashboard from './pages/Dashboard.jsx'
import StrategiesPage from './pages/StrategiesPage.jsx'
import StrategyDetail from './pages/StrategyDetail.jsx'
import GalleryPage from './pages/GalleryPage.jsx'
import AboutPage from './pages/AboutPage.jsx'

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/strategies" element={<StrategiesPage />} />
          <Route path="/strategies/:id" element={<StrategyDetail />} />
          <Route path="/gallery" element={<GalleryPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="*" element={<Dashboard />} />
        </Routes>
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
    </div>
  )
}
