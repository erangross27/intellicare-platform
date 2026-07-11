import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// PDF Styles - November 2025 Standards
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 11,
    backgroundColor: '#ffffff'
  },
  header: {
    marginBottom: 20,
    borderBottom: '2px solid #333333',
    paddingBottom: 10
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  recordContainer: {
    marginBottom: 20,
    paddingBottom: 15,
    borderBottom: '1px solid #cccccc'
  },
  recordHeader: {
    marginBottom: 10,
    paddingBottom: 8,
    borderBottom: '1px solid #333333'
  },
  recordTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 5
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5
  },
  metaText: {
    fontSize: 10,
    color: '#666666'
  },
  riskBadge: {
    fontSize: 10,
    fontWeight: 'bold',
    padding: '2 6',
    borderRadius: 3
  },
  riskLow: {
    color: '#666666'
  },
  riskModerate: {
    color: '#4d4d4d'
  },
  riskHigh: {
    color: '#333333'
  },
  riskVeryHigh: {
    color: '#1a1a1a'
  },
  sectionContainer: {
    marginBottom: 12
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333333',
    textTransform: 'uppercase',
    marginBottom: 6,
    borderBottom: '1px solid #eeeeee',
    paddingBottom: 3
  },
  subsectionContainer: {
    marginBottom: 8,
    marginLeft: 10,
    paddingLeft: 8,
    borderLeft: '2px solid #999999'
  },
  subsectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#333333',
    textTransform: 'uppercase',
    marginBottom: 4
  },
  contentText: {
    fontSize: 11,
    color: '#333333',
    lineHeight: 1.5,
    textAlign: 'justify'
  },
  fieldRow: {
    flexDirection: 'row',
    marginBottom: 4
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#666666',
    width: 150,
    textTransform: 'uppercase'
  },
  fieldValue: {
    fontSize: 11,
    color: '#333333',
    flex: 1
  },
  itemText: {
    fontSize: 11,
    color: '#333333',
    lineHeight: 1.4,
    marginBottom: 2,
    marginLeft: 10
  },
  referralRow: {
    fontSize: 11,
    color: '#333333',
    marginBottom: 4,
    marginLeft: 10
  }
});

// Format date helper
const formatDate = (date) => {
  if (!date) return '';
  try {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (e) {
    return String(date);
  }
};

// Format boolean helper
const formatBoolean = (value) => {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return '';
};

// Format field label from camelCase
const formatFieldLabel = (key) => {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
};

// Get risk style
const getRiskStyle = (risk) => {
  if (!risk) return styles.metaText;
  const riskLower = risk.toLowerCase();
  if (riskLower.includes('very high')) return [styles.riskBadge, styles.riskVeryHigh];
  if (riskLower.includes('high')) return [styles.riskBadge, styles.riskHigh];
  if (riskLower.includes('moderate')) return [styles.riskBadge, styles.riskModerate];
  if (riskLower.includes('low')) return [styles.riskBadge, styles.riskLow];
  return styles.metaText;
};

// Render a field row
const RenderField = ({ label, value }) => {
  if (!value && value !== false) return null;
  const displayValue = typeof value === 'boolean' ? formatBoolean(value) : value;

  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}:</Text>
      <Text style={styles.fieldValue}>{displayValue}</Text>
    </View>
  );
};

// Render object section with fields - wrap={false} keeps title with first content
const RenderObjectSection = ({ title, obj }) => {
  if (!obj || Object.keys(obj).length === 0) return null;

  const fields = [];
  const arrays = [];

  Object.entries(obj).forEach(([key, value]) => {
    if (value === null || value === undefined) return;

    if (Array.isArray(value) && value.length > 0) {
      arrays.push({ key, value });
    } else if (typeof value === 'boolean' || (typeof value === 'string' && value.trim())) {
      fields.push({ key, value });
    }
  });

  if (fields.length === 0 && arrays.length === 0) return null;

  return (
    <View style={styles.sectionContainer}>
      {/* Keep title with first field together */}
      <View wrap={false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {fields.length > 0 && (
          <RenderField
            label={formatFieldLabel(fields[0].key)}
            value={fields[0].value}
          />
        )}
      </View>

      {/* Remaining fields */}
      {fields.slice(1).map((field, idx) => (
        <RenderField
          key={idx}
          label={formatFieldLabel(field.key)}
          value={field.value}
        />
      ))}

      {/* Arrays as subsections */}
      {arrays.map((arr, idx) => (
        <View key={idx} style={styles.subsectionContainer}>
          <Text style={styles.subsectionTitle}>{formatFieldLabel(arr.key)}</Text>
          {arr.value.map((item, i) => (
            <Text key={i} style={styles.itemText}>
              • {typeof item === 'string' ? item : JSON.stringify(item)}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
};

// Recursively render an object's leaves/arrays/nested objects as rows (used by RenderRecursiveObjectSection)
const RenderObjectRows = ({ obj, indent = 0 }) => {
  if (!obj || typeof obj !== 'object') return null;
  const rows = [];
  Object.entries(obj).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    const label = formatFieldLabel(key);
    if (Array.isArray(value)) {
      if (value.length === 0) return;
      rows.push(
        <View key={key} style={{ marginLeft: indent * 10 }}>
          <Text style={styles.fieldLabel}>{label}:</Text>
          {value.map((item, i) => (
            <Text key={i} style={styles.itemText}>
              • {typeof item === 'string' ? item : JSON.stringify(item)}
            </Text>
          ))}
        </View>
      );
    } else if (typeof value === 'object') {
      rows.push(
        <View key={key} style={{ marginLeft: indent * 10, marginBottom: 2 }}>
          <Text style={styles.subsectionTitle}>{label}</Text>
          <RenderObjectRows obj={value} indent={indent + 1} />
        </View>
      );
    } else {
      const displayValue = typeof value === 'boolean' ? formatBoolean(value) : String(value);
      rows.push(
        <View key={key} style={[styles.fieldRow, { marginLeft: indent * 10 }]}>
          <Text style={styles.fieldLabel}>{label}:</Text>
          <Text style={styles.fieldValue}>{displayValue}</Text>
        </View>
      );
    }
  });
  return rows.length > 0 ? <>{rows}</> : null;
};

// Render a free-form object section recursively (utilities, language, employment).
// Rule #74: glue title + first row with wrap={false} when small (<=8 leaf rows), else flow.
const RenderRecursiveObjectSection = ({ title, obj }) => {
  if (!obj || typeof obj !== 'object' || Object.keys(obj).length === 0) return null;
  const entries = Object.entries(obj).filter(([, v]) => v !== null && v !== undefined && v !== '');
  if (entries.length === 0) return null;
  const countLeaves = (o) => Object.values(o).reduce((acc, v) => {
    if (v === null || v === undefined || v === '') return acc;
    if (Array.isArray(v)) return acc + v.length;
    if (typeof v === 'object') return acc + countLeaves(v);
    return acc + 1;
  }, 0);
  const leafCount = countLeaves(obj);
  return (
    <View style={styles.sectionContainer} wrap={leafCount > 8 ? undefined : false}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <RenderObjectRows obj={obj} />
    </View>
  );
};

// Render array section - wrap={false} keeps title with first item
const RenderArraySection = ({ title, items, renderItem }) => {
  if (!items || !Array.isArray(items) || items.length === 0) return null;

  return (
    <View style={styles.sectionContainer}>
      {/* Keep title + first item together */}
      <View wrap={false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {renderItem ? renderItem(items[0], 0) : (
          <Text style={styles.itemText}>• {items[0]}</Text>
        )}
      </View>
      {/* Remaining items flow naturally */}
      {items.slice(1).map((item, idx) => (
        renderItem ? renderItem(item, idx + 1) : (
          <Text key={idx} style={styles.itemText}>• {item}</Text>
        )
      ))}
    </View>
  );
};

const SocialDeterminantsOfHealthDocumentPDFTemplate = ({ data }) => {
  // Handle data unwrapping
  let records = [];
  if (Array.isArray(data)) {
    records = data;
  } else if (data?.social_determinants_of_health) {
    records = Array.isArray(data.social_determinants_of_health) ? data.social_determinants_of_health : [data.social_determinants_of_health];
  } else if (data?.data) {
    records = Array.isArray(data.data) ? data.data : [data.data];
  } else if (data) {
    records = [data];
  }

  // Filter out invalid records
  records = records.filter(r => r && typeof r === 'object');

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Social Determinants of Health</Text>
        </View>

        {/* Records */}
        {records.map((record, idx) => (
          <View key={idx} style={idx === records.length - 1 ? { marginBottom: 0 } : styles.recordContainer}>
            {/* Record Header */}
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>
                SDOH Assessment #{idx + 1}
              </Text>
              <View style={styles.metaRow}>
                {record.overallRiskAssessment && (
                  <Text style={getRiskStyle(record.overallRiskAssessment)}>
                    Risk: {record.overallRiskAssessment}
                  </Text>
                )}
                {record.date && (
                  <Text style={styles.metaText}>Date: {formatDate(record.date)}</Text>
                )}
                {record.assessmentDate && (
                  <Text style={styles.metaText}>Assessment Date: {formatDate(record.assessmentDate)}</Text>
                )}
              </View>
              <View style={styles.metaRow}>
                {record.provider && (
                  <Text style={styles.metaText}>Provider: {record.provider}</Text>
                )}
                {record.facility && (
                  <Text style={styles.metaText}>Facility: {record.facility}</Text>
                )}
              </View>
            </View>

            {/* Housing Status */}
            <RenderObjectSection title="Housing Status" obj={record.housingStatus} />

            {/* Food Security */}
            <RenderObjectSection title="Food Security" obj={record.foodSecurity} />

            {/* Financial Barriers */}
            <RenderObjectSection title="Financial Barriers" obj={record.financialBarriers} />

            {/* Transportation */}
            <RenderObjectSection title="Transportation" obj={record.transportation} />

            {/* Insurance */}
            <RenderObjectSection title="Insurance" obj={record.insurance} />

            {/* Social Support */}
            <RenderObjectSection title="Social Support" obj={record.socialSupport} />

            {/* Health Literacy (includes nested educationLevel) */}
            <RenderObjectSection title="Health Literacy" obj={record.healthLiteracy} />

            {/* Education Level - top-level string (mirrors JSX editable field) */}
            {(record.educationLevel || record.healthLiteracy?.educationLevel) && (
              <View style={styles.sectionContainer} wrap={false}>
                <Text style={styles.sectionTitle}>Education Level</Text>
                <RenderField label="Education Level" value={record.educationLevel || record.healthLiteracy?.educationLevel} />
              </View>
            )}

            {/* Substance Use Barriers */}
            <RenderObjectSection title="Substance Use Barriers" obj={record.substanceUseBarriers} />

            {/* Legal Barriers */}
            <RenderObjectSection title="Legal Barriers" obj={record.legalBarriers} />

            {/* Utilities - free-form object */}
            <RenderRecursiveObjectSection title="Utilities" obj={record.utilities} />

            {/* Language - free-form object */}
            <RenderRecursiveObjectSection title="Language" obj={record.language} />

            {/* Employment - free-form object */}
            <RenderRecursiveObjectSection title="Employment" obj={record.employment} />

            {/* Referrals Made - sorted by priority then alphabetically */}
            {record.referralsMade && record.referralsMade.length > 0 && (() => {
              const priorityOrder = { urgent: 0, high: 1, medium: 2, routine: 3 };
              const sortedReferrals = [...record.referralsMade].sort((a, b) => {
                const aPriority = priorityOrder[(a.priority || '').toLowerCase()] ?? 4;
                const bPriority = priorityOrder[(b.priority || '').toLowerCase()] ?? 4;
                if (aPriority !== bPriority) return aPriority - bPriority;
                return (a.service || '').localeCompare(b.service || '');
              });
              return (
                <RenderArraySection
                  title="Referrals Made"
                  items={sortedReferrals}
                  renderItem={(ref, i) => (
                    <View key={i} style={{ marginBottom: 6 }}>
                      <Text style={[styles.referralRow, { fontWeight: 'bold' }]}>
                        {ref.service || 'Unknown Service'}
                        {ref.priority ? ` [${ref.priority.toUpperCase()}]` : ''}
                      </Text>
                      {ref.status && (
                        <Text style={[styles.referralRow, { marginLeft: 10 }]}>
                          {ref.status}
                        </Text>
                      )}
                    </View>
                  )}
                />
              );
            })()}

            {/* Discharge Barriers */}
            <RenderArraySection
              title="Discharge Barriers"
              items={record.dischargeBarriers}
            />

            {/* Interventions - array or string */}
            {Array.isArray(record.interventions) && record.interventions.length > 0 && (
              <RenderArraySection
                title="Interventions"
                items={record.interventions}
                renderItem={(item, i) => (
                  <Text key={i} style={styles.itemText}>
                    • {typeof item === 'string' ? item : JSON.stringify(item)}
                  </Text>
                )}
              />
            )}
            {typeof record.interventions === 'string' && record.interventions.trim() && (
              <View style={styles.sectionContainer} wrap={false}>
                <Text style={styles.sectionTitle}>Interventions</Text>
                <Text style={styles.contentText}>{record.interventions}</Text>
              </View>
            )}

            {/* Notes */}
            {record.notes && (
              <View style={styles.sectionContainer} wrap={false}>
                <Text style={styles.sectionTitle}>Notes</Text>
                <Text style={styles.contentText}>{record.notes}</Text>
              </View>
            )}
          </View>
        ))}

      </Page>
    </Document>
  );
};

export default SocialDeterminantsOfHealthDocumentPDFTemplate;
