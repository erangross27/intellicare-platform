/**
 * CareTeamDocument.jsx
 * March 2026 blue glow theme with inline editing.
 * 3 editable arrays + flat fields. Collection: care_team
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import CareTeamDocumentPDFTemplate from '../pdf-templates/CareTeamDocumentPDFTemplate';
import './CareTeamDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'care_teamPendingEdits';
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
  leadership: ['teamLeadPhysician', 'provider', 'facility'],
  members: ['teamMembers'],
  consulting: ['consultingPhysicians'],
  specialties: ['medicalSpecialties'],
  diagnosis: ['primaryDiagnosis'],
  goals: ['careCoordinationGoals'],
  roles: ['primaryNurse', 'caseManager', 'socialWorker', 'pharmacistClinical', 'physicalTherapist', 'occupationalTherapist', 'respiratoryTherapist', 'dietitian'],
  communication: ['teamFormationDate', 'teamMeetingFrequency', 'teamCommunicationMethod', 'lastTeamConference'],
  coordination: ['dischargeCoordinator', 'palliativeCareConsult', 'patientAdvocate', 'careTransitionPlan', 'teamDuration'],
};
const FIELD_LABELS = {
  teamLeadPhysician: 'Team Lead', provider: 'Provider', facility: 'Facility', primaryDiagnosis: 'Primary Diagnosis',
  primaryNurse: 'Primary Nurse', caseManager: 'Case Manager', socialWorker: 'Social Worker',
  pharmacistClinical: 'Clinical Pharmacist', physicalTherapist: 'Physical Therapist',
  occupationalTherapist: 'Occupational Therapist', respiratoryTherapist: 'Respiratory Therapist', dietitian: 'Dietitian',
  teamFormationDate: 'Team Formation Date', teamMeetingFrequency: 'Meeting Frequency', teamCommunicationMethod: 'Communication Method', lastTeamConference: 'Last Conference',
  dischargeCoordinator: 'Discharge Coordinator', palliativeCareConsult: 'Palliative Care', patientAdvocate: 'Patient Advocate',
  careTransitionPlan: 'Transition Plan', teamDuration: 'Team Duration',
};
const ARRAY_FIELDS = ['teamMembers', 'consultingPhysicians', 'medicalSpecialties', 'careCoordinationGoals'];
const DATE_FIELDS = ['teamFormationDate', 'lastTeamConference'];
const toInputDate = (d) => { if (!d) return ''; try { const dt = new Date(d.$date || d); return isNaN(dt.getTime()) ? '' : dt.toISOString().split('T')[0]; } catch { return ''; } };

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };

const CareTeamDocument = ({ document: rawDoc }) => {
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
    arr = arr.flatMap(r => {
      if (r?.care_team) return Array.isArray(r.care_team) ? r.care_team : [r.care_team];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.care_team) return Array.isArray(dd.care_team) ? dd.care_team : [dd.care_team]; return [dd]; }
      return r;
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [rawDoc]);

  const getRecordId = (r) => { const id = r._id; if (!id) return null; if (typeof id === 'string') return id; if (id.$oid) return id.$oid; return String(id); };

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const rid = getRecordId(record);
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        // fieldPart = "field" (flat) or "field.arrayIndex" (array element)
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
  const getEffectiveArray = useCallback((record, fieldName, idx) => { const original = Array.isArray(record[fieldName]) ? [...record[fieldName]] : []; original.forEach((_, ai) => { const ek = `${fieldName}-${idx}-${ai}`; if (localEdits[ek] !== undefined && !pendingEdits[ek]) original[ai] = localEdits[ek]; }); return original; }, [localEdits, pendingEdits]);

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid, overrideValue) => {
    const rid = getRecordId(record); if (!rid) { console.error('[CareTeam] Cannot save — no record ID'); return; }
    const val = overrideValue !== undefined ? overrideValue : editValue;
    const ek = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: val }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    // Re-edit after approval → drop the section's 'approved' flag so the button goes back to yellow
    setApprovedSections(prev => { const key = `${sid}-${idx}`; if (!prev[key]) return prev; const n = { ...prev }; delete n[key]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][fn] = val;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue]);

  const handleSaveArrayItem = useCallback((record, fn, idx, sid, arrayIndex) => {
    const rid = getRecordId(record); if (!rid) { console.error('[CareTeam] Cannot save — no record ID'); return; }
    const ek = `${fn}-${idx}-${arrayIndex}`;
    setLocalEdits(prev => ({ ...prev, [ek]: editValue }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    setApprovedSections(prev => { const key = `${sid}-${idx}`; if (!prev[key]) return prev; const n = { ...prev }; delete n[key]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][`${fn}.${arrayIndex}`] = editValue;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue]);

  // Approve = COMMIT all staged drafts for this section + record to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, idx, sid) => {
    const rid = getRecordId(record); if (!rid) return;
    const sf = SECTION_FIELDS[sid] || [];
    try {
      const sc = (await import('../../../services/secureApiClient')).default;
      // Collect this record's pending edits that belong to this section's fields.
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k]) return false;
        // editKey = "field-idx" (flat) or "field-idx-arrayIndex" (array element)
        const parts = k.split('-');
        let field, ki, arrIdx;
        if (parts.length >= 3 && /^\d+$/.test(parts[parts.length - 1]) && /^\d+$/.test(parts[parts.length - 2])) {
          arrIdx = parseInt(parts[parts.length - 1], 10);
          ki = parseInt(parts[parts.length - 2], 10);
          field = parts.slice(0, parts.length - 2).join('-');
        } else {
          ki = parseInt(parts[parts.length - 1], 10);
          field = parts.slice(0, parts.length - 1).join('-');
        }
        return ki === idx && sf.includes(field) && (arrIdx === undefined || true);
      });
      for (const ek of toCommit) {
        const parts = ek.split('-');
        const payload = {};
        if (parts.length >= 3 && /^\d+$/.test(parts[parts.length - 1]) && /^\d+$/.test(parts[parts.length - 2])) {
          payload.field = parts.slice(0, parts.length - 2).join('-');
          payload.arrayIndex = parseInt(parts[parts.length - 1], 10);
        } else {
          payload.field = parts.slice(0, parts.length - 1).join('-');
        }
        payload.value = localEdits[ek];
        await sc.put(`/api/edit/care_team/${rid}/edit`, payload);
      }
      await sc.put(`/api/edit/care_team/${rid}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's committed drafts for this section's fields from localStorage
      const store = readDrafts();
      if (store[rid]) {
        sf.forEach(f => { delete store[rid][f]; Object.keys(store[rid]).forEach(fp => { if (fp.startsWith(`${f}.`)) delete store[rid][fp]; }); });
        if (Object.keys(store[rid]).length === 0) delete store[rid];
        writeDrafts(store);
      }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { sf.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[CareTeam] Approve failed:', err); }
  }, [localEdits, pendingEdits]);

  const highlightText = (text) => { if (!text) return ''; const str = String(text); if (!searchTerm.trim()) return str; const esc = searchTerm.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const re = new RegExp(`(${esc})`, 'gi'); const p = str.split(re); if (p.length === 1) return str; return <>{p.map((x, i) => re.test(x) ? <mark key={i}>{x}</mark> : x)}</>; };
  const phraseMatch = (text, term) => { if (!term.trim()) return true; return String(text || '').toLowerCase().includes(term.toLowerCase().trim()); };
  const shouldShowSection = (record, title, contentParts, fieldNames) => { if (!searchTerm.trim()) return true; if (record._showAllSections) return true; const sl = searchTerm.toLowerCase().trim(); const tl = (title || '').toLowerCase(); if (tl.startsWith(sl) || sl.startsWith(tl)) return true; const labels = (fieldNames || []).map(f => FIELD_LABELS[f] || f); const combined = [...labels, ...(Array.isArray(contentParts) ? contentParts : [contentParts])].filter(Boolean).join(' '); return phraseMatch(combined, searchTerm); };
  const sectionTitleMatches = (t) => { if (!searchTerm.trim()) return false; const sl = searchTerm.toLowerCase().trim(); const tl = (t || '').toLowerCase(); return tl.startsWith(sl) || sl.startsWith(tl); };
  const fieldMatches = (record, fn, idx) => { if (!searchTerm.trim()) return true; if (record._showAllSections) return true; return phraseMatch(FIELD_LABELS[fn] || fn, searchTerm) || phraseMatch(fmtVal(getFieldValue(record, fn, idx)), searchTerm); };

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const sl = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      const title = `Care Team ${idx + 1}`;
      const allText = [title, formatDate(record.date), ...Object.keys(FIELD_LABELS).map(f => fmtVal(record[f])), ...ARRAY_FIELDS.flatMap(f => Array.isArray(record[f]) ? record[f] : []), ...Object.values(FIELD_LABELS), 'Leadership', 'Team Members', 'Specialties', 'Diagnosis', 'Goals', 'Clinical Roles', 'Communication', 'Coordination'].filter(Boolean).join(' ');
      const match = allText.toLowerCase().includes(sl);
      record._showAllSections = match && title.toLowerCase().startsWith(sl);
      return match;
    });
  }, [records, searchTerm]);

  const sectionHasEdits = (idx, sid) => { const fs = SECTION_FIELDS[sid] || []; return fs.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`))); };
  const renderApproveButton = (idx, sid) => { const he = sectionHasEdits(idx, sid); const ia = approvedSections[`${sid}-${idx}`]; if (he) return <button className="approve-btn pending" onClick={(e) => { e.stopPropagation(); handleApproveSection(records[idx], idx, sid); }}>Pending Approve</button>; if (ia) return <span className="approve-btn approved">Approved</span>; return null; };

  const renderDateField = (record, fn, idx, sid) => {
    const raw = getFieldValue(record, fn, idx); if (!hasVal(raw)) return null;
    const dv = formatDate(raw); const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`;
    const saveDate = () => { if (isNaN(new Date(editValue).getTime())) return; handleSaveField(record, fn, idx, sid, `${editValue}T00:00:00.000Z`); };
    if (ie) return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div><div className="edit-field-container"><input type="date" className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} ref={el => { if (el) { try { el.showPicker(); } catch {} } }} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={saveDate} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(toInputDate(raw)); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  const renderEditableField = (record, fn, idx, sid) => {
    const raw = getFieldValue(record, fn, idx); if (!hasVal(raw)) return null;
    const dv = fmtVal(raw); const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`;
    if (ie) return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveField(record, fn, idx, sid); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => handleSaveField(record, fn, idx, sid)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
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
    return records.map((record, idx) => { const m = { ...record }; Object.keys(localEdits).forEach(key => { if (pendingEdits[key]) return; const ld = key.lastIndexOf('-'); if (ld === -1) return; const fn = key.substring(0, ld); const ri = parseInt(key.substring(ld + 1), 10); if (ri === idx && fn in record) m[fn] = localEdits[key]; }); ARRAY_FIELDS.forEach(field => { m[field] = getEffectiveArray(record, field, idx); }); return m; });
  }, [records, localEdits, pendingEdits, getEffectiveArray]);

  const SECTION_TITLES = { leadership: 'LEADERSHIP', members: 'TEAM MEMBERS', consulting: 'CONSULTING PHYSICIANS', specialties: 'MEDICAL SPECIALTIES', diagnosis: 'PRIMARY DIAGNOSIS', goals: 'CARE COORDINATION GOALS', roles: 'CLINICAL ROLES', communication: 'COMMUNICATION', coordination: 'COORDINATION' };

  const copySectionText = (record, idx, sid) => {
    const pr = pdfData[idx] || record; let text = `${SECTION_TITLES[sid] || sid.toUpperCase()}\n`;
    const addF = (fn) => { if (hasVal(pr[fn])) text += `${FIELD_LABELS[fn]}: ${DATE_FIELDS.includes(fn) ? formatDate(pr[fn]) : fmtVal(pr[fn])}\n`; };
    const addArr = (fn) => { getEffectiveArray(pr, fn, idx).forEach((it, i) => { text += `${i + 1}. ${it}\n`; }); };
    if (sid === 'members') { addArr('teamMembers'); }
    else if (sid === 'consulting') { addArr('consultingPhysicians'); }
    else if (sid === 'specialties') { addArr('medicalSpecialties'); }
    else if (sid === 'goals') { addArr('careCoordinationGoals'); }
    else { (SECTION_FIELDS[sid] || []).forEach(addF); }
    copyToClipboard(text.trim(), `section-${sid}-${idx}`);
  };

  const copyAllContent = () => {
    let text = '=== CARE TEAM ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Care Team ${idx + 1}\n`;
      if (r.date) text += `${formatDate(r.date)}\n`;
      const addF = (fn) => { if (hasVal(r[fn])) text += `${FIELD_LABELS[fn]}: ${DATE_FIELDS.includes(fn) ? formatDate(r[fn]) : fmtVal(r[fn])}\n`; };
      const addArr = (title, fn) => { const items = getEffectiveArray(r, fn, idx); if (items.length) { text += `\n${title}\n`; items.forEach((it, i) => { text += `${i + 1}. ${it}\n`; }); } };
      const simpleFs = (title, fields) => { const vis = fields.filter(f => hasVal(r[f])); if (vis.length) { text += `\n${title}\n`; vis.forEach(addF); } };
      simpleFs('LEADERSHIP', ['teamLeadPhysician', 'provider', 'facility']);
      addArr('TEAM MEMBERS', 'teamMembers');
      addArr('CONSULTING PHYSICIANS', 'consultingPhysicians');
      addArr('MEDICAL SPECIALTIES', 'medicalSpecialties');
      if (hasVal(r.primaryDiagnosis)) { text += `\nPRIMARY DIAGNOSIS\n${r.primaryDiagnosis}\n`; }
      addArr('CARE COORDINATION GOALS', 'careCoordinationGoals');
      simpleFs('CLINICAL ROLES', ['primaryNurse', 'caseManager', 'socialWorker', 'pharmacistClinical', 'physicalTherapist', 'occupationalTherapist', 'respiratoryTherapist', 'dietitian']);
      simpleFs('COMMUNICATION', ['teamFormationDate', 'teamMeetingFrequency', 'teamCommunicationMethod', 'lastTeamConference']);
      simpleFs('COORDINATION', ['dischargeCoordinator', 'palliativeCareConsult', 'patientAdvocate', 'careTransitionPlan', 'teamDuration']);
      text += '\n';
    });
    copyToClipboard(text.trim(), 'copy-all');
  };

  const renderSection = (record, idx, sid, title, children) => { if (!children) return null; return (<div className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn${copiedId === `section-${sid}-${idx}` ? ' copied' : ''}`} onClick={() => copySectionText(record, idx, sid)}>{copiedId === `section-${sid}-${idx}` ? 'Copied' : 'Copy Section'}</button>{renderApproveButton(idx, sid)}</div></div>{children}</div></div>); };

  const renderMultiFieldSection = (record, idx, sid, title, fields) => {
    const visibleFields = fields.filter(f => hasVal(getFieldValue(record, f, idx)));
    if (visibleFields.length === 0) return null;
    if (!shouldShowSection(record, title, visibleFields.map(f => fmtVal(getFieldValue(record, f, idx))), visibleFields)) return null;
    return renderSection(record, idx, sid, title, (() => { const stm = sectionTitleMatches(title); const sa = !searchTerm.trim() || record._showAllSections || stm; return <>{visibleFields.map(f => { if (!sa && !fieldMatches(record, f, idx)) return null; return <React.Fragment key={f}>{DATE_FIELDS.includes(f) ? renderDateField(record, f, idx, sid) : renderEditableField(record, f, idx, sid)}</React.Fragment>; })}</>; })());
  };

  const renderArraySection = (record, idx, sid, title, fieldName) => {
    const items = Array.isArray(record[fieldName]) ? record[fieldName].filter(Boolean) : [];
    if (items.length === 0) return null;
    if (!shouldShowSection(record, title, items, [fieldName])) return null;
    return renderSection(record, idx, sid, title, (() => { const stm = sectionTitleMatches(title); const sa = !searchTerm.trim() || record._showAllSections || stm; return items.map((item, ai) => { const val = localEdits[`${fieldName}-${idx}-${ai}`] !== undefined ? localEdits[`${fieldName}-${idx}-${ai}`] : item; if (!sa && !phraseMatch(val, searchTerm)) return null; return renderEditableArrayItem(record, fieldName, idx, sid, item, ai); }).filter(Boolean); })());
  };

  if (!filteredRecords || filteredRecords.length === 0) return (<article className="care-team-document"><header className="document-header"><h1 className="document-title">Care Team</h1></header><SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} /><div className="empty-state">No data available.</div></article>);

  return (
    <article className="care-team-document">
      <header className="document-header">
        <h1 className="document-title">Care Team</h1>
        <div className="header-actions">
          <button className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`} onClick={copyAllContent}>{copiedId === 'copy-all' ? 'Copied' : 'Copy All'}</button>
          <PDFDownloadLink document={<CareTeamDocumentPDFTemplate document={pdfData} />} fileName="Care_Team.pdf">
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
              <div className="record-title-row"><h3 className="record-name">{highlightText(`Care Team ${idx + 1}`)}</h3></div>
            </div>
            {renderMultiFieldSection(record, idx, 'leadership', 'Leadership', SECTION_FIELDS.leadership)}
            {renderArraySection(record, idx, 'members', 'Team Members', 'teamMembers')}
            {renderArraySection(record, idx, 'consulting', 'Consulting Physicians', 'consultingPhysicians')}
            {renderArraySection(record, idx, 'specialties', 'Medical Specialties', 'medicalSpecialties')}
            {hasVal(getFieldValue(record, 'primaryDiagnosis', idx)) && shouldShowSection(record, 'Primary Diagnosis', [fmtVal(getFieldValue(record, 'primaryDiagnosis', idx))], ['primaryDiagnosis']) && renderSection(record, idx, 'diagnosis', 'Primary Diagnosis', renderEditableField(record, 'primaryDiagnosis', idx, 'diagnosis'))}
            {renderArraySection(record, idx, 'goals', 'Care Coordination Goals', 'careCoordinationGoals')}
            {renderMultiFieldSection(record, idx, 'roles', 'Clinical Roles', SECTION_FIELDS.roles)}
            {renderMultiFieldSection(record, idx, 'communication', 'Communication', SECTION_FIELDS.communication)}
            {renderMultiFieldSection(record, idx, 'coordination', 'Coordination', SECTION_FIELDS.coordination)}
          </div>
        ))}
      </div>
    </article>
  );
};

export default CareTeamDocument;
