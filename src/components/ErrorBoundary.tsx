import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let readable = error.message;
    try {
      const parsed = JSON.parse(error.message) as { error?: string; operationType?: string };
      if (parsed.error) {
        readable = `${parsed.operationType ? `${parsed.operationType}: ` : ''}${parsed.error}`;
      }
    } catch {
      // Keep original message
    }
    return { hasError: true, message: readable };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App ErrorBoundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-dvh w-full bg-[#130810] text-white flex items-center justify-center p-6">
          <div className="w-full max-w-[340px] rounded-[28px] border border-rose-400/25 bg-[#25101C] p-6 text-center shadow-2xl">
            <div className="mx-auto w-12 h-12 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-300">
              <AlertTriangle className="w-6 h-6" aria-hidden="true" />
            </div>
            <h2 className="mt-4 font-display text-lg font-semibold text-white">
              Something went wrong
            </h2>
            <p className="mt-2 text-xs text-white/70 break-words leading-relaxed">
              {this.state.message || 'An unexpected error occurred while syncing blood records.'}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 w-full min-h-[44px] rounded-2xl bg-[#E11D48] hover:bg-[#BE123C] text-sm font-semibold text-white inline-flex items-center justify-center gap-2 transition-colors"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
