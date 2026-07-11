/**
 * BloodDisorderReportsDocument.jsx
 * Inline editing with per-section approve, per-row copy.
 * 4-level search, PDFDownloadLink + pdfData memo, secureApiClient.
 * Bar chart visualizations for lab sections (display-only).
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import BloodDisorderReportsPDFTemplate from '../pdf-templates/BloodDisorderReportsPDFTemplate';
import './BloodDisorderReportsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'blood_disorder_reportsPendingEdits';
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
  diagInfo: ['disorderType', 'diagnosis', 'etiology'],
  severity: ['severity'],
  cbc: ['cbc'],
  coagulation: ['coagulationStudies'],
  ironStudies: ['ironStudies'],
  vitaminLevels: ['vitaminLevels'],
  hemolysis: ['hemolysisWorkup'],
  morphology: ['peripheralSmear', 'boneMorrow'],
  treatment: ['treatment'],
  monitoring: ['monitoring'],
  notes: ['notes'],
  providerInfo: ['hematologist', 'facility'],
};
const FIELD_LABELS = { disorderType: 'Disorder Type', diagnosis: 'Diagnosis', etiology: 'Etiology', severity: 'Severity', peripheralSmear: 'Peripheral Smear', boneMorrow: 'Bone Marrow', monitoring: 'Monitoring', notes: 'Notes', hematologist: 'Hematologist', facility: 'Facility' };
const ARRAY_FIELDS = ['treatment'];
// Constrained clinical status scale for editable Vitamin Levels sub-fields (B12, Folate, …), low → high.
const VITAMIN_STATUS_OPTIONS = ['Very Low', 'Low', 'Normal', 'High', 'Very High'];

// ============== BAR CHART HELPERS ==============
const extractLabValue = (value) => { if (!value) return null; const match = String(value).match(/(\d+\.?\d*)/); return match ? parseFloat(match[1]) : null; };
const getLabTestType = (fieldName) => { const name = fieldName.toLowerCase(); const m = { 'wbc': 'wbc', 'white blood cell': 'wbc', 'hemoglobin': 'hemoglobin', 'hgb': 'hemoglobin', 'hematocrit': 'hematocrit', 'hct': 'hematocrit', 'platelets': 'platelets', 'plt': 'platelets', 'mcv': 'mcv', 'mch': 'mch', 'mchc': 'mchc', 'neutrophils': 'neutrophils', 'pt': 'pt', 'inr': 'inr', 'aptt': 'aptt', 'ptt': 'aptt', 'fibrinogen': 'fibrinogen', 'ferritin': 'ferritin', 'iron': 'iron', 'tibc': 'tibc', 'transferrin saturation': 'transferrinSat', 'transferrin': 'transferrinSat', 'b12': 'b12', 'folate': 'folate', 'ldh': 'ldh', 'haptoglobin': 'haptoglobin', 'bilirubin': 'bilirubin', 'total bilirubin': 'bilirubin', 'direct bilirubin': 'bilirubin', 'reticulocyte': 'reticulocyte', 'reticulocytes': 'reticulocyte', 'reticulocyte count': 'reticulocyte' }; for (const [key, type] of Object.entries(m)) { if (name.includes(key)) return type; } return null; };
const getLabBarColor = (value, testType) => { if (value === null) return '#9ca3af'; const ranges = { wbc: [4.5, 11.0], hemoglobin: [12.0, 16.0], hematocrit: [36, 48], platelets: [150, 400], mcv: [80, 100], mch: [27, 33], mchc: [32, 36], neutrophils: [40, 70], pt: [11, 13.5], inr: [0.9, 1.1], aptt: [25, 35], fibrinogen: [200, 400], ferritin: [15, 150], iron: [60, 170], tibc: [240, 450], transferrinSat: [20, 50], b12: [200, 900], folate: [2.7, 17], ldh: [140, 280], haptoglobin: [30, 200], bilirubin: [0.1, 1.2], reticulocyte: [0.5, 2.5] }; const r = ranges[testType]; if (!r) return '#9ca3af'; if (value < r[0]) return '#3b82f6'; if (value > r[1]) return '#ef4444'; return '#22c55e'; };
const getLabInterpretation = (value, testType) => { if (value === null) return ''; const interps = { wbc: ['Leukopenia', 'Normal', 'Leukocytosis'], hemoglobin: ['Anemia', 'Normal', 'Polycythemia'], hematocrit: ['Low', 'Normal', 'High'], platelets: ['Thrombocytopenia', 'Normal', 'Thrombocytosis'], mcv: ['Microcytic', 'Normocytic', 'Macrocytic'], mch: ['Low', 'Normal', 'High'], mchc: ['Hypochromic', 'Normal', 'Hyperchromic'], neutrophils: ['Low', 'Normal', 'High'], pt: ['Short', 'Normal', 'Prolonged'], inr: ['Low', 'Normal', 'Elevated'], aptt: ['Short', 'Normal', 'Prolonged'], fibrinogen: ['Low', 'Normal', 'High'], ferritin: ['Iron Deficiency', 'Normal', 'Iron Overload'], iron: ['Low', 'Normal', 'High'], tibc: ['Low', 'Normal', 'High'], transferrinSat: ['Low', 'Normal', 'High'], b12: ['Deficiency', 'Normal', 'High'], folate: ['Deficiency', 'Normal', 'High'], ldh: ['Low', 'Normal', 'Elevated'], haptoglobin: ['Low (Hemolysis)', 'Normal', 'High'], bilirubin: ['Low', 'Normal', 'Elevated'], reticulocyte: ['Low', 'Normal', 'High'] }; const i = interps[testType]; if (!i) return ''; const ranges = { wbc: [4.5, 11.0], hemoglobin: [12.0, 16.0], hematocrit: [36, 48], platelets: [150, 400], mcv: [80, 100], mch: [27, 33], mchc: [32, 36], neutrophils: [40, 70], pt: [11, 13.5], inr: [0.9, 1.1], aptt: [25, 35], fibrinogen: [200, 400], ferritin: [15, 150], iron: [60, 170], tibc: [240, 450], transferrinSat: [20, 50], b12: [200, 900], folate: [2.7, 17], ldh: [140, 280], haptoglobin: [30, 200], bilirubin: [0.1, 1.2], reticulocyte: [0.5, 2.5] }; const r = ranges[testType]; if (!r) return i[1]; if (value < r[0]) return i[0]; if (value > r[1]) return i[2]; return i[1]; };
const labToPercentage = (value, testType) => { if (value === null) return 0; const scales = { wbc: [0, 20], hemoglobin: [6, 20], hematocrit: [20, 60], platelets: [0, 600], mcv: [60, 120], mch: [20, 40], mchc: [28, 40], neutrophils: [0, 100], pt: [8, 20], inr: [0.5, 4], aptt: [15, 60], fibrinogen: [100, 600], ferritin: [0, 500], iron: [20, 250], tibc: [100, 600], transferrinSat: [0, 100], b12: [0, 1500], folate: [0, 25], ldh: [50, 500], haptoglobin: [0, 300], bilirubin: [0, 5], reticulocyte: [0, 8] }; const s = scales[testType]; if (!s) return 50; return Math.min(100, Math.max(5, ((value - s[0]) / (s[1] - s[0])) * 100)); };

const getSeverityLabel = (sev) => { if (!sev) return ''; const match = sev.match(/^(high|low|moderate|critical|severe)\s+(severity|risk)/i); return match ? match[0] : sev.length > 20 ? sev.substring(0, 20) + '...' : sev; };
const getSeverityBadgeColor = (sev) => { if (!sev) return '#10b981'; const l = sev.toLowerCase(); if (l.includes('critical') || l.includes('severe') || l.includes('high')) return '#ef4444'; if (l.includes('moderate')) return '#f59e0b'; return '#10b981'; };

const BloodDisorderReportsDocument = ({ document: rawDoc }) => {
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
    arr = arr.flatMap(r => { if (r?.blood_disorder_reports) return Array.isArray(r.blood_disorder_reports) ? r.blood_disorder_reports : [r.blood_disorder_reports]; if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.blood_disorder_reports) return Array.isArray(dd.blood_disorder_reports) ? dd.blood_disorder_reports : [dd.blood_disorder_reports]; return [dd]; } return r; });
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
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        // fieldPart = "field" or "field.arrayIndex"; build the file's native editKey.
        const dotIdx = fieldPart.indexOf('.');
        const editKey = dotIdx === -1 ? `${fieldPart}-${idx}` : `${fieldPart.slice(0, dotIdx)}-${idx}-${fieldPart.slice(dotIdx + 1)}`;
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
  const formatObject = (obj) => { if (!obj || typeof obj !== 'object' || Object.keys(obj).length === 0) return ''; return Object.entries(obj).map(([k, v]) => `${k}: ${v}`).join(', '); };

  // includePending=false (PDF/Copy) skips staged drafts; true (JSX) shows them.
  const getEffectiveArray = useCallback((record, fieldName, idx, includePending = true) => {
    const original = Array.isArray(record[fieldName]) ? [...record[fieldName]] : [];
    original.forEach((_, ai) => { const ek = `${fieldName}-${idx}-${ai}`; if (localEdits[ek] !== undefined && (includePending || !pendingEdits[ek])) original[ai] = localEdits[ek]; });
    return original;
  }, [localEdits, pendingEdits]);

  // Stage a draft for the record's draft store, clearing this section's approved flag so the
  // button returns to yellow "Pending Approve". fieldPart = "field" or "field.arrayIndex".
  const stageDraft = useCallback((record, fieldPart, value, sid, idx) => {
    const rid = getRecordId(record);
    if (rid) { const store = readDrafts(); if (!store[rid]) store[rid] = {}; store[rid][fieldPart] = value; writeDrafts(store); }
    if (sid != null) setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
  }, []);

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid) => {
    const ek = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: editValue }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    stageDraft(record, fn, editValue, sid, idx);
    setEditingField(null); setEditValue('');
  }, [editValue, stageDraft]);

  const handleSaveArrayItem = useCallback((record, fn, idx, sid, arrayIndex) => {
    const ek = `${fn}-${idx}-${arrayIndex}`;
    setLocalEdits(prev => ({ ...prev, [ek]: editValue }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    stageDraft(record, `${fn}.${arrayIndex}`, editValue, sid, idx);
    setEditingField(null); setEditValue('');
  }, [editValue, stageDraft]);

  function saveFieldPart(record, fieldName, idx, sectionId, partIdx, newPartText) {
    const currentValue = String(getFieldValue(record, fieldName, idx) || '');
    const parts = currentValue.split(/,\s*/).filter(s => s.trim().length > 0);
    parts[partIdx] = newPartText.trim();
    const filteredParts = parts.filter(p => p.trim().length > 0);
    const newFullText = filteredParts.join(', ');
    const partEditKey = `${fieldName}-${idx}-p${partIdx}`;
    setEditedFields(prev => ({ ...prev, [partEditKey]: 'edited' }));
    handleSaveField(record, fieldName, idx, sectionId);
    setEditValue(newFullText);
  }

  const handleSaveFieldWithValue = useCallback((record, fn, idx, sid, valueOverride, editTrackingKey) => {
    const ek = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: valueOverride }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [editTrackingKey || ek]: 'edited' }));
    stageDraft(record, fn, valueOverride, sid, idx);
    setEditingField(null); setEditValue('');
  }, [stageDraft]);

  // Edit ONE sub-key of an object field (e.g. vitaminLevels.B12) to a constrained status value. Stage
  // the WHOLE updated object under the field-level editKey `${fn}-${idx}` so Approve PUTs {field, value:obj}
  // (one $set of the whole object) and pdfData merges it. Selecting a value IS the edit (no Save click).
  const handleSaveObjectField = useCallback((record, fn, idx, sid, subKey, newVal) => {
    const ek = `${fn}-${idx}`;
    const cur = localEdits[ek] !== undefined ? localEdits[ek] : record[fn];
    const obj = { ...(cur && typeof cur === 'object' ? cur : {}), [subKey]: newVal };
    setLocalEdits(prev => ({ ...prev, [ek]: obj }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [`${fn}-${idx}-${subKey}`]: 'edited' }));
    stageDraft(record, fn, obj, sid, idx);
  }, [localEdits, stageDraft]);

  // Approve = COMMIT all staged drafts for this record's section to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, idx, sid) => {
    try {
      const rid = getRecordId(record); if (!rid) return;
      const sc = (await import('../../../services/secureApiClient')).default;
      const sf = SECTION_FIELDS[sid] || [];
      // Collect this section's pending edits from localEdits (keys: "field-idx" or "field-idx-arrayIndex").
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k]) return false;
        return sf.some(f => k === `${f}-${idx}` || k.startsWith(`${f}-${idx}-`));
      });
      for (const ek of toCommit) {
        let field, arrayIndex;
        const rest = ek; // "field-idx" or "field-idx-arrayIndex"
        // Strip the field prefix using SECTION_FIELDS so dotted-or-dashed field names parse correctly.
        const fld = sf.find(f => rest === `${f}-${idx}` || rest.startsWith(`${f}-${idx}-`));
        field = fld;
        const tail = rest.slice(`${fld}-${idx}`.length); // '' or '-<arrayIndex>'
        if (tail.startsWith('-')) { const n = tail.slice(1); if (/^\d+$/.test(n)) arrayIndex = parseInt(n, 10); }
        const payload = { field, value: localEdits[ek] };
        if (typeof arrayIndex === 'number') payload.arrayIndex = arrayIndex;
        await sc.put(`/api/edit/blood_disorder_reports/${rid}/edit`, payload);
      }
      await sc.put(`/api/edit/blood_disorder_reports/${rid}/approve`, { sectionId: sid, approved: true });
      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's committed drafts from localStorage
      const store = readDrafts();
      if (store[rid]) { toCommit.forEach(ek => { const fld = sf.find(f => ek === `${f}-${idx}` || ek.startsWith(`${f}-${idx}-`)); const tail = ek.slice(`${fld}-${idx}`.length); const fieldPart = tail.startsWith('-') && /^\d+$/.test(tail.slice(1)) ? `${fld}.${tail.slice(1)}` : fld; delete store[rid][fieldPart]; }); if (Object.keys(store[rid]).length === 0) delete store[rid]; writeDrafts(store); }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { sf.forEach(f => { if (k.startsWith(`${f}-${idx}`) || k.startsWith(`${f}.`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[BloodDisorderReports] Approve failed:', err); }
  }, [localEdits, pendingEdits]);

  const highlightText = (text) => { if (!text) return ''; const str = String(text); if (!searchTerm.trim()) return str; const esc = searchTerm.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const re = new RegExp(`(${esc})`, 'gi'); const p = str.split(re); if (p.length === 1) return str; return <>{p.map((x, i) => re.test(x) ? <mark key={i}>{x}</mark> : x)}</>; };
  const phraseMatch = (text, term) => { if (!term.trim()) return true; return String(text || '').toLowerCase().includes(term.toLowerCase().trim()); };
  const shouldShowSection = (record, title, contentParts, fieldNames) => { if (!searchTerm.trim()) return true; if (record._showAllSections) return true; const sl = searchTerm.toLowerCase().trim(); const tl = (title || '').toLowerCase(); if (tl.startsWith(sl) || sl.startsWith(tl)) return true; const labels = (fieldNames || []).map(f => FIELD_LABELS[f] || f); const combined = [...labels, ...(Array.isArray(contentParts) ? contentParts : [contentParts])].filter(Boolean).join(' '); return phraseMatch(combined, searchTerm); };
  const sectionTitleMatches = (t) => { if (!searchTerm.trim()) return false; const sl = searchTerm.toLowerCase().trim(); const tl = (t || '').toLowerCase(); return tl.startsWith(sl) || sl.startsWith(tl); };
  const fieldMatches = (record, fn, idx) => { if (!searchTerm.trim()) return true; if (record._showAllSections) return true; return phraseMatch(FIELD_LABELS[fn] || fn, searchTerm) || phraseMatch(getFieldValue(record, fn, idx), searchTerm); };

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const sl = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      const title = `Blood Disorder Report ${idx + 1}`;
      const allText = [title, formatDate(record.date), record.disorderType, record.diagnosis, record.severity, record.etiology, formatObject(record.cbc), formatObject(record.coagulationStudies), formatObject(record.ironStudies), formatObject(record.vitaminLevels), formatObject(record.hemolysisWorkup), record.peripheralSmear, record.boneMorrow, ...(Array.isArray(record.treatment) ? record.treatment : []), record.monitoring, record.notes, record.hematologist, record.facility, ...Object.values(FIELD_LABELS), 'Diagnosis Information', 'Clinical Summary', 'CBC (Complete Blood Count)', 'Coagulation Studies', 'Iron Studies', 'Vitamin Levels', 'Hemolysis Workup', 'Morphology', 'Treatment', 'Monitoring', 'Notes', 'Provider Information'].filter(Boolean).join(' ');
      const match = allText.toLowerCase().includes(sl);
      record._showAllSections = match && title.toLowerCase().startsWith(sl);
      return match;
    });
  }, [records, searchTerm]);

  const sectionHasEdits = (idx, sid) => { const fs = SECTION_FIELDS[sid] || []; return fs.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || k.startsWith(`${f}.`))); };
  const renderApproveButton = (idx, sid) => { const he = sectionHasEdits(idx, sid); const ia = approvedSections[`${sid}-${idx}`]; if (he) return <button className="approve-btn pending" onClick={(e) => { e.stopPropagation(); handleApproveSection(records[idx], idx, sid); }}>Pending Approve</button>; if (ia) return <span className="approve-btn approved">Approved</span>; return null; };

  const renderEditableField = (record, fn, idx, sid, hideLabel) => {
    const value = getFieldValue(record, fn, idx); if (!value && value !== false && !localEdits[`${fn}-${idx}`]) return null;
    const dv = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value || '');
    const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`;
    if (ie) return (<div className={hideLabel ? undefined : 'rec-mini-card'}>{!hideLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveField(record, fn, idx, sid); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => handleSaveField(record, fn, idx, sid)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div className={hideLabel ? undefined : 'rec-mini-card'}>{!hideLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(dv); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  const renderEditableArrayItem = (record, fn, idx, sid, item, ai) => {
    const ek = `${fn}-${idx}-${ai}`; const val = localEdits[ek] !== undefined ? localEdits[ek] : String(item || '');
    const ie = editingField === ek; const ed = editedFields[ek]; const cid = `arr-${fn}-${idx}-${ai}`;
    if (ie) return (<div key={ai} className="rec-mini-card"><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveArrayItem(record, fn, idx, sid, ai); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => handleSaveArrayItem(record, fn, idx, sid, ai)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div key={ai} className="rec-mini-card"><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(val); }}><div className="row-content"><span className="content-value">{highlightText(val)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(val, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  // Bar chart components (display-only)
  const LabBarChart = ({ label, percentage, rawValue, color, interpretation }) => (
    <div className="lab-bar-chart-row">
      <div className="lab-bar-label">{highlightText(label)}</div>
      <div className="lab-bar-container">
        <div className="lab-bar-background"><div className="lab-bar-fill" style={{ width: `${percentage}%`, backgroundColor: color }} /></div>
        <div className="lab-bar-value">{highlightText(rawValue)}</div>
      </div>
      {interpretation && <div className="lab-bar-interpretation" style={{ color }}>{highlightText(interpretation)}</div>}
    </div>
  );
  const LabChartLegend = () => (<div className="lab-chart-legend"><div className="legend-item"><div className="legend-color" style={{ backgroundColor: '#22c55e' }} /><span>Normal</span></div><div className="legend-item"><div className="legend-color" style={{ backgroundColor: '#3b82f6' }} /><span>Low</span></div><div className="legend-item"><div className="legend-color" style={{ backgroundColor: '#ef4444' }} /><span>High</span></div></div>);

  // editableStatus=true (Vitamin Levels): non-numeric sub-fields (B12, Folate, …) render as a status
  // dropdown + the section gets a Pending Approve button. obj read effective (shows pending drafts);
  // Copy Section uses the COMMITTED object (pdfData) per the defer-save rule.
  const renderLabSection = (record, idx, sid, title, fieldName, editableStatus = false) => {
    const obj = editableStatus ? getFieldValue(record, fieldName, idx) : record[fieldName];
    if (!obj || typeof obj !== 'object' || Object.keys(obj).length === 0) return null;
    const entries = Object.entries(obj);
    const chartData = []; const nonChartData = [];
    entries.forEach(([key, value]) => { const testType = getLabTestType(key); const numVal = extractLabValue(value); if (testType && numVal !== null) { chartData.push({ key, value: String(value), testType, numVal }); } else { nonChartData.push({ key, value: String(value) }); } });
    const allContent = entries.map(([k, v]) => `${k}: ${v}`);
    if (!shouldShowSection(record, title, allContent)) return null;
    const copyObj = editableStatus ? (((pdfData[idx] || record)[fieldName]) || {}) : obj;
    return (
      <div className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn${copiedId === `section-${sid}-${idx}` ? ' copied' : ''}`} onClick={() => { const text = Object.entries(copyObj).map(([k, v]) => `${k}: ${v}`).join('\n'); copyToClipboard(text, `section-${sid}-${idx}`); }}>{copiedId === `section-${sid}-${idx}` ? 'Copied' : 'Copy Section'}</button>{editableStatus && renderApproveButton(idx, sid)}</div></div>
        {chartData.length > 0 && (<div className="lab-chart-container"><LabChartLegend />{chartData.map((d, i) => <LabBarChart key={i} label={d.key} percentage={labToPercentage(d.numVal, d.testType)} rawValue={d.value} color={getLabBarColor(d.numVal, d.testType)} interpretation={getLabInterpretation(d.numVal, d.testType)} />)}</div>)}
        {nonChartData.length > 0 && nonChartData.map((d, i) => {
          if (editableStatus) {
            const subKey = d.key; const curVal = d.value; const ek = `${fieldName}-${idx}-${subKey}`; const ed = editedFields[ek]; const cid = `lab-${sid}-${idx}-${i}`;
            const opts = VITAMIN_STATUS_OPTIONS.includes(curVal) ? VITAMIN_STATUS_OPTIONS : [curVal, ...VITAMIN_STATUS_OPTIONS];
            return (<div key={i} className="rec-mini-card"><div className="nested-subtitle">{highlightText(subKey)}</div><div className={`numbered-row editable-row${ed ? ' modified' : ''}`}><div className="row-content"><select className="edit-select" value={curVal} onChange={e => handleSaveObjectField(record, fieldName, idx, sid, subKey, e.target.value)}>{opts.map(o => <option key={o} value={o}>{o}</option>)}</select></div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={() => copyToClipboard(`${subKey}: ${curVal}`, cid)}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
          }
          return (<div key={i} className="rec-mini-card"><div className="nested-subtitle">{highlightText(d.key)}</div><div className="numbered-row"><div className="row-content"><span className="content-value">{highlightText(d.value)}</span></div><button className={`copy-btn${copiedId === `lab-${sid}-${idx}-${i}` ? ' copied' : ''}`} onClick={() => copyToClipboard(`${d.key}: ${d.value}`, `lab-${sid}-${idx}-${i}`)}>{copiedId === `lab-${sid}-${idx}-${i}` ? 'Copied' : 'Copy'}</button></div></div>);
        })}
      </div></div>
    );
  };

  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return records;
    return records.map((record, idx) => {
      const m = { ...record };
      Object.keys(localEdits).forEach(key => { if (pendingEdits[key]) return; const ld = key.lastIndexOf('-'); if (ld === -1) return; const fn = key.substring(0, ld); const ri = parseInt(key.substring(ld + 1), 10); if (ri === idx && fn in record) m[fn] = localEdits[key]; });
      ARRAY_FIELDS.forEach(field => { m[field] = getEffectiveArray(record, field, idx, false); });
      return m;
    });
  }, [records, localEdits, pendingEdits, getEffectiveArray]);

  const copySectionText = (record, idx, sid) => {
    const pr = pdfData[idx] || record; let text = '';
    if (sid === 'diagInfo') { if (pr.disorderType) text += `Disorder Type: ${pr.disorderType}\n`; if (pr.diagnosis) text += `Diagnosis: ${pr.diagnosis}\n`; if (pr.etiology) text += `Etiology: ${pr.etiology}\n`; }
    else if (sid === 'severity') { if (pr.severity) text += `Severity: ${pr.severity}\n`; }
    else if (sid === 'morphology') { if (pr.peripheralSmear) { text += 'Peripheral Smear:\n'; pr.peripheralSmear.split(/,\s*/).filter(s => s.trim()).forEach((item, i) => { text += `${i + 1}. ${item.trim()}\n`; }); } if (pr.boneMorrow) text += `Bone Marrow: ${pr.boneMorrow}\n`; }
    else if (sid === 'treatment') { const items = getEffectiveArray(pr, 'treatment', idx, false); items.forEach((item, i) => { text += `${i + 1}. ${item}\n`; }); }
    else if (sid === 'monitoring') { if (pr.monitoring) { const sentences = pr.monitoring.split(/\.\s+/).map(s => s.trim()).filter(s => s.length > 0 && s.replace(/[.!?;,]+/g, '').trim().length > 0); sentences.forEach((s, i) => { text += `${i + 1}. ${s.replace(/\.$/, '')}\n`; }); } }
    else if (sid === 'notes') { if (pr.notes) { pr.notes.split(/\.\s+/).map(s => s.trim()).filter(s => s.length > 0 && s.replace(/[.!?;,]+/g, '').trim().length > 0).forEach((s, i) => { text += `${i + 1}. ${s.replace(/\.$/, '')}\n`; }); } }
    else if (sid === 'providerInfo') { if (pr.hematologist) text += `Hematologist: ${pr.hematologist}\n`; if (pr.facility) text += `Facility: ${pr.facility}\n`; }
    copyToClipboard(text.trim(), `section-${sid}-${idx}`);
  };

  const copyAllContent = () => {
    let text = '=== BLOOD DISORDER REPORTS ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Blood Disorder Report ${idx + 1}\n`;
      if (r.date) text += `${formatDate(r.date)}\n`;
      if (r.disorderType || r.diagnosis || r.etiology) { text += '\nDIAGNOSIS INFORMATION\n'; if (r.disorderType) text += `Disorder Type: ${r.disorderType}\n`; if (r.diagnosis) text += `Diagnosis: ${r.diagnosis}\n`; if (r.etiology) text += `Etiology: ${r.etiology}\n`; }
      if (r.severity) { text += '\nSEVERITY\n'; text += `${r.severity}\n`; }
      if (r.cbc && Object.keys(r.cbc).length > 0) { text += '\nCBC\n'; Object.entries(r.cbc).forEach(([k, v]) => { text += `${k}: ${v}\n`; }); }
      if (r.coagulationStudies && Object.keys(r.coagulationStudies).length > 0) { text += '\nCOAGULATION STUDIES\n'; Object.entries(r.coagulationStudies).forEach(([k, v]) => { text += `${k}: ${v}\n`; }); }
      if (r.ironStudies && Object.keys(r.ironStudies).length > 0) { text += '\nIRON STUDIES\n'; Object.entries(r.ironStudies).forEach(([k, v]) => { text += `${k}: ${v}\n`; }); }
      if (r.vitaminLevels && Object.keys(r.vitaminLevels).length > 0) { text += '\nVITAMIN LEVELS\n'; Object.entries(r.vitaminLevels).forEach(([k, v]) => { text += `${k}: ${v}\n`; }); }
      if (r.hemolysisWorkup && Object.keys(r.hemolysisWorkup).length > 0) { text += '\nHEMOLYSIS WORKUP\n'; Object.entries(r.hemolysisWorkup).forEach(([k, v]) => { text += `${k}: ${v}\n`; }); }
      if (r.peripheralSmear || r.boneMorrow) { text += '\nMORPHOLOGY\n'; if (r.peripheralSmear) { text += 'Peripheral Smear:\n'; r.peripheralSmear.split(/,\s*/).filter(s => s.trim()).forEach((item, i) => { text += `${i + 1}. ${item.trim()}\n`; }); } if (r.boneMorrow) text += `Bone Marrow: ${r.boneMorrow}\n`; }
      const tx = getEffectiveArray(r, 'treatment', idx, false); if (tx.length > 0) { text += '\nTREATMENT\n'; tx.forEach((item, i) => { text += `${i + 1}. ${item}\n`; }); }
      if (r.monitoring) { text += '\nMONITORING\n'; r.monitoring.split(/\.\s+/).map(s => s.trim()).filter(s => s.length > 0 && s.replace(/[.!?;,]+/g, '').trim().length > 0).forEach((s, i) => { text += `${i + 1}. ${s.replace(/\.$/, '')}\n`; }); }
      if (r.notes) { text += '\nNOTES\n'; r.notes.split(/\.\s+/).map(s => s.trim()).filter(s => s.length > 0 && s.replace(/[.!?;,]+/g, '').trim().length > 0).forEach((s, i) => { text += `${i + 1}. ${s.replace(/\.$/, '')}\n`; }); }
      if (r.hematologist || r.facility) { text += '\nPROVIDER INFORMATION\n'; if (r.hematologist) text += `Hematologist: ${r.hematologist}\n`; if (r.facility) text += `Facility: ${r.facility}\n`; }
      text += '\n';
    });
    copyToClipboard(text.trim(), 'copy-all');
  };

  const renderSection = (record, idx, sid, title, children) => { if (!children) return null; return (<div className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn${copiedId === `section-${sid}-${idx}` ? ' copied' : ''}`} onClick={() => copySectionText(record, idx, sid)}>{copiedId === `section-${sid}-${idx}` ? 'Copied' : 'Copy Section'}</button>{renderApproveButton(idx, sid)}</div></div>{children}</div></div>); };

  if (!filteredRecords || filteredRecords.length === 0) return (<article className="blood-disorder-reports-document"><header className="document-header"><h1 className="document-title">Blood Disorder Reports</h1></header><SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} /><div className="empty-state">No data available.</div></article>);

  return (
    <article className="blood-disorder-reports-document">
      <header className="document-header">
        <h1 className="document-title">Blood Disorder Reports</h1>
        <div className="header-actions">
          <button className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`} onClick={copyAllContent}>{copiedId === 'copy-all' ? 'Copied' : 'Copy All'}</button>
          <PDFDownloadLink document={<BloodDisorderReportsPDFTemplate document={pdfData} />} fileName="Blood_Disorder_Reports.pdf">
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
                {record.severity && <span className="severity-badge" style={{ background: `${getSeverityBadgeColor(record.severity)}22`, color: getSeverityBadgeColor(record.severity), border: `1px solid ${getSeverityBadgeColor(record.severity)}66` }}>{highlightText(getSeverityLabel(record.severity))}</span>}
                {record.date && <span className="record-date">{highlightText(formatDate(record.date))}</span>}
              </div>
              <div className="record-title-row"><h3 className="record-name">{highlightText(`Blood Disorder Report ${idx + 1}`)}</h3></div>
            </div>

            {/* Diagnosis Information */}
            {(record.disorderType || record.diagnosis || record.etiology) && shouldShowSection(record, 'Diagnosis Information', [record.disorderType, record.diagnosis, record.etiology].filter(Boolean), ['disorderType', 'diagnosis', 'etiology']) && renderSection(record, idx, 'diagInfo', 'Diagnosis Information', (() => { const stm = sectionTitleMatches('Diagnosis Information'); const sa = !searchTerm.trim() || record._showAllSections || stm; return <>{(sa || fieldMatches(record, 'disorderType', idx)) && renderEditableField(record, 'disorderType', idx, 'diagInfo')}{(sa || fieldMatches(record, 'diagnosis', idx)) && renderEditableField(record, 'diagnosis', idx, 'diagInfo')}{(sa || fieldMatches(record, 'etiology', idx)) && renderEditableField(record, 'etiology', idx, 'diagInfo')}</>; })())}

            {/* Severity (editable, with full text if long) */}
            {record.severity && shouldShowSection(record, 'Severity', [record.severity], ['severity']) && renderSection(record, idx, 'severity', 'Severity', renderEditableField(record, 'severity', idx, 'severity', true))}

            {/* Lab Sections (display-only bar charts) */}
            {renderLabSection(record, idx, 'cbc', 'CBC (Complete Blood Count)', 'cbc')}
            {renderLabSection(record, idx, 'coagulation', 'Coagulation Studies', 'coagulationStudies')}
            {renderLabSection(record, idx, 'ironStudies', 'Iron Studies', 'ironStudies')}
            {renderLabSection(record, idx, 'vitaminLevels', 'Vitamin Levels', 'vitaminLevels', true)}
            {renderLabSection(record, idx, 'hemolysis', 'Hemolysis Workup', 'hemolysisWorkup')}

            {/* Morphology */}
            {(record.peripheralSmear || record.boneMorrow) && shouldShowSection(record, 'Morphology', [record.peripheralSmear, record.boneMorrow].filter(Boolean), ['peripheralSmear', 'boneMorrow']) && renderSection(record, idx, 'morphology', 'Morphology', (() => { const stm = sectionTitleMatches('Morphology'); const sa = !searchTerm.trim() || record._showAllSections || stm; const smearVal = String(getFieldValue(record, 'peripheralSmear', idx) || ''); const smearItems = smearVal.split(/,\s*/).filter(s => s.trim().length > 0); return <>{(sa || fieldMatches(record, 'peripheralSmear', idx)) && smearItems.length > 1 ? (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText('Peripheral Smear')}</div>{smearItems.map((item, si) => { if (!sa && !phraseMatch(item, searchTerm)) return null; const partKey = `peripheralSmear-${idx}-p${si}`; const isEditing = editingField === partKey; const isEdited = editedFields[partKey]; const cid = `smear-${idx}-${si}`; if (isEditing) return (<div key={si} className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) { const parts = smearVal.split(/,\s*/).filter(s => s.trim().length > 0); parts[si] = editValue.trim(); const newFull = parts.filter(p => p.trim().length > 0).join(', '); handleSaveFieldWithValue(record, 'peripheralSmear', idx, 'morphology', newFull, partKey); } if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => { const parts = smearVal.split(/,\s*/).filter(s => s.trim().length > 0); parts[si] = editValue.trim(); const newFull = parts.filter(p => p.trim().length > 0).join(', '); handleSaveFieldWithValue(record, 'peripheralSmear', idx, 'morphology', newFull, partKey); }} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>); return (<React.Fragment key={si}><div className={`numbered-row editable-row${isEdited ? ' modified' : ''}`} onClick={() => { setEditingField(partKey); setEditValue(item.trim()); }}><div className="row-content"><span className="content-value">{highlightText(item.trim())}</span>{!isEdited && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(item.trim(), cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{isEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}</React.Fragment>); })}</div>) : (sa || fieldMatches(record, 'peripheralSmear', idx)) && renderEditableField(record, 'peripheralSmear', idx, 'morphology')}{(sa || fieldMatches(record, 'boneMorrow', idx)) && renderEditableField(record, 'boneMorrow', idx, 'morphology')}</>; })())}

            {/* Treatment */}
            {record.treatment?.length > 0 && shouldShowSection(record, 'Treatment', record.treatment, ['treatment']) && renderSection(record, idx, 'treatment', 'Treatment', (() => { const stm = sectionTitleMatches('Treatment'); const sa = !searchTerm.trim() || record._showAllSections || stm; return record.treatment.map((item, ai) => { const val = localEdits[`treatment-${idx}-${ai}`] !== undefined ? localEdits[`treatment-${idx}-${ai}`] : item; if (!sa && !phraseMatch(val, searchTerm)) return null; return renderEditableArrayItem(record, 'treatment', idx, 'treatment', item, ai); }).filter(Boolean); })())}

            {/* Monitoring */}
            {record.monitoring && shouldShowSection(record, 'Monitoring', [record.monitoring], ['monitoring']) && renderSection(record, idx, 'monitoring', 'Monitoring', (() => { const monVal = String(getFieldValue(record, 'monitoring', idx) || ''); const monSentences = monVal.split(/\.\s+/).map(s => s.trim()).filter(s => s.length > 0 && s.replace(/[.!?;,]+/g, '').trim().length > 0); if (monSentences.length <= 1) return renderEditableField(record, 'monitoring', idx, 'monitoring', true); const stm = sectionTitleMatches('Monitoring'); const sa = !searchTerm.trim() || record._showAllSections || stm; return monSentences.map((sentence, si) => { if (!sa && !phraseMatch(sentence, searchTerm)) return null; const partKey = `monitoring-${idx}-p${si}`; const isEditing = editingField === partKey; const isEdited = editedFields[partKey]; const cid = `mon-${idx}-${si}`; const displayText = sentence.replace(/\.$/, ''); if (isEditing) return (<div key={si} className="rec-mini-card"><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) { const parts = monVal.split(/\.\s+/).map(s => s.trim()).filter(s => s.length > 0 && s.replace(/[.!?;,]+/g, '').trim().length > 0); parts[si] = editValue.trim(); const newFull = parts.filter(p => p.trim().length > 0).map(p => p.replace(/\.$/, '')).join('. ') + '.'; handleSaveFieldWithValue(record, 'monitoring', idx, 'monitoring', newFull, partKey); } if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => { const parts = monVal.split(/\.\s+/).map(s => s.trim()).filter(s => s.length > 0 && s.replace(/[.!?;,]+/g, '').trim().length > 0); parts[si] = editValue.trim(); const newFull = parts.filter(p => p.trim().length > 0).map(p => p.replace(/\.$/, '')).join('. ') + '.'; handleSaveFieldWithValue(record, 'monitoring', idx, 'monitoring', newFull, partKey); }} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>); return (<React.Fragment key={si}><div className="rec-mini-card"><div className={`numbered-row editable-row${isEdited ? ' modified' : ''}`} onClick={() => { setEditingField(partKey); setEditValue(displayText); }}><div className="row-content"><span className="content-value">{highlightText(displayText)}</span>{!isEdited && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(displayText, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{isEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}</div></React.Fragment>); }).filter(Boolean); })())}

            {/* Notes */}
            {record.notes && shouldShowSection(record, 'Notes', [record.notes], ['notes']) && renderSection(record, idx, 'notes', 'Notes', (() => { const notesVal = String(getFieldValue(record, 'notes', idx) || ''); const notesSentences = notesVal.split(/\.\s+/).map(s => s.trim()).filter(s => s.length > 0 && s.replace(/[.!?;,]+/g, '').trim().length > 0); if (notesSentences.length <= 1) return renderEditableField(record, 'notes', idx, 'notes', true); const stm = sectionTitleMatches('Notes'); const sa = !searchTerm.trim() || record._showAllSections || stm; return notesSentences.map((sentence, si) => { if (!sa && !phraseMatch(sentence, searchTerm)) return null; const partKey = `notes-${idx}-p${si}`; const isEditing = editingField === partKey; const isEdited = editedFields[partKey]; const cid = `note-${idx}-${si}`; const displayText = sentence.replace(/\.$/, ''); if (isEditing) return (<div key={si} className="rec-mini-card"><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) { const parts = notesVal.split(/\.\s+/).map(s => s.trim()).filter(s => s.length > 0 && s.replace(/[.!?;,]+/g, '').trim().length > 0); parts[si] = editValue.trim(); const newFull = parts.filter(p => p.trim().length > 0).map(p => p.replace(/\.$/, '')).join('. ') + '.'; handleSaveFieldWithValue(record, 'notes', idx, 'notes', newFull, partKey); } if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => { const parts = notesVal.split(/\.\s+/).map(s => s.trim()).filter(s => s.length > 0 && s.replace(/[.!?;,]+/g, '').trim().length > 0); parts[si] = editValue.trim(); const newFull = parts.filter(p => p.trim().length > 0).map(p => p.replace(/\.$/, '')).join('. ') + '.'; handleSaveFieldWithValue(record, 'notes', idx, 'notes', newFull, partKey); }} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>); return (<React.Fragment key={si}><div className="rec-mini-card"><div className={`numbered-row editable-row${isEdited ? ' modified' : ''}`} onClick={() => { setEditingField(partKey); setEditValue(displayText); }}><div className="row-content"><span className="content-value">{highlightText(displayText)}</span>{!isEdited && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(displayText, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{isEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}</div></React.Fragment>); }).filter(Boolean); })())}

            {/* Provider Information */}
            {(record.hematologist || record.facility) && shouldShowSection(record, 'Provider Information', [record.hematologist, record.facility].filter(Boolean), ['hematologist', 'facility']) && renderSection(record, idx, 'providerInfo', 'Provider Information', (() => { const stm = sectionTitleMatches('Provider Information'); const sa = !searchTerm.trim() || record._showAllSections || stm; return <>{(sa || fieldMatches(record, 'hematologist', idx)) && renderEditableField(record, 'hematologist', idx, 'providerInfo')}{(sa || fieldMatches(record, 'facility', idx)) && renderEditableField(record, 'facility', idx, 'providerInfo')}</>; })())}
          </div>
        ))}
      </div>
    </article>
  );
};

export default BloodDisorderReportsDocument;
