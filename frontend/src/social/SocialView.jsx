import React, { useCallback, useEffect, useState } from 'react';
import AgendaRail from '../shared/AgendaRail';
import ReviewSection from './ReviewSection';
import DataSection from './DataSection';
import CompetitorsSection from './CompetitorsSection';
import CompetitorScatter from './CompetitorScatter';
import { getSocialVideos, getCompetitors } from './api';
import { COLORS } from '../shared/styles';
import { useViewDate } from '../shared/today';

const MAX_WIDTH = 1500;

// The Social tab: three stacked cards. The review reads the recent videos; the data card is every column of the tracker's videos table (the
// same rows the Google Sheet holds); the competitors card reads the tracker's research.db.
export default function SocialView() {
  const date = useViewDate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // One copy of the competitor data for both the Competitors and Scatter cards, so an add or remove
  // on the first shows on the second at once.
  const [competitors, setCompetitors] = useState(null);
  const [competitorsError, setCompetitorsError] = useState(null);
  const loadCompetitors = useCallback(() => getCompetitors()
    .then((d) => { setCompetitors(d); setCompetitorsError(null); })
    .catch((e) => setCompetitorsError(e.message)), []);
  useEffect(() => { loadCompetitors(); }, [loadCompetitors]);

  useEffect(() => {
    let live = true;
    setLoading(true);
    getSocialVideos()
      .then((d) => { if (live) { setData(d); setError(null); } })
      .catch((e) => { if (live) setError(e.message); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', minHeight: '100vh' }}>
      <AgendaRail dateISO={date} section="social" />
      <main style={{ flex: 1, minWidth: 0 }}>
        <div style={{ maxWidth: MAX_WIDTH, margin: '0 auto', padding: '24px 24px 64px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <ReviewSection videos={data && data.videos} />
          <DataSection data={data} loading={loading} error={error} />
          <CompetitorsSection data={competitors} error={competitorsError} reload={loadCompetitors} />
          <CompetitorScatter data={competitors} error={competitorsError} />
          <div style={{ fontSize: 11, color: COLORS.faint }}>
            TikTok data is read from the tracker's database on this server (TikTokAnalyzer, <code>data/tiktok.db</code>), the same file its daily run writes to the Google Sheet.
          </div>
        </div>
      </main>
    </div>
  );
}
