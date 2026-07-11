/**
 * GastroenterologyConsultationsDocumentPDFTemplate.jsx
 * Box-free B&W LETTER (canonical, memory 6a2d6af6) — mirrors the JSX: NO clinical date in schema (never
 * createdAt), values numbered ('1.' even singles), single-name label gate, per-field SENTINEL-ZERO (Child-Pugh /
 * MELD / amylase / lipase / calprotectin 0 = not measured → hidden; painScore/Mayo 0 shown), array numbered,
 * narratives split on [.;]. safeString scrubs non-Latin-1 glyphs. Rule #74: each field is ONE wrap={false} atomic
 * View with the sectionTitle riding INSIDE the first present field's View. Static PHI footer.
 * Collection: gastroenterology_consultations.
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

const SECTION_ORDER = ['gi-symptoms', 'endoscopy-procedures', 'liver-pancreas', 'additional-labs'];
const SECTION_TITLES = {
  'gi-symptoms': 'GI Symptoms & Complaints',
  'endoscopy-procedures': 'Endoscopy & Procedures',
  'liver-pancreas': 'Liver & Pancreas',
  'additional-labs': 'Additional Labs & Status',
};
const FIELD_LABELS = {
  chiefComplaint: 'Chief Complaint', bowelMovementFrequency: 'Bowel Movement Frequency', abdominalPainScore: 'Abdominal Pain Score',
  crohnsDiseaseName: "Crohn's Disease Activity (CDAI)", gastrointestinalBleedingType: 'GI Bleeding Type',
  functionalDyspepsiaSymptoms: 'Functional Dyspepsia Symptoms', irritableBowelSyndromeType: 'Irritable Bowel Syndrome Type',
  endoscopyFindings: 'Endoscopy Findings', colonoscopyPrepQuality: 'Colonoscopy Prep Quality', ulcerativeColitisMayoScore: 'Ulcerative Colitis Mayo Score',
  capsuleEndoscopyFindings: 'Capsule Endoscopy Findings', ercpFindings: 'ERCP Findings', liverEnzymeLevels: 'Liver Enzyme Levels',
  childPughScore: 'Child-Pugh Score', meldScore: 'MELD Score', ascitesVolume: 'Ascites Volume', esophagealVarices: 'Esophageal Varices',
  hepaticEncephalopathyGrade: 'Hepatic Encephalopathy Grade', pancreatitisSeverity: 'Pancreatitis Severity',
  serumAmylaseLevel: 'Serum Amylase Level', serumLipaseLevel: 'Serum Lipase Level', helicobacterPyloriStatus: 'Helicobacter Pylori Status',
  gastroparesisSeverity: 'Gastroparesis Severity', fecalCalprotectinLevel: 'Fecal Calprotectin Level',
};
const SECTION_FIELDS = {
  'gi-symptoms': ['chiefComplaint', 'bowelMovementFrequency', 'abdominalPainScore', 'crohnsDiseaseName', 'gastrointestinalBleedingType', 'functionalDyspepsiaSymptoms', 'irritableBowelSyndromeType'],
  'endoscopy-procedures': ['endoscopyFindings', 'colonoscopyPrepQuality', 'ulcerativeColitisMayoScore', 'capsuleEndoscopyFindings', 'ercpFindings'],
  'liver-pancreas': ['liverEnzymeLevels', 'childPughScore', 'meldScore', 'ascitesVolume', 'esophagealVarices', 'hepaticEncephalopathyGrade', 'pancreatitisSeverity', 'serumAmylaseLevel', 'serumLipaseLevel'],
  'additional-labs': ['helicobacterPyloriStatus', 'gastroparesisSeverity', 'fecalCalprotectinLevel'],
};
const NUMBER_FIELDS = ['abdominalPainScore', 'ulcerativeColitisMayoScore', 'childPughScore', 'meldScore', 'serumAmylaseLevel', 'serumLipaseLevel', 'fecalCalprotectinLevel'];
const HIDE_ZERO_FIELDS = ['childPughScore', 'meldScore', 'serumAmylaseLevel', 'serumLipaseLevel', 'fecalCalprotectinLevel'];
const ARRAY_FIELDS = ['functionalDyspepsiaSymptoms'];

const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};
const hasFieldVal = (fn, v) => { if (HIDE_ZERO_FIELDS.includes(fn) && v === 0) return false; return !isEmptyDeep(v); };
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'number' ? String(val) : typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val);
  str = str.replace(/[µμ]m/g, 'um').replace(/[µμ]g/g, 'mcg').replace(/[µμ]/g, 'u').replace(/°/g, ' deg').replace(/±/g, '+/-')
    .replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/→/g, '->').replace(/[×✕✖]/g, 'x').replace(/÷/g, '/')
    .replace(/“/g, '"').replace(/”/g, '"').replace(/‘/g, "'").replace(/’/g, "'").replace(/—/g, '-').replace(/–/g, '-');
  return str;
};

const parseLabel = (text) => { if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' }; const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/); if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() }; return { isLabeled: false, label: '', value: text }; };
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };
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
  const sentences = splitBySentence(text);
  const rows = []; let n = 1;
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const parts = splitByComma(parsed.value);
      const items = parts.length >= 2 ? parts : [parsed.value];
      rows.push({ type: 'subtitle', text: safeString(parsed.label) });
      let m = 1; items.forEach(it => rows.push({ type: 'item', text: safeString(strip(it)), num: m++ }));
    } else {
      rows.push({ type: 'item', text: safeString(strip(s)), num: n++ });
    }
  });
  return rows;
};

const renderField = (record, f, sectionTitle, isFirst) => {
  const val = record[f];
  if (!hasFieldVal(f, val)) return [];
  const label = FIELD_LABELS[f] || f;
  const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
  const titleNode = isFirst ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null;

  let body;
  if (NUMBER_FIELDS.includes(f)) {
    body = <Text style={styles.value}>1. {safeString(val)}</Text>;
  } else if (ARRAY_FIELDS.includes(f)) {
    const items = (Array.isArray(val) ? val : [val]).filter(x => !isEmptyDeep(x));
    if (items.length === 0) return [];
    body = items.map((it, i) => <Text key={i} style={styles.value}>{i + 1}. {safeString(it)}</Text>);
  } else {
    const rows = sentenceRows(safeString(val));
    body = rows.length > 1
      ? rows.map((r, i) => r.type === 'subtitle'
        ? <Text key={i} style={styles.subLabel}>{r.text}</Text>
        : <Text key={i} style={styles.value}>{r.num}. {r.text}</Text>)
      : <Text style={styles.value}>1. {safeString(val)}</Text>;
  }
  return [(
    <View key={f} style={styles.fieldGroup} wrap={false}>
      {titleNode}{showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      {body}
    </View>
  )];
};

const GastroenterologyConsultationsDocumentPDFTemplate = ({ document: docProp, data }) => {
  const templateData = docProp || data;
  let records = [];
  if (Array.isArray(templateData)) {
    if (templateData.length > 0 && templateData[0].gastroenterology_consultations && Array.isArray(templateData[0].gastroenterology_consultations)) records = templateData[0].gastroenterology_consultations;
    else records = templateData;
  } else if (templateData && templateData.gastroenterology_consultations) {
    records = Array.isArray(templateData.gastroenterology_consultations) ? templateData.gastroenterology_consultations : [templateData.gastroenterology_consultations];
  } else if (templateData && templateData.documentData) {
    const dd = templateData.documentData;
    records = Array.isArray(dd) ? dd : (dd.gastroenterology_consultations ? (Array.isArray(dd.gastroenterology_consultations) ? dd.gastroenterology_consultations : [dd.gastroenterology_consultations]) : [dd]);
  } else if (templateData) {
    records = [templateData];
  }
  records = records.filter(r => r && typeof r === 'object');

  if (!records || records.length === 0) {
    return (
      <Document><Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Gastroenterology Consultations</Text></View>
        <Text style={styles.emptyState}>No gastroenterology consultation records available.</Text>
      </Page></Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Gastroenterology Consultations</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <Text style={styles.recordTitle}>{`Gastroenterology Consultation ${idx + 1}`}</Text>
            {SECTION_ORDER.map((sid) => {
              const vis = (SECTION_FIELDS[sid] || []).filter(f => hasFieldVal(f, record[f]));
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

export default GastroenterologyConsultationsDocumentPDFTemplate;
