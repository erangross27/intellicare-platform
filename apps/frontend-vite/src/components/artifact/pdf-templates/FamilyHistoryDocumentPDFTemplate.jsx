/**
 * FamilyHistoryDocumentPDFTemplate.jsx
 * July 2026 — Helvetica — LETTER size — BLACK & WHITE ONLY (#000000, no blue)
 * Data collection: family_history
 *
 * Rule #74 — each section = ONE <View> with a conditional BOOLEAN wrap (never the unbreakable ternary idiom);
 * sectionTitle rendered INSIDE the first present field's box, never a standalone sibling;
 * box-free — underlines only (documentTitle 2pt, sectionTitle 1pt black, fieldLabel 0.5pt #999).
 *
 * Field handling mirrors the JSX:
 *   - NARRATIVE STRINGS  → numbered sentences when multi-sentence, else plain value
 *   - ARRAYS OF STRINGS  → numbered list items (sibling + condition categories + genetic testing)
 *   - BOOLEAN            → Yes / No (rendered whenever the key is defined, even when false)
 *   - createdAt is an ingestion timestamp — NEVER rendered as a record date.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', marginBottom: 16, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 20 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 10 },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldBox: { marginBottom: 8 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  fieldValue: { fontSize: 14, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  noDataText: { fontSize: 12, color: '#000000', textAlign: 'center', marginTop: 40 },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, fontSize: 10, color: '#666666', borderTopWidth: 0.5, borderTopColor: '#999999', paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 10, color: '#666666' },
});

/* ======= FIELD CONFIG (mirror JSX) ======= */
const SECTION_TITLES = {
  immediate: 'Immediate Family',
  conditions: 'Medical Conditions by Category',
  additional: 'Additional Information',
};

const FIELD_LABELS = {
  maternalHistory: 'Maternal History',
  paternalHistory: 'Paternal History',
  siblingHistory: 'Sibling History',
  grandparentalHistory: 'Grandparental History',
  psychiatricFamilyHistory: 'Psychiatric',
  familialCancerHistory: 'Cancer',
  cardiovascularFamilyHistory: 'Cardiovascular',
  diabetesFamilyHistory: 'Diabetes',
  neurologicalFamilyHistory: 'Neurological',
  geneticDisorders: 'Genetic Disorders',
  autoimmuneFamilyHistory: 'Autoimmune',
  endocrineFamilyHistory: 'Endocrine',
  renalFamilyHistory: 'Renal',
  pulmonaryFamilyHistory: 'Pulmonary',
  gastrointestinalFamilyHistory: 'Gastrointestinal',
  consanguinity: 'Consanguinity',
  pedigreeAvailable: 'Pedigree Available',
  longevityPatterns: 'Longevity Patterns',
  geneticTestingHistory: 'Genetic Testing History',
  adoptionHistory: 'Adoption History',
  ethnicityHealthRisks: 'Ethnicity Health Risks',
  ageOfOnsetPatterns: 'Age of Onset Patterns',
  reproductiveHistory: 'Reproductive History',
};

const SECTION_FIELDS = {
  immediate: ['maternalHistory', 'paternalHistory', 'siblingHistory', 'grandparentalHistory'],
  conditions: ['psychiatricFamilyHistory', 'familialCancerHistory', 'cardiovascularFamilyHistory', 'diabetesFamilyHistory', 'neurologicalFamilyHistory', 'geneticDisorders', 'autoimmuneFamilyHistory', 'endocrineFamilyHistory', 'renalFamilyHistory', 'pulmonaryFamilyHistory', 'gastrointestinalFamilyHistory'],
  additional: ['consanguinity', 'pedigreeAvailable', 'longevityPatterns', 'geneticTestingHistory', 'adoptionHistory', 'ethnicityHealthRisks', 'ageOfOnsetPatterns', 'reproductiveHistory'],
};

const NARRATIVE_STRING_FIELDS = ['maternalHistory', 'paternalHistory', 'grandparentalHistory', 'longevityPatterns', 'adoptionHistory', 'ethnicityHealthRisks', 'ageOfOnsetPatterns', 'reproductiveHistory'];
const ARRAY_FIELDS = ['siblingHistory', 'psychiatricFamilyHistory', 'familialCancerHistory', 'cardiovascularFamilyHistory', 'diabetesFamilyHistory', 'neurologicalFamilyHistory', 'geneticDisorders', 'autoimmuneFamilyHistory', 'endocrineFamilyHistory', 'renalFamilyHistory', 'pulmonaryFamilyHistory', 'gastrointestinalFamilyHistory', 'geneticTestingHistory'];
const BOOL_FIELDS = ['consanguinity', 'pedigreeAvailable'];

/* ======= UTILS ======= */
const hasArray = (v) => Array.isArray(v) && v.filter(x => x !== null && x !== undefined && String(x).trim() !== '').length > 0;

const hasString = (v) => {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim() !== '';
  return String(v).trim() !== '';
};

const fieldHasVal = (fn, v) => {
  if (BOOL_FIELDS.includes(fn)) return v !== undefined && v !== null;
  if (ARRAY_FIELDS.includes(fn)) return hasArray(v);
  return hasString(v);
};

const fieldVisible = (record, fn) => fieldHasVal(fn, record[fn]);

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (Array.isArray(val)) return val.join(', ');
  return String(val);
};

/* ======= SENTENCE SPLIT (paren-aware, title-protected) — mirrors the JSX splitBySemicolon ======= */
const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;](?:\s+)/)
    .map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

/* ======= RENDER FIELD — sectionTitle INSIDE the field box (anti-orphan) ======= */
const renderField = (record, fn, sectionTitle) => {
  const val = record[fn];
  if (!fieldVisible(record, fn)) return null;
  const label = FIELD_LABELS[fn] || fn;

  let body;
  if (BOOL_FIELDS.includes(fn)) {
    body = <Text style={styles.fieldValue}>{val ? 'Yes' : 'No'}</Text>;
  } else if (ARRAY_FIELDS.includes(fn)) {
    const items = (Array.isArray(val) ? val : [val]).filter(x => x !== null && x !== undefined && String(x).trim() !== '');
    body = items.map((item, i) => (
      <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
    ));
  } else {
    const strVal = safeString(val);
    const sentences = splitBySentence(strVal);
    if (NARRATIVE_STRING_FIELDS.includes(fn) && sentences.length > 1) {
      body = sentences.map((s, i) => (
        <Text key={i} style={styles.listItem}>{i + 1}. {s.replace(/[;.]+$/, '').trim()}</Text>
      ));
    } else {
      body = <Text style={styles.fieldValue}>{strVal}</Text>;
    }
  }

  return (
    <View key={fn} style={{ marginBottom: 6 }}>
      {sectionTitle ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null}
      <Text style={styles.fieldLabel}>{label}</Text>
      {body}
    </View>
  );
};

/* ======= RENDER SECTION — title INSIDE first present field + conditional (boolean) wrap ======= */
const renderSection = (record, sid) => {
  const title = SECTION_TITLES[sid];
  const fields = SECTION_FIELDS[sid] || [];
  const presentFields = fields.filter(f => fieldVisible(record, f));
  if (presentFields.length === 0) return null;

  return (
    <View key={sid} style={styles.fieldBox} wrap={presentFields.length > 8}>
      {presentFields.map((f, i) => renderField(record, f, i === 0 ? title : null))}
    </View>
  );
};

/* ======= MAIN COMPONENT ======= */
const FamilyHistoryDocumentPDFTemplate = ({ document: docProp, data }) => {
  const input = docProp || data;

  const unwrap = (val) => {
    if (!val) return [];
    if (Array.isArray(val)) {
      return val.flatMap(item => {
        if (item?.document) return Array.isArray(item.document) ? item.document : [item.document];
        if (item?.data) return Array.isArray(item.data) ? item.data : [item.data];
        return [item];
      });
    }
    if (val.document) return Array.isArray(val.document) ? val.document : [val.document];
    if (val.data) return Array.isArray(val.data) ? val.data : [val.data];
    return [val];
  };

  const records = unwrap(input).filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Family History</Text>
          <Text style={styles.noDataText}>No family history records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Family History</Text>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <Text style={styles.recordTitle}>{safeString(`Family History ${idx + 1}`)}</Text>
            {renderSection(record, 'immediate')}
            {renderSection(record, 'conditions')}
            {renderSection(record, 'additional')}
          </View>
        ))}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Protected Health Information (PHI) - Handle according to HIPAA guidelines</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
};

export default FamilyHistoryDocumentPDFTemplate;
