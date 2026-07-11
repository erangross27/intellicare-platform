import React, { useState } from 'react';

/**
 * CompactionDivider — shown after older turns are folded into a rolling summary (Phase 3).
 * Claude-Code-style dark card marking where the summarized conversation continues.
 * message: { type:'compaction_marker', foldedCount?, keptCount?, summaryPreview?, at? }
 */
export default function CompactionDivider({ message, isRTL = false }) {
  const [expanded, setExpanded] = useState(false);
  const folded = message?.foldedCount;
  const kept = message?.keptCount;
  const hasPreview = !!(message && typeof message.summaryPreview === 'string' && message.summaryPreview);
  let when = '';
  try { when = message?.at ? new Date(message.at).toLocaleString() : ''; } catch (_) { when = ''; }

  const title = isRTL ? 'השיחה כווצה' : 'Conversation compacted';
  const sub = isRTL
    ? `${typeof folded === 'number' ? folded + ' הודעות קודמות סוכמו' : 'הודעות קודמות סוכמו'}${typeof kept === 'number' ? ` · ${kept} נשמרו` : ''}`
    : `${typeof folded === 'number' ? folded + ' earlier messages summarized' : 'earlier messages summarized'}${typeof kept === 'number' ? ` · ${kept} kept` : ''}`;

  return (
    <div style={{ display: 'flex', justifyContent: 'center', margin: '18px 0' }} dir={isRTL ? 'rtl' : 'ltr'}>
      <div style={{
        maxWidth: '640px', width: '100%',
        background: '#0F1B33', border: '1px solid rgba(96,165,250,0.22)', borderRadius: '12px',
        padding: '13px 16px', fontFamily: "'Comfortaa', sans-serif",
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '13px', color: '#93c5fd', fontWeight: 700 }}>🗜️ {title}</span>
          {when ? <span style={{ fontSize: '10px', color: '#7e8db3' }}>{when}</span> : null}
        </div>
        <div style={{ fontSize: '12px', color: '#7e8db3', marginTop: '3px' }}>{sub}</div>
        {hasPreview ? (
          <>
            <button
              onClick={() => setExpanded((e) => !e)}
              style={{ marginTop: '8px', fontSize: '11px', color: '#60a5fa', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
            >
              {expanded ? (isRTL ? 'הסתר סיכום ▲' : 'Hide summary ▲') : (isRTL ? 'הצג סיכום ▼' : 'Show summary ▼')}
            </button>
            {expanded ? (
              <div style={{
                marginTop: '8px', fontSize: '12px', color: '#d6def0', background: '#0A1426',
                border: '1px solid rgba(96,165,250,0.16)', borderRadius: '8px', padding: '10px 12px',
                whiteSpace: 'pre-wrap', textAlign: isRTL ? 'right' : 'left', lineHeight: 1.55,
              }}>
                {message.summaryPreview}{message.summaryPreview.length >= 240 ? '…' : ''}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
