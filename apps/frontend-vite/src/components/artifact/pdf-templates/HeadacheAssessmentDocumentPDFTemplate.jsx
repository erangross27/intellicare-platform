/**
 * HeadacheAssessmentDocumentPDFTemplate.jsx
 * Box-free B&W LETTER (canonical, memory 6a2d6af6) — mirrors HeadacheAssessmentDocument.jsx:
 * real record.date (never createdAt), 10 sections in SECTION_ORDER, booleans (Yes/No) numbered,
 * triggers string-array numbered, abortive/preventive therapy items (medication title + numbered
 * sub-fields), headache diary recursive, results recursive object, recommendations date-grouped,
 * all string fields ([.;] sentence-split with abbrev/single-initial guard + labeled comma-split,
 * thousands guard), values numbered ('1.' even singles), single-name label gate. Rule #74: each
 * field is ONE wrap={false} atomic View with the sectionTitle riding INSIDE the first present
 * field's View. Static PHI footer. Collection: headache_assessment.
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
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, borderTopWidth: 0.5, borderTopColor: '#999999', paddingTop: 8 },
  footerText: { fontSize: 10, color: '#666666' },
});

const SECTION_ORDER = ['session-info', 'headache-profile', 'triggers', 'associated-symptoms', 'therapies', 'diary', 'scoring', 'clinical-findings', 'results-recs', 'clinical-notes'];
const SECTION_TITLES = {
  'session-info': 'Session Information',
  'headache-profile': 'Headache Profile',
  'triggers': 'Triggers',
  'associated-symptoms': 'Associated Symptoms',
  'therapies': 'Therapies',
  'diary': 'Headache Diary',
  'scoring': 'Scoring',
  'clinical-findings': 'Clinical Findings',
  'results-recs': 'Results & Recommendations',
  'clinical-notes': 'Clinical Notes',
};
const FIELD_LABELS = {
  date: 'Date', provider: 'Provider', facility: 'Facility', status: 'Status',
  headacheType: 'Headache Type', frequency: 'Frequency', severity: 'Severity', duration: 'Duration', location: 'Location', quality: 'Quality',
  triggers: 'Triggers',
  'associatedSymptoms.nausea': 'Nausea', 'associatedSymptoms.photophobia': 'Photophobia', 'associatedSymptoms.phonophobia': 'Phonophobia', 'associatedSymptoms.aura': 'Aura',
  abortiveTherapy: 'Abortive Therapy', preventiveTherapy: 'Preventive Therapy',
  headacheDiary: 'Headache Diary', midasScore: 'MIDAS Score',
  findings: 'Findings', assessment: 'Assessment', plan: 'Plan',
  results: 'Results', recommendations: 'Recommendations', notes: 'Notes',
};
const SECTION_FIELDS = {
  'session-info': ['date', 'provider', 'facility', 'status'],
  'headache-profile': ['headacheType', 'frequency', 'severity', 'duration', 'location', 'quality'],
  'triggers': ['triggers'],
  'associated-symptoms': ['associatedSymptoms.nausea', 'associatedSymptoms.photophobia', 'associatedSymptoms.phonophobia', 'associatedSymptoms.aura'],
  'therapies': ['abortiveTherapy', 'preventiveTherapy'],
  'diary': ['headacheDiary'],
  'scoring': ['midasScore'],
  'clinical-findings': ['findings', 'assessment', 'plan'],
  'results-recs': ['results', 'recommendations'],
  'clinical-notes': ['notes'],
};
const DATE_FIELDS = ['date'];
const BOOLEAN_FIELDS = ['associatedSymptoms.nausea', 'associatedSymptoms.photophobia', 'associatedSymptoms.phonophobia'];
const ARRAY_OF_STRING_FIELDS = ['triggers'];
const THERAPY_FIELDS = ['abortiveTherapy', 'preventiveTherapy'];
const OBJECT_FIELDS = ['results'];
const OBJECT_ARRAY_FIELDS = ['recommendations'];
const THERAPY_SUBFIELDS = {
  abortiveTherapy: [{ key: 'usage', label: 'Usage' }, { key: 'effectiveness', label: 'Effectiveness' }],
  preventiveTherapy: [{ key: 'startDate', label: 'Start Date' }, { key: 'effectiveness', label: 'Effectiveness' }],
};

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
  if (m && !CLAUSE_OPENER.test(m[1].trim())) return { isLabeled: true, label: m[1].trim(), value: m[2].trim().replace(/^\d+\.\s+/, '') };
  return { isLabeled: false, label: '', value: text };
};
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|[A-Z]|\d))[.;](?:\s+)/).map(s => s.trim().replace(/^\d+\.\s+/, '')).filter(s => s && !/^[;.,!?]+$/.test(s)); };
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

const renderField = (record, f, sectionTitle, isFirst) => {
  const val = getVal(record, f);
  if (!hasVal(val)) return [];
  const label = FIELD_LABELS[f] || f;
  const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
  const titleNode = isFirst ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null;

  /* Recommendations — array of {recommendation, date}, date-grouped */
  if (OBJECT_ARRAY_FIELDS.includes(f)) {
    const recs = (Array.isArray(val) ? val : []).filter(r => (r?.recommendation || '').trim());
    if (recs.length === 0) return [];
    const groups = [];
    recs.forEach((r) => { const d = (r?.date || '').trim(); const last = groups[groups.length - 1]; if (last && last.date === d) last.items.push(r); else groups.push({ date: d, items: [r] }); });
    return [(
      <View key={f} style={styles.fieldGroup} wrap={false}>
        {titleNode}{showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {groups.map((g, gi) => (
          <View key={gi}>
            {g.date ? <Text style={styles.subLabel}>{safeString(g.date)}</Text> : null}
            {g.items.map((r, i) => <Text key={i} style={styles.value}>{i + 1}. {safeString((r?.recommendation || '').trim())}</Text>)}
          </View>
        ))}
      </View>
    )];
  }

  /* Results — recursive object */
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

  /* Abortive / Preventive Therapy — array of medication objects */
  if (THERAPY_FIELDS.includes(f)) {
    const arr = (Array.isArray(val) ? val : []).filter(x => !isEmptyDeep(x));
    if (arr.length === 0) return [];
    const subFields = THERAPY_SUBFIELDS[f];
    return [(
      <View key={f} style={styles.fieldGroup} wrap={false}>
        {titleNode}{showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {arr.map((med, i) => (
          <View key={i}>
            <Text style={styles.subLabel}>{safeString(med.medication) || `Medication ${i + 1}`}</Text>
            {subFields.map(sf => {
              const sv = med[sf.key];
              if (isEmptyDeep(sv)) return null;
              return (
                <View key={sf.key}>
                  <Text style={styles.subLabel}>{sf.label}</Text>
                  {renderSentenceBody(sv)}
                </View>
              );
            })}
          </View>
        ))}
      </View>
    )];
  }

  /* Headache Diary — array of objects (recursive) */
  if (f === 'headacheDiary') {
    const arr = (Array.isArray(val) ? val : []).filter(x => !isEmptyDeep(x));
    if (arr.length === 0) return [];
    return [(
      <View key={f} style={styles.fieldGroup} wrap={false}>
        {titleNode}{showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {arr.map((item, i) => {
          if (isScalar(item)) return <Text key={i} style={styles.value}>{i + 1}. {safeString(fmtScalar(item))}</Text>;
          const entries = Object.entries(item).filter(([, v]) => !isEmptyDeep(v));
          if (entries.length === 0) return null;
          return (
            <View key={i}>
              <Text style={styles.subLabel}>{`Entry ${i + 1}`}</Text>
              {entries.map(([k, v]) => renderObjectNode(humanizeKey(k), v, `${f}-${i}-${k}`, 1))}
            </View>
          );
        })}
      </View>
    )];
  }

  /* Triggers — array of strings */
  if (ARRAY_OF_STRING_FIELDS.includes(f)) {
    const items = (Array.isArray(val) ? val : [val]).filter(x => !isEmptyDeep(x));
    if (items.length === 0) return [];
    return [(
      <View key={f} style={styles.fieldGroup} wrap={false}>
        {titleNode}{showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {items.map((it, i) => <Text key={i} style={styles.value}>{i + 1}. {safeString(fmtScalar(it))}</Text>)}
      </View>
    )];
  }

  let body;
  if (BOOLEAN_FIELDS.includes(f)) {
    body = <Text style={styles.value}>1. {val ? 'Yes' : 'No'}</Text>;
  } else if (DATE_FIELDS.includes(f)) {
    body = <Text style={styles.value}>1. {formatDate(val)}</Text>;
  } else {
    body = renderSentenceBody(val);
  }
  return [(
    <View key={f} style={styles.fieldGroup} wrap={false}>
      {titleNode}{showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      {body}
    </View>
  )];
};

const HeadacheAssessmentDocumentPDFTemplate = ({ document: docProp, data }) => {
  const templateData = docProp || data;
  let records = [];
  if (Array.isArray(templateData)) {
    if (templateData.length > 0 && templateData[0].headache_assessment && Array.isArray(templateData[0].headache_assessment)) records = templateData[0].headache_assessment;
    else if (templateData.length > 0 && templateData[0].records && Array.isArray(templateData[0].records)) records = templateData[0].records;
    else records = templateData;
  } else if (templateData && templateData.headache_assessment) {
    records = Array.isArray(templateData.headache_assessment) ? templateData.headache_assessment : [templateData.headache_assessment];
  } else if (templateData && templateData.documentData) {
    const dd = templateData.documentData;
    records = Array.isArray(dd) ? dd : (dd.headache_assessment ? (Array.isArray(dd.headache_assessment) ? dd.headache_assessment : [dd.headache_assessment]) : [dd]);
  } else if (templateData) {
    records = [templateData];
  }
  records = records
    .filter(r => r && typeof r === 'object')
    .map(record => { const clean = {}; for (const key of Object.keys(record)) { if (!key.startsWith('_')) clean[key] = record[key]; } return clean; });

  if (!records || records.length === 0) {
    return (
      <Document><Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Headache Assessment</Text></View>
        <Text style={styles.emptyState}>No headache assessment records available.</Text>
      </Page></Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Headache Assessment</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <Text style={styles.recordTitle}>{`Headache Assessment ${idx + 1}`}</Text>
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

export default HeadacheAssessmentDocumentPDFTemplate;
