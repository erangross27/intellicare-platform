/**
 * PrenatalTestingReportsDocumentPDFTemplate.jsx
 * March 2026 -- Helvetica -- LETTER size -- prenatal testing reports
 * Collection: prenatal_testing_reports
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#1f2937', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1f2937' },
  recordMeta: { fontSize: 11, color: '#6b7280', marginTop: 4 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 11, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#d1d5db', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 12, color: '#6b7280', textAlign: 'center', marginTop: 40 },
});

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
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'object' && val.$date) return formatDate(val.$date);
  return String(val);
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

/* MEANINGFUL_ZERO_FIELDS: numeric fields where 0 is a valid clinical value (gravida 0 = nulligravida).
   All other numeric fields (maternalAge, MoM levels, NT mm, fetal fraction %) treat 0 as "not measured" → hidden. */
const MEANINGFUL_ZERO_FIELDS = ['gravida'];
const numShows = (fn, v) => {
  if (v === null || v === undefined || v === '') return false;
  const n = Number(v);
  if (Number.isNaN(n)) return false;
  if (n === 0) return MEANINGFUL_ZERO_FIELDS.includes(fn);
  return true;
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
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
    if (ch === '(' || ch === '"' || ch === "'") { depth++; current += ch; }
    else if (ch === ')' || (depth > 0 && (ch === '"' || ch === "'"))) { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* renderFieldRow: label + value inside fieldBox */
const renderFieldRow = (label, value) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* renderSentenceField: parseLabel + comma-split with sequential counter */
const renderSentenceField = (label, text, counterRef) => {
  if (!hasVal(text)) return null;
  if (typeof text !== 'string') {
    return renderFieldRow(label, text);
  }
  const sentences = splitBySentence(fmtVal(text));
  if (sentences.length === 0) return null;

  const rows = [];
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const commaItems = splitByComma(parsed.value);
      if (commaItems.length >= 2) {
        rows.push({ type: 'subtitle', text: safeString(parsed.label) });
        commaItems.forEach(ci => { rows.push({ type: 'item', text: safeString(ci), num: counterRef.n++ }); });
      } else {
        rows.push({ type: 'item', text: safeString(s), num: counterRef.n++ });
      }
    } else {
      rows.push({ type: 'item', text: safeString(s), num: counterRef.n++ });
    }
  });

  const wrapProp = rows.length > 8 ? undefined : false;

  return (
    <View style={styles.fieldBox} wrap={wrapProp}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {rows.map((row, i) => {
        if (row.type === 'subtitle') {
          return <Text key={i} style={styles.nestedSubtitle}>{row.text}</Text>;
        }
        return <Text key={i} style={styles.listItem}>{row.num}. {row.text}</Text>;
      })}
    </View>
  );
};

/* renderArrayField */
const renderArrayField = (label, items, counterRef) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  const safeItems = items.filter(Boolean);
  if (safeItems.length === 0) return null;

  return (
    <View style={styles.fieldBox} wrap={safeItems.length > 8 ? undefined : false}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {safeItems.map((item, i) => (
        <Text key={i} style={styles.listItem}>{counterRef.n++}. {safeString(item)}</Text>
      ))}
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
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Prenatal Testing Reports</Text>
          </View>
          <Text style={styles.noDataText}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Document Header */}
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Prenatal Testing Reports</Text>
        </View>

        {records.map((record, index) => {
          const ctr = { n: 1 };

          return (
            <View key={index} style={styles.recordContainer}>
              {index > 0 && <View style={styles.separator} />}

              {/* Record Header */}
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>{`Prenatal Testing Report ${index + 1}`}</Text>
                {record.createdAt && <Text style={styles.recordMeta}>{formatDate(record.createdAt)}</Text>}
              </View>

              {/* 1. Visit Information */}
              {(hasVal(record.date) || hasVal(record.provider) || hasVal(record.facility) || hasVal(record.gestationalAgeAtTest) || numShows('maternalAge', record.maternalAge) || numShows('gravida', record.gravida) || hasVal(record.para)) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Visit Information</Text>
                  {hasVal(record.date) && renderFieldRow('Date', formatDate(record.date))}
                  {hasVal(record.provider) && renderFieldRow('Provider', record.provider)}
                  {hasVal(record.facility) && renderFieldRow('Facility', record.facility)}
                  {hasVal(record.gestationalAgeAtTest) && renderFieldRow('Gestational Age at Test', record.gestationalAgeAtTest)}
                  {numShows('maternalAge', record.maternalAge) && renderFieldRow('Maternal Age', record.maternalAge)}
                  {numShows('gravida', record.gravida) && renderFieldRow('Gravida', record.gravida)}
                  {hasVal(record.para) && renderFieldRow('Para', record.para)}
                </View>
              )}

              {/* 2. Test Details */}
              {(hasVal(record.testType) || hasVal(record.indicationForTesting) || hasVal(record.specimenType) || hasVal(record.specimenCollectionDate)) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Test Details</Text>
                  {renderSentenceField('Test Type', record.testType, ctr)}
                  {renderSentenceField('Indication for Testing', record.indicationForTesting, ctr)}
                  {renderSentenceField('Specimen Type', record.specimenType, ctr)}
                  {hasVal(record.specimenCollectionDate) && renderFieldRow('Specimen Collection Date', formatDate(record.specimenCollectionDate))}
                </View>
              )}

              {/* 3. Screening Results */}
              {(hasVal(record.trisomy21Risk) || hasVal(record.trisomy18Risk) || hasVal(record.trisomy13Risk) || hasVal(record.neuralTubeDefectRisk) || hasVal(record.fetalSex) || hasVal(record.karyotypeResult) || numShows('fetalFraction', record.fetalFraction)) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Screening Results</Text>
                  {renderSentenceField('Trisomy 21 Risk', record.trisomy21Risk, ctr)}
                  {renderSentenceField('Trisomy 18 Risk', record.trisomy18Risk, ctr)}
                  {renderSentenceField('Trisomy 13 Risk', record.trisomy13Risk, ctr)}
                  {renderSentenceField('Neural Tube Defect Risk', record.neuralTubeDefectRisk, ctr)}
                  {renderSentenceField('Fetal Sex', record.fetalSex, ctr)}
                  {renderSentenceField('Karyotype Result', record.karyotypeResult, ctr)}
                  {numShows('fetalFraction', record.fetalFraction) && renderFieldRow('Fetal Fraction', record.fetalFraction)}
                </View>
              )}

              {/* 4. Biochemistry */}
              {(numShows('afpLevel', record.afpLevel) || numShows('hcgLevel', record.hcgLevel) || numShows('estriolLevel', record.estriolLevel) || numShows('inhibinALevel', record.inhibinALevel) || numShows('pappALevel', record.pappALevel) || numShows('nuchalTranslucency', record.nuchalTranslucency)) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Biochemistry</Text>
                  {numShows('afpLevel', record.afpLevel) && renderFieldRow('AFP Level', record.afpLevel)}
                  {numShows('hcgLevel', record.hcgLevel) && renderFieldRow('hCG Level', record.hcgLevel)}
                  {numShows('estriolLevel', record.estriolLevel) && renderFieldRow('Estriol Level', record.estriolLevel)}
                  {numShows('inhibinALevel', record.inhibinALevel) && renderFieldRow('Inhibin A Level', record.inhibinALevel)}
                  {numShows('pappALevel', record.pappALevel) && renderFieldRow('PAPP-A Level', record.pappALevel)}
                  {numShows('nuchalTranslucency', record.nuchalTranslucency) && renderFieldRow('Nuchal Translucency', record.nuchalTranslucency)}
                </View>
              )}

              {/* 5. Additional */}
              {(hasVal(record.microarrayFindings) || hasVal(record.geneticCounselingProvided) || hasVal(record.confirmationTestingNeeded)) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Additional</Text>
                  {Array.isArray(record.microarrayFindings) && renderArrayField('Microarray Findings', record.microarrayFindings, ctr)}
                  {renderSentenceField('Genetic Counseling Provided', record.geneticCounselingProvided, ctr)}
                  {renderSentenceField('Confirmation Testing Needed', record.confirmationTestingNeeded, ctr)}
                </View>
              )}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default PrenatalTestingReportsDocumentPDFTemplate;
