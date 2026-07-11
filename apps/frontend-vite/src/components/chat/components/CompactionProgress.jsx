import React, { useEffect, useState } from 'react';

/**
 * CompactionProgress — Claude-Code-style "compacting conversation" progress card.
 * Rendered while the server summarizes older turns (between the 'compaction_start' and 'compacted'
 * SSE events). A single summarization call has no true byte-progress, so — like Claude Code — the
 * bar animates over the estimated duration and is swapped for the summary card when it completes.
 */
export default function CompactionProgress({ message, isRTL = false }) {
  const [pct, setPct] = useState(6);

  useEffect(() => {
    const start = performance.now();
    const DURATION = 12000; // estimated compaction time; eases toward ~92% then holds until 'compacted'
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / DURATION);
      const eased = 92 * (1 - Math.pow(1 - t, 2)); // ease-out
      setPct(Math.max(6, Math.round(eased)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const folding = message?.foldingCount;
  const label = isRTL ? 'מכווץ שיחה קודמת…' : 'Compacting earlier conversation…';

  return (
    <div style={{ display: 'flex', justifyContent: 'center', margin: '18px 0' }} dir={isRTL ? 'rtl' : 'ltr'}>
      <div style={{
        maxWidth: '640px', width: '100%',
        background: '#0F1B33', border: '1px solid rgba(96,165,250,0.22)', borderRadius: '12px',
        padding: '13px 16px', fontFamily: "'Comfortaa', sans-serif",
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '9px' }}>
          <span style={{ fontSize: '13px', color: '#93c5fd', fontWeight: 600 }}>🗜️ {label}</span>
          <span style={{ fontSize: '12px', color: '#93c5fd', fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
        </div>
        <div style={{ height: '6px', borderRadius: '999px', background: 'rgba(96,165,250,0.15)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, borderRadius: '999px', background: 'linear-gradient(90deg,#3b82f6,#60a5fa)', transition: 'width 0.2s ease-out' }} />
        </div>
        {typeof folding === 'number' ? (
          <div style={{ fontSize: '11px', color: '#7e8db3', marginTop: '9px' }}>
            {isRTL ? `מסכם ${folding} הודעות קודמות…` : `Summarizing ${folding} earlier messages…`}
          </div>
        ) : null}
      </div>
    </div>
  );
}
