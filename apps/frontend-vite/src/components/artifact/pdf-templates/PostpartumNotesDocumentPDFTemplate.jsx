import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * PostpartumNotesDocumentPDFTemplate
 * March 2026 — Helvetica, LETTER size, NO BLUE COLORS
 * Only #000000/#333333/#cccccc/#f5f5f5
 * Collection: postpartum_notes
 */

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 12,
    backgroundColor: '#ffffff',
    color: '#000000',
    size: 'LETTER',
  },
  header: {
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
  },
  documentTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
    color: '#000000',
  },
  recordCard: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
  },
  recordTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 12,
    color: '#000000',
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    marginBottom: 6,
    color: '#333333',
  },
  fieldBox: {
    marginBottom: 10,
    paddingLeft: 8,
  },
  fieldSubtitle: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
    color: '#000000',
  },
  fieldValue: {
    fontSize: 12,
    lineHeight: 1.4,
    marginBottom: 4,
    color: '#333333',
  },
  listItem: {
    fontSize: 12,
    paddingLeft: 8,
    marginBottom: 4,
    lineHeight: 1.4,
    color: '#333333',
  },
});

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try {
    const d = new Date(dateValue.$date || dateValue);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return String(dateValue);
  }
};

const PostpartumNotesDocumentPDFTemplate = ({ document: doc }) => {
  let records = [];

  if (Array.isArray(doc)) {
    records = doc;
  } else if (doc?.postpartum_notes) {
    records = Array.isArray(doc.postpartum_notes) ? doc.postpartum_notes : [doc.postpartum_notes];
  } else if (doc?.documentData?.postpartum_notes) {
    records = Array.isArray(doc.documentData.postpartum_notes) ? doc.documentData.postpartum_notes : [doc.documentData.postpartum_notes];
  } else if (doc?.documentData) {
    records = Array.isArray(doc.documentData) ? doc.documentData : [doc.documentData];
  } else if (doc && typeof doc === 'object') {
    records = [doc];
  }

  records = records.filter(r => r && Object.keys(r).length > 0);

  const safeString = (val) => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    if (typeof val === 'number') return String(val);
    if (typeof val === 'string') return val;
    return String(val);
  };

  const hasVal = (v) => {
    if (v === null || v === undefined || v === '') return false;
    if (typeof v === 'boolean') return true;
    if (typeof v === 'number') return true;
    if (typeof v === 'string') return v.trim() !== '';
    if (Array.isArray(v)) return v.length > 0;
    return true;
  };

  const SECTION_CONFIG = [
    {
      title: 'Delivery Information',
      fields: [
        { key: 'deliveryDate', label: 'Delivery Date', type: 'date' },
        { key: 'deliveryType', label: 'Delivery Type' },
        { key: 'gestationalAge', label: 'Gestational Age' },
      ],
    },
    {
      title: 'Recovery Assessment',
      fields: [
        { key: 'lochiaCharacteristics', label: 'Lochia Characteristics' },
        { key: 'uterineInvolution', label: 'Uterine Involution' },
        { key: 'perinealHealing', label: 'Perineal Healing' },
        { key: 'cesareanIncisionStatus', label: 'Cesarean Incision Status' },
        { key: 'vitalSigns', label: 'Vital Signs' },
      ],
    },
    {
      title: 'Lactation',
      fields: [
        { key: 'breastfeedingStatus', label: 'Breastfeeding Status' },
        { key: 'lactationAssessment', label: 'Lactation Assessment' },
      ],
    },
    {
      title: 'Screening & Scores',
      fields: [
        { key: 'edinburghPostnatalDepressionScore', label: 'Edinburgh Postnatal Depression Score', type: 'number' },
        { key: 'homansSign', label: "Homan's Sign", type: 'boolean' },
        { key: 'estimatedBloodLoss', label: 'Estimated Blood Loss (mL)', type: 'number' },
        { key: 'hemoglobinLevel', label: 'Hemoglobin Level', type: 'number' },
        { key: 'postpartumHemorrhageHistory', label: 'Postpartum Hemorrhage History', type: 'boolean' },
      ],
    },
    {
      title: 'Bowel & Bladder Function',
      fields: [
        { key: 'bowelBladderFunction', label: 'Bowel & Bladder Function' },
        { key: 'diastasisRectiMeasurement', label: 'Diastasis Recti Measurement' },
      ],
    },
    {
      title: 'Immunizations',
      fields: [
        { key: 'immunizationStatus', label: 'Immunization Status', type: 'array' },
        { key: 'rhogamAdministration', label: 'RhoGAM Administration', type: 'boolean' },
        { key: 'rubellaImmunityStatus', label: 'Rubella Immunity Status' },
      ],
    },
    {
      title: 'Discharge & Guidance',
      fields: [
        { key: 'contraceptionCounseling', label: 'Contraception Counseling' },
        { key: 'sleepPatterns', label: 'Sleep Patterns' },
        { key: 'socialSupportAssessment', label: 'Social Support Assessment' },
        { key: 'returnToActivityGuidance', label: 'Return to Activity Guidance' },
      ],
    },
  ];

  const renderField = (record, field, sectionTitle) => {
    const val = record[field.key];
    if (!hasVal(val)) return null;
    const showFieldLabel = field.label.toLowerCase() !== (sectionTitle || '').toLowerCase();

    if (field.type === 'date') {
      return (
        <View style={styles.fieldBox} key={field.key}>
          {showFieldLabel && <Text style={styles.fieldSubtitle}>{field.label}</Text>}
          <Text style={styles.fieldValue}>{formatDate(val)}</Text>
        </View>
      );
    }

    if (field.type === 'boolean') {
      return (
        <View style={styles.fieldBox} key={field.key}>
          {showFieldLabel && <Text style={styles.fieldSubtitle}>{field.label}</Text>}
          <Text style={styles.fieldValue}>{val ? 'Yes' : 'No'}</Text>
        </View>
      );
    }

    if (field.type === 'number') {
      return (
        <View style={styles.fieldBox} key={field.key}>
          {showFieldLabel && <Text style={styles.fieldSubtitle}>{field.label}</Text>}
          <Text style={styles.fieldValue}>{String(val)}</Text>
        </View>
      );
    }

    if (field.type === 'array') {
      const items = Array.isArray(val) ? val.filter(Boolean) : [];
      if (items.length === 0) return null;
      return (
        <View style={styles.fieldBox} key={field.key}>
          {showFieldLabel && <Text style={styles.fieldSubtitle}>{field.label}</Text>}
          {items.map((item, i) => (
            <Text key={i} style={styles.listItem}>
              {i + 1}. {safeString(item)}
            </Text>
          ))}
        </View>
      );
    }

    /* Default: string — split by sentence */
    const strVal = safeString(val);
    const sentences = strVal.split(/[;.]/).map(s => s.trim()).filter(Boolean);
    if (sentences.length > 1) {
      return (
        <View style={styles.fieldBox} key={field.key}>
          {showFieldLabel && <Text style={styles.fieldSubtitle}>{field.label}</Text>}
          {sentences.map((s, i) => (
            <Text key={i} style={styles.listItem}>
              {i + 1}. {s}
            </Text>
          ))}
        </View>
      );
    }

    return (
      <View style={styles.fieldBox} key={field.key}>
        {showFieldLabel && <Text style={styles.fieldSubtitle}>{field.label}</Text>}
        <Text style={styles.fieldValue}>{strVal}</Text>
      </View>
    );
  };

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.documentTitle}>Postpartum Notes</Text>
        </View>

        {records.map((record, idx) => {
          const seenLabels = new Set();
          return (
            <View key={idx} style={styles.recordCard}>
              <Text style={styles.recordTitle}>Postpartum Note {idx + 1}</Text>

              {SECTION_CONFIG.map((section, sIdx) => {
                const visibleFields = section.fields.filter(f => {
                  if (seenLabels.has(f.label)) return false;
                  const val = record[f.key];
                  return hasVal(val);
                });
                if (visibleFields.length === 0) return null;
                visibleFields.forEach(f => seenLabels.add(f.label));

                return (
                  <View key={sIdx} style={styles.section} wrap={false}>
                    <Text style={styles.sectionTitle}>{section.title}</Text>
                    {visibleFields.map(f => renderField(record, f, section.title))}
                  </View>
                );
              })}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default PostpartumNotesDocumentPDFTemplate;
