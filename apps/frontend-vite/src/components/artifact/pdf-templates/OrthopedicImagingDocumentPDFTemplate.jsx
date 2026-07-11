/**
 * OrthopedicImagingDocumentPDFTemplate.jsx
 * Box-free B&W LETTER (canonical, memory 6a2d6af6) - mirrors the JSX:
 *   - record `date` -> editable header pill in the JSX -> rendered here as the record-header date line
 *     (the SAME record.date the JSX edits - NEVER createdAt/updatedAt).
 *   - nested objects (mri / xray / ct / results) -> recursive object rows (resolvePath + objectRows):
 *     each key a subLabel, arrays-in-objects decomposed, labeled scalar items split (never side-by-side).
 *   - narrative strings sentence-split ([.;] with abbrev/single-initial guard + labeled comma-split),
 *     values numbered ('1.' even singles), single-name label gate.
 * Rule #74: each field is ONE wrap={false} atomic View with the sectionTitle riding INSIDE the first
 * present field's View. Static PHI footer. safeString uses ONLY \uXXXX escapes.
 * Collection: orthopedic_imaging.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 16 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: '#000000', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000' },
  recordContainer: { marginBottom: 20 },
  recordDate: { fontSize: 12, fontFamily: 'Helvetica', color: '#000000', marginBottom: 4 },
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

const SECTION_ORDER = ['study-info', 'imaging-mri', 'imaging-xray', 'imaging-ct', 'clinical-findings', 'imaging-results', 'assessment-plan'];
const SECTION_TITLES = {
  'study-info': 'Study Information',
  'imaging-mri': 'MRI',
  'imaging-xray': 'X-Ray',
  'imaging-ct': 'CT Scan',
  'clinical-findings': 'Clinical Findings',
  'imaging-results': 'Imaging Measurements',
  'assessment-plan': 'Assessment and Plan',
};
const FIELD_LABELS = {
  date: 'Date',
  type: 'Type',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  mri: 'MRI',
  xray: 'X-Ray',
  ct: 'CT Scan',
  findings: 'Findings',
  boneContusions: 'Bone Contusions',
  effusion: 'Effusion',
  results: 'Imaging Measurements',
  assessment: 'Assessment',
  plan: 'Plan',
  recommendations: 'Recommendations',
  notes: 'Notes',
};
const SECTION_FIELDS = {
  'study-info': ['date', 'type', 'provider', 'facility', 'status'],
  'imaging-mri': ['mri'],
  'imaging-xray': ['xray'],
  'imaging-ct': ['ct'],
  'clinical-findings': ['findings', 'boneContusions', 'effusion'],
  'imaging-results': ['results'],
  'assessment-plan': ['assessment', 'plan', 'recommendations', 'notes'],
};
const HEADER_DATE_FIELD = 'date';
const DATE_FIELDS = ['date'];
const NUMBER_FIELDS = [];
const HIDE_ZERO_FIELDS = NUMBER_FIELDS;
const STRING_FIELDS = ['type', 'provider', 'facility', 'status', 'findings', 'effusion', 'assessment', 'plan', 'notes'];
const ARRAY_FIELDS = ['boneContusions', 'recommendations'];
const OBJECT_FIELDS = ['mri', 'xray', 'ct', 'results'];

const resolvePath = (obj, path) => { if (!obj || !path) return undefined; return String(path).split('.').reduce((cur, part) => (cur === null || cur === undefined) ? undefined : cur[part], obj); };
const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};
const isScalar = (v) => v === null || typeof v !== 'object';
const hasVal = (v) => !isEmptyDeep(v);
const hasFieldVal = (fn, v) => { if (!hasVal(v)) return false; if (HIDE_ZERO_FIELDS.includes(fn) && Number(v) === 0) return false; return true; };
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };

const KEY_OVERRIDES = { mri: 'MRI', ct: 'CT', xray: 'X-Ray', orif: 'ORIF', rom: 'ROM', ap: 'AP', id: 'ID', mm: 'mm', cm: 'cm' };
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const lower = String(key).toLowerCase();
  if (KEY_OVERRIDES[lower]) return KEY_OVERRIDES[lower];
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.split(' ').map(w => { const l = w.toLowerCase(); return KEY_OVERRIDES[l] || (w.charAt(0).toUpperCase() + w.slice(1)); }).join(' ');
};

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try {
    const d = new Date(dateValue.$date || dateValue);
    if (isNaN(d.getTime())) return String(dateValue);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(dateValue); }
};
const fmtLeaf = (keyName, v) => {
  if (typeof v === 'string' && /date/i.test(keyName || '') && /^\d{4}-\d{2}-\d{2}/.test(v)) return formatDate(v);
  return fmtScalar(v);
};

/* safeString - ONLY \uXXXX escapes (never literal smart-quotes / dashes / BOM). */
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
}
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
const strip = (s) => safeString(s).replace(/^\s*\d+\.\s+/, '').replace(/[;.]+$/, '').trim();

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

/* objectRows: recursively render a nested object/array/scalar into <Text> rows (subLabel + value),
   decomposing labeled scalar array items (parseLabel) - mirrors the JSX renderObjectNode. */
const objectRows = (value, keyName, keyPrefix) => {
  if (isEmptyDeep(value)) return [];
  if (isScalar(value)) return [<Text key={keyPrefix} style={styles.value}>{safeString(fmtLeaf(keyName, value))}</Text>];
  if (Array.isArray(value)) {
    const items = value.filter(x => !isEmptyDeep(x));
    const out = [];
    items.forEach((it, i) => {
      if (isScalar(it)) {
        const p = parseLabel(String(it));
        if (p.isLabeled) {
          out.push(<Text key={`${keyPrefix}-${i}-l`} style={styles.subLabel}>{safeString(p.label)}</Text>);
          out.push(<Text key={`${keyPrefix}-${i}`} style={styles.value}>{safeString(p.value)}</Text>);
        } else {
          out.push(<Text key={`${keyPrefix}-${i}`} style={styles.value}>{i + 1}. {safeString(fmtScalar(it))}</Text>);
        }
      } else {
        out.push(<Text key={`${keyPrefix}-${i}-h`} style={styles.subLabel}>Item {i + 1}</Text>);
        objectRows(it, '', `${keyPrefix}-${i}`).forEach(el => out.push(el));
      }
    });
    return out;
  }
  const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
  const out = [];
  entries.forEach(([k, v]) => {
    out.push(<Text key={`${keyPrefix}-${k}-l`} style={styles.subLabel}>{safeString(humanizeKey(k))}</Text>);
    objectRows(v, k, `${keyPrefix}-${k}`).forEach(el => out.push(el));
  });
  return out;
};

const renderField = (record, f, sectionTitle, isFirst) => {
  const val = resolvePath(record, f);
  if (!hasFieldVal(f, val)) return [];
  const label = FIELD_LABELS[f] || f;
  const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
  const titleNode = isFirst ? <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text> : null;

  let body;
  if (OBJECT_FIELDS.includes(f)) {
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return [];
    body = entries.flatMap(([k, v]) => {
      const rows = [<Text key={`${f}-${k}-l`} style={styles.subLabel}>{safeString(humanizeKey(k))}</Text>];
      objectRows(v, k, `${f}-${k}`).forEach(el => rows.push(el));
      return rows;
    });
  } else if (ARRAY_FIELDS.includes(f)) {
    const items = (Array.isArray(val) ? val : [val]).filter(x => !isEmptyDeep(x));
    if (items.length === 0) return [];
    body = items.map((it, i) => {
      const p = parseLabel(String(it));
      if (isScalar(it) && p.isLabeled) {
        return (
          <View key={i}>
            <Text style={styles.subLabel}>{safeString(p.label)}</Text>
            <Text style={styles.value}>{safeString(p.value)}</Text>
          </View>
        );
      }
      return <Text key={i} style={styles.value}>{i + 1}. {safeString(fmtScalar(it))}</Text>;
    });
  } else if (DATE_FIELDS.includes(f)) {
    body = <Text style={styles.value}>{safeString(formatDate(val))}</Text>;
  } else if (STRING_FIELDS.includes(f)) {
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

const OrthopedicImagingDocumentPDFTemplate = ({ document: docProp, data }) => {
  const templateData = docProp || data;
  let records = [];
  if (Array.isArray(templateData)) {
    if (templateData.length > 0 && templateData[0].orthopedic_imaging && Array.isArray(templateData[0].orthopedic_imaging)) records = templateData[0].orthopedic_imaging;
    else records = templateData;
  } else if (templateData && templateData.orthopedic_imaging) {
    records = Array.isArray(templateData.orthopedic_imaging) ? templateData.orthopedic_imaging : [templateData.orthopedic_imaging];
  } else if (templateData && templateData.documentData) {
    const dd = templateData.documentData;
    records = Array.isArray(dd) ? dd : (dd.orthopedic_imaging ? (Array.isArray(dd.orthopedic_imaging) ? dd.orthopedic_imaging : [dd.orthopedic_imaging]) : [dd]);
  } else if (templateData) {
    records = [templateData];
  }
  records = records.filter(r => r && typeof r === 'object');

  if (!records || records.length === 0) {
    return (
      <Document><Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Orthopedic Imaging</Text></View>
        <Text style={styles.emptyState}>No orthopedic imaging records available.</Text>
      </Page></Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Orthopedic Imaging</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <View wrap={false}>
              {hasVal(record.date) && <Text style={styles.recordDate}>{safeString(formatDate(record.date))}</Text>}
              <Text style={styles.recordTitle}>{safeString(`Imaging Study ${idx + 1}`)}</Text>
            </View>
            {SECTION_ORDER.map((sid) => {
              const vis = (SECTION_FIELDS[sid] || []).filter(f => f !== HEADER_DATE_FIELD && hasFieldVal(f, resolvePath(record, f)));
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

export default OrthopedicImagingDocumentPDFTemplate;
