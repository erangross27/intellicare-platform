import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 12,
    backgroundColor: '#ffffff',
    color: '#000000',
    size: 'LETTER',
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
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    width: 180,
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
});

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

const fmtVal = (v) => {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  return String(v || '');
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

const hasVal = (v) => !isEmptyDeep(v);

const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/* Recursive object -> array of <Text> rows (B&W). depth controls indent. */
const renderObjectRows = (value, depth, keyPrefix) => {
  const rows = [];
  if (isEmptyDeep(value)) return rows;
  Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v], i) => {
    const label = humanizeKey(k);
    const padLeft = 12 + depth * 12;
    if (isScalar(v)) {
      rows.push(
        <View key={`${keyPrefix}-${k}-${i}`} style={[styles.fieldRow, { paddingLeft: padLeft }]}>
          <Text style={styles.fieldLabel}>{label}:</Text>
          <Text style={styles.fieldContent}>{fmtScalar(v)}</Text>
        </View>
      );
    } else {
      rows.push(<Text key={`${keyPrefix}-${k}-h${i}`} style={[styles.nestedHeader, { paddingLeft: padLeft }]}>{label}</Text>);
      rows.push(...renderObjectRows(v, depth + 1, `${keyPrefix}-${k}`));
    }
  });
  return rows;
};

const PostpartumPlanningDocumentPDFTemplate = ({ document: data }) => {
  let rawRecords = [];
  if (Array.isArray(data)) {
    if (data.length > 0 && data[0]?.records) {
      rawRecords = data[0].records;
    } else {
      rawRecords = data;
    }
  } else if (data?.records) {
    rawRecords = data.records;
  } else if (data) {
    rawRecords = [data];
  }

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

  if (!Array.isArray(records) || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.title}>Postpartum Planning</Text>
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
          <Text style={styles.title}>Postpartum Planning</Text>
        </View>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} minPresenceAhead={150}>
            <View style={styles.recordHeader}>
              <Text style={styles.recordTitle}>Postpartum Planning {idx + 1}</Text>
              {record.date && (
                <Text style={styles.recordMeta}>{formatDate(record.date)}</Text>
              )}
            </View>

            {/* Clinical Information */}
            {(hasVal(record.date) || hasVal(record.provider) || hasVal(record.facility) || hasVal(record.status)) && (
              <View style={styles.section} minPresenceAhead={80} wrap={false}>
                <Text style={styles.sectionTitle}>Clinical Information</Text>
                {hasVal(record.date) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Date:</Text>
                    <Text style={styles.fieldContent}>{formatDate(record.date)}</Text>
                  </View>
                )}
                {hasVal(record.provider) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Provider:</Text>
                    <Text style={styles.fieldContent}>{fmtVal(record.provider)}</Text>
                  </View>
                )}
                {hasVal(record.facility) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Facility:</Text>
                    <Text style={styles.fieldContent}>{fmtVal(record.facility)}</Text>
                  </View>
                )}
                {hasVal(record.status) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Status:</Text>
                    <Text style={styles.fieldContent}>{fmtVal(record.status)}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Immediate Postpartum */}
            {(hasVal(record.insulinDiscontinuation) || hasVal(record.pediatricianSelected) || hasVal(record.contraceptionPlan) || hasVal(record.maternityLeave)) && (() => {
              const mlRows = hasVal(record.maternityLeave) ? renderObjectRows(record.maternityLeave, 1, `ml-${idx}`) : [];
              const blockCount = (hasVal(record.insulinDiscontinuation) ? 1 : 0) + (hasVal(record.pediatricianSelected) ? 1 : 0) + (hasVal(record.contraceptionPlan) ? 1 : 0) + mlRows.length + (mlRows.length > 0 ? 1 : 0);
              return (
              <View style={styles.section} minPresenceAhead={80} wrap={blockCount > 8 ? undefined : false}>
                <Text style={styles.sectionTitle}>Immediate Postpartum</Text>
                {hasVal(record.insulinDiscontinuation) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Insulin Discontinuation:</Text>
                    <Text style={styles.fieldContent}>{fmtVal(record.insulinDiscontinuation)}</Text>
                  </View>
                )}
                {hasVal(record.pediatricianSelected) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Pediatrician Selected:</Text>
                    <Text style={styles.fieldContent}>{fmtVal(record.pediatricianSelected)}</Text>
                  </View>
                )}
                {hasVal(record.contraceptionPlan) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Contraception Plan:</Text>
                    <Text style={styles.fieldContent}>{fmtVal(record.contraceptionPlan)}</Text>
                  </View>
                )}
                {mlRows.length > 0 && (
                  <>
                    <Text style={styles.nestedHeader}>Maternity Leave</Text>
                    {mlRows}
                  </>
                )}
              </View>
              );
            })()}

            {/* Glucose Testing */}
            {hasVal(record.glucoseTestingSchedule) && (
              <View style={styles.section} minPresenceAhead={80} wrap={false}>
                <Text style={styles.sectionTitle}>Glucose Testing</Text>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Glucose Testing Schedule:</Text>
                  <Text style={styles.fieldContent}>{fmtVal(record.glucoseTestingSchedule)}</Text>
                </View>
              </View>
            )}

            {/* Breastfeeding Recommendations */}
            {(hasVal(record.breastfeedingRecommendations) || hasVal(record.lactationSupport)) && (
              <View style={styles.section} minPresenceAhead={80} wrap={false}>
                <Text style={styles.sectionTitle}>Breastfeeding Recommendations</Text>
                {Array.isArray(record.breastfeedingRecommendations) && record.breastfeedingRecommendations.length > 0 && (
                  record.breastfeedingRecommendations.map((rec, recIdx) => (
                    <Text key={recIdx} style={styles.listItem}>{recIdx + 1}. {fmtVal(rec)}</Text>
                  ))
                )}
                {hasVal(record.lactationSupport) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Lactation Support:</Text>
                    <Text style={styles.fieldContent}>{fmtVal(record.lactationSupport)}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Support & Preparations */}
            {(hasVal(record.postpartumSupport) || hasVal(record.homePreparations) || hasVal(record.mentalHealthScreening)) && (
              <View style={styles.section} minPresenceAhead={80} wrap={false}>
                <Text style={styles.sectionTitle}>Support & Preparations</Text>
                {Array.isArray(record.postpartumSupport) && record.postpartumSupport.length > 0 && (
                  <>
                    <Text style={styles.nestedHeader}>Postpartum Support</Text>
                    {record.postpartumSupport.map((item, i) => (
                      <Text key={i} style={styles.listItem}>{i + 1}. {fmtVal(item)}</Text>
                    ))}
                  </>
                )}
                {Array.isArray(record.homePreparations) && record.homePreparations.length > 0 && (
                  <>
                    <Text style={styles.nestedHeader}>Home Preparations</Text>
                    {record.homePreparations.map((item, i) => (
                      <Text key={i} style={styles.listItem}>{i + 1}. {fmtVal(item)}</Text>
                    ))}
                  </>
                )}
                {hasVal(record.mentalHealthScreening) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Mental Health Screening:</Text>
                    <Text style={styles.fieldContent}>{fmtVal(record.mentalHealthScreening)}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Risk Reduction */}
            {(hasVal(record.weightManagementPlan) || hasVal(record.exerciseProgram) || hasVal(record.metforminConsideration)) && (
              <View style={styles.section} minPresenceAhead={80} wrap={false}>
                <Text style={styles.sectionTitle}>Risk Reduction</Text>
                {hasVal(record.weightManagementPlan) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Weight Management Plan:</Text>
                    <Text style={styles.fieldContent}>{fmtVal(record.weightManagementPlan)}</Text>
                  </View>
                )}
                {hasVal(record.exerciseProgram) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Exercise Program:</Text>
                    <Text style={styles.fieldContent}>{fmtVal(record.exerciseProgram)}</Text>
                  </View>
                )}
                {hasVal(record.metforminConsideration) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Metformin Consideration:</Text>
                    <Text style={styles.fieldContent}>{fmtVal(record.metforminConsideration)}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Future Pregnancy */}
            {hasVal(record.futurePregnancyCounseling) && (
              <View style={styles.section} minPresenceAhead={80} wrap={false}>
                <Text style={styles.sectionTitle}>Future Pregnancy</Text>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Future Pregnancy Counseling:</Text>
                  <Text style={styles.fieldContent}>{fmtVal(record.futurePregnancyCounseling)}</Text>
                </View>
              </View>
            )}

            {/* Clinical Notes */}
            {hasVal(record.findings) && (
              <View style={styles.section} minPresenceAhead={80} wrap={false}>
                <Text style={styles.sectionTitle}>Findings</Text>
                <Text style={styles.contentText}>{fmtVal(record.findings)}</Text>
              </View>
            )}

            {hasVal(record.assessment) && (
              <View style={styles.section} minPresenceAhead={80} wrap={false}>
                <Text style={styles.sectionTitle}>Assessment</Text>
                <Text style={styles.contentText}>{fmtVal(record.assessment)}</Text>
              </View>
            )}

            {hasVal(record.plan) && (
              <View style={styles.section} minPresenceAhead={80} wrap={false}>
                <Text style={styles.sectionTitle}>Plan</Text>
                <Text style={styles.contentText}>{fmtVal(record.plan)}</Text>
              </View>
            )}

            {/* Recommendations (array of {recommendation, date}) */}
            {Array.isArray(record.recommendations) && record.recommendations.filter(r => !isEmptyDeep(r)).length > 0 && (() => {
              const recs = record.recommendations.filter(r => !isEmptyDeep(r));
              const rows = [];
              let lastDate = null; let n = 1;
              recs.forEach((r, i) => {
                const recText = (r?.recommendation || '').trim();
                const date = (r?.date || '').trim();
                if (date !== lastDate) { if (date) rows.push(<Text key={`d-${i}`} style={styles.nestedHeader}>{date}</Text>); lastDate = date; n = 1; }
                if (recText) rows.push(<Text key={`r-${i}`} style={styles.listItem}>{n++}. {recText}</Text>);
              });
              return (
                <View style={styles.section} minPresenceAhead={80} wrap={rows.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Recommendations</Text>
                  {rows}
                </View>
              );
            })()}

            {/* Results (object) */}
            {hasVal(record.results) && typeof record.results === 'object' && !Array.isArray(record.results) && (() => {
              const rows = renderObjectRows(record.results, 0, `res-${idx}`);
              if (rows.length === 0) return null;
              return (
                <View style={styles.section} minPresenceAhead={80} wrap={rows.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Results</Text>
                  {rows}
                </View>
              );
            })()}

            {hasVal(record.notes) && (
              <View style={styles.section} minPresenceAhead={80} wrap={false}>
                <Text style={styles.sectionTitle}>Notes</Text>
                <Text style={styles.contentText}>{fmtVal(record.notes)}</Text>
              </View>
            )}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PostpartumPlanningDocumentPDFTemplate;
