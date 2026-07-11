import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * IvfCycleMonitoringDocumentPDFTemplate - box-free canonical (LETTER)
 * Config-driven from the JSX SECTION_ORDER/SECTION_TITLES/FIELD_LABELS/SECTION_FIELDS.
 * Renders EVERY populated field the JSX renders (non-zero numbers, booleans as Yes/No) for JSX/PDF parity.
 * Numeric 0 is a "not measured" sentinel → skipped, matching the JSX. No boxes: underline rules only
 * (documentTitle 2 / recordTitle+sectionTitle 1 / fieldLabel 0.5). No record date (record has only createdAt).
 */

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 64, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000', lineHeight: 1.4 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', marginBottom: 16, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', marginTop: 14, marginBottom: 10, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: '#000000' },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginTop: 10, marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldWrap: { marginBottom: 8 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 6, marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  subLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 4, marginBottom: 2 },
  value: { fontSize: 14, paddingLeft: 8, marginBottom: 3, lineHeight: 1.4 },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, fontSize: 9, color: '#666666', textAlign: 'center', borderTopWidth: 0.5, borderTopColor: '#cccccc', paddingTop: 6 },
  noData: { fontSize: 14, textAlign: 'center', marginTop: 40, color: '#666666' },
});

/* CONFIG (mirrors the JSX) */
const SECTION_ORDER = ['cycle-overview', 'follicle-assessment', 'endometrial-status', 'hormone-levels', 'medication-protocol', 'trigger-retrieval'];

const SECTION_TITLES = {
  'cycle-overview': 'Cycle Overview',
  'follicle-assessment': 'Follicle Assessment',
  'endometrial-status': 'Endometrial Status',
  'hormone-levels': 'Hormone Levels',
  'medication-protocol': 'Medication Protocol',
  'trigger-retrieval': 'Trigger & Retrieval',
};

const FIELD_LABELS = {
  cycleDay: 'Cycle Day',
  stimulationProtocol: 'Stimulation Protocol',
  totalGonadotropinDays: 'Total Gonadotropin Days',
  cumulativeGonadotropinDose: 'Cumulative Gonadotropin Dose (IU)',
  follicleCount: 'Follicle Count',
  leadFollicleDiameter: 'Lead Follicle Diameter (mm)',
  folliclesGreaterThan14mm: 'Follicles > 14mm',
  follicleDistributionRight: 'Follicle Distribution (Right)',
  follicleDistributionLeft: 'Follicle Distribution (Left)',
  ovarianVolume: 'Ovarian Volume (mL)',
  endometrialThickness: 'Endometrial Thickness (mm)',
  endometrialPattern: 'Endometrial Pattern',
  freeFluidInPelvis: 'Free Fluid in Pelvis',
  serumEstradiolLevel: 'Serum Estradiol Level (pg/mL)',
  serumLhLevel: 'Serum LH Level (IU/L)',
  serumProgesteroneLevel: 'Serum Progesterone Level (ng/mL)',
  antiMullerianHormone: 'Anti-Mullerian Hormone (ng/mL)',
  gonadotropinType: 'Gonadotropin Type',
  gonadotropinDose: 'Gonadotropin Dose (IU)',
  gnrhAntagonistStarted: 'GnRH Antagonist Started',
  ovarianResponseCategory: 'Ovarian Response Category',
  ovarianHyperstimulationRisk: 'Ovarian Hyperstimulation Risk',
  triggerMedicationType: 'Trigger Medication Type',
  triggerMedicationDose: 'Trigger Medication Dose (IU)',
  scheduledRetrievalDateTime: 'Scheduled Retrieval Date/Time',
};

const SECTION_FIELDS = {
  'cycle-overview': ['cycleDay', 'stimulationProtocol', 'totalGonadotropinDays', 'cumulativeGonadotropinDose'],
  'follicle-assessment': ['follicleCount', 'leadFollicleDiameter', 'folliclesGreaterThan14mm', 'follicleDistributionRight', 'follicleDistributionLeft', 'ovarianVolume'],
  'endometrial-status': ['endometrialThickness', 'endometrialPattern', 'freeFluidInPelvis'],
  'hormone-levels': ['serumEstradiolLevel', 'serumLhLevel', 'serumProgesteroneLevel', 'antiMullerianHormone'],
  'medication-protocol': ['gonadotropinType', 'gonadotropinDose', 'gnrhAntagonistStarted', 'ovarianResponseCategory', 'ovarianHyperstimulationRisk'],
  'trigger-retrieval': ['triggerMedicationType', 'triggerMedicationDose', 'scheduledRetrievalDateTime'],
};

const NUMBER_FIELDS = ['cycleDay', 'totalGonadotropinDays', 'cumulativeGonadotropinDose', 'follicleCount', 'leadFollicleDiameter', 'folliclesGreaterThan14mm', 'ovarianVolume', 'endometrialThickness', 'serumEstradiolLevel', 'serumLhLevel', 'serumProgesteroneLevel', 'antiMullerianHormone', 'gonadotropinDose', 'triggerMedicationDose'];
const BOOLEAN_FIELDS = ['freeFluidInPelvis', 'gnrhAntagonistStarted'];
const ARRAY_FIELDS = ['follicleDistributionRight', 'follicleDistributionLeft'];
const DATE_FIELDS = ['scheduledRetrievalDateTime'];

/* HELPERS (mirror the JSX) — safeString uses ONLY \uXXXX escapes (never literal smart-quotes/invisible chars) */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u2028\u2029\uFEFF]/g, '');
};

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); if (isNaN(d.getTime())) return String(dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

/* showField: render a field only when meaningful — numeric 0 is a "not measured" sentinel → skip;
   empty arrays → skip; booleans always render (Yes/No); strings/dates need a value. Mirrors the JSX. */
const showField = (record, f) => {
  const v = record[f];
  if (NUMBER_FIELDS.includes(f)) { if (v === null || v === undefined || v === '') return false; const n = Number(v); return !Number.isNaN(n) && n !== 0; }
  if (BOOLEAN_FIELDS.includes(f)) return typeof v === 'boolean';
  if (ARRAY_FIELDS.includes(f)) return Array.isArray(v) && v.filter(x => x !== null && x !== undefined && x !== '').length > 0;
  if (DATE_FIELDS.includes(f)) return !!v;
  if (typeof v === 'string') return v.trim() !== '';
  return v !== null && v !== undefined && v !== '';
};

const CLAUSE_OPENER = /^(if|when|while|unless|although|though|because|since|after|before|once|given|whether|should|as|until|provided|assuming|in case)\b/i;
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m && !CLAUSE_OPENER.test(m[1].trim())) return { isLabeled: true, label: m[1].trim(), value: m[2].trim().replace(/^\d+\.\s+/, '') };
  return { isLabeled: false, label: '', value: text };
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

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|[A-Z]))[.;](?:\s+)/).map(s => s.trim().replace(/^\d+\.\s+/, '')).filter(s => s && !/^[;.,!?]+$/.test(s));
};

const strip = (s) => safeString(s).replace(/^\s*\d+\.\s+/, '').replace(/[;.]+$/, '').trim();

/* sentenceRows: splitBySentence -> parseLabel -> splitByComma, decomposing nested "Label: value"
   comma items into their own sub-label (mirrors the JSX decomposition; never side-by-side). */
const sentenceRows = (text) => {
  const rows = [];
  splitBySentence(text).forEach(sentence => {
    const p = parseLabel(sentence);
    if (p.isLabeled) {
      const items = splitByComma(p.value);
      if (items.length >= 2) {
        rows.push({ type: 'sub', text: p.label });
        items.forEach(it => {
          const ip = parseLabel(it);
          if (ip.isLabeled) { rows.push({ type: 'sub', text: ip.label }); rows.push({ type: 'item', text: ip.value }); }
          else rows.push({ type: 'item', text: it });
        });
      } else {
        rows.push({ type: 'sub', text: p.label });
        rows.push({ type: 'item', text: p.value });
      }
    } else {
      rows.push({ type: 'item', text: sentence });
    }
  });
  return rows;
};

const fieldBody = (record, f) => {
  const v = record[f];
  if (DATE_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(formatDate(v))}</Text>];
  if (NUMBER_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>];
  if (BOOLEAN_FIELDS.includes(f)) return [<Text key="v" style={styles.value}>{v ? 'Yes' : 'No'}</Text>];
  if (ARRAY_FIELDS.includes(f)) {
    const items = (Array.isArray(v) ? v : [v]).filter(x => x !== null && x !== undefined && x !== '');
    return items.map((it, i) => <Text key={i} style={styles.value}>{(i + 1) + '. ' + safeString(String(it))}</Text>);
  }
  const rows = sentenceRows(String(v));
  if (rows.length === 0) return [<Text key="v" style={styles.value}>{safeString(String(v))}</Text>];
  return rows.map((r, i) => r.type === 'sub'
    ? <Text key={i} style={styles.subLabel}>{safeString(r.text)}</Text>
    : <Text key={i} style={styles.value}>{strip(r.text)}</Text>);
};

const renderSection = (record, sid) => {
  const fields = SECTION_FIELDS[sid] || [];
  const present = fields.filter(f => showField(record, f));
  if (present.length === 0) return null;
  const sectionTitle = SECTION_TITLES[sid];
  return present.map((f, i) => {
    const label = FIELD_LABELS[f] || f;
    const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
    return (
      <View key={f} style={styles.fieldWrap} wrap={false}>
        {i === 0 && <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text>}
        {showLabel && <Text style={styles.fieldLabel}>{safeString(label)}</Text>}
        {fieldBody(record, f)}
      </View>
    );
  });
};

const IvfCycleMonitoringDocumentPDFTemplate = ({ document: docProp, data = docProp }) => {
  let records = [];
  if (Array.isArray(data)) records = data;
  else if (data && typeof data === 'object') records = [data];
  records = records.flatMap(r => {
    if (r?.ivf_cycle_monitoring) return Array.isArray(r.ivf_cycle_monitoring) ? r.ivf_cycle_monitoring : [r.ivf_cycle_monitoring];
    if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.ivf_cycle_monitoring) return Array.isArray(dd.ivf_cycle_monitoring) ? dd.ivf_cycle_monitoring : [dd.ivf_cycle_monitoring]; return [dd]; }
    return [r];
  }).filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>IVF Cycle Monitoring</Text>
          <Text style={styles.noData}>No IVF cycle monitoring records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>IVF Cycle Monitoring</Text>
        {records.map((record, rIdx) => (
          <View key={rIdx}>
            <Text style={styles.recordTitle} break={rIdx > 0}>{safeString(`IVF Cycle Monitoring ${rIdx + 1}`)}</Text>
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
          </View>
        ))}
        <Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text>
      </Page>
    </Document>
  );
};

export default IvfCycleMonitoringDocumentPDFTemplate;
