/**
 * CardiovascularRiskReductionDocument.jsx
 * March 2026 blue glow theme with inline editing.
 * All flat fields. Collection: cardiovascular_risk_reduction
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import CardiovascularRiskReductionDocumentPDFTemplate from '../pdf-templates/CardiovascularRiskReductionDocumentPDFTemplate';
import './CardiovascularRiskReductionDocument.css';

// value-adaptive edit widgets: numeric values edit with a number picker (decimal-aware step).
const stepFor = (v) => { const d = String(v ?? '').split('.')[1]; return d ? '0.' + '0'.repeat(Math.max(0, d.length - 1)) + '1' : '1'; };
const isNumericVal = (v) => typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && /^-?\d+(?:\.\d+)?$/.test(v.trim()));

const SECTION_FIELDS = {
  bp: ['systolicBloodPressure', 'diastolicBloodPressure'],
  lipids: ['totalCholesterol', 'ldlCholesterol', 'hdlCholesterol', 'triglycerides'],
  metabolic: ['fastingGlucose', 'hemoglobinA1c', 'bodyMassIndex', 'waistCircumference'],
  smoking: ['smokingStatus', 'packYearsHistory'],
  riskScores: ['framinghamRiskScore', 'reynoldsRiskScore', 'pcr10Score'],
  biomarkers: ['cReactiveProtein', 'homocysteineLevel', 'lipoproteinA'],
  imaging: ['ankleBrachialIndex', 'carotidIntimalThickness', 'coronaryCalciumScore'],
  cardiac: ['ejectionFraction', 'nyhaClass', 'estimatedGfr', 'urineAlbuminCreatinineRatio'],
};
const FIELD_LABELS = {
  systolicBloodPressure: 'Systolic BP', diastolicBloodPressure: 'Diastolic BP',
  totalCholesterol: 'Total Cholesterol', ldlCholesterol: 'LDL Cholesterol', hdlCholesterol: 'HDL Cholesterol', triglycerides: 'Triglycerides',
  fastingGlucose: 'Fasting Glucose', hemoglobinA1c: 'HbA1c', bodyMassIndex: 'BMI', waistCircumference: 'Waist Circumference',
  smokingStatus: 'Smoking Status', packYearsHistory: 'Pack-Years',
  framinghamRiskScore: 'Framingham Score', reynoldsRiskScore: 'Reynolds Score', pcr10Score: 'PCR-10 Score',
  cReactiveProtein: 'CRP', homocysteineLevel: 'Homocysteine', lipoproteinA: 'Lipoprotein(a)',
  ankleBrachialIndex: 'ABI', carotidIntimalThickness: 'CIMT', coronaryCalciumScore: 'Calcium Score',
  ejectionFraction: 'Ejection Fraction', nyhaClass: 'NYHA Class', estimatedGfr: 'eGFR', urineAlbuminCreatinineRatio: 'UACR',
};

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = field name; all flat here) */
const DRAFT_KEY = 'cardiovascular_risk_reductionPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

const CardiovascularRiskReductionDocument = ({ document: rawDoc }) => {
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
      if (r?.cardiovascular_risk_reduction) return Array.isArray(r.cardiovascular_risk_reduction) ? r.cardiovascular_risk_reduction : [r.cardiovascular_risk_reduction];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.cardiovascular_risk_reduction) return Array.isArray(dd.cardiovascular_risk_reduction) ? dd.cardiovascular_risk_reduction : [dd.cardiovascular_risk_reduction]; return [dd]; }
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
      const rid = !id ? null : (typeof id === 'string' ? id : (id.$oid ? id.$oid : String(id)));
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
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

  const getFieldValue = useCallback((record, fn, idx) => { const k = `${fn}-${idx}`; if (localEdits[k] !== undefined) return localEdits[k]; return record[fn]; }, [localEdits]);
  const getRecordId = (r) => { const id = r._id; if (!id) return null; if (typeof id === 'string') return id; if (id.$oid) return id.$oid; return String(id); };
  const copyToClipboard = async (text, id) => { try { await navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); } catch {} };

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid, valueOverride) => {
    const rid = getRecordId(record);
    if (!rid) { console.error('[CVRisk] Cannot save — no record ID'); return; }
    const value = valueOverride !== undefined ? valueOverride : editValue;
    const ek = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: value }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    // Re-edit after approval → drop the section 'approved' flag so the button goes back to yellow Pending Approve
    setApprovedSections(prev => {
      const aK = `${sid}-${idx}`;
      if (!prev[aK]) return prev;
      const next = { ...prev };
      delete next[aK];
      return next;
    });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][fn] = value;
    writeDrafts(store);
    setEditingField(null);
    setEditValue('');
  }, [editValue]);

  // Approve = COMMIT all staged drafts for this record's section to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, idx, sid) => {
    try {
      const rid = getRecordId(record); if (!rid) return;
      const sf = SECTION_FIELDS[sid] || [];
      const suffix = `-${idx}`;
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
        const fieldPart = k.slice(0, -suffix.length);
        const lastDot = fieldPart.lastIndexOf('.');
        const baseField = (lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1))) ? fieldPart.slice(0, lastDot) : fieldPart;
        return sf.includes(baseField);
      });
      const sc = (await import('../../../services/secureApiClient')).default;
      // Persist each staged field to the DB now (field, or field+arrayIndex for array elements)
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length);
        const lastDot = fieldPart.lastIndexOf('.');
        const isArr = lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1));
        const payload = { field: isArr ? fieldPart.slice(0, lastDot) : fieldPart, value: localEdits[editKey] };
        if (isArr) payload.arrayIndex = parseInt(fieldPart.slice(lastDot + 1), 10);
        await sc.put(`/api/edit/cardiovascular_risk_reduction/${rid}/edit`, payload);
      }
      await sc.put(`/api/edit/cardiovascular_risk_reduction/${rid}/approve`, { sectionId: sid, approved: true });
      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const next = { ...prev }; toCommit.forEach(k => delete next[k]); return next; });
      // Drop this record's drafts for the committed fields from localStorage (now committed)
      const store = readDrafts();
      if (store[rid]) {
        toCommit.forEach(k => {
          const fieldPart = k.slice(0, -suffix.length);
          const lastDot = fieldPart.lastIndexOf('.');
          const baseField = (lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1))) ? fieldPart.slice(0, lastDot) : fieldPart;
          delete store[rid][baseField];
          delete store[rid][fieldPart];
        });
        if (Object.keys(store[rid]).length === 0) delete store[rid];
        writeDrafts(store);
      }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { sf.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    }
    catch (err) { console.error('[CVRisk] Approve failed:', err); }
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
      const title = `Cardiovascular Risk Reduction ${idx + 1}`;
      const allText = [title, ...Object.keys(FIELD_LABELS).map(f => fmtVal(record[f])), ...Object.values(FIELD_LABELS), 'Blood Pressure', 'Lipid Panel', 'Metabolic', 'Smoking', 'Risk Scores', 'Biomarkers', 'Imaging', 'Cardiac Function'].filter(Boolean).join(' ');
      const match = allText.toLowerCase().includes(sl);
      record._showAllSections = match && title.toLowerCase().startsWith(sl);
      return match;
    });
  }, [records, searchTerm]);

  const sectionHasEdits = (idx, sid) => { const fs = SECTION_FIELDS[sid] || []; return fs.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`))); };
  const renderApproveButton = (idx, sid) => { const he = sectionHasEdits(idx, sid); const ia = approvedSections[`${sid}-${idx}`]; if (he) return <button className="approve-btn pending" onClick={(e) => { e.stopPropagation(); handleApproveSection(records[idx], idx, sid); }}>Pending Approve</button>; if (ia) return <span className="approve-btn approved">Approved</span>; return null; };

  const renderEditableField = (record, fn, idx, sid) => {
    const raw = getFieldValue(record, fn, idx); if (!hasVal(raw)) return null;
    const dv = fmtVal(raw); const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`;
    const isNum = isNumericVal(raw);
    const saveNum = () => { const n = parseFloat(editValue); if (isNaN(n)) return; handleSaveField(record, fn, idx, sid, n); };
    if (ie) return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div><div className="edit-field-container">{isNum ? (<input type="number" step={stepFor(raw)} className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveNum(); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} disabled={saving} />) : (<textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveField(record, fn, idx, sid); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} />)}<div className="edit-actions"><button className="save-btn" onClick={() => (isNum ? saveNum() : handleSaveField(record, fn, idx, sid))} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(dv); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return records;
    return records.map((record, idx) => { const m = { ...record }; Object.keys(localEdits).forEach(key => { if (pendingEdits[key]) return; const ld = key.lastIndexOf('-'); if (ld === -1) return; const fn = key.substring(0, ld); const ri = parseInt(key.substring(ld + 1), 10); if (ri === idx && fn in record) m[fn] = localEdits[key]; }); return m; });
  }, [records, localEdits, pendingEdits]);

  const SECTION_TITLES = { bp: 'BLOOD PRESSURE', lipids: 'LIPID PANEL', metabolic: 'METABOLIC', smoking: 'SMOKING', riskScores: 'RISK SCORES', biomarkers: 'BIOMARKERS', imaging: 'IMAGING', cardiac: 'CARDIAC FUNCTION' };

  const copySectionText = (record, idx, sid) => {
    const pr = pdfData[idx] || record; let text = `${SECTION_TITLES[sid] || sid.toUpperCase()}\n`;
    (SECTION_FIELDS[sid] || []).forEach(f => { if (hasVal(pr[f])) text += `${FIELD_LABELS[f]}: ${fmtVal(pr[f])}\n`; });
    copyToClipboard(text.trim(), `section-${sid}-${idx}`);
  };

  const copyAllContent = () => {
    let text = '=== CARDIOVASCULAR RISK REDUCTION ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Cardiovascular Risk Reduction ${idx + 1}\n`;
      Object.entries(SECTION_TITLES).forEach(([sid, title]) => {
        const fields = SECTION_FIELDS[sid] || []; const vis = fields.filter(f => hasVal(r[f]));
        if (vis.length) { text += `\n${title}\n`; vis.forEach(f => { text += `${FIELD_LABELS[f]}: ${fmtVal(r[f])}\n`; }); }
      });
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

  if (!filteredRecords || filteredRecords.length === 0) return (<article className="cv-risk-document"><header className="document-header"><h1 className="document-title">Cardiovascular Risk Reduction</h1></header><SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} /><div className="empty-state">No data available.</div></article>);

  return (
    <article className="cv-risk-document">
      <header className="document-header">
        <h1 className="document-title">Cardiovascular Risk Reduction</h1>
        <div className="header-actions">
          <button className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`} onClick={copyAllContent}>{copiedId === 'copy-all' ? 'Copied' : 'Copy All'}</button>
          <PDFDownloadLink document={<CardiovascularRiskReductionDocumentPDFTemplate document={pdfData} />} fileName="Cardiovascular_Risk_Reduction.pdf">
            {({ loading }) => <button className="copy-btn">{loading ? 'Preparing...' : 'Export PDF'}</button>}
          </PDFDownloadLink>
        </div>
      </header>
      <SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <div className="record-meta-row"></div>
              <div className="record-title-row"><h3 className="record-name">{highlightText(`Cardiovascular Risk Reduction ${idx + 1}`)}</h3></div>
            </div>
            {renderMultiFieldSection(record, idx, 'bp', 'Blood Pressure', SECTION_FIELDS.bp)}
            {renderMultiFieldSection(record, idx, 'lipids', 'Lipid Panel', SECTION_FIELDS.lipids)}
            {renderMultiFieldSection(record, idx, 'metabolic', 'Metabolic', SECTION_FIELDS.metabolic)}
            {renderMultiFieldSection(record, idx, 'smoking', 'Smoking', SECTION_FIELDS.smoking)}
            {renderMultiFieldSection(record, idx, 'riskScores', 'Risk Scores', SECTION_FIELDS.riskScores)}
            {renderMultiFieldSection(record, idx, 'biomarkers', 'Biomarkers', SECTION_FIELDS.biomarkers)}
            {renderMultiFieldSection(record, idx, 'imaging', 'Imaging', SECTION_FIELDS.imaging)}
            {renderMultiFieldSection(record, idx, 'cardiac', 'Cardiac Function', SECTION_FIELDS.cardiac)}
          </div>
        ))}
      </div>
    </article>
  );
};

export default CardiovascularRiskReductionDocument;
