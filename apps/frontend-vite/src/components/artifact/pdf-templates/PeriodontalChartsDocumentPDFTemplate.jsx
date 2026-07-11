/**
 * PeriodontalChartsDocumentPDFTemplate.jsx
 * Box-free B&W LETTER (canonical, memory 6a2d6af6) -- mirrors PeriodontalChartsDocument.jsx.
 * The screen JSX draws pocket-depth bar charts; the PDF is text-only box-free, so the per-tooth
 * charting arrays (pocketDepths / clinicalAttachmentLevel / bleedingOnProbing / recession / mobility /
 * furcationInvolvement) render as numbered "N. #tooth: value" rows under a field label. Pair-array
 * sections (Bone Loss, Calculus, ...) render each entry as subLabel(key) + value. Narrative strings
 * (diagnosis / stage / grade / gingivitis / plaque) render whole (single sentence) or [.;] sentence-
 * split. Single-name gate: a field label == its section title -> label hidden (only the sectionTitle
 * shows). probingForce === 0 is a "not recorded" sentinel -> hidden. Rule #74: the sectionTitle rides
 * INSIDE the first unit's wrap={false} View; every leaf is its own small wrap={false} glue unit so no
 * block exceeds a page and no title orphans. safeString uses \uXXXX escapes ONLY. Static PHI footer.
 * Collection: periodontal_charts.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 64, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.4, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 16 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: '#000000', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000' },
  recordContainer: { marginBottom: 20 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 14, marginBottom: 10, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: '#000000' },
  section: { marginBottom: 12 },
  fieldGroup: { marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 10, marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  subLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 2 },
  value: { fontSize: 14, lineHeight: 1.4, color: '#000000', marginBottom: 3, paddingLeft: 8 },
  emptyState: { fontSize: 14, textAlign: 'center', marginTop: 40, color: '#666666' },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, fontSize: 9, color: '#666666', textAlign: 'center', borderTopWidth: 0.5, borderTopColor: '#cccccc', paddingTop: 6 },
});

/* ======= HELPERS ======= */
const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.keys(v).length === 0;
  return false;
};
const hasVal = (v) => !isEmptyDeep(v);
const safeArray = (val) => (Array.isArray(val) ? val.filter(Boolean) : []);

/* safeString: \uXXXX escapes ONLY -- never paste literal smart-quotes / dashes / invisible chars. */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  const str = typeof val === 'number' ? String(val) : typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val);
  return str
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
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
    .replace(/\u00A0/g, ' ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u2028\u2029\uFEFF]/g, '');
};

const CLAUSE_OPENER = /^(if|when|while|unless|although|though|because|since|after|before|once|given|whether|should|as|until|provided|assuming|in case)\b/i;
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m && !CLAUSE_OPENER.test(m[1].trim())) return { isLabeled: true, label: m[1].trim(), value: m[2].trim().replace(/^\d+\.\s+/, '') };
  return { isLabeled: false, label: '', value: text };
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|[A-Z]))[.;](?:\s+)/).map(s => s.trim().replace(/^\d+\.\s+/, '')).filter(s => s && !/^[;.,!?]+$/.test(s));
};

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

const strip = (s) => safeString(s).replace(/^\s*\d+\.\s+/, '').replace(/[;.]+$/, '').trim();

const formatPairEntry = (entry) => {
  if (!Array.isArray(entry) || entry.length < 2) return '';
  return `${entry[0]}: ${entry[1]}`;
};
const formatPocketDepthEntry = (entry) => {
  if (!Array.isArray(entry) || entry.length < 2) return '';
  if (entry.length >= 7) return `${entry[0]}: DB=${entry[1]}, B=${entry[2]}, MB=${entry[3]}, DL=${entry[4]}, L=${entry[5]}, ML=${entry[6]}`;
  return `${entry[0]}: ${entry.slice(1).join(', ')}`;
};

/* ======= UNIT BUILDERS (each unit = the children of one wrap={false} View) ======= */
// Narrative string: whole for a single sentence (mirrors JSX + copy); [.;]-split + label-decompose for many.
const stringUnits = (text) => {
  const sentences = splitBySentence(String(text));
  if (sentences.length <= 1) return [[<Text key="v" style={styles.value}>{safeString(text)}</Text>]];
  const units = [];
  sentences.forEach((s, i) => {
    const p = parseLabel(s);
    if (p.isLabeled) {
      const items = splitByComma(p.value);
      if (items.length >= 2) {
        const grp = [<Text key="s" style={styles.subLabel}>{safeString(p.label)}</Text>];
        items.forEach((it, j) => grp.push(<Text key={`v${j}`} style={styles.value}>{j + 1}. {safeString(strip(it))}</Text>));
        units.push(grp);
      } else {
        units.push([<Text key="s" style={styles.subLabel}>{safeString(p.label)}</Text>, <Text key="v" style={styles.value}>{safeString(strip(p.value))}</Text>]);
      }
    } else {
      units.push([<Text key={`v${i}`} style={styles.value}>{safeString(strip(s))}</Text>]);
    }
  });
  return units;
};

// Tooth-charting array: field label glued to first row, then one numbered row per entry.
const arrayFieldUnits = (label, arr, fmt) => {
  const items = safeArray(arr).filter(e => (Array.isArray(e) ? e.length >= 2 : hasVal(e)));
  return items.map((item, i) => {
    const row = <Text key="v" style={styles.value}>{i + 1}. {safeString(fmt(item))}</Text>;
    return i === 0
      ? [<Text key="l" style={styles.fieldLabel}>{safeString(label)}</Text>, row]
      : [row];
  });
};

// Pair-array section (Bone Loss / Calculus / ...): each entry -> subLabel(key) + value.
const pairSubtitleUnits = (entries) => {
  const valid = safeArray(entries).filter(e => Array.isArray(e) && e.length >= 2);
  return valid.map(e => [
    <Text key="s" style={styles.subLabel}>{safeString(String(e[0]))}</Text>,
    <Text key="v" style={styles.value}>1. {safeString(String(e[1]))}</Text>,
  ]);
};

/* ======= SECTION RENDERER (sectionTitle rides inside the first unit's wrap={false} View) ======= */
const renderSectionUnits = (sid, title, units) => {
  if (!units || units.length === 0) return null;
  return (
    <View key={sid} style={styles.section}>
      {units.map((children, i) => (
        <View key={i} style={styles.fieldGroup} wrap={false}>
          {i === 0 && <Text style={styles.sectionTitle}>{safeString(title)}</Text>}
          {children}
        </View>
      ))}
    </View>
  );
};

const renderRecord = (record, idx) => {
  const sections = [];
  const add = (sid, title, units) => { const s = renderSectionUnits(sid, title, units); if (s) sections.push(s); };

  if (hasVal(record.periodontalDiagnosis)) add('diagnosis', 'Periodontal Diagnosis', stringUnits(record.periodontalDiagnosis));
  if (hasVal(record.periodontalStage)) add('stage', 'Periodontal Stage', stringUnits(record.periodontalStage));
  if (hasVal(record.periodontalGrade)) add('grade', 'Periodontal Grade', stringUnits(record.periodontalGrade));

  const chartUnits = [
    ...arrayFieldUnits('Pocket Depths', record.pocketDepths, formatPocketDepthEntry),
    ...arrayFieldUnits('Clinical Attachment Level', record.clinicalAttachmentLevel, formatPairEntry),
    ...arrayFieldUnits('Bleeding on Probing', record.bleedingOnProbing, formatPairEntry),
    ...arrayFieldUnits('Recession', record.recession, formatPairEntry),
    ...arrayFieldUnits('Mobility', record.mobility, formatPairEntry),
    ...arrayFieldUnits('Furcation Involvement', record.furcationInvolvement, formatPairEntry),
  ];
  add('charting', 'Periodontal Charting', chartUnits);

  add('bone-loss', 'Bone Loss', pairSubtitleUnits(record.boneLoss));
  add('calculus', 'Calculus', pairSubtitleUnits(record.calculus));
  if (hasVal(record.gingivitis)) add('gingivitis', 'Gingivitis', stringUnits(record.gingivitis));
  if (hasVal(record.plaqueBiofilm)) add('plaque', 'Plaque/Biofilm', stringUnits(record.plaqueBiofilm));
  add('suppuration', 'Suppuration', pairSubtitleUnits(record.suppuration));
  add('mucogingival', 'Mucogingival Problems', pairSubtitleUnits(record.mucogingivalProblems));
  add('keratinized', 'Keratinized Tissue Width', pairSubtitleUnits(record.keratinizedTissueWidth));
  add('implant', 'Implant Issues', pairSubtitleUnits(record.implantPeriodontitis));

  const probeUnits = [];
  if (hasVal(record.probeType)) probeUnits.push([<Text key="l" style={styles.fieldLabel}>Probe Type</Text>, <Text key="v" style={styles.value}>{safeString(record.probeType)}</Text>]);
  // probingForce === 0 is a "not recorded" sentinel (normal probing force is ~0.2-0.25 N) -> hidden.
  if (typeof record.probingForce === 'number' && record.probingForce !== 0) probeUnits.push([<Text key="l" style={styles.fieldLabel}>Probing Force</Text>, <Text key="v" style={styles.value}>{safeString(record.probingForce)}</Text>]);
  add('probe', 'Probe Information', probeUnits);

  return (
    <View key={record._id || idx} style={styles.recordContainer} break={idx > 0}>
      <Text style={styles.recordTitle}>{safeString(`Periodontal Chart ${idx + 1}`)}</Text>
      {sections}
    </View>
  );
};

/* ======= COMPONENT ======= */
const PeriodontalChartsDocumentPDFTemplate = ({ document: docProp, data: dataProp }) => {
  const data = docProp || dataProp;
  let rawRecords = [];
  if (Array.isArray(data)) {
    rawRecords = data.flatMap(item => {
      if (item?.periodontal_charts) return Array.isArray(item.periodontal_charts) ? item.periodontal_charts : [item.periodontal_charts];
      if (item?.documentData) { const dd = item.documentData; if (Array.isArray(dd)) return dd; if (dd?.periodontal_charts) return Array.isArray(dd.periodontal_charts) ? dd.periodontal_charts : [dd.periodontal_charts]; return [dd]; }
      return [item];
    });
  } else if (data?.periodontal_charts) {
    rawRecords = Array.isArray(data.periodontal_charts) ? data.periodontal_charts : [data.periodontal_charts];
  } else if (data?.documentData) {
    const dd = data.documentData;
    if (Array.isArray(dd)) rawRecords = dd;
    else if (dd?.periodontal_charts) rawRecords = Array.isArray(dd.periodontal_charts) ? dd.periodontal_charts : [dd.periodontal_charts];
    else if (dd && typeof dd === 'object') rawRecords = [dd];
  } else if (data) {
    rawRecords = [data];
  }
  const records = rawRecords.filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.documentTitle}>Periodontal Charts</Text></View>
          <Text style={styles.emptyState}>No periodontal chart records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Periodontal Charts</Text></View>
        {records.map((record, idx) => renderRecord(record, idx))}
        <Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text>
      </Page>
    </Document>
  );
};

export default PeriodontalChartsDocumentPDFTemplate;
