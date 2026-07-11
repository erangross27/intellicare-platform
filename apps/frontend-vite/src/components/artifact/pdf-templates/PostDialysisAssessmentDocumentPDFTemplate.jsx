/**
 * PostDialysisAssessmentDocumentPDFTemplate.jsx
 * Box-free B&W — Helvetica — LETTER size — post dialysis assessment
 * Collection: post_dialysis_assessment
 * NOTE: no clinical date field — the collection carries only ingestion timestamps
 * (createdAt/updatedAt), which are NOT clinical dates, so no date row is rendered.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, color: '#000000', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid', marginBottom: 16 },
  recordContainer: { marginBottom: 20 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 12 },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid', marginBottom: 8 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid', marginBottom: 3 },
  fieldValue: { fontSize: 14, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  separator: { marginTop: 16, marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 14, color: '#000000', textAlign: 'center', marginTop: 40 },
});

/* ======= FIELD MAPS (mirror the JSX) ======= */
const FIELD_LABELS = {
  dialysisSessionDuration: 'Session Duration',
  dialyzerType: 'Dialyzer Type',
  bloodFlowRate: 'Blood Flow Rate',
  dialysateFlowRate: 'Dialysate Flow Rate',
  anticoagulationProtocol: 'Anticoagulation Protocol',
  preDialysisSystolicBP: 'Pre-Dialysis Systolic BP',
  postDialysisSystolicBP: 'Post-Dialysis Systolic BP',
  preDialysisDiastolicBP: 'Pre-Dialysis Diastolic BP',
  postDialysisDiastolicBP: 'Post-Dialysis Diastolic BP',
  preDialysisWeight: 'Pre-Dialysis Weight',
  postDialysisWeight: 'Post-Dialysis Weight',
  fluidRemovalVolume: 'Fluid Removal Volume',
  ultrafiltrationRate: 'Ultrafiltration Rate',
  dryWeightAssessment: 'Dry Weight Assessment',
  ktVRatio: 'Kt/V Ratio',
  ureaReductionRatio: 'Urea Reduction Ratio',
  accessType: 'Access Type',
  accessFunctionStatus: 'Access Function Status',
  intradialyticHypotensionOccurred: 'Intradialytic Hypotension',
  muscleCrampsReported: 'Muscle Cramps',
  disequilibriumSyndromeSymptoms: 'Disequilibrium Syndrome Symptoms',
  sessionComplications: 'Session Complications',
  electrolyteLevelsPostDialysis: 'Electrolyte Levels',
  residualRenalFunction: 'Residual Renal Function',
  postDialysisRecoveryTime: 'Recovery Time',
};

const SECTION_CONFIGS = [
  { sid: 'session-parameters', title: 'Session Parameters', fields: ['dialysisSessionDuration', 'dialyzerType', 'bloodFlowRate', 'dialysateFlowRate', 'anticoagulationProtocol'] },
  { sid: 'vital-signs', title: 'Vital Signs', fields: ['preDialysisSystolicBP', 'postDialysisSystolicBP', 'preDialysisDiastolicBP', 'postDialysisDiastolicBP', 'preDialysisWeight', 'postDialysisWeight'] },
  { sid: 'fluid-management', title: 'Fluid Management', fields: ['fluidRemovalVolume', 'ultrafiltrationRate', 'dryWeightAssessment'] },
  { sid: 'dialysis-adequacy', title: 'Dialysis Adequacy', fields: ['ktVRatio', 'ureaReductionRatio'] },
  { sid: 'vascular-access', title: 'Vascular Access', fields: ['accessType', 'accessFunctionStatus'] },
  { sid: 'complications-symptoms', title: 'Complications & Symptoms', fields: ['intradialyticHypotensionOccurred', 'muscleCrampsReported', 'disequilibriumSyndromeSymptoms', 'sessionComplications'] },
  { sid: 'recovery-followup', title: 'Recovery & Follow-up', fields: ['electrolyteLevelsPostDialysis', 'residualRenalFunction', 'postDialysisRecoveryTime'] },
];

const BOOLEAN_FIELDS = ['intradialyticHypotensionOccurred', 'muscleCrampsReported'];
const NUMBER_FIELDS = ['dialysisSessionDuration', 'bloodFlowRate', 'dialysateFlowRate', 'preDialysisSystolicBP', 'postDialysisSystolicBP', 'preDialysisDiastolicBP', 'postDialysisDiastolicBP', 'preDialysisWeight', 'postDialysisWeight', 'fluidRemovalVolume', 'ultrafiltrationRate', 'ktVRatio', 'ureaReductionRatio', 'postDialysisRecoveryTime'];
const ARRAY_FIELDS = ['disequilibriumSyndromeSymptoms', 'sessionComplications'];
const STRING_FIELDS = ['dialyzerType', 'anticoagulationProtocol', 'dryWeightAssessment', 'accessType', 'accessFunctionStatus', 'electrolyteLevelsPostDialysis', 'residualRenalFunction'];
/* number fields where a stored 0 means "not recorded" (sentinel), NOT a real zero — hide when 0. */
const SENTINEL_ZERO_FIELDS = ['ultrafiltrationRate', 'postDialysisRecoveryTime'];
/* per-field display units (parity is label-level; values keep their clinical units) */
const UNITS = {
  dialysisSessionDuration: ' min', bloodFlowRate: ' mL/min', dialysateFlowRate: ' mL/min',
  preDialysisSystolicBP: ' mmHg', postDialysisSystolicBP: ' mmHg',
  preDialysisDiastolicBP: ' mmHg', postDialysisDiastolicBP: ' mmHg',
  preDialysisWeight: ' kg', postDialysisWeight: ' kg',
  fluidRemovalVolume: ' mL', ultrafiltrationRate: ' mL/hr',
  ureaReductionRatio: '%', postDialysisRecoveryTime: ' min',
};

/* ======= UTILS ======= */
const hasVal = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number') return true;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  return true;
};

const isMeaninglessZero = (fn, v) => SENTINEL_ZERO_FIELDS.includes(fn) && (v === 0 || v === '0');

const fieldVisible = (fn, val) => {
  if (ARRAY_FIELDS.includes(fn)) return Array.isArray(val) && val.filter(Boolean).length > 0;
  if (!hasVal(val)) return false;
  if (NUMBER_FIELDS.includes(fn) && isMeaninglessZero(fn, val)) return false;
  return true;
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)[.;](?:\s+)/).map(s => s.replace(/^\d+\.\s+/, '').trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  return String(val).trim();
};

/* ======= FIELD RENDERER — returns a bare <View style={fieldBox}> (glue owns wrap) ======= */
const renderField = (fn, val, key) => {
  const label = FIELD_LABELS[fn] || fn;

  if (BOOLEAN_FIELDS.includes(fn)) {
    return (
      <View key={key} style={styles.fieldBox}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValue}>{val ? 'Yes' : 'No'}</Text>
      </View>
    );
  }

  if (NUMBER_FIELDS.includes(fn)) {
    return (
      <View key={key} style={styles.fieldBox}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValue}>{`${val}${UNITS[fn] || ''}`}</Text>
      </View>
    );
  }

  if (ARRAY_FIELDS.includes(fn)) {
    const items = Array.isArray(val) ? val.filter(Boolean) : [];
    return (
      <View key={key} style={styles.fieldBox}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {items.map((item, i) => (
          <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
        ))}
      </View>
    );
  }

  /* STRING — multi-sentence → numbered list; single → whole value */
  const strVal = safeString(val);
  const sentences = splitBySentence(strVal);
  if (sentences.length > 1) {
    return (
      <View key={key} style={styles.fieldBox}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {sentences.map((s, i) => (
          <Text key={i} style={styles.listItem}>{i + 1}. {s}</Text>
        ))}
      </View>
    );
  }
  return (
    <View key={key} style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{strVal}</Text>
    </View>
  );
};

/* ======= PDF COMPONENT ======= */
const PostDialysisAssessmentDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.post_dialysis_assessment) return Array.isArray(r.post_dialysis_assessment) ? r.post_dialysis_assessment : [r.post_dialysis_assessment];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.post_dialysis_assessment) return Array.isArray(dd.post_dialysis_assessment) ? dd.post_dialysis_assessment : [dd.post_dialysis_assessment]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Post Dialysis Assessment</Text>
          <Text style={styles.noDataText}>No post dialysis assessment records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page} wrap>
        <Text style={styles.documentTitle}>Post Dialysis Assessment</Text>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <Text style={styles.recordTitle}>Post Dialysis Assessment {idx + 1}</Text>

            {SECTION_CONFIGS.map(cfg => {
              const present = cfg.fields.filter(fn => fieldVisible(fn, record[fn]));
              if (present.length === 0) return null;
              const [first, ...rest] = present;
              return (
                <View key={cfg.sid} style={styles.section}>
                  {/* anti-orphan glue: section title + first field never split across pages */}
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>{cfg.title}</Text>
                    {renderField(first, record[first], first)}
                  </View>
                  {rest.map(fn => renderField(fn, record[fn], fn))}
                </View>
              );
            })}

            {idx < records.length - 1 && <View style={styles.separator} />}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PostDialysisAssessmentDocumentPDFTemplate;
