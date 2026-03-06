import { Component } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

/**
 * Top-level error boundary. Catches unhandled React render errors and
 * displays a professional recovery UI instead of a blank screen.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    // In production you would send this to a monitoring service
    if (process.env.NODE_ENV !== 'production') {
      console.error('[ErrorBoundary]', error, info)
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-dark-900 flex items-center justify-center p-8">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-brand-red/10 border border-brand-red/20 flex items-center justify-center mx-auto">
              <AlertTriangle size={28} className="text-brand-red" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white mb-2">Something went wrong</h1>
              <p className="text-sm text-gray-400 leading-relaxed">
                An unexpected error occurred. The error has been logged.
              </p>
              {this.state.error && (
                <p className="text-xs text-gray-600 mt-3 font-mono bg-dark-800 rounded-lg p-3 text-left overflow-auto">
                  {this.state.error.message}
                </p>
              )}
            </div>
            <button
              onClick={this.handleReset}
              className="btn-primary mx-auto"
            >
              <RefreshCw size={14} aria-hidden="true" /> Reload application
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
