/**
 * ProteinuriaAssessmentDocumentPDFTemplate.jsx
 * Box-free canonical PDF — Helvetica — LETTER — proteinuria assessment
 * Collection: proteinuria_assessment
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, color: '#000000', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 8, marginBottom: 20, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 20 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 6, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 4, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', paddingBottom: 2, marginTop: 8, marginBottom: 4, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  subLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  value: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2 },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2 },
  noDataText: { fontSize: 14, color: '#000000', textAlign: 'center', marginTop: 40 },
});

/* ======= UTILS ======= */
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr.$date || dateStr);
    if (isNaN(date.getTime())) return String(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(dateStr); }
};

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let s;
  if (typeof val === 'string') s = val;
  else if (typeof val === 'number') s = String(val);
  else if (typeof val === 'boolean') s = val ? 'Yes' : 'No';
  else if (typeof val === 'object' && val.$date) s = formatDate(val.$date);
  else s = String(val);
  return s.replace(/×/g, 'x').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...');
};

const hasVal = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number') return true;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
};

const fmtVal = (v) => {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  return String(v || '');
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

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

/* ======= OBJECT (recursive) HELPERS ======= */
const KEY_OVERRIDES = { uacr: 'UACR', upcr: 'UPCR', rbc: 'RBC', wbc: 'WBC', ph: 'pH' };
const humanizeKey = (key) => { if (key === null || key === undefined || key === '') return ''; if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key]; const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); return s.charAt(0).toUpperCase() + s.slice(1); };
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
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };

/* ======= CONFIG ======= */
const SECTION_TITLES = {
  'general-info': 'General Information',
  'measurements': 'Proteinuria Measurements',
  'protein-trend': 'Protein Trend',
  'urinalysis': 'Urinalysis Findings',
  'electrophoresis': 'Urine Electrophoresis',
  'results-section': 'Results',
  'findings-assessment': 'Findings and Assessment',
  'plan-notes': 'Plan and Notes',
  'recommendations-section': 'Recommendations',
};
const SECTION_ORDER = ['general-info', 'measurements', 'protein-trend', 'urinalysis', 'electrophoresis', 'results-section', 'findings-assessment', 'plan-notes', 'recommendations-section'];
const SECTION_FIELDS = {
  'general-info': ['date', 'provider', 'facility', 'status'],
  'measurements': ['uacr', 'uacrCategory', 'upcr', 'twentyFourHourProtein'],
  'protein-trend': ['proteinTrend'],
  'urinalysis': ['hematuria', 'hematuriaType', 'rbcCasts'],
  'electrophoresis': ['urineElectrophoresis'],
  'results-section': ['results'],
  'findings-assessment': ['findings', 'assessment'],
  'plan-notes': ['plan', 'notes'],
  'recommendations-section': ['recommendations'],
};
const FIELD_LABELS = {
  date: 'Date', provider: 'Provider', facility: 'Facility', status: 'Status',
  uacr: 'UACR', uacrCategory: 'UACR Category', upcr: 'UPCR', twentyFourHourProtein: '24-Hour Protein',
  hematuria: 'Hematuria', hematuriaType: 'Hematuria Type', rbcCasts: 'RBC Casts',
  findings: 'Findings', assessment: 'Assessment', plan: 'Plan', notes: 'Notes',
  results: 'Results', recommendations: 'Recommendations',
};
const DATE_FIELDS = ['date'];
const BOOLEAN_FIELDS = ['hematuria', 'rbcCasts'];
const OBJECT_FIELDS = ['results'];
const OBJECT_ARRAY_FIELDS = ['recommendations'];

/* ======= FLAT ELEMENT BUILDERS (each returns an array of small <Text> elements) ======= */
const labelEl = (f, key) => <Text key={key} style={styles.fieldLabel}>{FIELD_LABELS[f] || f}</Text>;

/* string field → bare label + sentence/comma value lines (mirrors JSX renderStringField display) */
const stringFieldEls = (f, val) => {
  const strVal = fmtVal(val);
  const sentences = splitBySentence(strVal);
  const els = [labelEl(f, `${f}-l`)];
  if (sentences.length <= 1) {
    els.push(<Text key={`${f}-v`} style={styles.value}>{safeString(strVal)}</Text>);
    return els;
  }
  let n = 1;
  sentences.forEach((s, si) => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const parts = splitByComma(parsed.value);
      els.push(<Text key={`${f}-sl${si}`} style={styles.subLabel}>{safeString(parsed.label)}</Text>);
      if (parts.length >= 2) parts.forEach((p, pi) => els.push(<Text key={`${f}-s${si}c${pi}`} style={styles.listItem}>{`${n++}. ${safeString(p)}`}</Text>));
      else els.push(<Text key={`${f}-s${si}v`} style={styles.listItem}>{`${n++}. ${safeString(parsed.value)}`}</Text>);
    } else {
      els.push(<Text key={`${f}-s${si}`} style={styles.listItem}>{`${n++}. ${safeString(s)}`}</Text>);
    }
  });
  return els;
};

/* proteinTrend (array of {date,value,unit,type}) → one line per entry; NO field label (sameAsTitle) */
const proteinTrendEls = (val) => {
  const items = Array.isArray(val) ? val.filter(x => x && typeof x === 'object') : [];
  if (items.length === 0) return [];
  return items.map((item, i) => (
    <Text key={`pt${i}`} style={styles.listItem}>
      {`${formatDate(item.date)}: ${safeString(item.value)}${item.unit ? ` ${safeString(item.unit)}` : ''}${item.type ? ` (${safeString(item.type)})` : ''}`}
    </Text>
  ));
};

/* urineElectrophoresis (object) → key sub-label + value per entry */
const electrophoresisEls = (val) => {
  if (!val || typeof val !== 'object' || Object.keys(val).length === 0) return [];
  const els = [];
  Object.entries(val).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v], i) => {
    els.push(<Text key={`e${i}k`} style={styles.subLabel}>{humanizeKey(k)}</Text>);
    els.push(<Text key={`e${i}v`} style={styles.value}>{safeString(fmtScalar(v))}</Text>);
  });
  return els;
};

/* recursive object node → flat elements (results); label dropped at top level (sameAsTitle) */
const objectNodeEls = (label, value, keyPath, depth) => {
  if (isEmptyDeep(value)) return [];
  if (isScalar(value)) {
    const els = [];
    if (label) els.push(<Text key={`${keyPath}-l`} style={depth > 0 ? styles.subLabel : styles.fieldLabel}>{label}</Text>);
    els.push(<Text key={`${keyPath}-v`} style={styles.value}>{safeString(fmtScalar(value))}</Text>);
    return els;
  }
  const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return [];
  const els = [];
  if (label) els.push(<Text key={`${keyPath}-l`} style={depth > 0 ? styles.subLabel : styles.fieldLabel}>{label}</Text>);
  entries.forEach(([k, v]) => els.push(...objectNodeEls(humanizeKey(k), v, `${keyPath}-${k}`, depth + 1)));
  return els;
};
const objectFieldEls = (f, val) => {
  if (isEmptyDeep(val) || isScalar(val)) return [];
  const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return [];
  const els = [];
  entries.forEach(([k, v]) => els.push(...objectNodeEls(humanizeKey(k), v, `${f}-${k}`, 1)));
  return els;
};

/* recommendations (array of {recommendation, date}) → date-grouped numbered; label dropped (sameAsTitle) */
const recommendationsEls = (val) => {
  const recs = Array.isArray(val) ? val.filter(r => hasVal(r)) : [];
  if (recs.length === 0) return [];
  const groups = [];
  recs.forEach((r) => { const d = (r?.date || '').trim(); const last = groups[groups.length - 1]; if (last && last.date === d) last.items.push(r); else groups.push({ date: d, items: [r] }); });
  const els = [];
  groups.forEach((g, gi) => {
    if (g.date) els.push(<Text key={`rd${gi}`} style={styles.subLabel}>{safeString(g.date)}</Text>);
    g.items.forEach((r, i) => els.push(<Text key={`r${gi}-${i}`} style={styles.listItem}>{`${i + 1}. ${safeString((r?.recommendation || '').trim())}`}</Text>));
  });
  return els;
};

/* dispatch one field → flat element array */
const fieldEls = (record, f) => {
  const val = record[f];
  if (f === 'proteinTrend') return proteinTrendEls(val);
  if (f === 'urineElectrophoresis') return electrophoresisEls(val);
  if (OBJECT_ARRAY_FIELDS.includes(f)) return recommendationsEls(val);
  if (OBJECT_FIELDS.includes(f)) return objectFieldEls(f, val);
  if (!hasVal(val)) return [];
  if (DATE_FIELDS.includes(f)) return [labelEl(f, `${f}-l`), <Text key={`${f}-v`} style={styles.value}>{formatDate(val)}</Text>];
  if (BOOLEAN_FIELDS.includes(f)) return [labelEl(f, `${f}-l`), <Text key={`${f}-v`} style={styles.value}>{val ? 'Yes' : 'No'}</Text>];
  return stringFieldEls(f, val);
};

/* ======= COMPONENT ======= */
const ProteinuriaAssessmentDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.proteinuria_assessment) return Array.isArray(r.proteinuria_assessment) ? r.proteinuria_assessment : [r.proteinuria_assessment];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.proteinuria_assessment) return Array.isArray(dd.proteinuria_assessment) ? dd.proteinuria_assessment : [dd.proteinuria_assessment]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Proteinuria Assessment</Text>
          <Text style={styles.noDataText}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Proteinuria Assessment</Text>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer} break={index > 0}>
            <View wrap={false}>
              <Text style={styles.recordTitle}>{safeString(record.provider) || `Proteinuria Assessment ${index + 1}`}</Text>
            </View>

            {SECTION_ORDER.map((sid) => {
              const fields = SECTION_FIELDS[sid] || [];
              const flat = [];
              fields.forEach(f => flat.push(...fieldEls(record, f)));
              if (flat.length === 0) return null;
              const first = React.cloneElement(flat[0], { key: 'f0' });
              const rest = flat.slice(1).map((el, i) => React.cloneElement(el, { key: `f${i + 1}` }));
              return (
                <View key={sid} style={styles.section}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>{SECTION_TITLES[sid]}</Text>
                    {first}
                  </View>
                  {rest}
                </View>
              );
            })}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default ProteinuriaAssessmentDocumentPDFTemplate;
