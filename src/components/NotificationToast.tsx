import React from 'react';

interface NotificationToastProps {
  message: string | null;
  onDismiss?: () => void;
  placement?: 'hud' | 'title';
}

function getAccentClasses(message: string): { borderClass: string; dotClass: string } {
  const lower = message.toLowerCase();
  if (
    message.includes('☢️') ||
    message.includes('🔥') ||
    message.includes('💥') ||
    message.includes('🏚️') ||
    lower.includes('error') ||
    lower.includes('invalid') ||
    lower.includes('could not') ||
    lower.includes('war ignited') ||
    lower.includes('sacked') ||
    lower.includes('rebellion') ||
    lower.includes('collapsed')
  ) {
    return {
      borderClass: 'border-red-500/55',
      dotClass: 'bg-red-500 shadow-[0_0_8px_#ef4444]',
    };
  }
  if (
    message.includes('⚠️') ||
    message.includes('👑') ||
    message.includes('🌟') ||
    message.includes('🏛️') ||
    message.includes('🏆')
  ) {
    return {
      borderClass: 'border-amber-500/55',
      dotClass: 'bg-amber-500 shadow-[0_0_8px_#f59e0b]',
    };
  }
  return {
    borderClass: 'border-sky-400/45',
    dotClass: 'bg-sky-400 shadow-[0_0_8px_#38bdf8]',
  };
}

export const NotificationToast: React.FC<NotificationToastProps> = ({
  message,
  onDismiss,
  placement = 'hud',
}) => {
  if (!message) return null;

  const accent = getAccentClasses(message);
  const positionClasses =
    placement === 'title'
      ? 'bottom-[22px] left-4 right-4'
      : 'bottom-[74px] left-4 right-4 md:left-[216px] md:right-[372px]';

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed ${positionClasses} flex justify-center pointer-events-none z-[120]`}
    >
      <div
        className={`inline-flex items-center gap-2 max-w-[min(440px,100%)] bg-slate-900/92 backdrop-blur-md border ${accent.borderClass} text-slate-50 px-3 py-1.5 rounded-[10px] text-xs font-medium leading-snug shadow-2xl pointer-events-none transition-all duration-200`}
      >
        <span
          aria-hidden="true"
          className={`w-[7px] h-[7px] rounded-full shrink-0 ${accent.dotClass}`}
        />
        <span className="truncate">{message}</span>
        {onDismiss && (
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={onDismiss}
            className="pointer-events-auto bg-transparent border-0 text-slate-400 hover:text-slate-200 cursor-pointer text-[13px] leading-none px-0.5 ml-0.5 shrink-0"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
};
