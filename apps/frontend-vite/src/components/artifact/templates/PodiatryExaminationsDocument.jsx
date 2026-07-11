/**
 * PodiatryExaminationsDocument.jsx
 * June 2026 — mini-card checklist (697ba540) + full INLINE EDITING (editing checklist 69994f28).
 * Collection: podiatry_examinations
 *
 * Display: section -> mini-cards-container (header INSIDE) -> rec-mini-card per top-level field ->
 *   recursive renderNode. A LABEL is a nested-subtitle on its own line; a VALUE is a numbered-row.
 *   NO "Label: value" inline, NO numbering. hide-empty everywhere.
 * Editing: every scalar LEAF (string/number/boolean) anywhere in the nested tree is click-to-edit
 *   with a type-aware editor (textarea / number input / Yes-No select). On save it deep-clones the
 *   top-level field, sets the leaf, and persists the leaf via a dot-path (e.g.
 *   "neuropathyAssessment.monofilamentTest.interpretation" or "skinCondition.rightFoot.calluses.0.severity")
 *   to /api/edit/podiatry_examinations/:id/edit (the route allows any path whose ROOT is in ALLOWED_FIELDS).
 *   indicationForExam uses per-sentence editing. Per-section Pending Approve -> Approved.
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import PodiatryExaminationsDocumentPDFTemplate from '../pdf-templates/PodiatryExaminationsDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './PodiatryExaminationsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [dotField]: value } }  (dotField is the exact /edit field path; for
   indicationForExam it is just "indicationForExam"). */
const DRAFT_KEY = 'podiatryExaminationsPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

/* ═══════ CONSTANTS ═══════ */
const SECTION_TITLES = {
  indication: 'Indication', neuropathyAssessment: 'Neuropathy Assessment', vascularAssessment: 'Vascular Assessment',
  footStructureDeformities: 'Foot Structure & Deformities', skinCondition: 'Skin Condition', nailCondition: 'Nail Condition',
  footwearAssessment: 'Footwear Assessment', riskStratification: 'Risk Stratification', treatmentPlan: 'Treatment Plan', patientEducation: 'Patient Education',
};
const SECTION_FIELD = {
  indication: 'indicationForExam', neuropathyAssessment: 'neuropathyAssessment', vascularAssessment: 'vascularAssessment',
  footStructureDeformities: 'footStructureDeformities', skinCondition: 'skinCondition', nailCondition: 'nailCondition',
  footwearAssessment: 'footwearAssessment', riskStratification: 'riskStratification', treatmentPlan: 'treatmentPlan', patientEducation: 'patientEducation',
};
const SECTION_ORDER = ['indication', 'neuropathyAssessment', 'vascularAssessment', 'footStructureDeformities', 'skinCondition', 'nailCondition', 'footwearAssessment', 'riskStratification', 'treatmentPlan', 'patientEducation'];

const KEY_OVERRIDES = {
  iwgdfRiskCategory: 'IWGDF Risk Category', anklebrachialIndex: 'Ankle-Brachial Index', rightABI: 'Right ABI', leftABI: 'Left ABI',
  prominentMTHeads: 'Prominent MT Heads', dorsalisPedisPulse: 'Dorsalis Pedis Pulse', posteriorTibialPulse: 'Posterior Tibial Pulse', capillaryRefillTime: 'Capillary Refill Time',
};
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/* ═══════ VALUE HELPERS ═══════ */
const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v) || v === 0;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const isScalar = (v) => v === null || typeof v !== 'object';
const deepClone = (x) => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
const setByPath = (obj, pathArr, val) => { let cur = obj; for (let i = 0; i < pathArr.length - 1; i++) cur = cur[pathArr[i]]; cur[pathArr[pathArr.length - 1]] = val; };
const flattenSearchable = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (typeof v === 'number' || typeof v === 'string') return String(v);
  if (Array.isArray(v)) return v.map(flattenSearchable).join(' ');
  if (typeof v === 'object') return Object.entries(v).map(([k, val]) => `${humanizeKey(k)} ${flattenSearchable(val)}`).join(' ');
  return '';
};
const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); if (isNaN(d.getTime())) return String(dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};
const buildCopyLines = (label, value, indent) => {
  const pad = '  '.repeat(indent); const out = [];
  if (isEmptyDeep(value)) return out;
  if (isScalar(value)) { out.push(`${pad}${label ? label + ': ' : ''}${fmtScalar(value)}`); return out; }
  if (Array.isArray(value)) {
    if (label) out.push(`${pad}${label}:`);
    value.filter(x => !isEmptyDeep(x)).forEach(item => {
      if (isScalar(item)) out.push(`${pad}  - ${fmtScalar(item)}`);
      else { const e = Object.entries(item).filter(([, v]) => !isEmptyDeep(v)); if (!e.length) return; const head = isScalar(e[0][1]) ? fmtScalar(e[0][1]) : ''; if (head && e.length === 2 && isScalar(e[1][1])) out.push(`${pad}  - ${head}: ${fmtScalar(e[1][1])}`); else if (head) { out.push(`${pad}  - ${head}`); e.slice(1).forEach(([k, v]) => out.push(...buildCopyLines(humanizeKey(k), v, indent + 2))); } else e.forEach(([k, v]) => out.push(...buildCopyLines(humanizeKey(k), v, indent + 1))); }
    });
    return out;
  }
  if (label) out.push(`${pad}${label}:`);
  Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => out.push(...buildCopyLines(humanizeKey(k), v, indent + (label ? 1 : 0))));
  return out;
};

/* ═══════ COMPONENT ═══════ */
const PodiatryExaminationsDocument = ({ document: docProp, data, templateData }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSection, setCopiedSection] = useState(null);
  const [copiedItems, setCopiedItems] = useState({});
  const [showCopied, setShowCopied] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  // editKeys/dotFields that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [editedFields, setEditedFields] = useState({});   // nested leaf edits: `${dotPath}@@${idx}` -> 'edited'
  const [editedSentences, setEditedSentences] = useState({}); // indication: `indicationForExam-${idx}-s${i}`
  const [approvedSections, setApprovedSections] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const containerRef = useRef(null);

  /* ═══════ DATA UNWRAP (3-prop) ═══════ */
  const records = useMemo(() => {
    const source = docProp ?? data ?? templateData;
    if (!source) return [];
    let arr = Array.isArray(source) ? source : [source];
    arr = arr.flatMap(r => {
      if (!r || typeof r !== 'object') return [r];
      if (r.podiatry_examinations) return Array.isArray(r.podiatry_examinations) ? r.podiatry_examinations : [r.podiatry_examinations];
      if (r.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.podiatry_examinations) return Array.isArray(dd.podiatry_examinations) ? dd.podiatry_examinations : [dd.podiatry_examinations]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp, data, templateData]);

  /* ═══════ UTILS ═══════ */
  const getFieldValue = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    return record[fn];
  }, [localEdits]);
  const safeId = useCallback((r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); }, []);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
     Drafts are stored per dotField; we rebuild the per-field cloned object in localEdits + mark badges. */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      if (!record || !record._id) return;
      const rid = (typeof record._id === 'string') ? record._id : (record._id.$oid || String(record._id));
      const recDrafts = store[rid];
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([dotField, value]) => {
        nPending[dotField + `@@${idx}`] = true;
        if (dotField === 'indicationForExam') {
          nLocal[`indicationForExam-${idx}`] = value;
          nPending[`indicationForExam-${idx}`] = true;
          nSentences[`indicationForExam-${idx}-s0`] = 'edited';
        } else {
          const path = dotField.split('.');
          const fn = path[0];
          const subPath = path.slice(1);
          // Seed the per-field clone from the existing localEdits build-up or the original record value.
          const base = nLocal[`${fn}-${idx}`] !== undefined ? nLocal[`${fn}-${idx}`] : record[fn];
          const clone = base === undefined ? undefined : JSON.parse(JSON.stringify(base));
          if (clone !== undefined && subPath.length > 0) {
            try { setByPath(clone, subPath, value); nLocal[`${fn}-${idx}`] = clone; } catch { /* skip malformed draft */ }
          }
          nFields[`${dotField}@@${idx}`] = 'edited';
        }
      });
    });
    if (Object.keys(nPending).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [records]);
  const highlightText = useCallback((text) => {
    if (!searchTerm.trim() || text === null || text === undefined) return text;
    const phrase = searchTerm.trim();
    const regex = new RegExp(`(${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return String(text).split(regex).map((part, i) => regex.test(part) ? <mark key={i}>{part}</mark> : part);
  }, [searchTerm]);
  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
  }, []);
  function reconstructFullText(sentences) {
    if (!sentences || sentences.length === 0) return '';
    return sentences.map((s, i) => { let c = s.replace(/[;.]+$/, '').trim(); if (i < sentences.length - 1) c += '.'; return c; }).join(' ');
  }

  /* ═══════ SEARCH ═══════ */
  const shouldShowSection = useCallback((record, sid) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    if ((SECTION_TITLES[sid] || '').toLowerCase().includes(phrase)) return true;
    return flattenSearchable(getFieldValue(record, SECTION_FIELD[sid], 0)).toLowerCase().includes(phrase);
  }, [searchTerm, getFieldValue]);
  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      if (`podiatry examination ${idx + 1}`.includes(phrase)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase)) return true; }
      for (const sid of SECTION_ORDER) { if (flattenSearchable(getFieldValue(record, SECTION_FIELD[sid], idx)).toLowerCase().includes(phrase)) return true; }
      return false;
    });
  }, [records, searchTerm, getFieldValue]);

  /* ═══════ PDF DATA ═══════ */
  const pdfData = useMemo(() => filteredRecords.map((record, idx) => {
    const merged = { ...record };
    Object.keys(localEdits).forEach(key => {
      const m = key.match(/^(.+)-(\d+)$/);
      if (!m || parseInt(m[2]) !== idx) return;
      const fn = m[1];
      // Pending drafts stay OUT of the PDF until approved. A field is pending if its top-level
      // localEdits key is pending, or any staged dotField (`<root>...@@idx`) has this root.
      if (pendingEdits[key]) return;
      const hasPendingLeaf = Object.keys(pendingEdits).some(pk => {
        const at = pk.indexOf('@@');
        if (at === -1) return false;
        if (pk.slice(at + 2) !== String(idx)) return false;
        const dot = pk.slice(0, at);
        return dot === fn || dot.startsWith(`${fn}.`);
      });
      if (hasPendingLeaf) return;
      merged[fn] = localEdits[key];
    });
    return merged;
  }), [filteredRecords, localEdits, pendingEdits]);

  /* ═══════ EDIT: nested scalar LEAF (dot-path save) ═══════ */
  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const saveLeaf = useCallback((record, path, idx, sid, newVal) => {
    const recordId = safeId(record); if (!recordId) return;
    const fn = path[0]; const subPath = path.slice(1);
    const clone = deepClone(getFieldValue(record, fn, idx));
    if (subPath.length === 0) return; // top-level handled elsewhere
    try { setByPath(clone, subPath, newVal); } catch (e) { console.error('[PodiatryExaminations] setByPath failed', e); setSaveError('Save failed.'); return; }
    const dotField = path.join('.');
    const editKey = `${dotField}@@${idx}`;
    setSaveError(null);
    setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: clone }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    // Re-edit after approval → drop the section's 'approved' flag so the button goes back to yellow.
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[recordId]) store[recordId] = {};
    store[recordId][dotField] = newVal;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [safeId, getFieldValue]);

  /* one editable scalar cell — type-aware (boolean -> Yes/No select, number -> number, string -> textarea) */
  const editCell = (record, value, path, idx, sid, variant) => {
    const editKey = `${path.join('.')}@@${idx}`;
    const isEditing = editingField === editKey;
    const isBool = typeof value === 'boolean';
    const isNum = typeof value === 'number';
    const display = fmtScalar(value);
    const modified = editedFields[editKey] === 'edited';
    const wrapCls = variant === 'head' ? `editable-head ${modified ? 'modified' : ''}` : `numbered-row editable-row ${modified ? 'modified' : ''}`;
    const startEdit = () => { if (!isEditing) { setEditingField(editKey); setEditValue(isBool ? (value ? 'Yes' : 'No') : display); setSaveError(null); } };
    const commit = () => {
      let v;
      if (isBool) v = editValue === 'Yes';
      else if (isNum) { const n = parseFloat(editValue); if (isNaN(n)) { setSaveError('Please enter a valid number'); return; } v = n; }
      else v = editValue;
      saveLeaf(record, path, idx, sid, v);
    };
    if (isEditing) {
      return (
        <div className={variant === 'head' ? 'editable-head editing' : 'numbered-row'} key={editKey}>
          <div className="edit-field-container">
            {isBool ? (
              <select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}>
                <option value="Yes">Yes</option><option value="No">No</option>
              </select>
            ) : isNum ? (
              <input type="number" step="any" className="edit-number" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter') { e.preventDefault(); commit(); } }} />
            ) : (
              <textarea className="edit-textarea" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); commit(); } }} />
            )}
            {saveError && <div className="save-error">{saveError}</div>}
            <div className="edit-actions">
              <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); commit(); }}>{saving ? 'Saving...' : 'Save'}</button>
              <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
            </div>
          </div>
        </div>
      );
    }
    if (variant === 'head') {
      return (
        <div key={editKey} className={`nested-subtitle ${wrapCls}`} onClick={startEdit} title="Click to edit">
          {highlightText(display)}<span className="edit-indicator">&#9998;</span>
        </div>
      );
    }
    return (
      <div className={wrapCls} key={editKey} onClick={startEdit}>
        <div className="row-content"><span className="content-value">{highlightText(display)}</span><span className="edit-indicator">&#9998;</span></div>
        <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(display, editKey); }}>{copiedItems[editKey] ? 'Copied' : 'Copy'}</button>
      </div>
    );
  };

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fn = SECTION_FIELD[sid];
    if (sid === 'indication') return Object.keys(editedSentences).some(k => k.startsWith(`${fn}-${idx}`));
    return Object.keys(editedFields).some(k => { const [dot, kIdx] = k.split('@@'); return kIdx === String(idx) && (dot === fn || dot.startsWith(`${fn}.`)); });
  }, [editedFields, editedSentences]);
  // Approve = COMMIT all staged drafts for this section to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fn = SECTION_FIELD[sid];
    setSaving(true); setSaveError(null);
    try {
      const store = readDrafts();
      const recDrafts = store[id] || {};
      // dotFields staged for THIS section (root === fn, "fn." prefix, or the indication field itself)
      const toCommit = Object.keys(recDrafts).filter(dot => dot === fn || dot.startsWith(`${fn}.`));
      // Persist each staged field to the DB now. The /edit route accepts the full dot-path as `field`.
      for (const dotField of toCommit) {
        const resp = await secureApiClient.put(`/api/edit/podiatry_examinations/${id}/edit`, { field: dotField, value: recDrafts[dotField] });
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/podiatry_examinations/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => {
        const n = { ...prev };
        toCommit.forEach(dot => { delete n[`${dot}@@${idx}`]; });
        delete n[`${fn}-${idx}`]; // indication top-level pending key
        return n;
      });
      // Drop this section's drafts from localStorage (now committed)
      if (store[id]) { toCommit.forEach(dot => delete store[id][dot]); if (Object.keys(store[id]).length === 0) delete store[id]; writeDrafts(store); }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { const [dot, kIdx] = k.split('@@'); if (kIdx === String(idx) && (dot === fn || dot.startsWith(`${fn}.`))) delete n[k]; }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { if (k.startsWith(`${fn}-${idx}`)) delete n[k]; }); return n; });
    } catch (err) { console.error(err); setSaveError('Approve failed. Please try again.'); }
    finally { setSaving(false); }
  }, [safeId]);
  const renderApproveButton = (record, sid, idx) => {
    if (sectionHasEdits(idx, sid)) return (<button className="approve-btn pending" onClick={e => { e.stopPropagation(); handleApproveSection(record, sid, idx); }}>Pending Approve</button>);
    if (approvedSections[`${sid}-${idx}`]) return <span className="approve-btn approved">Approved</span>;
    return null;
  };

  /* ═══════ COPY ═══════ */
  const copyToClipboard = useCallback(async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch { const ta = window.document.createElement('textarea'); ta.value = text; ta.style.position = 'absolute'; ta.style.left = '-9999px'; (containerRef.current || window.document.body).appendChild(ta); ta.select(); window.document.execCommand('copy'); (containerRef.current || window.document.body).removeChild(ta); return true; } }, []);
  const copySection = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedSection(id); setTimeout(() => setCopiedSection(null), 2000); } }, [copyToClipboard]);
  const copyItem = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedItems(prev => ({ ...prev, [id]: true })); setTimeout(() => setCopiedItems(prev => ({ ...prev, [id]: false })), 2000); } }, [copyToClipboard]);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const fn = SECTION_FIELD[sid]; const val = getFieldValue(record, fn, idx);
    if (isEmptyDeep(val)) return '';
    let text = `${SECTION_TITLES[sid]}\n${'='.repeat(40)}\n`;
    if (sid === 'indication' && typeof val === 'string') { (splitBySentence(val).length > 1 ? splitBySentence(val) : [val]).forEach(s => { text += `${s}\n`; }); }
    else if (val && typeof val === 'object' && !Array.isArray(val)) { Object.entries(val).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => buildCopyLines(humanizeKey(k), v, 0).forEach(l => { text += `${l}\n`; })); }
    else buildCopyLines('', val, 0).forEach(l => { text += `${l}\n`; });
    return text + '\n';
  }, [getFieldValue, splitBySentence]);
  const copyAllText = useCallback(async () => {
    let text = '=== PODIATRY EXAMINATION ===\n\n';
    pdfData.forEach((r, idx) => { text += `Podiatry Examination ${idx + 1}\n${'='.repeat(40)}\n`; if (!isEmptyDeep(r.date)) text += `${formatDate(r.date)}\n`; text += '\n'; SECTION_ORDER.forEach(sid => { text += buildSectionCopyText(r, idx, sid); }); });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText]);

  /* ═══════ RENDER: recursive node — labels = nested-subtitle; scalar leaves = editable cells ═══════ */
  const renderNode = (record, label, value, path, idx, sid, depth) => {
    if (isEmptyDeep(value)) return null;
    const labelClass = depth > 0 ? 'nested-subtitle sub-label' : 'nested-subtitle';

    if (isScalar(value)) {
      return (
        <React.Fragment key={path.join('.')}>
          {label && <div className={labelClass}>{highlightText(label)}</div>}
          {editCell(record, value, path, idx, sid, 'row')}
        </React.Fragment>
      );
    }

    if (Array.isArray(value)) {
      const items = value.filter(x => !isEmptyDeep(x));
      if (items.length === 0) return null;
      // map kept indices to ORIGINAL indices so dot-paths stay correct after hide-empty
      const indexed = []; value.forEach((it, oi) => { if (!isEmptyDeep(it)) indexed.push([oi, it]); });
      return (
        <React.Fragment key={path.join('.')}>
          {label && <div className={labelClass}>{highlightText(label)}</div>}
          {indexed.map(([oi, item]) => {
            const ipath = [...path, oi];
            if (isScalar(item)) return editCell(record, item, ipath, idx, sid, 'row');
            const entries = Object.entries(item).filter(([, v]) => !isEmptyDeep(v));
            if (entries.length === 0) return null;
            const headScalar = isScalar(entries[0][1]);
            const rest = headScalar ? entries.slice(1) : entries;
            // Orphan prevention: a head with no sub-fields renders as a plain row, not a lone subtitle
            if (headScalar && rest.length === 0) {
              return <div className="rec-mini-card" key={ipath.join('.')}>{editCell(record, entries[0][1], [...ipath, entries[0][0]], idx, sid, 'row')}</div>;
            }
            return (
              <div className="rec-mini-card" key={ipath.join('.')}>
                {headScalar ? editCell(record, entries[0][1], [...ipath, entries[0][0]], idx, sid, 'head') : null}
                {rest.map(([k, v]) => (
                  isScalar(v) ? (
                    <div className="nested-mini-card" key={k}>
                      <div className="nested-subtitle sub-label">{highlightText(humanizeKey(k))}</div>
                      {editCell(record, v, [...ipath, k], idx, sid, 'row')}
                    </div>
                  ) : (
                    <div className="nested-mini-card" key={k}>
                      {renderNode(record, humanizeKey(k), v, [...ipath, k], idx, sid, depth + 2)}
                    </div>
                  )
                ))}
              </div>
            );
          })}
        </React.Fragment>
      );
    }

    const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    return (
      <React.Fragment key={path.join('.')}>
        {label && <div className={labelClass}>{highlightText(label)}</div>}
        <div className="nested-group">{entries.map(([k, v]) => renderNode(record, humanizeKey(k), v, [...path, k], idx, sid, depth + 1))}</div>
      </React.Fragment>
    );
  };

  /* ═══════ RENDER: indicationForExam (per-sentence editable) ═══════ */
  const renderIndication = (record, idx) => {
    const fn = 'indicationForExam'; const val = getFieldValue(record, fn, idx);
    if (isEmptyDeep(val)) return null;
    const sentences = splitBySentence(String(val));
    const rows = sentences.length > 1 ? sentences : [String(val)];
    const saveSentence = (sIdx) => {
      const id = safeId(record); if (!id) return;
      const current = splitBySentence(String(getFieldValue(record, fn, idx) || ''));
      const editedVal = editValue.trim();
      const updated = [...current];
      if (!editedVal || /^[;.,!?]+$/.test(editedVal)) updated.splice(sIdx, 1); else updated.splice(sIdx, 1, ...splitBySentence(editedVal));
      const fullText = reconstructFullText(updated);
      // Stage as a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
      setSaveError(null);
      setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText }));
      setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true, [`${fn}@@${idx}`]: true }));
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { if (k.startsWith(`${fn}-${idx}-s`)) delete n[k]; }); n[`${fn}-${idx}-s${sIdx}`] = 'edited'; return n; });
      setApprovedSections(prev => { const n = { ...prev }; delete n[`indication-${idx}`]; return n; });
      const store = readDrafts();
      if (!store[id]) store[id] = {};
      store[id][fn] = fullText;
      writeDrafts(store);
      setEditingField(null); setEditValue('');
    };
    return (
      <div className="rec-mini-card">
        {rows.map((sentence, sIdx) => {
          const key = `${fn}-${idx}-s${sIdx}`; const isEditing = editingField === key; const badge = editedSentences[key];
          return (
            <div key={sIdx}>
              <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(key); setEditValue(sentence.replace(/[;.]+$/, '').trim()); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); saveSentence(sIdx); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveSentence(sIdx); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(sentence)}</span><span className="edit-indicator">&#9998;</span></div>
                    <button className={`copy-btn ${copiedItems[key] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(sentence, key); }}>{copiedItems[key] ? 'Copied' : 'Copy'}</button>
                  </>
                )}
              </div>
              {badge && <span className="modified-badge">edited - click Pending Approve to save</span>}
            </div>
          );
        })}
      </div>
    );
  };

  /* ═══════ RENDER: SECTION ═══════ */
  const renderSection = (record, idx, sid) => {
    if (!shouldShowSection(record, sid)) return null;
    const fn = SECTION_FIELD[sid]; const val = getFieldValue(record, fn, idx);
    if (isEmptyDeep(val)) return null;
    const copyId = `${sid}-${idx}`;
    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(SECTION_TITLES[sid])}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {sid === 'indication'
            ? renderIndication(record, idx)
            : (val && typeof val === 'object' && !Array.isArray(val))
              ? Object.entries(val).filter(([, v]) => !isEmptyDeep(v)).map(([k, v]) => (<div className="rec-mini-card" key={k}>{renderNode(record, humanizeKey(k), v, [fn, k], idx, sid, 0)}</div>))
              : <div className="rec-mini-card">{renderNode(record, '', val, [fn], idx, sid, 0)}</div>}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!records || records.length === 0) {
    return (
      <div className="podiatry-examinations-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Podiatry Examination</h2></div>
        <div className="empty-state">No podiatry examination records available</div>
      </div>
    );
  }
  return (
    <div className="podiatry-examinations-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Podiatry Examination</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied' : 'Copy All'}</button>
          <PDFDownloadLink document={<PodiatryExaminationsDocumentPDFTemplate document={pdfData} />} fileName={`podiatry-examination-${new Date().toISOString().split('T')[0]}.pdf`} className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search podiatry examination records..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              {!isEmptyDeep(record.date) && (<div className="record-meta-row"><span className="record-date">{formatDate(record.date)}</span></div>)}
              <h3 className="record-name">{highlightText(`Podiatry Examination ${idx + 1}`)}</h3>
            </div>
            {SECTION_ORDER.map(sid => renderSection(record, idx, sid))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PodiatryExaminationsDocument;
