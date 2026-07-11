/**
 * FacialTraumaAssessmentDocumentPDFTemplate.jsx
 * Box-free B&W LETTER PDF — config-driven, mirrors FacialTraumaAssessmentDocument.jsx sections/labels
 * exactly (4-AREA RULE: JSX = Copy Section = Copy All = PDF). Collection: facial_trauma_assessment.
 * react-pdf: wrap is BOOLEAN only; each section glues its title to the first field so it never orphans.
 * hideZero mirrors JSX HIDE_ZERO_FIELDS: ALL 10 numerics — 0 = not measured / not scored (GCS min 3,
 * House-Brackmann min I; 0 mm / 0 mmHg / 0 deg / 0 hours = not assessed; real 0.47 h still shows).
 * Enums (LeFort I/II/III, trauma mechanism) render canonical casing. Sentence fields split on [.;] +
 * guarded comma-split + numbered. Title / section title / field label get borderBottom underlines.
 * NO date field in this schema — record header is ONLY the numbered record title.
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
  fieldValue: { fontSize: 14, color: '#000000', lineHeight: 1.5 },
  listItem: { fontSize: 14, color: '#000000', lineHeight: 1.5, marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  noData: { fontSize: 12, color: '#000000', textAlign: 'center', marginTop: 40 },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, fontSize: 10, color: '#666666', borderTopWidth: 0.5, borderTopColor: '#999999', paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 10, color: '#666666' },
});

/* ═══ UTILS ═══ */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/µm/g, 'um').replace(/μm/g, 'um').replace(/°/g, ' deg')
    .replace(/±/g, '+/-').replace(/≥/g, '>=').replace(/≤/g, '<=')
    .replace(/→/g, '->').replace(/“/g, '"').replace(/”/g, '"')
    .replace(/‘/g, "'").replace(/’/g, "'").replace(/—/g, '-').replace(/–/g, '-');
  return str;
};
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };

/* arrItemText: same array-item stringification as JSX (4-AREA RULE) */
const arrItemText = (item) => {
  if (item === null || item === undefined) return '';
  if (typeof item === 'object') return Object.values(item).filter(x => x !== null && x !== undefined && x !== '').map(String).join(' — ');
  return String(item);
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
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
    else if (ch === ',' && depth === 0) {
      const rest = text.slice(i + 1);
      const nextChar = rest.charAt(0);
      const restTrim = rest.replace(/^\s+/, '');
      if ((nextChar && /\d/.test(nextChar)) || /^(and|or|then)\b/i.test(restTrim) || /\b(and|or)$/i.test(current.trim())) {
        current += ch;
      } else {
        const t = current.trim(); if (t) result.push(t); current = '';
      }
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* Enum canonical casing (mirror JSX ENUM_OPTIONS/enumCanonical). */
const ENUM_OPTIONS = {
  lefortFractureClassification: ['I', 'II', 'III'],
  traumaMechanismCategory: ['Motor Vehicle Collision', 'Assault', 'Fall', 'Sports Injury', 'Pedestrian Struck', 'Bicycle Accident', 'Gunshot Wound', 'Industrial Accident'],
};
const enumCanonical = (fn, v) => {
  const s = String(v ?? '').trim();
  if (!s) return '';
  const hit = (ENUM_OPTIONS[fn] || []).find(o => o.toLowerCase() === s.toLowerCase());
  return hit || (s.charAt(0).toUpperCase() + s.slice(1));
};

/* buildRows: sentence → numbered rows (parseLabel sub-heading + guarded comma-split). */
const buildRows = (items) => {
  const rows = []; let n = 1;
  items.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const parts = splitByComma(parsed.value);
      if (parts.length >= 2) { rows.push({ type: 'sub', text: safeString(parsed.label) }); parts.forEach(p => rows.push({ type: 'item', text: safeString(p), num: n++ })); }
      else { rows.push({ type: 'item', text: safeString(s), num: n++ }); }
    } else {
      const parts = splitByComma(s);
      if (parts.length >= 2) { parts.forEach(p => rows.push({ type: 'item', text: safeString(p), num: n++ })); }
      else { rows.push({ type: 'item', text: safeString(s), num: n++ }); }
    }
  });
  return rows;
};

const renderRowsBlock = (label, rows, key) => {
  if (rows.length === 0) return null;
  return (
    <View key={key} style={styles.fieldBox} wrap={rows.length > 8}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {rows.map((row, i) => row.type === 'sub'
        ? <Text key={i} style={styles.nestedSubtitle}>{row.text}</Text>
        : <Text key={i} style={styles.listItem}>{row.num}. {row.text}</Text>)}
    </View>
  );
};

/* SECTION CONFIGS — mirror the JSX SECTION_TITLES / SECTION_FIELDS / FIELD_LABELS exactly.
   hideZero mirrors JSX HIDE_ZERO_FIELDS (all 10 numerics). */
const SECTION_CONFIGS = [
  { title: 'Injury Overview', fields: [
    { key: 'traumaMechanismCategory', label: 'Trauma Mechanism', isEnum: true },
    { key: 'glasgowComaScaleScore', label: 'Glasgow Coma Scale Score', hideZero: true },
    { key: 'facialInjurySeverityScore', label: 'Facial Injury Severity Score', hideZero: true },
    { key: 'timeFromInjuryToPresentation', label: 'Time From Injury to Presentation (hours)', hideZero: true },
  ] },
  { title: 'Fractures', fields: [
    { key: 'lefortFractureClassification', label: 'Le Fort Fracture Classification', isEnum: true },
    { key: 'mandibularFractureLocations', label: 'Mandibular Fracture Locations', isArray: true },
    { key: 'orbitalFloorFractureSize', label: 'Orbital Floor Fracture Size (mm)', hideZero: true },
    { key: 'zygomaticomaxillaryComplexDisplacement', label: 'ZMC Displacement (mm)', hideZero: true },
    { key: 'nasalBoneDeviationAngle', label: 'Nasal Bone Deviation (degrees)', hideZero: true },
  ] },
  { title: 'Ocular Findings', fields: [
    { key: 'enophthalmosPresent', label: 'Enophthalmos Present', isBool: true },
    { key: 'interocularDistanceChange', label: 'Interocular Distance Change (mm)', hideZero: true },
    { key: 'globeRuptureIndicators', label: 'Globe Rupture Indicators', isArray: true },
    { key: 'retrobulbarHematomaPresent', label: 'Retrobulbar Hematoma Present', isBool: true },
    { key: 'intraocularPressure', label: 'Intraocular Pressure (mmHg)', hideZero: true },
    { key: 'extraocularMovementRestriction', label: 'Extraocular Movement Restriction', isArray: true },
  ] },
  { title: 'Nerve & Soft Tissue', fields: [
    { key: 'infraorbitalNerveParesthesia', label: 'Infraorbital Nerve Paresthesia', isBool: true },
    { key: 'facialNerveBranchesAffected', label: 'Facial Nerve Branches Affected', isArray: true },
    { key: 'houseBrackmannGrade', label: 'House-Brackmann Grade', hideZero: true },
    { key: 'parotidDuctInjury', label: 'Parotid Duct Injury', isBool: true },
    { key: 'softTissueLacerationDepth', label: 'Soft Tissue Laceration Depth', isSentence: true },
  ] },
  { title: 'Dental & Occlusion', fields: [
    { key: 'occlusalDerangementType', label: 'Occlusal Derangement Type' },
    { key: 'maximalInterincisalOpening', label: 'Maximal Interincisal Opening (mm)', hideZero: true },
    { key: 'dentoalveolarInjuryClassification', label: 'Dentoalveolar Injury Classification', isSentence: true },
  ] },
  { title: 'Other Critical Findings', fields: [
    { key: 'septalHematomaPresent', label: 'Septal Hematoma Present', isBool: true },
    { key: 'cerebrospinalFluidRhinorrhea', label: 'CSF Rhinorrhea', isBool: true },
  ] },
];

const isPresent = (record, f) => {
  const v = record[f.key];
  if (f.hideZero && v === 0) return false;
  if (f.isArray) return Array.isArray(v) && v.some(item => arrItemText(item));
  return hasVal(v);
};

/* renderField: one wrap-glued View per field (label + value never split across a page). */
const renderField = (record, field, key) => {
  const val = record[field.key];
  if (field.isSentence) return renderRowsBlock(field.label, buildRows(splitBySentence(fmtVal(val))), key);
  if (field.isArray) {
    const rows = (Array.isArray(val) ? val : []).map(arrItemText).filter(Boolean).map((t, i) => ({ type: 'item', text: safeString(t), num: i + 1 }));
    return renderRowsBlock(field.label, rows, key);
  }

  const display = field.isEnum ? enumCanonical(field.key, val)
    : field.isBool ? (val ? 'Yes' : 'No')
    : safeString(fmtVal(val));
  return (
    <View key={key} style={styles.fieldBox} wrap={false}>
      <Text style={styles.fieldLabel}>{field.label}</Text>
      <Text style={styles.fieldValue}>{display}</Text>
    </View>
  );
};

const FacialTraumaAssessmentDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.facial_trauma_assessment) return Array.isArray(r.facial_trauma_assessment) ? r.facial_trauma_assessment : [r.facial_trauma_assessment];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.facial_trauma_assessment) return Array.isArray(dd.facial_trauma_assessment) ? dd.facial_trauma_assessment : [dd.facial_trauma_assessment]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Facial Trauma Assessment</Text>
          <Text style={styles.noData}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Facial Trauma Assessment</Text>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            {/* NO date field in this schema — record header is ONLY the numbered record title */}
            <Text style={styles.recordTitle}>Facial Trauma Assessment {(record._originalIdx ?? idx) + 1}</Text>
            {SECTION_CONFIGS.map((cfg, sIdx) => {
              const present = cfg.fields.filter(f => isPresent(record, f));
              if (present.length === 0) return null;
              return (
                <View key={sIdx} style={styles.section}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>{cfg.title}</Text>
                    {renderField(record, present[0], 0)}
                  </View>
                  {present.slice(1).map((field, i) => renderField(record, field, i + 1))}
                </View>
              );
            })}
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

export default FacialTraumaAssessmentDocumentPDFTemplate;
