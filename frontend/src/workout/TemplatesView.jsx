import React, { useState } from 'react';
import WorkoutCard from './WorkoutCard';
import { tableWrap, table, th, headRow, td, tdNum, tableLink } from './WorkoutTile';
import { API_BASE } from '../shared/api';
import { COLORS, SECTION_DOTS, pill } from '../shared/styles';
import { templateBanner, titleLines, APP_BLUE, POPPINS } from './art';

// The Workouts view: the app's gym templates as its own banners; a click opens the exercise list
// with sets, reps and the app's clip. Moved out of WorkoutView unchanged except that the card is
// always open here (it was a dropdown when it sat under Personal Trainer).

// Exercise thumbnail: the synced JPEG when there is one, else the clip's own frame at 0.5 s
// (18 clips decode in the browser but not in AVFoundation, so they have no JPEG).
const thumbStyle = { width: 36, height: 36, borderRadius: 6, objectFit: 'cover', verticalAlign: 'middle', marginRight: 10, background: COLORS.page, display: 'inline-block' };
// Six gym exercises have no name on disk; the exporter keeps the id, say so instead of a bare number.
const exerciseName = (e) => (/^\d+$/.test(e.name || '') ? `Exercise ${e.name}` : e.name);
// "8" when every set has the same reps, otherwise the list ("12, 10, 8").
const repsText = (sets) => {
  if (!sets || !sets.length) return '-';
  const reps = sets.map((s) => s.reps || 0);
  return reps.every((r) => r === reps[0]) ? String(reps[0]) : reps.join(', ');
};
// Media the Mac shipped from the app's own cache (see tools/homeworkouts/sync.py).
const mediaUrl = (kind, id) => `${API_BASE}/workout/media/${kind}/${id}`;
const maxSets = (t) => Math.max(0, ...t.exercises.map((e) => (e.sets || []).length));

export default function TemplatesView({ catalog }) {
  const [openTemplate, setOpenTemplate] = useState(null);
  const [playingExercise, setPlayingExercise] = useState(null);
  const templatesList = (catalog && catalog.templates) || [];
  return (
    <WorkoutCard title="Workouts" dot={SECTION_DOTS.notes} aside={catalog ? `${templatesList.length} gym workouts` : 'Loading...'} empty={!!catalog && templatesList.length === 0} emptyText="No templates in the snapshot.">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
        {templatesList.map((t) => {
          const [a, b] = titleLines(t.name);
          const open = openTemplate === t.id;
          const strong = /StrongLifts/.test(t.name);
          return (
              <div
                key={t.id}
                onClick={() => { setOpenTemplate(open ? null : t.id); setPlayingExercise(null); }}
                title={t.name}
                style={{
                  position: 'relative', aspectRatio: '690 / 240', borderRadius: 12, overflow: 'hidden', cursor: 'pointer',
                  background: `url(${templateBanner(t.name) || ''}) center / cover, ${COLORS.ink}`,
                  outline: open ? `3px solid ${APP_BLUE}` : 'none', outlineOffset: 2,
                  alignSelf: 'start',
                }}
              >
                <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#FFFFFF', fontFamily: POPPINS, fontWeight: 800, fontSize: 14, lineHeight: 1.05, textTransform: 'uppercase', textShadow: '0 1px 2px rgba(0,0,0,.3)' }}>
                  {a}<br />{b}
                  {strong ? null : <div style={{ fontWeight: 500, fontSize: 11, marginTop: 4, textTransform: 'none' }}>Classic Gym Workout</div>}
                </div>
              </div>
          );
        })}
      </div>
      {(() => {
        const t = templatesList.find((x) => x.id === openTemplate);
        if (!t) return null;
        const media = (catalog && catalog.media) || { videos: [], thumbs: [] };
        const numCell = { ...tdNum, textAlign: 'right', padding: '8px 12px 8px 0' };
        const numHead = { ...th, textAlign: 'right', padding: '4px 12px 8px 0' };
        return (
                <div style={{ marginTop: 12, background: COLORS.page, borderRadius: 12, padding: '14px 18px', minWidth: 0 }}>
                  <div style={{ fontFamily: POPPINS, fontWeight: 800, fontSize: 16, textTransform: 'uppercase' }}>{t.name}</div>
                  <div style={{ display: 'flex', gap: 6, margin: '6px 0 10px' }}>
                    <span style={pill}>{t.exercises.length} exercises</span>
                    <span style={pill}>{maxSets(t)} sets</span>
                  </div>
                  <div style={tableWrap}>
                    <table style={{ ...table, tableLayout: 'fixed' }}>
                      <colgroup><col /><col style={{ width: 64 }} /><col style={{ width: 90 }} /><col style={{ width: 130 }} /></colgroup>
                      <thead><tr style={headRow}><th style={th}>Exercise</th><th style={numHead}>Sets</th><th style={numHead}>Reps</th><th style={numHead}>Video</th></tr></thead>
                      <tbody>
                        {t.exercises.map((e) => {
                          const hasVideo = media.videos.includes(String(e.action_id));
                          const hasThumb = media.thumbs.includes(String(e.action_id));
                          const playing = playingExercise === `${t.id}:${e.action_id}:${e.order}`;
                          return (
                            <React.Fragment key={`${e.action_id}-${e.order}`}>
                              <tr>
                                <td style={{ ...td, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {hasThumb ? <img src={mediaUrl('thumb', e.action_id)} alt="" style={thumbStyle} />
                                    : hasVideo ? <video src={`${mediaUrl('video', e.action_id)}#t=0.5`} muted playsInline preload="metadata" style={thumbStyle} /> : null}
                                  {exerciseName(e)}
                                </td>
                                <td style={numCell}>{(e.sets || []).length || '-'}</td>
                                <td style={numCell}>{repsText(e.sets)}</td>
                                <td style={numCell}>
                                  {hasVideo ? (
                                    <button type="button" onClick={() => setPlayingExercise(playing ? null : `${t.id}:${e.action_id}:${e.order}`)} style={{ ...tableLink, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit' }}>{playing ? 'Hide' : 'Play ▶'}</button>
                                  ) : (
                                    <span style={{ color: COLORS.faint, fontSize: 11 }} title="The app has no clip for this exercise, or the sync has not fetched it yet.">Clip unavailable</span>
                                  )}
                                </td>
                              </tr>
                              {playing ? (
                                <tr><td colSpan={4} style={{ padding: '4px 0 12px' }}>
                                  <video controls autoPlay preload="metadata" src={mediaUrl('video', e.action_id)} style={{ width: '100%', maxWidth: 480, borderRadius: 10, background: '#000', display: 'block' }} />
                                </td></tr>
                              ) : null}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
        );
      })()}
    </WorkoutCard>
  );
}
