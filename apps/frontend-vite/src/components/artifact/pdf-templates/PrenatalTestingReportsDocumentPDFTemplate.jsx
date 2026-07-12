/**
 * PrenatalTestingReportsDocumentPDFTemplate.jsx
 * Box-free B&W underline theme — Helvetica — LETTER size — prenatal testing reports
 * Collection: prenatal_testing_reports
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, color: '#000000', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid', marginBottom: 20 },
  recordContainer: { marginBottom: 20 },
  recordHeader: { marginBottom: 12 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid', marginBottom: 8, marginTop: 6 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid', marginBottom: 3 },
  fieldValue: { fontSize: 14, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 2 },
  separator: { marginTop: 16, marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 14, color: '#000000', textAlign: 'center', marginTop: 40 },
});

/* ======= CONFIG (mirrors the JSX template) ======= */
const SECTION_TITLES = {
  'visit-info': 'Visit Information',
  'test-details': 'Test Details',
  'screening-results': 'Screening Results',
  'biochemistry': 'Biochemistry',
  'additional': 'Additional',
};

const FIELD_LABELS = {
  date: 'Date',
  provider: 'Provider',
  facility: 'Facility',
  gestationalAgeAtTest: 'Gestational Age at Test',
  maternalAge: 'Maternal Age',
  gravida: 'Gravida',
  para: 'Para',
  testType: 'Test Type',
  indicationForTesting: 'Indication for Testing',
  specimenType: 'Specimen Type',
  specimenCollectionDate: 'Specimen Collection Date',
  trisomy21Risk: 'Trisomy 21 Risk',
  trisomy18Risk: 'Trisomy 18 Risk',
  trisomy13Risk: 'Trisomy 13 Risk',
  neuralTubeDefectRisk: 'Neural Tube Defect Risk',
  fetalSex: 'Fetal Sex',
  karyotypeResult: 'Karyotype Result',
  fetalFraction: 'Fetal Fraction',
  afpLevel: 'AFP Level',
  hcgLevel: 'hCG Level',
  estriolLevel: 'Estriol Level',
  inhibinALevel: 'Inhibin A Level',
  pappALevel: 'PAPP-A Level',
  nuchalTranslucency: 'Nuchal Translucency',
  microarrayFindings: 'Microarray Findings',
  geneticCounselingProvided: 'Genetic Counseling Provided',
  confirmationTestingNeeded: 'Confirmation Testing Needed',
};

const SECTION_FIELDS = {
  'visit-info': ['date', 'provider', 'facility', 'gestationalAgeAtTest', 'maternalAge', 'gravida', 'para'],
  'test-details': ['testType', 'indicationForTesting', 'specimenType', 'specimenCollectionDate'],
  'screening-results': ['trisomy21Risk', 'trisomy18Risk', 'trisomy13Risk', 'neuralTubeDefectRisk', 'fetalSex', 'karyotypeResult', 'fetalFraction'],
  'biochemistry': ['afpLevel', 'hcgLevel', 'estriolLevel', 'inhibinALevel', 'pappALevel', 'nuchalTranslucency'],
  'additional': ['microarrayFindings', 'geneticCounselingProvided', 'confirmationTestingNeeded'],
};

const NUMBER_FIELDS = ['maternalAge', 'gravida', 'afpLevel', 'hcgLevel', 'estriolLevel', 'inhibinALevel', 'pappALevel', 'nuchalTranslucency', 'fetalFraction'];
/* MEANINGFUL_ZERO_FIELDS: numeric fields where 0 is a valid clinical value (gravida 0 = nulligravida).
   All other numeric fields (maternalAge, MoM levels, NT mm, fetal fraction %) treat 0 as "not measured" → hidden. */
const MEANINGFUL_ZERO_FIELDS = ['gravida'];
const ARRAY_FIELDS = ['microarrayFindings'];
const DATE_FIELDS = ['date', 'specimenCollectionDate'];

/* ======= UTILS ======= */
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr.$date || dateStr);
    if (isNaN(date.getTime())) return String(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(dateStr); }
};

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let s;
  if (typeof val === 'string') s = val;
  else if (typeof val === 'number') s = String(val);
  else if (typeof val === 'boolean') s = val ? 'Yes' : 'No';
  else if (typeof val === 'object' && val.$date) return formatDate(val.$date);
  else s = String(val);
  return s
    .replace(/×/g, 'x')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...');
};

const hasVal = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number') return true;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
};

const fmtVal = (v) => {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  return String(v || '');
};

/* numShows: hide numeric "not measured" zeros unless the field's zero is meaningful or it was doctor-edited */
const numShows = (fn, v, record) => {
  if (v === null || v === undefined || v === '') return false;
  const n = Number(v);
  if (Number.isNaN(n)) return false;
  if (n === 0) {
    if (MEANINGFUL_ZERO_FIELDS.includes(fn)) return true;
    return Array.isArray(record?.doctorEdits?.editedFields) && record.doctorEdits.editedFields.includes(fn);
  }
  return true;
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0 && /\s/.test(text[i + 1] || '') && !/^\s*\d{4}\b/.test(text.slice(i + 1))) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* formatSentenceLines: mirror of the JSX formatSentenceFieldLines (single running counter per field) */
const formatSentenceLines = (text) => {
  const sentences = splitBySentence(text);
  const lines = []; let n = 1;
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const parts = splitByComma(parsed.value);
      lines.push({ type: 'subtitle', text: safeString(parsed.label) });
      if (parts.length >= 2) {
        parts.forEach(item => lines.push({ type: 'item', text: safeString(item), num: n++ }));
      } else {
        lines.push({ type: 'item', text: safeString(parsed.value), num: n++ });
      }
    } else {
      lines.push({ type: 'item', text: safeString(s), num: n++ });
    }
  });
  return lines;
};

/* fieldView: one bare <View fieldBox> per field (label + value/list), or null when empty/hidden */
const fieldView = (record, f, key) => {
  const label = FIELD_LABELS[f] || f;
  const val = record[f];

  if (DATE_FIELDS.includes(f)) {
    if (!hasVal(val)) return null;
    return (
      <View key={key} style={styles.fieldBox}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValue}>{formatDate(val)}</Text>
      </View>
    );
  }

  if (NUMBER_FIELDS.includes(f)) {
    if (!numShows(f, val, record)) return null;
    return (
      <View key={key} style={styles.fieldBox}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValue}>{safeString(fmtVal(val))}</Text>
      </View>
    );
  }

  if (ARRAY_FIELDS.includes(f)) {
    const items = Array.isArray(val) ? val.filter(Boolean) : [];
    if (items.length === 0) return null;
    return (
      <View key={key} style={styles.fieldBox}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {items.map((item, i) => <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>)}
      </View>
    );
  }

  /* STRING (and any other scalar) */
  if (!hasVal(val)) return null;
  const strVal = safeString(fmtVal(val));
  const sentences = splitBySentence(strVal);
  if (sentences.length > 1) {
    const lines = formatSentenceLines(strVal);
    return (
      <View key={key} style={styles.fieldBox}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {lines.map((ln, i) => ln.type === 'subtitle'
          ? <Text key={i} style={styles.nestedSubtitle}>{ln.text}</Text>
          : <Text key={i} style={styles.listItem}>{ln.num}. {ln.text}</Text>)}
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

/* renderSection: anti-orphan — glue the section title + first visible field inside one wrap={false} View */
const renderSection = (record, sid, keyBase) => {
  const fields = SECTION_FIELDS[sid] || [];
  const views = fields.map((f, i) => fieldView(record, f, `${keyBase}-${sid}-${i}`)).filter(Boolean);
  if (views.length === 0) return null;
  const [first, ...rest] = views;
  return (
    <View key={`${keyBase}-${sid}`} style={styles.section}>
      <View wrap={false}>
        <Text style={styles.sectionTitle}>{SECTION_TITLES[sid]}</Text>
        {first}
      </View>
      {rest}
    </View>
  );
};

/* ======= COMPONENT ======= */
const PrenatalTestingReportsDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.prenatal_testing_reports) return Array.isArray(r.prenatal_testing_reports) ? r.prenatal_testing_reports : [r.prenatal_testing_reports];
      if (r?.documentData) {
        const dd = r.documentData;
        if (Array.isArray(dd)) return dd;
        if (dd?.prenatal_testing_reports) return Array.isArray(dd.prenatal_testing_reports) ? dd.prenatal_testing_reports : [dd.prenatal_testing_reports];
        return [dd];
      }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Prenatal Testing Reports</Text>
          <Text style={styles.noDataText}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Prenatal Testing Reports</Text>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer}>
            {index > 0 && <View style={styles.separator} />}
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Prenatal Testing Report ${index + 1}`}</Text>
            </View>
            {Object.keys(SECTION_FIELDS).map(sid => renderSection(record, sid, index))}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PrenatalTestingReportsDocumentPDFTemplate;
