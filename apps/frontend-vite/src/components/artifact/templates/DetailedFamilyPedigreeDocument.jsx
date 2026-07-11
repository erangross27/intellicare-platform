/**
 * DetailedFamilyPedigreeDocument.jsx
 * March 2026 — Complete rewrite with inline editing, blue glow theme
 * Collection: detailed_family_pedigree
 *
 * 17 Sections:
 *   1. record-info: provider
 *   2. ethnic-background: ethnicBackground
 *   3. maternal-grandmother: maternalGrandmotherMedicalHistory
 *   4. maternal-grandfather: maternalGrandfatherMedicalHistory
 *   5. paternal-grandmother: paternalGrandmotherMedicalHistory
 *   6. paternal-grandfather: paternalGrandfatherMedicalHistory
 *   7. mother-history: motherMedicalHistory
 *   8. father-history: fatherMedicalHistory
 *   9. siblings-info: siblingsCount, siblingsMedicalHistory
 *  10. children-info: childrenCount, childrenMedicalHistory
 *  11. pedigree-generations: pedigreeGenerationsDocumented
 *  12. consanguinity-adoption: consanguinityPresent, adoptionInFamily
 *  13. hereditary-cancer: hereditaryCancerSyndromes
 *  14. cardiovascular-genetic: cardiovascularGeneticConditions
 *  15. neurological-genetic: neurologicalGeneticConditions
 *  16. endocrine-familial: endocrineFamilialDisorders
 *  17. psychiatric-familial: psychiatricFamilialConditions
 *  18. autoimmune-familial: autoimmuneFamilialConditions
 *  19. pregnancy-complications: pregnancyComplications
 *  20. age-of-onset: ageOfOnsetPatterns
 *  21. genetic-testing: geneticTestingPerformed, carrierStatusKnown
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import DetailedFamilyPedigreeDocumentPDFTemplate from '../pdf-templates/DetailedFamilyPedigreeDocumentPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './DetailedFamilyPedigreeDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldName]: value } }  (value = full reconstructed field value or array) */
const DRAFT_KEY = 'detailed_family_pedigreePendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

/* ======= CONSTANTS ======= */
const SECTION_TITLES = {
  'record-info': 'Record Information',
  'ethnic-background': 'Ethnic Background',
  'maternal-grandmother': 'Maternal Grandmother History',
  'maternal-grandfather': 'Maternal Grandfather History',
  'paternal-grandmother': 'Paternal Grandmother History',
  'paternal-grandfather': 'Paternal Grandfather History',
  'mother-history': "Mother's Medical History",
  'father-history': "Father's Medical History",
  'siblings-info': 'Siblings Information',
  'children-info': 'Children Information',
  'pedigree-generations': 'Pedigree Generations',
  'consanguinity-adoption': 'Consanguinity & Adoption',
  'hereditary-cancer': 'Hereditary Cancer Syndromes',
  'cardiovascular-genetic': 'Cardiovascular Genetic Conditions',
  'neurological-genetic': 'Neurological Genetic Conditions',
  'endocrine-familial': 'Endocrine Familial Disorders',
  'psychiatric-familial': 'Psychiatric Familial Conditions',
  'autoimmune-familial': 'Autoimmune Familial Conditions',
  'pregnancy-complications': 'Pregnancy Complications',
  'age-of-onset': 'Age of Onset Patterns',
  'genetic-testing': 'Genetic Testing & Carrier Status',
};

const FIELD_LABELS = {
  provider: 'Provider',
  ethnicBackground: 'Ethnic Background',
  maternalGrandmotherMedicalHistory: 'Maternal Grandmother Medical History',
  maternalGrandfatherMedicalHistory: 'Maternal Grandfather Medical History',
  paternalGrandmotherMedicalHistory: 'Paternal Grandmother Medical History',
  paternalGrandfatherMedicalHistory: 'Paternal Grandfather Medical History',
  motherMedicalHistory: "Mother's Medical History",
  fatherMedicalHistory: "Father's Medical History",
  siblingsCount: 'Number of Siblings',
  siblingsMedicalHistory: 'Siblings Medical History',
  childrenCount: 'Number of Children',
  childrenMedicalHistory: 'Children Medical History',
  pedigreeGenerationsDocumented: 'Generations Documented',
  consanguinityPresent: 'Consanguinity Present',
  adoptionInFamily: 'Adoption in Family',
  hereditaryCancerSyndromes: 'Hereditary Cancer Syndromes',
  cardiovascularGeneticConditions: 'Cardiovascular Genetic Conditions',
  neurologicalGeneticConditions: 'Neurological Genetic Conditions',
  endocrineFamilialDisorders: 'Endocrine Familial Disorders',
  psychiatricFamilialConditions: 'Psychiatric Familial Conditions',
  autoimmuneFamilialConditions: 'Autoimmune Familial Conditions',
  pregnancyComplications: 'Pregnancy Complications',
  ageOfOnsetPatterns: 'Age of Onset Patterns',
  geneticTestingPerformed: 'Genetic Testing Performed',
  carrierStatusKnown: 'Carrier Status Known',
};

const SECTION_FIELDS = {
  'record-info': ['provider'],
  'ethnic-background': ['ethnicBackground'],
  'maternal-grandmother': ['maternalGrandmotherMedicalHistory'],
  'maternal-grandfather': ['maternalGrandfatherMedicalHistory'],
  'paternal-grandmother': ['paternalGrandmotherMedicalHistory'],
  'paternal-grandfather': ['paternalGrandfatherMedicalHistory'],
  'mother-history': ['motherMedicalHistory'],
  'father-history': ['fatherMedicalHistory'],
  'siblings-info': ['siblingsCount', 'siblingsMedicalHistory'],
  'children-info': ['childrenCount', 'childrenMedicalHistory'],
  'pedigree-generations': ['pedigreeGenerationsDocumented'],
  'consanguinity-adoption': ['consanguinityPresent', 'adoptionInFamily'],
  'hereditary-cancer': ['hereditaryCancerSyndromes'],
  'cardiovascular-genetic': ['cardiovascularGeneticConditions'],
  'neurological-genetic': ['neurologicalGeneticConditions'],
  'endocrine-familial': ['endocrineFamilialDisorders'],
  'psychiatric-familial': ['psychiatricFamilialConditions'],
  'autoimmune-familial': ['autoimmuneFamilialConditions'],
  'pregnancy-complications': ['pregnancyComplications'],
  'age-of-onset': ['ageOfOnsetPatterns'],
  'genetic-testing': ['geneticTestingPerformed', 'carrierStatusKnown'],
};

const NUMBER_FIELDS = ['siblingsCount', 'childrenCount', 'pedigreeGenerationsDocumented'];
const BOOLEAN_FIELDS = ['consanguinityPresent', 'adoptionInFamily'];

const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);

/* stepper step: decimals step 0.1, integers step 1 (counts/generations are integers) */
const stepFor = (v) => (/\.\d/.test(String(v)) ? 0.1 : 1);
const ARRAY_FIELDS = ['maternalGrandmotherMedicalHistory', 'maternalGrandfatherMedicalHistory', 'paternalGrandmotherMedicalHistory', 'paternalGrandfatherMedicalHistory', 'motherMedicalHistory', 'fatherMedicalHistory', 'siblingsMedicalHistory', 'childrenMedicalHistory', 'ethnicBackground', 'hereditaryCancerSyndromes', 'cardiovascularGeneticConditions', 'neurologicalGeneticConditions', 'endocrineFamilialDisorders', 'psychiatricFamilialConditions', 'autoimmuneFamilialConditions', 'pregnancyComplications', 'ageOfOnsetPatterns', 'geneticTestingPerformed', 'carrierStatusKnown'];
const STRING_FIELDS = ['provider'];

/* parseLabel: detect "Label: value" patterns */
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

/* splitByComma: parenthesis-aware + guards — skip no-space commas ("$18,000"),
   keep "and"/"or" adjacent to the comma connected, next non-space char must be letter/>/( */
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) {
      const rest = text.slice(i + 1);
      const noSpace = !/^\s/.test(rest);
      const nextWordM = rest.match(/^\s*([^\s,]+)/);
      const nextWord = nextWordM ? nextWordM[1].toLowerCase() : '';
      const prevWordM = current.match(/(\S+)\s*$/);
      const prevWord = prevWordM ? prevWordM[1].toLowerCase() : '';
      const nextCharM = rest.match(/^\s*(.)/);
      const nextChar = nextCharM ? nextCharM[1] : '';
      const badNext = nextChar && !/[A-Za-z>(]/.test(nextChar);
      if (noSpace || nextWord === 'and' || nextWord === 'or' || prevWord === 'and' || prevWord === 'or' || badNext) { current += ch; continue; }
      const t = current.trim(); if (t) result.push(t); current = '';
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

/* ======= COMPONENT ======= */
const DetailedFamilyPedigreeDocument = ({ document: docProp }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSection, setCopiedSection] = useState(null);
  const [copiedItems, setCopiedItems] = useState({});
  const [showCopied, setShowCopied] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  // editKeys (`${fn}-${idx}`) that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [editedFields, setEditedFields] = useState({});
  const [editedSentences, setEditedSentences] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const containerRef = useRef(null);

  /* stepper helper: adjust editValue by the value's step, clamped >= 0 (counts/generations) */
  const stepEditValue = (dir) => {
    setEditValue(prev => {
      const n = parseFloat(prev);
      const s = stepFor(prev);
      const next = (isNaN(n) ? 0 : n) + dir * s;
      return String(Math.max(0, Math.round(next * 100) / 100));
    });
  };

  /* ======= DATA UNWRAP ======= */
  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.detailed_family_pedigree) return Array.isArray(r.detailed_family_pedigree) ? r.detailed_family_pedigree : [r.detailed_family_pedigree];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.detailed_family_pedigree) return Array.isArray(dd.detailed_family_pedigree) ? dd.detailed_family_pedigree : [dd.detailed_family_pedigree]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  /* Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF). */
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const idOf = (r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); };
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const id = idOf(record);
      const recDrafts = id ? store[id] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldName, value]) => {
        const editKey = `${fieldName}-${idx}`;
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

  /* ======= UTILS ======= */
  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);

  const splitBySentence = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
  }, []);

  function reconstructFullText(sentences) {
    if (!sentences || sentences.length === 0) return '';
    return sentences.map((s, i) => {
      let c = s.replace(/[;.]+$/, '').trim();
      if (i < sentences.length - 1) c += '.';
      return c;
    }).join(' ');
  }

  const getFieldValue = useCallback((record, fn, idx) => {
    const k = `${fn}-${idx}`;
    if (localEdits[k] !== undefined) return localEdits[k];
    return record[fn];
  }, [localEdits]);

  const safeId = useCallback((r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); }, []);

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

  /* ======= SEARCH — 4-LEVEL ======= */
  const shouldShowSection = useCallback((record, sid) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const title = (SECTION_TITLES[sid] || '').toLowerCase();
    if (title.includes(phrase) || phrase.includes(title)) return true;
    const fields = SECTION_FIELDS[sid] || [];
    for (const f of fields) {
      const label = (FIELD_LABELS[f] || f).toLowerCase();
      if (label.includes(phrase) || phrase.includes(label)) return true;
      const val = getFieldValue(record, f, 0);
      if (val !== null && val !== undefined) {
        if (Array.isArray(val)) { if (val.some(item => String(item).toLowerCase().includes(phrase))) return true; }
        else if (typeof val === 'object') { if (Object.entries(val).some(([k, v]) => String(k).toLowerCase().includes(phrase) || String(v).toLowerCase().includes(phrase))) return true; }
        else if (fmtVal(val).toLowerCase().includes(phrase)) return true;
      }
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal]);

  const fieldMatches = useCallback((record, fn, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    const phrase = searchTerm.toLowerCase().trim();
    const label = (FIELD_LABELS[fn] || fn).toLowerCase();
    if (label.includes(phrase) || phrase.includes(label)) return true;
    const val = getFieldValue(record, fn, idx);
    if (val !== null && val !== undefined) {
      if (Array.isArray(val)) return val.some(item => String(item).toLowerCase().includes(phrase));
      if (typeof val === 'object') return Object.entries(val).some(([k, v]) => String(k).toLowerCase().includes(phrase) || String(v).toLowerCase().includes(phrase));
      return fmtVal(val).toLowerCase().includes(phrase);
    }
    return false;
  }, [searchTerm, getFieldValue, fmtVal]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Family Pedigree ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const fields of Object.values(SECTION_FIELDS)) {
        for (const f of fields) {
          const val = getFieldValue(record, f, idx);
          if (val && (Array.isArray(val) ? val.some(item => String(item).toLowerCase().includes(phrase)) : typeof val === 'object' ? Object.entries(val).some(([k, v]) => String(k).toLowerCase().includes(phrase) || String(v).toLowerCase().includes(phrase)) : fmtVal(val).toLowerCase().includes(phrase))) return true;
        }
      }
      return false;
    });
  }, [records, searchTerm, getFieldValue, fmtVal]);

  /* ======= PDF DATA ======= */
  const pdfData = useMemo(() => {
    return filteredRecords.map((record, idx) => {
      const merged = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF until approved
        const m = key.match(/^(.+)-(\d+)$/);
        if (m && parseInt(m[2]) === idx) {
          merged[m[1]] = localEdits[key];
        }
      });
      return merged;
    });
  }, [filteredRecords, localEdits, pendingEdits]);

  /* ======= EDIT HANDLERS ======= */
  // Stage a DRAFT for a whole field value locally + write it to the pending-drafts localStorage store
  // (survives refresh). NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve.
  // Drops the section's 'approved' flag so the button returns to yellow Pending Approve on re-edit.
  const stageDraft = useCallback((record, idx, fn, value, sid) => {
    const id = safeId(record); if (!id) return;
    setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: value }));
    setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true }));
    if (sid) setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = value;
    writeDrafts(store);
  }, [safeId]);

  const handleSaveField = useCallback((record, fn, idx, sid, sentIdx, valueOverride, editTrackingKey) => {
    const id = safeId(record); if (!id) return;
    const saveVal = valueOverride !== undefined ? valueOverride : editValue;
    setSaveError(null);
    stageDraft(record, idx, fn, saveVal, sid);
    const trackKey = editTrackingKey || `${fn}-${idx}`;
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    setEditingField(null); setEditValue('');
  }, [editValue, safeId, stageDraft]);

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) {
      const updated = [...sentences]; updated.splice(sentenceIdx, 1);
      const fullText = reconstructFullText(updated);
      setSaveError(null);
      stageDraft(record, idx, fn, fullText, sid);
      setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
      setEditingField(null); setEditValue('');
      return;
    }
    const newSentences = splitBySentence(editedVal);
    const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences);
    const fullText = reconstructFullText(updated);
    setSaveError(null);
    stageDraft(record, idx, fn, fullText, sid);
    const orig = sentences[sentenceIdx] || '';
    const changed = newSentences[0].replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim();
    setEditedSentences(prev => {
      const n = { ...prev };
      if (changed) n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited';
      const extra = newSentences.length - 1;
      for (let ei = 0; ei < extra; ei++) n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added';
      return n;
    });
    setEditingField(null); setEditValue('');
  }

  function saveCommaItem(record, fn, idx, sid, sIdx, ciIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || '');
    const sentences = splitBySentence(currentVal);
    const s = sentences[sIdx] || '';
    const p = parseLabel(s);
    if (!p.isLabeled) return;
    const items = splitByComma(p.value);
    const trimmed = editValue.trim();
    const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp);
    if (subParts.length > 1) { items.splice(ciIdx, 1, ...subParts); } else { items[ciIdx] = trimmed.replace(/[;.]+$/, '').trim(); }
    const rebuilt = `${p.label}: ${items.join(', ')}.`;
    const allS = [...sentences]; allS[sIdx] = rebuilt;
    const fullText = reconstructFullText(allS);
    setSaveError(null);
    stageDraft(record, idx, fn, fullText, sid);
    const sentenceKey = `${fn}-${idx}-s${sIdx}`;
    const commaKey = `${sentenceKey}-c${ciIdx}`;
    const marks = { [commaKey]: 'edited' };
    for (let ei = 1; ei < subParts.length; ei++) marks[`${sentenceKey}-c${ciIdx + ei}`] = 'added';
    setEditedSentences(prev => ({ ...prev, ...marks }));
    setEditingField(null); setEditValue('');
  }

  /* Save one comma-item of a labeled ARRAY item ("Sister Colette age 43: A, B, C") —
     rebuild the comma list, re-attach the label, splice into the array, stage a DRAFT. */
  function saveArrayItemComma(record, fn, idx, sid, itemIdx, label, items, ciIdx, commaKey) {
    const id = safeId(record); if (!id) return;
    const allItems = [...items]; allItems[ciIdx] = editValue.trim();
    const rebuilt = `${label}: ${allItems.filter(Boolean).join(', ')}`;
    const currentArr = [...(Array.isArray(getFieldValue(record, fn, idx)) ? getFieldValue(record, fn, idx) : [])];
    currentArr[itemIdx] = rebuilt;
    setSaveError(null);
    stageDraft(record, idx, fn, currentArr, sid);
    setEditedSentences(prev => ({ ...prev, [commaKey]: 'edited' }));
    setEditingField(null); setEditValue('');
  }

  /* Save the VALUE of a labeled array item (label kept) — splice "label: value" into the array. */
  function saveArrayItemLabeledValue(record, fn, idx, sid, itemIdx, label, editKey) {
    const id = safeId(record); if (!id) return;
    const rebuilt = `${label}: ${editValue.trim()}`;
    const currentArr = [...(Array.isArray(getFieldValue(record, fn, idx)) ? getFieldValue(record, fn, idx) : [])];
    currentArr[itemIdx] = rebuilt;
    setSaveError(null);
    stageDraft(record, idx, fn, currentArr, sid);
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    setEditingField(null); setEditValue('');
  }

  /* ======= APPROVE ======= */
  const sectionHasEdits = useCallback((idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    return fields.some(f =>
      Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) ||
      Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))
    );
  }, [editedFields, editedSentences]);

  // Approve = COMMIT all staged drafts for this section's fields to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    const fields = SECTION_FIELDS[sid] || [];
    const suffix = `-${idx}`;
    // Pending localEdits for this section: editKey = `${fn}-${idx}`, value = full field value or array
    const toCommit = Object.keys(localEdits).filter(k => {
      if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
      const fieldPart = k.slice(0, -suffix.length);
      const baseField = fieldPart.includes('.') ? fieldPart.slice(0, fieldPart.indexOf('.')) : fieldPart;
      return fields.includes(baseField);
    });
    setSaving(true); setSaveError(null);
    try {
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // "field" or "field.<arrayIndex>"
        const dotIdx = fieldPart.lastIndexOf('.');
        const tail = dotIdx === -1 ? '' : fieldPart.slice(dotIdx + 1);
        const isArrIdx = dotIdx !== -1 && /^\d+$/.test(tail);
        const payload = { field: isArrIdx ? fieldPart.slice(0, dotIdx) : fieldPart, value: localEdits[editKey] };
        if (isArrIdx) payload.arrayIndex = parseInt(tail, 10);
        await secureApiClient.put(`/api/edit/detailed_family_pedigree/${id}/edit`, payload);
      }
      await secureApiClient.put(`/api/edit/detailed_family_pedigree/${id}/approve`, { sectionId: sid, approved: true });
      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's drafts for the committed fields from localStorage
      const store = readDrafts();
      if (store[id]) {
        toCommit.forEach(editKey => {
          const fieldPart = editKey.slice(0, -suffix.length);
          const baseField = fieldPart.includes('.') ? fieldPart.slice(0, fieldPart.indexOf('.')) : fieldPart;
          delete store[id][baseField];
        });
        if (Object.keys(store[id]).length === 0) delete store[id];
        writeDrafts(store);
      }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`) || (k.startsWith(`${f}.`) && k.endsWith(`-${idx}`))) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error(err); setSaveError('Approve failed. Please try again.'); }
    finally { setSaving(false); }
  }, [safeId, localEdits, pendingEdits]);

  const renderApproveButton = useCallback((record, sid, idx) => {
    const hasEdits = sectionHasEdits(idx, sid);
    const isApproved = approvedSections[`${sid}-${idx}`];
    if (hasEdits) return (<button className="approve-btn pending" disabled={saving} onClick={e => { e.stopPropagation(); handleApproveSection(record, sid, idx); }}>{saving ? 'Approving...' : 'Pending Approve'}</button>);
    if (isApproved) return <span className="approve-btn approved">Approved</span>;
    return null;
  }, [sectionHasEdits, approvedSections, handleApproveSection, saving]);

  /* ======= COPY ======= */
  const copyToClipboard = useCallback(async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch { const ta = window.document.createElement('textarea'); ta.value = text; ta.style.position = 'absolute'; ta.style.left = '-9999px'; (containerRef.current || window.document.body).appendChild(ta); ta.select(); window.document.execCommand('copy'); (containerRef.current || window.document.body).removeChild(ta); return true; } }, []);
  const copySectionText = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedSection(id); setTimeout(() => setCopiedSection(null), 2000); } }, [copyToClipboard]);
  const copyItem = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedItems(prev => ({ ...prev, [id]: true })); setTimeout(() => setCopiedItems(prev => ({ ...prev, [id]: false })), 2000); } }, [copyToClipboard]);

  /* ======= FORMAT HELPERS FOR COPY (canonical: DASH under labels, every row numbered,
     labeled groups restart numbering, unlabeled rows run on) ======= */
  const formatSentenceFieldLines = useCallback((text) => {
    const sentences = splitBySentence(text);
    const lines = []; let running = 1;
    sentences.forEach(s => {
      const parsed = parseLabel(s);
      const value = (parsed.isLabeled ? parsed.value : s).replace(/[;.]+$/, '').trim();
      if (!value) return;
      const parts = splitByComma(value);
      if (parsed.isLabeled) {
        lines.push(parsed.label);
        lines.push(COPY_LINE_DASH);
        if (parts.length >= 3) parts.forEach((item, i) => { lines.push(`${i + 1}. ${item}`); });
        else lines.push(`1. ${value}`);
      } else if (parts.length >= 3) {
        parts.forEach(item => { lines.push(`${running++}. ${item}`); });
      } else {
        lines.push(`${running++}. ${value}`);
      }
    });
    return lines;
  }, [splitBySentence]);

  /* array field → copy lines mirroring the JSX: labeled items → sub-label + DASH +
     comma rows (>=3, restart) or "1. value"; unlabeled items continue the running count */
  const formatArrayFieldLines = useCallback((items) => {
    const lines = []; let running = 1;
    items.forEach(item => {
      const itemStr = String(item);
      const parsed = parseLabel(itemStr);
      if (parsed.isLabeled) {
        const commaItems = splitByComma(parsed.value);
        lines.push(parsed.label);
        lines.push(COPY_LINE_DASH);
        if (commaItems.length >= 3) commaItems.forEach((ci, i) => { lines.push(`${i + 1}. ${ci}`); });
        else lines.push(`1. ${parsed.value}`);
      } else {
        lines.push(`${running++}. ${itemStr}`);
      }
    });
    return lines;
  }, []);

  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    let text = `${title}\n${COPY_LINE_EQ}\n\n`;
    const fields = SECTION_FIELDS[sid] || [];
    fields.forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const val = getFieldValue(record, f, idx);
      if (!hasVal(val)) return;
      const sameAsTitle = label.trim().toLowerCase() === (title || '').trim().toLowerCase();
      const head = sameAsTitle ? '' : `${label}\n${COPY_LINE_DASH}\n`;
      if (BOOLEAN_FIELDS.includes(f)) {
        text += `${head}1. ${val ? 'Yes' : 'No'}\n\n`;
      } else if (NUMBER_FIELDS.includes(f)) {
        text += `${head}1. ${val}\n\n`;
      } else if (ARRAY_FIELDS.includes(f)) {
        const items = Array.isArray(val) ? val.filter(v => v && String(v).trim()) : [];
        if (items.length > 0) {
          text += head;
          formatArrayFieldLines(items).forEach(l => { text += `${l}\n`; });
          text += '\n';
        }
      } else {
        const strVal = fmtVal(val);
        text += head;
        formatSentenceFieldLines(strVal).forEach(l => { text += `${l}\n`; });
        text += '\n';
      }
    });
    return text;
  }, [getFieldValue, hasVal, fmtVal, splitBySentence, formatSentenceFieldLines, formatArrayFieldLines]);

  const copyAllText = useCallback(async () => {
    let text = `Detailed Family Pedigree\n${COPY_LINE_EQ}\n\n`;
    pdfData.forEach((r, idx) => {
      text += `Family Pedigree ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => {
        const st = buildSectionCopyText(r, idx, sid);
        // empty-section guard: title + EQ divider = 2 lines; require real content beyond them
        if (st.split('\n').filter(l => l.trim()).length > 2) text += st;
      });
      text += '\n';
    });
    const ok = await copyToClipboard(text);
    if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText]);

  /* ======= RENDER: BOOLEAN FIELD ======= */
  const renderBooleanField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const showLabel = label.toLowerCase() !== (SECTION_TITLES[sid] || '').toLowerCase();
    const displayVal = val ? 'Yes' : 'No';
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(val ? 'Yes' : 'No'); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const boolVal = editValue === 'Yes'; handleSaveField(record, fn, idx, sid, null, boolVal); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}: ${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ======= RENDER: NUMBER FIELD ======= */
  const renderNumberField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val) && val !== 0) return null;
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const label = FIELD_LABELS[fn] || fn;
    const showLabel = label.toLowerCase() !== (SECTION_TITLES[sid] || '').toLowerCase();
    const displayVal = String(val);
    const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(displayVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <div className="num-stepper-row">
                <button type="button" className="num-step" onClick={e => { e.stopPropagation(); stepEditValue(-1); }}>&#8722;</button>
                <input type="number" step="any" className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                <button type="button" className="num-step" onClick={e => { e.stopPropagation(); stepEditValue(1); }}>+</button>
              </div>
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const numVal = parseFloat(editValue); if (isNaN(numVal)) { setSaveError('Please enter a valid number'); return; } handleSaveField(record, fn, idx, sid, null, numVal); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">&#9998;</span></div>
              <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}: ${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
      </div>
    );
  };

  /* ======= RENDER: ARRAY FIELD (per-item editing with dot-path keys) ======= */
  const renderArrayField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx);
    const items = Array.isArray(val) ? val.filter(Boolean) : [];
    if (items.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn;
    const showLabel = label.toLowerCase() !== (SECTION_TITLES[sid] || '').toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    return (
      <div key={fn} className="rec-mini-card">
        {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        {items.map((item, itemIdx) => {
          const editKey = `${fn}.${itemIdx}-${idx}`;
          const isEditing = editingField === editKey;
          const isModified = editedFields[editKey];
          const itemStr = String(item);

          if (searchTerm.trim() && !sectionTitleMatches(sid) && !record._showAllSections) {
            const phrase = searchTerm.toLowerCase().trim();
            const labelLower = label.toLowerCase();
            if (!labelLower.includes(phrase) && !phrase.includes(labelLower) && !itemStr.toLowerCase().includes(phrase)) return null;
          }

          /* Labeled array item ("Sister Colette age 43: A, B, C") → nested-subtitle group;
             value with >=3 guarded comma items → one editable row per item */
          const parsedItem = parseLabel(itemStr);
          if (parsedItem.isLabeled) {
            const commaItems = splitByComma(parsedItem.value);
            if (commaItems.length >= 3) {
              return (
                <div key={itemIdx} className="rec-mini-card" style={{ marginTop: itemIdx > 0 ? 8 : 0 }}>
                  <div className="nested-subtitle sub-label">{highlightText(parsedItem.label)}</div>
                  {commaItems.map((ci, ciIdx) => {
                    const commaKey = `${editKey}-c${ciIdx}`;
                    const ciEditing = editingField === commaKey;
                    const ciBadge = editedSentences[commaKey];
                    return (
                      <div key={ciIdx}>
                        <div className={`numbered-row ${ciBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!ciEditing) { setEditingField(commaKey); setEditValue(ci); setSaveError(null); } }}>
                          {ciEditing ? (
                            <div className="edit-field-container">
                              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                              {saveError && <div className="save-error">{saveError}</div>}
                              <div className="edit-actions">
                                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveArrayItemComma(record, fn, idx, sid, itemIdx, parsedItem.label, commaItems, ciIdx, commaKey); }}>{saving ? 'Saving...' : 'Save'}</button>
                                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="row-content"><span className="content-value">{highlightText(ci)}</span><span className="edit-indicator">&#9998;</span></div>
                              <button className={`copy-btn ${copiedItems[commaKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(ci, commaKey); }}>{copiedItems[commaKey] ? 'Copied!' : 'Copy'}</button>
                            </>
                          )}
                        </div>
                        {ciBadge && <span className="modified-badge">edited - click Pending Approve to save</span>}
                      </div>
                    );
                  })}
                </div>
              );
            }
            /* Labeled item, <3 comma parts → sub-label + single value row (label kept on save) */
            return (
              <div key={itemIdx} className="rec-mini-card" style={{ marginTop: itemIdx > 0 ? 8 : 0 }}>
                <div className="nested-subtitle sub-label">{highlightText(parsedItem.label)}</div>
                <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(parsedItem.value); setSaveError(null); } }}>
                  {isEditing ? (
                    <div className="edit-field-container">
                      <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                      {saveError && <div className="save-error">{saveError}</div>}
                      <div className="edit-actions">
                        <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveArrayItemLabeledValue(record, fn, idx, sid, itemIdx, parsedItem.label, editKey); }}>{saving ? 'Saving...' : 'Save'}</button>
                        <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row-content"><span className="content-value">{highlightText(parsedItem.value)}</span><span className="edit-indicator">&#9998;</span></div>
                      <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(itemStr, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                    </>
                  )}
                </div>
                {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
              </div>
            );
          }

          return (
            <div key={itemIdx}>
              <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(itemStr); setSaveError(null); } }}>
                {isEditing ? (
                  <div className="edit-field-container">
                    <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                    {saveError && <div className="save-error">{saveError}</div>}
                    <div className="edit-actions">
                      <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id2 = safeId(record); if (!id2) return; setSaveError(null); const currentArr = [...(Array.isArray(getFieldValue(record, fn, idx)) ? getFieldValue(record, fn, idx) : [])]; currentArr[itemIdx] = editValue; stageDraft(record, idx, fn, currentArr, sid); setEditedFields(prev => ({ ...prev, [editKey]: 'edited' })); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button>
                      <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="row-content"><span className="content-value">{highlightText(itemStr)}</span><span className="edit-indicator">&#9998;</span></div>
                    <button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(itemStr, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button>
                  </>
                )}
              </div>
              {isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}
            </div>
          );
        })}
      </div>
    );
  };

  /* ======= RENDER: STRING FIELD with splitBySentence ======= */
  const renderStringField = (record, fn, idx, sid) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const strVal = fmtVal(val);
    const sentences = splitBySentence(strVal);
    const label = FIELD_LABELS[fn] || fn;
    const showLabel = label.toLowerCase() !== (SECTION_TITLES[sid] || '').toLowerCase();
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;

    /* Multi-sentence: render with splitBySentence */
    if (sentences.length > 1) {
      const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid) || record._showAllSections;
      const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());

      return (
        <div key={fn}>
          <div className="rec-mini-card">
            {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
            {sentences.map((sentence, sIdx) => {
              const sentenceKey = `${fn}-${idx}-s${sIdx}`;
              const isEditing = editingField === sentenceKey;
              const badge = editedSentences[sentenceKey];
              const sentenceMatches = phraseMatch || labelMatch || (searchTerm.trim() && sentence.toLowerCase().includes(searchTerm.toLowerCase().trim()));
              if (!sentenceMatches && searchTerm.trim()) return null;

              const parsed = parseLabel(sentence);
              if (parsed.isLabeled) {
                const commaItems = splitByComma(parsed.value);
                const parsedLabelMatch = searchTerm.trim() && parsed.label.toLowerCase().includes(searchTerm.toLowerCase().trim());
                if (commaItems.length >= 2) {
                  return (
                    <div key={sIdx} className="rec-mini-card" style={{ marginTop: 8 }}>
                      <div className="nested-subtitle">{highlightText(parsed.label)}</div>
                      {commaItems.map((ci, ciIdx) => {
                        const commaKey = `${sentenceKey}-c${ciIdx}`;
                        const ciEditing = editingField === commaKey;
                        const ciBadge = editedSentences[commaKey];
                        const ciMatches = phraseMatch || labelMatch || parsedLabelMatch || !searchTerm.trim() || ci.toLowerCase().includes(searchTerm.toLowerCase().trim());
                        if (!ciMatches && searchTerm.trim()) return null;
                        return (
                          <div key={ciIdx}>
                            <div className={`numbered-row ${ciBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!ciEditing) { setEditingField(commaKey); setEditValue(ci); setSaveError(null); } }}>
                              {ciEditing ? (
                                <div className="edit-field-container">
                                  <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                                  {saveError && <div className="save-error">{saveError}</div>}
                                  <div className="edit-actions">
                                    <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveCommaItem(record, fn, idx, sid, sIdx, ciIdx); }}>{saving ? 'Saving...' : 'Save'}</button>
                                    <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="row-content"><span className="content-value">{highlightText(ci)}</span><span className="edit-indicator">&#9998;</span></div>
                                  <button className={`copy-btn ${copiedItems[commaKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(ci, commaKey); }}>{copiedItems[commaKey] ? 'Copied!' : 'Copy'}</button>
                                </>
                              )}
                            </div>
                            {ciBadge && <span className={`modified-badge ${ciBadge === 'added' ? 'added' : ''}`}>{ciBadge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
                          </div>
                        );
                      })}
                    </div>
                  );
                }
              }

              /* Regular sentence row */
              return (
                <div key={sIdx} className={parsed.isLabeled ? 'rec-mini-card' : ''} style={parsed.isLabeled ? { marginTop: 8 } : undefined}>
                  {parsed.isLabeled && label.toLowerCase() !== parsed.label.toLowerCase() && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
                  <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(parsed.isLabeled ? parsed.value : sentence.replace(/[;.]+$/, '').trim()); setSaveError(null); } }}>
                    {isEditing ? (
                      <div className="edit-field-container">
                        <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
                        {saveError && <div className="save-error">{saveError}</div>}
                        <div className="edit-actions">
                          <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (parsed.isLabeled) { const trimmed = editValue.trim(); const subParts = trimmed.split(/\.\s+/).map(sp => sp.replace(/[;.]+$/, '').trim()).filter(sp => sp); const newValue = subParts.join(', '); const reconstructed = `${parsed.label}: ${newValue}`; const sentences2 = splitBySentence(String(getFieldValue(record, fn, idx) || '')); sentences2[sIdx] = reconstructed; const fullText = reconstructFullText(sentences2); setSaveError(null); stageDraft(record, idx, fn, fullText, sid); const marks = { [sentenceKey]: 'edited' }; for (let ei = 1; ei < subParts.length; ei++) marks[`${fn}-${idx}-s${sIdx}-c${ei}`] = 'added'; setEditedSentences(prev => ({ ...prev, ...marks })); setEditingField(null); setEditValue(''); } else { saveSentence(record, fn, idx, sid, sIdx); } }}>{saving ? 'Saving...' : 'Save'}</button>
                          <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="row-content"><span className="content-value">{highlightText(parsed.isLabeled ? parsed.value : sentence)}</span><span className="edit-indicator">&#9998;</span></div>
                        <button className={`copy-btn ${copiedItems[sentenceKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(sentence, sentenceKey); }}>{copiedItems[sentenceKey] ? 'Copied!' : 'Copy'}</button>
                      </>
                    )}
                  </div>
                  {badge && <span className={`modified-badge ${badge === 'added' ? 'added' : ''}`}>{badge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    /* Single-value string: simple editable */
    const editKey = `${fn}-${idx}`;
    const isEditing = editingField === editKey;
    const isModified = editedFields[editKey];

    return (
      <div key={fn} className="rec-mini-card">
        {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(editKey); setEditValue(strVal); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveSentence(record, fn, idx, sid, 0); }}>{saving ? 'Saving...' : 'Save'}</button>
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

  /* ======= RENDER: GENERIC SECTION ======= */
  const renderSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];

    const hasAnyVal = fields.some(f => {
      const val = getFieldValue(record, f, idx);
      return hasVal(val) || (NUMBER_FIELDS.includes(f) && val === 0);
    });
    if (!hasAnyVal) return null;

    const copyId = `${sid}-${idx}`;
    return (
      <div key={sid} className="section">
        <div className="mini-cards-container">
          <div className="section-header">
            <h4 className="section-title">{highlightText(title)}</h4>
            <div className="header-right-actions">
              <button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySectionText(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>
              {renderApproveButton(record, sid, idx)}
            </div>
          </div>
          {fields.map(f => {
            if (BOOLEAN_FIELDS.includes(f)) return renderBooleanField(record, f, idx, sid);
            if (NUMBER_FIELDS.includes(f)) return renderNumberField(record, f, idx, sid);
            if (ARRAY_FIELDS.includes(f)) return renderArrayField(record, f, idx, sid);
            return renderStringField(record, f, idx, sid);
          })}
        </div>
      </div>
    );
  };

  /* ======= MAIN RENDER ======= */
  if (!records || records.length === 0) {
    return (
      <div className="detailed-family-pedigree-document" ref={containerRef}>
        <div className="document-header"><h2 className="document-title">Detailed Family Pedigree</h2></div>
        <div className="empty-state">No family pedigree records available</div>
      </div>
    );
  }

  return (
    <div className="detailed-family-pedigree-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Detailed Family Pedigree</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<DetailedFamilyPedigreeDocumentPDFTemplate document={pdfData} />} fileName="Detailed_Family_Pedigree.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container">
        <input type="text" className="search-input" placeholder="Search family pedigree records..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        {searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}
      </div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              {hasVal(record.date) && (
                <div className="record-meta-row">
                  <span className="record-date">{highlightText(formatDate(record.date))}</span>
                </div>
              )}
              <h3 className="record-name">{highlightText(`Family Pedigree ${idx + 1}`)}</h3>
            </div>
            {renderSection(record, idx, 'record-info')}
            {renderSection(record, idx, 'ethnic-background')}
            {renderSection(record, idx, 'maternal-grandmother')}
            {renderSection(record, idx, 'maternal-grandfather')}
            {renderSection(record, idx, 'paternal-grandmother')}
            {renderSection(record, idx, 'paternal-grandfather')}
            {renderSection(record, idx, 'mother-history')}
            {renderSection(record, idx, 'father-history')}
            {renderSection(record, idx, 'siblings-info')}
            {renderSection(record, idx, 'children-info')}
            {renderSection(record, idx, 'pedigree-generations')}
            {renderSection(record, idx, 'consanguinity-adoption')}
            {renderSection(record, idx, 'hereditary-cancer')}
            {renderSection(record, idx, 'cardiovascular-genetic')}
            {renderSection(record, idx, 'neurological-genetic')}
            {renderSection(record, idx, 'endocrine-familial')}
            {renderSection(record, idx, 'psychiatric-familial')}
            {renderSection(record, idx, 'autoimmune-familial')}
            {renderSection(record, idx, 'pregnancy-complications')}
            {renderSection(record, idx, 'age-of-onset')}
            {renderSection(record, idx, 'genetic-testing')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DetailedFamilyPedigreeDocument;
