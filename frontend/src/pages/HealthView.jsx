import React from 'react';
import { useParams } from 'react-router-dom';
import TopNav from '../components/TopNav';
import { COLORS } from '../styles';

// Placeholder until the Garmin-backed page lands.
export default function HealthView() {
  const { date } = useParams();
  return (
    <div>
      <TopNav dateISO={date} section="health" />
      <div style={{ padding: 32, color: COLORS.muted }}>Health data coming soon.</div>
    </div>
  );
}
