import { useEffect } from 'react'

const BASE_TITLE = 'FuturePro Trading'

/**
 * Sets document.title to `<title> | FuturePro Trading`.
 * Falls back to the base title when no title is provided.
 *
 * @param {string} [title] - Page-specific title segment
 */
export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} | ${BASE_TITLE}` : BASE_TITLE
    return () => {
      document.title = BASE_TITLE
    }
  }, [title])
}
