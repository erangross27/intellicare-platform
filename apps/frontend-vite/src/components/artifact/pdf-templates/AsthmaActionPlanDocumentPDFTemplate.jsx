/**
 * AsthmaActionPlanDocumentPDFTemplate.jsx
 * PDFDownloadLink + pdfData memo pattern
 * ASCII separators only (no unicode box-drawing)
 * Shows all zone sub-fields: peakFlowRange, symptoms, medications, actions, etc.
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 14,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  documentTitle: {
    fontSize: 24,
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
    fontSize: 19,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 8,
    color: '#000000',
    backgroundColor: '#f0f0f0',
    padding: 8,
    borderWidth: 1,
    borderColor: '#000000',
  },
  recordMeta: {
    fontSize: 13,
    marginBottom: 4,
    color: '#333333',
    paddingLeft: 4,
  },
  fieldContainer: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    marginBottom: 6,
    color: '#000000',
    // NO borderBottom — it makes react-pdf orphan the title from its content
  },
  subSectionTitle: {
    fontSize: 15,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
    marginTop: 6,
    color: '#333333',
  },
  fieldValue: {
    fontSize: 14,
    color: '#000000',
    lineHeight: 1.5,
    paddingLeft: 12,
  },
  listItem: {
    fontSize: 14,
    lineHeight: 1.5,
    paddingLeft: 12,
    marginBottom: 4,
    color: '#000000',
  },
  emptyState: {
    textAlign: 'center',
    padding: 40,
    fontSize: 16,
    color: '#666666',
  },
  separator: {
    fontSize: 11,
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
  return text.split(/(?<=[.!?])\s+|(?<=;)\s+/).filter(s => s.trim().length > 0);
};

const AsthmaActionPlanDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (Array.isArray(templateData)) return templateData;
    if (templateData?.asthma_action_plan) return Array.isArray(templateData.asthma_action_plan) ? templateData.asthma_action_plan : [templateData.asthma_action_plan];
    if (templateData?.documentData) {
      const dd = templateData.documentData;
      if (Array.isArray(dd)) return dd;
      if (dd?.asthma_action_plan) return Array.isArray(dd.asthma_action_plan) ? dd.asthma_action_plan : [dd.asthma_action_plan];
      return [dd];
    }
    if (templateData && typeof templateData === 'object') return [templateData];
    return [];
  }, [templateData]);

  // STACKED label-above-value (mirrors the JSX nested-subtitle + value) — never side-by-side "Label: value"
  const renderField = (label, value) => {
    if (!value || (Array.isArray(value) && value.length === 0) || String(value).trim() === '') return null;
    return (
      <View style={{ marginBottom: 6 }}>
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
      <View style={styles.fieldContainer} wrap={sentences.length > 8}>
        <Text style={styles.sectionTitle}>{label}</Text>
        {sentences.map((s, i) => (
          <Text key={i} style={styles.listItem}>{i + 1}. {s}</Text>
        ))}
      </View>
    );
  };

  const renderArrayField = (label, items) => {
    if (!items || !Array.isArray(items) || items.length === 0) return null;
    return (
      <View style={{ marginBottom: 6 }} wrap={items.length > 8}>
        <Text style={styles.subSectionTitle}>{label}</Text>
        {items.map((item, i) => (
          <Text key={i} style={styles.listItem}>{i + 1}. {String(item)}</Text>
        ))}
      </View>
    );
  };

  const renderZoneSection = (title, zone) => {
    if (!zone) return null;
    const { peakFlowRange, symptoms, medications, actions, contactInstructions, emergencyMedications, emergencyContact, when911 } = zone;
    const hasData = peakFlowRange || (symptoms && symptoms.length > 0) || (medications && medications.length > 0) ||
      (actions && actions.length > 0) || contactInstructions || (emergencyMedications && emergencyMedications.length > 0) ||
      emergencyContact || (when911 && when911.length > 0);
    if (!hasData) return null;

    // total rows in this zone → keep small zones atomic (wrap={false}, no orphan); flow only a huge zone
    const cnt = (a) => (Array.isArray(a) ? a.length : 0);
    const zoneRows = 1 + (peakFlowRange ? 1 : 0)
      + (cnt(symptoms) ? cnt(symptoms) + 1 : 0)
      + (cnt(medications) ? cnt(medications) + 1 : 0)
      + (cnt(actions) ? cnt(actions) + 1 : 0)
      + (contactInstructions ? 1 : 0)
      + (cnt(emergencyMedications) ? cnt(emergencyMedications) + 1 : 0)
      + (emergencyContact ? 1 : 0)
      + (cnt(when911) ? cnt(when911) + 1 : 0);

    return (
      <View style={styles.fieldContainer} wrap={zoneRows > 18}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {renderField('Peak Flow Range', peakFlowRange)}
        {renderArrayField('Symptoms', symptoms)}
        {renderArrayField('Medications', medications)}
        {renderArrayField('Actions', actions)}
        {renderField('Contact Instructions', contactInstructions)}
        {renderArrayField('Emergency Medications', emergencyMedications)}
        {renderField('Emergency Contact', emergencyContact)}
        {renderArrayField('When to Call 911', when911)}
      </View>
    );
  };

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <Text style={styles.documentTitle}>Asthma Action Plans</Text>
          <Text style={styles.emptyState}>No asthma action plan records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Asthma Action Plans</Text>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordSection}>
            <View wrap={false}>
              <Text style={styles.recordTitle}>
                {`Asthma Action Plan ${idx + 1}`}
              </Text>
              {record.date && (
                <Text style={styles.recordMeta}>Date: {formatDate(record.date)}</Text>
              )}
              {record.status && (
                <Text style={styles.recordMeta}>Status: {record.status}</Text>
              )}
            </View>

            {idx > 0 && <Text style={styles.separator}>{'='.repeat(60)}</Text>}

            {/* Plan Information */}
            {(record.provider || record.facility) && (
              <View style={styles.fieldContainer} wrap={false}>
                <Text style={styles.sectionTitle}>Plan Information</Text>
                {renderField('Provider', record.provider)}
                {renderField('Facility', record.facility)}
              </View>
            )}

            {/* Findings */}
            {renderSentenceField('Findings', record.findings)}

            {/* Zones */}
            {renderZoneSection('Green Zone - Doing Well', record.greenZone)}
            {renderZoneSection('Yellow Zone - Caution', record.yellowZone)}
            {renderZoneSection('Red Zone - Medical Alert', record.redZone)}

            {/* Assessment, Plan, Notes */}
            {renderSentenceField('Assessment', record.assessment)}
            {renderSentenceField('Plan', record.plan)}
            {renderSentenceField('Notes', record.notes)}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default AsthmaActionPlanDocumentPDFTemplate;
