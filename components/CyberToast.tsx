import React from 'react';
import { AlertTriangle, CheckCircle, Info, XCircle, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  message: string;
  actionText?: string;
  onAction?: () => void;
}

interface CyberToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const CyberToastContainer: React.FC<CyberToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none px-2">
      {toasts.map((toast) => {
        const isError = toast.type === 'error';
        const isSuccess = toast.type === 'success';
        const isWarn = toast.type === 'warning';

        const borderColor = isError
          ? 'border-red-500/80 shadow-[0_0_20px_rgba(239,68,68,0.4)]'
          : isSuccess
          ? 'border-emerald-500/80 shadow-[0_0_20px_rgba(16,185,129,0.4)]'
          : isWarn
          ? 'border-amber-500/80 shadow-[0_0_20px_rgba(245,158,11,0.4)]'
          : 'border-cyan-500/80 shadow-[0_0_20px_rgba(6,182,212,0.4)]';

        const headerColor = isError
          ? 'text-red-400'
          : isSuccess
          ? 'text-emerald-400'
          : isWarn
          ? 'text-amber-400'
          : 'text-cyan-400';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto bg-[#070c18]/95 backdrop-blur-md border ${borderColor} rounded-lg p-3 relative overflow-hidden transition-all duration-300 animate-in slide-in-from-top-4`}
          >
            {/* Top scanning line */}
            <div className={`absolute top-0 left-0 right-0 h-[2px] ${isError ? 'bg-red-500' : isSuccess ? 'bg-emerald-500' : isWarn ? 'bg-amber-500' : 'bg-cyan-500'} animate-pulse`}></div>

            <div className="flex items-start gap-2.5">
              <div className={`mt-0.5 ${headerColor}`}>
                {isError && <XCircle size={18} />}
                {isSuccess && <CheckCircle size={18} />}
                {isWarn && <AlertTriangle size={18} />}
                {toast.type === 'info' && <Info size={18} />}
              </div>

              <div className="flex-1 min-w-0">
                {toast.title && (
                  <h4 className={`text-xs font-cyber tracking-wider uppercase font-bold mb-0.5 ${headerColor}`}>
                    {toast.title}
                  </h4>
                )}
                <p className="text-xs font-mono text-slate-200 leading-relaxed break-words">
                  {toast.message}
                </p>

                {toast.actionText && toast.onAction && (
                  <button
                    onClick={() => {
                      toast.onAction?.();
                      onDismiss(toast.id);
                    }}
                    className="mt-2 text-[11px] font-cyber px-2.5 py-1 bg-cyan-950/80 border border-cyan-500/60 text-cyan-300 rounded hover:bg-cyan-500 hover:text-black transition-colors uppercase tracking-wider"
                  >
                    {toast.actionText}
                  </button>
                )}
              </div>

              <button
                onClick={() => onDismiss(toast.id)}
                className="text-slate-500 hover:text-white transition-colors p-1"
                aria-label="Dismiss"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
