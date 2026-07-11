/**
 * BurnWoundCareDocument.jsx
 * Inline editing with per-section approve, per-row copy.
 * 4-level search, PDFDownloadLink + pdfData memo, secureApiClient.
 * Typed editing: numeric fields → number input (parseFloat/isNaN, units, zero-sentinel hide);
 * boolean fields → Yes/No select (saves real boolean); narrative → textarea/per-sentence.
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import BurnWoundCareDocumentPDFTemplate from '../pdf-templates/BurnWoundCareDocumentPDFTemplate';
import './BurnWoundCareDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'burn_wound_carePendingEdits';
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
  burnOverview: ['burnTotalBodySurfaceArea', 'burnDepthClassification'],
  severity: ['lundBrowderScore', 'baxterParklandFormula', 'modifiedBauxScore', 'abbreviatedBurnSeverityIndex'],
  inhalation: ['inhalationInjuryGrade', 'carboxyhemoglobinLevel'],
  escharotomy: ['escharotomyRequired', 'escharotomyLocations'],
  woundAssessment: ['woundBedPreparationStatus', 'debridementMethod', 'topicalAntimicrobialAgent', 'burnWoundCultureResults', 'quantitativeWoundBiopsy'],
  grafting: ['skinGraftType', 'graftMeshRatio', 'graftTakePercentage', 'dermalSubstitutePlaced'],
  therapy: ['negativeProressureWoundTherapySettings'],
  nutrition: ['prealabuminLevel', 'curreriFormulaCalories'],
  scarMgmt: ['vancouverScarScaleScore', 'pressureGarmentCompliance'],
  contracture: ['contractureLocation'],
};
const FIELD_LABELS = { burnTotalBodySurfaceArea: 'TBSA %', burnDepthClassification: 'Burn Depth', lundBrowderScore: 'Lund-Browder Score', baxterParklandFormula: 'Parkland Formula (mL)', modifiedBauxScore: 'Modified Baux Score', abbreviatedBurnSeverityIndex: 'ABSI Score', inhalationInjuryGrade: 'Inhalation Injury Grade', carboxyhemoglobinLevel: 'COHb Level', escharotomyRequired: 'Escharotomy Required', burnWoundCultureResults: 'Wound Culture Results', quantitativeWoundBiopsy: 'Quantitative Biopsy', topicalAntimicrobialAgent: 'Topical Antimicrobial', woundBedPreparationStatus: 'Wound Bed Status', debridementMethod: 'Debridement Method', skinGraftType: 'Skin Graft Type', graftMeshRatio: 'Graft Mesh Ratio', graftTakePercentage: 'Graft Take %', dermalSubstitutePlaced: 'Dermal Substitute', negativeProressureWoundTherapySettings: 'NPWT Settings', prealabuminLevel: 'Prealbumin Level', curreriFormulaCalories: 'Curreri Formula (kcal)', vancouverScarScaleScore: 'Vancouver Scar Score', pressureGarmentCompliance: 'Pressure Garment Compliance' };
const ARRAY_FIELDS = ['escharotomyLocations', 'contractureLocation'];
const NUMBER_FIELDS = ['burnTotalBodySurfaceArea', 'lundBrowderScore', 'baxterParklandFormula', 'modifiedBauxScore', 'abbreviatedBurnSeverityIndex', 'carboxyhemoglobinLevel', 'quantitativeWoundBiopsy', 'graftTakePercentage', 'prealabuminLevel', 'curreriFormulaCalories', 'vancouverScarScaleScore'];
const BOOLEAN_FIELDS = ['escharotomyRequired'];
const NUMBER_UNITS = { burnTotalBodySurfaceArea: '%', baxterParklandFormula: 'mL', carboxyhemoglobinLevel: '%', quantitativeWoundBiopsy: 'CFU/g', graftTakePercentage: '%', prealabuminLevel: 'mg/dL', curreriFormulaCalories: 'kcal/day' };
// Numeric fields where 0 is a sentinel (not measured) rather than a meaningful clinical value → hide when 0.
const ZERO_SENTINEL_FIELDS = new Set(['lundBrowderScore', 'modifiedBauxScore', 'abbreviatedBurnSeverityIndex', 'quantitativeWoundBiopsy', 'graftTakePercentage', 'prealabuminLevel', 'curreriFormulaCalories', 'vancouverScarScaleScore', 'carboxyhemoglobinLevel', 'burnTotalBodySurfaceArea', 'baxterParklandFormula']);

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; };
const hasFieldVal = (fn, v) => { if (!hasVal(v)) return false; if (NUMBER_FIELDS.includes(fn) && Number(v) === 0 && ZERO_SENTINEL_FIELDS.has(fn)) return false; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const fmtFieldVal = (fn, v) => { if (BOOLEAN_FIELDS.includes(fn)) return (v === true || v === 'true' || v === 'Yes') ? 'Yes' : 'No'; const base = fmtVal(v); if (NUMBER_FIELDS.includes(fn) && base !== '' && NUMBER_UNITS[fn]) return `${base} ${NUMBER_UNITS[fn]}`; return base; };

const BurnWoundCareDocument = ({ document: rawDoc }) => {
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
    arr = arr.flatMap(r => { if (r?.burn_wound_care) return Array.isArray(r.burn_wound_care) ? r.burn_wound_care : [r.burn_wound_care]; if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.burn_wound_care) return Array.isArray(dd.burn_wound_care) ? dd.burn_wound_care : [dd.burn_wound_care]; return [dd]; } return r; });
    return arr.filter(r => r && typeof r === 'object');
  }, [rawDoc]);

  const getRecordId = (r) => { const id = r._id; if (!id) return null; if (typeof id === 'string') return id; if (id.$oid) return id.$oid; return String(id); };

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  // Draft fieldPart is "field" (→ editKey `field-idx`) or "field.arrayIndex" (→ editKey `field-idx-arrayIndex`).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const rid = getRecordId(record);
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
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
  const copyToClipboard = async (text, id) => { try { await navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); } catch {} };

  // Used by pdfData / Copy only → pending (un-approved) array drafts must NOT leak into the PDF/Copy.
  const getEffectiveArray = useCallback((record, fieldName, idx) => {
    const original = Array.isArray(record[fieldName]) ? [...record[fieldName]] : [];
    original.forEach((_, ai) => { const ek = `${fieldName}-${idx}-${ai}`; if (localEdits[ek] !== undefined && !pendingEdits[ek]) original[ai] = localEdits[ek]; });
    return original;
  }, [localEdits, pendingEdits]);

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid) => {
    const rid = getRecordId(record); if (!rid) { console.error('[BurnWoundCare] Cannot save — no record ID'); return; }
    const ek = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: editValue }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][fn] = editValue;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue]);

  const handleSaveArrayItem = useCallback((record, fn, idx, sid, arrayIndex) => {
    const rid = getRecordId(record); if (!rid) { console.error('[BurnWoundCare] Cannot save — no record ID'); return; }
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

  // Approve = COMMIT all staged drafts for this section's fields to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, idx, sid) => {
    const rid = getRecordId(record); if (!rid) return;
    const sf = SECTION_FIELDS[sid] || [];
    try {
      const sc = (await import('../../../services/secureApiClient')).default;
      // localEdits keys for this section: `${fn}-${idx}` or `${fn}-${idx}-${ai}` where fn ∈ sf.
      // Build {editKey, field, arrayIndex} from the section's own fields so the parse is unambiguous.
      const toCommit = [];
      sf.forEach(f => {
        Object.keys(localEdits).forEach(k => {
          if (!pendingEdits[k]) return;
          if (k === `${f}-${idx}`) toCommit.push({ ek: k, field: f });
          else if (k.startsWith(`${f}-${idx}-`)) {
            const ai = k.slice(`${f}-${idx}-`.length);
            if (/^\d+$/.test(ai)) toCommit.push({ ek: k, field: f, arrayIndex: parseInt(ai, 10) });
          }
        });
      });
      for (const { ek, field, arrayIndex } of toCommit) {
        const payload = { field, value: localEdits[ek] };
        if (arrayIndex !== undefined) payload.arrayIndex = arrayIndex;
        await sc.put(`/api/edit/burn_wound_care/${rid}/edit`, payload);
      }
      await sc.put(`/api/edit/burn_wound_care/${rid}/approve`, { sectionId: sid, approved: true });
      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's drafts for these fields from localStorage (now committed)
      const store = readDrafts();
      if (store[rid]) {
        Object.keys(store[rid]).forEach(fp => { const base = fp.includes('.') ? fp.slice(0, fp.lastIndexOf('.')) : fp; if (sf.includes(base)) delete store[rid][fp]; });
        if (Object.keys(store[rid]).length === 0) delete store[rid];
        writeDrafts(store);
      }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { sf.forEach(f => { if (k.startsWith(`${f}-${idx}`) || k.startsWith(`${f}.`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[BurnWoundCare] Approve failed:', err); }
  }, [localEdits, pendingEdits]);

  const handleSaveFieldWithValue = useCallback((record, fn, idx, sid, valueOverride, editTrackingKey) => {
    const rid = getRecordId(record); if (!rid) { console.error('[BurnWoundCare] Cannot save — no record ID'); return; }
    const ek = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: valueOverride }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [editTrackingKey || ek]: 'edited' }));
    setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][fn] = valueOverride;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, []);

  /* Parse "Label: item1, item2" sentences */
  /* Split by sentence — only split on ". " when followed by an uppercase word that contains ":" (label pattern) */
  const splitBySentence = (text) => {
    if (!text) return [];
    // Split on ". " only when followed by a labeled pattern (Uppercase word(s): value)
    const parts = text.split(/\.\s+(?=[A-Z][A-Za-z0-9 ]+:)/).map(s => s.trim()).filter(s => s.length > 0 && s.replace(/[.!?;,]+/g, '').trim().length > 0);
    return parts.length > 1 ? parts : text.split(/\.\s+/).map(s => s.trim()).filter(s => s.length > 0 && s.replace(/[.!?;,]+/g, '').trim().length > 0);
  };
  const parseLabel = (text) => { if (!text) return { isLabeled: false, label: '', value: text || '' }; const match = text.match(/^([A-Z][A-Za-z0-9 &/()>=<+%.#-]+):\s*(.+)$/); if (match) return { isLabeled: true, label: match[1].trim(), value: match[2].trim() }; return { isLabeled: false, label: '', value: text }; };

  /* Render field with labeled sentence → nested-subtitle + comma-split rows */
  const renderLabeledSentenceField = (record, idx, sid, title, fieldName) => {
    const val = String(getFieldValue(record, fieldName, idx) || '');
    if (!val.trim()) return null;
    if (!shouldShowSection(record, title, [val], [fieldName])) return null;
    const sentences = splitBySentence(val);
    if (sentences.length <= 1) return null; // fall back to renderEditableField
    const stm = sectionTitleMatches(title);
    const sa = !searchTerm.trim() || record._showAllSections || stm;

    return (<div className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn${copiedId === `section-${sid}-${idx}` ? ' copied' : ''}`} onClick={() => copySectionText(record, idx, sid)}>{copiedId === `section-${sid}-${idx}` ? 'Copied' : 'Copy Section'}</button>{renderApproveButton(idx, sid)}</div></div>
      {sentences.map((sentence, si) => {
        const parsed = parseLabel(sentence.replace(/\.$/, ''));
        if (parsed.isLabeled) {
          const commaItems = parsed.value.split(/,\s*/).filter(s => s.trim().length > 0);
          if (!sa && !phraseMatch(sentence, searchTerm)) return null;
          return (<div key={si} className="rec-mini-card"><div className="nested-subtitle">{highlightText(parsed.label)}</div>
            {commaItems.map((item, ci) => {
              const partKey = `${fieldName}-${idx}-s${si}-c${ci}`;
              const isEditing = editingField === partKey;
              const isEdited = editedFields[partKey];
              const cid = `wbs-${idx}-${si}-${ci}`;
              if (isEditing) return (<div key={ci} className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) { const allSentences = splitBySentence(val); const thisParsed = parseLabel(allSentences[si].replace(/\.$/, '')); if (thisParsed.isLabeled) { const items = thisParsed.value.split(/,\s*/).filter(s => s.trim().length > 0); items[ci] = editValue.trim().replace(/\.\s*/g, ', ').replace(/,\s*$/, ''); const rebuilt = `${thisParsed.label}: ${items.join(', ')}.`; allSentences[si] = rebuilt; const newFull = allSentences.join(' '); handleSaveFieldWithValue(record, fieldName, idx, sid, newFull, partKey); } } if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => { const allSentences = splitBySentence(val); const thisParsed = parseLabel(allSentences[si].replace(/\.$/, '')); if (thisParsed.isLabeled) { const items = thisParsed.value.split(/,\s*/).filter(s => s.trim().length > 0); items[ci] = editValue.trim().replace(/\.\s*/g, ', ').replace(/,\s*$/, ''); const rebuilt = `${thisParsed.label}: ${items.join(', ')}.`; allSentences[si] = rebuilt; const newFull = allSentences.join(' '); handleSaveFieldWithValue(record, fieldName, idx, sid, newFull, partKey); } }} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>);
              return (<React.Fragment key={ci}><div className={`numbered-row editable-row${isEdited ? ' modified' : ''}`} onClick={() => { setEditingField(partKey); setEditValue(item.trim()); }}><div className="row-content"><span className="content-value">{highlightText(item.trim())}</span>{!isEdited && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(item.trim(), cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{isEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}</React.Fragment>);
            })}
          </div>);
        }
        // Non-labeled sentence — simple row
        if (!sa && !phraseMatch(sentence, searchTerm)) return null;
        const partKey = `${fieldName}-${idx}-s${si}`;
        const isEditing = editingField === partKey;
        const isEdited = editedFields[partKey];
        const cid = `wbs-plain-${idx}-${si}`;
        const displayText = sentence.replace(/\.$/, '');
        if (isEditing) return (<div key={si} className="rec-mini-card"><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) { const allSentences = splitBySentence(val); allSentences[si] = editValue.trim() + '.'; handleSaveFieldWithValue(record, fieldName, idx, sid, allSentences.join(' '), partKey); } if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => { const allSentences = splitBySentence(val); allSentences[si] = editValue.trim() + '.'; handleSaveFieldWithValue(record, fieldName, idx, sid, allSentences.join(' '), partKey); }} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
        return (<React.Fragment key={si}><div className="rec-mini-card"><div className={`numbered-row editable-row${isEdited ? ' modified' : ''}`} onClick={() => { setEditingField(partKey); setEditValue(displayText); }}><div className="row-content"><span className="content-value">{highlightText(displayText)}</span>{!isEdited && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(displayText, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{isEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}</div></React.Fragment>);
      }).filter(Boolean)}
    </div></div>);
  };

  const highlightText = (text) => { if (!text) return ''; const str = String(text); if (!searchTerm.trim()) return str; const esc = searchTerm.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const re = new RegExp(`(${esc})`, 'gi'); const p = str.split(re); if (p.length === 1) return str; return <>{p.map((x, i) => re.test(x) ? <mark key={i}>{x}</mark> : x)}</>; };
  const phraseMatch = (text, term) => { if (!term.trim()) return true; return String(text || '').toLowerCase().includes(term.toLowerCase().trim()); };
  const shouldShowSection = (record, title, contentParts, fieldNames) => { if (!searchTerm.trim()) return true; if (record._showAllSections) return true; const sl = searchTerm.toLowerCase().trim(); const tl = (title || '').toLowerCase(); if (tl.startsWith(sl) || sl.startsWith(tl)) return true; const labels = (fieldNames || []).map(f => FIELD_LABELS[f] || f); const combined = [...labels, ...(Array.isArray(contentParts) ? contentParts : [contentParts])].filter(Boolean).join(' '); return phraseMatch(combined, searchTerm); };
  const sectionTitleMatches = (t) => { if (!searchTerm.trim()) return false; const sl = searchTerm.toLowerCase().trim(); const tl = (t || '').toLowerCase(); return tl.startsWith(sl) || sl.startsWith(tl); };
  const fieldMatches = (record, fn, idx) => { if (!searchTerm.trim()) return true; if (record._showAllSections) return true; return phraseMatch(FIELD_LABELS[fn] || fn, searchTerm) || phraseMatch(fmtFieldVal(fn, getFieldValue(record, fn, idx)), searchTerm); };

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const sl = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      const title = `Burn Wound Care ${idx + 1}`;
      const allText = [title, formatDate(record.date || record.createdAt), record.burnDepthClassification, record.inhalationInjuryGrade, record.topicalAntimicrobialAgent, record.woundBedPreparationStatus, record.debridementMethod, record.skinGraftType, fmtVal(record.burnTotalBodySurfaceArea), ...(Array.isArray(record.escharotomyLocations) ? record.escharotomyLocations : []), ...(Array.isArray(record.contractureLocation) ? record.contractureLocation : []), ...Object.values(FIELD_LABELS), 'Burn Information', 'Severity Scores', 'Inhalation Injury', 'Escharotomy', 'Wound Management', 'Grafting', 'Wound Therapy', 'Nutrition', 'Rehabilitation'].filter(Boolean).join(' ');
      const match = allText.toLowerCase().includes(sl);
      record._showAllSections = match && title.toLowerCase().startsWith(sl);
      return match;
    });
  }, [records, searchTerm]);

  const sectionHasEdits = (idx, sid) => { const fs = SECTION_FIELDS[sid] || []; return fs.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || k.startsWith(`${f}.`))); };
  const renderApproveButton = (idx, sid) => { const he = sectionHasEdits(idx, sid); const ia = approvedSections[`${sid}-${idx}`]; if (he) return <button className="approve-btn pending" onClick={(e) => { e.stopPropagation(); handleApproveSection(records[idx], idx, sid); }}>Pending Approve</button>; if (ia) return <span className="approve-btn approved">Approved</span>; return null; };

  const renderEditableField = (record, fn, idx, sid) => {
    const raw = getFieldValue(record, fn, idx); if (!hasFieldVal(fn, raw)) return null;
    const dv = fmtFieldVal(fn, raw);
    const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`;

    // BOOLEAN field — Yes/No select, saves real boolean
    if (BOOLEAN_FIELDS.includes(fn)) {
      const boolVal = raw === true || raw === 'true' || raw === 'Yes';
      if (ie) return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div><div className="edit-field-container"><select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} disabled={saving}><option value="true">Yes</option><option value="false">No</option></select><div className="edit-actions"><button className="save-btn" onClick={() => handleSaveFieldWithValue(record, fn, idx, sid, editValue === 'true', ek)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
      return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(boolVal ? 'true' : 'false'); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
    }

    // NUMBER field — numeric input (parseFloat + isNaN guard), saves real number
    if (NUMBER_FIELDS.includes(fn)) {
      const unit = NUMBER_UNITS[fn];
      const doSave = () => { const n = parseFloat(editValue); if (isNaN(n)) return; handleSaveFieldWithValue(record, fn, idx, sid, n, ek); };
      if (ie) return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div><div className="edit-field-container"><div className="number-edit-row"><input type="number" step="any" className="edit-number" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') doSave(); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} disabled={saving} />{unit && <span className="number-edit-unit">{unit}</span>}</div><div className="edit-actions"><button className="save-btn" onClick={doSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
      return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(String(parseFloat(raw))); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
    }

    // STRING / narrative field — textarea
    if (ie) return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveField(record, fn, idx, sid); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={fn === 'woundBedPreparationStatus' || fn === 'topicalAntimicrobialAgent' ? 4 : 1} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => handleSaveField(record, fn, idx, sid)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
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
      ARRAY_FIELDS.forEach(field => { m[field] = getEffectiveArray(record, field, idx); });
      return m;
    });
  }, [records, localEdits, pendingEdits, getEffectiveArray]);

  const SECTION_TITLES = { burnOverview: 'BURN OVERVIEW', severity: 'SEVERITY SCORING', inhalation: 'INHALATION INJURY', escharotomy: 'ESCHAROTOMY', woundAssessment: 'WOUND ASSESSMENT', grafting: 'GRAFTING', therapy: 'WOUND THERAPY', nutrition: 'NUTRITIONAL SUPPORT', scarMgmt: 'SCAR MANAGEMENT', contracture: 'CONTRACTURE LOCATIONS' };

  const formatLabeledField = (val) => {
    const sentences = splitBySentence(val);
    let text = '';
    sentences.forEach(s => {
      const parsed = parseLabel(s.replace(/\.$/, ''));
      if (parsed.isLabeled) {
        text += `\n${parsed.label}:\n`;
        parsed.value.split(/,\s*/).filter(i => i.trim()).forEach((item, i) => { text += `  ${i + 1}. ${item.trim()}\n`; });
      } else { text += `${s.replace(/\.$/, '')}\n`; }
    });
    return text;
  };

  const copySectionText = (record, idx, sid) => {
    const pr = pdfData[idx] || record; let text = `${SECTION_TITLES[sid] || sid.toUpperCase()}\n`;
    const addF = (fn) => { if (hasFieldVal(fn, pr[fn])) { if (fn === 'woundBedPreparationStatus' && splitBySentence(String(pr[fn])).length > 1) { text += formatLabeledField(String(pr[fn])); } else { text += `${FIELD_LABELS[fn] || fn}: ${fmtFieldVal(fn, pr[fn])}\n`; } } };
    const addArr = (fn) => { getEffectiveArray(pr, fn, idx).forEach((item, i) => { text += `${i + 1}. ${item}\n`; }); };
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => { if (ARRAY_FIELDS.includes(f)) { addArr(f); } else { addF(f); } });
    copyToClipboard(text.trim(), `section-${sid}-${idx}`);
  };

  const copyAllContent = () => {
    let text = '=== BURN WOUND CARE ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Burn Wound Care ${idx + 1}\n`;
      if (r.date || r.createdAt) text += `${formatDate(r.date || r.createdAt)}\n`;
      const addF = (fn) => { if (hasFieldVal(fn, r[fn])) { if (fn === 'woundBedPreparationStatus' && splitBySentence(String(r[fn])).length > 1) { text += formatLabeledField(String(r[fn])); } else { text += `${FIELD_LABELS[fn] || fn}: ${fmtFieldVal(fn, r[fn])}\n`; } } };
      const addArr = (fn) => { getEffectiveArray(r, fn, idx).forEach((item, i) => { text += `${i + 1}. ${item}\n`; }); };
      Object.entries(SECTION_TITLES).forEach(([sid, title]) => {
        const fields = SECTION_FIELDS[sid] || [];
        const vis = fields.filter(f => ARRAY_FIELDS.includes(f) ? getEffectiveArray(r, f, idx).length > 0 : hasFieldVal(f, r[f]));
        if (vis.length) { text += `\n${title}\n`; vis.forEach(f => { if (ARRAY_FIELDS.includes(f)) addArr(f); else addF(f); }); }
      });
      text += '\n';
    });
    copyToClipboard(text.trim(), 'copy-all');
  };

  const renderSection = (record, idx, sid, title, children) => { if (!children) return null; return (<div className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn${copiedId === `section-${sid}-${idx}` ? ' copied' : ''}`} onClick={() => copySectionText(record, idx, sid)}>{copiedId === `section-${sid}-${idx}` ? 'Copied' : 'Copy Section'}</button>{renderApproveButton(idx, sid)}</div></div>{children}</div></div>); };

  const renderMultiFieldSection = (record, idx, sid, title, fields) => {
    const visibleFields = fields.filter(f => ARRAY_FIELDS.includes(f) ? (Array.isArray(record[f]) && record[f].length > 0) : hasFieldVal(f, getFieldValue(record, f, idx)));
    if (visibleFields.length === 0) return null;
    if (!shouldShowSection(record, title, visibleFields.map(f => ARRAY_FIELDS.includes(f) ? (record[f] || []).join(' ') : fmtFieldVal(f, getFieldValue(record, f, idx))), visibleFields)) return null;
    return renderSection(record, idx, sid, title, (() => { const stm = sectionTitleMatches(title); const sa = !searchTerm.trim() || record._showAllSections || stm; return <>{visibleFields.map(f => { if (ARRAY_FIELDS.includes(f)) { return (record[f] || []).map((item, ai) => { const val = localEdits[`${f}-${idx}-${ai}`] !== undefined ? localEdits[`${f}-${idx}-${ai}`] : item; if (!sa && !phraseMatch(val, searchTerm)) return null; return renderEditableArrayItem(record, f, idx, sid, item, ai); }).filter(Boolean); } if (!sa && !fieldMatches(record, f, idx)) return null; return <React.Fragment key={f}>{renderEditableField(record, f, idx, sid)}</React.Fragment>; })}</>; })());
  };

  if (!filteredRecords || filteredRecords.length === 0) return (<article className="burn-wound-care-document"><header className="document-header"><h1 className="document-title">Burn Wound Care</h1></header><SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} /><div className="empty-state">No data available.</div></article>);

  return (
    <article className="burn-wound-care-document">
      <header className="document-header">
        <h1 className="document-title">Burn Wound Care</h1>
        <div className="header-actions">
          <button className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`} onClick={copyAllContent}>{copiedId === 'copy-all' ? 'Copied' : 'Copy All'}</button>
          <PDFDownloadLink document={<BurnWoundCareDocumentPDFTemplate document={pdfData} />} fileName="Burn_Wound_Care.pdf">
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
              <div className="record-title-row"><h3 className="record-name">{highlightText(`Burn Wound Care ${idx + 1}`)}</h3></div>
            </div>

            {renderMultiFieldSection(record, idx, 'burnOverview', 'Burn Overview', ['burnTotalBodySurfaceArea', 'burnDepthClassification'])}
            {renderMultiFieldSection(record, idx, 'severity', 'Severity Scoring', ['lundBrowderScore', 'baxterParklandFormula', 'modifiedBauxScore', 'abbreviatedBurnSeverityIndex'])}
            {renderMultiFieldSection(record, idx, 'inhalation', 'Inhalation Injury', ['inhalationInjuryGrade', 'carboxyhemoglobinLevel'])}
            {renderMultiFieldSection(record, idx, 'escharotomy', 'Escharotomy', ['escharotomyRequired', 'escharotomyLocations'])}
            {/* Wound Assessment — woundBedPreparationStatus gets labeled sentence rendering, others simple */}
            {renderLabeledSentenceField(record, idx, 'woundAssessment', 'Wound Bed Status', 'woundBedPreparationStatus') || (record.woundBedPreparationStatus && renderMultiFieldSection(record, idx, 'woundAssessment', 'Wound Bed Status', ['woundBedPreparationStatus']))}
            {renderMultiFieldSection(record, idx, 'woundAssessment', 'Wound Assessment', ['debridementMethod', 'topicalAntimicrobialAgent', 'burnWoundCultureResults', 'quantitativeWoundBiopsy'])}
            {renderMultiFieldSection(record, idx, 'grafting', 'Grafting', ['skinGraftType', 'graftMeshRatio', 'graftTakePercentage', 'dermalSubstitutePlaced'])}
            {renderMultiFieldSection(record, idx, 'therapy', 'Wound Therapy', ['negativeProressureWoundTherapySettings'])}
            {renderMultiFieldSection(record, idx, 'nutrition', 'Nutritional Support', ['prealabuminLevel', 'curreriFormulaCalories'])}
            {renderMultiFieldSection(record, idx, 'scarMgmt', 'Scar Management', ['vancouverScarScaleScore', 'pressureGarmentCompliance'])}
            {renderMultiFieldSection(record, idx, 'contracture', 'Contracture Locations', ['contractureLocation'])}
          </div>
        ))}
      </div>
    </article>
  );
};

export default BurnWoundCareDocument;
