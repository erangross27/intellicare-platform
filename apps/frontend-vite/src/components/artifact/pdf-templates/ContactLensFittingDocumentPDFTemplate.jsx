/**
 * ContactLensFittingDocumentPDFTemplate.jsx
 * Box-free line-based layout (ConsultationNotes donor) — LETTER — B&W.
 * react-pdf 4.5.1 rules: wrap = BOOLEANS; recordContainer paddingBottom only + break={idx>0} (Rule #75);
 * sectionTitle rides INSIDE the section's field View (anti-orphan).
 * 4-area mirror: numberShowsPDF hides extraction-default 0 (mirrors JSX numberShows); every value numbered "1.";
 * LONG_STRING fields split by sentence (guarded [;.] + abbrev), labeled sub-label on >=3 comma parts.
 * Collection: contact_lens_fitting
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, borderBottomWidth: 2, borderBottomColor: '#000000', paddingBottom: 12 },
  title: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1 },
  recordContainer: { paddingBottom: 8 },
  recordHeader: { marginBottom: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  recordMeta: { fontSize: 12, color: '#000000', marginTop: 4 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', textTransform: 'uppercase', letterSpacing: 0.5, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 3, marginBottom: 8 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#000000', borderBottomWidth: 0.5, borderBottomColor: '#999999', paddingBottom: 3, marginTop: 4, marginBottom: 4 },
  subLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', borderBottomWidth: 0.5, borderBottomColor: '#999999', paddingBottom: 2, marginTop: 4, marginBottom: 3 },
  listItem: { fontSize: 14, color: '#000000', marginBottom: 3, paddingLeft: 8, lineHeight: 1.4 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
});

const SECTION_TITLES = {
  'lens-parameters': 'Lens Parameters',
  'corneal-measurements': 'Corneal Measurements',
  'tear-assessment': 'Tear Film Assessment',
  'fit-assessment': 'Fit Assessment',
  'over-refraction': 'Over-Refraction & Transmissibility',
  'wearing-schedule': 'Wearing & Replacement Schedule',
};
const FIELD_LABELS = {
  baseCurve: 'Base Curve', lensDiameter: 'Lens Diameter', sphericalPower: 'Spherical Power', cylinderPower: 'Cylinder Power',
  cylinderAxis: 'Cylinder Axis', addPower: 'Add Power', keratometryFlatK: 'Keratometry Flat K', keratometrySteepK: 'Keratometry Steep K',
  cornealAstigmatism: 'Corneal Astigmatism', horizontalVisibleIrisDiameter: 'Horizontal Visible Iris Diameter', pupilDiameter: 'Pupil Diameter',
  sagittalDepth: 'Sagittal Depth', cornealEccentricity: 'Corneal Eccentricity', cornealTopographySimK: 'Corneal Topography SimK',
  tearBreakUpTime: 'Tear Break-Up Time', schirmerTestResult: 'Schirmer Test Result', palpebralApertureHeight: 'Palpebral Aperture Height',
  lensCentration: 'Lens Centration', lensMovement: 'Lens Movement', fluoresceinPattern: 'Fluorescein Pattern',
  overRefractionSphere: 'Over-Refraction Sphere', overRefractionCylinder: 'Over-Refraction Cylinder', oxygenTransmissibility: 'Oxygen Transmissibility',
  wearingSchedule: 'Wearing Schedule', replacementSchedule: 'Replacement Schedule',
};
const SECTION_FIELDS = {
  'lens-parameters': ['baseCurve', 'lensDiameter', 'sphericalPower', 'cylinderPower', 'cylinderAxis', 'addPower'],
  'corneal-measurements': ['keratometryFlatK', 'keratometrySteepK', 'cornealAstigmatism', 'horizontalVisibleIrisDiameter', 'pupilDiameter', 'sagittalDepth', 'cornealEccentricity', 'cornealTopographySimK'],
  'tear-assessment': ['tearBreakUpTime', 'schirmerTestResult', 'palpebralApertureHeight'],
  'fit-assessment': ['lensCentration', 'lensMovement', 'fluoresceinPattern'],
  'over-refraction': ['overRefractionSphere', 'overRefractionCylinder', 'oxygenTransmissibility'],
  'wearing-schedule': ['wearingSchedule', 'replacementSchedule'],
};
const NUMBER_FIELDS = [
  'baseCurve', 'lensDiameter', 'sphericalPower', 'cylinderPower', 'cylinderAxis', 'addPower',
  'keratometryFlatK', 'keratometrySteepK', 'cornealAstigmatism', 'horizontalVisibleIrisDiameter',
  'pupilDiameter', 'sagittalDepth', 'cornealEccentricity', 'cornealTopographySimK',
  'tearBreakUpTime', 'schirmerTestResult', 'palpebralApertureHeight',
  'lensMovement', 'overRefractionSphere', 'overRefractionCylinder', 'oxygenTransmissibility',
];
const LONG_STRING_FIELDS = ['wearingSchedule'];
const MEANINGFUL_ZERO_FIELDS = [];

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : String(val);
  return str.replace(/µm/g, 'um').replace(/μm/g, 'um').replace(/°/g, ' deg').replace(/±/g, '+/-')
    .replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/→/g, '->').replace(/“/g, '"').replace(/”/g, '"')
    .replace(/‘/g, "'").replace(/’/g, "'").replace(/—/g, '-').replace(/–/g, '-');
};
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const hasValue = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; return true; };
// Mirrors the JSX numberShows: a stored 0 in a lens-measurement field is the batch default → hide unless MEANINGFUL_ZERO or doctor-edited.
const numberShowsPDF = (record, fn) => {
  const val = record[fn];
  if (val === null || val === undefined || val === '') return false;
  if (typeof val !== 'number') return hasValue(val);
  if (val !== 0) return true;
  if (MEANINGFUL_ZERO_FIELDS.includes(fn)) return true;
  if (Array.isArray(record?.doctorEdits?.editedFields) && record.doctorEdits.editedFields.includes(fn)) return true;
  return false;
};
const fieldShowsPDF = (record, fn) => NUMBER_FIELDS.includes(fn) ? numberShowsPDF(record, fn) : hasValue(record[fn]);

const formatDate = (dateVal) => {
  if (!dateVal) return '';
  try { const d = new Date(dateVal.$date || dateVal); if (isNaN(d.getTime())) return safeString(dateVal); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return safeString(dateVal); }
};
const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let cur = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      const rest = text.slice(i + 1);
      if (!/^\s/.test(rest)) { cur += ch; continue; }
      if (/^\s+(?:and|or)\b/i.test(rest)) { cur += ch; continue; }
      if (/\d\s*$/.test(cur) && /^\s*\d{4}\b/.test(rest)) { cur += ch; continue; }
      const t = cur.trim(); if (t) result.push(t); cur = '';
    } else cur += ch;
  }
  const t = cur.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

// Build {k:'label'|'sub'|'row', t} lines for one field (mirrors copy/JSX).
const fieldLines = (record, fn) => {
  const label = FIELD_LABELS[fn] || fn;
  const val = record[fn];
  const lines = [];
  if (LONG_STRING_FIELDS.includes(fn)) {
    lines.push({ k: 'label', t: label });
    let n = 1;
    splitBySentence(fmtVal(val)).forEach(s => {
      const p = parseLabel(s);
      if (p.isLabeled) {
        const parts = splitByComma(p.value);
        lines.push({ k: 'sub', t: p.label });
        if (parts.length >= 3) parts.forEach(it => lines.push({ k: 'row', t: `${n++}. ${it}` }));
        else lines.push({ k: 'row', t: `${n++}. ${p.value}` });
      } else lines.push({ k: 'row', t: `${n++}. ${s}` });
    });
  } else {
    lines.push({ k: 'label', t: label }, { k: 'row', t: `1. ${safeString(fmtVal(val))}` });
  }
  return lines;
};

const ContactLensFittingDocumentPDFTemplate = ({ document: docProp, records: recordsProp }) => {
  let data = docProp || recordsProp || [];
  if (!Array.isArray(data)) {
    if (data?.contact_lens_fitting) data = Array.isArray(data.contact_lens_fitting) ? data.contact_lens_fitting : [data.contact_lens_fitting];
    else if (data?.records && Array.isArray(data.records)) data = data.records;
    else if (data?.data && Array.isArray(data.data)) data = data.data;
    else if (data?._id || data?.baseCurve !== undefined) data = [data];
    else data = [];
  }
  const records = data.filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document><Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Contact Lens Fitting</Text></View>
        <Text style={styles.emptyState}>No records available</Text>
      </Page></Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Contact Lens Fitting</Text></View>

        {records.map((record, idx) => (
          // Rule #75: every record after the first STARTS ON A NEW PAGE; never record 0.
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Contact Lens Fitting ${idx + 1}`}</Text>
              {hasValue(record.createdAt) && <Text style={styles.recordMeta}>{formatDate(record.createdAt)}</Text>}
            </View>

            {Object.keys(SECTION_FIELDS).map(sid => {
              const present = SECTION_FIELDS[sid].filter(f => fieldShowsPDF(record, f));
              if (present.length === 0) return null;
              const lines = present.flatMap(f => fieldLines(record, f));
              return (
                <View key={sid} style={styles.section} wrap={lines.length > 20 ? true : false}>
                  <Text style={styles.sectionTitle}>{SECTION_TITLES[sid]}</Text>
                  {lines.map((ln, i) => ln.k === 'label'
                    ? <Text key={i} style={styles.fieldLabel}>{ln.t}</Text>
                    : ln.k === 'sub'
                      ? <Text key={i} style={styles.subLabel}>{ln.t}</Text>
                      : <Text key={i} style={styles.listItem}>{ln.t}</Text>)}
                </View>
              );
            })}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default ContactLensFittingDocumentPDFTemplate;
