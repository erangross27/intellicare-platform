import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import AdministrativeDataDocumentPDFTemplate from '../pdf-templates/AdministrativeDataDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './AdministrativeDataDocument.css';

/**
 * AdministrativeDataDocument - Clean layout following November 2025 standards
 *
 * DESIGN: Field-box layout, blue frames, Comfortaa font, row-level copy buttons
 * Pattern: Based on CardiologyConsultationsDocument template
 */
/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'administrative_dataPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};
const AdministrativeDataDocument = ({ document, data }) => {
  // Accept both 'document' and 'data' props for compatibility
  const templateData = document || data;
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSection, setCopiedSection] = useState(null);

  // Editing state (10 vars + ref)
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

  // Data unwrapping - handle wrapped structure from backend
  // CRITICAL: Get ALL records, not just first one
  let records = [];
  if (Array.isArray(templateData)) {
    // AIDocumentRenderer passed array directly: [{...fields}, {...fields}]
    records = templateData;
  } else {
    // Standard unwrapping for other formats
    const rawData = templateData?.documentData || templateData?.data || templateData;
    const adminData = rawData?.administrative_data;
    if (Array.isArray(adminData)) {
      records = adminData;
    } else if (adminData) {
      records = [adminData];
    } else if (rawData) {
      records = [rawData];
    }
  }

  // Ensure records is an array
  if (!Array.isArray(records)) {
    records = [];
  }

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const idFor = (rec) => {
      const id = rec && rec._id;
      if (!id) return null;
      return (typeof id === 'object' && id.$oid) ? id.$oid : String(id);
    };
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {}, nStatus = {};
    records.forEach((rec, idx) => {
      const recId = idFor(rec);
      const recDrafts = recId ? store[recId] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        // baseField → resolve owning section so the Approve button reappears
        const baseField = fieldPart.includes('.') ? fieldPart.split('.')[0] : fieldPart;
        const sectionId = Object.keys(SECTION_FIELDS).find(sid => SECTION_FIELDS[sid].includes(baseField));
        if (sectionId) nFields[`${sectionId}-${idx}`] = true;
        nSentences[`${baseField}-${idx}-s0`] = 'edited';
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

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Highlight search matches - December 2025 pattern (highlights ALL matches)
  const highlightText = (text) => {
    if (!searchTerm.trim() || !text) return text;
    const textStr = String(text);
    const phrase = searchTerm.trim();
    const escapedPhrase = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedPhrase})`, 'gi');
    const parts = textStr.split(regex);
    const phraseLower = phrase.toLowerCase();

    return parts.map((part, i) =>
      part.toLowerCase() === phraseLower ? <mark key={i}>{part}</mark> : part
    );
  };

  // Split a comma-separated value into items (parenthesis-aware) — for "Label: a, b, c" fields like Plan
  const splitByCommaAware = (text) => {
    if (!text || typeof text !== 'string') return [text || ''];
    const result = []; let current = ''; let depth = 0;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '(') { depth++; current += ch; }
      else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
      // Oxford comma: do NOT split on a comma immediately before "and" (keep "..., and Z" as one trailing item)
      else if (ch === ',' && depth === 0 && !/^\s*and\s/i.test(text.slice(i + 1))) { const t = current.trim(); if (t) result.push(t); current = ''; }
      else { current += ch; }
    }
    const t = current.trim(); if (t) result.push(t);
    return result.length > 0 ? result : [text];
  };

  // Detect an embedded "Label: value" prefix. Requires colon + SPACE so "14:28" / "Dr." are NOT treated as labels.
  const parseLabel = (text) => {
    if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
    const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
    if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
    return { isLabeled: false, label: '', value: text };
  };

  // Parse text into individual items - handles both numbered points and sentences
  const parseTextIntoRows = (text) => {
    if (!text) return [];

    // Check if text has numbered points like "(1)", "(2)", etc.
    const hasNumberedPoints = /\(\d+\)/.test(text);

    if (hasNumberedPoints) {
      // Parse numbered points
      const regex = /\((\d+)\)\s*/g;
      const matches = [];
      let lastIndex = 0;
      let match;

      while ((match = regex.exec(text)) !== null) {
        if (matches.length > 0) {
          matches[matches.length - 1].text = text.substring(lastIndex, match.index).trim();
        }
        matches.push({ text: '' });
        lastIndex = regex.lastIndex;
      }

      if (matches.length > 0) {
        matches[matches.length - 1].text = text.substring(lastIndex).trim();
        // Clean up last item
        const lastItem = matches[matches.length - 1];
        const nextSentence = lastItem.text.indexOf('. ');
        if (nextSentence > 0) {
          lastItem.text = lastItem.text.substring(0, nextSentence).trim();
        }
      }

      return matches;
    } else {
      // Split by sentences - period followed by space and capital letter
      // BUT exclude common abbreviations (St., Dr., Mr., Mrs., Ms., Jr., Sr., etc.)
      const sentences = [];

      // Common abbreviations to ignore
      const abbreviations = /\b(St|Dr|Mr|Mrs|Ms|Jr|Sr|Prof|Inc|Ltd|Co|Corp|Ave|Blvd|Rd|vs|etc|i\.e|e\.g|a\.m|p\.m)\.\s/gi;

      // Replace abbreviations with placeholder to protect them
      let protectedText = text.replace(abbreviations, (match) => {
        return match.replace('.', '___PERIOD___');
      });

      // Now split by ". " (period + space)
      const parts = protectedText.split(/\.\s+/);

      // Restore periods and create sentence objects
      parts.forEach((part, index) => {
        if (part.trim()) {
          // Restore protected periods
          let restoredPart = part.replace(/___PERIOD___/g, '.');
          // Add back the period at the end (except for last item)
          if (index < parts.length - 1) {
            sentences.push({ text: restoredPart.trim() + '.' });
          } else {
            // Last sentence - check if original text ended with period
            if (text.trim().endsWith('.')) {
              sentences.push({ text: restoredPart.trim() + '.' });
            } else {
              sentences.push({ text: restoredPart.trim() });
            }
          }
        }
      });

      return sentences.length > 0 ? sentences : [{ text: text.trim() }];
    }
  };

  // --- SECTION_FIELDS mapping + sectionHasEdits helper ---
  const SECTION_FIELDS = {
    'patient-identifiers': ['mrn', 'accountNumber', 'insurance'],
    'findings': ['findings'],
    'assessment': ['assessment'],
    'plan': ['plan'],
    'recommendations': [],
    'clinical-status': ['disposition', 'conditionAtDischarge', 'dietaryInstructions', 'status'],
    'hospital-stay': ['lengthOfStay', 'admittingDiagnosis'],
    'consultation': ['consultingPhysician', 'consultingSpecialty', 'referringPhysician', 'referringSpecialty', 'reasonForConsult'],
    'results': [],
    'emergency-legal': ['primaryCareProvider', 'emergencyContact', 'codeStatus', 'powerOfAttorney'],
    'notes': ['notes'],
    'signatures': ['category', 'type', 'provider', 'facility', 'facilityName', 'facilityAddress', 'electronicSignature', 'electronicSignatureFull'],
  };

  const sectionHasEdits = (sectionId) => {
    const fields = SECTION_FIELDS[sectionId];
    if (!fields) return false;
    return Object.keys(localEdits).some(editKey => {
      const dashIdx = editKey.lastIndexOf('-');
      const fieldPart = editKey.substring(0, dashIdx);
      const baseField = fieldPart.includes('.') ? fieldPart.split('.')[0] : fieldPart;
      return fields.includes(baseField);
    });
  };

  // --- Editing handlers ---
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

  const persistToLocalStorage = useCallback((recordId, fieldName, newValue) => {
    try {
      const key = 'artifactGridData';
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const gridData = JSON.parse(raw);
      const walk = (node) => {
        if (!node) return false;
        if (Array.isArray(node)) return node.some(walk);
        if (typeof node === 'object') {
          if (node._id === recordId) { node[fieldName] = newValue; return true; }
          return Object.values(node).some(walk);
        }
        return false;
      };
      if (walk(gridData)) localStorage.setItem(key, JSON.stringify(gridData));
    } catch (e) { /* ignore localStorage errors */ }
  }, []);

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApprove commits).
  const handleSaveField = useCallback((record, fieldName, idx, sectionId, arrayIndex, valueOverride, sentenceIdx) => {
    const recId = record && record._id && typeof record._id === 'object' && record._id.$oid ? record._id.$oid : record._id;
    if (!recId) return;
    const saveValue = (valueOverride !== undefined ? valueOverride : editValue.trim());
    const fieldPart = (typeof arrayIndex === 'number') ? `${fieldName}.${arrayIndex}` : fieldName;
    const editKey = `${fieldPart}-${idx}`;
    const sKey = `${fieldName}-${idx}-s${sentenceIdx !== undefined ? sentenceIdx : 0}`;

    setLocalEdits(prev => ({ ...prev, [editKey]: saveValue }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [`${sectionId}-${idx}`]: true }));
    setEditedSentences(prev => ({ ...prev, [sKey]: 'edited' }));
    setStatusOverrides(prev => ({ ...prev, [idx]: 'amended' }));
    // Re-edit after approval → drop the section 'approved' flag so the button goes back to Approve
    setApprovedSections(prev => {
      if (!prev[sectionId]) return prev;
      const next = { ...prev };
      delete next[sectionId];
      return next;
    });

    const store = readDrafts();
    if (!store[recId]) store[recId] = {};
    store[recId][fieldPart] = saveValue;
    writeDrafts(store);

    setEditingField(null);
    setEditValue('');
  }, [editValue]);

  // Approve = COMMIT all staged drafts for this record to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApprove = useCallback(async (record, idx, sectionId) => {
    const recId = record && record._id && typeof record._id === 'object' && record._id.$oid ? record._id.$oid : record._id;
    if (!recId) return;
    setApproving(true);
    try {
      const suffix = `-${idx}`;
      const toCommit = Object.keys(localEdits).filter(k => pendingEdits[k] && k.endsWith(suffix));
      // Persist each staged field to the DB now (field, or field+arrayIndex for array elements)
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // "field" or "field.arrayIndex"
        const lastDot = fieldPart.lastIndexOf('.');
        const trailing = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const isArrayElem = lastDot !== -1 && /^\d+$/.test(trailing);
        const payload = { field: isArrayElem ? fieldPart.slice(0, lastDot) : fieldPart, value: localEdits[editKey] };
        if (isArrayElem) payload.arrayIndex = parseInt(trailing, 10);
        await secureApiClient.put(`/api/edit/administrative_data/${recId}/edit`, payload);
      }
      // Flag the record approved (audit trail)
      await secureApiClient.put(`/api/edit/administrative_data/${recId}/approve`);

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => {
        const next = { ...prev };
        toCommit.forEach(k => delete next[k]);
        return next;
      });
      // Drop this record's drafts from localStorage (now committed)
      const store = readDrafts();
      if (store[recId]) { delete store[recId]; writeDrafts(store); }

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
      console.error('Approve error:', err);
    } finally {
      setApproving(false);
    }
  }, [localEdits, pendingEdits]);

  // --- getFieldValue helper ---
  const getFieldValue = (record, fieldName, idx) => {
    const editKey = `${fieldName}-${idx}`;
    if (localEdits[editKey] !== undefined) return localEdits[editKey];
    const val = record[fieldName];
    if (Array.isArray(val)) return val.join(', ');
    return val;
  };

  // Search filtering with document title detection - supports numbered records
  const filteredRecords = useMemo(() => {
    // Add _documentTitle and _recordNumber to each record
    const recordsWithTitle = records.map((record, idx) => ({
      ...record,
      _documentTitle: `Administrative Data ${idx + 1}`,
      _recordNumber: String(idx + 1)
    }));

    if (!searchTerm.trim()) return recordsWithTitle;

    const searchLower = searchTerm.toLowerCase().trim();
    const searchWords = searchLower.split(/\s+/);

    return recordsWithTitle.map((record) => {
      const recordNumber = record._recordNumber;

      // Build searchable text for this record
      const resultsText = typeof record.results === 'object' && record.results !== null
        ? Object.entries(record.results).map(([key, value]) => `${key} ${value || ''}`).join(' ')
        : (record.results || '');

      const recommendationsText = Array.isArray(record.recommendations)
        ? record.recommendations.map(r => `${r.recommendation || r} ${r.date || ''}`).join(' ')
        : (record.recommendations || '');

      const searchableText = [
        // Record title with variations
        record._documentTitle,
        `administrative data ${recordNumber}`,
        `administrative ${recordNumber}`,
        recordNumber,
        // Section keywords
        'administrative data', 'patient identifiers', 'emergency contacts & legal',
        'hospital stay', 'clinical status', 'consultation & referral',
        'findings', 'assessment', 'plan', 'notes', 'recommendations', 'results',
        'signatures & documentation',
        // Field labels (3 case variations)
        'PATIENT NAME', 'patient name', 'Patient Name',
        'MRN', 'mrn',
        'ACCOUNT NUMBER', 'account number', 'Account Number',
        'INSURANCE', 'insurance', 'Insurance',
        'DISPOSITION', 'disposition', 'Disposition',
        'CONDITION AT DISCHARGE', 'condition at discharge',
        'DIETARY INSTRUCTIONS', 'dietary instructions',
        'STATUS', 'status', 'Status',
        'ADMISSION DATE', 'admission date',
        'DISCHARGE DATE', 'discharge date',
        'LENGTH OF STAY', 'length of stay',
        'ADMITTING DIAGNOSIS', 'admitting diagnosis',
        'CONSULTING PHYSICIAN', 'consulting physician',
        'CONSULTING SPECIALTY', 'consulting specialty',
        'REFERRING PHYSICIAN', 'referring physician',
        'REFERRING SPECIALTY', 'referring specialty',
        'CONSULT DATE', 'consult date',
        'REASON FOR CONSULT', 'reason for consult',
        'PRIMARY CARE PROVIDER', 'primary care provider',
        'EMERGENCY CONTACT', 'emergency contact',
        'CODE STATUS', 'code status',
        'ADVANCED DIRECTIVES', 'advanced directives',
        'POWER OF ATTORNEY', 'power of attorney',
        'CATEGORY', 'category', 'Category',
        'TYPE', 'type', 'Type',
        'PROVIDER', 'provider', 'Provider',
        'DATE', 'date', 'Date',
        'FACILITY', 'facility', 'Facility',
        'FACILITY NAME', 'facility name',
        'FACILITY ADDRESS', 'facility address',
        'ELECTRONIC SIGNATURE', 'electronic signature',
        'ELECTRONIC SIGNATURE FULL', 'electronic signature full',
        // Field values
        record.patientName,
        record.mrn,
        record.accountNumber,
        record.insurance,
        record.primaryCareProvider,
        record.emergencyContact,
        record.codeStatus,
        record.advancedDirectives ? 'yes' : 'no',
        record.powerOfAttorney,
        formatDate(record.admissionDate),
        formatDate(record.dischargeDate),
        record.lengthOfStay,
        record.admittingDiagnosis,
        record.disposition,
        record.conditionAtDischarge,
        record.dietaryInstructions,
        record.status,
        record.consultingPhysician,
        record.consultingSpecialty,
        record.referringPhysician,
        record.referringSpecialty,
        formatDate(record.consultDate),
        record.reasonForConsult,
        record.findings,
        record.assessment,
        record.plan,
        record.notes,
        recommendationsText,
        resultsText,
        record.category,
        record.type,
        record.provider,
        formatDate(record.date),
        record.facility,
        record.facilityName,
        record.facilityAddress,
        record.electronicSignature,
        record.electronicSignatureFull
      ].filter(Boolean).join(' ').toLowerCase();

      // Check if search matches this record
      const matchesRecord = searchWords.every(word => searchableText.includes(word));

      // Check for document title search (show all sections)
      const docTitleLower = record._documentTitle?.toLowerCase() || '';
      const startsWithDocTitle = searchLower.startsWith(docTitleLower) ||
        searchLower === `administrative data ${recordNumber}` ||
        searchLower === `administrative ${recordNumber}` ||
        searchLower === recordNumber;

      return {
        ...record,
        _showAllSections: startsWithDocTitle,
        _matchesSearch: matchesRecord
      };
    }).filter(record => record._matchesSearch);
  }, [records, searchTerm]);

  // Section-level filtering - takes record to check _showAllSections
  const shouldShowSection = (record, sectionTitle, ...sectionFields) => {
    if (!searchTerm.trim()) return true;
    if (record._showAllSections) return true;

    const searchWords = searchTerm.toLowerCase().trim().split(/\s+/);
    const titleLower = sectionTitle.toLowerCase();
    const contentText = sectionFields.filter(Boolean).join(' ').toLowerCase();
    const combinedText = `${titleLower} ${contentText}`;

    return searchWords.every(word => combinedText.includes(word));
  };

  // Row-level filtering - includes label in search, checks _showAllSections
  const shouldShowRow = (record, ...rowContent) => {
    if (!searchTerm.trim()) return true;
    if (record._showAllSections) return true;

    const searchWords = searchTerm.toLowerCase().trim().split(/\s+/);

    // Row-level filtering - Include BOTH label and value in row text
    const rowText = rowContent
      .filter(Boolean)
      .map(item => String(item))
      .join(' ')
      .toLowerCase();

    return searchWords.every(word => rowText.includes(word));
  };

  // Copy to clipboard - use navigator.clipboard API (modern) with fallback
  const copyField = async (text, fieldId) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for older browsers - use window.document to avoid prop shadowing
        const textarea = window.document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        window.document.body.appendChild(textarea);
        textarea.select();
        window.document.execCommand('copy');
        window.document.body.removeChild(textarea);
      }
      setCopiedSection(fieldId);
      setTimeout(() => setCopiedSection(null), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  // Helper to generate text for a single record
  const generateRecordText = (record, idx) => {
    let text = `=== ${record._documentTitle || `ADMINISTRATIVE DATA ${idx + 1}`} ===\n\n`;

    // Stacked field (mirrors the JSX): label on its own line, value below — NO side-by-side "label: value".
    // Embedded "Label: value" → field label line, embedded label line, value line.
    const fld = (label, value) => {
      if (value === null || value === undefined || value === '') return '';
      const p = parseLabel(String(value));
      return p.isLabeled ? `${label}\n${p.label}\n${p.value}\n` : `${label}\n${value}\n`;
    };

    // 1. Patient Identifiers
    if (record.patientName || record.mrn || record.accountNumber || record.insurance) {
      text += '--- Patient Identifiers ---\n';
      text += fld('Patient Name', record.patientName);
      text += fld('MRN', record.mrn);
      text += fld('Account Number', record.accountNumber);
      text += fld('Insurance', record.insurance);
      text += '\n';
    }

    // 2. Findings
    if (record.findings) {
      text += '--- Findings ---\n';
      const parseText = (txt) => {
        if (!txt) return [];
        const numberedPattern = /(?:^|\s)\(?\d+[.)]\s+/g;
        const hasNumbering = numberedPattern.test(txt);
        if (hasNumbering) {
          return txt.split(numberedPattern).map(p => p.trim()).filter(p => p.length > 0);
        }
        return txt.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.\s+/).map(s => s.trim()).filter(s => s.length > 0);
      };
      const findingsItems = parseText(record.findings);
      if (findingsItems.length > 1) {
        findingsItems.forEach((item, i) => {
          text += `${i + 1}. ${item}\n`;
        });
      } else {
        text += `${record.findings}\n`;
      }
      text += '\n';
    }

    // 3. Assessment
    if (record.assessment) {
      text += '--- Assessment ---\n';
      const parseAssessmentText = (txt) => {
        if (!txt) return [];
        const numberedPattern = /(?:^|\s)\(?\d+[.)]\s+/g;
        const hasNumbering = numberedPattern.test(txt);
        if (hasNumbering) {
          return txt.split(numberedPattern).map(p => p.trim()).filter(p => p.length > 0);
        }
        return txt.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.\s+/).map(s => s.trim()).filter(s => s.length > 0);
      };
      const assessmentItems = parseAssessmentText(record.assessment);
      if (assessmentItems.length > 1) {
        assessmentItems.forEach((item, i) => {
          text += `${i + 1}. ${item}\n`;
        });
      } else {
        text += `${record.assessment}\n`;
      }
      text += '\n';
    }

    // 4. Plan
    if (record.plan) {
      text += '--- Plan ---\n';
      const parseText = (txt) => {
        if (!txt) return [];
        const numberedPattern = /(?:^|\s)\(?\d+[.)]\s+/g;
        const hasNumbering = numberedPattern.test(txt);
        if (hasNumbering) {
          return txt.split(numberedPattern).map(p => p.trim()).filter(p => p.length > 0);
        }
        return txt.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.\s+/).map(s => s.trim()).filter(s => s.length > 0);
      };
      const planItems = parseText(record.plan);
      if (planItems.length > 0) {
        let n = 1;
        planItems.forEach((item) => {
          const ci = item.indexOf(':');
          if (ci > 0) {
            const lbl = item.substring(0, ci).trim();
            const val = item.substring(ci + 1).trim();
            const parts = splitByCommaAware(val);
            text += `${lbl}:\n`;
            if (parts.length >= 2) parts.forEach(p => { text += `  ${n++}. ${p}\n`; });
            else text += `  ${n++}. ${val}\n`;
          } else {
            const parts = splitByCommaAware(item);
            if (parts.length >= 2) parts.forEach(p => { text += `${n++}. ${p}\n`; });
            else text += `${n++}. ${item}\n`;
          }
        });
      } else {
        text += `${record.plan}\n`;
      }
      text += '\n';
    }

    // 5. Recommendations (skip if empty array)
    if (record.recommendations && (Array.isArray(record.recommendations) ? record.recommendations.length > 0 : true)) {
      text += '--- Recommendations ---\n';
      if (Array.isArray(record.recommendations)) {
        record.recommendations.forEach((rec, recIdx) => {
          text += `${recIdx + 1}. ${rec.recommendation || rec}`;
          if (rec.date) text += ` (${formatDate(rec.date)})`;
          text += '\n';
        });
      } else {
        text += `${record.recommendations}\n`;
      }
      text += '\n';
    }

    // 6. Clinical Status
    if (record.disposition || record.conditionAtDischarge || record.dietaryInstructions || record.status) {
      text += '--- Clinical Status ---\n';
      text += fld('Disposition', record.disposition);
      text += fld('Condition at Discharge', record.conditionAtDischarge);
      text += fld('Dietary Instructions', record.dietaryInstructions);
      text += fld('Status', record.status);
      text += '\n';
    }

    // 7. Hospital Stay
    if (record.admissionDate || record.dischargeDate || record.lengthOfStay || record.admittingDiagnosis) {
      text += '--- Hospital Stay ---\n';
      text += fld('Admission Date', record.admissionDate && formatDate(record.admissionDate));
      text += fld('Discharge Date', record.dischargeDate && formatDate(record.dischargeDate));
      text += fld('Length of Stay', record.lengthOfStay && `${record.lengthOfStay} days`);
      text += fld('Admitting Diagnosis', record.admittingDiagnosis);
      text += '\n';
    }

    // 8. Consultation & Referral
    if (record.consultingPhysician || record.referringPhysician || record.consultDate || record.reasonForConsult) {
      text += '--- Consultation & Referral ---\n';
      text += fld('Consulting Physician', record.consultingPhysician);
      text += fld('Consulting Specialty', record.consultingSpecialty);
      text += fld('Referring Physician', record.referringPhysician);
      text += fld('Referring Specialty', record.referringSpecialty);
      text += fld('Consult Date', record.consultDate && formatDate(record.consultDate));
      text += fld('Reason for Consult', record.reasonForConsult);
      text += '\n';
    }

    // 9. Results - only include if has actual data
    if (record.results) {
      let hasResultsData = false;
      if (typeof record.results === 'object' && record.results !== null) {
        hasResultsData = Object.entries(record.results).some(([key, value]) => value !== null && value !== undefined);
      } else if (typeof record.results === 'string' && record.results.trim()) {
        hasResultsData = true;
      } else if (Array.isArray(record.results) && record.results.length > 0) {
        hasResultsData = true;
      }

      if (hasResultsData) {
        text += '--- Results ---\n';
        if (typeof record.results === 'object' && record.results !== null) {
          Object.entries(record.results).forEach(([key, value]) => {
            if (value !== null && value !== undefined) {
              const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
              text += fld(label, value);
            }
          });
        } else {
          text += `${record.results}\n`;
        }
        text += '\n';
      }
    }

    // 10. Emergency Contacts & Legal
    if (record.primaryCareProvider || record.emergencyContact || record.codeStatus || record.advancedDirectives !== undefined || record.powerOfAttorney) {
      text += '--- Emergency Contacts & Legal ---\n';
      text += fld('Primary Care Provider', record.primaryCareProvider);
      text += fld('Emergency Contact', record.emergencyContact);
      text += fld('Code Status', record.codeStatus);
      if (record.advancedDirectives !== undefined) {
        text += fld('Advanced Directives', record.advancedDirectives ? 'Yes' : 'No');
      }
      text += fld('Power of Attorney', record.powerOfAttorney);
      text += '\n';
    }

    // 11. Notes
    if (record.notes) {
      text += '--- Notes ---\n';
      const parseText = (txt) => {
        if (!txt) return [];
        const numberedPattern = /(?:^|\s)\(?\d+[.)]\s+/g;
        const hasNumbering = numberedPattern.test(txt);
        if (hasNumbering) {
          return txt.split(numberedPattern).map(p => p.trim()).filter(p => p.length > 0);
        }
        return txt.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.\s+/).map(s => s.trim()).filter(s => s.length > 0);
      };
      const notesItems = parseText(record.notes);
      if (notesItems.length > 1) {
        notesItems.forEach((item, i) => {
          text += `${i + 1}. ${item}\n`;
        });
      } else {
        text += `${record.notes}\n`;
      }
      text += '\n';
    }

    // 12. Signatures & Documentation
    if (record.category || record.type || record.provider || record.date || record.facility || record.facilityName || record.facilityAddress || record.electronicSignature || record.electronicSignatureFull) {
      text += '--- Signatures & Documentation ---\n';
      text += fld('Category', record.category);
      text += fld('Type', record.type);
      text += fld('Provider', record.provider);
      text += fld('Date', record.date && formatDate(record.date));
      text += fld('Facility', record.facility);
      text += fld('Facility Name', record.facilityName);
      text += fld('Facility Address', record.facilityAddress);
      text += fld('Electronic Signature', record.electronicSignature);
      text += fld('Electronic Signature Full', record.electronicSignatureFull);
      text += '\n';
    }

    return text;
  };

  // --- pdfData memo ---
  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return filteredRecords;
    return filteredRecords.map((rec, idx) => {
      const merged = { ...rec };
      for (const [editKey, editVal] of Object.entries(localEdits)) {
        if (pendingEdits[editKey]) continue; // pending drafts stay OUT of the PDF until approved
        const dashIdx = editKey.lastIndexOf('-');
        const fieldName = editKey.substring(0, dashIdx);
        const recIdx = parseInt(editKey.substring(dashIdx + 1), 10);
        if (recIdx === idx) {
          if (fieldName.includes('.')) {
            const [arrField, arrIdxStr] = fieldName.split('.');
            const arrIdx = parseInt(arrIdxStr, 10);
            if (Array.isArray(merged[arrField])) {
              merged[arrField] = [...merged[arrField]];
              merged[arrField][arrIdx] = editVal;
            }
          } else {
            merged[fieldName] = editVal;
          }
        }
      }
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  // --- renderEditableField helper ---
  const renderEditableField = (record, idx, fieldName, label, sectionId) => {
    const canEdit = !!record._id;
    const value = getFieldValue(record, fieldName, idx);
    if (!value && value !== 0) return null;

    // Embedded "Label: value": keep the FIELD label as the title, show the embedded label as a
    // nested sub-label, and the value as ONE row (NO comma split).
    const parsed = parseLabel(String(value));
    const displayValue = parsed.isLabeled ? parsed.value : String(value);
    const reconstruct = (v) => (parsed.isLabeled ? `${parsed.label}: ${v.trim()}` : v.trim());

    const editKey = `${fieldName}-${idx}-s0`;
    const isEditing = editingField === editKey;
    // Yellow on this row only while a draft is pending; handleApprove clears editedSentences → clears on approve.
    const rowModified = !!editedSentences[editKey];

    const editIndicator = (
      <span className="edit-indicator" title="Click to edit">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <path d="M9.5 1.5l1 1-7 7H2.5v-1z"/>
        </svg>
      </span>
    );

    if (isEditing) {
      return (
        <div className="rec-mini-card">
          <div className="nested-subtitle">{highlightText(label)}</div>
          {parsed.isLabeled && <div className="nested-subtitle sub-label">{highlightText(parsed.label)}</div>}
          <div className="numbered-row edit-row">
            <div className="edit-field-container">
              <textarea
                ref={textareaRef}
                className="edit-textarea"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    handleSaveField(record, fieldName, idx, sectionId, undefined, reconstruct(editValue));
                  }
                  if (e.key === 'Escape') handleCancelEdit();
                }}
                rows={2}
              />
              <div className="edit-actions">
                <button className="cancel-btn" onClick={handleCancelEdit}>Cancel</button>
                <button className="save-btn" onClick={() => handleSaveField(record, fieldName, idx, sectionId, undefined, reconstruct(editValue))} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    const valueRow = (
      <>
        <div className={`numbered-row${rowModified ? ' modified' : ''}`}>
          <div
            className={`row-content${canEdit ? ' editable' : ''}`}
            onClick={() => canEdit && handleStartEdit(fieldName, idx, displayValue)}
          >
            <span className="content-value">{highlightText(displayValue)}</span>
            {canEdit && editIndicator}
          </div>
          <button
            className={`copy-btn ${copiedSection === `${fieldName}-${idx}` ? 'copied' : ''}`}
            onClick={() => copyField(parsed.isLabeled ? `${parsed.label}: ${displayValue}` : `${label}: ${displayValue}`, `${fieldName}-${idx}`)}
          >
            {copiedSection === `${fieldName}-${idx}` ? 'Copied' : 'Copy'}
          </button>
        </div>
        {rowModified && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </>
    );

    return (
      <div className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {parsed.isLabeled ? (
          <div className="nested-mini-card">
            <div className="nested-subtitle sub-label">{highlightText(parsed.label)}</div>
            {valueRow}
          </div>
        ) : valueRow}
      </div>
    );
  };

  // --- renderApproveButton helper ---
  const renderApproveButton = (record, idx, sectionId) => {
    if (!sectionHasEdits(sectionId) && !approvedSections[sectionId]) return null;
    return (
      <button
        className={`approve-btn${approvedSections[sectionId] ? ' approved' : ''}`}
        onClick={() => handleApprove(record, idx, sectionId)}
        disabled={approving}
      >
        {approving ? 'Approving...' : approvedSections[sectionId] ? 'Approved' : 'Pending Approve'}
      </button>
    );
  };

  // --- renderEditableTextSection helper for text fields (findings, assessment, plan, notes) ---
  const renderEditableTextSection = (record, idx, fieldName, sectionId) => {
    const canEdit = !!record._id;
    const currentValue = getFieldValue(record, fieldName, idx) || record[fieldName];

    // Sentence-aware splitter (protects Mr./Dr./etc. titles + numbered lists)
    const parseText = (txt) => {
      if (!txt) return [];
      const numberedPattern = /(?:^|\s)\(?\d+[.)]\s+/g;
      const hasNumbering = numberedPattern.test(txt);
      if (hasNumbering) {
        return txt.split(numberedPattern).map(p => p.trim()).filter(p => p.length > 0);
      }
      return txt.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.\s+/).map(s => s.trim()).filter(s => s.length > 0);
    };

    // Rejoin sentence items into the full field string (keep a single trailing period if the source had one).
    const joinItems = (arr) => {
      const body = arr.map(s => String(s).replace(/[.\s]+$/, '')).join('. ');
      return /\.\s*$/.test(String(currentValue || '').trim()) ? body + '.' : body;
    };

    // Reconstruct the full field value after editing ONE displayed row
    // (label:comma item, plan comma item, or a whole sentence) — so Save stages the complete field.
    const rebuildValue = (itemIdx, kind, subIdx, newText) => {
      const arr = parseText(currentValue);
      if (itemIdx < 0 || itemIdx >= arr.length) return currentValue;
      const nt = newText.trim();
      const item = arr[itemIdx];
      if (kind === 'comma') {
        const ci = item.indexOf(':');
        const lbl = ci > 0 ? item.substring(0, ci).trim() : '';
        const val = ci > 0 ? item.substring(ci + 1).trim() : item;
        const parts = splitByCommaAware(val);
        if (parts.length >= 2) { parts[subIdx] = nt; arr[itemIdx] = lbl ? `${lbl}: ${parts.join(', ')}` : parts.join(', '); }
        else { arr[itemIdx] = lbl ? `${lbl}: ${nt}` : nt; }
      } else if (kind === 'plain-comma') {
        const parts = splitByCommaAware(item);
        if (parts.length >= 2) { parts[subIdx] = nt; arr[itemIdx] = parts.join(', '); }
        else { arr[itemIdx] = nt; }
      } else {
        arr[itemIdx] = nt;
      }
      return joinItems(arr);
    };

    // Begin editing a single row: the textarea shows ONLY that row's text.
    const startRowEdit = (rowKey, text) => {
      setEditingField(rowKey);
      setEditValue(text || '');
      setTimeout(() => textareaRef.current?.focus(), 50);
    };

    const sectionTitleMatches = !searchTerm.trim() || record._showAllSections ||
      shouldShowRow(record, fieldName.charAt(0).toUpperCase() + fieldName.slice(1), fieldName, fieldName.toUpperCase());

    const items = parseText(currentValue);
    if (items.length === 0) return null;

    const editIndicator = (
      <span className="edit-indicator" title="Click to edit">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <path d="M9.5 1.5l1 1-7 7H2.5v-1z"/>
        </svg>
      </span>
    );

    // Render ONE row — inline editable: clicking shows a textarea with just this row's text;
    // Save reconstructs the full field via rebuildValue(itemIdx, kind, subIdx, ...).
    const renderRow = (rowKey, text, kind, itemIdx, subIdx, marginBottom) => {
      const rowModified = !!editedSentences[rowKey];
      if (editingField === rowKey) {
        // Save the row: reconstruct the full field, stage the draft, and mark ONLY this row as edited.
        const doSave = () => {
          handleSaveField(record, fieldName, idx, sectionId, undefined, rebuildValue(itemIdx, kind, subIdx, editValue), itemIdx);
          setEditedSentences(prev => ({ ...prev, [rowKey]: 'edited' }));
        };
        return (
          <div key={rowKey} className="numbered-row edit-row" style={{ marginBottom }}>
            <div className="edit-field-container">
              <textarea
                ref={textareaRef}
                className="edit-textarea"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) doSave();
                  if (e.key === 'Escape') handleCancelEdit();
                }}
                rows={3}
              />
              <div className="edit-actions">
                <button className="cancel-btn" onClick={handleCancelEdit}>Cancel</button>
                <button className="save-btn" disabled={saving} onClick={doSave}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        );
      }
      return (
        <React.Fragment key={rowKey}>
          <div className={`numbered-row${rowModified ? ' modified' : ''}`} style={{ marginBottom }}>
            <div
              className={`row-content${canEdit ? ' editable' : ''}`}
              onClick={() => canEdit && startRowEdit(rowKey, text)}
            >
              <span className="content-value">{highlightText(text)}</span>
              {canEdit && editIndicator}
            </div>
            <button
              className={`copy-btn ${copiedSection === rowKey ? 'copied' : ''}`}
              onClick={() => copyField(text, rowKey)}
            >
              {copiedSection === rowKey ? 'Copied' : 'Copy'}
            </button>
          </div>
          {rowModified && <div className="modified-badge">edited - click Pending Approve to save</div>}
        </React.Fragment>
      );
    };

    return (
      <>
        {items.map((item, itemIdx) => {
          const colonIndex = item.indexOf(':');
          const isLabelValue = colonIndex > 0;
          const label = isLabelValue ? item.substring(0, colonIndex).trim() : '';
          const value = isLabelValue ? item.substring(colonIndex + 1).trim() : item;

          const itemMatches = sectionTitleMatches || shouldShowRow(record, label, value, item);
          if (!itemMatches) return null;

          if (isLabelValue) {
            const commaItems = splitByCommaAware(value);
            const rows = commaItems.length >= 2 ? commaItems : [value];
            return (
              <div key={itemIdx} className="rec-mini-card" style={{ marginBottom: itemIdx < items.length - 1 ? '8px' : '0' }}>
                <div className="nested-subtitle">{highlightText(label)}</div>
                {rows.map((ci, ciIdx) => renderRow(
                  `${fieldName}-${idx}-i${itemIdx}-c${ciIdx}`, ci, 'comma', itemIdx, ciIdx,
                  ciIdx < rows.length - 1 ? '8px' : '0'
                ))}
              </div>
            );
          }

          // Plan's non-labeled rows (e.g. "Referrals to A, B, ..., and Z") split by comma (Oxford-aware); other fields stay one row.
          const plainParts = fieldName === 'plan' ? splitByCommaAware(item) : null;
          const isPlainComma = !!(plainParts && plainParts.length >= 2);
          const plainRows = isPlainComma ? plainParts : [item];
          return plainRows.map((pr, prIdx) => renderRow(
            `${fieldName}-${idx}-i${itemIdx}-p${prIdx}`, pr, isPlainComma ? 'plain-comma' : 'whole', itemIdx, prIdx,
            (itemIdx < items.length - 1 || prIdx < plainRows.length - 1) ? '8px' : '0'
          ));
        })}
      </>
    );
  };

  const copyAll = () => {
    const text = pdfData.map((record, idx) => generateRecordText(record, idx)).join('\n\n');
    copyField(text, 'all');
  };


  // Empty state - no records at all
  if (records.length === 0) {
    return (
      <div className="administrative-data-document">
        <div className="empty-state">
          <div className="empty-icon">{'\u{1F4CB}'}</div>
          <p className="empty-text">No administrative data available</p>
        </div>
      </div>
    );
  }

  // No results from search
  if (filteredRecords.length === 0) {
    return (
      <div className="administrative-data-document">
        <div className="document-header">
          <h2 className="document-title">Administrative Data</h2>
          <div className="header-actions">
            <button
              className={`action-btn ${copiedSection === 'all' ? 'copied' : ''}`}
              onClick={copyAll}
            >
              {copiedSection === 'all' ? 'Copied!' : 'Copy All'}
            </button>
            <PDFDownloadLink
              document={<AdministrativeDataDocumentPDFTemplate documents={pdfData} />}
              fileName="administrative-data.pdf"
            >
              {({ loading }) => (
                <button className="action-btn">{loading ? 'Preparing...' : 'Export PDF'}</button>
              )}
            </PDFDownloadLink>
          </div>
        </div>

        <SearchBar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          totalCount={records.length}
          filteredCount={0}
        />

        <div className="no-results">
          <p>No results found for "{searchTerm}"</p>
        </div>
      </div>
    );
  }

  return (
    <div className="administrative-data-document">
      <div className="document-header">
        <h2 className="document-title">Administrative Data</h2>
        <div className="header-actions">
          <button
            className={`action-btn ${copiedSection === 'all' ? 'copied' : ''}`}
            onClick={copyAll}
          >
            {copiedSection === 'all' ? 'Copied!' : 'Copy All'}
          </button>
          <PDFDownloadLink
            document={<AdministrativeDataDocumentPDFTemplate documents={pdfData} />}
            fileName="administrative-data.pdf"
          >
            {({ loading }) => (
              <button className="action-btn">{loading ? 'Preparing...' : 'Export PDF'}</button>
            )}
          </PDFDownloadLink>
        </div>
      </div>

      <SearchBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        totalCount={records.length}
        filteredCount={filteredRecords.length}
      />

      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={record._id || idx} className="record-card">
            {/* Record Header with Title */}
            <div className="record-header">
              <h3 className="record-title">{highlightText(record._documentTitle)}</h3>
              {record.date && (
                <span className="date-badge">{highlightText(formatDate(record.date))}</span>
              )}
            </div>

            <div className="administrative-sections">
        {/* 1. Patient Identifiers - Who is this? */}
        {shouldShowSection(record, 'Patient Identifiers', 'patient name', 'PATIENT NAME', record.patientName, 'mrn', 'MRN', record.mrn, 'account number', 'ACCOUNT NUMBER', record.accountNumber, 'insurance', 'INSURANCE', record.insurance) &&
         (record.patientName || record.mrn || record.accountNumber || record.insurance) && (() => {
          // Section title match - if searching by section name, show all rows
          const sectionTitleMatches = searchTerm && (
            shouldShowRow(record, 'Patient Identifiers') ||
            shouldShowRow(record, 'patient identifiers')
          );

          return (
            <div className="section">
              <div className="mini-cards-container">
                <div className="section-header">
                  <h3 className="section-title">{highlightText('Patient Identifiers')}</h3>
                  <div className="header-right-actions">
                    <button
                      className={`copy-btn ${copiedSection === 'patientIdentifiers-section' ? 'copied' : ''}`}
                      onClick={() => {
                        const text = [
                          record.patientName ? `Patient Name: ${record.patientName}` : '',
                          record.mrn ? `MRN: ${record.mrn}` : '',
                          record.accountNumber ? `Account Number: ${record.accountNumber}` : '',
                          record.insurance ? `Insurance: ${record.insurance}` : ''
                        ].filter(Boolean).join('\n');
                        copyField(text, 'patientIdentifiers-section');
                      }}
                    >
                      {copiedSection === 'patientIdentifiers-section' ? 'Copied' : 'Copy Section'}
                    </button>
                    {renderApproveButton(record, idx, 'patient-identifiers')}
                  </div>
                </div>
                {record.patientName && (sectionTitleMatches || shouldShowRow(record, 'PATIENT NAME', 'patient name', 'Patient Name', record.patientName)) && (
                  <div className="rec-mini-card">
                    <div className="nested-subtitle">{highlightText('Patient Name')}</div>
                    <div className="numbered-row">
                      <div className="row-content">
                        <span className="content-value">{highlightText(record.patientName)}</span>
                      </div>
                      <button
                        className={`copy-btn ${copiedSection === 'patientName' ? 'copied' : ''}`}
                        onClick={() => copyField(`Patient Name: ${record.patientName}`, 'patientName')}
                      >
                        {copiedSection === 'patientName' ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>
                )}
                {(sectionTitleMatches || shouldShowRow(record, 'MRN', 'mrn', record.mrn)) && renderEditableField(record, idx, 'mrn', 'MRN', 'patient-identifiers')}
                {(sectionTitleMatches || shouldShowRow(record, 'ACCOUNT NUMBER', 'account number', 'Account Number', record.accountNumber)) && renderEditableField(record, idx, 'accountNumber', 'Account Number', 'patient-identifiers')}
                {(sectionTitleMatches || shouldShowRow(record, 'INSURANCE', 'insurance', 'Insurance', record.insurance)) && renderEditableField(record, idx, 'insurance', 'Insurance', 'patient-identifiers')}
              </div>
            </div>
          );
        })()}

        {/* 2. Findings - What did we observe? */}
        {shouldShowSection(record, 'Findings', 'findings', 'FINDINGS', record.findings) && record.findings && (
          <div className="section">
            <div className="mini-cards-container">
              <div className="section-header">
                <h3 className="section-title">{highlightText('Findings')}</h3>
                <div className="header-right-actions">
                  <button
                    className={`copy-btn ${copiedSection === 'findings-section' ? 'copied' : ''}`}
                    onClick={() => {
                      const parseText = (txt) => {
                        if (!txt) return [];
                        const numberedPattern = /(?:^|\s)\(?\d+[.)]\s+/g;
                        const hasNumbering = numberedPattern.test(txt);
                        if (hasNumbering) {
                          return txt.split(numberedPattern).map(p => p.trim()).filter(p => p.length > 0);
                        }
                        return txt.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.\s+/).map(s => s.trim()).filter(s => s.length > 0);
                      };
                      const findingsValue = getFieldValue(record, 'findings', idx) || record.findings;
                      const items = parseText(findingsValue);
                      const textToCopy = items.length > 0
                        ? items.map((item, i) => `${i + 1}. ${item}`).join('\n')
                        : findingsValue;
                      copyField(textToCopy, 'findings-section');
                    }}
                  >
                    {copiedSection === 'findings-section' ? 'Copied' : 'Copy Section'}
                  </button>
                  {renderApproveButton(record, idx, 'findings')}
                </div>
              </div>
              {renderEditableTextSection(record, idx, 'findings', 'findings')}
            </div>
          </div>
        )}

        {/* 3. Assessment - What's our interpretation? */}
        {shouldShowSection(record, 'Assessment', 'assessment', 'ASSESSMENT', record.assessment) && record.assessment && (
          <div className="section">
            <div className="mini-cards-container">
              <div className="section-header">
                <h3 className="section-title">{highlightText('Assessment')}</h3>
                <div className="header-right-actions">
                  <button
                    className={`copy-btn ${copiedSection === 'assessment-section' ? 'copied' : ''}`}
                    onClick={() => {
                      const parseAssessmentText = (text) => {
                        if (!text) return [];
                        const numberedPattern = /(?:^|\s)\(?\d+[.)]\s+/g;
                        const hasNumbering = numberedPattern.test(text);
                        if (hasNumbering) {
                          const parts = text.split(numberedPattern).map(p => p.trim()).filter(p => p.length > 0);
                          return parts;
                        }
                        return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.\s+/).map(s => s.trim()).filter(s => s.length > 0);
                      };
                      const assessmentValue = getFieldValue(record, 'assessment', idx) || record.assessment;
                      const items = parseAssessmentText(assessmentValue);
                      const textToCopy = items.length > 0
                        ? items.map((item, i) => `${i + 1}. ${item}`).join('\n')
                        : assessmentValue;
                      copyField(textToCopy, 'assessment-section');
                    }}
                  >
                    {copiedSection === 'assessment-section' ? 'Copied' : 'Copy Section'}
                  </button>
                  {renderApproveButton(record, idx, 'assessment')}
                </div>
              </div>
              {renderEditableTextSection(record, idx, 'assessment', 'assessment')}
            </div>
          </div>
        )}

        {/* 4. Plan - What are we doing? */}
        {shouldShowSection(record, 'Plan', 'plan', 'PLAN', record.plan) && record.plan && (
          <div className="section">
            <div className="mini-cards-container">
              <div className="section-header">
                <h3 className="section-title">{highlightText('Plan')}</h3>
                <div className="header-right-actions">
                  <button
                    className={`copy-btn ${copiedSection === 'plan-section' ? 'copied' : ''}`}
                    onClick={() => {
                      const parseText = (txt) => {
                        if (!txt) return [];
                        const numberedPattern = /(?:^|\s)\(?\d+[.)]\s+/g;
                        const hasNumbering = numberedPattern.test(txt);
                        if (hasNumbering) {
                          return txt.split(numberedPattern).map(p => p.trim()).filter(p => p.length > 0);
                        }
                        return txt.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.\s+/).map(s => s.trim()).filter(s => s.length > 0);
                      };
                      const planValue = getFieldValue(record, 'plan', idx) || record.plan;
                      const items = parseText(planValue);
                      const lines = []; let n = 1;
                      items.forEach((item) => {
                        const ci = item.indexOf(':');
                        if (ci > 0) {
                          const lbl = item.substring(0, ci).trim();
                          const val = item.substring(ci + 1).trim();
                          const parts = splitByCommaAware(val);
                          lines.push(`${lbl}:`);
                          if (parts.length >= 2) parts.forEach(p => lines.push(`  ${n++}. ${p}`));
                          else lines.push(`  ${n++}. ${val}`);
                        } else {
                          const parts = splitByCommaAware(item);
                          if (parts.length >= 2) parts.forEach(p => lines.push(`${n++}. ${p}`));
                          else lines.push(`${n++}. ${item}`);
                        }
                      });
                      const textToCopy = lines.length > 0 ? lines.join('\n') : planValue;
                      copyField(textToCopy, 'plan-section');
                    }}
                  >
                    {copiedSection === 'plan-section' ? 'Copied' : 'Copy Section'}
                  </button>
                  {renderApproveButton(record, idx, 'plan')}
                </div>
              </div>
              {renderEditableTextSection(record, idx, 'plan', 'plan')}
            </div>
          </div>
        )}

        {/* 5. Recommendations - Specific action items (skip if empty array or no data) */}
        {shouldShowSection(record, 'Recommendations', 'recommendations', 'RECOMMENDATIONS', Array.isArray(record.recommendations) ? record.recommendations.map(r => r.recommendation || r).join(' ') : record.recommendations) &&
         record.recommendations &&
         (Array.isArray(record.recommendations) ? record.recommendations.length > 0 : true) && (
          <div className="section">
            <div className="mini-cards-container">
              <div className="section-header">
                <h3 className="section-title">{highlightText('Recommendations')}</h3>
                <div className="header-right-actions">
                  <button
                    className={`copy-btn ${copiedSection === 'recommendations-section' ? 'copied' : ''}`}
                    onClick={() => {
                      let text = '';
                      if (Array.isArray(record.recommendations)) {
                        record.recommendations.forEach((rec, i) => {
                          text += `${i + 1}. ${rec.recommendation || rec}`;
                          if (rec.date) text += ` (${formatDate(rec.date)})`;
                          text += '\n';
                        });
                      } else {
                        text = record.recommendations;
                      }
                      copyField(text, 'recommendations-section');
                    }}
                  >
                    {copiedSection === 'recommendations-section' ? 'Copied' : 'Copy Section'}
                  </button>
                  {renderApproveButton(record, idx, 'recommendations')}
                </div>
              </div>
              {Array.isArray(record.recommendations) ? (
                record.recommendations.map((rec, recIdx) => (
                  <div key={recIdx} className="numbered-row">
                    <div className="row-content">
                      <span className="content-value">
                        {highlightText(rec.recommendation || rec)}
                        {rec.date && <span className="rec-date"> ({highlightText(formatDate(rec.date))})</span>}
                      </span>
                    </div>
                    <button
                      className={`copy-btn ${copiedSection === `rec-${recIdx}` ? 'copied' : ''}`}
                      onClick={() => copyField(`${rec.recommendation || rec}${rec.date ? ` (${formatDate(rec.date)})` : ''}`, `rec-${recIdx}`)}
                    >
                      {copiedSection === `rec-${recIdx}` ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                ))
              ) : (
                <div className="numbered-row">
                  <div className="row-content">
                    <span className="content-value">{highlightText(record.recommendations)}</span>
                  </div>
                  <button
                    className={`copy-btn ${copiedSection === 'recommendations' ? 'copied' : ''}`}
                    onClick={() => copyField(record.recommendations, 'recommendations')}
                  >
                    {copiedSection === 'recommendations' ? 'Copied' : 'Copy'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 6. Clinical Status - Current condition */}
        {shouldShowSection(record, 'Clinical Status', 'disposition', 'DISPOSITION', record.disposition, 'condition at discharge', 'CONDITION AT DISCHARGE', record.conditionAtDischarge, 'dietary instructions', 'DIETARY INSTRUCTIONS', record.dietaryInstructions, 'status', 'STATUS', record.status) &&
         (record.disposition || record.conditionAtDischarge || record.dietaryInstructions || record.status) && (() => {
          // Section title match - if searching by section name, show all rows
          const sectionTitleMatches = searchTerm && (
            shouldShowRow(record, 'Clinical Status') ||
            shouldShowRow(record, 'clinical status')
          );

          return (
            <div className="section">
              <div className="mini-cards-container">
                <div className="section-header">
                  <h3 className="section-title">{highlightText('Clinical Status')}</h3>
                  <div className="header-right-actions">
                    <button
                      className={`copy-btn ${copiedSection === 'clinicalStatus-section' ? 'copied' : ''}`}
                      onClick={() => {
                        const text = [
                          record.disposition ? `Disposition: ${record.disposition}` : '',
                          record.conditionAtDischarge ? `Condition at Discharge: ${record.conditionAtDischarge}` : '',
                          record.dietaryInstructions ? `Dietary Instructions: ${record.dietaryInstructions}` : '',
                          record.status ? `Status: ${record.status}` : ''
                        ].filter(Boolean).join('\n');
                        copyField(text, 'clinicalStatus-section');
                      }}
                    >
                      {copiedSection === 'clinicalStatus-section' ? 'Copied' : 'Copy Section'}
                    </button>
                    {renderApproveButton(record, idx, 'clinical-status')}
                  </div>
                </div>
                {(sectionTitleMatches || shouldShowRow(record, 'Disposition', record.disposition)) && renderEditableField(record, idx, 'disposition', 'Disposition', 'clinical-status')}
                {(sectionTitleMatches || shouldShowRow(record, 'Condition at Discharge', record.conditionAtDischarge)) && renderEditableField(record, idx, 'conditionAtDischarge', 'Condition at Discharge', 'clinical-status')}
                {(sectionTitleMatches || shouldShowRow(record, 'Dietary Instructions', record.dietaryInstructions)) && renderEditableField(record, idx, 'dietaryInstructions', 'Dietary Instructions', 'clinical-status')}
                {(sectionTitleMatches || shouldShowRow(record, 'Status', record.status)) && renderEditableField(record, idx, 'status', 'Status', 'clinical-status')}
              </div>
            </div>
          );
        })()}

        {/* 7. Hospital Stay - Admission/discharge */}
        {shouldShowSection(record, 'Hospital Stay', 'admission date', 'ADMISSION DATE', formatDate(record.admissionDate), 'discharge date', 'DISCHARGE DATE', formatDate(record.dischargeDate), 'length of stay', 'LENGTH OF STAY', record.lengthOfStay, 'admitting diagnosis', 'ADMITTING DIAGNOSIS', record.admittingDiagnosis) &&
         (record.admissionDate || record.dischargeDate || record.lengthOfStay || record.admittingDiagnosis) && (() => {
          const sectionTitleMatches = searchTerm && (
            shouldShowRow(record, 'Hospital Stay') ||
            shouldShowRow(record, 'hospital stay')
          );

          return (
            <div className="section">
              <div className="mini-cards-container">
                <div className="section-header">
                  <h3 className="section-title">{highlightText('Hospital Stay')}</h3>
                  <div className="header-right-actions">
                    <button
                      className={`copy-btn ${copiedSection === 'hospitalStay-section' ? 'copied' : ''}`}
                      onClick={() => {
                        const text = [
                          record.admissionDate ? `Admission Date: ${formatDate(record.admissionDate)}` : '',
                          record.dischargeDate ? `Discharge Date: ${formatDate(record.dischargeDate)}` : '',
                          record.lengthOfStay ? `Length of Stay: ${record.lengthOfStay} days` : '',
                          record.admittingDiagnosis ? `Admitting Diagnosis: ${record.admittingDiagnosis}` : ''
                        ].filter(Boolean).join('\n');
                        copyField(text, 'hospitalStay-section');
                      }}
                    >
                      {copiedSection === 'hospitalStay-section' ? 'Copied' : 'Copy Section'}
                    </button>
                    {renderApproveButton(record, idx, 'hospital-stay')}
                  </div>
                </div>
                {record.admissionDate && (sectionTitleMatches || shouldShowRow(record, 'ADMISSION DATE', 'admission date', 'Admission Date', formatDate(record.admissionDate))) && (
                  <div className="rec-mini-card">
                    <div className="nested-subtitle">{highlightText('Admission Date')}</div>
                    <div className="numbered-row">
                      <div className="row-content">
                        <span className="content-value">{highlightText(formatDate(record.admissionDate))}</span>
                      </div>
                      <button
                        className={`copy-btn ${copiedSection === 'admissionDate' ? 'copied' : ''}`}
                        onClick={() => copyField(`Admission Date: ${formatDate(record.admissionDate)}`, 'admissionDate')}
                      >
                        {copiedSection === 'admissionDate' ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>
                )}
                {record.dischargeDate && (sectionTitleMatches || shouldShowRow(record, 'DISCHARGE DATE', 'discharge date', 'Discharge Date', formatDate(record.dischargeDate))) && (
                  <div className="rec-mini-card">
                    <div className="nested-subtitle">{highlightText('Discharge Date')}</div>
                    <div className="numbered-row">
                      <div className="row-content">
                        <span className="content-value">{highlightText(formatDate(record.dischargeDate))}</span>
                      </div>
                      <button
                        className={`copy-btn ${copiedSection === 'dischargeDate' ? 'copied' : ''}`}
                        onClick={() => copyField(`Discharge Date: ${formatDate(record.dischargeDate)}`, 'dischargeDate')}
                      >
                        {copiedSection === 'dischargeDate' ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>
                )}
                {(sectionTitleMatches || shouldShowRow(record, 'LENGTH OF STAY', 'length of stay', 'Length of Stay', `${record.lengthOfStay} days`)) && renderEditableField(record, idx, 'lengthOfStay', 'Length of Stay', 'hospital-stay')}
                {(sectionTitleMatches || shouldShowRow(record, 'ADMITTING DIAGNOSIS', 'admitting diagnosis', 'Admitting Diagnosis', record.admittingDiagnosis)) && renderEditableField(record, idx, 'admittingDiagnosis', 'Admitting Diagnosis', 'hospital-stay')}
              </div>
            </div>
          );
        })()}

        {/* 8. Consultation & Referral - Who's involved */}
        {shouldShowSection(record, 'Consultation & Referral', 'consulting physician', 'CONSULTING PHYSICIAN', record.consultingPhysician, 'consulting specialty', 'CONSULTING SPECIALTY', record.consultingSpecialty, 'referring physician', 'REFERRING PHYSICIAN', record.referringPhysician, 'referring specialty', 'REFERRING SPECIALTY', record.referringSpecialty, 'consult date', 'CONSULT DATE', formatDate(record.consultDate), 'reason for consult', 'REASON FOR CONSULT', record.reasonForConsult) &&
         (record.consultingPhysician || record.referringPhysician || record.consultDate || record.reasonForConsult) && (() => {
          const sectionTitleMatches = searchTerm && (
            shouldShowRow(record, 'Consultation & Referral') ||
            shouldShowRow(record, 'consultation & referral') ||
            shouldShowRow(record, 'Consultation Referral') ||
            shouldShowRow(record, 'consultation referral')
          );

          return (
            <div className="section">
              <div className="mini-cards-container">
                <div className="section-header">
                  <h3 className="section-title">{highlightText('Consultation & Referral')}</h3>
                  <div className="header-right-actions">
                    <button
                      className={`copy-btn ${copiedSection === 'consultReferral-section' ? 'copied' : ''}`}
                      onClick={() => {
                        const text = [
                          record.consultingPhysician ? `Consulting Physician: ${record.consultingPhysician}` : '',
                          record.consultingSpecialty ? `Consulting Specialty: ${record.consultingSpecialty}` : '',
                          record.referringPhysician ? `Referring Physician: ${record.referringPhysician}` : '',
                          record.referringSpecialty ? `Referring Specialty: ${record.referringSpecialty}` : '',
                          record.consultDate ? `Consult Date: ${formatDate(record.consultDate)}` : '',
                          record.reasonForConsult ? `Reason for Consult: ${record.reasonForConsult}` : ''
                        ].filter(Boolean).join('\n');
                        copyField(text, 'consultReferral-section');
                      }}
                    >
                      {copiedSection === 'consultReferral-section' ? 'Copied' : 'Copy Section'}
                    </button>
                    {renderApproveButton(record, idx, 'consultation')}
                  </div>
                </div>
                {(sectionTitleMatches || shouldShowRow(record, 'CONSULTING PHYSICIAN', 'consulting physician', 'Consulting Physician', record.consultingPhysician)) && renderEditableField(record, idx, 'consultingPhysician', 'Consulting Physician', 'consultation')}
                {(sectionTitleMatches || shouldShowRow(record, 'CONSULTING SPECIALTY', 'consulting specialty', 'Consulting Specialty', record.consultingSpecialty)) && renderEditableField(record, idx, 'consultingSpecialty', 'Consulting Specialty', 'consultation')}
                {(sectionTitleMatches || shouldShowRow(record, 'REFERRING PHYSICIAN', 'referring physician', 'Referring Physician', record.referringPhysician)) && renderEditableField(record, idx, 'referringPhysician', 'Referring Physician', 'consultation')}
                {(sectionTitleMatches || shouldShowRow(record, 'REFERRING SPECIALTY', 'referring specialty', 'Referring Specialty', record.referringSpecialty)) && renderEditableField(record, idx, 'referringSpecialty', 'Referring Specialty', 'consultation')}
                {record.consultDate && (sectionTitleMatches || shouldShowRow(record, 'CONSULT DATE', 'consult date', 'Consult Date', formatDate(record.consultDate))) && (
                  <div className="rec-mini-card">
                    <div className="nested-subtitle">{highlightText('Consult Date')}</div>
                    <div className="numbered-row">
                      <div className="row-content">
                        <span className="content-value">{highlightText(formatDate(record.consultDate))}</span>
                      </div>
                      <button
                        className={`copy-btn ${copiedSection === 'consultDate' ? 'copied' : ''}`}
                        onClick={() => copyField(`Consult Date: ${formatDate(record.consultDate)}`, 'consultDate')}
                      >
                        {copiedSection === 'consultDate' ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>
                )}
                {(sectionTitleMatches || shouldShowRow(record, 'REASON FOR CONSULT', 'reason for consult', 'Reason for Consult', record.reasonForConsult)) && renderEditableField(record, idx, 'reasonForConsult', 'Reason for Consult', 'consultation')}
              </div>
            </div>
          );
        })()}

        {/* 9. Results - Lab/test results */}
        {(() => {
          if (!record.results) return null;

          if (typeof record.results === 'object' && record.results !== null) {
            const hasData = Object.entries(record.results).some(([key, value]) => value !== null && value !== undefined);
            if (!hasData) return null;
          }

          if (typeof record.results === 'string' && !record.results.trim()) return null;
          if (Array.isArray(record.results) && record.results.length === 0) return null;

          if (!shouldShowSection(record, 'Results', 'results', 'RESULTS', typeof record.results === 'object' && record.results !== null ? Object.values(record.results).join(' ') : record.results)) return null;

          return (
            <div className="section">
              <div className="mini-cards-container">
                <div className="section-header">
                  <h3 className="section-title">{highlightText('Results')}</h3>
                  <div className="header-right-actions">
                    <button
                      className={`copy-btn ${copiedSection === 'results-section' ? 'copied' : ''}`}
                      onClick={() => {
                        let text = '';
                        if (typeof record.results === 'object' && record.results !== null) {
                          text = Object.entries(record.results)
                            .filter(([, value]) => value !== null && value !== undefined)
                            .map(([key, value]) => {
                              const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                              return `${label}: ${value}`;
                            })
                            .join('\n');
                        } else {
                          text = String(record.results);
                        }
                        copyField(text, 'results-section');
                      }}
                    >
                      {copiedSection === 'results-section' ? 'Copied' : 'Copy Section'}
                    </button>
                    {renderApproveButton(record, idx, 'results')}
                  </div>
                </div>
                {typeof record.results === 'object' && record.results !== null ? (
                  Object.entries(record.results).map(([key, value]) => {
                    if (value === null || value === undefined) return null;
                    const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                    return (
                      <div key={key} className="rec-mini-card">
                        <div className="nested-subtitle">{highlightText(label)}</div>
                        <div className="numbered-row">
                          <div className="row-content">
                            <span className="content-value">{highlightText(String(value))}</span>
                          </div>
                          <button
                            className={`copy-btn ${copiedSection === `result-${key}` ? 'copied' : ''}`}
                            onClick={() => copyField(`${label}: ${value}`, `result-${key}`)}
                          >
                            {copiedSection === `result-${key}` ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="numbered-row">
                    <div className="row-content">
                      <span className="content-value">{highlightText(String(record.results))}</span>
                    </div>
                    <button
                      className={`copy-btn ${copiedSection === 'results' ? 'copied' : ''}`}
                      onClick={() => copyField(String(record.results), 'results')}
                    >
                      {copiedSection === 'results' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* 10. Emergency Contacts & Legal - Support system */}
        {shouldShowSection(record, 'Emergency Contacts & Legal', 'primary care provider', 'PRIMARY CARE PROVIDER', record.primaryCareProvider, 'emergency contact', 'EMERGENCY CONTACT', record.emergencyContact, 'code status', 'CODE STATUS', record.codeStatus, 'advanced directives', 'ADVANCED DIRECTIVES', record.advancedDirectives, 'power of attorney', 'POWER OF ATTORNEY', record.powerOfAttorney) &&
         (record.primaryCareProvider || record.emergencyContact || record.codeStatus || record.advancedDirectives !== undefined || record.powerOfAttorney) && (() => {
          const sectionTitleMatches = searchTerm && (
            shouldShowRow(record, 'Emergency Contacts & Legal') ||
            shouldShowRow(record, 'emergency contacts & legal') ||
            shouldShowRow(record, 'Emergency Contacts Legal') ||
            shouldShowRow(record, 'emergency contacts legal')
          );

          return (
            <div className="section">
              <div className="mini-cards-container">
                <div className="section-header">
                  <h3 className="section-title">{highlightText('Emergency Contacts & Legal')}</h3>
                  <div className="header-right-actions">
                    <button
                      className={`copy-btn ${copiedSection === 'emergencyLegal-section' ? 'copied' : ''}`}
                      onClick={() => {
                        const text = [
                          record.primaryCareProvider ? `Primary Care Provider: ${record.primaryCareProvider}` : '',
                          record.emergencyContact ? `Emergency Contact: ${record.emergencyContact}` : '',
                          record.codeStatus ? `Code Status: ${record.codeStatus}` : '',
                          record.advancedDirectives !== undefined ? `Advanced Directives: ${record.advancedDirectives ? 'Yes' : 'No'}` : '',
                          record.powerOfAttorney ? `Power of Attorney: ${record.powerOfAttorney}` : ''
                        ].filter(Boolean).join('\n');
                        copyField(text, 'emergencyLegal-section');
                      }}
                    >
                      {copiedSection === 'emergencyLegal-section' ? 'Copied' : 'Copy Section'}
                    </button>
                    {renderApproveButton(record, idx, 'emergency-legal')}
                  </div>
                </div>
                {(sectionTitleMatches || shouldShowRow(record, 'PRIMARY CARE PROVIDER', 'primary care provider', 'Primary Care Provider', record.primaryCareProvider)) && renderEditableField(record, idx, 'primaryCareProvider', 'Primary Care Provider', 'emergency-legal')}
                {(sectionTitleMatches || shouldShowRow(record, 'EMERGENCY CONTACT', 'emergency contact', 'Emergency Contact', record.emergencyContact)) && renderEditableField(record, idx, 'emergencyContact', 'Emergency Contact', 'emergency-legal')}
                {(sectionTitleMatches || shouldShowRow(record, 'CODE STATUS', 'code status', 'Code Status', record.codeStatus)) && renderEditableField(record, idx, 'codeStatus', 'Code Status', 'emergency-legal')}
                {record.advancedDirectives !== undefined && (sectionTitleMatches || shouldShowRow(record, 'ADVANCED DIRECTIVES', 'advanced directives', 'Advanced Directives', record.advancedDirectives ? 'Yes' : 'No')) && (
                  <div className="rec-mini-card">
                    <div className="nested-subtitle">{highlightText('Advanced Directives')}</div>
                    <div className="numbered-row">
                      <div className="row-content">
                        <span className="content-value">{highlightText(record.advancedDirectives ? 'Yes' : 'No')}</span>
                      </div>
                      <button
                        className={`copy-btn ${copiedSection === 'advancedDirectives' ? 'copied' : ''}`}
                        onClick={() => copyField(`Advanced Directives: ${record.advancedDirectives ? 'Yes' : 'No'}`, 'advancedDirectives')}
                      >
                        {copiedSection === 'advancedDirectives' ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>
                )}
                {(sectionTitleMatches || shouldShowRow(record, 'POWER OF ATTORNEY', 'power of attorney', 'Power of Attorney', record.powerOfAttorney)) && renderEditableField(record, idx, 'powerOfAttorney', 'Power of Attorney', 'emergency-legal')}
              </div>
            </div>
          );
        })()}

        {/* 11. Notes - Additional docs */}
        {shouldShowSection(record, 'Notes', 'notes', 'NOTES', record.notes) && record.notes && (() => {
          return (
            <div className="section">
              <div className="mini-cards-container">
                <div className="section-header">
                  <h3 className="section-title">{highlightText('Notes')}</h3>
                  <div className="header-right-actions">
                    <button
                      className={`copy-btn ${copiedSection === 'notes-section' ? 'copied' : ''}`}
                      onClick={() => {
                        const parseText = (txt) => {
                          if (!txt) return [];
                          const numberedPattern = /(?:^|\s)\(?\d+[.)]\s+/g;
                          const hasNumbering = numberedPattern.test(txt);
                          if (hasNumbering) {
                            return txt.split(numberedPattern).map(p => p.trim()).filter(p => p.length > 0);
                          }
                          return txt.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.\s+/).map(s => s.trim()).filter(s => s.length > 0);
                        };
                        const notesValue = getFieldValue(record, 'notes', idx) || record.notes;
                        const items = parseText(notesValue);
                        const textToCopy = items.length > 0
                          ? items.map((item, i) => `${i + 1}. ${item}`).join('\n')
                          : notesValue;
                        copyField(textToCopy, 'notes-section');
                      }}
                    >
                      {copiedSection === 'notes-section' ? 'Copied' : 'Copy Section'}
                    </button>
                    {renderApproveButton(record, idx, 'notes')}
                  </div>
                </div>
                {renderEditableTextSection(record, idx, 'notes', 'notes')}
              </div>
            </div>
          );
        })()}

        {/* 12. Signatures & Documentation */}
        {shouldShowSection(record, 'Signatures & Documentation', 'category', 'Category', record.category, 'type', 'Type', record.type, 'provider', 'Provider', record.provider, 'date', 'Date', formatDate(record.date), 'facility', 'Facility', record.facility, 'facility name', 'Facility Name', record.facilityName, 'facility address', 'Facility Address', record.facilityAddress, 'electronic signature', 'Electronic Signature', record.electronicSignature, 'electronic signature full', 'Electronic Signature Full', record.electronicSignatureFull) &&
         (record.category || record.type || record.provider || record.date || record.facility || record.facilityName || record.facilityAddress || record.electronicSignature || record.electronicSignatureFull) && (() => {
          const sectionTitleMatches = !searchTerm.trim() || record._showAllSections ||
            shouldShowRow(record, 'Signatures & Documentation', 'signatures & documentation', 'Documentation', 'documentation');

          return (
            <div className="section">
              <div className="mini-cards-container">
                <div className="section-header">
                  <h3 className="section-title">{highlightText('Signatures & Documentation')}</h3>
                  <div className="header-right-actions">
                    <button
                      className={`copy-btn ${copiedSection === 'signatures-section' ? 'copied' : ''}`}
                      onClick={() => {
                        const text = [
                          record.category ? `Category: ${record.category}` : '',
                          record.type ? `Type: ${record.type}` : '',
                          record.provider ? `Provider: ${record.provider}` : '',
                          record.date ? `Date: ${formatDate(record.date)}` : '',
                          record.facility ? `Facility: ${record.facility}` : '',
                          record.facilityName ? `Facility Name: ${record.facilityName}` : '',
                          record.facilityAddress ? `Facility Address: ${record.facilityAddress}` : '',
                          record.electronicSignature ? `Electronic Signature: ${record.electronicSignature}` : '',
                          record.electronicSignatureFull ? `Electronic Signature Full: ${record.electronicSignatureFull}` : ''
                        ].filter(Boolean).join('\n');
                        copyField(text, 'signatures-section');
                      }}
                    >
                      {copiedSection === 'signatures-section' ? 'Copied' : 'Copy Section'}
                    </button>
                    {renderApproveButton(record, idx, 'signatures')}
                  </div>
                </div>
                {(sectionTitleMatches || shouldShowRow(record, 'Category', 'category', 'CATEGORY', record.category)) && renderEditableField(record, idx, 'category', 'Category', 'signatures')}
                {(sectionTitleMatches || shouldShowRow(record, 'Type', 'type', 'TYPE', record.type)) && renderEditableField(record, idx, 'type', 'Type', 'signatures')}
                {(sectionTitleMatches || shouldShowRow(record, 'Provider', 'provider', 'PROVIDER', record.provider)) && renderEditableField(record, idx, 'provider', 'Provider', 'signatures')}
                {record.date && (sectionTitleMatches || shouldShowRow(record, 'Date', 'date', 'DATE', formatDate(record.date))) && (
                  <div className="rec-mini-card">
                    <div className="nested-subtitle">{highlightText('Date')}</div>
                    <div className="numbered-row">
                      <div className="row-content">
                        <span className="content-value">{highlightText(formatDate(record.date))}</span>
                      </div>
                      <button
                        className={`copy-btn ${copiedSection === 'date' ? 'copied' : ''}`}
                        onClick={() => copyField(`Date: ${formatDate(record.date)}`, 'date')}
                      >
                        {copiedSection === 'date' ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>
                )}
                {(sectionTitleMatches || shouldShowRow(record, 'Facility', 'facility', 'FACILITY', record.facility)) && renderEditableField(record, idx, 'facility', 'Facility', 'signatures')}
                {(sectionTitleMatches || shouldShowRow(record, 'Facility Name', 'facility name', 'FACILITY NAME', record.facilityName)) && renderEditableField(record, idx, 'facilityName', 'Facility Name', 'signatures')}
                {(sectionTitleMatches || shouldShowRow(record, 'Facility Address', 'facility address', 'FACILITY ADDRESS', record.facilityAddress)) && renderEditableField(record, idx, 'facilityAddress', 'Facility Address', 'signatures')}
                {(sectionTitleMatches || shouldShowRow(record, 'Electronic Signature', 'electronic signature', 'ELECTRONIC SIGNATURE', record.electronicSignature)) && renderEditableField(record, idx, 'electronicSignature', 'Electronic Signature', 'signatures')}
                {(sectionTitleMatches || shouldShowRow(record, 'Electronic Signature Full', 'electronic signature full', 'ELECTRONIC SIGNATURE FULL', record.electronicSignatureFull)) && renderEditableField(record, idx, 'electronicSignatureFull', 'Electronic Signature Full', 'signatures')}
              </div>
            </div>
          );
        })()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdministrativeDataDocument;
