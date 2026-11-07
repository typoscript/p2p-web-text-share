import { memo } from 'react';
import { AlertCircle, CheckCircle2, Info, Loader2, WifiOff } from 'lucide-react';

export type ToastVariant = 'info' | 'loading' | 'success' | 'warning' | 'error';

export interface ToastState {
  id: number;
  message: string;
  variant: ToastVariant;
  visible: boolean;
}

const VARIANT_STYLES: Record<ToastVariant, { box: string; icon: string }> = {
  info: { box: 'bg-indigo-950/95 border-indigo-600/60 text-indigo-100', icon: 'text-indigo-400' },
  loading: { box: 'bg-indigo-950/95 border-indigo-600/60 text-indigo-100', icon: 'text-indigo-400 animate-spin' },
  success: { box: 'bg-emerald-950/95 border-emerald-600/60 text-emerald-100', icon: 'text-emerald-400' },
  warning: { box: 'bg-amber-950/95 border-amber-600/60 text-amber-100', icon: 'text-amber-400' },
  error: { box: 'bg-rose-950/95 border-rose-600/60 text-rose-100', icon: 'text-rose-400' },
};

const VARIANT_ICONS = {
  info: Info,
  loading: Loader2,
  success: CheckCircle2,
  warning: WifiOff,
  error: AlertCircle,
} as const;

// 화면 상단 중앙에 떠 있는 알림 토스트 (레이아웃을 밀지 않도록 fixed 오버레이)
export const Toast = memo(function Toast({ toast }: { toast: ToastState | null }) {
  if (!toast) return null;
  const style = VARIANT_STYLES[toast.variant];
  const Icon = VARIANT_ICONS[toast.variant];

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div
        key={toast.id}
        role="status"
        aria-live="polite"
        className={`flex max-w-md items-center gap-2 rounded-xl border px-4 py-2.5 text-xs sm:text-sm font-medium shadow-xl shadow-black/40 backdrop-blur-md transition-all duration-300 ease-out ${style.box} ${
          toast.visible ? 'translate-y-0 opacity-100' : '-translate-y-3 opacity-0'
        }`}
      >
        <Icon className={`h-4 w-4 flex-none ${style.icon}`} />
        <span>{toast.message}</span>
      </div>
    </div>
  );
});
