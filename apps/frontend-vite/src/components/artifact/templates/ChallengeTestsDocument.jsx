/**
 * ChallengeTestsDocument.jsx
 * March 2026 blue glow theme with inline editing.
 * Nested objects (food/drug/aspirin/exercise) + sentence-split + array. Collection: challenge_tests
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import ChallengeTestsPDFTemplate from '../pdf-templates/ChallengeTestsPDFTemplate';
import './ChallengeTestsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart mirrors the editKey field-part:
   "field", "field-sN" for a sentence, or "field-N" for an array element) */
const DRAFT_KEY = 'challenge_testsPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

const CHALLENGE_TYPES = ['food', 'drug', 'aspirin', 'exercise'];
const SECTION_FIELDS = {
  info: ['supervisedBy', 'threshold'],
  challenge: ['food.status', 'food.indication', 'drug.status', 'drug.indication', 'aspirin.status', 'aspirin.indication', 'exercise.status', 'exercise.indication'],
  challenge_food: ['food.status', 'food.indication'],
  challenge_drug: ['drug.status', 'drug.indication'],
  challenge_aspirin: ['aspirin.status', 'aspirin.indication'],
  challenge_exercise: ['exercise.status', 'exercise.indication'],
  protocol: ['protocol'],
  reactions: ['reactions'],
  outcome: ['outcome'],
};
const FIELD_LABELS = {
  supervisedBy: 'Supervised By', threshold: 'Threshold',
  protocol: 'Protocol', outcome: 'Outcome', reactions: 'Reactions',
  status: 'Status', indication: 'Indication',
  'food.indication': 'Indication', 'drug.indication': 'Indication', 'aspirin.indication': 'Indication', 'exercise.indication': 'Indication',
  'food.status': 'Status', 'drug.status': 'Status', 'aspirin.status': 'Status', 'exercise.status': 'Status',
};
const ARRAY_FIELDS = ['reactions'];
const SENTENCE_SPLIT_FIELDS = new Set(['protocol', 'outcome']);

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).some(k => hasVal(v[k])); return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/[;.]\s+/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };
const reconstructFullText = (sentences) => { if (!sentences || sentences.length === 0) return ''; return sentences.map((s, i) => { let c = s.replace(/[;.]+$/, '').trim(); if (i < sentences.length - 1) c += '.'; return c; }).join(' '); };
/* guarded comma split: never inside parentheses; ", and …"/", or …" stays connected (both sides);
   no-space commas ("4,444 mg") kept whole */
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) {
      if (!/\s/.test(text[i + 1] || '')) { current += ch; continue; }
      const rest = text.slice(i + 1).replace(/^\s+/, '');
      if (/^(and|or)\b/i.test(rest)) { current += ch; continue; }
      if (/\b(and|or)\s*$/i.test(current)) { current += ch; continue; }
      const t = current.trim(); if (t) result.push(t); current = '';
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};
/* supervisedBy: people separated by "), " — split AFTER each close-paren so
   "Dr. Helena Sorensen, MD (allergist)" stays one row (credential commas protected) */
const PARTS_FIELDS = {
  supervisedBy: { split: (s) => String(s).split(/(?<=\)),\s+/).map(t => t.trim()).filter(Boolean), join: ', ' },
};
/* Sentences -> groups: a labeled sentence ("Doses: 1mg, 3mg, …") becomes its own group with a
   nested-subtitle and comma-split rows; consecutive UNLABELED sentences collect into one group,
   also comma-split. Items carry (si, ci) so per-row edits splice back correctly. */
const parseLabeledSentences = (text) => {
  const groups = []; let nullGroup = null;
  splitBySentence(String(text || '')).forEach((sentence, si) => {
    const colonIdx = sentence.indexOf(':');
    const label = colonIdx > 0 && colonIdx < 60 && !sentence.substring(0, colonIdx).includes('.') ? sentence.substring(0, colonIdx).trim() : null;
    if (label) {
      const parts = splitByComma(sentence.substring(colonIdx + 1).trim());
      groups.push({ label, items: parts.map((p, pi) => ({ text: p.replace(/[.;]+$/, '').trim(), si, ci: pi })) });
      nullGroup = null;
    } else {
      if (!nullGroup) { nullGroup = { label: null, items: [] }; groups.push(nullGroup); }
      splitByComma(sentence).forEach((p, pi) => nullGroup.items.push({ text: p.replace(/[.;]+$/, '').trim(), si, ci: pi }));
    }
  });
  return groups;
};

const getChallengeType = (record) => { for (const t of CHALLENGE_TYPES) { if (record[t] && typeof record[t] === 'object' && Object.keys(record[t]).some(k => hasVal(record[t][k]))) return t; } return null; };
const getChallengeTypes = (record) => CHALLENGE_TYPES.filter(t => record[t] && typeof record[t] === 'object' && Object.keys(record[t]).some(k => hasVal(record[t][k])));

const ChallengeTestsDocument = ({ document: rawDoc }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  const [editedFields, setEditedFields] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});

  const records = useMemo(() => {
    if (!rawDoc) return [];
    let arr = Array.isArray(rawDoc) ? rawDoc : [rawDoc];
    arr = arr.flatMap(r => {
      if (r?.challenge_tests) return Array.isArray(r.challenge_tests) ? r.challenge_tests : [r.challenge_tests];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.challenge_tests) return Array.isArray(dd.challenge_tests) ? dd.challenge_tests : [dd.challenge_tests]; return [dd]; }
      return r;
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [rawDoc]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const rid = (() => { const id = record && record._id; if (!id) return null; if (typeof id === 'string') return id; if (id.$oid) return id.$oid; return String(id); })();
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        // fieldPart mirrors the editKey field-part: "field", "field-sN", or "field-N".
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        nFields[editKey] = 'edited';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
  }, [records]);

  const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
  const getFieldValue = useCallback((record, fn, idx) => { const k = `${fn}-${idx}`; if (localEdits[k] !== undefined) return localEdits[k]; if (fn.includes('.')) { const parts = fn.split('.'); let v = record; for (const p of parts) { v = v?.[p]; } return v; } return record[fn]; }, [localEdits]);
  const getRecordId = (r) => { const id = r._id; if (!id) return null; if (typeof id === 'string') return id; if (id.$oid) return id.$oid; return String(id); };
  const copyToClipboard = async (text, id) => { try { await navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); } catch {} };
  const getEffectiveArray = useCallback((record, fieldName, idx) => { const original = Array.isArray(record[fieldName]) ? [...record[fieldName]] : []; original.forEach((_, ai) => { const ek = `${fieldName}-${idx}-${ai}`; if (localEdits[ek] !== undefined) original[ai] = localEdits[ek]; }); return original; }, [localEdits]);
  const getEffectiveSentences = useCallback((record, fn, idx) => { const raw = getFieldValue(record, fn, idx); if (!hasVal(raw)) return []; return splitBySentence(String(raw)).map((s, si) => { const sk = `${fn}-${idx}-s${si}`; return localEdits[sk] !== undefined ? localEdits[sk] : s; }); }, [localEdits, getFieldValue]);

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid) => {
    const rid = getRecordId(record); if (!rid) { console.error('[ChallengeTests] Cannot save — no record ID'); return; }
    const value = editValue;
    const ek = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: value }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    // Re-edit after approval → drop this section's approved flag so the button goes back to yellow Pending Approve.
    setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][fn] = value;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue]);

  const handleSaveArrayItem = useCallback((record, fn, idx, sid, arrayIndex) => {
    const rid = getRecordId(record); if (!rid) { console.error('[ChallengeTests] Cannot save — no record ID'); return; }
    const value = editValue;
    const ek = `${fn}-${idx}-${arrayIndex}`;
    const fieldPart = `${fn}-${arrayIndex}`;
    setLocalEdits(prev => ({ ...prev, [ek]: value }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][fieldPart] = value;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue]);

  const saveSentence = useCallback((record, fn, idx, sid, sentenceIdx) => {
    const rid = getRecordId(record); if (!rid) { console.error('[ChallengeTests] Cannot save — no record ID'); return; }
    const raw = getFieldValue(record, fn, idx);
    const sentences = splitBySentence(String(raw || ''));
    const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) { sentences.splice(sentenceIdx, 1); setEditedFields(prev => ({ ...prev, [`${fn}-${idx}`]: 'edited' })); }
    else { const originalSentence = sentences[sentenceIdx]; const newSentences = splitBySentence(editedVal); sentences.splice(sentenceIdx, 1, ...newSentences); if (newSentences.length > 1) { const extraCount = newSentences.length - 1; const originalChanged = newSentences[0].replace(/[;.]+$/, '').trim() !== originalSentence.replace(/[;.]+$/, '').trim(); setEditedFields(prev => { const n = { ...prev }; if (originalChanged) n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited'; for (let ei = 0; ei < extraCount; ei++) { n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added'; } return n; }); } else { setEditedFields(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' })); } }
    const newValue = reconstructFullText(sentences);
    // Stage as a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
    const ek = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: newValue }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][fn] = newValue;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, localEdits, getFieldValue]);

  // Approve = COMMIT all staged drafts for this record's section to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, idx, sid) => {
    const rid = getRecordId(record); if (!rid) return;
    setApproving(true);
    try {
      const sc = (await import('../../../services/secureApiClient')).default;
      const suffix = `-${idx}`;
      // Collect this record's pending edits belonging to this section.
      const sectionFields = SECTION_FIELDS[sid] || [];
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k]) return false;
        // editKey forms: "field-idx", "field-idx-sN", "field-idx-N". The field-part is everything before "-idx".
        const i = k.indexOf(suffix);
        if (i === -1) return false;
        const before = k.slice(0, i);
        const after = k.slice(i + suffix.length); // "", "-sN", or "-N"
        if (before === '' ) return false;
        // Must be a key for THIS record index (after is empty or "-<digits>" / "-s<digits>").
        if (after !== '' && !/^-(s?\d+)$/.test(after)) return false;
        return sectionFields.includes(before);
      });
      for (const editKey of toCommit) {
        const i = editKey.indexOf(suffix);
        const fn = editKey.slice(0, i);
        const after = editKey.slice(i + suffix.length); // "" or "-N" (array element) or "-sN" (sentence → whole field)
        const payload = { field: fn, value: localEdits[editKey] };
        // arrayIndex ONLY when the trailing segment is purely numeric (array element). "-sN" is NOT.
        const m = after.match(/^-(\d+)$/);
        if (m) payload.arrayIndex = parseInt(m[1], 10);
        await sc.put(`/api/edit/challenge_tests/${rid}/edit`, payload);
      }
      await sc.put(`/api/edit/challenge_tests/${rid}/approve`, { sectionId: sid, approved: true });
      // Clear pending → committed edits now flow into pdfData/PDF.
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's committed drafts from localStorage (only the ones we committed).
      const store = readDrafts();
      if (store[rid]) {
        toCommit.forEach(editKey => {
          const i = editKey.indexOf(suffix);
          const fn = editKey.slice(0, i);
          const after = editKey.slice(i + suffix.length);
          const m = after.match(/^-(\d+)$/);
          const fieldPart = m ? `${fn}-${m[1]}` : fn;
          delete store[rid][fieldPart];
        });
        if (Object.keys(store[rid]).length === 0) delete store[rid];
        writeDrafts(store);
      }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { sectionFields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    }
    catch (err) { console.error('[ChallengeTests] Approve failed:', err); }
    finally { setApproving(false); }
  }, [localEdits, pendingEdits]);

  const highlightText = (text) => { if (!text) return ''; const str = String(text); if (!searchTerm.trim()) return str; const esc = searchTerm.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const re = new RegExp(`(${esc})`, 'gi'); const p = str.split(re); if (p.length === 1) return str; return <>{p.map((x, i) => re.test(x) ? <mark key={i}>{x}</mark> : x)}</>; };
  const phraseMatch = (text, term) => { if (!term.trim()) return true; return String(text || '').toLowerCase().includes(term.toLowerCase().trim()); };
  const shouldShowSection = (record, title, contentParts, fieldNames) => { if (!searchTerm.trim()) return true; if (record._showAllSections) return true; const sl = searchTerm.toLowerCase().trim(); const tl = (title || '').toLowerCase(); if (tl.startsWith(sl) || sl.startsWith(tl)) return true; const labels = (fieldNames || []).map(f => FIELD_LABELS[f] || f); const combined = [...labels, ...(Array.isArray(contentParts) ? contentParts : [contentParts])].filter(Boolean).join(' '); return phraseMatch(combined, searchTerm); };
  const sectionTitleMatches = (t) => { if (!searchTerm.trim()) return false; const sl = searchTerm.toLowerCase().trim(); const tl = (t || '').toLowerCase(); return tl.startsWith(sl) || sl.startsWith(tl); };
  const fieldMatches = (record, fn, idx) => { if (!searchTerm.trim()) return true; if (record._showAllSections) return true; return phraseMatch(FIELD_LABELS[fn] || fn, searchTerm) || phraseMatch(fmtVal(getFieldValue(record, fn, idx)), searchTerm); };

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const sl = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      const title = `Challenge Test ${idx + 1}`;
      const cts = getChallengeTypes(record);
      const ctText = cts.flatMap(t => [t, record[t]?.indication, record[t]?.status]);
      const allText = [title, formatDate(record.testDate), record.supervisedBy, record.protocol, record.outcome, record.threshold, ...ctText, ...(Array.isArray(record.reactions) ? record.reactions : []), ...Object.values(FIELD_LABELS), 'Food Challenge', 'Drug Challenge', 'Aspirin Challenge', 'Exercise Challenge', 'Test Information', 'Protocol', 'Reactions', 'Outcome', 'Indication', 'Status'].filter(Boolean).join(' ');
      const match = allText.toLowerCase().includes(sl);
      record._showAllSections = match && title.toLowerCase().startsWith(sl);
      return match;
    });
  }, [records, searchTerm]);

  const sectionHasEdits = (idx, sid) => { const fs = SECTION_FIELDS[sid] || []; return fs.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`))); };
  const renderApproveButton = (record, idx, sid) => { const he = sectionHasEdits(idx, sid); const ia = approvedSections[`${sid}-${idx}`]; if (he) return <button className="approve-btn pending" disabled={approving} onClick={(e) => { e.stopPropagation(); handleApproveSection(record, idx, sid); }}>{approving ? 'Approving...' : 'Pending Approve'}</button>; if (ia) return <span className="approve-btn approved">Approved</span>; return null; };

  const renderEditableField = (record, fn, idx, sid, showLabel = true, label) => {
    const raw = getFieldValue(record, fn, idx); if (!hasVal(raw)) return null;
    const dv = fmtVal(raw); const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`; const displayLabel = label || FIELD_LABELS[fn] || fn;
    if (ie) return (<div className="rec-mini-card">{showLabel && <div className="nested-subtitle">{highlightText(displayLabel)}</div>}<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveField(record, fn, idx, sid); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => handleSaveField(record, fn, idx, sid)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div className="rec-mini-card">{showLabel && <div className="nested-subtitle">{highlightText(displayLabel)}</div>}<div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(dv); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  // Save one comma-part of one sentence: splice the edited part back (label preserved for
  // labeled sentences), rejoin ', ', rebuild the field.
  const savePart = useCallback((record, fn, idx, sid, si, ci) => {
    const rid = getRecordId(record); if (!rid) { console.error('[ChallengeTests] Cannot save part — no record ID'); return; }
    const sentences = splitBySentence(String(getFieldValue(record, fn, idx) || ''));
    const sentence = sentences[si] || '';
    const colonIdx = sentence.indexOf(':');
    // same label rule as parseLabeledSentences so (si, ci) indexes line up
    const label = colonIdx > 0 && colonIdx < 60 && !sentence.substring(0, colonIdx).includes('.') ? sentence.substring(0, colonIdx).trim() : null;
    const content = label ? sentence.substring(colonIdx + 1).trim() : sentence;
    const parts = splitByComma(content);
    const trimmed = editValue.trim();
    if (!trimmed || /^[;.,!?]+$/.test(trimmed)) parts.splice(ci, 1); else parts[ci] = trimmed.replace(/[;.]+$/, '');
    if (parts.length) sentences[si] = label ? `${label}: ${parts.join(', ')}` : parts.join(', '); else sentences.splice(si, 1);
    const newValue = reconstructFullText(sentences);
    const ek = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: newValue }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [`${fn}-${idx}-s${si}-c${ci}`]: 'edited' }));
    setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts(); if (!store[rid]) store[rid] = {}; store[rid][fn] = newValue; writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, getFieldValue]);

  /* sentences → labeled groups (nested subtitle + comma rows) / unlabeled comma rows —
     every part is its own editable row */
  const renderSentenceSplitField = (record, fn, idx, sid, showLabel = true) => {
    const raw = getFieldValue(record, fn, idx); if (!hasVal(raw)) return null;
    const groups = parseLabeledSentences(String(raw));
    if (groups.length === 0) return null;
    return (
      <div className="rec-mini-card">
        {showLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}
        {groups.map((group, gi) => (
          <React.Fragment key={gi}>
            {group.label && <div className="nested-subtitle">{highlightText(group.label)}</div>}
            {group.items.map(({ text: part, si, ci }) => {
          const sk = `${fn}-${idx}-s${si}-c${ci}`; const ie = editingField === sk; const ed = editedFields[sk]; const cid = `sent-${fn}-${idx}-${si}-${ci}`;
          if (ie) return (<div key={sk} className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) savePart(record, fn, idx, sid, si, ci); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={2} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => savePart(record, fn, idx, sid, si, ci)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>);
          return (<React.Fragment key={sk}><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(sk); setEditValue(part); }}><div className="row-content"><span className="content-value">{highlightText(part)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(part, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</React.Fragment>);
            })}
          </React.Fragment>
        ))}
      </div>
    );
  };

  /* supervisedBy: per-person rows split after ")" — edits splice back with ', ' */
  const renderPartsField = (record, fn, idx, sid) => {
    const raw = getFieldValue(record, fn, idx); if (!hasVal(raw)) return null;
    const cfg = PARTS_FIELDS[fn];
    const parts = cfg.split(String(raw));
    if (parts.length <= 1) return renderEditableField(record, fn, idx, sid);
    return (
      <div className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>
        {parts.map((part, pi) => {
          const pk = `${fn}-${idx}-p${pi}`; const ie = editingField === pk; const ed = editedFields[pk]; const cid = `part-${fn}-${idx}-${pi}`;
          if (ie) return (<div key={pk} className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} /><div className="edit-actions"><button className="save-btn" disabled={saving} onClick={() => { const rid = getRecordId(record); if (!rid) return; const cur = cfg.split(String(getFieldValue(record, fn, idx) || '')); const t = editValue.trim(); if (t) cur[pi] = t; else cur.splice(pi, 1); const rebuilt = cur.join(cfg.join); const ek = `${fn}-${idx}`; setLocalEdits(prev => ({ ...prev, [ek]: rebuilt })); setPendingEdits(prev => ({ ...prev, [ek]: true })); setEditedFields(prev => ({ ...prev, [pk]: 'edited' })); setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; }); const store = readDrafts(); if (!store[rid]) store[rid] = {}; store[rid][fn] = rebuilt; writeDrafts(store); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>);
          return (<React.Fragment key={pk}><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(pk); setEditValue(part); }}><div className="row-content"><span className="content-value">{highlightText(part)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(part, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</React.Fragment>);
        })}
      </div>
    );
  };

  const renderEditableArrayItem = (record, fn, idx, sid, item, ai) => {
    const ek = `${fn}-${idx}-${ai}`; const val = localEdits[ek] !== undefined ? localEdits[ek] : String(item || '');
    const ie = editingField === ek; const ed = editedFields[ek]; const cid = `arr-${fn}-${idx}-${ai}`;
    if (ie) return (<React.Fragment key={ai}><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveArrayItem(record, fn, idx, sid, ai); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => handleSaveArrayItem(record, fn, idx, sid, ai)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></React.Fragment>);
    return (<React.Fragment key={ai}><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(val); }}><div className="row-content"><span className="content-value">{highlightText(val)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(val, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</React.Fragment>);
  };

  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return records;
    return records.map((record, idx) => { const m = { ...record }; Object.keys(localEdits).forEach(key => { if (pendingEdits[key]) return; const ld = key.lastIndexOf('-'); if (ld === -1) return; const fn = key.substring(0, ld); const ri = parseInt(key.substring(ld + 1), 10); if (ri === idx) { if (fn.includes('.')) { const [obj, prop] = fn.split('.'); m[obj] = { ...m[obj], [prop]: localEdits[key] }; } else if (fn in record) { m[fn] = localEdits[key]; } } }); ARRAY_FIELDS.forEach(field => { m[field] = getEffectiveArray(record, field, idx); }); return m; });
  }, [records, localEdits, pendingEdits, getEffectiveArray]);

  const SECTION_TITLES = { info: 'TEST INFORMATION', challenge: 'CHALLENGE TYPE', challenge_food: 'FOOD CHALLENGE', challenge_drug: 'DRUG CHALLENGE', challenge_aspirin: 'ASPIRIN CHALLENGE', challenge_exercise: 'EXERCISE CHALLENGE', protocol: 'PROTOCOL', reactions: 'REACTIONS', outcome: 'OUTCOME' };

  const COPY_LINE_EQ = '='.repeat(40);
  const COPY_LINE_DASH = '-'.repeat(40);
  // sentences → labeled groups (label + dashes, numbering restarts) / unlabeled rows (count continues)
  const sentencePartLines = (text) => {
    const out = []; let n = 0;
    parseLabeledSentences(String(text || '')).forEach(g => {
      if (g.label) { n = 0; out.push(g.label); out.push(COPY_LINE_DASH); }
      g.items.forEach(it => { if (it.text) out.push(`${++n}. ${it.text}`); });
    });
    return out;
  };

  const copySectionText = (record, idx, sid) => {
    const pr = pdfData[idx] || record;
    const title = SECTION_TITLES[sid] || sid.toUpperCase();
    let text = `${title}\n${COPY_LINE_EQ}\n`;
    // single-name rule: label == section title → hide the label (title already shown)
    const showLbl = (lbl) => String(lbl).toLowerCase() !== title.toLowerCase();
    const addF = (fn) => { const v = fn.includes('.') ? fn.split('.').reduce((o, p) => o?.[p], pr) : pr[fn]; const lbl = FIELD_LABELS[fn.split('.').pop()] || fn; if (hasVal(v)) { if (showLbl(lbl)) text += `${lbl}\n${COPY_LINE_DASH}\n`; text += `1. ${fmtVal(v)}\n\n`; } };
    const addParts = (fn) => { const v = pr[fn]; if (!hasVal(v)) return; const lbl = FIELD_LABELS[fn] || fn; if (showLbl(lbl)) text += `${lbl}\n${COPY_LINE_DASH}\n`; PARTS_FIELDS[fn].split(String(v)).forEach((p, i) => { text += `${i + 1}. ${p}\n`; }); text += '\n'; };
    const addSentenceSplit = (fn, v) => { const val = v !== undefined ? v : pr[fn]; if (!hasVal(val)) return; sentencePartLines(val).forEach(l => { text += `${l}\n`; }); };
    if (sid === 'info') { addParts('supervisedBy'); addF('threshold'); }
    else if (sid.startsWith('challenge')) { const ct = sid.includes('_') ? sid.split('_')[1] : getChallengeType(pr); if (ct && pr[ct]) { addF(`${ct}.status`); if (hasVal(pr[ct]?.indication)) { text += `Indication\n${COPY_LINE_DASH}\n`; addSentenceSplit(null, pr[ct].indication); text += '\n'; } } }
    else if (sid === 'protocol') { addSentenceSplit('protocol'); }
    else if (sid === 'outcome') { addSentenceSplit('outcome'); }
    else if (sid === 'reactions') { getEffectiveArray(pr, 'reactions', idx).forEach((it, i) => { text += `${i + 1}. ${it}\n`; }); }
    copyToClipboard(text.trim(), `section-${sid}-${idx}`);
  };

  const copyAllContent = () => {
    let text = `CHALLENGE TESTS\n${COPY_LINE_EQ}\n\n`;
    pdfData.forEach((r, idx) => {
      text += `Challenge Test ${idx + 1}\n${COPY_LINE_EQ}\n`;
      if (r.testDate) text += `${formatDate(r.testDate)}\n`;
      getChallengeTypes(r).forEach(ct => {
        text += `\n${ct.toUpperCase()} CHALLENGE\n${COPY_LINE_EQ}\n`;
        if (hasVal(r[ct]?.status)) text += `Status\n${COPY_LINE_DASH}\n1. ${r[ct].status}\n\n`;
        if (hasVal(r[ct]?.indication)) { text += `Indication\n${COPY_LINE_DASH}\n`; sentencePartLines(r[ct].indication).forEach(l => { text += `${l}\n`; }); text += '\n'; }
      });
      if (hasVal(r.supervisedBy) || hasVal(r.threshold)) {
        text += `\nTEST INFORMATION\n${COPY_LINE_EQ}\n`;
        if (hasVal(r.supervisedBy)) { text += `Supervised By\n${COPY_LINE_DASH}\n`; PARTS_FIELDS.supervisedBy.split(String(r.supervisedBy)).forEach((p, i) => { text += `${i + 1}. ${p}\n`; }); text += '\n'; }
        if (hasVal(r.threshold)) text += `Threshold\n${COPY_LINE_DASH}\n1. ${r.threshold}\n\n`;
      }
      if (hasVal(r.protocol)) { text += `\nPROTOCOL\n${COPY_LINE_EQ}\n`; sentencePartLines(r.protocol).forEach(l => { text += `${l}\n`; }); text += '\n'; }
      const reactions = getEffectiveArray(r, 'reactions', idx);
      if (reactions.length) { text += `\nREACTIONS\n${COPY_LINE_EQ}\n`; reactions.forEach((it, i) => { text += `${i + 1}. ${it}\n`; }); text += '\n'; }
      if (hasVal(r.outcome)) { text += `\nOUTCOME\n${COPY_LINE_EQ}\n`; sentencePartLines(r.outcome).forEach(l => { text += `${l}\n`; }); text += '\n'; }
      text += '\n';
    });
    copyToClipboard(text.trim(), 'copy-all');
  };

  const renderSection = (record, idx, sid, title, children) => { if (!children) return null; return (<div className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn${copiedId === `section-${sid}-${idx}` ? ' copied' : ''}`} onClick={() => copySectionText(record, idx, sid)}>{copiedId === `section-${sid}-${idx}` ? 'Copied' : 'Copy Section'}</button>{renderApproveButton(record, idx, sid)}</div></div>{children}</div></div>); };

  if (!filteredRecords || filteredRecords.length === 0) return (<article className="challenge-tests-document"><header className="document-header"><h1 className="document-title">Challenge Tests</h1></header><SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} /><div className="empty-state">No data available.</div></article>);

  return (
    <article className="challenge-tests-document">
      <header className="document-header">
        <h1 className="document-title">Challenge Tests</h1>
        <div className="header-actions">
          <button className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`} onClick={copyAllContent}>{copiedId === 'copy-all' ? 'Copied' : 'Copy All'}</button>
          <PDFDownloadLink document={<ChallengeTestsPDFTemplate document={pdfData} />} fileName="Challenge_Tests.pdf">
            {({ loading }) => <button className="copy-btn">{loading ? 'Preparing...' : 'Export PDF'}</button>}
          </PDFDownloadLink>
        </div>
      </header>
      <SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />
      <div className="records-container">
        {filteredRecords.map((record, idx) => {
          const challengeTypes = getChallengeTypes(record);
          return (
            <div key={idx} className="record-card">
              <div className="record-header">
                <div className="record-meta-row">
                  {record.testDate && <span className="record-date">{highlightText(formatDate(record.testDate))}</span>}
                </div>
                <div className="record-title-row"><h3 className="record-name">{highlightText(`Challenge Test ${idx + 1}`)}</h3></div>
              </div>
              {challengeTypes.map((ct) => {
                const typeLabel = ct.charAt(0).toUpperCase() + ct.slice(1) + ' Challenge';
                const sid = `challenge_${ct}`;
                if (!shouldShowSection(record, typeLabel, [record[ct]?.status, record[ct]?.indication].filter(Boolean), [`${ct}.status`, `${ct}.indication`])) return null;
                return <React.Fragment key={ct}>{renderSection(record, idx, sid, typeLabel, (<>
                  {renderEditableField(record, `${ct}.status`, idx, sid, true, 'Status')}
                  {renderSentenceSplitField(record, `${ct}.indication`, idx, sid, true)}
                </>))}</React.Fragment>;
              })}
              {(() => {
                const vis = ['supervisedBy', 'threshold'].filter(f => hasVal(getFieldValue(record, f, idx)));
                if (vis.length === 0) return null;
                if (!shouldShowSection(record, 'Test Information', vis.map(f => fmtVal(getFieldValue(record, f, idx))), vis)) return null;
                return renderSection(record, idx, 'info', 'Test Information', (<>{vis.map(f => <React.Fragment key={f}>{PARTS_FIELDS[f] ? renderPartsField(record, f, idx, 'info') : renderEditableField(record, f, idx, 'info')}</React.Fragment>)}</>));
              })()}
              {hasVal(getFieldValue(record, 'protocol', idx)) && shouldShowSection(record, 'Protocol', [fmtVal(getFieldValue(record, 'protocol', idx))], ['protocol']) && renderSection(record, idx, 'protocol', 'Protocol', renderSentenceSplitField(record, 'protocol', idx, 'protocol', false))}
              {(() => {
                const items = Array.isArray(record.reactions) ? record.reactions.filter(Boolean) : [];
                if (items.length === 0) return null;
                if (!shouldShowSection(record, 'Reactions', items, ['reactions'])) return null;
                const stm = sectionTitleMatches('Reactions'); const sa = !searchTerm.trim() || record._showAllSections || stm;
                const visibleItems = items.map((item, ai) => { const val = localEdits[`reactions-${idx}-${ai}`] !== undefined ? localEdits[`reactions-${idx}-${ai}`] : item; if (!sa && !phraseMatch(val, searchTerm)) return null; return renderEditableArrayItem(record, 'reactions', idx, 'reactions', item, ai); }).filter(Boolean);
                return visibleItems.length > 0 ? renderSection(record, idx, 'reactions', 'Reactions', <div className="rec-mini-card">{visibleItems}</div>) : null;
              })()}
              {hasVal(getFieldValue(record, 'outcome', idx)) && shouldShowSection(record, 'Outcome', [fmtVal(getFieldValue(record, 'outcome', idx))], ['outcome']) && renderSection(record, idx, 'outcome', 'Outcome', renderSentenceSplitField(record, 'outcome', idx, 'outcome', false))}
            </div>
          );
        })}
      </div>
    </article>
  );
};

export default ChallengeTestsDocument;
