import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import secureApiClient from '../../../services/secureApiClient';
import SearchBar from '../components/SearchBar';
import BlueDatePicker from '../components/BlueDatePicker';
import CmvMonitoringPlanDocumentPDFTemplate from '../pdf-templates/CmvMonitoringPlanDocumentPDFTemplate';
import './CmvMonitoringPlanDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'cmv_monitoring_planPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

// Section → field mapping for approve/edit tracking
const SECTION_FIELDS = {
  'patient-info': ['date', 'provider', 'facility', 'patientImmuneStatus'],
  'transplant-info': ['transplantType', 'transplantDate', 'donorCmvSerostatus', 'recipientCmvSerostatus', 'riskStratification'],
  'monitoring-details': ['monitoringFrequency', 'monitoringMethod', 'viralLoadThreshold', 'nextMonitoringDate'],
  'viral-status': ['currentViralLoad', 'viralLoadTrend'],
  'clinical-status': ['cd4Count', 'previousCmvEpisodes', 'immunosuppressionLevel'],
  'cmv-symptoms': ['cmvDiseaseSymptoms'],
  'treatment-info': ['prophylaxisRegimen', 'prophylaxisDuration', 'preemptiveTherapyIndication', 'drugResistanceTesting', 'ganciclovirResistance', 'alternativeTherapyRequired'],
};

const SENTENCE_FIELDS = ['patientImmuneStatus', 'riskStratification', 'preemptiveTherapyIndication', 'drugResistanceTesting', 'ganciclovirResistance', 'alternativeTherapyRequired'];
// Decimal-aware step for the −/+ number stepper ("2.5" → 0.1, "250" → 1)
const stepFor = (v) => { const d = String(v ?? '').split('.')[1]; return d ? '0.' + '0'.repeat(Math.max(0, d.length - 1)) + '1' : '1'; };
// Fixed-choice fields → dropdown; unmatched stored value stays selectable (enumOptionsWith)
const ENUM_FIELDS = {
  donorCmvSerostatus: ['Positive', 'Negative', 'Unknown'],
  recipientCmvSerostatus: ['Positive', 'Negative', 'Unknown'],
  immunosuppressionLevel: ['Low', 'Moderate', 'High'],
};
const enumOptionsWith = (opts, current) => { const cur = String(current ?? '').trim(); return cur && !opts.some(o => o.toLowerCase() === cur.toLowerCase()) ? [cur, ...opts] : opts; };
// Seed the editor with the canonical option when the stored value matches case-insensitively
const enumSeed = (opts, current) => { const cur = String(current ?? '').trim(); return opts.find(o => o.toLowerCase() === cur.toLowerCase()) || cur; };
const ARRAY_FIELDS = ['cmvDiseaseSymptoms'];
const NUMBER_FIELDS = ['viralLoadThreshold', 'currentViralLoad', 'cd4Count', 'previousCmvEpisodes', 'prophylaxisDuration'];
// Date fields that should display formatted and edit via date-picker
const DATE_FIELDS = ['date', 'transplantDate', 'nextMonitoringDate'];

const CmvMonitoringPlanDocument = ({ document: templateData }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  const [editedFields, setEditedFields] = useState({});
  const [editedSentences, setEditedSentences] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});

  // Data unwrapping
  const records = useMemo(() => {
    if (Array.isArray(templateData)) return templateData;
    if (templateData?.cmv_monitoring_plan && Array.isArray(templateData.cmv_monitoring_plan)) return templateData.cmv_monitoring_plan;
    if (templateData?.documentData) {
      const d = templateData.documentData;
      if (Array.isArray(d)) return d;
      if (d?.cmv_monitoring_plan && Array.isArray(d.cmv_monitoring_plan)) return d.cmv_monitoring_plan;
      if (d && typeof d === 'object') return [d];
    }
    if (templateData && typeof templateData === 'object') return [templateData];
    return [];
  }, [templateData]);

  // Safe _id extraction (handles string and { $oid } shapes)
  const getRecordIdFrom = (record) => {
    const rid = record && record._id;
    if (!rid) return null;
    if (typeof rid === 'string') return rid;
    if (rid.$oid) return rid.$oid;
    return String(rid);
  };

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  // Draft fieldPart is "field" (scalar/sentence) or "field.arrayIndex" (array element); rebuild the
  // file's own editKey convention from it ("field-idx" or "field-idx-itemIdx").
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const rid = getRecordIdFrom(record);
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const dotIdx = fieldPart.indexOf('.');
        const isArrayItem = dotIdx !== -1 && /^\d+$/.test(fieldPart.slice(dotIdx + 1));
        const editKey = isArrayItem
          ? `${fieldPart.slice(0, dotIdx)}-${idx}-${fieldPart.slice(dotIdx + 1)}`
          : `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        nFields[editKey] = 'edited';
        if (!isArrayItem) nSentences[`${fieldPart}-${idx}-s0`] = 'edited';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [records]);

  // Helpers
  const formatDate = (v) => {
    if (!v) return '';
    try { return new Date(v).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); }
    catch { return String(v); }
  };

  const hasVal = (v) => {
    if (v === null || v === undefined) return false;
    if (typeof v === 'number') return true;
    if (typeof v === 'string') return v.trim().length > 0;
    if (Array.isArray(v)) return v.length > 0;
    return Boolean(v);
  };

  // Convert a stored date value to YYYY-MM-DD for BlueDatePicker
  const toInputDate = (v) => {
    if (!v) return '';
    try {
      const d = new Date(v);
      if (isNaN(d.getTime())) return '';
      return d.toISOString().slice(0, 10);
    } catch { return ''; }
  };

  const getFieldValue = useCallback((record, field, idx) => {
    const editKey = `${field}-${idx}`;
    if (localEdits[editKey] !== undefined) return localEdits[editKey];
    return record[field];
  }, [localEdits]);

  const getEffectiveArray = useCallback((record, field, idx) => {
    const arr = Array.isArray(record[field]) ? [...record[field]] : [];
    Object.keys(localEdits).forEach(k => {
      const match = k.match(new RegExp(`^${field}-(\\d+)-(\\d+)$`));
      if (match && parseInt(match[1]) === idx) {
        arr[parseInt(match[2])] = localEdits[k];
      }
    });
    const fullKey = `${field}-${idx}`;
    if (localEdits[fullKey] !== undefined && Array.isArray(localEdits[fullKey])) {
      return localEdits[fullKey];
    }
    return arr;
  }, [localEdits]);

  // Abbreviation+decimal guard: never break on "Dr. Smith", "vs. standard", "3.5 months"
  const splitBySentence = (text) => {
    if (!text) return [];
    return String(text).split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/).map(s => s.trim()).filter(s => s.length > 0 && !/^[.;,\s]+$/.test(s));
  };

  function reconstructFullText(sentences) {
    return sentences.map((s, i) => {
      let trimmed = s.replace(/[;.]+$/, '').trim();
      if (i < sentences.length - 1) trimmed += '.';
      return trimmed;
    }).join(' ');
  }

  // Safe _id extraction
  const getRecordId = (record) => {
    const rid = record._id;
    if (!rid) return null;
    if (typeof rid === 'string') return rid;
    if (rid.$oid) return rid.$oid;
    return String(rid);
  };

  // ─── handleSaveField ────────────────────────────────────────
  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fieldName, idx, sectionId, sentenceIdx, valueOverride, editTrackingKey) => {
    const rid = getRecordId(record);
    if (!rid) { console.error('[CmvMonitoringPlan] Cannot save — no record ID'); return; }
    const val = valueOverride !== undefined ? valueOverride : editValue;
    const ek = editTrackingKey || `${fieldName}-${idx}`;

    setLocalEdits(prev => ({ ...prev, [ek]: val }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    // Re-edit after approval → drop the section's approved flag so the button goes back to yellow Pending Approve
    setApprovedSections(prev => {
      const updated = { ...prev };
      delete updated[`${sectionId}-${idx}`];
      return updated;
    });

    // Persist the draft (fieldPart = "field" for scalar/sentence-full saves; this handler never
    // receives an array element — those stage inline in renderEditableArrayItem).
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][fieldName] = val;
    writeDrafts(store);

    setEditingField(null);
    setEditValue('');
  }, [editValue]);

  // ─── saveSentence ────────────────────────────────────────
  function saveSentence(record, fieldName, idx, sectionId, sentenceIdx) {
    const currentValue = String(getFieldValue(record, fieldName, idx) || '');
    const currentSentences = splitBySentence(currentValue);
    const editedVal = editValue.trim();

    if (!editedVal || /^[.;,\s]+$/.test(editedVal)) {
      // Delete sentence
      currentSentences.splice(sentenceIdx, 1);
      const newFullText = reconstructFullText(currentSentences);
      setEditedFields(prev => ({ ...prev, [`${fieldName}-${idx}`]: 'edited' }));
      handleSaveField(record, fieldName, idx, sectionId, null, newFullText, `${fieldName}-${idx}`);
      return;
    }

    const newSentences = splitBySentence(editedVal);
    currentSentences.splice(sentenceIdx, 1, ...newSentences);
    const newFullText = reconstructFullText(currentSentences);
    const fn = fieldName;

    // Track which sentences are edited/added
    const originalSentence = splitBySentence(String(record[fieldName] || ''))[sentenceIdx] || '';
    const originalChanged = newSentences[0].replace(/[;.]+$/, '').trim() !== originalSentence.replace(/[;.]+$/, '').trim();

    setEditedSentences(prev => {
      const n = { ...prev };
      if (originalChanged) n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited';
      const extraCount = newSentences.length - 1;
      for (let ei = 0; ei < extraCount; ei++) {
        n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added';
      }
      return n;
    });

    handleSaveField(record, fieldName, idx, sectionId, null, newFullText, `${fieldName}-${idx}`);
  }

  // ─── sectionHasEdits ────────────────────────────────────────
  // Declared BEFORE handleApproveSection — it appears in that hook's dependency array, which is
  // evaluated at render time (TDZ "Cannot access before initialization" crash otherwise, 6a4758db).
  const sectionHasEdits = useCallback((sectionId, idx) => {
    const fs = SECTION_FIELDS[sectionId] || [];
    return fs.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || k.startsWith(`${f}.`)) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  // ─── handleApproveSection ────────────────────────────────────────
  // Approve = COMMIT this section's staged drafts for this record to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sectionId, idx) => {
    const approveKey = `${sectionId}-${idx}`;
    const hasEdits = sectionHasEdits(sectionId, idx);
    if (approvedSections[approveKey] && !hasEdits) return;
    setSaving(true);
    try {
      const rid = getRecordId(record);
      if (!rid) return;
      const sectionFields = SECTION_FIELDS[sectionId] || [];

      // Collect this section's pending edits. editKey is "field-idx" (scalar/sentence) or
      // "field-idx-itemIdx" (array element). Field names contain no dashes, so split is unambiguous.
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k]) return false;
        const parts = k.split('-');
        if (parts.length < 2) return false;
        const field = parts[0];
        const recIdx = parseInt(parts[1], 10);
        return recIdx === idx && sectionFields.includes(field);
      });

      // Persist each staged field to the DB now (field, or field+arrayIndex for array elements)
      for (const editKey of toCommit) {
        const parts = editKey.split('-');
        const field = parts[0];
        const payload = { field, value: localEdits[editKey] };
        // arrayIndex ONLY when the trailing segment is purely numeric (array element editKey)
        if (parts.length >= 3 && /^\d+$/.test(parts[2])) payload.arrayIndex = parseInt(parts[2], 10);
        const resp = await secureApiClient.put(`/api/edit/cmv_monitoring_plan/${rid}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }

      await secureApiClient.put(`/api/edit/cmv_monitoring_plan/${rid}/approve`, { sectionId, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => {
        const next = { ...prev };
        toCommit.forEach(k => delete next[k]);
        return next;
      });
      // Drop this record's committed drafts from localStorage
      const store = readDrafts();
      if (store[rid]) {
        toCommit.forEach(editKey => {
          const parts = editKey.split('-');
          const fieldPart = (parts.length >= 3 && /^\d+$/.test(parts[2])) ? `${parts[0]}.${parts[2]}` : parts[0];
          delete store[rid][fieldPart];
        });
        if (Object.keys(store[rid]).length === 0) delete store[rid];
        writeDrafts(store);
      }

      setApprovedSections(prev => ({ ...prev, [approveKey]: true }));

      // Clear edit markers for this section
      const fields = SECTION_FIELDS[sectionId] || [];
      setEditedFields(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(k => {
          fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || k.startsWith(`${f}.`)) delete next[k]; });
        });
        return next;
      });
      setEditedSentences(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(k => {
          fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || k.startsWith(`${f}.`)) delete next[k]; });
        });
        return next;
      });
    } catch (err) {
      console.error('[CmvMonitoringPlan] Approve error:', err);
    } finally { setSaving(false); }
  }, [approvedSections, editedFields, editedSentences, localEdits, pendingEdits, sectionHasEdits]);

  // ─── renderApproveButton (hasEdits BEFORE isApproved) ────────────────────
  const renderApproveButton = (record, sectionId, idx) => {
    const approveKey = `${sectionId}-${idx}`;
    const isApproved = approvedSections[approveKey] || record.approvedSections?.[sectionId];
    const hasEdits = sectionHasEdits(sectionId, idx);

    if (hasEdits) {
      return (
        <button className="approve-badge pending" disabled={saving} onClick={(e) => { e.stopPropagation(); handleApproveSection(record, sectionId, idx); }}>
          {saving ? 'Approving...' : 'Pending Approve'}
        </button>
      );
    }
    if (isApproved) {
      return <span className="approve-badge approved">Approved</span>;
    }
    return null;
  };

  // ─── renderDateField (date-picker) ────────────────────────────────────────
  const renderDateField = (record, fieldName, label, idx, sectionId) => {
    const val = getFieldValue(record, fieldName, idx);
    if (!hasVal(val)) return null;
    const editKey = `${fieldName}-${idx}`;
    const isEditing = editingField === editKey;
    const isEdited = editedFields[editKey];
    const displayVal = formatDate(val);

    if (isEditing) {
      return (
        <div className="rec-mini-card" key={fieldName}>
          <div className="nested-subtitle">{highlightText(label)}</div>
          <div className="edit-field-container">
            <BlueDatePicker value={editValue} onSelect={(iso) => setEditValue(iso)} />
            <div className="edit-actions">
              <button className="save-btn" disabled={saving} onClick={() => {
                if (isNaN(new Date(editValue).getTime())) return;
                handleSaveField(record, fieldName, idx, sectionId, null, editValue + 'T00:00:00.000Z');
              }}>{saving ? 'Saving...' : 'Save'}</button>
              <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="rec-mini-card" key={fieldName}>
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row editable-row${isEdited ? ' modified' : ''}`}
          onClick={() => { setEditingField(editKey); setEditValue(toInputDate(val)); }}>
          <span className="content-value">{highlightText(displayVal)}<span className="edit-indicator"> ✎</span></span>
        </div>
        {isEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </div>
    );
  };

  // ─── renderNumberField (typed numeric input) ──────────────────────────────
  const renderNumberField = (record, fieldName, label, idx, sectionId) => {
    const val = getFieldValue(record, fieldName, idx);
    // 0 is meaningful (e.g. undetectable viral load) — keep visible
    if (!hasVal(val) && val !== 0) return null;
    const editKey = `${fieldName}-${idx}`;
    const isEditing = editingField === editKey;
    const isEdited = editedFields[editKey];
    const displayVal = String(val);

    if (isEditing) {
      return (
        <div className="rec-mini-card" key={fieldName}>
          <div className="nested-subtitle">{highlightText(label)}</div>
          <div className="edit-field-container">
            <div className="num-stepper-row">
              <button type="button" className="num-step" disabled={saving} onClick={() => { const st = parseFloat(stepFor(val)) || 1; const dec = (String(st).split('.')[1] || '').length; const cur = parseFloat(editValue); setEditValue(Math.max(0, (isNaN(cur) ? 0 : cur) - st).toFixed(dec)); }}>−</button>
              <input type="number" step={stepFor(val)} min="0" className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter') { const p = parseFloat(editValue); if (!isNaN(p)) handleSaveField(record, fieldName, idx, sectionId, null, p); }
                  if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
                }} />
              <button type="button" className="num-step" disabled={saving} onClick={() => { const st = parseFloat(stepFor(val)) || 1; const dec = (String(st).split('.')[1] || '').length; const cur = parseFloat(editValue); setEditValue(Math.max(0, (isNaN(cur) ? 0 : cur) + st).toFixed(dec)); }}>+</button>
            </div>
            <div className="edit-actions">
              <button className="save-btn" disabled={saving} onClick={() => {
                const p = parseFloat(editValue);
                if (isNaN(p)) return;
                handleSaveField(record, fieldName, idx, sectionId, null, p);
              }}>{saving ? 'Saving...' : 'Save'}</button>
              <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="rec-mini-card" key={fieldName}>
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row editable-row${isEdited ? ' modified' : ''}`}
          onClick={() => { setEditingField(editKey); setEditValue(String(val)); }}>
          <span className="content-value">{highlightText(displayVal)}<span className="edit-indicator"> ✎</span></span>
        </div>
        {isEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </div>
    );
  };

  // ─── renderEditableField ────────────────────────────────────────
  const renderEditableField = (record, fieldName, label, idx, sectionId) => {
    if (DATE_FIELDS.includes(fieldName)) return renderDateField(record, fieldName, label, idx, sectionId);
    if (NUMBER_FIELDS.includes(fieldName)) return renderNumberField(record, fieldName, label, idx, sectionId);
    const val = getFieldValue(record, fieldName, idx);
    if (!hasVal(val)) return null;
    const editKey = `${fieldName}-${idx}`;
    const isEditing = editingField === editKey;
    const isEdited = editedFields[editKey];
    const displayVal = String(val);
    const enumOpts = ENUM_FIELDS[fieldName];

    if (isEditing) {
      return (
        <div className="rec-mini-card" key={fieldName}>
          <div className="nested-subtitle">{highlightText(label)}</div>
          <div className="edit-field-container">
            {enumOpts ? (
              <select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus
                onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}>
                {enumOptionsWith(enumOpts, editValue).map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && e.ctrlKey) handleSaveField(record, fieldName, idx, sectionId);
                  if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
                }} autoFocus rows={2} />
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
      <div className="rec-mini-card" key={fieldName}>
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row editable-row${isEdited ? ' modified' : ''}`}
          onClick={() => { setEditingField(editKey); setEditValue(enumOpts ? enumSeed(enumOpts, val) : String(val)); }}>
          <span className="content-value">{highlightText(displayVal)}<span className="edit-indicator"> ✎</span></span>
        </div>
        {isEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </div>
    );
  };

  // ─── renderSentenceEditableField ────────────────────────────────────────
  const renderSentenceEditableField = (record, fieldName, label, idx, sectionId) => {
    const val = getFieldValue(record, fieldName, idx);
    if (!hasVal(val)) return null;
    const sentences = splitBySentence(String(val));

    if (sentences.length <= 1) {
      return renderEditableField(record, fieldName, label, idx, sectionId);
    }

    return (
      <div className="rec-mini-card" key={fieldName}>
        <div className="nested-subtitle">{highlightText(label)}</div>
        {sentences.map((sentence, sIdx) => {
          const sentenceKey = `${fieldName}-${idx}-s${sIdx}`;
          const isEditing = editingField === sentenceKey;
          const editStatus = editedSentences[sentenceKey];

          if (isEditing) {
            return (
              <div key={sIdx} className="edit-field-container">
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && e.ctrlKey) saveSentence(record, fieldName, idx, sectionId, sIdx);
                    if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
                  }} autoFocus rows={2} />
                <div className="edit-actions">
                  <button className="save-btn" onClick={() => saveSentence(record, fieldName, idx, sectionId, sIdx)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                  <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
                </div>
              </div>
            );
          }

          const sentenceDisplay = sentence.replace(/[;.]+$/, '').trim();
          return (
            <React.Fragment key={sIdx}>
              <div className={`numbered-row editable-row${editStatus ? ' modified' : ''}`}
                onClick={() => { setEditingField(sentenceKey); setEditValue(sentenceDisplay); }}>
                <span className="content-value">{highlightText(sentenceDisplay)}<span className="edit-indicator"> ✎</span></span>
              </div>
              {editStatus && <div className={`modified-badge${editStatus === 'added' ? ' added' : ''}`}>{editStatus === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</div>}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  // ─── renderEditableArrayItem ────────────────────────────────────────
  const renderEditableArrayItem = (record, fieldName, idx, sectionId, item, itemIdx) => {
    const editKey = `${fieldName}-${idx}-${itemIdx}`;
    const isEditing = editingField === editKey;
    const isEdited = editedFields[editKey];
    const effectiveVal = localEdits[editKey] !== undefined ? localEdits[editKey] : item;

    // Stage an array-element edit as a DRAFT (no DB write). localStorage keeps it across refresh;
    // Approve commits it. fieldPart = "field.itemIdx" (reversible to field + arrayIndex on approve).
    const stageArrayEdit = () => {
      const rid = getRecordId(record);
      if (!rid) { console.error('[CmvMonitoringPlan] Cannot save — no record ID'); return; }
      setLocalEdits(prev => ({ ...prev, [editKey]: editValue }));
      setPendingEdits(prev => ({ ...prev, [editKey]: true }));
      setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
      setApprovedSections(prev => {
        const updated = { ...prev };
        delete updated[`${sectionId}-${idx}`];
        return updated;
      });
      const store = readDrafts();
      if (!store[rid]) store[rid] = {};
      store[rid][`${fieldName}.${itemIdx}`] = editValue;
      writeDrafts(store);
      setEditingField(null);
      setEditValue('');
    };

    if (isEditing) {
      return (
        <div key={itemIdx} className="edit-field-container">
          <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && e.ctrlKey) stageArrayEdit();
              if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
            }} autoFocus rows={2} />
          <div className="edit-actions">
            <button className="save-btn" disabled={saving} onClick={stageArrayEdit}>{saving ? 'Saving...' : 'Save'}</button>
            <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
          </div>
        </div>
      );
    }

    return (
      <React.Fragment key={itemIdx}>
        <div className={`numbered-row editable-row${isEdited ? ' modified' : ''}`}
          onClick={() => { setEditingField(editKey); setEditValue(String(effectiveVal)); }}>
          <span className="content-value">{highlightText(String(effectiveVal))}<span className="edit-indicator"> ✎</span></span>
        </div>
        {isEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </React.Fragment>
    );
  };

  // ─── renderNonEditableField ────────────────────────────────────────
  const renderNonEditableField = (label, value) => {
    if (!hasVal(value)) return null;
    return (
      <div className="rec-mini-card" key={label}>
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className="numbered-row">
          <span className="content-value">{highlightText(String(value))}</span>
        </div>
      </div>
    );
  };

  // ─── Search / Highlight ────────────────────────────────────────
  const highlightText = (text) => {
    if (!text || !searchTerm.trim()) return text;
    const textStr = String(text);
    const phrase = searchTerm.trim();
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = textStr.split(regex);
    return parts.map((part, i) =>
      part.toLowerCase() === phrase.toLowerCase()
        ? <mark key={i}>{part}</mark>
        : part
    );
  };

  const shouldShowRow = (...args) => {
    if (!searchTerm.trim()) return true;
    const phrase = searchTerm.toLowerCase().trim();
    return args.some(a => a && String(a).toLowerCase().includes(phrase));
  };

  // Filtered records with 4-level search
  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();

    return records.map((record, idx) => {
      const recordNumber = String(idx + 1);
      const docTitle = `CMV Monitoring Plan ${recordNumber}`;
      let showAllSections = false;

      if (docTitle.toLowerCase().includes(phrase)) showAllSections = true;

      const allFieldValues = [
        docTitle, record.provider, record.facility, record.patientImmuneStatus,
        record.transplantType, record.donorCmvSerostatus, record.recipientCmvSerostatus,
        record.riskStratification, record.monitoringFrequency, record.monitoringMethod,
        record.viralLoadTrend, record.immunosuppressionLevel, record.prophylaxisRegimen,
        record.preemptiveTherapyIndication, record.drugResistanceTesting,
        record.ganciclovirResistance, record.alternativeTherapyRequired,
        record.currentViralLoad !== undefined ? String(record.currentViralLoad) : '',
        record.viralLoadThreshold !== undefined ? String(record.viralLoadThreshold) : '',
        record.cd4Count !== undefined ? String(record.cd4Count) : '',
        record.previousCmvEpisodes !== undefined ? String(record.previousCmvEpisodes) : '',
        record.prophylaxisDuration !== undefined ? String(record.prophylaxisDuration) : '',
        'Patient Information', 'Transplant Information', 'Monitoring Details',
        'Viral Status', 'Clinical Status', 'CMV Disease Symptoms', 'Treatment Information',
        ...(record.cmvDiseaseSymptoms || []),
      ].filter(Boolean).join(' ').toLowerCase();

      const matches = allFieldValues.includes(phrase);

      return { ...record, _showAllSections: showAllSections, _matches: matches || showAllSections };
    }).filter(r => r._matches);
  }, [records, searchTerm]);

  // ─── pdfData memo ────────────────────────────────────────
  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return filteredRecords;
    return filteredRecords.map((record, idx) => {
      const merged = { ...record };
      Object.keys(localEdits).forEach(k => {
        if (pendingEdits[k]) return; // pending drafts stay OUT of the PDF until approved
        const lastDash = k.lastIndexOf('-');
        if (lastDash > 0) {
          const field = k.substring(0, lastDash);
          const recIdx = parseInt(k.substring(lastDash + 1));
          if (recIdx === idx && !k.includes('-s') && merged.hasOwnProperty(field)) {
            merged[field] = localEdits[k];
          }
        }
      });
      // Array fields: apply only NON-pending element edits (committed) over the original.
      ARRAY_FIELDS.forEach(field => {
        const arr = Array.isArray(record[field]) ? [...record[field]] : [];
        Object.keys(localEdits).forEach(k => {
          if (pendingEdits[k]) return; // pending drafts stay OUT of the PDF until approved
          const match = k.match(new RegExp(`^${field}-(\\d+)-(\\d+)$`));
          if (match && parseInt(match[1]) === idx) arr[parseInt(match[2])] = localEdits[k];
        });
        merged[field] = arr;
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  // ─── Copy helpers ────────────────────────────────────────
  const copyToClipboard = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const buildSectionCopyText = (record, idx, sectionId) => {
    const r = pdfData[idx] || record;
    // [label, value, kind?] triples → "Label\n----\n1. value" blocks (labels underlined, VALUES
    // numbered — never numbered labels with indented values). kind 'sentence' splits the value into
    // numbered sentence rows so copy mirrors the JSX mini-card rows and the PDF.
    const EQ = '='.repeat(40);
    const DASH = '-'.repeat(40);
    const collectFields = (pairs) => {
      const valid = pairs.filter(p => p && hasVal(p[1]));
      return valid.map(([label, val, kind]) => {
        const rows = kind === 'sentence' ? splitBySentence(String(val)) : [];
        const lines = (rows.length ? rows : [String(val)]).map((s, i) => `${i + 1}. ${s}`).join('\n');
        return `${label}\n${DASH}\n${lines}`;
      }).join('\n\n');
    };

    switch (sectionId) {
      case 'patient-info': {
        const fields = collectFields([
          r.date ? ['Date', formatDate(r.date)] : null,
          ['Provider', r.provider],
          ['Facility', r.facility],
          ['Patient Immune Status', r.patientImmuneStatus, 'sentence'],
        ]);
        return fields ? `PATIENT INFORMATION\n${EQ}\n\n${fields}` : '';
      }
      case 'transplant-info': {
        const fields = collectFields([
          ['Transplant Type', r.transplantType],
          r.transplantDate ? ['Transplant Date', formatDate(r.transplantDate)] : null,
          ['Donor CMV Serostatus', r.donorCmvSerostatus],
          ['Recipient CMV Serostatus', r.recipientCmvSerostatus],
          ['Risk Stratification', r.riskStratification, 'sentence'],
        ]);
        return fields ? `TRANSPLANT INFORMATION\n${EQ}\n\n${fields}` : '';
      }
      case 'monitoring-details': {
        const fields = collectFields([
          ['Monitoring Frequency', r.monitoringFrequency],
          ['Monitoring Method', r.monitoringMethod],
          hasVal(r.viralLoadThreshold) ? ['Viral Load Threshold', `${r.viralLoadThreshold} copies/mL`] : null,
          r.nextMonitoringDate ? ['Next Monitoring Date', formatDate(r.nextMonitoringDate)] : null,
        ]);
        return fields ? `MONITORING DETAILS\n${EQ}\n\n${fields}` : '';
      }
      case 'viral-status': {
        const fields = collectFields([
          hasVal(r.currentViralLoad) ? ['Current Viral Load', `${r.currentViralLoad} copies/mL`] : null,
          ['Viral Load Trend', r.viralLoadTrend],
        ]);
        return fields ? `VIRAL STATUS\n${EQ}\n\n${fields}` : '';
      }
      case 'clinical-status': {
        const fields = collectFields([
          hasVal(r.cd4Count) ? ['CD4 Count', `${r.cd4Count} cells/uL`] : null,
          hasVal(r.previousCmvEpisodes) ? ['Previous CMV Episodes', String(r.previousCmvEpisodes)] : null,
          ['Immunosuppression Level', r.immunosuppressionLevel],
        ]);
        return fields ? `CLINICAL STATUS\n${EQ}\n\n${fields}` : '';
      }
      case 'cmv-symptoms': {
        // r is the pdfData row → its cmvDiseaseSymptoms already has committed (non-pending) edits applied.
        const symptoms = (Array.isArray(r.cmvDiseaseSymptoms) ? r.cmvDiseaseSymptoms : []).filter(Boolean);
        if (symptoms.length === 0) return '';
        // Single-name rule: field label == section title → no sub-label, items right under the title.
        const items = symptoms.map((s, i) => `${i + 1}. ${s}`).join('\n');
        return `CMV DISEASE SYMPTOMS\n${EQ}\n\n${items}`;
      }
      case 'treatment-info': {
        const fields = collectFields([
          ['Prophylaxis Regimen', r.prophylaxisRegimen],
          hasVal(r.prophylaxisDuration) ? ['Prophylaxis Duration', `${r.prophylaxisDuration} days`] : null,
          ['Preemptive Therapy Indication', r.preemptiveTherapyIndication, 'sentence'],
          ['Drug Resistance Testing', r.drugResistanceTesting, 'sentence'],
          ['Ganciclovir Resistance', r.ganciclovirResistance, 'sentence'],
          ['Alternative Therapy Required', r.alternativeTherapyRequired, 'sentence'],
        ]);
        return fields ? `TREATMENT INFORMATION\n${EQ}\n\n${fields}` : '';
      }
      default: return '';
    }
  };

  const copyAllText = async () => {
    let text = 'CMV MONITORING PLAN RECORDS\n\n';
    pdfData.forEach((record, idx) => {
      text += `CMV Monitoring Plan ${idx + 1}\n`;
      text += '='.repeat(40) + '\n\n';
      ['patient-info', 'transplant-info', 'monitoring-details', 'viral-status', 'clinical-status', 'cmv-symptoms', 'treatment-info'].forEach(sid => {
        const sectionText = buildSectionCopyText(record, idx, sid);
        if (sectionText) text += sectionText + '\n\n';
      });
      text += '\n';
    });
    copyToClipboard(text.trim(), 'copy-all');
  };

  // ─── Render ────────────────────────────────────────
  if (!records || records.length === 0) {
    return (
      <div className="cmv-monitoring-plan">
        <div className="document-header">
          <h2 className="document-title">CMV Monitoring Plan</h2>
        </div>
        <p className="no-data">No CMV monitoring plan data available.</p>
      </div>
    );
  }

  return (
    <div className="cmv-monitoring-plan">
      <div className="document-header">
        <h1 className="document-title">CMV Monitoring Plan</h1>
        <div className="header-actions">
          <button className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`} onClick={copyAllText}>
            {copiedId === 'copy-all' ? 'Copied!' : 'Copy All'}
          </button>
          <PDFDownloadLink document={<CmvMonitoringPlanDocumentPDFTemplate document={pdfData} />} fileName="CMV_Monitoring_Plan.pdf">
            {({ loading }) => (
              <button className={`pdf-btn${copiedId === 'pdf' ? ' copied' : ''}`}>{loading ? 'Preparing...' : 'Export PDF'}</button>
            )}
          </PDFDownloadLink>
        </div>
      </div>

      <SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} placeholder="Search CMV monitoring plans..." />

      {filteredRecords.map((record, idx) => {
        const phrase = searchTerm.toLowerCase().trim();

        return (
          <div key={idx} className="record-card">
            <div className="record-header">
              <div className="record-meta-row">
                {record.date && <span className="record-date">{highlightText(formatDate(record.date))}</span>}
              </div>
              <div className="record-title-row">
                <h3 className="record-name">{highlightText(`CMV Monitoring Plan ${idx + 1}`)}</h3>
              </div>
            </div>

            <div className="card-content">
              {/* Patient Information */}
              {(() => {
                const sectionTitleMatches = phrase && 'patient information'.includes(phrase);
                const showProvider = hasVal(record.provider) && (record._showAllSections || sectionTitleMatches || shouldShowRow('provider', record.provider));
                const showFacility = hasVal(record.facility) && (record._showAllSections || sectionTitleMatches || shouldShowRow('facility', record.facility));
                const showImmuneStatus = hasVal(record.patientImmuneStatus) && (record._showAllSections || sectionTitleMatches || shouldShowRow('patient immune status', record.patientImmuneStatus));
                const showDate = hasVal(record.date) && (record._showAllSections || sectionTitleMatches || shouldShowRow('date', formatDate(record.date)));

                if (!(showDate || showProvider || showFacility || showImmuneStatus)) return null;

                return (
                  <div className="mini-cards-container">
                    <div className="section-header">
                      <h4 className="section-title">{highlightText('Patient Information')}</h4>
                      <div className="section-actions">
                        <button className={`copy-btn${copiedId === `patient-info-${idx}` ? ' copied' : ''}`}
                          onClick={() => copyToClipboard(buildSectionCopyText(record, idx, 'patient-info'), `patient-info-${idx}`)}>
                          {copiedId === `patient-info-${idx}` ? 'Copied!' : 'Copy Section'}
                        </button>
                        {renderApproveButton(record, 'patient-info', idx)}
                      </div>
                    </div>
                    {showDate && renderEditableField(record, 'date', 'Date', idx, 'patient-info')}
                    {showProvider && renderEditableField(record, 'provider', 'Provider', idx, 'patient-info')}
                    {showFacility && renderEditableField(record, 'facility', 'Facility', idx, 'patient-info')}
                    {showImmuneStatus && (SENTENCE_FIELDS.includes('patientImmuneStatus')
                      ? renderSentenceEditableField(record, 'patientImmuneStatus', 'Patient Immune Status', idx, 'patient-info')
                      : renderEditableField(record, 'patientImmuneStatus', 'Patient Immune Status', idx, 'patient-info'))}
                  </div>
                );
              })()}

              {/* Transplant Information */}
              {(() => {
                const sectionTitleMatches = phrase && 'transplant information'.includes(phrase);
                const showTransplantType = hasVal(record.transplantType) && (record._showAllSections || sectionTitleMatches || shouldShowRow('transplant type', record.transplantType));
                const showTransplantDate = hasVal(record.transplantDate) && (record._showAllSections || sectionTitleMatches || shouldShowRow('transplant date', formatDate(record.transplantDate)));
                const showDonor = hasVal(record.donorCmvSerostatus) && (record._showAllSections || sectionTitleMatches || shouldShowRow('donor cmv serostatus', record.donorCmvSerostatus));
                const showRecipient = hasVal(record.recipientCmvSerostatus) && (record._showAllSections || sectionTitleMatches || shouldShowRow('recipient cmv serostatus', record.recipientCmvSerostatus));
                const showRisk = hasVal(record.riskStratification) && (record._showAllSections || sectionTitleMatches || shouldShowRow('risk stratification', record.riskStratification));

                if (!(showTransplantType || showTransplantDate || showDonor || showRecipient || showRisk)) return null;

                return (
                  <div className="mini-cards-container">
                    <div className="section-header">
                      <h4 className="section-title">{highlightText('Transplant Information')}</h4>
                      <div className="section-actions">
                        <button className={`copy-btn${copiedId === `transplant-info-${idx}` ? ' copied' : ''}`}
                          onClick={() => copyToClipboard(buildSectionCopyText(record, idx, 'transplant-info'), `transplant-info-${idx}`)}>
                          {copiedId === `transplant-info-${idx}` ? 'Copied!' : 'Copy Section'}
                        </button>
                        {renderApproveButton(record, 'transplant-info', idx)}
                      </div>
                    </div>
                    {showTransplantType && renderEditableField(record, 'transplantType', 'Transplant Type', idx, 'transplant-info')}
                    {showTransplantDate && renderEditableField(record, 'transplantDate', 'Transplant Date', idx, 'transplant-info')}
                    {showDonor && renderEditableField(record, 'donorCmvSerostatus', 'Donor CMV Serostatus', idx, 'transplant-info')}
                    {showRecipient && renderEditableField(record, 'recipientCmvSerostatus', 'Recipient CMV Serostatus', idx, 'transplant-info')}
                    {showRisk && (SENTENCE_FIELDS.includes('riskStratification')
                      ? renderSentenceEditableField(record, 'riskStratification', 'Risk Stratification', idx, 'transplant-info')
                      : renderEditableField(record, 'riskStratification', 'Risk Stratification', idx, 'transplant-info'))}
                  </div>
                );
              })()}

              {/* Monitoring Details */}
              {(() => {
                const sectionTitleMatches = phrase && 'monitoring details'.includes(phrase);
                const showFrequency = hasVal(record.monitoringFrequency) && (record._showAllSections || sectionTitleMatches || shouldShowRow('monitoring frequency', record.monitoringFrequency));
                const showMethod = hasVal(record.monitoringMethod) && (record._showAllSections || sectionTitleMatches || shouldShowRow('monitoring method', record.monitoringMethod));
                const showThreshold = hasVal(record.viralLoadThreshold) && (record._showAllSections || sectionTitleMatches || shouldShowRow('viral load threshold', String(record.viralLoadThreshold)));
                const showNextDate = hasVal(record.nextMonitoringDate) && (record._showAllSections || sectionTitleMatches || shouldShowRow('next monitoring date', formatDate(record.nextMonitoringDate)));

                if (!(showFrequency || showMethod || showThreshold || showNextDate)) return null;

                return (
                  <div className="mini-cards-container">
                    <div className="section-header">
                      <h4 className="section-title">{highlightText('Monitoring Details')}</h4>
                      <div className="section-actions">
                        <button className={`copy-btn${copiedId === `monitoring-details-${idx}` ? ' copied' : ''}`}
                          onClick={() => copyToClipboard(buildSectionCopyText(record, idx, 'monitoring-details'), `monitoring-details-${idx}`)}>
                          {copiedId === `monitoring-details-${idx}` ? 'Copied!' : 'Copy Section'}
                        </button>
                        {renderApproveButton(record, 'monitoring-details', idx)}
                      </div>
                    </div>
                    {showFrequency && renderEditableField(record, 'monitoringFrequency', 'Monitoring Frequency', idx, 'monitoring-details')}
                    {showMethod && renderEditableField(record, 'monitoringMethod', 'Monitoring Method', idx, 'monitoring-details')}
                    {showThreshold && renderEditableField(record, 'viralLoadThreshold', 'Viral Load Threshold', idx, 'monitoring-details')}
                    {showNextDate && renderEditableField(record, 'nextMonitoringDate', 'Next Monitoring Date', idx, 'monitoring-details')}
                  </div>
                );
              })()}

              {/* Viral Status */}
              {(() => {
                const sectionTitleMatches = phrase && 'viral status'.includes(phrase);
                const showViralLoad = hasVal(record.currentViralLoad) && (record._showAllSections || sectionTitleMatches || shouldShowRow('current viral load', String(record.currentViralLoad)));
                const showTrend = hasVal(record.viralLoadTrend) && (record._showAllSections || sectionTitleMatches || shouldShowRow('viral load trend', record.viralLoadTrend));

                if (!(showViralLoad || showTrend)) return null;

                return (
                  <div className="mini-cards-container">
                    <div className="section-header">
                      <h4 className="section-title">{highlightText('Viral Status')}</h4>
                      <div className="section-actions">
                        <button className={`copy-btn${copiedId === `viral-status-${idx}` ? ' copied' : ''}`}
                          onClick={() => copyToClipboard(buildSectionCopyText(record, idx, 'viral-status'), `viral-status-${idx}`)}>
                          {copiedId === `viral-status-${idx}` ? 'Copied!' : 'Copy Section'}
                        </button>
                        {renderApproveButton(record, 'viral-status', idx)}
                      </div>
                    </div>
                    {showViralLoad && renderEditableField(record, 'currentViralLoad', 'Current Viral Load', idx, 'viral-status')}
                    {showTrend && renderEditableField(record, 'viralLoadTrend', 'Viral Load Trend', idx, 'viral-status')}
                  </div>
                );
              })()}

              {/* Clinical Status */}
              {(() => {
                const sectionTitleMatches = phrase && 'clinical status'.includes(phrase);
                const showCd4 = hasVal(record.cd4Count) && (record._showAllSections || sectionTitleMatches || shouldShowRow('cd4 count', String(record.cd4Count)));
                const showEpisodes = hasVal(record.previousCmvEpisodes) && (record._showAllSections || sectionTitleMatches || shouldShowRow('previous cmv episodes', String(record.previousCmvEpisodes)));
                const showImmunosuppression = hasVal(record.immunosuppressionLevel) && (record._showAllSections || sectionTitleMatches || shouldShowRow('immunosuppression level', record.immunosuppressionLevel));

                if (!(showCd4 || showEpisodes || showImmunosuppression)) return null;

                return (
                  <div className="mini-cards-container">
                    <div className="section-header">
                      <h4 className="section-title">{highlightText('Clinical Status')}</h4>
                      <div className="section-actions">
                        <button className={`copy-btn${copiedId === `clinical-status-${idx}` ? ' copied' : ''}`}
                          onClick={() => copyToClipboard(buildSectionCopyText(record, idx, 'clinical-status'), `clinical-status-${idx}`)}>
                          {copiedId === `clinical-status-${idx}` ? 'Copied!' : 'Copy Section'}
                        </button>
                        {renderApproveButton(record, 'clinical-status', idx)}
                      </div>
                    </div>
                    {showCd4 && renderEditableField(record, 'cd4Count', 'CD4 Count', idx, 'clinical-status')}
                    {showEpisodes && renderEditableField(record, 'previousCmvEpisodes', 'Previous CMV Episodes', idx, 'clinical-status')}
                    {showImmunosuppression && renderEditableField(record, 'immunosuppressionLevel', 'Immunosuppression Level', idx, 'clinical-status')}
                  </div>
                );
              })()}

              {/* CMV Disease Symptoms */}
              {(() => {
                const symptoms = getEffectiveArray(record, 'cmvDiseaseSymptoms', idx);
                if (!symptoms || symptoms.length === 0) return null;
                const sectionTitleMatches = phrase && 'cmv disease symptoms'.includes(phrase);

                const visibleSymptoms = symptoms.map((s, sIdx) => {
                  if (!s) return null;
                  const show = record._showAllSections || sectionTitleMatches || shouldShowRow(s);
                  return show ? { symptom: s, sIdx } : null;
                }).filter(Boolean);

                if (visibleSymptoms.length === 0) return null;

                return (
                  <div className="mini-cards-container">
                    <div className="section-header">
                      <h4 className="section-title">{highlightText('CMV Disease Symptoms')}</h4>
                      <div className="section-actions">
                        <button className={`copy-btn${copiedId === `cmv-symptoms-${idx}` ? ' copied' : ''}`}
                          onClick={() => copyToClipboard(buildSectionCopyText(record, idx, 'cmv-symptoms'), `cmv-symptoms-${idx}`)}>
                          {copiedId === `cmv-symptoms-${idx}` ? 'Copied!' : 'Copy Section'}
                        </button>
                        {renderApproveButton(record, 'cmv-symptoms', idx)}
                      </div>
                    </div>
                    {visibleSymptoms.map(({ symptom, sIdx }) =>
                      renderEditableArrayItem(record, 'cmvDiseaseSymptoms', idx, 'cmv-symptoms', symptom, sIdx)
                    )}
                  </div>
                );
              })()}

              {/* Treatment Information */}
              {(() => {
                const sectionTitleMatches = phrase && 'treatment information'.includes(phrase);
                const showProphylaxis = hasVal(record.prophylaxisRegimen) && (record._showAllSections || sectionTitleMatches || shouldShowRow('prophylaxis regimen', record.prophylaxisRegimen));
                const showDuration = hasVal(record.prophylaxisDuration) && (record._showAllSections || sectionTitleMatches || shouldShowRow('prophylaxis duration', String(record.prophylaxisDuration)));
                const showPreemptive = hasVal(record.preemptiveTherapyIndication) && (record._showAllSections || sectionTitleMatches || shouldShowRow('preemptive therapy indication', record.preemptiveTherapyIndication));
                const showDrugResistance = hasVal(record.drugResistanceTesting) && (record._showAllSections || sectionTitleMatches || shouldShowRow('drug resistance testing', record.drugResistanceTesting));
                const showGanciclovir = hasVal(record.ganciclovirResistance) && (record._showAllSections || sectionTitleMatches || shouldShowRow('ganciclovir resistance', record.ganciclovirResistance));
                const showAlternative = hasVal(record.alternativeTherapyRequired) && (record._showAllSections || sectionTitleMatches || shouldShowRow('alternative therapy required', record.alternativeTherapyRequired));

                if (!(showProphylaxis || showDuration || showPreemptive || showDrugResistance || showGanciclovir || showAlternative)) return null;

                return (
                  <div className="mini-cards-container">
                    <div className="section-header">
                      <h4 className="section-title">{highlightText('Treatment Information')}</h4>
                      <div className="section-actions">
                        <button className={`copy-btn${copiedId === `treatment-info-${idx}` ? ' copied' : ''}`}
                          onClick={() => copyToClipboard(buildSectionCopyText(record, idx, 'treatment-info'), `treatment-info-${idx}`)}>
                          {copiedId === `treatment-info-${idx}` ? 'Copied!' : 'Copy Section'}
                        </button>
                        {renderApproveButton(record, 'treatment-info', idx)}
                      </div>
                    </div>
                    {showProphylaxis && renderEditableField(record, 'prophylaxisRegimen', 'Prophylaxis Regimen', idx, 'treatment-info')}
                    {showDuration && renderEditableField(record, 'prophylaxisDuration', 'Prophylaxis Duration', idx, 'treatment-info')}
                    {showPreemptive && (SENTENCE_FIELDS.includes('preemptiveTherapyIndication')
                      ? renderSentenceEditableField(record, 'preemptiveTherapyIndication', 'Preemptive Therapy Indication', idx, 'treatment-info')
                      : renderEditableField(record, 'preemptiveTherapyIndication', 'Preemptive Therapy Indication', idx, 'treatment-info'))}
                    {showDrugResistance && (SENTENCE_FIELDS.includes('drugResistanceTesting')
                      ? renderSentenceEditableField(record, 'drugResistanceTesting', 'Drug Resistance Testing', idx, 'treatment-info')
                      : renderEditableField(record, 'drugResistanceTesting', 'Drug Resistance Testing', idx, 'treatment-info'))}
                    {showGanciclovir && (SENTENCE_FIELDS.includes('ganciclovirResistance')
                      ? renderSentenceEditableField(record, 'ganciclovirResistance', 'Ganciclovir Resistance', idx, 'treatment-info')
                      : renderEditableField(record, 'ganciclovirResistance', 'Ganciclovir Resistance', idx, 'treatment-info'))}
                    {showAlternative && (SENTENCE_FIELDS.includes('alternativeTherapyRequired')
                      ? renderSentenceEditableField(record, 'alternativeTherapyRequired', 'Alternative Therapy Required', idx, 'treatment-info')
                      : renderEditableField(record, 'alternativeTherapyRequired', 'Alternative Therapy Required', idx, 'treatment-info'))}
                  </div>
                );
              })()}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default CmvMonitoringPlanDocument;
