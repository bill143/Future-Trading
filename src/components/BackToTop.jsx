import { useState, useEffect } from 'react'
import { ArrowUp } from 'lucide-react'

const SHOW_THRESHOLD = 400 // px from top

/**
 * A floating "Back to top" button that becomes visible after scrolling
 * past SHOW_THRESHOLD pixels. Smooth-scrolls back to the top on click.
 */
export default function BackToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > SHOW_THRESHOLD)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const handleClick = () => window.scrollTo({ top: 0, behavior: 'smooth' })

  return (
    <button
      onClick={handleClick}
      aria-label="Back to top"
      className={`fixed bottom-6 right-6 z-40 w-10 h-10 rounded-full bg-dark-600 border border-dark-400
        text-gray-300 hover:text-white hover:bg-brand-blue hover:border-brand-blue
        shadow-lg shadow-black/40 flex items-center justify-center
        transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}
    >
      <ArrowUp size={16} aria-hidden="true" />
    </button>
  )
}
