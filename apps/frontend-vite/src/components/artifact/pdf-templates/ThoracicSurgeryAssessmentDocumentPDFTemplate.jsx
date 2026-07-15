/**
 * ThoracicSurgeryAssessmentDocumentPDFTemplate.jsx
 * June 2026 — Helvetica — A4 — BLACK & WHITE only (#000000 titles/borders/values, NO blue).
 * Collection: thoracic_surgery_assessment.
 *
 * BOX-FREE (no backgroundColor/border on field/section views; recordHeader = black bottom-border only).
 * Rule #74: each field is ONE wrap-gated <View> (rows<=8 -> wrap={false}; rows>8 -> wrap=undefined),
 * with its sectionTitle as the FIRST child of the first present field's View (anti-orphan — never a sibling).
 * Single-name skip: hide a field label when it equals the section title.
 * 16 OBJECT fields rendered recursively as humanized key/value lines; 3 ARRAY fields (strings or
 * {key:value} objects) rendered recursively as numbered/labelled lines. 100% schema coverage.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.4, backgroundColor: '#ffffff', color: '#000000' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 8, marginBottom: 20, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 20 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 6, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  section: { marginBottom: 10 },
  fieldGroup: { marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 4, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', paddingBottom: 2, marginTop: 6, marginBottom: 3, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  subLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 2 },
  value: { fontSize: 14, lineHeight: 1.4, color: '#000000', marginBottom: 2 },
  nested: { marginLeft: 10, marginTop: 2 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
  pageNumber: { position: 'absolute', bottom: 20, right: 40, fontSize: 10, color: '#000000' },
});

/* ═══════ CONSTANTS ═══════ */
const SECTION_TITLES = {
  'consultation': 'Consultation Reason',
  'surgeon': 'Surgeon Credentials',
  'performance': 'Performance Status',
  'pulmonary': 'Pulmonary Function',
  'staging': 'Tumor Staging',
  'diagnostics': 'Diagnostic Procedures',
  'petct': 'PET/CT Findings',
  'vats': 'VATS Assessment',
  'preop': 'Preoperative Preparation',
  'operative': 'Operative Details',
  'anesthesia': 'Anesthesia Planning',
  'recovery': 'Enhanced Recovery Protocol',
  'adjuvant': 'Adjuvant Therapy',
  'consent': 'Informed Consent',
  'tumorboard': 'Tumor Board',
  'backup': 'Backup Surgical Plan',
  'alternatives': 'Alternative Treatments',
  'postop': 'Postoperative Orders',
  'results': 'Results',
  'clinical': 'Clinical',
  'recommendations-section': 'Recommendations',
  'notes-status': 'Notes & Status',
};
const FIELD_LABELS = {
  date: 'Date',
  consultationReason: 'Consultation Reason',
  surgeonCredentials: 'Surgeon Credentials',
  performanceStatus: 'Performance Status',
  adlStatus: 'ADL Status',
  pulmonaryFunction: 'Pulmonary Function',
  tumorStaging: 'Tumor Staging',
  mediastinoscopy: 'Mediastinoscopy',
  bronchoscopy: 'Bronchoscopy',
  vatsAssessment: 'VATS Assessment',
  preoperativePreparation: 'Preoperative Preparation',
  operativeDetails: 'Operative Details',
  adjuvantTherapy: 'Adjuvant Therapy',
  petCtFindings: 'PET/CT Findings',
  informedConsent: 'Informed Consent',
  tumorBoard: 'Tumor Board',
  anesthesiaPlanning: 'Anesthesia Planning',
  enhancedRecoveryProtocol: 'Enhanced Recovery Protocol',
  postoperativeOrders: 'Postoperative Orders',
  backupSurgicalPlan: 'Backup Surgical Plan',
  alternativeTreatments: 'Alternative Treatments',
  recommendations: 'Recommendations',
  results: 'Results',
  type: 'Type',
  provider: 'Provider',
  facility: 'Facility',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  notes: 'Notes',
  status: 'Status',
};
const SECTION_FIELDS = {
  'consultation': ['consultationReason'],
  'surgeon': ['surgeonCredentials'],
  'performance': ['performanceStatus', 'adlStatus'],
  'pulmonary': ['pulmonaryFunction'],
  'staging': ['tumorStaging'],
  'diagnostics': ['mediastinoscopy', 'bronchoscopy'],
  'petct': ['petCtFindings'],
  'vats': ['vatsAssessment'],
  'preop': ['preoperativePreparation'],
  'operative': ['operativeDetails'],
  'anesthesia': ['anesthesiaPlanning'],
  'recovery': ['enhancedRecoveryProtocol'],
  'adjuvant': ['adjuvantTherapy'],
  'consent': ['informedConsent'],
  'tumorboard': ['tumorBoard'],
  'backup': ['backupSurgicalPlan'],
  'alternatives': ['alternativeTreatments'],
  'postop': ['postoperativeOrders'],
  'results': ['results'],
  'clinical': ['date', 'provider', 'facility', 'type', 'findings', 'assessment', 'plan'],
  'recommendations-section': ['recommendations'],
  'notes-status': ['notes', 'status'],
};
const SECTION_ORDER = [
  'consultation', 'surgeon', 'performance', 'pulmonary', 'staging', 'diagnostics',
  'petct', 'vats', 'preop', 'operative', 'anesthesia', 'recovery', 'adjuvant',
  'consent', 'tumorboard', 'backup', 'alternatives', 'postop', 'results',
  'clinical', 'recommendations-section', 'notes-status',
];
const DATE_FIELDS = ['date'];
const SENTENCE_FIELDS = ['consultationReason', 'adlStatus', 'findings', 'assessment', 'plan', 'notes'];
const STRING_FIELDS = ['consultationReason', 'surgeonCredentials', 'adlStatus', 'type', 'provider', 'facility', 'findings', 'assessment', 'plan', 'notes', 'status'];
const OBJECT_FIELDS = ['performanceStatus', 'pulmonaryFunction', 'tumorStaging', 'mediastinoscopy', 'bronchoscopy', 'vatsAssessment', 'preoperativePreparation', 'operativeDetails', 'adjuvantTherapy', 'petCtFindings', 'informedConsent', 'tumorBoard', 'anesthesiaPlanning', 'enhancedRecoveryProtocol', 'postoperativeOrders', 'results'];
const ARRAY_FIELDS = ['backupSurgicalPlan', 'alternativeTreatments', 'recommendations'];
const COMMA_SPLIT_FIELDS = new Set([
  'performanceStatus.description',
  'informedConsent.patientDecision',
  'backupSurgicalPlan.1.plan',
  'assessment',
]);
const PERIOD_SPLIT_FIELDS = new Set([
  'consultationReason', 'adlStatus', 'findings', 'assessment', 'plan', 'notes',
  'informedConsent.patientDecision',
]);

const KEY_OVERRIDES = {
  ecog: 'ECOG', fev1: 'FEV1', fvc: 'FVC', dlco: 'DLCO', tnm: 'TNM', tnmStage: 'TNM Stage',
  egfr: 'EGFR', alk: 'ALK', ros1: 'ROS1', 'pd-l1': 'PD-L1', suvMax: 'SUV Max', suv: 'SUV',
  vats: 'VATS', adl: 'ADL', icu: 'ICU', nsclc: 'NSCLC', sbrt: 'SBRT', afib: 'AFib',
  ct: 'CT', pet: 'PET', mri: 'MRI', id: 'ID',
};
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const lower = String(key).toLowerCase();
  if (KEY_OVERRIDES[lower]) return KEY_OVERRIDES[lower];
  if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const formatDate = (d) => { if (!d) return ''; try { const dt = new Date(d.$date || d); if (isNaN(dt.getTime())) return String(d); return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
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
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };

const splitEditableClauses = (value, fieldPath) => {
  const source = String(value ?? '');
  const splitCommas = COMMA_SPLIT_FIELDS.has(fieldPath);
  const splitPeriods = PERIOD_SPLIT_FIELDS.has(fieldPath);
  const parts = [];
  let current = '';
  let depth = 0;
  const push = () => { if (current.trim()) parts.push(current.trim()); current = ''; };
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '(') depth += 1;
    if (character === ')') depth = Math.max(0, depth - 1);
    const next = source[index + 1] || '';
    const previousWord = current.trim().match(/([A-Za-z]+)$/)?.[1] || '';
    const safePeriod = character === '.' && splitPeriods && depth === 0 && /\s/.test(next)
      && !['Mr', 'Mrs', 'Ms', 'Dr', 'St', 'Jr', 'Sr', 'Prof', 'Rev', 'Gen', 'Col', 'Sgt', 'vs', 'etc'].includes(previousWord);
    const safeComma = character === ',' && splitCommas && depth === 0;
    const safeSemicolon = character === ';' && depth === 0;
    if (safePeriod || safeComma || safeSemicolon) {
      push();
      while (/\s/.test(source[index + 1] || '')) index += 1;
    } else current += character;
  }
  push();
  return parts.length ? parts : [source];
};

/* recursive node: object -> labelled nested block; array -> numbered/recursive items; scalar -> value line */
const renderNode = (label, value, keyPath, depth, fieldPath) => {
  if (isEmptyDeep(value)) return null;
  const LabelTag = depth > 0 ? styles.subLabel : styles.fieldLabel;
  if (isScalar(value)) {
    const displayValue = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value.trim()) ? formatDate(value) : fmtScalar(value);
    const parts = splitEditableClauses(displayValue, fieldPath);
    return (
      <View key={keyPath}>
        {label ? <Text style={LabelTag}>{label}</Text> : null}
        {parts.map((part, index) => <Text key={`${keyPath}-${index}`} style={styles.value}>{`${index + 1}. ${part}`}</Text>)}
      </View>
    );
  }
  if (Array.isArray(value)) {
    const items = value.filter(v => !isEmptyDeep(v));
    if (items.length === 0) return null;
    return (
      <View key={keyPath}>
        {label ? <Text style={LabelTag}>{label}</Text> : null}
        <View style={label ? styles.nested : undefined}>
          {items.flatMap((v, i) => isScalar(v)
            ? splitEditableClauses(fmtScalar(v), `${fieldPath}.${i}`).map((part, partIndex) => <Text key={`${i}-${partIndex}`} style={styles.value}>{`${i + 1}${partIndex ? `.${partIndex + 1}` : ''}. ${part}`}</Text>)
            : [<View key={i}>{renderNode('', v, `${keyPath}-${i}`, depth + 1, `${fieldPath}.${i}`)}</View>])}
        </View>
      </View>
    );
  }
  const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  return (
    <View key={keyPath}>
      {label ? <Text style={LabelTag}>{label}</Text> : null}
      <View style={label ? styles.nested : undefined}>{entries.map(([k, v]) => renderNode(humanizeKey(k), v, `${keyPath}-${k}`, depth + 1, `${fieldPath}.${k}`))}</View>
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

/* Rule #74 (per-field gating): render a field as wrap-gated View(s) — EACH View is one wrap unit.
   sectionTitle goes INSIDE the first View (isFirst) — never a sibling. Returns an ARRAY of Views. */
const renderField = (record, field, sectionTitle, isFirst) => {
  const val = record[field];
  if (!hasVal(val)) return [];
  const label = FIELD_LABELS[field] || field;
  const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
  const titleNode = isFirst ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null;

  if (DATE_FIELDS.includes(field)) {
    return [(
      <View key={field} style={styles.fieldGroup} wrap={false}>
        {titleNode}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        <Text style={styles.value}>{formatDate(val)}</Text>
      </View>
    )];
  }

  if (ARRAY_FIELDS.includes(field)) {
    const items = Array.isArray(val) ? val.filter(v => !isEmptyDeep(v)) : [];
    if (items.length === 0) return [];
    let arrayRowNumber = 1;
    const itemNodes = items.flatMap((item, index) => isScalar(item)
      ? splitEditableClauses(fmtScalar(item), `${field}.${index}`).map((part, partIndex) => (
        <Text key={`${index}-${partIndex}`} style={styles.value}>{`${arrayRowNumber++}. ${part}`}</Text>
      ))
      : [<View key={index}>{renderNode('', item, `${field}-${index}`, 1, `${field}.${index}`)}</View>]);
    return [
      <View key={`${field}-first`} style={styles.fieldGroup} wrap={false}>
        {titleNode}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {itemNodes[0]}
      </View>,
      ...itemNodes.slice(1).map((node, index) => <View key={`${field}-rest-${index}`} style={styles.fieldGroup}>{node}</View>),
    ];
  }

  if (OBJECT_FIELDS.includes(field)) {
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return [];
    return entries.map(([k, v], i) => {
      const rows = countRows(v);
      return (
        <View key={`${field}-${k}`} style={styles.fieldGroup} wrap={rows <= 8 ? false : true}>
          {i === 0 ? titleNode : null}
          {i === 0 && showLabel ? <Text style={styles.fieldLabel}>{label}</Text> : null}
          {renderNode(humanizeKey(k), v, `${field}-${k}`, 1, `${field}.${k}`)}
        </View>
      );
    });
  }

  /* string — narrative fields split into sentences */
  const strVal = fmtVal(val);
  const sentences = splitEditableClauses(strVal, field);
  if (sentences.length > 1) {
    return [(
      <View key={field} style={styles.fieldGroup} wrap={sentences.length <= 8 ? false : true}>
        {titleNode}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {sentences.map((s, sIdx) => (<Text key={sIdx} style={styles.value}>{sIdx + 1}. {s}</Text>))}
      </View>
    )];
  }
  return [(
    <View key={field} style={styles.fieldGroup} wrap={false}>
      {titleNode}
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      <Text style={styles.value}>{strVal}</Text>
    </View>
  )];
};

const ThoracicSurgeryAssessmentDocumentPDFTemplate = ({ document: data }) => {
  let records = [];
  if (Array.isArray(data)) {
    if (data.length === 1 && data[0]?.thoracic_surgery_assessment) records = Array.isArray(data[0].thoracic_surgery_assessment) ? data[0].thoracic_surgery_assessment : [data[0].thoracic_surgery_assessment];
    else records = data;
  } else if (data?.thoracic_surgery_assessment) records = Array.isArray(data.thoracic_surgery_assessment) ? data.thoracic_surgery_assessment : [data.thoracic_surgery_assessment];
  else if (data?.documentData) { const dd = data.documentData; if (Array.isArray(dd)) records = dd; else if (dd?.thoracic_surgery_assessment) records = Array.isArray(dd.thoracic_surgery_assessment) ? dd.thoracic_surgery_assessment : [dd.thoracic_surgery_assessment]; else if (dd && typeof dd === 'object') records = [dd]; }
  else if (data && typeof data === 'object') records = [data];
  records = (records || []).filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><Text style={styles.documentTitle}>Thoracic Surgery Assessment</Text><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Thoracic Surgery Assessment</Text>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <View wrap={false}>
              <Text style={styles.recordTitle}>{`Thoracic Surgery Assessment ${String(record._recordNumber || idx + 1)}`}</Text>
            </View>

            {/* Rule #74 (per-field gating): section View only provides spacing and always FLOWS.
                Each field is its own wrap-gated unit (via renderField), with the sectionTitle embedded
                INSIDE the first present field's View (anti-orphan). */}
            {SECTION_ORDER.map((sid) => {
              const fields = SECTION_FIELDS[sid];
              const presentFields = fields.filter(f => hasVal(record[f]));
              if (presentFields.length === 0) return null;
              const title = SECTION_TITLES[sid];
              return (
                <View key={sid} style={styles.section}>
                  {presentFields.flatMap((f, fi) => renderField(record, f, title, fi === 0))}
                </View>
              );
            })}
          </View>
        ))}
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} fixed />
      </Page>
    </Document>
  );
};

export default ThoracicSurgeryAssessmentDocumentPDFTemplate;
