import React from 'react';

interface NotificationToastProps {
  message: string | null;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({ message }) => {
  if (!message) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(244, 63, 94, 0.95)',
        backdropFilter: 'blur(8px)',
        color: '#fff',
        padding: '8px 18px',
        borderRadius: '8px',
        fontSize: '13px',
        fontWeight: 600,
        zIndex: 9999,
        boxShadow: '0 6px 20px rgba(0, 0, 0, 0.4)',
        pointerEvents: 'none',
        transition: 'all 0.25s ease',
      }}
    >
      {message}
    </div>
  );
};
