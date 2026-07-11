/**
 * PatientDetailsDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: patient_details
 *
 * 5 Sections:
 *   1. personal-information: patientName/firstName/lastName, dateOfBirth, gender, socialSecurityNumber, nationalId
 *   2. contact-information: email, phone/phoneNumber, street, city, state, zipCode, country, preferredLanguage
 *   3. medical-information: bloodType, allergies
 *   4. insurance-information: insuranceProvider, insuranceNumber
 *   5. emergency-contact: emergencyContact, emergencyContactPhone
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import PatientDetailsDocumentPDFTemplate from '../pdf-templates/PatientDetailsDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './PatientDetailsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = field name) */
const DRAFT_KEY = 'patient_detailsPendingEdits';
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
  'personal-information': 'Personal Information',
  'contact-information': 'Contact Information',
  'medical-information': 'Medical Information',
  'insurance-information': 'Insurance Information',
  'emergency-contact': 'Emergency Contact',
};

const FIELD_LABELS = {
  patientName: 'Full Name',
  firstName: 'First Name',
  lastName: 'Last Name',
  dateOfBirth: 'Date of Birth',
  gender: 'Gender',
  socialSecurityNumber: 'SSN',
  nationalId: 'National ID',
  email: 'Email',
  phone: 'Phone',
  phoneNumber: 'Phone',
  street: 'Street',
  city: 'City',
  state: 'State',
  zipCode: 'Zip Code',
  country: 'Country',
  preferredLanguage: 'Preferred Language',
  bloodType: 'Blood Type',
  allergies: 'Allergies',
  insuranceProvider: 'Insurance Provider',
  insuranceNumber: 'Insurance Number',
  emergencyContact: 'Emergency Contact Name',
  emergencyContactPhone: 'Emergency Contact Phone',
};

const SECTION_FIELDS = {
  'personal-information': ['patientName', 'dateOfBirth', 'gender', 'socialSecurityNumber', 'nationalId'],
  'contact-information': ['email', 'phone', 'street', 'city', 'state', 'zipCode', 'country', 'preferredLanguage'],
  'medical-information': ['bloodType', 'allergies'],
  'insurance-information': ['insuranceProvider', 'insuranceNumber'],
  'emergency-contact': ['emergencyContact', 'emergencyContactPhone'],
};

const DATE_FIELDS = ['dateOfBirth'];
const BOOLEAN_FIELDS = [];
const NUMBER_FIELDS = [];
const STRING_FIELDS = ['patientName', 'firstName', 'lastName', 'gender', 'socialSecurityNumber', 'nationalId', 'email', 'phone', 'phoneNumber', 'street', 'city', 'state', 'zipCode', 'country', 'preferredLanguage', 'bloodType', 'allergies', 'insuranceProvider', 'insuranceNumber', 'emergencyContact', 'emergencyContactPhone'];

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

const toInputDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toISOString().split('T')[0]; } catch { return ''; }
};

const calculateAge = (dob) => {
  if (!dob) return '?';
  const birthDate = new Date(dob.$date || dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
  return age;
};

/* ═══════ COMPONENT ═══════ */
const PatientDetailsDocument = ({ document: docProp }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSection, setCopiedSection] = useState(null);
  const [copiedItems, setCopiedItems] = useState({});
  const [showCopied, setShowCopied] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [editedFields, setEditedFields] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const containerRef = useRef(null);

  /* ═══════ DATA UNWRAP ═══════ */
  const record = useMemo(() => {
    if (!docProp) return null;
    if (Array.isArray(docProp)) return docProp[0] || null;
    if (docProp?.documentData) return docProp.documentData;
    return docProp;
  }, [docProp]);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF). */
  useEffect(() => {
    if (!record) return;
    const rid = record._id ? (typeof record._id === 'string' ? record._id : (record._id.$oid || String(record._id))) : null;
    if (!rid) return;
    const store = readDrafts();
    const recDrafts = store[rid];
    if (!recDrafts || Object.keys(recDrafts).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {};
    Object.entries(recDrafts).forEach(([fieldPart, value]) => {
      nLocal[fieldPart] = value;
      nPending[fieldPart] = true;
      nFields[fieldPart] = 'edited';
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
  }, [record]);

  /* ═══════ UTILS ═══════ */
  const hasVal = useCallback((v) => {
    if (v === null || v === undefined || v === '') return false;
    if (typeof v === 'boolean') return true;
    if (typeof v === 'number') return true;
    if (typeof v === 'string') return v.trim() !== '';
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object') return Object.keys(v).length > 0;
    return true;
  }, []);

  const fmtVal = useCallback((v) => {
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    if (typeof v === 'number') return String(v);
    return String(v || '');
  }, []);

  const getFieldValue = useCallback((fn) => {
    if (!record) return undefined;
    const k = fn;
    if (localEdits[k] !== undefined) return localEdits[k];
    /* handle phone alias */
    if (fn === 'phone' && record.phone === undefined && record.phoneNumber !== undefined) return record.phoneNumber;
    /* handle patientName derived from firstName+lastName */
    if (fn === 'patientName' && !record.patientName && (record.firstName || record.lastName)) {
      return `${record.firstName || ''} ${record.lastName || ''}`.trim();
    }
    return record[fn];
  }, [localEdits, record]);

  const safeId = useCallback((r) => {
    if (!r?._id) return null;
    if (typeof r._id === 'string') return r._id;
    if (r._id.$oid) return r._id.$oid;
    return String(r._id);
  }, []);

  const highlightText = useCallback((text) => {
    if (!searchTerm.trim() || !text) return text;
    const phrase = searchTerm.trim();
    const regex = new RegExp(`(${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = String(text).split(regex);
    return parts.map((part, i) => regex.test(part) ? <mark key={i}>{part}</mark> : part);
  }, [searchTerm]);

  const sectionTitleMatches = useCallback((sid) => {
    if (!searchTerm.trim()) return false;
    const p = searchTerm.toLowerCase().trim();
    const t = (SECTION_TITLES[sid] || '').toLowerCase();
    return t.includes(p) || p.includes(t);
  }, [searchTerm]);

  /* ═══════ SEARCH ═══════ */
  const shouldShowSection = useCallback((sid) => {
    if (!searchTerm.trim()) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const title = (SECTION_TITLES[sid] || '').toLowerCase();
    if (title.includes(phrase) || phrase.includes(title)) return true;
    const fields = SECTION_FIELDS[sid] || [];
    for (const f of fields) {
      const label = (FIELD_LABELS[f] || f).toLowerCase();
      if (label.includes(phrase) || phrase.includes(label)) return true;
      const val = getFieldValue(f);
      if (val !== null && val !== undefined) {
        if (fmtVal(val).toLowerCase().includes(phrase)) return true;
      }
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal]);

  const fieldMatches = useCallback((fn) => {
    if (!searchTerm.trim()) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const label = (FIELD_LABELS[fn] || fn).toLowerCase();
    if (label.includes(phrase) || phrase.includes(label)) return true;
    const val = getFieldValue(fn);
    if (val !== null && val !== undefined) {
      return fmtVal(val).toLowerCase().includes(phrase);
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal]);

  /* ═══════ PDF DATA ═══════ */
  const pdfData = useMemo(() => {
    if (!record) return null;
    const merged = { ...record };
    Object.keys(localEdits).forEach(key => {
      if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF/Copy All until approved
      merged[key] = localEdits[key];
    });
    return merged;
  }, [record, localEdits, pendingEdits]);

  const patientName = useMemo(() => {
    if (!record) return 'Unknown Patient';
    return getFieldValue('patientName') || `${record.firstName || ''} ${record.lastName || ''}`.trim() || 'Unknown Patient';
  }, [record, getFieldValue]);

  const age = useMemo(() => {
    if (!record) return '?';
    const dob = getFieldValue('dateOfBirth') || record.dateOfBirth;
    return calculateAge(dob);
  }, [record, getFieldValue]);

  /* ═══════ EDIT HANDLERS ═══════ */
  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((fn, valueOverride) => {
    if (!record) return;
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    setSaveError(null);
    setLocalEdits(prev => ({ ...prev, [fn]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [fn]: true }));
    setEditedFields(prev => ({ ...prev, [fn]: 'edited' }));
    // Re-edit after approval → drop the section's 'approved' flag so the button goes back to yellow Pending.
    setApprovedSections(prev => {
      const sid = Object.keys(SECTION_FIELDS).find(s => SECTION_FIELDS[s].includes(fn));
      if (!sid || !prev[sid]) return prev;
      const next = { ...prev };
      delete next[sid];
      return next;
    });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = saveVal;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, record]);

  /* ═══════ APPROVE ═══════ */
  const sectionHasEdits = useCallback((sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f => Object.keys(editedFields).some(k => k === f));
  }, [editedFields]);

  // Approve = COMMIT this section's staged drafts to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (sid) => {
    if (!record) return;
    const id = safeId(record); if (!id) return;
    setSaving(true);
    try {
      const fields = SECTION_FIELDS[sid] || [];
      const toCommit = fields.filter(f => pendingEdits[f] && localEdits[f] !== undefined);
      // Persist each staged field to the DB now. fieldPart is a plain field name here (no arrayIndex):
      // a dot-suffix only becomes arrayIndex when the segment after the LAST dot is purely numeric.
      for (const fieldPart of toCommit) {
        const lastDot = fieldPart.lastIndexOf('.');
        const payload = { field: fieldPart, value: localEdits[fieldPart] };
        if (lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1))) {
          payload.field = fieldPart.slice(0, lastDot);
          payload.arrayIndex = parseInt(fieldPart.slice(lastDot + 1), 10);
        }
        const resp = await secureApiClient.put(`/api/edit/patient_details/${id}/edit`, payload);
        if (!resp || !resp.success) throw new Error((resp && resp.error) || 'save failed');
      }
      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/patient_details/${id}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(f => delete n[f]); return n; });
      // Drop this section's committed drafts from localStorage
      const store = readDrafts();
      if (store[id]) { toCommit.forEach(f => delete store[id][f]); if (Object.keys(store[id]).length === 0) delete store[id]; writeDrafts(store); }

      setApprovedSections(prev => ({ ...prev, [sid]: true }));
      setEditedFields(prev => { const n = { ...prev }; fields.forEach(f => { delete n[f]; }); return n; });
    } catch (err) { console.error('[PatientDetails] Approve error:', err); }
    finally { setSaving(false); }
  }, [safeId, record, pendingEdits, localEdits]);

  const renderApproveButton = useCallback((sid) => {
    const hasEdits = sectionHasEdits(sid);
    const isApproved = approvedSections[sid];
    if (hasEdits) return (<button className="approve-btn pending" onClick={e => { e.stopPropagation(); handleApproveSection(sid); }}>Pending Approve</button>);
    if (isApproved) return <span className="approve-btn approved">Approved</span>;
    return null;
  }, [sectionHasEdits, approvedSections, handleApproveSection]);

  /* ═══════ COPY ═══════ */
  const copyToClipboard = useCallback(async (text) => {
    try { await navigator.clipboard.writeText(text); return true; }
    catch { const ta = window.document.createElement('textarea'); ta.value = text; ta.style.position = 'absolute'; ta.style.left = '-9999px'; (containerRef.current || window.document.body).appendChild(ta); ta.select(); window.document.execCommand('copy'); (containerRef.current || window.document.body).removeChild(ta); return true; }
  }, []);

  const copySection = useCallback(async (text, id) => {
    const ok = await copyToClipboard(text); if (ok) { setCopiedSection(id); setTimeout(() => setCopiedSection(null), 2000); }
  }, [copyToClipboard]);

  const copyItem = useCallback(async (text, id) => {
    const ok = await copyToClipboard(text); if (ok) { setCopiedItems(prev => ({ ...prev, [id]: true })); setTimeout(() => setCopiedItems(prev => ({ ...prev, [id]: false })), 2000); }
  }, [copyToClipboard]);

  const buildSectionCopyText = useCallback((sid) => {
    const title = SECTION_TITLES[sid];
    let text = `${title}\n${'='.repeat(40)}\n\n`;
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(f);
      if (!hasVal(val)) return;
      if (DATE_FIELDS.includes(f)) { text += `${label}\n${formatDate(val)}\n\n`; }
      else { text += `${label}\n${fmtVal(val)}\n\n`; }
    });
    return text;
  }, [getFieldValue, hasVal, fmtVal]);

  const copyAllText = useCallback(async () => {
    let text = '=== PATIENT INFORMATION ===\n\n';
    text += `Patient: ${patientName}\n\n`;
    Object.keys(SECTION_FIELDS).forEach(sid => { text += buildSectionCopyText(sid); });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [patientName, copyToClipboard, buildSectionCopyText]);

  /* ═══════ RENDER: DATE FIELD ═══════ */
  const renderDateField = (fn, sid) => {
    const val = getFieldValue(fn); if (!hasVal(val)) return null;
    const editKey = fn;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const displayVal = formatDate(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(fn) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(toInputDate(val)); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <input type="date" className="edit-date" value={editValue} onChange={e => setEditValue(e.target.value)} ref={el => { if (el) { el.focus(); try { el.showPicker(); } catch {} } }} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (isNaN(new Date(editValue).getTime())) { setSaveError('Please enter a valid date'); return; } handleSaveField(fn, editValue + 'T00:00:00.000Z'); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: STRING FIELD ═══════ */
  const renderStringField = (fn, sid) => {
    const val = getFieldValue(fn); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    const editKey = fn;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(fn) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(strVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveField(fn); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(strVal)}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${strVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ═══════ RENDER: GENERIC SECTION ═══════ */
  const renderSection = (sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];
    const hasAnyVal = fields.some(f => hasVal(getFieldValue(f)));
    if (!hasAnyVal) return null;

    const copyId = sid;
    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(title)}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(sid)}
            </div>
          </div>
          {fields.map(f => {
            if (DATE_FIELDS.includes(f)) return renderDateField(f, sid);
            return renderStringField(f, sid);
          })}
        </div>
      </div>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  if (!record) {
    return (
      <div className="patient-details-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Patient Information</h2></div>
        <div className="empty-state">No patient data available</div>
      </div>
    );
  }

  return (
    <div className="patient-details-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Patient Information</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<PatientDetailsDocumentPDFTemplate document={pdfData} />} fileName={`patient-details-${patientName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`} className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>

      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search patient details..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Filtering patient details...</span>}
      </div>
      <div className="patient-name-badge">
        <span className="patient-name">{highlightText(patientName)}</span>
        {age !== '?' && <span className="patient-age">{age} years old</span>}
        {record.status && <span className={`patient-status status-${record.status?.toLowerCase()}`}>{highlightText(record.status)}</span>}
      </div>
      <div className="records-container">
        {renderSection('personal-information')}
        {renderSection('contact-information')}
        {renderSection('medical-information')}
        {renderSection('insurance-information')}
        {renderSection('emergency-contact')}
      </div>
      <div className="patient-details-footer">
        <p className="footer-note">For medical history and clinical data, ask to "show medical data" for this patient.</p>
      </div>
    </div>
  );
};

export default PatientDetailsDocument;
