/**
 * ColorectalSurgeryConsultationsDocumentPDFTemplate.jsx
 * Box-free line-based layout (ConsultationNotes donor) — LETTER size — B&W.
 * react-pdf 4.5.1 engine rules: wrap props are BOOLEANS (explicit undefined = unbreakable);
 * recordContainer paddingBottom only (marginBottom → empty page 1) + break={idx>0} (Rule #75, each
 * record starts a new page); sectionTitle rides INSIDE the first present field's View (anti-orphan, 6a2d6af6).
 * Sections/fields mirror the JSX + copy exactly (4-area mirror). Sentence fields render labeled groups:
 * a "Label: value" sentence → sub-label + comma-split value rows (>=3), numbering restarts at each labeled
 * group (unlabeled continues). ceaLevel 0 = tumor-marker extraction default → hidden.
 * Collection: colorectal_surgery_consultations
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000' },
  title: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1 },
  recordContainer: { paddingBottom: 8 },
  recordHeader: { marginBottom: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  recordMeta: { fontSize: 12, color: '#000000', marginTop: 4 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', textTransform: 'uppercase', letterSpacing: 0.5, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 3, marginBottom: 8 },
  fieldUnit: { marginBottom: 6 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#000000', borderBottomWidth: 0.5, borderBottomColor: '#999999', paddingBottom: 3, marginBottom: 4 },
  subLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', borderBottomWidth: 0.5, borderBottomColor: '#999999', paddingBottom: 2, marginBottom: 3, marginTop: 4 },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 3, paddingLeft: 8 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
});

const SECTION_DEFS = [
  ['Consultation Information', ['consultationDate', 'provider', 'facility', 'referralReason', 'urgency']],
  ['Diagnosis', ['chiefComplaint', 'primaryDiagnosis', 'diagnosisCode']],
  ['Diagnostic Findings', ['colonoscopyFindings', 'imagingFindings', 'biopsyResults', 'tumorLocation', 'tumorSize', 'clinicalStaging', 'ceaLevel']],
  ['Surgical Plan', ['recommendedProcedure', 'surgicalApproach', 'ostomyPlanned', 'neoadjuvantTherapy', 'bowelPreparation']],
  ['Patient Factors', ['comorbidities', 'asaClassification', 'anticoagulationStatus']],
  ['Counseling & Review', ['patientCounseling', 'multidisciplinaryReview']],
];
const FIELD_LABELS = {
  consultationDate: 'Consultation Date', provider: 'Provider', facility: 'Facility', referralReason: 'Referral Reason', urgency: 'Urgency',
  chiefComplaint: 'Chief Complaint', primaryDiagnosis: 'Primary Diagnosis', diagnosisCode: 'Diagnosis Codes',
  colonoscopyFindings: 'Colonoscopy Findings', imagingFindings: 'Imaging Findings', biopsyResults: 'Biopsy Results', tumorLocation: 'Tumor/Dysplasia Location', tumorSize: 'Tumor Size', clinicalStaging: 'Clinical Staging', ceaLevel: 'CEA Level',
  recommendedProcedure: 'Recommended Procedure', surgicalApproach: 'Surgical Approach', ostomyPlanned: 'Ostomy Planned', neoadjuvantTherapy: 'Neoadjuvant Therapy', bowelPreparation: 'Bowel Preparation',
  comorbidities: 'Comorbidities', asaClassification: 'ASA Classification', anticoagulationStatus: 'Anticoagulation Status',
  patientCounseling: 'Patient Counseling', multidisciplinaryReview: 'Multidisciplinary Review',
};
const SENTENCE_FIELDS = ['colonoscopyFindings', 'imagingFindings', 'biopsyResults', 'chiefComplaint', 'patientCounseling', 'multidisciplinaryReview', 'surgicalApproach'];
const ARRAY_FIELDS = ['comorbidities', 'diagnosisCode'];
const DATE_FIELDS = ['consultationDate'];
const HIDE_ZERO_FIELDS = ['ceaLevel'];

const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; };
const fieldHasVal = (fn, v) => { if (HIDE_ZERO_FIELDS.includes(fn) && (v === 0 || v === '0')) return false; return hasVal(v); };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
// Abbreviation+decimal guard: never break on "Dr. Smith", "vs. standard", "3.5 mg".
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [];
  const parts = []; let cur = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      const rest = text.slice(i + 1);
      if (!/^\s/.test(rest)) { cur += ch; continue; }
      if (/^\s+(?:and|or)\b/i.test(rest)) { cur += ch; continue; }
      if (/\d\s*$/.test(cur) && /^\s*\d{4}\b/.test(rest)) { cur += ch; continue; }
      parts.push(cur.trim()); cur = '';
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
};
const parseLabel = (sentence) => { const m = String(sentence).replace(/[;.]+$/, '').trim().match(/^([A-Za-z][A-Za-z0-9 /()-]{1,40}):\s*(.+)$/s); return m ? { label: m[1].trim(), value: m[2].trim() } : { label: null, value: String(sentence) }; };
// Sentence field → labeled groups (label + comma-split value rows when >=3; trailing [.;] stripped).
const buildSentenceGroups = (text) => splitBySentence(text).map(s => {
  const strip = (p) => p.replace(/[.;]+$/, '').trim();
  const p = parseLabel(s);
  const c = splitByComma(p.value);
  return { label: p.label, parts: (c.length >= 3 ? c : [p.value]).map(strip) };
});

// Build a field's display lines ({k:'label'|'sub'|'row', t}) or null when empty. Mirrors the JSX + copy.
const buildFieldLines = (record, f, title) => {
  const val = record[f];
  const label = FIELD_LABELS[f] || f;
  const showLabel = label.toLowerCase() !== title.toLowerCase();
  const lines = [];
  if (ARRAY_FIELDS.includes(f)) {
    const arr = (Array.isArray(val) ? val : []).filter(hasVal);
    if (arr.length === 0) return null;
    if (showLabel) lines.push({ k: 'label', t: label });
    arr.forEach((item, i) => lines.push({ k: 'row', t: `${i + 1}. ${String(item)}` }));
  } else if (SENTENCE_FIELDS.includes(f)) {
    if (!hasVal(val)) return null;
    if (showLabel) lines.push({ k: 'label', t: label });
    let n = 0;
    buildSentenceGroups(fmtVal(val)).forEach(g => {
      if (g.label) { lines.push({ k: 'sub', t: g.label }); n = 0; }
      g.parts.forEach(part => lines.push({ k: 'row', t: `${++n}. ${part}` }));
    });
  } else if (DATE_FIELDS.includes(f)) {
    if (!hasVal(val)) return null;
    if (showLabel) lines.push({ k: 'label', t: label });
    lines.push({ k: 'row', t: `1. ${formatDate(val)}` });
  } else {
    if (!fieldHasVal(f, val)) return null;
    if (showLabel) lines.push({ k: 'label', t: label });
    lines.push({ k: 'row', t: `1. ${fmtVal(val)}` });
  }
  return lines.length ? lines : null;
};

/* One field = one wrap-gated glue View; sectionTitle rides inside the FIRST present field's View.
   Threshold 20 keeps short fields whole (no title/sub-label orphans); long narrative fields flow. */
const renderFieldView = (lines, title, isFirst, keyId) => (
  <View key={keyId} style={styles.fieldUnit} wrap={lines.length > 20 ? true : false}>
    {isFirst ? <Text style={styles.sectionTitle}>{title}</Text> : null}
    {lines.map((ln, i) => {
      if (ln.k === 'label') return <Text key={i} style={styles.fieldLabel}>{ln.t}</Text>;
      if (ln.k === 'sub') return <Text key={i} style={styles.subLabel}>{ln.t}</Text>;
      return <Text key={i} style={styles.listItem}>{ln.t}</Text>;
    })}
  </View>
);

const renderSection = (record, title, fields) => {
  const units = fields.map(f => buildFieldLines(record, f, title)).filter(Boolean);
  if (units.length === 0) return null;
  return <View key={title} style={styles.section}>{units.map((lines, i) => renderFieldView(lines, title, i === 0, `${title}-${i}`))}</View>;
};

const ColorectalSurgeryConsultationsDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.colorectal_surgery_consultations) return Array.isArray(r.colorectal_surgery_consultations) ? r.colorectal_surgery_consultations : [r.colorectal_surgery_consultations];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.colorectal_surgery_consultations) return Array.isArray(dd.colorectal_surgery_consultations) ? dd.colorectal_surgery_consultations : [dd.colorectal_surgery_consultations]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>Colorectal Surgery Consultations</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Colorectal Surgery Consultations</Text></View>
        {records.map((record, idx) => (
          // Rule #75: every record after the first STARTS ON A NEW PAGE; never on record 0.
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Colorectal Surgery Consultation ${idx + 1}`}</Text>
              {record.consultationDate ? <Text style={styles.recordMeta}>{formatDate(record.consultationDate)}</Text> : null}
            </View>
            {SECTION_DEFS.map(([title, fields]) => renderSection(record, title, fields))}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default ColorectalSurgeryConsultationsDocumentPDFTemplate;
