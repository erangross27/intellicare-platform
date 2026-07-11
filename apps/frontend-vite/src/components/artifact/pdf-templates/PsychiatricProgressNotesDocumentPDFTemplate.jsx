/**
 * PsychiatricProgressNotesDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — A4 — parseLabel + comma-split — fieldBox pattern
 * Collection: psychiatric_progress_notes
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// ========== STYLES ==========

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 12,
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  documentHeader: {
    marginBottom: 24,
    borderBottomWidth: 3,
    borderBottomColor: '#000000',
    paddingBottom: 14,
  },
  documentTitle: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  documentSubtitle: {
    fontSize: 10,
    color: '#555555',
    textAlign: 'center',
    marginTop: 4,
    fontFamily: 'Helvetica',
  },
  recordContainer: {
    marginBottom: 28,
    paddingBottom: 16,
  },
  recordHeader: {
    marginBottom: 16,
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderWidth: 2,
    borderColor: '#000000',
    borderLeftWidth: 5,
    borderLeftColor: '#000000',
  },
  recordTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  recordMeta: {
    fontSize: 10,
    marginTop: 6,
    color: '#333333',
    fontFamily: 'Helvetica',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  fieldBox: {
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: 11,
    color: '#000000',
    lineHeight: 1.5,
  },
  listItem: {
    fontSize: 11,
    lineHeight: 1.5,
    color: '#000000',
    marginBottom: 2,
    paddingLeft: 8,
  },
  nestedSubtitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginTop: 6,
    marginBottom: 3,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#999999',
    fontFamily: 'Helvetica',
  },
});

// ========== UTILITY FUNCTIONS ==========

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/\u00b5m/g, 'um').replace(/\u03bcm/g, 'um').replace(/\u00b0/g, ' deg')
    .replace(/\u00b1/g, '+/-').replace(/\u2265/g, '>=').replace(/\u2264/g, '<=')
    .replace(/\u2192/g, '->').replace(/\u201c/g, '"').replace(/\u201d/g, '"')
    .replace(/\u2018/g, "'").replace(/\u2019/g, "'").replace(/\u2014/g, '-').replace(/\u2013/g, '-');
  return str;
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

const formatDate = (dateVal) => {
  if (!dateVal) return '';
  try {
    const d = new Date(dateVal.$date || dateVal);
    if (isNaN(d.getTime())) return safeString(dateVal);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return safeString(dateVal);
  }
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
    if (ch === '(' || ch === '"' || ch === "'") { depth++; current += ch; }
    else if (ch === ')' || (depth > 0 && (ch === '"' || ch === "'"))) { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

// ========== RENDER HELPERS ==========

/* renderFieldRow: label + value inside fieldBox */
const renderFieldRow = (label, value) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox} wrap={false}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* renderDateField: date in a fieldBox */
const renderDateField = (value, label) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox} wrap={false}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{formatDate(value)}</Text>
    </View>
  );
};

/* renderSentenceField: parseLabel + comma-split with sequential counter */
const renderSentenceField = (label, text, counterRef) => {
  if (!hasVal(text)) return null;
  if (typeof text !== 'string') {
    return renderFieldRow(label, text);
  }
  const sentences = splitBySentence(fmtVal(text));
  if (sentences.length === 0) return null;

  const rows = [];
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const commaItems = splitByComma(parsed.value);
      if (commaItems.length >= 2) {
        rows.push({ type: 'subtitle', text: safeString(parsed.label) });
        commaItems.forEach(ci => { rows.push({ type: 'item', text: safeString(ci), num: counterRef.n++ }); });
      } else {
        rows.push({ type: 'item', text: safeString(s), num: counterRef.n++ });
      }
    } else {
      rows.push({ type: 'item', text: safeString(s), num: counterRef.n++ });
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

/* renderArrayField: for arrays with sequential counter */
const renderArrayField = (label, items, counterRef) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  const validItems = items.filter(Boolean);
  if (validItems.length === 0) return null;

  return (
    <View style={styles.fieldBox} wrap={validItems.length > 8 ? undefined : false}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {validItems.map((item, i) => {
        const recText = item?.recommendation || String(item);
        const recDate = item?.date ? ` (${formatDate(item.date)})` : '';
        return (
          <Text key={i} style={styles.listItem}>{counterRef.n++}. {safeString(`${recText}${recDate}`)}</Text>
        );
      })}
    </View>
  );
};

// ========== COMPONENT ==========

const PsychiatricProgressNotesDocumentPDFTemplate = ({ document: docProp }) => {
  /* DATA UNWRAP */
  const records = React.useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.psychiatric_progress_notes) return Array.isArray(r.psychiatric_progress_notes) ? r.psychiatric_progress_notes : [r.psychiatric_progress_notes];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.psychiatric_progress_notes) return Array.isArray(dd.psychiatric_progress_notes) ? dd.psychiatric_progress_notes : [dd.psychiatric_progress_notes]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [docProp]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Psychiatric Progress Notes</Text>
          </View>
          <Text style={{ textAlign: 'center', color: '#666666', fontSize: 14 }}>No records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Document Header */}
        <View style={styles.documentHeader} fixed>
          <Text style={styles.documentTitle}>Psychiatric Progress Notes</Text>
          <Text style={styles.documentSubtitle}>Generated {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</Text>
        </View>

        {records.map((record, idx) => {
          const ctr = { n: 1 };

          return (
            <View key={idx} style={styles.recordContainer}>
              {/* Record Header */}
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>
                  {safeString(`Psychiatric Progress Notes ${idx + 1}`)}
                </Text>
                <Text style={styles.recordMeta}>
                  {hasVal(record.consultDate) && `Consult Date: ${formatDate(record.consultDate)}`}
                </Text>
              </View>

              {/* Visit Information — section title inside fieldBox */}
              {hasVal(record.consultDate) && (
                <View style={styles.section}>
                  <View style={styles.fieldBox} wrap={false}>
                    <Text style={styles.sectionTitle}>Visit Information</Text>
                    {renderDateField(record.consultDate, 'Consult Date')}
                  </View>
                </View>
              )}

              {/* Referral & Chief Complaint — section title inside fieldBox */}
              {(hasVal(record.referralReason) || hasVal(record.chiefComplaint)) && (
                <View style={styles.section}>
                  <View style={styles.fieldBox} wrap={false}>
                    <Text style={styles.sectionTitle}>Referral & Chief Complaint</Text>
                  </View>
                  {renderSentenceField('Referral Reason', record.referralReason, ctr)}
                  {renderSentenceField('Chief Complaint', record.chiefComplaint, ctr)}
                </View>
              )}

              {/* Examination Findings — renderSentenceField with parseLabel + comma-split */}
              {hasVal(record.examFindings) && (
                <View style={styles.section}>
                  {renderSentenceField('Examination Findings', record.examFindings, ctr)}
                </View>
              )}

              {/* Diagnosis & Treatment Plan — section title inside fieldBox */}
              {(hasVal(record.diagnosis) || hasVal(record.treatmentPlan)) && (
                <View style={styles.section}>
                  <View style={styles.fieldBox} wrap={false}>
                    <Text style={styles.sectionTitle}>Diagnosis & Treatment Plan</Text>
                  </View>
                  {renderSentenceField('Diagnosis', record.diagnosis, ctr)}
                  {renderSentenceField('Treatment Plan', record.treatmentPlan, ctr)}
                </View>
              )}

              {/* Follow-Up & Recommendations — section title inside fieldBox */}
              {(hasVal(record.followUpPlan) || hasVal(record.recommendations)) && (
                <View style={styles.section}>
                  <View style={styles.fieldBox} wrap={false}>
                    <Text style={styles.sectionTitle}>Follow-Up & Recommendations</Text>
                  </View>
                  {renderSentenceField('Follow-Up Plan', record.followUpPlan, ctr)}
                  {renderArrayField('Recommendations', record.recommendations, ctr)}
                </View>
              )}
            </View>
          );
        })}

        {/* Footer */}
        <Text style={styles.footer} fixed>
          Psychiatric Progress Notes - Confidential Medical Document
        </Text>
      </Page>
    </Document>
  );
};

export default PsychiatricProgressNotesDocumentPDFTemplate;
