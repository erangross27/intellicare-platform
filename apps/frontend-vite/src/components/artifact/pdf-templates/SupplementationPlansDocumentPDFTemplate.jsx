import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 12,
    lineHeight: 1.5,
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  documentHeader: {
    marginBottom: 24,
    paddingBottom: 12,
  },
  documentTitle: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 4,
  },
  recordContainer: {
    marginBottom: 24,
  },
  recordHeader: {
    marginBottom: 16,
    paddingBottom: 10,
  },
  recordDateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  recordDate: {
    fontSize: 11,
    color: '#000000',
    fontFamily: 'Helvetica',
  },
  recordTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
  },
  statusBadge: {
    fontSize: 10,
    color: '#000000',
    fontFamily: 'Helvetica',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 8,
  },
  sectionContent: {
    marginLeft: 8,
  },
  fieldRow: {
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: 12,
    color: '#000000',
  },
  listItem: {
    fontSize: 12,
    color: '#000000',
    marginBottom: 4,
    paddingLeft: 8,
  },
  separator: {
    marginTop: 20,
    marginBottom: 20,
  },
  noDataText: {
    fontSize: 12,
    color: '#000000',
    textAlign: 'center',
    marginTop: 40,
  },
});

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return String(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return String(dateStr);
  }
};

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'object' && val.$date) return formatDate(val.$date);
  return String(val);
};

const keyToLabel = (key) => {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
};

const splitIntoItems = (text) => {
  if (!text) return [];
  const numbered = text.split(/\s+(?=\d+\.\s)/).filter(s => s.trim()).map(s => s.trim());
  if (numbered.length > 1) return numbered;
  const bySemicolon = text.split(/;\s*/).filter(s => s.trim()).map(s => s.trim());
  if (bySemicolon.length > 1) return bySemicolon;
  const bySentence = text.split(/(?<=[.!?])\s+/).filter(s => s.trim()).map(s => s.trim());
  if (bySentence.length > 1) return bySentence;
  return [text.trim()];
};

const stripNumber = (text) => String(text).replace(/^\d+\.\s*/, '');

const SupplementationPlansDocumentPDFTemplate = ({ document: data }) => {
  const unwrapData = (inputData) => {
    if (!inputData) return [];
    if (Array.isArray(inputData)) {
      if (inputData.length === 1 && inputData[0]?.supplementation_plans) {
        return inputData[0].supplementation_plans;
      }
      return inputData;
    }
    if (inputData.supplementation_plans) {
      return inputData.supplementation_plans;
    }
    return [inputData];
  };

  const records = unwrapData(data);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Supplementation Plans</Text>
          </View>
          <Text style={styles.noDataText}>No data available</Text>
        </Page>
      </Document>
    );
  }

  const renderObjectSection = (title, obj) => {
    if (!obj || typeof obj !== 'object') return null;
    const entries = Object.entries(obj).filter(([k, v]) => safeString(v) && k !== '_id');
    if (entries.length === 0) return null;

    return (
      <View style={styles.section} wrap={entries.length > 8 ? undefined : false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.sectionContent}>
          {entries.map(([key, value], i) => (
            <View key={i} style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>{keyToLabel(key)}</Text>
              <Text style={styles.fieldValue}>{safeString(value)}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderTextSection = (title, text) => {
    if (!text) return null;
    const items = splitIntoItems(text);

    return (
      <View style={styles.section} wrap={items.length > 8 ? undefined : false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.sectionContent}>
          {items.map((item, i) => (
            <Text key={i} style={styles.listItem}>{i + 1}. {stripNumber(item)}</Text>
          ))}
        </View>
      </View>
    );
  };

  const renderArraySection = (title, items) => {
    const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];
    if (safeItems.length === 0) return null;

    return (
      <View style={styles.section} wrap={safeItems.length > 8 ? undefined : false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.sectionContent}>
          {safeItems.map((item, i) => (
            <Text key={i} style={styles.listItem}>{i + 1}. {item}</Text>
          ))}
        </View>
      </View>
    );
  };

  const renderSimpleField = (title, value) => {
    if (!value) return null;

    return (
      <View style={styles.section} wrap={false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.sectionContent}>
          <Text style={styles.fieldValue}>{value}</Text>
        </View>
      </View>
    );
  };

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Supplementation Plans</Text>
        </View>

        {records.map((record, index) => {
          const suppObj = {};
          if (record.supplement) suppObj.supplement = record.supplement;
          if (record.dosage) suppObj.dosage = record.dosage;
          if (record.condition) suppObj.condition = record.condition;
          if (record.status) suppObj.status = record.status;
          if (record.type) suppObj.type = record.type;

          const provObj = {};
          if (record.provider) provObj.provider = record.provider;
          if (record.facility) provObj.facility = record.facility;
          if (record.date) provObj.date = formatDate(record.date);

          const recs = Array.isArray(record.recommendations) ? record.recommendations.filter(Boolean).map(r => (r && typeof r === 'object' && !Array.isArray(r)) ? String(r.recommendation || r.text || r.name || '') : String(r)) : [];

          return (
            <View key={index} style={styles.recordContainer}>
              {index > 0 && <View style={styles.separator} />}

              <View style={styles.recordHeader} wrap={false}>
                <View style={styles.recordDateRow}>
                  {record.date && (
                    <Text style={styles.recordDate}>{formatDate(record.date)}</Text>
                  )}
                  {record.status && (
                    <Text style={styles.statusBadge}>{record.status}</Text>
                  )}
                </View>
                <Text style={styles.recordTitle}>
                  {`Supplementation Plans ${index + 1}`}
                </Text>
              </View>

              {renderObjectSection('Supplement Details', suppObj)}
              {renderTextSection('Clinical Reasoning', record.reasoning)}
              {renderTextSection('Findings', record.findings)}
              {renderObjectSection('Provider Information', provObj)}
              {renderTextSection('Assessment', record.assessment)}
              {renderTextSection('Plan', record.plan)}
              {renderArraySection('Recommendations', recs)}
              {renderTextSection('Notes', record.notes)}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default SupplementationPlansDocumentPDFTemplate;
