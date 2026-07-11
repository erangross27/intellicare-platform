/**
 * GuidelineComplianceDocumentPDFTemplate.jsx
 * Box-free B&W LETTER (canonical, memory 6a2d6af6) — mirrors the JSX: real record.date (never createdAt),
 * guidelines array-of-objects rendered one card per guideline in array order (NO sort, matching the JSX),
 * each card: guidelineName header, Compliance, Priority, Clinical Rationale ([.;] sentence-split, numbered),
 * Gaps / Recommendations string-arrays numbered, Quantitative Monitoring + Patient-Reported Outcomes nested
 * objects (label-on-own-line + numbered value — NEVER side-by-side "Label: value"). All string fields
 * [.;] sentence-split with abbrev/single-initial guard; values numbered ('1.' even singles); single-name
 * label gate. Rule #74: each field is ONE wrap={false} atomic View, sectionTitle rides the first field;
 * big guideline cards keep name+compliance+priority together and let the tail flow. Static PHI footer.
 * Collection: guideline_compliance.
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
  guidelineName: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 4 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 4, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  subLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 2 },
  value: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nested: { marginLeft: 10, paddingLeft: 8, borderLeftWidth: 0.5, borderLeftColor: '#999999', marginTop: 2 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, borderTopWidth: 0.5, borderTopColor: '#999999', paddingTop: 8 },
  footerText: { fontSize: 10, color: '#666666' },
});

const SECTION_ORDER = ['session-info', 'guidelines', 'clinical-notes', 'additional'];
const SECTION_TITLES = {
  'session-info': 'Session Information',
  'guidelines': 'Guidelines',
  'clinical-notes': 'Clinical Notes',
  'additional': 'Additional Notes',
};
const FIELD_LABELS = {
  date: 'Date', type: 'Type', provider: 'Provider', facility: 'Facility', status: 'Status',
  guidelines: 'Guidelines',
  findings: 'Findings', assessment: 'Assessment', plan: 'Plan',
  notes: 'Notes',
};
const SECTION_FIELDS = {
  'session-info': ['date', 'type', 'provider', 'facility', 'status'],
  'guidelines': ['guidelines'],
  'clinical-notes': ['findings', 'assessment', 'plan'],
  'additional': ['notes'],
};
const DATE_FIELDS = ['date'];
const GUIDELINE_SUB_ORDER = ['compliance', 'priority', 'clinicalRationale', 'gaps', 'recommendations', 'quantitativeMonitoring', 'patientReportedOutcomes'];
const GUIDELINE_SUB_LABELS = {
  compliance: 'Compliance', priority: 'Priority', clinicalRationale: 'Clinical Rationale',
  gaps: 'Gaps', recommendations: 'Recommendations',
  quantitativeMonitoring: 'Quantitative Monitoring', patientReportedOutcomes: 'Patient-Reported Outcomes',
};
const SENTENCE_SUB_FIELDS = ['clinicalRationale'];

const getVal = (obj, path) => { if (!obj || !path) return undefined; return String(path).split('.').reduce((cur, part) => (cur === null || cur === undefined) ? undefined : cur[part], obj); };

const KEY_OVERRIDES = { hba1c: 'HbA1c', bp: 'BP', tug: 'TUG' };
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (KEY_OVERRIDES[String(key).toLowerCase()]) return KEY_OVERRIDES[String(key).toLowerCase()];
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
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'number' ? String(val) : typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val);
  str = str.replace(/[µμ]m/g, 'um').replace(/[µμ]g/g, 'mcg').replace(/[µμ]/g, 'u').replace(/°/g, ' deg').replace(/±/g, '+/-')
    .replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/→/g, '->').replace(/[×✕✖]/g, 'x').replace(/÷/g, '/')
    .replace(/²/g, '2').replace(/³/g, '3')
    .replace(/“/g, '"').replace(/”/g, '"').replace(/‘/g, "'").replace(/’/g, "'").replace(/—/g, '-').replace(/–/g, '-');
  return str;
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
const renderSentenceBody = (val) => {
  const rows = sentenceRows(safeString(val));
  return rows.length > 1
    ? rows.map((r, i) => r.type === 'subtitle'
      ? <Text key={i} style={styles.subLabel}>{r.text}</Text>
      : <Text key={i} style={styles.value}>{r.num}. {r.text}</Text>)
    : <Text style={styles.value}>1. {safeString(val)}</Text>;
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

// ── Guidelines: array-of-objects, one card per guideline in array order (mirrors JSX, no sort) ──
const renderGuidelineCard = (g, gi, titleNode) => {
  const gName = g.guidelineName || `Guideline ${gi + 1}`;
  const headRows = GUIDELINE_SUB_ORDER
    .filter(k => !SENTENCE_SUB_FIELDS.includes(k) && isScalar(g[k]) && hasVal(g[k]))
    .filter(k => k === 'compliance' || k === 'priority');
  const tail = GUIDELINE_SUB_ORDER
    .filter(k => !(k === 'compliance' || k === 'priority'))
    .filter(k => hasVal(g[k]));

  return (
    <View key={gi} style={styles.fieldGroup}>
      <View wrap={false}>
        {titleNode}
        <Text style={styles.guidelineName}>{safeString(gName)}</Text>
        {headRows.map(k => (
          <React.Fragment key={k}>
            <Text style={styles.subLabel}>{GUIDELINE_SUB_LABELS[k]}</Text>
            <Text style={styles.value}>1. {safeString(g[k])}</Text>
          </React.Fragment>
        ))}
      </View>
      {tail.map(k => {
        if (SENTENCE_SUB_FIELDS.includes(k)) {
          return (
            <View key={k}>
              <Text style={styles.subLabel}>{GUIDELINE_SUB_LABELS[k]}</Text>
              {renderSentenceBody(g[k])}
            </View>
          );
        }
        return <View key={k}>{renderObjectNode(GUIDELINE_SUB_LABELS[k], g[k], `g${gi}-${k}`, 0)}</View>;
      })}
    </View>
  );
};

const renderField = (record, f, sectionTitle, isFirst) => {
  const val = getVal(record, f);
  if (!hasVal(val)) return [];
  const titleNode = isFirst ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null;

  if (f === 'guidelines') {
    const guidelines = (Array.isArray(val) ? val : []).filter(g => g && typeof g === 'object' && hasVal(g));
    if (guidelines.length === 0) return [];
    return guidelines.map((g, gi) => renderGuidelineCard(g, gi, gi === 0 ? titleNode : null));
  }

  const label = FIELD_LABELS[f] || f;
  const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
  const body = DATE_FIELDS.includes(f)
    ? <Text style={styles.value}>1. {formatDate(val)}</Text>
    : renderSentenceBody(val);
  return [(
    <View key={f} style={styles.fieldGroup} wrap={false}>
      {titleNode}{showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      {body}
    </View>
  )];
};

const GuidelineComplianceDocumentPDFTemplate = ({ document: docProp, data }) => {
  const templateData = docProp || data;
  let records = [];
  if (Array.isArray(templateData)) {
    if (templateData.length > 0 && templateData[0].guideline_compliance && Array.isArray(templateData[0].guideline_compliance)) records = templateData[0].guideline_compliance;
    else if (templateData.length > 0 && templateData[0].records && Array.isArray(templateData[0].records)) records = templateData[0].records;
    else records = templateData;
  } else if (templateData && templateData.guideline_compliance) {
    records = Array.isArray(templateData.guideline_compliance) ? templateData.guideline_compliance : [templateData.guideline_compliance];
  } else if (templateData && templateData.documentData) {
    const dd = templateData.documentData;
    records = Array.isArray(dd) ? dd : (dd.guideline_compliance ? (Array.isArray(dd.guideline_compliance) ? dd.guideline_compliance : [dd.guideline_compliance]) : [dd]);
  } else if (templateData) {
    records = [templateData];
  }
  records = records
    .filter(r => r && typeof r === 'object')
    .map(record => { const clean = {}; for (const key of Object.keys(record)) { if (!key.startsWith('_')) clean[key] = record[key]; } return clean; });

  if (!records || records.length === 0) {
    return (
      <Document><Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Guideline Compliance</Text></View>
        <Text style={styles.emptyState}>No guideline compliance records available.</Text>
      </Page></Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Guideline Compliance</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <Text style={styles.recordTitle}>{`Guideline Compliance ${idx + 1}`}</Text>
            {SECTION_ORDER.map((sid) => {
              const vis = (SECTION_FIELDS[sid] || []).filter(f => hasVal(getVal(record, f)));
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

export default GuidelineComplianceDocumentPDFTemplate;
