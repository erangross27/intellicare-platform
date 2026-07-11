/**
 * MyelomaSpecificDataDocumentPDFTemplate.jsx
 * Box-free B&W LETTER (canonical) - mirrors MyelomaSpecificDataDocument.jsx:
 * real record.date (never createdAt), 7 sections in SECTION_ORDER, dotted-path fields (resolvePath)
 * for crabCriteria.* / lightChains.*, deep recursive objects (results) flattened box-free -
 * scalars inline "Key: value", arrays numbered, nested objects under a subLabel. Narrative strings
 * (findings/assessment/plan/notes) use [.;] sentence-split (abbrev/single-initial guard, labeled ->
 * subLabel + value, thousands-guarded comma-split so "1,250 mg/L" / "5,420 mg/dL" stay intact).
 * Single-name label gate (field label === section title -> field label hidden). Rule #74: each field
 * is ONE wrap={false} atomic View with the sectionTitle riding INSIDE the first present field's View.
 * safeString uses ONLY \uXXXX escapes (0 non-ASCII bytes). Static PHI footer. Collection: myeloma_specific_data.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 64, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 16 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000' },
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

/* ====== CONSTANTS (mirror the JSX) ====== */
const SECTION_ORDER = ['provider-info', 'crab-criteria', 'laboratory-values', 'diagnostic-markers', 'findings-assessment', 'plan-notes', 'results'];

const SECTION_TITLES = {
  'provider-info': 'Provider Information',
  'crab-criteria': 'CRAB Criteria',
  'laboratory-values': 'Laboratory Values',
  'diagnostic-markers': 'Diagnostic Markers',
  'findings-assessment': 'Findings & Assessment',
  'plan-notes': 'Plan & Notes',
  'results': 'Results',
};

const FIELD_LABELS = {
  date: 'Date',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  'crabCriteria.calcium': 'Calcium (C)',
  'crabCriteria.renalInsufficiency': 'Renal Insufficiency (R)',
  'crabCriteria.anemia': 'Anemia (A)',
  'crabCriteria.boneLesions': 'Bone Lesions (B)',
  mSpike: 'M-Spike',
  'lightChains.kappa': 'Kappa',
  'lightChains.lambda': 'Lambda',
  'lightChains.ratio': 'Ratio',
  beta2Microglobulin: 'Beta-2 Microglobulin',
  plasmaCellPercentage: 'Plasma Cell Percentage',
  benceJonesProtein: 'Bence Jones Protein',
  immunofixation: 'Immunofixation',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  recommendations: 'Recommendations',
  notes: 'Notes',
  results: 'Results',
};

const SECTION_FIELDS = {
  'provider-info': ['date', 'provider', 'facility', 'status'],
  'crab-criteria': ['crabCriteria.calcium', 'crabCriteria.renalInsufficiency', 'crabCriteria.anemia', 'crabCriteria.boneLesions'],
  'laboratory-values': ['mSpike', 'lightChains.kappa', 'lightChains.lambda', 'lightChains.ratio', 'beta2Microglobulin', 'plasmaCellPercentage'],
  'diagnostic-markers': ['benceJonesProtein', 'immunofixation'],
  'findings-assessment': ['findings', 'assessment'],
  'plan-notes': ['plan', 'recommendations', 'notes'],
  'results': ['results'],
};

const DATE_FIELDS = ['date'];

/* ====== HELPERS (mirror the JSX) ====== */
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

/* safeString: ONLY \uXXXX escapes - never paste literal smart-quotes / dashes / BOM into the regex. */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  const str = typeof val === 'number' ? String(val) : typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val);
  return str
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
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

/* sentenceRows: splitBySentence -> parseLabel -> splitByComma, decomposing nested "Label: value"
   comma items into their own sub-label (mirrors the JSX decomposition; never side-by-side). */
const sentenceRows = (text) => {
  const strip = (x) => String(x).replace(/^\s*\d+\.\s+/, '').replace(/[;.]+$/, '').trim();
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

/* Top-level value -> rows for one field */
const fieldBody = (field, val) => {
  if (DATE_FIELDS.includes(field)) return [<Text key="d" style={styles.value}>1. {formatDate(val)}</Text>];
  if (isScalar(val)) {
    if (typeof val === 'string') {
      const rows = sentenceRows(safeString(val));
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

const MyelomaSpecificDataDocumentPDFTemplate = ({ document: data }) => {
  let records = [];
  if (Array.isArray(data)) {
    if (data.length === 1 && data[0]?.myeloma_specific_data) records = Array.isArray(data[0].myeloma_specific_data) ? data[0].myeloma_specific_data : [data[0].myeloma_specific_data];
    else records = data;
  } else if (data?.myeloma_specific_data) records = Array.isArray(data.myeloma_specific_data) ? data.myeloma_specific_data : [data.myeloma_specific_data];
  else if (data?.documentData) { const dd = data.documentData; if (Array.isArray(dd)) records = dd; else if (dd?.myeloma_specific_data) records = Array.isArray(dd.myeloma_specific_data) ? dd.myeloma_specific_data : [dd.myeloma_specific_data]; else if (dd && typeof dd === 'object') records = [dd]; }
  else if (data?.records) records = Array.isArray(data.records) ? data.records : [data.records];
  else if (data && typeof data === 'object') records = [data];
  records = (records || []).filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document><Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Myeloma Specific Data</Text></View>
        <Text style={styles.emptyState}>No myeloma specific data records available.</Text>
      </Page></Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Myeloma Specific Data</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <Text style={styles.recordTitle}>{safeString(`Myeloma Specific Data ${idx + 1}`)}</Text>
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
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Protected Health Information (PHI) - Handle according to HIPAA guidelines</Text>
        </View>
      </Page>
    </Document>
  );
};

export default MyelomaSpecificDataDocumentPDFTemplate;
