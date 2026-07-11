/**
 * PatientSpecificCarePlanDocumentPDFTemplate.jsx
 * July 2026 - Helvetica - LETTER size - black & white only (#000000)
 * Collection: patient_specific_care_plan
 *
 * Box-free B&W LETTER rewrite mirroring JSX SECTION_FIELDS/FIELD_LABELS.
 * Rule #74: each field is ONE wrap={false} atomic View; sectionTitle rides
 * INSIDE the first field's View. borderBottom underline rules on documentTitle
 * (2pt), sectionTitle (1pt), fieldLabel (0.5pt #999).
 * safeString uses ONLY \uXXXX escapes (zero literal non-ASCII bytes).
 *
 * FIELDS (15 - 100% coverage):
 *   ARRAY-of-OBJECTS: tailoredInterventions, lifestyleModifications
 *   OBJECT (recursive): comorbidityManagement, results
 *   DATE:   date
 *   STRING: type, provider, facility, findings, assessment, plan, notes, status, longTerm
 *   ARRAY:  recommendations ({recommendation,date} or strings)
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', marginBottom: 4, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000' },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000' },
  recordMeta: { fontSize: 10, color: '#333333', marginTop: 2 },
  section: { marginBottom: 16 },
  fieldGroup: { marginBottom: 10 },
  sectionTitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000', textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginTop: 4, marginBottom: 2, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  subLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 2 },
  fieldValue: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  listItem: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  subcard: { marginBottom: 10, paddingLeft: 10, borderLeftWidth: 1, borderLeftColor: '#000000', borderLeftStyle: 'solid' },
  subcardTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 4 },
  nestedBox: { paddingLeft: 8, marginBottom: 4 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#cccccc', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 12, color: '#333333', textAlign: 'center', marginTop: 40 },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, borderTopWidth: 0.5, borderTopColor: '#999999', paddingTop: 8 },
  footerText: { fontSize: 10, color: '#666666' },
});

/* ======= FIELD CONFIG (mirror JSX) ======= */
const SECTION_TITLES = {
  'encounter': 'Encounter',
  'tailored-interventions': 'Tailored Interventions',
  'lifestyle-mods': 'Lifestyle Modifications',
  'comorbidity-mgmt': 'Comorbidity Management',
  'clinical': 'Clinical Assessment',
  'results-section': 'Results',
  'recommendations-section': 'Recommendations',
  'notes-status': 'Notes & Status',
};

const FIELD_LABELS = {
  date: 'Date', type: 'Type', provider: 'Provider', facility: 'Facility',
  findings: 'Findings', assessment: 'Assessment', plan: 'Plan', longTerm: 'Long-Term Plan',
  notes: 'Notes', status: 'Status', results: 'Results', recommendations: 'Recommendations',
  comorbidityManagement: 'Comorbidity Management', tailoredInterventions: 'Tailored Interventions',
  lifestyleModifications: 'Lifestyle Modifications',
};

const SECTION_FIELDS = {
  'encounter': ['date', 'type', 'provider', 'facility'],
  'tailored-interventions': ['tailoredInterventions'],
  'lifestyle-mods': ['lifestyleModifications'],
  'comorbidity-mgmt': ['comorbidityManagement'],
  'clinical': ['findings', 'assessment', 'plan', 'longTerm'],
  'results-section': ['results'],
  'recommendations-section': ['recommendations'],
  'notes-status': ['notes', 'status'],
};

const SECTION_ORDER = ['encounter', 'tailored-interventions', 'lifestyle-mods', 'comorbidity-mgmt', 'clinical', 'results-section', 'recommendations-section', 'notes-status'];

const DATE_FIELDS = ['date'];
const SENTENCE_FIELDS = ['findings', 'assessment', 'plan', 'longTerm', 'notes'];
const OBJECT_FIELDS = ['comorbidityManagement', 'results'];
const OBJECT_ARRAY_FIELDS = ['recommendations'];
const CUSTOM_ARRAY_FIELDS = ['tailoredInterventions', 'lifestyleModifications'];

const KEY_OVERRIDES = { bp: 'BP', hr: 'HR', ldl: 'LDL', hdl: 'HDL', hba1c: 'HbA1c', egfr: 'eGFR', bmi: 'BMI', gdmt: 'GDMT' };
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];
  const s = String(key);
  if (/\s/.test(s)) return s.charAt(0).toUpperCase() + s.slice(1);
  const r = s.replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return r.charAt(0).toUpperCase() + r.slice(1);
};

/* ======= UTILS ======= */
const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};
const isScalar = (v) => v === null || typeof v !== 'object';
const hasVal = (v) => !isEmptyDeep(v);
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };

/* safeString: normalize common non-ASCII glyphs to ASCII. Regex uses ONLY \uXXXX escapes -
   never paste a literal smart-quote / em-dash / BOM into this source. */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'number' ? String(val) : typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val);
  return str
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[\u00B5\u03BC]m/g, 'um')
    .replace(/[\u00B5\u03BC]g/g, 'mcg')
    .replace(/[\u00B5\u03BC]/g, 'u')
    .replace(/\u00B0/g, ' deg')
    .replace(/\u00B1/g, '+/-')
    .replace(/\u2265/g, '>=')
    .replace(/\u2264/g, '<=')
    .replace(/\u2192/g, '->')
    .replace(/[\u00D7\u2715\u2716]/g, 'x')
    .replace(/\u00F7/g, '/')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u2028\u2029\uFEFF]/g, '');
};

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); if (isNaN(d.getTime())) return String(dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

const isEpochSentinel = (dateValue) => {
  if (!dateValue) return false;
  try { const d = new Date(dateValue.$date || dateValue); return d.getTime() === 0 || (d.getFullYear() === 1970 && d.getMonth() === 0 && d.getDate() === 1); } catch { return false; }
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|[A-Z]))[.;](?:\s+)/).map(s => s.trim().replace(/^\d+\.\s+/, '')).filter(s => s && !/^[;.,!?]+$/.test(s));
};

/* ======= RENDER: recursive object tree (stacked sub-label + value) ======= */
const renderObjectTree = (label, value, depth, keyPrefix) => {
  if (isEmptyDeep(value)) return null;
  if (isScalar(value)) {
    return (
      <View key={keyPrefix} style={{ marginBottom: 4, paddingLeft: depth * 8 }}>
        <Text style={styles.subLabel}>{safeString(label)}</Text>
        <Text style={styles.fieldValue}>{safeString(fmtScalar(value))}</Text>
      </View>
    );
  }
  if (Array.isArray(value)) {
    const items = value.map((v, i) => [i, v]).filter(([, v]) => !isEmptyDeep(v));
    if (items.length === 0) return null;
    return (
      <View key={keyPrefix} style={{ paddingLeft: depth * 8 }}>
        {label ? <Text style={styles.subLabel}>{safeString(label)}</Text> : null}
        {items.map(([i, v]) => (
          isScalar(v)
            ? <Text key={i} style={styles.listItem}>{i + 1}. {safeString(fmtScalar(v))}</Text>
            : <View key={i} style={styles.nestedBox}>{renderObjectTree(`Item ${i + 1}`, v, depth + 1, `${keyPrefix}.${i}`)}</View>
        ))}
      </View>
    );
  }
  const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  return (
    <View key={keyPrefix} style={{ paddingLeft: depth * 8 }}>
      {label ? <Text style={styles.subLabel}>{safeString(label)}</Text> : null}
      {entries.map(([k, v]) => (
        isScalar(v)
          ? <View key={k} style={{ marginBottom: 4 }}><Text style={styles.subLabel}>{safeString(humanizeKey(k))}</Text><Text style={styles.fieldValue}>{safeString(fmtScalar(v))}</Text></View>
          : <View key={k} style={styles.nestedBox}>{renderObjectTree(humanizeKey(k), v, depth + 1, `${keyPrefix}.${k}`)}</View>
      ))}
    </View>
  );
};

/* ======= RENDER: one field - returns ONE wrap={false} atomic View ======= */
const renderField = (record, fn, sectionTitle, isFirst) => {
  const val = record[fn];
  if (!hasVal(val)) return null;
  if (DATE_FIELDS.includes(fn) && isEpochSentinel(val)) return null;
  const label = FIELD_LABELS[fn] || fn;
  const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
  const titleNode = isFirst ? <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text> : null;

  let body;
  if (DATE_FIELDS.includes(fn)) {
    body = <Text style={styles.fieldValue}>{safeString(formatDate(val))}</Text>;
  } else if (CUSTOM_ARRAY_FIELDS.includes(fn)) {
    const arr = Array.isArray(val) ? val : [];
    const items = arr.filter(it => !isEmptyDeep(it));
    if (items.length === 0) return null;
    body = items.map((item, i) => {
      const title = item.intervention || item.condition || item.domain || `Item ${i + 1}`;
      const rest = Object.entries(item).filter(([k, v]) => !isEmptyDeep(v) && k !== 'intervention' && k !== 'condition' && k !== 'domain');
      return (
        <View key={i} style={styles.subcard}>
          <Text style={styles.subcardTitle}>{i + 1}. {safeString(title)}</Text>
          {rest.map(([k, v]) => renderObjectTree(humanizeKey(k), v, 0, `${fn}.${i}.${k}`))}
        </View>
      );
    });
  } else if (OBJECT_FIELDS.includes(fn)) {
    if (isScalar(val)) return null;
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    body = entries.map(([k, v]) => renderObjectTree(humanizeKey(k), v, 0, `${fn}.${k}`));
  } else if (OBJECT_ARRAY_FIELDS.includes(fn)) {
    const recs = Array.isArray(val) ? val : [];
    const items = recs.filter(r => !isEmptyDeep(r));
    if (items.length === 0) return null;
    body = items.map((r, i) => {
      const recText = (typeof r === 'string' ? r : (r?.recommendation || '')).trim();
      const recDate = (typeof r === 'string' ? '' : (r?.date || '')).trim();
      return <Text key={i} style={styles.listItem}>{i + 1}. {safeString(recText)}{recDate ? ` (${safeString(recDate)})` : ''}</Text>;
    });
  } else {
    const strVal = safeString(val);
    const sentences = splitBySentence(strVal);
    if (SENTENCE_FIELDS.includes(fn) && sentences.length > 1) {
      body = sentences.map((s, i) => <Text key={i} style={styles.listItem}>{i + 1}. {safeString(s.replace(/[;.]+$/, '').trim())}</Text>);
    } else {
      body = <Text style={styles.fieldValue}>{safeString(strVal)}</Text>;
    }
  }

  return (
    <View key={fn} style={styles.fieldGroup} wrap={false}>
      {titleNode}
      {showLabel && <Text style={styles.fieldLabel}>{safeString(label)}</Text>}
      {body}
    </View>
  );
};

/* ======= RENDER SECTION - flatMap fields, sectionTitle rides in first field ======= */
const renderSection = (record, sid) => {
  const fields = SECTION_FIELDS[sid] || [];
  const presentFields = fields.filter(f => hasVal(record[f]) && !(DATE_FIELDS.includes(f) && isEpochSentinel(record[f])));
  if (presentFields.length === 0) return null;
  const title = SECTION_TITLES[sid];
  const views = presentFields.map((f, fi) => renderField(record, f, title, fi === 0)).filter(Boolean);
  if (views.length === 0) return null;
  return (
    <View key={sid} style={styles.section}>
      {views}
    </View>
  );
};

/* ======= MAIN COMPONENT ======= */
const PatientSpecificCarePlanDocumentPDFTemplate = ({ document: docProp, data }) => {
  const templateData = docProp || data;
  let records = [];
  if (Array.isArray(templateData)) {
    if (templateData.length > 0 && templateData[0].patient_specific_care_plan && Array.isArray(templateData[0].patient_specific_care_plan)) {
      records = templateData[0].patient_specific_care_plan;
    } else {
      records = templateData;
    }
  } else if (templateData && templateData.patient_specific_care_plan) {
    records = Array.isArray(templateData.patient_specific_care_plan) ? templateData.patient_specific_care_plan : [templateData.patient_specific_care_plan];
  } else if (templateData && templateData.documentData) {
    const dd = templateData.documentData;
    records = Array.isArray(dd) ? dd : (dd.patient_specific_care_plan ? (Array.isArray(dd.patient_specific_care_plan) ? dd.patient_specific_care_plan : [dd.patient_specific_care_plan]) : [dd]);
  } else if (templateData) {
    records = [templateData];
  }
  records = records.filter(r => r && typeof r === 'object');

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Patient-Specific Care Plan</Text>
          </View>
          <Text style={styles.noDataText}>No patient-specific care plan data available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Patient-Specific Care Plan</Text>
        </View>
        {records.map((record, idx) => {
          const meta = [formatDate(record.date), safeString(record.provider), safeString(record.facility)].filter(Boolean).join('  |  ');
          return (
            <View key={idx} style={styles.recordContainer} break={idx > 0}>
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>{`Patient-Specific Care Plan ${idx + 1}`}</Text>
                {meta ? <Text style={styles.recordMeta}>{safeString(meta)}</Text> : null}
              </View>
              {SECTION_ORDER.map(sid => renderSection(record, sid))}
              {idx < records.length - 1 && <View style={styles.separator} />}
            </View>
          );
        })}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Protected Health Information (PHI) - Handle according to HIPAA guidelines</Text>
        </View>
      </Page>
    </Document>
  );
};

export default PatientSpecificCarePlanDocumentPDFTemplate;