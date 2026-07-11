/**
 * PregnancySymptomsDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — pregnancy symptoms
 * June 2026 — BLACK & WHITE / GRAYSCALE only (no saturated colors). OBJECT field `results`
 *   rendered recursively (renderObjectNode); recommendations (array of {recommendation, date})
 *   date-grouped numbered list; status string. Rule #74 per-field wrap-gating.
 * Collection: pregnancy_symptoms
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 11, color: '#444444', fontFamily: 'Helvetica' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 11, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  subLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 1 },
  nested: { marginLeft: 10, paddingLeft: 8, borderLeftWidth: 1, borderLeftColor: '#000000', marginTop: 2 },
  recDate: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 12, color: '#444444', textAlign: 'center', marginTop: 40 },
});

/* ======= UTILS ======= */
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr.$date || dateStr);
    if (isNaN(date.getTime())) return String(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(dateStr); }
};

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'object' && val.$date) return formatDate(val.$date);
  return String(val);
};

const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};
const hasVal = (v) => !isEmptyDeep(v);
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };

const KEY_OVERRIDES = {};
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/* recursive object node: label = bold heading; value = plain line below */
const renderObjectNode = (label, value, keyPath, depth) => {
  if (isEmptyDeep(value)) return null;
  const LabelTag = depth > 0 ? styles.subLabel : styles.nestedSubtitle;
  if (isScalar(value)) {
    return (
      <View key={keyPath}>
        {label ? <Text style={LabelTag}>{label}</Text> : null}
        <Text style={styles.fieldValue}>{fmtScalar(value)}</Text>
      </View>
    );
  }
  const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  return (
    <View key={keyPath}>
      {label ? <Text style={LabelTag}>{label}</Text> : null}
      <View style={label ? styles.nested : undefined}>{entries.map(([k, v]) => renderObjectNode(humanizeKey(k), v, `${keyPath}-${k}`, depth + 1))}</View>
    </View>
  );
};

/* count rows for the wrap heuristic */
const countRows = (val) => {
  if (isEmptyDeep(val)) return 0;
  if (isScalar(val)) return 1;
  if (Array.isArray(val)) { let n = 0; val.filter(x => !isEmptyDeep(x)).forEach(it => { n += isScalar(it) ? 1 : 1 + countRows(it); }); return n; }
  let n = 0; Object.values(val).forEach(sub => { if (!isEmptyDeep(sub)) n += isScalar(sub) ? 2 : 1 + countRows(sub); }); return n;
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* ======= FIELD RENDERING ======= */
const renderStringField = (label, val) => {
  if (!hasVal(val)) return null;
  const strVal = safeString(val);
  const sentences = splitBySentence(strVal);
  if (sentences.length > 1) {
    let num = 1;
    return (
      <View style={styles.fieldBox}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {sentences.map((sentence, sIdx) => {
          const parsed = parseLabel(sentence);
          if (parsed.isLabeled) {
            const items = splitByComma(parsed.value);
            if (items.length >= 2) {
              return (
                <View key={sIdx}>
                  <Text style={styles.nestedSubtitle}>{parsed.label}:</Text>
                  {items.map((item, iIdx) => (
                    <Text key={iIdx} style={styles.listItem}>{num++}. {item}</Text>
                  ))}
                </View>
              );
            }
            return (
              <View key={sIdx}>
                <Text style={styles.nestedSubtitle}>{parsed.label}:</Text>
                <Text style={styles.listItem}>{num++}. {parsed.value}</Text>
              </View>
            );
          }
          return <Text key={sIdx} style={styles.listItem}>{num++}. {sentence}</Text>;
        })}
      </View>
    );
  }
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{strVal}</Text>
    </View>
  );
};

/* ======= SECTIONS CONFIG ======= */
const SECTION_TITLES = {
  'symptom-info': 'Symptom Information',
  'gastrointestinal': 'Gastrointestinal Symptoms',
  'musculoskeletal': 'Musculoskeletal Symptoms',
  'circulatory-skin': 'Circulatory & Skin',
  'other-symptoms': 'Other Symptoms',
  'findings': 'Findings',
  'assessment': 'Assessment',
  'results-section': 'Results',
  'recommendations-section': 'Recommendations',
  'plan-notes': 'Plan & Notes',
  'notes-status': 'Status',
};

const SECTION_FIELDS = {
  'symptom-info': ['date', 'provider', 'facility'],
  'gastrointestinal': ['nausea', 'vomiting', 'heartburn', 'constipation', 'hemorrhoids'],
  'musculoskeletal': ['backPain', 'roundLigamentPain'],
  'circulatory-skin': ['edema', 'varicoseVeins', 'skinChanges'],
  'other-symptoms': ['sleepDisturbance', 'urinaryFrequency', 'vaginalDischarge'],
  'findings': ['findings'],
  'assessment': ['assessment'],
  'results-section': ['results'],
  'recommendations-section': ['recommendations'],
  'plan-notes': ['plan', 'notes'],
  'notes-status': ['status'],
};

const FIELD_LABELS = {
  date: 'Date',
  provider: 'Provider',
  facility: 'Facility',
  nausea: 'Nausea',
  vomiting: 'Vomiting',
  heartburn: 'Heartburn',
  constipation: 'Constipation',
  hemorrhoids: 'Hemorrhoids',
  backPain: 'Back Pain',
  roundLigamentPain: 'Round Ligament Pain',
  edema: 'Edema',
  varicoseVeins: 'Varicose Veins',
  skinChanges: 'Skin Changes',
  sleepDisturbance: 'Sleep Disturbance',
  urinaryFrequency: 'Urinary Frequency',
  vaginalDischarge: 'Vaginal Discharge',
  findings: 'Findings',
  assessment: 'Assessment',
  results: 'Results',
  recommendations: 'Recommendations',
  plan: 'Plan',
  notes: 'Notes',
  status: 'Status',
};

const DATE_FIELDS = ['date'];
const ARRAY_FIELDS = ['skinChanges'];
const OBJECT_FIELDS = ['results'];
const OBJECT_ARRAY_FIELDS = ['recommendations'];

/* ======= FIELD RENDERER (Rule #74: each field = ONE wrap-gated View; sectionTitle inside first present field) ======= */
const renderField = (record, f, sectionTitle, isFirst) => {
  const val = record[f];
  if (!hasVal(val)) return [];
  const label = FIELD_LABELS[f] || f;
  const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
  const titleNode = isFirst ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null;

  if (DATE_FIELDS.includes(f)) {
    return [(
      <View key={f} style={styles.fieldBox} wrap={false}>
        {titleNode}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        <Text style={styles.fieldValue}>{formatDate(val)}</Text>
      </View>
    )];
  }

  if (ARRAY_FIELDS.includes(f)) {
    const items = Array.isArray(val) ? val.filter(Boolean) : [val];
    if (items.length === 0) return [];
    return [(
      <View key={f} style={styles.fieldBox} wrap={items.length > 8 ? undefined : false}>
        {titleNode}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {items.map((item, i) => (
          <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
        ))}
      </View>
    )];
  }

  if (OBJECT_ARRAY_FIELDS.includes(f)) {
    const recs = Array.isArray(val) ? val : [];
    if (recs.length === 0) return [];
    const groups = [];
    recs.forEach((r) => { const d = (r?.date || '').trim(); const last = groups[groups.length - 1]; if (last && last.date === d) last.items.push(r); else groups.push({ date: d, items: [r] }); });
    return [(
      <View key={f} style={styles.fieldBox} wrap={recs.length > 8 ? undefined : false}>
        {titleNode}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {groups.map((group, gIdx) => (
          <View key={gIdx}>
            {group.date ? <Text style={styles.recDate}>{group.date}</Text> : null}
            {group.items.map((r, i) => (<Text key={i} style={styles.listItem}>{i + 1}. {(r?.recommendation || '').trim()}</Text>))}
          </View>
        ))}
      </View>
    )];
  }

  if (OBJECT_FIELDS.includes(f)) {
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return [];
    return entries.map(([k, v], i) => {
      const rows = countRows(v);
      return (
        <View key={`${f}-${k}`} style={styles.fieldBox} wrap={rows > 8 ? undefined : false}>
          {i === 0 ? titleNode : null}
          {i === 0 && showLabel ? <Text style={styles.fieldLabel}>{label}</Text> : null}
          {renderObjectNode(humanizeKey(k), v, `${f}-${k}`, 1)}
        </View>
      );
    });
  }

  /* string — split into sentences */
  const strVal = safeString(val);
  const sentences = splitBySentence(strVal);
  return [(
    <View key={f} style={styles.fieldBox} wrap={sentences.length > 8 ? undefined : false}>
      {titleNode}
      {renderStringField(label, val)}
    </View>
  )];
};

/* ======= SECTION RENDERER ======= */
const renderSection = (record, sid) => {
  const fields = SECTION_FIELDS[sid] || [];
  const presentFields = fields.filter(f => hasVal(record[f]));
  if (presentFields.length === 0) return null;
  const sectionTitle = SECTION_TITLES[sid];

  const views = [];
  presentFields.forEach((f, i) => { views.push(...renderField(record, f, sectionTitle, i === 0)); });

  return <View style={styles.section}>{views}</View>;
};

/* ======= MAIN COMPONENT ======= */
const PregnancySymptomsDocumentPDFTemplate = ({ document: doc }) => {
  let records = [];
  if (Array.isArray(doc)) {
    records = doc;
  } else if (doc?.pregnancy_symptoms) {
    records = Array.isArray(doc.pregnancy_symptoms) ? doc.pregnancy_symptoms : [doc.pregnancy_symptoms];
  } else if (doc?.documentData?.pregnancy_symptoms) {
    records = Array.isArray(doc.documentData.pregnancy_symptoms) ? doc.documentData.pregnancy_symptoms : [doc.documentData.pregnancy_symptoms];
  } else if (doc?.documentData) {
    records = Array.isArray(doc.documentData) ? doc.documentData : [doc.documentData];
  } else if (doc && typeof doc === 'object') {
    records = [doc];
  }
  records = records.filter(r => r && typeof r === 'object' && Object.keys(r).length > 0);

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Pregnancy Symptoms</Text>
          </View>
          <Text style={styles.noDataText}>No pregnancy symptoms records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Pregnancy Symptoms</Text>
        </View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader}>
              {hasVal(record.date) && (
                <View style={styles.recordDateRow}>
                  <Text style={styles.recordDate}>{formatDate(record.date)}</Text>
                </View>
              )}
              <Text style={styles.recordTitle}>Pregnancy Symptoms {idx + 1}</Text>
            </View>
            {renderSection(record, 'symptom-info')}
            {renderSection(record, 'gastrointestinal')}
            {renderSection(record, 'musculoskeletal')}
            {renderSection(record, 'circulatory-skin')}
            {renderSection(record, 'other-symptoms')}
            {renderSection(record, 'findings')}
            {renderSection(record, 'assessment')}
            {renderSection(record, 'results-section')}
            {renderSection(record, 'recommendations-section')}
            {renderSection(record, 'plan-notes')}
            {renderSection(record, 'notes-status')}
            {idx < records.length - 1 && <View style={styles.separator} />}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PregnancySymptomsDocumentPDFTemplate;
