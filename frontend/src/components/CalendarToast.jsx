import React, { useEffect, useState } from 'react';

const STORAGE_KEY = 'plannerCalendarToast';

export default function CalendarToast() {
  const [toast, setToast] = useState(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  });

  const dismiss = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setToast(null);
  };

  useEffect(() => {
    if (toast && toast.type === 'success') {
      const t = setTimeout(dismiss, 6000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  if (!toast) return null;

  const isError = toast.type === 'error';
  return (
    <div style={{
      position: 'fixed',
      top: 12,
      left: '50%',
      transform: 'translateX(-50%)',
      maxWidth: 720,
      width: 'calc(100% - 32px)',
      background: isError ? '#FDECEA' : '#E8F5E9',
      border: `1px solid ${isError ? '#C62828' : '#2E7D32'}`,
      color: isError ? '#8B1A1A' : '#1B5E20',
      padding: '10px 14px',
      fontSize: 13,
      lineHeight: 1.4,
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
      boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
      zIndex: 200,
    }}>
      <div style={{ flex: 1, wordBreak: 'break-word' }}>{toast.message}</div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        style={{
          border: 'none', background: 'transparent',
          color: 'inherit', fontSize: 18, cursor: 'pointer',
          padding: 0, lineHeight: 1,
        }}
      >×</button>
    </div>
  );
}
