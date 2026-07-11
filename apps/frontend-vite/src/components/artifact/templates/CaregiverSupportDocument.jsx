/**
 * CaregiverSupportDocument.jsx
 * March 2026 blue glow theme with inline editing.
 * Multiple editable arrays + flat fields + comma-split fields. Collection: caregiver_support
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import CaregiverSupportDocumentPDFTemplate from '../pdf-templates/CaregiverSupportDocumentPDFTemplate';
import './CaregiverSupportDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [draftKey]: value } }
   draftKey mirrors the editKey with the record index removed:
     flat field   -> "fn"            (editKey "fn-idx")
     array item   -> "fn~a~ai"       (editKey "fn-idx-ai")
     comma part   -> "fn~c~ci"       (editKey "fn-idx-cCi") — display-only; the merged full value lives under "fn" */
const DRAFT_KEY = 'caregiver_supportPendingEdits';
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
  caregiver: ['caregiverName', 'relationshipToPatient', 'provider', 'facility'],
  metrics: ['caregiverBurdenScore', 'hoursOfCarePerWeek', 'caregivingDuration', 'caregiverStressLevel'],
  adls: ['assistanceWithAdls'],
  iadls: ['assistanceWithIadls'],
  health: ['sleepDisruptionFrequency', 'socialIsolationLevel'],
  healthConcerns: ['caregiverHealthConcerns'],
  support: ['supportGroupParticipation', 'respiteCareUtilization', 'caregiverCounselingReferral'],
  training: ['caregiverTrainingProvided'],
  coping: ['caregiverCopingStrategies'],
  homeMods: ['homeModificationsNeeded'],
  devices: ['assistiveDevicesUsed'],
  roles: ['medicalDecisionMakingRole', 'emergencyBackupPlan', 'careTransitionConcerns', 'financialStrainLevel', 'employmentImpact'],
};
const FIELD_LABELS = {
  caregiverName: 'Caregiver Name', relationshipToPatient: 'Relationship', provider: 'Provider', facility: 'Facility',
  caregiverBurdenScore: 'Burden Score', hoursOfCarePerWeek: 'Hours/Week', caregivingDuration: 'Duration', caregiverStressLevel: 'Stress Level',
  sleepDisruptionFrequency: 'Sleep Disruption', socialIsolationLevel: 'Social Isolation',
  supportGroupParticipation: 'Support Group', respiteCareUtilization: 'Respite Care', caregiverCounselingReferral: 'Counseling Referral',
  medicalDecisionMakingRole: 'Decision-Making Role', emergencyBackupPlan: 'Emergency Plan',
  careTransitionConcerns: 'Transition Concerns', financialStrainLevel: 'Financial Strain', employmentImpact: 'Employment Impact',
  assistanceWithAdls: 'ADL Assistance', assistanceWithIadls: 'IADL Assistance', caregiverHealthConcerns: 'Health Concerns',
  caregiverTrainingProvided: 'Training', caregiverCopingStrategies: 'Coping Strategies',
  homeModificationsNeeded: 'Home Modifications', assistiveDevicesUsed: 'Assistive Devices',
};
const ARRAY_FIELDS = ['assistanceWithAdls', 'assistanceWithIadls', 'caregiverHealthConcerns', 'caregiverTrainingProvided', 'caregiverCopingStrategies', 'homeModificationsNeeded', 'assistiveDevicesUsed'];
const COMMA_SPLIT_FIELDS = new Set(['medicalDecisionMakingRole', 'emergencyBackupPlan', 'careTransitionConcerns', 'financialStrainLevel', 'employmentImpact', 'supportGroupParticipation']);
// Numeric fields stored as numbers in DB; 0 is a "not recorded" sentinel here so hide-zero, and edit via typed number input.
const NUMBER_FIELDS = new Set(['caregiverBurdenScore', 'hoursOfCarePerWeek']);

/* Copy-text divider lines: '=' under section titles, '-' under field sub-labels. */
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);
/* number stepper: step matches the value's decimal precision */
const stepFor = (v) => { const d = String(v ?? '').split('.')[1]; return d ? '0.' + '0'.repeat(Math.max(0, d.length - 1)) + '1' : '1'; };
/* splitByComma: top-level commas only — NOT inside parentheses, NOT when "and"/"or" sits
   right before or right after the comma, NOT without a following space ("$18,000") */
const splitByComma = (text) => {
  const s = String(text || ''); const out = []; let cur = ''; let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(') { depth++; cur += ch; continue; }
    if (ch === ')') { depth = Math.max(0, depth - 1); cur += ch; continue; }
    if (ch === ',' && depth === 0) {
      if (!/\s/.test(s[i + 1] || '')) { cur += ch; continue; }
      const rest = s.slice(i + 1).replace(/^\s+/, '');
      if (/^(and|or)\b/i.test(rest)) { cur += ch; continue; }
      if (/\b(and|or)\s*$/i.test(cur)) { cur += ch; continue; }
      const t = cur.trim(); if (t) out.push(t); cur = ''; continue;
    }
    cur += ch;
  }
  const t = cur.trim(); if (t) out.push(t);
  return out.length ? out : (s.trim() ? [s.trim()] : []);
};

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; };
// For number fields, treat 0 (and blank/NaN) as not-present so the sentinel zero is hidden.
const hasNumVal = (v) => { if (v === null || v === undefined || v === '') return false; const n = parseFloat(v); return !isNaN(n) && n !== 0; };
const fieldHasVal = (fn, v) => NUMBER_FIELDS.has(fn) ? hasNumVal(v) : hasVal(v);
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };

const CaregiverSupportDocument = ({ document: rawDoc }) => {
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
      if (r?.caregiver_support) return Array.isArray(r.caregiver_support) ? r.caregiver_support : [r.caregiver_support];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.caregiver_support) return Array.isArray(dd.caregiver_support) ? dd.caregiver_support : [dd.caregiver_support]; return [dd]; }
      return r;
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [rawDoc]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const idOf = (r) => { const id = r && r._id; if (!id) return null; if (typeof id === 'string') return id; if (id.$oid) return id.$oid; return String(id); };
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const rid = idOf(record);
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([draftKey, value]) => {
        // draftKey -> editKey by inserting the current render index:
        //   "fn"        -> "fn-idx"            (flat / merged comma value)
        //   "fn~a~ai"   -> "fn-idx-ai"         (array item)
        //   "fn~c~ci"   -> "fn-idx-cCi"        (comma display part)
        let editKey;
        const aPos = draftKey.indexOf('~a~');
        const cPos = draftKey.indexOf('~c~');
        if (aPos !== -1) { const fn = draftKey.slice(0, aPos); const ai = draftKey.slice(aPos + 3); editKey = `${fn}-${idx}-${ai}`; }
        else if (cPos !== -1) { const fn = draftKey.slice(0, cPos); const ci = draftKey.slice(cPos + 3); editKey = `${fn}-${idx}-c${ci}`; }
        else { editKey = `${draftKey}-${idx}`; }
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
  const getFieldValue = useCallback((record, fn, idx) => { const k = `${fn}-${idx}`; if (localEdits[k] !== undefined) return localEdits[k]; return record[fn]; }, [localEdits]);
  const getRecordId = (r) => { const id = r._id; if (!id) return null; if (typeof id === 'string') return id; if (id.$oid) return id.$oid; return String(id); };
  const copyToClipboard = async (text, id) => { try { await navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); } catch {} };
  // Used by the PDF/Copy paths → must EXCLUDE pending drafts (committed edits only).
  const getEffectiveArray = useCallback((record, fieldName, idx) => { const original = Array.isArray(record[fieldName]) ? [...record[fieldName]] : []; original.forEach((_, ai) => { const ek = `${fieldName}-${idx}-${ai}`; if (localEdits[ek] !== undefined && !pendingEdits[ek]) original[ai] = localEdits[ek]; }); return original; }, [localEdits, pendingEdits]);

  const getEffectiveCommaParts = useCallback((record, fn, idx) => {
    const raw = getFieldValue(record, fn, idx);
    if (!hasVal(raw)) return [];
    return splitByComma(raw).map((p, ci) => {
      const ck = `${fn}-${idx}-c${ci}`;
      return localEdits[ck] !== undefined ? localEdits[ck] : p;
    });
  }, [localEdits, getFieldValue]);

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid) => {
    const rid = getRecordId(record); if (!rid) { console.error('[CaregiverSupport] Cannot save — no record ID'); return; }
    // Number fields must persist as numbers, not strings, to keep DB shape and avoid string sentinels.
    let outValue = editValue;
    if (NUMBER_FIELDS.has(fn)) { const n = parseFloat(editValue); outValue = isNaN(n) ? 0 : n; }
    const ek = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: outValue }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    // Re-edit after approval → drop the section's 'approved' flag so the button goes back to yellow Pending.
    setApprovedSections(prev => { const key = `${sid}-${idx}`; if (!prev[key]) return prev; const n = { ...prev }; delete n[key]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][fn] = outValue;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue]);

  // Save = stage a DRAFT locally (no DB write). Approve commits with arrayIndex.
  const handleSaveArrayItem = useCallback((record, fn, idx, sid, arrayIndex) => {
    const rid = getRecordId(record); if (!rid) { console.error('[CaregiverSupport] Cannot save — no record ID'); return; }
    const ek = `${fn}-${idx}-${arrayIndex}`;
    setLocalEdits(prev => ({ ...prev, [ek]: editValue }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    setApprovedSections(prev => { const key = `${sid}-${idx}`; if (!prev[key]) return prev; const n = { ...prev }; delete n[key]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][`${fn}~a~${arrayIndex}`] = editValue;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue]);

  // Save = stage a DRAFT locally (no DB write). Stages both the merged full value (committed on Approve)
  // and the per-part display value (so the edited sentence shows + survives refresh).
  const saveCommaItem = useCallback((record, fn, idx, sid, ci) => {
    const rid = getRecordId(record); if (!rid) { console.error('[CaregiverSupport] Cannot save — no record ID'); return; }
    const raw = getFieldValue(record, fn, idx);
    const parts = splitByComma(raw).map((p, i) => {
      if (i === ci) return editValue;
      const ck = `${fn}-${idx}-c${i}`;
      return localEdits[ck] !== undefined ? localEdits[ck] : p;
    });
    const filtered = parts.filter(p => p.trim());
    const newValue = filtered.join(', ');
    const ek = `${fn}-${idx}`; const ck = `${fn}-${idx}-c${ci}`;
    setLocalEdits(prev => ({ ...prev, [ek]: newValue, [ck]: editValue }));
    setPendingEdits(prev => ({ ...prev, [ek]: true, [ck]: true }));
    setEditedFields(prev => ({ ...prev, [ck]: 'edited' }));
    setApprovedSections(prev => { const key = `${sid}-${idx}`; if (!prev[key]) return prev; const n = { ...prev }; delete n[key]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][fn] = newValue;            // merged full value → committed to DB on Approve
    store[rid][`${fn}~c~${ci}`] = editValue; // per-part display value → repopulates the edited sentence
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, localEdits, getFieldValue]);

  // Approve = COMMIT all staged drafts for this section to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, idx, sid) => {
    const rid = getRecordId(record); if (!rid) return;
    setApproving(true);
    const sf = SECTION_FIELDS[sid] || [];
    // Decompose an editKey "fn-idx[-ai | -cCi]" → { field, recordIdx, arrayIndex? } or null if not parseable.
    const parseKey = (k) => {
      const di = k.lastIndexOf('-');
      if (di === -1) return null;
      const tail = k.slice(di + 1);
      const head = k.slice(0, di);
      if (/^\d+$/.test(tail)) {
        // tail is numeric → either "fn-idx" (head has no more dashes for this fn) or "fn-idx-ai".
        const di2 = head.lastIndexOf('-');
        if (di2 !== -1 && /^\d+$/.test(head.slice(di2 + 1))) {
          // head = "fn-idx", tail = arrayIndex
          return { field: head.slice(0, di2), recordIdx: parseInt(head.slice(di2 + 1), 10), arrayIndex: parseInt(tail, 10) };
        }
        // "fn-idx"
        return { field: head, recordIdx: parseInt(tail, 10) };
      }
      if (/^c\d+$/.test(tail)) {
        // comma display key "fn-idx-cCi" — not committed individually (merged value under "fn-idx" carries it).
        const di2 = head.lastIndexOf('-');
        if (di2 === -1) return null;
        return { field: head.slice(0, di2), recordIdx: parseInt(head.slice(di2 + 1), 10), commaPart: true };
      }
      return null;
    };
    const toCommit = Object.keys(localEdits).filter(k => pendingEdits[k]).map(k => ({ k, p: parseKey(k) }))
      .filter(({ p }) => p && p.recordIdx === idx && sf.includes(p.field) && !p.commaPart);
    try {
      const sc = (await import('../../../services/secureApiClient')).default;
      for (const { k, p } of toCommit) {
        const payload = { field: p.field, value: localEdits[k] };
        if (typeof p.arrayIndex === 'number') payload.arrayIndex = p.arrayIndex;
        await sc.put(`/api/edit/caregiver_support/${rid}/edit`, payload);
      }
      await sc.put(`/api/edit/caregiver_support/${rid}/approve`, { sectionId: sid, approved: true });
      // Clear pending → committed edits now flow into pdfData/PDF. Also clear the comma display keys for this section.
      setPendingEdits(prev => {
        const n = { ...prev };
        Object.keys(n).forEach(k => { const pp = parseKey(k); if (pp && pp.recordIdx === idx && sf.includes(pp.field)) delete n[k]; });
        return n;
      });
      // Drop this record's committed drafts from localStorage (only the keys for this section's fields).
      const store = readDrafts();
      if (store[rid]) {
        Object.keys(store[rid]).forEach(draftKey => {
          const aPos = draftKey.indexOf('~a~'); const cPos = draftKey.indexOf('~c~');
          const baseFn = aPos !== -1 ? draftKey.slice(0, aPos) : cPos !== -1 ? draftKey.slice(0, cPos) : draftKey;
          if (sf.includes(baseFn)) delete store[rid][draftKey];
        });
        if (Object.keys(store[rid]).length === 0) delete store[rid];
        writeDrafts(store);
      }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { sf.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    }
    catch (err) { console.error('[CaregiverSupport] Approve failed:', err); }
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
      const title = `Caregiver Support ${idx + 1}`;
      const allText = [title, formatDate(record.date), ...Object.keys(FIELD_LABELS).map(f => fmtVal(record[f])), ...ARRAY_FIELDS.flatMap(f => Array.isArray(record[f]) ? record[f] : []), ...Object.values(FIELD_LABELS), 'Caregiver', 'Care Metrics', 'ADLs', 'IADLs', 'Health', 'Support', 'Training', 'Roles'].filter(Boolean).join(' ');
      const match = allText.toLowerCase().includes(sl);
      record._showAllSections = match && title.toLowerCase().startsWith(sl);
      return match;
    });
  }, [records, searchTerm]);

  const sectionHasEdits = (idx, sid) => { const fs = SECTION_FIELDS[sid] || []; return fs.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`))); };
  const renderApproveButton = (record, idx, sid) => { const he = sectionHasEdits(idx, sid); const ia = approvedSections[`${sid}-${idx}`]; if (he) return <button className="approve-btn pending" disabled={approving} onClick={(e) => { e.stopPropagation(); handleApproveSection(record, idx, sid); }}>{approving ? 'Approving...' : 'Pending Approve'}</button>; if (ia) return <span className="approve-btn approved">Approved</span>; return null; };

  const renderEditableField = (record, fn, idx, sid) => {
    const raw = getFieldValue(record, fn, idx); if (!fieldHasVal(fn, raw)) return null;
    const isNum = NUMBER_FIELDS.has(fn);
    const dv = fmtVal(raw); const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`;
    if (ie) {
      const stepVal = parseFloat(stepFor(raw)) || 1;
      const stepDecs = (String(stepVal).split('.')[1] || '').length;
      const stepNum = (dir) => { const cur = parseFloat(editValue); setEditValue(((isNaN(cur) ? 0 : cur) + dir * stepVal).toFixed(stepDecs)); };
      return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div><div className="edit-field-container">{isNum ? (
        <div className="num-stepper-row">
          <button type="button" className="num-step" onClick={() => stepNum(-1)} disabled={saving}>−</button>
          <input type="number" step={stepFor(raw)} className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Enter') handleSaveField(record, fn, idx, sid); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} disabled={saving} />
          <button type="button" className="num-step" onClick={() => stepNum(1)} disabled={saving}>+</button>
        </div>
      ) : (<textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveField(record, fn, idx, sid); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} />)}<div className="edit-actions"><button className="save-btn" onClick={() => handleSaveField(record, fn, idx, sid)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    }
    return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(dv); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  const renderCommaSplitField = (record, fn, idx, sid) => {
    const parts = getEffectiveCommaParts(record, fn, idx);
    if (parts.length === 0) return null;
    return (
      <div className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>
        {parts.map((part, ci) => {
          const ck = `${fn}-${idx}-c${ci}`;
          const ie = editingField === ck;
          const ed = editedFields[ck];
          const cid = `comma-${fn}-${idx}-${ci}`;
          if (ie) return (
            <div key={ci} className="edit-field-container">
              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveCommaItem(record, fn, idx, sid, ci); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} />
              <div className="edit-actions">
                <button className="save-btn" onClick={() => saveCommaItem(record, fn, idx, sid, ci)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
              </div>
            </div>
          );
          return (
            <React.Fragment key={ci}>
              <div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ck); setEditValue(part); }}>
                <div className="row-content"><span className="content-value">{highlightText(part)}</span>{!ed && <span className="edit-indicator">✎</span>}</div>
                <button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(part, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button>
              </div>
              {ed && <div className="modified-badge">edited - click Pending Approve to save</div>}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  const renderEditableArrayItem = (record, fn, idx, sid, item, ai) => {
    const ek = `${fn}-${idx}-${ai}`; const val = localEdits[ek] !== undefined ? localEdits[ek] : String(item || '');
    const ie = editingField === ek; const ed = editedFields[ek]; const cid = `arr-${fn}-${idx}-${ai}`;
    if (ie) return (<div key={ai} className="rec-mini-card"><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveArrayItem(record, fn, idx, sid, ai); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => handleSaveArrayItem(record, fn, idx, sid, ai)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div key={ai} className="rec-mini-card"><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(val); }}><div className="row-content"><span className="content-value">{highlightText(val)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(val, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return records;
    return records.map((record, idx) => {
      const m = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF/Copy until approved
        const ld = key.lastIndexOf('-'); if (ld === -1) return;
        const fn = key.substring(0, ld); const ri = parseInt(key.substring(ld + 1), 10);
        if (ri === idx && fn in record) m[fn] = localEdits[key];
      });
      // Array fields: merge only committed (non-pending) per-item edits.
      ARRAY_FIELDS.forEach(field => {
        const original = Array.isArray(record[field]) ? [...record[field]] : [];
        original.forEach((_, ai) => { const ek = `${field}-${idx}-${ai}`; if (localEdits[ek] !== undefined && !pendingEdits[ek]) original[ai] = localEdits[ek]; });
        m[field] = original;
      });
      return m;
    });
  }, [records, localEdits, pendingEdits]);

  const SECTION_TITLES = { caregiver: 'CAREGIVER', metrics: 'CARE METRICS', adls: 'ADL ASSISTANCE', iadls: 'IADL ASSISTANCE', health: 'HEALTH & WELLBEING', healthConcerns: 'HEALTH CONCERNS', support: 'SUPPORT SERVICES', training: 'TRAINING', coping: 'COPING STRATEGIES', homeMods: 'HOME MODIFICATIONS', devices: 'ASSISTIVE DEVICES', roles: 'ROLES & PLANNING' };

  const copySectionText = (record, idx, sid) => {
    const pr = pdfData[idx] || record; const title = SECTION_TITLES[sid] || sid.toUpperCase();
    let text = `${title}\n${COPY_LINE_EQ}\n`;
    const showLabel = (fn) => (FIELD_LABELS[fn] || fn).trim().toLowerCase() !== title.trim().toLowerCase();
    const labelLine = (fn) => { if (showLabel(fn)) text += `${FIELD_LABELS[fn] || fn}\n${COPY_LINE_DASH}\n`; };
    const addF = (fn) => { if (fieldHasVal(fn, pr[fn])) { labelLine(fn); text += `1. ${fmtVal(pr[fn])}\n`; } };
    const addCommaSplit = (fn) => {
      if (!hasVal(pr[fn])) return;
      labelLine(fn);
      splitByComma(pr[fn]).forEach((p, i) => { text += `${i + 1}. ${p}\n`; });
    };
    const addArr = (fn) => { getEffectiveArray(pr, fn, idx).forEach((it, i) => { text += `${i + 1}. ${it}\n`; }); };
    const arrSids = { adls: 'assistanceWithAdls', iadls: 'assistanceWithIadls', healthConcerns: 'caregiverHealthConcerns', training: 'caregiverTrainingProvided', coping: 'caregiverCopingStrategies', homeMods: 'homeModificationsNeeded', devices: 'assistiveDevicesUsed' };
    if (arrSids[sid]) { addArr(arrSids[sid]); }
    else { (SECTION_FIELDS[sid] || []).forEach(fn => { if (COMMA_SPLIT_FIELDS.has(fn)) addCommaSplit(fn); else addF(fn); }); }
    copyToClipboard(text.trim(), `section-${sid}-${idx}`);
  };

  const copyAllContent = () => {
    let text = '=== CAREGIVER SUPPORT ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Caregiver Support ${idx + 1}\n${COPY_LINE_EQ}\n`;
      if (r.date) text += `${formatDate(r.date)}\n`;
      const showLabel = (fn, title) => (FIELD_LABELS[fn] || fn).trim().toLowerCase() !== String(title || '').trim().toLowerCase();
      const labelLine = (fn, title) => { if (showLabel(fn, title)) text += `${FIELD_LABELS[fn] || fn}\n${COPY_LINE_DASH}\n`; };
      const addF = (fn, title) => { if (fieldHasVal(fn, r[fn])) { labelLine(fn, title); text += `1. ${fmtVal(r[fn])}\n`; } };
      const addCommaSplit = (fn, title) => {
        if (!hasVal(r[fn])) return;
        labelLine(fn, title);
        splitByComma(r[fn]).forEach((p, i) => { text += `${i + 1}. ${p}\n`; });
      };
      const addArr = (title, fn) => { const items = getEffectiveArray(r, fn, idx); if (items.length) { text += `\n${title}\n${COPY_LINE_EQ}\n`; items.forEach((it, i) => { text += `${i + 1}. ${it}\n`; }); } };
      const simpleFs = (title, fields) => { const vis = fields.filter(f => fieldHasVal(f, r[f])); if (vis.length) { text += `\n${title}\n${COPY_LINE_EQ}\n`; vis.forEach(f => addF(f, title)); } };
      const commaSplitFs = (title, fields) => {
        const vis = fields.filter(f => hasVal(r[f]));
        if (vis.length === 0) return;
        text += `\n${title}\n${COPY_LINE_EQ}\n`;
        vis.forEach(fn => { if (COMMA_SPLIT_FIELDS.has(fn)) addCommaSplit(fn, title); else addF(fn, title); });
      };
      simpleFs('CAREGIVER', ['caregiverName', 'relationshipToPatient', 'provider', 'facility']);
      simpleFs('CARE METRICS', ['caregiverBurdenScore', 'hoursOfCarePerWeek', 'caregivingDuration', 'caregiverStressLevel']);
      addArr('ADL ASSISTANCE', 'assistanceWithAdls'); addArr('IADL ASSISTANCE', 'assistanceWithIadls');
      simpleFs('HEALTH & WELLBEING', ['sleepDisruptionFrequency', 'socialIsolationLevel']);
      addArr('HEALTH CONCERNS', 'caregiverHealthConcerns');
      commaSplitFs('SUPPORT SERVICES', ['supportGroupParticipation', 'respiteCareUtilization', 'caregiverCounselingReferral']);
      addArr('TRAINING', 'caregiverTrainingProvided'); addArr('COPING STRATEGIES', 'caregiverCopingStrategies');
      addArr('HOME MODIFICATIONS', 'homeModificationsNeeded'); addArr('ASSISTIVE DEVICES', 'assistiveDevicesUsed');
      commaSplitFs('ROLES & PLANNING', ['medicalDecisionMakingRole', 'emergencyBackupPlan', 'careTransitionConcerns', 'financialStrainLevel', 'employmentImpact']);
      text += '\n';
    });
    copyToClipboard(text.trim(), 'copy-all');
  };

  const renderSection = (record, idx, sid, title, children) => { if (!children) return null; return (<div className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn${copiedId === `section-${sid}-${idx}` ? ' copied' : ''}`} onClick={() => copySectionText(record, idx, sid)}>{copiedId === `section-${sid}-${idx}` ? 'Copied' : 'Copy Section'}</button>{renderApproveButton(record, idx, sid)}</div></div>{children}</div></div>); };

  const renderMultiFieldSection = (record, idx, sid, title, fields) => {
    const visibleFields = fields.filter(f => fieldHasVal(f, getFieldValue(record, f, idx)));
    if (visibleFields.length === 0) return null;
    if (!shouldShowSection(record, title, visibleFields.map(f => fmtVal(getFieldValue(record, f, idx))), visibleFields)) return null;
    return renderSection(record, idx, sid, title, (() => { const stm = sectionTitleMatches(title); const sa = !searchTerm.trim() || record._showAllSections || stm; return <>{visibleFields.map(f => { if (!sa && !fieldMatches(record, f, idx)) return null; if (COMMA_SPLIT_FIELDS.has(f)) return <React.Fragment key={f}>{renderCommaSplitField(record, f, idx, sid)}</React.Fragment>; return <React.Fragment key={f}>{renderEditableField(record, f, idx, sid)}</React.Fragment>; })}</>; })());
  };

  const renderArraySection = (record, idx, sid, title, fieldName) => {
    const items = Array.isArray(record[fieldName]) ? record[fieldName].filter(Boolean) : [];
    if (items.length === 0) return null;
    if (!shouldShowSection(record, title, items, [fieldName])) return null;
    return renderSection(record, idx, sid, title, (() => { const stm = sectionTitleMatches(title); const sa = !searchTerm.trim() || record._showAllSections || stm; return items.map((item, ai) => { const val = localEdits[`${fieldName}-${idx}-${ai}`] !== undefined ? localEdits[`${fieldName}-${idx}-${ai}`] : item; if (!sa && !phraseMatch(val, searchTerm)) return null; return renderEditableArrayItem(record, fieldName, idx, sid, item, ai); }).filter(Boolean); })());
  };

  if (!filteredRecords || filteredRecords.length === 0) return (<article className="caregiver-support-document"><header className="document-header"><h1 className="document-title">Caregiver Support</h1></header><SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} /><div className="empty-state">No data available.</div></article>);

  return (
    <article className="caregiver-support-document">
      <header className="document-header">
        <h1 className="document-title">Caregiver Support</h1>
        <div className="header-actions">
          <button className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`} onClick={copyAllContent}>{copiedId === 'copy-all' ? 'Copied' : 'Copy All'}</button>
          <PDFDownloadLink document={<CaregiverSupportDocumentPDFTemplate document={pdfData} />} fileName="Caregiver_Support.pdf">
            {({ loading }) => <button className="copy-btn">{loading ? 'Preparing...' : 'Export PDF'}</button>}
          </PDFDownloadLink>
        </div>
      </header>
      <SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <div className="record-meta-row">
                {record.date && <span className="record-date">{highlightText(formatDate(record.date))}</span>}
              </div>
              <div className="record-title-row"><h3 className="record-name">{highlightText(`Caregiver Support ${idx + 1}`)}</h3></div>
            </div>
            {renderMultiFieldSection(record, idx, 'caregiver', 'Caregiver', SECTION_FIELDS.caregiver)}
            {renderMultiFieldSection(record, idx, 'metrics', 'Care Metrics', SECTION_FIELDS.metrics)}
            {renderArraySection(record, idx, 'adls', 'ADL Assistance', 'assistanceWithAdls')}
            {renderArraySection(record, idx, 'iadls', 'IADL Assistance', 'assistanceWithIadls')}
            {renderMultiFieldSection(record, idx, 'health', 'Health & Wellbeing', SECTION_FIELDS.health)}
            {renderArraySection(record, idx, 'healthConcerns', 'Health Concerns', 'caregiverHealthConcerns')}
            {renderMultiFieldSection(record, idx, 'support', 'Support Services', SECTION_FIELDS.support)}
            {renderArraySection(record, idx, 'training', 'Training', 'caregiverTrainingProvided')}
            {renderArraySection(record, idx, 'coping', 'Coping Strategies', 'caregiverCopingStrategies')}
            {renderArraySection(record, idx, 'homeMods', 'Home Modifications', 'homeModificationsNeeded')}
            {renderArraySection(record, idx, 'devices', 'Assistive Devices', 'assistiveDevicesUsed')}
            {renderMultiFieldSection(record, idx, 'roles', 'Roles & Planning', SECTION_FIELDS.roles)}
          </div>
        ))}
      </div>
    </article>
  );
};

export default CaregiverSupportDocument;
