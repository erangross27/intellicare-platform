/**
 * EndocrineTherapyDocumentPDFTemplate.jsx
 * July 2026 — box-free canonical — LETTER — BLACK & WHITE ONLY (#000000)
 * Collection: endocrine_therapy. Mirrors EndocrineTherapyDocument.jsx (4-area rule):
 * numbered value rows, dot-notation nested fields, recursive results object (stacked leaves),
 * date-grouped recommendations, single-name gate, section title rides the first present field's
 * glue View, per-field wrap={false} anti-orphan, break={idx>0}.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 44, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.4, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 20 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { paddingBottom: 18 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 12, paddingBottom: 6 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 10, marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldGroup: { marginBottom: 8 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  fieldValue: { fontSize: 14, lineHeight: 1.4, color: '#000000', marginBottom: 1 },
  noDataText: { fontSize: 14, color: '#000000', textAlign: 'center', marginTop: 40 },
});

/* ═══════ CONFIG (mirror JSX) ═══════ */
const SECTION_TITLES = {
  'session-info': 'Session Information', 'medication-info': 'Medication Information', 'side-effects': 'Side Effects',
  'side-effect-mgmt': 'Side Effect Management', 'hormone-receptor': 'Hormone Receptor Status', 'ovarian-suppression': 'Ovarian Suppression',
  'menopause-status': 'Menopause Status', 'bone-protection': 'Bone Protection & Extended Therapy', 'plan-section': 'Plan',
  'assessment-notes': 'Assessment & Notes', 'results-section': 'Results', 'recommendations-section': 'Recommendations',
};
const FIELD_LABELS = {
  date: 'Date', startDate: 'Start Date', provider: 'Provider', facility: 'Facility', status: 'Status',
  medication: 'Medication', plannedDuration: 'Planned Duration', compliance: 'Compliance', sideEffects: 'Side Effects',
  'sideEffectManagement.arthralgias.currentManagement': 'Arthralgias — Current Management',
  'sideEffectManagement.arthralgias.alternativeOptions': 'Arthralgias — Alternative Options',
  'sideEffectManagement.hotFlashes.frequency': 'Hot Flashes — Frequency',
  'sideEffectManagement.hotFlashes.currentManagement': 'Hot Flashes — Current Management',
  'sideEffectManagement.hotFlashes.alternativeOptions': 'Hot Flashes — Alternative Options',
  'sideEffectManagement.vaginalDryness.currentManagement': 'Vaginal Dryness — Current Management',
  'sideEffectManagement.vaginalDryness.treatments': 'Vaginal Dryness — Treatments',
  'hormoneReceptorStatus.er': 'ER Status', 'hormoneReceptorStatus.pr': 'PR Status', 'hormoneReceptorStatus.her2': 'HER2 Status',
  ovarianSuppression: 'Ovarian Suppression',
  'menopauseStatus.status': 'Menopause Status', 'menopauseStatus.surgicalHistory': 'Surgical History',
  'menopauseStatus.symptoms': 'Symptoms', 'menopauseStatus.hormoneLevels.estradiol': 'Estradiol',
  boneProtection: 'Bone Protection', extendedTherapyDiscussion: 'Extended Therapy Discussion',
  plan: 'Plan', assessment: 'Assessment', findings: 'Findings', notes: 'Notes', results: 'Results', recommendations: 'Recommendations',
};
const SECTION_FIELDS = {
  'session-info': ['date', 'startDate', 'provider', 'facility', 'status'],
  'medication-info': ['medication', 'plannedDuration', 'compliance'],
  'side-effects': ['sideEffects'],
  'side-effect-mgmt': ['sideEffectManagement.arthralgias.currentManagement', 'sideEffectManagement.arthralgias.alternativeOptions', 'sideEffectManagement.hotFlashes.frequency', 'sideEffectManagement.hotFlashes.currentManagement', 'sideEffectManagement.hotFlashes.alternativeOptions', 'sideEffectManagement.vaginalDryness.currentManagement', 'sideEffectManagement.vaginalDryness.treatments'],
  'hormone-receptor': ['hormoneReceptorStatus.er', 'hormoneReceptorStatus.pr', 'hormoneReceptorStatus.her2'],
  'ovarian-suppression': ['ovarianSuppression'],
  'menopause-status': ['menopauseStatus.status', 'menopauseStatus.surgicalHistory', 'menopauseStatus.symptoms', 'menopauseStatus.hormoneLevels.estradiol'],
  'bone-protection': ['boneProtection', 'extendedTherapyDiscussion'],
  'plan-section': ['plan'],
  'assessment-notes': ['assessment', 'findings', 'notes'],
  'results-section': ['results'],
  'recommendations-section': ['recommendations'],
};
const DATE_FIELDS = ['date', 'startDate'];
const BOOLEAN_FIELDS = ['ovarianSuppression'];
const ENUM_FIELDS = ['status'];
const ENUM_OPTIONS = { status: ['Active', 'Completed', 'Not Active'] };
const enumCanonical = (fn, v) => { const opts = ENUM_OPTIONS[fn] || []; const s = String(v ?? '').trim(); return opts.find(o => o.toLowerCase() === s.toLowerCase()) || s; };
const STRING_ARRAY_FIELDS = ['sideEffects', 'sideEffectManagement.arthralgias.alternativeOptions', 'sideEffectManagement.hotFlashes.alternativeOptions', 'sideEffectManagement.vaginalDryness.treatments', 'menopauseStatus.symptoms'];
const SENTENCE_FIELDS = ['plan', 'assessment', 'findings', 'notes', 'extendedTherapyDiscussion'];
const OBJECT_FIELDS = ['results'];
const OBJECT_ARRAY_FIELDS = ['recommendations'];

/* ═══════ UTILS ═══════ */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/µm/g, 'um').replace(/μm/g, 'um').replace(/°/g, ' deg')
    .replace(/±/g, '+/-').replace(/≥/g, '>=').replace(/≤/g, '<=')
    .replace(/→/g, '->').replace(/“/g, '"').replace(/”/g, '"')
    .replace(/‘/g, "'").replace(/’/g, "'").replace(/—/g, '-').replace(/–/g, '-');
  return str;
};
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const isEmptyDeep = (v) => { if (v === null || v === undefined) return true; if (typeof v === 'boolean') return false; if (typeof v === 'number') return !Number.isFinite(v); if (typeof v === 'string') return v.trim() === ''; if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0; if (typeof v === 'object') return Object.values(v).every(isEmptyDeep); return false; };
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const KEY_OVERRIDES = { er: 'ER', pr: 'PR', her2: 'HER2', tsh: 'TSH', t3: 'T3', t4: 'T4', bmi: 'BMI' };
const humanizeKey = (key) => { if (key === null || key === undefined || key === '') return ''; if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key]; const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); return s.charAt(0).toUpperCase() + s.slice(1); };
const formatDate = (dateValue) => { if (!dateValue) return ''; try { const d = new Date(dateValue.$date || dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); } };
const parseLabel = (text) => { if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' }; const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/); if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() }; return { isLabeled: false, label: '', value: text }; };
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|mg|kg|ml|mcg))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) { const ch = text[i]; if (ch === '(') { depth++; current += ch; } else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; } else if (ch === ',' && depth === 0) { const t = current.trim(); if (t) result.push(t); current = ''; } else { current += ch; } }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

const getFieldValue = (record, f) => {
  if (!f.includes('.')) return record[f];
  const parts = f.split('.'); let v = record;
  for (const p of parts) { if (v && typeof v === 'object') v = v[p]; else return undefined; }
  return v;
};
const fieldPresent = (record, f) => {
  const v = getFieldValue(record, f);
  if (OBJECT_ARRAY_FIELDS.includes(f)) return Array.isArray(v) && v.filter(r => !isEmptyDeep(r)).length > 0;
  if (OBJECT_FIELDS.includes(f)) return v && typeof v === 'object' && !isScalar(v) && !isEmptyDeep(v);
  if (STRING_ARRAY_FIELDS.includes(f)) return Array.isArray(v) && v.filter(x => !isEmptyDeep(x)).length > 0;
  return hasVal(v);
};

/* recursive object → stacked rows (key sub-label + value; never side-by-side) */
const objectRows = (label, value) => {
  const out = [];
  if (isEmptyDeep(value)) return out;
  if (isScalar(value)) { if (label) out.push({ sub: safeString(label) }); out.push({ value: safeString(fmtScalar(value)) }); return out; }
  if (label) out.push({ sub: safeString(label) });
  Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => out.push(...objectRows(humanizeKey(k), v)));
  return out;
};

/* rows for a field → [{sub?} | {value}] mirroring the JSX Copy */
const fieldRows = (record, f) => {
  const val = getFieldValue(record, f);
  const rows = [];
  if (DATE_FIELDS.includes(f)) { rows.push({ value: `1. ${formatDate(val)}` }); }
  else if (BOOLEAN_FIELDS.includes(f)) { rows.push({ value: `1. ${val ? 'Yes' : 'No'}` }); }
  else if (ENUM_FIELDS.includes(f)) { rows.push({ value: `1. ${safeString(enumCanonical(f, val))}` }); }
  else if (OBJECT_ARRAY_FIELDS.includes(f)) {
    const recs = Array.isArray(val) ? val.filter(r => !isEmptyDeep(r)) : [];
    let lastDate = null; let n = 1;
    recs.forEach(r => { const rec = (r?.recommendation || '').trim(); const date = (r?.date || '').trim(); if (date !== lastDate) { if (date) rows.push({ sub: safeString(date) }); lastDate = date; n = 1; } if (rec) rows.push({ value: `${n++}. ${safeString(rec)}` }); });
  } else if (OBJECT_FIELDS.includes(f)) {
    Object.entries(val).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => rows.push(...objectRows(humanizeKey(k), v)));
  } else if (SENTENCE_FIELDS.includes(f)) {
    let n = 1;
    splitBySentence(fmtVal(val)).forEach(s => {
      const parsed = parseLabel(s);
      if (parsed.isLabeled) { rows.push({ sub: safeString(parsed.label) }); const parts = splitByComma(parsed.value); if (parts.length >= 2) parts.forEach(p => rows.push({ value: `${n++}. ${safeString(p)}` })); else rows.push({ value: `${n++}. ${safeString(parsed.value)}` }); }
      else rows.push({ value: `${n++}. ${safeString(s)}` });
    });
  } else if (STRING_ARRAY_FIELDS.includes(f) || Array.isArray(val)) {
    (Array.isArray(val) ? val : []).filter(x => !isEmptyDeep(x)).forEach((item, i) => rows.push({ value: `${i + 1}. ${safeString(fmtVal(item))}` }));
  } else {
    rows.push({ value: `1. ${safeString(fmtVal(val))}` });
  }
  return rows;
};

/* one field = one glue View (anti-orphan). sectionTitle rides the first present field. single-name gate. */
const renderField = (record, f, sectionTitle, idx) => {
  const label = FIELD_LABELS[f] || f;
  const showLabel = label.toLowerCase() !== (sectionTitle || '').toLowerCase();
  const rows = fieldRows(record, f);
  return (
    <View key={`${idx}-${f}`} style={styles.fieldGroup} wrap={rows.length > 22 ? true : false}>
      {sectionTitle ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null}
      {showLabel ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      {rows.map((r, i) => r.sub
        ? <Text key={i} style={styles.fieldLabel}>{r.sub}</Text>
        : <Text key={i} style={styles.fieldValue}>{r.value}</Text>)}
    </View>
  );
};

const renderSection = (record, sid, idx) => {
  const fields = SECTION_FIELDS[sid] || [];
  const present = fields.filter(f => fieldPresent(record, f));
  if (present.length === 0) return null;
  const title = SECTION_TITLES[sid];
  return present.map((f, i) => renderField(record, f, i === 0 ? title : null, idx));
};

/* ═══════ COMPONENT ═══════ */
const EndocrineTherapyDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.endocrine_therapy) return Array.isArray(r.endocrine_therapy) ? r.endocrine_therapy : [r.endocrine_therapy];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.endocrine_therapy) return Array.isArray(dd.endocrine_therapy) ? dd.endocrine_therapy : [dd.endocrine_therapy]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  const DOC_TITLE = 'Endocrine Therapy';

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.documentTitle}>{DOC_TITLE}</Text></View>
          <Text style={styles.noDataText}>No endocrine therapy records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>{DOC_TITLE}</Text></View>
        {/* Flatten record children directly under <Page> — a per-record wrapper <View> is a
            keep-together unit react-pdf shoves WHOLE to the next page (page 1 = title only). break
            rides the record-title Text (a direct Page child). (memory 6a4deac1 / Rule #74) */}
        {records.flatMap((record, idx) => {
          const els = [<Text key={`rt-${idx}`} style={styles.recordTitle} break={idx > 0}>{`Endocrine Therapy ${idx + 1}`}</Text>];
          Object.keys(SECTION_FIELDS).forEach(sid => { const sec = renderSection(record, sid, idx); if (sec) els.push(...sec); });
          return els;
        })}
      </Page>
    </Document>
  );
};

export default EndocrineTherapyDocumentPDFTemplate;
