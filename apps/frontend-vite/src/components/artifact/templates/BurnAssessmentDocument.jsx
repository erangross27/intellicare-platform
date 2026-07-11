/**
 * BurnAssessmentDocument.jsx
 * Inline editing with per-section approve, per-row copy.
 * 4-level search, PDFDownloadLink + pdfData memo, secureApiClient.
 * No type conversion — always saves raw text.
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import BurnAssessmentDocumentPDFTemplate from '../pdf-templates/BurnAssessmentDocumentPDFTemplate';
import './BurnAssessmentDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field-arrayIndex") */
const DRAFT_KEY = 'burn_assessmentPendingEdits';
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
  burnInfo: ['burnEtiology', 'burnDepthClassification', 'tbsaPercentage'],
  locations: ['anatomicalLocationsBurned'],
  inhalation: ['inhalationInjuryPresent', 'carboxyhemoglobinLevel'],
  fluid: ['parklandFormulaCalculation', 'fluidResuscitationRate', 'urineOutputTarget'],
  escharotomy: ['escharotomyRequired', 'escharotomySites'],
  severity: ['bauxScore', 'absiScore'],
  referral: ['burnCenterReferralCriteria'],
  woundCare: ['woundDressingType', 'woundCultureResults', 'graftingRequired', 'graftDonorSite'],
  clinical: ['tetanusProphylaxisStatus', 'caloricRequirementCalculation', 'prealbuminLevel'],
  risk: ['contractureRiskAreas'],
  etiology: ['electricalBurnVoltage', 'chemicalAgentInvolved'],
};
const FIELD_LABELS = { burnEtiology: 'Burn Etiology', burnDepthClassification: 'Burn Depth', tbsaPercentage: 'TBSA %', inhalationInjuryPresent: 'Inhalation Injury', carboxyhemoglobinLevel: 'Carboxyhemoglobin Level', parklandFormulaCalculation: 'Parkland Formula (mL)', fluidResuscitationRate: 'Fluid Rate (mL/hr)', urineOutputTarget: 'Urine Output Target (mL/kg/hr)', escharotomyRequired: 'Escharotomy Required', woundDressingType: 'Wound Dressing', graftingRequired: 'Grafting Required', graftDonorSite: 'Graft Donor Site', tetanusProphylaxisStatus: 'Tetanus Prophylaxis', caloricRequirementCalculation: 'Caloric Requirement', prealbuminLevel: 'Prealbumin Level', bauxScore: 'Baux Score', absiScore: 'ABSI Score', electricalBurnVoltage: 'Electrical Burn Voltage', chemicalAgentInvolved: 'Chemical Agent' };
const ARRAY_FIELDS = ['anatomicalLocationsBurned', 'escharotomySites', 'burnCenterReferralCriteria', 'woundCultureResults', 'contractureRiskAreas'];
const NUMBER_FIELDS = ['tbsaPercentage', 'carboxyhemoglobinLevel', 'parklandFormulaCalculation', 'fluidResuscitationRate', 'urineOutputTarget', 'bauxScore', 'absiScore', 'prealbuminLevel', 'caloricRequirementCalculation'];
const BOOLEAN_FIELDS = ['inhalationInjuryPresent', 'escharotomyRequired', 'graftingRequired'];
// Fields where a numeric 0 is a sentinel ("not calculated / not measured") and should be hidden.
const HIDE_ZERO_FIELDS = ['fluidResuscitationRate', 'bauxScore', 'absiScore', 'prealbuminLevel', 'caloricRequirementCalculation'];

const hasVal = (v, fn) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') { if (v === 0 && fn && HIDE_ZERO_FIELDS.includes(fn)) return false; return true; } if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
// Spinner step matches the value's decimal precision: 12.4 -> 0.1, 12.45 -> 0.01, integers -> 1
const stepFor = (v) => { const d = String(v ?? '').split('.')[1]; return d ? '0.' + '0'.repeat(d.length - 1) + '1' : '1'; };
// Plain-text rule drawn above and below each title in Copy Section / Copy All.
const RULE = '='.repeat(44);

const BurnAssessmentDocument = ({ document: rawDoc }) => {
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
    arr = arr.flatMap(r => { if (r?.burn_assessment) return Array.isArray(r.burn_assessment) ? r.burn_assessment : [r.burn_assessment]; if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.burn_assessment) return Array.isArray(dd.burn_assessment) ? dd.burn_assessment : [dd.burn_assessment]; return [dd]; } return r; });
    return arr.filter(r => r && typeof r === 'object');
  }, [rawDoc]);

  const getRecordIdStatic = (r) => { const id = r && r._id; if (!id) return null; if (typeof id === 'string') return id; if (id.$oid) return id.$oid; return String(id); };

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  // fieldPart shape: "field" (simple) or "field#arrayIndex" (array element).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const rid = getRecordIdStatic(record);
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const hashIdx = fieldPart.indexOf('#');
        const editKey = hashIdx === -1
          ? `${fieldPart}-${idx}`
          : `${fieldPart.slice(0, hashIdx)}-${idx}-${fieldPart.slice(hashIdx + 1)}`;
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

  // includePending=true → used by the editable JSX rows; false (default) → committed-only for PDF/Copy.
  const getEffectiveArray = useCallback((record, fieldName, idx, includePending = false) => {
    const original = Array.isArray(record[fieldName]) ? [...record[fieldName]] : [];
    original.forEach((_, ai) => { const ek = `${fieldName}-${idx}-${ai}`; if (localEdits[ek] !== undefined && (includePending || !pendingEdits[ek])) original[ai] = localEdits[ek]; });
    return original;
  }, [localEdits, pendingEdits]);

  const coerceValue = (fn, val) => {
    if (BOOLEAN_FIELDS.includes(fn)) return val === 'Yes' || val === true;
    if (NUMBER_FIELDS.includes(fn)) { const n = parseFloat(val); return isNaN(n) ? val : n; }
    return val;
  };

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid) => {
    const rid = getRecordId(record); if (!rid) { console.error('[BurnAssessment] Cannot save — no record ID'); return; }
    const typed = coerceValue(fn, editValue);
    const ek = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: typed }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    // Re-edit after approval → drop the section 'approved' flag so the button goes back to yellow Pending
    setApprovedSections(prev => { const key = `${sid}-${idx}`; if (!prev[key]) return prev; const n = { ...prev }; delete n[key]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][fn] = typed;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue]);

  const handleSaveArrayItem = useCallback((record, fn, idx, sid, arrayIndex) => {
    const rid = getRecordId(record); if (!rid) { console.error('[BurnAssessment] Cannot save — no record ID'); return; }
    const ek = `${fn}-${idx}-${arrayIndex}`;
    setLocalEdits(prev => ({ ...prev, [ek]: editValue }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    setApprovedSections(prev => { const key = `${sid}-${idx}`; if (!prev[key]) return prev; const n = { ...prev }; delete n[key]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][`${fn}#${arrayIndex}`] = editValue;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue]);

  // Approve = COMMIT all staged drafts for this record's section to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, idx, sid) => {
    const rid = getRecordId(record); if (!rid) return;
    try {
      const sc = (await import('../../../services/secureApiClient')).default;
      const sf = SECTION_FIELDS[sid] || [];
      // Collect this record's pending edits that belong to this section.
      // editKey is "field-idx" (simple) or "field-idx-arrayIndex" (array element).
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k]) return false;
        return sf.some(f => k === `${f}-${idx}` || k.startsWith(`${f}-${idx}-`));
      });
      for (const ek of toCommit) {
        // Reverse the editKey: try "field-idx-arrayIndex" first, else "field-idx".
        let field = null, arrayIndex;
        for (const f of sf) {
          if (ek === `${f}-${idx}`) { field = f; break; }
          if (ek.startsWith(`${f}-${idx}-`)) {
            const tail = ek.slice(`${f}-${idx}-`.length);
            if (/^\d+$/.test(tail)) { field = f; arrayIndex = parseInt(tail, 10); break; }
          }
        }
        if (!field) continue;
        const payload = { field, value: localEdits[ek] };
        if (typeof arrayIndex === 'number') payload.arrayIndex = arrayIndex;
        await sc.put(`/api/edit/burn_assessment/${rid}/edit`, payload);
      }
      await sc.put(`/api/edit/burn_assessment/${rid}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's committed section drafts from localStorage
      const store = readDrafts();
      if (store[rid]) {
        sf.forEach(f => { delete store[rid][f]; Object.keys(store[rid]).forEach(p => { if (p.startsWith(`${f}#`)) delete store[rid][p]; }); });
        if (Object.keys(store[rid]).length === 0) delete store[rid];
        writeDrafts(store);
      }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { sf.forEach(f => { if (k.startsWith(`${f}-${idx}`) || k.startsWith(`${f}.`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[BurnAssessment] Approve failed:', err); }
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
      const title = `Burn Assessment ${idx + 1}`;
      const allText = [title, formatDate(record.burnDate || record.date), record.burnEtiology, record.burnDepthClassification, fmtVal(record.tbsaPercentage), ...(Array.isArray(record.anatomicalLocationsBurned) ? record.anatomicalLocationsBurned : []), ...(Array.isArray(record.burnCenterReferralCriteria) ? record.burnCenterReferralCriteria : []), record.woundDressingType, record.graftDonorSite, record.tetanusProphylaxisStatus, record.electricalBurnVoltage, record.chemicalAgentInvolved, ...Object.values(FIELD_LABELS), 'Burn Information', 'Anatomical Locations', 'Inhalation Injury', 'Fluid Resuscitation', 'Escharotomy', 'Severity Scoring', 'Referral Criteria', 'Wound Care', 'Clinical', 'Contracture Risk', 'Etiology Details'].filter(Boolean).join(' ');
      const match = allText.toLowerCase().includes(sl);
      record._showAllSections = match && title.toLowerCase().startsWith(sl);
      return match;
    });
  }, [records, searchTerm]);

  const sectionHasEdits = (idx, sid) => { const fs = SECTION_FIELDS[sid] || []; return fs.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || k.startsWith(`${f}.`))); };
  const renderApproveButton = (idx, sid) => { const he = sectionHasEdits(idx, sid); const ia = approvedSections[`${sid}-${idx}`]; if (he) return <button className="approve-btn pending" onClick={(e) => { e.stopPropagation(); handleApproveSection(records[idx], idx, sid); }}>Pending Approve</button>; if (ia) return <span className="approve-btn approved">Approved</span>; return null; };

  const renderEditableField = (record, fn, idx, sid) => {
    const raw = getFieldValue(record, fn, idx); if (!hasVal(raw, fn)) return null;
    const dv = fmtVal(raw);
    const isNumber = NUMBER_FIELDS.includes(fn); const isBoolean = BOOLEAN_FIELDS.includes(fn);
    const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`;
    if (ie) {
      let editor;
      if (isBoolean) {
        editor = (<select className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus disabled={saving}><option value="Yes">Yes</option><option value="No">No</option></select>);
      } else if (isNumber) {
        editor = (<input type="number" step={stepFor(editValue)} className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSaveField(record, fn, idx, sid); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus disabled={saving} />);
      } else {
        editor = (<textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveField(record, fn, idx, sid); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={fn === 'woundDressingType' || fn === 'graftDonorSite' ? 3 : 1} disabled={saving} />);
      }
      return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div><div className="edit-field-container">{editor}<div className="edit-actions"><button className="save-btn" onClick={() => handleSaveField(record, fn, idx, sid)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    }
    return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(dv); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
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
      // Merge array element edits, but skip pending (un-approved) drafts so they stay out of the PDF/Copy All.
      ARRAY_FIELDS.forEach(field => {
        const arr = Array.isArray(record[field]) ? [...record[field]] : [];
        arr.forEach((_, ai) => { const ek = `${field}-${idx}-${ai}`; if (localEdits[ek] !== undefined && !pendingEdits[ek]) arr[ai] = localEdits[ek]; });
        m[field] = arr;
      });
      return m;
    });
  }, [records, localEdits, pendingEdits]);

  // Titles match the on-screen JSX section headings (Title Case), so Copy mirrors the JSX exactly.
  const SECTION_TITLES = { burnInfo: 'Burn Information', locations: 'Anatomical Locations', inhalation: 'Inhalation Injury', fluid: 'Fluid Resuscitation', escharotomy: 'Escharotomy', severity: 'Severity Scoring', referral: 'Referral Criteria', woundCare: 'Wound Care', clinical: 'Clinical', risk: 'Contracture Risk', etiology: 'Etiology Details' };

  const copySectionText = (record, idx, sid) => {
    const pr = pdfData[idx] || record; let text = `${RULE}\n${SECTION_TITLES[sid] || sid}\n${RULE}\n`;
    // Mirror the JSX: label on its own line, value on the next line (NOT "label: value").
    const addF = (fn) => { if (hasVal(pr[fn], fn)) text += `\n${FIELD_LABELS[fn] || fn}\n${fmtVal(pr[fn])}\n`; };
    // Array items render as plain values in the JSX (no numbering).
    const addArr = (fn) => { getEffectiveArray(pr, fn, idx).forEach((item) => { text += `\n${item}\n`; }); };
    if (sid === 'burnInfo') { ['burnEtiology', 'burnDepthClassification', 'tbsaPercentage'].forEach(addF); }
    else if (sid === 'locations') { addArr('anatomicalLocationsBurned'); }
    else if (sid === 'inhalation') { ['inhalationInjuryPresent', 'carboxyhemoglobinLevel'].forEach(addF); }
    else if (sid === 'fluid') { ['parklandFormulaCalculation', 'fluidResuscitationRate', 'urineOutputTarget'].forEach(addF); }
    else if (sid === 'escharotomy') { addF('escharotomyRequired'); addArr('escharotomySites'); }
    else if (sid === 'severity') { ['bauxScore', 'absiScore'].forEach(addF); }
    else if (sid === 'referral') { addArr('burnCenterReferralCriteria'); }
    else if (sid === 'woundCare') { ['woundDressingType', 'graftingRequired', 'graftDonorSite'].forEach(addF); addArr('woundCultureResults'); }
    else if (sid === 'clinical') { ['tetanusProphylaxisStatus', 'caloricRequirementCalculation', 'prealbuminLevel'].forEach(addF); }
    else if (sid === 'risk') { addArr('contractureRiskAreas'); }
    else if (sid === 'etiology') { ['electricalBurnVoltage', 'chemicalAgentInvolved'].forEach(addF); }
    copyToClipboard(text.trim(), `section-${sid}-${idx}`);
  };

  const copyAllContent = () => {
    let text = `${RULE}\nBurn Assessment\n${RULE}\n\n`;
    pdfData.forEach((r, idx) => {
      // Record header mirrors the JSX: date above the record title.
      if (r.burnDate || r.date) text += `${formatDate(r.burnDate || r.date)}\n`;
      text += `Burn Assessment ${idx + 1}\n`;
      // Mirror the JSX: label on its own line, value on the next line (NOT "label: value").
      const addF = (fn) => { if (hasVal(r[fn], fn)) text += `\n${FIELD_LABELS[fn] || fn}\n${fmtVal(r[fn])}\n`; };
      // Array items render as plain values in the JSX (no numbering).
      const addArr = (fn) => { getEffectiveArray(r, fn, idx).forEach((item) => { text += `\n${item}\n`; }); };
      const simpleFs = (title, fields) => { const vis = fields.filter(f => hasVal(r[f], f)); if (vis.length) { text += `\n${RULE}\n${title}\n${RULE}\n`; vis.forEach(addF); } };
      const arrFs = (title, fn) => { const items = getEffectiveArray(r, fn, idx); if (items.length) { text += `\n${RULE}\n${title}\n${RULE}\n`; addArr(fn); } };
      simpleFs('Burn Information', ['burnEtiology', 'burnDepthClassification', 'tbsaPercentage']);
      arrFs('Anatomical Locations', 'anatomicalLocationsBurned');
      simpleFs('Inhalation Injury', ['inhalationInjuryPresent', 'carboxyhemoglobinLevel']);
      simpleFs('Fluid Resuscitation', ['parklandFormulaCalculation', 'fluidResuscitationRate', 'urineOutputTarget']);
      if (hasVal(r.escharotomyRequired, 'escharotomyRequired') || getEffectiveArray(r, 'escharotomySites', idx).length) { text += `\n${RULE}\nEscharotomy\n${RULE}\n`; addF('escharotomyRequired'); addArr('escharotomySites'); }
      simpleFs('Severity Scoring', ['bauxScore', 'absiScore']);
      arrFs('Referral Criteria', 'burnCenterReferralCriteria');
      if (hasVal(r.woundDressingType) || hasVal(r.graftingRequired, 'graftingRequired') || hasVal(r.graftDonorSite) || getEffectiveArray(r, 'woundCultureResults', idx).length) { text += `\n${RULE}\nWound Care\n${RULE}\n`; ['woundDressingType', 'graftingRequired', 'graftDonorSite'].forEach(addF); addArr('woundCultureResults'); }
      simpleFs('Clinical', ['tetanusProphylaxisStatus', 'caloricRequirementCalculation', 'prealbuminLevel']);
      arrFs('Contracture Risk', 'contractureRiskAreas');
      simpleFs('Etiology Details', ['electricalBurnVoltage', 'chemicalAgentInvolved']);
      text += '\n';
    });
    copyToClipboard(text.trim(), 'copy-all');
  };

  const renderSection = (record, idx, sid, title, children) => { if (!children) return null; return (<div className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn${copiedId === `section-${sid}-${idx}` ? ' copied' : ''}`} onClick={() => copySectionText(record, idx, sid)}>{copiedId === `section-${sid}-${idx}` ? 'Copied' : 'Copy Section'}</button>{renderApproveButton(idx, sid)}</div></div>{children}</div></div>); };

  const renderMultiFieldSection = (record, idx, sid, title, fields) => {
    const visibleFields = fields.filter(f => hasVal(getFieldValue(record, f, idx), f));
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

  if (!filteredRecords || filteredRecords.length === 0) return (<article className="burn-assessment-document"><header className="document-header"><h1 className="document-title">Burn Assessment</h1></header><SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} /><div className="empty-state">No data available.</div></article>);

  return (
    <article className="burn-assessment-document">
      <header className="document-header">
        <h1 className="document-title">Burn Assessment</h1>
        <div className="header-actions">
          <button className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`} onClick={copyAllContent}>{copiedId === 'copy-all' ? 'Copied' : 'Copy All'}</button>
          <PDFDownloadLink document={<BurnAssessmentDocumentPDFTemplate document={pdfData} />} fileName="Burn_Assessment.pdf">
            {({ loading }) => <button className="copy-btn">{loading ? 'Preparing...' : 'Export PDF'}</button>}
          </PDFDownloadLink>
        </div>
      </header>
      <SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <div className="record-meta-row">{(record.burnDate || record.date) && <span className="record-date">{highlightText(formatDate(record.burnDate || record.date))}</span>}</div>
              <div className="record-title-row"><h3 className="record-name">{highlightText(`Burn Assessment ${idx + 1}`)}</h3></div>
            </div>

            {renderMultiFieldSection(record, idx, 'burnInfo', 'Burn Information', ['burnEtiology', 'burnDepthClassification', 'tbsaPercentage'])}
            {renderArraySection(record, idx, 'locations', 'Anatomical Locations', 'anatomicalLocationsBurned')}
            {renderMultiFieldSection(record, idx, 'inhalation', 'Inhalation Injury', ['inhalationInjuryPresent', 'carboxyhemoglobinLevel'])}
            {renderMultiFieldSection(record, idx, 'fluid', 'Fluid Resuscitation', ['parklandFormulaCalculation', 'fluidResuscitationRate', 'urineOutputTarget'])}

            {/* Escharotomy — simple + array combined */}
            {(hasVal(record.escharotomyRequired) || record.escharotomySites?.length > 0) && shouldShowSection(record, 'Escharotomy', [fmtVal(record.escharotomyRequired), ...(record.escharotomySites || [])].filter(Boolean), ['escharotomyRequired', 'escharotomySites']) && renderSection(record, idx, 'escharotomy', 'Escharotomy', <>{renderEditableField(record, 'escharotomyRequired', idx, 'escharotomy')}{record.escharotomySites?.map((item, ai) => renderEditableArrayItem(record, 'escharotomySites', idx, 'escharotomy', item, ai))}</>)}

            {renderMultiFieldSection(record, idx, 'severity', 'Severity Scoring', ['bauxScore', 'absiScore'])}
            {renderArraySection(record, idx, 'referral', 'Referral Criteria', 'burnCenterReferralCriteria')}

            {/* Wound Care — simple + array combined */}
            {(hasVal(record.woundDressingType) || hasVal(record.graftingRequired) || hasVal(record.graftDonorSite) || record.woundCultureResults?.length > 0) && shouldShowSection(record, 'Wound Care', [record.woundDressingType, fmtVal(record.graftingRequired), record.graftDonorSite, ...(record.woundCultureResults || [])].filter(Boolean), ['woundDressingType', 'woundCultureResults', 'graftingRequired', 'graftDonorSite']) && renderSection(record, idx, 'woundCare', 'Wound Care', <>{renderEditableField(record, 'woundDressingType', idx, 'woundCare')}{renderEditableField(record, 'graftingRequired', idx, 'woundCare')}{renderEditableField(record, 'graftDonorSite', idx, 'woundCare')}{record.woundCultureResults?.map((item, ai) => renderEditableArrayItem(record, 'woundCultureResults', idx, 'woundCare', item, ai))}</>)}

            {renderMultiFieldSection(record, idx, 'clinical', 'Clinical', ['tetanusProphylaxisStatus', 'caloricRequirementCalculation', 'prealbuminLevel'])}
            {renderArraySection(record, idx, 'risk', 'Contracture Risk', 'contractureRiskAreas')}
            {renderMultiFieldSection(record, idx, 'etiology', 'Etiology Details', ['electricalBurnVoltage', 'chemicalAgentInvolved'])}
          </div>
        ))}
      </div>
    </article>
  );
};

export default BurnAssessmentDocument;
