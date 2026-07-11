/**
 * CascadeTestingProtocolDocumentPDFTemplate.jsx
 * Helvetica 22/13/11pt — LETTER size — US medical platform
 * Collection: cascade_testing_protocol
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/* Box-free line-based layout (mirrors user-approved ConsultationNotes style):
   no backgroundColor/border boxes; underline under section titles (1pt black) and
   field sub-labels (0.5pt gray); bigger fonts (page 15 / title 26 / section 16 / values 14). */
const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 15, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, borderBottomWidth: 3, borderBottomColor: '#000000', paddingBottom: 14 },
  title: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 2 },
  recordContainer: { marginBottom: 28, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#cccccc' },
  recordHeader: { marginBottom: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold' },
  recordMeta: { fontSize: 13, color: '#333333', marginTop: 4 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 3 },
  fieldBox: { marginBottom: 8 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  fieldValue: { fontSize: 14, lineHeight: 1.5, color: '#000000', paddingLeft: 8 },
  listItem: { fontSize: 14, lineHeight: 1.5, marginBottom: 2, paddingLeft: 8 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 16, color: '#666666' },
});

const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
// number 0 is a "not assessed" sentinel for the percentage/score fields -> treat as empty (matches main document)
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return v !== 0; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const safeArr = (v) => Array.isArray(v) ? v.filter(Boolean) : [];
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/[;.]\s+/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };

const FL = {
  geneticCondition: 'Genetic Condition', inheritancePattern: 'Inheritance Pattern', clinicalPenetrance: 'Clinical Penetrance (%)', carrierStatus: 'Carrier Status',
  testingMethodology: 'Testing Methodology', targetMutation: 'Target Mutation', testingLaboratory: 'Testing Laboratory',
  priorRiskCounseling: 'Prior Risk Counseling', informedConsentDate: 'Informed Consent Date', geneticCounselorInvolvement: 'Genetic Counselor Involvement', participationConsent: 'Participation Consent',
  preTestProbability: 'Pre-Test Probability (%)', riskStratificationScore: 'Risk Stratification Score', familyHistoryAccuracy: 'Family History Accuracy',
  indexCaseIdentifier: 'Index Case Identifier', familialRelationshipToIndex: 'Familial Relationship', pedigreePosition: 'Pedigree Position', cascadeRecruitmentMethod: 'Cascade Recruitment Method',
  surveillanceProtocol: 'Surveillance Protocol', psychosocialSupport: 'Psychosocial Support',
  disclosurePreferences: 'Disclosure Preferences', followUpSchedule: 'Follow-Up Schedule',
};
const COMMA_SPLIT_FIELDS = new Set(['surveillanceProtocol', 'psychosocialSupport']);
const SENTENCE_SPLIT_FIELDS = new Set(['disclosurePreferences', 'followUpSchedule']);

/* splitByComma: top-level commas only — NOT inside parentheses, NOT when "and"/"or"
   sits right before or right after the comma, NOT without a following space ("$18,000") */
const splitByComma = (text) => {
  const s = String(text || ''); const out = []; let cur = ''; let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(') { depth++; cur += ch; continue; }
    if (ch === ')') { depth = Math.max(0, depth - 1); cur += ch; continue; }
    if (ch === ',' && depth === 0) {
      if (!/\s/.test(s[i + 1] || '')) { cur += ch; continue; }
      const rest = s.slice(i + 1).replace(/^\s+/, '');
      if (/^(and|or)\b/i.test(rest)) { cur += ch; continue; }
      if (/\b(and|or)\s*$/i.test(cur)) { cur += ch; continue; }
      const t = cur.trim(); if (t) out.push(t); cur = ''; continue;
    }
    cur += ch;
  }
  const t = cur.trim(); if (t) out.push(t);
  return out.length ? out : (s.trim() ? [s.trim()] : []);
};

/* single-name rule: hide the field label when it duplicates the section title */
const showFieldLabel = (f, sTitle) => (FL[f] || f).trim().toLowerCase() !== String(sTitle || '').trim().toLowerCase();

/* Title INSIDE fieldBox + conditional wrap on fieldBox; every value numbered */
const renderFieldSection = (sTitle, fields, record) => {
  const visible = fields.filter(f => hasVal(record[f]));
  if (visible.length === 0) return null;
  return (
    <View style={styles.section}>
      <View style={styles.fieldBox} wrap={visible.length > 8 ? undefined : false}>
        <Text style={styles.sectionTitle}>{sTitle}</Text>
        {visible.map((f, i) => (
          <View key={i} style={{ marginBottom: 4 }}>
            {showFieldLabel(f, sTitle) && <Text style={styles.fieldLabel}>{FL[f] || f}</Text>}
            <Text style={styles.listItem}>1. {f === 'informedConsentDate' ? formatDate(record[f]) : fmtVal(record[f])}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

/* Comma-split fields → numbered items */
const renderCommaSplitFieldSection = (sTitle, fn, record) => {
  if (!hasVal(record[fn])) return null;
  const parts = splitByComma(record[fn]);
  return (
    <View style={styles.section}>
      <View style={styles.fieldBox} wrap={parts.length > 8 ? undefined : false}>
        <Text style={styles.sectionTitle}>{sTitle}</Text>
        {showFieldLabel(fn, sTitle) && <Text style={styles.fieldLabel}>{FL[fn] || fn}</Text>}
        {parts.map((p, i) => (
          <Text key={i} style={styles.listItem}>{i + 1}. {p}</Text>
        ))}
      </View>
    </View>
  );
};

/* Sentence-split fields → numbered items */
const renderSentenceSplitFieldSection = (sTitle, fn, record) => {
  if (!hasVal(record[fn])) return null;
  const sentences = splitBySentence(String(record[fn]));
  if (sentences.length === 0) return null;
  return (
    <View style={styles.section}>
      <View style={styles.fieldBox} wrap={sentences.length > 8 ? undefined : false}>
        <Text style={styles.sectionTitle}>{sTitle}</Text>
        {showFieldLabel(fn, sTitle) && <Text style={styles.fieldLabel}>{FL[fn] || fn}</Text>}
        {sentences.map((s, i) => (
          <Text key={i} style={styles.listItem}>{i + 1}. {s}</Text>
        ))}
      </View>
    </View>
  );
};

/* Array → numbered list */
const renderArraySection = (sTitle, items) => {
  const arr = safeArr(items);
  if (arr.length === 0) return null;
  return (
    <View style={styles.section}>
      <View style={styles.fieldBox} wrap={arr.length > 8 ? undefined : false}>
        <Text style={styles.sectionTitle}>{sTitle}</Text>
        {arr.map((it, i) => (
          <Text key={i} style={styles.listItem}>{i + 1}. {it}</Text>
        ))}
      </View>
    </View>
  );
};

const CascadeTestingProtocolDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.cascade_testing_protocol) return Array.isArray(r.cascade_testing_protocol) ? r.cascade_testing_protocol : [r.cascade_testing_protocol];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.cascade_testing_protocol) return Array.isArray(dd.cascade_testing_protocol) ? dd.cascade_testing_protocol : [dd.cascade_testing_protocol]; return [dd]; }
      return r;
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.title}>Cascade Testing Protocol</Text></View>
          <Text style={styles.emptyState}>No records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.title}>Cascade Testing Protocol</Text>
        </View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Cascade Testing Protocol ${idx + 1}`}</Text>
              {record.date && <Text style={styles.recordMeta}>{formatDate(record.date)}</Text>}
            </View>
            {renderFieldSection('Genetic Condition', ['geneticCondition', 'inheritancePattern', 'clinicalPenetrance', 'carrierStatus'], record)}
            {renderFieldSection('Testing Details', ['testingMethodology', 'targetMutation', 'testingLaboratory'], record)}
            {renderFieldSection('Consent & Counseling', ['priorRiskCounseling', 'informedConsentDate', 'geneticCounselorInvolvement', 'participationConsent'], record)}
            {renderFieldSection('Risk Assessment', ['preTestProbability', 'riskStratificationScore', 'familyHistoryAccuracy'], record)}
            {renderFieldSection('Index Case & Family', ['indexCaseIdentifier', 'familialRelationshipToIndex', 'pedigreePosition', 'cascadeRecruitmentMethod'], record)}
            {renderCommaSplitFieldSection('Surveillance Protocol', 'surveillanceProtocol', record)}
            {renderArraySection('Phenotypic Screening', record.phenotypicScreeningResults)}
            {renderCommaSplitFieldSection('Psychosocial Support', 'psychosocialSupport', record)}
            {renderSentenceSplitFieldSection('Disclosure Preferences', 'disclosurePreferences', record)}
            {renderArraySection('Preventive Interventions', record.preventiveInterventions)}
            {renderSentenceSplitFieldSection('Follow-Up Schedule', 'followUpSchedule', record)}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default CascadeTestingProtocolDocumentPDFTemplate;
