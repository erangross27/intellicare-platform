import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/* Box-free black & white generic-recursive renderer.
   - No box backgrounds/borders; hierarchy shown via underlines only (documentTitle / sectionTitle / fieldLabel).
   - Field labels are BARE (no colon) so they render as exact `>Label<` text nodes for JSX/PDF field parity.
   - Anti-orphan: every sectionTitle is glued to its first body element inside a <View wrap={false}>.
   - Scalars stack label-over-value; arrays render as numbered lists; nested objects/arrays recurse under a subLabel. */
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 14,
    lineHeight: 1.5,
    color: '#000000',
    backgroundColor: '#ffffff',
  },
  documentTitle: {
    fontSize: 26,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    borderBottomStyle: 'solid',
    marginBottom: 20,
    textTransform: 'none',
  },
  recordContainer: {
    marginBottom: 24,
  },
  recordTitle: {
    fontSize: 19,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 12,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    borderBottomStyle: 'solid',
    marginBottom: 8,
    textTransform: 'none',
  },
  fieldBox: {
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
    paddingBottom: 2,
    borderBottomWidth: 0.5,
    borderBottomColor: '#999999',
    borderBottomStyle: 'solid',
    marginBottom: 3,
    textTransform: 'none',
  },
  fieldValue: {
    fontSize: 14,
    color: '#000000',
    lineHeight: 1.5,
  },
  subLabel: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginTop: 6,
    marginBottom: 4,
  },
  listItem: {
    fontSize: 14,
    color: '#000000',
    marginBottom: 4,
    paddingLeft: 8,
    lineHeight: 1.5,
  },
  separator: {
    marginTop: 20,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    borderBottomStyle: 'solid',
  },
  noDataText: {
    fontSize: 14,
    color: '#000000',
    textAlign: 'center',
    marginTop: 40,
  },
});

const KEY_OVERRIDES = {
  emg: 'EMG',
  copm: 'COPM',
  iadls: 'IADLs',
  adls: 'ADLs',
  fimScore: 'FIM Score',
  fimSubscales: 'FIM Subscales',
  barthel: 'Barthel Index',
  bergBalance: 'Berg Balance Score',
  bergBalanceScore: 'Berg Balance Score',
  timedUpAndGo: 'Timed Up And Go',
  sixMinuteWalk: 'Six Minute Walk',
  tenMeterWalkTest: 'Ten Meter Walk Test',
  fuglMeyerUpperExtremity: 'Fugl-Meyer Upper Extremity',
  actionResearchArmTest: 'Action Research Arm Test',
  priorLevelOfFunction: 'Prior Level of Function',
  mobilityDetails: 'Mobility Details',
  performanceScore: 'Performance Score',
  satisfactionScore: 'Satisfaction Score',
  dietRecommendation: 'Diet Recommendation',
  aspirationRisk: 'Aspiration Risk',
  longTermGoal: 'Long Term Goal',
  anticipatedDisposition: 'Anticipated Disposition',
  targetedMuscles: 'Targeted Muscles',
};

const humanizeKey = (key) => {
  if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];
  return String(key)
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

const NAME_KEYS = ['activity', 'item', 'medication', 'muscle', 'device', 'name', 'title', 'label'];

const isScalar = (v) => v === null || v === undefined || ['string', 'number', 'boolean'].includes(typeof v);
const isBlank = (v) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

const isEmptyDeep = (v) => {
  if (isBlank(v)) return true;
  if (Array.isArray(v)) return v.filter((x) => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.keys(v).filter((k) => k !== '_id' && !isEmptyDeep(v[k])).length === 0;
  return false; // numbers (including 0) and booleans are meaningful
};

const scalarText = (v) => {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (v === null || v === undefined) return '';
  return String(v);
};

const stripNumber = (text) => String(text).replace(/^\d+[.)]\s*/, '').trim();

const splitIntoItems = (text) => {
  if (!text || typeof text !== 'string') return [];
  const t = text.trim();
  if (!t) return [];
  const bySemi = t.split(/;\s+/).map((s) => s.trim()).filter(Boolean);
  if (bySemi.length > 1) return bySemi;
  const bySentence = t.split(/(?<!\d)\.\s+/).map((s) => s.trim()).filter(Boolean);
  if (bySentence.length > 1) return bySentence;
  return [t];
};

const fieldBox = (label, value, key) => (
  <View key={key} style={styles.fieldBox} wrap={false}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <Text style={styles.fieldValue}>{value}</Text>
  </View>
);

/* bodyForValue / withSubLabel are mutually recursive; both are only invoked at render time. */
const withSubLabel = (label, value, keyPrefix) => {
  const body = bodyForValue(value, keyPrefix);
  if (body.length === 0) return [];
  return [<Text key={`${keyPrefix}-sl`} style={styles.subLabel}>{label}</Text>, ...body];
};

function bodyForValue(value, keyPrefix) {
  const out = [];
  if (isEmptyDeep(value)) return out;

  if (Array.isArray(value)) {
    if (value.every(isScalar)) {
      value.filter((x) => !isBlank(x)).forEach((item, i) => {
        out.push(
          <Text key={`${keyPrefix}-${i}`} style={styles.listItem}>{i + 1}. {stripNumber(scalarText(item))}</Text>
        );
      });
      return out;
    }
    value.forEach((item, i) => {
      if (isEmptyDeep(item)) return;
      if (isScalar(item)) {
        out.push(<Text key={`${keyPrefix}-${i}`} style={styles.listItem}>{stripNumber(scalarText(item))}</Text>);
        return;
      }
      const entries = Object.entries(item).filter(([k, v]) => k !== '_id' && !isEmptyDeep(v));
      const nameKey = NAME_KEYS.find((nk) => entries.some(([k, v]) => k === nk && isScalar(v)));
      if (nameKey) {
        out.push(<Text key={`${keyPrefix}-${i}-t`} style={styles.subLabel}>{scalarText(item[nameKey])}</Text>);
      }
      entries.filter(([k]) => k !== nameKey).forEach(([k, v]) => {
        if (isScalar(v)) out.push(fieldBox(humanizeKey(k), scalarText(v), `${keyPrefix}-${i}-${k}`));
        else out.push(...withSubLabel(humanizeKey(k), v, `${keyPrefix}-${i}-${k}`));
      });
    });
    return out;
  }

  if (typeof value === 'object') {
    Object.entries(value).filter(([k, v]) => k !== '_id' && !isEmptyDeep(v)).forEach(([k, v]) => {
      if (isScalar(v)) out.push(fieldBox(humanizeKey(k), scalarText(v), `${keyPrefix}-${k}`));
      else out.push(...withSubLabel(humanizeKey(k), v, `${keyPrefix}-${k}`));
    });
    return out;
  }

  out.push(<Text key={keyPrefix} style={styles.fieldValue}>{scalarText(value)}</Text>);
  return out;
}

const bodyForText = (text, keyPrefix) =>
  splitIntoItems(text).map((item, i) => (
    <Text key={`${keyPrefix}-${i}`} style={styles.listItem}>{i + 1}. {stripNumber(item)}</Text>
  ));

/* Section — glues the title to its first body element so a title never orphans at a page break. */
const Section = ({ title, prefix, children }) => {
  const items = React.Children.toArray(children).filter(Boolean);
  if (items.length === 0) return null;
  const [first, ...rest] = items;
  return (
    <View style={styles.section}>
      <View wrap={false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {first}
      </View>
      {rest}
    </View>
  );
};

const PmrAssessmentDocumentPDFTemplate = ({ document: data }) => {
  const unwrapData = (inputData) => {
    if (!inputData) return [];
    if (Array.isArray(inputData)) {
      if (inputData.length === 1 && inputData[0]?.pmr_assessment) return inputData[0].pmr_assessment;
      return inputData;
    }
    if (inputData.pmr_assessment) return inputData.pmr_assessment;
    return [inputData];
  };

  const records = unwrapData(data);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>PMR Assessment</Text>
          <Text style={styles.noDataText}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>PMR Assessment</Text>

        {records.map((record, index) => {
          const p = `r${index}`;
          const ti = record.therapyInterventions || {};
          const mm = record.medicalManagement || {};
          return (
            <View key={index} style={styles.recordContainer}>
              {index > 0 && <View style={styles.separator} />}
              <Text style={styles.recordTitle}>PMR Assessment {index + 1}</Text>

              <Section title="Functional History" prefix={p}>{bodyForValue(record.functionalHistory, `${p}-fh`)}</Section>
              <Section title="Functional Assessment" prefix={p}>{bodyForValue(record.functionalAssessment, `${p}-fa`)}</Section>
              <Section title="Balance Assessment" prefix={p}>{bodyForValue(record.balanceAssessment, `${p}-ba`)}</Section>
              <Section title="Gait Analysis" prefix={p}>{bodyForValue(record.gaitAnalysis, `${p}-ga`)}</Section>
              <Section title="Spasticity Assessment - Ashworth Scale" prefix={p}>{bodyForValue(record.spasticityAssessment?.ashworthScale, `${p}-sa`)}</Section>
              <Section title="EMG / Nerve Conduction Studies" prefix={p}>{bodyForValue(record.emgStudies, `${p}-emg`)}</Section>
              <Section title="Orthotic" prefix={p}>{bodyForValue(record.orthotic, `${p}-ort`)}</Section>
              <Section title="COPM Priority Areas" prefix={p}>{bodyForValue(record.copm?.priorityAreas, `${p}-copm`)}</Section>
              <Section title="Swallow Study" prefix={p}>{bodyForValue(record.swallowStudy, `${p}-sw`)}</Section>
              <Section title="Neuropsychological Testing" prefix={p}>{bodyForValue(record.neuropsychologicalTesting, `${p}-np`)}</Section>
              <Section title="Botulinum Toxin Injections" prefix={p}>{bodyForValue(record.botulinumToxinInjections, `${p}-bt`)}</Section>
              <Section title="Equipment" prefix={p}>{bodyForValue(record.equipment, `${p}-eq`)}</Section>
              <Section title="Physical Therapy" prefix={p}>{bodyForValue(ti.physicalTherapy, `${p}-pt`)}</Section>
              <Section title="Occupational Therapy" prefix={p}>{bodyForValue(ti.occupationalTherapy, `${p}-ot`)}</Section>
              <Section title="Speech Therapy" prefix={p}>{bodyForValue(ti.speechTherapy, `${p}-st`)}</Section>
              <Section title="Psychology" prefix={p}>{bodyForValue(ti.psychology, `${p}-psy`)}</Section>
              <Section title="Pharmacologic Plan" prefix={p}>{bodyForValue(mm.pharmacologicPlan, `${p}-pp`)}</Section>
              <Section title="Spasticity Medications" prefix={p}>{bodyForValue(mm.spasticityMedications, `${p}-sm`)}</Section>
              <Section title="Support Groups" prefix={p}>{bodyForValue(record.supportGroups, `${p}-sg`)}</Section>
              <Section title="Discharge Planning" prefix={p}>{bodyForValue(record.dischargePlanningPMR, `${p}-dp`)}</Section>
              <Section title="General Information" prefix={p}>{bodyForValue(record.facility, `${p}-fac`)}</Section>
              <Section title="Provider" prefix={p}>{bodyForValue(record.provider, `${p}-prov`)}</Section>
              <Section title="Findings" prefix={p}>{bodyForText(record.findings, `${p}-find`)}</Section>
              <Section title="Assessment" prefix={p}>{bodyForText(record.assessment, `${p}-asmt`)}</Section>
              <Section title="Plan" prefix={p}>{bodyForText(record.plan, `${p}-plan`)}</Section>
              <Section title="Recommendations" prefix={p}>{bodyForValue(record.recommendations, `${p}-rec`)}</Section>
              <Section title="Results" prefix={p}>{bodyForValue(record.results, `${p}-res`)}</Section>
              <Section title="Notes" prefix={p}>{bodyForText(record.notes, `${p}-note`)}</Section>
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default PmrAssessmentDocumentPDFTemplate;
