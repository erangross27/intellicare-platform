import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// Depression Screening PDF Template - December 2025 REBUILD
// Black & White with Bar Chart Visualization for 9 Assessment Scores
// NEW SCHEMA: phq9Score, phq2Score, gadSevenScore, beckDepressionInventoryScore,
// hamiltonDepressionRatingScale, montgomeryAsbergDepressionRatingScale,
// edinburghPostnatalDepressionScale, geriatricDepressionScale, columbiaScale

// ========================= STYLES =========================

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000' },
  header: { marginBottom: 20, paddingBottom: 8 },
  title: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1 },
  recordCard: { marginBottom: 0, paddingBottom: 16 },
  recordHeader: { marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  recordMeta: { fontSize: 12, color: '#000000', marginTop: 2 },
  section: { paddingBottom: 4 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 4, textTransform: 'uppercase', borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 2 },
  fieldBox: { marginBottom: 6 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#000000', marginBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', paddingBottom: 2 },
  listItem: { fontSize: 14, lineHeight: 1.4, color: '#000000', marginBottom: 2, paddingLeft: 12 },
  // Bar chart (box-free, B&W)
  chartSection: { marginBottom: 8 },
  legendContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8, paddingBottom: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginRight: 12, marginBottom: 4 },
  legendColor: { width: 10, height: 8 },
  legendText: { fontSize: 10, color: '#000000', marginLeft: 4 },
  barChartRow: { marginBottom: 10 },
  barLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 2 },
  barInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  barScoreText: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000' },
  barInterpretation: { fontSize: 10, color: '#000000' },
  barContainer: { flexDirection: 'row', alignItems: 'center', height: 16 },
  barBackground: { flex: 1, height: 12, backgroundColor: '#eeeeee' },
  barFill: { height: '100%' },
});

// ========================= HELPER FUNCTIONS =========================

// Safe string helper for PDF (handles undefined/null and Unicode)
const safeString = (value) => {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2014/g, '--')
    .replace(/\u2013/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[^\x00-\x7F]/g, '');
};

// Format date helper
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return safeString(dateStr);
  }
};

// ========================= SCORE HELPER FUNCTIONS =========================

// Score configurations for all 9 assessment types
const scoreConfigs = {
  phq9: { max: 27, name: 'PHQ-9', description: 'Patient Health Questionnaire-9' },
  phq2: { max: 6, name: 'PHQ-2', description: 'Patient Health Questionnaire-2' },
  gad7: { max: 21, name: 'GAD-7', description: 'Generalized Anxiety Disorder-7' },
  beck: { max: 63, name: 'BDI', description: 'Beck Depression Inventory' },
  hamilton: { max: 52, name: 'HDRS', description: 'Hamilton Depression Rating Scale' },
  madrs: { max: 60, name: 'MADRS', description: 'Montgomery-Asberg Depression Rating Scale' },
  edinburgh: { max: 30, name: 'EPDS', description: 'Edinburgh Postnatal Depression Scale' },
  geriatric: { max: 15, name: 'GDS', description: 'Geriatric Depression Scale' },
  columbia: { max: 25, name: 'C-SSRS', description: 'Columbia Suicide Severity Rating Scale' },
};

// PHQ-9 interpretation (0-27)
const getPHQ9Info = (score) => {
  if (score <= 4) return { color: '#898989', interpretation: 'Minimal depression' };
  if (score <= 9) return { color: '#7a7a7a', interpretation: 'Mild depression' };
  if (score <= 14) return { color: '#a7a7a7', interpretation: 'Moderate depression' };
  if (score <= 19) return { color: '#a8a8a8', interpretation: 'Moderately severe' };
  return { color: '#777777', interpretation: 'Severe depression' };
};

// PHQ-2 interpretation (0-6)
const getPHQ2Info = (score) => {
  if (score < 3) return { color: '#898989', interpretation: 'Negative screen' };
  return { color: '#777777', interpretation: 'Positive screen' };
};

// GAD-7 interpretation (0-21)
const getGAD7Info = (score) => {
  if (score <= 4) return { color: '#898989', interpretation: 'Minimal anxiety' };
  if (score <= 9) return { color: '#7a7a7a', interpretation: 'Mild anxiety' };
  if (score <= 14) return { color: '#a7a7a7', interpretation: 'Moderate anxiety' };
  return { color: '#777777', interpretation: 'Severe anxiety' };
};

// Beck Depression Inventory interpretation (0-63)
const getBeckInfo = (score) => {
  if (score <= 10) return { color: '#898989', interpretation: 'Normal ups and downs' };
  if (score <= 16) return { color: '#7a7a7a', interpretation: 'Mild mood disturbance' };
  if (score <= 20) return { color: '#a7a7a7', interpretation: 'Borderline clinical' };
  if (score <= 30) return { color: '#a8a8a8', interpretation: 'Moderate depression' };
  if (score <= 40) return { color: '#777777', interpretation: 'Severe depression' };
  return { color: '#414141', interpretation: 'Extreme depression' };
};

// Hamilton Depression Rating Scale interpretation (0-52)
const getHamiltonInfo = (score) => {
  if (score <= 7) return { color: '#898989', interpretation: 'Normal' };
  if (score <= 13) return { color: '#7a7a7a', interpretation: 'Mild depression' };
  if (score <= 18) return { color: '#a7a7a7', interpretation: 'Moderate depression' };
  if (score <= 22) return { color: '#a8a8a8', interpretation: 'Severe depression' };
  return { color: '#777777', interpretation: 'Very severe depression' };
};

// MADRS interpretation (0-60)
const getMADRSInfo = (score) => {
  if (score <= 6) return { color: '#898989', interpretation: 'Normal/absent' };
  if (score <= 19) return { color: '#7a7a7a', interpretation: 'Mild depression' };
  if (score <= 34) return { color: '#a7a7a7', interpretation: 'Moderate depression' };
  return { color: '#777777', interpretation: 'Severe depression' };
};

// Edinburgh Postnatal Depression Scale interpretation (0-30)
const getEdinburghInfo = (score) => {
  if (score <= 9) return { color: '#898989', interpretation: 'Low risk' };
  if (score <= 12) return { color: '#a7a7a7', interpretation: 'Possible depression' };
  return { color: '#777777', interpretation: 'Likely depression' };
};

// Geriatric Depression Scale interpretation (0-15)
const getGeriatricInfo = (score) => {
  if (score <= 4) return { color: '#898989', interpretation: 'Normal' };
  if (score <= 8) return { color: '#7a7a7a', interpretation: 'Mild depression' };
  if (score <= 11) return { color: '#a7a7a7', interpretation: 'Moderate depression' };
  return { color: '#777777', interpretation: 'Severe depression' };
};

// Columbia Suicide Severity Rating Scale interpretation (0-25)
const getColumbiaInfo = (score) => {
  if (score === 0) return { color: '#898989', interpretation: 'No suicidal ideation' };
  if (score <= 5) return { color: '#a7a7a7', interpretation: 'Ideation present' };
  if (score <= 10) return { color: '#a8a8a8', interpretation: 'Active ideation' };
  return { color: '#777777', interpretation: 'High risk' };
};

// Get score info based on type
const getScoreInfo = (type, score) => {
  switch (type) {
    case 'phq9': return getPHQ9Info(score);
    case 'phq2': return getPHQ2Info(score);
    case 'gad7': return getGAD7Info(score);
    case 'beck': return getBeckInfo(score);
    case 'hamilton': return getHamiltonInfo(score);
    case 'madrs': return getMADRSInfo(score);
    case 'edinburgh': return getEdinburghInfo(score);
    case 'geriatric': return getGeriatricInfo(score);
    case 'columbia': return getColumbiaInfo(score);
    default: return { color: '#666666', interpretation: 'Unknown' };
  }
};

// Prepare chart data from record
const prepareChartData = (record) => {
  const charts = [];

  // PHQ-9 Score
  if (record.phq9Score && record.phq9Score > 0) {
    const config = scoreConfigs.phq9;
    const info = getScoreInfo('phq9', record.phq9Score);
    charts.push({
      label: `${config.name} (${config.description})`,
      score: record.phq9Score,
      max: config.max,
      percentage: Math.min(100, (record.phq9Score / config.max) * 100),
      color: info.color,
      interpretation: info.interpretation,
    });
  }

  // PHQ-2 Score
  if (record.phq2Score && record.phq2Score > 0) {
    const config = scoreConfigs.phq2;
    const info = getScoreInfo('phq2', record.phq2Score);
    charts.push({
      label: `${config.name} (${config.description})`,
      score: record.phq2Score,
      max: config.max,
      percentage: Math.min(100, (record.phq2Score / config.max) * 100),
      color: info.color,
      interpretation: info.interpretation,
    });
  }

  // GAD-7 Score
  if (record.gadSevenScore && record.gadSevenScore > 0) {
    const config = scoreConfigs.gad7;
    const info = getScoreInfo('gad7', record.gadSevenScore);
    charts.push({
      label: `${config.name} (${config.description})`,
      score: record.gadSevenScore,
      max: config.max,
      percentage: Math.min(100, (record.gadSevenScore / config.max) * 100),
      color: info.color,
      interpretation: info.interpretation,
    });
  }

  // Beck Depression Inventory
  if (record.beckDepressionInventoryScore && record.beckDepressionInventoryScore > 0) {
    const config = scoreConfigs.beck;
    const info = getScoreInfo('beck', record.beckDepressionInventoryScore);
    charts.push({
      label: `${config.name} (${config.description})`,
      score: record.beckDepressionInventoryScore,
      max: config.max,
      percentage: Math.min(100, (record.beckDepressionInventoryScore / config.max) * 100),
      color: info.color,
      interpretation: info.interpretation,
    });
  }

  // Hamilton Depression Rating Scale
  if (record.hamiltonDepressionRatingScale && record.hamiltonDepressionRatingScale > 0) {
    const config = scoreConfigs.hamilton;
    const info = getScoreInfo('hamilton', record.hamiltonDepressionRatingScale);
    charts.push({
      label: `${config.name} (${config.description})`,
      score: record.hamiltonDepressionRatingScale,
      max: config.max,
      percentage: Math.min(100, (record.hamiltonDepressionRatingScale / config.max) * 100),
      color: info.color,
      interpretation: info.interpretation,
    });
  }

  // Montgomery-Asberg Depression Rating Scale
  if (record.montgomeryAsbergDepressionRatingScale && record.montgomeryAsbergDepressionRatingScale > 0) {
    const config = scoreConfigs.madrs;
    const info = getScoreInfo('madrs', record.montgomeryAsbergDepressionRatingScale);
    charts.push({
      label: `${config.name} (${config.description})`,
      score: record.montgomeryAsbergDepressionRatingScale,
      max: config.max,
      percentage: Math.min(100, (record.montgomeryAsbergDepressionRatingScale / config.max) * 100),
      color: info.color,
      interpretation: info.interpretation,
    });
  }

  // Edinburgh Postnatal Depression Scale
  if (record.edinburghPostnatalDepressionScale && record.edinburghPostnatalDepressionScale > 0) {
    const config = scoreConfigs.edinburgh;
    const info = getScoreInfo('edinburgh', record.edinburghPostnatalDepressionScale);
    charts.push({
      label: `${config.name} (${config.description})`,
      score: record.edinburghPostnatalDepressionScale,
      max: config.max,
      percentage: Math.min(100, (record.edinburghPostnatalDepressionScale / config.max) * 100),
      color: info.color,
      interpretation: info.interpretation,
    });
  }

  // Geriatric Depression Scale
  if (record.geriatricDepressionScale && record.geriatricDepressionScale > 0) {
    const config = scoreConfigs.geriatric;
    const info = getScoreInfo('geriatric', record.geriatricDepressionScale);
    charts.push({
      label: `${config.name} (${config.description})`,
      score: record.geriatricDepressionScale,
      max: config.max,
      percentage: Math.min(100, (record.geriatricDepressionScale / config.max) * 100),
      color: info.color,
      interpretation: info.interpretation,
    });
  }

  // Columbia Suicide Severity Rating Scale
  if (record.columbiaScale && record.columbiaScale > 0) {
    const config = scoreConfigs.columbia;
    const info = getScoreInfo('columbia', record.columbiaScale);
    charts.push({
      label: `${config.name} (${config.description})`,
      score: record.columbiaScale,
      max: config.max,
      percentage: Math.min(100, (record.columbiaScale / config.max) * 100),
      color: info.color,
      interpretation: info.interpretation,
    });
  }

  return charts;
};

// ========================= PDF COMPONENTS =========================

// Legend component - severity levels
const PDFLegend = () => (
  <View style={styles.legendContainer}>
    <View style={styles.legendItem}>
      <View style={[styles.legendColor, { backgroundColor: '#898989' }]} />
      <Text style={styles.legendText}>Minimal/Normal</Text>
    </View>
    <View style={styles.legendItem}>
      <View style={[styles.legendColor, { backgroundColor: '#7a7a7a' }]} />
      <Text style={styles.legendText}>Mild</Text>
    </View>
    <View style={styles.legendItem}>
      <View style={[styles.legendColor, { backgroundColor: '#a7a7a7' }]} />
      <Text style={styles.legendText}>Moderate</Text>
    </View>
    <View style={styles.legendItem}>
      <View style={[styles.legendColor, { backgroundColor: '#a8a8a8' }]} />
      <Text style={styles.legendText}>Mod-Severe</Text>
    </View>
    <View style={styles.legendItem}>
      <View style={[styles.legendColor, { backgroundColor: '#777777' }]} />
      <Text style={styles.legendText}>Severe</Text>
    </View>
  </View>
);

// Bar chart component
const PDFBarChart = ({ label, score, max, percentage, color, interpretation }) => (
  <View style={styles.barChartRow}>
    <Text style={styles.barLabel}>{safeString(label)}</Text>
    <View style={styles.barInfoRow}>
      <Text style={styles.barScoreText}>{score}/{max}</Text>
      <Text style={styles.barInterpretation}>{safeString(interpretation)}</Text>
    </View>
    <View style={styles.barContainer}>
      <View style={styles.barBackground}>
        <View style={[styles.barFill, { width: `${percentage}%`, backgroundColor: color }]} />
      </View>
    </View>
  </View>
);

// Box-free label-above-value helpers (numbered "1." even for single values)
const renderFieldRow = (label, value) => {
  if (value === undefined || value === null || value === '') return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.listItem}>1. {safeString(value)}</Text>
    </View>
  );
};
const boolText = (v) => (v ? 'Yes' : 'No');
const renderArrayField = (label, items) => {
  if (!items || items.length === 0) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {items.map((it, i) => <Text key={i} style={styles.listItem}>{i + 1}. {safeString(it)}</Text>)}
    </View>
  );
};

// ========================= MAIN COMPONENT =========================

const DepressionScreeningDocumentPDFTemplate = ({ document: data }) => {
  // Data unwrapping - handle various data structures
  const unwrapData = (inputData) => {
    if (!inputData) return [];
    if (Array.isArray(inputData)) {
      // Check for nested wrapper
      if (inputData.length === 1 && inputData[0]?.depression_screening) {
        return inputData[0].depression_screening;
      }
      return inputData;
    }
    if (inputData.depression_screening) {
      return inputData.depression_screening;
    }
    return [inputData];
  };

  const records = unwrapData(data);

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Document Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Depression Screening</Text>
        </View>

        {/* Records */}
        {records.map((record, idx) => {
          const chartData = prepareChartData(record);
          const hasClinical = record.suicidalIdeationPresent !== undefined || record.depressionSeverityLevel || record.majorDepressiveEpisodeCriteria !== undefined || record.psychoticFeaturesPresent !== undefined || record.anxietySymptomSeverity || record.functionalImpairmentLevel;
          const hasSymptoms = record.sleepDisturbanceType?.length > 0 || record.appetiteChanges || record.energyFatigueLevel || record.concentrationDifficulties !== undefined || record.worthlessnessGuilt !== undefined || record.psychomotorChanges;
          const historyRows = (record.priorDepressionEpisodes !== undefined ? 1 : 0) + (record.substanceUseComorbidity !== undefined ? 1 : 0) + (record.medicalComorbidities?.length || 0) + (record.currentAntidepressantMedications?.length || 0);
          const hasHistory = historyRows > 0;

          return (
            <View key={idx} style={styles.recordCard} break={idx > 0}>
              {/* Record Header */}
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>Depression Screening {idx + 1}</Text>
                {(record.createdAt || record.createdAtUTC) && (
                  <Text style={styles.recordMeta}>{formatDate(record.createdAt || record.createdAtUTC)}</Text>
                )}
              </View>

              {/* Assessment Scores - Bar Chart (box-free) */}
              {chartData.length > 0 && (
                <View style={styles.section} wrap={chartData.length > 5 ? true : false}>
                  <Text style={styles.sectionTitle}>Assessment Scores</Text>
                  <View style={styles.chartSection}>
                    <PDFLegend />
                    {chartData.map((chart, cIdx) => (
                      <PDFBarChart key={cIdx} label={chart.label} score={chart.score} max={chart.max} percentage={chart.percentage} color={chart.color} interpretation={chart.interpretation} />
                    ))}
                  </View>
                </View>
              )}

              {/* Clinical Assessment */}
              {hasClinical && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Clinical Assessment</Text>
                  {record.depressionSeverityLevel && renderFieldRow('Depression Severity Level', record.depressionSeverityLevel)}
                  {record.majorDepressiveEpisodeCriteria !== undefined && renderFieldRow('Major Depressive Episode Criteria', boolText(record.majorDepressiveEpisodeCriteria))}
                  {record.psychoticFeaturesPresent !== undefined && renderFieldRow('Psychotic Features Present', boolText(record.psychoticFeaturesPresent))}
                  {record.suicidalIdeationPresent !== undefined && renderFieldRow('Suicidal Ideation Present', boolText(record.suicidalIdeationPresent))}
                  {record.anxietySymptomSeverity && renderFieldRow('Anxiety Symptom Severity', record.anxietySymptomSeverity)}
                  {record.functionalImpairmentLevel && renderFieldRow('Functional Impairment Level', record.functionalImpairmentLevel)}
                </View>
              )}

              {/* Current Symptoms */}
              {hasSymptoms && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Current Symptoms</Text>
                  {record.sleepDisturbanceType?.length > 0 && renderArrayField('Sleep Disturbance Type', record.sleepDisturbanceType)}
                  {record.appetiteChanges && renderFieldRow('Appetite Changes', record.appetiteChanges)}
                  {record.energyFatigueLevel && renderFieldRow('Energy / Fatigue Level', record.energyFatigueLevel)}
                  {record.concentrationDifficulties !== undefined && renderFieldRow('Concentration Difficulties', boolText(record.concentrationDifficulties))}
                  {record.worthlessnessGuilt !== undefined && renderFieldRow('Worthlessness / Guilt', boolText(record.worthlessnessGuilt))}
                  {record.psychomotorChanges && renderFieldRow('Psychomotor Changes', record.psychomotorChanges)}
                </View>
              )}

              {/* History & Comorbidities */}
              {hasHistory && (
                <View style={styles.section} wrap={historyRows > 8 ? true : false}>
                  <Text style={styles.sectionTitle}>History and Comorbidities</Text>
                  {record.priorDepressionEpisodes !== undefined && renderFieldRow('Prior Depression Episodes', String(record.priorDepressionEpisodes))}
                  {record.substanceUseComorbidity !== undefined && renderFieldRow('Substance Use Comorbidity', boolText(record.substanceUseComorbidity))}
                  {record.medicalComorbidities?.length > 0 && renderArrayField('Medical Comorbidities', record.medicalComorbidities)}
                  {record.currentAntidepressantMedications?.length > 0 && renderArrayField('Current Antidepressant Medications', record.currentAntidepressantMedications)}
                </View>
              )}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default DepressionScreeningDocumentPDFTemplate;
