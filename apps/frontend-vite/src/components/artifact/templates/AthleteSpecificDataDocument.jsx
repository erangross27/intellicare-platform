/**
 * AthleteSpecificDataDocument.jsx
 * Inline editing with per-section approve, PDFDownloadLink + pdfData memo,
 * secureApiClient for all API calls. Boolean fields display as Yes/No.
 * previousInjuries: array of objects with per-sub-field editing.
 * highlightText uses React mark elements (safe, no raw HTML injection)
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import AthleteSpecificDataDocumentPDFTemplate from '../pdf-templates/AthleteSpecificDataDocumentPDFTemplate';
import './AthleteSpecificDataDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [trackKey]: { field, value, localKey, kind } } }
     - trackKey  = the editedFields/editedSentences tracking key (unique per edited item)
     - field     = exact DB field path the original save handler would have written
     - value     = exact DB value (string, boolean, or whole array for recommendations)
     - localKey  = the localEdits key used for the on-screen override / pdfData merge
     - kind      = 'simple' | 'sentence' | 'injury' | 'leaf' | 'recommendations' (for rehydrate) */
const DRAFT_KEY = 'athlete_specific_dataPendingEdits';
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
  recordInfo: ['provider', 'facility', 'status'],
  sportProfile: ['sport', 'position', 'professionalLevel', 'teamSupport'],
  previousInjuries: ['previousInjuries'],
  supportCompliance: ['psychologicalSupport', 'antiDopingNotification'],
  findings: ['findings'],
  assessment: ['assessment'],
  plan: ['plan'],
  recommendations: ['recommendations'],
  results: ['results'],
  notes: ['notes'],
};

const FIELD_LABELS = {
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  sport: 'Sport',
  position: 'Position',
  professionalLevel: 'Professional Level',
  teamSupport: 'Team Support',
  psychologicalSupport: 'Psychological Support',
  antiDopingNotification: 'Anti-Doping Notification',
  previousInjuries: 'Previous Injuries',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  recommendations: 'Recommendations',
  results: 'Results',
  notes: 'Notes',
};

const BOOLEAN_FIELDS = ['professionalLevel', 'teamSupport', 'psychologicalSupport', 'antiDopingNotification'];
const OBJECT_FIELDS = ['results'];

// ===== Object/value helpers (recursive OBJECT field support) =====
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const isScalar = (v) => v === null || typeof v !== 'object';
const flattenSearchable = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (typeof v === 'number' || typeof v === 'string') return String(v);
  if (Array.isArray(v)) return v.map(flattenSearchable).join(' ');
  if (typeof v === 'object') return Object.entries(v).map(([k, val]) => `${humanizeKey(k)} ${flattenSearchable(val)}`).join(' ');
  return '';
};
const objectCopyLines = (label, value, indent = 0) => {
  const out = [];
  if (isEmptyDeep(value)) return out;
  const pad = '  '.repeat(indent);
  if (isScalar(value)) { out.push(`${pad}${label ? label + ': ' : ''}${fmtScalar(value)}`); return out; }
  if (label) out.push(`${pad}${label}:`);
  Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => out.push(...objectCopyLines(humanizeKey(k), v, indent + (label ? 1 : 0))));
  return out;
};

const AthleteSpecificDataDocument = ({ document: rawDoc }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  const [editedFields, setEditedFields] = useState({});
  const [editedSentences, setEditedSentences] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  // localEdits keys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});

  // Unwrap data
  const records = useMemo(() => {
    if (!rawDoc) return [];
    let arr = Array.isArray(rawDoc) ? rawDoc : [rawDoc];
    arr = arr.flatMap(r => {
      if (r?.athlete_specific_data) return Array.isArray(r.athlete_specific_data) ? r.athlete_specific_data : [r.athlete_specific_data];
      if (r?.documentData) {
        const dd = r.documentData;
        if (Array.isArray(dd)) return dd;
        if (dd?.athlete_specific_data) return Array.isArray(dd.athlete_specific_data) ? dd.athlete_specific_data : [dd.athlete_specific_data];
        return [dd];
      }
      return r;
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [rawDoc]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const idOf = (record) => {
      const id = record && record._id;
      if (!id) return null;
      if (typeof id === 'string') return id;
      if (id.$oid) return id.$oid;
      return String(id);
    };
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const recId = idOf(record);
      const recDrafts = recId ? store[recId] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([trackKey, draft]) => {
        if (!draft || typeof draft !== 'object') return;
        const localKey = draft.localKey || trackKey;
        nLocal[localKey] = draft.value;
        nPending[localKey] = true;
        if (draft.kind === 'sentence') nSentences[trackKey] = 'edited';
        else nFields[trackKey] = 'edited';
      });
    });
    if (Object.keys(nPending).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [records]);

  const formatDate = (dateVal) => {
    if (!dateVal) return '';
    try {
      const d = new Date(dateVal.$date || dateVal);
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch { return String(dateVal); }
  };

  const splitBySentence = (text) => {
    if (!text || typeof text !== 'string') return [];
    // Abbreviation-safe: do NOT split after a title/abbreviation period (Dr. Mr. Mrs. St. etc.)
    return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|Prof|Rev|Sr|Jr|St|Gen|Col|Sgt|Lt|Capt|vs|etc)\.)(?<=[.!?])\s+|(?<=;)\s+/).filter(s => {
      const trimmed = s.trim();
      return trimmed.length > 0 && trimmed.replace(/[.!?;,]+/g, '').trim().length > 0;
    });
  };

  const displayBoolean = (val) => {
    if (val === true || val === 'true' || val === 'Yes') return 'Yes';
    if (val === false || val === 'false' || val === 'No') return 'No';
    return String(val || '');
  };

  const parseBoolean = (val) => {
    const lower = String(val).toLowerCase().trim();
    return lower === 'yes' || lower === 'true' || lower === '1';
  };

  // ===== Edit Helpers =====
  const getFieldValue = useCallback((record, fieldName, idx) => {
    const key = `${fieldName}-${idx}`;
    if (localEdits[key] !== undefined) return localEdits[key];
    return record[fieldName];
  }, [localEdits]);

  const getRecordId = (record) => {
    const id = record._id;
    if (!id) return null;
    if (typeof id === 'string') return id;
    if (id.$oid) return id.$oid;
    return String(id);
  };

  // ===== Save Handlers =====
  // Stage a DRAFT locally + persist it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  // `field`/`value` are the EXACT DB payload the original handler would have PUT, so Approve replays it verbatim.
  const stageDraftFor = useCallback((record, sectionId, idx, { trackKey, localKey, localValue, field, value, kind }) => {
    setLocalEdits(prev => ({ ...prev, [localKey]: localValue }));
    setPendingEdits(prev => ({ ...prev, [localKey]: true }));
    if (kind === 'sentence') setEditedSentences(prev => ({ ...prev, [trackKey]: 'edited' }));
    else setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    // Re-edit after approval → drop this section's approved flag so the button returns to yellow Pending Approve
    setApprovedSections(prev => {
      const apKey = `${sectionId}-${idx}`;
      if (!prev[apKey]) return prev;
      const next = { ...prev };
      delete next[apKey];
      return next;
    });
    const recordId = getRecordId(record);
    if (recordId) {
      const store = readDrafts();
      if (!store[recordId]) store[recordId] = {};
      store[recordId][trackKey] = { field, value, localKey, kind };
      writeDrafts(store);
    }
    setEditingField(null);
    setEditValue('');
  }, []);

  const handleSaveField = useCallback((record, fieldName, idx, sectionId, sentenceIdx, valueOverride, editTrackingKey) => {
    const recordId = getRecordId(record);
    if (!recordId) { console.error('[AthleteSpecificData] Cannot save — no record ID'); return; }

    let newValue = valueOverride !== undefined ? valueOverride : editValue;
    if (BOOLEAN_FIELDS.includes(fieldName)) newValue = parseBoolean(newValue);

    const isSentence = sentenceIdx !== undefined && sentenceIdx !== null;
    const localKey = editTrackingKey || `${fieldName}-${idx}`;
    const trackKey = isSentence ? (editTrackingKey || `${fieldName}-${idx}-s${sentenceIdx}`) : localKey;

    stageDraftFor(record, sectionId, idx, {
      trackKey, localKey, localValue: newValue,
      field: fieldName, value: newValue, kind: isSentence ? 'sentence' : 'simple',
    });
  }, [editValue]);

  const handleSaveInjuryField = useCallback((record, idx, injuryIdx, subField) => {
    const recordId = getRecordId(record);
    if (!recordId) { console.error('[AthleteSpecificData] Cannot save — no record ID'); return; }

    const editKey = `previousInjuries-${idx}-${injuryIdx}-${subField}`;
    stageDraftFor(record, 'previousInjuries', idx, {
      trackKey: editKey, localKey: editKey, localValue: editValue,
      field: `previousInjuries.${injuryIdx}.${subField}`, value: editValue, kind: 'injury',
    });
  }, [editValue]);

  // Save a nested OBJECT leaf by dot-path (e.g. results.bloodPressure) — value stays a STRING
  const handleSaveLeaf = useCallback((record, rootField, path, idx, leafKeyTrack, newVal) => {
    const recordId = getRecordId(record);
    if (!recordId) { console.error('[AthleteSpecificData] Cannot save — no record ID'); return; }
    const dottedField = `${rootField}.${path.join('.')}`;
    // Build the merged root-object value for the on-screen override (localEdits[`${rootField}-${idx}`])
    const cur = localEdits[`${rootField}-${idx}`] !== undefined ? localEdits[`${rootField}-${idx}`] : record[rootField];
    const clone = JSON.parse(JSON.stringify(cur ?? {}));
    let node = clone;
    for (let i = 0; i < path.length - 1; i++) node = node[path[i]];
    node[path[path.length - 1]] = newVal;
    stageDraftFor(record, rootField, idx, {
      trackKey: leafKeyTrack, localKey: `${rootField}-${idx}`, localValue: clone,
      field: dottedField, value: newVal, kind: 'leaf',
    });
  }, [editValue, localEdits]);

  // Save a single recommendation item's text within the array
  const handleSaveRecommendation = useCallback((record, idx, recIdx, newText) => {
    const recordId = getRecordId(record);
    if (!recordId) { console.error('[AthleteSpecificData] Cannot save — no record ID'); return; }
    const currentArr = Array.isArray(getFieldValue(record, 'recommendations', idx))
      ? getFieldValue(record, 'recommendations', idx) : [];
    const trimmed = newText.trim();
    const newArr = currentArr.map((r, i) => i === recIdx ? { ...r, recommendation: trimmed } : { ...r });
    stageDraftFor(record, 'recommendations', idx, {
      trackKey: `recommendations-${idx}-r${recIdx}`, localKey: `recommendations-${idx}`, localValue: newArr,
      field: 'recommendations', value: newArr, kind: 'recommendations',
    });
  }, [getFieldValue]);

  // Approve = COMMIT all staged drafts for this record+section to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, idx, sectionId) => {
    try {
      const recordId = getRecordId(record);
      if (!recordId) return;

      const sectionFields = SECTION_FIELDS[sectionId] || [];
      const store = readDrafts();
      const recDrafts = store[recordId] || {};
      // Collect this section's staged drafts (trackKey starts with one of the section's field-idx prefixes)
      const toCommit = Object.keys(recDrafts).filter(trackKey =>
        sectionFields.some(f => trackKey.startsWith(`${f}-${idx}`))
      );

      const secureApiClient = (await import('../../../services/secureApiClient')).default;
      // Persist each staged field to the DB now, replaying the exact field/value the save handler computed
      for (const trackKey of toCommit) {
        const draft = recDrafts[trackKey];
        if (!draft) continue;
        await secureApiClient.put(`/api/edit/athlete_specific_data/${recordId}/edit`, {
          field: draft.field, value: draft.value,
        });
      }
      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/athlete_specific_data/${recordId}/approve`, {
        sectionId, approved: true,
      });

      // Clear pending → committed edits now flow into pdfData/PDF
      const committedLocalKeys = toCommit.map(k => recDrafts[k]?.localKey).filter(Boolean);
      setPendingEdits(prev => {
        const next = { ...prev };
        committedLocalKeys.forEach(k => delete next[k]);
        return next;
      });
      // Drop this section's drafts from localStorage (now committed)
      toCommit.forEach(k => delete recDrafts[k]);
      if (Object.keys(recDrafts).length === 0) delete store[recordId];
      else store[recordId] = recDrafts;
      writeDrafts(store);

      setApprovedSections(prev => ({ ...prev, [`${sectionId}-${idx}`]: true }));

      setEditedFields(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(k => { sectionFields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete next[k]; }); });
        return next;
      });
      setEditedSentences(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(k => { sectionFields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete next[k]; }); });
        return next;
      });
    } catch (err) {
      console.error('[AthleteSpecificData] Approve failed:', err);
    }
  }, []);

  // ===== Sentence Editing Helpers =====
  function reconstructFullText(sentences) {
    return sentences.map((s, i) => {
      const trimmed = s.trim();
      if (i < sentences.length - 1 && !trimmed.match(/[.!?;]$/)) return trimmed + '.';
      return trimmed;
    }).join(' ');
  }

  function saveSentence(record, fieldName, idx, sectionId, sentenceIdx, newSentenceText) {
    const currentValue = String(getFieldValue(record, fieldName, idx) || '');
    const currentSentences = splitBySentence(currentValue);
    const cleanNew = newSentenceText.trim();
    const cleanOld = (currentSentences[sentenceIdx] || '').trim().replace(/[.!?;]+$/, '');
    if (cleanNew === cleanOld) { setEditingField(null); setEditValue(''); return; }

    if (!cleanNew || cleanNew.replace(/[.!?;,]+/g, '').trim() === '') {
      currentSentences.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(currentSentences);
      const editKey = `${fieldName}-${idx}-s${sentenceIdx}`;
      setEditedSentences(prev => ({ ...prev, [editKey]: 'edited' }));
      handleSaveField(record, fieldName, idx, sectionId, null, fullText, `${fieldName}-${idx}`);
      return;
    }

    let newText = cleanNew;
    if (newText && !newText.match(/[.!?;]$/)) newText += '.';
    currentSentences[sentenceIdx] = newText;
    const extraCount = newText.split(/(?<=[.!?])\s+|(?<=;)\s+/).length - 1;
    const fullText = reconstructFullText(currentSentences);
    const editKey = `${fieldName}-${idx}-s${sentenceIdx}`;
    setEditedSentences(prev => {
      const next = { ...prev, [editKey]: 'edited' };
      for (let e = 1; e <= extraCount; e++) { next[`${fieldName}-${idx}-s${sentenceIdx + e}`] = 'added'; }
      return next;
    });
    handleSaveField(record, fieldName, idx, sectionId, null, fullText, `${fieldName}-${idx}`);
  }

  // ===== Search =====
  const highlightText = (text) => {
    if (!text) return '';
    const str = String(text);
    if (!searchTerm.trim()) return str;
    const escaped = searchTerm.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = str.split(regex);
    if (parts.length === 1) return str;
    return <>{parts.map((p, i) => regex.test(p) ? <mark key={i}>{p}</mark> : p)}</>;
  };

  const phraseMatch = (text, term) => {
    if (!term.trim()) return true;
    return String(text || '').toLowerCase().includes(term.toLowerCase().trim());
  };

  const shouldShowSection = (record, sectionTitle, contentParts) => {
    if (!searchTerm.trim()) return true;
    if (record._showAllSections) return true;
    const combined = [sectionTitle, ...(Array.isArray(contentParts) ? contentParts : [contentParts])].filter(Boolean).join(' ');
    return phraseMatch(combined, searchTerm);
  };

  const sectionTitleMatches = (sectionTitle) => {
    if (!searchTerm.trim()) return false;
    return phraseMatch(sectionTitle, searchTerm);
  };

  const fieldMatches = (record, fieldName, idx) => {
    if (!searchTerm.trim()) return true;
    if (record._showAllSections) return true;
    const label = FIELD_LABELS[fieldName] || fieldName;
    const value = getFieldValue(record, fieldName, idx);
    const displayVal = BOOLEAN_FIELDS.includes(fieldName) ? displayBoolean(value) : value;
    return phraseMatch(label, searchTerm) || phraseMatch(displayVal, searchTerm);
  };

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    return records.filter((record, idx) => {
      const title = `Athlete Specific Data ${idx + 1}`;
      const injuryText = (record.previousInjuries || []).map(inj => `${inj.injury} ${inj.date} ${inj.recovery}`).join(' ');
      const recText = (record.recommendations || []).map(r => `${r?.recommendation || ''} ${r?.date || ''}`).join(' ');
      const resultsText = flattenSearchable(record.results);
      const allText = [
        title, formatDate(record.date),
        record.sport, record.position, record.provider, record.facility, record.status,
        displayBoolean(record.professionalLevel), displayBoolean(record.teamSupport),
        displayBoolean(record.psychologicalSupport), displayBoolean(record.antiDopingNotification),
        record.findings, record.assessment, record.plan, record.notes,
        injuryText, recText, resultsText,
        'Record Information', 'Sport Profile', 'Previous Injuries',
        'Support & Compliance', 'Findings', 'Assessment', 'Plan',
        'Recommendations', 'Results', 'Notes',
      ].filter(Boolean).join(' ');
      const match = phraseMatch(allText, searchTerm);
      if (match && phraseMatch(title, searchTerm)) { record._showAllSections = true; }
      return match;
    });
  }, [records, searchTerm]);

  // ===== Section Has Edits & Approve Button =====
  const sectionHasEdits = (idx, sectionId) => {
    const fields = SECTION_FIELDS[sectionId] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`)) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  };

  const renderApproveButton = (idx, sectionId) => {
    const hasEdits = sectionHasEdits(idx, sectionId);
    const isApproved = approvedSections[`${sectionId}-${idx}`];
    if (hasEdits) {
      return <button className="approve-btn pending" onClick={(e) => { e.stopPropagation(); handleApproveSection(records[idx], idx, sectionId); }}>Pending Approve</button>;
    }
    if (isApproved) { return <span className="approve-btn approved">Approved</span>; }
    return null;
  };

  // ===== Render Editable Field =====
  const renderEditableField = (record, fieldName, idx, sectionId) => {
    const rawValue = getFieldValue(record, fieldName, idx);
    const isBool = BOOLEAN_FIELDS.includes(fieldName);
    const displayValue = isBool ? displayBoolean(rawValue) : String(rawValue || '');
    if (!displayValue && !isBool) return null;
    const editKey = `${fieldName}-${idx}`;
    const isEditing = editingField === editKey;
    const isEdited = editedFields[editKey];

    if (isEditing) {
      return (
        <div className="rec-mini-card">
          <div className="nested-subtitle">{highlightText(FIELD_LABELS[fieldName] || fieldName)}</div>
          <div className="edit-field-container">
            {isBool ? (
              <select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            ) : (
              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveField(record, fieldName, idx, sectionId); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}
                autoFocus rows={2} disabled={saving} />
            )}
            <div className="edit-actions">
              <button className="save-btn" onClick={() => handleSaveField(record, fieldName, idx, sectionId)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
              <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(FIELD_LABELS[fieldName] || fieldName)}</div>
        <div className={`numbered-row editable-row${isEdited ? ' modified' : ''}`} onClick={() => { setEditingField(editKey); setEditValue(displayValue); }}>
          <div className="row-content">
            <span className="content-value">{highlightText(displayValue)}</span>
            {!isEdited && <span className="edit-indicator">✎</span>}
          </div>
        </div>
        {isEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </div>
    );
  };

  // ===== Render Sentence Editable Field =====
  const renderSentenceEditableField = (record, fieldName, idx, sectionId) => {
    const value = getFieldValue(record, fieldName, idx);
    if (!value) return null;
    const sentences = splitBySentence(String(value));
    if (sentences.length <= 1) return renderEditableField(record, fieldName, idx, sectionId);

    const visibleSentences = sentences.map((s, origIdx) => ({ text: s, _origIdx: origIdx })).filter(item => {
      if (!searchTerm.trim() || record._showAllSections) return true;
      if (sectionTitleMatches(FIELD_LABELS[fieldName] || fieldName)) return true;
      return phraseMatch(item.text, searchTerm);
    });
    if (visibleSentences.length === 0) return null;

    return (
      <>
        {visibleSentences.map(({ text, _origIdx: sIdx }) => {
          const sentenceKey = `${fieldName}-${idx}-s${sIdx}`;
          const isEditing = editingField === sentenceKey;
          const editStatus = editedSentences[sentenceKey];

          if (isEditing) {
            return (
              <div key={sIdx} className="rec-mini-card">
                <div className="edit-field-container">
                  <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveSentence(record, fieldName, idx, sectionId, sIdx, editValue); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}
                    autoFocus rows={2} disabled={saving} />
                  <div className="edit-actions">
                    <button className="save-btn" onClick={() => saveSentence(record, fieldName, idx, sectionId, sIdx, editValue)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                    <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div key={sIdx} className="rec-mini-card">
              <div className={`numbered-row editable-row${editStatus ? ' modified' : ''}`} onClick={() => { setEditingField(sentenceKey); setEditValue(text.replace(/[.!?;]+$/, '')); }}>
                <div className="row-content">
                  <span className="content-value">{highlightText(text)}</span>
                  {!editStatus && <span className="edit-indicator">✎</span>}
                </div>
              </div>
              {editStatus && <div className={`modified-badge${editStatus === 'added' ? ' added' : ''}`}>{editStatus === 'added' ? 'added' : 'edited - click Pending Approve to save'}</div>}
            </div>
          );
        })}
      </>
    );
  };

  // ===== Render Injury Item (object with sub-fields) =====
  const renderInjuryItem = (record, idx, injury, injuryIdx) => {
    const subFields = ['injury', 'date', 'recovery'];
    const subLabels = { injury: 'Injury', date: 'Date', recovery: 'Recovery' };

    if (searchTerm.trim() && !record._showAllSections && !sectionTitleMatches('Previous Injuries')) {
      const injText = `${injury.injury} ${injury.date} ${injury.recovery}`;
      if (!phraseMatch(injText, searchTerm)) return null;
    }

    const valOf = (sf) => {
      const editKey = `previousInjuries-${idx}-${injuryIdx}-${sf}`;
      return localEdits[editKey] !== undefined ? localEdits[editKey] : (injury[sf] || '');
    };
    // Only sub-fields with a value — avoids an orphaned "Injury N" header (memory 6988a478)
    const present = subFields.filter(sf => String(valOf(sf)).trim() !== '');
    if (present.length === 0) return null;

    return (
      <div key={injuryIdx} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(`Injury ${injuryIdx + 1}`)}</div>
        {present.map(sf => {
          const editKey = `previousInjuries-${idx}-${injuryIdx}-${sf}`;
          const displayVal = valOf(sf);
          const isEditing = editingField === editKey;
          const isEdited = editedFields[editKey];

          if (isEditing) {
            return (
              <div key={sf} className="nested-mini-card">
                <div className="nested-subtitle sub-label">{highlightText(subLabels[sf])}</div>
                <div className="edit-field-container">
                  <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveInjuryField(record, idx, injuryIdx, sf); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}
                    autoFocus rows={1} disabled={saving} />
                  <div className="edit-actions">
                    <button className="save-btn" onClick={() => handleSaveInjuryField(record, idx, injuryIdx, sf)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                    <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div key={sf} className="nested-mini-card">
              <div className="nested-subtitle sub-label">{highlightText(subLabels[sf])}</div>
              <div className={`numbered-row editable-row${isEdited ? ' modified' : ''}`} onClick={() => { setEditingField(editKey); setEditValue(String(displayVal)); }}>
                <div className="row-content">
                  <span className="content-value">{highlightText(String(displayVal))}</span>
                  {!isEdited && <span className="edit-indicator">✎</span>}
                </div>
              </div>
              {isEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
            </div>
          );
        })}
      </div>
    );
  };

  // ===== Render OBJECT Leaf (editable string leaf) =====
  const renderObjectLeaf = (record, rootField, path, idx, value) => {
    const leafValueString = fmtScalar(value);
    const leafKey = `${rootField}-${idx}-${path.join('.')}`;
    const isEditing = editingField === leafKey;
    const isEdited = editedFields[leafKey];
    const isBool = typeof value === 'boolean';

    if (isEditing) {
      return (
        <div key={path[path.length - 1]} className="nested-mini-card">
          <div className="nested-subtitle sub-label">{highlightText(humanizeKey(path[path.length - 1]))}</div>
          <div className="edit-field-container">
            {isBool ? (
              <select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            ) : (
              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}
                autoFocus rows={2} disabled={saving} />
            )}
            <div className="edit-actions">
              <button className="save-btn" disabled={saving} onClick={() => {
                const newVal = isBool ? (parseBoolean(editValue)) : editValue.trim();
                handleSaveLeaf(record, rootField, path, idx, leafKey, newVal);
              }}>{saving ? 'Saving...' : 'Save'}</button>
              <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div key={path[path.length - 1]} className="nested-mini-card">
        <div className="nested-subtitle sub-label">{highlightText(humanizeKey(path[path.length - 1]))}</div>
        <div className={`numbered-row editable-row${isEdited ? ' modified' : ''}`} onClick={() => { setEditingField(leafKey); setEditValue(isBool ? leafValueString : leafValueString); }}>
          <div className="row-content">
            <span className="content-value">{highlightText(leafValueString)}</span>
            {!isEdited && <span className="edit-indicator">✎</span>}
          </div>
        </div>
        {isEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </div>
    );
  };

  // ===== Render OBJECT Node (recursive) =====
  const renderObjectNode = (record, rootField, idx, label, value, path, depth) => {
    if (isEmptyDeep(value)) return null;
    if (isScalar(value)) return renderObjectLeaf(record, rootField, path, idx, value);
    const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    const labelClass = depth > 0 ? 'nested-subtitle sub-label' : 'nested-subtitle';
    return (
      <React.Fragment key={path.join('-') || rootField}>
        {label && <div className={labelClass}>{highlightText(label)}</div>}
        <div className="nested-group">
          {entries.map(([k, v]) => (
            isScalar(v)
              ? renderObjectLeaf(record, rootField, [...path, k], idx, v)
              : <div className="nested-mini-card" key={k}>{renderObjectNode(record, rootField, idx, humanizeKey(k), v, [...path, k], depth + 1)}</div>
          ))}
        </div>
      </React.Fragment>
    );
  };

  // ===== Render OBJECT Field (results) =====
  const renderObjectField = (record, fieldName, idx) => {
    const val = getFieldValue(record, fieldName, idx);
    if (isEmptyDeep(val) || isScalar(val)) return null;
    const label = FIELD_LABELS[fieldName] || fieldName;
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    if (searchTerm.trim() && !record._showAllSections && !sectionTitleMatches(label) && !phraseMatch(flattenSearchable(val), searchTerm)) return null;
    return (
      <div key={fieldName} className="rec-mini-card">
        {entries.map(([k, v]) => (
          isScalar(v)
            ? renderObjectLeaf(record, fieldName, [k], idx, v)
            : <div className="nested-mini-card" key={k}>{renderObjectNode(record, fieldName, idx, humanizeKey(k), v, [k], 1)}</div>
        ))}
      </div>
    );
  };

  // ===== Render RECOMMENDATIONS (array of {recommendation, date}) =====
  const renderRecommendationsField = (record, idx) => {
    const val = getFieldValue(record, 'recommendations', idx);
    const recs = Array.isArray(val) ? val : [];
    if (recs.length === 0) return null;
    const phrase = searchTerm.toLowerCase().trim();
    const showAll = !searchTerm.trim() || record._showAllSections || sectionTitleMatches('Recommendations');

    const groups = [];
    recs.forEach((rec, rIdx) => {
      const d = (rec?.date || '').trim();
      const last = groups[groups.length - 1];
      if (last && last.date === d) last.items.push({ rec, rIdx });
      else groups.push({ date: d, items: [{ rec, rIdx }] });
    });

    const rendered = groups.map((group, gIdx) => {
      const items = group.items.filter(({ rec }) => {
        if (showAll) return true;
        return (rec?.recommendation || '').toLowerCase().includes(phrase) || group.date.toLowerCase().includes(phrase);
      });
      if (items.length === 0) return null;
      return (
        <div key={gIdx} className="rec-mini-card" style={{ marginTop: 8 }}>
          {group.date && <div className="nested-subtitle">{highlightText(group.date)}</div>}
          {items.map(({ rec, rIdx }) => {
            const recText = (rec?.recommendation || '').trim();
            const itemKey = `recommendations-${idx}-r${rIdx}`;
            const isEditing = editingField === itemKey;
            const isEdited = editedFields[itemKey];
            if (isEditing) {
              return (
                <div key={rIdx} className="edit-field-container">
                  <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}
                    autoFocus rows={2} disabled={saving} />
                  <div className="edit-actions">
                    <button className="save-btn" disabled={saving} onClick={() => handleSaveRecommendation(record, idx, rIdx, editValue)}>{saving ? 'Saving...' : 'Save'}</button>
                    <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
                  </div>
                </div>
              );
            }
            return (
              <div key={rIdx}>
                <div className={`numbered-row editable-row${isEdited ? ' modified' : ''}`} onClick={() => { setEditingField(itemKey); setEditValue(recText); }}>
                  <div className="row-content">
                    <span className="content-value">{highlightText(recText)}</span>
                    {!isEdited && <span className="edit-indicator">✎</span>}
                  </div>
                </div>
                {isEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
              </div>
            );
          })}
        </div>
      );
    }).filter(Boolean);

    if (rendered.length === 0) return null;
    return <div className="rec-mini-card">{rendered}</div>;
  };

  // ===== pdfData Memo =====
  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return records;
    return records.map((record, idx) => {
      const merged = { ...record };
      // Merge simple/sentence/boolean edits
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF until approved
        const lastDash = key.lastIndexOf('-');
        if (lastDash === -1) return;
        const fieldName = key.substring(0, lastDash);
        const recordIdx = parseInt(key.substring(lastDash + 1), 10);
        if (recordIdx === idx && fieldName in record && fieldName !== 'previousInjuries') {
          merged[fieldName] = localEdits[key];
        }
      });
      // Merge injury sub-field edits
      if (record.previousInjuries) {
        merged.previousInjuries = record.previousInjuries.map((inj, injIdx) => {
          const mergedInj = { ...inj };
          ['injury', 'date', 'recovery'].forEach(sf => {
            const ek = `previousInjuries-${idx}-${injIdx}-${sf}`;
            if (pendingEdits[ek]) return; // pending drafts stay OUT of the PDF until approved
            if (localEdits[ek] !== undefined) mergedInj[sf] = localEdits[ek];
          });
          return mergedInj;
        });
      }
      return merged;
    });
  }, [records, localEdits, pendingEdits]);

  // ===== Copy =====
  const copyToClipboard = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) { console.error('Copy failed:', err); }
  };

  const copySectionText = (record, idx, sectionId) => {
    const pdfRecord = pdfData[idx] || record;
    let text = '';
    if (sectionId === 'previousInjuries') {
      (pdfRecord.previousInjuries || []).forEach((inj, i) => {
        text += `Injury ${i + 1}\n`;
        if (inj.injury) text += `  Injury: ${inj.injury}\n`;
        if (inj.date) text += `  Date: ${inj.date}\n`;
        if (inj.recovery) text += `  Recovery: ${inj.recovery}\n`;
      });
    } else if (sectionId === 'recommendations') {
      (pdfRecord.recommendations || []).forEach((rec, i) => {
        text += `${i + 1}. ${rec?.recommendation || ''}`;
        if (rec?.date) text += ` (${rec.date})`;
        text += '\n';
      });
    } else if (sectionId === 'results') {
      objectCopyLines('Results', pdfRecord.results, 0).forEach(l => { text += `${l}\n`; });
    } else {
      const fields = SECTION_FIELDS[sectionId] || [];
      fields.forEach(f => {
        const label = FIELD_LABELS[f] || f;
        const val = pdfRecord[f];
        if (val === undefined || val === null) return;
        const displayVal = BOOLEAN_FIELDS.includes(f) ? displayBoolean(val) : val;
        if (!displayVal) return;
        const sentences = splitBySentence(String(displayVal));
        if (sentences.length > 1) {
          text += `${label}:\n`;
          sentences.forEach((s, i) => { text += `  ${i + 1}. ${s}\n`; });
        } else {
          text += `${label}: ${displayVal}\n`;
        }
      });
    }
    copyToClipboard(text.trim(), `section-${sectionId}-${idx}`);
  };

  const copyAllContent = () => {
    let text = '=== ATHLETE SPECIFIC DATA ===\n\n';
    pdfData.forEach((record, idx) => {
      if (idx > 0) text += '\n' + '='.repeat(60) + '\n\n';
      text += `Athlete Specific Data ${idx + 1}\n`;
      if (record.date) text += `Date: ${formatDate(record.date)}\n`;
      text += '\n';
      Object.entries(SECTION_FIELDS).forEach(([sid, fields]) => {
        if (sid === 'previousInjuries') {
          if (record.previousInjuries?.length > 0) {
            text += 'Previous Injuries:\n';
            record.previousInjuries.forEach((inj, i) => {
              text += `  Injury ${i + 1}\n`;
              if (inj.injury) text += `    Injury: ${inj.injury}\n`;
              if (inj.date) text += `    Date: ${inj.date}\n`;
              if (inj.recovery) text += `    Recovery: ${inj.recovery}\n`;
            });
          }
        } else if (sid === 'recommendations') {
          if (record.recommendations?.length > 0) {
            text += 'Recommendations:\n';
            record.recommendations.forEach((rec, i) => {
              text += `  ${i + 1}. ${rec?.recommendation || ''}`;
              if (rec?.date) text += ` (${rec.date})`;
              text += '\n';
            });
          }
        } else if (sid === 'results') {
          if (!isEmptyDeep(record.results) && !isScalar(record.results)) {
            objectCopyLines('Results', record.results, 0).forEach(l => { text += `${l}\n`; });
          }
        } else {
          fields.forEach(f => {
            const label = FIELD_LABELS[f] || f;
            const val = record[f];
            if (val === undefined || val === null) return;
            const displayVal = BOOLEAN_FIELDS.includes(f) ? displayBoolean(val) : val;
            if (!displayVal) return;
            text += `${label}: ${displayVal}\n`;
          });
        }
      });
    });
    copyToClipboard(text.trim(), 'copy-all');
  };

  // ===== Helper: Render section =====
  const renderSection = (record, idx, sectionId, title, children) => {
    if (!children) return null;
    return (
      <div className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(title)}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn${copiedId === `section-${sectionId}-${idx}` ? ' copied' : ''}`} onClick={() => copySectionText(record, idx, sectionId)}>
                {copiedId === `section-${sectionId}-${idx}` ? 'Copied' : 'Copy Section'}
              </button>
              {renderApproveButton(idx, sectionId)}
            </div>
          </div>
          {children}
        </div>
      </div>
    );
  };

  // ===== Render =====
  if (!filteredRecords || filteredRecords.length === 0) {
    return (
      <article className="athlete-specific-data-document">
        <header className="document-header">
          <h1 className="document-title">Athlete Specific Data</h1>
        </header>
        <SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />
        <div className="empty-state">No athlete specific data available.</div>
      </article>
    );
  }

  return (
    <article className="athlete-specific-data-document">
      <header className="document-header">
        <h1 className="document-title">Athlete Specific Data</h1>
        <div className="header-actions">
          <button className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`} onClick={copyAllContent}>
            {copiedId === 'copy-all' ? 'Copied' : 'Copy All'}
          </button>
          <PDFDownloadLink document={<AthleteSpecificDataDocumentPDFTemplate document={pdfData} />} fileName="Athlete_Specific_Data.pdf">
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
                {record.date && <span className="record-date">{highlightText(formatDate(record.date))}</span>}
              </div>
              <div className="record-title-row">
                <h3 className="record-name">{highlightText(`Athlete Specific Data ${idx + 1}`)}</h3>
              </div>
            </div>

            {/* Record Information */}
            {(() => {
              if (!shouldShowSection(record, 'Record Information', [record.provider, record.facility, record.status].filter(Boolean))) return null;
              const stm = sectionTitleMatches('Record Information');
              const showAll = !searchTerm.trim() || record._showAllSections || stm;
              return renderSection(record, idx, 'recordInfo', 'Record Information', <>
                {(showAll || fieldMatches(record, 'provider', idx)) && renderEditableField(record, 'provider', idx, 'recordInfo')}
                {(showAll || fieldMatches(record, 'facility', idx)) && renderEditableField(record, 'facility', idx, 'recordInfo')}
                {(showAll || fieldMatches(record, 'status', idx)) && renderEditableField(record, 'status', idx, 'recordInfo')}
              </>);
            })()}

            {/* Sport Profile */}
            {(() => {
              if (!shouldShowSection(record, 'Sport Profile', [record.sport, record.position, displayBoolean(record.professionalLevel), displayBoolean(record.teamSupport)].filter(Boolean))) return null;
              const stm = sectionTitleMatches('Sport Profile');
              const showAll = !searchTerm.trim() || record._showAllSections || stm;
              return renderSection(record, idx, 'sportProfile', 'Sport Profile', <>
                {(showAll || fieldMatches(record, 'sport', idx)) && renderEditableField(record, 'sport', idx, 'sportProfile')}
                {(showAll || fieldMatches(record, 'position', idx)) && renderEditableField(record, 'position', idx, 'sportProfile')}
                {(showAll || fieldMatches(record, 'professionalLevel', idx)) && renderEditableField(record, 'professionalLevel', idx, 'sportProfile')}
                {(showAll || fieldMatches(record, 'teamSupport', idx)) && renderEditableField(record, 'teamSupport', idx, 'sportProfile')}
              </>);
            })()}

            {/* Previous Injuries */}
            {(() => {
              const injuries = record.previousInjuries;
              if (!injuries || injuries.length === 0) return null;
              const injText = injuries.map(inj => `${inj.injury} ${inj.date} ${inj.recovery}`).join(' ');
              if (!shouldShowSection(record, 'Previous Injuries', [injText])) return null;
              return renderSection(record, idx, 'previousInjuries', 'Previous Injuries',
                injuries.map((inj, injIdx) => renderInjuryItem(record, idx, inj, injIdx))
              );
            })()}

            {/* Support & Compliance */}
            {(() => {
              if (!shouldShowSection(record, 'Support & Compliance', [displayBoolean(record.psychologicalSupport), displayBoolean(record.antiDopingNotification)].filter(Boolean))) return null;
              const stm = sectionTitleMatches('Support & Compliance');
              const showAll = !searchTerm.trim() || record._showAllSections || stm;
              return renderSection(record, idx, 'supportCompliance', 'Support & Compliance', <>
                {(showAll || fieldMatches(record, 'psychologicalSupport', idx)) && renderEditableField(record, 'psychologicalSupport', idx, 'supportCompliance')}
                {(showAll || fieldMatches(record, 'antiDopingNotification', idx)) && renderEditableField(record, 'antiDopingNotification', idx, 'supportCompliance')}
              </>);
            })()}

            {/* Findings */}
            {getFieldValue(record, 'findings', idx) && shouldShowSection(record, 'Findings', [getFieldValue(record, 'findings', idx)]) &&
              renderSection(record, idx, 'findings', 'Findings', renderSentenceEditableField(record, 'findings', idx, 'findings'))
            }

            {/* Assessment */}
            {getFieldValue(record, 'assessment', idx) && shouldShowSection(record, 'Assessment', [getFieldValue(record, 'assessment', idx)]) &&
              renderSection(record, idx, 'assessment', 'Assessment', renderSentenceEditableField(record, 'assessment', idx, 'assessment'))
            }

            {/* Plan */}
            {getFieldValue(record, 'plan', idx) && shouldShowSection(record, 'Plan', [getFieldValue(record, 'plan', idx)]) &&
              renderSection(record, idx, 'plan', 'Plan', renderSentenceEditableField(record, 'plan', idx, 'plan'))
            }

            {/* Recommendations */}
            {(() => {
              const recs = getFieldValue(record, 'recommendations', idx);
              if (!Array.isArray(recs) || recs.length === 0) return null;
              const recText = recs.map(r => `${r?.recommendation || ''} ${r?.date || ''}`).join(' ');
              if (!shouldShowSection(record, 'Recommendations', [recText])) return null;
              return renderSection(record, idx, 'recommendations', 'Recommendations', renderRecommendationsField(record, idx));
            })()}

            {/* Results */}
            {(() => {
              const results = getFieldValue(record, 'results', idx);
              if (isEmptyDeep(results) || isScalar(results)) return null;
              if (!shouldShowSection(record, 'Results', [flattenSearchable(results)])) return null;
              return renderSection(record, idx, 'results', 'Results', renderObjectField(record, 'results', idx));
            })()}

            {/* Notes */}
            {getFieldValue(record, 'notes', idx) && shouldShowSection(record, 'Notes', [getFieldValue(record, 'notes', idx)]) &&
              renderSection(record, idx, 'notes', 'Notes', renderSentenceEditableField(record, 'notes', idx, 'notes'))
            }
          </div>
        ))}
      </div>
    </article>
  );
};

export default AthleteSpecificDataDocument;
