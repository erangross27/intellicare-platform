import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * PrenatalVisitsDocumentPDFTemplate
 * March 2026 — Helvetica, LETTER size, 20pt title / 12pt content
 * Collection: prenatal_visits
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
  },
  recordCard: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
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
    color: '#1a1a1a',
  },
  fieldBlock: {
    marginBottom: 6,
    paddingLeft: 8,
  },
  fieldSubtitle: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: 12,
    lineHeight: 1.4,
    marginBottom: 4,
  },
  listItem: {
    fontSize: 12,
    paddingLeft: 8,
    marginBottom: 4,
    lineHeight: 1.4,
  },
  chartSection: {
    marginBottom: 14,
    padding: 12,
    backgroundColor: '#e8e8e8',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#999999',
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 8,
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  barLabel: {
    fontSize: 11,
    width: 100,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
  },
  barBackground: {
    flex: 1,
    height: 16,
    backgroundColor: '#cccccc',
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: 8,
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  barValue: {
    fontSize: 11,
    width: 80,
    textAlign: 'right',
  },
  /* nested object (cervicalExam) */
  subLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  nested: {
    marginLeft: 10,
    paddingLeft: 8,
    borderLeftWidth: 1,
    borderLeftColor: '#000000',
    marginTop: 2,
  },
});

const parseGestationalWeeks = (ga) => {
  if (!ga) return null;
  const match = String(ga).match(/(\d+)\s*weeks?/i);
  return match ? parseInt(match[1], 10) : null;
};

const getTrimesterInfo = (weeks) => {
  if (weeks === null) return null;
  if (weeks < 13) return { label: 'First Trimester', color: '#888888' };
  if (weeks < 28) return { label: 'Second Trimester', color: '#666666' };
  if (weeks < 37) return { label: 'Third Trimester', color: '#444444' };
  return { label: 'Full Term', color: '#222222' };
};

/* free-form object recursive helpers (grayscale, B&W) */
const KEY_OVERRIDES = { fhr: 'FHR', afi: 'AFI', efw: 'EFW', us: 'US', bpm: 'BPM', cm: 'cm' };
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];
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
const countRows = (val) => {
  if (isEmptyDeep(val)) return 0;
  if (isScalar(val)) return 1;
  if (Array.isArray(val)) { let n = 0; val.filter(x => !isEmptyDeep(x)).forEach(it => { n += isScalar(it) ? 1 : 1 + countRows(it); }); return n; }
  let n = 0; Object.values(val).forEach(sub => { if (!isEmptyDeep(sub)) n += isScalar(sub) ? 2 : 1 + countRows(sub); }); return n;
};

const PrenatalVisitsDocumentPDFTemplate = ({ document: doc }) => {
  let records = [];

  if (Array.isArray(doc)) {
    records = doc;
  } else if (doc?.prenatal_visits) {
    records = Array.isArray(doc.prenatal_visits) ? doc.prenatal_visits : [doc.prenatal_visits];
  } else if (doc?.documentData?.prenatal_visits) {
    records = Array.isArray(doc.documentData.prenatal_visits) ? doc.documentData.prenatal_visits : [doc.documentData.prenatal_visits];
  } else if (doc?.documentData) {
    records = Array.isArray(doc.documentData) ? doc.documentData : [doc.documentData];
  } else if (doc && typeof doc === 'object') {
    records = [doc];
  }

  records = records.filter(r => r && Object.keys(r).length > 0);

  const safeString = (val) => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number') return String(val);
    return String(val);
  };

  /* recursive object node: label = bold heading; nested value indented (grayscale) */
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

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.documentTitle}>Prenatal Visits</Text>
        </View>

        {records.map((record, idx) => {
          const gestationalWeeks = record.gestationalWeeks || parseGestationalWeeks(record.gestationalAge);
          const trimesterInfo = getTrimesterInfo(gestationalWeeks);
          const percentage = gestationalWeeks ? Math.min((gestationalWeeks / 40) * 100, 100) : 0;

          return (
            <View key={idx} style={styles.recordCard}>
              <Text style={styles.recordTitle}>Prenatal Visit {idx + 1}</Text>

              {trimesterInfo && gestationalWeeks && (
                <View style={styles.chartSection} wrap={false}>
                  <Text style={styles.chartTitle}>Gestational Age Progress</Text>
                  <View style={styles.barContainer}>
                    <Text style={styles.barLabel}>{trimesterInfo.label}</Text>
                    <View style={styles.barBackground}>
                      <View style={[styles.barFill, { width: `${percentage}%`, backgroundColor: trimesterInfo.color }]} />
                    </View>
                    <Text style={styles.barValue}>{gestationalWeeks}/40 weeks</Text>
                  </View>
                </View>
              )}

              {(record.visitDate || record.gestationalAge) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Visit Information</Text>
                  {record.visitDate && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Visit Date</Text>
                      <Text style={styles.fieldValue}>{safeString(record.visitDate)}</Text>
                    </View>
                  )}
                  {record.gestationalAge && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Gestational Age</Text>
                      <Text style={styles.fieldValue}>{safeString(record.gestationalAge)}</Text>
                    </View>
                  )}
                </View>
              )}

              {(record.lmp || record.edd || record.gravida !== undefined || record.para !== undefined) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Pregnancy Details</Text>
                  {record.lmp && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>LMP (Last Menstrual Period)</Text>
                      <Text style={styles.fieldValue}>{safeString(record.lmp)}</Text>
                    </View>
                  )}
                  {record.edd && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>EDD (Estimated Due Date)</Text>
                      <Text style={styles.fieldValue}>{safeString(record.edd)}</Text>
                    </View>
                  )}
                  {record.gravida !== undefined && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Gravida</Text>
                      <Text style={styles.fieldValue}>{safeString(record.gravida)}</Text>
                    </View>
                  )}
                  {record.para !== undefined && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Para</Text>
                      <Text style={styles.fieldValue}>{safeString(record.para)}</Text>
                    </View>
                  )}
                </View>
              )}

              {(record.weight || record.bloodPressure) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Vital Signs</Text>
                  {record.weight && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Weight</Text>
                      <Text style={styles.fieldValue}>{safeString(record.weight)}</Text>
                    </View>
                  )}
                  {record.bloodPressure && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Blood Pressure</Text>
                      <Text style={styles.fieldValue}>{safeString(record.bloodPressure)}</Text>
                    </View>
                  )}
                </View>
              )}

              {(record.fundalHeight || record.fetalHeartRate || record.fetalMovement) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Fetal Assessment</Text>
                  {record.fundalHeight && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Fundal Height</Text>
                      <Text style={styles.fieldValue}>{safeString(record.fundalHeight)}</Text>
                    </View>
                  )}
                  {record.fetalHeartRate && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Fetal Heart Rate</Text>
                      <Text style={styles.fieldValue}>{safeString(record.fetalHeartRate)}</Text>
                    </View>
                  )}
                  {record.fetalMovement && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Fetal Movement</Text>
                      <Text style={styles.fieldValue}>{safeString(record.fetalMovement)}</Text>
                    </View>
                  )}
                </View>
              )}

              {record.cervicalExam && !isEmptyDeep(record.cervicalExam) && (
                Object.entries(record.cervicalExam).filter(([, v]) => !isEmptyDeep(v)).map(([k, v], i, arr) => {
                  const rows = countRows(v);
                  return (
                    <View key={`cervicalExam-${k}`} style={styles.section} wrap={rows > 8 ? undefined : false}>
                      {i === 0 ? <Text style={styles.sectionTitle}>Cervical Exam</Text> : null}
                      <View style={styles.fieldBlock}>
                        {renderObjectNode(humanizeKey(k), v, `cervicalExam-${k}`, 1)}
                      </View>
                    </View>
                  );
                })
              )}

              {record.ultrasoundFindings && Object.keys(record.ultrasoundFindings).length > 0 && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Ultrasound Findings</Text>
                  {record.ultrasoundFindings.presentation && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Presentation</Text>
                      <Text style={styles.fieldValue}>{safeString(record.ultrasoundFindings.presentation)}</Text>
                    </View>
                  )}
                  {record.ultrasoundFindings.FHR && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Fetal Heart Rate (US)</Text>
                      <Text style={styles.fieldValue}>{safeString(record.ultrasoundFindings.FHR)}</Text>
                    </View>
                  )}
                  {record.ultrasoundFindings.AFI && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Amniotic Fluid Index</Text>
                      <Text style={styles.fieldValue}>{safeString(record.ultrasoundFindings.AFI)}</Text>
                    </View>
                  )}
                  {record.ultrasoundFindings.placenta && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Placenta</Text>
                      <Text style={styles.fieldValue}>{safeString(record.ultrasoundFindings.placenta)}</Text>
                    </View>
                  )}
                  {record.ultrasoundFindings.EFW && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Estimated Fetal Weight</Text>
                      <Text style={styles.fieldValue}>{safeString(record.ultrasoundFindings.EFW)}</Text>
                    </View>
                  )}
                  {record.ultrasoundFindings.umbilicalArteryDoppler && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldSubtitle}>Umbilical Artery Doppler</Text>
                      <Text style={styles.fieldValue}>{safeString(record.ultrasoundFindings.umbilicalArteryDoppler)}</Text>
                    </View>
                  )}
                </View>
              )}

              {record.labResults?.length > 0 && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Lab Results</Text>
                  {record.labResults.map((lab, labIdx) => (
                    <Text key={labIdx} style={styles.listItem}>
                      {labIdx + 1}. {safeString(lab)}
                    </Text>
                  ))}
                </View>
              )}

              {record.complications?.length > 0 && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Complications</Text>
                  {record.complications.map((comp, compIdx) => (
                    <Text key={compIdx} style={styles.listItem}>
                      {compIdx + 1}. {safeString(comp)}
                    </Text>
                  ))}
                </View>
              )}

              {record.plan && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Plan</Text>
                  {safeString(record.plan).split(/[;.]/).map(s => s.trim()).filter(Boolean).map((item, planIdx) => (
                    <Text key={planIdx} style={styles.listItem}>
                      {planIdx + 1}. {item}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default PrenatalVisitsDocumentPDFTemplate;
