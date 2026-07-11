/**
 * OvarianStimulationProtocolDocumentPDFTemplate.jsx
 * Box-free B&W LETTER (canonical, memory 6a2d6af6) - mirrors the JSX: sentinel-zero hide (a 0-valued protocol
 * metric is the extractor's unset default -> HIDDEN, memory 6a4fa368), number fields + number arrays numbered,
 * narrative strings sentence-split ([.;] with abbrev/single-initial guard + labeled comma-split), values
 * numbered ('1.' even singles), single-name label gate. Rule #74: each field is ONE wrap={false} atomic View
 * with the sectionTitle riding INSIDE the first present field's View. Static PHI footer.
 * Collection: ovarian_stimulation_protocol.
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

const SECTION_ORDER = ['protocol-overview', 'stimulation-dosing', 'trigger-day', 'baseline-assessment', 'follicle-monitoring', 'oocyte-outcome', 'ohss-management', 'luteal-support'];
const SECTION_TITLES = {
  'protocol-overview': 'Protocol Overview',
  'stimulation-dosing': 'Stimulation and Dosing',
  'trigger-day': 'Trigger Day',
  'baseline-assessment': 'Baseline Assessment',
  'follicle-monitoring': 'Follicle Monitoring',
  'oocyte-outcome': 'Oocyte Outcome',
  'ohss-management': 'OHSS Management',
  'luteal-support': 'Luteal Phase Support',
};
const FIELD_LABELS = {
  protocolType: 'Protocol Type',
  gonadotropinType: 'Gonadotropin Type',
  gnrhAnalogType: 'GnRH Analog Type',
  startingGonadotropinDose: 'Starting Gonadotropin Dose',
  totalGonadotropinDose: 'Total Gonadotropin Dose',
  stimulationDuration: 'Stimulation Duration',
  gnrhAntagonistStartDay: 'GnRH Antagonist Start Day',
  triggerMedication: 'Trigger Medication',
  triggerDayEstradiolLevel: 'Trigger Day Estradiol Level',
  triggerDayProgesteroneLevel: 'Trigger Day Progesterone Level',
  triggerDayLhLevel: 'Trigger Day LH Level',
  baselineAntralFollicleCount: 'Baseline Antral Follicle Count',
  baselineAmhLevel: 'Baseline AMH Level',
  folliclesGreaterThan14mm: 'Follicles Greater Than 14mm',
  leadFollicleDiameter: 'Lead Follicle Diameter',
  endometrialThicknessAtTrigger: 'Endometrial Thickness at Trigger',
  oocytesRetrieved: 'Oocytes Retrieved',
  matureOocytesMii: 'Mature Oocytes (MII)',
  oocyteYieldRatio: 'Oocyte Yield Ratio',
  follicleOutputRate: 'Follicle Output Rate',
  ovarianSensitivityIndex: 'Ovarian Sensitivity Index',
  ohssRiskCategory: 'OHSS Risk Category',
  ohssProphylaxisMeasures: 'OHSS Prophylaxis Measures',
  lutealPhaseSupportRegimen: 'Luteal Phase Support Regimen',
  bolognaCriteriaClassification: 'Bologna Criteria Classification',
};
const SECTION_FIELDS = {
  'protocol-overview': ['protocolType', 'gonadotropinType', 'gnrhAnalogType'],
  'stimulation-dosing': ['startingGonadotropinDose', 'totalGonadotropinDose', 'stimulationDuration', 'gnrhAntagonistStartDay'],
  'trigger-day': ['triggerMedication', 'triggerDayEstradiolLevel', 'triggerDayProgesteroneLevel', 'triggerDayLhLevel'],
  'baseline-assessment': ['baselineAntralFollicleCount', 'baselineAmhLevel', 'bolognaCriteriaClassification'],
  'follicle-monitoring': ['folliclesGreaterThan14mm', 'leadFollicleDiameter', 'endometrialThicknessAtTrigger'],
  'oocyte-outcome': ['oocytesRetrieved', 'matureOocytesMii', 'oocyteYieldRatio', 'follicleOutputRate', 'ovarianSensitivityIndex'],
  'ohss-management': ['ohssRiskCategory', 'ohssProphylaxisMeasures'],
  'luteal-support': ['lutealPhaseSupportRegimen'],
};
const NUMBER_FIELDS = [
  'startingGonadotropinDose', 'totalGonadotropinDose', 'stimulationDuration', 'gnrhAntagonistStartDay',
  'triggerDayEstradiolLevel', 'triggerDayProgesteroneLevel', 'triggerDayLhLevel',
  'baselineAntralFollicleCount', 'baselineAmhLevel', 'folliclesGreaterThan14mm',
  'leadFollicleDiameter', 'endometrialThicknessAtTrigger', 'oocytesRetrieved',
  'matureOocytesMii', 'oocyteYieldRatio', 'follicleOutputRate', 'ovarianSensitivityIndex',
];
const HIDE_ZERO_FIELDS = NUMBER_FIELDS;
const STRING_FIELDS = ['protocolType', 'gonadotropinType', 'gnrhAnalogType', 'triggerMedication', 'ohssRiskCategory', 'lutealPhaseSupportRegimen', 'bolognaCriteriaClassification'];
const ARRAY_FIELDS = ['ohssProphylaxisMeasures'];

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

/* safeString: normalize unicode punctuation/symbols to ASCII. Regex uses ONLY \uXXXX escapes - NEVER paste a
   literal smart-quote / em-dash / BOM into this source (that yields "Unterminated regular expression"). */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'number' ? String(val) : typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val);
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

  if (ARRAY_FIELDS.includes(f)) {
    const items = (Array.isArray(val) ? val : [val]).filter(x => !isEmptyDeep(x));
    if (items.length === 0) return [];
    return [(
      <View key={f} style={styles.fieldGroup} wrap={false}>
        {titleNode}{showLabel && <Text style={styles.fieldLabel}>{safeString(label)}</Text>}
        {items.map((it, i) => <Text key={i} style={styles.value}>{i + 1}. {safeString(fmtScalar(it))}</Text>)}
      </View>
    )];
  }

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

const OvarianStimulationProtocolDocumentPDFTemplate = ({ document: docProp, data }) => {
  const templateData = docProp || data;
  let records = [];
  if (Array.isArray(templateData)) {
    if (templateData.length > 0 && templateData[0].ovarian_stimulation_protocol && Array.isArray(templateData[0].ovarian_stimulation_protocol)) records = templateData[0].ovarian_stimulation_protocol;
    else records = templateData;
  } else if (templateData && templateData.ovarian_stimulation_protocol) {
    records = Array.isArray(templateData.ovarian_stimulation_protocol) ? templateData.ovarian_stimulation_protocol : [templateData.ovarian_stimulation_protocol];
  } else if (templateData && templateData.documentData) {
    const dd = templateData.documentData;
    records = Array.isArray(dd) ? dd : (dd.ovarian_stimulation_protocol ? (Array.isArray(dd.ovarian_stimulation_protocol) ? dd.ovarian_stimulation_protocol : [dd.ovarian_stimulation_protocol]) : [dd]);
  } else if (templateData) {
    records = [templateData];
  }
  records = records.filter(r => r && typeof r === 'object');

  if (!records || records.length === 0) {
    return (
      <Document><Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Ovarian Stimulation Protocol</Text></View>
        <Text style={styles.emptyState}>No ovarian stimulation protocol records available.</Text>
      </Page></Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Ovarian Stimulation Protocol</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <Text style={styles.recordTitle}>{`Ovarian Stimulation Protocol ${idx + 1}`}</Text>
            {SECTION_ORDER.map((sid) => {
              const vis = (SECTION_FIELDS[sid] || []).filter(f => (ARRAY_FIELDS.includes(f) ? !isEmptyDeep(getVal(record, f)) : hasFieldVal(f, getVal(record, f))));
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

export default OvarianStimulationProtocolDocumentPDFTemplate;
