/**
 * Full-page loading skeleton displayed while a lazy-loaded route chunk
 * is being fetched (Suspense fallback).
 */
export default function PageSkeleton() {
  return (
    <div
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-pulse"
      aria-busy="true"
      aria-label="Loading page…"
    >
      {/* Hero skeleton */}
      <div className="h-52 rounded-2xl bg-dark-700/60" />

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-dark-700/60" />
        ))}
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-52 rounded-xl bg-dark-700/60" />
        ))}
      </div>
    </div>
  )
}
