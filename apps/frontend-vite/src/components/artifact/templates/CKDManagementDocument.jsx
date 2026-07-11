/**
 * CKDManagementDocument.jsx
 * March 2026 blue glow theme with inline editing.
 * 4-level search, PDFDownloadLink + pdfData memo, secureApiClient.
 * No type conversion — always saves raw text.
 * Collection: ckd_management
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import CKDManagementDocumentPDFTemplate from '../pdf-templates/CKDManagementDocumentPDFTemplate';
import './CKDManagementDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'ckd_managementPendingEdits';
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
  kidneyFunction: ['estimatedGFR', 'ckdStage', 'serumCreatinine', 'bloodUreaNitrogen', 'proteinuria', 'albuminCreatinineRatio'],
  labValues: ['hemoglobinLevel', 'calciumLevel', 'phosphorusLevel', 'parathyroidHormone', 'vitamin25OHD'],
  dialysis: ['dialysisModality', 'dialysisAdequacyKtV', 'vascularAccessType', 'transplantEvaluation'],
  medications: ['aceInhibitorUsage', 'phosphateBinderTherapy', 'erythropoietinTherapy'],
  imaging: ['kidneySizeLeft', 'kidneySizeRight', 'kidneyEchotexture'],
  comorbidities: ['comorbidDiabetes', 'comorbidHypertension', 'fluidOverloadStatus'],
};
const FIELD_LABELS = {
  estimatedGFR: 'Estimated GFR', ckdStage: 'CKD Stage', serumCreatinine: 'Serum Creatinine',
  bloodUreaNitrogen: 'Blood Urea Nitrogen', proteinuria: 'Proteinuria', albuminCreatinineRatio: 'Albumin/Creatinine Ratio',
  hemoglobinLevel: 'Hemoglobin Level', calciumLevel: 'Calcium Level', phosphorusLevel: 'Phosphorus Level',
  parathyroidHormone: 'Parathyroid Hormone', vitamin25OHD: 'Vitamin 25-OH-D',
  dialysisModality: 'Dialysis Modality', dialysisAdequacyKtV: 'Dialysis Adequacy (Kt/V)',
  vascularAccessType: 'Vascular Access Type', transplantEvaluation: 'Transplant Evaluation',
  aceInhibitorUsage: 'ACE Inhibitor Usage', phosphateBinderTherapy: 'Phosphate Binder Therapy',
  erythropoietinTherapy: 'Erythropoietin Therapy',
  kidneySizeLeft: 'Kidney Size (Left)', kidneySizeRight: 'Kidney Size (Right)', kidneyEchotexture: 'Kidney Echotexture',
  comorbidDiabetes: 'Comorbid Diabetes', comorbidHypertension: 'Comorbid Hypertension',
  fluidOverloadStatus: 'Fluid Overload Status',
};
const ARRAY_FIELDS = [];
// Numeric lab/measurement fields → −/+ stepper. 0 is an "unmeasured" sentinel here (a serum creatinine
// or kidney size of 0 is not physiological) → hidden via hasFieldVal.
const NUMBER_FIELDS = new Set(['estimatedGFR', 'serumCreatinine', 'bloodUreaNitrogen', 'albuminCreatinineRatio', 'hemoglobinLevel', 'calciumLevel', 'phosphorusLevel', 'parathyroidHormone', 'vitamin25OHD', 'dialysisAdequacyKtV', 'kidneySizeLeft', 'kidneySizeRight']);
const BOOLEAN_FIELDS = new Set(['aceInhibitorUsage', 'phosphateBinderTherapy', 'erythropoietinTherapy', 'comorbidDiabetes', 'comorbidHypertension']);
// Fixed-choice fields → dropdown (unmatched current value kept as an extra option).
const ENUM_FIELDS = { ckdStage: ['1', '2', '3a', '3b', '4', '5'], fluidOverloadStatus: ['Euvolemic', 'Hypervolemic', 'Hypovolemic'] };
const enumOptionsWith = (opts, current) => { const cur = String(current ?? '').trim(); return cur && !opts.some(o => o.toLowerCase() === cur.toLowerCase()) ? [cur, ...opts] : opts; };
const stepFor = (v) => { const d = String(v ?? '').split('.')[1]; return d ? '0.' + '0'.repeat(Math.max(0, d.length - 1)) + '1' : '1'; };
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; };
// Field-aware presence: a numeric lab of 0 (unmeasured sentinel) is treated as absent.
const hasFieldVal = (fn, v) => { if (NUMBER_FIELDS.has(fn) && (v === 0 || v === '0')) return false; return hasVal(v); };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };

const CKDManagementDocument = ({ document: rawDoc }) => {
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
      if (r?.ckd_management) return Array.isArray(r.ckd_management) ? r.ckd_management : [r.ckd_management];
      if (r?.documentData) {
        const dd = r.documentData;
        if (Array.isArray(dd)) return dd;
        if (dd?.ckd_management) return Array.isArray(dd.ckd_management) ? dd.ckd_management : [dd.ckd_management];
        return [dd];
      }
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
  const copyToClipboard = async (text, id) => { try { await navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); } catch {} };

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid, overrideValue) => {
    const rid = getRecordId(record);
    if (!rid) { console.error('[CKDManagement] Cannot save — no record ID'); return; }
    const value = overrideValue !== undefined ? overrideValue : editValue;
    const ek = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: value }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    // Re-edit after approval → drop the section's 'approved' flag so the button goes back to yellow Pending Approve
    setApprovedSections(prev => {
      if (!prev[`${sid}-${idx}`]) return prev;
      const next = { ...prev };
      delete next[`${sid}-${idx}`];
      return next;
    });
    // fieldPart mirrors handleApproveSection's reverse parse: plain field name here (no array fields).
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][fn] = value;
    writeDrafts(store);
    setEditingField(null);
    setEditValue('');
  }, [editValue]);

  // Approve = COMMIT this section's staged drafts to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, idx, sid) => {
    const rid = getRecordId(record);
    if (!rid) return;
    setSaving(true);
    try {
      const sc = (await import('../../../services/secureApiClient')).default;
      const sf = SECTION_FIELDS[sid] || [];
      const suffix = `-${idx}`;
      // Staged edits for THIS section's fields (key = "field-idx" or "field.arrayIndex-idx")
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
        const fieldPart = k.slice(0, -suffix.length);
        const baseField = fieldPart.includes('.') ? fieldPart.slice(0, fieldPart.lastIndexOf('.')) : fieldPart;
        return sf.includes(baseField);
      });
      // Persist each staged field to the DB now (field, or field+arrayIndex for array elements).
      // arrayIndex applies ONLY when the trailing dot-segment is purely numeric (reverses handleSaveField).
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length);
        const lastDot = fieldPart.lastIndexOf('.');
        const tail = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const isArrayIdx = lastDot !== -1 && /^\d+$/.test(tail);
        const payload = { field: isArrayIdx ? fieldPart.slice(0, lastDot) : fieldPart, value: localEdits[editKey] };
        if (isArrayIdx) payload.arrayIndex = parseInt(tail, 10);
        await sc.put(`/api/edit/ckd_management/${rid}/edit`, payload);
      }
      // Flag the section approved (audit trail)
      await sc.put(`/api/edit/ckd_management/${rid}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => {
        const next = { ...prev };
        toCommit.forEach(k => delete next[k]);
        return next;
      });
      // Drop this record's drafts for the committed fields from localStorage
      const store = readDrafts();
      if (store[rid]) {
        toCommit.forEach(k => {
          const fieldPart = k.slice(0, -suffix.length);
          delete store[rid][fieldPart];
        });
        if (Object.keys(store[rid]).length === 0) delete store[rid];
        writeDrafts(store);
      }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => {
        const n = { ...prev };
        Object.keys(n).forEach(k => { sf.forEach(f => { if (k.startsWith(`${f}-${idx}`) || k.startsWith(`${f}.`)) delete n[k]; }); });
        return n;
      });
    } catch (err) { console.error('[CKDManagement] Approve failed:', err); }
    finally { setSaving(false); }
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
      const title = `CKD Management ${idx + 1}`;
      const allFields = Object.keys(FIELD_LABELS);
      const allText = [
        title,
        ...allFields.map(f => fmtVal(record[f])),
        ...Object.values(FIELD_LABELS),
        'Kidney Function', 'Lab Values', 'Dialysis & Transplant', 'Medications', 'Kidney Imaging', 'Comorbidities',
      ].filter(Boolean).join(' ');
      const match = allText.toLowerCase().includes(sl);
      record._showAllSections = match && title.toLowerCase().startsWith(sl);
      return match;
    });
  }, [records, searchTerm]);

  const sectionHasEdits = (idx, sid) => { const fs = SECTION_FIELDS[sid] || []; return fs.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || k.startsWith(`${f}.`))); };
  const renderApproveButton = (record, idx, sid) => { const he = sectionHasEdits(idx, sid); const ia = approvedSections[`${sid}-${idx}`]; if (he) return <button className="approve-btn pending" disabled={saving} onClick={(e) => { e.stopPropagation(); handleApproveSection(record, idx, sid); }}>{saving ? 'Approving...' : 'Pending Approve'}</button>; if (ia) return <span className="approve-btn approved">Approved</span>; return null; };

  const renderEditableField = (record, fn, idx, sid) => {
    const raw = getFieldValue(record, fn, idx);
    if (!hasFieldVal(fn, raw)) return null;
    const dv = fmtVal(raw);
    const ek = `${fn}-${idx}`;
    const ie = editingField === ek;
    const ed = editedFields[ek];
    const cid = `row-${fn}-${idx}`;
    // Widget by value shape: number → −/+ stepper; boolean → Yes/No; fixed-choice → enum <select>; else textarea.
    const isNumber = NUMBER_FIELDS.has(fn);
    const isBoolean = BOOLEAN_FIELDS.has(fn);
    const isEnum = !!ENUM_FIELDS[fn];
    const enumOpts = isEnum ? enumOptionsWith(ENUM_FIELDS[fn], dv) : null;
    const startEditVal = isBoolean ? (raw === true ? 'Yes' : 'No') : isEnum ? (enumOpts.find(o => o.toLowerCase() === dv.toLowerCase()) || dv) : String(raw);
    const st = isNumber ? (parseFloat(stepFor(raw)) || 1) : 1;
    const dec = (String(st).split('.')[1] || '').length;
    const bump = (d) => { const cur = parseFloat(editValue); setEditValue((Math.max(0, (isNaN(cur) ? 0 : cur) + d)).toFixed(dec)); };
    const saveNum = () => { const n = parseFloat(editValue); if (isNaN(n)) return; handleSaveField(record, fn, idx, sid, n); };
    if (ie) return (
      <div className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>
        <div className="edit-field-container">
          {isBoolean ? (
            <select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} disabled={saving}>
              <option value="Yes">Yes</option><option value="No">No</option>
            </select>
          ) : isEnum ? (
            <select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} disabled={saving}>
              {enumOpts.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : isNumber ? (
            <div className="num-stepper-row">
              <button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); bump(-st); }}>−</button>
              <input type="number" step={stepFor(raw)} min="0" className="edit-number" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveNum(); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} disabled={saving} />
              <button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); bump(st); }}>+</button>
            </div>
          ) : (
            <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveField(record, fn, idx, sid); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}
              autoFocus rows={1} disabled={saving} />
          )}
          <div className="edit-actions">
            <button className="save-btn" onClick={() => { if (isNumber) saveNum(); else if (isBoolean) handleSaveField(record, fn, idx, sid, editValue === 'Yes'); else handleSaveField(record, fn, idx, sid); }} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
          </div>
        </div>
      </div>
    );
    return (
      <div className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>
        <div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(startEditVal); }}>
          <div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div>
          <button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button>
        </div>
        {ed && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </div>
    );
  };

  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return records;
    return records.map((record, idx) => {
      const m = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF until approved
        const ld = key.lastIndexOf('-');
        if (ld === -1) return;
        const fn = key.substring(0, ld);
        const ri = parseInt(key.substring(ld + 1), 10);
        if (ri === idx && fn in record) m[fn] = localEdits[key];
      });
      return m;
    });
  }, [records, localEdits, pendingEdits]);

  const SECTION_TITLES = {
    kidneyFunction: 'KIDNEY FUNCTION', labValues: 'LAB VALUES',
    dialysis: 'DIALYSIS & TRANSPLANT', medications: 'MEDICATIONS',
    imaging: 'KIDNEY IMAGING', comorbidities: 'COMORBIDITIES',
  };

  // One field → sub-label + DASH (unless label == section title) + "1. value". Hides 0-sentinel labs.
  const emitField = (r, fn, title) => {
    if (!hasFieldVal(fn, r[fn])) return '';
    const label = FIELD_LABELS[fn] || fn;
    let out = '';
    if (label.toLowerCase() !== (title || '').toLowerCase()) out += `${label}\n${COPY_LINE_DASH}\n`;
    return out + `1. ${fmtVal(r[fn])}\n\n`;
  };

  const copySectionText = (record, idx, sid) => {
    const pr = pdfData[idx] || record;
    const title = SECTION_TITLES[sid] || sid.toUpperCase();
    let text = `${title}\n${COPY_LINE_EQ}\n\n`;
    (SECTION_FIELDS[sid] || []).forEach(fn => { text += emitField(pr, fn, title); });
    copyToClipboard(text.trim(), `section-${sid}-${idx}`);
  };

  const copyAllContent = () => {
    let text = `CKD MANAGEMENT\n${COPY_LINE_EQ}\n\n`;
    pdfData.forEach((r, idx) => {
      text += `CKD Management ${idx + 1}\n${COPY_LINE_EQ}\n`;
      Object.entries(SECTION_TITLES).forEach(([sid, title]) => {
        const vis = (SECTION_FIELDS[sid] || []).filter(f => hasFieldVal(f, r[f]));
        if (!vis.length) return;
        text += `\n${title}\n${COPY_LINE_EQ}\n`;
        vis.forEach(fn => { text += emitField(r, fn, title); });
      });
      text += '\n';
    });
    copyToClipboard(text.trim(), 'copy-all');
  };

  const renderSection = (record, idx, sid, title, children) => {
    if (!children) return null;
    return (
      <div className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(title)}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn${copiedId === `section-${sid}-${idx}` ? ' copied' : ''}`}
                onClick={() => copySectionText(record, idx, sid)}>
                {copiedId === `section-${sid}-${idx}` ? 'Copied' : 'Copy Section'}
              </button>
              {renderApproveButton(record, idx, sid)}
            </div>
          </div>
          {children}
        </div>
      </div>
    );
  };

  const renderMultiFieldSection = (record, idx, sid, title, fields) => {
    const visibleFields = fields.filter(f => hasFieldVal(f, getFieldValue(record, f, idx)));
    if (visibleFields.length === 0) return null;
    if (!shouldShowSection(record, title, visibleFields.map(f => fmtVal(getFieldValue(record, f, idx))), visibleFields)) return null;
    return renderSection(record, idx, sid, title, (() => {
      const stm = sectionTitleMatches(title);
      const sa = !searchTerm.trim() || record._showAllSections || stm;
      return <>{visibleFields.map(f => {
        if (!sa && !fieldMatches(record, f, idx)) return null;
        return <React.Fragment key={f}>{renderEditableField(record, f, idx, sid)}</React.Fragment>;
      })}</>;
    })());
  };

  const getStageColor = (stage) => { if (!stage) return '#10b981'; const s = String(stage).toLowerCase(); if (s.includes('5') || s.includes('4')) return '#ef4444'; if (s.includes('3')) return '#f59e0b'; return '#10b981'; };

  if (!filteredRecords || filteredRecords.length === 0) return (
    <article className="ckd-management-document">
      <header className="document-header"><h1 className="document-title">CKD Management</h1></header>
      <SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />
      <div className="empty-state">No data available.</div>
    </article>
  );

  return (
    <article className="ckd-management-document">
      <header className="document-header">
        <h1 className="document-title">CKD Management</h1>
        <div className="header-actions">
          <button className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`} onClick={copyAllContent}>{copiedId === 'copy-all' ? 'Copied' : 'Copy All'}</button>
          <PDFDownloadLink document={<CKDManagementDocumentPDFTemplate document={pdfData} />} fileName="CKD_Management.pdf">
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
                {record.ckdStage && <span className="stage-badge" style={{ background: `${getStageColor(record.ckdStage)}22`, color: getStageColor(record.ckdStage), border: `1px solid ${getStageColor(record.ckdStage)}66` }}>{highlightText(`Stage ${record.ckdStage}`)}</span>}
              </div>
              <div className="record-title-row"><h3 className="record-name">{highlightText(`CKD Management ${idx + 1}`)}</h3></div>
            </div>

            {renderMultiFieldSection(record, idx, 'kidneyFunction', 'Kidney Function', SECTION_FIELDS.kidneyFunction)}
            {renderMultiFieldSection(record, idx, 'labValues', 'Lab Values', SECTION_FIELDS.labValues)}
            {renderMultiFieldSection(record, idx, 'dialysis', 'Dialysis & Transplant', SECTION_FIELDS.dialysis)}
            {renderMultiFieldSection(record, idx, 'medications', 'Medications', SECTION_FIELDS.medications)}
            {renderMultiFieldSection(record, idx, 'imaging', 'Kidney Imaging', SECTION_FIELDS.imaging)}
            {renderMultiFieldSection(record, idx, 'comorbidities', 'Comorbidities', SECTION_FIELDS.comorbidities)}
          </div>
        ))}
      </div>
    </article>
  );
};

export default CKDManagementDocument;
