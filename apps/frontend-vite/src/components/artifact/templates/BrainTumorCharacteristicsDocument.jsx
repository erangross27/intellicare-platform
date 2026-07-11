/**
 * BrainTumorCharacteristicsDocument.jsx
 * Inline editing with per-section approve, per-row copy.
 * 4-level search, PDFDownloadLink + pdfData memo, secureApiClient.
 * No type conversion — always saves raw text.
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import BrainTumorCharacteristicsDocumentPDFTemplate from '../pdf-templates/BrainTumorCharacteristicsDocumentPDFTemplate';
import './BrainTumorCharacteristicsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } } */
const DRAFT_KEY = 'brain_tumor_characteristicsPendingEdits';
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
  tumorInfo: ['tumorHistology', 'whoGrade', 'tumorLocation', 'tumorSize'],
  imaging: ['enhancementPattern', 'perilesionalEdema', 'midlineShift', 'perfusionMetrics', 'diffusionRestriction'],
  clinical: ['karnofskyPerformanceScore', 'glasgowComaScale'],
  molecular: ['idh1Mutation', 'mgmtPromoterMethylation', 'p53Expression', 'ki67Index', 'chromosomeCodeletion'],
  surgical: ['resectionExtent', 'eloquentCortexInvolvement', 'vascularInvolvement'],
  advanced: ['bloodBrainBarrierDisruption', 'cerebrospinalFluidSeeding'],
};
const FIELD_LABELS = { tumorHistology: 'Tumor Histology', whoGrade: 'WHO Grade', tumorLocation: 'Tumor Location', tumorSize: 'Tumor Size', enhancementPattern: 'Enhancement Pattern', perilesionalEdema: 'Perilesional Edema', midlineShift: 'Midline Shift', perfusionMetrics: 'Perfusion Metrics', diffusionRestriction: 'Diffusion Restriction', karnofskyPerformanceScore: 'Karnofsky Performance Score', glasgowComaScale: 'Glasgow Coma Scale', idh1Mutation: 'IDH1 Mutation', mgmtPromoterMethylation: 'MGMT Promoter Methylation', p53Expression: 'p53 Expression', ki67Index: 'Ki-67 Index', chromosomeCodeletion: 'Chromosome Co-deletion', resectionExtent: 'Resection Extent', eloquentCortexInvolvement: 'Eloquent Cortex Involvement', vascularInvolvement: 'Vascular Involvement', bloodBrainBarrierDisruption: 'Blood-Brain Barrier Disruption', cerebrospinalFluidSeeding: 'Cerebrospinal Fluid Seeding' };

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };

/* Edit-control field typing (chosen by the STORED JS type, verified via get_patient_data):
   - BOOLEAN_FIELDS → Yes/No <select>, saved as a real boolean.
   - NUMBER_FIELDS  → bare numbers (unit lives in the label or none) → <input type=number>, saved as a real Number.
   - UNIT_NUMBER_FIELDS → value is a STRING that contains its unit ("42%") → number stepper + fixed unit affix,
     reassembled losslessly to the same string. Everything else stays a textarea. */
const BOOLEAN_FIELDS = ['perilesionalEdema', 'diffusionRestriction', 'eloquentCortexInvolvement', 'bloodBrainBarrierDisruption', 'cerebrospinalFluidSeeding'];
const NUMBER_FIELDS = ['whoGrade', 'karnofskyPerformanceScore', 'glasgowComaScale'];
const UNIT_NUMBER_FIELDS = ['ki67Index'];
const stepFor = (v) => { const d = (String(v).split('.')[1] || '').length; return d > 0 ? '0.' + '0'.repeat(d - 1) + '1' : '1'; };
// String-with-unit splitter (e.g. "42%"): edit only the number, keep prefix/unit as fixed affixes. Returns null
// (→ textarea) for non-numeric, ranges, or units that contain a digit (compound values like "4.2 × 3.8 cm").
const splitNumberUnit = (raw) => {
  if (raw == null) return null;
  const s = String(raw).trim();
  const m = s.match(/^([<>≤≥=~]*)\s*(-?\d+(?:\.\d+)?)(\s*)(\S[\s\S]*)?$/);
  if (!m) return null;
  const unit = (m[4] || '').trim();
  if (/^[-–—]\s*\d/.test(unit)) return null;   // range -> textarea
  if (/\d/.test(unit)) return null;            // digit-in-unit (compound) -> textarea
  return { prefix: m[1] || '', number: m[2], sep: m[3] || '', unit, step: stepFor(m[2]) };
};

const BrainTumorCharacteristicsDocument = ({ document: rawDoc }) => {
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
    arr = arr.flatMap(r => { if (r?.brain_tumor_characteristics) return Array.isArray(r.brain_tumor_characteristics) ? r.brain_tumor_characteristics : [r.brain_tumor_characteristics]; if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.brain_tumor_characteristics) return Array.isArray(dd.brain_tumor_characteristics) ? dd.brain_tumor_characteristics : [dd.brain_tumor_characteristics]; return [dd]; } return r; });
    return arr.filter(r => r && typeof r === 'object');
  }, [rawDoc]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const id = record && record._id;
      const rid = id ? (typeof id === 'string' ? id : (id.$oid || String(id))) : null;
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

  const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
  const getFieldValue = useCallback((record, fn, idx) => { const k = `${fn}-${idx}`; if (localEdits[k] !== undefined) return localEdits[k]; return record[fn]; }, [localEdits]);
  const getRecordId = (r) => { const id = r._id; if (!id) return null; if (typeof id === 'string') return id; if (id.$oid) return id.$oid; return String(id); };
  const copyToClipboard = async (text, id) => { try { await navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); } catch {} };

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid, valueOverride) => {
    const rid = getRecordId(record);
    if (!rid) { console.error('[BrainTumorCharacteristics] Cannot save — no record ID'); return; }
    const value = valueOverride !== undefined ? valueOverride : editValue;
    const ek = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: value }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    // Re-edit after approval → drop the section's 'approved' flag so the button goes back to yellow Pending Approve
    setApprovedSections(prev => {
      const key = `${sid}-${idx}`;
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][fn] = value;
    writeDrafts(store);
    setEditingField(null);
    setEditValue('');
  }, [editValue]);

  // Approve = COMMIT all staged drafts for this section's fields to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, idx, sid) => {
    try {
      const rid = getRecordId(record); if (!rid) return;
      const sc = (await import('../../../services/secureApiClient')).default;
      const sf = SECTION_FIELDS[sid] || [];
      // Collect this section's staged (pending) edits from localEdits using the "-<idx>" suffix convention.
      const suffix = `-${idx}`;
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
        const fieldPart = k.slice(0, -suffix.length); // "field" or "field.arrayIndex"
        const baseField = fieldPart.includes('.') ? fieldPart.split('.')[0] : fieldPart;
        return sf.includes(baseField);
      });
      // Persist each staged field to the DB now. arrayIndex ONLY when the trailing dot-segment is purely numeric.
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length);
        const lastDot = fieldPart.lastIndexOf('.');
        const tail = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const payload = { value: localEdits[editKey] };
        if (lastDot !== -1 && /^\d+$/.test(tail)) {
          payload.field = fieldPart.slice(0, lastDot);
          payload.arrayIndex = parseInt(tail, 10);
        } else {
          payload.field = fieldPart;
        }
        const resp = await sc.put(`/api/edit/brain_tumor_characteristics/${rid}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      // Flag the section approved (audit trail)
      await sc.put(`/api/edit/brain_tumor_characteristics/${rid}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const next = { ...prev }; toCommit.forEach(k => delete next[k]); return next; });
      // Drop this record's drafts for the committed fields from localStorage
      const store = readDrafts();
      if (store[rid]) { toCommit.forEach(k => { const fieldPart = k.slice(0, -suffix.length); delete store[rid][fieldPart]; }); if (Object.keys(store[rid]).length === 0) delete store[rid]; writeDrafts(store); }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { sf.forEach(f => { if (k.startsWith(`${f}-${idx}`) || k.startsWith(`${f}.`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[BrainTumorCharacteristics] Approve failed:', err); }
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
      const title = `Brain Tumor ${idx + 1}`;
      const allText = [title, formatDate(record.date || record.createdAt), ...Object.keys(FIELD_LABELS).map(f => fmtVal(record[f])), ...Object.values(FIELD_LABELS), 'Tumor Information', 'Imaging', 'Clinical Scores', 'Molecular Markers', 'Surgical Planning', 'Advanced'].filter(Boolean).join(' ');
      const match = allText.toLowerCase().includes(sl);
      record._showAllSections = match && title.toLowerCase().startsWith(sl);
      return match;
    });
  }, [records, searchTerm]);

  const sectionHasEdits = (idx, sid) => { const fs = SECTION_FIELDS[sid] || []; return fs.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || k.startsWith(`${f}.`))); };
  const renderApproveButton = (idx, sid) => { const he = sectionHasEdits(idx, sid); const ia = approvedSections[`${sid}-${idx}`]; if (he) return <button className="approve-btn pending" onClick={(e) => { e.stopPropagation(); handleApproveSection(records[idx], idx, sid); }}>Pending Approve</button>; if (ia) return <span className="approve-btn approved">Approved</span>; return null; };

  const renderEditableField = (record, fn, idx, sid) => {
    const raw = getFieldValue(record, fn, idx); if (!hasVal(raw)) return null;
    const dv = fmtVal(raw);
    const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`;
    const isBool = BOOLEAN_FIELDS.includes(fn);
    const isNum = NUMBER_FIELDS.includes(fn);
    const nu = (!isBool && !isNum && UNIT_NUMBER_FIELDS.includes(fn)) ? splitNumberUnit(dv) : null;
    const cancel = () => { setEditingField(null); setEditValue(''); };
    const saveBool = () => handleSaveField(record, fn, idx, sid, editValue === 'Yes');
    const saveNum = () => { const n = parseFloat(editValue); if (editValue === '' || isNaN(n)) return; handleSaveField(record, fn, idx, sid, n); };
    const saveUnit = () => { const n = parseFloat(editValue); if (editValue === '' || isNaN(n)) return; handleSaveField(record, fn, idx, sid, `${nu.prefix}${editValue}${nu.sep}${nu.unit}`); };
    const onSave = isBool ? saveBool : isNum ? saveNum : nu ? saveUnit : () => handleSaveField(record, fn, idx, sid);
    const seed = isBool ? dv : nu ? nu.number : isNum ? String(raw) : dv;
    if (ie) {
      let control;
      if (isBool) control = (<select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') cancel(); }} disabled={saving}><option value="Yes">Yes</option><option value="No">No</option></select>);
      else if (isNum) control = (<input type="number" className="edit-number" step={stepFor(dv)} value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveNum(); if (e.key === 'Escape') cancel(); }} disabled={saving} />);
      else if (nu) control = (<div className="num-unit-edit">{nu.prefix && <span className="nu-affix">{nu.prefix}</span>}<input type="number" className="edit-number" step={nu.step} value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveUnit(); if (e.key === 'Escape') cancel(); }} disabled={saving} />{nu.unit && <span className="nu-affix">{nu.unit}</span>}</div>);
      else control = (<textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveField(record, fn, idx, sid); if (e.key === 'Escape') cancel(); }} autoFocus rows={fn === 'resectionExtent' ? 4 : 1} disabled={saving} />);
      return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div><div className="edit-field-container">{control}<div className="edit-actions"><button className="save-btn" onClick={onSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={cancel}>Cancel</button></div></div></div>);
    }
    return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(seed); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return records;
    return records.map((record, idx) => { const m = { ...record }; Object.keys(localEdits).forEach(key => { if (pendingEdits[key]) return; const ld = key.lastIndexOf('-'); if (ld === -1) return; const fn = key.substring(0, ld); const ri = parseInt(key.substring(ld + 1), 10); if (ri === idx && fn in record) m[fn] = localEdits[key]; }); return m; });
  }, [records, localEdits, pendingEdits]);

  const SECTION_TITLES = { tumorInfo: 'TUMOR INFORMATION', imaging: 'IMAGING', clinical: 'CLINICAL SCORES', molecular: 'MOLECULAR MARKERS', surgical: 'SURGICAL PLANNING', advanced: 'ADVANCED' };

  const copySectionText = (record, idx, sid) => {
    const pr = pdfData[idx] || record; let text = `${SECTION_TITLES[sid] || sid.toUpperCase()}\n`;
    const addF = (fn) => { if (hasVal(pr[fn])) text += `${FIELD_LABELS[fn] || fn}: ${fmtVal(pr[fn])}\n`; };
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(addF);
    copyToClipboard(text.trim(), `section-${sid}-${idx}`);
  };

  const copyAllContent = () => {
    let text = '=== BRAIN TUMOR CHARACTERISTICS ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Brain Tumor ${idx + 1}\n`;
      if (r.date || r.createdAt) text += `${formatDate(r.date || r.createdAt)}\n`;
      const addF = (fn) => { if (hasVal(r[fn])) text += `${FIELD_LABELS[fn] || fn}: ${fmtVal(r[fn])}\n`; };
      Object.entries(SECTION_TITLES).forEach(([sid, title]) => {
        const fields = SECTION_FIELDS[sid] || [];
        const vis = fields.filter(f => hasVal(r[f]));
        if (vis.length) { text += `\n${title}\n`; vis.forEach(addF); }
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

  if (!filteredRecords || filteredRecords.length === 0) return (<article className="brain-tumor-characteristics-document"><header className="document-header"><h1 className="document-title">Brain Tumor Characteristics</h1></header><SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} /><div className="empty-state">No data available.</div></article>);

  return (
    <article className="brain-tumor-characteristics-document">
      <header className="document-header">
        <h1 className="document-title">Brain Tumor Characteristics</h1>
        <div className="header-actions">
          <button className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`} onClick={copyAllContent}>{copiedId === 'copy-all' ? 'Copied' : 'Copy All'}</button>
          <PDFDownloadLink document={<BrainTumorCharacteristicsDocumentPDFTemplate document={pdfData} />} fileName="Brain_Tumor_Characteristics.pdf">
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
              <div className="record-title-row"><h3 className="record-name">{highlightText(`Brain Tumor ${idx + 1}`)}</h3></div>
            </div>

            {renderMultiFieldSection(record, idx, 'tumorInfo', 'Tumor Information', ['tumorHistology', 'whoGrade', 'tumorLocation', 'tumorSize'])}
            {renderMultiFieldSection(record, idx, 'imaging', 'Imaging', ['enhancementPattern', 'perilesionalEdema', 'midlineShift', 'perfusionMetrics', 'diffusionRestriction'])}
            {renderMultiFieldSection(record, idx, 'clinical', 'Clinical Scores', ['karnofskyPerformanceScore', 'glasgowComaScale'])}
            {renderMultiFieldSection(record, idx, 'molecular', 'Molecular Markers', ['idh1Mutation', 'mgmtPromoterMethylation', 'p53Expression', 'ki67Index', 'chromosomeCodeletion'])}
            {renderMultiFieldSection(record, idx, 'surgical', 'Surgical Planning', ['resectionExtent', 'eloquentCortexInvolvement', 'vascularInvolvement'])}
            {renderMultiFieldSection(record, idx, 'advanced', 'Advanced', ['bloodBrainBarrierDisruption', 'cerebrospinalFluidSeeding'])}
          </div>
        ))}
      </div>
    </article>
  );
};

export default BrainTumorCharacteristicsDocument;
