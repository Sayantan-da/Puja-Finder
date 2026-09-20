export default function RatingStars({ value, count }: { value: number | null; count?: number }) {
  if (value == null) {
    return <span className="text-xs text-stone-500">No ratings yet</span>
  }
  const full = Math.round(value)
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <span className="text-amber-400" title={`${value.toFixed(1)} / 5`}>
        {'★'.repeat(full)}
        <span className="text-stone-300">{'★'.repeat(5 - full)}</span>
      </span>
      <span className="text-stone-600 font-medium text-xs">
        {value.toFixed(1)}
        {typeof count === 'number' ? ` (${count})` : ''}
      </span>
    </span>
  )
}
