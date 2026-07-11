/**
 * CurrentPregnancyDocumentPDFTemplate.jsx
 * Box-free line-based layout (ConsultationNotes donor) — LETTER — B&W.
 * react-pdf 4.5.1: PER-FIELD wrap gating (each field = one wrap={false} unit; the section title rides
 * INSIDE the first field's View → no title orphan); recordContainer paddingBottom + break={idx>0} (Rule #75).
 * 4-area mirror of the JSX/copy: canonical splitBySentence ([;.] + abbrev) + guarded splitByComma (>=3);
 * OBJECT fields → sub-label(key) + numbered value; arrays/date/boolean/enum numbered; single-name label hidden.
 * Collection: current_pregnancy
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000' },
  title: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1, color: '#000000' },
  recordContainer: { paddingBottom: 8 },
  recordHeader: { marginBottom: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 16 },
  fieldGroup: { marginBottom: 4 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', textTransform: 'uppercase', letterSpacing: 0.5, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 3, marginBottom: 8 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#000000', borderBottomWidth: 0.5, borderBottomColor: '#999999', paddingBottom: 3, marginTop: 6, marginBottom: 4 },
  subLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', borderBottomWidth: 0.5, borderBottomColor: '#999999', paddingBottom: 2, marginTop: 4, marginBottom: 3 },
  listItem: { fontSize: 14, color: '#000000', marginBottom: 3, paddingLeft: 8, lineHeight: 1.4 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
});

const SECTION_TITLES = {
  pregnancyInfo: 'Pregnancy Info', complicationsRisk: 'Complications & Risk', fetalAssessment: 'Fetal Assessment',
  insulinManagement: 'Insulin Management', monitoringSupport: 'Monitoring & Support', clinicalNarrative: 'Clinical Narrative',
  recommendationsResults: 'Recommendations & Results', notesSection: 'Notes',
};
const FIELD_LABELS = {
  date: 'Date', type: 'Type', provider: 'Provider', facility: 'Facility', status: 'Status',
  gestationalAge: 'Gestational Age', edd: 'EDD', eddConfirmationMethod: 'EDD Confirmation Method',
  lmp: 'LMP', conceptionMethod: 'Conception Method', singleton: 'Singleton', multipleGestation: 'Multiple Gestation',
  pregnancyComplications: 'Pregnancy Complications', highRiskFactors: 'High Risk Factors', currentSymptoms: 'Current Symptoms',
  'fetalEcho.performed': 'Performed', 'fetalEcho.result': 'Result', 'fetalEcho.indication': 'Indication',
  'insulinAdjustmentProtocol.fastingInsulin': 'Fasting Insulin', 'insulinAdjustmentProtocol.mealInsulin': 'Meal Insulin',
  'insulinAdjustmentProtocol.adjustmentInstructions': 'Adjustment Instructions',
  ketoneMonitoringInstructions: 'Ketone Monitoring Instructions', virtualCheckIns: 'Virtual Check-Ins',
  culturalConsiderations: 'Cultural Considerations', riskCounseling: 'Risk Counseling',
  findings: 'Findings', assessment: 'Assessment', plan: 'Plan', recommendations: 'Recommendations', results: 'Results', notes: 'Notes',
};
const SECTION_FIELDS = {
  pregnancyInfo: ['date', 'type', 'provider', 'facility', 'status', 'gestationalAge', 'edd', 'eddConfirmationMethod', 'lmp', 'conceptionMethod', 'singleton', 'multipleGestation'],
  complicationsRisk: ['pregnancyComplications', 'highRiskFactors', 'currentSymptoms'],
  fetalAssessment: ['fetalEcho.performed', 'fetalEcho.result', 'fetalEcho.indication'],
  insulinManagement: ['insulinAdjustmentProtocol.fastingInsulin', 'insulinAdjustmentProtocol.mealInsulin', 'insulinAdjustmentProtocol.adjustmentInstructions'],
  monitoringSupport: ['ketoneMonitoringInstructions', 'virtualCheckIns', 'culturalConsiderations', 'riskCounseling'],
  clinicalNarrative: ['findings', 'assessment', 'plan'],
  recommendationsResults: ['recommendations', 'results'],
  notesSection: ['notes'],
};
const SECTION_ORDER = ['pregnancyInfo', 'complicationsRisk', 'fetalAssessment', 'insulinManagement', 'monitoringSupport', 'clinicalNarrative', 'recommendationsResults', 'notesSection'];
const ARRAY_FIELDS = ['pregnancyComplications', 'highRiskFactors', 'currentSymptoms', 'insulinAdjustmentProtocol.adjustmentInstructions', 'culturalConsiderations', 'riskCounseling', 'recommendations'];
const SENTENCE_FIELDS = ['ketoneMonitoringInstructions', 'insulinAdjustmentProtocol.fastingInsulin', 'insulinAdjustmentProtocol.mealInsulin', 'findings', 'assessment', 'plan', 'notes'];
const OBJECT_FIELDS = ['multipleGestation', 'results'];
const BOOLEAN_FIELDS = ['singleton', 'fetalEcho.performed'];
const DATE_FIELDS = ['date'];
const ENUM_FIELDS = { status: ['Active', 'Not Active'] };

const KEY_OVERRIDES = { edd: 'EDD', lmp: 'LMP', gdm: 'GDM', poc: 'POC', bmi: 'BMI', hr: 'HR' };
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
const fmtEnumVal = (f, v) => { const opts = ENUM_FIELDS[f]; if (opts) { const hit = opts.find(o => o.toLowerCase() === String(v ?? '').toLowerCase().trim()); if (hit) return hit; } return null; };
const safeArr = (v) => Array.isArray(v) ? v.filter(x => !isEmptyDeep(x)) : [];
const getVal = (record, f) => { if (!f.includes('.')) return record[f]; return f.split('.').reduce((o, k) => (o == null ? undefined : o[k]), record); };
const arrItemText = (item) => {
  if (item && typeof item === 'object' && !Array.isArray(item)) {
    return String(item.recommendation || item.text || item.value || item.description || Object.values(item).filter(v => v !== null && typeof v !== 'object').join(' — ') || '').trim();
  }
  return String(item ?? '').trim();
};
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };
const parseLabel = (text) => { if (!text || typeof text !== 'string') return null; const m = text.match(/^([A-Za-z][A-Za-z\s/&(),.#≥≤><%0-9-]{2,}?):\s+(.*)/); return m ? { label: m[1].trim(), content: m[2].trim() } : null; };
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
      const t = cur.trim(); if (t) parts.push(t); cur = '';
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts.filter(Boolean);
};

/* recursive object → {k:'sub'|'row'} lines: scalar leaf → sub-label(key) + "1. value"; nested/array → key + rows. */
const objectLinesPdf = (value) => {
  const out = [];
  if (!value || typeof value !== 'object') return out;
  Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => {
    const key = humanizeKey(k);
    if (isScalar(v)) { out.push({ k: 'sub', t: key }, { k: 'row', t: `1. ${fmtScalar(v)}` }); }
    else if (Array.isArray(v)) { out.push({ k: 'sub', t: key }); v.filter(x => !isEmptyDeep(x)).forEach((it, i) => out.push({ k: 'row', t: `${i + 1}. ${isScalar(it) ? fmtScalar(it) : arrItemText(it)}` })); }
    else { out.push({ k: 'sub', t: key }); objectLinesPdf(v).forEach(l => out.push(l)); }
  });
  return out;
};

/* Build {k:'label'|'sub'|'row'} lines for ONE field — the exact mirror of buildFieldLines. */
const fieldLines = (record, f, sectionTitle) => {
  const label = FIELD_LABELS[f] || f;
  const val = getVal(record, f);
  const lines = [];
  if (!hasVal(val)) return lines;
  const showLabel = label.toLowerCase() !== String(sectionTitle || '').toLowerCase();
  const head = showLabel ? [{ k: 'label', t: label }] : [];
  if (OBJECT_FIELDS.includes(f)) {
    if (isScalar(val)) return lines;
    lines.push(...head); objectLinesPdf(val).forEach(l => lines.push(l));
  } else if (ARRAY_FIELDS.includes(f)) {
    const arr = safeArr(val); if (arr.length === 0) return lines;
    lines.push(...head); arr.forEach((item, i) => lines.push({ k: 'row', t: `${i + 1}. ${arrItemText(item)}` }));
  } else if (DATE_FIELDS.includes(f)) {
    lines.push(...head, { k: 'row', t: `1. ${formatDate(val)}` });
  } else if (BOOLEAN_FIELDS.includes(f)) {
    lines.push(...head, { k: 'row', t: `1. ${typeof val === 'boolean' ? (val ? 'Yes' : 'No') : fmtVal(val)}` });
  } else if (SENTENCE_FIELDS.includes(f)) {
    lines.push(...head);
    let n = 0;
    splitBySentence(fmtVal(val)).forEach(s => {
      const p = parseLabel(s);
      if (p) { const ci = splitByComma(p.content); lines.push({ k: 'sub', t: p.label }); n = 0; if (ci.length >= 3) ci.forEach(c => lines.push({ k: 'row', t: `${++n}. ${c}` })); else lines.push({ k: 'row', t: `${++n}. ${p.content}` }); }
      else { const ci = splitByComma(s); if (ci.length >= 3) ci.forEach(c => lines.push({ k: 'row', t: `${++n}. ${c}` })); else lines.push({ k: 'row', t: `${++n}. ${s}` }); }
    });
  } else {
    const strVal = ENUM_FIELDS[f] ? (fmtEnumVal(f, val) ?? fmtVal(val)) : fmtVal(val);
    lines.push(...head, { k: 'row', t: `1. ${strVal}` });
  }
  return lines;
};

const renderLine = (ln, i) => ln.k === 'label'
  ? <Text key={i} style={styles.fieldLabel}>{ln.t}</Text>
  : ln.k === 'sub'
    ? <Text key={i} style={styles.subLabel}>{ln.t}</Text>
    : <Text key={i} style={styles.listItem}>{ln.t}</Text>;

const CurrentPregnancyDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.current_pregnancy) return Array.isArray(r.current_pregnancy) ? r.current_pregnancy : [r.current_pregnancy];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.current_pregnancy) return Array.isArray(dd.current_pregnancy) ? dd.current_pregnancy : [dd.current_pregnancy]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>Current Pregnancy</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Current Pregnancy</Text></View>
        {records.map((record, idx) => (
          // Rule #75: every record after the first STARTS ON A NEW PAGE; never record 0.
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Current Pregnancy ${idx + 1}`}</Text>
            </View>
            {SECTION_ORDER.map(sid => {
              const title = SECTION_TITLES[sid];
              // Per-FIELD gating: each field is its own wrap unit; the section title rides inside the FIRST field's View.
              const units = (SECTION_FIELDS[sid] || []).map(f => fieldLines(record, f, title)).filter(u => u.length > 0);
              if (units.length === 0) return null;
              return (
                <View key={sid} style={styles.section}>
                  {units.map((unit, ui) => (
                    <View key={ui} style={styles.fieldGroup} wrap={unit.length > 22 ? true : false}>
                      {ui === 0 && <Text style={styles.sectionTitle}>{title}</Text>}
                      {unit.map(renderLine)}
                    </View>
                  ))}
                </View>
              );
            })}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default CurrentPregnancyDocumentPDFTemplate;
