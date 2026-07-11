/**
 * ClosureTechniqueDocument.jsx
 * March 2026 — Blue glow editing theme
 * Collection: closure_technique
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import ClosureTechniqueDocumentPDFTemplate from '../pdf-templates/ClosureTechniqueDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './ClosureTechniqueDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'closure_techniquePendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

const SECTION_TITLES = {
  procedure: 'Procedure',
  closure: 'Closure Details',
  suture: 'Suture Details',
  sites: 'Site Closure',
  additional: 'Additional Details',
  notes: 'Notes',
};

const FIELD_LABELS = {
  procedureName: 'Procedure Name', closureLayer: 'Closure Layer', closureTechnique: 'Closure Technique',
  sutureType: 'Suture Type', sutureMaterial: 'Suture Material', sutureSize: 'Suture Size', needleType: 'Needle Type',
  closureSequence: 'Closure Sequence', portSiteClosure: 'Port Site Closure', skinClosure: 'Skin Closure',
  drains: 'Drains', hemostasis: 'Hemostasis', tensionFree: 'Tension Free', facility: 'Facility', notes: 'Notes',
};

const SECTION_FIELDS = {
  procedure: ['procedureName', 'facility'],
  closure: ['closureLayer', 'closureTechnique', 'closureSequence'],
  suture: ['sutureType', 'sutureMaterial', 'sutureSize', 'needleType'],
  sites: ['portSiteClosure', 'skinClosure'],
  additional: ['drains', 'hemostasis', 'tensionFree'],
  notes: ['notes'],
};

const SENTENCE_FIELDS = ['closureSequence', 'notes'];
// closureLayer included: "Peritenon, subcutaneous, skin" is a genuine >=3 comma list (Rule #73)
const COMMA_SPLIT_FIELDS = ['sutureMaterial', 'sutureSize', 'procedureName', 'closureLayer'];
const SPLIT_PATTERN = { procedureName: /;\s*/, sutureMaterial: /,\s*/, sutureSize: /,\s*/, closureLayer: /,\s*/ };
// Suture gauge shape "2-0"/"3-0": −/+ stepper edits ONLY the leading number, the "-0" part is
// preserved verbatim. Gated by the EXPLICIT sutureSize field + this exact shape (never shape-only).
const SUTURE_GAUGE_RE = /^(\d+)\s*-\s*(\d+)$/;
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);

const parseLabel = (text) => { if (!text || typeof text !== 'string') return null; const m = text.match(/^([A-Za-z][A-Za-z\s/&(),.#-]{2,}?):\s+(.*)/); return m ? { label: m[1].trim(), content: m[2].trim() } : null; };

const ClosureTechniqueDocument = ({ document: docProp }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSection, setCopiedSection] = useState(null);
  const [copiedItems, setCopiedItems] = useState({});
  const [showCopied, setShowCopied] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [editedFields, setEditedFields] = useState({});
  const [editedSentences, setEditedSentences] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  const [saving, setSaving] = useState(false);
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const containerRef = useRef(null);

  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.closure_technique) return Array.isArray(r.closure_technique) ? r.closure_technique : [r.closure_technique];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.closure_technique) return Array.isArray(dd.closure_technique) ? dd.closure_technique : [dd.closure_technique]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const recId = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((r, idx) => {
      const id = recId(r);
      const recDrafts = id ? store[id] : null;
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
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [records]);

  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; return true; }, []);
  const formatDate = useCallback((d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);
  // Abbreviation+decimal guard: never break on "Dr. Smith", "vs. standard", "3.5 months"
  const splitBySentence = useCallback((text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); }, []);
  function reconstructFullText(sentences) { if (!sentences || sentences.length === 0) return ''; return sentences.map((s, i) => { let c = s.replace(/[;.]+$/, '').trim(); if (i < sentences.length - 1) c += '.'; return c; }).join(' '); }
  const getFieldValue = useCallback((record, fn, idx) => { const k = `${fn}-${idx}`; if (localEdits[k] !== undefined) return localEdits[k]; return record[fn]; }, [localEdits]);
  const safeId = useCallback((r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); }, []);
  const highlightText = useCallback((text) => { if (!searchTerm.trim() || !text) return text; const phrase = searchTerm.trim(); const regex = new RegExp(`(${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'); const parts = String(text).split(regex); return parts.map((part, i) => regex.test(part) ? <mark key={i}>{part}</mark> : part); }, [searchTerm]);

  const shouldShowSection = useCallback((record, sid) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const title = (SECTION_TITLES[sid] || '').toLowerCase();
    if (title.includes(phrase) || phrase.includes(title)) return true;
    const fields = SECTION_FIELDS[sid] || [];
    for (const f of fields) {
      const label = (FIELD_LABELS[f] || f).toLowerCase();
      if (label.includes(phrase) || phrase.includes(label)) return true;
      const val = getFieldValue(record, f, 0);
      if (val !== null && val !== undefined && fmtVal(val).toLowerCase().includes(phrase)) return true;
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal]);

  const fieldMatches = useCallback((record, fn, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const label = (FIELD_LABELS[fn] || fn).toLowerCase();
    if (label.includes(phrase) || phrase.includes(label)) return true;
    const val = getFieldValue(record, fn, idx);
    return val !== null && val !== undefined && fmtVal(val).toLowerCase().includes(phrase);
  }, [searchTerm, getFieldValue, fmtVal]);

  const sectionTitleMatches = useCallback((sid) => { if (!searchTerm.trim()) return false; const p = searchTerm.toLowerCase().trim(); const t = (SECTION_TITLES[sid] || '').toLowerCase(); return t.includes(p) || p.includes(t); }, [searchTerm]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Closure Technique ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const f of Object.keys(FIELD_LABELS)) { const val = record[f]; if (val && fmtVal(val).toLowerCase().includes(phrase)) return true; }
      return false;
    });
  }, [records, searchTerm, fmtVal]);

  const pdfData = useMemo(() => filteredRecords.map((r, idx) => { const m = { ...r }; Object.keys(localEdits).forEach(k => { if (pendingEdits[k]) return; const mt = k.match(/^(.+)-(\d+)$/); if (mt && parseInt(mt[2]) === idx) m[mt[1]] = localEdits[k]; }); return m; }), [filteredRecords, localEdits, pendingEdits]);

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const stageDraft = useCallback((record, sid, idx, fieldPart, value) => {
    const id = safeId(record); if (!id) return;
    const editKey = `${fieldPart}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: value }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    // Re-edit after approval → drop the section 'approved' flag so the button goes back to yellow Pending Approve
    if (sid) setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fieldPart] = value;
    writeDrafts(store);
  }, [safeId]);

  const handleSaveField = useCallback((record, fn, idx, sid) => {
    const id = safeId(record); if (!id) return;
    stageDraft(record, sid, idx, fn, editValue);
    setEditedFields(prev => ({ ...prev, [`${fn}-${idx}`]: 'edited' }));
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, stageDraft]);

  // Save one sentence = stage the rebuilt full text as a DRAFT (no DB write). Approve commits it.
  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || ''); const sentences = splitBySentence(currentVal); const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) { const updated = [...sentences]; updated.splice(sentenceIdx, 1); const fullText = reconstructFullText(updated);
      stageDraft(record, sid, idx, fn, fullText); setEditedFields(prev => ({ ...prev, [`${fn}-${idx}`]: 'edited' })); setEditingField(null); setEditValue(''); return; }
    const newSentences = splitBySentence(editedVal); const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences); const fullText = reconstructFullText(updated);
    stageDraft(record, sid, idx, fn, fullText);
    const orig = sentences[sentenceIdx] || ''; const changed = newSentences[0].replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim();
    setEditedSentences(prev => { const n = { ...prev }; if (changed) n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited'; const extra = newSentences.length - 1; for (let ei = 0; ei < extra; ei++) n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added'; return n; });
    setEditingField(null); setEditValue('');
  }

  const sectionHasEdits = useCallback((idx, sid) => { const fields = SECTION_FIELDS[sid] || []; return fields.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`)) || Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))); }, [editedFields, editedSentences]);
  // Approve = COMMIT this section's staged drafts to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    setSaving(true);
    try {
      const fields = SECTION_FIELDS[sid] || [];
      const suffix = `-${idx}`;
      // Pending drafts for this record whose base field belongs to this section.
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
        const fieldPart = k.slice(0, -suffix.length); // "field" or "field.arrayIndex"
        const lastDot = fieldPart.lastIndexOf('.');
        const base = (lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1))) ? fieldPart.slice(0, lastDot) : fieldPart;
        return fields.includes(base);
      });
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length);
        const lastDot = fieldPart.lastIndexOf('.');
        const isArr = lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1));
        const payload = { field: isArr ? fieldPart.slice(0, lastDot) : fieldPart, value: localEdits[editKey] };
        if (isArr) payload.arrayIndex = parseInt(fieldPart.slice(lastDot + 1), 10);
        await secureApiClient.put(`/api/edit/closure_technique/${id}/edit`, payload);
      }
      await secureApiClient.put(`/api/edit/closure_technique/${id}/approve`, { sectionId: sid, approved: true });
      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's committed drafts from localStorage
      const store = readDrafts();
      if (store[id]) { toCommit.forEach(k => { const fieldPart = k.slice(0, -suffix.length); delete store[id][fieldPart]; }); if (Object.keys(store[id]).length === 0) delete store[id]; writeDrafts(store); }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error(err); } finally { setSaving(false); }
  }, [safeId, localEdits, pendingEdits]);
  const renderApproveButton = useCallback((record, sid, idx) => { const hasEdits = sectionHasEdits(idx, sid); const isApproved = approvedSections[`${sid}-${idx}`]; if (hasEdits) return (<button className="approve-btn pending" disabled={saving} onClick={e => { e.stopPropagation(); handleApproveSection(record, sid, idx); }}>{saving ? 'Approving...' : 'Pending Approve'}</button>); if (isApproved) return <span className="approve-btn approved">Approved</span>; return null; }, [sectionHasEdits, approvedSections, handleApproveSection, saving]);

  const copyToClipboard = useCallback(async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch { const ta = window.document.createElement('textarea'); ta.value = text; ta.style.position = 'absolute'; ta.style.left = '-9999px'; (containerRef.current || window.document.body).appendChild(ta); ta.select(); window.document.execCommand('copy'); (containerRef.current || window.document.body).removeChild(ta); return true; } }, []);
  const copySection = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedSection(id); setTimeout(() => setCopiedSection(null), 2000); } }, [copyToClipboard]);
  const copyItem = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedItems(prev => ({ ...prev, [id]: true })); setTimeout(() => setCopiedItems(prev => ({ ...prev, [id]: false })), 2000); } }, [copyToClipboard]);

  // One field → sub-label + DASH (hidden when label == section title) + numbered rows.
  // Labeled sentences → label group + DASH + numbered comma rows (restart); plain sentences continue
  // the running count. Declared BEFORE the callbacks that list it in their dep arrays (TDZ, 6a4758db).
  const emitCopyField = useCallback((f, val, title) => {
    const label = FIELD_LABELS[f] || f;
    const showLabel = label.toLowerCase() !== (title || '').toLowerCase();
    let t = '';
    if (SENTENCE_FIELDS.includes(f)) {
      if (showLabel) t += `${label}\n${COPY_LINE_DASH}\n`;
      let running = 0;
      splitBySentence(fmtVal(val)).forEach(s => {
        const p = parseLabel(s);
        if (p) { t += `${p.label}\n${COPY_LINE_DASH}\n`; const ci = p.content.split(/,\s*/).filter(Boolean); (ci.length ? ci : [p.content]).forEach((c, j) => { t += `${j + 1}. ${c.trim()}\n`; }); running = 0; return; }
        t += `${++running}. ${s}\n`;
      });
      return t + '\n';
    }
    if (COMMA_SPLIT_FIELDS.includes(f)) {
      const sp = SPLIT_PATTERN[f] || /,\s*/;
      if (showLabel) t += `${label}\n${COPY_LINE_DASH}\n`;
      String(val).split(sp).filter(Boolean).forEach((item, i) => { t += `${i + 1}. ${item.trim()}\n`; });
      return t + '\n';
    }
    if (showLabel) t += `${label}\n${COPY_LINE_DASH}\n`;
    return t + `1. ${fmtVal(val)}\n\n`;
  }, [fmtVal, splitBySentence]);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid]; let text = `${title}\n${COPY_LINE_EQ}\n\n`;
    (SECTION_FIELDS[sid] || []).forEach(f => { const val = getFieldValue(record, f, idx); if (!hasVal(val)) return; text += emitCopyField(f, val, title); });
    return text;
  }, [getFieldValue, hasVal, emitCopyField]);

  const copyAllText = useCallback(async () => {
    let text = `CLOSURE TECHNIQUE\n${COPY_LINE_EQ}\n\n`;
    pdfData.forEach((r, idx) => { text += `Closure Technique ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
      if (r.date) text += `Date\n${COPY_LINE_DASH}\n1. ${formatDate(r.date)}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => { const fields = SECTION_FIELDS[sid]; const hasAny = fields.some(f => hasVal(r[f])); if (!hasAny) return;
        text += `${SECTION_TITLES[sid]}\n${COPY_LINE_EQ}\n\n`;
        fields.forEach(f => { const val = r[f]; if (!hasVal(val)) return; text += emitCopyField(f, val, SECTION_TITLES[sid]); });
      }); text += '\n';
    });
    const ok = await copyToClipboard(text.trim()); if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, hasVal, formatDate, emitCopyField]);

  const renderEditableField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey; const label = FIELD_LABELS[fn] || fn; const sl = label.toLowerCase() !== (title || '').toLowerCase(); const displayVal = fmtVal(val); const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    return (<div key={fn} className={sl ? 'rec-mini-card' : ''}>{sl && <div className="nested-subtitle">{highlightText(label)}</div>}<div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); } }}>{isEditing ? (<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} /><div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(record, fn, idx, sid); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>) : (<><div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button></>)}</div>{isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}</div>);
  };

  const renderSentenceEditableField = (record, fn, idx, sid, title) => {
    const val = String(getFieldValue(record, fn, idx) || ''); if (!val.trim()) return null;
    const sentences = splitBySentence(val); if (sentences.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn; const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid);
    if (searchTerm.trim() && !phraseMatch && !fieldMatches(record, fn, idx)) return null;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());
    return (<div key={fn}><div className="rec-mini-card">{sl && <div className="nested-subtitle">{highlightText(label)}</div>}{sentences.map((sentence, sIdx) => {
      const sentenceKey = `${fn}-${idx}-s${sIdx}`; const isEditing = editingField === sentenceKey; const badge = editedSentences[sentenceKey];
      const sentenceMatches = phraseMatch || labelMatch || (searchTerm.trim() && sentence.toLowerCase().includes(searchTerm.toLowerCase().trim()));
      if (!sentenceMatches && searchTerm.trim()) return null;
      const parsed = parseLabel(sentence);
      if (parsed) {
        const commaItems = parsed.content.split(/,\s*/).map(s => s.trim()).filter(Boolean);
        if (commaItems.length > 1) {
          return (<div key={sIdx} className="rec-mini-card" style={{ marginTop: 8 }}>
            <div className="nested-subtitle">{highlightText(parsed.label)}</div>
            {commaItems.map((ci, ciIdx) => {
              const commaKey = `${sentenceKey}-c${ciIdx}`;
              const ciEditing = editingField === commaKey;
              const ciBadge = editedFields[commaKey];
              return (<div key={ciIdx}>
                <div className={`numbered-row ${ciBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!ciEditing) { setEditingField(commaKey); setEditValue(ci); } }}>
                  {ciEditing ? (<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} /><div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; const curSentences = splitBySentence(String(getFieldValue(record, fn, idx) || '')); const items = parsed.content.split(/,\s*/).map(s2 => s2.trim()).filter(Boolean); items[ciIdx] = editValue.trim(); curSentences[sIdx] = `${parsed.label}: ${items.join(', ')}`; const fullText = reconstructFullText(curSentences); stageDraft(record, sid, idx, fn, fullText); setEditedFields(prev => ({ ...prev, [commaKey]: 'edited' })); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>
                  ) : (<><div className="row-content"><span className="content-value">{highlightText(ci)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[commaKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(ci, commaKey); }}>{copiedItems[commaKey] ? 'Copied!' : 'Copy'}</button></>)}
                </div>
                {ciBadge && <span className="modified-badge">edited - click Pending Approve to save</span>}
              </div>);
            })}
          </div>);
        }
      }
      return (<div key={sIdx}><div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(sentence.replace(/[;.]+$/, '').trim()); } }}>{isEditing ? (<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} /><div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveSentence(record, fn, idx, sid, sIdx); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>) : (<><div className="row-content"><span className="content-value">{highlightText(sentence)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[sentenceKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(sentence, sentenceKey); }}>{copiedItems[sentenceKey] ? 'Copied!' : 'Copy'}</button></>)}</div>{badge && <span className={`modified-badge ${badge === 'added' ? 'added' : ''}`}>{badge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}</div>);
    })}</div></div>);
  };

  const saveCommaItem = useCallback((record, fn, idx, sid, commaIdx, valueOverride) => {
    const id = safeId(record); if (!id) return;
    const pattern = SPLIT_PATTERN[fn] || /,\s*/;
    const joiner = fn === 'procedureName' ? '; ' : ', ';
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const items = currentVal.split(pattern).map(s => s.trim()).filter(Boolean);
    items[commaIdx] = (valueOverride !== undefined ? valueOverride : editValue).trim();
    const newVal = items.join(joiner);
    stageDraft(record, sid, idx, fn, newVal);
    setEditedFields(prev => ({ ...prev, [`${fn}-${idx}-c${commaIdx}`]: 'edited' }));
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, getFieldValue, stageDraft]);

  const renderCommaSplitField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const label = FIELD_LABELS[fn] || fn; const sl = label.toLowerCase() !== (title || '').toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const pattern = SPLIT_PATTERN[fn] || /,\s*/;
    const items = String(val).split(pattern).map(s => s.trim()).filter(Boolean);
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());
    return (<div key={fn} className="rec-mini-card">
      {sl && <div className="nested-subtitle">{highlightText(label)}</div>}
      {items.map((item, ci) => {
        const commaKey = `${fn}-${idx}-c${ci}`;
        const isEditing = editingField === commaKey;
        const badge = editedFields[commaKey];
        const itemMatches = !searchTerm.trim() || record._showAllSections || sectionTitleMatches(sid) || labelMatch || item.toLowerCase().includes(searchTerm.toLowerCase().trim());
        if (!itemMatches) return null;
        // Suture gauge ("2-0") → −/+ stepper edits ONLY the leading number; the "-0" stays untouched.
        const gauge = fn === 'sutureSize' ? item.match(SUTURE_GAUGE_RE) : null;
        const saveGauge = () => { const n = parseInt(editValue, 10); if (isNaN(n) || n < 0) return; saveCommaItem(record, fn, idx, sid, ci, `${n}-${gauge[2]}`); };
        return (<div key={ci}>
          <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(commaKey); setEditValue(gauge ? gauge[1] : item); } }}>
            {isEditing ? (<div className="edit-field-container">{gauge ? (<div className="num-stepper-row"><button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); const cur = parseInt(editValue, 10); setEditValue(String(Math.max(0, (isNaN(cur) ? 0 : cur) - 1))); }}>−</button><input type="number" step="1" min="0" className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveGauge(); } if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} onClick={e => e.stopPropagation()} /><span className="unit-literal">-{gauge[2]}</span><button type="button" className="num-step" disabled={saving} onClick={e => { e.stopPropagation(); const cur = parseInt(editValue, 10); setEditValue(String(Math.max(0, (isNaN(cur) ? 0 : cur) + 1))); }}>+</button></div>) : (<textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} />)}<div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (gauge) saveGauge(); else saveCommaItem(record, fn, idx, sid, ci); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>
            ) : (<><div className="row-content"><span className="content-value">{highlightText(item)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[commaKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(item, commaKey); }}>{copiedItems[commaKey] ? 'Copied!' : 'Copy'}</button></>)}
          </div>
          {badge && <span className="modified-badge">edited - click Pending Approve to save</span>}
        </div>);
      })}
    </div>);
  };

  const renderMixedSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid]; if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || []; const hasAnyVal = fields.some(f => hasVal(getFieldValue(record, f, idx))); if (!hasAnyVal) return null;
    const copyId = `${sid}-${idx}`;
    return (<div key={sid} className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>{renderApproveButton(record, sid, idx)}</div></div>{fields.map(f => { if (SENTENCE_FIELDS.includes(f)) return renderSentenceEditableField(record, f, idx, sid, title); if (COMMA_SPLIT_FIELDS.includes(f)) return renderCommaSplitField(record, f, idx, sid, title); return renderEditableField(record, f, idx, sid, title); })}</div></div>);
  };

  if (!records || records.length === 0) return (<div className="closure-technique-document" ref={containerRef}><div className="document-header"><h2 className="document-title">Closure Technique</h2></div><div className="empty-state">No closure technique records available</div></div>);

  return (
    <div className="closure-technique-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Closure Technique</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<ClosureTechniqueDocumentPDFTemplate document={pdfData} />} fileName="Closure_Technique.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container"><input type="text" className="search-input" placeholder="Search closure technique..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />{searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}</div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header"><div className="record-meta-row">{record.date && <span className="record-date">{highlightText(formatDate(record.date))}</span>}</div><h3 className="record-name">{highlightText(`Closure Technique ${idx + 1}`)}</h3></div>
            {renderMixedSection(record, idx, 'procedure')}
            {renderMixedSection(record, idx, 'closure')}
            {renderMixedSection(record, idx, 'suture')}
            {renderMixedSection(record, idx, 'sites')}
            {renderMixedSection(record, idx, 'additional')}
            {renderMixedSection(record, idx, 'notes')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ClosureTechniqueDocument;
