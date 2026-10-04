import { API_BASE } from './api';
import { dateToISO, todayISO } from './dayInfo';

// One line in the server's trail of what open tabs did about today (GET /api/client-events):
// page loads, snaps to today, build reloads. sendBeacon so a line sent right before a
// reload still arrives; never throws.
export function reportClientEvent(event, fields = {}) {
  try {
    const bundle = (Array.from(document.scripts).map((s) => s.src).find((src) => /\/static\/js\/main\./.test(src)) || '').replace(/^.*\/static\/js\//, '');
    const body = JSON.stringify({
      event,
      path: window.location.pathname,
      bundle,
      visibility: document.visibilityState,
      browserDay: dateToISO(new Date()),
      today: todayISO(),
      ...fields,
    });
    if (navigator.sendBeacon && navigator.sendBeacon(`${API_BASE}/client-event`, body)) return;
    fetch(`${API_BASE}/client-event`, { method: 'POST', body, keepalive: true }).catch(() => {});
  } catch (_) { /* diagnostics must never break the page */ }
}
