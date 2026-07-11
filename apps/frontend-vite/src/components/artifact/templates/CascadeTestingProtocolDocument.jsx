/**
 * CascadeTestingProtocolDocument.jsx
 * March 2026 blue glow theme with inline editing.
 * Flat fields + arrays + comma-split + sentence-split. Collection: cascade_testing_protocol
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import BlueDatePicker from '../components/BlueDatePicker';
import CascadeTestingProtocolDocumentPDFTemplate from '../pdf-templates/CascadeTestingProtocolDocumentPDFTemplate';
import './CascadeTestingProtocolDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'cascade_testing_protocolPendingEdits';
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
  condition: ['geneticCondition', 'inheritancePattern', 'clinicalPenetrance', 'carrierStatus'],
  testing: ['testingMethodology', 'targetMutation', 'testingLaboratory'],
  consent: ['priorRiskCounseling', 'informedConsentDate', 'geneticCounselorInvolvement', 'participationConsent'],
  risk: ['preTestProbability', 'riskStratificationScore', 'familyHistoryAccuracy'],
  indexCase: ['indexCaseIdentifier', 'familialRelationshipToIndex', 'pedigreePosition', 'cascadeRecruitmentMethod'],
  surveillance: ['surveillanceProtocol'],
  phenotypic: ['phenotypicScreeningResults'],
  psychosocial: ['psychosocialSupport'],
  disclosure: ['disclosurePreferences'],
  interventions: ['preventiveInterventions'],
  followUp: ['followUpSchedule'],
};
const FIELD_LABELS = {
  geneticCondition: 'Genetic Condition', inheritancePattern: 'Inheritance Pattern', clinicalPenetrance: 'Clinical Penetrance (%)', carrierStatus: 'Carrier Status',
  testingMethodology: 'Testing Methodology', targetMutation: 'Target Mutation', testingLaboratory: 'Testing Laboratory',
  priorRiskCounseling: 'Prior Risk Counseling', informedConsentDate: 'Informed Consent Date', geneticCounselorInvolvement: 'Genetic Counselor Involvement', participationConsent: 'Participation Consent',
  preTestProbability: 'Pre-Test Probability (%)', riskStratificationScore: 'Risk Stratification Score', familyHistoryAccuracy: 'Family History Accuracy',
  indexCaseIdentifier: 'Index Case Identifier', familialRelationshipToIndex: 'Familial Relationship', pedigreePosition: 'Pedigree Position', cascadeRecruitmentMethod: 'Cascade Recruitment Method',
  surveillanceProtocol: 'Surveillance Protocol', psychosocialSupport: 'Psychosocial Support',
  disclosurePreferences: 'Disclosure Preferences', followUpSchedule: 'Follow-Up Schedule',
  preventiveInterventions: 'Preventive Interventions', phenotypicScreeningResults: 'Phenotypic Screening Results',
};
const ARRAY_FIELDS = ['preventiveInterventions', 'phenotypicScreeningResults'];
const COMMA_SPLIT_FIELDS = new Set(['surveillanceProtocol', 'psychosocialSupport']);
const SENTENCE_SPLIT_FIELDS = new Set(['disclosurePreferences', 'followUpSchedule']);
const NUMBER_FIELDS = new Set(['clinicalPenetrance', 'preTestProbability', 'riskStratificationScore']);
const BOOLEAN_FIELDS = new Set(['priorRiskCounseling', 'geneticCounselorInvolvement', 'participationConsent']);
const DATE_FIELDS = new Set(['informedConsentDate']);

// number 0 is a "not assessed" sentinel for these percentage/score fields -> treat as empty
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return v !== 0; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const toInputDate = (d) => { if (!d) return ''; try { const dt = new Date(d.$date || d); if (isNaN(dt.getTime())) return ''; return dt.toISOString().slice(0, 10); } catch { return ''; } };
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/[;.]\s+/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };
const reconstructFullText = (sentences) => { if (!sentences || sentences.length === 0) return ''; return sentences.map((s, i) => { let c = s.replace(/[;.]+$/, '').trim(); if (i < sentences.length - 1) c += '.'; return c; }).join(' '); };
/* splitByComma: top-level commas only — NOT inside parentheses, NOT when "and"/"or"
   sits right before or right after the comma, NOT without a following space ("$18,000") */
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
/* Copy-text divider lines + number-stepper step size */
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);
const stepFor = (v) => { const d = String(v ?? '').split('.')[1]; return d ? '0.' + '0'.repeat(Math.max(0, d.length - 1)) + '1' : '1'; };

const CascadeTestingProtocolDocument = ({ document: rawDoc }) => {
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
      if (r?.cascade_testing_protocol) return Array.isArray(r.cascade_testing_protocol) ? r.cascade_testing_protocol : [r.cascade_testing_protocol];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.cascade_testing_protocol) return Array.isArray(dd.cascade_testing_protocol) ? dd.cascade_testing_protocol : [dd.cascade_testing_protocol]; return [dd]; }
      return r;
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [rawDoc]);

  const getRecordId = (r) => { const id = r._id; if (!id) return null; if (typeof id === 'string') return id; if (id.$oid) return id.$oid; return String(id); };

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const rid = getRecordId(record);
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        // fieldPart = "field" or "field.arrayIndex" (arrayIndex purely numeric trailing segment)
        const dotIdx = fieldPart.lastIndexOf('.');
        const tail = dotIdx === -1 ? '' : fieldPart.slice(dotIdx + 1);
        let editKey, markKey;
        if (dotIdx !== -1 && /^\d+$/.test(tail)) {
          const fn = fieldPart.slice(0, dotIdx);
          editKey = `${fn}-${idx}-${tail}`;   // array element
          markKey = editKey;
        } else {
          editKey = `${fieldPart}-${idx}`;     // flat / comma / sentence (full value)
          markKey = editKey;
        }
        nLocal[editKey] = value;
        nPending[editKey] = true;
        nFields[markKey] = 'edited';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
  }, [records]);

  const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
  const getFieldValue = useCallback((record, fn, idx) => { const k = `${fn}-${idx}`; if (localEdits[k] !== undefined) return localEdits[k]; return record[fn]; }, [localEdits]);
  const copyToClipboard = async (text, id) => { try { await navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); } catch {} };
  const getEffectiveArray = useCallback((record, fieldName, idx) => { const original = Array.isArray(record[fieldName]) ? [...record[fieldName]] : []; original.forEach((_, ai) => { const ek = `${fieldName}-${idx}-${ai}`; if (localEdits[ek] !== undefined) original[ai] = localEdits[ek]; }); return original; }, [localEdits]);

  const getEffectiveCommaParts = useCallback((record, fn, idx) => {
    const raw = getFieldValue(record, fn, idx);
    if (!hasVal(raw)) return [];
    return splitByComma(raw).map((p, ci) => {
      const ck = `${fn}-${idx}-c${ci}`;
      return localEdits[ck] !== undefined ? localEdits[ck] : p;
    });
  }, [localEdits, getFieldValue]);

  const getEffectiveSentences = useCallback((record, fn, idx) => {
    const raw = getFieldValue(record, fn, idx);
    if (!hasVal(raw)) return [];
    return splitBySentence(String(raw)).map((s, si) => {
      const sk = `${fn}-${idx}-s${si}`;
      return localEdits[sk] !== undefined ? localEdits[sk] : s;
    });
  }, [localEdits, getFieldValue]);

  // Stage a DRAFT for a field (no DB write). localStorage keeps it across refresh; Approve commits it.
  const stageDraft = useCallback((rid, fieldPart, value) => {
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][fieldPart] = value;
    writeDrafts(store);
  }, []);
  // Re-edit after approval → drop this section's 'approved' flag so the button goes back to yellow Pending.
  const clearApproved = useCallback((sid, idx) => {
    setApprovedSections(prev => { const key = `${sid}-${idx}`; if (!prev[key]) return prev; const n = { ...prev }; delete n[key]; return n; });
  }, []);

  // Save = stage a DRAFT locally + write to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid) => {
    const rid = getRecordId(record); if (!rid) { console.error('[CascadeTestingProtocol] Cannot save — no record ID'); return; }
    const ek = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: editValue }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    clearApproved(sid, idx);
    stageDraft(rid, fn, editValue);
    setEditingField(null); setEditValue('');
  }, [editValue, stageDraft, clearApproved]);

  const handleSaveTypedField = useCallback((record, fn, idx, sid, typedValue) => {
    const rid = getRecordId(record); if (!rid) { console.error('[CascadeTestingProtocol] Cannot save — no record ID'); return; }
    const ek = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: typedValue }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    clearApproved(sid, idx);
    stageDraft(rid, fn, typedValue);
    setEditingField(null); setEditValue('');
  }, [stageDraft, clearApproved]);

  const handleSaveArrayItem = useCallback((record, fn, idx, sid, arrayIndex) => {
    const rid = getRecordId(record); if (!rid) { console.error('[CascadeTestingProtocol] Cannot save — no record ID'); return; }
    const ek = `${fn}-${idx}-${arrayIndex}`;
    setLocalEdits(prev => ({ ...prev, [ek]: editValue }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    clearApproved(sid, idx);
    stageDraft(rid, `${fn}.${arrayIndex}`, editValue);
    setEditingField(null); setEditValue('');
  }, [editValue, stageDraft, clearApproved]);

  const saveCommaItem = useCallback((record, fn, idx, sid, ci) => {
    const rid = getRecordId(record); if (!rid) { console.error('[CascadeTestingProtocol] Cannot save — no record ID'); return; }
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
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ck]: 'edited' }));
    clearApproved(sid, idx);
    stageDraft(rid, fn, newValue);
    setEditingField(null); setEditValue('');
  }, [editValue, localEdits, getFieldValue, stageDraft, clearApproved]);

  const saveSentence = useCallback((record, fn, idx, sid, sentenceIdx) => {
    const rid = getRecordId(record); if (!rid) { console.error('[CascadeTestingProtocol] Cannot save — no record ID'); return; }
    const raw = getFieldValue(record, fn, idx);
    const sentences = splitBySentence(String(raw || ''));
    const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      sentences.splice(sentenceIdx, 1);
    } else {
      const newSentences = splitBySentence(editedVal);
      sentences.splice(sentenceIdx, 1, ...newSentences);
      if (newSentences.length > 1) {
        const extraCount = newSentences.length - 1;
        setEditedFields(prev => {
          const n = { ...prev };
          n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited';
          for (let ei = 0; ei < extraCount; ei++) { n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added'; }
          return n;
        });
      } else {
        setEditedFields(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      }
    }
    const newValue = reconstructFullText(sentences);
    setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: newValue }));
    setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
    clearApproved(sid, idx);
    stageDraft(rid, fn, newValue);
    setEditingField(null); setEditValue('');
  }, [editValue, getFieldValue, stageDraft, clearApproved]);

  // Approve = COMMIT all staged drafts for this section's fields to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, idx, sid) => {
    setApproving(true);
    try {
      const rid = getRecordId(record); if (!rid) return;
      const sf = SECTION_FIELDS[sid] || [];
      // Parse an editKey into { field, recIdx, arrayIndex? }. Keys are "field-idx" or
      // "field-idx-arrayIndex"; field names in this template are camelCase (no hyphens).
      const parseKey = (k) => {
        const parts = k.split('-');
        if (parts.length < 2) return null;
        const tail = parts[parts.length - 1];
        const prev = parts[parts.length - 2];
        // array form only when the LAST two segments are both purely numeric (idx + arrayIndex)
        if (/^\d+$/.test(tail) && /^\d+$/.test(prev)) {
          return { field: parts.slice(0, -2).join('-'), recIdx: parseInt(prev, 10), arrayIndex: parseInt(tail, 10) };
        }
        if (/^\d+$/.test(tail)) return { field: parts.slice(0, -1).join('-'), recIdx: parseInt(tail, 10) };
        return null;
      };
      // Collect this record's pending edits whose base field belongs to this section.
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k]) return false;
        const p = parseKey(k);
        return p && p.recIdx === idx && sf.includes(p.field);
      });
      const sc = (await import('../../../services/secureApiClient')).default;
      for (const editKey of toCommit) {
        const p = parseKey(editKey);
        const payload = { field: p.field, value: localEdits[editKey] };
        if (p.arrayIndex !== undefined) payload.arrayIndex = p.arrayIndex;
        await sc.put(`/api/edit/cascade_testing_protocol/${rid}/edit`, payload);
      }
      await sc.put(`/api/edit/cascade_testing_protocol/${rid}/approve`, { sectionId: sid, approved: true });
      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's drafts for these section fields from localStorage (now committed)
      const store = readDrafts();
      if (store[rid]) {
        Object.keys(store[rid]).forEach(fp => { const base = fp.includes('.') ? fp.slice(0, fp.lastIndexOf('.')) : fp; if (sf.includes(base)) delete store[rid][fp]; });
        if (Object.keys(store[rid]).length === 0) delete store[rid];
        writeDrafts(store);
      }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { sf.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[CascadeTestingProtocol] Approve failed:', err); }
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
      const title = `Cascade Testing Protocol ${idx + 1}`;
      const allText = [title, formatDate(record.date), formatDate(record.informedConsentDate), ...Object.keys(FIELD_LABELS).map(f => fmtVal(record[f])), ...ARRAY_FIELDS.flatMap(f => Array.isArray(record[f]) ? record[f] : []), ...Object.values(FIELD_LABELS), 'Genetic Condition', 'Testing Details', 'Consent', 'Risk', 'Surveillance', 'Psychosocial', 'Interventions', 'Follow-Up'].filter(Boolean).join(' ');
      const match = allText.toLowerCase().includes(sl);
      record._showAllSections = match && title.toLowerCase().startsWith(sl);
      return match;
    });
  }, [records, searchTerm]);

  const sectionHasEdits = (idx, sid) => { const fs = SECTION_FIELDS[sid] || []; return fs.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`))); };
  const renderApproveButton = (record, idx, sid) => { const he = sectionHasEdits(idx, sid); const ia = approvedSections[`${sid}-${idx}`]; if (he) return <button className="approve-btn pending" disabled={approving} onClick={(e) => { e.stopPropagation(); handleApproveSection(record, idx, sid); }}>{approving ? 'Approving...' : 'Pending Approve'}</button>; if (ia) return <span className="approve-btn approved">Approved</span>; return null; };

  const renderNumberField = (record, fn, idx, sid, showLabel = true) => {
    const raw = getFieldValue(record, fn, idx); if (!hasVal(raw)) return null;
    const dv = fmtVal(raw); const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`;
    const saveNum = () => { const n = parseFloat(editValue); if (isNaN(n)) return; handleSaveTypedField(record, fn, idx, sid, n); };
    if (ie) {
      const stepVal = parseFloat(stepFor(raw)) || 1;
      const stepDecs = (String(stepVal).split('.')[1] || '').length;
      const stepNum = (dir) => { const cur = parseFloat(editValue); setEditValue(((isNaN(cur) ? 0 : cur) + dir * stepVal).toFixed(stepDecs)); };
      return (<div className="rec-mini-card">{showLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className="edit-field-container">
        <div className="num-stepper-row">
          <button type="button" className="num-step" onClick={() => stepNum(-1)} disabled={saving}>−</button>
          <input type="number" step={stepFor(raw)} className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveNum(); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus disabled={saving} />
          <button type="button" className="num-step" onClick={() => stepNum(1)} disabled={saving}>+</button>
        </div>
        <div className="edit-actions"><button className="save-btn" onClick={saveNum} disabled={saving || isNaN(parseFloat(editValue))}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    }
    return (<div className="rec-mini-card">{showLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(dv); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  const renderBooleanField = (record, fn, idx, sid, showLabel = true) => {
    const raw = getFieldValue(record, fn, idx); if (!hasVal(raw)) return null;
    const dv = raw ? 'Yes' : 'No'; const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`;
    if (ie) return (<div className="rec-mini-card">{showLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className="edit-field-container"><select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}><option value="Yes">Yes</option><option value="No">No</option></select><div className="edit-actions"><button className="save-btn" onClick={() => handleSaveTypedField(record, fn, idx, sid, editValue === 'Yes')} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div className="rec-mini-card">{showLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(dv); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  const renderDateField = (record, fn, idx, sid, showLabel = true) => {
    const raw = getFieldValue(record, fn, idx); if (!hasVal(raw)) return null;
    const dv = formatDate(raw); const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`;
    const saveDate = () => { if (isNaN(new Date(editValue).getTime())) return; handleSaveTypedField(record, fn, idx, sid, editValue + 'T00:00:00.000Z'); };
    if (ie) return (<div className="rec-mini-card">{showLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className="edit-field-container"><BlueDatePicker value={editValue} onSelect={(iso) => setEditValue(iso)} /><div className="edit-actions"><button className="save-btn" onClick={saveDate} disabled={saving || !editValue}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div className="rec-mini-card">{showLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(toInputDate(raw)); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  const renderEditableField = (record, fn, idx, sid, showLabel = true) => {
    if (NUMBER_FIELDS.has(fn)) return renderNumberField(record, fn, idx, sid, showLabel);
    if (BOOLEAN_FIELDS.has(fn)) return renderBooleanField(record, fn, idx, sid, showLabel);
    if (DATE_FIELDS.has(fn)) return renderDateField(record, fn, idx, sid, showLabel);
    const raw = getFieldValue(record, fn, idx); if (!hasVal(raw)) return null;
    const dv = fmtVal(raw); const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`;
    if (ie) return (<div className="rec-mini-card">{showLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveField(record, fn, idx, sid); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => handleSaveField(record, fn, idx, sid)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div className="rec-mini-card">{showLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(dv); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  const renderCommaSplitField = (record, fn, idx, sid, showLabel = true) => {
    const parts = getEffectiveCommaParts(record, fn, idx);
    if (parts.length === 0) return null;
    return (
      <div className="rec-mini-card">
        {showLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}
        {parts.map((part, ci) => {
          const ck = `${fn}-${idx}-c${ci}`; const ie = editingField === ck; const ed = editedFields[ck]; const cid = `comma-${fn}-${idx}-${ci}`;
          if (ie) return (<div key={ci} className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveCommaItem(record, fn, idx, sid, ci); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => saveCommaItem(record, fn, idx, sid, ci)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>);
          return (<React.Fragment key={ci}><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ck); setEditValue(part); }}><div className="row-content"><span className="content-value">{highlightText(part)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(part, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</React.Fragment>);
        })}
      </div>
    );
  };

  const renderSentenceSplitField = (record, fn, idx, sid, showLabel = true) => {
    const sentences = getEffectiveSentences(record, fn, idx);
    if (sentences.length === 0) return null;
    return (
      <div className="rec-mini-card">
        {showLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}
        {sentences.map((sentence, si) => {
          const sk = `${fn}-${idx}-s${si}`; const ie = editingField === sk; const ed = editedFields[sk]; const cid = `sent-${fn}-${idx}-${si}`;
          if (ie) return (<div key={si} className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveSentence(record, fn, idx, sid, si); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={2} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => saveSentence(record, fn, idx, sid, si)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>);
          return (<React.Fragment key={si}><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(sk); setEditValue(sentence); }}><div className="row-content"><span className="content-value">{highlightText(sentence)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(sentence, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className={`modified-badge${ed === 'added' ? ' added' : ''}`}>{ed === 'added' ? 'added' : 'edited - click Pending Approve to save'}</div>}</React.Fragment>);
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
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF until approved
        const ld = key.lastIndexOf('-'); if (ld === -1) return;
        const fn = key.substring(0, ld); const ri = parseInt(key.substring(ld + 1), 10);
        if (ri === idx && fn in record) m[fn] = localEdits[key];
      });
      // Array fields: merge only NON-pending element edits (pending stay out of PDF until approved)
      ARRAY_FIELDS.forEach(field => {
        const original = Array.isArray(record[field]) ? [...record[field]] : [];
        original.forEach((_, ai) => { const ek = `${field}-${idx}-${ai}`; if (localEdits[ek] !== undefined && !pendingEdits[ek]) original[ai] = localEdits[ek]; });
        m[field] = original;
      });
      return m;
    });
  }, [records, localEdits, pendingEdits]);

  const SECTION_TITLES = { condition: 'GENETIC CONDITION', testing: 'TESTING DETAILS', consent: 'CONSENT & COUNSELING', risk: 'RISK ASSESSMENT', indexCase: 'INDEX CASE & FAMILY', surveillance: 'SURVEILLANCE PROTOCOL', phenotypic: 'PHENOTYPIC SCREENING', psychosocial: 'PSYCHOSOCIAL SUPPORT', disclosure: 'DISCLOSURE PREFERENCES', interventions: 'PREVENTIVE INTERVENTIONS', followUp: 'FOLLOW-UP SCHEDULE' };

  const copySectionText = (record, idx, sid) => {
    const pr = pdfData[idx] || record; const title = SECTION_TITLES[sid] || sid.toUpperCase();
    let text = `${title}\n${COPY_LINE_EQ}\n`;
    // single-name rule: hide the label when it duplicates the section title
    const labelLine = (fn) => { const l = FIELD_LABELS[fn] || fn; if (l.trim().toLowerCase() !== title.trim().toLowerCase()) text += `${l}\n${COPY_LINE_DASH}\n`; };
    const addF = (fn) => { if (hasVal(pr[fn])) { labelLine(fn); text += `1. ${DATE_FIELDS.has(fn) ? formatDate(pr[fn]) : fmtVal(pr[fn])}\n`; } };
    const addCommaSplit = (fn) => { if (!hasVal(pr[fn])) return; splitByComma(pr[fn]).forEach((p, i) => { text += `${i + 1}. ${p}\n`; }); };
    const addSentenceSplit = (fn) => { if (!hasVal(pr[fn])) return; splitBySentence(String(pr[fn])).forEach((s, i) => { text += `${i + 1}. ${s}\n`; }); };
    const addArr = (fn) => { (Array.isArray(pr[fn]) ? pr[fn] : []).forEach((it, i) => { text += `${i + 1}. ${it}\n`; }); };
    const arrSids = { interventions: 'preventiveInterventions', phenotypic: 'phenotypicScreeningResults' };
    const commaSids = { surveillance: 'surveillanceProtocol', psychosocial: 'psychosocialSupport' };
    const sentSids = { disclosure: 'disclosurePreferences', followUp: 'followUpSchedule' };
    if (arrSids[sid]) { addArr(arrSids[sid]); }
    else if (commaSids[sid]) { addCommaSplit(commaSids[sid]); }
    else if (sentSids[sid]) { addSentenceSplit(sentSids[sid]); }
    else { (SECTION_FIELDS[sid] || []).forEach(addF); }
    copyToClipboard(text.trim(), `section-${sid}-${idx}`);
  };

  const copyAllContent = () => {
    let text = '=== CASCADE TESTING PROTOCOL ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Cascade Testing Protocol ${idx + 1}\n${COPY_LINE_EQ}\n`;
      if (r.date) text += `${formatDate(r.date)}\n`;
      // single-name rule: hide the label when it duplicates the section title
      const labelLine = (fn, title) => { const l = FIELD_LABELS[fn] || fn; if (l.trim().toLowerCase() !== String(title || '').trim().toLowerCase()) text += `${l}\n${COPY_LINE_DASH}\n`; };
      const addF = (fn, title) => { if (hasVal(r[fn])) { labelLine(fn, title); text += `1. ${DATE_FIELDS.has(fn) ? formatDate(r[fn]) : fmtVal(r[fn])}\n`; } };
      const addCommaSplit = (fn) => { if (!hasVal(r[fn])) return; splitByComma(r[fn]).forEach((p, i) => { text += `${i + 1}. ${p}\n`; }); };
      const addSentenceSplit = (fn) => { if (!hasVal(r[fn])) return; splitBySentence(String(r[fn])).forEach((s, i) => { text += `${i + 1}. ${s}\n`; }); };
      const addArr = (title, fn) => { const items = Array.isArray(r[fn]) ? r[fn] : []; if (items.length) { text += `\n${title}\n${COPY_LINE_EQ}\n`; items.forEach((it, i) => { text += `${i + 1}. ${it}\n`; }); } };
      const simpleFs = (title, fields) => { const vis = fields.filter(f => hasVal(r[f])); if (vis.length) { text += `\n${title}\n${COPY_LINE_EQ}\n`; vis.forEach(f => addF(f, title)); } };
      simpleFs('GENETIC CONDITION', SECTION_FIELDS.condition);
      simpleFs('TESTING DETAILS', SECTION_FIELDS.testing);
      simpleFs('CONSENT & COUNSELING', SECTION_FIELDS.consent);
      simpleFs('RISK ASSESSMENT', SECTION_FIELDS.risk);
      simpleFs('INDEX CASE & FAMILY', SECTION_FIELDS.indexCase);
      if (hasVal(r.surveillanceProtocol)) { text += `\nSURVEILLANCE PROTOCOL\n${COPY_LINE_EQ}\n`; addCommaSplit('surveillanceProtocol'); }
      addArr('PHENOTYPIC SCREENING', 'phenotypicScreeningResults');
      if (hasVal(r.psychosocialSupport)) { text += `\nPSYCHOSOCIAL SUPPORT\n${COPY_LINE_EQ}\n`; addCommaSplit('psychosocialSupport'); }
      if (hasVal(r.disclosurePreferences)) { text += `\nDISCLOSURE PREFERENCES\n${COPY_LINE_EQ}\n`; addSentenceSplit('disclosurePreferences'); }
      addArr('PREVENTIVE INTERVENTIONS', 'preventiveInterventions');
      if (hasVal(r.followUpSchedule)) { text += `\nFOLLOW-UP SCHEDULE\n${COPY_LINE_EQ}\n`; addSentenceSplit('followUpSchedule'); }
      text += '\n';
    });
    copyToClipboard(text.trim(), 'copy-all');
  };

  const renderSection = (record, idx, sid, title, children) => { if (!children) return null; return (<div className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn${copiedId === `section-${sid}-${idx}` ? ' copied' : ''}`} onClick={() => copySectionText(record, idx, sid)}>{copiedId === `section-${sid}-${idx}` ? 'Copied' : 'Copy Section'}</button>{renderApproveButton(record, idx, sid)}</div></div>{children}</div></div>); };

  const renderMultiFieldSection = (record, idx, sid, title, fields) => {
    const visibleFields = fields.filter(f => hasVal(getFieldValue(record, f, idx)));
    if (visibleFields.length === 0) return null;
    if (!shouldShowSection(record, title, visibleFields.map(f => fmtVal(getFieldValue(record, f, idx))), visibleFields)) return null;
    return renderSection(record, idx, sid, title, (() => { const stm = sectionTitleMatches(title); const sa = !searchTerm.trim() || record._showAllSections || stm; return <>{visibleFields.map(f => { if (!sa && !fieldMatches(record, f, idx)) return null; const sl = (FIELD_LABELS[f] || f).toLowerCase() !== title.toLowerCase(); if (COMMA_SPLIT_FIELDS.has(f)) return <React.Fragment key={f}>{renderCommaSplitField(record, f, idx, sid, sl)}</React.Fragment>; if (SENTENCE_SPLIT_FIELDS.has(f)) return <React.Fragment key={f}>{renderSentenceSplitField(record, f, idx, sid, sl)}</React.Fragment>; return <React.Fragment key={f}>{renderEditableField(record, f, idx, sid, sl)}</React.Fragment>; })}</>; })());
  };

  const renderArraySection = (record, idx, sid, title, fieldName) => {
    const items = Array.isArray(record[fieldName]) ? record[fieldName].filter(Boolean) : [];
    if (items.length === 0) return null;
    if (!shouldShowSection(record, title, items, [fieldName])) return null;
    return renderSection(record, idx, sid, title, (() => { const stm = sectionTitleMatches(title); const sa = !searchTerm.trim() || record._showAllSections || stm; return items.map((item, ai) => { const val = localEdits[`${fieldName}-${idx}-${ai}`] !== undefined ? localEdits[`${fieldName}-${idx}-${ai}`] : item; if (!sa && !phraseMatch(val, searchTerm)) return null; return renderEditableArrayItem(record, fieldName, idx, sid, item, ai); }).filter(Boolean); })());
  };

  const renderSingleSplitSection = (record, idx, sid, title, fieldName) => {
    if (!hasVal(getFieldValue(record, fieldName, idx))) return null;
    if (!shouldShowSection(record, title, [fmtVal(getFieldValue(record, fieldName, idx))], [fieldName])) return null;
    if (COMMA_SPLIT_FIELDS.has(fieldName)) return renderSection(record, idx, sid, title, renderCommaSplitField(record, fieldName, idx, sid, false));
    if (SENTENCE_SPLIT_FIELDS.has(fieldName)) return renderSection(record, idx, sid, title, renderSentenceSplitField(record, fieldName, idx, sid, false));
    return renderSection(record, idx, sid, title, renderEditableField(record, fieldName, idx, sid, false));
  };

  if (!filteredRecords || filteredRecords.length === 0) return (<article className="cascade-testing-protocol-document"><header className="document-header"><h1 className="document-title">Cascade Testing Protocol</h1></header><SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} /><div className="empty-state">No data available.</div></article>);

  return (
    <article className="cascade-testing-protocol-document">
      <header className="document-header">
        <h1 className="document-title">Cascade Testing Protocol</h1>
        <div className="header-actions">
          <button className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`} onClick={copyAllContent}>{copiedId === 'copy-all' ? 'Copied' : 'Copy All'}</button>
          <PDFDownloadLink document={<CascadeTestingProtocolDocumentPDFTemplate document={pdfData} />} fileName="Cascade_Testing_Protocol.pdf">
            {({ loading }) => <button className="copy-btn">{loading ? 'Preparing...' : 'Export PDF'}</button>}
          </PDFDownloadLink>
        </div>
      </header>
      <SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <div className="record-title-row"><h3 className="record-name">{highlightText(`Cascade Testing Protocol ${idx + 1}`)}</h3></div>
            </div>
            {renderMultiFieldSection(record, idx, 'condition', 'Genetic Condition', SECTION_FIELDS.condition)}
            {renderMultiFieldSection(record, idx, 'testing', 'Testing Details', SECTION_FIELDS.testing)}
            {renderMultiFieldSection(record, idx, 'consent', 'Consent & Counseling', SECTION_FIELDS.consent)}
            {renderMultiFieldSection(record, idx, 'risk', 'Risk Assessment', SECTION_FIELDS.risk)}
            {renderMultiFieldSection(record, idx, 'indexCase', 'Index Case & Family', SECTION_FIELDS.indexCase)}
            {renderSingleSplitSection(record, idx, 'surveillance', 'Surveillance Protocol', 'surveillanceProtocol')}
            {renderArraySection(record, idx, 'phenotypic', 'Phenotypic Screening', 'phenotypicScreeningResults')}
            {renderSingleSplitSection(record, idx, 'psychosocial', 'Psychosocial Support', 'psychosocialSupport')}
            {renderSingleSplitSection(record, idx, 'disclosure', 'Disclosure Preferences', 'disclosurePreferences')}
            {renderArraySection(record, idx, 'interventions', 'Preventive Interventions', 'preventiveInterventions')}
            {renderSingleSplitSection(record, idx, 'followUp', 'Follow-Up Schedule', 'followUpSchedule')}
          </div>
        ))}
      </div>
    </article>
  );
};

export default CascadeTestingProtocolDocument;
