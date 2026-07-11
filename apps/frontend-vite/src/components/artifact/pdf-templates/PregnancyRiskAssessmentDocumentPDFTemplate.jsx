import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 12,
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  documentHeader: {
    marginBottom: 16,
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    paddingBottom: 10,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  recordContainer: {
    marginBottom: 20,
  },
  recordHeader: {
    marginBottom: 8,
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderWidth: 1,
    borderColor: '#000000',
  },
  recordTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textTransform: 'uppercase',
  },
  recordMeta: {
    fontSize: 10,
    color: '#333333',
    marginTop: 4,
  },
  riskBadge: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginTop: 4,
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textTransform: 'uppercase',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    paddingBottom: 2,
    marginBottom: 6,
  },
  fieldRow: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingLeft: 8,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    width: 140,
  },
  fieldContent: {
    fontSize: 12,
    color: '#000000',
    flex: 1,
  },
  contentText: {
    fontSize: 12,
    color: '#000000',
    lineHeight: 1.4,
    paddingLeft: 8,
  },
  listItem: {
    fontSize: 12,
    color: '#000000',
    paddingLeft: 12,
    marginBottom: 3,
  },
  nestedHeader: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginTop: 6,
    marginBottom: 4,
    paddingLeft: 4,
    textTransform: 'uppercase',
  },
  nestedItem: {
    fontSize: 12,
    color: '#000000',
    paddingLeft: 16,
    marginBottom: 2,
  },
  subLabel: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginTop: 4,
    marginBottom: 1,
    paddingLeft: 8,
  },
  nested: {
    marginLeft: 16,
    paddingLeft: 8,
    borderLeftWidth: 1,
    borderLeftColor: '#000000',
    marginTop: 2,
  },
  recDate: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginTop: 4,
    paddingLeft: 8,
  },
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
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };

/* recursive object node: label = bold heading; value = plain line below */
const renderObjectNode = (label, value, keyPath, depth) => {
  if (isEmptyDeep(value)) return null;
  const LabelTag = depth > 0 ? styles.subLabel : styles.nestedHeader;
  if (isScalar(value)) {
    return (
      <View key={keyPath}>
        {label ? <Text style={LabelTag}>{label}</Text> : null}
        <Text style={styles.nestedItem}>{fmtScalar(value)}</Text>
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

/* count rows for the wrap heuristic */
const countRows = (val) => {
  if (isEmptyDeep(val)) return 0;
  if (isScalar(val)) return 1;
  if (Array.isArray(val)) { let n = 0; val.filter(x => !isEmptyDeep(x)).forEach(it => { n += isScalar(it) ? 1 : 1 + countRows(it); }); return n; }
  let n = 0; Object.values(val).forEach(sub => { if (!isEmptyDeep(sub)) n += isScalar(sub) ? 2 : 1 + countRows(sub); }); return n;
};

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try {
    const dateStr = dateValue.$date || dateValue;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return String(dateValue);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return String(dateValue);
  }
};

const PregnancyRiskAssessmentDocumentPDFTemplate = ({ document: data }) => {
  // Data unwrapping
  let rawRecords = [];
  if (Array.isArray(data)) {
    if (data.length > 0 && data[0].records) {
      rawRecords = data[0].records;
    } else {
      rawRecords = data;
    }
  } else if (data?.records) {
    rawRecords = data.records;
  } else if (data) {
    rawRecords = [data];
  }

  // Clean records - remove injected underscore-prefixed fields from JSX filtering
  const records = rawRecords.map(record => {
    if (!record || typeof record !== 'object') return record;
    const cleanRecord = {};
    for (const key of Object.keys(record)) {
      if (!key.startsWith('_')) {
        cleanRecord[key] = record[key];
      }
    }
    return cleanRecord;
  });

  // Safety check for empty records
  if (!Array.isArray(records) || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.title}>Pregnancy Risk Assessment</Text>
          </View>
          <Text style={styles.contentText}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.title}>Pregnancy Risk Assessment</Text>
        </View>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} minPresenceAhead={150}>
            <View style={styles.recordHeader}>
              <Text style={styles.recordTitle}>Pregnancy Risk Assessment {idx + 1}</Text>
              {record.date && (
                <Text style={styles.recordMeta}>{formatDate(record.date)}</Text>
              )}
              {record.riskLevel && (
                <Text style={styles.riskBadge}>Risk Level: {String(record.riskLevel).toUpperCase()}</Text>
              )}
            </View>

            {/* Clinical Information Section */}
            {(record.date || record.provider || record.facility) && (
              <View style={styles.section} minPresenceAhead={80} wrap={false}>
                <Text style={styles.sectionTitle}>Clinical Information</Text>
                {record.date && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Date:</Text>
                    <Text style={styles.fieldContent}>{formatDate(record.date)}</Text>
                  </View>
                )}
                {record.provider && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Provider:</Text>
                    <Text style={styles.fieldContent}>{String(record.provider)}</Text>
                  </View>
                )}
                {record.facility && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Facility:</Text>
                    <Text style={styles.fieldContent}>{String(record.facility)}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Risk Assessment Section */}
            {(record.riskLevel || (record.riskFactors && record.riskFactors.length > 0)) && (
              <View style={styles.section} minPresenceAhead={80} wrap={false}>
                <Text style={styles.sectionTitle}>Risk Assessment</Text>
                {record.riskLevel && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Risk Level:</Text>
                    <Text style={styles.fieldContent}>{String(record.riskLevel).toUpperCase()}</Text>
                  </View>
                )}
                {record.riskFactors && record.riskFactors.length > 0 && (
                  <View>
                    <Text style={styles.nestedHeader}>Risk Factors</Text>
                    {record.riskFactors.map((factor, fIdx) => (
                      <Text key={fIdx} style={styles.listItem}>{fIdx + 1}. {String(factor || '')}</Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Consultations Needed Section */}
            {record.consultationsNeeded && record.consultationsNeeded.length > 0 && (
              <View style={styles.section} minPresenceAhead={80} wrap={false}>
                <Text style={styles.sectionTitle}>Consultations Needed</Text>
                {record.consultationsNeeded.map((consult, cIdx) => (
                  <Text key={cIdx} style={styles.listItem}>{cIdx + 1}. {String(consult || '')}</Text>
                ))}
              </View>
            )}

            {/* Surveillance Plan Section */}
            {(record.surveillancePlan || record.hospitalOfDelivery || (record.antenatalTesting && record.antenatalTesting.length > 0)) && (
              <View style={styles.section} minPresenceAhead={150} wrap={false}>
                <Text style={styles.sectionTitle}>Surveillance Plan</Text>
                {record.surveillancePlan && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Plan:</Text>
                    <Text style={styles.fieldContent}>{String(record.surveillancePlan)}</Text>
                  </View>
                )}
                {record.hospitalOfDelivery && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Hospital:</Text>
                    <Text style={styles.fieldContent}>{String(record.hospitalOfDelivery)}</Text>
                  </View>
                )}
                {record.antenatalTesting && record.antenatalTesting.length > 0 && (
                  <View>
                    <Text style={styles.nestedHeader}>Antenatal Testing</Text>
                    {record.antenatalTesting.map((test, tIdx) => (
                      <Text key={tIdx} style={styles.nestedItem}>
                        {tIdx + 1}. {String(test?.test || test?.type || '')}: {String(test?.frequency || '')}{test?.startingAt ? ` (starting at ${String(test.startingAt)})` : ''}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Findings Section */}
            {record.findings && (
              <View style={styles.section} minPresenceAhead={80} wrap={false}>
                <Text style={styles.sectionTitle}>Findings</Text>
                <Text style={styles.contentText}>{String(record.findings)}</Text>
              </View>
            )}

            {/* Assessment Section */}
            {record.assessment && (
              <View style={styles.section} minPresenceAhead={80} wrap={false}>
                <Text style={styles.sectionTitle}>Assessment</Text>
                <Text style={styles.contentText}>{String(record.assessment)}</Text>
              </View>
            )}

            {/* Plan Section */}
            {record.plan && (
              <View style={styles.section} minPresenceAhead={80} wrap={false}>
                <Text style={styles.sectionTitle}>Plan</Text>
                <Text style={styles.contentText}>{String(record.plan)}</Text>
              </View>
            )}

            {/* Results Section (recursive object) */}
            {!isEmptyDeep(record.results) && (() => {
              const entries = Object.entries(record.results).filter(([, v]) => !isEmptyDeep(v));
              if (entries.length === 0) return null;
              const rows = countRows(record.results);
              return (
                <View style={styles.section} minPresenceAhead={80} wrap={rows > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Results</Text>
                  {entries.map(([k, v]) => renderObjectNode(humanizeKey(k), v, `results-${k}`, 1))}
                </View>
              );
            })()}

            {/* Recommendations Section (array of {recommendation, date}, date-grouped) */}
            {Array.isArray(record.recommendations) && record.recommendations.filter(r => !isEmptyDeep(r)).length > 0 && (() => {
              const recs = record.recommendations.filter(r => !isEmptyDeep(r));
              const groups = [];
              recs.forEach((r) => { const d = (r?.date || '').trim(); const last = groups[groups.length - 1]; if (last && last.date === d) last.items.push(r); else groups.push({ date: d, items: [r] }); });
              return (
                <View style={styles.section} minPresenceAhead={80} wrap={recs.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Recommendations</Text>
                  {groups.map((group, gIdx) => (
                    <View key={gIdx}>
                      {group.date ? <Text style={styles.recDate}>{group.date}</Text> : null}
                      {group.items.map((r, i) => (
                        <Text key={i} style={styles.listItem}>{i + 1}. {String(r?.recommendation || '').trim()}</Text>
                      ))}
                    </View>
                  ))}
                </View>
              );
            })()}

            {/* Notes Section */}
            {record.notes && (
              <View style={styles.section} minPresenceAhead={80} wrap={false}>
                <Text style={styles.sectionTitle}>Notes</Text>
                <Text style={styles.contentText}>{String(record.notes)}</Text>
              </View>
            )}

            {/* Status Section */}
            {record.status && (
              <View style={styles.section} minPresenceAhead={80} wrap={false}>
                <Text style={styles.sectionTitle}>Status</Text>
                <Text style={styles.contentText}>{String(record.status)}</Text>
              </View>
            )}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PregnancyRiskAssessmentDocumentPDFTemplate;
