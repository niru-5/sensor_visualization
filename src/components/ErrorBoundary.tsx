import { Component } from 'react'
import type { ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  /** Shown when the child tree (e.g. a WebGL canvas) throws. */
  fallback?: ReactNode
  label?: string
}

interface ErrorBoundaryState {
  hasError: boolean
}

/**
 * Lightweight error boundary: isolates one panel (e.g. a single FovCone3D
 * Canvas) so a WebGL failure shows a fallback instead of unmounting the
 * whole app (which previously reset the active tab to the wizard).
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(err: unknown): void {
    // Log for diagnostics; the UI shows the fallback.
    console.error(`[ErrorBoundary${this.props.label ? `:${this.props.label}` : ''}]`, err)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex h-[480px] w-full items-center justify-center rounded-xl bg-slate-900 p-4 text-center text-sm text-slate-400">
            3D view unavailable (WebGL error). The rest of the app still works — try reloading or a different browser.
          </div>
        )
      )
    }
    return this.props.children
  }
}
