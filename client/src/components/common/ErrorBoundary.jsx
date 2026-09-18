import { Component } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

/** Last line of defence so a render error never leaves a blank white page. */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled UI error:', error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="grid min-h-screen place-items-center bg-surface-page p-6">
        <div className="card w-full max-w-md p-8 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-danger-50 text-danger-500">
            <AlertTriangle className="h-6 w-6" />
          </span>
          <h1 className="mt-4 text-lg font-bold text-ink-900">Something broke on this screen</h1>
          <p className="mt-2 text-sm text-ink-500">
            The error has been logged to the console. Reloading usually fixes it.
          </p>
          <pre className="mt-4 max-h-32 overflow-auto rounded-xl bg-ink-50 p-3 text-left text-xs text-ink-600">
            {error.message}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            <RotateCcw className="h-4 w-4" />
            Reload page
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
