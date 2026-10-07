import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, FileText, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReset = () => {
    // Clear any service worker caches that might have served stale chunks
    if ('caches' in window) {
      caches.keys().then((names) => {
        for (const name of names) {
          caches.delete(name);
        }
      });
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const reg of registrations) {
          reg.unregister();
        }
      });
    }
    window.location.hash = '#/receipt';
    window.location.reload();
  };

  private handleGoToFlatReceipt = () => {
    this.setState({ hasError: false, error: null });
    window.location.hash = '#/receipt';
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-neutral-900 text-neutral-100 flex items-center justify-center p-6 font-sans">
          <div className="max-w-md w-full bg-neutral-800 border border-neutral-700 rounded-2xl p-6 shadow-2xl flex flex-col items-center text-center">
            <div className="p-3 bg-rose-500/10 text-rose-400 rounded-xl mb-4 border border-rose-500/20">
              <AlertTriangle size={32} />
            </div>

            <h1 className="text-lg font-bold mb-2">Display Recovery Mode</h1>
            <p className="text-xs text-neutral-400 mb-6 leading-relaxed">
              The visualizer encountered an environment rendering conflict (often caused by hardware WebGL constraints or stale browser cache).
            </p>

            {this.state.error && (
              <div className="w-full bg-neutral-950/70 border border-neutral-800 rounded-lg p-3 mb-6 text-left overflow-auto max-h-32 text-[11px] font-mono text-rose-300">
                {this.state.error.message || 'Unknown render error'}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2.5 w-full">
              <button
                onClick={this.handleGoToFlatReceipt}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
              >
                <FileText size={14} />
                <span>Open Flat Receipt</span>
              </button>

              <button
                onClick={this.handleReset}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-neutral-700 hover:bg-neutral-600 active:bg-neutral-500 text-neutral-200 rounded-xl text-xs font-semibold transition-colors"
              >
                <RefreshCw size={14} />
                <span>Clear Cache &amp; Reload</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
