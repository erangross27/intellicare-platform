/**
 * CaregiverAssessmentDocumentPDFTemplate.jsx
 * Helvetica 20/16/14/12pt. B&W ONLY (#000000 + grayscale; NO saturated colors).
 * FULL TEMPLATE STANDARD — 100% coverage of all 17 non-system fields.
 * Rule #74: each field is ONE wrap-gated <View> (rows<=8 -> wrap={false}; rows>8 -> wrap=undefined);
 *           sectionTitle goes INSIDE the first View (isFirst) — never a sibling.
 *   - OBJECT field `results` rendered recursively as humanized key/value lines.
 *   - recommendations (array of {recommendation, date}) date-grouped numbered list.
 *   - per-sentence numbering for narrative string fields.
 * Collection: caregiver_assessment
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 12, fontFamily: 'Helvetica', backgroundColor: '#ffffff', color: '#000000' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', marginBottom: 14, textAlign: 'center', borderBottomWidth: 2, borderBottomColor: '#000000', paddingBottom: 8, textTransform: 'uppercase', letterSpacing: 1, color: '#000000' },
  recordSection: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#cccccc' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 6, backgroundColor: '#f0f0f0', padding: 6, borderWidth: 1, borderColor: '#000000', color: '#000000' },
  recordMeta: { fontSize: 11, marginBottom: 2, color: '#333333', paddingLeft: 4 },
  fieldGroup: { marginBottom: 10, marginTop: 4 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', marginBottom: 6, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 4, color: '#000000' },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 4, marginTop: 6, paddingLeft: 4, paddingBottom: 3, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  subLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 2, marginTop: 4, paddingLeft: 8 },
  value: { fontSize: 12, lineHeight: 1.5, paddingLeft: 12, marginBottom: 3, color: '#000000' },
  recDate: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#333333', marginTop: 4, marginBottom: 2, paddingLeft: 8 },
  nested: { paddingLeft: 10, borderLeftWidth: 1, borderLeftColor: '#cccccc', marginLeft: 4 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
});

const KEY_OVERRIDES = {};
const humanizeKey = (key) => { if (key === null || key === undefined || key === '') return ''; if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key]; const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); return s.charAt(0).toUpperCase() + s.slice(1); };
const formatDate = (d) => { if (!d) return ''; try { const dt = new Date(d.$date || d); if (isNaN(dt.getTime())) return String(d); return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const isEmptyDeep = (v) => { if (v === null || v === undefined) return true; if (typeof v === 'boolean') return false; if (typeof v === 'number') return !Number.isFinite(v); if (typeof v === 'string') return v.trim() === ''; if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0; if (typeof v === 'object') return Object.values(v).every(isEmptyDeep); return false; };
const hasVal = (v) => !isEmptyDeep(v);
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const splitBySentence = (text) => { if (!text) return []; return String(text).split(/[;,.]\s+/).map(s => s.trim()).filter(s => s.length > 0 && s.replace(/[.!?;,]+/g, '').trim().length > 0); };

const FIELD_LABELS = {
  primaryCaregiver: 'Primary Caregiver', caregiverHealth: 'Caregiver Health', respiteNeeds: 'Respite Needs',
  caregiverBurden: 'Caregiver Burden', financialStrain: 'Financial Strain',
  supportServices: 'Support Services', educationProvided: 'Education Provided',
  findings: 'Findings', assessment: 'Assessment', plan: 'Plan',
  recommendations: 'Recommendations', results: 'Results', notes: 'Notes',
  provider: 'Provider', facility: 'Facility', status: 'Status', date: 'Date',
};
const SECTION_TITLES = {
  caregiver: 'Caregiver Information', burden: 'Burden & Strain', support: 'Support Services',
  education: 'Education Provided', clinical: 'Clinical', recommendationsSection: 'Recommendations',
  resultsSection: 'Results', notesSection: 'Notes', providerInfo: 'Provider Information',
};
const SECTION_FIELDS = {
  caregiver: ['primaryCaregiver', 'caregiverHealth', 'respiteNeeds'],
  burden: ['caregiverBurden', 'financialStrain'],
  support: ['supportServices'],
  education: ['educationProvided'],
  clinical: ['findings', 'assessment', 'plan'],
  recommendationsSection: ['recommendations'],
  resultsSection: ['results'],
  notesSection: ['notes'],
  providerInfo: ['provider', 'facility', 'status'],
};
const SECTION_ORDER = ['caregiver', 'burden', 'support', 'education', 'clinical', 'recommendationsSection', 'resultsSection', 'notesSection', 'providerInfo'];

const ARRAY_FIELDS = ['supportServices', 'educationProvided'];
const SENTENCE_FIELDS = ['caregiverBurden', 'caregiverHealth', 'financialStrain', 'findings', 'assessment', 'plan', 'notes'];
const OBJECT_FIELDS = ['results'];
const OBJECT_ARRAY_FIELDS = ['recommendations'];
const DATE_FIELDS = ['date'];

/* recursive object node: label = bold heading; value = plain line below */
const renderObjectNode = (label, value, keyPath, depth) => {
  if (isEmptyDeep(value)) return null;
  const LabelTag = depth > 0 ? styles.subLabel : styles.fieldLabel;
  if (isScalar(value)) {
    return (
      <View key={keyPath}>
        {label ? <Text style={LabelTag}>{label}</Text> : null}
        <Text style={styles.value}>1. {fmtScalar(value)}</Text>
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

const countRows = (val) => {
  if (isEmptyDeep(val)) return 0;
  if (isScalar(val)) return 1;
  if (Array.isArray(val)) { let n = 0; val.filter(x => !isEmptyDeep(x)).forEach(it => { n += isScalar(it) ? 1 : 1 + countRows(it); }); return n; }
  let n = 0; Object.values(val).forEach(sub => { if (!isEmptyDeep(sub)) n += isScalar(sub) ? 2 : 1 + countRows(sub); }); return n;
};

/* Rule #74: render a field as wrap-gated View(s). Returns an ARRAY of Views. */
const renderFieldViews = (record, field, sectionTitle, isFirst) => {
  const val = record[field];
  if (!hasVal(val)) return [];
  const label = FIELD_LABELS[field] || field;
  const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
  const titleNode = isFirst ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null;

  if (DATE_FIELDS.includes(field)) {
    return [(
      <View key={field} style={styles.fieldGroup} wrap={false}>
        {titleNode}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        <Text style={styles.value}>1. {formatDate(val)}</Text>
      </View>
    )];
  }

  if (ARRAY_FIELDS.includes(field)) {
    const items = Array.isArray(val) ? val.filter(Boolean) : [];
    if (items.length === 0) return [];
    return [(
      <View key={field} style={styles.fieldGroup} wrap={items.length > 8 ? undefined : false}>
        {titleNode}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {items.map((it, i) => <Text key={i} style={styles.value}>{i + 1}. {fmtVal(it)}</Text>)}
      </View>
    )];
  }

  if (OBJECT_ARRAY_FIELDS.includes(field)) {
    const recs = Array.isArray(val) ? val : [];
    if (recs.length === 0) return [];
    const groups = [];
    recs.forEach((r) => { const d = (r?.date || '').trim(); const last = groups[groups.length - 1]; if (last && last.date === d) last.items.push(r); else groups.push({ date: d, items: [r] }); });
    return [(
      <View key={field} style={styles.fieldGroup} wrap={recs.length > 8 ? undefined : false}>
        {titleNode}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {groups.map((group, gIdx) => (
          <View key={gIdx}>
            {group.date ? <Text style={styles.recDate}>{group.date}</Text> : null}
            {group.items.map((r, i) => (<Text key={i} style={styles.value}>{i + 1}. {(r?.recommendation || '').trim()}</Text>))}
          </View>
        ))}
      </View>
    )];
  }

  if (OBJECT_FIELDS.includes(field)) {
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return [];
    return entries.map(([k, v], i) => {
      const rows = countRows(v);
      return (
        <View key={`${field}-${k}`} style={styles.fieldGroup} wrap={rows > 8 ? undefined : false}>
          {i === 0 ? titleNode : null}
          {i === 0 && showLabel ? <Text style={styles.fieldLabel}>{label}</Text> : null}
          {renderObjectNode(humanizeKey(k), v, `${field}-${k}`, 1)}
        </View>
      );
    });
  }

  if (SENTENCE_FIELDS.includes(field)) {
    const strVal = fmtVal(val);
    const sentences = splitBySentence(strVal);
    if (sentences.length > 1) {
      return [(
        <View key={field} style={styles.fieldGroup} wrap={sentences.length > 8 ? undefined : false}>
          {titleNode}
          {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
          {sentences.map((s, sIdx) => (<Text key={sIdx} style={styles.value}>{sIdx + 1}. {s}</Text>))}
        </View>
      )];
    }
    return [(
      <View key={field} style={styles.fieldGroup} wrap={false}>
        {titleNode}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        <Text style={styles.value}>1. {strVal}</Text>
      </View>
    )];
  }

  /* simple scalar (primaryCaregiver, respiteNeeds, provider, facility, status) */
  return [(
    <View key={field} style={styles.fieldGroup} wrap={false}>
      {titleNode}
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      <Text style={styles.value}>1. {fmtVal(val)}</Text>
    </View>
  )];
};

const CaregiverAssessmentDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.caregiver_assessment) return Array.isArray(r.caregiver_assessment) ? r.caregiver_assessment : [r.caregiver_assessment];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.caregiver_assessment) return Array.isArray(dd.caregiver_assessment) ? dd.caregiver_assessment : [dd.caregiver_assessment]; return [dd]; }
      return r;
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) return <Document><Page size="A4" style={styles.page}><Text style={styles.documentTitle}>Caregiver Assessment</Text><Text style={styles.emptyState}>No records available</Text></Page></Document>;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Caregiver Assessment</Text>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordSection}>
            <View wrap={false}>
              <Text style={styles.recordTitle}>{`Caregiver Assessment ${idx + 1}`}</Text>
              {hasVal(record.date) && <Text style={styles.recordMeta}>{formatDate(record.date)}</Text>}
              {hasVal(record.provider) && <Text style={styles.recordMeta}>{fmtVal(record.provider)}</Text>}
              {hasVal(record.facility) && <Text style={styles.recordMeta}>{fmtVal(record.facility)}</Text>}
            </View>
            {SECTION_ORDER.flatMap(sid => {
              const fields = (SECTION_FIELDS[sid] || []).filter(f => hasVal(record[f]));
              if (fields.length === 0) return [];
              const title = SECTION_TITLES[sid];
              return fields.flatMap((f, fi) => renderFieldViews(record, f, title, fi === 0));
            })}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default CaregiverAssessmentDocumentPDFTemplate;
