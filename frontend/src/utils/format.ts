/** Human-friendly helpers shared across pages. */

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const mins = Math.floor((Date.now() - then) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return new Date(iso).toLocaleDateString()
}

export function formatDistance(km: number | null | undefined): string {
  if (km == null) return ''
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${km.toFixed(1)} km`
}

export function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null) return ''
  if (minutes < 60) return `${minutes} min${minutes !== 1 ? 's' : ''}`
  const hrs = Math.floor(minutes / 60)
  const remMins = minutes % 60
  if (remMins === 0) return `${hrs} hr${hrs !== 1 ? 's' : ''}`
  return `${hrs}h ${remMins}m`
}

