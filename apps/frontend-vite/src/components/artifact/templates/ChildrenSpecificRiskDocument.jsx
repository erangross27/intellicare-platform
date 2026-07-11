/**
 * ChildrenSpecificRiskDocument.jsx
 * March 2026 blue glow theme with inline editing.
 * Flat fields + arrays. Collection: children_specific_risk
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import ChildrenSpecificRiskPDFTemplate from '../pdf-templates/ChildrenSpecificRiskPDFTemplate';
import './ChildrenSpecificRiskDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'children_specific_riskPendingEdits';
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
  growth: ['ageAtAssessment', 'gestationalAgeAtBirth', 'birthWeightGrams', 'currentWeightPercentile', 'currentHeightPercentile', 'bmiPercentile', 'headCircumferencePercentile'],
  development: ['developmentalDelayRisk', 'autismScreeningScore', 'vaccineDelayedStatus'],
  medical: ['leadLevelMcgDl', 'ironDeficiencyAnemia', 'asthmaControlTest', 'epipenRequired', 'seizureDisorderType', 'congenitalHeartDefect'],
  allergies: ['allergyTriggers'],
  medications: ['chronicMedicationList'],
  social: ['schoolAbsenteeismRate', 'socialDeterminantsRisk', 'mentalHealthScreening', 'substanceUseRisk'],
  family: ['familyHistoryGenetic'],
};
const FIELD_LABELS = {
  ageAtAssessment: 'Age at Assessment', gestationalAgeAtBirth: 'Gestational Age at Birth', birthWeightGrams: 'Birth Weight (g)',
  currentWeightPercentile: 'Weight Percentile', currentHeightPercentile: 'Height Percentile', bmiPercentile: 'BMI Percentile', headCircumferencePercentile: 'Head Circumference Percentile',
  developmentalDelayRisk: 'Developmental Delay Risk', autismScreeningScore: 'Autism Screening Score', vaccineDelayedStatus: 'Vaccine Delayed',
  leadLevelMcgDl: 'Lead Level (mcg/dL)', ironDeficiencyAnemia: 'Iron Deficiency Anemia', asthmaControlTest: 'Asthma Control Test', epipenRequired: 'EpiPen Required', seizureDisorderType: 'Seizure Disorder Type', congenitalHeartDefect: 'Congenital Heart Defect',
  schoolAbsenteeismRate: 'School Absenteeism Rate', socialDeterminantsRisk: 'Social Determinants Risk', mentalHealthScreening: 'Mental Health Screening', substanceUseRisk: 'Substance Use Risk',
};
const ARRAY_FIELDS = ['allergyTriggers', 'chronicMedicationList', 'familyHistoryGenetic'];
const NUMBER_FIELDS = ['ageAtAssessment', 'gestationalAgeAtBirth', 'birthWeightGrams', 'currentWeightPercentile', 'currentHeightPercentile', 'bmiPercentile', 'headCircumferencePercentile', 'autismScreeningScore', 'leadLevelMcgDl', 'asthmaControlTest', 'schoolAbsenteeismRate'];
const BOOLEAN_FIELDS = ['vaccineDelayedStatus', 'ironDeficiencyAnemia', 'epipenRequired'];

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return v !== 0; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };

const ChildrenSpecificRiskDocument = ({ document: rawDoc }) => {
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
    arr = arr.flatMap(r => {
      if (r?.children_specific_risk) return Array.isArray(r.children_specific_risk) ? r.children_specific_risk : [r.children_specific_risk];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.children_specific_risk) return Array.isArray(dd.children_specific_risk) ? dd.children_specific_risk : [dd.children_specific_risk]; return [dd]; }
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
      const id = record && record._id;
      const rid = !id ? null : (typeof id === 'string' ? id : (id.$oid || String(id)));
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        // fieldPart = "field" or "field.arrayIndex" (arrayIndex purely numeric after last dot)
        const dotIdx = fieldPart.lastIndexOf('.');
        const tail = dotIdx === -1 ? '' : fieldPart.slice(dotIdx + 1);
        const isArr = dotIdx !== -1 && /^\d+$/.test(tail);
        const editKey = isArr
          ? `${fieldPart.slice(0, dotIdx)}-${idx}-${tail}`
          : `${fieldPart}-${idx}`;
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
  const getEffectiveArray = useCallback((record, fieldName, idx) => { const original = Array.isArray(record[fieldName]) ? [...record[fieldName]] : []; original.forEach((_, ai) => { const ek = `${fieldName}-${idx}-${ai}`; if (localEdits[ek] !== undefined) original[ai] = localEdits[ek]; }); return original; }, [localEdits]);

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const stageDraft = useCallback((record, fieldPart, editKey, value, idx, sid) => {
    const rid = getRecordId(record);
    if (!rid) { console.error('[ChildrenSpecificRisk] Cannot save — no record ID'); return; }
    setLocalEdits(prev => ({ ...prev, [editKey]: value }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    // Re-edit after approval → drop the section 'approved' flag so the button goes back to yellow Pending Approve
    setApprovedSections(prev => {
      const key = `${sid}-${idx}`;
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][fieldPart] = value;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, []);

  const handleSaveField = useCallback((record, fn, idx, sid) => {
    stageDraft(record, fn, `${fn}-${idx}`, editValue, idx, sid);
  }, [editValue, stageDraft]);

  const handleSaveTypedField = useCallback((record, fn, idx, sid, typedValue) => {
    stageDraft(record, fn, `${fn}-${idx}`, typedValue, idx, sid);
  }, [stageDraft]);

  const handleSaveArrayItem = useCallback((record, fn, idx, sid, arrayIndex) => {
    stageDraft(record, `${fn}.${arrayIndex}`, `${fn}-${idx}-${arrayIndex}`, editValue, idx, sid);
  }, [editValue, stageDraft]);

  // Approve = COMMIT all staged drafts for this record's section to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, idx, sid) => {
    try {
      const rid = getRecordId(record);
      if (!rid) return;
      const sc = (await import('../../../services/secureApiClient')).default;
      const sf = SECTION_FIELDS[sid] || [];
      // Parse an editKey ("field-idx" or "field-idx-arrayIndex") into its parts. ARRAY_FIELDS keys
      // carry a trailing "-arrayIndex"; all others are plain "field-idx".
      const parseKey = (k) => {
        const parts = k.split('-');
        const last = parts[parts.length - 1];
        const prev = parts[parts.length - 2];
        // "field-idx-ai": two trailing numeric segments AND base field is an array field
        if (parts.length >= 3 && /^\d+$/.test(last) && /^\d+$/.test(prev)) {
          const fieldName = parts.slice(0, -2).join('-');
          if (ARRAY_FIELDS.includes(fieldName)) return { fieldName, recIdx: parseInt(prev, 10), arrayIndex: parseInt(last, 10) };
        }
        // "field-idx"
        const fieldName = parts.slice(0, -1).join('-');
        return { fieldName, recIdx: parseInt(last, 10), arrayIndex: undefined };
      };
      // Collect this record's pending edits for this section's fields
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k]) return false;
        const { fieldName, recIdx } = parseKey(k);
        return recIdx === idx && sf.includes(fieldName);
      });
      for (const editKey of toCommit) {
        const { fieldName, arrayIndex } = parseKey(editKey);
        const payload = { field: fieldName, value: localEdits[editKey] };
        if (arrayIndex !== undefined) payload.arrayIndex = arrayIndex;
        const resp = await sc.put(`/api/edit/children_specific_risk/${rid}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      await sc.put(`/api/edit/children_specific_risk/${rid}/approve`, { sectionId: sid, approved: true });
      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const next = { ...prev }; toCommit.forEach(k => delete next[k]); return next; });
      // Drop this record's committed drafts from localStorage
      const store = readDrafts();
      if (store[rid]) {
        sf.forEach(f => { delete store[rid][f]; Object.keys(store[rid]).forEach(fp => { if (fp.startsWith(`${f}.`)) delete store[rid][fp]; }); });
        if (Object.keys(store[rid]).length === 0) delete store[rid];
        writeDrafts(store);
      }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { sf.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    }
    catch (err) { console.error('[ChildrenSpecificRisk] Approve failed:', err); }
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
      const title = `Children Specific Risk ${idx + 1}`;
      const allText = [title, ...Object.keys(FIELD_LABELS).map(f => fmtVal(record[f])), ...ARRAY_FIELDS.flatMap(f => Array.isArray(record[f]) ? record[f] : []), ...Object.values(FIELD_LABELS), 'Growth & Development', 'Medical Conditions', 'Allergy Triggers', 'Medications', 'Social & Behavioral', 'Family History'].filter(Boolean).join(' ');
      const match = allText.toLowerCase().includes(sl);
      record._showAllSections = match && title.toLowerCase().startsWith(sl);
      return match;
    });
  }, [records, searchTerm]);

  const sectionHasEdits = (idx, sid) => { const fs = SECTION_FIELDS[sid] || []; return fs.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`))); };
  const renderApproveButton = (idx, sid) => { const he = sectionHasEdits(idx, sid); const ia = approvedSections[`${sid}-${idx}`]; if (he) return <button className="approve-btn pending" onClick={(e) => { e.stopPropagation(); handleApproveSection(records[idx], idx, sid); }}>Pending Approve</button>; if (ia) return <span className="approve-btn approved">Approved</span>; return null; };

  const renderNumberField = (record, fn, idx, sid, showLabel = true) => {
    const raw = getFieldValue(record, fn, idx); if (!hasVal(raw)) return null;
    const dv = fmtVal(raw); const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`;
    const saveNum = () => { const n = parseFloat(editValue); if (isNaN(n)) return; handleSaveTypedField(record, fn, idx, sid, n); };
    if (ie) return (<div className="rec-mini-card">{showLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className="edit-field-container"><input type="number" step="any" className="edit-input" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveNum(); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={saveNum} disabled={saving || isNaN(parseFloat(editValue))}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div className="rec-mini-card">{showLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(dv); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  const renderBooleanField = (record, fn, idx, sid, showLabel = true) => {
    const raw = getFieldValue(record, fn, idx); if (!hasVal(raw)) return null;
    const dv = raw ? 'Yes' : 'No'; const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`;
    if (ie) return (<div className="rec-mini-card">{showLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className="edit-field-container"><select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}><option value="Yes">Yes</option><option value="No">No</option></select><div className="edit-actions"><button className="save-btn" onClick={() => handleSaveTypedField(record, fn, idx, sid, editValue === 'Yes')} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div className="rec-mini-card">{showLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(dv); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  const renderEditableField = (record, fn, idx, sid, showLabel = true) => {
    if (NUMBER_FIELDS.includes(fn)) return renderNumberField(record, fn, idx, sid, showLabel);
    if (BOOLEAN_FIELDS.includes(fn)) return renderBooleanField(record, fn, idx, sid, showLabel);
    const raw = getFieldValue(record, fn, idx); if (!hasVal(raw)) return null;
    const dv = fmtVal(raw); const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`;
    if (ie) return (<div className="rec-mini-card">{showLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveField(record, fn, idx, sid); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => handleSaveField(record, fn, idx, sid)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div className="rec-mini-card">{showLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(dv); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  const renderEditableArrayItem = (record, fn, idx, sid, item, ai) => {
    const ek = `${fn}-${idx}-${ai}`; const val = localEdits[ek] !== undefined ? localEdits[ek] : String(item || '');
    const ie = editingField === ek; const ed = editedFields[ek]; const cid = `arr-${fn}-${idx}-${ai}`;
    if (ie) return (<React.Fragment key={ai}><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveArrayItem(record, fn, idx, sid, ai); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => handleSaveArrayItem(record, fn, idx, sid, ai)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></React.Fragment>);
    return (<React.Fragment key={ai}><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(val); }}><div className="row-content"><span className="content-value">{highlightText(val)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(val, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</React.Fragment>);
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
      // Array fields: apply only NON-pending element edits.
      ARRAY_FIELDS.forEach(field => {
        const original = Array.isArray(record[field]) ? [...record[field]] : [];
        original.forEach((_, ai) => {
          const ek = `${field}-${idx}-${ai}`;
          if (localEdits[ek] !== undefined && !pendingEdits[ek]) original[ai] = localEdits[ek];
        });
        m[field] = original;
      });
      return m;
    });
  }, [records, localEdits, pendingEdits]);

  const SECTION_TITLES = { growth: 'GROWTH PARAMETERS', development: 'DEVELOPMENTAL SCREENING', medical: 'MEDICAL CONDITIONS', allergies: 'ALLERGY TRIGGERS', medications: 'CHRONIC MEDICATIONS', social: 'SOCIAL & BEHAVIORAL', family: 'FAMILY HISTORY (GENETIC)' };

  const copySectionText = (record, idx, sid) => {
    const pr = pdfData[idx] || record; let text = `${SECTION_TITLES[sid] || sid.toUpperCase()}\n`;
    const addF = (fn) => { if (hasVal(pr[fn])) text += `${FIELD_LABELS[fn] || fn}\n${fmtVal(pr[fn])}\n\n`; };
    const addArr = (fn) => { (Array.isArray(pr[fn]) ? pr[fn] : []).forEach((it, i) => { text += `${i + 1}. ${it}\n`; }); };
    const arrSids = { allergies: 'allergyTriggers', medications: 'chronicMedicationList', family: 'familyHistoryGenetic' };
    if (arrSids[sid]) { addArr(arrSids[sid]); }
    else { (SECTION_FIELDS[sid] || []).forEach(addF); }
    copyToClipboard(text.trim(), `section-${sid}-${idx}`);
  };

  const copyAllContent = () => {
    let text = '=== CHILDREN SPECIFIC RISK ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Children Specific Risk ${idx + 1}\n`;
      const addF = (fn) => { if (hasVal(r[fn])) text += `${FIELD_LABELS[fn] || fn}\n${fmtVal(r[fn])}\n\n`; };
      const addArr = (title, fn) => { const items = Array.isArray(r[fn]) ? r[fn] : []; if (items.length) { text += `\n${title}\n`; items.forEach((it, i) => { text += `${i + 1}. ${it}\n`; }); } };
      const simpleFs = (title, fields) => { const vis = fields.filter(f => hasVal(r[f])); if (vis.length) { text += `\n${title}\n`; vis.forEach(addF); } };
      simpleFs('GROWTH PARAMETERS', SECTION_FIELDS.growth);
      simpleFs('DEVELOPMENTAL SCREENING', SECTION_FIELDS.development);
      simpleFs('MEDICAL CONDITIONS', SECTION_FIELDS.medical);
      addArr('ALLERGY TRIGGERS', 'allergyTriggers');
      addArr('CHRONIC MEDICATIONS', 'chronicMedicationList');
      simpleFs('SOCIAL & BEHAVIORAL', SECTION_FIELDS.social);
      addArr('FAMILY HISTORY (GENETIC)', 'familyHistoryGenetic');
      text += '\n';
    });
    copyToClipboard(text.trim(), 'copy-all');
  };

  const renderSection = (record, idx, sid, title, children) => { if (!children) return null; return (<div className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn${copiedId === `section-${sid}-${idx}` ? ' copied' : ''}`} onClick={() => copySectionText(record, idx, sid)}>{copiedId === `section-${sid}-${idx}` ? 'Copied' : 'Copy Section'}</button>{renderApproveButton(idx, sid)}</div></div>{children}</div></div>); };

  const renderMultiFieldSection = (record, idx, sid, title, fields) => {
    const visibleFields = fields.filter(f => hasVal(getFieldValue(record, f, idx)));
    if (visibleFields.length === 0) return null;
    if (!shouldShowSection(record, title, visibleFields.map(f => fmtVal(getFieldValue(record, f, idx))), visibleFields)) return null;
    return renderSection(record, idx, sid, title, (() => { const stm = sectionTitleMatches(title); const sa = !searchTerm.trim() || record._showAllSections || stm; return <>{visibleFields.map(f => { if (!sa && !fieldMatches(record, f, idx)) return null; const sl = (FIELD_LABELS[f] || f).toLowerCase() !== title.toLowerCase(); return <React.Fragment key={f}>{renderEditableField(record, f, idx, sid, sl)}</React.Fragment>; })}</>; })());
  };

  const renderArraySection = (record, idx, sid, title, fieldName) => {
    const items = Array.isArray(record[fieldName]) ? record[fieldName].filter(Boolean) : [];
    if (items.length === 0) return null;
    if (!shouldShowSection(record, title, items, [fieldName])) return null;
    return renderSection(record, idx, sid, title, (() => { const stm = sectionTitleMatches(title); const sa = !searchTerm.trim() || record._showAllSections || stm; const visibleItems = items.map((item, ai) => { const val = localEdits[`${fieldName}-${idx}-${ai}`] !== undefined ? localEdits[`${fieldName}-${idx}-${ai}`] : item; if (!sa && !phraseMatch(val, searchTerm)) return null; return renderEditableArrayItem(record, fieldName, idx, sid, item, ai); }).filter(Boolean); return visibleItems.length > 0 ? <div className="rec-mini-card">{visibleItems}</div> : null; })());
  };

  if (!filteredRecords || filteredRecords.length === 0) return (<article className="children-specific-risk-document"><header className="document-header"><h1 className="document-title">Children Specific Risk</h1></header><SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} /><div className="empty-state">No data available.</div></article>);

  return (
    <article className="children-specific-risk-document">
      <header className="document-header">
        <h1 className="document-title">Children Specific Risk</h1>
        <div className="header-actions">
          <button className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`} onClick={copyAllContent}>{copiedId === 'copy-all' ? 'Copied' : 'Copy All'}</button>
          <PDFDownloadLink document={<ChildrenSpecificRiskPDFTemplate document={pdfData} />} fileName="Children_Specific_Risk.pdf">
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
              <div className="record-title-row"><h3 className="record-name">{highlightText(`Children Specific Risk ${idx + 1}`)}</h3></div>
            </div>
            {renderMultiFieldSection(record, idx, 'growth', 'Growth Parameters', SECTION_FIELDS.growth)}
            {renderMultiFieldSection(record, idx, 'development', 'Developmental Screening', SECTION_FIELDS.development)}
            {renderMultiFieldSection(record, idx, 'medical', 'Medical Conditions', SECTION_FIELDS.medical)}
            {renderArraySection(record, idx, 'allergies', 'Allergy Triggers', 'allergyTriggers')}
            {renderArraySection(record, idx, 'medications', 'Chronic Medications', 'chronicMedicationList')}
            {renderMultiFieldSection(record, idx, 'social', 'Social & Behavioral', SECTION_FIELDS.social)}
            {renderArraySection(record, idx, 'family', 'Family History (Genetic)', 'familyHistoryGenetic')}
          </div>
        ))}
      </div>
    </article>
  );
};

export default ChildrenSpecificRiskDocument;
