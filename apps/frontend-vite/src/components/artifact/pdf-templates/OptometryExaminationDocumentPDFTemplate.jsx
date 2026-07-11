/**
 * OptometryExaminationDocumentPDFTemplate.jsx
 * Box-free B&W LETTER (canonical, memory 6a2d6af6)  mirrors the JSX: sentinel-zero hide (a 0-valued optometry
 * measurement is the extractor's unset default  HIDDEN, negatives kept), number fields numbered, narrative
 * strings sentence-split ([.;] with abbrev/single-initial/genus guard + labeled comma-split), values numbered
 * ('1.' even singles), single-name label gate. Rule #74: each field is ONE wrap={false} atomic View with the
 * sectionTitle riding INSIDE the first present field's View. Static PHI footer. No record date (title only).
 * Collection: optometry_examination.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 16 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: '#000000', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000' },
  recordContainer: { marginBottom: 20 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 12, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000' },
  section: { marginBottom: 16 },
  fieldGroup: { marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 4, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  subLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 2 },
  value: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, borderTopWidth: 0.5, borderTopColor: '#999999', paddingTop: 8 },
  footerText: { fontSize: 10, color: '#666666' },
});

const SECTION_ORDER = ['visual-acuity', 'refraction', 'intraocular-pressure', 'pupil-anterior', 'optic-nerve', 'macula-retina', 'ocular-surface', 'special-testing'];
const SECTION_TITLES = {
  'visual-acuity': 'Visual Acuity',
  'refraction': 'Refraction',
  'intraocular-pressure': 'Intraocular Pressure',
  'pupil-anterior': 'Pupil and Anterior Chamber',
  'optic-nerve': 'Optic Nerve',
  'macula-retina': 'Macula and Retina',
  'ocular-surface': 'Ocular Surface',
  'special-testing': 'Special Testing',
};
const FIELD_LABELS = {
  visualAcuityOdUncorrected: 'Visual Acuity OD Uncorrected',
  visualAcuityOsUncorrected: 'Visual Acuity OS Uncorrected',
  visualAcuityOdCorrected: 'Visual Acuity OD Corrected',
  visualAcuityOsCorrected: 'Visual Acuity OS Corrected',
  sphereOd: 'Sphere OD',
  sphereOs: 'Sphere OS',
  cylinderOd: 'Cylinder OD',
  cylinderOs: 'Cylinder OS',
  axisOd: 'Axis OD',
  axisOs: 'Axis OS',
  intraocularPressureOd: 'IOP OD (Right Eye)',
  intraocularPressureOs: 'IOP OS (Left Eye)',
  tonometryMethod: 'Tonometry Method',
  centralCornealThicknessOd: 'Central Corneal Thickness OD',
  centralCornealThicknessOs: 'Central Corneal Thickness OS',
  pupilDiameterOdPhotopic: 'Pupil Diameter OD (Photopic)',
  pupilDiameterOsPhotopic: 'Pupil Diameter OS (Photopic)',
  pupillaryReflexOd: 'Pupillary Reflex OD',
  pupillaryReflexOs: 'Pupillary Reflex OS',
  anteriorChamberDepthOd: 'Anterior Chamber Depth OD',
  vanHerickGradeOd: 'Van Herick Grade OD',
  vanHerickGradeOs: 'Van Herick Grade OS',
  cupToDiscRatioOd: 'Cup-to-Disc Ratio OD',
  cupToDiscRatioOs: 'Cup-to-Disc Ratio OS',
  visualFieldMeanDeviationOd: 'Visual Field Mean Deviation OD',
  visualFieldMeanDeviationOs: 'Visual Field Mean Deviation OS',
  octRnflThicknessOd: 'OCT RNFL Thickness OD',
  octRnflThicknessOs: 'OCT RNFL Thickness OS',
  maculaOctCentralThicknessOd: 'Macula OCT Central Thickness OD',
  maculaOctCentralThicknessOs: 'Macula OCT Central Thickness OS',
  lensOpacityClassificationGradeOd: 'Lens Opacity Classification OD',
  lensOpacityClassificationGradeOs: 'Lens Opacity Classification OS',
  tearBreakUpTimeOd: 'Tear Break-Up Time OD',
  tearBreakUpTimeOs: 'Tear Break-Up Time OS',
  schirmerTestOd: 'Schirmer Test OD',
  schirmerTestOs: 'Schirmer Test OS',
  meibomianGlandDysfunctionGrade: 'Meibomian Gland Dysfunction Grade',
  ocularSurfaceDiseaseIndex: 'Ocular Surface Disease Index',
  contrastSensitivityScore: 'Contrast Sensitivity Score',
  colorVisionTestResult: 'Color Vision Test Result',
  stereoacuityScore: 'Stereoacuity Score',
  axialLengthOd: 'Axial Length OD',
  axialLengthOs: 'Axial Length OS',
  keratometryOdFlat: 'Keratometry OD Flat',
  keratometryOdSteep: 'Keratometry OD Steep',
  keratometryOsFlat: 'Keratometry OS Flat',
  keratometryOsSteep: 'Keratometry OS Steep',
};
const SECTION_FIELDS = {
  'visual-acuity': ['visualAcuityOdUncorrected', 'visualAcuityOsUncorrected', 'visualAcuityOdCorrected', 'visualAcuityOsCorrected'],
  'refraction': ['sphereOd', 'sphereOs', 'cylinderOd', 'cylinderOs', 'axisOd', 'axisOs'],
  'intraocular-pressure': ['intraocularPressureOd', 'intraocularPressureOs', 'tonometryMethod', 'centralCornealThicknessOd', 'centralCornealThicknessOs'],
  'pupil-anterior': ['pupilDiameterOdPhotopic', 'pupilDiameterOsPhotopic', 'pupillaryReflexOd', 'pupillaryReflexOs', 'anteriorChamberDepthOd', 'vanHerickGradeOd', 'vanHerickGradeOs'],
  'optic-nerve': ['cupToDiscRatioOd', 'cupToDiscRatioOs', 'visualFieldMeanDeviationOd', 'visualFieldMeanDeviationOs', 'octRnflThicknessOd', 'octRnflThicknessOs'],
  'macula-retina': ['maculaOctCentralThicknessOd', 'maculaOctCentralThicknessOs', 'lensOpacityClassificationGradeOd', 'lensOpacityClassificationGradeOs'],
  'ocular-surface': ['tearBreakUpTimeOd', 'tearBreakUpTimeOs', 'schirmerTestOd', 'schirmerTestOs', 'meibomianGlandDysfunctionGrade', 'ocularSurfaceDiseaseIndex'],
  'special-testing': ['contrastSensitivityScore', 'colorVisionTestResult', 'stereoacuityScore', 'axialLengthOd', 'axialLengthOs', 'keratometryOdFlat', 'keratometryOdSteep', 'keratometryOsFlat', 'keratometryOsSteep'],
};
const NUMBER_FIELDS = [
  'sphereOd', 'sphereOs', 'cylinderOd', 'cylinderOs', 'axisOd', 'axisOs',
  'intraocularPressureOd', 'intraocularPressureOs',
  'centralCornealThicknessOd', 'centralCornealThicknessOs',
  'pupilDiameterOdPhotopic', 'pupilDiameterOsPhotopic',
  'anteriorChamberDepthOd', 'cupToDiscRatioOd', 'cupToDiscRatioOs',
  'visualFieldMeanDeviationOd', 'visualFieldMeanDeviationOs',
  'octRnflThicknessOd', 'octRnflThicknessOs',
  'maculaOctCentralThicknessOd', 'maculaOctCentralThicknessOs',
  'tearBreakUpTimeOd', 'tearBreakUpTimeOs', 'schirmerTestOd', 'schirmerTestOs',
  'ocularSurfaceDiseaseIndex', 'stereoacuityScore',
  'axialLengthOd', 'axialLengthOs',
  'keratometryOdFlat', 'keratometryOdSteep', 'keratometryOsFlat', 'keratometryOsSteep',
];
const HIDE_ZERO_FIELDS = NUMBER_FIELDS;
const STRING_FIELDS = [
  'visualAcuityOdUncorrected', 'visualAcuityOsUncorrected', 'visualAcuityOdCorrected', 'visualAcuityOsCorrected',
  'tonometryMethod', 'pupillaryReflexOd', 'pupillaryReflexOs',
  'vanHerickGradeOd', 'vanHerickGradeOs',
  'lensOpacityClassificationGradeOd', 'lensOpacityClassificationGradeOs',
  'meibomianGlandDysfunctionGrade', 'contrastSensitivityScore', 'colorVisionTestResult',
];

const getVal = (obj, path) => { if (!obj || !path) return undefined; return String(path).split('.').reduce((cur, part) => (cur === null || cur === undefined) ? undefined : cur[part], obj); };
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
const hasFieldVal = (fn, v) => { if (!hasVal(v)) return false; if (HIDE_ZERO_FIELDS.includes(fn) && Number(v) === 0) return false; return true; };
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };

/* safeString: fold non-ASCII to ASCII + strip control/invisible chars. Regex uses ONLY \uXXXX escapes 
   NEVER paste literal smart-quotes/dashes/BOM into the source (memory: template-pdf-safestring-unicode-escape-only). */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'number' ? String(val) : typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val);
  return str
    .replace(/[\u00B5\u03BC]m/g, 'um')
    .replace(/[\u00B5\u03BC]g/g, 'mcg')
    .replace(/[\u00B5\u03BC]/g, 'u')
    .replace(/\u00B0/g, ' deg')
    .replace(/\u00B1/g, '+/-')
    .replace(/\u2265/g, '>=')
    .replace(/\u2264/g, '<=')
    .replace(/\u2192/g, '->')
    .replace(/[\u00D7\u2715\u2716]/g, 'x')
    .replace(/\u00F7/g, '/')
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u2028\u2029\uFEFF]/g, '');
};

const CLAUSE_OPENER = /^(if|when|while|unless|although|though|because|since|after|before|once|given|whether|should|as|until|provided|assuming|in case)\b/i;
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m && !CLAUSE_OPENER.test(m[1].trim())) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|[A-Z]))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0 && /\s/.test(text[i + 1] || '')) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};
const sentenceRows = (text) => {
  const strip = (x) => String(x).replace(/[;.]+$/, '').trim();
  const rows = []; let n = 1;
  splitBySentence(text).forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const parts = splitByComma(parsed.value);
      if (parts.length >= 2) {
        rows.push({ type: 'subtitle', text: safeString(parsed.label) });
        let m = 1;
        parts.forEach(it => {
          const ip = parseLabel(it);
          if (ip.isLabeled) rows.push({ type: 'subtitle', text: safeString(ip.label) });
          rows.push({ type: 'item', text: safeString(strip(ip.isLabeled ? ip.value : it)), num: m++ });
        });
      } else {
        rows.push({ type: 'subtitle', text: safeString(parsed.label) });
        rows.push({ type: 'item', text: safeString(strip(parsed.value)), num: 1 });
      }
    } else {
      rows.push({ type: 'item', text: safeString(strip(s)), num: n++ });
    }
  });
  return rows;
};

const renderField = (record, f, sectionTitle, isFirst) => {
  const val = getVal(record, f);
  if (!hasFieldVal(f, val)) return [];
  const label = FIELD_LABELS[f] || f;
  const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
  const titleNode = isFirst ? <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text> : null;

  let body;
  if (STRING_FIELDS.includes(f)) {
    const rows = sentenceRows(safeString(val));
    body = rows.length > 1
      ? rows.map((r, i) => r.type === 'subtitle'
        ? <Text key={i} style={styles.subLabel}>{r.text}</Text>
        : <Text key={i} style={styles.value}>{r.num}. {r.text}</Text>)
      : <Text style={styles.value}>1. {safeString(val)}</Text>;
  } else {
    body = <Text style={styles.value}>1. {safeString(fmtScalar(val))}</Text>;
  }
  return [(
    <View key={f} style={styles.fieldGroup} wrap={false}>
      {titleNode}{showLabel && <Text style={styles.fieldLabel}>{safeString(label)}</Text>}
      {body}
    </View>
  )];
};

const OptometryExaminationDocumentPDFTemplate = ({ document: docProp, data }) => {
  const templateData = docProp || data;
  let records = [];
  if (Array.isArray(templateData)) {
    if (templateData.length > 0 && templateData[0].optometry_examination && Array.isArray(templateData[0].optometry_examination)) records = templateData[0].optometry_examination;
    else records = templateData;
  } else if (templateData && templateData.optometry_examination) {
    records = Array.isArray(templateData.optometry_examination) ? templateData.optometry_examination : [templateData.optometry_examination];
  } else if (templateData && templateData.documentData) {
    const dd = templateData.documentData;
    records = Array.isArray(dd) ? dd : (dd.optometry_examination ? (Array.isArray(dd.optometry_examination) ? dd.optometry_examination : [dd.optometry_examination]) : [dd]);
  } else if (templateData) {
    records = [templateData];
  }
  records = records.filter(r => r && typeof r === 'object');

  if (!records || records.length === 0) {
    return (
      <Document><Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Optometry Examination</Text></View>
        <Text style={styles.emptyState}>No optometry examination records available.</Text>
      </Page></Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Optometry Examination</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <Text style={styles.recordTitle}>{safeString(`Optometry Examination ${idx + 1}`)}</Text>
            {SECTION_ORDER.map((sid) => {
              const vis = (SECTION_FIELDS[sid] || []).filter(f => hasFieldVal(f, getVal(record, f)));
              if (vis.length === 0) return null;
              return (
                <View key={sid} style={styles.section}>
                  {vis.flatMap((f, fi) => renderField(record, f, SECTION_TITLES[sid], fi === 0))}
                </View>
              );
            })}
          </View>
        ))}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Protected Health Information (PHI) - Handle according to HIPAA guidelines</Text>
        </View>
      </Page>
    </Document>
  );
};

export default OptometryExaminationDocumentPDFTemplate;
