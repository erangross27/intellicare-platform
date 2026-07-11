/**
 * BoneScanReportsDocument.jsx
 * Inline editing with per-section approve, per-row copy.
 * 4-level search, PDFDownloadLink + pdfData memo, secureApiClient.
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import BoneScanReportsDocumentPDFTemplate from '../pdf-templates/BoneScanReportsDocumentPDFTemplate';
import './BoneScanReportsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'bone_scan_reportsPendingEdits';
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
  imaging: ['radiopharmaceuticalAgent', 'injectedDose', 'uptakeDelay', 'bloodPoolImaging'],
  skeletal: ['skeletalUptakePattern', 'superScanPattern'],
  hotSpots: ['hotSpotLocations'],
  coldSpots: ['coldSpotLocations'],
  clinical: ['metastaticDisease', 'clinicalCorrelation'],
  fractures: ['fractureSites'],
  other: ['arthriticChanges', 'pageticChanges', 'osteoporosisEvidence', 'osteosarcomaFindings', 'osteomyelitisEvidence'],
  additional: ['renalClearance', 'softtissueUptake', 'spinalAlignment'],
  devices: ['prostheticDevices', 'photonDeficiency', 'imagingArtifacts'],
  followUp: ['followUpRecommendations'],
};
const FIELD_LABELS = { radiopharmaceuticalAgent: 'Radiopharmaceutical', injectedDose: 'Injected Dose', uptakeDelay: 'Uptake Delay', bloodPoolImaging: 'Blood Pool Imaging', skeletalUptakePattern: 'Skeletal Uptake Pattern', superScanPattern: 'Super Scan Pattern', metastaticDisease: 'Metastatic Disease', clinicalCorrelation: 'Clinical Correlation', pageticChanges: 'Pagetic Changes', osteoporosisEvidence: 'Osteoporosis Evidence', osteosarcomaFindings: 'Osteosarcoma Findings', osteomyelitisEvidence: 'Osteomyelitis Evidence', renalClearance: 'Renal Clearance', softtissueUptake: 'Soft Tissue Uptake', spinalAlignment: 'Spinal Alignment', followUpRecommendations: 'Follow Up Recommendations' };
const ARRAY_FIELDS = ['hotSpotLocations', 'coldSpotLocations', 'fractureSites', 'arthriticChanges', 'prostheticDevices', 'photonDeficiency', 'imagingArtifacts'];
const BOOLEAN_FIELDS = ['bloodPoolImaging', 'superScanPattern'];

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; return String(v || ''); };

const BoneScanReportsDocument = ({ document: rawDoc }) => {
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
    arr = arr.flatMap(r => { if (r?.bone_scan_reports) return Array.isArray(r.bone_scan_reports) ? r.bone_scan_reports : [r.bone_scan_reports]; if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.bone_scan_reports) return Array.isArray(dd.bone_scan_reports) ? dd.bone_scan_reports : [dd.bone_scan_reports]; return [dd]; } return r; });
    return arr.filter(r => r && typeof r === 'object');
  }, [rawDoc]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const id = record && record._id;
      const rid = !id ? null : (typeof id === 'string' ? id : (id.$oid ? id.$oid : String(id)));
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        // fieldPart = "field" or "field.arrayIndex"; editKey uses "-" separators
        const dotIdx = fieldPart.lastIndexOf('.');
        const isArr = dotIdx !== -1 && /^\d+$/.test(fieldPart.slice(dotIdx + 1));
        const editKey = isArr
          ? `${fieldPart.slice(0, dotIdx)}-${idx}-${fieldPart.slice(dotIdx + 1)}`
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

  // Committed array values for copy/PDF paths — pending array drafts stay OUT until approved.
  const getEffectiveArray = useCallback((record, fieldName, idx) => {
    const original = Array.isArray(record[fieldName]) ? [...record[fieldName]] : [];
    original.forEach((_, ai) => { const ek = `${fieldName}-${idx}-${ai}`; if (localEdits[ek] !== undefined && !pendingEdits[ek]) original[ai] = localEdits[ek]; });
    return original;
  }, [localEdits, pendingEdits]);

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid) => {
    const rid = getRecordId(record);
    if (!rid) { console.error('[BoneScanReports] Cannot save — no record ID'); return; }
    const isBool = BOOLEAN_FIELDS.includes(fn);
    const outVal = isBool ? (editValue === 'Yes') : editValue;
    const ek = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: outVal }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    // Re-edit after approval → drop this section's 'approved' flag so the button goes back to yellow
    setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][fn] = outVal;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue]);

  const handleSaveArrayItem = useCallback((record, fn, idx, sid, arrayIndex) => {
    const rid = getRecordId(record);
    if (!rid) { console.error('[BoneScanReports] Cannot save — no record ID'); return; }
    const ek = `${fn}-${idx}-${arrayIndex}`;
    setLocalEdits(prev => ({ ...prev, [ek]: editValue }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][`${fn}.${arrayIndex}`] = editValue;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue]);

  // Approve = COMMIT this section's staged drafts to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, idx, sid) => {
    const rid = getRecordId(record);
    if (!rid) return;
    const sf = SECTION_FIELDS[sid] || [];
    try {
      const sc = (await import('../../../services/secureApiClient')).default;
      // Collect this record's pending edits belonging to this section's fields
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k]) return false;
        // editKey = "field-idx" or "field-idx-arrayIndex"
        const parts = k.split('-');
        let field, recIdx, arrayIndex;
        if (parts.length >= 3 && /^\d+$/.test(parts[parts.length - 1]) && /^\d+$/.test(parts[parts.length - 2])) {
          arrayIndex = parseInt(parts[parts.length - 1], 10);
          recIdx = parseInt(parts[parts.length - 2], 10);
          field = parts.slice(0, parts.length - 2).join('-');
        } else {
          recIdx = parseInt(parts[parts.length - 1], 10);
          field = parts.slice(0, parts.length - 1).join('-');
        }
        return recIdx === idx && sf.includes(field);
      });
      for (const editKey of toCommit) {
        const parts = editKey.split('-');
        let field, arrayIndex;
        if (parts.length >= 3 && /^\d+$/.test(parts[parts.length - 1]) && /^\d+$/.test(parts[parts.length - 2])) {
          arrayIndex = parseInt(parts[parts.length - 1], 10);
          field = parts.slice(0, parts.length - 2).join('-');
        } else {
          field = parts.slice(0, parts.length - 1).join('-');
        }
        const payload = { field, value: localEdits[editKey] };
        if (typeof arrayIndex === 'number') payload.arrayIndex = arrayIndex;
        const resp = await sc.put(`/api/edit/bone_scan_reports/${rid}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      await sc.put(`/api/edit/bone_scan_reports/${rid}/approve`, { sectionId: sid, approved: true });
      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this section's committed drafts from localStorage
      const store = readDrafts();
      if (store[rid]) {
        sf.forEach(f => {
          delete store[rid][f];
          Object.keys(store[rid]).forEach(fp => { if (fp.startsWith(`${f}.`)) delete store[rid][fp]; });
        });
        if (Object.keys(store[rid]).length === 0) delete store[rid];
        writeDrafts(store);
      }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { sf.forEach(f => { if (k.startsWith(`${f}-${idx}`) || k.startsWith(`${f}.`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[BoneScanReports] Approve failed:', err); }
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
      const title = `Bone Scan Report ${idx + 1}`;
      const allText = [title, formatDate(record.date || record.createdAt), record.skeletalUptakePattern, record.metastaticDisease, record.clinicalCorrelation, record.followUpRecommendations, ...(Array.isArray(record.hotSpotLocations) ? record.hotSpotLocations : []), ...(Array.isArray(record.fractureSites) ? record.fractureSites : []), ...Object.values(FIELD_LABELS), 'Imaging Parameters', 'Skeletal Uptake', 'Hot Spots', 'Cold Spots', 'Clinical Assessment', 'Fracture Sites', 'Other Findings', 'Additional', 'Devices & Artifacts', 'Follow Up'].filter(Boolean).join(' ');
      const match = allText.toLowerCase().includes(sl);
      record._showAllSections = match && title.toLowerCase().startsWith(sl);
      return match;
    });
  }, [records, searchTerm]);

  const sectionHasEdits = (idx, sid) => { const fs = SECTION_FIELDS[sid] || []; return fs.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || k.startsWith(`${f}.`))); };
  const renderApproveButton = (idx, sid) => { const he = sectionHasEdits(idx, sid); const ia = approvedSections[`${sid}-${idx}`]; if (he) return <button className="approve-btn pending" onClick={(e) => { e.stopPropagation(); handleApproveSection(records[idx], idx, sid); }}>Pending Approve</button>; if (ia) return <span className="approve-btn approved">Approved</span>; return null; };

  const renderEditableField = (record, fn, idx, sid, hideLabel) => {
    const raw = getFieldValue(record, fn, idx); if (!hasVal(raw)) return null;
    const dv = fmtVal(raw);
    const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`;
    const isBool = BOOLEAN_FIELDS.includes(fn);
    if (ie) return (<div className={hideLabel ? undefined : 'rec-mini-card'}>{!hideLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className="edit-field-container">{isBool ? (<select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} disabled={saving}><option value="Yes">Yes</option><option value="No">No</option></select>) : (<textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveField(record, fn, idx, sid); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={fn === 'clinicalCorrelation' || fn === 'followUpRecommendations' ? 3 : 1} disabled={saving} />)}<div className="edit-actions"><button className="save-btn" onClick={() => handleSaveField(record, fn, idx, sid)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div className={hideLabel ? undefined : 'rec-mini-card'}>{!hideLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(dv); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
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
      Object.keys(localEdits).forEach(key => { if (pendingEdits[key]) return; const ld = key.lastIndexOf('-'); if (ld === -1) return; const fn = key.substring(0, ld); const ri = parseInt(key.substring(ld + 1), 10); if (ri === idx && fn in record) m[fn] = localEdits[key]; });
      // Array fields: merge only COMMITTED edits (pending array drafts stay OUT of the PDF until approved)
      ARRAY_FIELDS.forEach(field => {
        const arr = Array.isArray(record[field]) ? [...record[field]] : [];
        arr.forEach((_, ai) => { const ek = `${field}-${idx}-${ai}`; if (localEdits[ek] !== undefined && !pendingEdits[ek]) arr[ai] = localEdits[ek]; });
        m[field] = arr;
      });
      return m;
    });
  }, [records, localEdits, pendingEdits]);

  const SECTION_TITLES = { imaging: 'IMAGING PARAMETERS', skeletal: 'SKELETAL UPTAKE', hotSpots: 'HOT SPOTS', coldSpots: 'COLD SPOTS', clinical: 'CLINICAL ASSESSMENT', fractures: 'FRACTURE SITES', other: 'OTHER FINDINGS', additional: 'ADDITIONAL', devices: 'DEVICES & ARTIFACTS', followUp: 'FOLLOW UP' };

  const copySectionText = (record, idx, sid) => {
    const pr = pdfData[idx] || record; let text = `${SECTION_TITLES[sid] || sid.toUpperCase()}\n`;
    const addF = (fn) => { if (hasVal(pr[fn])) text += `${FIELD_LABELS[fn] || fn}: ${fmtVal(pr[fn])}\n`; };
    const addArr = (fn) => { getEffectiveArray(pr, fn, idx).forEach((item, i) => { text += `${i + 1}. ${item}\n`; }); };
    if (sid === 'imaging') { ['radiopharmaceuticalAgent', 'injectedDose', 'uptakeDelay', 'bloodPoolImaging'].forEach(addF); }
    else if (sid === 'skeletal') { addF('skeletalUptakePattern'); addF('superScanPattern'); }
    else if (sid === 'hotSpots') { addArr('hotSpotLocations'); }
    else if (sid === 'coldSpots') { addArr('coldSpotLocations'); }
    else if (sid === 'clinical') { addF('metastaticDisease'); addF('clinicalCorrelation'); }
    else if (sid === 'fractures') { addArr('fractureSites'); }
    else if (sid === 'other') { ['pageticChanges', 'osteoporosisEvidence', 'osteosarcomaFindings', 'osteomyelitisEvidence'].forEach(addF); addArr('arthriticChanges'); }
    else if (sid === 'additional') { ['renalClearance', 'softtissueUptake', 'spinalAlignment'].forEach(addF); }
    else if (sid === 'devices') { addArr('prostheticDevices'); addArr('photonDeficiency'); addArr('imagingArtifacts'); }
    else if (sid === 'followUp') { addF('followUpRecommendations'); }
    copyToClipboard(text.trim(), `section-${sid}-${idx}`);
  };

  const copyAllContent = () => {
    let text = '=== BONE SCAN REPORTS ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Bone Scan Report ${idx + 1}\n`;
      if (r.date || r.createdAt) text += `${formatDate(r.date || r.createdAt)}\n`;
      const addF = (fn) => { if (hasVal(r[fn])) text += `${FIELD_LABELS[fn] || fn}: ${fmtVal(r[fn])}\n`; };
      const addArr = (fn) => { getEffectiveArray(r, fn, idx).forEach((item, i) => { text += `${i + 1}. ${item}\n`; }); };
      const simpleFs = (title, fields) => { const vis = fields.filter(f => hasVal(r[f])); if (vis.length) { text += `\n${title}\n`; vis.forEach(addF); } };
      const arrFs = (title, fn) => { const items = getEffectiveArray(r, fn, idx); if (items.length) { text += `\n${title}\n`; addArr(fn); } };
      simpleFs('IMAGING PARAMETERS', ['radiopharmaceuticalAgent', 'injectedDose', 'uptakeDelay', 'bloodPoolImaging']);
      if (hasVal(r.skeletalUptakePattern) || hasVal(r.superScanPattern)) { text += '\nSKELETAL UPTAKE\n'; addF('skeletalUptakePattern'); addF('superScanPattern'); }
      arrFs('HOT SPOTS', 'hotSpotLocations');
      arrFs('COLD SPOTS', 'coldSpotLocations');
      if (hasVal(r.metastaticDisease) || hasVal(r.clinicalCorrelation)) { text += '\nCLINICAL ASSESSMENT\n'; addF('metastaticDisease'); addF('clinicalCorrelation'); }
      arrFs('FRACTURE SITES', 'fractureSites');
      simpleFs('OTHER FINDINGS', ['pageticChanges', 'osteoporosisEvidence', 'osteosarcomaFindings', 'osteomyelitisEvidence']);
      if (hasVal(r.followUpRecommendations)) { text += '\nFOLLOW UP\n'; addF('followUpRecommendations'); }
      text += '\n';
    });
    copyToClipboard(text.trim(), 'copy-all');
  };

  const renderSection = (record, idx, sid, title, children) => { if (!children) return null; return (<div className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn${copiedId === `section-${sid}-${idx}` ? ' copied' : ''}`} onClick={() => copySectionText(record, idx, sid)}>{copiedId === `section-${sid}-${idx}` ? 'Copied' : 'Copy Section'}</button>{renderApproveButton(idx, sid)}</div></div>{children}</div></div>); };

  const renderMultiFieldSection = (record, idx, sid, title, fields) => {
    const visibleFields = fields.filter(f => hasVal(getFieldValue(record, f, idx)));
    if (visibleFields.length === 0) return null;
    if (!shouldShowSection(record, title, visibleFields.map(f => fmtVal(getFieldValue(record, f, idx))), visibleFields)) return null;
    return renderSection(record, idx, sid, title, (() => { const stm = sectionTitleMatches(title); const sa = !searchTerm.trim() || record._showAllSections || stm; return <>{visibleFields.map(f => { if (!sa && !fieldMatches(record, f, idx)) return null; return <React.Fragment key={f}>{renderEditableField(record, f, idx, sid)}</React.Fragment>; })}</>; })());
  };

  const renderArraySection = (record, idx, sid, title, fieldName) => {
    const items = Array.isArray(record[fieldName]) ? record[fieldName].filter(Boolean) : [];
    if (items.length === 0) return null;
    if (!shouldShowSection(record, title, items, [fieldName])) return null;
    return renderSection(record, idx, sid, title, (() => { const stm = sectionTitleMatches(title); const sa = !searchTerm.trim() || record._showAllSections || stm; return items.map((item, ai) => { const val = localEdits[`${fieldName}-${idx}-${ai}`] !== undefined ? localEdits[`${fieldName}-${idx}-${ai}`] : item; if (!sa && !phraseMatch(val, searchTerm)) return null; return renderEditableArrayItem(record, fieldName, idx, sid, item, ai); }).filter(Boolean); })());
  };

  if (!filteredRecords || filteredRecords.length === 0) return (<article className="bone-scan-reports-document"><header className="document-header"><h1 className="document-title">Bone Scan Reports</h1></header><SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} /><div className="empty-state">No data available.</div></article>);

  return (
    <article className="bone-scan-reports-document">
      <header className="document-header">
        <h1 className="document-title">Bone Scan Reports</h1>
        <div className="header-actions">
          <button className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`} onClick={copyAllContent}>{copiedId === 'copy-all' ? 'Copied' : 'Copy All'}</button>
          <PDFDownloadLink document={<BoneScanReportsDocumentPDFTemplate document={pdfData} />} fileName="Bone_Scan_Reports.pdf">
            {({ loading }) => <button className="copy-btn">{loading ? 'Preparing...' : 'Export PDF'}</button>}
          </PDFDownloadLink>
        </div>
      </header>
      <SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <div className="record-meta-row">{(record.date || record.createdAt) && <span className="record-date">{highlightText(formatDate(record.date || record.createdAt))}</span>}</div>
              <div className="record-title-row"><h3 className="record-name">{highlightText(`Bone Scan Report ${idx + 1}`)}</h3></div>
            </div>

            {renderMultiFieldSection(record, idx, 'imaging', 'Imaging Parameters', ['radiopharmaceuticalAgent', 'injectedDose', 'uptakeDelay', 'bloodPoolImaging'])}
            {renderMultiFieldSection(record, idx, 'skeletal', 'Skeletal Uptake', ['skeletalUptakePattern', 'superScanPattern'])}
            {renderArraySection(record, idx, 'hotSpots', 'Hot Spots', 'hotSpotLocations')}
            {renderArraySection(record, idx, 'coldSpots', 'Cold Spots', 'coldSpotLocations')}
            {renderMultiFieldSection(record, idx, 'clinical', 'Clinical Assessment', ['metastaticDisease', 'clinicalCorrelation'])}
            {renderArraySection(record, idx, 'fractures', 'Fracture Sites', 'fractureSites')}
            {renderMultiFieldSection(record, idx, 'other', 'Other Findings', ['pageticChanges', 'osteoporosisEvidence', 'osteosarcomaFindings', 'osteomyelitisEvidence'])}
            {renderMultiFieldSection(record, idx, 'additional', 'Additional', ['renalClearance', 'softtissueUptake', 'spinalAlignment'])}

            {/* Follow Up */}
            {record.followUpRecommendations && shouldShowSection(record, 'Follow Up', [record.followUpRecommendations], ['followUpRecommendations']) && renderSection(record, idx, 'followUp', 'Follow Up', renderEditableField(record, 'followUpRecommendations', idx, 'followUp', true))}
          </div>
        ))}
      </div>
    </article>
  );
};

export default BoneScanReportsDocument;
