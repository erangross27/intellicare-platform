/**
 * InfectiousDiseaseAssessmentDocumentPDFTemplate.jsx
 * Box-free B&W LETTER (canonical) — mirrors InfectiousDiseaseAssessmentDocument.jsx:
 * real record.date (never createdAt), config-driven SECTION_ORDER/SECTION_TITLES/FIELD_LABELS/
 * SECTION_FIELDS copied verbatim from the JSX. Generic recursive renderer (resolvePath + fieldBody +
 * objectRows) handles dotted-path fields, empty {}/[] gated out (isEmptyDeep), and the
 * antimicrobialTherapy ARRAY-OF-OBJECTS (each item flattened box-free: scalars inline "Key: value" —
 * allowed in the PDF only). Narrative assessment/plan use [.;] sentence-split (abbrev/single-initial
 * guard, leading-marker strip, thousands-guarded comma-split). Each field is ONE wrap={false} atomic
 * View with the sectionTitle riding INSIDE the first present field's View (Rule #74 anti-orphan).
 * safeString uses \uXXXX escapes ONLY. Static PHI footer. Collection: infectious_disease_assessment.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 64, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000', lineHeight: 1.4 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', marginBottom: 16, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', marginTop: 14, marginBottom: 10, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: '#000000' },
  section: { marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginTop: 10, marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldGroup: { marginBottom: 8 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 6, marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  subLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 4, marginBottom: 2 },
  value: { fontSize: 14, paddingLeft: 8, marginBottom: 3, lineHeight: 1.4 },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, fontSize: 9, color: '#666666', textAlign: 'center', borderTopWidth: 0.5, borderTopColor: '#cccccc', paddingTop: 6 },
  noData: { fontSize: 14, textAlign: 'center', marginTop: 40, color: '#666666' },
});

/* CONFIG (mirrors the JSX) */
const SECTION_ORDER = ['session-info', 'hiv-status', 'opportunistic-infections', 'hepatitis-panel', 'antimicrobial-therapy', 'cultures', 'assessment-plan', 'recommendations', 'results', 'notes'];

const SECTION_TITLES = {
  'session-info': 'Session Information',
  'hiv-status': 'HIV Status',
  'opportunistic-infections': 'Opportunistic Infections',
  'hepatitis-panel': 'Hepatitis Panel',
  'antimicrobial-therapy': 'Antimicrobial Therapy',
  'cultures': 'Cultures',
  'assessment-plan': 'Assessment & Plan',
  'recommendations': 'Recommendations',
  'results': 'Results',
  'notes': 'Notes',
};

const FIELD_LABELS = {
  date: 'Date',
  type: 'Type',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  'hivStatus.cd4Count': 'CD4 Count',
  'hivStatus.cd4Percentage': 'CD4 Percentage',
  'hivStatus.viralLoad': 'Viral Load',
  'hivStatus.resistance': 'Resistance',
  'hivStatus.artRegimen': 'ART Regimen',
  opportunisticInfections: 'Opportunistic Infections',
  'hepatitisPanel.hbsAg': 'HBsAg',
  'hepatitisPanel.hbcAb': 'HBcAb',
  'hepatitisPanel.hcvRna': 'HCV RNA',
  'hepatitisPanel.hcvGenotype': 'HCV Genotype',
  antimicrobialTherapy: 'Antimicrobial Therapy',
  cultures: 'Cultures',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  recommendations: 'Recommendations',
  results: 'Results',
  notes: 'Notes',
};

const SECTION_FIELDS = {
  'session-info': ['date', 'type', 'provider', 'facility', 'status'],
  'hiv-status': ['hivStatus.cd4Count', 'hivStatus.cd4Percentage', 'hivStatus.viralLoad', 'hivStatus.resistance', 'hivStatus.artRegimen'],
  'opportunistic-infections': ['opportunisticInfections'],
  'hepatitis-panel': ['hepatitisPanel.hbsAg', 'hepatitisPanel.hbcAb', 'hepatitisPanel.hcvRna', 'hepatitisPanel.hcvGenotype'],
  'antimicrobial-therapy': ['antimicrobialTherapy'],
  'cultures': ['cultures'],
  'assessment-plan': ['findings', 'assessment', 'plan'],
  'recommendations': ['recommendations'],
  'results': ['results'],
  'notes': ['notes'],
};

const DATE_FIELDS = ['date'];

/* HELPERS (mirror the JSX) */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u2192/g, '->')
    .replace(/\u2265/g, '>=')
    .replace(/\u2264/g, '<=')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u2028\u2029\uFEFF]/g, '');
};

const resolvePath = (obj, path) => { if (!obj || !path) return undefined; return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj); };
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
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
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

const strip = (x) => safeString(x).replace(/^\s*\d+\.\s+/, '').replace(/[;.]+$/, '').trim();

const sentenceRows = (text) => {
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
          rows.push({ type: 'item', text: strip(ip.isLabeled ? ip.value : it), num: m++ });
        });
      } else {
        rows.push({ type: 'subtitle', text: safeString(parsed.label) });
        rows.push({ type: 'item', text: strip(parsed.value), num: 1 });
      }
    } else {
      rows.push({ type: 'item', text: strip(s), num: n++ });
    }
  });
  return rows;
};

/* Recursively flatten a nested object into box-free rows (scalars inline "Key: value") */
const objectRows = (obj, kp) => {
  const out = [];
  Object.entries(obj).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v], i) => {
    const key = `${kp}.${k}.${i}`;
    if (isScalar(v)) {
      out.push(<Text key={key} style={styles.value}>{humanizeKey(k)}: {safeString(fmtScalar(v))}</Text>);
    } else if (Array.isArray(v)) {
      out.push(<Text key={key + 'h'} style={styles.subLabel}>{humanizeKey(k)}</Text>);
      v.filter(x => !isEmptyDeep(x)).forEach((it, j) => {
        if (isScalar(it)) out.push(<Text key={key + '-' + j} style={styles.value}>{j + 1}. {safeString(fmtScalar(it))}</Text>);
        else objectRows(it, key + '-' + j).forEach(r => out.push(r));
      });
    } else {
      out.push(<Text key={key + 'h'} style={styles.subLabel}>{humanizeKey(k)}</Text>);
      objectRows(v, key).forEach(r => out.push(r));
    }
  });
  return out;
};

/* Top-level value → rows for one field */
const fieldBody = (field, val) => {
  if (DATE_FIELDS.includes(field)) return [<Text key="d" style={styles.value}>1. {safeString(formatDate(val))}</Text>];
  if (isScalar(val)) {
    if (typeof val === 'string') {
      const rows = sentenceRows(val);
      return rows.length > 1
        ? rows.map((r, i) => r.type === 'subtitle'
          ? <Text key={i} style={styles.subLabel}>{r.text}</Text>
          : <Text key={i} style={styles.value}>{r.num}. {r.text}</Text>)
        : [<Text key="s" style={styles.value}>1. {safeString(val)}</Text>];
    }
    return [<Text key="n" style={styles.value}>1. {safeString(fmtScalar(val))}</Text>];
  }
  if (Array.isArray(val)) {
    const items = val.filter(x => !isEmptyDeep(x));
    if (items.every(isScalar)) return items.map((it, i) => <Text key={i} style={styles.value}>{i + 1}. {safeString(fmtScalar(it))}</Text>);
    const out = [];
    items.forEach((it, i) => {
      if (isScalar(it)) out.push(<Text key={'s' + i} style={styles.value}>{i + 1}. {safeString(fmtScalar(it))}</Text>);
      else objectRows(it, 'o' + i).forEach(r => out.push(r));
    });
    return out;
  }
  return objectRows(val, 'obj');
};

const fieldPresent = (record, field) => hasVal(resolvePath(record, field));

const renderField = (record, field, sectionTitle, isFirst) => {
  if (!fieldPresent(record, field)) return [];
  const val = resolvePath(record, field);
  const label = FIELD_LABELS[field] || field;
  const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
  const titleNode = isFirst ? <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text> : null;
  return [(
    <View key={field} style={styles.fieldGroup} wrap={false}>
      {titleNode}{showLabel && <Text style={styles.fieldLabel}>{safeString(label)}</Text>}
      {fieldBody(field, val)}
    </View>
  )];
};

const InfectiousDiseaseAssessmentDocumentPDFTemplate = ({ document: data }) => {
  let records = [];
  if (Array.isArray(data)) {
    if (data.length === 1 && data[0]?.infectious_disease_assessment) records = Array.isArray(data[0].infectious_disease_assessment) ? data[0].infectious_disease_assessment : [data[0].infectious_disease_assessment];
    else records = data;
  } else if (data?.infectious_disease_assessment) records = Array.isArray(data.infectious_disease_assessment) ? data.infectious_disease_assessment : [data.infectious_disease_assessment];
  else if (data?.documentData) { const dd = data.documentData; if (Array.isArray(dd)) records = dd; else if (dd?.infectious_disease_assessment) records = Array.isArray(dd.infectious_disease_assessment) ? dd.infectious_disease_assessment : [dd.infectious_disease_assessment]; else if (dd && typeof dd === 'object') records = [dd]; }
  else if (data && typeof data === 'object') records = [data];
  records = (records || []).filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Infectious Disease Assessment</Text>
          <Text style={styles.noData}>No infectious disease assessment records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Infectious Disease Assessment</Text>
        {records.map((record, rIdx) => (
          <View key={rIdx} break={rIdx > 0}>
            <Text style={styles.recordTitle}>{safeString(`Infectious Disease Assessment ${rIdx + 1}`)}</Text>
            {SECTION_ORDER.map((sid) => {
              const presentFields = (SECTION_FIELDS[sid] || []).filter(f => fieldPresent(record, f));
              if (presentFields.length === 0) return null;
              const title = SECTION_TITLES[sid];
              return (
                <View key={sid} style={styles.section}>
                  {presentFields.flatMap((f, fi) => renderField(record, f, title, fi === 0))}
                </View>
              );
            })}
          </View>
        ))}
        <Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text>
      </Page>
    </Document>
  );
};

export default InfectiousDiseaseAssessmentDocumentPDFTemplate;
