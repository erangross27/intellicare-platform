/**
 * ColorectalSurgeryAssessmentDocumentPDFTemplate.jsx
 * Box-free line-based layout (ConsultationNotes donor) — LETTER size — B&W.
 * react-pdf 4.5.1 engine rules: wrap props are BOOLEANS (explicit undefined = unbreakable);
 * recordContainer paddingBottom only (marginBottom → empty page 1) + break={idx>0} (Rule #75, each
 * record starts a new page); sectionTitle rides INSIDE the first present field's View (anti-orphan, 6a2d6af6).
 * Sections/fields mirror the JSX + copy exactly (4-area mirror). Sentence fields (findings/assessment/plan)
 * render labeled groups: a "Label: value" sentence → sub-label + comma-split value rows (>=3), numbering
 * restarts at each labeled group. Object sections (anorectal/defecography/results) walk key→value.
 * Collection: colorectal_surgery_assessment
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000' },
  title: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1 },
  recordContainer: { paddingBottom: 8 },
  recordHeader: { marginBottom: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  recordMeta: { fontSize: 12, color: '#000000', marginTop: 4 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', textTransform: 'uppercase', letterSpacing: 0.5, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 3, marginBottom: 8 },
  fieldUnit: { marginBottom: 6 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#000000', borderBottomWidth: 0.5, borderBottomColor: '#999999', paddingBottom: 3, marginBottom: 4 },
  subLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', borderBottomWidth: 0.5, borderBottomColor: '#999999', paddingBottom: 2, marginBottom: 3, marginTop: 4 },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 3, paddingLeft: 8 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
});

const SECTION_TITLES = {
  providerInfo: 'Provider Information', findingsAssessment: 'Findings & Assessment', colonoscopy: 'Colonoscopy',
  anorectalManometry: 'Anorectal Manometry', defecography: 'Defecography', results: 'Results',
  stomaAssessment: 'Stoma Assessment', oncologicMarkers: 'Oncologic Markers',
};
const SECTION_ORDER = ['providerInfo', 'findingsAssessment', 'colonoscopy', 'anorectalManometry', 'defecography', 'results', 'stomaAssessment', 'oncologicMarkers'];
const SECTION_FIELDS = {
  providerInfo: ['date', 'provider', 'facility', 'type', 'status'],
  findingsAssessment: ['findings', 'assessment', 'plan', 'notes'],
  colonoscopy: ['colonoscopy.preparation', 'colonoscopy.completeness', 'colonoscopy.polyps', 'colonoscopy.lesions'],
  anorectalManometry: ['anorectalManometry'],
  defecography: ['defecography'],
  results: ['results'],
  stomaAssessment: ['stomaAssessment.type', 'stomaAssessment.site', 'stomaAssessment.viability', 'stomaAssessment.complications'],
  oncologicMarkers: ['oncologicMarkers.cea', 'oncologicMarkers.ca199', 'oncologicMarkers.microsatelliteStatus', 'oncologicMarkers.kras'],
};
const FIELD_LABELS = {
  date: 'Date', provider: 'Provider', facility: 'Facility', type: 'Type', status: 'Status',
  findings: 'Findings', assessment: 'Assessment', plan: 'Plan', notes: 'Notes',
  'colonoscopy.preparation': 'Preparation', 'colonoscopy.completeness': 'Completeness',
  'colonoscopy.polyps': 'Polyps', 'colonoscopy.lesions': 'Lesions',
  anorectalManometry: 'Anorectal Manometry', defecography: 'Defecography', results: 'Results',
  'stomaAssessment.type': 'Stoma Type', 'stomaAssessment.site': 'Site',
  'stomaAssessment.viability': 'Viability', 'stomaAssessment.complications': 'Complications',
  'oncologicMarkers.cea': 'CEA', 'oncologicMarkers.ca199': 'CA 19-9',
  'oncologicMarkers.microsatelliteStatus': 'Microsatellite Status', 'oncologicMarkers.kras': 'KRAS',
};
const KEY_OVERRIDES = {
  restingPressure: 'Resting Pressure', squeezePressure: 'Squeeze Pressure', sensoryThreshold: 'Sensory Threshold',
  compliance: 'Compliance', pelvicFloorDescent: 'Pelvic Floor Descent', rectocele: 'Rectocele',
  intussusception: 'Intussusception', evacuation: 'Evacuation',
};
const SENTENCE_FIELDS = ['findings', 'assessment', 'plan'];
const DATE_FIELDS = ['date'];
const OBJECT_FIELDS = ['anorectalManometry', 'defecography', 'results'];
const ARRAY_FIELDS = ['colonoscopy.polyps', 'colonoscopy.lesions', 'stomaAssessment.complications'];

const humanizeKey = (key) => { if (key === null || key === undefined || key === '') return ''; if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key]; const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); return s.charAt(0).toUpperCase() + s.slice(1); };
const isEmptyDeep = (v) => { if (v === null || v === undefined) return true; if (typeof v === 'boolean') return false; if (typeof v === 'number') return !Number.isFinite(v); if (typeof v === 'string') return v.trim() === ''; if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0; if (typeof v === 'object') return Object.values(v).every(isEmptyDeep); return false; };
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const getDotPath = (record, dotPath) => { let val = record; for (const p of dotPath.split('.')) { val = val?.[p]; if (val === undefined || val === null) return val; } return val; };
// Abbreviation+decimal guard: never break on "Dr. Smith", "vs. standard", "3.5 mg".
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [];
  const parts = []; let cur = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      const rest = text.slice(i + 1);
      if (!/^\s/.test(rest)) { cur += ch; continue; }
      if (/^\s+(?:and|or)\b/i.test(rest)) { cur += ch; continue; }
      if (/\d\s*$/.test(cur) && /^\s*\d{4}\b/.test(rest)) { cur += ch; continue; }
      parts.push(cur.trim()); cur = '';
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
};
const parseLabel = (sentence) => {
  if (!sentence || typeof sentence !== 'string') return null;
  const ci = sentence.indexOf(':');
  if (ci < 1 || ci > 60) return null;
  if (/\d/.test(sentence[ci - 1] || '') && /\d/.test(sentence[ci + 1] || '')) return null;
  const label = sentence.slice(0, ci).trim();
  const value = sentence.slice(ci + 1).trim();
  if (!label || !value || label.includes('.')) return null;
  return { label, value };
};
const buildSentenceGroups = (text) => splitBySentence(text).map(s => {
  const strip = (p) => p.replace(/[.;]+$/, '').trim();
  const parsed = parseLabel(s);
  if (parsed) { const c = splitByComma(parsed.value); return { label: parsed.label, parts: (c.length >= 3 ? c : [parsed.value]).map(strip) }; }
  const c = splitByComma(s); return { label: null, parts: (c.length >= 3 ? c : [s]).map(strip) };
});

// Build a field's display lines ({k:'label'|'sub'|'row', t}) or null when empty. Mirrors the JSX/copy exactly.
const buildFieldLines = (record, sid, f, title) => {
  const val = f.includes('.') ? getDotPath(record, f) : record[f];
  const label = FIELD_LABELS[f] || humanizeKey(f);
  const showLabel = label.toLowerCase() !== title.toLowerCase();
  const lines = [];
  if (DATE_FIELDS.includes(f)) {
    if (!hasVal(val)) return null;
    if (showLabel) lines.push({ k: 'label', t: label });
    lines.push({ k: 'row', t: `1. ${formatDate(val)}` });
  } else if (SENTENCE_FIELDS.includes(f)) {
    if (!hasVal(val)) return null;
    if (showLabel) lines.push({ k: 'label', t: label });
    let n = 0;
    buildSentenceGroups(fmtVal(val)).forEach(g => {
      if (g.label) { lines.push({ k: 'sub', t: g.label }); n = 0; }
      g.parts.forEach(p => lines.push({ k: 'row', t: `${++n}. ${p}` }));
    });
  } else if (ARRAY_FIELDS.includes(f)) {
    const arr = Array.isArray(val) ? val : [];
    if (arr.length === 0) return null;
    if (showLabel) lines.push({ k: 'label', t: label });
    arr.forEach((item, i) => lines.push({ k: 'row', t: `${i + 1}. ${String(item)}` }));
  } else if (OBJECT_FIELDS.includes(f)) {
    if (!val || typeof val !== 'object' || isEmptyDeep(val)) return null;
    const walk = (obj) => Object.entries(obj).forEach(([k, v]) => {
      if (isEmptyDeep(v)) return;
      if (isScalar(v)) lines.push({ k: 'sub', t: humanizeKey(k) }, { k: 'row', t: `1. ${fmtScalar(v)}` });
      else { lines.push({ k: 'sub', t: humanizeKey(k) }); walk(v); }
    });
    walk(val);
    if (lines.length === 0) return null;
  } else {
    if (!hasVal(val)) return null;
    if (showLabel) lines.push({ k: 'label', t: label });
    lines.push({ k: 'row', t: `1. ${fmtVal(val)}` });
  }
  return lines.length ? lines : null;
};

/* One field = one wrap-gated glue View; sectionTitle rides inside the FIRST present field's View.
   Threshold 20 keeps every field (all short here) whole so no title/sub-label orphans. */
const renderFieldView = (lines, title, isFirst, keyId) => (
  <View key={keyId} style={styles.fieldUnit} wrap={lines.length > 20 ? true : false}>
    {isFirst ? <Text style={styles.sectionTitle}>{title}</Text> : null}
    {lines.map((ln, i) => {
      if (ln.k === 'label') return <Text key={i} style={styles.fieldLabel}>{ln.t}</Text>;
      if (ln.k === 'sub') return <Text key={i} style={styles.subLabel}>{ln.t}</Text>;
      return <Text key={i} style={styles.listItem}>{ln.t}</Text>;
    })}
  </View>
);

const renderSection = (record, sid) => {
  const title = SECTION_TITLES[sid];
  const units = (SECTION_FIELDS[sid] || []).map(f => buildFieldLines(record, sid, f, title)).filter(Boolean);
  if (units.length === 0) return null;
  return <View key={sid} style={styles.section}>{units.map((lines, i) => renderFieldView(lines, title, i === 0, `${sid}-${i}`))}</View>;
};

const renderRecommendations = (record) => {
  const recs = (Array.isArray(record.recommendations) ? record.recommendations : []).filter(r => r?.recommendation);
  if (recs.length === 0) return null;
  const grouped = {};
  recs.forEach(rec => { const d = rec.date ? formatDate(rec.date) : 'No Date'; (grouped[d] = grouped[d] || []).push(rec); });
  const sortedDates = Object.keys(grouped).sort((a, b) => a === 'No Date' ? 1 : b === 'No Date' ? -1 : new Date(b) - new Date(a));
  const lines = [];
  sortedDates.forEach(d => { lines.push({ k: 'sub', t: d }); grouped[d].forEach((r, i) => lines.push({ k: 'row', t: `${i + 1}. ${r.recommendation}` })); });
  return <View key="recommendations" style={styles.section}>{renderFieldView(lines, 'Recommendations', true, 'recs-0')}</View>;
};

const ColorectalSurgeryAssessmentDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.colorectal_surgery_assessment) return Array.isArray(r.colorectal_surgery_assessment) ? r.colorectal_surgery_assessment : [r.colorectal_surgery_assessment];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.colorectal_surgery_assessment) return Array.isArray(dd.colorectal_surgery_assessment) ? dd.colorectal_surgery_assessment : [dd.colorectal_surgery_assessment]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>Colorectal Surgery Assessment</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Colorectal Surgery Assessment</Text></View>
        {records.map((record, idx) => (
          // Rule #75: every record after the first STARTS ON A NEW PAGE; never on record 0.
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Colorectal Surgery Assessment ${idx + 1}`}</Text>
              {record.date ? <Text style={styles.recordMeta}>{formatDate(record.date)}</Text> : null}
            </View>
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
            {renderRecommendations(record)}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default ColorectalSurgeryAssessmentDocumentPDFTemplate;
