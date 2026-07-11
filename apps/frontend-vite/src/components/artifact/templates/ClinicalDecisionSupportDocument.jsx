/**
 * ClinicalDecisionSupportDocument.jsx
 * March 2026 — Blue glow editing theme
 * Collection: clinical_decision_support
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import ClinicalDecisionSupportPDFTemplate from '../pdf-templates/ClinicalDecisionSupportPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './ClinicalDecisionSupportDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = editKey without the "-<idx>" suffix) */
const DRAFT_KEY = 'clinical_decision_supportPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

const SECTION_TITLES = {
  overallRisk: 'Overall Risk',
  redFlags: 'Red Flags',
  riskFactors: 'Risk Factors',
  mitigatingFactors: 'Mitigating Factors',
  drugInteractions: 'Drug Interactions',
  contraindications: 'Contraindications',
};

const SECTION_EDIT_PREFIXES = {
  overallRisk: ['riskAssessment.overallRisk', 'riskAssessment.riskDescription'],
  redFlags: ['redFlags'],
  riskFactors: ['riskAssessment.riskFactors'],
  mitigatingFactors: ['riskAssessment.mitigatingFactors'],
  drugInteractions: ['drugInteractions'],
  contraindications: ['contraindications'],
};

// Risk/severity/urgency LEVEL fields → enum dropdown. User-specified wording: Low / Moderate / High /
// Very High (Moderate, not Medium — matches stored data). enumOptionsWith keeps any unmatched current
// value (e.g. "High (post-STEMI, very high-risk)") so nothing is lost.
const RISK_LEVELS = ['Low', 'Moderate', 'High', 'Very High'];
const isLevelPath = (dotPath) => /\.(severity|urgency)$/.test(dotPath) || dotPath === 'riskAssessment.overallRisk';
const enumOptionsWith = (opts, current) => { const cur = String(current ?? '').trim(); return cur && !opts.some(o => o.toLowerCase() === cur.toLowerCase()) ? [cur, ...opts] : opts; };
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);

const ClinicalDecisionSupportDocument = ({ document: docProp }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSection, setCopiedSection] = useState(null);
  const [copiedItems, setCopiedItems] = useState({});
  const [showCopied, setShowCopied] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [editedFields, setEditedFields] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const [saving, setSaving] = useState(false);
  const containerRef = useRef(null);

  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.clinical_decision_support) return Array.isArray(r.clinical_decision_support) ? r.clinical_decision_support : [r.clinical_decision_support];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.clinical_decision_support) return Array.isArray(dd.clinical_decision_support) ? dd.clinical_decision_support : [dd.clinical_decision_support]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  const recordId = useCallback((record) => {
    if (!record?._id) return null;
    if (typeof record._id === 'string') return record._id;
    if (record._id.$oid) return record._id.$oid;
    return String(record._id);
  }, []);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nEdited = {};
    records.forEach((record, idx) => {
      const id = recordId(record);
      const recDrafts = id ? store[id] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        nEdited[editKey] = 'edited';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nEdited, ...prev }));
  }, [records, recordId]);

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

  const safeId = useCallback((record) => {
    if (!record?._id) return null;
    if (typeof record._id === 'string') return record._id;
    if (record._id.$oid) return record._id.$oid;
    return String(record._id);
  }, []);

  const getLocalEdit = useCallback((key) => localEdits[key], [localEdits]);

  const highlightText = useCallback((text) => {
    if (!searchTerm.trim() || !text) return text;
    const phrase = searchTerm.trim();
    const regex = new RegExp(`(${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = String(text).split(regex);
    return parts.map((part, i) => regex.test(part) ? <mark key={i}>{part}</mark> : part);
  }, [searchTerm]);

  const shouldShowSection = useCallback((record, sectionId) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const title = (SECTION_TITLES[sectionId] || '').toLowerCase();
    if (title.includes(phrase) || phrase.includes(title)) return true;
    return false;
  }, [searchTerm]);

  const sectionTitleMatches = useCallback((sectionId) => {
    if (!searchTerm.trim()) return false;
    const phrase = searchTerm.toLowerCase().trim();
    const title = (SECTION_TITLES[sectionId] || '').toLowerCase();
    return title.includes(phrase) || phrase.includes(title);
  }, [searchTerm]);

  const contentMatches = useCallback((text) => {
    if (!searchTerm.trim()) return true;
    return String(text || '').toLowerCase().includes(searchTerm.toLowerCase().trim());
  }, [searchTerm]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const recordTitle = `Clinical Decision Support ${idx + 1}`.toLowerCase();
      if (recordTitle.includes(phrase) || phrase.includes(recordTitle)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) {
        if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true;
      }
      const ra = record.riskAssessment;
      if (ra) {
        if (contentMatches(ra.overallRisk) || contentMatches(ra.riskDescription)) return true;
        if (ra.riskFactors?.some(f => contentMatches(f.factor) || contentMatches(f.severity) || contentMatches(f.evidence))) return true;
        if (ra.mitigatingFactors?.some(f => contentMatches(f))) return true;
      }
      if (record.redFlags?.some(f => contentMatches(f.finding) || contentMatches(f.urgency) || contentMatches(f.action) || contentMatches(f.timeframe))) return true;
      if (record.drugInteractions?.some(d => d.medications?.some(m => contentMatches(m)) || contentMatches(d.severity) || contentMatches(d.mechanism) || contentMatches(d.clinicalEffect) || contentMatches(d.recommendation))) return true;
      if (record.contraindications?.some(c => contentMatches(c.medication) || contentMatches(c.condition) || contentMatches(c.severity) || contentMatches(c.alternative))) return true;
      return false;
    });
  }, [records, searchTerm, contentMatches]);

  const pdfData = useMemo(() => {
    return filteredRecords.map((record, idx) => {
      if (Object.keys(localEdits).length === 0) return record;
      const merged = JSON.parse(JSON.stringify(record));
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF until approved
        if (!key.endsWith(`-${idx}`)) return;
        const path = key.replace(`-${idx}`, '');
        const parts = path.split('.');
        let obj = merged;
        for (let i = 0; i < parts.length - 1; i++) {
          const p = isNaN(parts[i]) ? parts[i] : parseInt(parts[i]);
          if (obj[p] === undefined) return;
          obj = obj[p];
        }
        const lastPart = isNaN(parts[parts.length - 1]) ? parts[parts.length - 1] : parseInt(parts[parts.length - 1]);
        obj[lastPart] = localEdits[key];
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  // ========== EDIT ==========
  // Stage a DRAFT (field part = the full dotPath). NOT written to MongoDB and NOT shown in the PDF
  // until the user clicks Pending Approve (handleApproveSection commits). Survives refresh via localStorage.
  const handleSaveDotPath = useCallback((record, dotPath, idx) => {
    const id = safeId(record);
    if (!id) return;
    const value = editValue;
    const editKey = `${dotPath}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: value }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    // Re-edit after approval → drop the section's 'approved' flag so the button goes back to yellow
    const sectionId = Object.keys(SECTION_EDIT_PREFIXES).find(sid =>
      (SECTION_EDIT_PREFIXES[sid] || []).some(p => dotPath.startsWith(p)));
    if (sectionId) setApprovedSections(prev => {
      const k = `${sectionId}-${idx}`;
      if (!prev[k]) return prev;
      const next = { ...prev }; delete next[k]; return next;
    });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][dotPath] = value;
    writeDrafts(store);
    setEditingField(null);
    setEditValue('');
  }, [editValue, safeId]);

  // Stage a DRAFT for an array element (field part = `${fieldName}.${arrayIndex}`). No DB write until Approve.
  const handleSaveArrayItem = useCallback((record, fieldName, idx, arrayIndex) => {
    const id = safeId(record);
    if (!id) return;
    const value = editValue;
    const fieldPart = `${fieldName}.${arrayIndex}`;
    const editKey = `${fieldPart}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: value }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    const sectionId = Object.keys(SECTION_EDIT_PREFIXES).find(sid =>
      (SECTION_EDIT_PREFIXES[sid] || []).some(p => fieldPart.startsWith(p)));
    if (sectionId) setApprovedSections(prev => {
      const k = `${sectionId}-${idx}`;
      if (!prev[k]) return prev;
      const next = { ...prev }; delete next[k]; return next;
    });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fieldPart] = value;
    writeDrafts(store);
    setEditingField(null);
    setEditValue('');
  }, [editValue, safeId]);

  const sectionHasEdits = useCallback((idx, sectionId) => {
    const prefixes = SECTION_EDIT_PREFIXES[sectionId] || [];
    return prefixes.some(p => Object.keys(editedFields).some(k => k.startsWith(`${p}`) && k.endsWith(`-${idx}`)));
  }, [editedFields]);

  // Approve = COMMIT all staged drafts for this section to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sectionId, idx) => {
    const id = safeId(record);
    if (!id) return;
    const prefixes = SECTION_EDIT_PREFIXES[sectionId] || [];
    const suffix = `-${idx}`;
    const toCommit = Object.keys(localEdits).filter(k =>
      pendingEdits[k] && k.endsWith(suffix) &&
      prefixes.some(p => k.slice(0, -suffix.length).startsWith(p)));
    setSaving(true);
    try {
      // Persist each staged field to the DB now. arrayIndex is added ONLY when the segment after the
      // LAST dot of the fieldPart is purely numeric (reverses handleSaveArrayItem's `${field}.${arrayIndex}`).
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length);
        const lastDot = fieldPart.lastIndexOf('.');
        const tail = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const payload = { value: localEdits[editKey] };
        if (lastDot !== -1 && /^\d+$/.test(tail)) {
          payload.field = fieldPart.slice(0, lastDot);
          payload.arrayIndex = parseInt(tail, 10);
        } else {
          payload.field = fieldPart;
        }
        const resp = await secureApiClient.put(`/api/edit/clinical_decision_support/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      await secureApiClient.put(`/api/edit/clinical_decision_support/${id}/approve`, { sectionId, approved: true });
      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => {
        const next = { ...prev };
        toCommit.forEach(k => delete next[k]);
        return next;
      });
      // Drop this record's committed drafts from localStorage
      const store = readDrafts();
      if (store[id]) {
        toCommit.forEach(k => { delete store[id][k.slice(0, -suffix.length)]; });
        if (Object.keys(store[id]).length === 0) delete store[id];
        writeDrafts(store);
      }
      setApprovedSections(prev => ({ ...prev, [`${sectionId}-${idx}`]: true }));
      setEditedFields(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(k => { prefixes.forEach(p => { if (k.startsWith(p) && k.endsWith(`-${idx}`)) delete next[k]; }); });
        return next;
      });
    } catch (err) { console.error('[CDS] Approve error:', err); }
    finally { setSaving(false); }
  }, [safeId, localEdits, pendingEdits]);

  const renderApproveButton = useCallback((record, sectionId, idx) => {
    const hasEdits = sectionHasEdits(idx, sectionId);
    const isApproved = approvedSections[`${sectionId}-${idx}`];
    if (hasEdits) return (<button className="approve-btn pending" disabled={saving} onClick={e => { e.stopPropagation(); handleApproveSection(record, sectionId, idx); }}>{saving ? 'Approving...' : 'Pending Approve'}</button>);
    if (isApproved) return <span className="approve-btn approved">Approved</span>;
    return null;
  }, [sectionHasEdits, approvedSections, handleApproveSection, saving]);

  // ========== COPY ==========
  const copyToClipboard = useCallback(async (text) => {
    try { await navigator.clipboard.writeText(text); return true; } catch {
      const ta = window.document.createElement('textarea'); ta.value = text; ta.style.position = 'absolute'; ta.style.left = '-9999px';
      (containerRef.current || window.document.body).appendChild(ta); ta.select(); window.document.execCommand('copy');
      (containerRef.current || window.document.body).removeChild(ta); return true;
    }
  }, []);
  const copySection = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedSection(id); setTimeout(() => setCopiedSection(null), 2000); } }, [copyToClipboard]);
  const copyItem = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedItems(prev => ({ ...prev, [id]: true })); setTimeout(() => setCopiedItems(prev => ({ ...prev, [id]: false })), 2000); } }, [copyToClipboard]);

  // Sub-fields → "Label\n----\n1. value" (numbered, never side-by-side "Label: value").
  const emitPairs = useCallback((pairs) => pairs.filter(([, v]) => hasVal(v)).map(([l, v]) => `${l}\n${COPY_LINE_DASH}\n1. ${v}\n`).join('\n'), [hasVal]);
  const hasSection = useCallback((pr, sid) => {
    const ra = pr.riskAssessment || {};
    if (sid === 'overallRisk') return hasVal(ra.overallRisk) || hasVal(ra.riskDescription);
    if (sid === 'riskFactors') return (ra.riskFactors || []).length > 0;
    if (sid === 'mitigatingFactors') return (ra.mitigatingFactors || []).length > 0;
    if (sid === 'redFlags') return (pr.redFlags || []).length > 0;
    if (sid === 'drugInteractions') return (pr.drugInteractions || []).length > 0;
    if (sid === 'contraindications') return (pr.contraindications || []).length > 0;
    return false;
  }, [hasVal]);
  // Section copy: EQ under title; each array item = its name (DASH) + numbered sub-fields. Mirrors the JSX.
  const buildSectionCopy = useCallback((record, idx, sectionId) => {
    const pr = pdfData[idx] || record;
    const ra = pr.riskAssessment || {};
    let t = `${SECTION_TITLES[sectionId]}\n${COPY_LINE_EQ}\n\n`;
    if (sectionId === 'overallRisk') {
      t += emitPairs([['Risk Level', ra.overallRisk], ['Description', ra.riskDescription]]);
    } else if (sectionId === 'riskFactors') {
      (ra.riskFactors || []).forEach(f => { t += `${f.factor || 'Risk Factor'}\n${COPY_LINE_DASH}\n${emitPairs([['Severity', f.severity], ['Evidence', f.evidence]])}\n`; });
    } else if (sectionId === 'mitigatingFactors') {
      let n = 0; (ra.mitigatingFactors || []).forEach(f => { if (hasVal(f)) t += `${++n}. ${f}\n`; });
    } else if (sectionId === 'redFlags') {
      (pr.redFlags || []).forEach(f => { t += `${f.finding || 'Red Flag'}\n${COPY_LINE_DASH}\n${emitPairs([['Urgency', f.urgency], ['Action Required', f.action], ['Timeframe', f.timeframe]])}\n`; });
    } else if (sectionId === 'drugInteractions') {
      (pr.drugInteractions || []).forEach(d => { t += `${d.medications?.join(' + ') || 'Interaction'}\n${COPY_LINE_DASH}\n${emitPairs([['Severity', d.severity], ['Mechanism', d.mechanism], ['Clinical Effect', d.clinicalEffect], ['Recommendation', d.recommendation]])}\n`; });
    } else if (sectionId === 'contraindications') {
      (pr.contraindications || []).forEach(c => { t += `${c.medication || 'Contraindication'}\n${COPY_LINE_DASH}\n${emitPairs([['Condition', c.condition], ['Severity', c.severity], ['Alternative', c.alternative]])}\n`; });
    }
    return t.trimEnd() + '\n';
  }, [pdfData, hasVal, emitPairs]);

  const copyAllText = useCallback(async () => {
    let text = `CLINICAL DECISION SUPPORT\n${COPY_LINE_EQ}\n\n`;
    pdfData.forEach((r, idx) => {
      text += `Clinical Decision Support ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
      ['overallRisk', 'redFlags', 'riskFactors', 'mitigatingFactors', 'drugInteractions', 'contraindications'].forEach(sid => {
        if (hasSection(r, sid)) text += buildSectionCopy(r, idx, sid) + '\n';
      });
    });
    const ok = await copyToClipboard(text.trim());
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, hasSection, buildSectionCopy]);

  // ========== RENDER HELPERS ==========
  const renderEditableProperty = (record, dotPath, idx, sectionId, label, value) => {
    const editKey = `${dotPath}-${idx}`;
    const localVal = getLocalEdit(editKey);
    const displayVal = localVal !== undefined ? localVal : fmtVal(value);
    const isEditing = editingField === editKey;
    const badge = editedFields[editKey];
    if (!hasVal(value) && !localVal) return null;
    const isSearching = searchTerm.trim().length > 0;
    const stm = sectionTitleMatches(sectionId);
    if (isSearching && !record._showAllSections && !stm && !contentMatches(displayVal) && !contentMatches(label)) return null;

    // Risk/severity/urgency level fields edit as an enum dropdown (Low/Moderate/High/Very High).
    const isLevel = isLevelPath(dotPath);
    const enumOpts = isLevel ? enumOptionsWith(RISK_LEVELS, displayVal) : null;
    const startVal = isLevel ? (enumOpts.find(o => o.toLowerCase() === String(displayVal).toLowerCase()) || displayVal) : displayVal;

    return (
      <div key={dotPath}>
        <div className="nested-subtitle">{highlightText(label)}</div>
        <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(startVal); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              {isLevel ? (
                <select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} disabled={saving}>
                  {enumOpts.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} />
              )}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveDotPath(record, dotPath, idx); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">✎</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {badge && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  const renderObjectArraySection = (record, idx, sectionId, fieldPath, items, renderItem) => {
    if (!items || items.length === 0) return null;
    const title = SECTION_TITLES[sectionId];
    const isSearching = searchTerm.trim().length > 0;
    if (isSearching && !record._showAllSections && !shouldShowSection(record, sectionId)) {
      const hasMatch = items.some((item, ai) => renderItem(item, ai, true));
      if (!hasMatch) return null;
    }
    const copyId = `${sectionId}-${idx}`;
    return (
      <div className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(title)}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => {
                let text = `${title}\n${'='.repeat(40)}\n\n`;
                items.forEach((item, i) => { text += renderItem(item, i, false, true); });
                copySection(text, copyId);
              }}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sectionId, idx)}
            </div>
          </div>
          {items.map((item, ai) => {
            const content = renderItem(item, ai, false, false, record, idx);
            return content;
          })}
        </div>
      </div>
    );
  };

  // ========== SECTION RENDERS ==========
  const renderOverallRisk = (record, idx) => {
    const ra = record.riskAssessment;
    if (!ra || (!hasVal(ra.overallRisk) && !hasVal(ra.riskDescription))) return null;
    if (!shouldShowSection(record, 'overallRisk') && searchTerm.trim() && !record._showAllSections) {
      if (!contentMatches(ra.overallRisk) && !contentMatches(ra.riskDescription)) return null;
    }
    const copyId = `overallRisk-${idx}`;
    return (
      <div className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText('Overall Risk')}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopy(record, idx, 'overallRisk'), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, 'overallRisk', idx)}
            </div>
          </div>
          {renderEditableProperty(record, 'riskAssessment.overallRisk', idx, 'overallRisk', 'Risk Level', ra.overallRisk)}
          {renderEditableProperty(record, 'riskAssessment.riskDescription', idx, 'overallRisk', 'Description', ra.riskDescription)}
        </div>
      </div>
    );
  };

  const renderRedFlags = (record, idx) => {
    const flags = record.redFlags;
    if (!flags || flags.length === 0) return null;
    const title = 'Red Flags';
    const stm = sectionTitleMatches('redFlags');
    const isSearching = searchTerm.trim().length > 0;
    if (isSearching && !record._showAllSections && !stm) {
      if (!flags.some(f => contentMatches(f.finding) || contentMatches(f.urgency) || contentMatches(f.action) || contentMatches(f.timeframe))) return null;
    }
    const copyId = `redFlags-${idx}`;
    return (
      <div className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(title)}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopy(record, idx, 'redFlags'), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, 'redFlags', idx)}
            </div>
          </div>
          {flags.map((flag, ai) => {
            if (isSearching && !record._showAllSections && !stm && !contentMatches(flag.finding) && !contentMatches(flag.urgency) && !contentMatches(flag.action) && !contentMatches(flag.timeframe)) return null;
            return (
              <div key={ai} className="rec-mini-card">
                <div className="nested-subtitle">{highlightText(flag.finding || `Red Flag ${ai + 1}`)}</div>
                {renderEditableProperty(record, `redFlags.${ai}.urgency`, idx, 'redFlags', 'Urgency', flag.urgency)}
                {renderEditableProperty(record, `redFlags.${ai}.action`, idx, 'redFlags', 'Action Required', flag.action)}
                {renderEditableProperty(record, `redFlags.${ai}.timeframe`, idx, 'redFlags', 'Timeframe', flag.timeframe)}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderRiskFactors = (record, idx) => {
    const factors = record.riskAssessment?.riskFactors;
    if (!factors || factors.length === 0) return null;
    const title = 'Risk Factors';
    const stm = sectionTitleMatches('riskFactors');
    const isSearching = searchTerm.trim().length > 0;
    if (isSearching && !record._showAllSections && !stm) {
      if (!factors.some(f => contentMatches(f.factor) || contentMatches(f.severity) || contentMatches(f.evidence))) return null;
    }
    const copyId = `riskFactors-${idx}`;
    return (
      <div className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(title)}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopy(record, idx, 'riskFactors'), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, 'riskFactors', idx)}
            </div>
          </div>
          {factors.map((factor, ai) => {
            if (isSearching && !record._showAllSections && !stm && !contentMatches(factor.factor) && !contentMatches(factor.severity) && !contentMatches(factor.evidence)) return null;
            return (
              <div key={ai} className="rec-mini-card">
                <div className="nested-subtitle">{highlightText(factor.factor || `Risk Factor ${ai + 1}`)}</div>
                {renderEditableProperty(record, `riskAssessment.riskFactors.${ai}.severity`, idx, 'riskFactors', 'Severity', factor.severity)}
                {renderEditableProperty(record, `riskAssessment.riskFactors.${ai}.evidence`, idx, 'riskFactors', 'Evidence', factor.evidence)}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderMitigatingFactors = (record, idx) => {
    const factors = record.riskAssessment?.mitigatingFactors;
    if (!factors || factors.length === 0) return null;
    const title = 'Mitigating Factors';
    const stm = sectionTitleMatches('mitigatingFactors');
    const isSearching = searchTerm.trim().length > 0;
    if (isSearching && !record._showAllSections && !stm) {
      if (!factors.some(f => contentMatches(f))) return null;
    }
    const copyId = `mitigatingFactors-${idx}`;
    return (
      <div className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(title)}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopy(record, idx, 'mitigatingFactors'), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, 'mitigatingFactors', idx)}
            </div>
          </div>
          <div className="rec-mini-card">
            {factors.map((factor, ai) => {
              if (isSearching && !record._showAllSections && !stm && !contentMatches(factor)) return null;
              const editKey = `riskAssessment.mitigatingFactors.${ai}-${idx}`;
              const localVal = getLocalEdit(editKey);
              const displayVal = localVal !== undefined ? localVal : factor;
              const isEditing = editingField === editKey;
              const badge = editedFields[editKey];
              return (
                <div key={ai}>
                  <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); } }}>
                    {isEditing ? (
                      <div className="edit-field-container">
                        <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} />
                        <div className="edit-actions">
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); handleSaveArrayItem(record, 'riskAssessment.mitigatingFactors', idx, ai); }}>{saving ? 'Saving...' : 'Save'}</button>
                          <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">✎</span></div>
                        <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(displayVal, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                      </>
                    )}
                  </div>
                  {badge && <span className="modified-badge">edited - click Pending Approve to save</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderDrugInteractions = (record, idx) => {
    const interactions = record.drugInteractions;
    if (!interactions || interactions.length === 0) return null;
    const title = 'Drug Interactions';
    const stm = sectionTitleMatches('drugInteractions');
    const isSearching = searchTerm.trim().length > 0;
    if (isSearching && !record._showAllSections && !stm) {
      if (!interactions.some(d => d.medications?.some(m => contentMatches(m)) || contentMatches(d.severity) || contentMatches(d.mechanism) || contentMatches(d.clinicalEffect) || contentMatches(d.recommendation))) return null;
    }
    const copyId = `drugInteractions-${idx}`;
    return (
      <div className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(title)}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopy(record, idx, 'drugInteractions'), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, 'drugInteractions', idx)}
            </div>
          </div>
          {interactions.map((di, ai) => {
            if (isSearching && !record._showAllSections && !stm && !di.medications?.some(m => contentMatches(m)) && !contentMatches(di.severity) && !contentMatches(di.mechanism) && !contentMatches(di.clinicalEffect) && !contentMatches(di.recommendation)) return null;
            const medsLabel = di.medications?.join(' + ') || `Interaction ${ai + 1}`;
            return (
              <div key={ai} className="rec-mini-card">
                <div className="nested-subtitle">{highlightText(medsLabel)}</div>
                {renderEditableProperty(record, `drugInteractions.${ai}.severity`, idx, 'drugInteractions', 'Severity', di.severity)}
                {renderEditableProperty(record, `drugInteractions.${ai}.mechanism`, idx, 'drugInteractions', 'Mechanism', di.mechanism)}
                {renderEditableProperty(record, `drugInteractions.${ai}.clinicalEffect`, idx, 'drugInteractions', 'Clinical Effect', di.clinicalEffect)}
                {renderEditableProperty(record, `drugInteractions.${ai}.recommendation`, idx, 'drugInteractions', 'Recommendation', di.recommendation)}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderContraindications = (record, idx) => {
    const contras = record.contraindications;
    if (!contras || contras.length === 0) return null;
    const title = 'Contraindications';
    const stm = sectionTitleMatches('contraindications');
    const isSearching = searchTerm.trim().length > 0;
    if (isSearching && !record._showAllSections && !stm) {
      if (!contras.some(c => contentMatches(c.medication) || contentMatches(c.condition) || contentMatches(c.severity) || contentMatches(c.alternative))) return null;
    }
    const copyId = `contraindications-${idx}`;
    return (
      <div className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(title)}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopy(record, idx, 'contraindications'), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, 'contraindications', idx)}
            </div>
          </div>
          {contras.map((ci, ai) => {
            if (isSearching && !record._showAllSections && !stm && !contentMatches(ci.medication) && !contentMatches(ci.condition) && !contentMatches(ci.severity) && !contentMatches(ci.alternative)) return null;
            return (
              <div key={ai} className="rec-mini-card">
                <div className="nested-subtitle">{highlightText(ci.medication || `Contraindication ${ai + 1}`)}</div>
                {renderEditableProperty(record, `contraindications.${ai}.condition`, idx, 'contraindications', 'Condition', ci.condition)}
                {renderEditableProperty(record, `contraindications.${ai}.severity`, idx, 'contraindications', 'Severity', ci.severity)}
                {renderEditableProperty(record, `contraindications.${ai}.alternative`, idx, 'contraindications', 'Alternative', ci.alternative)}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ========== EMPTY STATE ==========
  if (!records || records.length === 0) {
    return (
      <div className="clinical-decision-support-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Clinical Decision Support</h2></div>
        <div className="empty-state">No clinical decision support records available</div>
      </div>
    );
  }

  return (
    <div className="clinical-decision-support-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Clinical Decision Support</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<ClinicalDecisionSupportPDFTemplate document={pdfData} />} fileName="Clinical_Decision_Support.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>

      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search clinical decision support..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>

      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <div className="record-meta-row">
                {record.date && <span className="record-date">{highlightText(new Date(record.date?.$date || record.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }))}</span>}
              </div>
              <h3 className="record-name">{highlightText(`Clinical Decision Support ${idx + 1}`)}</h3>
            </div>
            {renderOverallRisk(record, idx)}
            {renderRedFlags(record, idx)}
            {renderRiskFactors(record, idx)}
            {renderMitigatingFactors(record, idx)}
            {renderDrugInteractions(record, idx)}
            {renderContraindications(record, idx)}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ClinicalDecisionSupportDocument;
