/**
 * AsthmaManagementNotesDocument.jsx
 * Inline editing with per-section approve, PDFDownloadLink + pdfData memo,
 * secureApiClient for all API calls.
 * highlightText uses React mark elements (safe, no raw HTML injection)
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import AsthmaManagementNotesDocumentPDFTemplate from '../pdf-templates/AsthmaManagementNotesDocumentPDFTemplate';
import './AsthmaManagementNotesDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }
   fieldPart = "field" (field-level) or "field-itemIdx" (array element, trailing numeric segment) */
const DRAFT_KEY = 'asthma_management_notesPendingEdits';
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
  sessionInfo: ['provider', 'facility'],
  classification: ['asthmaType', 'severity', 'controlLevel'],
  symptoms: ['symptoms'],
  triggers: ['triggers'],
  pulmonaryFunction: ['peakFlow', 'spirometry'],
  medications: ['medications'],
  treatmentPlan: ['medicationChanges', 'actionPlan', 'education', 'followUp'],
  notes: ['notes'],
};

const FIELD_LABELS = {
  provider: 'Provider',
  facility: 'Facility',
  asthmaType: 'Asthma Type',
  severity: 'Severity',
  controlLevel: 'Control Level',
  peakFlow: 'Peak Flow',
  spirometry: 'Spirometry',
  medicationChanges: 'Medication Changes',
  actionPlan: 'Action Plan',
  education: 'Patient Education',
  followUp: 'Follow-Up',
  notes: 'Notes',
  symptoms: 'Current Symptoms',
  triggers: 'Triggers',
  medications: 'Medications',
};

const ARRAY_FIELDS = ['symptoms', 'triggers', 'medications'];

/* Detect an embedded "Label: value" (e.g. a Notes sentence "GINA Assessment: Severe persistent asthma, Step 4-5 ..."
   or an Action Plan sentence "Green Zone (Peak Flow >380): Budesonide/Formoterol 2 puffs BID, ...").
   Requires a space after the colon (so "280 L/min", ratios/times never match) and a sane label length. */
const parseLabel = (text) => {
  const s = String(text == null ? '' : text);
  const m = s.match(/^([^:]{1,80}):\s+(\S.*)$/s);
  return m ? { label: m[1].trim(), value: m[2].trim() } : null;
};

const AsthmaManagementNotesDocument = ({ document: rawDoc }) => {
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

  // Unwrap data
  const records = useMemo(() => {
    if (!rawDoc) return [];
    if (Array.isArray(rawDoc)) {
      if (rawDoc.length > 0 && rawDoc[0]?.asthma_management_notes) {
        return Array.isArray(rawDoc[0].asthma_management_notes) ? rawDoc[0].asthma_management_notes : [rawDoc[0].asthma_management_notes];
      }
      return rawDoc;
    }
    if (rawDoc.asthma_management_notes) return Array.isArray(rawDoc.asthma_management_notes) ? rawDoc.asthma_management_notes : [rawDoc.asthma_management_notes];
    if (rawDoc.documentData) {
      const dd = rawDoc.documentData;
      if (Array.isArray(dd)) return dd;
      if (dd.asthma_management_notes) return Array.isArray(dd.asthma_management_notes) ? dd.asthma_management_notes : [dd.asthma_management_notes];
      return [dd];
    }
    return [rawDoc];
  }, [rawDoc]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    records.forEach((record, idx) => {
      const id = record && record._id;
      const recordId = !id ? null : (typeof id === 'string' ? id : (id.$oid || String(id)));
      const recDrafts = recordId ? store[recordId] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        nFields[editKey] = 'edited';
        nSentences[`${fieldPart}-${idx}-s0`] = 'edited';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
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

  // ===== Edit Helpers =====
  const getFieldValue = useCallback((record, fieldName, idx) => {
    const key = `${fieldName}-${idx}`;
    if (localEdits[key] !== undefined) return localEdits[key];
    return record[fieldName];
  }, [localEdits]);

  const getEffectiveArray = useCallback((record, fieldName, idx) => {
    const original = Array.isArray(record[fieldName]) ? [...record[fieldName]] : [];
    return original.map((item, itemIdx) => {
      const editKey = `${fieldName}-${idx}-${itemIdx}`;
      return localEdits[editKey] !== undefined ? localEdits[editKey] : item;
    });
  }, [localEdits]);

  const getRecordId = (record) => {
    const id = record._id;
    if (!id) return null;
    if (typeof id === 'string') return id;
    if (id.$oid) return id.$oid;
    return String(id);
  };

  // ===== Save Handlers =====
  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fieldName, idx, sectionId, sentenceIdx, valueOverride, editTrackingKey) => {
    const recordId = getRecordId(record);
    if (!recordId) { console.error('[AsthmaManagementNotes] Cannot save — no record ID'); return; }

    const newValue = valueOverride !== undefined ? valueOverride : editValue;
    const editKey = editTrackingKey || `${fieldName}-${idx}`;
    // fieldPart = editKey minus the trailing "-<idx>" suffix (reversed on Approve)
    const fieldPart = editKey.endsWith(`-${idx}`) ? editKey.slice(0, -`-${idx}`.length) : fieldName;

    setLocalEdits(prev => ({ ...prev, [editKey]: newValue }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));

    if (sentenceIdx !== undefined && sentenceIdx !== null) {
      const sKey = editTrackingKey || `${fieldName}-${idx}-s${sentenceIdx}`;
      setEditedSentences(prev => ({ ...prev, [sKey]: 'edited' }));
    } else {
      setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    }
    // Re-edit after approval → drop this section's 'approved' flag so the button returns to yellow Pending Approve
    setApprovedSections(prev => {
      if (!prev[`${sectionId}-${idx}`]) return prev;
      const next = { ...prev };
      delete next[`${sectionId}-${idx}`];
      return next;
    });

    const store = readDrafts();
    if (!store[recordId]) store[recordId] = {};
    store[recordId][fieldPart] = newValue;
    writeDrafts(store);

    setEditingField(null);
    setEditValue('');
  }, [editValue]);

  // Save (array element) = stage a DRAFT locally + localStorage. NOT a DB write; Approve commits.
  const handleSaveArrayItem = useCallback((record, fieldName, idx, itemIdx) => {
    const recordId = getRecordId(record);
    if (!recordId) { console.error('[AsthmaManagementNotes] Cannot save — no record ID'); return; }

    const value = editValue;
    const editKey = `${fieldName}-${idx}-${itemIdx}`;
    // fieldPart for an array element: "field-itemIdx" (trailing numeric segment = arrayIndex on Approve)
    const fieldPart = `${fieldName}-${itemIdx}`;
    const sectionId = fieldName; // array sections use the field name as the sectionId

    setLocalEdits(prev => ({ ...prev, [editKey]: value }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    setApprovedSections(prev => {
      if (!prev[`${sectionId}-${idx}`]) return prev;
      const next = { ...prev };
      delete next[`${sectionId}-${idx}`];
      return next;
    });

    const store = readDrafts();
    if (!store[recordId]) store[recordId] = {};
    store[recordId][fieldPart] = value;
    writeDrafts(store);

    setEditingField(null);
    setEditValue('');
  }, [editValue]);

  // Approve = COMMIT all staged drafts for this section to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, idx, sectionId) => {
    setSaving(true);
    try {
      const recordId = getRecordId(record);
      if (!recordId) return;

      const sectionFields = SECTION_FIELDS[sectionId] || [];
      const secureApiClient = (await import('../../../services/secureApiClient')).default;

      // Collect this record's pending edits belonging to this section's fields.
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k]) return false;
        if (!k.endsWith(`-${idx}`)) return false; // not this record
        const fieldPart = k.slice(0, -`-${idx}`.length); // "field" or "field-itemIdx"
        const baseField = fieldPart.includes('-') ? fieldPart.slice(0, fieldPart.lastIndexOf('-')) : fieldPart;
        // baseField is "field-itemIdx" stripped of its trailing index, OR just "field"
        const lastSeg = fieldPart.slice(fieldPart.lastIndexOf('-') + 1);
        const fieldName = /^\d+$/.test(lastSeg) ? baseField : fieldPart;
        return sectionFields.includes(fieldName);
      });

      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -`-${idx}`.length); // "field" or "field-itemIdx"
        const lastSeg = fieldPart.slice(fieldPart.lastIndexOf('-') + 1);
        const isArrayElem = fieldPart.includes('-') && /^\d+$/.test(lastSeg);
        const fieldName = isArrayElem ? fieldPart.slice(0, fieldPart.lastIndexOf('-')) : fieldPart;
        const payload = { field: fieldName, value: localEdits[editKey] };
        if (isArrayElem) payload.arrayIndex = parseInt(lastSeg, 10);
        const resp = await secureApiClient.put(`/api/edit/asthma_management_notes/${recordId}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }

      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/asthma_management_notes/${recordId}/approve`, {
        sectionId, approved: true,
      });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => {
        const next = { ...prev };
        toCommit.forEach(k => delete next[k]);
        return next;
      });
      // Drop this record's committed drafts from localStorage
      const store = readDrafts();
      if (store[recordId]) {
        const recDrafts = store[recordId];
        toCommit.forEach(editKey => {
          const fieldPart = editKey.slice(0, -`-${idx}`.length);
          delete recDrafts[fieldPart];
        });
        if (Object.keys(recDrafts).length === 0) delete store[recordId];
        writeDrafts(store);
      }

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
      console.error('[AsthmaManagementNotes] Approve failed:', err);
    } finally {
      setSaving(false);
    }
  }, [localEdits, pendingEdits]);

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

    // If user cleared the sentence (empty or punctuation-only), remove it
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
    return phraseMatch(label, searchTerm) || phraseMatch(value, searchTerm);
  };

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    return records.filter((record, idx) => {
      const title = `Asthma Management Note ${idx + 1}`;
      const allText = [
        title, formatDate(record.date),
        record.provider, record.facility, record.asthmaType,
        record.severity, record.controlLevel, record.peakFlow,
        record.spirometry, record.medicationChanges, record.actionPlan,
        record.education, record.followUp, record.notes,
        ...(record.symptoms || []), ...(record.triggers || []),
        ...(record.medications || []),
        'Session Information', 'Asthma Classification', 'Current Symptoms',
        'Triggers', 'Pulmonary Function', 'Medications', 'Treatment Plan', 'Notes',
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

  // ===== Render Editable Field (simple) =====
  const renderEditableField = (record, fieldName, idx, sectionId) => {
    const value = getFieldValue(record, fieldName, idx);
    if (!value && !localEdits[`${fieldName}-${idx}`]) return null;
    const displayValue = String(value || '');
    const editKey = `${fieldName}-${idx}`;
    const isEditing = editingField === editKey;
    const isEdited = editedFields[editKey];

    // If the value embeds a "Label: value", surface that label as the nested-subtitle and show the value
    // in the mini-card row; otherwise the field label is the subtitle. Editing acts on the FULL value.
    const p = parseLabel(displayValue);
    const subtitle = p ? p.label : (FIELD_LABELS[fieldName] || fieldName);
    const rowText = p ? p.value : displayValue;

    if (isEditing) {
      return (
        <div className="rec-mini-card">
          <div className="nested-subtitle">{highlightText(subtitle)}</div>
          <div className="edit-field-container">
            <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveField(record, fieldName, idx, sectionId); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}
              autoFocus rows={2} disabled={saving} />
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
        <div className="nested-subtitle">{highlightText(subtitle)}</div>
        <div className={`numbered-row editable-row${isEdited ? ' modified' : ''}`} onClick={() => { setEditingField(editKey); setEditValue(displayValue); }}>
          <div className="row-content">
            <span className="content-value">{highlightText(rowText)}</span>
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

          // Per-sentence label:value → surface the label as a nested-subtitle above the value mini-card.
          const p = parseLabel(text);
          return (
            <div key={sIdx} className="rec-mini-card">
              {p && <div className="nested-subtitle">{highlightText(p.label)}</div>}
              <div className={`numbered-row editable-row${editStatus ? ' modified' : ''}`} onClick={() => { setEditingField(sentenceKey); setEditValue(text.replace(/[.!?;]+$/, '')); }}>
                <div className="row-content">
                  <span className="content-value">{highlightText(p ? p.value : text)}</span>
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

  // ===== Render Editable Array Item =====
  const renderEditableArrayItem = (record, fieldName, idx, sectionId, item, itemIdx) => {
    const editKey = `${fieldName}-${idx}-${itemIdx}`;
    const displayValue = localEdits[editKey] !== undefined ? localEdits[editKey] : item;
    const isEditing = editingField === editKey;
    const isEdited = editedFields[editKey];

    if (searchTerm.trim() && !record._showAllSections && !sectionTitleMatches(FIELD_LABELS[fieldName] || fieldName) && !phraseMatch(displayValue, searchTerm)) return null;

    if (isEditing) {
      return (
        <div key={itemIdx} className="edit-field-container">
          <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveArrayItem(record, fieldName, idx, itemIdx); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}
            autoFocus rows={2} disabled={saving} />
          <div className="edit-actions">
            <button className="save-btn" onClick={() => handleSaveArrayItem(record, fieldName, idx, itemIdx)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            <button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button>
          </div>
        </div>
      );
    }

    return (
      <React.Fragment key={itemIdx}>
        <div className={`numbered-row editable-row${isEdited ? ' modified' : ''}`} onClick={() => { setEditingField(editKey); setEditValue(String(displayValue)); }}>
          <div className="row-content">
            <span className="content-value">{highlightText(String(displayValue))}</span>
            {!isEdited && <span className="edit-indicator">✎</span>}
          </div>
        </div>
        {isEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </React.Fragment>
    );
  };

  // ===== pdfData Memo =====
  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return records;
    return records.map((record, idx) => {
      const merged = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF until approved
        const lastDash = key.lastIndexOf('-');
        if (lastDash === -1) return;
        const fieldName = key.substring(0, lastDash);
        const recordIdx = parseInt(key.substring(lastDash + 1), 10);
        if (recordIdx === idx && !ARRAY_FIELDS.includes(fieldName) && fieldName in record) {
          merged[fieldName] = localEdits[key];
        }
      });
      // Array fields: apply committed (non-pending) element edits only
      ARRAY_FIELDS.forEach(field => {
        const original = Array.isArray(record[field]) ? [...record[field]] : [];
        merged[field] = original.map((item, itemIdx) => {
          const editKey = `${field}-${idx}-${itemIdx}`;
          if (localEdits[editKey] !== undefined && !pendingEdits[editKey]) return localEdits[editKey];
          return item;
        });
      });
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
    const fields = SECTION_FIELDS[sectionId] || [];
    let text = '';
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      if (ARRAY_FIELDS.includes(f)) {
        // Use pdfRecord (committed-only) so pending drafts stay OUT of Copy Section, matching the PDF.
        const arr = Array.isArray(pdfRecord[f]) ? pdfRecord[f] : [];
        if (arr.length > 0) { text += `${label}:\n`; arr.forEach((item, i) => { text += `  ${i + 1}. ${item}\n`; }); }
      } else {
        const val = pdfRecord[f];
        if (val) {
          const sentences = splitBySentence(String(val));
          if (sentences.length > 1) {
            text += `${label}:\n`;
            const items = sentences.map(s => ({ s, p: parseLabel(s) }));
            if (items.some(it => it.p)) {
              // a field with embedded label:value sentences → label on its own line, value indented (mirrors the JSX)
              items.forEach(({ s, p }) => { text += p ? `  ${p.label}:\n    ${p.value}\n` : `  ${s}\n`; });
            } else {
              sentences.forEach((s, i) => { text += `  ${i + 1}. ${s}\n`; });
            }
          } else {
            const p = parseLabel(String(val));
            text += p ? `${p.label}:\n  ${p.value}\n` : `${label}: ${val}\n`;
          }
        }
      }
    });
    copyToClipboard(text.trim(), `section-${sectionId}-${idx}`);
  };

  const copyAllContent = () => {
    let text = '=== ASTHMA MANAGEMENT NOTES ===\n\n';
    pdfData.forEach((record, idx) => {
      if (idx > 0) text += '\n' + '='.repeat(60) + '\n\n';
      text += `Asthma Management Note ${idx + 1}\n`;
      if (record.date) text += `Date: ${formatDate(record.date)}\n`;
      text += '\n';
      Object.entries(SECTION_FIELDS).forEach(([, fields]) => {
        fields.forEach(f => {
          const label = FIELD_LABELS[f] || f;
          if (ARRAY_FIELDS.includes(f)) {
            const arr = Array.isArray(record[f]) ? record[f] : [];
            if (arr.length > 0) { text += `${label}:\n`; arr.forEach((item, i) => { text += `  ${i + 1}. ${item}\n`; }); }
          } else {
            const val = record[f];
            if (val) {
              const sentences = splitBySentence(String(val));
              if (sentences.length > 1) {
                text += `${label}:\n`;
                const items = sentences.map(s => ({ s, p: parseLabel(s) }));
                if (items.some(it => it.p)) {
                  items.forEach(({ s, p }) => { text += p ? `  ${p.label}:\n    ${p.value}\n` : `  ${s}\n`; });
                } else {
                  sentences.forEach((s, i) => { text += `  ${i + 1}. ${s}\n`; });
                }
              } else {
                const p = parseLabel(String(val));
                text += p ? `${p.label}:\n  ${p.value}\n` : `${label}: ${val}\n`;
              }
            }
          }
        });
      });
    });
    copyToClipboard(text.trim(), 'copy-all');
  };

  // ===== Helper: Render a section with header + approve =====
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
      <article className="asthma-management-notes-document">
        <header className="document-header">
          <h1 className="document-title">Asthma Management Notes</h1>
        </header>
        <SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />
        <div className="empty-state">No asthma management notes available.</div>
      </article>
    );
  }

  return (
    <article className="asthma-management-notes-document">
      <header className="document-header">
        <h1 className="document-title">Asthma Management Notes</h1>
        <div className="header-actions">
          <button className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`} onClick={copyAllContent}>
            {copiedId === 'copy-all' ? 'Copied' : 'Copy All'}
          </button>
          <PDFDownloadLink document={<AsthmaManagementNotesDocumentPDFTemplate document={pdfData} />} fileName="Asthma_Management_Notes.pdf">
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
                <h3 className="record-name">{highlightText(`Asthma Management Note ${idx + 1}`)}</h3>
              </div>
            </div>

            {/* Session Information */}
            {(() => {
              if (!shouldShowSection(record, 'Session Information', [record.provider, record.facility].filter(Boolean))) return null;
              const stm = sectionTitleMatches('Session Information');
              const showAll = !searchTerm.trim() || record._showAllSections || stm;
              return renderSection(record, idx, 'sessionInfo', 'Session Information', <>
                {(showAll || fieldMatches(record, 'provider', idx)) && renderEditableField(record, 'provider', idx, 'sessionInfo')}
                {(showAll || fieldMatches(record, 'facility', idx)) && renderEditableField(record, 'facility', idx, 'sessionInfo')}
              </>);
            })()}

            {/* Asthma Classification */}
            {(() => {
              if (!shouldShowSection(record, 'Asthma Classification', [record.asthmaType, record.severity, record.controlLevel].filter(Boolean))) return null;
              const stm = sectionTitleMatches('Asthma Classification');
              const showAll = !searchTerm.trim() || record._showAllSections || stm;
              return renderSection(record, idx, 'classification', 'Asthma Classification', <>
                {(showAll || fieldMatches(record, 'asthmaType', idx)) && renderEditableField(record, 'asthmaType', idx, 'classification')}
                {(showAll || fieldMatches(record, 'severity', idx)) && renderEditableField(record, 'severity', idx, 'classification')}
                {(showAll || fieldMatches(record, 'controlLevel', idx)) && renderEditableField(record, 'controlLevel', idx, 'classification')}
              </>);
            })()}

            {/* Current Symptoms */}
            {(() => {
              const arr = getEffectiveArray(record, 'symptoms', idx);
              if (!arr || arr.length === 0) return null;
              if (!shouldShowSection(record, 'Current Symptoms', arr)) return null;
              return renderSection(record, idx, 'symptoms', 'Current Symptoms',
                arr.map((item, itemIdx) => renderEditableArrayItem(record, 'symptoms', idx, 'symptoms', item, itemIdx))
              );
            })()}

            {/* Triggers */}
            {(() => {
              const arr = getEffectiveArray(record, 'triggers', idx);
              if (!arr || arr.length === 0) return null;
              if (!shouldShowSection(record, 'Triggers', arr)) return null;
              return renderSection(record, idx, 'triggers', 'Triggers',
                arr.map((item, itemIdx) => renderEditableArrayItem(record, 'triggers', idx, 'triggers', item, itemIdx))
              );
            })()}

            {/* Pulmonary Function */}
            {(() => {
              if (!shouldShowSection(record, 'Pulmonary Function', [getFieldValue(record, 'peakFlow', idx), getFieldValue(record, 'spirometry', idx)].filter(Boolean))) return null;
              const stm = sectionTitleMatches('Pulmonary Function');
              const showAll = !searchTerm.trim() || record._showAllSections || stm;
              return renderSection(record, idx, 'pulmonaryFunction', 'Pulmonary Function', <>
                {(showAll || fieldMatches(record, 'peakFlow', idx)) && renderEditableField(record, 'peakFlow', idx, 'pulmonaryFunction')}
                {(showAll || fieldMatches(record, 'spirometry', idx)) && renderSentenceEditableField(record, 'spirometry', idx, 'pulmonaryFunction')}
              </>);
            })()}

            {/* Medications */}
            {(() => {
              const arr = getEffectiveArray(record, 'medications', idx);
              if (!arr || arr.length === 0) return null;
              if (!shouldShowSection(record, 'Medications', arr)) return null;
              return renderSection(record, idx, 'medications', 'Medications',
                arr.map((item, itemIdx) => renderEditableArrayItem(record, 'medications', idx, 'medications', item, itemIdx))
              );
            })()}

            {/* Treatment Plan */}
            {(() => {
              if (!shouldShowSection(record, 'Treatment Plan', [record.medicationChanges, record.actionPlan, record.education, record.followUp].filter(Boolean))) return null;
              const stm = sectionTitleMatches('Treatment Plan');
              const showAll = !searchTerm.trim() || record._showAllSections || stm;
              return renderSection(record, idx, 'treatmentPlan', 'Treatment Plan', <>
                {(showAll || fieldMatches(record, 'medicationChanges', idx)) && renderSentenceEditableField(record, 'medicationChanges', idx, 'treatmentPlan')}
                {(showAll || fieldMatches(record, 'actionPlan', idx)) && renderSentenceEditableField(record, 'actionPlan', idx, 'treatmentPlan')}
                {(showAll || fieldMatches(record, 'education', idx)) && renderSentenceEditableField(record, 'education', idx, 'treatmentPlan')}
                {(showAll || fieldMatches(record, 'followUp', idx)) && renderSentenceEditableField(record, 'followUp', idx, 'treatmentPlan')}
              </>);
            })()}

            {/* Notes */}
            {getFieldValue(record, 'notes', idx) && shouldShowSection(record, 'Notes', [getFieldValue(record, 'notes', idx)]) &&
              renderSection(record, idx, 'notes', 'Notes',
                renderSentenceEditableField(record, 'notes', idx, 'notes')
              )
            }
          </div>
        ))}
      </div>
    </article>
  );
};

export default AsthmaManagementNotesDocument;
