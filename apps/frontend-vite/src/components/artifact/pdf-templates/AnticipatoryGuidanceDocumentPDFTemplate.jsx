import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 14,
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  header: {
    marginBottom: 24,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
  },
  documentTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  recordCard: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
  },
  recordTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 12,
    color: '#000000',
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    marginBottom: 8,
    color: '#000000',
    borderBottomWidth: 0.5,
    borderBottomColor: '#999999',
    paddingBottom: 4,
  },
  fieldBlock: {
    marginBottom: 8,
    paddingLeft: 8,
  },
  fieldSubtitle: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
    color: '#333333',
  },
  fieldValue: {
    fontSize: 14,
    lineHeight: 1.5,
    marginBottom: 4,
    color: '#000000',
  },
  listItem: {
    fontSize: 14,
    paddingLeft: 12,
    marginBottom: 4,
    lineHeight: 1.5,
    color: '#000000',
  },
  contentText: {
    fontSize: 14,
    marginBottom: 6,
    paddingLeft: 8,
    lineHeight: 1.5,
    color: '#000000',
  },
  subLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginTop: 4,
    marginBottom: 1,
    color: '#333333',
  },
  nested: {
    marginLeft: 10,
    paddingLeft: 8,
    borderLeftWidth: 1,
    borderLeftColor: '#000000',
    marginTop: 2,
  },
});

/* recursive object node: label = bold heading; value = plain line below (B&W only) */
const renderObjectNode = (label, value, keyPath, depth) => {
  if (isEmptyDeep(value)) return null;
  const LabelTag = depth > 0 ? styles.subLabel : styles.fieldSubtitle;
  if (isScalar(value)) {
    return (
      <View key={keyPath}>
        {label ? <Text style={LabelTag}>{label}</Text> : null}
        <Text style={styles.fieldValue}>{fmtScalar(value)}</Text>
      </View>
    );
  }
  const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  return (
    <View key={keyPath}>
      {label ? <Text style={LabelTag}>{label}</Text> : null}
      <View style={label ? styles.nested : undefined}>{entries.map(([k, v]) => renderObjectNode(humanizeKey(k), v, `${keyPath}-${k}`, depth + 1))}</View>
    </View>
  );
};

const hasValue = (val) => {
  if (val === null || val === undefined) return false;
  if (typeof val === 'string') return val.trim().length > 0;
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === 'object') return Object.keys(val).length > 0;
  return true;
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

const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };

const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/* count rows for wrap heuristic (Rule #74) */
const countRows = (val) => {
  if (isEmptyDeep(val)) return 0;
  if (isScalar(val)) return 1;
  if (Array.isArray(val)) { let n = 0; val.filter(x => !isEmptyDeep(x)).forEach(it => { n += isScalar(it) ? 1 : 1 + countRows(it); }); return n; }
  let n = 0; Object.values(val).forEach(sub => { if (!isEmptyDeep(sub)) n += isScalar(sub) ? 2 : 1 + countRows(sub); }); return n;
};

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (Array.isArray(val)) return val.filter(Boolean).join(', ');
  return String(val);
};

const formatDate = (dateVal) => {
  if (!dateVal) return '';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return String(dateVal);
  }
};

const AnticipatoryGuidanceDocumentPDFTemplate = ({ document: docProp, data }) => {
  const templateData = docProp || data;

  let records = [];
  if (Array.isArray(templateData)) {
    records = templateData.flatMap(item => {
      if (item.anticipatory_guidance) return item.anticipatory_guidance;
      if (item.records) return item.records;
      return item;
    });
  } else if (templateData?.anticipatory_guidance) {
    records = Array.isArray(templateData.anticipatory_guidance) ? templateData.anticipatory_guidance : [templateData.anticipatory_guidance];
  } else if (templateData?.documentData?.anticipatory_guidance) {
    records = Array.isArray(templateData.documentData.anticipatory_guidance) ? templateData.documentData.anticipatory_guidance : [templateData.documentData.anticipatory_guidance];
  } else if (templateData?.documentData) {
    records = Array.isArray(templateData.documentData) ? templateData.documentData : [templateData.documentData];
  } else if (templateData && typeof templateData === 'object') {
    records = [templateData];
  }
  records = records.filter(r => r && Object.keys(r).length > 0);

  const renderArraySection = (title, arr) => {
    if (!arr || !Array.isArray(arr) || arr.length === 0) return null;
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {arr.map((item, i) => (
          <Text key={i} style={styles.listItem}>
            {i + 1}. {safeString(item)}
          </Text>
        ))}
      </View>
    );
  };

  /* Results — recursive OBJECT. Rule #74: section title INSIDE the wrap-gated View;
     gate on total row count (>8 -> flow; <=8 -> wrap={false} keeps block intact). */
  const renderResultsSection = (title, obj) => {
    if (isEmptyDeep(obj) || isScalar(obj)) return null;
    const entries = Object.entries(obj).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    const rows = countRows(obj);
    return (
      <View style={styles.section} wrap={rows > 8 ? undefined : false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {entries.map(([k, v]) => (
          <View key={k} style={styles.fieldBlock}>
            {renderObjectNode(humanizeKey(k), v, k, 0)}
          </View>
        ))}
      </View>
    );
  };

  const renderTextSection = (title, text) => {
    if (!hasValue(text)) return null;
    const str = safeString(text);
    const sentences = str.split(/(?<=[.;])\s+/).map(s => s.trim()).filter(Boolean);
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {sentences.length > 1 ? (
          sentences.map((s, i) => (
            <Text key={i} style={styles.listItem}>{i + 1}. {s}</Text>
          ))
        ) : (
          <Text style={styles.contentText}>{str}</Text>
        )}
      </View>
    );
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.documentTitle}>Anticipatory Guidance</Text>
        </View>

        {records.map((record, idx) => {
          const sleep = record.sleep;

          return (
            <View key={idx} style={styles.recordCard}>
              <Text style={styles.recordTitle}>Anticipatory Guidance {idx + 1}</Text>

              {/* Guidance Information */}
              {(hasValue(record.date) || hasValue(record.provider) || hasValue(record.facility)) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Guidance Information</Text>
                  {hasValue(record.date) && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Date</Text>
                      <Text style={styles.fieldValue}>{formatDate(record.date)}</Text>
                    </View>
                  )}
                  {hasValue(record.provider) && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Provider</Text>
                      <Text style={styles.fieldValue}>{safeString(record.provider)}</Text>
                    </View>
                  )}
                  {hasValue(record.facility) && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Facility</Text>
                      <Text style={styles.fieldValue}>{safeString(record.facility)}</Text>
                    </View>
                  )}
                </View>
              )}

              {renderArraySection('Nutrition', record.nutrition)}
              {renderArraySection('Physical Activity', record.physicalActivity)}
              {renderTextSection('Screen Time', record.screenTime)}

              {/* Sleep */}
              {sleep && (hasValue(sleep.hoursRecommended) || hasValue(sleep.currentPattern) || (Array.isArray(sleep.concerns) && sleep.concerns.length > 0)) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Sleep</Text>
                  {hasValue(sleep.hoursRecommended) && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Hours Recommended</Text>
                      <Text style={styles.fieldValue}>{safeString(sleep.hoursRecommended)}</Text>
                    </View>
                  )}
                  {hasValue(sleep.currentPattern) && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Current Pattern</Text>
                      <Text style={styles.fieldValue}>{safeString(sleep.currentPattern)}</Text>
                    </View>
                  )}
                  {Array.isArray(sleep.concerns) && sleep.concerns.length > 0 && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Concerns</Text>
                      {sleep.concerns.map((item, i) => (
                        <Text key={i} style={styles.listItem}>
                          {i + 1}. {safeString(item)}
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {renderArraySection('Safety', record.safety)}
              {renderArraySection('Dental Care', record.dental)}
              {renderArraySection('Social Development', record.socialDevelopment)}
              {renderTextSection('Toileting', record.toileting)}
              {renderArraySection('Discipline', record.discipline)}
              {renderTextSection('Findings', record.findings)}
              {renderTextSection('Assessment', record.assessment)}
              {renderTextSection('Plan', record.plan)}
              {renderResultsSection('Results', record.results)}
              {renderArraySection('Recommendations', record.recommendations)}
              {renderTextSection('Notes', record.notes)}
              {renderTextSection('Status', record.status)}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default AnticipatoryGuidanceDocumentPDFTemplate;
