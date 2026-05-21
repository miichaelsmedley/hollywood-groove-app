import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * App-wide error boundary.
 *
 * Without this, a render crash unmounts the whole React tree and leaves a
 * blank screen — which, on this dark theme, just looks black with no clue
 * what happened. This converts any such crash into a readable message plus a
 * reload button, and surfaces the error text so it can actually be reported.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught a render error:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-screen bg-cinema text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-cinema-50 border border-red-500/40 rounded-2xl p-6 space-y-3">
          <h1 className="text-lg font-bold text-red-300">Something went wrong</h1>
          <p className="text-sm text-cinema-400">
            This screen hit an unexpected error. Reloading usually clears it. If it
            keeps happening, the details below help pin down the cause.
          </p>
          <pre className="text-xs text-red-200 bg-cinema-100 rounded-lg p-3 max-h-48 overflow-auto whitespace-pre-wrap break-words">
            {error.message || String(error)}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="btn-primary w-full cursor-pointer"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
