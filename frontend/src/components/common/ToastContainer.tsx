import { useToast } from './ToastContext'

export default function ToastContainer() {
  const { toasts, removeToast } = useToast()

  if (toasts.length === 0) return null

  return (
    <div
      className="fixed bottom-20 sm:bottom-6 right-4 z-50 flex flex-col gap-2.5 max-w-sm pointer-events-none"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success'
        const isError = toast.type === 'error'

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border text-sm font-medium transition-all duration-300 transform translate-y-0 animate-fade-in-up backdrop-blur-md ${
              isSuccess
                ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-100 shadow-emerald-950/40'
                : isError
                ? 'bg-rose-950/90 border-rose-500/40 text-rose-100 shadow-rose-950/40'
                : 'bg-stone-900/90 border-amber-500/40 text-amber-50 shadow-black/50'
            }`}
          >
            <span className="text-base shrink-0">
              {isSuccess ? '✅' : isError ? '⚠️' : '🪔'}
            </span>
            <span className="flex-1 leading-snug">{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-stone-400 hover:text-white text-xs p-1 rounded-full transition-colors"
              aria-label="Close notification"
            >
              ✕
            </button>
          </div>
        )
      })}
    </div>
  )
}
