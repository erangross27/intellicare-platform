/**
 * ChiropracticConsultationDocumentPDFTemplate.jsx
 * Box-free line-based layout (ConsultationNotes donor) — LETTER size — B&W.
 * react-pdf 4.5.1 engine rules: wrap props are BOOLEANS (explicit undefined = unbreakable);
 * recordContainer uses paddingBottom only (marginBottom → empty page 1); per-FIELD gates with the
 * section title inside the first field's unit + leaf glue (anti-orphan, 6a2d6af6). Text-block fields
 * split by sentence then guarded comma; labeled sentences become sub-label groups (parseLabeledSentences).
 * Collection: chiropractic_consultations
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
  recordMeta: { fontSize: 12, color: '#333333', marginTop: 4 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', textTransform: 'uppercase', letterSpacing: 0.5, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 3, marginBottom: 8 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#000000', borderBottomWidth: 0.5, borderBottomColor: '#999999', paddingBottom: 3, marginBottom: 4 },
  subLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 3, marginBottom: 2 },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 3, paddingLeft: 8 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
});

const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const safeArr = (v) => Array.isArray(v) ? v.filter(Boolean) : [];
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) {
      if (!/\s/.test(text[i + 1] || '')) { current += ch; continue; }
      const rest = text.slice(i + 1).replace(/^\s+/, '');
      if (/^(and|or)\b/i.test(rest)) { current += ch; continue; }
      if (/\b(and|or)\s*$/i.test(current)) { current += ch; continue; }
      const t = current.trim(); if (t) result.push(t); current = '';
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};
const parseLabeledSentences = (text) => {
  const groups = []; let nullGroup = null;
  splitBySentence(String(text || '')).forEach(sentence => {
    const ci = sentence.indexOf(':');
    const label = ci > 0 && ci < 60 && !sentence.substring(0, ci).includes('.') ? sentence.substring(0, ci).trim() : null;
    if (label) { groups.push({ label, items: splitByComma(sentence.substring(ci + 1).trim()).map(p => p.replace(/[.;]+$/, '').trim()).filter(Boolean) }); nullGroup = null; }
    else { if (!nullGroup) { nullGroup = { label: null, items: [] }; groups.push(nullGroup); } splitByComma(sentence).forEach(p => { const t = p.replace(/[.;]+$/, '').trim(); if (t) nullGroup.items.push(t); }); }
  });
  return groups;
};

const FL = {
  chiefComplaint: 'Chief Complaint', painIntensityNRS: 'Pain Intensity (NRS)', oswestryDisabilityIndex: 'Oswestry Disability Index', neckDisabilityIndex: 'Neck Disability Index',
  spinalRangeOfMotion: 'Spinal Range of Motion', straightLegRaiseTest: 'Straight Leg Raise Test', kempsTestFindings: "Kemp's Test Findings",
  dermatomeAssessment: 'Dermatome Assessment', deepTendonReflexes: 'Deep Tendon Reflexes', myotomeGrading: 'Myotome Grading',
  palpationFindings: 'Palpation Findings', posturalAnalysis: 'Postural Analysis',
  cobbAngleMeasurement: 'Cobb Angle', cervicalLordosisDegrees: 'Cervical Lordosis', lumbarLordosisDegrees: 'Lumbar Lordosis', discHeightAssessment: 'Disc Height Assessment',
  cavitationAchieved: 'Cavitation Achieved', softTissueTherapy: 'Soft Tissue Therapy', treatmentFrequencyRecommendation: 'Treatment Plan',
};
const TEXT_BLOCK_FIELDS = new Set(['chiefComplaint', 'discHeightAssessment', 'softTissueTherapy', 'spinalRangeOfMotion', 'myotomeGrading', 'palpationFindings', 'posturalAnalysis', 'treatmentFrequencyRecommendation', 'straightLegRaiseTest', 'kempsTestFindings', 'dermatomeAssessment', 'deepTendonReflexes']);
const HIDE_ZERO_FIELDS = new Set(['cobbAngleMeasurement', 'cervicalLordosisDegrees', 'lumbarLordosisDegrees']);
const hasFieldVal = (fn, v) => { if (!hasVal(v)) return false; if (HIDE_ZERO_FIELDS.has(fn) && typeof v === 'number' && v === 0) return false; return true; };

const blockRowCount = (value) => { const g = parseLabeledSentences(String(value)); return g.reduce((s, gr) => s + gr.items.length + (gr.label ? 1 : 0), 0); };
const fieldRows = (fn, value) => TEXT_BLOCK_FIELDS.has(fn) ? blockRowCount(value) + 1 : 2;

/* one field as a wrap-gated unit; section title rides inside when isFirst */
const renderFieldUnit = (fn, value, sTitle, isFirst) => {
  const rows = fieldRows(fn, value) + (isFirst ? 1 : 0);
  const showFieldLabel = (FL[fn] || fn).toLowerCase() !== String(sTitle).toLowerCase();
  let inner;
  if (TEXT_BLOCK_FIELDS.has(fn)) {
    let n = 0;
    inner = (
      <View style={{ marginBottom: 6 }}>
        {showFieldLabel && <Text style={styles.fieldLabel}>{FL[fn] || fn}</Text>}
        {parseLabeledSentences(String(value)).map((g, gi) => {
          if (g.label) n = 0;
          const start = n; n += g.items.length;
          return (
            <View key={gi}>
              {g.label && <Text style={styles.subLabel}>{g.label}</Text>}
              {g.items.map((it, i) => <Text key={i} style={styles.listItem}>{start + i + 1}. {it}</Text>)}
            </View>
          );
        })}
      </View>
    );
  } else {
    inner = (
      <View style={{ marginBottom: 6 }}>
        {showFieldLabel && <Text style={styles.fieldLabel}>{FL[fn] || fn}</Text>}
        <Text style={styles.listItem}>1. {fmtVal(value)}</Text>
      </View>
    );
  }
  // A single narrative field (+ its section title) fits one page, so keep it wrap={false} to glue the
  // title to real content (prevents the "SPINAL ASSESSMENT" title orphan). Only wrap a genuinely huge
  // field that could exceed a page on its own.
  return (
    <View key={fn} wrap={rows > 22 ? true : false}>
      {isFirst && <Text style={styles.sectionTitle}>{sTitle}</Text>}
      {inner}
    </View>
  );
};

const renderFieldSection = (sTitle, fields, record) => {
  const visible = fields.filter(f => hasFieldVal(f, record[f]));
  if (visible.length === 0) return null;
  return (<View style={styles.section}>{visible.map((f, i) => renderFieldUnit(f, record[f], sTitle, i === 0))}</View>);
};

const renderArraySection = (sTitle, items) => {
  const arr = safeArr(items);
  if (arr.length === 0) return null;
  // array item guarded-comma-splits into rows ONLY when >=3 parts (genuine list); else keep whole
  // (grammatical dosing comma stays with the item) — mirrors the JSX (Rule #73).
  const rows = [];
  arr.forEach(it => { const parts = splitByComma(String(it)); (parts.length >= 3 ? parts : [String(it)]).forEach(p => { const t = p.replace(/[.;]+$/, '').trim(); if (t) rows.push(t); }); });
  return (
    <View style={styles.section} wrap={rows.length + 1 > 8 ? true : false}>
      <Text style={styles.sectionTitle}>{sTitle}</Text>
      {rows.map((t, i) => <Text key={i} style={styles.listItem}>{i + 1}. {t}</Text>)}
    </View>
  );
};

const ChiropracticConsultationDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.chiropractic_consultations) return Array.isArray(r.chiropractic_consultations) ? r.chiropractic_consultations : [r.chiropractic_consultations];
      if (r?.chiropractic_consultation) return Array.isArray(r.chiropractic_consultation) ? r.chiropractic_consultation : [r.chiropractic_consultation];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.chiropractic_consultations) return Array.isArray(dd.chiropractic_consultations) ? dd.chiropractic_consultations : [dd.chiropractic_consultations]; return [dd]; }
      return r;
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>Chiropractic Consultation</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Chiropractic Consultation</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Chiropractic Consultation ${idx + 1}`}</Text>
              {(record.date || record.createdAt) && <Text style={styles.recordMeta}>{formatDate(record.date || record.createdAt)}</Text>}
            </View>
            {renderFieldSection('Chief Complaint', ['chiefComplaint'], record)}
            {renderFieldSection('Pain & Disability Scores', ['painIntensityNRS', 'oswestryDisabilityIndex', 'neckDisabilityIndex'], record)}
            {renderArraySection('Vertebral Subluxation', record.vertebralSubluxationLevels)}
            {renderFieldSection('Spinal Assessment', ['spinalRangeOfMotion', 'straightLegRaiseTest', 'kempsTestFindings'], record)}
            {renderFieldSection('Neurological Exam', ['dermatomeAssessment', 'deepTendonReflexes', 'myotomeGrading'], record)}
            {renderFieldSection('Palpation & Posture', ['palpationFindings', 'posturalAnalysis'], record)}
            {renderFieldSection('Imaging Measurements', ['cobbAngleMeasurement', 'cervicalLordosisDegrees', 'lumbarLordosisDegrees', 'discHeightAssessment'], record)}
            {renderArraySection('Adjustment Techniques', record.adjustmentTechniqueUsed)}
            {renderArraySection('Segments Adjusted', record.segmentsAdjusted)}
            {(hasVal(record.cavitationAchieved) || hasVal(record.softTissueTherapy)) && renderFieldSection('Treatment Details', ['cavitationAchieved', 'softTissueTherapy'], record)}
            {renderArraySection('Therapeutic Modalities', record.therapeuticModalitiesApplied)}
            {renderArraySection('Rehabilitative Exercises', record.rehabilitativeExercisesPrescribed)}
            {renderArraySection('Contraindications', record.contraindications)}
            {renderFieldSection('Treatment Plan', ['treatmentFrequencyRecommendation'], record)}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default ChiropracticConsultationDocumentPDFTemplate;
