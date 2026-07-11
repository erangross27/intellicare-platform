/**
 * WeeklyVirtualCheckInsDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — weekly virtual check-ins
 * Collection: weekly_virtual_check_ins
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 11, color: '#6b7280', fontFamily: 'Helvetica' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8 },
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

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

/* parseLabel: colon in char class for patterns like "Week 1 Baseline (February 12, 2026):" */
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#:'"-]{1,80}?):\s+([\s\S]*)/);
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
    else if (ch === ',' && depth === 0) {
      const after = text.slice(i + 1).trimStart();
      if (/^\d{4}\b/.test(after)) { current += ch; continue; }
      const t = current.trim(); if (t) result.push(t); current = '';
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* renderFieldRow: label + value inside fieldBox */
const renderFieldRow = (label, value) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* renderDateField */
const renderDateFieldPDF = (label, value) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{formatDate(value)}</Text>
    </View>
  );
};

/* renderBooleanField */
const renderBooleanFieldPDF = (label, value) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value ? 'Yes' : 'No'}</Text>
    </View>
  );
};

/* renderSentenceSection: parseLabel + comma-split */
const renderSentenceSection = (label, text) => {
  if (!hasVal(text)) return null;
  const sentences = splitBySentence(fmtVal(text));
  if (sentences.length === 0) return null;

  const rows = [];
  let n = 1;
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const commaItems = splitByComma(parsed.value);
      if (commaItems.length >= 2) {
        rows.push({ type: 'subtitle', text: safeString(parsed.label) });
        commaItems.forEach(ci => { rows.push({ type: 'item', text: safeString(ci), num: n++ }); });
      } else {
        rows.push({ type: 'item', text: safeString(s), num: n++ });
      }
    } else {
      rows.push({ type: 'item', text: safeString(s), num: n++ });
    }
  });

  const wrapProp = rows.length > 8 ? undefined : false;

  return (
    <View style={styles.fieldBox} wrap={wrapProp}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {rows.map((row, i) => {
        if (row.type === 'subtitle') {
          return <Text key={i} style={styles.nestedSubtitle}>{row.text}</Text>;
        }
        return <Text key={i} style={styles.listItem}>{row.num}. {row.text}</Text>;
      })}
    </View>
  );
};

/* renderRecommendations: array of objects [{recommendation, date}] */
const renderRecommendationsPDF = (recs) => {
  if (!Array.isArray(recs) || recs.length === 0) return null;
  const safeRecs = recs.filter(r => r?.recommendation);
  if (safeRecs.length === 0) return null;

  /* Group by date */
  const groups = {};
  safeRecs.forEach(r => { const d = r.date ? formatDate(r.date) : 'No Date'; if (!groups[d]) groups[d] = []; groups[d].push(r); });

  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>RECOMMENDATIONS</Text>
      {Object.entries(groups).map(([date, items], gIdx) => (
        <View key={gIdx}>
          <Text style={styles.nestedSubtitle}>{date}</Text>
          {items.map((rec, i) => (
            <Text key={i} style={styles.listItem}>{i + 1}. {safeString(rec.recommendation)}</Text>
          ))}
        </View>
      ))}
    </View>
  );
};

/* SECTION CONFIGS */
const SECTION_TITLES = {
  'record-info': 'Record Information',
  'purpose': 'Purpose',
  'findings-assessment': 'Findings & Assessment',
  'plan': 'Plan',
  'recommendations': 'Recommendations',
  'notes': 'Notes',
};

const SECTION_FIELDS = {
  'record-info': ['provider', 'facility', 'type', 'platform', 'frequency', 'status', 'scheduled'],
  'purpose': ['purpose'],
  'findings-assessment': ['findings', 'assessment'],
  'plan': ['plan'],
  'recommendations': ['recommendations'],
  'notes': ['notes'],
};

const STRING_FIELDS = ['frequency', 'purpose', 'platform', 'type', 'provider', 'facility', 'findings', 'assessment', 'plan', 'notes', 'status'];
const BOOLEAN_FIELDS = ['scheduled'];
const DATE_FIELDS_LIST = ['date'];

/* renderField: dispatch to correct renderer */
const renderField = (record, f, sectionTitle) => {
  if (!hasVal(record[f])) return null;
  const label = {
    provider: 'Provider', facility: 'Facility', type: 'Type', platform: 'Platform',
    frequency: 'Frequency', status: 'Status', scheduled: 'Scheduled',
    purpose: 'Purpose', findings: 'Findings', assessment: 'Assessment',
    plan: 'Plan', recommendations: 'Recommendations', notes: 'Notes',
  }[f] || f;
  const showLabel = label.toLowerCase() !== (sectionTitle || '').toLowerCase();

  if (f === 'recommendations') return renderRecommendationsPDF(record[f]);
  if (BOOLEAN_FIELDS.includes(f)) return renderBooleanFieldPDF(showLabel ? label : '', record[f]);
  if (DATE_FIELDS_LIST.includes(f)) return renderDateFieldPDF(showLabel ? label : '', record[f]);
  if (STRING_FIELDS.includes(f)) {
    const strVal = fmtVal(record[f]);
    const sentences = splitBySentence(strVal);
    if (sentences.length > 1) return renderSentenceSection(showLabel ? label : '', strVal);
    return renderFieldRow(showLabel ? label : '', strVal);
  }
  return renderFieldRow(showLabel ? label : '', record[f]);
};

/* renderSection with presentFields */
const renderSection = (record, sid) => {
  const title = SECTION_TITLES[sid];
  const fields = SECTION_FIELDS[sid] || [];
  const presentFields = fields.filter(f => hasVal(record[f]));
  if (presentFields.length === 0) return null;

  return (
    <View key={sid} style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {fields.map((f, fIdx) => {
        if (!hasVal(record[f])) return null;
        return <View key={fIdx}>{renderField(record, f, title)}</View>;
      })}
    </View>
  );
};

/* ======= COMPONENT ======= */
const WeeklyVirtualCheckInsDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.weekly_virtual_check_ins) return Array.isArray(r.weekly_virtual_check_ins) ? r.weekly_virtual_check_ins : [r.weekly_virtual_check_ins];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.weekly_virtual_check_ins) return Array.isArray(dd.weekly_virtual_check_ins) ? dd.weekly_virtual_check_ins : [dd.weekly_virtual_check_ins]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Weekly Virtual Check-Ins</Text>
          </View>
          <Text style={styles.noDataText}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Document Header */}
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Weekly Virtual Check-Ins</Text>
        </View>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer}>
            {index > 0 && <View style={styles.separator} />}

            {/* Record Header */}
            <View style={styles.recordHeader} wrap={false}>
              <View style={styles.recordDateRow}>
                {record.date && (
                  <Text style={styles.recordDate}>{formatDate(record.date)}</Text>
                )}
              </View>
              <Text style={styles.recordTitle}>
                {`Weekly Virtual Check-In ${index + 1}`}
              </Text>
            </View>

            {/* Sections */}
            {renderSection(record, 'record-info')}
            {renderSection(record, 'purpose')}
            {renderSection(record, 'findings-assessment')}
            {renderSection(record, 'plan')}
            {renderSection(record, 'recommendations')}
            {renderSection(record, 'notes')}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default WeeklyVirtualCheckInsDocumentPDFTemplate;
