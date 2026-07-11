/**
 * SchoolPerformanceDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — school performance
 * Collection: school_performance
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
  if (typeof val === 'string') {
    let str = val;
    str = str.replace(/[\u00B5\u03BC]m/g, 'um');
    str = str.replace(/\u00B0/g, ' deg');
    str = str.replace(/\u00B1/g, '+/-');
    str = str.replace(/\u2265/g, '>=');
    str = str.replace(/\u2264/g, '<=');
    str = str.replace(/\u2192/g, '->');
    return str;
  }
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

const SchoolPerformanceDocumentPDFTemplate = ({ document: docProp }) => {
  const records = (() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.school_performance) return Array.isArray(r.school_performance) ? r.school_performance : [r.school_performance];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.school_performance) return Array.isArray(dd.school_performance) ? dd.school_performance : [dd.school_performance]; return [dd]; }
      if (r?.records) return Array.isArray(r.records) ? r.records : [r.records];
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  })();

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>School Performance</Text>
          </View>
          <Text style={styles.noDataText}>No school performance records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>School Performance</Text>
        </View>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader}>
              {hasVal(record.date) && (
                <View style={styles.recordDateRow}>
                  <Text style={styles.recordDate}>{formatDate(record.date)}</Text>
                </View>
              )}
              <Text style={styles.recordTitle}>{safeString(`School Performance ${idx + 1}`)}</Text>
            </View>

            {/* School Information */}
            {(hasVal(record.grade) || hasVal(record.school) || hasVal(record.provider) || hasVal(record.facility)) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>School Information</Text>
                {hasVal(record.grade) && (
                  <View style={styles.fieldBox}>
                    <Text style={styles.fieldLabel}>Grade</Text>
                    <Text style={styles.fieldValue}>{safeString(record.grade)}</Text>
                  </View>
                )}
                {hasVal(record.school) && (
                  <View style={styles.fieldBox}>
                    <Text style={styles.fieldLabel}>School</Text>
                    <Text style={styles.fieldValue}>{safeString(record.school)}</Text>
                  </View>
                )}
                {hasVal(record.provider) && (
                  <View style={styles.fieldBox}>
                    <Text style={styles.fieldLabel}>Provider</Text>
                    <Text style={styles.fieldValue}>{safeString(record.provider)}</Text>
                  </View>
                )}
                {hasVal(record.facility) && (
                  <View style={styles.fieldBox}>
                    <Text style={styles.fieldLabel}>Facility</Text>
                    <Text style={styles.fieldValue}>{safeString(record.facility)}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Academic Performance */}
            {hasVal(record.academicPerformance) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Academic Performance</Text>
                <Text style={styles.fieldValue}>{safeString(record.academicPerformance)}</Text>
              </View>
            )}

            {/* Behavior & Social */}
            {(hasVal(record.behaviorInClass) || hasVal(record.peerInteractions)) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Behavior & Social</Text>
                {hasVal(record.behaviorInClass) && (
                  <View style={styles.fieldBox}>
                    <Text style={styles.fieldLabel}>Behavior in Class</Text>
                    <Text style={styles.fieldValue}>{safeString(record.behaviorInClass)}</Text>
                  </View>
                )}
                {hasVal(record.peerInteractions) && (
                  <View style={styles.fieldBox}>
                    <Text style={styles.fieldLabel}>Peer Interactions</Text>
                    <Text style={styles.fieldValue}>{safeString(record.peerInteractions)}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Strengths */}
            {hasVal(record.strengths) && (
              <View style={styles.section}>
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Strengths</Text>
                  {record.strengths.slice(0, 1).map((s, i) => (
                    <Text key={i} style={styles.listItem}>{i + 1}. {safeString(s)}</Text>
                  ))}
                </View>
                {record.strengths.slice(1).map((s, i) => (
                  <Text key={i + 1} style={styles.listItem}>{i + 2}. {safeString(s)}</Text>
                ))}
              </View>
            )}

            {/* Concerns */}
            {hasVal(record.concerns) && (
              <View style={styles.section}>
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>Concerns</Text>
                  {record.concerns.slice(0, 1).map((c, i) => (
                    <Text key={i} style={styles.listItem}>{i + 1}. {safeString(c)}</Text>
                  ))}
                </View>
                {record.concerns.slice(1).map((c, i) => (
                  <Text key={i + 1} style={styles.listItem}>{i + 2}. {safeString(c)}</Text>
                ))}
              </View>
            )}

            {/* Special Education */}
            {(record.specialEducation === true || record.specialEducation === false || hasVal(record.iepOr504Plan)) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Special Education</Text>
                <View style={styles.fieldBox}>
                  <Text style={styles.fieldLabel}>Special Education Services</Text>
                  <Text style={styles.fieldValue}>{record.specialEducation ? 'Yes' : 'No'}</Text>
                </View>
                {hasVal(record.iepOr504Plan) && (
                  <View style={styles.fieldBox}>
                    <Text style={styles.fieldLabel}>IEP/504 Plan</Text>
                    <Text style={styles.fieldValue}>{safeString(record.iepOr504Plan)}</Text>
                  </View>
                )}
              </View>
            )}

            {/* School Forms Completed */}
            {hasVal(record.schoolFormsCompleted) && (
              <View style={styles.section}>
                <View wrap={false}>
                  <Text style={styles.sectionTitle}>School Forms Completed</Text>
                </View>
                {record.schoolFormsCompleted.map((form, fIdx) => (
                  <View key={fIdx} style={styles.fieldBox} wrap={false}>
                    <Text style={styles.nestedSubtitle}>{fIdx + 1}. {safeString(form.formType)}</Text>
                    <Text style={styles.fieldValue}>Date: {safeString(form.completedDate || 'N/A')}</Text>
                    <Text style={styles.fieldValue}>Status: {safeString(form.status || 'N/A')}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Assessment */}
            {hasVal(record.assessment) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Assessment</Text>
                <Text style={styles.fieldValue}>{safeString(record.assessment)}</Text>
              </View>
            )}

            {/* Notes */}
            {hasVal(record.notes) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Notes</Text>
                <Text style={styles.fieldValue}>{safeString(record.notes)}</Text>
              </View>
            )}

            {idx < records.length - 1 && <View style={styles.separator} />}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default SchoolPerformanceDocumentPDFTemplate;
