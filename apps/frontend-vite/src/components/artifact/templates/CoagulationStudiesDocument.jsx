import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import secureApiClient from '../../../services/secureApiClient';
import SearchBar from '../components/SearchBar';
import CoagulationStudiesDocumentPDFTemplate from '../pdf-templates/CoagulationStudiesDocumentPDFTemplate';
import './CoagulationStudiesDocument.css';

// Section → field mapping for approve/edit tracking
const SECTION_FIELDS = {
  'basic-coag': ['prothrombinTime', 'internationalNormalizedRatio', 'activatedPartialThromboplastinTime', 'thrombinTime'],
  'fibrinolysis': ['fibrinogenLevel', 'plateletCount', 'bleedingTime', 'dDimerLevel', 'fibrinDegradationProducts'],
  'coag-factors': ['factorViiActivity', 'factorViiiActivity', 'factorIxActivity', 'vonWillebrandFactor'],
  'inhibitors': ['proteinCActivity', 'proteinSActivity', 'antithrombinActivity'],
  'thrombophilia': ['lupusAnticoagulantScreen', 'anticardiolipinAntibody', 'factorVLeidenMutation', 'prothrombinGeneMutation'],
  'specialized': ['reptilaseTime', 'plateletAggregationStudy', 'claustThrombelastometry'],
};

const SENTENCE_FIELDS = [];
const ARRAY_FIELDS = [];

const FIELD_LABELS = {
  prothrombinTime: 'Prothrombin Time (PT)',
  internationalNormalizedRatio: 'INR',
  activatedPartialThromboplastinTime: 'aPTT',
  thrombinTime: 'Thrombin Time',
  fibrinogenLevel: 'Fibrinogen Level',
  plateletCount: 'Platelet Count',
  bleedingTime: 'Bleeding Time',
  dDimerLevel: 'D-Dimer Level',
  fibrinDegradationProducts: 'Fibrin Degradation Products',
  factorViiActivity: 'Factor VII Activity',
  factorViiiActivity: 'Factor VIII Activity',
  factorIxActivity: 'Factor IX Activity',
  vonWillebrandFactor: 'von Willebrand Factor',
  proteinCActivity: 'Protein C Activity',
  proteinSActivity: 'Protein S Activity',
  antithrombinActivity: 'Antithrombin Activity',
  lupusAnticoagulantScreen: 'Lupus Anticoagulant Screen',
  anticardiolipinAntibody: 'Anticardiolipin Antibody',
  factorVLeidenMutation: 'Factor V Leiden Mutation',
  prothrombinGeneMutation: 'Prothrombin Gene Mutation',
  reptilaseTime: 'Reptilase Time',
  plateletAggregationStudy: 'Platelet Aggregation Study',
  claustThrombelastometry: 'Thrombelastometry (ROTEM)',
};

const SECTION_TITLES = {
  'basic-coag': 'Basic Coagulation',
  'fibrinolysis': 'Fibrinolysis & Platelet Studies',
  'coag-factors': 'Coagulation Factors',
  'inhibitors': 'Natural Anticoagulant Inhibitors',
  'thrombophilia': 'Thrombophilia Screening',
  'specialized': 'Specialized Tests',
};

const BOOLEAN_FIELDS = ['lupusAnticoagulantScreen', 'factorVLeidenMutation', 'prothrombinGeneMutation'];

// Numeric lab values → −/+ stepper (stored type stays number)
const NUMBER_FIELDS = [
  'prothrombinTime', 'internationalNormalizedRatio', 'activatedPartialThromboplastinTime', 'thrombinTime',
  'fibrinogenLevel', 'plateletCount', 'bleedingTime', 'dDimerLevel', 'fibrinDegradationProducts',
  'factorViiActivity', 'factorViiiActivity', 'factorIxActivity', 'vonWillebrandFactor',
  'proteinCActivity', 'proteinSActivity', 'antithrombinActivity', 'reptilaseTime',
];
// Decimal-aware step for the −/+ number stepper ("1.1" → 0.1, "245000" → 1)
const stepFor = (v) => { const d = String(v ?? '').split('.')[1]; return d ? '0.' + '0'.repeat(Math.max(0, d.length - 1)) + '1' : '1'; };

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'coagulation_studiesPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

const CoagulationStudiesDocument = ({ document: templateData }) => {
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
    if (templateData?.coagulation_studies && Array.isArray(templateData.coagulation_studies)) return templateData.coagulation_studies;
    if (templateData?.documentData) {
      const d = templateData.documentData;
      if (Array.isArray(d)) return d;
      if (d?.coagulation_studies && Array.isArray(d.coagulation_studies)) return d.coagulation_studies;
      if (d && typeof d === 'object') return [d];
    }
    if (templateData && typeof templateData === 'object') return [templateData];
    return [];
  }, [templateData]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const rid = record && record._id ? (typeof record._id === 'string' ? record._id : (record._id.$oid || String(record._id))) : null;
      const recDrafts = rid ? store[rid] : null;
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
    if (typeof v === 'boolean') return true;
    if (typeof v === 'string') return v.trim().length > 0;
    if (Array.isArray(v)) return v.length > 0;
    return Boolean(v);
  };

  const getFieldValue = useCallback((record, field, idx) => {
    const editKey = `${field}-${idx}`;
    if (localEdits[editKey] !== undefined) return localEdits[editKey];
    return record[field];
  }, [localEdits]);

  const formatDisplayValue = (fieldName, val) => {
    if (BOOLEAN_FIELDS.includes(fieldName)) {
      if (typeof val === 'boolean') return val ? 'Yes' : 'No';
      return String(val);
    }
    return String(val);
  };

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
    if (!rid) {
      console.error('[CoagulationStudies] Cannot save — no record ID');
      return;
    }
    const val = valueOverride !== undefined ? valueOverride : editValue;
    const ek = editTrackingKey || `${fieldName}-${idx}`;

    setLocalEdits(prev => ({ ...prev, [ek]: val }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    // Re-edit after approval → drop the section 'approved' flag so the button goes back to yellow Pending Approve
    setApprovedSections(prev => {
      const updated = { ...prev };
      delete updated[`${sectionId}-${idx}`];
      return updated;
    });

    // Stage the draft (no DB write). localStorage keeps it across refresh; Approve commits it.
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][fieldName] = val;
    writeDrafts(store);

    setEditingField(null);
    setEditValue('');
  }, [editValue]);

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

      // Collect this record's pending edits for this section (editKey = "field-idx" or "field.arrayIndex-idx")
      const suffix = `-${idx}`;
      const sectionFields = SECTION_FIELDS[sectionId] || [];
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
        const fieldPart = k.slice(0, -suffix.length);
        const baseField = fieldPart.includes('.') ? fieldPart.slice(0, fieldPart.lastIndexOf('.')) : fieldPart;
        return sectionFields.includes(baseField) || sectionFields.includes(fieldPart);
      });
      // Persist each staged field to the DB now (field, or field+arrayIndex for array elements)
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // "field" or "field.arrayIndex"
        const lastDot = fieldPart.lastIndexOf('.');
        const trailing = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const isArrayIdx = lastDot !== -1 && /^\d+$/.test(trailing);
        const payload = { field: isArrayIdx ? fieldPart.slice(0, lastDot) : fieldPart, value: localEdits[editKey] };
        if (isArrayIdx) payload.arrayIndex = parseInt(trailing, 10);
        const resp = await secureApiClient.put(`/api/edit/coagulation_studies/${rid}/edit`, payload);
        if (!resp || !resp.success) throw new Error((resp && resp.error) || 'save failed');
      }

      await secureApiClient.put(`/api/edit/coagulation_studies/${rid}/approve`, { sectionId, approved: true });

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
          const fieldPart = editKey.slice(0, -suffix.length);
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
      console.error('[CoagulationStudies] Approve error:', err);
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

  // ─── renderEditableField ────────────────────────────────────────
  // Widget by value shape: number → −/+ stepper (saves a NUMBER), boolean → Yes/No select
  // (saves a REAL boolean via valueOverride — never the "Yes"/"No" string), else textarea.
  const renderEditableField = (record, fieldName, label, idx, sectionId) => {
    const val = getFieldValue(record, fieldName, idx);
    if (!hasVal(val)) return null;
    // A coagulation assay value of 0 is the extraction default for "not reported" (0% factor
    // activity / 0 platelet count is not a real measurement) — treat numeric 0 as absent.
    if (NUMBER_FIELDS.includes(fieldName) && Number(val) === 0) return null;
    const editKey = `${fieldName}-${idx}`;
    const isEditing = editingField === editKey;
    const isEdited = editedFields[editKey];
    const displayVal = formatDisplayValue(fieldName, val);
    const isNum = NUMBER_FIELDS.includes(fieldName);
    const isBool = BOOLEAN_FIELDS.includes(fieldName) && typeof val === 'boolean';

    if (isEditing) {
      return (
        <div className="rec-mini-card" key={fieldName}>
          <div className="nested-subtitle">{highlightText(label)}</div>
          <div className="edit-field-container">
            {isNum ? (
              <div className="num-stepper-row">
                <button type="button" className="num-step" disabled={saving} onClick={() => { const st = parseFloat(stepFor(val)) || 1; const dec = (String(st).split('.')[1] || '').length; const cur = parseFloat(editValue); setEditValue(Math.max(0, (isNaN(cur) ? 0 : cur) - st).toFixed(dec)); }}>−</button>
                <input type="number" step={stepFor(val)} min="0" className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus
                  onKeyDown={e => {
                    if (e.key === 'Enter') { const p = parseFloat(editValue); if (!isNaN(p)) handleSaveField(record, fieldName, idx, sectionId, null, p); }
                    if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
                  }} />
                <button type="button" className="num-step" disabled={saving} onClick={() => { const st = parseFloat(stepFor(val)) || 1; const dec = (String(st).split('.')[1] || '').length; const cur = parseFloat(editValue); setEditValue(Math.max(0, (isNaN(cur) ? 0 : cur) + st).toFixed(dec)); }}>+</button>
              </div>
            ) : isBool ? (
              <select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus
                onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            ) : (
              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && e.ctrlKey) handleSaveField(record, fieldName, idx, sectionId);
                  if (e.key === 'Escape') { setEditingField(null); setEditValue(''); }
                }} autoFocus rows={2} />
            )}
            <div className="edit-actions">
              <button className="save-btn" disabled={saving} onClick={() => {
                if (isNum) { const p = parseFloat(editValue); if (isNaN(p)) return; handleSaveField(record, fieldName, idx, sectionId, null, p); }
                else if (isBool) handleSaveField(record, fieldName, idx, sectionId, null, editValue === 'Yes');
                else handleSaveField(record, fieldName, idx, sectionId);
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
          onClick={() => { setEditingField(editKey); setEditValue(isBool ? (val ? 'Yes' : 'No') : String(val)); }}>
          <span className="content-value">{highlightText(displayVal)}<span className="edit-indicator"> ✎</span></span>
        </div>
        {isEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </div>
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
      const docTitle = `Coagulation Study ${recordNumber}`;
      let showAllSections = false;

      if (docTitle.toLowerCase().includes(phrase)) showAllSections = true;

      const allFieldValues = [
        docTitle,
        record.prothrombinTime !== undefined ? String(record.prothrombinTime) : '',
        record.internationalNormalizedRatio !== undefined ? String(record.internationalNormalizedRatio) : '',
        record.activatedPartialThromboplastinTime !== undefined ? String(record.activatedPartialThromboplastinTime) : '',
        record.thrombinTime !== undefined ? String(record.thrombinTime) : '',
        record.fibrinogenLevel !== undefined ? String(record.fibrinogenLevel) : '',
        record.plateletCount !== undefined ? String(record.plateletCount) : '',
        record.bleedingTime !== undefined ? String(record.bleedingTime) : '',
        record.dDimerLevel !== undefined ? String(record.dDimerLevel) : '',
        record.fibrinDegradationProducts !== undefined ? String(record.fibrinDegradationProducts) : '',
        record.factorViiActivity !== undefined ? String(record.factorViiActivity) : '',
        record.factorViiiActivity !== undefined ? String(record.factorViiiActivity) : '',
        record.factorIxActivity !== undefined ? String(record.factorIxActivity) : '',
        record.vonWillebrandFactor !== undefined ? String(record.vonWillebrandFactor) : '',
        record.proteinCActivity !== undefined ? String(record.proteinCActivity) : '',
        record.proteinSActivity !== undefined ? String(record.proteinSActivity) : '',
        record.antithrombinActivity !== undefined ? String(record.antithrombinActivity) : '',
        typeof record.lupusAnticoagulantScreen === 'boolean' ? (record.lupusAnticoagulantScreen ? 'Yes' : 'No') : '',
        record.anticardiolipinAntibody || '',
        typeof record.factorVLeidenMutation === 'boolean' ? (record.factorVLeidenMutation ? 'Yes' : 'No') : '',
        typeof record.prothrombinGeneMutation === 'boolean' ? (record.prothrombinGeneMutation ? 'Yes' : 'No') : '',
        record.reptilaseTime !== undefined ? String(record.reptilaseTime) : '',
        record.plateletAggregationStudy || '',
        record.claustThrombelastometry || '',
        'Basic Coagulation', 'Fibrinolysis & Platelet Studies', 'Coagulation Factors',
        'Natural Anticoagulant Inhibitors', 'Thrombophilia Screening', 'Specialized Tests',
        'Prothrombin Time', 'INR', 'aPTT', 'Thrombin Time', 'Fibrinogen Level', 'Platelet Count',
        'Bleeding Time', 'D-Dimer Level', 'Fibrin Degradation Products', 'Factor VII Activity',
        'Factor VIII Activity', 'Factor IX Activity', 'von Willebrand Factor', 'Protein C Activity',
        'Protein S Activity', 'Antithrombin Activity', 'Lupus Anticoagulant Screen',
        'Anticardiolipin Antibody', 'Factor V Leiden Mutation', 'Prothrombin Gene Mutation',
        'Reptilase Time', 'Platelet Aggregation Study', 'Thrombelastometry',
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
    // [label, value] pairs → "Label\n----\n1. value" blocks (labels underlined, VALUES numbered —
    // never numbered labels with indented values). Mirrors the PDF.
    const EQ = '='.repeat(40);
    const DASH = '-'.repeat(40);
    const collectFields = (pairs) => {
      // Drop numeric-0 fields (values arrive stringified; booleans are 'Yes'/'No', never '0') — a 0
      // coagulation value is the "not reported" extraction default, not a real result.
      const valid = pairs.filter(p => p && hasVal(p[1]) && p[1] !== '0');
      return valid.map(([label, val]) => `${label}\n${DASH}\n1. ${val}`).join('\n\n');
    };

    const formatBool = (v) => {
      if (typeof v === 'boolean') return v ? 'Yes' : 'No';
      return String(v);
    };

    switch (sectionId) {
      case 'basic-coag': {
        const fields = collectFields([
          hasVal(r.prothrombinTime) ? ['Prothrombin Time (PT)', String(r.prothrombinTime)] : null,
          hasVal(r.internationalNormalizedRatio) ? ['INR', String(r.internationalNormalizedRatio)] : null,
          hasVal(r.activatedPartialThromboplastinTime) ? ['aPTT', String(r.activatedPartialThromboplastinTime)] : null,
          hasVal(r.thrombinTime) ? ['Thrombin Time', String(r.thrombinTime)] : null,
        ]);
        return fields ? `BASIC COAGULATION\n${EQ}\n\n${fields}` : '';
      }
      case 'fibrinolysis': {
        const fields = collectFields([
          hasVal(r.fibrinogenLevel) ? ['Fibrinogen Level', String(r.fibrinogenLevel)] : null,
          hasVal(r.plateletCount) ? ['Platelet Count', String(r.plateletCount)] : null,
          hasVal(r.bleedingTime) ? ['Bleeding Time', String(r.bleedingTime)] : null,
          hasVal(r.dDimerLevel) ? ['D-Dimer Level', String(r.dDimerLevel)] : null,
          hasVal(r.fibrinDegradationProducts) ? ['Fibrin Degradation Products', String(r.fibrinDegradationProducts)] : null,
        ]);
        return fields ? `FIBRINOLYSIS & PLATELET STUDIES\n${EQ}\n\n${fields}` : '';
      }
      case 'coag-factors': {
        const fields = collectFields([
          hasVal(r.factorViiActivity) ? ['Factor VII Activity', String(r.factorViiActivity)] : null,
          hasVal(r.factorViiiActivity) ? ['Factor VIII Activity', String(r.factorViiiActivity)] : null,
          hasVal(r.factorIxActivity) ? ['Factor IX Activity', String(r.factorIxActivity)] : null,
          hasVal(r.vonWillebrandFactor) ? ['von Willebrand Factor', String(r.vonWillebrandFactor)] : null,
        ]);
        return fields ? `COAGULATION FACTORS\n${EQ}\n\n${fields}` : '';
      }
      case 'inhibitors': {
        const fields = collectFields([
          hasVal(r.proteinCActivity) ? ['Protein C Activity', String(r.proteinCActivity)] : null,
          hasVal(r.proteinSActivity) ? ['Protein S Activity', String(r.proteinSActivity)] : null,
          hasVal(r.antithrombinActivity) ? ['Antithrombin Activity', String(r.antithrombinActivity)] : null,
        ]);
        return fields ? `NATURAL ANTICOAGULANT INHIBITORS\n${EQ}\n\n${fields}` : '';
      }
      case 'thrombophilia': {
        const fields = collectFields([
          hasVal(r.lupusAnticoagulantScreen) ? ['Lupus Anticoagulant Screen', formatBool(r.lupusAnticoagulantScreen)] : null,
          hasVal(r.anticardiolipinAntibody) ? ['Anticardiolipin Antibody', String(r.anticardiolipinAntibody)] : null,
          hasVal(r.factorVLeidenMutation) ? ['Factor V Leiden Mutation', formatBool(r.factorVLeidenMutation)] : null,
          hasVal(r.prothrombinGeneMutation) ? ['Prothrombin Gene Mutation', formatBool(r.prothrombinGeneMutation)] : null,
        ]);
        return fields ? `THROMBOPHILIA SCREENING\n${EQ}\n\n${fields}` : '';
      }
      case 'specialized': {
        const fields = collectFields([
          hasVal(r.reptilaseTime) ? ['Reptilase Time', String(r.reptilaseTime)] : null,
          hasVal(r.plateletAggregationStudy) ? ['Platelet Aggregation Study', String(r.plateletAggregationStudy)] : null,
          hasVal(r.claustThrombelastometry) ? ['Thrombelastometry (ROTEM)', String(r.claustThrombelastometry)] : null,
        ]);
        return fields ? `SPECIALIZED TESTS\n${EQ}\n\n${fields}` : '';
      }
      default: return '';
    }
  };

  const copyAllText = async () => {
    let text = 'COAGULATION STUDIES RECORDS\n\n';
    pdfData.forEach((record, idx) => {
      text += `Coagulation Study ${idx + 1}\n`;
      text += '='.repeat(40) + '\n\n';
      ['basic-coag', 'fibrinolysis', 'coag-factors', 'inhibitors', 'thrombophilia', 'specialized'].forEach(sid => {
        const sectionText = buildSectionCopyText(record, idx, sid);
        if (sectionText) text += sectionText + '\n\n';
      });
      text += '\n';
    });
    copyToClipboard(text.trim(), 'copy-all');
  };

  // ─── Section renderer ────────────────────────────────────────
  const renderSection = (record, idx, sectionId) => {
    const phrase = searchTerm.toLowerCase().trim();
    const sectionTitle = SECTION_TITLES[sectionId];
    const fields = SECTION_FIELDS[sectionId];
    const sectionTitleMatches = phrase && sectionTitle.toLowerCase().includes(phrase);

    const visibleFields = fields.filter(fieldName => {
      const val = getFieldValue(record, fieldName, idx);
      if (!hasVal(val)) return false;
      // Numeric 0 = "not reported" extraction default (see renderEditableField) → hide the row.
      if (NUMBER_FIELDS.includes(fieldName) && Number(val) === 0) return false;
      const label = FIELD_LABELS[fieldName] || fieldName;
      const displayVal = formatDisplayValue(fieldName, val);
      return record._showAllSections || sectionTitleMatches || shouldShowRow(label, displayVal);
    });

    if (visibleFields.length === 0) return null;

    return (
      <div className="mini-cards-container" key={sectionId}>
        <div className="section-header">
          <h4 className="section-title">{highlightText(sectionTitle)}</h4>
          <div className="section-actions">
            <button className={`copy-btn${copiedId === `${sectionId}-${idx}` ? ' copied' : ''}`}
              onClick={() => copyToClipboard(buildSectionCopyText(record, idx, sectionId), `${sectionId}-${idx}`)}>
              {copiedId === `${sectionId}-${idx}` ? 'Copied!' : 'Copy Section'}
            </button>
            {renderApproveButton(record, sectionId, idx)}
          </div>
        </div>
        {visibleFields.map(fieldName => {
          const label = FIELD_LABELS[fieldName] || fieldName;
          return renderEditableField(record, fieldName, label, idx, sectionId);
        })}
      </div>
    );
  };

  // ─── Render ────────────────────────────────────────
  if (!records || records.length === 0) {
    return (
      <div className="coagulation-studies">
        <div className="document-header">
          <h2 className="document-title">Coagulation Studies</h2>
        </div>
        <p className="no-data">No coagulation studies data available.</p>
      </div>
    );
  }

  return (
    <div className="coagulation-studies">
      <div className="document-header">
        <h1 className="document-title">Coagulation Studies</h1>
        <div className="header-actions">
          <button className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`} onClick={copyAllText}>
            {copiedId === 'copy-all' ? 'Copied!' : 'Copy All'}
          </button>
          <PDFDownloadLink document={<CoagulationStudiesDocumentPDFTemplate document={pdfData} />} fileName="Coagulation_Studies.pdf">
            {({ loading }) => (
              <button className={`pdf-btn${copiedId === 'pdf' ? ' copied' : ''}`}>{loading ? 'Preparing...' : 'Export PDF'}</button>
            )}
          </PDFDownloadLink>
        </div>
      </div>

      <SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} placeholder="Search coagulation studies..." />

      {filteredRecords.map((record, idx) => {
        return (
          <div key={idx} className="record-card">
            <div className="record-header">
              <div className="record-meta-row">
                {record.date && <span className="record-date">{highlightText(formatDate(record.date))}</span>}
              </div>
              <div className="record-title-row">
                <h3 className="record-name">{highlightText(`Coagulation Study ${idx + 1}`)}</h3>
              </div>
            </div>

            <div className="card-content">
              {renderSection(record, idx, 'basic-coag')}
              {renderSection(record, idx, 'fibrinolysis')}
              {renderSection(record, idx, 'coag-factors')}
              {renderSection(record, idx, 'inhibitors')}
              {renderSection(record, idx, 'thrombophilia')}
              {renderSection(record, idx, 'specialized')}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default CoagulationStudiesDocument;
