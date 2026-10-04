import React, { useCallback, useEffect, useRef, useState } from 'react';
import Icon from './icons';
import { getWorkoutStatus, requestWorkoutRefresh } from './api';
import { COLORS } from '../shared/styles';
import { roundButton } from './theme';

// The Refresh button in the Workout top bar. The server cannot reach the Mac, so a press leaves a
// request (POST /api/workout/refresh) that the Mac's refresh watcher picks up within ~15 s, and the
// Mac answers by shipping a snapshot stamped with that request. This hook reloads the page's data
// at once (the phone's pushes are already on the server), polls status until the Mac answers, then
// reloads again. phase: idle | waiting | timeout | error.
const POLL_MS = 4000;
const GIVE_UP_MS = 3 * 60 * 1000;

export function useWorkoutRefresh(onReload) {
  const [phase, setPhase] = useState('idle');
  const timer = useRef(null);
  const reload = useRef(onReload);
  reload.current = onReload;
  useEffect(() => () => clearTimeout(timer.current), []);

  const start = useCallback(async () => {
    clearTimeout(timer.current);
    setPhase('waiting');
    let requestedAt;
    try {
      requestedAt = (await requestWorkoutRefresh()).requested_at;
    } catch (err) {
      setPhase('error');
      return;
    }
    reload.current();
    const began = Date.now();
    const poll = async () => {
      try {
        const r = (await getWorkoutStatus()).refresh;
        if (r && r.answered_at && r.requested_at && Date.parse(r.requested_at) >= Date.parse(requestedAt)) {
          setPhase('idle');
          reload.current();
          return;
        }
      } catch (err) { /* keep polling: the backend may be restarting */ }
      if (Date.now() - began > GIVE_UP_MS) { setPhase('timeout'); return; }
      timer.current = setTimeout(poll, POLL_MS);
    };
    timer.current = setTimeout(poll, POLL_MS);
  }, []);

  const message = {
    waiting: { text: 'Refreshing: asking the Mac to sync the Home Workouts app...', color: COLORS.muted },
    timeout: { text: 'Refresh: the Mac has not answered in 3 min (asleep, locked or offline); the hourly sync will retry.', color: COLORS.warn },
    error: { text: 'Refresh: the server did not take the request. Try again in a moment.', color: COLORS.danger },
  }[phase] || null;
  return { phase, start, message };
}

const SPIN = '@keyframes workoutRefreshSpin { to { transform: rotate(360deg); } } @media (prefers-reduced-motion: reduce) { .workout-refresh-spin { animation: none !important; } }';

export default function RefreshButton({ phase, onClick }) {
  const busy = phase === 'waiting';
  return (
    <button
      type="button" onClick={onClick} disabled={busy}
      title={busy ? 'Waiting for the Mac to sync...' : 'Refresh: sync the app on the Mac now'}
      aria-label="Refresh workout data" aria-busy={busy}
      style={{ ...roundButton(), cursor: busy ? 'progress' : 'pointer', padding: 0, font: 'inherit', flexShrink: 0 }}
    >
      <style>{SPIN}</style>
      <span className={busy ? 'workout-refresh-spin' : undefined} style={{ display: 'inline-flex', animation: busy ? 'workoutRefreshSpin 1s linear infinite' : 'none' }}>
        <Icon name="refresh" />
      </span>
    </button>
  );
}
