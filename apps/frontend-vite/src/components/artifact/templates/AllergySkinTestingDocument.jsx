import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import AllergySkinTestingPDFTemplate from '../pdf-templates/AllergySkinTestingPDFTemplate';
import secureApiClient from '../../../services/secureApiClient';
import './AllergySkinTestingDocument.css';

/**
 * AllergySkinTestingDocument - March 2026 Mini-Card Pattern with Bar Chart + Inline Editing
 *
 * MongoDB Schema (allergy_skin_testing):
 * - testType: string
 * - allergensTested: string[]
 * - positiveReactions: string[]
 * - negativeReactions: string[]
 * - whealSize: object
 * - controls: string
 * - medicationWithheld: string[]
 * - adverseReactions: string
 * - interpretation: string
 * - recommendations: string
 * - allergist: string
 * - date: Date (non-editable)
 * - facility: string
 * - notes: string
 */

// ========== Section-to-field mapping for approve scoping ==========
const SECTION_FIELDS = {
  testInfo: ['testType', 'allergist', 'facility', 'controls'],
  whealSize: ['whealSize'],
  allergensTested: ['allergensTested'],
  positiveReactions: ['positiveReactions'],
  negativeReactions: ['negativeReactions'],
  medicationsWithheld: ['medicationWithheld'],
  adverseReactions: ['adverseReactions'],
  interpretation: ['interpretation'],
  recommendations: ['recommendations'],
  notes: ['notes'],
};

const SENTENCE_FIELDS = ['controls', 'interpretation', 'recommendations', 'notes'];

// ========== Field-name → display label mapping for 4-level search ==========
const FIELD_LABELS = {
  testType: 'Test Type',
  allergist: 'Allergist',
  facility: 'Facility',
  controls: 'Controls',
  whealSize: 'Wheal Size',
  allergensTested: 'Allergens Tested',
  positiveReactions: 'Positive Reactions',
  negativeReactions: 'Negative Reactions',
  medicationWithheld: 'Medications Withheld',
  adverseReactions: 'Adverse Reactions',
  interpretation: 'Interpretation',
  recommendations: 'Recommendations',
  notes: 'Notes',
};

// ========== Search normalization (strips parentheses, brackets, special chars) ==========
const normalizeForSearch = (text) => {
  if (!text) return '';
  return String(text).toLowerCase().replace(/[()[\]<>&:%]/g, '').replace(/[/\\-]/g, ' ').trim();
};

// ========== Utility functions (outside component) ==========

// Convert a dynamic object key (e.g. "histamineControl", "catDander") into a readable label
const humanizeKey = (key) => {
  if (key === null || key === undefined) return '';
  return String(key)
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
};

// Parenthesis-aware sentence splitter
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
  const last = current.trim();
  if (last) result.push(last);
  return result;
};

// Parse "Label: Value" pattern
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const match = text.match(/^([A-Z][A-Za-z0-9 &/()>=<+%.#-]+):\s*(.+)$/);
  if (match) return { isLabeled: true, label: match[1].trim(), value: match[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

// Parenthesis-aware comma split
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text];
  const result = [];
  let current = '';
  let parenDepth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') parenDepth++;
    else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);
    if (ch === ',' && parenDepth === 0) {
      const trimmed = current.trim();
      if (trimmed) result.push(trimmed);
      current = '';
    } else {
      current += ch;
    }
  }
  const last = current.trim();
  if (last) result.push(last);
  return result;
};

// ========== Number-segment editing (field-type-aware) ==========
// Tokenize a string into number / text segments so each NUMBER becomes its own increase/decrease
// <input type="number"> while the surrounding text stays fixed.
// "14x12mm, 4+" -> [num 14][txt "x"][num 12][txt "mm, "][num 4][txt "+"]
const numberSegments = (str) => {
  const s = String(str ?? '');
  const tokens = [];
  const re = /-?\d+(?:\.\d+)?/g;
  let last = 0, m;
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) tokens.push({ t: 'txt', v: s.slice(last, m.index) });
    tokens.push({ t: 'num', v: m[0] });
    last = m.index + m[0].length;
  }
  if (last < s.length) tokens.push({ t: 'txt', v: s.slice(last) });
  return tokens;
};
// Re-join number tokens (replaced by edited values, in order) with the fixed text tokens.
const reconstructNums = (tokens, nums) => {
  let j = 0;
  return tokens.map(tok => (tok.t === 'num' ? (nums[j++] ?? '') : tok.v)).join('');
};
// Does a value contain an editable number?
const hasNum = (v) => /\d/.test(String(v ?? ''));

// ========== Chart Utilities (outside component) ==========

const categorizeAllergen = (allergen) => {
  const l = allergen.toLowerCase();
  if (l.includes('aspergillus') || l.includes('penicillium') || l.includes('cladosporium') || l.includes('alternaria') || l.includes('mold') || l.includes('fungi') || l.includes('fusarium') || l.includes('mucor')) return 'Molds/Fungi';
  if (l.includes('dust') || l.includes('mite') || l.includes('cockroach') || l.includes('indoor')) return 'Environmental';
  if (l.includes('cat') || l.includes('dog') || l.includes('horse') || l.includes('pet') || l.includes('animal') || l.includes('dander') || l.includes('feather')) return 'Animals';
  if (l.includes('grass') || l.includes('tree') || l.includes('weed') || l.includes('ragweed') || l.includes('pollen') || l.includes('birch') || l.includes('oak') || l.includes('cedar')) return 'Pollens';
  if (l.includes('peanut') || l.includes('milk') || l.includes('egg') || l.includes('wheat') || l.includes('soy') || l.includes('shellfish') || l.includes('fish') || l.includes('nut') || l.includes('food')) return 'Foods';
  return 'Other';
};

const extractClassData = (reactions) => {
  if (!reactions || !Array.isArray(reactions)) return [];
  return reactions.map(reaction => {
    const classMatch = String(reaction).match(/Class\s*(\d+)/i);
    const kuMatch = String(reaction).match(/([\d.]+)\s*kU\/L/i);
    const allergenMatch = String(reaction).match(/^([^(]+)/);
    const classLevel = classMatch ? parseInt(classMatch[1], 10) : null;
    const kuValue = kuMatch ? parseFloat(kuMatch[1]) : null;
    const allergen = allergenMatch ? allergenMatch[1].trim() : reaction;
    return { allergen, classLevel, kuValue, category: categorizeAllergen(allergen), rawText: reaction };
  }).filter(item => item.classLevel !== null);
};

const groupByCategory = (chartData) => {
  const groups = {};
  chartData.forEach(item => {
    if (!groups[item.category]) groups[item.category] = [];
    groups[item.category].push(item);
  });
  const order = ['Molds/Fungi', 'Environmental', 'Pollens', 'Foods', 'Animals', 'Other'];
  return order.filter(cat => groups[cat]).map(cat => ({ category: cat, items: groups[cat] }));
};

const getClassColor = (cl) => {
  if (cl === 0) return '#22c55e';
  if (cl === 1) return '#84cc16';
  if (cl === 2) return '#eab308';
  if (cl === 3) return '#f97316';
  if (cl === 4) return '#ef4444';
  if (cl >= 5) return '#dc2626';
  return '#6b7280';
};

const getClassInterpretation = (cl) => {
  if (cl === 0) return 'Negative';
  if (cl === 1) return 'Low';
  if (cl === 2) return 'Moderate';
  if (cl === 3) return 'High';
  if (cl >= 4) return 'Very High';
  return 'Unknown';
};

const getAllergenDescription = (allergen) => {
  const l = allergen.toLowerCase();
  if (l.includes('aspergillus')) return 'Common indoor mold found in damp areas';
  if (l.includes('penicillium')) return 'Mold found on food and in damp buildings';
  if (l.includes('cladosporium')) return 'Outdoor mold common on plants and soil';
  if (l.includes('alternaria')) return 'Outdoor mold causing seasonal allergies';
  if (l.includes('fusarium')) return 'Soil fungus also found in grains';
  if (l.includes('mucor')) return 'Fast-growing mold in soil and decaying matter';
  if (l.includes('dust mite') || l === 'dust mites') return 'Microscopic insects in household dust';
  if (l.includes('cockroach')) return 'Insect allergen from droppings and body parts';
  if (l.includes('latex')) return 'Natural rubber protein allergen';
  if (l.includes('cat')) return 'Proteins from cat skin, saliva, and urine';
  if (l.includes('dog')) return 'Proteins from dog skin, saliva, and urine';
  if (l.includes('horse')) return 'Proteins from horse dander and hair';
  if (l.includes('feather')) return 'Proteins from bird feathers';
  if (l.includes('birch')) return 'Tree pollen common in spring';
  if (l.includes('oak')) return 'Tree pollen causing spring allergies';
  if (l.includes('cedar')) return 'Evergreen tree pollen allergen';
  if (l.includes('maple')) return 'Tree pollen from maple trees';
  if (l.includes('ragweed')) return 'Weed pollen causing fall allergies';
  if (l.includes('grass')) return 'Grass pollen causing summer allergies';
  if (l.includes('timothy')) return 'Common grass pollen allergen';
  if (l.includes('peanut')) return 'Legume protein allergen';
  if (l.includes('milk') || l.includes('casein')) return 'Dairy protein allergen';
  if (l.includes('egg')) return 'Egg protein allergen';
  if (l.includes('wheat') || l.includes('gluten')) return 'Wheat/gluten protein allergen';
  if (l.includes('soy')) return 'Soybean protein allergen';
  if (l.includes('shellfish') || l.includes('shrimp')) return 'Shellfish protein allergen';
  if (l.includes('fish')) return 'Fish protein allergen';
  if (l.includes('tree nut') || l.includes('almond') || l.includes('walnut')) return 'Tree nut protein allergen';
  return 'Allergen identified by skin testing';
};

// ========== Pending-edit DRAFT store (localStorage) ==========
// Drafts survive refresh + show in the JSX, but are NOT written to MongoDB and NOT shown in the
// PDF/Copy All until the user clicks Approve. Kept in a SEPARATE key (NOT artifactGridData) so
// drafts never leak into the PDF/DB source.
// Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex")
const DRAFT_KEY = 'allergy_skin_testingPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

// ========== Component ==========
const AllergySkinTestingDocument = ({ document: templateData }) => {
  // === State ===
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  // Editing state
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  const [editedFields, setEditedFields] = useState({});
  const [editedSentences, setEditedSentences] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  // Field-type-aware number editing: when a value contains numbers, edit each number with a stepper.
  // editTokens = tokenized template (null = plain textarea mode); editNums = current number values.
  const [editTokens, setEditTokens] = useState(null);
  const [editNums, setEditNums] = useState([]);
  const textareaRef = useRef(null);
  const canEdit = true;

  // === Data Unwrapping ===
  const unwrappedData = useMemo(() => {
    if (Array.isArray(templateData)) return templateData;
    if (templateData?.allergy_skin_testing && Array.isArray(templateData.allergy_skin_testing)) {
      return templateData.allergy_skin_testing;
    }
    if (templateData?.documentData) {
      const docData = templateData.documentData;
      if (Array.isArray(docData)) return docData;
      if (docData?.allergy_skin_testing && Array.isArray(docData.allergy_skin_testing)) {
        return docData.allergy_skin_testing;
      }
      if (docData && typeof docData === 'object') return [docData];
    }
    if (templateData && typeof templateData === 'object') {
      return [templateData];
    }
    return [];
  }, [templateData]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {}, nSentences = {};
    unwrappedData.forEach((record, idx) => {
      const recId = record && (record._id?.$oid || record._id);
      const recDrafts = recId ? store[recId] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const editKey = `${fieldPart}-${idx}`;
        nLocal[editKey] = value;
        nPending[editKey] = true;
        // Restore the edited marker the save handler would have set
        if (SENTENCE_FIELDS.includes(fieldPart)) {
          nSentences[`${fieldPart}-${idx}-s0`] = 'edited';
        } else {
          nFields[`${fieldPart}-${idx}`] = true;
        }
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
    setEditedSentences(prev => ({ ...nSentences, ...prev }));
  }, [unwrappedData]);

  // === Helpers ===
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const formatDateISO = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toISOString().split('T')[0];
  };

  // Get field value from localEdits first, then record
  const getFieldValue = (record, fieldName, idx) => {
    const editKey = `${fieldName}-${idx}`;
    if (localEdits[editKey] !== undefined) return localEdits[editKey];
    return record[fieldName];
  };

  // === Editing Handlers ===
  const handleStartEdit = useCallback((editKey, currentValue) => {
    const strVal = typeof currentValue === 'string'
      ? currentValue.replace(/[.;]\s*$/, '')
      : String(currentValue || '');
    setEditingField(editKey);
    setEditTokens(null);
    setEditNums([]);
    setEditValue(strVal);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fieldName, idx, sectionId, sentenceIdx, valueOverride, editTrackingKey) => {
    const recordId = record._id?.$oid || record._id;
    if (!recordId) return;

    const saveValue = valueOverride !== undefined ? valueOverride : editValue.trim();

    // Update localEdits + mark as a pending (un-committed) draft
    const editKey = `${fieldName}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: saveValue }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));

    // Track edit
    const sKey = editTrackingKey || `${fieldName}-${idx}-s${sentenceIdx !== undefined ? sentenceIdx : 0}`;
    if (SENTENCE_FIELDS.includes(fieldName)) {
      setEditedSentences(prev => ({ ...prev, [sKey]: 'edited' }));
    } else {
      setEditedFields(prev => ({ ...prev, [sKey]: true }));
    }

    // Re-edit after approval → drop this section's 'approved' flag so the button goes back to yellow
    if (sectionId) {
      setApprovedSections(prev => { const u = { ...prev }; delete u[`${sectionId}-${idx}`]; return u; });
    }

    // Persist the draft to localStorage (survives refresh; NOT committed to DB/PDF until Approve)
    const store = readDrafts();
    if (!store[recordId]) store[recordId] = {};
    store[recordId][fieldName] = saveValue;
    writeDrafts(store);

    setEditingField(null);
    setEditValue('');
    setEditTokens(null);
    setEditNums([]);
  }, [editValue]);

  // Begin a NUMBER edit: tokenize the value so each number renders as a stepper input.
  const startNumEdit = (editKey, value) => {
    const str = String(value ?? '');
    const tokens = numberSegments(str);
    setEditingField(editKey);
    setEditTokens(tokens);
    setEditNums(tokens.filter(t => t.t === 'num').map(t => t.v));
    setEditValue(str);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  // Field-type-aware edit start: numbers → stepper editor, otherwise plain textarea.
  const startEdit = (editKey, value) => {
    if (hasNum(value)) startNumEdit(editKey, value);
    else handleStartEdit(editKey, value);
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue('');
    setEditTokens(null);
    setEditNums([]);
  };

  // Shared edit UI for every editable field. NUMBER mode renders one <input type="number"> (with
  // native ↑/↓ increase-decrease steppers) per number, surrounding text fixed; editValue stays synced
  // to the reconstructed string so each caller's existing save logic works unchanged. Otherwise textarea.
  const renderEditInputs = (onSave) => {
    if (editTokens) {
      let ni = -1;
      return (
        <div className="edit-field-container">
          <div className="number-edit-row">
            {editTokens.map((tok, ti) => {
              if (tok.t !== 'num') return <span key={ti} className="number-edit-text">{tok.v}</span>;
              const j = ++ni;
              return (
                <input
                  key={ti}
                  type="number"
                  step="any"
                  className="edit-number"
                  ref={j === 0 ? textareaRef : undefined}
                  value={editNums[j]}
                  onChange={(e) => {
                    const nn = [...editNums];
                    nn[j] = e.target.value;
                    setEditNums(nn);
                    setEditValue(reconstructNums(editTokens, nn));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onSave();
                    if (e.key === 'Escape') cancelEdit();
                  }}
                  disabled={saving}
                />
              );
            })}
          </div>
          <div className="edit-actions">
            <button className="save-btn" onClick={onSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            <button className="cancel-btn" onClick={cancelEdit}>Cancel</button>
          </div>
        </div>
      );
    }
    return (
      <div className="edit-field-container">
        <textarea
          ref={textareaRef}
          className="edit-textarea"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) onSave();
            if (e.key === 'Escape') cancelEdit();
          }}
          disabled={saving}
        />
        <div className="edit-actions">
          <button className="save-btn" onClick={onSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          <button className="cancel-btn" onClick={cancelEdit}>Cancel</button>
        </div>
      </div>
    );
  };

  // Approve = COMMIT this section's staged drafts to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sectionId, idx) => {
    const key = `${sectionId}-${idx}`;
    const isApproved = approvedSections[key];
    if (isApproved) return; // One-way approve

    const recordId = record._id?.$oid || record._id;
    if (!recordId) return;

    const fields = SECTION_FIELDS[sectionId] || [];
    const suffix = `-${idx}`;
    // Staged drafts for THIS record + THIS section: editKey = "fieldPart-idx", fieldPart maps to a section field
    const toCommit = Object.keys(localEdits).filter(k => {
      if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
      const fieldPart = k.slice(0, -suffix.length); // "field" or "field.arrayIndex"
      const lastDot = fieldPart.lastIndexOf('.');
      const baseField = (lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1)))
        ? fieldPart.slice(0, lastDot)
        : fieldPart;
      return fields.includes(baseField);
    });

    try {
      // Persist each staged field to the DB now (field, or field+arrayIndex for array elements)
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length);
        const lastDot = fieldPart.lastIndexOf('.');
        const hasArrayIndex = lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1));
        const payload = {
          field: hasArrayIndex ? fieldPart.slice(0, lastDot) : fieldPart,
          value: localEdits[editKey],
        };
        if (hasArrayIndex) payload.arrayIndex = parseInt(fieldPart.slice(lastDot + 1), 10);
        await secureApiClient.put(`/api/edit/allergy_skin_testing/${recordId}/edit`, payload);
      }
      // Flag the section approved (audit trail)
      await secureApiClient.put(`/api/edit/allergy_skin_testing/${recordId}/approve`, {
        sectionId,
        approved: true,
      });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => {
        const next = { ...prev };
        toCommit.forEach(k => delete next[k]);
        return next;
      });
      // Drop this section's committed fields from the localStorage draft store
      const store = readDrafts();
      if (store[recordId]) {
        toCommit.forEach(editKey => {
          const fieldPart = editKey.slice(0, -suffix.length);
          const lastDot = fieldPart.lastIndexOf('.');
          const baseField = (lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1)))
            ? fieldPart.slice(0, lastDot)
            : fieldPart;
          delete store[recordId][baseField];
        });
        if (Object.keys(store[recordId]).length === 0) delete store[recordId];
        writeDrafts(store);
      }

      setApprovedSections(prev => ({ ...prev, [key]: true }));

      // Clear edit markers for this section
      setEditedSentences(prev => {
        const cleaned = { ...prev };
        for (const k of Object.keys(cleaned)) {
          if (fields.some(f => k.startsWith(`${f}-${idx}-s`))) delete cleaned[k];
        }
        return cleaned;
      });
      setEditedFields(prev => {
        const cleaned = { ...prev };
        for (const k of Object.keys(cleaned)) {
          if (fields.some(f => k.startsWith(`${f}-${idx}`))) delete cleaned[k];
        }
        return cleaned;
      });
    } catch (error) {
      console.error('Approve failed:', error);
    }
  }, [approvedSections, localEdits, pendingEdits]);

  // === Approve UI helpers ===
  const sectionHasEdits = (sectionId, idx) => {
    const fields = SECTION_FIELDS[sectionId] || [];
    return fields.some(f => {
      for (const k of Object.keys(editedSentences)) {
        if (k.startsWith(`${f}-${idx}-s`)) return true;
      }
      for (const k of Object.keys(editedFields)) {
        if (k.startsWith(`${f}-${idx}`)) return true;
      }
      return false;
    });
  };

  const renderApproveBtn = (record, sectionId, idx) => {
    const key = `${sectionId}-${idx}`;
    const isApproved = approvedSections[key];
    const hasEdits = sectionHasEdits(sectionId, idx);
    if (!hasEdits && !isApproved) return null;
    return (
      <button
        className={`approve-btn ${isApproved ? 'approved' : 'pending'}`}
        onClick={() => handleApproveSection(record, sectionId, idx)}
      >
        {isApproved ? 'Approved' : 'Pending Approve'}
      </button>
    );
  };

  // === Render Helpers ===

  // Simple editable field (short strings)
  const renderEditableField = (record, fieldName, idx, sectionId, label, showLabel = true) => {
    const val = getFieldValue(record, fieldName, idx);
    if (!val && !canEdit) return null;

    const editKey = `${fieldName}-${idx}`;
    const isEditing = editingField === editKey;
    // Saves may land in editedFields OR editedSentences (sentence-field fallback), keyed plain or with -s0.
    const isEdited = editedFields[editKey] || editedFields[`${editKey}-s0`]
      || editedSentences[editKey] || editedSentences[`${editKey}-s0`];

    const Wrapper = showLabel ? 'div' : React.Fragment;
    const wrapperProps = showLabel ? { className: 'rec-mini-card' } : {};

    if (isEditing) {
      return (
        <Wrapper {...wrapperProps}>
          {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
          {renderEditInputs(() => handleSaveField(record, fieldName, idx, sectionId))}
        </Wrapper>
      );
    }

    return (
      <Wrapper {...wrapperProps}>
        {showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}
        <div className={`numbered-row${isEdited ? ' modified' : ''}`}>
          <div
            className={`row-content${canEdit ? ' editable' : ''}`}
            onClick={() => canEdit && startEdit(editKey, val)}
          >
            <span className="content-value">{highlightText(String(val || ''))}</span>
            {canEdit && !isEdited && <span className="edit-indicator">✎</span>}
          </div>
          <button
            className={`copy-btn${copiedId === editKey ? ' copied' : ''}`}
            onClick={() => copyToClipboard(String(val || ''), editKey)}
          >
            {copiedId === editKey ? 'Copied' : 'Copy'}
          </button>
        </div>
        {isEdited && <div className="modified-badge">edited — click pending approve to save</div>}
      </Wrapper>
    );
  };

  // Per-sentence editable field (long text)
  const renderSentenceEditableField = (record, fieldName, idx, sectionId, label, showLabel = true) => {
    const val = String(getFieldValue(record, fieldName, idx) || '');
    if (!val && !canEdit) return null;

    const sentences = splitBySentence(val);
    if (sentences.length === 0 && !canEdit) return null;
    if (sentences.length <= 1) {
      return renderEditableField(record, fieldName, idx, sectionId, label, showLabel);
    }

    return sentences.map((sentence, sIdx) => {
      const parsed = parseLabel(sentence);

      // Per-sentence search filtering (4th level: field content)
      if (searchTerm && !record._showAllSections && !stm(label)) {
        const sentenceText = parsed.isLabeled ? `${parsed.label} ${parsed.value}` : sentence;
        if (!shouldShowRow(record, sentenceText)) {
          return null;
        }
      }
      const textToSplit = parsed.isLabeled ? parsed.value : sentence;
      // Only comma-split labeled values (structured lists), not unlabeled narrative sentences
      let commaParts = parsed.isLabeled ? splitByComma(textToSplit) : [textToSplit];
      // Handle "count (item1, item2, ...)" pattern where commas are inside parens
      if (commaParts.length < 2 && parsed.isLabeled) {
        const parenListMatch = textToSplit.match(/^\d+\s*\((.+)\)$/);
        if (parenListMatch) {
          commaParts = parenListMatch[1].split(',').map(s => s.trim()).filter(Boolean);
        }
      }
      const displayParts = commaParts.length >= 2 ? commaParts : [textToSplit];

      if (displayParts.length >= 2) {
        const fullSentence = sentence;
        const itemLabel = parsed.isLabeled ? parsed.label : null;

        const multiWrapperProps = { key: sIdx, className: 'rec-mini-card' };

        return (
          <div {...multiWrapperProps}>
            {parsed.isLabeled && (
              <div className="nested-subtitle">{highlightText(parsed.label)}</div>
            )}
            {displayParts.map((part, pi) => {
              const partEditKey = `${fieldName}-${idx}-s${sIdx}-p${pi}`;
              const isPartEditing = editingField === partEditKey;
              const isPartEdited = editedSentences[partEditKey] === 'edited';
              const partCopyId = `${fieldName}-${idx}-part-${sIdx}-${pi}`;

              if (isPartEditing) {
                const onSavePart = () => {
                  const newParts = [...displayParts];
                  newParts[pi] = editValue.trim();
                  const filteredParts = newParts.filter(p => p.trim().length > 0);
                  const sourceText = String(getFieldValue(record, fieldName, idx) || '');
                  let replacement = '';
                  if (filteredParts.length > 0) {
                    replacement = itemLabel ? `${itemLabel}: ${filteredParts.join(', ')}` : filteredParts.join(', ');
                  }
                  const newFullText = replacement
                    ? sourceText.replace(fullSentence, replacement)
                    : sourceText.replace(fullSentence, '').replace(/\.\s*\./g, '.').replace(/\s{2,}/g, ' ').trim();
                  handleSaveField(record, fieldName, idx, sectionId, 0, newFullText, partEditKey);
                };
                return <React.Fragment key={pi}>{renderEditInputs(onSavePart)}</React.Fragment>;
              }

              return (
                <React.Fragment key={pi}>
                  <div className={`numbered-row${isPartEdited ? ' modified' : ''}`}>
                    <div
                      className={`row-content${canEdit ? ' editable' : ''}`}
                      onClick={() => canEdit && startEdit(partEditKey, part)}
                    >
                      <span className="content-value">{highlightText(part)}</span>
                      {canEdit && !isPartEdited && <span className="edit-indicator">✎</span>}
                    </div>
                    <button
                      className={`copy-btn${copiedId === partCopyId ? ' copied' : ''}`}
                      onClick={() => copyToClipboard(part, partCopyId)}
                    >
                      {copiedId === partCopyId ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  {isPartEdited && <div className="modified-badge">edited — click pending approve to save</div>}
                </React.Fragment>
              );
            })}
          </div>
        );
      }

      // Single-item branch
      const sentenceEditKey = `${fieldName}-${idx}-s${sIdx}`;
      const isSentenceEditing = editingField === sentenceEditKey;
      const isSentenceEdited = editedSentences[sentenceEditKey] === 'edited';
      const sentenceCopyId = `${fieldName}-${idx}-sent-${sIdx}`;

      if (isSentenceEditing) {
        const onSaveSentence = () => {
          // Preserve "Label: value" structure for labeled sentences (the row edits only the value).
          let editedSentence = editValue.trim();
          if (parsed.isLabeled) editedSentence = `${parsed.label}: ${editedSentence}`;
          if (editedSentence && !/[.!?]$/.test(editedSentence)) editedSentence += '.';
          const allCurrent = splitBySentence(String(getFieldValue(record, fieldName, idx) || ''));
          const updated = allCurrent.map((s, i) => {
            const t = i === sIdx ? editedSentence : s;
            return (t && !/[.!?]$/.test(t)) ? t + '.' : t;
          });
          const newFullText = updated.filter(Boolean).join(' ');
          handleSaveField(record, fieldName, idx, sectionId, sIdx, newFullText, sentenceEditKey);
        };
        return (
          <div key={sIdx} className="rec-mini-card">
            {parsed.isLabeled && (
              <div className="nested-subtitle">{highlightText(parsed.label)}</div>
            )}
            {renderEditInputs(onSaveSentence)}
          </div>
        );
      }

      return (
        <div key={sIdx} className="rec-mini-card">
          {parsed.isLabeled && (
            <div className="nested-subtitle">{highlightText(parsed.label)}</div>
          )}
          <div className={`numbered-row${isSentenceEdited ? ' modified' : ''}`}>
            <div
              className={`row-content${canEdit ? ' editable' : ''}`}
              onClick={() => canEdit && startEdit(sentenceEditKey, parsed.isLabeled ? parsed.value : sentence)}
            >
              <span className="content-value">{highlightText(parsed.isLabeled ? parsed.value : sentence)}</span>
              {canEdit && !isSentenceEdited && <span className="edit-indicator">✎</span>}
            </div>
            <button
              className={`copy-btn${copiedId === sentenceCopyId ? ' copied' : ''}`}
              onClick={() => copyToClipboard(sentence, sentenceCopyId)}
            >
              {copiedId === sentenceCopyId ? 'Copied' : 'Copy'}
            </button>
          </div>
          {isSentenceEdited && <div className="modified-badge">edited — click pending approve to save</div>}
        </div>
      );
    });
  };

  // Array item editable (for string arrays like allergensTested, positiveReactions, etc.)
  const renderArrayItemEditable = (record, fieldName, idx, sectionId, arrayIndex, item) => {
    const arrEditKey = `${fieldName}-${idx}-arr-${arrayIndex}`;
    const isEditing = editingField === arrEditKey;
    const isEdited = editedFields[arrEditKey];
    const copyId = `${fieldName}-${idx}-item-${arrayIndex}`;

    if (isEditing) {
      const onSaveItem = () => {
        const currentArray = [...(getFieldValue(record, fieldName, idx) || [])];
        currentArray[arrayIndex] = editValue.trim();
        handleSaveField(record, fieldName, idx, sectionId, 0, currentArray, arrEditKey);
      };
      return <React.Fragment key={arrayIndex}>{renderEditInputs(onSaveItem)}</React.Fragment>;
    }

    return (
      <React.Fragment key={arrayIndex}>
        <div className={`numbered-row${isEdited ? ' modified' : ''}`}>
          <div
            className={`row-content${canEdit ? ' editable' : ''}`}
            onClick={() => canEdit && startEdit(arrEditKey, item)}
          >
            <span className="content-value">{highlightText(item)}</span>
            {canEdit && !isEdited && <span className="edit-indicator">✎</span>}
          </div>
          <button
            className={`copy-btn${copiedId === copyId ? ' copied' : ''}`}
            onClick={() => copyToClipboard(item, copyId)}
          >
            {copiedId === copyId ? 'Copied' : 'Copy'}
          </button>
        </div>
        {isEdited && <div className="modified-badge">edited — click pending approve to save</div>}
      </React.Fragment>
    );
  };

  // Dynamic-key object field renderer (e.g. whealSize — keys vary per record).
  // Renders each entry as humanized label + editable scalar; array-valued entries become rows.
  const renderObjectFieldEntry = (record, fieldName, idx, sectionId, key, rawVal) => {
    const entryEditKey = `${fieldName}-${idx}-key-${key}`;
    const copyId = `${fieldName}-${idx}-keycopy-${key}`;
    const isEditing = editingField === entryEditKey;
    const isEdited = editedFields[entryEditKey];
    const label = humanizeKey(key);

    // Build the new full object with this key replaced, then save the whole object (root field)
    const saveEntry = (newVal) => {
      const currentObj = getFieldValue(record, fieldName, idx) || {};
      const newObj = { ...currentObj, [key]: newVal };
      handleSaveField(record, fieldName, idx, sectionId, 0, newObj, entryEditKey);
    };

    // Array-valued entry → flatten to readable text (avoid [object Object])
    if (Array.isArray(rawVal)) {
      const flat = rawVal.map(v => (v !== null && typeof v === 'object') ? JSON.stringify(v) : String(v)).join(', ');
      return (
        <div key={key} className="rec-mini-card">
          <div className="nested-subtitle">{highlightText(label)}</div>
          <div className="numbered-row">
            <div className="row-content"><span className="content-value">{highlightText(flat)}</span></div>
            <button
              className={`copy-btn${copiedId === copyId ? ' copied' : ''}`}
              onClick={() => copyToClipboard(flat, copyId)}
            >
              {copiedId === copyId ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      );
    }

    // Nested object-valued entry → flatten to readable text (avoid [object Object])
    if (rawVal !== null && typeof rawVal === 'object') {
      const flat = Object.entries(rawVal).map(([k, v]) => `${humanizeKey(k)}: ${String(v)}`).join('; ');
      return (
        <div key={key} className="rec-mini-card">
          <div className="nested-subtitle">{highlightText(label)}</div>
          <div className="numbered-row">
            <div className="row-content"><span className="content-value">{highlightText(flat)}</span></div>
            <button
              className={`copy-btn${copiedId === copyId ? ' copied' : ''}`}
              onClick={() => copyToClipboard(flat, copyId)}
            >
              {copiedId === copyId ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      );
    }

    // Scalar entry → editable
    const scalarStr = String(rawVal ?? '');
    return (
      <div key={key} className="rec-mini-card">
        <div className="nested-subtitle">{highlightText(label)}</div>
        {isEditing ? (
          renderEditInputs(() => saveEntry(editValue.trim()))
        ) : (
          <>
            <div className={`numbered-row${isEdited ? ' modified' : ''}`}>
              <div
                className={`row-content${canEdit ? ' editable' : ''}`}
                onClick={() => canEdit && startEdit(entryEditKey, scalarStr)}
              >
                <span className="content-value">{highlightText(scalarStr)}</span>
                {canEdit && !isEdited && <span className="edit-indicator">✎</span>}
              </div>
              <button
                className={`copy-btn${copiedId === copyId ? ' copied' : ''}`}
                onClick={() => copyToClipboard(scalarStr, copyId)}
              >
                {copiedId === copyId ? 'Copied' : 'Copy'}
              </button>
            </div>
            {isEdited && <div className="modified-badge">edited — click pending approve to save</div>}
          </>
        )}
      </div>
    );
  };

  // === Copy Functions ===
  const copyToClipboard = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const getTestInfoText = (record, idx) => {
    let text = 'TEST INFORMATION\n';
    const testType = getFieldValue(record, 'testType', idx);
    const allergist = getFieldValue(record, 'allergist', idx);
    const facility = getFieldValue(record, 'facility', idx);
    const controls = getFieldValue(record, 'controls', idx);
    if (testType) text += `Test Type: ${testType}\n`;
    if (allergist) text += `Allergist: ${allergist}\n`;
    if (facility) text += `Facility: ${facility}\n`;
    if (controls) text += `Controls: ${controls}\n`;
    return text.trim();
  };

  const getObjectSectionText = (record, fieldName, idx, title) => {
    const obj = getFieldValue(record, fieldName, idx);
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return '';
    const entries = Object.entries(obj).filter(([, v]) => v !== null && v !== undefined && v !== '');
    if (entries.length === 0) return '';
    let text = `${title}\n`;
    entries.forEach(([k, v]) => {
      const flat = (v !== null && typeof v === 'object') ? JSON.stringify(v) : String(v);
      text += `${humanizeKey(k)}: ${flat}\n`;
    });
    return text.trim();
  };

  const getArraySectionText = (record, fieldName, idx, title) => {
    const arr = getFieldValue(record, fieldName, idx);
    if (!arr || !Array.isArray(arr) || arr.length === 0) return '';
    let text = `${title}\n`;
    arr.forEach((item, i) => { text += `${i + 1}. ${item}\n`; });
    return text.trim();
  };

  const getTextSectionText = (record, fieldName, idx, title) => {
    const val = getFieldValue(record, fieldName, idx);
    if (!val) return '';
    const sentences = splitBySentence(String(val));
    if (sentences.length <= 1) return `${title}\n${val}`;
    let n = 1;
    const lines = [];
    sentences.forEach(sentence => {
      const parsed = parseLabel(sentence);
      const textToSplit = parsed.isLabeled ? parsed.value : sentence;
      let commaParts = parsed.isLabeled ? splitByComma(textToSplit) : [textToSplit];
      if (commaParts.length < 2 && parsed.isLabeled) {
        const parenListMatch = textToSplit.match(/^\d+\s*\((.+)\)$/);
        if (parenListMatch) {
          commaParts = parenListMatch[1].split(',').map(s => s.trim()).filter(Boolean);
        }
      }
      const displayParts = commaParts.length >= 2 ? commaParts : [textToSplit];
      if (parsed.isLabeled && displayParts.length >= 2) {
        lines.push(`\n${parsed.label}`);
        displayParts.forEach(part => { lines.push(`${n++}. ${part}`); });
      } else if (parsed.isLabeled) {
        lines.push(`\n${parsed.label}`);
        lines.push(`${n++}. ${parsed.value}`);
      } else if (displayParts.length >= 2) {
        displayParts.forEach(part => { lines.push(`${n++}. ${part}`); });
      } else {
        lines.push(`${n++}. ${sentence}`);
      }
    });
    return `${title}\n${lines.join('\n')}`;
  };

  const getAllRecordText = (record, idx) => {
    const parts = [];
    if (record.date) parts.push(`Date: ${formatDate(record.date)}`);
    parts.push(getTestInfoText(record, idx));
    parts.push(getObjectSectionText(record, 'whealSize', idx, 'WHEAL SIZE'));
    parts.push(getArraySectionText(record, 'allergensTested', idx, 'ALLERGENS TESTED'));
    parts.push(getArraySectionText(record, 'positiveReactions', idx, 'POSITIVE REACTIONS'));
    parts.push(getArraySectionText(record, 'negativeReactions', idx, 'NEGATIVE REACTIONS'));
    parts.push(getArraySectionText(record, 'medicationWithheld', idx, 'MEDICATIONS WITHHELD'));
    parts.push(getTextSectionText(record, 'adverseReactions', idx, 'ADVERSE REACTIONS'));
    parts.push(getTextSectionText(record, 'interpretation', idx, 'INTERPRETATION'));
    parts.push(getTextSectionText(record, 'recommendations', idx, 'RECOMMENDATIONS'));
    parts.push(getTextSectionText(record, 'notes', idx, 'NOTES'));
    return parts.filter(Boolean).join('\n\n');
  };

  // === PDF Data ===
  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return unwrappedData;
    return unwrappedData.map((rec, idx) => {
      const merged = { ...rec };
      for (const [editKey, editVal] of Object.entries(localEdits)) {
        if (pendingEdits[editKey]) continue; // pending drafts stay OUT of the PDF until approved
        const dashIdx = editKey.lastIndexOf('-');
        const fieldName = editKey.substring(0, dashIdx);
        const recIdx = parseInt(editKey.substring(dashIdx + 1), 10);
        if (recIdx === idx) {
          merged[fieldName] = editVal;
        }
      }
      return merged;
    });
  }, [unwrappedData, localEdits, pendingEdits]);

  // === Search Highlighting ===
  const highlightText = (text) => {
    if (!text || !searchTerm) return text;
    const textStr = String(text);
    const searchLower = searchTerm.toLowerCase().trim();
    if (!searchLower) return textStr;

    const escaped = searchLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = textStr.split(regex);

    return parts.map((part, i) =>
      part.toLowerCase() === searchLower
        ? <mark key={i}>{part}</mark>
        : part
    );
  };

  // === 4-Level Search ===
  const shouldShowRow = (record, ...values) => {
    if (!searchTerm) return true;
    const searchLower = normalizeForSearch(searchTerm);
    if (!searchLower) return true;

    const combinedText = values.filter(Boolean)
      .map(arg => normalizeForSearch(arg))
      .join(' ');

    return combinedText.includes(searchLower) || searchLower.split(/\s+/).every(word =>
      combinedText.includes(word)
    );
  };

  // sectionTitleMatches helper (variadic, normalizes special chars)
  const stm = (...titles) => {
    if (!searchTerm.trim()) return true;
    const p = normalizeForSearch(searchTerm);
    return titles.some(title => {
      const t = normalizeForSearch(title);
      return t.startsWith(p) || p.startsWith(t);
    });
  };

  // shouldShowSection helper (4-level: document → section → row → field)
  const shouldShowSection = (record, sectionId, title, idx) => {
    if (!searchTerm.trim() || record._showAllSections) return true;
    if (stm(title)) return true;
    const fields = SECTION_FIELDS[sectionId] || [];
    // Check field labels (e.g. "Test Type", "Allergist")
    const fieldLabels = fields.map(f => FIELD_LABELS[f]).filter(Boolean);
    if (fieldLabels.length > 0 && stm(...fieldLabels)) return true;
    return fields.some(f => {
      const val = getFieldValue(record, f, idx);
      if (Array.isArray(val)) return val.some(item => shouldShowRow(record, item));
      if (val && typeof val === 'object') {
        return Object.entries(val).some(([k, v]) => shouldShowRow(record, humanizeKey(k), String(v)));
      }
      return val && shouldShowRow(record, val);
    });
  };

  // === Filtered Records ===
  const filteredRecords = useMemo(() => {
    const recordsWithMeta = unwrappedData.map((record, idx) => ({
      ...record,
      _documentTitle: `Allergy Skin Testing ${idx + 1}`,
      _recordNumber: idx + 1,
      _originalIdx: idx,
    }));

    if (!searchTerm) return recordsWithMeta;

    const searchNorm = normalizeForSearch(searchTerm);

    return recordsWithMeta.map(record => {
      record._showAllSections = false;

      const chartDataForSearch = extractClassData(record.positiveReactions);
      const chartCategories = [...new Set(chartDataForSearch.map(item => item.category))];
      const chartInterpretations = chartDataForSearch.map(item => getClassInterpretation(item.classLevel));

      const searchableText = normalizeForSearch([
        record._documentTitle,
        `allergy skin testing ${record._recordNumber}`,
        `test ${record._recordNumber}`, String(record._recordNumber),
        'allergy skin testing', 'allergy test', 'ige class', 'reaction severity', 'positive reactions chart',
        record.testType, record.allergist, record.facility, record.controls,
        record.adverseReactions, record.interpretation, record.recommendations, record.notes,
        formatDate(record.date), formatDateISO(record.date),
        'test information', 'wheal size', 'allergens tested', 'negative reactions', 'medications withheld',
        'adverse reactions', 'interpretation', 'recommendations', 'notes',
        ...Object.values(FIELD_LABELS),
        ...(record.whealSize && typeof record.whealSize === 'object' && !Array.isArray(record.whealSize)
          ? Object.entries(record.whealSize).flatMap(([k, v]) => [humanizeKey(k), String(v)])
          : []),
        'molds/fungi', 'environmental', 'pollens', 'foods', 'animals',
        ...chartCategories, ...chartInterpretations,
        ...(record.allergensTested || []),
        ...(record.positiveReactions || []),
        ...(record.negativeReactions || []),
        ...(record.medicationWithheld || []),
        ...chartDataForSearch.map(item => item.allergen),
      ].filter(Boolean).join(' '));

      const matches = searchNorm.split(/\s+/).every(word =>
        searchableText.includes(word)
      );

      if (matches) {
        const titleNorm = normalizeForSearch(record._documentTitle);
        if (searchNorm.split(/\s+/).every(term => titleNorm.includes(term))) {
          record._showAllSections = true;
        }
        return record;
      }
      return null;
    }).filter(Boolean);
  }, [unwrappedData, searchTerm]);

  // === Main Render ===
  if (!unwrappedData || unwrappedData.length === 0) {
    return (
      <div className="allergy-skin-testing-document">
        <div className="empty-state">
          <div className="empty-icon">🧪</div>
          <p className="empty-text">No allergy skin testing records found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="allergy-skin-testing-document">
      {/* Document Header */}
      <div className="document-header">
        <h1 className="document-title">Allergy Skin Testing</h1>
        <div className="header-actions">
          <button
            className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`}
            onClick={() => {
              const allText = filteredRecords.map(r => getAllRecordText(r, r._originalIdx)).join('\n\n---\n\n');
              copyToClipboard(allText, 'copy-all');
            }}
          >
            {copiedId === 'copy-all' ? 'Copied' : 'Copy All'}
          </button>
          <PDFDownloadLink
            document={<AllergySkinTestingPDFTemplate document={pdfData} />}
            fileName="Allergy_Skin_Testing.pdf"
          >
            {({ loading }) => (
              <button className="copy-btn">{loading ? 'Preparing...' : 'Export PDF'}</button>
            )}
          </PDFDownloadLink>
        </div>
      </div>

      {/* Search */}
      <div className="search-container">
        <input
          type="text"
          className="search-input"
          placeholder="Search allergy tests..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <button className="clear-search" onClick={() => setSearchTerm('')}>×</button>
        )}
      </div>

      {/* Records */}
      <div className="records-list">
        {filteredRecords.length === 0 ? (
          <div className="no-results">No results found for "{searchTerm}"</div>
        ) : (
          filteredRecords.map((record, filteredIdx) => {
            const idx = record._originalIdx;
            const showAll = record._showAllSections;
            const showAllContent = !searchTerm;
            const isSearching = searchTerm.length > 0;

            // Chart data derives from current positiveReactions (may be edited)
            const currentPositiveReactions = getFieldValue(record, 'positiveReactions', idx);
            const chartData = extractClassData(currentPositiveReactions);
            const hasChartData = chartData.length > 0;

            return (
              <article key={filteredIdx} className="record-card">
                {/* Card Header */}
                <div className="card-header">
                  <div className="header-top-row">
                    {record.date && (
                      <span className="date-badge">{highlightText(formatDate(record.date))}</span>
                    )}
                  </div>
                  <h2 className="card-title">
                    {highlightText(record._documentTitle || `Allergy Skin Testing ${idx + 1}`)}
                  </h2>
                </div>

                <div className="card-content">
                  {/* Positive Reactions Chart */}
                  {(() => {
                    if (!hasChartData) return null;
                    if (!shouldShowSection(record, 'positiveReactions', 'Positive Reactions Chart', idx)) return null;

                    const groupedData = groupByCategory(chartData);
                    const filteredGroups = (() => {
                      if (!searchTerm.trim() || showAll) return groupedData;
                      if (stm('Positive Reactions Chart', 'IgE Class', 'Reaction Severity')) return groupedData;

                      return groupedData.map(group => {
                        if (shouldShowRow(record, group.category)) return group;
                        const filteredItems = group.items.filter(item =>
                          shouldShowRow(record, item.allergen, `class ${item.classLevel}`, getClassInterpretation(item.classLevel), item.rawText)
                        );
                        return filteredItems.length > 0 ? { ...group, items: filteredItems } : null;
                      }).filter(Boolean);
                    })();

                    if (filteredGroups.length === 0) return null;

                    return (
                      <section className="mini-cards-container">
                        <div className="section-header">
                          <h4 className="section-title">{highlightText('Positive Reactions Chart')}</h4>
                          <div className="header-right-actions">
                            <button
                              className={`copy-btn${copiedId === `chart-${idx}` ? ' copied' : ''}`}
                              onClick={() => copyToClipboard(
                                getArraySectionText(record, 'positiveReactions', idx, 'POSITIVE REACTIONS'),
                                `chart-${idx}`
                              )}
                            >
                              {copiedId === `chart-${idx}` ? 'Copied' : 'Copy Section'}
                            </button>
                            {renderApproveBtn(record, 'positiveReactions', idx)}
                          </div>
                        </div>
                        <div className="chart-container">
                          <div className="chart-legend">
                            {[
                              { color: '#22c55e', label: 'Class 0 (Negative)' },
                              { color: '#84cc16', label: 'Class 1 (Low)' },
                              { color: '#eab308', label: 'Class 2 (Moderate)' },
                              { color: '#f97316', label: 'Class 3 (High)' },
                              { color: '#ef4444', label: 'Class 4+ (Very High)' },
                            ].map(({ color, label }) => (
                              <div key={label} className="legend-item">
                                <span className="legend-color" style={{ background: color }}></span>
                                <span>{highlightText(label)}</span>
                              </div>
                            ))}
                          </div>
                          {filteredGroups.map((group, groupIdx) => (
                            <div key={groupIdx} className="chart-category">
                              <div className="category-header">{highlightText(group.category)}</div>
                              {group.items.map((item, chartIdx) => {
                                // Find the original array index for this item
                                const arrItems = currentPositiveReactions || [];
                                const origArrIdx = arrItems.indexOf(item.rawText);

                                return (
                                  <div key={chartIdx} className="bar-chart-row">
                                    <div className="bar-label-row">
                                      <div className="bar-label">{highlightText(item.allergen)}</div>
                                      <div className="bar-description">{highlightText(getAllergenDescription(item.allergen))}</div>
                                    </div>
                                    <div className="bar-container">
                                      <div className="bar-background">
                                        <div
                                          className="bar-fill"
                                          style={{
                                            width: `${Math.min((item.classLevel / 6) * 100, 100)}%`,
                                            background: getClassColor(item.classLevel),
                                          }}
                                        ></div>
                                      </div>
                                      <div className="bar-value">
                                        {highlightText(`Class ${item.classLevel}`)}
                                        {item.kuValue && ` (${highlightText(`${item.kuValue} kU/L`)})`}
                                      </div>
                                    </div>
                                    <div className="bar-interpretation" style={{ color: getClassColor(item.classLevel) }}>
                                      {highlightText(getClassInterpretation(item.classLevel))}
                                    </div>
                                    {/* Inline edit for this positive reaction array item */}
                                    {canEdit && origArrIdx >= 0 && (() => {
                                      const arrEditKey = `positiveReactions-${idx}-arr-${origArrIdx}`;
                                      const isEdited = editedFields[arrEditKey];
                                      return isEdited ? (
                                        <div className="modified-badge">edited — click pending approve to save</div>
                                      ) : (
                                        <button
                                          className="edit-bar-btn"
                                          onClick={() => startEdit(arrEditKey, item.rawText)}
                                          title="Edit this reaction"
                                        >✎</button>
                                      );
                                    })()}
                                    {/* Edit textarea for this chart item */}
                                    {editingField === `positiveReactions-${idx}-arr-${origArrIdx}` && (
                                      <div style={{ marginTop: 8 }}>
                                        {renderEditInputs(() => {
                                          const currentArr = [...(getFieldValue(record, 'positiveReactions', idx) || [])];
                                          currentArr[origArrIdx] = editValue.trim();
                                          handleSaveField(record, 'positiveReactions', idx, 'positiveReactions', 0, currentArr, `positiveReactions-${idx}-arr-${origArrIdx}`);
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </section>
                    );
                  })()}

                  {/* Test Information */}
                  {(() => {
                    if (!shouldShowSection(record, 'testInfo', 'Test Information', idx)) return null;
                    const testType = getFieldValue(record, 'testType', idx);
                    const allergist = getFieldValue(record, 'allergist', idx);
                    const facility = getFieldValue(record, 'facility', idx);
                    const controls = getFieldValue(record, 'controls', idx);
                    if (!testType && !allergist && !facility && !controls) return null;

                    return (
                      <section className="mini-cards-container">
                        <div className="section-header">
                          <h4 className="section-title">{highlightText('Test Information')}</h4>
                          <div className="header-right-actions">
                            <button
                              className={`copy-btn${copiedId === `testinfo-${idx}` ? ' copied' : ''}`}
                              onClick={() => copyToClipboard(getTestInfoText(record, idx), `testinfo-${idx}`)}
                            >
                              {copiedId === `testinfo-${idx}` ? 'Copied' : 'Copy Section'}
                            </button>
                            {renderApproveBtn(record, 'testInfo', idx)}
                          </div>
                        </div>
                        {testType && (showAllContent || showAll || stm('Test Information') || shouldShowRow(record, 'test type', testType)) &&
                          renderEditableField(record, 'testType', idx, 'testInfo', 'Test Type')}
                        {allergist && (showAllContent || showAll || stm('Test Information') || shouldShowRow(record, 'allergist', allergist)) &&
                          renderEditableField(record, 'allergist', idx, 'testInfo', 'Allergist')}
                        {facility && (showAllContent || showAll || stm('Test Information') || shouldShowRow(record, 'facility', facility)) &&
                          renderEditableField(record, 'facility', idx, 'testInfo', 'Facility')}
                        {controls && (showAllContent || showAll || stm('Test Information') || shouldShowRow(record, 'controls', controls)) &&
                          renderSentenceEditableField(record, 'controls', idx, 'testInfo', 'Controls')}
                      </section>
                    );
                  })()}

                  {/* Wheal Size (dynamic-key object — keys vary per record) */}
                  {(() => {
                    const obj = getFieldValue(record, 'whealSize', idx);
                    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
                    const entries = Object.entries(obj).filter(([, v]) => v !== null && v !== undefined && v !== '');
                    if (entries.length === 0) return null;
                    if (!shouldShowSection(record, 'whealSize', 'Wheal Size', idx)) return null;

                    const filteredEntries = entries.filter(([k, v]) =>
                      showAllContent || showAll || stm('Wheal Size') || shouldShowRow(record, humanizeKey(k), String(v))
                    );
                    if (filteredEntries.length === 0) return null;

                    return (
                      <section className="mini-cards-container">
                        <div className="section-header">
                          <h4 className="section-title">{highlightText('Wheal Size')}</h4>
                          <div className="header-right-actions">
                            <button
                              className={`copy-btn${copiedId === `wheal-${idx}` ? ' copied' : ''}`}
                              onClick={() => copyToClipboard(getObjectSectionText(record, 'whealSize', idx, 'WHEAL SIZE'), `wheal-${idx}`)}
                            >
                              {copiedId === `wheal-${idx}` ? 'Copied' : 'Copy Section'}
                            </button>
                            {renderApproveBtn(record, 'whealSize', idx)}
                          </div>
                        </div>
                        {filteredEntries.map(([k, v]) =>
                          renderObjectFieldEntry(record, 'whealSize', idx, 'whealSize', k, v)
                        )}
                      </section>
                    );
                  })()}

                  {/* Allergens Tested */}
                  {(() => {
                    const arr = getFieldValue(record, 'allergensTested', idx);
                    if (!arr || !Array.isArray(arr) || arr.length === 0) return null;
                    if (!shouldShowSection(record, 'allergensTested', 'Allergens Tested', idx)) return null;

                    const filteredItems = arr.map((item, i) => ({ item, origIdx: i })).filter(({ item }) =>
                      showAllContent || showAll || stm('Allergens Tested') || shouldShowRow(record, item)
                    );
                    if (filteredItems.length === 0) return null;

                    return (
                      <section className="mini-cards-container">
                        <div className="section-header">
                          <h4 className="section-title">{highlightText('Allergens Tested')}</h4>
                          <div className="header-right-actions">
                            <button
                              className={`copy-btn${copiedId === `allergens-${idx}` ? ' copied' : ''}`}
                              onClick={() => copyToClipboard(getArraySectionText(record, 'allergensTested', idx, 'ALLERGENS TESTED'), `allergens-${idx}`)}
                            >
                              {copiedId === `allergens-${idx}` ? 'Copied' : 'Copy Section'}
                            </button>
                            {renderApproveBtn(record, 'allergensTested', idx)}
                          </div>
                        </div>
                        {filteredItems.map(({ item, origIdx }) =>
                          renderArrayItemEditable(record, 'allergensTested', idx, 'allergensTested', origIdx, item)
                        )}
                      </section>
                    );
                  })()}

                  {/* Negative Reactions */}
                  {(() => {
                    const arr = getFieldValue(record, 'negativeReactions', idx);
                    if (!arr || !Array.isArray(arr) || arr.length === 0) return null;
                    if (!shouldShowSection(record, 'negativeReactions', 'Negative Reactions', idx)) return null;

                    const filteredItems = arr.map((item, i) => ({ item, origIdx: i })).filter(({ item }) =>
                      showAllContent || showAll || stm('Negative Reactions') || shouldShowRow(record, item)
                    );
                    if (filteredItems.length === 0) return null;

                    return (
                      <section className="mini-cards-container negative-section">
                        <div className="section-header">
                          <h4 className="section-title negative-title">{highlightText('Negative Reactions')}</h4>
                          <div className="header-right-actions">
                            <button
                              className={`copy-btn${copiedId === `negative-${idx}` ? ' copied' : ''}`}
                              onClick={() => copyToClipboard(getArraySectionText(record, 'negativeReactions', idx, 'NEGATIVE REACTIONS'), `negative-${idx}`)}
                            >
                              {copiedId === `negative-${idx}` ? 'Copied' : 'Copy Section'}
                            </button>
                            {renderApproveBtn(record, 'negativeReactions', idx)}
                          </div>
                        </div>
                        <div className="negative-wrapper">
                          {filteredItems.map(({ item, origIdx }) =>
                            renderArrayItemEditable(record, 'negativeReactions', idx, 'negativeReactions', origIdx, item)
                          )}
                        </div>
                      </section>
                    );
                  })()}

                  {/* Medications Withheld */}
                  {(() => {
                    const arr = getFieldValue(record, 'medicationWithheld', idx);
                    if (!arr || !Array.isArray(arr) || arr.length === 0) return null;
                    if (!shouldShowSection(record, 'medicationsWithheld', 'Medications Withheld', idx)) return null;

                    const filteredItems = arr.map((item, i) => ({ item, origIdx: i })).filter(({ item }) =>
                      showAllContent || showAll || stm('Medications Withheld') || shouldShowRow(record, item)
                    );
                    if (filteredItems.length === 0) return null;

                    return (
                      <section className="mini-cards-container">
                        <div className="section-header">
                          <h4 className="section-title">{highlightText('Medications Withheld')}</h4>
                          <div className="header-right-actions">
                            <button
                              className={`copy-btn${copiedId === `meds-${idx}` ? ' copied' : ''}`}
                              onClick={() => copyToClipboard(getArraySectionText(record, 'medicationWithheld', idx, 'MEDICATIONS WITHHELD'), `meds-${idx}`)}
                            >
                              {copiedId === `meds-${idx}` ? 'Copied' : 'Copy Section'}
                            </button>
                            {renderApproveBtn(record, 'medicationsWithheld', idx)}
                          </div>
                        </div>
                        {filteredItems.map(({ item, origIdx }) =>
                          renderArrayItemEditable(record, 'medicationWithheld', idx, 'medicationsWithheld', origIdx, item)
                        )}
                      </section>
                    );
                  })()}

                  {/* Adverse Reactions */}
                  {(() => {
                    const val = getFieldValue(record, 'adverseReactions', idx);
                    if (!val) return null;
                    if (!shouldShowSection(record, 'adverseReactions', 'Adverse Reactions', idx)) return null;

                    return (
                      <section className="mini-cards-container">
                        <div className="section-header">
                          <h4 className="section-title">{highlightText('Adverse Reactions')}</h4>
                          <div className="header-right-actions">
                            <button
                              className={`copy-btn${copiedId === `adverse-${idx}` ? ' copied' : ''}`}
                              onClick={() => copyToClipboard(getTextSectionText(record, 'adverseReactions', idx, 'ADVERSE REACTIONS'), `adverse-${idx}`)}
                            >
                              {copiedId === `adverse-${idx}` ? 'Copied' : 'Copy Section'}
                            </button>
                            {renderApproveBtn(record, 'adverseReactions', idx)}
                          </div>
                        </div>
                        {renderEditableField(record, 'adverseReactions', idx, 'adverseReactions', 'Adverse Reactions', false)}
                      </section>
                    );
                  })()}

                  {/* Interpretation */}
                  {(() => {
                    const val = getFieldValue(record, 'interpretation', idx);
                    if (!val) return null;
                    if (!shouldShowSection(record, 'interpretation', 'Interpretation', idx)) return null;

                    return (
                      <section className="mini-cards-container">
                        <div className="section-header">
                          <h4 className="section-title">{highlightText('Interpretation')}</h4>
                          <div className="header-right-actions">
                            <button
                              className={`copy-btn${copiedId === `interp-${idx}` ? ' copied' : ''}`}
                              onClick={() => copyToClipboard(getTextSectionText(record, 'interpretation', idx, 'INTERPRETATION'), `interp-${idx}`)}
                            >
                              {copiedId === `interp-${idx}` ? 'Copied' : 'Copy Section'}
                            </button>
                            {renderApproveBtn(record, 'interpretation', idx)}
                          </div>
                        </div>
                        {renderSentenceEditableField(record, 'interpretation', idx, 'interpretation', 'Interpretation', false)}
                      </section>
                    );
                  })()}

                  {/* Recommendations */}
                  {(() => {
                    const val = getFieldValue(record, 'recommendations', idx);
                    if (!val) return null;
                    if (!shouldShowSection(record, 'recommendations', 'Recommendations', idx)) return null;

                    return (
                      <section className="mini-cards-container">
                        <div className="section-header">
                          <h4 className="section-title">{highlightText('Recommendations')}</h4>
                          <div className="header-right-actions">
                            <button
                              className={`copy-btn${copiedId === `rec-${idx}` ? ' copied' : ''}`}
                              onClick={() => copyToClipboard(getTextSectionText(record, 'recommendations', idx, 'RECOMMENDATIONS'), `rec-${idx}`)}
                            >
                              {copiedId === `rec-${idx}` ? 'Copied' : 'Copy Section'}
                            </button>
                            {renderApproveBtn(record, 'recommendations', idx)}
                          </div>
                        </div>
                        {renderSentenceEditableField(record, 'recommendations', idx, 'recommendations', 'Recommendations', false)}
                      </section>
                    );
                  })()}

                  {/* Notes */}
                  {(() => {
                    const val = getFieldValue(record, 'notes', idx);
                    if (!val) return null;
                    if (!shouldShowSection(record, 'notes', 'Notes', idx)) return null;

                    return (
                      <section className="mini-cards-container">
                        <div className="section-header">
                          <h4 className="section-title">{highlightText('Notes')}</h4>
                          <div className="header-right-actions">
                            <button
                              className={`copy-btn${copiedId === `notes-${idx}` ? ' copied' : ''}`}
                              onClick={() => copyToClipboard(getTextSectionText(record, 'notes', idx, 'NOTES'), `notes-${idx}`)}
                            >
                              {copiedId === `notes-${idx}` ? 'Copied' : 'Copy Section'}
                            </button>
                            {renderApproveBtn(record, 'notes', idx)}
                          </div>
                        </div>
                        {renderSentenceEditableField(record, 'notes', idx, 'notes', 'Notes', false)}
                      </section>
                    );
                  })()}
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AllergySkinTestingDocument;
