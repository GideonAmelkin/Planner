// The server's local day, the one source of "today" for the frontend. The browser asks
// for it instead of trusting its own clock, so the page and the 23:59 rollover always
// agree on when the day turns.
const { localISO } = require('./dates');

function today(now = new Date()) {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
  return {
    date: localISO(now),
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    msUntilMidnight: midnight.getTime() - now.getTime(),
  };
}

module.exports = { today };
