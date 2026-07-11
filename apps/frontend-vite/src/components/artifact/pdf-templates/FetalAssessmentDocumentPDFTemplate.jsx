/**
 * FetalAssessmentDocumentPDFTemplate.jsx
 * Box-free B&W LETTER (canonical, memory 6a2d6af6) — mirrors the JSX: status enum canonical, real record.date
 * (never createdAt), values numbered ('1.' even singles), single-name label gate, OBJECT leaves stacked
 * (sub-label + numbered value, never "key: value"), recommendations date-grouped. Collection: fetal_assessment
 *
 * Rule #74: each field is ONE wrap={false} atomic View; the sectionTitle rides INSIDE the first present
 * field's View (anti-orphan). splitBySentence splits on [.;]. Unlabeled single sentence with >=3 guarded
 * comma items → numbered rows (mirror the JSX plan split). PHI footer is STATIC only (no dynamic page-number
 * render callback — that crashes react-pdf 4.5.1 at 3+ pages).
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
  nested: { marginLeft: 10, paddingLeft: 8, borderLeftWidth: 0.5, borderLeftColor: '#999999', marginTop: 2 },
  recDate: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, borderTopWidth: 0.5, borderTopColor: '#999999', paddingTop: 8 },
  footerText: { fontSize: 10, color: '#666666' },
});

/* ═══════ CONSTANTS ═══════ */
const SECTION_TITLES = {
  'session-info': 'Session Information', 'fetal-parameters': 'Fetal Parameters', 'fetal-movement': 'Fetal Movement',
  'leopold-maneuvers': 'Leopold Maneuvers', 'findings-section': 'Findings', 'assessment-section': 'Assessment',
  'plan-section': 'Plan', 'results-section': 'Results', 'recommendations-section': 'Recommendations', 'notes-section': 'Notes',
};
const FIELD_LABELS = {
  date: 'Date', provider: 'Provider', facility: 'Facility', status: 'Status',
  fetalHeartRate: 'Fetal Heart Rate', fundalHeight: 'Fundal Height', fundalHeightPercentile: 'Fundal Height Percentile',
  fetalPosition: 'Fetal Position', fetalPresentation: 'Fetal Presentation', estimatedFetalWeight: 'Estimated Fetal Weight',
  fetalMovement: 'Fetal Movement', leopoldManeuvers: 'Leopold Maneuvers',
  findings: 'Findings', assessment: 'Assessment', plan: 'Plan',
  results: 'Results', recommendations: 'Recommendations', notes: 'Notes',
};
const SECTION_FIELDS = {
  'session-info': ['date', 'provider', 'facility', 'status'],
  'fetal-parameters': ['fetalHeartRate', 'fundalHeight', 'fundalHeightPercentile', 'fetalPosition', 'fetalPresentation', 'estimatedFetalWeight'],
  'fetal-movement': ['fetalMovement'], 'leopold-maneuvers': ['leopoldManeuvers'],
  'findings-section': ['findings'], 'assessment-section': ['assessment'], 'plan-section': ['plan'],
  'results-section': ['results'], 'recommendations-section': ['recommendations'], 'notes-section': ['notes'],
};
const SECTION_ORDER = ['session-info', 'fetal-parameters', 'fetal-movement', 'leopold-maneuvers', 'findings-section', 'assessment-section', 'plan-section', 'results-section', 'recommendations-section', 'notes-section'];
const DATE_FIELDS = ['date'];
const OBJECT_FIELDS = ['fetalMovement', 'leopoldManeuvers', 'results'];
const OBJECT_ARRAY_FIELDS = ['recommendations'];
const ENUM_OPTIONS = { status: ['Active', 'Completed', 'Not Active'] };
const enumCanonical = (fn, cur) => { const base = ENUM_OPTIONS[fn] || []; const hit = base.find(o => o.toLowerCase() === String(cur ?? '').toLowerCase()); return hit || cur; };

const KEY_OVERRIDES = { efw: 'EFW', afi: 'AFI', nst: 'NST', bpp: 'BPP', fhr: 'FHR', ga: 'GA', us: 'US' };
const humanizeKey = (key) => { if (key === null || key === undefined || key === '') return ''; if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key]; const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); return s.charAt(0).toUpperCase() + s.slice(1); };

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
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'number' ? String(val) : typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val);
  str = str.replace(/[µμ]m/g, 'um').replace(/[µμ]g/g, 'mcg').replace(/[µμ]/g, 'u').replace(/°/g, ' deg').replace(/±/g, '+/-')
    .replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/→/g, '->').replace(/“/g, '"').replace(/”/g, '"')
    .replace(/‘/g, "'").replace(/’/g, "'").replace(/—/g, '-').replace(/–/g, '-');
  return str;
};
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|EFW|AFI|NST|BPP))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };
const parseLabel = (text) => { if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' }; const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/); if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() }; return { isLabeled: false, label: '', value: text }; };
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* recursive object node: sub-label heading + numbered value line (STACKED, never "Label: value") */
const renderObjectNode = (label, value, keyPath, depth) => {
  if (isEmptyDeep(value)) return null;
  const LabelTag = depth > 0 ? styles.subLabel : styles.fieldLabel;
  if (isScalar(value)) {
    return (
      <View key={keyPath}>
        {label ? <Text style={LabelTag}>{label}</Text> : null}
        <Text style={styles.value}>1. {safeString(fmtScalar(value))}</Text>
      </View>
    );
  }
  const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  return (
    <View key={keyPath}>
      {label ? <Text style={LabelTag}>{label}</Text> : null}
      <View style={label ? styles.nested : undefined}>{entries.map(([k, v]) => renderObjectNode(humanizeKey(k), v, `${keyPath}-${k}`, depth + 1))}</View>
    </View>
  );
};

/* STRING rows: LABELED sentence → subtitle + >=2 comma rows; UNLABELED single sentence >=3 comma → numbered;
   otherwise one whole numbered row per sentence. */
const stringRows = (text) => {
  const strip = (x) => x.replace(/[;.]+$/, '').trim();
  const strVal = fmtVal(text);
  const sentences = splitBySentence(strVal);
  const single = parseLabel(strVal);
  if (sentences.length <= 1 && !single.isLabeled) {
    const commaItems = splitByComma(strVal);
    if (commaItems.length >= 3) return commaItems.map((c, i) => ({ type: 'item', text: safeString(strip(c)), num: i + 1 }));
    return [{ type: 'item', text: safeString(strVal), num: 1 }];
  }
  const rows = []; let n = 1;
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const parts = splitByComma(parsed.value);
      const items = (parts.length >= 2 ? parts : [parsed.value]).map(strip);
      rows.push({ type: 'subtitle', text: safeString(parsed.label) });
      let m = 1; items.forEach(it => rows.push({ type: 'item', text: safeString(it), num: m++ }));
    } else {
      rows.push({ type: 'item', text: safeString(strip(s)), num: n++ });
    }
  });
  return rows;
};

/* Rule #74: render a field as wrap={false} atomic View(s); sectionTitle rides inside the first View. */
const renderField = (record, field, sectionTitle, isFirst) => {
  const val = record[field];
  if (!hasVal(val)) return [];
  const label = FIELD_LABELS[field] || field;
  const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
  const titleNode = isFirst ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null;

  if (DATE_FIELDS.includes(field)) {
    return [(
      <View key={field} style={styles.fieldGroup} wrap={false}>
        {titleNode}{showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        <Text style={styles.value}>1. {formatDate(val)}</Text>
      </View>
    )];
  }
  if (ENUM_OPTIONS[field]) {
    return [(
      <View key={field} style={styles.fieldGroup} wrap={false}>
        {titleNode}{showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        <Text style={styles.value}>1. {safeString(enumCanonical(field, fmtVal(val)))}</Text>
      </View>
    )];
  }
  if (OBJECT_ARRAY_FIELDS.includes(field)) {
    const recs = Array.isArray(val) ? val : [];
    if (recs.length === 0) return [];
    const groups = [];
    recs.forEach((r) => { const d = (r?.date || '').trim(); const last = groups[groups.length - 1]; if (last && last.date === d) last.items.push(r); else groups.push({ date: d, items: [r] }); });
    return [(
      <View key={field} style={styles.fieldGroup} wrap={false}>
        {titleNode}{showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {groups.map((group, gIdx) => (
          <View key={gIdx}>
            {group.date ? <Text style={styles.recDate}>{group.date}</Text> : null}
            {group.items.map((r, i) => (<Text key={i} style={styles.value}>{i + 1}. {safeString((r?.recommendation || '').trim())}</Text>))}
          </View>
        ))}
      </View>
    )];
  }
  if (OBJECT_FIELDS.includes(field)) {
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return [];
    return entries.map(([k, v], i) => (
      <View key={`${field}-${k}`} style={styles.fieldGroup} wrap={false}>
        {i === 0 ? titleNode : null}
        {i === 0 && showLabel ? <Text style={styles.fieldLabel}>{label}</Text> : null}
        {renderObjectNode(humanizeKey(k), v, `${field}-${k}`, 1)}
      </View>
    ));
  }

  /* string */
  const rows = stringRows(val);
  return [(
    <View key={field} style={styles.fieldGroup} wrap={false}>
      {titleNode}{showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      {rows.map((r, i) => r.type === 'subtitle'
        ? <Text key={i} style={styles.subLabel}>{r.text}</Text>
        : <Text key={i} style={styles.value}>{r.num}. {r.text}</Text>)}
    </View>
  )];
};

const FetalAssessmentDocumentPDFTemplate = ({ document: data }) => {
  let records = [];
  if (Array.isArray(data)) {
    if (data.length === 1 && data[0]?.fetal_assessment) records = Array.isArray(data[0].fetal_assessment) ? data[0].fetal_assessment : [data[0].fetal_assessment];
    else records = data;
  } else if (data?.fetal_assessment) records = Array.isArray(data.fetal_assessment) ? data.fetal_assessment : [data.fetal_assessment];
  else if (data?.documentData) { const dd = data.documentData; if (Array.isArray(dd)) records = dd; else if (dd?.fetal_assessment) records = Array.isArray(dd.fetal_assessment) ? dd.fetal_assessment : [dd.fetal_assessment]; else if (dd && typeof dd === 'object') records = [dd]; }
  else if (data && typeof data === 'object') records = [data];

  records = (records || []).filter(r => r && typeof r === 'object').map(record => {
    const cleanRecord = {};
    for (const key of Object.keys(record)) { if (!key.startsWith('_')) cleanRecord[key] = record[key]; }
    return cleanRecord;
  });

  if (records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.documentTitle}>Fetal Assessment</Text></View><Text style={styles.emptyState}>No data available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Fetal Assessment</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <Text style={styles.recordTitle}>{`Fetal Assessment ${idx + 1}`}</Text>
            {SECTION_ORDER.map((sid) => {
              const fields = SECTION_FIELDS[sid];
              const presentFields = fields.filter(f => hasVal(record[f]));
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

export default FetalAssessmentDocumentPDFTemplate;
