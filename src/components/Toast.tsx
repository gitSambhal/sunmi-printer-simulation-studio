import React from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  message: string;
  type?: ToastType;
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const type = toast.type || 'info';
        return (
          <div
            key={toast.id}
            role="status"
            aria-live="polite"
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-lg backdrop-blur-md transition-all animate-in fade-in slide-in-from-bottom-2 duration-200 ${
              type === 'success'
                ? 'bg-neutral-900/95 dark:bg-neutral-800/95 text-white border-emerald-500/30'
                : type === 'error'
                ? 'bg-rose-950/95 text-rose-100 border-rose-500/40'
                : type === 'warning'
                ? 'bg-amber-950/95 text-amber-100 border-amber-500/40'
                : 'bg-neutral-900/95 dark:bg-neutral-800/95 text-white border-neutral-700/40'
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              {type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400" />}
              {type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400" />}
              {type === 'info' && <Info className="w-4 h-4 text-sky-400" />}
            </div>

            <div className="flex-1 text-xs font-medium leading-relaxed">
              {toast.message}
            </div>

            <button
              onClick={() => onDismiss(toast.id)}
              className="shrink-0 p-0.5 text-neutral-400 hover:text-white transition-colors"
              aria-label="Dismiss notification"
            >
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
