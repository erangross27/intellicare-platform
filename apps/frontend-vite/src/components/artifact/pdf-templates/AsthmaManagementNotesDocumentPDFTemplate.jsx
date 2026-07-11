/**
 * AsthmaManagementNotesDocumentPDFTemplate.jsx
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
    color: '#000000',
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
    color: '#000000',
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
  fieldContainer: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    marginBottom: 6,
    color: '#000000',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    paddingBottom: 4,
  },
  subSectionTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
    marginTop: 4,
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: 12,
    color: '#000000',
    lineHeight: 1.5,
    paddingLeft: 12,
  },
  listItem: {
    fontSize: 12,
    lineHeight: 1.5,
    paddingLeft: 12,
    marginBottom: 4,
    color: '#000000',
  },
  emptyState: {
    textAlign: 'center',
    padding: 40,
    fontSize: 14,
    color: '#666666',
  },
  separator: {
    fontSize: 10,
    color: '#999999',
    marginBottom: 8,
    textAlign: 'center',
  },
});

const formatDate = (dateString) => {
  if (!dateString) return '';
  try {
    return new Date(dateString.$date || dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(dateString); }
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  // Abbreviation-safe: do NOT split after a title/abbreviation period (Dr. Mr. Mrs. St. etc.)
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|Prof|Rev|Sr|Jr|St|Gen|Col|Sgt|Lt|Capt|vs|etc)\.)(?<=[.!?])\s+|(?<=;)\s+/).filter(s => s.trim().length > 0);
};

const AsthmaManagementNotesDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (Array.isArray(templateData)) return templateData;
    if (templateData?.asthma_management_notes) return Array.isArray(templateData.asthma_management_notes) ? templateData.asthma_management_notes : [templateData.asthma_management_notes];
    if (templateData?.documentData) {
      const dd = templateData.documentData;
      if (Array.isArray(dd)) return dd;
      if (dd?.asthma_management_notes) return Array.isArray(dd.asthma_management_notes) ? dd.asthma_management_notes : [dd.asthma_management_notes];
      return [dd];
    }
    if (templateData && typeof templateData === 'object') return [templateData];
    return [];
  }, [templateData]);

  // Detect an embedded "Label: value" (e.g. a Notes/Action Plan sentence).
  const parseLabel = (text) => {
    const s = String(text == null ? '' : text);
    const m = s.match(/^([^:]{1,80}):\s+(\S.*)$/s);
    return m ? { label: m[1].trim(), value: m[2].trim() } : null;
  };

  // stacked label-above-value (mirrors the JSX nested-subtitle + value) — never side-by-side "Label: value".
  // If the value embeds "Label: value", surface that embedded label.
  const renderStackedField = (label, value) => {
    if (!value || (Array.isArray(value) && value.length === 0) || String(value).trim() === '') return null;
    const p = parseLabel(String(value));
    return (
      <View style={{ marginBottom: 6 }} wrap={false}>
        <Text style={styles.subSectionTitle}>{p ? p.label : label}</Text>
        <Text style={styles.fieldValue}>{p ? p.value : String(value)}</Text>
      </View>
    );
  };

  const renderSentenceField = (label, value) => {
    if (!value || String(value).trim() === '') return null;
    const sentences = splitBySentence(String(value));
    if (sentences.length <= 1) return renderStackedField(label, value);
    const items = sentences.map(s => ({ s, p: parseLabel(s) }));
    const hasLabels = items.some(it => it.p);
    return (
      <View style={styles.fieldContainer} wrap={sentences.length > 8}>
        <Text style={styles.sectionTitle}>{label}</Text>
        {hasLabels
          ? items.map(({ s, p }, i) => (
              p
                ? (
                  <View key={i} wrap={false} style={{ marginBottom: 4 }}>
                    <Text style={styles.subSectionTitle}>{p.label}</Text>
                    <Text style={styles.fieldValue}>{p.value}</Text>
                  </View>
                )
                : <Text key={i} style={styles.listItem}>{s}</Text>
            ))
          : sentences.map((s, i) => (<Text key={i} style={styles.listItem}>{i + 1}. {s}</Text>))}
      </View>
    );
  };

  const renderArrayField = (label, items) => {
    if (!items || !Array.isArray(items) || items.length === 0) return null;
    return (
      <View style={styles.fieldContainer} wrap={items.length > 8}>
        <Text style={styles.sectionTitle}>{label}</Text>
        {items.map((item, i) => (
          <Text key={i} style={styles.listItem}>{i + 1}. {String(item)}</Text>
        ))}
      </View>
    );
  };

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <Text style={styles.documentTitle}>Asthma Management Notes</Text>
          <Text style={styles.emptyState}>No asthma management note records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Asthma Management Notes</Text>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordSection}>
            <View wrap={false}>
              <Text style={styles.recordTitle}>{`Asthma Management Note ${idx + 1}`}</Text>
              {record.date && <Text style={styles.recordMeta}>Date: {formatDate(record.date)}</Text>}
            </View>

            {idx > 0 && <Text style={styles.separator}>{'='.repeat(60)}</Text>}

            {/* Session Info */}
            {(record.provider || record.facility) && (
              <View style={styles.fieldContainer} wrap={false}>
                <Text style={styles.sectionTitle}>Session Information</Text>
                {renderStackedField('Provider', record.provider)}
                {renderStackedField('Facility', record.facility)}
              </View>
            )}

            {/* Classification */}
            {(record.asthmaType || record.severity || record.controlLevel) && (
              <View style={styles.fieldContainer} wrap={false}>
                <Text style={styles.sectionTitle}>Asthma Classification</Text>
                {renderStackedField('Asthma Type', record.asthmaType)}
                {renderStackedField('Severity', record.severity)}
                {renderStackedField('Control Level', record.controlLevel)}
              </View>
            )}

            {renderArrayField('Current Symptoms', record.symptoms)}
            {renderArrayField('Triggers', record.triggers)}

            {/* Pulmonary Function */}
            {(record.peakFlow || record.spirometry) && (
              <View style={styles.fieldContainer} wrap={false}>
                <Text style={styles.sectionTitle}>Pulmonary Function</Text>
                {renderStackedField('Peak Flow', record.peakFlow)}
                {renderSentenceField('Spirometry', record.spirometry)}
              </View>
            )}

            {renderArrayField('Medications', record.medications)}

            {/* Treatment Plan */}
            {(record.medicationChanges || record.actionPlan || record.education || record.followUp) && (
              <View style={styles.fieldContainer}>
                <Text style={styles.sectionTitle}>Treatment Plan</Text>
                {renderSentenceField('Medication Changes', record.medicationChanges)}
                {renderSentenceField('Action Plan', record.actionPlan)}
                {renderSentenceField('Patient Education', record.education)}
                {renderSentenceField('Follow-Up', record.followUp)}
              </View>
            )}

            {renderSentenceField('Notes', record.notes)}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default AsthmaManagementNotesDocumentPDFTemplate;
