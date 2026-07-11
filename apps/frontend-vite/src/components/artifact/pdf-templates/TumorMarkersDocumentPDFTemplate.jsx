/**
 * TumorMarkersDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — tumor markers
 * Collection: tumor_markers
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#333333', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#1f2937', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#666666', borderBottomStyle: 'solid' },
  recordDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 11, color: '#6b7280', fontFamily: 'Helvetica' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1f2937' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 8 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 11, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#d1d5db', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 12, color: '#6b7280', textAlign: 'center', marginTop: 40 },
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

const hasVal = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number') return true;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
};

const fmtVal = (v) => {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  return String(v || '');
};

/* ======= SECTION CONFIG ======= */
const SECTION_TITLES = {
  'header-info': 'Header Information',
  'standard-markers': 'Standard Markers',
  'other-markers': 'Other Markers',
  'clinical-assessment': 'Clinical Assessment',
  'treatment-plan': 'Treatment Plan',
  'results-data': 'Results',
};

const FIELD_LABELS = {
  date: 'Date',
  type: 'Type',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  cea: 'CEA',
  ca199: 'CA 19-9',
  ca125: 'CA 125',
  afp: 'AFP',
  psa: 'PSA',
  ldh: 'LDH',
  alkalinePhosphatase: 'Alkaline Phosphatase',
  otherMarkers: 'Other Markers',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  recommendations: 'Recommendations',
  notes: 'Notes',
  results: 'Results',
};

const SECTION_FIELDS = {
  'header-info': ['date', 'type', 'provider', 'facility', 'status'],
  'standard-markers': ['cea', 'ca199', 'ca125', 'afp', 'psa', 'ldh', 'alkalinePhosphatase'],
  'other-markers': ['otherMarkers'],
  'clinical-assessment': ['findings', 'assessment'],
  'treatment-plan': ['plan', 'recommendations', 'notes'],
  'results-data': ['results'],
};

const DATE_FIELDS = ['date'];

/* ======= RENDER FIELD ======= */
const renderField = (record, fn) => {
  const val = record[fn];
  if (!hasVal(val)) return null;
  const label = FIELD_LABELS[fn] || fn;

  if (DATE_FIELDS.includes(fn)) {
    return (
      <View key={fn} style={styles.fieldBox}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValue}>{formatDate(val)}</Text>
      </View>
    );
  }

  if (fn === 'otherMarkers') {
    const items = Array.isArray(val) ? val.filter(m => {
      if (typeof m === 'object') return (m.name && m.name.trim()) || (m.value && m.value.trim());
      return m && String(m).trim();
    }) : [];
    if (items.length === 0) return null;
    return (
      <View key={fn} style={styles.fieldBox}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {items.map((item, i) => (
          <Text key={i} style={styles.listItem}>
            {typeof item === 'object' ? `${item.name || ''}: ${item.value || ''}` : safeString(item)}
          </Text>
        ))}
      </View>
    );
  }

  if (fn === 'recommendations') {
    const recs = Array.isArray(val) ? val.filter(r => {
      if (typeof r === 'object' && r !== null) return (r.recommendation && String(r.recommendation).trim()) || (r.date && String(r.date).trim());
      return r && String(r).trim();
    }) : [];
    if (recs.length === 0) return null;
    const groups = [];
    recs.forEach((rec) => {
      const d = (typeof rec === 'object' && rec !== null ? (rec.date || '') : '').toString().trim();
      const last = groups[groups.length - 1];
      if (last && last.date === d) last.items.push(rec);
      else groups.push({ date: d, items: [rec] });
    });
    return (
      <View key={fn} style={styles.fieldBox} wrap={recs.length > 8 ? undefined : false}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {groups.map((group, gi) => (
          <View key={gi} style={{ marginBottom: 4 }}>
            {group.date ? <Text style={styles.nestedSubtitle}>{group.date}</Text> : null}
            {group.items.map((rec, i) => (
              <Text key={i} style={styles.listItem}>
                {(typeof rec === 'object' && rec !== null ? (rec.recommendation || '') : safeString(rec)).trim()}
              </Text>
            ))}
          </View>
        ))}
      </View>
    );
  }

  if (fn === 'results') {
    if (typeof val === 'object' && !Array.isArray(val)) {
      const entries = Object.entries(val);
      if (entries.length === 0) return null;
      return (
        <View key={fn} style={styles.fieldBox}>
          <Text style={styles.fieldLabel}>{label}</Text>
          {entries.map(([k, v], i) => (
            <View key={i} style={{ marginBottom: 4 }}>
              <Text style={styles.nestedSubtitle}>{k.replace(/_/g, ' ').toUpperCase()}</Text>
              <Text style={styles.fieldValue}>{safeString(v)}</Text>
            </View>
          ))}
        </View>
      );
    }
    return (
      <View key={fn} style={styles.fieldBox}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValue}>{safeString(val)}</Text>
      </View>
    );
  }

  return (
    <View key={fn} style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{safeString(val)}</Text>
    </View>
  );
};

/* ======= RENDER SECTION ======= */
const renderSection = (record, sid) => {
  const title = SECTION_TITLES[sid];
  const fields = SECTION_FIELDS[sid] || [];
  const anyVal = fields.some(f => hasVal(record[f]));
  if (!anyVal) return null;

  return (
    <View key={sid} style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {fields.map(f => renderField(record, f))}
    </View>
  );
};

/* ======= MAIN COMPONENT ======= */
const TumorMarkersDocumentPDFTemplate = ({ document: docProp }) => {
  let records = [];
  if (Array.isArray(docProp)) {
    if (docProp.length > 0 && docProp[0].tumor_markers && Array.isArray(docProp[0].tumor_markers)) {
      records = docProp[0].tumor_markers;
    } else {
      records = docProp;
    }
  } else if (docProp && docProp.tumor_markers) {
    records = Array.isArray(docProp.tumor_markers) ? docProp.tumor_markers : [docProp.tumor_markers];
  } else if (docProp) {
    records = [docProp];
  }
  records = records.filter(r => r && typeof r === 'object');

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Tumor Markers</Text>
          </View>
          <Text style={styles.noDataText}>No tumor markers data available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Tumor Markers</Text>
        </View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} wrap={false}>
            <View style={styles.recordHeader}>
              {hasVal(record.date) && (
                <View style={styles.recordDateRow}>
                  <Text style={styles.recordDate}>{formatDate(record.date)}</Text>
                </View>
              )}
              <Text style={styles.recordTitle}>{record.provider || `Tumor Markers ${idx + 1}`}</Text>
            </View>
            {renderSection(record, 'header-info')}
            {renderSection(record, 'standard-markers')}
            {renderSection(record, 'other-markers')}
            {renderSection(record, 'clinical-assessment')}
            {renderSection(record, 'treatment-plan')}
            {renderSection(record, 'results-data')}
            {idx < records.length - 1 && <View style={styles.separator} />}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default TumorMarkersDocumentPDFTemplate;
