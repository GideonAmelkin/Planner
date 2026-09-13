const fetch = require('node-fetch');
const { all, get, run } = require('./db');

// ZenQuotes can repeat itself; quotes.text is UNIQUE, so retry a few times
// before falling back to the bundled list.
const FETCH_ATTEMPTS = 5;
const RETRY_DELAY_MS = 600;
const FETCH_TIMEOUT_MS = 8000;

const FALLBACK_QUOTES = [
  { text: 'The vitality of thought is in adventure. Ideas won’t keep. Something must be done about them.', author: 'Alfred North Whitehead' },
  { text: 'What you do every day matters more than what you do once in a while.', author: 'Gretchen Rubin' },
  { text: 'Discipline equals freedom.', author: 'Jocko Willink' },
  { text: 'Begin at once to live, and count each separate day as a separate life.', author: 'Seneca' },
  { text: 'We suffer more often in imagination than in reality.', author: 'Seneca' },
  { text: 'You have power over your mind — not outside events. Realize this, and you will find strength.', author: 'Marcus Aurelius' },
  { text: 'Waste no more time arguing what a good man should be. Be one.', author: 'Marcus Aurelius' },
  { text: 'It is not the man who has too little, but the man who craves more, that is poor.', author: 'Seneca' },
  { text: 'First say to yourself what you would be; and then do what you have to do.', author: 'Epictetus' },
  { text: 'The impediment to action advances action. What stands in the way becomes the way.', author: 'Marcus Aurelius' },
  { text: 'Action is the foundational key to all success.', author: 'Pablo Picasso' },
  { text: 'The successful warrior is the average man, with laser-like focus.', author: 'Bruce Lee' },
  { text: 'Risk comes from not knowing what you’re doing.', author: 'Warren Buffett' },
  { text: 'Price is what you pay. Value is what you get.', author: 'Warren Buffett' },
  { text: 'The best time to plant a tree was 20 years ago. The second best time is now.', author: 'Chinese Proverb' },
  { text: 'Compound interest is the eighth wonder of the world.', author: 'Albert Einstein' },
  { text: 'Don’t watch the clock; do what it does. Keep going.', author: 'Sam Levenson' },
  { text: 'Quality is not an act, it is a habit.', author: 'Aristotle' },
  { text: 'We are what we repeatedly do. Excellence, then, is not an act, but a habit.', author: 'Will Durant' },
  { text: 'Slow is smooth. Smooth is fast.', author: 'U.S. Navy SEALs' },
];

async function fetchRandomFromZenQuotes() {
  const res = await fetch('https://zenquotes.io/api/random', {
    headers: { 'User-Agent': 'PersonalPlanner/1.0' },
    timeout: FETCH_TIMEOUT_MS,
  });
  if (!res.ok) throw new Error(`ZenQuotes HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data) || !data[0] || !data[0].q) {
    throw new Error('Unexpected ZenQuotes response');
  }
  return { text: String(data[0].q).trim(), author: String(data[0].a || '').trim() };
}

async function pickFallback() {
  const rows = await all('SELECT text FROM quotes').catch(() => []);
  const used = new Set(rows.map((r) => r.text));
  for (const q of FALLBACK_QUOTES) {
    if (!used.has(q.text)) return q;
  }
  return FALLBACK_QUOTES[Math.floor(Math.random() * FALLBACK_QUOTES.length)];
}

async function getQuoteForDate(date) {
  const existing = await get('SELECT date, text, author FROM quotes WHERE date = ?', [date]);
  if (existing) return existing;

  for (let attempt = 0; attempt < FETCH_ATTEMPTS; attempt++) {
    try {
      const q = await fetchRandomFromZenQuotes();
      try {
        await run(
          'INSERT INTO quotes (date, text, author) VALUES (?, ?, ?)',
          [date, q.text, q.author]
        );
        return { date, text: q.text, author: q.author };
      } catch (insertErr) {
        if (String(insertErr.message).includes('UNIQUE')) {
          continue;
        }
        throw insertErr;
      }
    } catch (err) {
      console.warn(`[quote] fetch attempt ${attempt + 1} failed:`, err.message);
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }

  const fb = await pickFallback();
  try {
    await run('INSERT INTO quotes (date, text, author) VALUES (?, ?, ?)', [date, fb.text, fb.author]);
  } catch (_) { /* another request may have stored a quote for this date first */ }
  return { date, text: fb.text, author: fb.author, fallback: true };
}

module.exports = { getQuoteForDate };
