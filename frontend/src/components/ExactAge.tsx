import { useEffect, useState } from 'react'

/**
 * Exact-time display that ticks every second:
 *   "Updated 18:42:07 · 12s ago"
 * Transparent timing for live data — no vague "a few minutes ago".
 */
export default function ExactAge({
  ts,
  prefix = 'Updated',
  className = 'text-xs text-stone-500 tabular-nums',
}: {
  ts: string | null | undefined
  prefix?: string
  className?: string
}) {
  const [, force] = useState(0)

  useEffect(() => {
    const t = setInterval(() => force((x) => x + 1), 1000)
    return () => clearInterval(t)
  }, [])

  if (!ts) return null
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return null

  const secs = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000))
  const clock = d.toLocaleTimeString([], { hour12: false })
  const age =
    secs < 60
      ? `${secs}s ago`
      : secs < 3600
        ? `${Math.floor(secs / 60)}m ${String(secs % 60).padStart(2, '0')}s ago`
        : `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m ago`

  return (
    <span className={className}>
      {prefix} {clock} · {age}
    </span>
  )
}
