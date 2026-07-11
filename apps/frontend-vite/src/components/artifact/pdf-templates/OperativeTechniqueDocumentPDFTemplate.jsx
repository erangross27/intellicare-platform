/**
 * OperativeTechniqueDocumentPDFTemplate.jsx
 * Box-free B&W LETTER (canonical) - mirrors the JSX: real record.date (never createdAt), status enum
 * canonical, LONG_TEXT fields sentence-split, stepByStep labeled-array ("Heading: description" -> subLabel +
 * decomposed body), criticalSteps object-array ({step, technique, complications}), closure/results recursive
 * objects (arrays-in-objects handled), drains simple array, recommendations date-grouped. Values numbered
 * ('1.' even singles), single-name label gate. Rule #74: each field is ONE wrap={false} atomic View with the
 * sectionTitle riding INSIDE the first present field's View. Static PHI footer. Collection: operative_technique.
 * safeString: \uXXXX escapes ONLY (never literal smart-quotes / invisible chars).
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
  nested: { marginLeft: 10, paddingLeft: 8, borderLeftWidth: 0.5, borderLeftColor: '#999999', marginTop: 2 },
  recDate: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, borderTopWidth: 0.5, borderTopColor: '#999999', paddingTop: 8 },
  footerText: { fontSize: 10, color: '#666666' },
});

const SECTION_ORDER = ['general-info', 'step-by-step', 'critical-steps', 'hemostasis-irrigation', 'drains', 'closure', 'clinical-notes', 'recommendations', 'results'];
const SECTION_TITLES = {
  'general-info': 'General Information',
  'step-by-step': 'Step-by-Step Procedure',
  'critical-steps': 'Critical Steps',
  'hemostasis-irrigation': 'Hemostasis and Irrigation',
  'drains': 'Drains',
  'closure': 'Closure',
  'clinical-notes': 'Clinical Notes',
  'recommendations': 'Recommendations',
  'results': 'Results',
};
const FIELD_LABELS = {
  date: 'Date', provider: 'Provider', facility: 'Facility', status: 'Status',
  stepByStep: 'Step-by-Step Procedure', criticalSteps: 'Critical Steps',
  hemostasis: 'Hemostasis', irrigation: 'Irrigation', drains: 'Drains', closure: 'Closure',
  findings: 'Findings', assessment: 'Assessment', plan: 'Plan', notes: 'Notes',
  recommendations: 'Recommendations', results: 'Results',
};
const SECTION_FIELDS = {
  'general-info': ['date', 'provider', 'facility', 'status'],
  'step-by-step': ['stepByStep'],
  'critical-steps': ['criticalSteps'],
  'hemostasis-irrigation': ['hemostasis', 'irrigation'],
  'drains': ['drains'],
  'closure': ['closure'],
  'clinical-notes': ['findings', 'assessment', 'plan', 'notes'],
  'recommendations': ['recommendations'],
  'results': ['results'],
};
const DATE_FIELDS = ['date'];
const ENUM_FIELDS = ['status'];
const ENUM_OPTIONS = { status: ['Completed', 'In Progress', 'Scheduled', 'Cancelled'] };
const enumCanonical = (options, val) => { const cur = String(val ?? '').trim(); const hit = (options || []).find(o => o.toLowerCase() === cur.toLowerCase()); return hit || cur; };
const LABELED_ARRAY_FIELDS = ['stepByStep'];
const CRITICAL_ARRAY_FIELDS = ['criticalSteps'];
const ARRAY_FIELDS = ['drains'];
const OBJECT_ARRAY_FIELDS = ['recommendations'];
const OBJECT_FIELDS = ['closure', 'results'];
const LONG_TEXT_FIELDS = ['findings', 'assessment', 'plan', 'notes'];

const getVal = (obj, path) => { if (!obj || !path) return undefined; return String(path).split('.').reduce((cur, part) => (cur === null || cur === undefined) ? undefined : cur[part], obj); };

const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (/\s/.test(String(key))) return String(key);
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};
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

/* safeString: \uXXXX escapes ONLY - never paste literal smart-quotes / em-dashes / invisible chars. */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  const str = typeof val === 'number' ? String(val) : typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val);
  return str
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201F]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
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
const bodyNodes = (text, keyPrefix) => {
  const rows = sentenceRows(text);
  if (rows.length === 0) return [<Text key={`${keyPrefix}-0`} style={styles.value}>1. {safeString(text)}</Text>];
  return rows.map((r, i) => r.type === 'subtitle'
    ? <Text key={`${keyPrefix}-${i}`} style={styles.subLabel}>{r.text}</Text>
    : <Text key={`${keyPrefix}-${i}`} style={styles.value}>{r.num}. {r.text}</Text>);
};

const renderObjectNode = (label, value, keyPath, depth) => {
  if (isEmptyDeep(value)) return null;
  const LabelTag = depth > 0 ? styles.subLabel : styles.fieldLabel;
  if (Array.isArray(value)) {
    const items = value.filter(x => !isEmptyDeep(x));
    if (items.length === 0) return null;
    return (
      <View key={keyPath}>
        {label ? <Text style={LabelTag}>{label}</Text> : null}
        {items.map((it, i) => <Text key={i} style={styles.value}>{i + 1}. {safeString(fmtScalar(it))}</Text>)}
      </View>
    );
  }
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

const renderField = (record, f, sectionTitle, isFirst) => {
  const val = getVal(record, f);
  if (!hasVal(val)) return [];
  const label = FIELD_LABELS[f] || f;
  const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
  const titleNode = isFirst ? <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text> : null;

  /* stepByStep - labeled array of "Heading: description". Each step is its own atomic wrap={false}
     View (glued heading+body) so a long list breaks BETWEEN steps; the sectionTitle rides inside step 0. */
  if (LABELED_ARRAY_FIELDS.includes(f)) {
    const items = (Array.isArray(val) ? val : []).filter(x => !isEmptyDeep(x));
    if (items.length === 0) return [];
    return items.map((item, ii) => {
      const p = parseLabel(String(item));
      const heading = p.isLabeled ? p.label : '';
      const bodyStr = p.isLabeled ? p.value : String(item);
      return (
        <View key={`${f}-${ii}`} style={styles.fieldGroup} wrap={false}>
          {ii === 0 ? titleNode : null}
          {ii === 0 && showLabel ? <Text style={styles.fieldLabel}>{label}</Text> : null}
          {heading ? <Text style={styles.subLabel}>{safeString(heading)}</Text> : null}
          {bodyNodes(safeString(bodyStr), `${f}-${ii}`)}
        </View>
      );
    });
  }

  /* criticalSteps - array of {step, technique, complications}. Each object is its own atomic
     wrap={false} View; the sectionTitle rides inside object 0. */
  if (CRITICAL_ARRAY_FIELDS.includes(f)) {
    const items = (Array.isArray(val) ? val : []).filter(o => o && typeof o === 'object' && !isEmptyDeep(o));
    if (items.length === 0) return [];
    return items.map((obj, oi) => {
      const step = (obj.step || '').trim();
      const tech = (obj.technique || '').trim();
      const comp = (obj.complications || '').trim();
      return (
        <View key={`${f}-${oi}`} style={styles.fieldGroup} wrap={false}>
          {oi === 0 ? titleNode : null}
          {oi === 0 && showLabel ? <Text style={styles.fieldLabel}>{label}</Text> : null}
          {step ? <Text style={styles.subLabel}>{safeString(step)}</Text> : null}
          {tech ? <Text style={styles.subLabel}>Technique</Text> : null}
          {tech ? bodyNodes(safeString(tech), `${f}-${oi}-t`) : null}
          {comp ? <Text style={styles.subLabel}>Complications</Text> : null}
          {comp ? bodyNodes(safeString(comp), `${f}-${oi}-c`) : null}
        </View>
      );
    });
  }

  /* recommendations - array of {recommendation, date}, date-grouped */
  if (OBJECT_ARRAY_FIELDS.includes(f)) {
    const recs = (Array.isArray(val) ? val : []).filter(r => (r?.recommendation || '').trim());
    if (recs.length === 0) return [];
    const groups = [];
    recs.forEach((r) => { const d = (r?.date || '').trim(); const last = groups[groups.length - 1]; if (last && last.date === d) last.items.push(r); else groups.push({ date: d, items: [r] }); });
    return [(
      <View key={f} style={styles.fieldGroup} wrap={false}>
        {titleNode}{showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {groups.map((group, gIdx) => (
          <View key={gIdx}>
            {group.date ? <Text style={styles.recDate}>{safeString(group.date)}</Text> : null}
            {group.items.map((r, i) => (<Text key={i} style={styles.value}>{i + 1}. {safeString((r?.recommendation || '').trim())}</Text>))}
          </View>
        ))}
      </View>
    )];
  }

  /* drains - simple array of strings */
  if (ARRAY_FIELDS.includes(f)) {
    const items = (Array.isArray(val) ? val : [val]).filter(x => !isEmptyDeep(x));
    if (items.length === 0) return [];
    return [(
      <View key={f} style={styles.fieldGroup} wrap={false}>
        {titleNode}{showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {items.map((it, i) => <Text key={i} style={styles.value}>{i + 1}. {safeString(it)}</Text>)}
      </View>
    )];
  }

  /* closure / results - recursive nested object (arrays-in-objects handled) */
  if (OBJECT_FIELDS.includes(f)) {
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return [];
    return [(
      <View key={f} style={styles.fieldGroup} wrap={false}>
        {titleNode}{showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {entries.map(([k, v]) => renderObjectNode(humanizeKey(k), v, `${f}-${k}`, 1))}
      </View>
    )];
  }

  let body;
  if (DATE_FIELDS.includes(f)) {
    body = <Text style={styles.value}>1. {safeString(formatDate(val))}</Text>;
  } else if (ENUM_FIELDS.includes(f)) {
    body = <Text style={styles.value}>1. {safeString(enumCanonical(ENUM_OPTIONS[f], fmtScalar(val)))}</Text>;
  } else if (LONG_TEXT_FIELDS.includes(f)) {
    const rows = sentenceRows(safeString(val));
    body = rows.length > 1
      ? rows.map((r, i) => r.type === 'subtitle'
        ? <Text key={i} style={styles.subLabel}>{r.text}</Text>
        : <Text key={i} style={styles.value}>{r.num}. {r.text}</Text>)
      : <Text style={styles.value}>1. {safeString(val)}</Text>;
  } else {
    body = <Text style={styles.value}>1. {safeString(val)}</Text>;
  }
  return [(
    <View key={f} style={styles.fieldGroup} wrap={false}>
      {titleNode}{showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      {body}
    </View>
  )];
};

const fieldHasVal = (record, f) => {
  const val = getVal(record, f);
  if (CRITICAL_ARRAY_FIELDS.includes(f) || OBJECT_ARRAY_FIELDS.includes(f) || LABELED_ARRAY_FIELDS.includes(f) || ARRAY_FIELDS.includes(f)) {
    return Array.isArray(val) && val.filter(x => !isEmptyDeep(x)).length > 0;
  }
  return hasVal(val);
};

const OperativeTechniqueDocumentPDFTemplate = ({ document: docProp, data }) => {
  const templateData = docProp || data;
  let records = [];
  if (Array.isArray(templateData)) {
    if (templateData.length > 0 && templateData[0].operative_technique && Array.isArray(templateData[0].operative_technique)) records = templateData[0].operative_technique;
    else records = templateData;
  } else if (templateData && templateData.operative_technique) {
    records = Array.isArray(templateData.operative_technique) ? templateData.operative_technique : [templateData.operative_technique];
  } else if (templateData && templateData.documentData) {
    const dd = templateData.documentData;
    records = Array.isArray(dd) ? dd : (dd.operative_technique ? (Array.isArray(dd.operative_technique) ? dd.operative_technique : [dd.operative_technique]) : [dd]);
  } else if (templateData) {
    records = [templateData];
  }
  records = records.filter(r => r && typeof r === 'object');

  if (!records || records.length === 0) {
    return (
      <Document><Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Operative Technique</Text></View>
        <Text style={styles.emptyState}>No operative technique records available.</Text>
      </Page></Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Operative Technique</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <Text style={styles.recordTitle}>{`Operative Technique ${idx + 1}`}</Text>
            {SECTION_ORDER.map((sid) => {
              const vis = (SECTION_FIELDS[sid] || []).filter(f => fieldHasVal(record, f));
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

export default OperativeTechniqueDocumentPDFTemplate;
