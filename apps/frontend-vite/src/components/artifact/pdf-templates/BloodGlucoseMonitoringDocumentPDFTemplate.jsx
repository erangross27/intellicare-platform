import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * Blood Glucose Monitoring Document PDF Template
 * BOX-FREE clean black & white: no background fills, no box borders — only thin line
 * dividers under the document title, each section title, and the record header.
 * Helvetica font, A4. (checklist 6a3d4c85 §H)
 */

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 12,
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  // Document header
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
    color: '#000000',
    textAlign: 'center',
    marginTop: 4,
    fontFamily: 'Helvetica',
  },
  // Record container
  recordContainer: {
    marginBottom: 28,
    paddingBottom: 16,
  },
  // Record header — box-free: just a thin underline, no fill/border box
  recordHeader: {
    marginBottom: 14,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
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
    color: '#000000',
    fontFamily: 'Helvetica',
  },
  // Section
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    paddingBottom: 4,
    marginBottom: 10,
  },
  // Field block — box-free: spacing only, no border/background
  fieldBlock: {
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  // Sub-label inside a field block (for parseSubtitleItems nested labels)
  subLabel: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    paddingLeft: 16,
    marginTop: 6,
    marginBottom: 4,
  },
  // Numbered value row
  numberedItem: {
    flexDirection: 'row',
    paddingLeft: 10,
    marginBottom: 3,
  },
  itemNumber: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    width: 22,
  },
  itemContent: {
    fontSize: 11,
    color: '#000000',
    flex: 1,
    lineHeight: 1.5,
  },
  // No data
  noData: {
    fontSize: 12,
    color: '#000000',
    textAlign: 'center',
    marginTop: 40,
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#000000',
    borderTopWidth: 1,
    borderTopColor: '#000000',
    paddingTop: 6,
  },
});

const formatDate = (dateString) => {
  if (!dateString) return '';
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  } catch { return String(dateString); }
};

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') return '';
  return String(val);
};

const safeArray = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(v => v !== null && v !== undefined && v !== '');
  return [];
};

const hasValue = (val) => {
  if (val === null || val === undefined || val === '') return false;
  if (typeof val === 'number') return true;
  if (typeof val === 'boolean') return true;
  if (typeof val === 'string') return val.trim() !== '';
  return true;
};

// parseSubtitleItems: splits "Label1: value1. Label2: value2." into [{label, value, isGeneric}]
const parseSubtitleItems = (text) => {
  if (!text) return [];
  const segments = text.split(/(?<!(?:Dr|Mr|Mrs|Ms|Jr|Sr|St|vs|etc)\.)(?<=\.)\s+(?=[A-Z])/).filter(s => s.trim());
  if (segments.length === 0) return [];
  return segments.map((segment) => {
    const colonMatch = segment.match(/^([^:]+?):\s*(.+)$/s);
    if (colonMatch && colonMatch[1].length < 80) {
      return { label: colonMatch[1].trim(), value: colonMatch[2].trim().replace(/\.$/, ''), isGeneric: false };
    }
    return { label: '', value: segment.trim().replace(/\.$/, ''), isGeneric: true };
  });
};

/* Title INSIDE the View; @react-pdf v4 BOOLEAN wrap (undefined === false on v4).
   <=8 rows → atomic wrap={false} (moves whole block to next page → no orphan).
   >8 rows → glue title+first row in a wrap={false} sub-View, rest flow → orphan-proof, no overprint. */
const Block = (title, rows) => {
  if (!rows.length) return null;
  if (rows.length <= 8) {
    return (
      <View style={styles.section} wrap={false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {rows}
      </View>
    );
  }
  return (
    <View style={styles.section} wrap>
      <View wrap={false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {rows[0]}
      </View>
      {rows.slice(1)}
    </View>
  );
};

const BloodGlucoseMonitoringDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (Array.isArray(templateData)) return templateData;
    if (templateData?.blood_glucose_monitoring) return templateData.blood_glucose_monitoring;
    if (templateData?.documentData) {
      const docData = templateData.documentData;
      if (Array.isArray(docData)) return docData;
      if (docData?.blood_glucose_monitoring) return docData.blood_glucose_monitoring;
      return [docData];
    }
    if (templateData && typeof templateData === 'object') return [templateData];
    return [];
  }, [templateData]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Blood Glucose Monitoring</Text>
          </View>
          <Text style={styles.noData}>No blood glucose monitoring data available</Text>
        </Page>
      </Document>
    );
  }

  // Field section — each field is a plain block (label + numbered value); box-free.
  const renderFieldSection = (title, entries) => {
    const valid = entries
      .filter(([, val]) => typeof val === 'boolean' ? true : hasValue(val))
      .map(([label, val]) => [label, typeof val === 'boolean' ? (val ? 'Yes' : 'No') : safeString(val)]);
    if (valid.length === 0) return null;
    const rows = valid.map(([label, val], i) => {
      const subItems = parseSubtitleItems(val);
      if (subItems.length > 1) {
        return (
          <View key={i} style={styles.fieldBlock} wrap={false}>
            <Text style={styles.fieldLabel}>{label}</Text>
            {subItems.map((item, j) => (
              <View key={j}>
                {!item.isGeneric && <Text style={styles.subLabel}>{item.label}</Text>}
                <View style={styles.numberedItem}>
                  <Text style={styles.itemNumber}>{j + 1}.</Text>
                  <Text style={styles.itemContent}>{item.value}</Text>
                </View>
              </View>
            ))}
          </View>
        );
      }
      return (
        <View key={i} style={styles.fieldBlock} wrap={false}>
          <Text style={styles.fieldLabel}>{label}</Text>
          <View style={styles.numberedItem}>
            <Text style={styles.itemNumber}>1.</Text>
            <Text style={styles.itemContent}>{val}</Text>
          </View>
        </View>
      );
    });
    return Block(title, rows);
  };

  // Text section — each parsed item is a plain block; box-free.
  const renderTextSection = (title, text) => {
    if (!hasValue(text)) return null;
    const items = parseSubtitleItems(text);
    if (items.length === 0) return null;
    const rows = items.map((item, i) => (
      <View key={i} style={styles.fieldBlock} wrap={false}>
        {!item.isGeneric && <Text style={styles.fieldLabel}>{item.label}</Text>}
        <View style={styles.numberedItem}>
          <Text style={styles.itemNumber}>{i + 1}.</Text>
          <Text style={styles.itemContent}>{item.value}</Text>
        </View>
      </View>
    ));
    return Block(title, rows);
  };

  const renderPatternsSection = (record) => {
    const patterns = safeArray(record.patterns);
    if (patterns.length === 0) return null;
    const rows = patterns.map((p, i) => (
      <View key={i} style={styles.fieldBlock} wrap={false}>
        <View style={styles.numberedItem}>
          <Text style={styles.itemNumber}>{i + 1}.</Text>
          <Text style={styles.itemContent}>{safeString(p)}</Text>
        </View>
      </View>
    ));
    return Block('Glucose Patterns', rows);
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Blood Glucose Monitoring</Text>
          <Text style={styles.documentSubtitle}>Clinical Monitoring Report</Text>
        </View>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            {/* Record Header */}
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>Record {idx + 1}</Text>
              {(record.date || record.createdAt) && (
                <Text style={styles.recordMeta}>Date: {formatDate(record.date || record.createdAt)}</Text>
              )}
            </View>

            {/* 0. Provider Information */}
            {renderFieldSection('Provider Information', [
              ['Provider', record.provider],
              ['Facility', record.facility],
              ['Review Period', record.reviewPeriod],
            ])}

            {/* 1. Monitoring Details */}
            {renderFieldSection('Monitoring Details', [
              ['Monitoring Method', record.monitoringMethod],
              ['Device Type', record.deviceType],
              ['Frequency', record.frequency],
            ])}

            {/* 2. Glucose Metrics */}
            {renderFieldSection('Glucose Metrics', [
              ['Average Glucose', record.averageGlucose],
              ['Time In Range', record.timeInRange],
              ['Time Above Range', record.timeAboveRange],
              ['Time Below Range', record.timeBelowRange],
              ['Glucose Variability', record.glucoseVariability],
            ])}

            {/* 3. Glucose Patterns */}
            {renderPatternsSection(record)}

            {/* 4. Clinical Events */}
            {renderFieldSection('Clinical Events', [
              ['Hypoglycemic Events', record.hypoglycemicEvents],
              ['Adherence', record.adherence],
            ])}

            {/* 5. Adjustments */}
            {renderTextSection('Adjustments', record.adjustments)}

            {/* 6. Notes */}
            {renderTextSection('Notes', record.notes)}
          </View>
        ))}

        <Text style={styles.footer}>Confidential Medical Document</Text>
      </Page>
    </Document>
  );
};

export default BloodGlucoseMonitoringDocumentPDFTemplate;
