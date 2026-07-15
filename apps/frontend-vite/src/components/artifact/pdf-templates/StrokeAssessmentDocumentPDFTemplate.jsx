/**
 * StrokeAssessmentDocumentPDFTemplate.jsx
 * July 2026 — canonical 26/19/16/13/14 typography
 * Collection: stroke_assessment
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 34, paddingBottom: 42, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.4, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 18 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 14, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#cccccc', borderBottomStyle: 'solid' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 4 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 3, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldBox: { marginBottom: 3 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', paddingBottom: 1, marginBottom: 1, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  fieldValue: { fontSize: 14, lineHeight: 1.35, color: '#000000' },
  listItem: { fontSize: 14, lineHeight: 1.35, color: '#000000', marginBottom: 1, paddingLeft: 8 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#cccccc', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 14, color: '#000000', marginTop: 40 },
});

const FIELD_LABELS = {
  date: 'Date', strokeType: 'Stroke Type', territory: 'Territory', mechanism: 'Mechanism', nihssScore: 'NIHSS Score', mrsScore: 'MRS Score',
  'thrombolysis.received': 'Received', 'thrombolysis.agent': 'Agent', 'thrombolysis.timing': 'Timing', 'thrombolysis.response': 'Response',
  deficits: 'Deficits', 'secondaryPrevention.anticoagulation': 'Anticoagulation', 'secondaryPrevention.statins': 'Statins',
  'secondaryPrevention.bloodPressureControl': 'Blood Pressure Control', provider: 'Provider', facility: 'Facility', findings: 'Findings',
  assessment: 'Assessment', plan: 'Plan', recommendations: 'Recommendations', notes: 'Notes', results: 'Results', thrombectomy: 'Thrombectomy',
};

const SECTIONS = [
  { title: 'Assessment Date', fields: [{ key: 'date', type: 'date' }] },
  { title: 'Stroke Classification', fields: [{ key: 'strokeType' }, { key: 'territory', type: 'comma' }, { key: 'mechanism' }, { key: 'nihssScore', type: 'composite' }, { key: 'mrsScore', type: 'number' }] },
  { title: 'Thrombolysis', fields: [{ key: 'thrombolysis.received', type: 'boolean' }, { key: 'thrombolysis.agent' }, { key: 'thrombolysis.timing' }, { key: 'thrombolysis.response' }] },
  { title: 'Thrombectomy', fields: [{ key: 'thrombectomy', type: 'object' }] },
  { title: 'Deficits', fields: [{ key: 'deficits', type: 'array', hideLabel: true }] },
  { title: 'Secondary Prevention', fields: [{ key: 'secondaryPrevention.anticoagulation' }, { key: 'secondaryPrevention.statins' }, { key: 'secondaryPrevention.bloodPressureControl' }] },
  { title: 'Clinical Details', fields: [{ key: 'provider' }, { key: 'facility' }, { key: 'findings' }, { key: 'assessment' }, { key: 'plan' }] },
  { title: 'Results', fields: [{ key: 'results', type: 'object' }] },
  { title: 'Recommendations & Notes', fields: [{ key: 'recommendations', type: 'array' }, { key: 'notes' }] },
];

const getAtPath = (source, path) => String(path).split('.').reduce((value, key) => value?.[key], source);
const humanize = value => String(value || '').replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/\b\w/g, character => character.toUpperCase()).trim();
const hasVal = value => value !== null && value !== undefined && value !== '' && (typeof value !== 'string' || value.trim() !== '') && (!Array.isArray(value) || value.some(item => hasVal(item))) && (typeof value !== 'object' || Array.isArray(value) || value.$date || Object.values(value).some(item => hasVal(item)));
const formatDate = value => { try { const date = new Date(value?.$date || value); return Number.isNaN(date.getTime()) ? String(value || '') : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(value || ''); } };
const splitBySentence = value => String(value || '').split(/(?:;\s+|(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)\.\s+)/).map(item => item.trim()).filter(Boolean);
const splitByComma = value => {
  const source = String(value || ''); const rows = []; let current = ''; let depth = 0;
  for (const character of source) {
    if (character === '(') { depth += 1; current += character; }
    else if (character === ')') { depth = Math.max(0, depth - 1); current += character; }
    else if (character === ',' && depth === 0) { if (current.trim()) rows.push(current.trim()); current = ''; }
    else current += character;
  }
  if (current.trim()) rows.push(current.trim()); return rows.length ? rows : [source];
};
const splitCompositeScore = value => String(value || '').split(/;\s*/).map(item => item.trim()).filter(Boolean);

const flattenObject = (value, prefix = '') => {
  const entries = [];
  Object.entries(value || {}).forEach(([key, child]) => {
    if (key === '_id' || !hasVal(child)) return;
    const label = prefix ? `${prefix} — ${humanize(key)}` : humanize(key);
    if (Array.isArray(child)) entries.push({ label, rows: child.filter(hasVal).map(item => typeof item === 'boolean' ? (item ? 'Yes' : 'No') : String(item)) });
    else if (child && typeof child === 'object' && !child.$date) entries.push(...flattenObject(child, label));
    else entries.push({ label, rows: [typeof child === 'boolean' ? (child ? 'Yes' : 'No') : child?.$date ? formatDate(child) : String(child)] });
  });
  return entries;
};

const fieldEntries = (record, field) => {
  const value = getAtPath(record, field.key); if (!hasVal(value)) return [];
  const label = FIELD_LABELS[field.key] || humanize(field.key.split('.').pop());
  if (field.type === 'object') return flattenObject(value);
  if (field.type === 'date') return [{ label, rows: [formatDate(value)], hideLabel: field.hideLabel }];
  if (field.type === 'boolean') return [{ label, rows: [value ? 'Yes' : 'No'], hideLabel: field.hideLabel }];
  if (field.type === 'array') return [{ label, rows: value.filter(hasVal).map(String), hideLabel: field.hideLabel }];
  if (field.type === 'composite') return [{ label, rows: splitCompositeScore(value), hideLabel: field.hideLabel }];
  if (field.type === 'comma') return [{ label, rows: splitBySentence(value).flatMap(splitByComma), hideLabel: field.hideLabel }];
  return [{ label, rows: splitBySentence(value), hideLabel: field.hideLabel }];
};

const StrokeAssessmentDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let array = Array.isArray(data) ? data : [data];
    array = array.flatMap(record => {
      if (record?.stroke_assessment) return Array.isArray(record.stroke_assessment) ? record.stroke_assessment : [record.stroke_assessment];
      if (record?.documentData) {
        const nested = record.documentData;
        if (Array.isArray(nested)) return nested;
        if (nested?.stroke_assessment) return Array.isArray(nested.stroke_assessment) ? nested.stroke_assessment : [nested.stroke_assessment];
        return [nested];
      }
      return [record];
    });
    return array.filter(record => record && typeof record === 'object');
  }, [data]);

  if (records.length === 0) return <Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.documentTitle}>Stroke Assessment</Text></View><Text style={styles.noDataText}>No data available</Text></Page></Document>;

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Stroke Assessment</Text></View>
        {records.map((record, recordIndex) => (
          <View key={recordIndex} style={styles.recordContainer}>
            {recordIndex > 0 && <View style={styles.separator} />}
            <View style={styles.recordHeader} wrap={false}><Text style={styles.recordTitle}>{`Stroke Assessment ${recordIndex + 1}`}</Text></View>
            {SECTIONS.map((section, sectionIndex) => {
              const entries = section.fields.flatMap(field => fieldEntries(record, field));
              if (entries.length === 0) return null;
              return (
                <View key={sectionIndex} style={styles.section}>
                  {entries.map((entry, entryIndex) => (
                    <View key={`${entry.label}-${entryIndex}`} style={styles.fieldBox} wrap={false}>
                      {entryIndex === 0 && <Text style={styles.sectionTitle}>{section.title}</Text>}
                      {!entry.hideLabel && <Text style={styles.fieldLabel}>{entry.label}</Text>}
                      {entry.rows.map((row, rowIndex) => <Text key={rowIndex} style={entry.rows.length > 1 ? styles.listItem : styles.fieldValue}>{`${rowIndex + 1}. ${row}`}</Text>)}
                    </View>
                  ))}
                </View>
              );
            })}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default StrokeAssessmentDocumentPDFTemplate;
