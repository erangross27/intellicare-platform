/**
 * OpportunisticInfectionsDocumentPDFTemplate.jsx
 * Box-free B&W LETTER (canonical, memory 6a2d6af6) -- mirrors the JSX config: real record.date (never
 * createdAt), num fields, Yes/No booleans, arrays numbered, only LONG_TEXT fields sentence-split
 * ([.;] with abbrev/single-initial/genus guard + labeled comma-split), units baked into field labels,
 * values numbered ('1.' even singles), single-name label gate. Rule #74: each field is ONE wrap={false}
 * atomic View with the sectionTitle riding INSIDE the first present field's View. Static PHI footer.
 * safeString folds non-ASCII (Greek beta / micro sign etc.) with \uXXXX escapes ONLY so Helvetica hits
 * no missing glyph and the source stays pure ASCII. Collection: opportunistic_infections.
 */
import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';

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

const SECTION_ORDER = ['clinical-info', 'infection-details', 'immune-status', 'art-info', 'diagnosis', 'treatment', 'prophylaxis', 'clinical-status'];
const SECTION_TITLES = {
  'clinical-info': 'Clinical Information',
  'infection-details': 'Infection Details',
  'immune-status': 'Immune Status',
  'art-info': 'ART Information',
  'diagnosis': 'Diagnosis',
  'treatment': 'Treatment',
  'prophylaxis': 'Prophylaxis',
  'clinical-status': 'Clinical Status',
};
const FIELD_LABELS = {
  date: 'Date',
  symptomOnsetDate: 'Symptom Onset Date',
  severityGrade: 'Severity Grade',
  infectionType: 'Infection Type',
  pathogenIdentified: 'Pathogen Identified',
  infectionSite: 'Infection Site',
  underlyingImmunodeficiency: 'Underlying Immunodeficiency',
  cd4Count: 'CD4 Count (cells/uL)',
  cd4Percentage: 'CD4 Percentage (%)',
  viralLoadHiv: 'HIV Viral Load (copies/mL)',
  artStatus: 'ART Status',
  artRegimen: 'ART Regimen',
  irisPresent: 'IRIS Present',
  diagnosisMethod: 'Diagnosis Methods',
  radiologicFeatures: 'Radiologic Features',
  cultureResults: 'Culture Results',
  histopathologyResults: 'Histopathology Results',
  susceptibilityTesting: 'Susceptibility Testing',
  antimicrobialTherapy: 'Antimicrobial Therapy',
  treatmentDuration: 'Treatment Duration',
  treatmentResponse: 'Treatment Response',
  adverseDrugReactions: 'Adverse Drug Reactions',
  prophylaxisHistory: 'Prophylaxis History',
  prophylaxisIndicated: 'Prophylaxis Indicated',
  hospitalAdmissionRequired: 'Hospital Admission Required',
  coinfections: 'Coinfections',
};
const SECTION_FIELDS = {
  'clinical-info': ['date', 'symptomOnsetDate', 'severityGrade'],
  'infection-details': ['infectionType', 'pathogenIdentified', 'infectionSite', 'underlyingImmunodeficiency'],
  'immune-status': ['cd4Count', 'cd4Percentage', 'viralLoadHiv'],
  'art-info': ['artStatus', 'artRegimen', 'irisPresent'],
  'diagnosis': ['diagnosisMethod', 'radiologicFeatures', 'cultureResults', 'histopathologyResults', 'susceptibilityTesting'],
  'treatment': ['antimicrobialTherapy', 'treatmentDuration', 'treatmentResponse', 'adverseDrugReactions'],
  'prophylaxis': ['prophylaxisHistory', 'prophylaxisIndicated'],
  'clinical-status': ['hospitalAdmissionRequired', 'coinfections'],
};
const DATE_FIELDS = ['date', 'symptomOnsetDate'];
const NUMBER_FIELDS = ['cd4Count', 'cd4Percentage', 'viralLoadHiv'];
const BOOLEAN_FIELDS = ['irisPresent', 'prophylaxisIndicated', 'hospitalAdmissionRequired'];
const ARRAY_FIELDS = ['infectionSite', 'diagnosisMethod', 'antimicrobialTherapy', 'coinfections', 'adverseDrugReactions'];
const LONG_TEXT_FIELDS = ['radiologicFeatures', 'treatmentResponse', 'prophylaxisHistory', 'cultureResults', 'histopathologyResults', 'susceptibilityTesting'];
const NO_SPLIT_FIELDS = [];

const formatDate = (d) => { if (!d) return ''; try { const dt = new Date(d.$date || d); if (isNaN(dt.getTime())) return String(d); return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
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
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };

/* safeString: fold non-ASCII to safe ASCII using \uXXXX escapes ONLY (Helvetica lacks Greek/symbol glyphs).
   \u03B2 = Greek small beta (in "(1,3)-beta-D-glucan"); \u00B5 / \u03BC = micro sign / Greek mu -> u. */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  const str = typeof val === 'number' ? String(val) : typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val);
  return str
    .replace(/\u03B2/g, 'beta')
    .replace(/[\u00B5\u03BC]/g, 'u')
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
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
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|[A-Z]))[.;](?:\s+)/).map(s => s.trim().replace(/^\d+\.\s+/, '')).filter(s => s && !/^[;.,!?]+$/.test(s)); };
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
  const val = record[f];
  if (!hasVal(val)) return [];
  const label = FIELD_LABELS[f] || f;
  const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
  const titleNode = isFirst ? <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text> : null;

  if (ARRAY_FIELDS.includes(f)) {
    const items = (Array.isArray(val) ? val : [val]).filter(x => !isEmptyDeep(x));
    if (items.length === 0) return [];
    return [(
      <View key={f} style={styles.fieldGroup} wrap={false}>
        {titleNode}{showLabel && <Text style={styles.fieldLabel}>{safeString(label)}</Text>}
        {items.map((it, i) => <Text key={i} style={styles.value}>{i + 1}. {safeString(it)}</Text>)}
      </View>
    )];
  }

  let body;
  if (DATE_FIELDS.includes(f)) {
    body = <Text style={styles.value}>1. {safeString(formatDate(val))}</Text>;
  } else if (NUMBER_FIELDS.includes(f)) {
    body = <Text style={styles.value}>1. {safeString(String(val))}</Text>;
  } else if (BOOLEAN_FIELDS.includes(f)) {
    body = <Text style={styles.value}>1. {val ? 'Yes' : 'No'}</Text>;
  } else if (LONG_TEXT_FIELDS.includes(f) && !NO_SPLIT_FIELDS.includes(f)) {
    const rows = sentenceRows(safeString(val));
    body = rows.length > 1
      ? rows.map((r, i) => r.type === 'subtitle'
        ? <Text key={i} style={styles.subLabel}>{r.text}</Text>
        : <Text key={i} style={styles.value}>{r.num}. {r.text}</Text>)
      : <Text style={styles.value}>1. {safeString(fmtScalar(val))}</Text>;
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

const OpportunisticInfectionsDocumentPDFTemplate = ({ document: docProp, data }) => {
  const templateData = docProp || data;
  let records = [];
  if (Array.isArray(templateData)) {
    if (templateData.length > 0 && templateData[0].opportunistic_infections && Array.isArray(templateData[0].opportunistic_infections)) records = templateData[0].opportunistic_infections;
    else records = templateData;
  } else if (templateData && templateData.opportunistic_infections) {
    records = Array.isArray(templateData.opportunistic_infections) ? templateData.opportunistic_infections : [templateData.opportunistic_infections];
  } else if (templateData && templateData.documentData) {
    const dd = templateData.documentData;
    records = Array.isArray(dd) ? dd : (dd.opportunistic_infections ? (Array.isArray(dd.opportunistic_infections) ? dd.opportunistic_infections : [dd.opportunistic_infections]) : [dd]);
  } else if (templateData) {
    records = [templateData];
  }
  records = records.filter(r => r && typeof r === 'object');

  if (!records || records.length === 0) {
    return (
      <Document><Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Opportunistic Infections</Text></View>
        <Text style={styles.emptyState}>No opportunistic infections records available.</Text>
      </Page></Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Opportunistic Infections</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <Text style={styles.recordTitle}>{safeString(`Opportunistic Infection ${idx + 1}`)}</Text>
            {SECTION_ORDER.map((sid) => {
              const vis = (SECTION_FIELDS[sid] || []).filter(f => hasVal(record[f]));
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

export default OpportunisticInfectionsDocumentPDFTemplate;
