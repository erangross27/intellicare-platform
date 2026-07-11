/**
 * AthleteSpecificDataDocumentPDFTemplate.jsx
 * PDFDownloadLink + pdfData memo pattern
 * ASCII separators only (no unicode box-drawing)
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 12,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  documentTitle: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 24,
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    paddingBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  recordSection: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
  },
  recordTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 8,
    backgroundColor: '#f0f0f0',
    padding: 8,
    borderWidth: 1,
    borderColor: '#000000',
  },
  recordMeta: {
    fontSize: 11,
    marginBottom: 4,
    color: '#333333',
    paddingLeft: 4,
  },
  fieldContainer: { marginBottom: 14 },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    paddingBottom: 4,
  },
  subSectionTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#333333', marginTop: 4, marginBottom: 2 },
  fieldValue: { fontSize: 12, color: '#000000', lineHeight: 1.5, paddingLeft: 12, marginBottom: 2 },
  listItem: { fontSize: 12, lineHeight: 1.5, paddingLeft: 12, marginBottom: 4 },
  injuryBlock: {
    marginBottom: 10,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#cccccc',
    paddingTop: 4,
    paddingBottom: 4,
  },
  injuryTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
  separator: { fontSize: 10, color: '#999999', marginBottom: 8, textAlign: 'center' },
  recItem: { fontSize: 12, lineHeight: 1.5, paddingLeft: 12, marginBottom: 4 },
  recDate: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#333333', marginTop: 4, marginBottom: 2 },
  objLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#3f3f3f', marginBottom: 2 },
  objGroup: { paddingLeft: 10, borderLeftWidth: 1, borderLeftColor: '#cccccc', marginBottom: 4 },
});

const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
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
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const isScalar = (v) => v === null || typeof v !== 'object';

const formatDate = (dateString) => {
  if (!dateString) return '';
  try {
    return new Date(dateString.$date || dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(dateString); }
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  // Abbreviation-safe: do NOT split after a title/abbreviation period (Dr. Mr. Mrs. St. etc.)
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|Prof|Rev|Sr|Jr|St|Gen|Col|Sgt|Lt|Capt|vs|etc)\.)(?<=[.!?])\s+|(?<=;)\s+/).filter(s => {
    const trimmed = s.trim();
    return trimmed.length > 0 && trimmed.replace(/[.!?;,]+/g, '').trim().length > 0;
  });
};

const displayBoolean = (val) => {
  if (val === true || val === 'true' || val === 'Yes') return 'Yes';
  if (val === false || val === 'false' || val === 'No') return 'No';
  return '';
};

const AthleteSpecificDataDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.athlete_specific_data) return Array.isArray(r.athlete_specific_data) ? r.athlete_specific_data : [r.athlete_specific_data];
      if (r?.documentData) {
        const dd = r.documentData;
        if (Array.isArray(dd)) return dd;
        if (dd?.athlete_specific_data) return Array.isArray(dd.athlete_specific_data) ? dd.athlete_specific_data : [dd.athlete_specific_data];
        return [dd];
      }
      return r;
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  // stacked label-above-value (mirrors the JSX nested-subtitle + value) — never side-by-side "Label: value".
  const renderField = (label, value) => {
    if (!value || (Array.isArray(value) && value.length === 0) || String(value).trim() === '') return null;
    return (
      <View style={{ marginBottom: 6 }} wrap={false}>
        <Text style={styles.subSectionTitle}>{label}</Text>
        <Text style={styles.fieldValue}>{String(value)}</Text>
      </View>
    );
  };

  const renderSentenceField = (label, value) => {
    if (!value || String(value).trim() === '') return null;
    const sentences = splitBySentence(String(value));
    if (sentences.length <= 1) return renderField(label, value);
    return (
      <View style={styles.fieldContainer}>
        <Text style={styles.sectionTitle}>{label}</Text>
        {sentences.map((s, i) => <Text key={i} style={styles.listItem}>{i + 1}. {s}</Text>)}
      </View>
    );
  };

  // Recursive grayscale OBJECT renderer
  const renderObjectNode = (label, value, depth, keyPrefix) => {
    if (isEmptyDeep(value)) return null;
    if (isScalar(value)) {
      return (
        <View key={keyPrefix} style={{ marginBottom: 2 }} wrap={false}>
          <Text style={styles.subSectionTitle}>{label}</Text>
          <Text style={styles.fieldValue}>{fmtScalar(value)}</Text>
        </View>
      );
    }
    const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    return (
      <View key={keyPrefix} style={depth > 0 ? styles.objGroup : undefined}>
        {label && depth > 0 && <Text style={styles.objLabel}>{label}</Text>}
        {entries.map(([k, v]) => (
          isScalar(v)
            ? renderObjectNode(humanizeKey(k), v, depth + 1, `${keyPrefix}.${k}`)
            : renderObjectNode(humanizeKey(k), v, depth + 1, `${keyPrefix}.${k}`)
        ))}
      </View>
    );
  };

  const renderObjectField = (label, value) => {
    if (isEmptyDeep(value) || isScalar(value)) return null;
    const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    const leafCount = JSON.stringify(value).split(':').length - 1;
    return (
      <View style={styles.fieldContainer} wrap={leafCount > 8}>
        <Text style={styles.sectionTitle}>{label}</Text>
        {entries.map(([k, v]) => (
          isScalar(v)
            ? renderObjectNode(humanizeKey(k), v, 1, k)
            : renderObjectNode(humanizeKey(k), v, 1, k)
        ))}
      </View>
    );
  };

  const renderRecommendationsField = (recommendations) => {
    const recs = Array.isArray(recommendations) ? recommendations.filter(r => !isEmptyDeep(r?.recommendation)) : [];
    if (recs.length === 0) return null;
    const groups = [];
    recs.forEach((rec) => {
      const d = (rec?.date || '').trim();
      const last = groups[groups.length - 1];
      if (last && last.date === d) last.items.push(rec);
      else groups.push({ date: d, items: [rec] });
    });
    return (
      <View style={styles.fieldContainer} wrap={recs.length > 8}>
        <Text style={styles.sectionTitle}>Recommendations</Text>
        {groups.map((group, gIdx) => (
          <View key={gIdx}>
            {group.date && <Text style={styles.recDate}>{group.date}</Text>}
            {group.items.map((rec, i) => (
              <Text key={i} style={styles.recItem}>- {String(rec?.recommendation || '')}</Text>
            ))}
          </View>
        ))}
      </View>
    );
  };

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <Text style={styles.documentTitle}>Athlete Specific Data</Text>
          <Text style={styles.emptyState}>No records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Athlete Specific Data</Text>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordSection}>
            <View wrap={false}>
              <Text style={styles.recordTitle}>{`Athlete Specific Data ${idx + 1}`}</Text>
              {record.date && <Text style={styles.recordMeta}>Date: {formatDate(record.date)}</Text>}
            </View>
            {idx > 0 && <Text style={styles.separator}>{'='.repeat(60)}</Text>}

            {(record.provider || record.facility || record.status) && (
              <View style={styles.fieldContainer}>
                <Text style={styles.sectionTitle}>Record Information</Text>
                {renderField('Provider', record.provider)}
                {renderField('Facility', record.facility)}
                {renderField('Status', record.status)}
              </View>
            )}

            {(record.sport || record.position || record.professionalLevel !== undefined) && (
              <View style={styles.fieldContainer}>
                <Text style={styles.sectionTitle}>Sport Profile</Text>
                {renderField('Sport', record.sport)}
                {renderField('Position', record.position)}
                {renderField('Professional Level', displayBoolean(record.professionalLevel))}
                {renderField('Team Support', displayBoolean(record.teamSupport))}
              </View>
            )}

            {record.previousInjuries && record.previousInjuries.length > 0 && (
              <View style={styles.fieldContainer}>
                <Text style={styles.sectionTitle}>Previous Injuries</Text>
                {record.previousInjuries.map((inj, injIdx) => (
                  <View key={injIdx} style={styles.injuryBlock} wrap={false}>
                    <Text style={styles.injuryTitle}>Injury {injIdx + 1}</Text>
                    {inj.injury && (<><Text style={styles.subSectionTitle}>Injury</Text><Text style={styles.fieldValue}>{String(inj.injury)}</Text></>)}
                    {inj.date && (<><Text style={styles.subSectionTitle}>Date</Text><Text style={styles.fieldValue}>{String(inj.date)}</Text></>)}
                    {inj.recovery && (<><Text style={styles.subSectionTitle}>Recovery</Text><Text style={styles.fieldValue}>{String(inj.recovery)}</Text></>)}
                  </View>
                ))}
              </View>
            )}

            {(record.psychologicalSupport !== undefined || record.antiDopingNotification !== undefined) && (
              <View style={styles.fieldContainer}>
                <Text style={styles.sectionTitle}>Support and Compliance</Text>
                {renderField('Psychological Support', displayBoolean(record.psychologicalSupport))}
                {renderField('Anti-Doping Notification', displayBoolean(record.antiDopingNotification))}
              </View>
            )}

            {renderSentenceField('Findings', record.findings)}
            {renderSentenceField('Assessment', record.assessment)}
            {renderSentenceField('Plan', record.plan)}
            {renderRecommendationsField(record.recommendations)}
            {renderObjectField('Results', record.results)}
            {renderSentenceField('Notes', record.notes)}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default AthleteSpecificDataDocumentPDFTemplate;
