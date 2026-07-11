/**
 * BrainTumorMolecularMarkersDocument.jsx
 * Inline editing with per-section approve, per-row copy.
 * 4-level search, PDFDownloadLink + pdfData memo, secureApiClient.
 * Nested objects use dot-path editing. No type conversion.
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import BrainTumorMolecularMarkersDocumentPDFTemplate from '../pdf-templates/BrainTumorMolecularMarkersDocumentPDFTemplate';
import './BrainTumorMolecularMarkersDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "parentField.dotPath") */
const DRAFT_KEY = 'brain_tumor_molecular_markersPendingEdits';
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
  classification: ['tumorType', 'whoGrade', 'molecularClassification'],
  idhStatus: ['idhStatus'],
  codeletionStatus: ['codeletionStatus'],
  ngsPanel: ['ngsPanel'],
  treatment: ['treatmentRecommendations'],
  trials: ['clinicalTrialEligibility'],
  specimen: ['specimen'],
};
const FIELD_LABELS = { tumorType: 'Tumor Type', whoGrade: 'WHO Grade', molecularClassification: 'Molecular Classification' };
const NESTED_LABELS = { tested: 'Tested', result: 'Result', prognosticImplication: 'Prognostic Implication', diagnosticImplication: 'Diagnostic Implication', therapeuticImplication: 'Therapeutic Implication', specificMutation: 'Specific Mutation', method: 'Method', methylationPercentage: 'Methylation Percentage', percentage: 'Percentage', interpretation: 'Interpretation', egfrvIIIMutation: 'EGFRvIII Mutation', tumorType: 'Associated Tumor Type', location: 'Location', performed: 'Performed', panelName: 'Panel Name', genesAnalyzed: 'Genes Analyzed', additionalMutations: 'Additional Mutations', tumorMutationBurden: 'Tumor Mutation Burden', microsatelliteStatus: 'Microsatellite Status', chemotherapyGuidance: 'Chemotherapy Guidance', radiationGuidance: 'Radiation Guidance', targetedTherapy: 'Targeted Therapy', immunotherapy: 'Immunotherapy', prognosticCounseling: 'Prognostic Counseling', specimenType: 'Specimen Type', specimenDate: 'Specimen Date', pathologyReportDate: 'Pathology Report Date', laboratory: 'Laboratory', tumorCellularity: 'Tumor Cellularity', molecularTarget: 'Molecular Target', drugClass: 'Drug Class', trialExample: 'Trial Example', eligibility: 'Eligibility' };
const MARKER_FIELDS = ['mgmtStatus', 'tertPromoterStatus', 'atrxStatus', 'tp53Status', 'ki67ProliferationIndex', 'egfrStatus', 'cdkn2aStatus', 'brafStatus', 'h3Status'];
const MARKER_LABELS = { mgmtStatus: 'MGMT Status', tertPromoterStatus: 'TERT Promoter', atrxStatus: 'ATRX Status', tp53Status: 'TP53 Status', ki67ProliferationIndex: 'Ki-67 Index', egfrStatus: 'EGFR Status', cdkn2aStatus: 'CDKN2A Status', brafStatus: 'BRAF Status', h3Status: 'H3 Status' };
// Each "other marker" section renders with sid === its field name; register them so the per-section Approve
// button (sectionHasEdits) and commit (handleApproveSection) resolve their field. Safe: nothing iterates
// Object.keys(SECTION_FIELDS) for render/copy/pdf, so no double-count.
MARKER_FIELDS.forEach(f => { SECTION_FIELDS[f] = [f]; });

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'string') return v.trim() !== ''; if (typeof v === 'object' && Object.keys(v).length === 0) return false; if (typeof v === 'object') return true; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; return String(v || ''); };
const hasObjData = (obj) => obj && typeof obj === 'object' && Object.keys(obj).length > 0 && Object.values(obj).some(v => hasVal(v));

/* Abbreviation-safe sentence split (split the narrative on ". " — protects Dr./decimals) — JSX↔PDF parity. */
const ABBR_RE = '(?:Mr|Mrs|Ms|Dr|Prof|Rev|Sr|Jr|St|Gen|Col|Sgt|Lt|Capt|vs|etc)';
const splitBySentence = (text) => { if (!text) return []; return String(text).split(new RegExp(`(?<!\\b${ABBR_RE}\\.)(?<=[.!?])\\s+`)).map(s => s.trim()).filter(s => s.length > 0 && s.replace(/[.!?;,]+/g, '').trim().length > 0); };
const stepFor = (v) => { const d = (String(v).split('.')[1] || '').length; return d > 0 ? '0.' + '0'.repeat(d - 1) + '1' : '1'; };
/* String-with-unit splitter ("78%","42%"): edit only the number, keep prefix/unit affixes. null (→textarea) for
   non-numeric, ranges, dates, or compound values whose unit contains a digit. */
const splitNumberUnit = (raw) => {
  if (raw == null) return null;
  const s = String(raw).trim();
  const m = s.match(/^([<>≤≥=~]*)\s*(-?\d+(?:\.\d+)?)(\s*)(\S[\s\S]*)?$/);
  if (!m) return null;
  const unit = (m[4] || '').trim();
  if (/^[-–—]\s*\d/.test(unit)) return null;   // range / date -> textarea
  if (/\d/.test(unit)) return null;            // digit-in-unit (compound) -> textarea
  return { prefix: m[1] || '', number: m[2], sep: m[3] || '', unit, step: stepFor(m[2]) };
};
/* Copy lines for one nested entry: multi-sentence → label then numbered sentences; else "Label: value". */
const objEntryCopyLines = (label, value) => {
  const dv = fmtVal(value);
  if (typeof value !== 'boolean') { const sents = splitBySentence(dv); if (sents.length > 1) { const out = [`${label}:`]; sents.forEach((s, i) => out.push(`  ${i + 1}. ${s.replace(/\.$/, '')}`)); return out; } }
  return [`${label}: ${dv}`];
};

const BrainTumorMolecularMarkersDocument = ({ document: rawDoc }) => {
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
    arr = arr.flatMap(r => { if (r?.brain_tumor_molecular_markers) return Array.isArray(r.brain_tumor_molecular_markers) ? r.brain_tumor_molecular_markers : [r.brain_tumor_molecular_markers]; if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.brain_tumor_molecular_markers) return Array.isArray(dd.brain_tumor_molecular_markers) ? dd.brain_tumor_molecular_markers : [dd.brain_tumor_molecular_markers]; return [dd]; } return r; });
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

  const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
  const getFieldValue = useCallback((record, fn, idx) => { const k = `${fn}-${idx}`; if (localEdits[k] !== undefined) return localEdits[k]; return record[fn]; }, [localEdits]);
  const getRecordId = (r) => { const id = r._id; if (!id) return null; if (typeof id === 'string') return id; if (id.$oid) return id.$oid; return String(id); };
  const copyToClipboard = async (text, id) => { try { await navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); } catch {} };

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid) => {
    const rid = getRecordId(record);
    if (!rid) { console.error('[BrainTumorMolecularMarkers] Cannot save — no record ID'); return; }
    const fieldPart = fn;
    const ek = `${fieldPart}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: editValue }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    // Re-edit after approval → drop the section's 'approved' flag so the button returns to yellow Pending
    setApprovedSections(prev => { const key = `${sid}-${idx}`; if (!prev[key]) return prev; const n = { ...prev }; delete n[key]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][fieldPart] = editValue;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue]);

  // Save (nested/dot-path) = stage a DRAFT locally only. Committed to DB on Approve.
  const handleSaveNestedField = useCallback((record, idx, parentField, dotPath, sid, valueOverride, trackKey) => {
    const rid = getRecordId(record);
    if (!rid) { console.error('[BrainTumorMolecularMarkers] Cannot save — no record ID'); return; }
    const fieldPart = `${parentField}.${dotPath}`;
    const ek = `${fieldPart}-${idx}`;
    // FIELD-level key carries the staged value (commits correctly: endsWith `-idx`); trackKey lets a per-sentence
    // row own the modified badge while localEdits/pendingEdits/draft stay at the field level.
    const track = trackKey || ek;
    const value = valueOverride !== undefined ? valueOverride : editValue;
    setLocalEdits(prev => ({ ...prev, [ek]: value }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [track]: 'edited' }));
    setApprovedSections(prev => { const key = `${sid}-${idx}`; if (!prev[key]) return prev; const n = { ...prev }; delete n[key]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][fieldPart] = value;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue]);

  // Approve = COMMIT all staged drafts for this section to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, idx, sid) => {
    const rid = getRecordId(record);
    if (!rid) return;
    setSaving(true);
    try {
      const sc = (await import('../../../services/secureApiClient')).default;
      const sf = SECTION_FIELDS[sid] || [];
      const suffix = `-${idx}`;
      // This section's staged edits: editKey "<fieldPart>-<idx>" whose base field belongs to the section.
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
        const fieldPart = k.slice(0, -suffix.length);
        const baseField = fieldPart.indexOf('.') === -1 ? fieldPart : fieldPart.slice(0, fieldPart.indexOf('.'));
        return sf.includes(baseField);
      });
      // Persist each staged field to the DB now. arrayIndex ONLY when the last dot-segment is purely numeric.
      for (const ek of toCommit) {
        const fieldPart = ek.slice(0, -suffix.length); // "field" or "parentField.dotPath"
        const lastDot = fieldPart.lastIndexOf('.');
        const lastSeg = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const payload = { value: localEdits[ek] };
        if (lastDot !== -1 && /^\d+$/.test(lastSeg)) {
          payload.field = fieldPart.slice(0, lastDot);
          payload.arrayIndex = parseInt(lastSeg, 10);
        } else {
          payload.field = fieldPart;
        }
        await sc.put(`/api/edit/brain_tumor_molecular_markers/${rid}/edit`, payload);
      }
      // Flag the section approved (audit trail)
      await sc.put(`/api/edit/brain_tumor_molecular_markers/${rid}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's committed drafts from localStorage
      const store = readDrafts();
      if (store[rid]) { toCommit.forEach(k => { const fp = k.slice(0, -suffix.length); if (store[rid]) delete store[rid][fp]; }); if (store[rid] && Object.keys(store[rid]).length === 0) delete store[rid]; writeDrafts(store); }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { sf.forEach(f => { if (k.startsWith(`${f}-${idx}`) || k.startsWith(`${f}.`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[BrainTumorMolecularMarkers] Approve failed:', err); } finally { setSaving(false); }
  }, [localEdits, pendingEdits]);

  const highlightText = (text) => { if (!text) return ''; const str = String(text); if (!searchTerm.trim()) return str; const esc = searchTerm.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const re = new RegExp(`(${esc})`, 'gi'); const p = str.split(re); if (p.length === 1) return str; return <>{p.map((x, i) => re.test(x) ? <mark key={i}>{x}</mark> : x)}</>; };
  const phraseMatch = (text, term) => { if (!term.trim()) return true; return String(text || '').toLowerCase().includes(term.toLowerCase().trim()); };
  const shouldShowSection = (record, title, contentParts, fieldNames) => { if (!searchTerm.trim()) return true; if (record._showAllSections) return true; const sl = searchTerm.toLowerCase().trim(); const tl = (title || '').toLowerCase(); if (tl.startsWith(sl) || sl.startsWith(tl)) return true; const combined = (Array.isArray(contentParts) ? contentParts : [contentParts]).filter(Boolean).join(' '); return phraseMatch(combined, searchTerm); };
  const sectionTitleMatches = (t) => { if (!searchTerm.trim()) return false; const sl = searchTerm.toLowerCase().trim(); const tl = (t || '').toLowerCase(); return tl.startsWith(sl) || sl.startsWith(tl); };
  const fieldMatches = (record, fn, idx) => { if (!searchTerm.trim()) return true; if (record._showAllSections) return true; return phraseMatch(FIELD_LABELS[fn] || fn, searchTerm) || phraseMatch(fmtVal(getFieldValue(record, fn, idx)), searchTerm); };

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const sl = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      const title = `Molecular Markers ${idx + 1}`;
      const flattenObj = (obj) => obj && typeof obj === 'object' ? Object.values(obj).map(v => typeof v === 'object' ? flattenObj(v) : fmtVal(v)).join(' ') : '';
      const allText = [title, formatDate(record.date), record.tumorType, record.whoGrade, record.molecularClassification, flattenObj(record.idhStatus), flattenObj(record.codeletionStatus), ...MARKER_FIELDS.map(f => flattenObj(record[f])), flattenObj(record.ngsPanel), flattenObj(record.treatmentRecommendations), (Array.isArray(record.clinicalTrialEligibility) ? record.clinicalTrialEligibility.map(flattenObj).join(' ') : ''), flattenObj(record.specimen), ...Object.values(FIELD_LABELS), ...Object.values(NESTED_LABELS), ...Object.values(MARKER_LABELS), 'Classification', 'IDH Status', '1p/19q Co-deletion', 'NGS Panel', 'Treatment Recommendations', 'Clinical Trial Eligibility', 'Specimen Details', 'Other Markers'].filter(Boolean).join(' ');
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
    if (ie) return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveField(record, fn, idx, sid); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => handleSaveField(record, fn, idx, sid)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(dv); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  const renderNestedEditableField = (record, idx, parentField, dotPath, label, value, sid) => {
    if (!hasVal(value)) return null;
    const nKey = `${parentField}.${dotPath}-${idx}`;
    const cur = localEdits[nKey] !== undefined ? localEdits[nKey] : value;
    const dv = fmtVal(cur);
    const cidBase = `nested-${parentField}-${dotPath}-${idx}`;
    const cancel = () => { setEditingField(null); setEditValue(''); };
    const isBool = typeof value === 'boolean' || typeof cur === 'boolean';

    // 1) BOOLEAN -> Yes/No select (saved as a real boolean)
    if (isBool) {
      const ie = editingField === nKey; const ed = editedFields[nKey];
      const save = () => handleSaveNestedField(record, idx, parentField, dotPath, sid, editValue === 'Yes', nKey);
      if (ie) return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(label)}</div><div className="edit-field-container"><select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') cancel(); }} disabled={saving}><option value="Yes">Yes</option><option value="No">No</option></select><div className="edit-actions"><button className="save-btn" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={cancel}>Cancel</button></div></div></div>);
      return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(label)}</div><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(nKey); setEditValue(dv); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cidBase ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cidBase); }}>{copiedId === cidBase ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
    }

    // 2) MULTI-SENTENCE -> split by the dot into per-sentence editable rows (Option A, lossless rejoin)
    const sents = splitBySentence(dv);
    if (sents.length > 1) {
      return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(label)}</div>{sents.map((sentence, si) => {
        const partKey = `${nKey}-p${si}`; const ie = editingField === partKey; const ed = editedFields[partKey]; const cid = `${cidBase}-p${si}`; const displayText = sentence.replace(/\.$/, '');
        const saveSentence = () => { const parts = splitBySentence(fmtVal(localEdits[nKey] !== undefined ? localEdits[nKey] : value)); parts[si] = editValue.trim(); const newFull = parts.filter(x => x.trim().length > 0).map(x => x.replace(/\.$/, '')).join('. ') + '.'; handleSaveNestedField(record, idx, parentField, dotPath, sid, newFull, partKey); };
        if (ie) return (<div key={si} className="nested-mini-card"><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveSentence(); if (e.key === 'Escape') cancel(); }} autoFocus rows={2} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={saveSentence} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={cancel}>Cancel</button></div></div></div>);
        return (<div key={si} className="nested-mini-card"><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(partKey); setEditValue(displayText); }}><div className="row-content"><span className="content-value">{highlightText(displayText)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(displayText, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
      })}</div>);
    }

    // 3) NUMBER+UNIT (e.g. "78%","42%") -> number stepper + fixed unit affix (lossless reassembly)
    const nu = splitNumberUnit(dv);
    if (nu) {
      const ie = editingField === nKey; const ed = editedFields[nKey];
      const save = () => { const n = parseFloat(editValue); if (editValue === '' || isNaN(n)) return; handleSaveNestedField(record, idx, parentField, dotPath, sid, `${nu.prefix}${editValue}${nu.sep}${nu.unit}`, nKey); };
      if (ie) return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(label)}</div><div className="edit-field-container"><div className="num-unit-edit">{nu.prefix && <span className="nu-affix">{nu.prefix}</span>}<input type="number" className="edit-number" step={nu.step} value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }} disabled={saving} />{nu.unit && <span className="nu-affix">{nu.unit}</span>}</div><div className="edit-actions"><button className="save-btn" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={cancel}>Cancel</button></div></div></div>);
      return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(label)}</div><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(nKey); setEditValue(nu.number); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cidBase ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cidBase); }}>{copiedId === cidBase ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
    }

    // 4) DEFAULT -> textarea
    const ie = editingField === nKey; const ed = editedFields[nKey];
    if (ie) return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(label)}</div><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveNestedField(record, idx, parentField, dotPath, sid); if (e.key === 'Escape') cancel(); }} autoFocus rows={dotPath.includes('Guidance') || dotPath.includes('Counseling') || dotPath.includes('Implication') ? 3 : 1} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => handleSaveNestedField(record, idx, parentField, dotPath, sid)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={cancel}>Cancel</button></div></div></div>);
    return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(label)}</div><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(nKey); setEditValue(dv); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cidBase ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cidBase); }}>{copiedId === cidBase ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  const renderNestedObjectSection = (record, idx, sid, title, parentField, obj) => {
    if (!hasObjData(obj)) return null;
    const entries = Object.entries(obj).filter(([, v]) => hasVal(v));
    if (entries.length === 0) return null;
    if (!shouldShowSection(record, title, entries.map(([k, v]) => `${NESTED_LABELS[k] || k}: ${fmtVal(v)}`))) return null;
    return (<div className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn${copiedId === `section-${sid}-${idx}` ? ' copied' : ''}`} onClick={() => { let text = `${title.toUpperCase()}\n`; entries.forEach(([k, v]) => { objEntryCopyLines(NESTED_LABELS[k] || k, v).forEach(l => { text += `${l}\n`; }); }); copyToClipboard(text.trim(), `section-${sid}-${idx}`); }}>{copiedId === `section-${sid}-${idx}` ? 'Copied' : 'Copy Section'}</button>{renderApproveButton(idx, sid)}</div></div>{entries.map(([key, value]) => renderNestedEditableField(record, idx, parentField, key, NESTED_LABELS[key] || key, value, sid))}</div></div>);
  };

  const renderArrayObjectSection = (record, idx, sid, title, parentField, arr) => {
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const items = arr.map((it, i) => ({ it, i })).filter(({ it }) => hasObjData(it) || hasVal(it));
    if (items.length === 0) return null;
    const flat = items.map(({ it }) => typeof it === 'object' ? Object.entries(it).map(([k, v]) => `${NESTED_LABELS[k] || k}: ${fmtVal(v)}`).join(' ') : fmtVal(it));
    if (!shouldShowSection(record, title, flat)) return null;
    return (<div className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn${copiedId === `section-${sid}-${idx}` ? ' copied' : ''}`} onClick={() => { let text = `${title.toUpperCase()}\n`; items.forEach(({ it }, n) => { text += `${n + 1}.\n`; if (typeof it === 'object') Object.entries(it).filter(([, v]) => hasVal(v)).forEach(([k, v]) => { objEntryCopyLines(NESTED_LABELS[k] || k, v).forEach(l => { text += `${l}\n`; }); }); else text += `${fmtVal(it)}\n`; }); copyToClipboard(text.trim(), `section-${sid}-${idx}`); }}>{copiedId === `section-${sid}-${idx}` ? 'Copied' : 'Copy Section'}</button>{renderApproveButton(idx, sid)}</div></div>{items.map(({ it, i }) => (<div key={i} className="nested-mini-card"><div className="nested-subtitle">{highlightText(`Trial ${i + 1}`)}</div>{typeof it === 'object' ? Object.entries(it).filter(([, v]) => hasVal(v)).map(([key, value]) => renderNestedEditableField(record, idx, parentField, `${i}.${key}`, NESTED_LABELS[key] || key, value, sid)) : renderNestedEditableField(record, idx, parentField, `${i}`, `Trial ${i + 1}`, it, sid)}</div>))}</div></div>);
  };

  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return records;
    return records.map((record, idx) => { const m = { ...record }; Object.keys(localEdits).forEach(key => { if (pendingEdits[key]) return; const ld = key.lastIndexOf('-'); if (ld === -1) return; const fn = key.substring(0, ld); const ri = parseInt(key.substring(ld + 1), 10); if (ri === idx && fn in record) m[fn] = localEdits[key]; }); return m; });
  }, [records, localEdits, pendingEdits]);

  const copyAllContent = () => {
    let text = '=== BRAIN TUMOR MOLECULAR MARKERS ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Molecular Markers ${idx + 1}\n`;
      if (r.date) text += `${formatDate(r.date)}\n`;
      if (r.tumorType || r.whoGrade || r.molecularClassification) { text += '\nCLASSIFICATION\n'; if (r.tumorType) text += `Tumor Type: ${r.tumorType}\n`; if (r.whoGrade) text += `WHO Grade: ${fmtVal(r.whoGrade)}\n`; if (r.molecularClassification) text += `Molecular Classification: ${r.molecularClassification}\n`; }
      const printObj = (title, obj) => { if (!hasObjData(obj)) return; text += `\n${title}\n`; Object.entries(obj).filter(([, v]) => hasVal(v)).forEach(([k, v]) => { objEntryCopyLines(NESTED_LABELS[k] || k, v).forEach(l => { text += `${l}\n`; }); }); };
      printObj('IDH STATUS', r.idhStatus);
      printObj('1P/19Q CO-DELETION', r.codeletionStatus);
      MARKER_FIELDS.forEach(f => printObj((MARKER_LABELS[f] || f).toUpperCase(), r[f]));
      printObj('NGS PANEL', r.ngsPanel);
      printObj('TREATMENT RECOMMENDATIONS', r.treatmentRecommendations);
      if (Array.isArray(r.clinicalTrialEligibility) && r.clinicalTrialEligibility.some(t => hasObjData(t) || hasVal(t))) { text += '\nCLINICAL TRIAL ELIGIBILITY\n'; r.clinicalTrialEligibility.forEach((t, n) => { if (!(hasObjData(t) || hasVal(t))) return; text += `Trial ${n + 1}\n`; if (typeof t === 'object') Object.entries(t).filter(([, v]) => hasVal(v)).forEach(([k, v]) => { objEntryCopyLines(NESTED_LABELS[k] || k, v).forEach(l => { text += `${l}\n`; }); }); else text += `${fmtVal(t)}\n`; }); }
      printObj('SPECIMEN DETAILS', r.specimen);
      text += '\n';
    });
    copyToClipboard(text.trim(), 'copy-all');
  };

  const renderSection = (record, idx, sid, title, children) => { if (!children) return null; return (<div className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn${copiedId === `section-${sid}-${idx}` ? ' copied' : ''}`} onClick={() => { let text = `${title.toUpperCase()}\n`; const sf = SECTION_FIELDS[sid] || []; const pr = pdfData[idx] || record; sf.forEach(f => { if (hasVal(pr[f])) text += `${FIELD_LABELS[f] || f}: ${fmtVal(pr[f])}\n`; }); copyToClipboard(text.trim(), `section-${sid}-${idx}`); }}>{copiedId === `section-${sid}-${idx}` ? 'Copied' : 'Copy Section'}</button>{renderApproveButton(idx, sid)}</div></div>{children}</div></div>); };

  const renderMultiFieldSection = (record, idx, sid, title, fields) => {
    const visibleFields = fields.filter(f => hasVal(getFieldValue(record, f, idx)));
    if (visibleFields.length === 0) return null;
    if (!shouldShowSection(record, title, visibleFields.map(f => fmtVal(getFieldValue(record, f, idx))), visibleFields)) return null;
    return renderSection(record, idx, sid, title, (() => { const stm = sectionTitleMatches(title); const sa = !searchTerm.trim() || record._showAllSections || stm; return <>{visibleFields.map(f => { if (!sa && !fieldMatches(record, f, idx)) return null; return <React.Fragment key={f}>{renderEditableField(record, f, idx, sid)}</React.Fragment>; })}</>; })());
  };

  if (!filteredRecords || filteredRecords.length === 0) return (<article className="brain-tumor-molecular-markers-document"><header className="document-header"><h1 className="document-title">Brain Tumor Molecular Markers</h1></header><SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} /><div className="empty-state">No data available.</div></article>);

  return (
    <article className="brain-tumor-molecular-markers-document">
      <header className="document-header">
        <h1 className="document-title">Brain Tumor Molecular Markers</h1>
        <div className="header-actions">
          <button className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`} onClick={copyAllContent}>{copiedId === 'copy-all' ? 'Copied' : 'Copy All'}</button>
          <PDFDownloadLink document={<BrainTumorMolecularMarkersDocumentPDFTemplate document={pdfData} />} fileName="Brain_Tumor_Molecular_Markers.pdf">
            {({ loading }) => <button className="copy-btn">{loading ? 'Preparing...' : 'Export PDF'}</button>}
          </PDFDownloadLink>
        </div>
      </header>
      <SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <div className="record-meta-row">{record.date && <span className="record-date">{highlightText(formatDate(record.date))}</span>}</div>
              <div className="record-title-row"><h3 className="record-name">{highlightText(`Molecular Markers ${idx + 1}`)}</h3></div>
            </div>

            {renderMultiFieldSection(record, idx, 'classification', 'Classification', ['tumorType', 'whoGrade', 'molecularClassification'])}
            {renderNestedObjectSection(record, idx, 'idhStatus', 'IDH Status', 'idhStatus', record.idhStatus)}
            {renderNestedObjectSection(record, idx, 'codeletionStatus', '1p/19q Co-deletion', 'codeletionStatus', record.codeletionStatus)}

            {/* Other Markers — render each non-empty one */}
            {MARKER_FIELDS.some(f => hasObjData(record[f])) && MARKER_FIELDS.map(f => renderNestedObjectSection(record, idx, f, MARKER_LABELS[f], f, record[f]))}

            {renderNestedObjectSection(record, idx, 'ngsPanel', 'NGS Panel', 'ngsPanel', record.ngsPanel)}
            {renderNestedObjectSection(record, idx, 'treatment', 'Treatment Recommendations', 'treatmentRecommendations', record.treatmentRecommendations)}
            {renderArrayObjectSection(record, idx, 'trials', 'Clinical Trial Eligibility', 'clinicalTrialEligibility', record.clinicalTrialEligibility)}
            {renderNestedObjectSection(record, idx, 'specimen', 'Specimen Details', 'specimen', record.specimen)}
          </div>
        ))}
      </div>
    </article>
  );
};

export default BrainTumorMolecularMarkersDocument;
