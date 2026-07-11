/**
 * MentalStatusExamsDocument.jsx
 * February 2026 — Inline Editing Enabled
 *
 * Sections:
 *   1. Consciousness & Orientation (levelOfConsciousness, orientation, attentionConcentration)
 *   2. Cognitive Function (memoryImpairment, executiveFunction, abstractThinking, cognitiveScreeningTool)
 *   3. Speech & Thought (speechLanguage, thoughtProcess, thoughtContent, perceptualDisturbances)
 *   4. Mood & Affect (mood, affect)
 *   5. Behavior & Judgment (psychomotorActivity, impulseControl, insight, judgment)
 *   6. Unified schema fallback sections (findings, assessment, plan, recommendations, results, notes)
 *
 * 4-level search, mini-card blue theme, per-section approve, inline editing
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import secureApiClient from '../../../services/secureApiClient';
import MentalStatusExamsDocumentPDFTemplate from '../pdf-templates/MentalStatusExamsDocumentPDFTemplate';
import './MentalStatusExamsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'mentalStatusExamsPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

const MentalStatusExamsDocument = ({ document, data }) => {
  const templateData = document || data;
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  // ============== EDITING STATE ==============
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  const [editedFields, setEditedFields] = useState({});
  const [editedSentences, setEditedSentences] = useState({});
  const [statusOverrides, setStatusOverrides] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const textareaRef = useRef(null);

  // ============== DATA UNWRAPPING ==============
  const unwrappedData = useMemo(() => {
    if (!templateData) return [];
    const raw = templateData?.documentData || templateData?.data || templateData;
    if (Array.isArray(raw)) return raw.filter(r => r && typeof r === 'object');
    if (raw?.records && Array.isArray(raw.records)) return raw.records;
    if (raw?.mental_status_exams && Array.isArray(raw.mental_status_exams)) {
      return raw.mental_status_exams.length === 1 && raw.mental_status_exams[0]?.mental_status_exams
        ? raw.mental_status_exams[0].mental_status_exams
        : raw.mental_status_exams;
    }
    // Single record wrapped
    if (raw?.mental_status_exams?.[0]) return [raw.mental_status_exams[0]];
    // Single record at top level with mental status fields
    if (raw?.levelOfConsciousness || raw?.orientation || raw?.mood || raw?.affect ||
        raw?.findings || raw?.assessment || raw?._id) {
      return [raw];
    }
    return [];
  }, [templateData]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {}, nStatus = {};
    unwrappedData.forEach((record, idx) => {
      const recId = record && record._id
        ? (typeof record._id === 'object' && record._id.$oid ? record._id.$oid : record._id)
        : null;
      const recDrafts = recId ? store[recId] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        // section id is not derivable from fieldPart alone; mark the section that owns this base field
        const baseField = fieldPart.includes('.') ? fieldPart.split('.')[0] : fieldPart;
        const owningSection = Object.keys(SECTION_FIELDS).find(sid => SECTION_FIELDS[sid].includes(baseField));
        if (owningSection) nFields[`${owningSection}-${idx}`] = true;
        nSentences[`${fieldPart}-${idx}-s0`] = 'edited';
        nStatus[idx] = 'amended';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
    setStatusOverrides(prev => ({ ...nStatus, ...prev }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unwrappedData]);

  // ============== UTILITY FUNCTIONS ==============
  const formatDate = useCallback((dateVal) => {
    if (!dateVal) return 'N/A';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return String(dateVal);
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return String(dateVal);
    }
  }, []);

  const formatFieldLabel = useCallback((key) => {
    return key
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }, []);

  // ============== COPY FUNCTIONS ==============
  const copyToClipboard = useCallback((text, id) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }, []);

  // ============== HIGHLIGHT FUNCTION ==============
  const highlightText = useCallback((text) => {
    if (!searchTerm.trim() || !text) return text;
    const phrase = searchTerm.trim();
    const escapedPhrase = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedPhrase})`, 'gi');
    const parts = String(text).split(regex);
    const phraseLower = phrase.toLowerCase();
    return parts.map((part, i) =>
      part.toLowerCase() === phraseLower ? <mark key={i}>{part}</mark> : part
    );
  }, [searchTerm]);

  // ============== EDITING HELPERS ==============
  const getFieldValue = useCallback((record, fieldName, idx) => {
    const editKey = `${fieldName}-${idx}`;
    if (localEdits[editKey] !== undefined) return localEdits[editKey];
    return record[fieldName];
  }, [localEdits]);

  // ============== EDITING HANDLERS ==============
  const handleStartEdit = useCallback((fieldName, idx, currentValue, sentenceIdx = 0) => {
    const editKey = `${fieldName}-${idx}-s${sentenceIdx}`;
    setEditingField(editKey);
    setEditValue(currentValue || '');
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingField(null);
    setEditValue('');
  }, []);

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApprove commits).
  const handleSaveField = useCallback((record, fieldName, idx, sectionId, arrayIndex, valueOverride, sentenceIdx) => {
    const recordId = record && record._id
      ? (typeof record._id === 'object' && record._id.$oid ? record._id.$oid : record._id)
      : null;
    if (!recordId) return;
    const saveValue = (valueOverride !== undefined ? valueOverride : editValue.trim());
    const fieldPart = typeof arrayIndex === 'number' ? `${fieldName}.${arrayIndex}` : fieldName;
    const editKey = `${fieldPart}-${idx}`;
    const sKey = `${fieldPart}-${idx}-s${sentenceIdx !== undefined ? sentenceIdx : 0}`;

    setLocalEdits(prev => ({ ...prev, [editKey]: saveValue }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [`${sectionId}-${idx}`]: true }));
    setEditedSentences(prev => ({ ...prev, [sKey]: 'edited' }));
    setStatusOverrides(prev => ({ ...prev, [idx]: 'amended' }));
    // Re-edit after approval → drop the section 'approved' flag so the button goes back to yellow Pending Approve
    setApprovedSections(prev => {
      if (!prev[sectionId]) return prev;
      const next = { ...prev };
      delete next[sectionId];
      return next;
    });

    const store = readDrafts();
    if (!store[recordId]) store[recordId] = {};
    store[recordId][fieldPart] = saveValue;
    writeDrafts(store);

    setEditingField(null);
    setEditValue('');
  }, [editValue]);

  // Approve = COMMIT all staged drafts for this record to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApprove = useCallback(async (record, idx, sectionId) => {
    const recordId = record && record._id
      ? (typeof record._id === 'object' && record._id.$oid ? record._id.$oid : record._id)
      : null;
    if (!recordId) return;
    setApproving(true);
    try {
      const suffix = `-${idx}`;
      const toCommit = Object.keys(localEdits).filter(k => pendingEdits[k] && k.endsWith(suffix));
      // Persist each staged field to the DB now (field, or field+arrayIndex for array elements)
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // "field" or "field.arrayIndex"
        const dotIdx = fieldPart.lastIndexOf('.');
        const trailing = dotIdx === -1 ? '' : fieldPart.slice(dotIdx + 1);
        const isArrayIndex = dotIdx !== -1 && /^\d+$/.test(trailing);
        const payload = { field: isArrayIndex ? fieldPart.slice(0, dotIdx) : fieldPart, value: localEdits[editKey] };
        if (isArrayIndex) payload.arrayIndex = parseInt(trailing, 10);
        const response = await secureApiClient.put(`/api/edit/mental_status_exams/${recordId}/edit`, payload);
        if (!response || !response.success) throw new Error((response && response.error) || 'save failed');
      }
      // Flag the record approved (audit trail)
      await secureApiClient.put(`/api/edit/mental_status_exams/${recordId}/approve`);

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => {
        const next = { ...prev };
        toCommit.forEach(k => delete next[k]);
        return next;
      });
      // Drop this record's drafts from localStorage (now committed)
      const store = readDrafts();
      if (store[recordId]) { delete store[recordId]; writeDrafts(store); }

      setStatusOverrides(prev => ({ ...prev, [idx]: 'approved' }));
      setApprovedSections(prev => ({ ...prev, [sectionId]: true }));
      setEditedSentences(prev => {
        const updated = {};
        for (const key of Object.keys(prev)) {
          if (!key.includes(`-${idx}-`)) updated[key] = prev[key];
        }
        return updated;
      });
      setEditedFields(prev => {
        const updated = {};
        for (const key of Object.keys(prev)) {
          if (!key.endsWith(`-${idx}`)) updated[key] = prev[key];
        }
        return updated;
      });
    } catch (err) {
      console.error('[MentalStatusExams] Approve error:', err);
    } finally {
      setApproving(false);
    }
  }, [localEdits, pendingEdits]);

  // ============== SECTION_FIELDS + sectionHasEdits ==============
  const SECTION_FIELDS = {
    'consciousness': ['levelOfConsciousness', 'orientation', 'attentionConcentration'],
    'cognitive': ['memoryImpairment', 'executiveFunction', 'abstractThinking', 'cognitiveScreeningTool'],
    'speech-thought': ['speechLanguage', 'thoughtProcess', 'thoughtContent', 'perceptualDisturbances'],
    'mood-affect': ['mood', 'affect'],
    'behavior-judgment': ['psychomotorActivity', 'impulseControl', 'insight', 'judgment'],
  };

  const sectionHasEdits = (sectionId) => {
    const fields = SECTION_FIELDS[sectionId];
    if (!fields) return false;
    return Object.keys(localEdits).some(editKey => {
      const dashIdx = editKey.lastIndexOf('-');
      const fieldPart = editKey.substring(0, dashIdx);
      return fields.includes(fieldPart);
    });
  };

  // ============== EDIT INDICATOR ==============
  const editIndicator = (
    <span className="edit-indicator" title="Click to edit">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
        <path d="m15 5 4 4" />
      </svg>
      <span className="edit-tag">edit</span>
    </span>
  );

  // ============== RENDER EDITABLE FIELD ==============
  const renderEditableField = (record, idx, fieldName, label, sectionId, copyId) => {
    const displayValue = getFieldValue(record, fieldName, idx);
    if (!displayValue) return null;
    const canEdit = !!record._id;
    const sectionKey = `${sectionId}-${idx}`;
    const sectionWasEdited = editedFields[sectionKey];
    const editKey = `${fieldName}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const sentenceState = sectionWasEdited ? editedSentences[editKey] : undefined;
    const recordStatus = statusOverrides[idx] || 'active';
    const isFieldEdited = sentenceState === 'edited' && recordStatus !== 'approved';
    const isPending = sentenceState && recordStatus !== 'approved';

    if (isEditing) {
      return (
        <div className="rec-mini-card" key={fieldName}>
          <div className="nested-subtitle">{highlightText(label)}</div>
          <div className="numbered-row edit-row">
            <div className="edit-field-container">
              <textarea
                ref={textareaRef}
                className="edit-textarea"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') handleCancelEdit();
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSaveField(record, fieldName, idx, sectionId);
                }}
                rows={Math.max(2, editValue.split('\n').length)}
                disabled={saving}
              />
              <div className="edit-actions">
                <button
                  className="edit-save-btn"
                  onClick={() => handleSaveField(record, fieldName, idx, sectionId)}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button className="edit-cancel-btn" onClick={handleCancelEdit} disabled={saving}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="rec-mini-card" key={fieldName}>
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isFieldEdited ? 'modified' : ''}`}>
          <div
            className={`row-content ${canEdit ? 'editable' : ''}`}
            onClick={() => canEdit && handleStartEdit(fieldName, idx, displayValue)}
            title={canEdit ? 'Click to edit' : undefined}
          >
            <span className="content-value">{highlightText(displayValue)}</span>
            {canEdit && !isPending && editIndicator}
          </div>
          <button
            className={`copy-btn ${copiedId === copyId ? 'copied' : ''}`}
            onClick={() => copyToClipboard(displayValue, copyId)}
          >
            {copiedId === copyId ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {isFieldEdited && (
          <div className="modified-badge">edited — click approve to save</div>
        )}
      </div>
    );
  };

  // ============== READ-ONLY FIELD (for non-editable fields like dates, generic fields) ==============
  const renderReadOnlyField = (label, value, copyId) => {
    if (!value) return null;
    const displayValue = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
    return (
      <div className="rec-mini-card" key={label}>
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className="numbered-row">
          <div className="row-content">
            <span className="content-value">{highlightText(displayValue)}</span>
          </div>
          <button
            className={`copy-btn ${copiedId === copyId ? 'copied' : ''}`}
            onClick={() => copyToClipboard(displayValue, copyId)}
          >
            {copiedId === copyId ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>
    );
  };

  // ============== SECTION HEADER WITH APPROVE ==============
  const renderSectionHeader = (title, copyId, copyFn, idx, sectionId) => (
    <div className="section-header">
      <h3 className="section-title">{highlightText(title)}</h3>
      <div className="header-right-actions">
        <button
          className={`copy-btn ${copiedId === copyId ? 'copied' : ''}`}
          onClick={copyFn}
        >
          {copiedId === copyId ? 'Copied!' : 'Copy Section'}
        </button>
        {(sectionHasEdits(sectionId) || approvedSections[sectionId]) && (
          <button
            className={`approve-btn${approvedSections[sectionId] ? ' approved' : ''}`}
            onClick={() => handleApprove(unwrappedData[idx], idx, sectionId)}
            disabled={approving}
          >
            {approving ? 'Approving...' : approvedSections[sectionId] ? 'Approved' : 'Approve'}
          </button>
        )}
      </div>
    </div>
  );

  // ============== 4-LEVEL SEARCH ==============
  const shouldShowRow = useCallback((...valuesToCheck) => {
    if (!searchTerm.trim()) return true;
    const phrase = searchTerm.toLowerCase().trim();
    for (const val of valuesToCheck) {
      if (val && String(val).toLowerCase().includes(phrase)) return true;
    }
    return false;
  }, [searchTerm]);

  const sectionTitleMatches = useCallback((sectionTitle) => {
    if (!searchTerm.trim()) return true;
    const phrase = searchTerm.toLowerCase().trim();
    return sectionTitle.toLowerCase().includes(phrase);
  }, [searchTerm]);

  const shouldShowSection = useCallback((sectionTitle, ...rowValues) => {
    if (!searchTerm.trim()) return true;
    if (sectionTitleMatches(sectionTitle)) return true;
    const phrase = searchTerm.toLowerCase().trim();
    for (const val of rowValues) {
      if (val && String(val).toLowerCase().includes(phrase)) return true;
    }
    return false;
  }, [searchTerm, sectionTitleMatches]);

  // Level 1: Document-level filtering
  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) {
      return unwrappedData.map(r => ({ ...r, _showAllSections: false }));
    }
    const phrase = searchTerm.toLowerCase().trim();

    return unwrappedData.map((record, idx) => {
      const searchableText = [
        `Mental Status Exam ${idx + 1}`,
        'mental status examination', 'mental status exam',
        'Consciousness & Orientation', 'consciousness', 'orientation',
        'Level of Consciousness', 'Attention Concentration',
        'Cognitive Function', 'cognitive', 'Memory Impairment',
        'Executive Function', 'Abstract Thinking', 'Cognitive Screening Tool',
        'Speech & Thought', 'Speech Language', 'Thought Process',
        'Thought Content', 'Perceptual Disturbances',
        'Mood & Affect', 'mood', 'affect',
        'Behavior & Judgment', 'Psychomotor Activity', 'Impulse Control',
        'Insight', 'Judgment',
        'Findings', 'Assessment', 'Plan', 'Recommendations', 'Results', 'Notes',
        record.levelOfConsciousness, record.orientation, record.attentionConcentration,
        record.memoryImpairment, record.executiveFunction, record.abstractThinking,
        record.cognitiveScreeningTool, record.speechLanguage, record.thoughtProcess,
        record.thoughtContent, record.perceptualDisturbances, record.mood, record.affect,
        record.psychomotorActivity, record.impulseControl, record.insight, record.judgment,
        record.findings, record.assessment, record.plan, record.notes,
        record.provider, record.facility, record.type, record.status,
        ...(Array.isArray(record.recommendations) ? record.recommendations.map(r =>
          typeof r === 'object' ? r.recommendation : String(r)
        ) : []),
        typeof record.results === 'object' ? JSON.stringify(record.results) : record.results,
      ].filter(Boolean).join(' ').toLowerCase();

      const matches = searchableText.includes(phrase);
      const documentTitle = `mental status exam ${idx + 1}`;
      const documentTitleMatches = documentTitle.includes(phrase) ||
        phrase.includes('mental status');

      return matches ? { ...record, _showAllSections: documentTitleMatches } : null;
    }).filter(Boolean);
  }, [unwrappedData, searchTerm]);

  // ============== pdfData MEMO ==============
  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return filteredRecords;
    return filteredRecords.map((rec, idx) => {
      const merged = { ...rec };
      for (const [editKey, editVal] of Object.entries(localEdits)) {
        if (pendingEdits[editKey]) continue; // pending drafts stay OUT of the PDF until approved
        const dashIdx = editKey.lastIndexOf('-');
        const fieldPart = editKey.substring(0, dashIdx);
        const recIdx = parseInt(editKey.substring(dashIdx + 1), 10);
        if (recIdx === idx) {
          // Array-element edit (e.g. "recommendations.2") vs plain field
          const dotIdx = fieldPart.lastIndexOf('.');
          const trailing = dotIdx === -1 ? '' : fieldPart.slice(dotIdx + 1);
          if (dotIdx !== -1 && /^\d+$/.test(trailing)) {
            const arrField = fieldPart.slice(0, dotIdx);
            const arrIndex = parseInt(trailing, 10);
            merged[arrField] = Array.isArray(merged[arrField]) ? [...merged[arrField]] : [...(rec[arrField] || [])];
            merged[arrField][arrIndex] = editVal;
          } else {
            merged[fieldPart] = editVal;
          }
        }
      }
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  // ============== COPY TEXT GENERATORS ==============
  const EDITABLE_FIELD_LABELS = {
    levelOfConsciousness: 'Level of Consciousness',
    orientation: 'Orientation',
    attentionConcentration: 'Attention & Concentration',
    memoryImpairment: 'Memory Impairment',
    executiveFunction: 'Executive Function',
    abstractThinking: 'Abstract Thinking',
    cognitiveScreeningTool: 'Cognitive Screening Tool',
    speechLanguage: 'Speech & Language',
    thoughtProcess: 'Thought Process',
    thoughtContent: 'Thought Content',
    perceptualDisturbances: 'Perceptual Disturbances',
    mood: 'Mood',
    affect: 'Affect',
    psychomotorActivity: 'Psychomotor Activity',
    impulseControl: 'Impulse Control',
    insight: 'Insight',
    judgment: 'Judgment',
  };

  const getSectionText = (record, sectionTitle, fieldNames) => {
    const lines = [sectionTitle.toUpperCase(), '='.repeat(50)];
    fieldNames.forEach(fn => {
      if (record[fn]) lines.push(`${EDITABLE_FIELD_LABELS[fn] || formatFieldLabel(fn)}: ${record[fn]}`);
    });
    return lines.join('\n');
  };

  const getAllRecordText = useCallback((record, idx) => {
    const sections = [
      `MENTAL STATUS EXAMINATION ${idx + 1}`,
      '='.repeat(60),
      '',
    ];

    if (record.date) sections.push(`Date: ${formatDate(record.date)}`);
    if (record.type) sections.push(`Type: ${record.type}`);
    if (record.provider) sections.push(`Provider: ${record.provider}`);
    if (record.facility) sections.push(`Facility: ${record.facility}`);
    if (record.status) sections.push(`Status: ${record.status}`);
    sections.push('');

    // Editable fields by section
    const consciousnessFields = ['levelOfConsciousness', 'orientation', 'attentionConcentration'];
    const cognitiveFields = ['memoryImpairment', 'executiveFunction', 'abstractThinking', 'cognitiveScreeningTool'];
    const speechFields = ['speechLanguage', 'thoughtProcess', 'thoughtContent', 'perceptualDisturbances'];
    const moodFields = ['mood', 'affect'];
    const behaviorFields = ['psychomotorActivity', 'impulseControl', 'insight', 'judgment'];

    const addSection = (title, fields) => {
      const hasData = fields.some(f => record[f]);
      if (hasData) {
        sections.push(title.toUpperCase());
        sections.push('-'.repeat(40));
        fields.forEach(fn => {
          if (record[fn]) sections.push(`${EDITABLE_FIELD_LABELS[fn]}: ${record[fn]}`);
        });
        sections.push('');
      }
    };

    addSection('Consciousness & Orientation', consciousnessFields);
    addSection('Cognitive Function', cognitiveFields);
    addSection('Speech & Thought', speechFields);
    addSection('Mood & Affect', moodFields);
    addSection('Behavior & Judgment', behaviorFields);

    // Unified schema fallback fields
    if (record.findings) {
      sections.push('FINDINGS');
      sections.push('-'.repeat(40));
      sections.push(record.findings);
      sections.push('');
    }
    if (record.assessment) {
      sections.push('ASSESSMENT');
      sections.push('-'.repeat(40));
      sections.push(record.assessment);
      sections.push('');
    }
    if (record.plan) {
      sections.push('PLAN');
      sections.push('-'.repeat(40));
      sections.push(record.plan);
      sections.push('');
    }
    if (record.recommendations && Array.isArray(record.recommendations) && record.recommendations.length > 0) {
      sections.push('RECOMMENDATIONS');
      sections.push('-'.repeat(40));
      record.recommendations.forEach((rec, i) => {
        const recText = typeof rec === 'object' ? rec.recommendation : String(rec);
        sections.push(`${i + 1}. ${recText}`);
      });
      sections.push('');
    }
    if (record.results) {
      sections.push('RESULTS');
      sections.push('-'.repeat(40));
      sections.push(typeof record.results === 'object' ? JSON.stringify(record.results, null, 2) : String(record.results));
      sections.push('');
    }
    if (record.notes) {
      sections.push('NOTES');
      sections.push('-'.repeat(40));
      sections.push(record.notes);
      sections.push('');
    }

    return sections.join('\n');
  }, [formatDate]);

  // ============== RENDER ==============
  if (!unwrappedData.length) {
    return (
      <div className="mental-status-exams-document">
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <p className="empty-text">No mental status exam data available</p>
        </div>
      </div>
    );
  }

  const isSearching = searchTerm.trim().length > 0;

  return (
    <div className="mental-status-exams-document">
      {/* Document Header */}
      <div className="document-header">
        <h1 className="document-title">Mental Status Examination</h1>

        <div className="header-actions">
          <button
            className={`copy-btn ${copiedId === 'all-documents' ? 'copied' : ''}`}
            onClick={() => {
              const allText = pdfData.map((r, i) => getAllRecordText(r, i)).join('\n\n');
              copyToClipboard(allText, 'all-documents');
            }}
          >
            {copiedId === 'all-documents' ? 'Copied!' : 'Copy All'}
          </button>
          <PDFDownloadLink
            document={<MentalStatusExamsDocumentPDFTemplate data={pdfData[0] || unwrappedData[0]} />}
            fileName={`Mental_Status_Exam_${new Date().toISOString().split('T')[0]}.pdf`}
            className="pdf-btn"
          >
            {({ loading }) => (loading ? 'Preparing...' : 'Export PDF')}
          </PDFDownloadLink>
        </div>

        <div className="search-container">
          <input
            type="text"
            className="search-input"
            placeholder="Search mental status exam..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="clear-search" onClick={() => setSearchTerm('')}>x</button>
          )}
        </div>
      </div>

      {/* Results Count */}
      {isSearching && (
        <div className="search-results-count">
          Found {filteredRecords.length} of {unwrappedData.length} exam{unwrappedData.length !== 1 ? 's' : ''}
        </div>
      )}

      {/* No search results */}
      {isSearching && filteredRecords.length === 0 && (
        <div className="empty-state">
          <p className="empty-text">No results found for "{searchTerm}"</p>
        </div>
      )}

      {/* Records */}
      {filteredRecords.map((record, idx) => {
        const showAll = record._showAllSections;
        const recordId = record._id || `mse-${idx}`;

        // Check which specific MSE fields exist
        const hasConsciousness = record.levelOfConsciousness || record.orientation || record.attentionConcentration;
        const hasCognitive = record.memoryImpairment || record.executiveFunction || record.abstractThinking || record.cognitiveScreeningTool;
        const hasSpeechThought = record.speechLanguage || record.thoughtProcess || record.thoughtContent || record.perceptualDisturbances;
        const hasMoodAffect = record.mood || record.affect;
        const hasBehaviorJudgment = record.psychomotorActivity || record.impulseControl || record.insight || record.judgment;

        // Section visibility for editable sections
        const showConsciousness = hasConsciousness && (showAll || shouldShowSection('Consciousness & Orientation',
          record.levelOfConsciousness, record.orientation, record.attentionConcentration));
        const showCognitive = hasCognitive && (showAll || shouldShowSection('Cognitive Function',
          record.memoryImpairment, record.executiveFunction, record.abstractThinking, record.cognitiveScreeningTool));
        const showSpeechThought = hasSpeechThought && (showAll || shouldShowSection('Speech & Thought',
          record.speechLanguage, record.thoughtProcess, record.thoughtContent, record.perceptualDisturbances));
        const showMoodAffect = hasMoodAffect && (showAll || shouldShowSection('Mood & Affect',
          record.mood, record.affect));
        const showBehaviorJudgment = hasBehaviorJudgment && (showAll || shouldShowSection('Behavior & Judgment',
          record.psychomotorActivity, record.impulseControl, record.insight, record.judgment));

        // Section visibility for unified schema fallback sections (read-only)
        const showFindings = record.findings && (showAll || shouldShowSection('Findings', record.findings));
        const showAssessment = record.assessment && (showAll || shouldShowSection('Assessment', record.assessment));
        const showPlan = record.plan && (showAll || shouldShowSection('Plan', record.plan));
        const showRecommendations = record.recommendations && Array.isArray(record.recommendations) && record.recommendations.length > 0 &&
          (showAll || shouldShowSection('Recommendations', ...record.recommendations.map(r => typeof r === 'object' ? r.recommendation : String(r))));
        const showResults = record.results && (showAll || shouldShowSection('Results',
          typeof record.results === 'object' ? JSON.stringify(record.results) : String(record.results)));
        const showNotes = record.notes && (showAll || shouldShowSection('Notes', record.notes));

        // Section title match checks for showing all rows within a section
        const consciousnessTitleMatches = showAll || sectionTitleMatches('Consciousness & Orientation');
        const cognitiveTitleMatches = showAll || sectionTitleMatches('Cognitive Function');
        const speechTitleMatches = showAll || sectionTitleMatches('Speech & Thought');
        const moodTitleMatches = showAll || sectionTitleMatches('Mood & Affect');
        const behaviorTitleMatches = showAll || sectionTitleMatches('Behavior & Judgment');

        return (
          <div key={recordId} className="exam-record">
            {/* Record Header */}
            <div className="record-header">
              <h2 className="record-title">{highlightText(`Mental Status Exam ${idx + 1}`)}</h2>
              <div className="header-top-row">
                {record.date && <span className="date-badge">{formatDate(record.date)}</span>}
              </div>
            </div>

            {/* Metadata Section (read-only) */}
            {(record.type || record.provider || record.facility || record.status) && (
              <div className="section">
                <div className="mini-cards-container">
                  <div className="section-header">
                    <h3 className="section-title">{highlightText('Exam Information')}</h3>
                    <div className="header-right-actions">
                      <button
                        className={`copy-btn ${copiedId === `metadata-${idx}` ? 'copied' : ''}`}
                        onClick={() => {
                          const lines = ['EXAM INFORMATION', '='.repeat(50)];
                          if (record.date) lines.push(`Date: ${formatDate(record.date)}`);
                          if (record.type) lines.push(`Type: ${record.type}`);
                          if (record.provider) lines.push(`Provider: ${record.provider}`);
                          if (record.facility) lines.push(`Facility: ${record.facility}`);
                          if (record.status) lines.push(`Status: ${record.status}`);
                          copyToClipboard(lines.join('\n'), `metadata-${idx}`);
                        }}
                      >
                        {copiedId === `metadata-${idx}` ? 'Copied!' : 'Copy Section'}
                      </button>
                    </div>
                  </div>
                  {record.type && renderReadOnlyField('Type', record.type, `type-${idx}`)}
                  {record.provider && renderReadOnlyField('Provider', record.provider, `provider-${idx}`)}
                  {record.facility && renderReadOnlyField('Facility', record.facility, `facility-${idx}`)}
                  {record.status && renderReadOnlyField('Status', record.status, `status-${idx}`)}
                </div>
              </div>
            )}

            {/* 1. Consciousness & Orientation */}
            {showConsciousness && (
              <div className="section">
                <div className="mini-cards-container">
                  {renderSectionHeader('Consciousness & Orientation', `consciousness-${idx}`,
                    () => copyToClipboard(getSectionText(pdfData[idx] || record, 'Consciousness & Orientation',
                      ['levelOfConsciousness', 'orientation', 'attentionConcentration']), `consciousness-${idx}`), idx, 'consciousness')}

                  {record.levelOfConsciousness && (consciousnessTitleMatches || shouldShowRow('Level of Consciousness', record.levelOfConsciousness)) &&
                    renderEditableField(record, idx, 'levelOfConsciousness', 'Level of Consciousness', 'consciousness', `${recordId}-loc`)}
                  {record.orientation && (consciousnessTitleMatches || shouldShowRow('Orientation', record.orientation)) &&
                    renderEditableField(record, idx, 'orientation', 'Orientation', 'consciousness', `${recordId}-orientation`)}
                  {record.attentionConcentration && (consciousnessTitleMatches || shouldShowRow('Attention & Concentration', record.attentionConcentration)) &&
                    renderEditableField(record, idx, 'attentionConcentration', 'Attention & Concentration', 'consciousness', `${recordId}-attention`)}
                </div>
              </div>
            )}

            {/* 2. Cognitive Function */}
            {showCognitive && (
              <div className="section">
                <div className="mini-cards-container">
                  {renderSectionHeader('Cognitive Function', `cognitive-${idx}`,
                    () => copyToClipboard(getSectionText(pdfData[idx] || record, 'Cognitive Function',
                      ['memoryImpairment', 'executiveFunction', 'abstractThinking', 'cognitiveScreeningTool']), `cognitive-${idx}`), idx, 'cognitive')}

                  {record.memoryImpairment && (cognitiveTitleMatches || shouldShowRow('Memory Impairment', record.memoryImpairment)) &&
                    renderEditableField(record, idx, 'memoryImpairment', 'Memory Impairment', 'cognitive', `${recordId}-memory`)}
                  {record.executiveFunction && (cognitiveTitleMatches || shouldShowRow('Executive Function', record.executiveFunction)) &&
                    renderEditableField(record, idx, 'executiveFunction', 'Executive Function', 'cognitive', `${recordId}-executive`)}
                  {record.abstractThinking && (cognitiveTitleMatches || shouldShowRow('Abstract Thinking', record.abstractThinking)) &&
                    renderEditableField(record, idx, 'abstractThinking', 'Abstract Thinking', 'cognitive', `${recordId}-abstract`)}
                  {record.cognitiveScreeningTool && (cognitiveTitleMatches || shouldShowRow('Cognitive Screening Tool', record.cognitiveScreeningTool)) &&
                    renderEditableField(record, idx, 'cognitiveScreeningTool', 'Cognitive Screening Tool', 'cognitive', `${recordId}-screening`)}
                </div>
              </div>
            )}

            {/* 3. Speech & Thought */}
            {showSpeechThought && (
              <div className="section">
                <div className="mini-cards-container">
                  {renderSectionHeader('Speech & Thought', `speech-thought-${idx}`,
                    () => copyToClipboard(getSectionText(pdfData[idx] || record, 'Speech & Thought',
                      ['speechLanguage', 'thoughtProcess', 'thoughtContent', 'perceptualDisturbances']), `speech-thought-${idx}`), idx, 'speech-thought')}

                  {record.speechLanguage && (speechTitleMatches || shouldShowRow('Speech & Language', record.speechLanguage)) &&
                    renderEditableField(record, idx, 'speechLanguage', 'Speech & Language', 'speech-thought', `${recordId}-speech`)}
                  {record.thoughtProcess && (speechTitleMatches || shouldShowRow('Thought Process', record.thoughtProcess)) &&
                    renderEditableField(record, idx, 'thoughtProcess', 'Thought Process', 'speech-thought', `${recordId}-process`)}
                  {record.thoughtContent && (speechTitleMatches || shouldShowRow('Thought Content', record.thoughtContent)) &&
                    renderEditableField(record, idx, 'thoughtContent', 'Thought Content', 'speech-thought', `${recordId}-content`)}
                  {record.perceptualDisturbances && (speechTitleMatches || shouldShowRow('Perceptual Disturbances', record.perceptualDisturbances)) &&
                    renderEditableField(record, idx, 'perceptualDisturbances', 'Perceptual Disturbances', 'speech-thought', `${recordId}-perceptual`)}
                </div>
              </div>
            )}

            {/* 4. Mood & Affect */}
            {showMoodAffect && (
              <div className="section">
                <div className="mini-cards-container">
                  {renderSectionHeader('Mood & Affect', `mood-affect-${idx}`,
                    () => copyToClipboard(getSectionText(pdfData[idx] || record, 'Mood & Affect',
                      ['mood', 'affect']), `mood-affect-${idx}`), idx, 'mood-affect')}

                  {record.mood && (moodTitleMatches || shouldShowRow('Mood', record.mood)) &&
                    renderEditableField(record, idx, 'mood', 'Mood', 'mood-affect', `${recordId}-mood`)}
                  {record.affect && (moodTitleMatches || shouldShowRow('Affect', record.affect)) &&
                    renderEditableField(record, idx, 'affect', 'Affect', 'mood-affect', `${recordId}-affect`)}
                </div>
              </div>
            )}

            {/* 5. Behavior & Judgment */}
            {showBehaviorJudgment && (
              <div className="section">
                <div className="mini-cards-container">
                  {renderSectionHeader('Behavior & Judgment', `behavior-judgment-${idx}`,
                    () => copyToClipboard(getSectionText(pdfData[idx] || record, 'Behavior & Judgment',
                      ['psychomotorActivity', 'impulseControl', 'insight', 'judgment']), `behavior-judgment-${idx}`), idx, 'behavior-judgment')}

                  {record.psychomotorActivity && (behaviorTitleMatches || shouldShowRow('Psychomotor Activity', record.psychomotorActivity)) &&
                    renderEditableField(record, idx, 'psychomotorActivity', 'Psychomotor Activity', 'behavior-judgment', `${recordId}-psychomotor`)}
                  {record.impulseControl && (behaviorTitleMatches || shouldShowRow('Impulse Control', record.impulseControl)) &&
                    renderEditableField(record, idx, 'impulseControl', 'Impulse Control', 'behavior-judgment', `${recordId}-impulse`)}
                  {record.insight && (behaviorTitleMatches || shouldShowRow('Insight', record.insight)) &&
                    renderEditableField(record, idx, 'insight', 'Insight', 'behavior-judgment', `${recordId}-insight`)}
                  {record.judgment && (behaviorTitleMatches || shouldShowRow('Judgment', record.judgment)) &&
                    renderEditableField(record, idx, 'judgment', 'Judgment', 'behavior-judgment', `${recordId}-judgment`)}
                </div>
              </div>
            )}

            {/* 6. Findings (unified schema fallback, read-only) */}
            {showFindings && (
              <div className="section">
                <div className="mini-cards-container">
                  <div className="section-header">
                    <h3 className="section-title">{highlightText('Findings')}</h3>
                    <div className="header-right-actions">
                      <button
                        className={`copy-btn ${copiedId === `findings-${idx}` ? 'copied' : ''}`}
                        onClick={() => copyToClipboard(record.findings, `findings-${idx}`)}
                      >
                        {copiedId === `findings-${idx}` ? 'Copied!' : 'Copy Section'}
                      </button>
                    </div>
                  </div>
                  {renderReadOnlyField('Findings', record.findings, `findings-val-${idx}`)}
                </div>
              </div>
            )}

            {/* 7. Assessment (unified schema fallback, read-only) */}
            {showAssessment && (
              <div className="section">
                <div className="mini-cards-container">
                  <div className="section-header">
                    <h3 className="section-title">{highlightText('Assessment')}</h3>
                    <div className="header-right-actions">
                      <button
                        className={`copy-btn ${copiedId === `assessment-${idx}` ? 'copied' : ''}`}
                        onClick={() => copyToClipboard(record.assessment, `assessment-${idx}`)}
                      >
                        {copiedId === `assessment-${idx}` ? 'Copied!' : 'Copy Section'}
                      </button>
                    </div>
                  </div>
                  {renderReadOnlyField('Assessment', record.assessment, `assessment-val-${idx}`)}
                </div>
              </div>
            )}

            {/* 8. Plan (unified schema fallback, read-only) */}
            {showPlan && (
              <div className="section">
                <div className="mini-cards-container">
                  <div className="section-header">
                    <h3 className="section-title">{highlightText('Plan')}</h3>
                    <div className="header-right-actions">
                      <button
                        className={`copy-btn ${copiedId === `plan-${idx}` ? 'copied' : ''}`}
                        onClick={() => copyToClipboard(record.plan, `plan-${idx}`)}
                      >
                        {copiedId === `plan-${idx}` ? 'Copied!' : 'Copy Section'}
                      </button>
                    </div>
                  </div>
                  {renderReadOnlyField('Plan', record.plan, `plan-val-${idx}`)}
                </div>
              </div>
            )}

            {/* 9. Recommendations (unified schema fallback, read-only) */}
            {showRecommendations && (
              <div className="section">
                <div className="mini-cards-container">
                  <div className="section-header">
                    <h3 className="section-title">{highlightText('Recommendations')}</h3>
                    <div className="header-right-actions">
                      <button
                        className={`copy-btn ${copiedId === `recs-${idx}` ? 'copied' : ''}`}
                        onClick={() => {
                          const recText = record.recommendations.map((rec, i) => {
                            const text = typeof rec === 'object' ? rec.recommendation : String(rec);
                            return `${i + 1}. ${text}`;
                          }).join('\n');
                          copyToClipboard(recText, `recs-${idx}`);
                        }}
                      >
                        {copiedId === `recs-${idx}` ? 'Copied!' : 'Copy Section'}
                      </button>
                    </div>
                  </div>
                  {record.recommendations.map((rec, recIdx) => {
                    const recText = typeof rec === 'object' ? rec.recommendation : String(rec);
                    const recDate = typeof rec === 'object' && rec.date ? rec.date : null;
                    return renderReadOnlyField(
                      `Recommendation ${recIdx + 1}${recDate ? ` (${formatDate(recDate)})` : ''}`,
                      recText,
                      `rec-${idx}-${recIdx}`
                    );
                  })}
                </div>
              </div>
            )}

            {/* 10. Results (unified schema fallback, read-only) */}
            {showResults && (
              <div className="section">
                <div className="mini-cards-container">
                  <div className="section-header">
                    <h3 className="section-title">{highlightText('Results')}</h3>
                    <div className="header-right-actions">
                      <button
                        className={`copy-btn ${copiedId === `results-${idx}` ? 'copied' : ''}`}
                        onClick={() => {
                          const resultsText = typeof record.results === 'object' ? JSON.stringify(record.results, null, 2) : String(record.results);
                          copyToClipboard(resultsText, `results-${idx}`);
                        }}
                      >
                        {copiedId === `results-${idx}` ? 'Copied!' : 'Copy Section'}
                      </button>
                    </div>
                  </div>
                  {renderReadOnlyField('Results', record.results, `results-val-${idx}`)}
                </div>
              </div>
            )}

            {/* 11. Notes (unified schema fallback, read-only) */}
            {showNotes && (
              <div className="section">
                <div className="mini-cards-container">
                  <div className="section-header">
                    <h3 className="section-title">{highlightText('Notes')}</h3>
                    <div className="header-right-actions">
                      <button
                        className={`copy-btn ${copiedId === `notes-${idx}` ? 'copied' : ''}`}
                        onClick={() => copyToClipboard(record.notes, `notes-${idx}`)}
                      >
                        {copiedId === `notes-${idx}` ? 'Copied!' : 'Copy Section'}
                      </button>
                    </div>
                  </div>
                  {renderReadOnlyField('Notes', record.notes, `notes-val-${idx}`)}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default MentalStatusExamsDocument;
