import { useEffect, useState, useRef, useMemo } from 'react'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import plaintext from 'highlight.js/lib/languages/plaintext'
import { Copy, Check, Download, ChevronUp, ChevronDown, AlertTriangle } from 'lucide-react'

// Register only the languages we need
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('plaintext', plaintext)

const MAX_DISPLAY_LINES = 500

export default function CodeViewer({ fileName, strategyName }) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [lineCount, setLineCount] = useState(0)
  const codeRef = useRef(null)

  useEffect(() => {
    if (!fileName) return
    setLoading(true)
    setError(null)
    setCode('')
    setShowAll(false)

    fetch(`/strategies/${fileName}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.text()
      })
      .then((text) => {
        setCode(text)
        setLineCount(text.split('\n').length)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [fileName])

  useEffect(() => {
    if (code && codeRef.current) {
      hljs.highlightElement(codeRef.current)
    }
  }, [code, showAll])

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleDownload = () => {
    const blob = new Blob([code], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
  }

  const displayCode = useMemo(
    () => (showAll ? code : code.split('\n').slice(0, MAX_DISPLAY_LINES).join('\n')),
    [code, showAll],
  )
  const isTruncated = !showAll && lineCount > MAX_DISPLAY_LINES

  if (loading) {
    return (
      <div className="bg-dark-900 rounded-xl border border-dark-600 p-8 flex items-center justify-center min-h-[300px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-brand-blue border-t-transparent animate-spin" />
          <span className="text-sm text-gray-500">Loading Pine Script…</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-dark-900 rounded-xl border border-dark-600 p-8 flex items-center justify-center min-h-[200px]">
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertTriangle size={32} className="text-brand-red/60" />
          <div>
            <p className="text-sm font-medium text-gray-300">Failed to load strategy</p>
            <p className="text-xs text-gray-500 mt-1">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-dark-900 rounded-xl border border-dark-600 overflow-hidden">
      {/* Code header */}
      <div className="flex items-center justify-between px-4 py-3 bg-dark-800 border-b border-dark-600">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-brand-red/70" />
            <div className="w-3 h-3 rounded-full bg-brand-gold/70" />
            <div className="w-3 h-3 rounded-full bg-brand-green/70" />
          </div>
          <span className="text-xs font-mono text-gray-400">{fileName}</span>
          <span className="text-xs text-gray-600">
            {lineCount.toLocaleString()} lines
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="btn-ghost py-1 px-2 text-xs"
            title="Download file"
          >
            <Download size={13} />
            <span className="hidden sm:inline">Download</span>
          </button>
          <button
            onClick={handleCopy}
            className={`btn-ghost py-1 px-2 text-xs ${copied ? 'text-brand-green' : ''}`}
            title="Copy to clipboard"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            <span className="hidden sm:inline">{copied ? 'Copied!' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Large file warning */}
      {lineCount > MAX_DISPLAY_LINES && (
        <div className="px-4 py-2 bg-brand-gold/5 border-b border-brand-gold/20 flex items-center gap-2">
          <AlertTriangle size={13} className="text-brand-gold flex-shrink-0" />
          <span className="text-xs text-brand-gold/80">
            Large file ({lineCount.toLocaleString()} lines) — showing first{' '}
            {MAX_DISPLAY_LINES.toLocaleString()} lines. Use Download to get the full file.
          </span>
        </div>
      )}

      {/* Code block */}
      <div className="overflow-auto max-h-[600px]">
        <div className="flex">
          {/* Line numbers */}
          <div
            className="select-none text-right pr-4 pl-4 py-5 text-xs font-mono text-gray-700 bg-dark-900 border-r border-dark-700 leading-[1.7] min-w-[3.5rem]"
            aria-hidden="true"
          >
            {displayCode.split('\n').map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>

          {/* Highlighted code */}
          <pre className="flex-1 overflow-x-auto py-5 pl-4 pr-4 text-xs leading-[1.7] m-0 bg-transparent">
            <code ref={codeRef} className="language-plaintext">
              {displayCode}
            </code>
          </pre>
        </div>
      </div>

      {/* Show more/less */}
      {lineCount > MAX_DISPLAY_LINES && (
        <div className="flex justify-center py-3 border-t border-dark-600 bg-dark-800">
          <button
            onClick={() => setShowAll(!showAll)}
            className="btn-ghost text-xs"
          >
            {showAll ? (
              <>
                <ChevronUp size={13} /> Show less
              </>
            ) : (
              <>
                <ChevronDown size={13} /> Show all{' '}
                {lineCount.toLocaleString()} lines
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
