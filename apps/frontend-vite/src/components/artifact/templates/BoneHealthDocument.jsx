/**
 * BoneHealthDocument.jsx
 * Inline editing with per-section approve, per-row copy.
 * 4-level search, PDFDownloadLink + pdfData memo, secureApiClient.
 * Plan uses per-sentence split. boneProtectionTherapy uses comma-split.
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import BoneHealthDocumentPDFTemplate from '../pdf-templates/BoneHealthDocumentPDFTemplate';
import './BoneHealthDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [editKey]: { ek, field, value, arrayIndex?, local } } }
     - ek        : the localEdits/editedFields key (preserves the file's own key conventions)
     - field     : DB field path for the /api/edit PUT (e.g. "boneProtectionTherapy", "dexaScan.tScore", "results.bmd")
     - value     : DB value for the PUT (scalar/leaf value, exactly what the old save sent)
     - arrayIndex: present only for array-element edits
     - local     : value to put back into localEdits on rehydrate (== value, except for object-leaf clones) */
const DRAFT_KEY = 'bone_healthPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

const SECTION_FIELDS = {
  dexaScan: ['dexaScan'],
  therapy: ['boneProtectionTherapy'],
  riskFactors: ['riskFactors'],
  fractures: ['fractures'],
  clinical: ['findings', 'assessment'],
  plan: ['plan'],
  results: ['results'],
  recommendations: ['recommendations'],
  providerInfo: ['provider', 'facility', 'status'],
  notes: ['notes'],
};
const FIELD_LABELS = { findings: 'Findings', assessment: 'Assessment', plan: 'Plan', provider: 'Provider', facility: 'Facility', status: 'Status', notes: 'Notes', boneProtectionTherapy: 'Bone Protection Therapy', results: 'Results' };
const ARRAY_FIELDS = ['riskFactors', 'fractures', 'recommendations'];
const DEXA_LABELS = { tScore: 'T-Score', result: 'Result', scheduledDate: 'Scheduled Date' };

const KEY_OVERRIDES = { tScore: 'T-Score', zScore: 'Z-Score', bmd: 'BMD', dexa: 'DEXA', frax: 'FRAX', id: 'ID' };
const humanizeKey = (key) => { if (key === null || key === undefined || key === '') return ''; if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key]; const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); return s.charAt(0).toUpperCase() + s.slice(1); };
const splitNumberUnit = (text) => { if (text === null || text === undefined) return null; const s = String(text).trim(); if (s === '') return null; if (/^-?\d+(?:\.\d+)?\s*\/\s*\d/.test(s)) return null; const m = s.match(/^(-?[\d,]*\.?\d+)(\s*)(.*)$/); if (!m || !/\d/.test(m[1])) return null; return { num: m[1].replace(/,/g, ''), sep: m[2] || '', unit: (m[3] || '').trim() }; };
const splitRatio = (text) => { if (text === null || text === undefined) return null; const m = String(text).trim().match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/); if (!m) return null; return { num: m[1], denom: m[2] }; };
const isEmptyDeep = (v) => { if (v === null || v === undefined) return true; if (typeof v === 'boolean') return false; if (typeof v === 'number') return !Number.isFinite(v); if (typeof v === 'string') return v.trim() === ''; if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0; if (typeof v === 'object') return Object.values(v).every(isEmptyDeep); return false; };
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const isScalar = (v) => v === null || typeof v !== 'object';
const flattenSearchable = (v) => { if (v === null || v === undefined) return ''; if (typeof v === 'boolean') return v ? 'yes' : 'no'; if (typeof v === 'number' || typeof v === 'string') return String(v); if (Array.isArray(v)) return v.map(flattenSearchable).join(' '); if (typeof v === 'object') return Object.entries(v).map(([k, val]) => `${humanizeKey(k)} ${flattenSearchable(val)}`).join(' '); return ''; };

/* ── Comma-split for flat list fields (boneProtectionTherapy). Paren-aware; keeps "1,500" intact. Rejoin with ', '. ── */
const splitByComma = (text) => {
  const s = String(text ?? ''); const out = []; let depth = 0, cur = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '(' || c === '[') { depth++; cur += c; }
    else if (c === ')' || c === ']') { depth = Math.max(0, depth - 1); cur += c; }
    else if (c === ',' && depth === 0) {
      const before = s[i - 1] || '', after = (s.slice(i + 1).match(/^\s*(\S)/) || [])[1] || '';
      if (/\d/.test(before) && /\d/.test(after)) cur += c; // 1,500
      else { out.push(cur); cur = ''; }
    } else cur += c;
  }
  out.push(cur);
  return out.map(x => x.trim()).filter(x => x.length > 0);
};

/* ── label:value parsing for free-text clinical fields (findings/assessment) ──
   parseLabel: "Label: value" → {isLabeled,label,value,prefix}. `prefix` keeps the exact
   "Label: " characters so prefix+value reproduces the clause byte-for-byte (lossless edit).
   `:\s+` (space after colon) rejects ratios/times like "1:40"; "L-spine T-score: -1.8" matches. */
const ABBR_RE = /^(?:Mr|Mrs|Ms|Dr|Prof|Rev|Sr|Jr|St|Gen|Col|Sgt|Lt|Capt|vs|etc)$/i;
const parseLabel = (s) => {
  const str = String(s ?? '');
  const m = str.match(/^([^:]{1,80}):(\s+)(\S[\s\S]*)$/);
  if (!m) return { isLabeled: false, label: '', value: str, prefix: '' };
  return { isLabeled: true, label: m[1].trim(), value: m[3], prefix: m[1] + ':' + m[2] };
};
/* Tokenize free text into clause tokens [{raw, sep}] such that join(raw+sep) === text EXACTLY.
   Boundaries: depth-0 ", " (paren-aware; not between digits, not before a 4-digit year or and/or)
   and sentence ". " (abbreviation-safe). Decimals ("-1.8") are safe — the period must be followed by a space. */
const tokenizeClauses = (text) => {
  const s = String(text ?? ''); const tokens = []; let depth = 0, start = 0, i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '(' || c === '[') { depth++; i++; continue; }
    if (c === ')' || c === ']') { depth = Math.max(0, depth - 1); i++; continue; }
    if (depth === 0 && c === '.') {
      const m = s.slice(i).match(/^\.\s+/);
      if (m) { const wm = s.slice(0, i).match(/([A-Za-z]+)$/); if (!(wm && ABBR_RE.test(wm[1]))) { tokens.push({ raw: s.slice(start, i), sep: m[0] }); start = i + m[0].length; i = start; continue; } }
    }
    if (depth === 0 && c === ',') {
      const m = s.slice(i).match(/^,\s*/); const before = s[i - 1] || ''; const rest = s.slice(i + m[0].length); const after = rest[0] || '';
      const betweenDigits = /\d/.test(before) && /\d/.test(after); const beforeYear = /^\d{4}\b/.test(rest); const beforeAndOr = /^(?:and|or)\b/i.test(rest);
      if (!betweenDigits && !beforeYear && !beforeAndOr) { tokens.push({ raw: s.slice(start, i), sep: m[0] }); start = i + m[0].length; i = start; continue; }
    }
    i++;
  }
  tokens.push({ raw: s.slice(start), sep: '' });
  return tokens;
};
/* Parse a clinical field into display items. Unlabeled continuation clauses fold into the preceding
   item's value so comma-bearing values ("postmenopausal, vitamin D insufficiency") stay intact.
   Lossless: items.map(it => it.raw + it.sep).join('') === original. */
const parseClinicalItems = (text) => {
  const toks = tokenizeClauses(text); const items = [];
  toks.forEach(tok => {
    const p = parseLabel(tok.raw);
    if (p.isLabeled || items.length === 0) { items.push({ ...p, raw: tok.raw, sep: tok.sep }); }
    else { const prev = items[items.length - 1]; prev.raw = prev.raw + prev.sep + tok.raw; prev.sep = tok.sep; prev.value = prev.raw.slice(prev.prefix.length); }
  });
  return items;
};
/* Rebuild the full field string with item k's value replaced — lossless for every untouched item. */
const rebuildClinical = (items, k, newValue) => items.map((it, j) => ((j === k ? (it.isLabeled ? it.prefix + newValue : newValue) : it.raw) + it.sep)).join('');
/* HTML number-input step matching the value's decimal precision, so ▲▼ nudges the LAST digit (1.8 → 1.9, not 2.8). */
const stepForNumber = (numStr) => { const d = (String(numStr).split('.')[1] || '').length; return d > 0 ? '0.' + '0'.repeat(d - 1) + '1' : '1'; };
/* Copy / Copy-All: fully-nested lines for a clinical field (no inline "Label: value"). */
const formatClinicalLines = (label, value) => {
  const items = parseClinicalItems(value); const lines = [`${label}:`];
  if (!items.some(it => it.isLabeled)) { lines.push(`  ${String(value).trim()}`); return lines; }
  items.forEach(it => { if (it.isLabeled) { lines.push(`  ${it.label}:`); lines.push(`    ${it.value}`); } else { lines.push(`  ${it.value}`); } });
  return lines;
};

const BoneHealthDocument = ({ document: rawDoc }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  const [editedFields, setEditedFields] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});

  const records = useMemo(() => {
    if (!rawDoc) return [];
    let arr = Array.isArray(rawDoc) ? rawDoc : [rawDoc];
    arr = arr.flatMap(r => { if (r?.bone_health) return Array.isArray(r.bone_health) ? r.bone_health : [r.bone_health]; if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.bone_health) return Array.isArray(dd.bone_health) ? dd.bone_health : [dd.bone_health]; return [dd]; } return r; });
    return arr.filter(r => r && typeof r === 'object');
  }, [rawDoc]);

  const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
  const getFieldValue = useCallback((record, fn, idx) => { const k = `${fn}-${idx}`; if (localEdits[k] !== undefined) return localEdits[k]; return record[fn]; }, [localEdits]);
  const getRecordId = (r) => { const id = r._id; if (!id) return null; if (typeof id === 'string') return id; if (id.$oid) return id.$oid; return String(id); };

  // Stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve (handleApproveSection commits).
  // `draft` carries everything Approve needs to reverse the original save exactly: { ek, field, value, arrayIndex?, local }.
  const stageDraft = useCallback((rid, draft) => {
    if (!rid) return;
    setLocalEdits(prev => ({ ...prev, [draft.ek]: draft.local }));
    setPendingEdits(prev => ({ ...prev, [draft.ek]: true }));
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][draft.ek] = draft;
    writeDrafts(store);
  }, []);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const rid = getRecordId(record);
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.values(recDrafts).forEach((draft) => {
        if (!draft || !draft.ek) return;
        nLocal[draft.ek] = draft.local;
        nPending[draft.ek] = true;
        const trackKey = draft.track || draft.ek;
        nFields[trackKey] = 'edited';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
  }, [records]);
  const copyToClipboard = async (text, id) => { try { await navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); } catch {} };

  // getEffectiveArray feeds the PDF + Copy paths, so it EXCLUDES pending drafts (uncommitted edits stay out of PDF/Copy).
  // The JSX array rows read localEdits inline (not via this helper) so drafts still show in the UI.
  const getEffectiveArray = useCallback((record, fieldName, idx) => {
    const original = Array.isArray(record[fieldName]) ? [...record[fieldName]] : [];
    original.forEach((_, ai) => { const ek = `${fieldName}-${idx}-${ai}`; if (localEdits[ek] !== undefined && !pendingEdits[ek]) original[ai] = localEdits[ek]; });
    return original;
  }, [localEdits, pendingEdits]);

  // Re-edit after a section was approved → drop its 'approved' flag so the button returns to yellow Pending Approve.
  const clearApproved = useCallback((sid, idx) => {
    setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
  }, []);

  // Save = stage a DRAFT only (no DB write). Approve (handleApproveSection) commits to MongoDB.
  const handleSaveField = useCallback((record, fn, idx, sid) => {
    const rid = getRecordId(record); if (!rid) { console.error('[BoneHealth] Save failed: No record ID'); return; }
    const ek = `${fn}-${idx}`;
    stageDraft(rid, { ek, field: fn, value: editValue, local: editValue });
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    clearApproved(sid, idx);
    setEditingField(null); setEditValue('');
  }, [editValue, stageDraft, clearApproved]);

  const handleSaveFieldWithValue = useCallback((record, fn, idx, sid, valueOverride, editTrackingKey) => {
    const rid = getRecordId(record); if (!rid) { console.error('[BoneHealth] Save failed: No record ID'); return; }
    const ek = `${fn}-${idx}`; const track = editTrackingKey || ek;
    stageDraft(rid, { ek, field: fn, value: valueOverride, local: valueOverride, track });
    setEditedFields(prev => ({ ...prev, [track]: 'edited' }));
    clearApproved(sid, idx);
    setEditingField(null); setEditValue('');
  }, [stageDraft, clearApproved]);

  const handleSaveArrayItem = useCallback((record, fn, idx, sid, arrayIndex) => {
    const rid = getRecordId(record); if (!rid) { console.error('[BoneHealth] Array save failed: No record ID'); return; }
    const ek = `${fn}-${idx}-${arrayIndex}`;
    stageDraft(rid, { ek, field: fn, value: editValue, arrayIndex, local: editValue });
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    clearApproved(sid, idx);
    setEditingField(null); setEditValue('');
  }, [editValue, stageDraft, clearApproved]);

  const handleSaveNestedField = useCallback((record, idx, parentField, dotPath, sectionId) => {
    const rid = getRecordId(record); if (!rid) { console.error('[BoneHealth] Nested save failed: No record ID'); return; }
    const ek = `${parentField}.${dotPath}-${idx}`;
    stageDraft(rid, { ek, field: `${parentField}.${dotPath}`, value: editValue, local: editValue });
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    clearApproved(sectionId, idx);
    setEditingField(null); setEditValue('');
  }, [editValue, stageDraft, clearApproved]);

  /* save a nested OBJECT leaf by dot-path (e.g. results.bmd) — clones full object, stores under `results-${idx}` */
  const handleSaveLeaf = useCallback((record, rootField, path, idx, sid, leafKeyTrack, newVal) => {
    const rid = getRecordId(record); if (!rid) { console.error('[BoneHealth] Leaf save failed: No record ID'); return; }
    const ek = `${rootField}-${idx}`;
    const dottedField = `${rootField}.${path.join('.')}`;
    // Build the cloned object locally (this is what localEdits holds for object roots), staged only.
    setLocalEdits(prev => {
      const cur = prev[ek] !== undefined ? prev[ek] : record[rootField];
      const clone = JSON.parse(JSON.stringify(cur ?? {}));
      let node = clone;
      for (let i = 0; i < path.length - 1; i++) node = node[path[i]];
      node[path[path.length - 1]] = newVal;
      // Persist the cloned object to the draft store as the rehydrate `local`, while `value` stays the leaf scalar for the DB PUT.
      const store = readDrafts();
      if (!store[rid]) store[rid] = {};
      store[rid][ek] = { ek, field: dottedField, value: newVal, local: clone, track: leafKeyTrack };
      writeDrafts(store);
      return { ...prev, [ek]: clone };
    });
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [leafKeyTrack]: 'edited' }));
    clearApproved(sid, idx);
    setEditingField(null); setEditValue('');
  }, [clearApproved]);

  // Approve = COMMIT all staged drafts for THIS record to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, idx, sid) => {
    try {
      const rid = getRecordId(record); if (!rid) return;
      const sc = (await import('../../../services/secureApiClient')).default;
      const store = readDrafts();
      const recDrafts = store[rid] || {};
      const sf = SECTION_FIELDS[sid] || [];
      // Collect this section's pending drafts (match by the draft's DB field root against this section's fields).
      const toCommit = Object.values(recDrafts).filter(d => {
        if (!d || !pendingEdits[d.ek]) return false;
        const fieldRoot = String(d.field).split('.')[0];
        return sf.includes(fieldRoot);
      });
      // Persist each staged field to the DB now (field + value, plus arrayIndex for array elements).
      for (const d of toCommit) {
        const payload = { field: d.field, value: d.value };
        if (typeof d.arrayIndex === 'number') payload.arrayIndex = d.arrayIndex;
        await sc.put(`/api/edit/bone_health/${rid}/edit`, payload);
      }
      // Flag the section approved (audit trail)
      await sc.put(`/api/edit/bone_health/${rid}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(d => delete n[d.ek]); return n; });
      // Drop committed drafts from localStorage (remove the record entry once empty)
      const store2 = readDrafts();
      if (store2[rid]) { toCommit.forEach(d => delete store2[rid][d.ek]); if (Object.keys(store2[rid]).length === 0) delete store2[rid]; writeDrafts(store2); }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { sf.forEach(f => { if (k.startsWith(`${f}-${idx}`) || k.startsWith(`${f}.`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[BoneHealth] Approve failed:', err); }
  }, [pendingEdits]);

  const splitBySentence = (text) => { if (!text) return []; return text.split(/\.\s+/).map(s => s.trim()).filter(s => s.length > 0 && s.replace(/[.!?;,]+/g, '').trim().length > 0); };

  const highlightText = (text) => { if (!text) return ''; const str = String(text); if (!searchTerm.trim()) return str; const esc = searchTerm.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const re = new RegExp(`(${esc})`, 'gi'); const p = str.split(re); if (p.length === 1) return str; return <>{p.map((x, i) => re.test(x) ? <mark key={i}>{x}</mark> : x)}</>; };
  const phraseMatch = (text, term) => { if (!term.trim()) return true; return String(text || '').toLowerCase().includes(term.toLowerCase().trim()); };
  const shouldShowSection = (record, title, contentParts, fieldNames) => { if (!searchTerm.trim()) return true; if (record._showAllSections) return true; const sl = searchTerm.toLowerCase().trim(); const tl = (title || '').toLowerCase(); if (tl.startsWith(sl) || sl.startsWith(tl)) return true; const labels = (fieldNames || []).map(f => FIELD_LABELS[f] || f); const combined = [...labels, ...(Array.isArray(contentParts) ? contentParts : [contentParts])].filter(Boolean).join(' '); return phraseMatch(combined, searchTerm); };
  const sectionTitleMatches = (t) => { if (!searchTerm.trim()) return false; const sl = searchTerm.toLowerCase().trim(); const tl = (t || '').toLowerCase(); return tl.startsWith(sl) || sl.startsWith(tl); };
  const fieldMatches = (record, fn, idx) => { if (!searchTerm.trim()) return true; if (record._showAllSections) return true; return phraseMatch(FIELD_LABELS[fn] || fn, searchTerm) || phraseMatch(getFieldValue(record, fn, idx), searchTerm); };

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const sl = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      const title = `Bone Health ${idx + 1}`;
      const dexa = record.dexaScan;
      const allText = [title, formatDate(record.date), dexa?.tScore, dexa?.result, dexa?.scheduledDate, record.boneProtectionTherapy, ...(Array.isArray(record.riskFactors) ? record.riskFactors : []), ...(Array.isArray(record.fractures) ? record.fractures : []), record.findings, record.assessment, record.plan, flattenSearchable(record.results), record.notes, record.provider, record.facility, record.status, ...(Array.isArray(record.recommendations) ? record.recommendations.map(r => r.recommendation || r) : []), ...Object.values(FIELD_LABELS), 'DEXA Scan', 'Bone Protection Therapy', 'Risk Factors', 'Fractures', 'Clinical Assessment', 'Plan', 'Results', 'Recommendations', 'Provider Information', 'Notes'].filter(Boolean).join(' ');
      const match = allText.toLowerCase().includes(sl);
      record._showAllSections = match && title.toLowerCase().startsWith(sl);
      return match;
    });
  }, [records, searchTerm]);

  const sectionHasEdits = (idx, sid) => { const fs = SECTION_FIELDS[sid] || []; return fs.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || k.startsWith(`${f}.`))); };
  const renderApproveButton = (idx, sid) => { const he = sectionHasEdits(idx, sid); const ia = approvedSections[`${sid}-${idx}`]; if (he) return <button className="approve-btn pending" onClick={(e) => { e.stopPropagation(); handleApproveSection(records[idx], idx, sid); }}>Pending Approve</button>; if (ia) return <span className="approve-btn approved">Approved</span>; return null; };

  const renderEditableField = (record, fn, idx, sid, hideLabel) => {
    const value = getFieldValue(record, fn, idx); if (!value && value !== false && !localEdits[`${fn}-${idx}`]) return null;
    const dv = String(value || '');
    const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`;
    if (ie) return (<div className={hideLabel ? undefined : 'rec-mini-card'}>{!hideLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveField(record, fn, idx, sid); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={fn === 'plan' || fn === 'assessment' || fn === 'notes' ? 4 : 1} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => handleSaveField(record, fn, idx, sid)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div className={hideLabel ? undefined : 'rec-mini-card'}>{!hideLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(dv); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  const renderNestedEditableField = (record, idx, parentField, dotPath, label, value, sid) => {
    if (!value && value !== 0) return null;
    const nKey = `${parentField}.${dotPath}-${idx}`; const nVal = localEdits[nKey] !== undefined ? localEdits[nKey] : String(value);
    const nEditing = editingField === nKey; const nEdited = editedFields[nKey]; const cid = `nested-${parentField}-${dotPath}-${idx}`;
    if (nEditing) return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(label)}</div><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveNestedField(record, idx, parentField, dotPath, sid); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => handleSaveNestedField(record, idx, parentField, dotPath, sid)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(label)}</div><div className={`numbered-row editable-row${nEdited ? ' modified' : ''}`} onClick={() => { setEditingField(nKey); setEditValue(nVal); }}><div className="row-content"><span className="content-value">{highlightText(nVal)}</span>{!nEdited && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(nVal, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{nEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  /* OBJECT leaf (editable; number+unit -> number input, "4/5" ratio -> number input, bool -> select, else textarea) */
  const renderObjectLeaf = (record, rootField, path, idx, sid, value) => {
    const leafValueString = fmtScalar(value);
    const leafKey = `${rootField}-${idx}-${path.join('.')}`;
    const ie = editingField === leafKey;
    const ed = editedFields[leafKey];
    const isBool = typeof value === 'boolean';
    const ratio = isBool ? null : splitRatio(leafValueString);
    const nu = (isBool || ratio) ? null : splitNumberUnit(leafValueString);
    const editStartValue = isBool ? (value ? 'yes' : 'no') : ratio ? ratio.num : nu ? nu.num : leafValueString;
    const cid = `leaf-${rootField}-${idx}-${path.join('.')}`;
    return (
      <div key={path[path.length - 1]} className="nested-mini-card">
        <div className="nested-subtitle sub-label">{highlightText(humanizeKey(path[path.length - 1]))}</div>
        {ie ? (
          <div className="edit-field-container">
            {isBool ? (
              <select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            ) : (ratio || nu) ? (
              <div className="number-edit-row">
                <input type="number" step="any" className="edit-number" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} />
                {ratio ? <span className="number-edit-unit">{`/ ${ratio.denom}`}</span> : (nu.unit && <span className="number-edit-unit">{nu.unit}</span>)}
              </div>
            ) : (
              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus rows={1} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} disabled={saving} />
            )}
            <div className="edit-actions">
              <button className="save-btn" disabled={saving} onClick={() => {
                let newVal;
                if (isBool) { newVal = editValue === 'yes'; }
                else if (ratio) { const n = parseFloat(editValue); if (isNaN(n)) return; newVal = `${n}/${ratio.denom}`; }
                else if (nu) { const n = parseFloat(editValue); if (isNaN(n)) return; newVal = nu.unit ? `${n}${nu.sep || ' '}${nu.unit}` : String(n); }
                else { newVal = editValue.trim(); }
                handleSaveLeaf(record, rootField, path, idx, sid, leafKey, newVal);
              }}>{saving ? 'Saving...' : 'Save'}</button>
              <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(leafKey); setEditValue(editStartValue); }}>
            <div className="row-content"><span className="content-value">{highlightText(leafValueString)}</span>{!ed && <span className="edit-indicator">✎</span>}</div>
            <button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(`${humanizeKey(path[path.length - 1])}\n${leafValueString}`, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button>
          </div>
        )}
        {ed && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </div>
    );
  };

  /* OBJECT node (recursive; humanizeKey + nested-mini-card; editable leaves, hide-empty at every level) */
  const renderObjectNode = (record, rootField, idx, sid, label, value, path, depth) => {
    if (isEmptyDeep(value)) return null;
    if (isScalar(value)) return renderObjectLeaf(record, rootField, path, idx, sid, value);
    const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    return (
      <React.Fragment key={path.join('-') || rootField}>
        {label && <div className={depth > 0 ? 'nested-subtitle sub-label' : 'nested-subtitle'}>{highlightText(label)}</div>}
        <div className="nested-group">
          {entries.map(([k, v]) => (
            isScalar(v) ? renderObjectLeaf(record, rootField, [...path, k], idx, sid, v)
              : <div className="nested-mini-card" key={k}>{renderObjectNode(record, rootField, idx, sid, humanizeKey(k), v, [...path, k], depth + 1)}</div>
          ))}
        </div>
      </React.Fragment>
    );
  };

  const renderResultsSection = (record, idx, sid, title) => {
    const val = getFieldValue(record, 'results', idx);
    if (!val || isScalar(val) || isEmptyDeep(val)) return null;
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    if (!shouldShowSection(record, title, [flattenSearchable(val)], ['results'])) return null;
    return renderSection(record, idx, sid, title, (
      <>{entries.map(([k, v]) => (
        isScalar(v) ? renderObjectLeaf(record, 'results', [k], idx, sid, v)
          : <div className="nested-mini-card" key={k}>{renderObjectNode(record, 'results', idx, sid, humanizeKey(k), v, [k], 1)}</div>
      ))}</>
    ));
  };

  const renderEditableArrayItem = (record, fn, idx, sid, item, ai) => {
    const recText = typeof item === 'object' ? (item.recommendation || '') : String(item || '');
    const ek = `${fn}-${idx}-${ai}`; const val = localEdits[ek] !== undefined ? localEdits[ek] : recText;
    const ie = editingField === ek; const ed = editedFields[ek]; const cid = `arr-${fn}-${idx}-${ai}`;
    if (ie) return (<div key={ai} className="rec-mini-card"><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveArrayItem(record, fn, idx, sid, ai); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => handleSaveArrayItem(record, fn, idx, sid, ai)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div key={ai} className="rec-mini-card"><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(val); }}><div className="row-content"><span className="content-value">{highlightText(val)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(val, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  const renderSentenceSplitSection = (record, idx, sid, title, fieldName) => {
    const val = String(getFieldValue(record, fieldName, idx) || '');
    if (!val.trim()) return null;
    if (!shouldShowSection(record, title, [val], [fieldName])) return null;
    const sentences = splitBySentence(val);
    if (sentences.length <= 1) return renderSection(record, idx, sid, title, renderEditableField(record, fieldName, idx, sid, true));
    const stm = sectionTitleMatches(title);
    const sa = !searchTerm.trim() || record._showAllSections || stm;
    return (<div className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn${copiedId === `section-${sid}-${idx}` ? ' copied' : ''}`} onClick={() => copySectionText(record, idx, sid)}>{copiedId === `section-${sid}-${idx}` ? 'Copied' : 'Copy Section'}</button>{renderApproveButton(idx, sid)}</div></div>
      {sentences.map((sentence, si) => { if (!sa && !phraseMatch(sentence, searchTerm)) return null; const partKey = `${fieldName}-${idx}-p${si}`; const isEditing = editingField === partKey; const isEdited = editedFields[partKey]; const cid = `${sid}-${idx}-${si}`; const displayText = sentence.replace(/\.$/, ''); if (isEditing) return (<div key={si} className="rec-mini-card"><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) { const parts = splitBySentence(val); parts[si] = editValue.trim(); const newFull = parts.filter(p => p.trim().length > 0).map(p => p.replace(/\.$/, '')).join('. ') + '.'; handleSaveFieldWithValue(record, fieldName, idx, sid, newFull, partKey); } if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={2} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => { const parts = splitBySentence(val); parts[si] = editValue.trim(); const newFull = parts.filter(p => p.trim().length > 0).map(p => p.replace(/\.$/, '')).join('. ') + '.'; handleSaveFieldWithValue(record, fieldName, idx, sid, newFull, partKey); }} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>); return (<React.Fragment key={si}><div className="rec-mini-card"><div className={`numbered-row editable-row${isEdited ? ' modified' : ''}`} onClick={() => { setEditingField(partKey); setEditValue(displayText); }}><div className="row-content"><span className="content-value">{highlightText(displayText)}</span>{!isEdited && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(displayText, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{isEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}</div></React.Fragment>); }).filter(Boolean)}
    </div></div>);
  };

  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return records;
    return records.map((record, idx) => {
      const m = { ...record };
      Object.keys(localEdits).forEach(key => { if (pendingEdits[key]) return; const ld = key.lastIndexOf('-'); if (ld === -1) return; const fn = key.substring(0, ld); const ri = parseInt(key.substring(ld + 1), 10); if (ri === idx && fn in record) m[fn] = localEdits[key]; });
      ARRAY_FIELDS.forEach(field => { m[field] = getEffectiveArray(record, field, idx); });
      return m;
    });
  }, [records, localEdits, pendingEdits, getEffectiveArray]);

  const SECTION_TITLES = { dexaScan: 'DEXA SCAN', therapy: 'BONE PROTECTION THERAPY', riskFactors: 'RISK FACTORS', fractures: 'FRACTURES', clinical: 'CLINICAL ASSESSMENT', plan: 'PLAN', results: 'RESULTS', recommendations: 'RECOMMENDATIONS', providerInfo: 'PROVIDER INFORMATION', notes: 'NOTES' };

  const objectCopyLines = (label, value, indent) => {
    const pad = '  '.repeat(indent); const out = [];
    if (isEmptyDeep(value)) return out;
    if (isScalar(value)) { out.push(`${pad}${label ? label + ': ' : ''}${fmtScalar(value)}`); return out; }
    if (label) out.push(`${pad}${label}:`);
    Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => out.push(...objectCopyLines(humanizeKey(k), v, indent + (label ? 1 : 0))));
    return out;
  };

  const copySectionText = (record, idx, sid) => {
    const pr = pdfData[idx] || record; let text = `${SECTION_TITLES[sid] || sid.toUpperCase()}\n`;
    if (sid === 'dexaScan') { const d = pr.dexaScan; if (d) { if (d.tScore) text += `T-Score: ${d.tScore}\n`; if (d.result) text += `Result: ${d.result}\n`; if (d.scheduledDate) text += `Scheduled Date: ${d.scheduledDate}\n`; } }
    else if (sid === 'therapy') { if (pr.boneProtectionTherapy) { splitByComma(pr.boneProtectionTherapy).forEach((s, i) => { text += `${i + 1}. ${s}\n`; }); } }
    else if (sid === 'riskFactors') { getEffectiveArray(pr, 'riskFactors', idx).forEach((item, i) => { text += `${i + 1}. ${item}\n`; }); }
    else if (sid === 'fractures') { getEffectiveArray(pr, 'fractures', idx).forEach((item, i) => { text += `${i + 1}. ${item}\n`; }); }
    else if (sid === 'clinical') { ['findings', 'assessment'].forEach(f => { if (pr[f]) formatClinicalLines(FIELD_LABELS[f] || f, pr[f]).forEach(l => { text += `${l}\n`; }); }); }
    else if (sid === 'plan') { if (pr.plan) { splitBySentence(pr.plan).forEach((s, i) => { text += `${i + 1}. ${s.replace(/\.$/, '')}\n`; }); } }
    else if (sid === 'results') { const rv = pr.results; if (rv && !isScalar(rv)) { Object.entries(rv).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => objectCopyLines(humanizeKey(k), v, 0).forEach(l => { text += `${l}\n`; })); } }
    else if (sid === 'recommendations') { getEffectiveArray(pr, 'recommendations', idx).forEach((item, i) => { const t = typeof item === 'object' ? (item.recommendation || '') : String(item); text += `${i + 1}. ${t}\n`; }); }
    else if (sid === 'providerInfo') { if (pr.provider) text += `Provider: ${pr.provider}\n`; if (pr.facility) text += `Facility: ${pr.facility}\n`; if (pr.status) text += `Status: ${pr.status}\n`; }
    else if (sid === 'notes') { if (pr.notes) text += `${pr.notes}\n`; }
    copyToClipboard(text.trim(), `section-${sid}-${idx}`);
  };

  const copyAllContent = () => {
    let text = '=== BONE HEALTH ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Bone Health ${idx + 1}\n`;
      if (r.date) text += `${formatDate(r.date)}\n`;
      const d = r.dexaScan; if (d && (d.tScore || d.result || d.scheduledDate)) { text += '\nDEXA SCAN\n'; if (d.tScore) text += `T-Score: ${d.tScore}\n`; if (d.result) text += `Result: ${d.result}\n`; if (d.scheduledDate) text += `Scheduled Date: ${d.scheduledDate}\n`; }
      if (r.boneProtectionTherapy) { text += '\nBONE PROTECTION THERAPY\n'; splitByComma(r.boneProtectionTherapy).forEach((s, i) => { text += `${i + 1}. ${s}\n`; }); }
      const rf = getEffectiveArray(r, 'riskFactors', idx); if (rf.length) { text += '\nRISK FACTORS\n'; rf.forEach((item, i) => { text += `${i + 1}. ${item}\n`; }); }
      const fr = getEffectiveArray(r, 'fractures', idx); if (fr.length) { text += '\nFRACTURES\n'; fr.forEach((item, i) => { text += `${i + 1}. ${item}\n`; }); }
      if (r.findings || r.assessment) { text += '\nCLINICAL ASSESSMENT\n'; ['findings', 'assessment'].forEach(f => { if (r[f]) formatClinicalLines(FIELD_LABELS[f] || f, r[f]).forEach(l => { text += `${l}\n`; }); }); }
      if (r.plan) { text += '\nPLAN\n'; splitBySentence(r.plan).forEach((s, i) => { text += `${i + 1}. ${s.replace(/\.$/, '')}\n`; }); }
      if (r.results && !isScalar(r.results) && !isEmptyDeep(r.results)) { text += '\nRESULTS\n'; Object.entries(r.results).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => objectCopyLines(humanizeKey(k), v, 0).forEach(l => { text += `${l}\n`; })); }
      const recs = getEffectiveArray(r, 'recommendations', idx); if (recs.length) { text += '\nRECOMMENDATIONS\n'; recs.forEach((item, i) => { const t = typeof item === 'object' ? (item.recommendation || '') : String(item); text += `${i + 1}. ${t}\n`; }); }
      if (r.provider || r.facility || r.status) { text += '\nPROVIDER INFORMATION\n'; if (r.provider) text += `Provider: ${r.provider}\n`; if (r.facility) text += `Facility: ${r.facility}\n`; if (r.status) text += `Status: ${r.status}\n`; }
      if (r.notes) { text += '\nNOTES\n'; text += `${r.notes}\n`; }
      text += '\n';
    });
    copyToClipboard(text.trim(), 'copy-all');
  };

  const renderSection = (record, idx, sid, title, children) => { if (!children) return null; return (<div className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn${copiedId === `section-${sid}-${idx}` ? ' copied' : ''}`} onClick={() => copySectionText(record, idx, sid)}>{copiedId === `section-${sid}-${idx}` ? 'Copied' : 'Copy Section'}</button>{renderApproveButton(idx, sid)}</div></div>{children}</div></div>); };

  const renderMultiFieldSection = (record, idx, sid, title, fields) => {
    const visibleFields = fields.filter(f => getFieldValue(record, f, idx));
    if (visibleFields.length === 0) return null;
    if (!shouldShowSection(record, title, visibleFields.map(f => String(getFieldValue(record, f, idx) || '')), visibleFields)) return null;
    return renderSection(record, idx, sid, title, (() => { const stm = sectionTitleMatches(title); const sa = !searchTerm.trim() || record._showAllSections || stm; return <>{visibleFields.map(f => { if (!sa && !fieldMatches(record, f, idx)) return null; return <React.Fragment key={f}>{renderEditableField(record, f, idx, sid)}</React.Fragment>; })}</>; })());
  };

  /* COMMA-SPLIT section (boneProtectionTherapy): one editable mini-card per comma item; save re-splits + rejoins with ', '. */
  const renderCommaSection = (record, idx, sid, title, fn) => {
    const raw = String(getFieldValue(record, fn, idx) || '');
    if (!raw.trim()) return null;
    if (!shouldShowSection(record, title, [raw], [fn])) return null;
    const items = splitByComma(raw);
    if (items.length === 0) return null;
    return renderSection(record, idx, sid, title, (() => {
      const stm = sectionTitleMatches(title); const sa = !searchTerm.trim() || record._showAllSections || stm;
      return items.map((item, ci) => {
        if (!sa && !phraseMatch(item, searchTerm)) return null;
        const partKey = `${fn}-${idx}-c${ci}`; const ie = editingField === partKey; const ed = editedFields[partKey]; const cid = `comma-${fn}-${idx}-${ci}`;
        const saveItem = () => { const arr = splitByComma(getFieldValue(record, fn, idx)); arr[ci] = editValue.trim(); handleSaveFieldWithValue(record, fn, idx, sid, arr.join(', '), partKey); };
        if (ie) return (<div key={ci} className="rec-mini-card"><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveItem(); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={2} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={saveItem} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
        return (<div key={ci} className="rec-mini-card"><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(partKey); setEditValue(item); }}><div className="row-content"><span className="content-value">{highlightText(item)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(item, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
      }).filter(Boolean);
    })());
  };

  /* CLINICAL field (findings/assessment): when it contains "Label: value" parts, render each as a nested-subtitle
     mini-card (editable value); reassembly is lossless. Plain narrative (no labels) keeps the single-blob editor. */
  const renderClinicalLabelField = (record, fn, idx, sid) => {
    const value = String(getFieldValue(record, fn, idx) || '');
    if (!value.trim()) return null;
    const items = parseClinicalItems(value);
    if (!items.some(it => it.isLabeled)) return renderEditableField(record, fn, idx, sid);
    return (
      <div className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>
        {items.map((it, k) => {
          const partKey = `${fn}-${idx}-l${k}`; const ie = editingField === partKey; const ed = editedFields[partKey]; const cid = `clin-${fn}-${idx}-${k}`;
          // Number-aware editing: a numeric value (optional unit / ratio) edits via a number stepper, unit stays fixed.
          // Local digit-in-unit guard keeps ranges like "140-180 mg/dL" on the textarea (without touching the shared helper).
          const ratio = splitRatio(it.value);
          const nu = ratio ? null : (() => { const x = splitNumberUnit(it.value); return (x && !/\d/.test(x.unit)) ? x : null; })();
          const isNum = !!(ratio || nu);
          const editStart = ratio ? ratio.num : nu ? nu.num : it.value;
          const saveItem = () => {
            let newVal;
            if (ratio) { const n = parseFloat(editValue); if (isNaN(n)) return; newVal = `${n}/${ratio.denom}`; }
            else if (nu) { const n = parseFloat(editValue); if (isNaN(n)) return; newVal = nu.unit ? `${n}${nu.sep || ''}${nu.unit}` : String(n); }
            else { newVal = editValue.trim(); }
            handleSaveFieldWithValue(record, fn, idx, sid, rebuildClinical(items, k, newVal), partKey);
          };
          return (
            <div key={k} className="nested-mini-card">
              {it.isLabeled && <div className="nested-subtitle sub-label">{highlightText(it.label)}</div>}
              {ie ? (
                <div className="edit-field-container">
                  {isNum ? (
                    <div className="number-edit-row">
                      <input type="number" step={stepForNumber(ratio ? ratio.num : nu.num)} className="edit-number" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveItem(); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} />
                      {ratio ? <span className="number-edit-unit">{`/ ${ratio.denom}`}</span> : (nu.unit && <span className="number-edit-unit">{nu.unit}</span>)}
                    </div>
                  ) : (
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveItem(); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={2} disabled={saving} />
                  )}
                  <div className="edit-actions"><button className="save-btn" onClick={saveItem} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div>
                </div>
              ) : (
                <div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(partKey); setEditValue(editStart); }}>
                  <div className="row-content"><span className="content-value">{highlightText(it.value)}</span>{!ed && <span className="edit-indicator">✎</span>}</div>
                  <button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(it.isLabeled ? `${it.label}\n${it.value}` : it.value, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button>
                </div>
              )}
              {ed && <div className="modified-badge">edited - click Pending Approve to save</div>}
            </div>
          );
        })}
      </div>
    );
  };

  const renderClinicalSection = (record, idx) => {
    const fields = ['findings', 'assessment'].filter(f => getFieldValue(record, f, idx));
    if (fields.length === 0) return null;
    if (!shouldShowSection(record, 'Clinical Assessment', fields.map(f => String(getFieldValue(record, f, idx) || '')), fields)) return null;
    return renderSection(record, idx, 'clinical', 'Clinical Assessment', (() => { const stm = sectionTitleMatches('Clinical Assessment'); const sa = !searchTerm.trim() || record._showAllSections || stm; return <>{fields.map(f => { if (!sa && !fieldMatches(record, f, idx)) return null; return <React.Fragment key={f}>{renderClinicalLabelField(record, f, idx, 'clinical')}</React.Fragment>; })}</>; })());
  };

  const renderArraySection = (record, idx, sid, title, fieldName) => {
    const items = Array.isArray(record[fieldName]) ? record[fieldName].filter(Boolean) : [];
    if (items.length === 0) return null;
    if (!shouldShowSection(record, title, items.map(i => typeof i === 'object' ? i.recommendation : i), [fieldName])) return null;
    return renderSection(record, idx, sid, title, (() => { const stm = sectionTitleMatches(title); const sa = !searchTerm.trim() || record._showAllSections || stm; return items.map((item, ai) => { const val = typeof item === 'object' ? (item.recommendation || '') : String(item); const lv = localEdits[`${fieldName}-${idx}-${ai}`] !== undefined ? localEdits[`${fieldName}-${idx}-${ai}`] : val; if (!sa && !phraseMatch(lv, searchTerm)) return null; return renderEditableArrayItem(record, fieldName, idx, sid, item, ai); }).filter(Boolean); })());
  };

  if (!filteredRecords || filteredRecords.length === 0) return (<article className="bone-health-document"><header className="document-header"><h1 className="document-title">Bone Health</h1></header><SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} /><div className="empty-state">No data available.</div></article>);

  return (
    <article className="bone-health-document">
      <header className="document-header">
        <h1 className="document-title">Bone Health</h1>
        <div className="header-actions">
          <button className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`} onClick={copyAllContent}>{copiedId === 'copy-all' ? 'Copied' : 'Copy All'}</button>
          <PDFDownloadLink document={<BoneHealthDocumentPDFTemplate document={pdfData} />} fileName="Bone_Health.pdf">
            {({ loading }) => <button className="copy-btn">{loading ? 'Preparing...' : 'Export PDF'}</button>}
          </PDFDownloadLink>
        </div>
      </header>
      <SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />
      <div className="records-container">
        {filteredRecords.map((record, idx) => {
          const dexa = record.dexaScan;
          return (
          <div key={idx} className="record-card">
            <div className="record-header">
              <div className="record-meta-row">{record.date && <span className="record-date">{highlightText(formatDate(record.date))}</span>}</div>
              <div className="record-title-row"><h3 className="record-name">{highlightText(`Bone Health ${idx + 1}`)}</h3></div>
            </div>

            {/* DEXA Scan — nested object with dot-path editing */}
            {dexa && (dexa.tScore || dexa.result || dexa.scheduledDate) && shouldShowSection(record, 'DEXA Scan', [dexa.tScore, dexa.result, dexa.scheduledDate].filter(Boolean), ['dexaScan']) && renderSection(record, idx, 'dexaScan', 'DEXA Scan', <>{renderNestedEditableField(record, idx, 'dexaScan', 'tScore', 'T-Score', dexa.tScore, 'dexaScan')}{renderNestedEditableField(record, idx, 'dexaScan', 'result', 'Result', dexa.result, 'dexaScan')}{renderNestedEditableField(record, idx, 'dexaScan', 'scheduledDate', 'Scheduled Date', dexa.scheduledDate, 'dexaScan')}</>)}

            {/* Bone Protection Therapy — comma-split editable rows */}
            {renderCommaSection(record, idx, 'therapy', 'Bone Protection Therapy', 'boneProtectionTherapy')}

            {renderArraySection(record, idx, 'riskFactors', 'Risk Factors', 'riskFactors')}
            {renderArraySection(record, idx, 'fractures', 'Fractures', 'fractures')}
            {renderClinicalSection(record, idx)}
            {renderSentenceSplitSection(record, idx, 'plan', 'Plan', 'plan')}
            {renderResultsSection(record, idx, 'results', 'Results')}
            {renderArraySection(record, idx, 'recommendations', 'Recommendations', 'recommendations')}
            {renderMultiFieldSection(record, idx, 'providerInfo', 'Provider Information', ['provider', 'facility', 'status'])}

            {/* Notes */}
            {record.notes && shouldShowSection(record, 'Notes', [record.notes], ['notes']) && renderSection(record, idx, 'notes', 'Notes', renderEditableField(record, 'notes', idx, 'notes', true))}
          </div>
          );
        })}
      </div>
    </article>
  );
};

export default BoneHealthDocument;
