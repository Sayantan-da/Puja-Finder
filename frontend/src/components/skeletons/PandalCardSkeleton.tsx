export default function PandalCardSkeleton() {
  return (
    <div className="puja-card rounded-2xl bg-white border border-red-100/70 overflow-hidden flex flex-col shadow-xs animate-pulse">
      {/* Top red-gold stripe skeleton */}
      <div className="h-1 w-full bg-red-100" />

      {/* Image container skeleton */}
      <div className="h-42 w-full shimmer-wave" />

      {/* Card body */}
      <div className="p-4 flex flex-col flex-1 justify-between gap-3">
        <div>
          {/* Top badges (Verified + Rating) */}
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div className="h-4 w-24 rounded-full shimmer-wave" />
            <div className="h-4 w-10 rounded-md shimmer-wave" />
          </div>

          {/* Pandal name skeleton */}
          <div className="h-5 w-4/5 rounded-md shimmer-wave mb-2" />
          <div className="h-4 w-3/5 rounded-md shimmer-wave mb-2" />

          {/* Locality skeleton */}
          <div className="h-3.5 w-1/2 rounded-md shimmer-wave mb-3" />

          {/* Comfort tags skeleton */}
          <div className="flex gap-1.5 mt-2">
            <div className="h-5 w-20 rounded-md shimmer-wave" />
            <div className="h-5 w-16 rounded-md shimmer-wave" />
          </div>
        </div>

        {/* Footer row skeleton */}
        <div className="pt-3 border-t border-red-50 flex items-center justify-between">
          <div className="flex gap-1.5">
            <div className="h-5 w-18 rounded-full shimmer-wave" />
            <div className="h-5 w-20 rounded-full shimmer-wave" />
          </div>
          <div className="h-4 w-14 rounded-md shimmer-wave" />
        </div>
      </div>
    </div>
  )
}
