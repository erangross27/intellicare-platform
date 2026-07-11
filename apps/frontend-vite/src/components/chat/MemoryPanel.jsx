import React, { useEffect, useState, useCallback } from 'react';
import secureApi from '../../services/secureApiClient';

/**
 * MemoryPanel — "What I remember about this patient" drawer (Phase 6).
 * Fixed slide-over overlay (does NOT disturb the Sidebar / ArtifactPanel flex layout).
 * Styled for the blue-dark theme. Lists the patient's active cross-conversation memories; edit + dismiss.
 * Data: GET/PATCH/DELETE /api/agent/agent-sdk/patient-memory (see routes/agent.js).
 */
const TYPE_LABELS = {
  concern: '⚠️ Concern',
  hypothesis: '💡 Hypothesis',
  plan: '📋 Plan',
  preference: '⭐ Preference',
  problem: '🩺 Problem',
  'fact-discussed': '📝 Discussed',
  summary: '🗂️ Summary',
};

// Blue-dark theme palette (matches the merged app theme)
const C = {
  panel: '#0A1426',
  card: '#0F1B33',
  border: 'rgba(96,165,250,0.16)',
  borderStrong: 'rgba(96,165,250,0.30)',
  title: '#e8eefc',
  body: '#d6def0',
  accent: '#60a5fa',
  accentSoft: '#93c5fd',
  muted: '#7e8db3',
  danger: '#f87171',
};

export default function MemoryPanel({ patientId, patientName, isOpen, onClose, language = 'en', sideOffset = 0 }) {
  const isRTL = language === 'he';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [memories, setMemories] = useState([]);
  const [resolvedName, setResolvedName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');

  const load = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await secureApi.get(`/api/agent/agent-sdk/patient-memory?patientId=${encodeURIComponent(patientId)}`);
      setMemories(Array.isArray(res?.memories) ? res.memories : []);
      if (res?.patientName) setResolvedName(res.patientName);
    } catch (e) {
      setError(e?.message || 'Failed to load memory');
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => { if (isOpen && patientId) load(); }, [isOpen, patientId, load]);

  const dismiss = async (id) => {
    try {
      await secureApi.delete(`/api/agent/agent-sdk/patient-memory/${id}`);
      setMemories((m) => m.filter((x) => x.id !== id));
    } catch (e) {
      setError(e?.message || 'Failed to remove');
    }
  };

  const saveEdit = async (id) => {
    try {
      await secureApi.patch(`/api/agent/agent-sdk/patient-memory/${id}`, { text: editText });
      setMemories((m) => m.map((x) => (x.id === id ? { ...x, text: editText } : x)));
      setEditingId(null);
    } catch (e) {
      setError(e?.message || 'Failed to save');
    }
  };

  if (!isOpen) return null;
  const fmtDate = (d) => { try { return new Date(d).toLocaleDateString(); } catch (_) { return ''; } };
  const displayName = patientName || resolvedName || (isRTL ? 'מטופל' : 'Patient');

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{
        position: 'fixed', top: 0, [isRTL ? 'left' : 'right']: sideOffset, height: '100vh',
        width: '380px', maxWidth: '92vw', background: C.panel,
        boxShadow: '-8px 0 32px rgba(0,0,0,0.45)', zIndex: 1001,
        display: 'flex', flexDirection: 'column',
        borderInlineStart: `1px solid ${C.border}`,
        fontFamily: "'Comfortaa', sans-serif",
      }}
    >
      <div style={{ padding: '16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '15px', color: C.title, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>🧠</span>{isRTL ? 'מה שאני זוכר' : 'What I remember'}
          </div>
          <div style={{ fontSize: '12px', color: C.accentSoft, marginTop: '2px' }}>{displayName}</div>
        </div>
        <button onClick={onClose} title={isRTL ? 'סגור' : 'Close'}
          style={{ border: 'none', background: 'transparent', fontSize: '22px', cursor: 'pointer', color: C.muted, lineHeight: 1 }}>×</button>
      </div>

      <div style={{ padding: '10px 16px', fontSize: '11px', color: C.muted, borderBottom: `1px solid ${C.border}`, lineHeight: 1.5 }}>
        {isRTL ? 'הערות מוקשרות משיחות קודמות. אינן נתונים קליניים עדכניים.' : 'Remembered context from past conversations — not current clinical data.'}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px' }}>
        {loading ? <div style={{ color: C.muted, fontSize: '13px', padding: '12px' }}>{isRTL ? 'טוען…' : 'Loading…'}</div> : null}
        {error ? <div style={{ color: C.danger, fontSize: '12px', padding: '8px' }}>{error}</div> : null}
        {!loading && !error && memories.length === 0 ? (
          <div style={{ color: C.muted, fontSize: '13px', padding: '24px 12px', textAlign: 'center' }}>
            {isRTL ? 'אין עדיין זיכרונות למטופל זה.' : 'No memories yet for this patient.'}
          </div>
        ) : null}

        {memories.map((m) => (
          <div key={m.id} style={{ border: `1px solid ${C.border}`, borderRadius: '12px', padding: '11px 13px', marginBottom: '10px', background: C.card }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '7px' }}>
              <span style={{ fontSize: '11px', color: C.accentSoft, fontWeight: 600 }}>{TYPE_LABELS[m.type] || m.type}</span>
              <span style={{ fontSize: '10px', color: C.muted }}>{fmtDate(m.createdAt)}</span>
            </div>
            {editingId === m.id ? (
              <div>
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  rows={3}
                  style={{ width: '100%', fontSize: '13px', padding: '8px', borderRadius: '8px', border: `1px solid ${C.borderStrong}`, boxSizing: 'border-box', background: C.panel, color: C.title, fontFamily: 'inherit', outline: 'none', resize: 'vertical' }}
                />
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <button onClick={() => saveEdit(m.id)} style={{ fontSize: '12px', padding: '5px 12px', border: 'none', borderRadius: '8px', background: C.accent, color: '#0A1426', fontWeight: 700, cursor: 'pointer' }}>{isRTL ? 'שמור' : 'Save'}</button>
                  <button onClick={() => setEditingId(null)} style={{ fontSize: '12px', padding: '5px 12px', border: `1px solid ${C.border}`, borderRadius: '8px', background: 'transparent', color: C.accentSoft, cursor: 'pointer' }}>{isRTL ? 'ביטול' : 'Cancel'}</button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ fontSize: '13px', color: C.body, whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{m.text}</div>
                <div style={{ display: 'flex', gap: '14px', marginTop: '9px' }}>
                  <button onClick={() => { setEditingId(m.id); setEditText(m.text); }}
                    style={{ fontSize: '11px', border: 'none', background: 'transparent', color: C.accent, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>{isRTL ? 'ערוך' : 'Edit'}</button>
                  <button onClick={() => dismiss(m.id)}
                    style={{ fontSize: '11px', border: 'none', background: 'transparent', color: C.danger, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>{isRTL ? 'הסר' : 'Dismiss'}</button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
