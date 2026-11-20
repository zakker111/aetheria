import React, { useEffect, useState } from 'react';

interface NotificationToastProps {
  message: string | null;
  onDismiss?: () => void;
  placement?: 'hud' | 'title';
}

function getAccentColor(message: string): { border: string; dot: string } {
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
    return { border: 'rgba(239, 68, 68, 0.55)', dot: '#ef4444' };
  }
  if (
    message.includes('⚠️') ||
    message.includes('👑') ||
    message.includes('🌟') ||
    message.includes('🏛️') ||
    message.includes('🏆')
  ) {
    return { border: 'rgba(245, 158, 11, 0.55)', dot: '#f59e0b' };
  }
  return { border: 'rgba(56, 189, 248, 0.45)', dot: '#38bdf8' };
}

export const NotificationToast: React.FC<NotificationToastProps> = ({
  message,
  onDismiss,
  placement = 'hud',
}) => {
  const [isNarrow, setIsNarrow] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 960 : false
  );

  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < 960);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (!message) return null;

  const accent = getAccentColor(message);
  const useHudCorridor = placement === 'hud' && !isNarrow;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: placement === 'title' ? '22px' : '74px',
        left: useHudCorridor ? '216px' : '16px',
        right: useHudCorridor ? '372px' : '16px',
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 120,
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          maxWidth: 'min(440px, 100%)',
          background: 'rgba(15, 23, 42, 0.92)',
          backdropFilter: 'blur(10px)',
          border: `1px solid ${accent.border}`,
          color: '#f8fafc',
          padding: '6px 12px',
          borderRadius: '10px',
          fontSize: '12px',
          fontWeight: 500,
          lineHeight: 1.35,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
          pointerEvents: 'none',
          transition: 'opacity 0.2s ease, transform 0.2s ease',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: accent.dot,
            boxShadow: `0 0 8px ${accent.dot}`,
            flexShrink: 0,
          }}
        />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {message}
        </span>
        {onDismiss && (
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={onDismiss}
            style={{
              pointerEvents: 'auto',
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: '13px',
              lineHeight: 1,
              padding: '0 2px',
              marginLeft: '2px',
              flexShrink: 0,
            }}
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
};

