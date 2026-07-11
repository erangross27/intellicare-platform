import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import SearchBar from '../components/SearchBar';
import { PDFDownloadLink } from '@react-pdf/renderer';
import secureApiClient from '../../../services/secureApiClient';
import ConsultationDetailsDocumentPDFTemplate from '../pdf-templates/ConsultationDetailsDocumentPDFTemplate';
import './ConsultationDetailsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'consultation_detailsPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

const ConsultationDetailsDocument = ({ document, data }) => {
  // Accept both 'document' and 'data' props for compatibility
  const templateData = document || data;
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSectionId, setCopiedSectionId] = useState(null);

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

  // Format date helper
  const formatDate = (dateValue) => {
    if (!dateValue) return '';
    try {
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return String(dateValue);
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }).format(date);
    } catch (e) {
      return String(dateValue);
    }
  };

  // Unwrap data - handle wrapped collection format
  let recordsArray = [];
  if (Array.isArray(templateData)) {
    if (templateData.length > 0 && templateData[0].consultation_details && Array.isArray(templateData[0].consultation_details)) {
      recordsArray = templateData[0].consultation_details;
    } else {
      recordsArray = templateData;
    }
  } else if (templateData && templateData.consultation_details && Array.isArray(templateData.consultation_details)) {
    recordsArray = templateData.consultation_details;
  } else if (templateData) {
    recordsArray = [templateData];
  }

  const validRecords = recordsArray.filter(r => r != null);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  // Drafts are keyed by record _id; map back to the current render index. fieldPart = "field" or "field.arrayIndex".
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {}, nStatus = {};
    validRecords.forEach((record, idx) => {
      const rid = record && (record._id?.$oid || record._id);
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        // editedFields is keyed `${sectionId}-${idx}`; we don't know sectionId here, so mark the
        // field's own section keys leniently via the sentence marker + status (button shows via sectionHasEdits).
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
  }, [templateData]);

  // Split text into sentences — proper parser with parenthesis/title protection
  const splitBySentence = (text) => {
    if (!text || typeof text !== 'string') return [];
    const result = [];
    let current = '';
    let parenDepth = 0;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '(') parenDepth++;
      else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);
      if ((ch === '.' || ch === ';') && parenDepth === 0 && i + 1 < text.length && /\s/.test(text[i + 1])) {
        if (ch === '.' && /\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|etc)$/.test(current)) {
          current += ch;
          continue;
        }
        const trimmed = current.trim();
        if (trimmed) result.push(trimmed);
        current = '';
        while (i + 1 < text.length && /\s/.test(text[i + 1])) i++;
      } else {
        current += ch;
      }
    }
    const trimmed = current.replace(/[.;]+$/, '').trim();
    if (trimmed) result.push(trimmed);
    return result;
  };

  // Parse "Label: Value" from sentence text — detect embedded subtitle labels
  const parseLabel = (text) => {
    if (!text || typeof text !== 'string') return { label: '', value: text || '', isLabeled: false };
    const colonIdx = text.indexOf(':');
    if (colonIdx > 0 && colonIdx <= 40) {
      const beforeColon = text.substring(0, colonIdx).trim();
      if (/^[A-Za-z][A-Za-z\s\-/()]*$/.test(beforeColon) && beforeColon.split(/\s+/).length <= 5) {
        const afterColon = text.substring(colonIdx + 1).trim();
        if (afterColon.length > 0) {
          return { label: beforeColon, value: afterColon, isLabeled: true };
        }
      }
    }
    return { label: '', value: text, isLabeled: false };
  };

  // Split by comma (respecting parentheses) for display
  const splitByComma = (text) => {
    if (!text || typeof text !== 'string') return [text];
    const parts = [];
    let current = '';
    let parenDepth = 0;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '(') parenDepth++;
      else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);
      if (ch === ',' && parenDepth === 0) {
        const trimmed = current.trim();
        if (trimmed) parts.push(trimmed);
        current = '';
      } else {
        current += ch;
      }
    }
    const trimmed = current.trim();
    if (trimmed) parts.push(trimmed);
    return parts.length > 1 ? parts : [text];
  };

  // Format sentence field text for copy: splits by sentence, then by comma for labeled groups (≥3 items)
  const formatSentenceFieldLines = (text) => {
    const sentences = splitBySentence(text);
    const lines = [];
    let n = 1;
    sentences.forEach(s => {
      const parsed = parseLabel(s);
      if (parsed.isLabeled) {
        const parts = splitByComma(parsed.value);
        if (parts.length >= 3) {
          lines.push(parsed.label);
          parts.forEach(item => { lines.push(`  ${n++}. ${item}`); });
        } else {
          lines.push(`${n++}. ${s}`);
        }
      } else {
        lines.push(`${n++}. ${s}`);
      }
    });
    return lines;
  };

  // Sentence fields that may have multiple sentences
  const SENTENCE_FIELDS = [
    'chiefComplaint', 'consultationReason', 'historyOfPresentIllness',
    'diagnosticImpression', 'consultationOpinion', 'followUpInstructions',
    'patientEducation', 'functionalCapacity', 'prognosticIndicators',
  ];

  // Level 1: Document-level filtering — PHRASE MATCHING with .startsWith() for title
  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return validRecords.map((r, idx) => ({
      ...r,
      _documentTitle: `Consultation Details ${idx + 1}`,
      _showAllSections: true
    }));

    const searchLower = searchTerm.toLowerCase().trim();

    return validRecords.map((record, idx) => {
      const documentTitle = `Consultation Details ${idx + 1}`;

      // Flatten nested objects with "Key: Value" format for label search
      const flatVitalSigns = record.vitalSigns && typeof record.vitalSigns === 'object'
        ? Object.entries(record.vitalSigns).map(([k, v]) => `${k.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim()}: ${v}`)
        : [];
      const flatPhysicalExam = record.physicalExamination && typeof record.physicalExamination === 'object'
        ? Object.entries(record.physicalExamination).map(([k, v]) => `${k.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim()}: ${v}`)
        : [];
      const flatROS = record.reviewOfSystems && typeof record.reviewOfSystems === 'object'
        ? Object.entries(record.reviewOfSystems).map(([k, v]) => `${k.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim()}: ${v}`)
        : [];

      const searchableText = [
        documentTitle,
        'consultation details',
        // Field labels + values in "Label: Value" format
        record.consultationDate ? `Consultation Date: ${formatDate(record.consultationDate)}` : null,
        record.consultationType ? `Consultation Type: ${record.consultationType}` : null,
        record.specialtyService ? `Specialty Service: ${record.specialtyService}` : null,
        record.urgencyLevel ? `Urgency Level: ${record.urgencyLevel}` : null,
        record.consultingProvider ? `Consulting Provider: ${record.consultingProvider}` : null,
        record.consultingFacility ? `Consulting Facility: ${record.consultingFacility}` : null,
        record.referringProvider ? `Referring Provider: ${record.referringProvider}` : null,
        record.consultationDuration ? `Duration: ${record.consultationDuration} minutes` : null,
        record.chiefComplaint,
        record.consultationReason,
        record.historyOfPresentIllness,
        record.diagnosticImpression,
        record.consultationOpinion,
        record.followUpInstructions,
        record.patientEducation,
        record.functionalCapacity,
        record.prognosticIndicators,
        record.agreementWithConsultation,
        // Arrays
        ...(record.recommendedDiagnostics || []),
        ...(record.therapeuticRecommendations || []),
        ...(record.medicationReview || []),
        ...(record.proceduresPerformed || []),
        // Nested objects — flattened "Key: Value"
        ...flatVitalSigns,
        ...flatPhysicalExam,
        ...flatROS,
        typeof record.vitalSigns === 'string' ? record.vitalSigns : null,
        typeof record.physicalExamination === 'string' ? record.physicalExamination : null,
        typeof record.reviewOfSystems === 'string' ? record.reviewOfSystems : null,
        // Unified fields
        record.findings,
        record.assessment,
        record.plan,
        record.notes,
        ...(Array.isArray(record.recommendations)
          ? record.recommendations.map(r => typeof r === 'object' ? `${r.recommendation || ''} ${r.date ? formatDate(r.date) : ''}` : r)
          : []),
        // Section titles
        'consultation information', 'chief complaint', 'consultation reason',
        'history of present illness', 'vital signs', 'physical examination',
        'review of systems', 'diagnostic impression', 'consultation opinion',
        'recommended diagnostics', 'therapeutic recommendations', 'medication review',
        'procedures performed', 'follow-up instructions', 'patient education',
        'functional capacity', 'prognostic indicators', 'agreement with consultation',
        'clinical notes', 'recommendations',
        // Field labels
        'consultation date', 'consulting provider', 'consulting facility', 'referring provider',
        'consultation type', 'specialty service', 'urgency level', 'duration', 'HPI', 'ROS',
        'findings', 'assessment', 'plan', 'notes'
      ].filter(Boolean).join(' ').toLowerCase();

      // PHRASE MATCHING
      const matches = searchableText.includes(searchLower);

      // _showAllSections: true when document/record title matches (.startsWith())
      const titleLower = documentTitle.toLowerCase();
      const titleMatches = titleLower.startsWith(searchLower) || searchLower.startsWith(titleLower);

      return {
        ...record,
        _documentTitle: documentTitle,
        _showAllSections: titleMatches,
        _matches: matches
      };
    }).filter(r => r._matches);
  }, [validRecords, searchTerm]);

  // Highlight text with search term
  const highlightText = (text) => {
    if (!text || !searchTerm.trim()) return text;
    const textStr = String(text);
    const searchWords = searchTerm.trim().split(/\s+/).filter(w => w.length > 0);
    if (searchWords.length === 0) return textStr;

    const pattern = searchWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const regex = new RegExp(`(${pattern})`, 'gi');
    const parts = textStr.split(regex);

    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} style={{ backgroundColor: '#fef08a', color: '#000', padding: 0, margin: 0 }}>
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  // Level 3-4: Row-level filtering — PHRASE MATCHING
  const shouldShowRow = (record, ...rowContent) => {
    if (!searchTerm.trim()) return true;
    if (record._showAllSections) return true;

    const searchLower = searchTerm.toLowerCase().trim();
    const rowText = rowContent
      .filter(Boolean)
      .map(item => String(item))
      .join(' ')
      .toLowerCase();

    return rowText.includes(searchLower);
  };

  // Level 2: Section filtering — .startsWith() for title, PHRASE MATCHING for content
  const shouldShowSection = (record, sectionTitle, ...sectionContent) => {
    if (!searchTerm.trim()) return true;
    if (record._showAllSections) return true;

    const searchLower = searchTerm.toLowerCase().trim();

    // Title check: .startsWith() prevents partial word matches
    if (sectionTitle) {
      const titleLower = sectionTitle.toLowerCase();
      if (titleLower.startsWith(searchLower) || searchLower.startsWith(titleLower)) return true;
    }

    // Content check: PHRASE MATCHING with "Label: Value" format
    const contentText = sectionContent.filter(Boolean).join(' ').toLowerCase();
    return contentText.includes(searchLower);
  };

  // Copy function - use modern Clipboard API
  const copySection = async (text, sectionId) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSectionId(sectionId);
      setTimeout(() => setCopiedSectionId(null), 2000);
    } catch (err) {
      const textarea = window.document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'absolute';
      textarea.style.left = '-9999px';
      window.document.body.appendChild(textarea);
      textarea.select();
      try {
        window.document.execCommand('copy');
        setCopiedSectionId(sectionId);
        setTimeout(() => setCopiedSectionId(null), 2000);
      } catch (fallbackErr) {
        console.error('Copy failed:', fallbackErr);
      }
      window.document.body.removeChild(textarea);
    }
  };

  // ============== EDITING HELPERS ==============

  const getFieldValue = useCallback((record, fieldName, idx) => {
    const editKey = `${fieldName}-${idx}`;
    if (localEdits[editKey] !== undefined) return localEdits[editKey];
    return record[fieldName];
  }, [localEdits]);

  const getArrayFieldValue = useCallback((record, fieldName, arrayIndex, idx) => {
    const editKey = `${fieldName}.${arrayIndex}-${idx}`;
    if (localEdits[editKey] !== undefined) return localEdits[editKey];
    const arr = record[fieldName];
    if (Array.isArray(arr) && arrayIndex < arr.length) return arr[arrayIndex];
    return undefined;
  }, [localEdits]);

  // NOTE: persistToLocalStorage (which wrote edits into the shared 'artifactGridData' store) was
  // intentionally removed — drafts now live ONLY in the dedicated DRAFT_KEY store so they never leak
  // into the PDF/DB source before the user clicks Approve.

  // ============== EDITING HANDLERS ==============

  const handleStartEdit = useCallback((fieldName, idx, currentValue, sentenceIdx = 0) => {
    const editKey = `${fieldName}-${idx}-s${sentenceIdx}`;
    setEditingField(editKey);
    const cleanValue = (currentValue || '').replace(/[.;]+$/, '').trim();
    setEditValue(cleanValue);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingField(null);
    setEditValue('');
  }, []);

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApprove commits).
  // fieldName is "field" (flat) or "field.arrayIndex" (array element); it is the localStorage fieldPart.
  const handleSaveField = useCallback((record, fieldName, idx, sectionId, sentenceIdx, valueOverride) => {
    const recordId = record._id?.$oid || record._id;
    if (!recordId) {
      console.error('[ConsultationDetails] Cannot save — no record _id');
      return;
    }
    const saveValue = valueOverride !== undefined ? valueOverride : editValue.trim();
    const editKey = `${fieldName}-${idx}`;
    const sKey = `${fieldName}-${idx}-s${sentenceIdx !== undefined ? sentenceIdx : 0}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: saveValue }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [`${sectionId}-${idx}`]: true }));
    setEditedSentences(prev => ({ ...prev, [sKey]: 'edited' }));
    setStatusOverrides(prev => ({ ...prev, [idx]: 'amended' }));
    // Re-edit after approval → drop the approved flag so the button returns to yellow Pending Approve.
    setApprovedSections(prev => {
      const updated = { ...prev };
      delete updated[sectionId];
      delete updated[`record-${idx}`];
      return updated;
    });
    // Persist the draft to localStorage (keyed by record id, then fieldPart). NO DB write here.
    const store = readDrafts();
    if (!store[recordId]) store[recordId] = {};
    store[recordId][fieldName] = saveValue;
    writeDrafts(store);
    setEditingField(null);
    setEditValue('');
  }, [editValue]);

  // Approve = COMMIT all staged drafts for this record/section to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApprove = useCallback(async (record, idx, sectionId) => {
    const recordId = record._id?.$oid || record._id;
    if (!recordId) return;
    setApproving(true);
    try {
      const suffix = `-${idx}`;
      const fields = SECTION_FIELDS[sectionId] || [];
      // Collect this record's pending edits whose base field belongs to this section.
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
        const fieldPart = k.slice(0, -suffix.length);
        const lastDot = fieldPart.lastIndexOf('.');
        const baseField = lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1))
          ? fieldPart.slice(0, lastDot) : fieldPart;
        return fields.includes(baseField);
      });
      // Persist each staged field to the DB now (field, or field+arrayIndex for array elements).
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // "field" or "field.arrayIndex"
        const lastDot = fieldPart.lastIndexOf('.');
        const hasArrayIdx = lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1));
        const payload = { field: hasArrayIdx ? fieldPart.slice(0, lastDot) : fieldPart, value: localEdits[editKey] };
        if (hasArrayIdx) payload.arrayIndex = parseInt(fieldPart.slice(lastDot + 1), 10);
        const resp = await secureApiClient.put(`/api/edit/consultation_details/${recordId}/edit`, payload);
        if (!resp || !resp.success) throw new Error((resp && resp.error) || 'save failed');
      }
      // Flag the record approved (audit trail)
      const response = await secureApiClient.put(`/api/edit/consultation_details/${recordId}/approve`);
      if (!response || !response.success) throw new Error((response && response.error) || 'approve failed');

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => {
        const next = { ...prev };
        toCommit.forEach(k => delete next[k]);
        return next;
      });
      // Drop this record's committed drafts from localStorage.
      const store = readDrafts();
      if (store[recordId]) {
        toCommit.forEach(editKey => { delete store[recordId][editKey.slice(0, -suffix.length)]; });
        if (Object.keys(store[recordId]).length === 0) delete store[recordId];
        writeDrafts(store);
      }

      setStatusOverrides(prev => ({ ...prev, [idx]: 'approved' }));
      setApprovedSections(prev => ({ ...prev, [sectionId]: true }));
    } catch (err) {
      console.error('[ConsultationDetails] Approve error:', err);
    } finally {
      setApproving(false);
    }
  }, [localEdits, pendingEdits]);

  // ============== SECTION_FIELDS + sectionHasEdits ==============
  const SECTION_FIELDS = {
    'consultation-info': ['consultingProvider', 'consultingFacility', 'referringProvider', 'consultationType', 'specialtyService', 'urgencyLevel'],
    'chief-complaint': ['chiefComplaint'],
    'consultation-reason': ['consultationReason'],
    'hpi': ['historyOfPresentIllness'],
    'diagnostic-impression': ['diagnosticImpression'],
    'consultation-opinion': ['consultationOpinion'],
    'recommended-diagnostics': ['recommendedDiagnostics'],
    'therapeutic-recommendations': ['therapeuticRecommendations'],
    'medication-review': ['medicationReview'],
    'procedures-performed': ['proceduresPerformed'],
    'follow-up': ['followUpInstructions'],
    'patient-education': ['patientEducation'],
    'functional-capacity': ['functionalCapacity'],
    'prognostic-indicators': ['prognosticIndicators'],
  };

  const sectionHasEdits = useCallback((sectionId, idx) => {
    const fields = SECTION_FIELDS[sectionId];
    if (!fields) return false;
    const recordStatus = statusOverrides[idx] || 'active';
    if (recordStatus === 'approved') return false;
    return fields.some(f => {
      return Object.keys(editedSentences).some(key => {
        // Match plain string-field keys (`field-idx-s…`) and array-item keys (`field.itemIdx-idx-s…`)
        if (!key.startsWith(`${f}-${idx}-s`) && !key.startsWith(`${f}.`)) return false;
        if (key.startsWith(`${f}.`) && !key.includes(`-${idx}-s`)) return false;
        return editedSentences[key] === 'edited' || editedSentences[key] === 'added';
      });
    });
  }, [editedSentences, statusOverrides]);

  // ============== pdfData MEMO ==============
  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return validRecords;
    return validRecords.map((record, idx) => {
      const merged = { ...record };
      for (const [editKey, editVal] of Object.entries(localEdits)) {
        if (pendingEdits[editKey]) continue; // pending drafts stay OUT of the PDF until approved
        const dashIdx = editKey.lastIndexOf('-');
        const fieldPart = editKey.substring(0, dashIdx);
        const recIdx = parseInt(editKey.substring(dashIdx + 1), 10);
        if (recIdx === idx) {
          const dotParts = fieldPart.split('.');
          if (dotParts.length === 1) {
            merged[fieldPart] = editVal;
          } else if (dotParts.length === 2) {
            const [parent, child] = dotParts;
            const childNum = parseInt(child, 10);
            if (!isNaN(childNum) && Array.isArray(merged[parent])) {
              merged[parent] = [...merged[parent]];
              merged[parent][childNum] = editVal;
            }
          }
        }
      }
      return merged;
    });
  }, [validRecords, localEdits, pendingEdits]);

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

  // ============== RENDER EDITABLE FIELD (string fields) ==============
  const renderEditableField = (record, fieldName, label, idx, sectionId, copyId) => {
    const displayValue = getFieldValue(record, fieldName, idx);
    if (!displayValue) return null;
    const canEdit = !!record._id;
    const sectionKey = `${sectionId}-${idx}`;
    const sectionWasEdited = editedFields[sectionKey];
    const editKey = `${fieldName}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const isFieldEdited = sectionWasEdited && editedSentences[editKey] === 'edited' && statusOverrides[idx] !== 'approved';

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
                rows={Math.max(2, Math.ceil((editValue?.length || 0) / 60))}
                disabled={saving}
              />
              <div className="edit-actions">
                <button className="edit-save-btn" onClick={() => handleSaveField(record, fieldName, idx, sectionId)} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button className="edit-cancel-btn" onClick={handleCancelEdit} disabled={saving}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="rec-mini-card" key={fieldName}>
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row${isFieldEdited ? ' modified' : ''}`}>
          <div
            className={`row-content${canEdit ? ' editable' : ''}`}
            onClick={() => canEdit && handleStartEdit(fieldName, idx, displayValue)}
            title={canEdit ? 'Click to edit' : undefined}
          >
            <span className="content-value">{highlightText(displayValue)}</span>
            {canEdit && !isFieldEdited && editIndicator}
          </div>
          <button className={`copy-btn ${copiedSectionId === copyId ? 'copied' : ''}`}
            onClick={() => copySection(`${label}: ${displayValue}`, copyId)}>
            {copiedSectionId === copyId ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {isFieldEdited && <div className="modified-badge">edited -- click approve to save</div>}
      </div>
    );
  };

  // ============== SENTENCE EDITING HELPERS (plain functions — NOT useCallback) ==============

  const reconstructFullText = (allSentences, sIdx, editedSentence, fieldName, idx, hasFullEdit) => {
    const updated = allSentences.map((s, i) => {
      let t;
      if (i === sIdx) {
        t = editedSentence;
      } else if (!hasFullEdit) {
        const pKey = `${fieldName}.s${i}-${idx}`;
        t = localEdits[pKey] !== undefined ? localEdits[pKey] : s;
      } else {
        t = s;
      }
      return (t && !/[.!?]$/.test(t)) ? t + '.' : t;
    });
    return updated.join(' ');
  };

  const saveSentence = (record, fieldName, idx, sectionId, sIdx) => {
    let editedSentence = editValue.trim();
    if (editedSentence && !/[.!?]$/.test(editedSentence)) editedSentence += '.';
    const fullEditKey = `${fieldName}-${idx}`;
    const hasFullEdit = localEdits[fullEditKey] !== undefined;
    const sourceText = hasFullEdit ? localEdits[fullEditKey] : (record[fieldName] || '');
    const allCurrent = splitBySentence(sourceText);
    const fullText = reconstructFullText(allCurrent, sIdx, editedSentence, fieldName, idx, hasFullEdit);
    const newSentences = splitBySentence(fullText);
    const extraCount = newSentences.length - allCurrent.length;
    if (extraCount > 0) {
      const editedMap = {};
      editedMap[`${fieldName}-${idx}-s${sIdx}`] = 'edited';
      for (let si = sIdx + 1; si <= sIdx + extraCount; si++) {
        editedMap[`${fieldName}-${idx}-s${si}`] = 'added';
      }
      setEditedSentences(prev => {
        const cleaned = {};
        for (const key of Object.keys(prev)) {
          if (!key.startsWith(`${fieldName}-${idx}-s`)) cleaned[key] = prev[key];
        }
        return { ...cleaned, ...editedMap };
      });
    }
    handleSaveField(record, fieldName, idx, sectionId, sIdx, fullText);
  };

  // ============== RENDER SENTENCE EDITABLE FIELD (per-sentence editing for text fields) ==============
  const renderSentenceEditableField = (record, fieldName, sectionTitle, idx, sectionId, copyIdPrefix) => {
    const displayValue = getFieldValue(record, fieldName, idx);
    if (!displayValue || typeof displayValue !== 'string') return null;
    const sentences = splitBySentence(displayValue);
    if (sentences.length === 0) return null;
    const canEdit = !!record._id;

    const sectionTitleMatches = (() => {
      if (!searchTerm.trim() || record._showAllSections) return false;
      const searchLower = searchTerm.toLowerCase().trim();
      const titleLower = sectionTitle.toLowerCase();
      return titleLower.startsWith(searchLower) || searchLower.startsWith(titleLower);
    })();
    const showAllSentences = record._showAllSections || sectionTitleMatches;

    return sentences.map((sentence, sIdx) => {
      if (!showAllSentences && searchTerm.trim() && !shouldShowRow(record, sectionTitle, sentence)) return null;
      const editKey = `${fieldName}-${idx}-s${sIdx}`;
      const isEditing = editingField === editKey;
      const isFieldEdited = (editedSentences[editKey] === 'edited' || editedSentences[editKey] === 'added') && statusOverrides[idx] !== 'approved';
      const parsed = parseLabel(sentence);
      const labelPrefix = parsed.isLabeled ? `${parsed.label}: ` : '';
      const editDisplayValue = parsed.isLabeled && editValue.startsWith(labelPrefix)
        ? editValue.substring(labelPrefix.length)
        : editValue;

      if (isEditing) {
        return (
          <div key={sIdx} className="rec-mini-card">
            {parsed.isLabeled && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
            <div className="numbered-row edit-row">
              <div className="edit-field-container">
                <textarea
                  ref={textareaRef}
                  className="edit-textarea"
                  value={editDisplayValue}
                  onChange={(e) => setEditValue(parsed.isLabeled ? `${labelPrefix}${e.target.value}` : e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') handleCancelEdit();
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveSentence(record, fieldName, idx, sectionId, sIdx);
                  }}
                  rows={Math.max(2, Math.ceil((editDisplayValue?.length || 0) / 60))}
                  disabled={saving}
                />
                <div className="edit-actions">
                  <button className="edit-save-btn" onClick={() => saveSentence(record, fieldName, idx, sectionId, sIdx)} disabled={saving}>
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button className="edit-cancel-btn" onClick={handleCancelEdit} disabled={saving}>Cancel</button>
                </div>
              </div>
            </div>
          </div>
        );
      }

      const rawComma = parsed.isLabeled ? splitByComma(parsed.value) : [];
      const displayParts = (parsed.isLabeled && rawComma.length >= 3) ? rawComma : [parsed.value];
      return (
        <div key={sIdx} className="rec-mini-card">
          {parsed.isLabeled && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
          {displayParts.map((part, pIdx) => (
            <div key={pIdx} className={`numbered-row${isFieldEdited ? ' modified' : ''}`}>
              <div
                className={`row-content${canEdit ? ' editable' : ''}`}
                onClick={() => canEdit && handleStartEdit(fieldName, idx, sentence, sIdx)}
                title={canEdit ? 'Click to edit' : undefined}
              >
                <span className="content-value">{highlightText(part)}</span>
                {canEdit && !isFieldEdited && editIndicator}
              </div>
              <button className={`copy-btn ${copiedSectionId === `${copyIdPrefix}-${sIdx}-${pIdx}` ? 'copied' : ''}`}
                onClick={() => copySection(part, `${copyIdPrefix}-${sIdx}-${pIdx}`)}>
                {copiedSectionId === `${copyIdPrefix}-${sIdx}-${pIdx}` ? 'Copied!' : 'Copy'}
              </button>
            </div>
          ))}
          {isFieldEdited && <div className="modified-badge">edited -- click pending approve to save</div>}
        </div>
      );
    }).filter(Boolean);
  };

  // ============== RENDER EDITABLE ARRAY ITEM ==============
  const renderEditableArrayItem = (record, fieldName, item, idx, itemIdx, sectionId, copyId) => {
    const displayValue = getArrayFieldValue(record, fieldName, itemIdx, idx) || item;
    if (!displayValue) return null;
    const canEdit = !!record._id;
    const editKey = `${fieldName}.${itemIdx}-${idx}-s0`;
    const isEditing = editingField === editKey;
    const sectionKey = `${sectionId}-${idx}`;
    const sectionWasEdited = editedFields[sectionKey];
    const isItemEdited = sectionWasEdited && editedSentences[editKey] === 'edited' && statusOverrides[idx] !== 'approved';
    const parsed = parseLabel(displayValue);
    const labelPrefix = parsed.isLabeled ? `${parsed.label}: ` : '';
    const editDisplayValue = parsed.isLabeled && editValue.startsWith(labelPrefix)
      ? editValue.substring(labelPrefix.length)
      : editValue;
    const commaParts = splitByComma(parsed.value);

    if (isEditing) {
      return (
        <div key={itemIdx} className="rec-mini-card">
          {parsed.isLabeled && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
          <div className="numbered-row edit-row">
            <div className="edit-field-container">
              <textarea
                ref={textareaRef}
                className="edit-textarea"
                value={editDisplayValue}
                onChange={(e) => setEditValue(parsed.isLabeled ? `${labelPrefix}${e.target.value}` : e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') handleCancelEdit();
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSaveField(record, `${fieldName}.${itemIdx}`, idx, sectionId);
                }}
                rows={Math.max(2, Math.ceil((editDisplayValue?.length || 0) / 60))}
                disabled={saving}
              />
              <div className="edit-actions">
                <button className="edit-save-btn" onClick={() => handleSaveField(record, `${fieldName}.${itemIdx}`, idx, sectionId)} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button className="edit-cancel-btn" onClick={handleCancelEdit} disabled={saving}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div key={itemIdx} className="rec-mini-card">
        {parsed.isLabeled && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
        {commaParts.map((part, pIdx) => (
          <div key={pIdx} className={`numbered-row${isItemEdited ? ' modified' : ''}`}>
            <div
              className={`row-content${canEdit ? ' editable' : ''}`}
              onClick={() => canEdit && handleStartEdit(`${fieldName}.${itemIdx}`, idx, displayValue)}
              title={canEdit ? 'Click to edit' : undefined}
            >
              <span className="content-value">{highlightText(part)}</span>
              {pIdx === 0 && canEdit && !isItemEdited && editIndicator}
            </div>
            <button className={`copy-btn ${copiedSectionId === `${copyId}-${pIdx}` ? 'copied' : ''}`}
              onClick={() => copySection(part, `${copyId}-${pIdx}`)}>
              {copiedSectionId === `${copyId}-${pIdx}` ? 'Copied!' : 'Copy'}
            </button>
          </div>
        ))}
        {isItemEdited && <div className="modified-badge">edited -- click approve to save</div>}
      </div>
    );
  };

  // ============== SECTION HEADER WITH APPROVE ==============
  const renderSectionHeader = (title, copyId, copyFn, idx, sectionId) => (
    <div className="section-header">
      <div className="section-header-left">
        <h4 className="section-title">{highlightText(title)}</h4>
      </div>
      <div className="section-header-right">
        <button
          className={`copy-btn ${copiedSectionId === copyId ? 'copied' : ''}`}
          onClick={copyFn}
        >
          {copiedSectionId === copyId ? 'Copied!' : 'Copy Section'}
        </button>
        {(sectionHasEdits(sectionId, idx) || approvedSections[sectionId]) && (
          <button
            className={`approve-btn${approvedSections[sectionId] ? ' approved' : ' pending'}`}
            onClick={() => handleApprove(validRecords[idx], idx, sectionId)}
            disabled={approving}
          >
            {approving ? 'Approving...' : approvedSections[sectionId] ? 'Approved' : 'Pending Approve'}
          </button>
        )}
      </div>
    </div>
  );

  // Copy all function - uses pdfData for edit persistence
  const copyAll = () => {
    let text = '=== CONSULTATION DETAILS ===\n\n';

    const records = pdfData.length > 0 ? pdfData : filteredRecords;
    records.forEach((record, idx) => {
      text += `Consultation Details ${idx + 1}\n`;
      text += '\u2500'.repeat(50) + '\n\n';

      // Consultation Info
      if (record.consultationDate) text += `Consultation Date: ${formatDate(record.consultationDate)}\n`;
      if (record.consultationType) text += `Consultation Type: ${record.consultationType}\n`;
      if (record.specialtyService) text += `Specialty Service: ${record.specialtyService}\n`;
      if (record.urgencyLevel) text += `Urgency Level: ${record.urgencyLevel}\n`;
      if (record.consultingProvider) text += `Consulting Provider: ${record.consultingProvider}\n`;
      if (record.consultingFacility) text += `Consulting Facility: ${record.consultingFacility}\n`;
      if (record.referringProvider) text += `Referring Provider: ${record.referringProvider}\n`;
      if (record.consultationDuration) text += `Duration: ${record.consultationDuration} minutes\n`;
      text += '\n';

      // Chief Complaint & HPI
      if (record.chiefComplaint) {
        text += 'CHIEF COMPLAINT\n';
        formatSentenceFieldLines(record.chiefComplaint).forEach(line => { text += `  ${line}\n`; });
        text += '\n';
      }
      if (record.historyOfPresentIllness) {
        text += 'HISTORY OF PRESENT ILLNESS\n';
        formatSentenceFieldLines(record.historyOfPresentIllness).forEach(line => { text += `  ${line}\n`; });
        text += '\n';
      }
      if (record.consultationReason) {
        text += 'CONSULTATION REASON\n';
        formatSentenceFieldLines(record.consultationReason).forEach(line => { text += `  ${line}\n`; });
        text += '\n';
      }

      // Review of Systems - Handle both string and object formats
      if (record.reviewOfSystems) {
        if (typeof record.reviewOfSystems === 'string') {
          text += `REVIEW OF SYSTEMS\n${record.reviewOfSystems}\n\n`;
        } else if (Object.keys(record.reviewOfSystems).length > 0) {
          text += 'REVIEW OF SYSTEMS\n';
          Object.entries(record.reviewOfSystems).forEach(([key, value]) => {
            text += `  ${key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim()}: ${value}\n`;
          });
          text += '\n';
        }
      }

      // Vital Signs - Handle both string and object formats
      if (record.vitalSigns) {
        if (typeof record.vitalSigns === 'string') {
          text += `VITAL SIGNS\n${record.vitalSigns}\n\n`;
        } else if (Object.keys(record.vitalSigns).length > 0) {
          text += 'VITAL SIGNS\n';
          Object.entries(record.vitalSigns).forEach(([key, value]) => {
            text += `  ${key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim()}: ${value}\n`;
          });
          text += '\n';
        }
      }

      // Physical Examination - Handle both string and object formats
      if (record.physicalExamination) {
        if (typeof record.physicalExamination === 'string') {
          text += `PHYSICAL EXAMINATION\n${record.physicalExamination}\n\n`;
        } else if (Object.keys(record.physicalExamination).length > 0) {
          text += 'PHYSICAL EXAMINATION\n';
          Object.entries(record.physicalExamination).forEach(([key, value]) => {
            text += `  ${key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim()}: ${value}\n`;
          });
          text += '\n';
        }
      }

      // Diagnostic Impression & Opinion
      if (record.diagnosticImpression) {
        text += 'DIAGNOSTIC IMPRESSION\n';
        formatSentenceFieldLines(record.diagnosticImpression).forEach(line => { text += `  ${line}\n`; });
        text += '\n';
      }
      if (record.consultationOpinion) {
        text += 'CONSULTATION OPINION\n';
        formatSentenceFieldLines(record.consultationOpinion).forEach(line => { text += `  ${line}\n`; });
        text += '\n';
      }

      // Recommended Diagnostics
      if (record.recommendedDiagnostics && record.recommendedDiagnostics.length > 0) {
        text += 'RECOMMENDED DIAGNOSTICS\n';
        record.recommendedDiagnostics.forEach((item, i) => {
          text += `  ${i + 1}. ${item}\n`;
        });
        text += '\n';
      }

      // Therapeutic Recommendations
      if (record.therapeuticRecommendations && record.therapeuticRecommendations.length > 0) {
        text += 'THERAPEUTIC RECOMMENDATIONS\n';
        record.therapeuticRecommendations.forEach((item, i) => {
          text += `  ${i + 1}. ${item}\n`;
        });
        text += '\n';
      }

      // Medication Review
      if (record.medicationReview && record.medicationReview.length > 0) {
        text += 'MEDICATION REVIEW\n';
        record.medicationReview.forEach((item, i) => {
          text += `  ${i + 1}. ${item}\n`;
        });
        text += '\n';
      }

      // Procedures Performed
      if (record.proceduresPerformed && record.proceduresPerformed.length > 0) {
        text += 'PROCEDURES PERFORMED\n';
        record.proceduresPerformed.forEach((item, i) => {
          text += `  ${i + 1}. ${item}\n`;
        });
        text += '\n';
      }

      // Follow-up & Education
      if (record.followUpInstructions) {
        text += 'FOLLOW-UP INSTRUCTIONS\n';
        formatSentenceFieldLines(record.followUpInstructions).forEach(line => { text += `  ${line}\n`; });
        text += '\n';
      }
      if (record.patientEducation) {
        text += 'PATIENT EDUCATION\n';
        formatSentenceFieldLines(record.patientEducation).forEach(line => { text += `  ${line}\n`; });
        text += '\n';
      }

      // Additional Fields
      if (record.functionalCapacity) {
        text += 'FUNCTIONAL CAPACITY\n';
        formatSentenceFieldLines(record.functionalCapacity).forEach(line => { text += `  ${line}\n`; });
        text += '\n';
      }
      if (record.prognosticIndicators) {
        text += 'PROGNOSTIC INDICATORS\n';
        formatSentenceFieldLines(record.prognosticIndicators).forEach(line => { text += `  ${line}\n`; });
        text += '\n';
      }
      if (record.agreementWithConsultation) text += `AGREEMENT WITH CONSULTATION\n${record.agreementWithConsultation}\n\n`;

      // Clinical Notes
      if (record.findings) {
        text += 'FINDINGS\n';
        formatSentenceFieldLines(record.findings).forEach(line => { text += `  ${line}\n`; });
        text += '\n';
      }
      if (record.assessment) {
        text += 'ASSESSMENT\n';
        formatSentenceFieldLines(record.assessment).forEach(line => { text += `  ${line}\n`; });
        text += '\n';
      }
      if (record.plan) {
        text += 'PLAN\n';
        formatSentenceFieldLines(record.plan).forEach(line => { text += `  ${line}\n`; });
        text += '\n';
      }
      if (record.notes) {
        text += 'NOTES\n';
        formatSentenceFieldLines(record.notes).forEach(line => { text += `  ${line}\n`; });
        text += '\n';
      }

      // Recommendations
      if (record.recommendations && record.recommendations.length > 0) {
        text += 'RECOMMENDATIONS\n';
        record.recommendations.forEach((rec, i) => {
          if (typeof rec === 'object') {
            if (rec.date) text += `  ${formatDate(rec.date)}\n`;
            text += `  ${i + 1}. ${rec.recommendation || 'N/A'}\n`;
          } else {
            text += `  ${i + 1}. ${rec}\n`;
          }
        });
        text += '\n';
      }

      text += '='.repeat(80) + '\n\n';
    });

    copySection(text, 'all');
  };

  // Export to PDF - uses pdfData for edit persistence
  const exportData = pdfData.length > 0 ? pdfData : filteredRecords;

  if (!filteredRecords || filteredRecords.length === 0) {
    return (
      <div className="consultation-details-document">
        <div className="document-header">
          <h2 className="document-title">Consultation Details</h2>
        </div>
        <SearchBar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          placeholder="Search consultation details..."
        />
        <div className="no-data-message">
          {searchTerm ? 'No consultations match your search.' : 'No consultation details available.'}
        </div>
      </div>
    );
  }

  return (
    <div className="consultation-details-document">
      <div className="document-header">
        <h2 className="document-title">Consultation Details</h2>
        <div className="header-actions">
          <button className={`copy-all-button ${copiedSectionId === 'all' ? 'copied' : ''}`} onClick={copyAll}>
            {copiedSectionId === 'all' ? 'Copied!' : 'Copy All'}
          </button>
          <PDFDownloadLink
            document={<ConsultationDetailsDocumentPDFTemplate data={exportData} />}
            fileName="Consultation_Details.pdf"
            className="export-pdf-button"
          >
            {({ loading }) => (loading ? 'Preparing PDF...' : 'Export PDF')}
          </PDFDownloadLink>
        </div>
      </div>

      <SearchBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        placeholder="Search consultation details..."
      />

      <div className="records-container">
        {filteredRecords.map((record, idx) => {
          const recordId = `record-${idx}`;
          const showAll = record._showAllSections;

          // Helper: check if search term matches a section title using .startsWith()
          const titleMatch = (title) => {
            if (!searchTerm.trim() || showAll) return false;
            const searchLower = searchTerm.toLowerCase().trim();
            const t = title.toLowerCase();
            return t.startsWith(searchLower) || searchLower.startsWith(t);
          };

          return (
            <div key={idx} className="record-card">
              <div className="record-card-header">
                <div className="header-left">
                  <h3 className="record-card-title">
                    {highlightText(`Consultation Details ${idx + 1}`)}
                  </h3>
                </div>
                {record.consultationDate && (
                  <div className="date-text">{formatDate(record.consultationDate)}</div>
                )}
              </div>

              <div className="record-card-content">
                {/* Consultation Information Section */}
                {(record.consultationType || record.consultingProvider || record.consultingFacility || record.referringProvider || record.consultationDuration) &&
                  shouldShowSection(record, 'Consultation Information',
                    record.consultationType ? `Consultation Type: ${record.consultationType}` : null,
                    record.consultingProvider ? `Consulting Provider: ${record.consultingProvider}` : null,
                    record.consultingFacility ? `Consulting Facility: ${record.consultingFacility}` : null,
                    record.referringProvider ? `Referring Provider: ${record.referringProvider}` : null,
                    record.specialtyService ? `Specialty Service: ${record.specialtyService}` : null,
                    record.urgencyLevel ? `Urgency Level: ${record.urgencyLevel}` : null,
                    record.consultationDuration ? `Duration: ${record.consultationDuration} minutes` : null
                  ) && (
                  (() => {
                    const showField = showAll || titleMatch('Consultation Information');

                    return (
                      <div className="section">
                        <div className="mini-cards-container">
                          {renderSectionHeader('Consultation Information', `${recordId}-info-section`, () => {
                            const r = pdfData[idx] || record;
                            const lines = ['CONSULTATION INFORMATION'];
                            if (r.consultationType) lines.push(`Consultation Type: ${r.consultationType}`);
                            if (r.consultingProvider) lines.push(`Consulting Provider: ${r.consultingProvider}`);
                            if (r.consultingFacility) lines.push(`Consulting Facility: ${r.consultingFacility}`);
                            if (r.referringProvider) lines.push(`Referring Provider: ${r.referringProvider}`);
                            if (r.specialtyService) lines.push(`Specialty Service: ${r.specialtyService}`);
                            if (r.urgencyLevel) lines.push(`Urgency Level: ${r.urgencyLevel}`);
                            if (r.consultationDuration) lines.push(`Duration: ${r.consultationDuration} minutes`);
                            copySection(lines.join('\n'), `${recordId}-info-section`);
                          }, idx, 'consultation-info')}
                          {(showField || shouldShowRow(record, 'Consultation Type', record.consultationType)) &&
                            renderEditableField(record, 'consultationType', 'Consultation Type', idx, 'consultation-info', `${recordId}-type`)
                          }
                          {(showField || shouldShowRow(record, 'Consulting Provider', record.consultingProvider)) &&
                            renderEditableField(record, 'consultingProvider', 'Consulting Provider', idx, 'consultation-info', `${recordId}-cprovider`)
                          }
                          {(showField || shouldShowRow(record, 'Consulting Facility', record.consultingFacility)) &&
                            renderEditableField(record, 'consultingFacility', 'Consulting Facility', idx, 'consultation-info', `${recordId}-cfacility`)
                          }
                          {(showField || shouldShowRow(record, 'Referring Provider', record.referringProvider)) &&
                            renderEditableField(record, 'referringProvider', 'Referring Provider', idx, 'consultation-info', `${recordId}-rprovider`)
                          }
                          {(showField || shouldShowRow(record, 'Specialty Service', record.specialtyService)) &&
                            renderEditableField(record, 'specialtyService', 'Specialty Service', idx, 'consultation-info', `${recordId}-specialty`)
                          }
                          {(showField || shouldShowRow(record, 'Urgency Level', record.urgencyLevel)) &&
                            renderEditableField(record, 'urgencyLevel', 'Urgency Level', idx, 'consultation-info', `${recordId}-urgency`)
                          }
                          {record.consultationDuration > 0 && (showField || shouldShowRow(record, 'Duration', record.consultationDuration)) && (
                            <div className="rec-mini-card">
                              <div className="nested-subtitle">{highlightText('Duration')}</div>
                              <div className="numbered-row">
                                <div className="row-content">
                                  <span className="content-value">{highlightText(`${record.consultationDuration} minutes`)}</span>
                                </div>
                                <button className={`copy-btn ${copiedSectionId === `${recordId}-duration` ? 'copied' : ''}`}
                                  onClick={() => copySection(`Duration: ${record.consultationDuration} minutes`, `${recordId}-duration`)}>
                                  {copiedSectionId === `${recordId}-duration` ? 'Copied!' : 'Copy'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()
                )}

                {/* Chief Complaint */}
                {record.chiefComplaint && shouldShowSection(record, 'Chief Complaint', record.chiefComplaint) && (
                  <div className="section">
                    <div className="mini-cards-container">
                      {renderSectionHeader('Chief Complaint', `${recordId}-cc-section`, () => {
                        const r = pdfData[idx] || record;
                        const lines = ['CHIEF COMPLAINT', '='.repeat(40), ...formatSentenceFieldLines(r.chiefComplaint || '')];
                        copySection(lines.join('\n'), `${recordId}-cc-section`);
                      }, idx, 'chief-complaint')}
                      {renderSentenceEditableField(record, 'chiefComplaint', 'Chief Complaint', idx, 'chief-complaint', `${recordId}-cc`)}
                    </div>
                  </div>
                )}

                {/* Consultation Reason */}
                {record.consultationReason && shouldShowSection(record, 'Consultation Reason', record.consultationReason) && (
                  <div className="section">
                    <div className="mini-cards-container">
                      {renderSectionHeader('Consultation Reason', `${recordId}-reason-section`, () => {
                        const r = pdfData[idx] || record;
                        const lines = ['CONSULTATION REASON', '='.repeat(40), ...formatSentenceFieldLines(r.consultationReason || '')];
                        copySection(lines.join('\n'), `${recordId}-reason-section`);
                      }, idx, 'consultation-reason')}
                      {renderSentenceEditableField(record, 'consultationReason', 'Consultation Reason', idx, 'consultation-reason', `${recordId}-reason`)}
                    </div>
                  </div>
                )}

                {/* History of Present Illness */}
                {record.historyOfPresentIllness && shouldShowSection(record, 'History of Present Illness', record.historyOfPresentIllness) && (
                  <div className="section">
                    <div className="mini-cards-container">
                      {renderSectionHeader('History of Present Illness', `${recordId}-hpi-section`, () => {
                        const r = pdfData[idx] || record;
                        const lines = ['HISTORY OF PRESENT ILLNESS', '='.repeat(40), ...formatSentenceFieldLines(r.historyOfPresentIllness || '')];
                        copySection(lines.join('\n'), `${recordId}-hpi-section`);
                      }, idx, 'hpi')}
                      {renderSentenceEditableField(record, 'historyOfPresentIllness', 'History of Present Illness', idx, 'hpi', `${recordId}-hpi`)}
                    </div>
                  </div>
                )}

                {/* Vital Signs - Handle both string and object formats (READ-ONLY) */}
                {record.vitalSigns && (
                  typeof record.vitalSigns === 'string'
                    ? shouldShowSection(record, 'Vital Signs', record.vitalSigns)
                    : Object.keys(record.vitalSigns).length > 0 && shouldShowSection(record, 'Vital Signs',
                        ...Object.entries(record.vitalSigns).map(([k, v]) => `${k.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim()}: ${v}`)
                      )
                ) && (() => {
                  const showAllContent = showAll || titleMatch('Vital Signs');

                  return (
                    <div className="section">
                      <div className="mini-cards-container">
                        <div className="section-header">
                          <div className="section-header-left">
                            <h4 className="section-title">{highlightText('Vital Signs')}</h4>
                          </div>
                        </div>
                        {typeof record.vitalSigns === 'string' ? (
                          splitBySentence(record.vitalSigns)
                            .filter(sentence => showAllContent || shouldShowRow(record, sentence))
                            .map((sentence, sentIdx) => (
                              <div key={sentIdx} className="rec-mini-card">
                                <div className="numbered-row">
                                  <div className="row-content">
                                    <span className="content-value">{highlightText(sentence)}</span>
                                  </div>
                                  <button className={`copy-btn ${copiedSectionId === `${recordId}-vs-${sentIdx}` ? 'copied' : ''}`}
                                    onClick={() => copySection(sentence, `${recordId}-vs-${sentIdx}`)}>
                                    {copiedSectionId === `${recordId}-vs-${sentIdx}` ? 'Copied!' : 'Copy'}
                                  </button>
                                </div>
                              </div>
                            ))
                        ) : (
                          Object.entries(record.vitalSigns)
                            .filter(([key, value]) => {
                              const label = key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim();
                              return value && (showAllContent || shouldShowRow(record, label, value));
                            })
                            .map(([key, value], vIdx) => (
                              <div key={vIdx} className="rec-mini-card">
                                <div className="nested-subtitle">{highlightText(key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim())}</div>
                                <div className="numbered-row">
                                  <div className="row-content">
                                    <span className="content-value">{highlightText(String(value))}</span>
                                  </div>
                                  <button className={`copy-btn ${copiedSectionId === `${recordId}-vs-${vIdx}` ? 'copied' : ''}`}
                                    onClick={() => copySection(`${key}: ${value}`, `${recordId}-vs-${vIdx}`)}>
                                    {copiedSectionId === `${recordId}-vs-${vIdx}` ? 'Copied!' : 'Copy'}
                                  </button>
                                </div>
                              </div>
                            ))
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Physical Examination - Handle both string and object formats (READ-ONLY) */}
                {record.physicalExamination && (
                  typeof record.physicalExamination === 'string'
                    ? shouldShowSection(record, 'Physical Examination', record.physicalExamination)
                    : Object.keys(record.physicalExamination).length > 0 && shouldShowSection(record, 'Physical Examination',
                        ...Object.entries(record.physicalExamination).map(([k, v]) => `${k.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim()}: ${v}`)
                      )
                ) && (() => {
                  const showAllContent = showAll || titleMatch('Physical Examination');

                  return (
                    <div className="section">
                      <div className="mini-cards-container">
                        <div className="section-header">
                          <div className="section-header-left">
                            <h4 className="section-title">{highlightText('Physical Examination')}</h4>
                          </div>
                        </div>
                        {typeof record.physicalExamination === 'string' ? (
                          splitBySentence(record.physicalExamination)
                            .filter(sentence => showAllContent || shouldShowRow(record, sentence))
                            .map((sentence, sentIdx) => (
                              <div key={sentIdx} className="rec-mini-card">
                                <div className="numbered-row">
                                  <div className="row-content">
                                    <span className="content-value">{highlightText(sentence)}</span>
                                  </div>
                                  <button className={`copy-btn ${copiedSectionId === `${recordId}-pe-${sentIdx}` ? 'copied' : ''}`}
                                    onClick={() => copySection(sentence, `${recordId}-pe-${sentIdx}`)}>
                                    {copiedSectionId === `${recordId}-pe-${sentIdx}` ? 'Copied!' : 'Copy'}
                                  </button>
                                </div>
                              </div>
                            ))
                        ) : (
                          Object.entries(record.physicalExamination)
                            .filter(([key, value]) => {
                              const label = key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim();
                              return value && (showAllContent || shouldShowRow(record, label, value));
                            })
                            .map(([key, value], pIdx) => (
                              <div key={pIdx} className="rec-mini-card">
                                <div className="nested-subtitle">{highlightText(key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim())}</div>
                                <div className="numbered-row">
                                  <div className="row-content">
                                    <span className="content-value">{highlightText(String(value))}</span>
                                  </div>
                                  <button className={`copy-btn ${copiedSectionId === `${recordId}-pe-${pIdx}` ? 'copied' : ''}`}
                                    onClick={() => copySection(`${key}: ${value}`, `${recordId}-pe-${pIdx}`)}>
                                    {copiedSectionId === `${recordId}-pe-${pIdx}` ? 'Copied!' : 'Copy'}
                                  </button>
                                </div>
                              </div>
                            ))
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Review of Systems - Handle both string and object formats (READ-ONLY) */}
                {record.reviewOfSystems && (
                  typeof record.reviewOfSystems === 'string'
                    ? shouldShowSection(record, 'Review of Systems', record.reviewOfSystems)
                    : Object.keys(record.reviewOfSystems).length > 0 && shouldShowSection(record, 'Review of Systems',
                        ...Object.entries(record.reviewOfSystems).map(([k, v]) => `${k.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim()}: ${v}`)
                      )
                ) && (() => {
                  const showAllContent = showAll || titleMatch('Review of Systems');

                  return (
                    <div className="section">
                      <div className="mini-cards-container">
                        <div className="section-header">
                          <div className="section-header-left">
                            <h4 className="section-title">{highlightText('Review of Systems')}</h4>
                          </div>
                        </div>
                        {typeof record.reviewOfSystems === 'string' ? (
                          splitBySentence(record.reviewOfSystems)
                            .filter(sentence => showAllContent || shouldShowRow(record, sentence))
                            .map((sentence, sentIdx) => (
                              <div key={sentIdx} className="rec-mini-card">
                                <div className="numbered-row">
                                  <div className="row-content">
                                    <span className="content-value">{highlightText(sentence)}</span>
                                  </div>
                                  <button className={`copy-btn ${copiedSectionId === `${recordId}-ros-${sentIdx}` ? 'copied' : ''}`}
                                    onClick={() => copySection(sentence, `${recordId}-ros-${sentIdx}`)}>
                                    {copiedSectionId === `${recordId}-ros-${sentIdx}` ? 'Copied!' : 'Copy'}
                                  </button>
                                </div>
                              </div>
                            ))
                        ) : (
                          Object.entries(record.reviewOfSystems)
                            .filter(([key, value]) => {
                              const label = key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim();
                              return value && (showAllContent || shouldShowRow(record, label, value));
                            })
                            .map(([key, value], rIdx) => (
                              <div key={rIdx} className="rec-mini-card">
                                <div className="nested-subtitle">{highlightText(key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim())}</div>
                                <div className="numbered-row">
                                  <div className="row-content">
                                    <span className="content-value">{highlightText(String(value))}</span>
                                  </div>
                                  <button className={`copy-btn ${copiedSectionId === `${recordId}-ros-${rIdx}` ? 'copied' : ''}`}
                                    onClick={() => copySection(`${key}: ${value}`, `${recordId}-ros-${rIdx}`)}>
                                    {copiedSectionId === `${recordId}-ros-${rIdx}` ? 'Copied!' : 'Copy'}
                                  </button>
                                </div>
                              </div>
                            ))
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Diagnostic Impression */}
                {record.diagnosticImpression && shouldShowSection(record, 'Diagnostic Impression', record.diagnosticImpression) && (
                  <div className="section">
                    <div className="mini-cards-container">
                      {renderSectionHeader('Diagnostic Impression', `${recordId}-di-section`, () => {
                        const r = pdfData[idx] || record;
                        const lines = ['DIAGNOSTIC IMPRESSION', '='.repeat(40), ...formatSentenceFieldLines(r.diagnosticImpression || '')];
                        copySection(lines.join('\n'), `${recordId}-di-section`);
                      }, idx, 'diagnostic-impression')}
                      {renderSentenceEditableField(record, 'diagnosticImpression', 'Diagnostic Impression', idx, 'diagnostic-impression', `${recordId}-di`)}
                    </div>
                  </div>
                )}

                {/* Consultation Opinion */}
                {record.consultationOpinion && shouldShowSection(record, 'Consultation Opinion', record.consultationOpinion) && (
                  <div className="section">
                    <div className="mini-cards-container">
                      {renderSectionHeader('Consultation Opinion', `${recordId}-opinion-section`, () => {
                        const r = pdfData[idx] || record;
                        const lines = ['CONSULTATION OPINION', '='.repeat(40), ...formatSentenceFieldLines(r.consultationOpinion || '')];
                        copySection(lines.join('\n'), `${recordId}-opinion-section`);
                      }, idx, 'consultation-opinion')}
                      {renderSentenceEditableField(record, 'consultationOpinion', 'Consultation Opinion', idx, 'consultation-opinion', `${recordId}-opinion`)}
                    </div>
                  </div>
                )}

                {/* Recommended Diagnostics */}
                {record.recommendedDiagnostics && record.recommendedDiagnostics.length > 0 &&
                  shouldShowSection(record, 'Recommended Diagnostics', ...record.recommendedDiagnostics) && (
                  <div className="section">
                    <div className="mini-cards-container">
                      {renderSectionHeader('Recommended Diagnostics', `${recordId}-rd-section`, () => {
                        const r = pdfData[idx] || record;
                        const lines = ['RECOMMENDED DIAGNOSTICS', '='.repeat(40)];
                        (r.recommendedDiagnostics || []).forEach((item, i) => lines.push(`${i + 1}. ${item}`));
                        copySection(lines.join('\n'), `${recordId}-rd-section`);
                      }, idx, 'recommended-diagnostics')}
                      {(record.recommendedDiagnostics || [])
                        .filter(item => showAll || titleMatch('Recommended Diagnostics') || shouldShowRow(record, item))
                        .map((item, itemIdx) =>
                          renderEditableArrayItem(record, 'recommendedDiagnostics', item, idx, itemIdx, 'recommended-diagnostics', `${recordId}-rd-${itemIdx}`)
                        )}
                    </div>
                  </div>
                )}

                {/* Therapeutic Recommendations */}
                {record.therapeuticRecommendations && record.therapeuticRecommendations.length > 0 &&
                  shouldShowSection(record, 'Therapeutic Recommendations', ...record.therapeuticRecommendations) && (
                  <div className="section">
                    <div className="mini-cards-container">
                      {renderSectionHeader('Therapeutic Recommendations', `${recordId}-tr-section`, () => {
                        const r = pdfData[idx] || record;
                        const lines = ['THERAPEUTIC RECOMMENDATIONS', '='.repeat(40)];
                        (r.therapeuticRecommendations || []).forEach((item, i) => lines.push(`${i + 1}. ${item}`));
                        copySection(lines.join('\n'), `${recordId}-tr-section`);
                      }, idx, 'therapeutic-recommendations')}
                      {(record.therapeuticRecommendations || [])
                        .filter(item => showAll || titleMatch('Therapeutic Recommendations') || shouldShowRow(record, item))
                        .map((item, itemIdx) =>
                          renderEditableArrayItem(record, 'therapeuticRecommendations', item, idx, itemIdx, 'therapeutic-recommendations', `${recordId}-tr-${itemIdx}`)
                        )}
                    </div>
                  </div>
                )}

                {/* Medication Review */}
                {record.medicationReview && record.medicationReview.length > 0 &&
                  shouldShowSection(record, 'Medication Review', ...record.medicationReview) && (
                  <div className="section">
                    <div className="mini-cards-container">
                      {renderSectionHeader('Medication Review', `${recordId}-mr-section`, () => {
                        const r = pdfData[idx] || record;
                        const lines = ['MEDICATION REVIEW', '='.repeat(40)];
                        (r.medicationReview || []).forEach((item, i) => lines.push(`${i + 1}. ${item}`));
                        copySection(lines.join('\n'), `${recordId}-mr-section`);
                      }, idx, 'medication-review')}
                      {(record.medicationReview || [])
                        .filter(item => showAll || titleMatch('Medication Review') || shouldShowRow(record, item))
                        .map((item, itemIdx) =>
                          renderEditableArrayItem(record, 'medicationReview', item, idx, itemIdx, 'medication-review', `${recordId}-mr-${itemIdx}`)
                        )}
                    </div>
                  </div>
                )}

                {/* Procedures Performed */}
                {record.proceduresPerformed && record.proceduresPerformed.length > 0 &&
                  shouldShowSection(record, 'Procedures Performed', ...record.proceduresPerformed) && (
                  <div className="section">
                    <div className="mini-cards-container">
                      {renderSectionHeader('Procedures Performed', `${recordId}-pp-section`, () => {
                        const r = pdfData[idx] || record;
                        const lines = ['PROCEDURES PERFORMED', '='.repeat(40)];
                        (r.proceduresPerformed || []).forEach((item, i) => lines.push(`${i + 1}. ${item}`));
                        copySection(lines.join('\n'), `${recordId}-pp-section`);
                      }, idx, 'procedures-performed')}
                      {(record.proceduresPerformed || [])
                        .filter(item => showAll || titleMatch('Procedures Performed') || shouldShowRow(record, item))
                        .map((item, itemIdx) =>
                          renderEditableArrayItem(record, 'proceduresPerformed', item, idx, itemIdx, 'procedures-performed', `${recordId}-pp-${itemIdx}`)
                        )}
                    </div>
                  </div>
                )}

                {/* Follow-up Instructions */}
                {record.followUpInstructions && shouldShowSection(record, 'Follow-up Instructions', record.followUpInstructions) && (
                  <div className="section">
                    <div className="mini-cards-container">
                      {renderSectionHeader('Follow-up Instructions', `${recordId}-followup-section`, () => {
                        const r = pdfData[idx] || record;
                        const lines = ['FOLLOW-UP INSTRUCTIONS', '='.repeat(40), ...formatSentenceFieldLines(r.followUpInstructions || '')];
                        copySection(lines.join('\n'), `${recordId}-followup-section`);
                      }, idx, 'follow-up')}
                      {renderSentenceEditableField(record, 'followUpInstructions', 'Follow-up Instructions', idx, 'follow-up', `${recordId}-followup`)}
                    </div>
                  </div>
                )}

                {/* Patient Education */}
                {record.patientEducation && shouldShowSection(record, 'Patient Education', record.patientEducation) && (
                  <div className="section">
                    <div className="mini-cards-container">
                      {renderSectionHeader('Patient Education', `${recordId}-edu-section`, () => {
                        const r = pdfData[idx] || record;
                        const lines = ['PATIENT EDUCATION', '='.repeat(40), ...formatSentenceFieldLines(r.patientEducation || '')];
                        copySection(lines.join('\n'), `${recordId}-edu-section`);
                      }, idx, 'patient-education')}
                      {renderSentenceEditableField(record, 'patientEducation', 'Patient Education', idx, 'patient-education', `${recordId}-edu`)}
                    </div>
                  </div>
                )}

                {/* Functional Capacity */}
                {record.functionalCapacity && shouldShowSection(record, 'Functional Capacity', record.functionalCapacity) && (
                  <div className="section">
                    <div className="mini-cards-container">
                      {renderSectionHeader('Functional Capacity', `${recordId}-fc-section`, () => {
                        const r = pdfData[idx] || record;
                        const lines = ['FUNCTIONAL CAPACITY', '='.repeat(40), ...formatSentenceFieldLines(r.functionalCapacity || '')];
                        copySection(lines.join('\n'), `${recordId}-fc-section`);
                      }, idx, 'functional-capacity')}
                      {renderSentenceEditableField(record, 'functionalCapacity', 'Functional Capacity', idx, 'functional-capacity', `${recordId}-fc`)}
                    </div>
                  </div>
                )}

                {/* Prognostic Indicators */}
                {record.prognosticIndicators && shouldShowSection(record, 'Prognostic Indicators', record.prognosticIndicators) && (
                  <div className="section">
                    <div className="mini-cards-container">
                      {renderSectionHeader('Prognostic Indicators', `${recordId}-prog-section`, () => {
                        const r = pdfData[idx] || record;
                        const lines = ['PROGNOSTIC INDICATORS', '='.repeat(40), ...formatSentenceFieldLines(r.prognosticIndicators || '')];
                        copySection(lines.join('\n'), `${recordId}-prog-section`);
                      }, idx, 'prognostic-indicators')}
                      {renderSentenceEditableField(record, 'prognosticIndicators', 'Prognostic Indicators', idx, 'prognostic-indicators', `${recordId}-prog`)}
                    </div>
                  </div>
                )}

                {/* Agreement with Consultation (READ-ONLY - not in ALLOWED_FIELDS) */}
                {record.agreementWithConsultation && shouldShowSection(record, 'Agreement with Consultation', record.agreementWithConsultation) && (
                  <div className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <div className="section-header-left">
                          <h4 className="section-title">{highlightText('Agreement with Consultation')}</h4>
                        </div>
                      </div>
                      <div className="rec-mini-card">
                        <div className="numbered-row">
                          <div className="row-content">
                            <span className="content-value">{highlightText(record.agreementWithConsultation)}</span>
                          </div>
                          <button className={`copy-btn ${copiedSectionId === `${recordId}-agree` ? 'copied' : ''}`}
                            onClick={() => copySection(record.agreementWithConsultation, `${recordId}-agree`)}>
                            {copiedSectionId === `${recordId}-agree` ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Clinical Notes Section (READ-ONLY - not in ALLOWED_FIELDS) */}
                {(record.findings || record.assessment || record.plan || record.notes) &&
                  shouldShowSection(record, 'Clinical Notes',
                    record.findings ? `Findings: ${record.findings}` : null,
                    record.assessment ? `Assessment: ${record.assessment}` : null,
                    record.plan ? `Plan: ${record.plan}` : null,
                    record.notes ? `Notes: ${record.notes}` : null
                  ) && (() => {
                  const notesTitleMatches = searchTerm && (() => {
                    const searchLower = searchTerm.toLowerCase().trim();
                    const t = 'clinical notes';
                    return t.startsWith(searchLower) || searchLower.startsWith(t);
                  })();
                  const showNotes = showAll || notesTitleMatches;

                  return (
                  <div className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <div className="section-header-left">
                          <h4 className="section-title">{highlightText('Clinical Notes')}</h4>
                        </div>
                      </div>
                      {/* Findings */}
                      {record.findings && (showNotes || shouldShowRow(record, 'Findings', record.findings)) && (
                        <div className="rec-mini-card">
                          <div className="nested-subtitle">{highlightText('Findings')}</div>
                          {splitBySentence(record.findings)
                            .filter(sentence => showNotes || shouldShowRow(record, 'Findings', sentence))
                            .map((sentence, sentIdx) => (
                              <div key={sentIdx} className="numbered-row" style={{ marginBottom: 8 }}>
                                <div className="row-content">
                                  <span className="content-value">{highlightText(sentence)}</span>
                                </div>
                                <button className={`copy-btn ${copiedSectionId === `${recordId}-findings-${sentIdx}` ? 'copied' : ''}`}
                                  onClick={() => copySection(sentence, `${recordId}-findings-${sentIdx}`)}>
                                  {copiedSectionId === `${recordId}-findings-${sentIdx}` ? 'Copied!' : 'Copy'}
                                </button>
                              </div>
                            ))}
                        </div>
                      )}

                      {/* Assessment */}
                      {record.assessment && (showNotes || shouldShowRow(record, 'Assessment', record.assessment)) && (
                        <div className="rec-mini-card">
                          <div className="nested-subtitle">{highlightText('Assessment')}</div>
                          {splitBySentence(record.assessment)
                            .filter(sentence => showNotes || shouldShowRow(record, 'Assessment', sentence))
                            .map((sentence, sentIdx) => (
                              <div key={sentIdx} className="numbered-row" style={{ marginBottom: 8 }}>
                                <div className="row-content">
                                  <span className="content-value">{highlightText(sentence)}</span>
                                </div>
                                <button className={`copy-btn ${copiedSectionId === `${recordId}-assessment-${sentIdx}` ? 'copied' : ''}`}
                                  onClick={() => copySection(sentence, `${recordId}-assessment-${sentIdx}`)}>
                                  {copiedSectionId === `${recordId}-assessment-${sentIdx}` ? 'Copied!' : 'Copy'}
                                </button>
                              </div>
                            ))}
                        </div>
                      )}

                      {/* Plan */}
                      {record.plan && (showNotes || shouldShowRow(record, 'Plan', record.plan)) && (
                        <div className="rec-mini-card">
                          <div className="nested-subtitle">{highlightText('Plan')}</div>
                          {splitBySentence(record.plan)
                            .filter(sentence => showNotes || shouldShowRow(record, 'Plan', sentence))
                            .map((sentence, sentIdx) => (
                              <div key={sentIdx} className="numbered-row" style={{ marginBottom: 8 }}>
                                <div className="row-content">
                                  <span className="content-value">{highlightText(sentence)}</span>
                                </div>
                                <button className={`copy-btn ${copiedSectionId === `${recordId}-plan-${sentIdx}` ? 'copied' : ''}`}
                                  onClick={() => copySection(sentence, `${recordId}-plan-${sentIdx}`)}>
                                  {copiedSectionId === `${recordId}-plan-${sentIdx}` ? 'Copied!' : 'Copy'}
                                </button>
                              </div>
                            ))}
                        </div>
                      )}

                      {/* Notes */}
                      {record.notes && (showNotes || shouldShowRow(record, 'Notes', record.notes)) && (
                        <div className="rec-mini-card">
                          <div className="nested-subtitle">{highlightText('Notes')}</div>
                          {splitBySentence(record.notes)
                            .filter(sentence => showNotes || shouldShowRow(record, 'Notes', sentence))
                            .map((sentence, sentIdx) => (
                              <div key={sentIdx} className="numbered-row" style={{ marginBottom: 8 }}>
                                <div className="row-content">
                                  <span className="content-value">{highlightText(sentence)}</span>
                                </div>
                                <button className={`copy-btn ${copiedSectionId === `${recordId}-notes-${sentIdx}` ? 'copied' : ''}`}
                                  onClick={() => copySection(sentence, `${recordId}-notes-${sentIdx}`)}>
                                  {copiedSectionId === `${recordId}-notes-${sentIdx}` ? 'Copied!' : 'Copy'}
                                </button>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                  );
                })()}

                {/* Recommendations (READ-ONLY - not in ALLOWED_FIELDS) */}
                {record.recommendations && Array.isArray(record.recommendations) && record.recommendations.length > 0 &&
                  shouldShowSection(record, 'Recommendations',
                    ...record.recommendations.map(r => typeof r === 'object' ? `${r.recommendation || ''} ${r.date ? formatDate(r.date) : ''}` : r)
                  ) && (() => {
                  const recTitleMatches = searchTerm && (() => {
                    const searchLower = searchTerm.toLowerCase().trim();
                    const t = 'recommendations';
                    return t.startsWith(searchLower) || searchLower.startsWith(t);
                  })();
                  const showRecs = showAll || recTitleMatches;

                  return (
                  <div className="section">
                    <div className="mini-cards-container">
                      <div className="section-header">
                        <div className="section-header-left">
                          <h4 className="section-title">{highlightText('Recommendations')}</h4>
                        </div>
                      </div>
                      {record.recommendations
                        .filter(rec => showRecs || shouldShowRow(record, typeof rec === 'object' ? rec.recommendation : rec, typeof rec === 'object' && rec.date ? formatDate(rec.date) : ''))
                        .map((rec, rIdx) => (
                          <div key={rIdx} className="rec-mini-card">
                            <div className="numbered-row">
                              <div className="row-content">
                                {typeof rec === 'object' ? (
                                  <>
                                    {rec.date && <div className="rec-date-top">{highlightText(formatDate(rec.date))}</div>}
                                    <span className="content-value">{highlightText(rec.recommendation || 'N/A')}</span>
                                  </>
                                ) : (
                                  <span className="content-value">{highlightText(rec)}</span>
                                )}
                              </div>
                              <button className={`copy-btn ${copiedSectionId === `${recordId}-rec-${rIdx}` ? 'copied' : ''}`}
                                onClick={() => copySection(
                                  typeof rec === 'object'
                                    ? `${rec.date ? formatDate(rec.date) + '\n' : ''}${rec.recommendation}`
                                    : rec,
                                  `${recordId}-rec-${rIdx}`
                                )}>
                                {copiedSectionId === `${recordId}-rec-${rIdx}` ? 'Copied!' : 'Copy'}
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                  );
                })()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ConsultationDetailsDocument;
