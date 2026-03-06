import { useState, useEffect } from 'react'

/**
 * Returns real-time US market open/closed status.
 *
 * US equity market hours: Monday–Friday 09:30–16:00 ET
 * Futures active: essentially Mon 00:00 – Fri 17:00 ET plus Sun 18:00–24:00 ET
 *
 * We check against New York time (America/New_York) and re-evaluate every 30 s.
 *
 * @returns {{ label: string, variant: 'open' | 'futures' | 'closed' }}
 */
function computeStatus() {
  const now = new Date()

  const nyParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
    weekday: 'short',
  }).formatToParts(now)

  const get = (type) => nyParts.find((p) => p.type === type)?.value ?? ''
  const weekday = get('weekday') // 'Mon' … 'Sun'
  const hour = parseInt(get('hour'), 10)
  const minute = parseInt(get('minute'), 10)
  const totalMins = hour * 60 + minute

  const isWeekend = weekday === 'Sat' || weekday === 'Sun'
  const equityOpen = !isWeekend && totalMins >= 9 * 60 + 30 && totalMins < 16 * 60

  // Futures trade nearly 24h — closed Fri 17:00 → Sun 18:00 ET
  const futuresClosed =
    (weekday === 'Fri' && totalMins >= 17 * 60) ||
    weekday === 'Sat' ||
    (weekday === 'Sun' && totalMins < 18 * 60)

  if (equityOpen) return { label: 'Market Open', variant: 'open' }
  if (!futuresClosed) return { label: 'Futures Active', variant: 'futures' }
  return { label: 'Market Closed', variant: 'closed' }
}

export function useMarketStatus() {
  const [status, setStatus] = useState(computeStatus)

  useEffect(() => {
    const id = setInterval(() => setStatus(computeStatus()), 30_000)
    return () => clearInterval(id)
  }, [])

  return status
}
