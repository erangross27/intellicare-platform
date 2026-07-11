/**
 * SurgicalTeamDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — surgical team
 * Collection: surgical_team
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#606060', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#1f2937', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#606060', borderBottomStyle: 'solid' },
  recordDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 11, color: '#6b7280', fontFamily: 'Helvetica' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1f2937' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#606060', marginBottom: 8 },
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

/* renderStringField: sentence-split rendering */
const renderStringFieldPDF = (label, value) => {
  if (!hasVal(value)) return null;
  const strVal = fmtVal(value);
  const sentences = splitBySentence(strVal);
  if (sentences.length <= 1) return renderFieldRow(label, value);

  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {sentences.map((sentence, sIdx) => {
        const parsed = parseLabel(sentence);
        if (parsed.isLabeled) {
          const commaItems = splitByComma(parsed.value);
          if (commaItems.length >= 2) {
            return (
              <View key={sIdx}>
                <Text style={styles.nestedSubtitle}>{parsed.label}:</Text>
                {commaItems.map((ci, ciIdx) => (
                  <Text key={ciIdx} style={styles.listItem}>{ciIdx + 1}. {ci}</Text>
                ))}
              </View>
            );
          }
          return (
            <View key={sIdx}>
              <Text style={styles.nestedSubtitle}>{parsed.label}:</Text>
              <Text style={styles.listItem}>{parsed.value}</Text>
            </View>
          );
        }
        return <Text key={sIdx} style={styles.listItem}>{sIdx + 1}. {sentence}</Text>;
      })}
    </View>
  );
};

/* renderArrayField: array items */
const renderArrayFieldPDF = (label, value) => {
  if (!hasVal(value) || !Array.isArray(value) || value.length === 0) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {value.filter(Boolean).map((item, i) => (
        <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
      ))}
    </View>
  );
};

/* humanizeKey: snake/camel → Title Case */
const humanizeKey = (key) => String(key)
  .replace(/[_-]+/g, ' ')
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/\s+/g, ' ')
  .trim()
  .replace(/\b\w/g, c => c.toUpperCase());

/* renderObjectLeaves: recursive dynamic-key object → label/value rows with typed leaves.
   depth controls left indentation so nested objects read hierarchically. */
const renderObjectLeaves = (obj, depth = 0, keyPrefix = '') => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];
  const rows = [];
  Object.entries(obj).forEach(([key, value]) => {
    if (!hasVal(value)) return;
    const label = humanizeKey(key);
    const rowKey = `${keyPrefix}${key}`;
    if (Array.isArray(value)) {
      rows.push(
        <Text key={rowKey} style={[styles.listItem, { paddingLeft: 8 + depth * 12 }]}>
          {label}: {value.filter(v => v !== null && v !== undefined && v !== '').map(v => (typeof v === 'object' ? safeString(v) : fmtVal(v))).join(', ')}
        </Text>
      );
    } else if (typeof value === 'object' && !value.$date) {
      rows.push(
        <Text key={`${rowKey}-h`} style={[styles.nestedSubtitle, { marginLeft: depth * 12 }]}>{label}:</Text>
      );
      rows.push(...renderObjectLeaves(value, depth + 1, `${rowKey}.`));
    } else {
      rows.push(
        <Text key={rowKey} style={[styles.listItem, { paddingLeft: 8 + depth * 12 }]}>
          {label}: {safeString(value)}
        </Text>
      );
    }
  });
  return rows;
};

/* renderResultsField: content-gated dynamic-key Results object */
const renderResultsFieldPDF = (label, value) => {
  if (!hasVal(value) || typeof value !== 'object' || Array.isArray(value)) return null;
  const rows = renderObjectLeaves(value);
  if (rows.length === 0) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {rows}
    </View>
  );
};

/* ======= TEMPLATE ======= */
const SurgicalTeamDocumentPDFTemplate = ({ document: records }) => {
  let recordsArray = [];
  if (Array.isArray(records)) {
    recordsArray = records;
  } else if (records?.surgical_team && Array.isArray(records.surgical_team)) {
    recordsArray = records.surgical_team;
  } else if (records?.documentData) {
    const docData = records.documentData;
    if (Array.isArray(docData)) {
      recordsArray = docData;
    } else if (docData?.surgical_team && Array.isArray(docData.surgical_team)) {
      recordsArray = docData.surgical_team;
    } else if (docData && typeof docData === 'object') {
      recordsArray = [docData];
    }
  } else if (records && typeof records === 'object' && !Array.isArray(records)) {
    recordsArray = [records];
  }

  if (recordsArray.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Surgical Team</Text>
          </View>
          <Text style={styles.noDataText}>No records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Surgical Team</Text>
        </View>

        {recordsArray.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader}>
              {record.date && (
                <View style={styles.recordDateRow}>
                  <Text style={styles.recordDate}>{formatDate(record.date)}</Text>
                </View>
              )}
              <Text style={styles.recordTitle}>Surgical Team {idx + 1}</Text>
            </View>

            {/* Procedure Information */}
            {(hasVal(record.type) || hasVal(record.status) || hasVal(record.provider) || hasVal(record.facility)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Procedure Information</Text>
                {renderStringFieldPDF('Procedure Type', record.type)}
                {renderStringFieldPDF('Status', record.status)}
                {renderStringFieldPDF('Provider', record.provider)}
                {renderStringFieldPDF('Facility', record.facility)}
              </View>
            )}

            {/* Team Members */}
            {(hasVal(record.primarySurgeon) || hasVal(record.anesthesiologist) || hasVal(record.scrubNurse) || hasVal(record.circulatingNurse)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Team Members</Text>
                {renderStringFieldPDF('Primary Surgeon', record.primarySurgeon)}
                {renderStringFieldPDF('Anesthesiologist', record.anesthesiologist)}
                {renderStringFieldPDF('Scrub Nurse', record.scrubNurse)}
                {renderStringFieldPDF('Circulating Nurse', record.circulatingNurse)}
              </View>
            )}

            {/* Team Lists */}
            {(hasVal(record.assistantSurgeons) || hasVal(record.residents) || hasVal(record.students)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Team Lists</Text>
                {renderArrayFieldPDF('Assistant Surgeons', record.assistantSurgeons)}
                {renderArrayFieldPDF('Residents', record.residents)}
                {renderArrayFieldPDF('Students', record.students)}
              </View>
            )}

            {/* Clinical Findings */}
            {hasVal(record.findings) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Clinical Findings</Text>
                {renderStringFieldPDF('Findings', record.findings)}
              </View>
            )}

            {/* Assessment & Plan */}
            {(hasVal(record.assessment) || hasVal(record.plan) || hasVal(record.recommendations)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Assessment & Plan</Text>
                {renderStringFieldPDF('Assessment', record.assessment)}
                {renderStringFieldPDF('Plan', record.plan)}
                {renderArrayFieldPDF('Recommendations', record.recommendations)}
              </View>
            )}

            {/* Notes */}
            {hasVal(record.notes) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Notes</Text>
                {renderStringFieldPDF('Notes', record.notes)}
              </View>
            )}

            {/* Results — dynamic-key object (recursive, content-gated) */}
            {hasVal(record.results) && renderObjectLeaves(record.results).length > 0 && (
              <View style={styles.section} wrap={renderObjectLeaves(record.results).length > 8 ? undefined : false}>
                <Text style={styles.sectionTitle}>Results</Text>
                {renderResultsFieldPDF('Results', record.results)}
              </View>
            )}

            {idx < recordsArray.length - 1 && <View style={styles.separator} />}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default SurgicalTeamDocumentPDFTemplate;
