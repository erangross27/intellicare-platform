import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * SleepStudyReportsDocumentPDFTemplate - March 2026
 * Helvetica font, LETTER size, 20pt title / 12pt body
 * Renders flat MongoDB fields grouped into sections
 */

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#FFFFFF',
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 12,
    size: 'LETTER',
  },
  title: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 20,
    color: '#000000',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    marginTop: 16,
    marginBottom: 8,
    color: '#000000',
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  label: {
    fontFamily: 'Helvetica-Bold',
    width: 200,
    fontSize: 12,
  },
  value: {
    flex: 1,
    fontSize: 12,
  },
  divider: {
    marginTop: 16,
    marginBottom: 16,
    borderBottom: '1 solid #CCCCCC',
  },
  line: {
    fontSize: 12,
    marginBottom: 4,
    color: '#000000',
    lineHeight: 1.6,
  },
  arrayLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 12,
    marginBottom: 2,
  },
  arrayItem: {
    fontSize: 12,
    marginBottom: 2,
    marginLeft: 12,
    color: '#000000',
    lineHeight: 1.5,
  },
});

const SECTION_TITLES = {
  'sleep-indices': 'Sleep Indices',
  'oxygenation': 'Oxygenation',
  'sleep-architecture': 'Sleep Architecture',
  'respiratory-events': 'Respiratory Events',
  'other-measurements': 'Other Measurements',
};

const FIELD_LABELS = {
  apneaHypopneaIndex: 'Apnea-Hypopnea Index (AHI)',
  respiratoryDisturbanceIndex: 'Respiratory Disturbance Index (RDI)',
  oxygenDesaturationIndex: 'Oxygen Desaturation Index (ODI)',
  minimumOxygenSaturation: 'Minimum Oxygen Saturation',
  meanOxygenSaturation: 'Mean Oxygen Saturation',
  totalSleepTime: 'Total Sleep Time',
  sleepEfficiency: 'Sleep Efficiency',
  sleepLatency: 'Sleep Latency',
  remLatency: 'REM Latency',
  wakeAfterSleepOnset: 'Wake After Sleep Onset (WASO)',
  arousalIndex: 'Arousal Index',
  centralApneaIndex: 'Central Apnea Index',
  obstructiveApneaIndex: 'Obstructive Apnea Index',
  mixedApneaIndex: 'Mixed Apnea Index',
  hypopneaIndex: 'Hypopnea Index',
  periodicLimbMovementIndex: 'Periodic Limb Movement Index (PLMI)',
  epworthSleepinessScale: 'Epworth Sleepiness Scale (ESS)',
  pittsburghSleepQualityIndex: 'Pittsburgh Sleep Quality Index (PSQI)',
  snoreIntensity: 'Snore Intensity',
  sleepStageDistribution: 'Sleep Stage Distribution',
  cpapTitrationPressure: 'CPAP Titration Pressure',
  bodyPositionDependency: 'Body Position Dependency',
  cheyneStokesBrewing: 'Cheyne-Stokes Breathing',
};

const SECTION_FIELDS = {
  'sleep-indices': ['apneaHypopneaIndex', 'respiratoryDisturbanceIndex', 'oxygenDesaturationIndex'],
  'oxygenation': ['minimumOxygenSaturation', 'meanOxygenSaturation'],
  'sleep-architecture': ['totalSleepTime', 'sleepEfficiency', 'sleepLatency', 'remLatency', 'wakeAfterSleepOnset', 'arousalIndex'],
  'respiratory-events': ['centralApneaIndex', 'obstructiveApneaIndex', 'mixedApneaIndex', 'hypopneaIndex'],
  'other-measurements': ['periodicLimbMovementIndex', 'epworthSleepinessScale', 'pittsburghSleepQualityIndex', 'snoreIntensity', 'sleepStageDistribution', 'cpapTitrationPressure', 'bodyPositionDependency', 'cheyneStokesBrewing'],
};

const BOOLEAN_FIELDS = ['bodyPositionDependency', 'cheyneStokesBrewing'];
const NUMBER_FIELDS = ['apneaHypopneaIndex', 'respiratoryDisturbanceIndex', 'oxygenDesaturationIndex', 'minimumOxygenSaturation', 'meanOxygenSaturation', 'totalSleepTime', 'sleepEfficiency', 'sleepLatency', 'remLatency', 'wakeAfterSleepOnset', 'arousalIndex', 'centralApneaIndex', 'obstructiveApneaIndex', 'mixedApneaIndex', 'hypopneaIndex', 'periodicLimbMovementIndex', 'epworthSleepinessScale', 'pittsburghSleepQualityIndex', 'cpapTitrationPressure'];
const ARRAY_FIELDS = ['sleepStageDistribution'];

const hasValue = (val) => {
  if (val === null || val === undefined || val === '') return false;
  if (typeof val === 'boolean') return true;
  if (typeof val === 'number') return true;
  if (typeof val === 'string') return val.trim() !== '';
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === 'object') return Object.keys(val).length > 0;
  return true;
};

const fieldHasValue = (f, val) => {
  if (!hasValue(val)) return false;
  if (NUMBER_FIELDS.includes(f) && parseFloat(val) === 0) return false;
  return true;
};

const fmtVal = (v) => {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  return String(v || '');
};

const arrayItemToString = (item) => {
  if (item === null || item === undefined) return '';
  if (typeof item === 'object' && !Array.isArray(item)) {
    return Object.entries(item)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([k, v]) => `${k}: ${typeof v === 'boolean' ? (v ? 'Yes' : 'No') : v}`)
      .join(', ');
  }
  return String(item);
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return String(dateString);
  }
};

const SleepStudyReportsDocumentPDFTemplate = ({ document: doc }) => {
  let records = [];

  if (Array.isArray(doc)) {
    records = doc;
  } else if (doc?.sleep_study_reports) {
    records = Array.isArray(doc.sleep_study_reports) ? doc.sleep_study_reports : [doc.sleep_study_reports];
  } else if (doc?.documentData) {
    const dd = doc.documentData;
    if (Array.isArray(dd)) records = dd;
    else if (dd?.sleep_study_reports) records = Array.isArray(dd.sleep_study_reports) ? dd.sleep_study_reports : [dd.sleep_study_reports];
    else records = [dd];
  } else if (doc && typeof doc === 'object') {
    records = [doc];
  }

  records = records.filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.title}>SLEEP STUDY REPORTS</Text>
          <Text style={styles.line}>No sleep study reports available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.title}>SLEEP STUDY REPORTS</Text>

        {records.map((record, idx) => (
          <View key={idx}>
            <View wrap={false}>
              <Text style={[styles.sectionTitle, { fontSize: 16, marginTop: idx > 0 ? 20 : 8 }]}>
                {`Sleep Study Report ${idx + 1}`}
                {record.createdAt ? ` - ${formatDate(record.createdAt)}` : ''}
              </Text>
            </View>

            {Object.keys(SECTION_FIELDS).map(sid => {
              const fields = SECTION_FIELDS[sid];
              const visibleFields = fields.filter(f => fieldHasValue(f, record[f]));
              if (visibleFields.length === 0) return null;

              // items = scalar rows + array item lines, to gate wrapping
              let itemCount = 0;
              visibleFields.forEach(f => {
                if (ARRAY_FIELDS.includes(f)) {
                  const arr = Array.isArray(record[f]) ? record[f] : [record[f]];
                  itemCount += 1 + arr.filter(it => arrayItemToString(it)).length;
                } else {
                  itemCount += 1;
                }
              });

              return (
                <View key={sid} wrap={itemCount > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>{SECTION_TITLES[sid]}</Text>
                  {visibleFields.map(f => {
                    const label = FIELD_LABELS[f] || f;
                    if (ARRAY_FIELDS.includes(f)) {
                      const arr = Array.isArray(record[f]) ? record[f] : [record[f]];
                      const items = arr.map(arrayItemToString).filter(Boolean);
                      if (items.length === 0) return null;
                      return (
                        <View key={f}>
                          <Text style={styles.arrayLabel}>{label}:</Text>
                          {items.map((it, i) => (
                            <Text key={i} style={styles.arrayItem}>{`${i + 1}. ${it}`}</Text>
                          ))}
                        </View>
                      );
                    }
                    return (
                      <View key={f} style={styles.row}>
                        <Text style={styles.label}>{label}:</Text>
                        <Text style={styles.value}>{fmtVal(record[f])}</Text>
                      </View>
                    );
                  })}
                </View>
              );
            })}

            {idx < records.length - 1 && <View style={styles.divider} />}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default SleepStudyReportsDocumentPDFTemplate;
