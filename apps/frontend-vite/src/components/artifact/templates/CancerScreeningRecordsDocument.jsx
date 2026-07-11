/**
 * CancerScreeningRecordsDocument.jsx
 * March 2026 blue glow theme with inline editing.
 * 4-level search, PDFDownloadLink + pdfData memo, secureApiClient.
 * No type conversion — always saves raw text.
 * Collection: cancer_screening_records
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import CancerScreeningRecordsDocumentPDFTemplate from '../pdf-templates/CancerScreeningRecordsDocumentPDFTemplate';
import './CancerScreeningRecordsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'cancer_screening_recordsPendingEdits';
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
  screeningInfo: ['screeningType', 'cancerTypeScreened', 'screeningInterval', 'indicationForScreening', 'imagingModalityUsed'],
  dates: ['screeningDate', 'previousScreeningDate', 'nextRecommendedScreeningDate'],
  riskFactors: ['riskCategory', 'familyHistoryOfCancer'],
  mammography: ['biRadsCategory'],
  colonoscopy: ['colonoscopyFindings', 'polypCount', 'polypHistology', 'cecalIntubation', 'bowelPrepQuality'],
  cervical: ['papSmearResult', 'hpvTestResult'],
  prostate: ['psaLevel'],
  lung: ['ldctLungRadsScore', 'packYearHistory'],
  biopsy: ['biopsyPerformed', 'biopsySite', 'pathologyReportNumber'],
  followUp: ['requiresFollowUp'],
};
const FIELD_LABELS = {
  screeningType: 'Screening Type', cancerTypeScreened: 'Cancer Type Screened',
  screeningInterval: 'Screening Interval', indicationForScreening: 'Indication',
  imagingModalityUsed: 'Imaging Modality', riskCategory: 'Risk Category',
  familyHistoryOfCancer: 'Family History of Cancer', biRadsCategory: 'BI-RADS Category',
  colonoscopyFindings: 'Colonoscopy Findings', polypCount: 'Polyp Count',
  polypHistology: 'Polyp Histology', cecalIntubation: 'Cecal Intubation',
  bowelPrepQuality: 'Bowel Prep Quality', papSmearResult: 'Pap Smear Result',
  hpvTestResult: 'HPV Test Result', psaLevel: 'PSA Level',
  ldctLungRadsScore: 'LDCT Lung-RADS Score', packYearHistory: 'Pack-Year History',
  biopsyPerformed: 'Biopsy Performed', biopsySite: 'Biopsy Site',
  pathologyReportNumber: 'Pathology Report Number', requiresFollowUp: 'Requires Follow-Up',
};
const ARRAY_FIELDS = [];

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };

/* ═══════ FIELD-TYPE EDITORS (value-adaptive; see "fix field types" checklist memory) ═══════
   Per value: boolean → Yes/No, enum → dropdown, positive/negative → dropdown, measurement → number picker, else textarea.
   Dates edit via renderDateField (input type=date). */
const DATE_FIELDS = ['date', 'screeningDate', 'previousScreeningDate', 'nextRecommendedScreeningDate'];
const DATE_LABELS = { date: 'Date', screeningDate: 'Screening Date', previousScreeningDate: 'Previous Screening', nextRecommendedScreeningDate: 'Next Recommended' };
const stepFor = (v) => { const d = String(v ?? '').split('.')[1]; return d ? '0.' + '0'.repeat(Math.max(0, d.length - 1)) + '1' : '1'; };
const MEAS_RE = /^\s*-?\d+(?:\.\d+)?(?:\s*[x×/]\s*-?\d+(?:\.\d+)?)*\s*(?:%|[A-Za-z]{1,4}(?:\/[A-Za-z]{1,4})?)?(?:\s+[A-Za-z]+){0,2}\s*$/;
const isMeasurement = (v) => typeof v === 'number' || (typeof v === 'string' && /\d/.test(v) && MEAS_RE.test(v.trim()));
const parseNumeric = (v) => { if (typeof v === 'number') return { literals: ['', ''], nums: [String(v)] }; const s = String(v ?? ''); const nums = [], literals = []; const re = /-?\d+(?:\.\d+)?/g; let last = 0, m; while ((m = re.exec(s)) !== null) { literals.push(s.slice(last, m.index)); nums.push(m[0]); last = m.index + m[0].length; } if (!nums.length) return null; literals.push(s.slice(last)); return { literals, nums }; };
const POSNEG_RE = /^(positive|negative)$/i;
const isPosNeg = (v) => typeof v === 'string' && POSNEG_RE.test(v.trim());
const posNegOptions = (v) => (String(v).trim() === String(v).trim().toLowerCase() ? ['positive', 'negative'] : ['Positive', 'Negative']);
const ENUM_FIELDS = { screeningInterval: ['annual', 'biennial', 'every 3 years', 'every 5 years', 'one-time'] };
const enumOptionsWith = (opts, current) => { const cur = String(current ?? '').trim(); return cur && !opts.includes(cur) ? [cur, ...opts] : opts; };
const toInputDate = (d) => { if (!d) return ''; try { const dt = new Date(d.$date || d); if (isNaN(dt.getTime())) return ''; return dt.toISOString().split('T')[0]; } catch { return ''; } };

const CancerScreeningRecordsDocument = ({ document: rawDoc }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  const [editNums, setEditNums] = useState([]);   // per-number values while editing a measurement field
  const [editedFields, setEditedFields] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});

  const records = useMemo(() => {
    if (!rawDoc) return [];
    let arr = Array.isArray(rawDoc) ? rawDoc : [rawDoc];
    arr = arr.flatMap(r => {
      if (r?.cancer_screening_records) return Array.isArray(r.cancer_screening_records) ? r.cancer_screening_records : [r.cancer_screening_records];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.cancer_screening_records) return Array.isArray(dd.cancer_screening_records) ? dd.cancer_screening_records : [dd.cancer_screening_records]; return [dd]; }
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
    if (!rid) { console.error('[CancerScreening] Cannot save — no record ID'); return; }
    const value = valueOverride !== undefined ? valueOverride : editValue;
    const ek = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: value }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    // Re-edit after approval → drop the section 'approved' flag so the button goes back to yellow Pending Approve
    setApprovedSections(prev => {
      const sk = `${sid}-${idx}`;
      if (!prev[sk]) return prev;
      const next = { ...prev };
      delete next[sk];
      return next;
    });
    // fieldPart mirrors handleApproveSection's reverse parse: "field" (or "field.arrayIndex" when numeric)
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][fn] = value;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue]);

  // Approve = COMMIT all staged drafts for this section to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, idx, sid) => {
    const rid = getRecordId(record);
    if (!rid) return;
    try {
      const sc = (await import('../../../services/secureApiClient')).default;
      const sf = SECTION_FIELDS[sid] || [];
      const suffix = `-${idx}`;
      // Collect this record's pending edits that belong to this section.
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
        const fieldPart = k.slice(0, -suffix.length); // "field" or "field.arrayIndex"
        const lastDot = fieldPart.lastIndexOf('.');
        const baseField = (lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1)))
          ? fieldPart.slice(0, lastDot) : fieldPart;
        return sf.includes(baseField);
      });
      // Persist each staged field to the DB now (field, + arrayIndex only when the trailing segment is numeric)
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length);
        const lastDot = fieldPart.lastIndexOf('.');
        const isArr = lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1));
        const payload = { field: isArr ? fieldPart.slice(0, lastDot) : fieldPart, value: localEdits[editKey] };
        if (isArr) payload.arrayIndex = parseInt(fieldPart.slice(lastDot + 1), 10);
        await sc.put(`/api/edit/cancer_screening_records/${rid}/edit`, payload);
      }
      // Flag the section approved (audit trail)
      await sc.put(`/api/edit/cancer_screening_records/${rid}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const next = { ...prev }; toCommit.forEach(k => delete next[k]); return next; });
      // Drop this record's committed drafts from localStorage
      const store = readDrafts();
      if (store[rid]) { toCommit.forEach(k => { const fp = k.slice(0, -suffix.length); delete store[rid][fp]; }); if (Object.keys(store[rid]).length === 0) delete store[rid]; writeDrafts(store); }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { sf.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[CancerScreening] Approve failed:', err); }
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
      const title = `Cancer Screening Record ${idx + 1}`;
      const allText = [title, formatDate(record.date), ...Object.keys(FIELD_LABELS).map(f => fmtVal(record[f])), ...Object.values(FIELD_LABELS),
        'Screening Information', 'Risk Factors', 'Mammography', 'Colonoscopy', 'Cervical Screening', 'Prostate Screening', 'Lung Screening', 'Biopsy', 'Follow-Up',
      ].filter(Boolean).join(' ');
      const match = allText.toLowerCase().includes(sl);
      record._showAllSections = match && title.toLowerCase().startsWith(sl);
      return match;
    });
  }, [records, searchTerm]);

  const sectionHasEdits = (idx, sid) => { const fs = SECTION_FIELDS[sid] || []; return fs.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`))); };
  const renderApproveButton = (idx, sid) => { const he = sectionHasEdits(idx, sid); const ia = approvedSections[`${sid}-${idx}`]; if (he) return <button className="approve-btn pending" onClick={(e) => { e.stopPropagation(); handleApproveSection(records[idx], idx, sid); }}>Pending Approve</button>; if (ia) return <span className="approve-btn approved">Approved</span>; return null; };

  /* ═══════ SHARED EDITOR HELPERS (one editor open at a time → single editNums array) ═══════ */
  const startNumEdit = (ek, parsed) => { setEditingField(ek); setEditNums(parsed.nums.slice()); setEditValue(''); };
  const rebuildNumeric = (parsed, sourceVal) => {
    let out = parsed.literals[0] || '';
    editNums.forEach((n, i) => { out += String(n ?? '').trim(); out += parsed.literals[i + 1] || ''; });
    out = out.trim();
    if (typeof sourceVal === 'number' && /^-?\d+(?:\.\d+)?$/.test(out)) return parseFloat(out);
    return out;
  };
  const renderNumberEditor = (parsed, onSave) => (
    <div className="number-edit-row">
      {parsed.literals[0] && parsed.literals[0].trim() ? <span className="number-edit-unit">{parsed.literals[0].trim()}</span> : null}
      {editNums.map((n, i) => (
        <React.Fragment key={i}>
          <input type="number" step={stepFor(n)} className="edit-number" value={n ?? ''} autoFocus={i === 0}
            onChange={e => setEditNums(prev => prev.map((v, j) => (j === i ? e.target.value : v)))}
            onKeyDown={e => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setEditNums([]); } }} disabled={saving} />
          {i < editNums.length - 1 && parsed.literals[i + 1] && parsed.literals[i + 1].trim() ? <span className="number-edit-unit">{parsed.literals[i + 1].trim()}</span> : null}
        </React.Fragment>
      ))}
      {parsed.literals[editNums.length] && parsed.literals[editNums.length].trim() ? <span className="number-edit-unit">{parsed.literals[editNums.length].trim()}</span> : null}
    </div>
  );
  const renderPosNegEditor = (v) => (
    <select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus disabled={saving}>
      {posNegOptions(v).map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );

  /* ═══════ DATE FIELD (editable date picker) ═══════ */
  const renderDateField = (record, fn, idx, sid) => {
    const raw = getFieldValue(record, fn, idx);
    if (!hasVal(raw)) return null;
    const label = FIELD_LABELS[fn] || DATE_LABELS[fn] || fn;
    const dv = formatDate(raw);
    const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`;
    if (ie) return (
      <div className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className="edit-field-container">
          <input type="date" className="edit-date" value={editValue} onChange={e => setEditValue(e.target.value)}
            ref={el => { if (el) { el.focus(); try { el.showPicker(); } catch { /* not supported */ } } }}
            onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} disabled={saving} />
          <div className="edit-actions">
            <button className="save-btn" onClick={() => { if (!editValue || isNaN(new Date(editValue).getTime())) return; handleSaveField(record, fn, idx, sid, editValue + 'T00:00:00.000Z'); }} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
          </div>
        </div>
      </div>
    );
    return (
      <div className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(toInputDate(raw)); }}>
          <div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div>
          <button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(`${label}: ${dv}`, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button>
        </div>
        {ed && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </div>
    );
  };

  const renderEditableField = (record, fn, idx, sid) => {
    const raw = getFieldValue(record, fn, idx);
    if (!hasVal(raw)) return null;
    const dv = fmtVal(raw);
    const isBool = typeof raw === 'boolean';                          // Yes/No dropdown
    const enumOpts = !isBool ? ENUM_FIELDS[fn] : null;                // fixed-choice dropdown (e.g. screeningInterval)
    const isEnum = !!enumOpts;
    const posneg = !isBool && !isEnum && isPosNeg(dv);                // positive/negative dropdown
    const isNum = !isBool && !isEnum && !posneg && isMeasurement(raw); // number picker (polypCount/psaLevel/biRadsCategory...)
    const parsed = isNum ? parseNumeric(raw) : null;
    const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`;
    const startEdit = () => {
      if (isNum) { startNumEdit(ek, parsed); return; }
      setEditingField(ek);
      setEditValue(isBool ? (raw ? 'true' : 'false') : posneg ? dv.trim() : dv);
    };
    const save = () => {
      if (isNum) return handleSaveField(record, fn, idx, sid, rebuildNumeric(parsed, raw));
      if (isBool) return handleSaveField(record, fn, idx, sid, editValue === 'true');
      return handleSaveField(record, fn, idx, sid);   // enum / posneg / text → editValue string
    };
    if (ie) return (
      <div className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>
        <div className="edit-field-container">
          {isBool ? (
            <select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus disabled={saving}>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          ) : isEnum ? (
            <select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus disabled={saving}>
              {enumOptionsWith(enumOpts, dv).map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : posneg ? (
            renderPosNegEditor(dv)
          ) : isNum ? (
            renderNumberEditor(parsed, save)
          ) : (
            <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) save(); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}
              autoFocus rows={1} disabled={saving} />
          )}
          <div className="edit-actions">
            <button className="save-btn" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
          </div>
        </div>
      </div>
    );
    return (
      <div className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>
        <div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={startEdit}>
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
      Object.keys(localEdits).forEach(key => { if (pendingEdits[key]) return; const ld = key.lastIndexOf('-'); if (ld === -1) return; const fn = key.substring(0, ld); const ri = parseInt(key.substring(ld + 1), 10); if (ri === idx && fn in record) m[fn] = localEdits[key]; });
      return m;
    });
  }, [records, localEdits, pendingEdits]);

  const SECTION_TITLES = {
    screeningInfo: 'SCREENING INFORMATION', dates: 'SCREENING DATES', riskFactors: 'RISK FACTORS',
    mammography: 'MAMMOGRAPHY', colonoscopy: 'COLONOSCOPY',
    cervical: 'CERVICAL SCREENING', prostate: 'PROSTATE SCREENING',
    lung: 'LUNG SCREENING', biopsy: 'BIOPSY', followUp: 'FOLLOW-UP',
  };

  const copySectionText = (record, idx, sid) => {
    const pr = pdfData[idx] || record;
    let text = `${SECTION_TITLES[sid] || sid.toUpperCase()}\n`;
    const addF = (fn) => { if (hasVal(pr[fn])) text += `${FIELD_LABELS[fn] || DATE_LABELS[fn] || fn}: ${DATE_FIELDS.includes(fn) ? formatDate(pr[fn]) : fmtVal(pr[fn])}\n`; };
    (SECTION_FIELDS[sid] || []).forEach(addF);
    copyToClipboard(text.trim(), `section-${sid}-${idx}`);
  };

  const copyAllContent = () => {
    let text = '=== CANCER SCREENING RECORDS ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Cancer Screening Record ${idx + 1}\n`;
      if (r.date) text += `${formatDate(r.date)}\n`;
      const addF = (fn) => { if (hasVal(r[fn])) text += `${FIELD_LABELS[fn] || DATE_LABELS[fn] || fn}: ${DATE_FIELDS.includes(fn) ? formatDate(r[fn]) : fmtVal(r[fn])}\n`; };
      Object.entries(SECTION_TITLES).forEach(([sid, title]) => {
        const fields = SECTION_FIELDS[sid] || [];
        const vis = fields.filter(f => hasVal(r[f]));
        if (vis.length) { text += `\n${title}\n`; vis.forEach(addF); }
      });
      text += '\n';
    });
    copyToClipboard(text.trim(), 'copy-all');
  };

  const renderSection = (record, idx, sid, title, children) => {
    if (!children) return null;
    return (<div className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn${copiedId === `section-${sid}-${idx}` ? ' copied' : ''}`} onClick={() => copySectionText(record, idx, sid)}>{copiedId === `section-${sid}-${idx}` ? 'Copied' : 'Copy Section'}</button>{renderApproveButton(idx, sid)}</div></div>{children}</div></div>);
  };

  const renderMultiFieldSection = (record, idx, sid, title, fields) => {
    const visibleFields = fields.filter(f => hasVal(getFieldValue(record, f, idx)));
    if (visibleFields.length === 0) return null;
    if (!shouldShowSection(record, title, visibleFields.map(f => fmtVal(getFieldValue(record, f, idx))), visibleFields)) return null;
    return renderSection(record, idx, sid, title, (() => {
      const stm = sectionTitleMatches(title);
      const sa = !searchTerm.trim() || record._showAllSections || stm;
      return <>{visibleFields.map(f => { if (!sa && !fieldMatches(record, f, idx)) return null; return <React.Fragment key={f}>{renderEditableField(record, f, idx, sid)}</React.Fragment>; })}</>;
    })());
  };

  if (!filteredRecords || filteredRecords.length === 0) return (
    <article className="cancer-screening-document">
      <header className="document-header"><h1 className="document-title">Cancer Screening Records</h1></header>
      <SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />
      <div className="empty-state">No data available.</div>
    </article>
  );

  return (
    <article className="cancer-screening-document">
      <header className="document-header">
        <h1 className="document-title">Cancer Screening Records</h1>
        <div className="header-actions">
          <button className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`} onClick={copyAllContent}>{copiedId === 'copy-all' ? 'Copied' : 'Copy All'}</button>
          <PDFDownloadLink document={<CancerScreeningRecordsDocumentPDFTemplate document={pdfData} />} fileName="Cancer_Screening_Records.pdf">
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
                {record.cancerTypeScreened && <span className="status-badge" style={{ background: 'rgba(96,165,250,0.15)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.4)' }}>{highlightText(record.cancerTypeScreened)}</span>}
                {record.date && <span className="record-date">{highlightText(formatDate(record.date))}</span>}
              </div>
              <div className="record-title-row"><h3 className="record-name">{highlightText(`Cancer Screening Record ${idx + 1}`)}</h3></div>
            </div>

            {renderMultiFieldSection(record, idx, 'screeningInfo', 'Screening Information', SECTION_FIELDS.screeningInfo)}

            {/* Screening Dates — editable date pickers (section-scoped Approve) */}
            {(() => {
              const df = SECTION_FIELDS.dates.filter(f => hasVal(getFieldValue(record, f, idx)));
              if (df.length === 0) return null;
              if (!shouldShowSection(record, 'Screening Dates', df.map(f => formatDate(getFieldValue(record, f, idx))), df)) return null;
              const stm = sectionTitleMatches('Screening Dates');
              const sa = !searchTerm.trim() || record._showAllSections || stm;
              return renderSection(record, idx, 'dates', 'Screening Dates',
                <>{df.map(f => { if (!sa && !fieldMatches(record, f, idx)) return null; return <React.Fragment key={f}>{renderDateField(record, f, idx, 'dates')}</React.Fragment>; })}</>);
            })()}

            {renderMultiFieldSection(record, idx, 'riskFactors', 'Risk Factors', SECTION_FIELDS.riskFactors)}
            {renderMultiFieldSection(record, idx, 'mammography', 'Mammography', SECTION_FIELDS.mammography)}
            {renderMultiFieldSection(record, idx, 'colonoscopy', 'Colonoscopy', SECTION_FIELDS.colonoscopy)}
            {renderMultiFieldSection(record, idx, 'cervical', 'Cervical Screening', SECTION_FIELDS.cervical)}
            {renderMultiFieldSection(record, idx, 'prostate', 'Prostate Screening', SECTION_FIELDS.prostate)}
            {renderMultiFieldSection(record, idx, 'lung', 'Lung Screening', SECTION_FIELDS.lung)}
            {renderMultiFieldSection(record, idx, 'biopsy', 'Biopsy', SECTION_FIELDS.biopsy)}
            {renderMultiFieldSection(record, idx, 'followUp', 'Follow-Up', SECTION_FIELDS.followUp)}
          </div>
        ))}
      </div>
    </article>
  );
};

export default CancerScreeningRecordsDocument;
