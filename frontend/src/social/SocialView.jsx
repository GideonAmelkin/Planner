import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import AgendaRail from '../shared/AgendaRail';
import SocialCard from './SocialCard';
import ReviewSection from './ReviewSection';
import DataSection from './DataSection';
import { getSocialVideos } from './api';
import { COLORS, card } from '../shared/styles';

const MAX_WIDTH = 1500;

// The Social tab: four stacked cards. The top one is reserved; the review reads the
// recent videos; the data card is every column of the tracker's videos table (the
// same rows the Google Sheet holds); competitors are not chosen yet.
export default function SocialView() {
  const { date } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
          <div style={{ ...card, minHeight: 96, display: 'flex', alignItems: 'center', color: COLORS.faint, fontSize: 13 }}>
            Nothing here yet.
          </div>
          <ReviewSection videos={data && data.videos} />
          <DataSection data={data} loading={loading} error={error} />
          <SocialCard title="Competitors" empty emptyText="No competitors selected yet." />
          <div style={{ fontSize: 11, color: COLORS.faint }}>
            TikTok data is read from the tracker's database on this server (TikTokAnalyzer, <code>data/tiktok.db</code>), the same file its daily run writes to the Google Sheet.
          </div>
        </div>
      </main>
    </div>
  );
}
