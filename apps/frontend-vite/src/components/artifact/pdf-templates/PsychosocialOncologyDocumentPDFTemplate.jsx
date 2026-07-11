/**
 * PsychosocialOncologyDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — psychosocial oncology
 * Collection: psychosocial_oncology
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

const humanizeKey = (key) => {
  if (key === null || key === undefined) return '';
  return String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

/* flattenLeaves: nested object -> [{ keyLabel, value }] leaf rows (no [object Object]) */
const flattenLeaves = (obj, parentLabel = '') => {
  const rows = [];
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return rows;
  Object.entries(obj).forEach(([k, v]) => {
    if (v === null || v === undefined || v === '') return;
    const keyLabel = parentLabel ? `${parentLabel} - ${humanizeKey(k)}` : humanizeKey(k);
    if (Array.isArray(v)) {
      if (v.length === 0) return;
      const flat = v.map((item) => (item && typeof item === 'object' ? Object.values(item).filter((x) => x !== null && x !== undefined && x !== '').map(safeString).join(' - ') : safeString(item))).filter(Boolean).join(', ');
      if (flat) rows.push({ keyLabel, value: flat });
    } else if (typeof v === 'object') {
      if (Object.keys(v).length === 0) return;
      rows.push(...flattenLeaves(v, keyLabel));
    } else {
      rows.push({ keyLabel, value: v });
    }
  });
  return rows;
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

/* ======= FIELD RENDERERS ======= */
const RenderField = ({ label, value }) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox} wrap={false}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{safeString(value)}</Text>
    </View>
  );
};

const RenderDateField = ({ label, value }) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox} wrap={false}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{formatDate(value)}</Text>
    </View>
  );
};

const RenderBooleanField = ({ label, value }) => {
  if (value === null || value === undefined) return null;
  return (
    <View style={styles.fieldBox} wrap={false}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value ? 'Yes' : 'No'}</Text>
    </View>
  );
};

const RenderArrayField = ({ label, items }) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {items.filter(Boolean).map((item, i) => (
        <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
      ))}
    </View>
  );
};

const RenderObjectField = ({ label, obj }) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const rows = flattenLeaves(obj);
  if (rows.length === 0) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {rows.map(({ keyLabel, value }, i) => (
        <View key={i} style={{ flexDirection: 'row', marginBottom: 2, paddingLeft: 8 }}>
          <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#404040', width: 140 }}>{keyLabel}:</Text>
          <Text style={{ fontSize: 11, color: '#000000', flex: 1 }}>{safeString(value)}</Text>
        </View>
      ))}
    </View>
  );
};

const RenderRecommendations = ({ items }) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>RECOMMENDATIONS</Text>
      {items.filter(Boolean).map((rec, i) => {
        const recText = typeof rec === 'string' ? rec : (rec.recommendation || '');
        const recDate = typeof rec === 'object' ? rec.date : null;
        return (
          <View key={i} style={{ marginBottom: 3, paddingLeft: 8 }}>
            {recDate && <Text style={{ fontSize: 9, color: '#606060', marginBottom: 1 }}>{recDate}</Text>}
            <Text style={styles.listItem}>{i + 1}. {recText}</Text>
          </View>
        );
      })}
    </View>
  );
};

/* ======= MAIN TEMPLATE ======= */
const PsychosocialOncologyDocumentPDFTemplate = ({ document: data }) => {
  let recordsArray;
  if (Array.isArray(data)) {
    recordsArray = data[0]?.psychosocial_oncology || data;
  } else {
    recordsArray = data?.psychosocial_oncology || (data?.documentData || data?.data || [data]);
  }
  if (!Array.isArray(recordsArray)) recordsArray = [recordsArray];
  recordsArray = recordsArray.filter(Boolean);

  if (recordsArray.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.noDataText}>No psychosocial oncology records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Psychosocial Oncology</Text>
        </View>

        {recordsArray.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              <View style={styles.recordDateRow}>
                <Text style={styles.recordTitle}>{record.type || `Psychosocial Oncology ${idx + 1}`}</Text>
                {hasVal(record.date) && <Text style={styles.recordDate}>{formatDate(record.date)}</Text>}
              </View>
            </View>

            {/* General Information */}
            {(hasVal(record.date) || hasVal(record.type) || hasVal(record.provider) || hasVal(record.facility) || hasVal(record.status)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>General Information</Text>
                <RenderDateField label="DATE" value={record.date} />
                <RenderField label="TYPE" value={record.type} />
                <RenderField label="PROVIDER" value={record.provider} />
                <RenderField label="FACILITY" value={record.facility} />
                <RenderField label="STATUS" value={record.status} />
              </View>
            )}

            {/* Screening */}
            {(hasVal(record.distressScreening) || hasVal(record.anxietyLevel) || hasVal(record.depressionScreening)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Screening</Text>
                <RenderField label="DISTRESS SCREENING" value={record.distressScreening} />
                <RenderField label="ANXIETY LEVEL" value={record.anxietyLevel} />
                <RenderField label="DEPRESSION SCREENING" value={record.depressionScreening} />
              </View>
            )}

            {/* Coping Strategies */}
            {hasVal(record.copingStrategies) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Coping Strategies</Text>
                <RenderArrayField label="STRATEGIES" items={record.copingStrategies} />
              </View>
            )}

            {/* Support Systems */}
            {hasVal(record.supportSystems) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Support Systems</Text>
                <RenderArrayField label="SYSTEMS" items={record.supportSystems} />
              </View>
            )}

            {/* Financial Toxicity */}
            {hasVal(record.financialToxicity) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Financial Toxicity</Text>
                <RenderObjectField label="DETAILS" obj={record.financialToxicity} />
              </View>
            )}

            {/* Return to Work */}
            {hasVal(record.returnToWork) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Return to Work</Text>
                <RenderObjectField label="DETAILS" obj={record.returnToWork} />
              </View>
            )}

            {/* Support Group Participation */}
            {record.supportGroupParticipation !== undefined && record.supportGroupParticipation !== null && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Support Group Participation</Text>
                <RenderBooleanField label="PARTICIPATES" value={record.supportGroupParticipation} />
              </View>
            )}

            {/* Findings */}
            {hasVal(record.findings) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Findings</Text>
                <View style={styles.fieldBox}>
                  <Text style={styles.fieldValue}>{safeString(record.findings)}</Text>
                </View>
              </View>
            )}

            {/* Assessment */}
            {hasVal(record.assessment) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Assessment</Text>
                <View style={styles.fieldBox}>
                  <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#414141', lineHeight: 1.4 }}>{safeString(record.assessment)}</Text>
                </View>
              </View>
            )}

            {/* Plan */}
            {hasVal(record.plan) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Plan</Text>
                <View style={styles.fieldBox}>
                  <Text style={styles.fieldValue}>{safeString(record.plan)}</Text>
                </View>
              </View>
            )}

            {/* Recommendations */}
            {hasVal(record.recommendations) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Recommendations</Text>
                <RenderRecommendations items={record.recommendations} />
              </View>
            )}

            {/* Results (dynamic-key object) */}
            {hasVal(record.results) && flattenLeaves(record.results).length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Results</Text>
                <RenderObjectField label="RESULTS" obj={record.results} />
              </View>
            )}

            {/* Notes */}
            {hasVal(record.notes) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Notes</Text>
                <View style={styles.fieldBox}>
                  <Text style={styles.fieldValue}>{safeString(record.notes)}</Text>
                </View>
              </View>
            )}

            {idx < recordsArray.length - 1 && <View style={styles.separator} />}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PsychosocialOncologyDocumentPDFTemplate;
