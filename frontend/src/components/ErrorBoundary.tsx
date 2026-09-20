import { Component, type ReactNode } from 'react'

interface State {
  error: Error | null
}

/**
 * App-wide error boundary: a crash in one component shows a friendly
 * reload screen instead of a white page — critical during Puja-week traffic.
 */
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: unknown) {
    // Hook your error tracker (e.g. Sentry.captureException) here
    console.error('UI crash:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
          <p className="text-4xl mb-3">🪔</p>
          <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
          <p className="text-stone-400 text-sm mb-5 max-w-sm">
            The page hit an error, but your data is safe. Reload to continue pandal hopping.
          </p>
          <button
            onClick={() => {
              this.setState({ error: null })
              window.location.href = '/'
            }}
            className="rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold px-5 py-2.5 transition"
          >
            ↻ Reload PujaFinder
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
