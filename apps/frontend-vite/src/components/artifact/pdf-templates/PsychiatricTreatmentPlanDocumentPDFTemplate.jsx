/**
 * PsychiatricTreatmentPlanDocumentPDFTemplate.jsx
 * Box-free canonical PDF - Helvetica - LETTER - psychiatric treatment plan
 * Collection: psychiatric_treatment_plan
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

/* safeString: \u-escapes only (no literal smart-quotes / invisible chars - memory 6a4f...) */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let s;
  if (typeof val === 'string') s = val;
  else if (typeof val === 'number') s = String(val);
  else if (typeof val === 'boolean') s = val ? 'Yes' : 'No';
  else if (typeof val === 'object' && val.$date) s = formatDate(val.$date);
  else s = String(val);
  return s
    .replace(/\u00d7/g, 'x')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00b5m/g, 'um').replace(/\u03bcm/g, 'um')
    .replace(/\u00b0/g, ' deg').replace(/\u00b1/g, '+/-')
    .replace(/\u2265/g, '>=').replace(/\u2264/g, '<=').replace(/\u2192/g, '->');
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

const safeArray = (v) => Array.isArray(v) ? v.filter(x => x !== null && x !== undefined) : [];
const resolve = (record, path) => { const parts = String(path).split('.'); let v = record; for (const p of parts) v = v == null ? undefined : v[p]; return v; };

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

const KEY_OVERRIDES = {};
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const isObjEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isObjEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isObjEmptyDeep);
  return false;
};

/* objectLines: flatten a dynamic-key object into [{depth,label,value}] (value=null for a nested header) */
const objectLines = (value, depth = 0, label = '') => {
  const out = [];
  if (isObjEmptyDeep(value)) return out;
  if (value === null || typeof value !== 'object') {
    out.push({ depth, label, value: fmtVal(value) });
    return out;
  }
  if (label) out.push({ depth, label, value: null });
  Object.entries(value).filter(([, v]) => !isObjEmptyDeep(v)).forEach(([k, v]) => {
    out.push(...objectLines(v, depth + (label ? 1 : 0), humanizeKey(k)));
  });
  return out;
};

/* ======= CONFIG (mirror JSX) ======= */
const SECTION_TITLES = {
  'plan-info': 'Plan Information',
  'diagnoses': 'Diagnoses',
  'findings': 'Findings',
  'assessment': 'Assessment',
  'pharmacological': 'Pharmacological Interventions',
  'psychotherapy': 'Psychotherapy',
  'support-groups': 'Support Groups',
  'lifestyle': 'Lifestyle Modifications',
  'safety-plan': 'Safety Plan',
  'follow-up': 'Follow-Up Plan',
  'results': 'Results',
  'recommendations': 'Recommendations',
  'plan-notes': 'Plan & Notes',
};
const SECTION_ORDER = ['plan-info', 'diagnoses', 'findings', 'assessment', 'pharmacological', 'psychotherapy', 'support-groups', 'lifestyle', 'safety-plan', 'follow-up', 'results', 'recommendations', 'plan-notes'];
const SECTION_FIELDS = {
  'plan-info': ['date', 'type', 'provider', 'facility', 'status'],
  'findings': ['findings'],
  'assessment': ['assessment'],
  'psychotherapy': ['psychotherapy.type', 'psychotherapy.frequency', 'psychotherapy.provider', 'psychotherapy.goals'],
  'support-groups': ['supportGroups'],
  'lifestyle': ['lifestyleModifications'],
  'safety-plan': ['safetyPlan.warningSignsidentified', 'safetyPlan.copingStrategies', 'safetyPlan.supportsContacts', 'safetyPlan.crisisNumbers', 'safetyPlan.meansRestriction', 'safetyPlan.childcarePlan'],
  'follow-up': ['followUpPlan.nextAppointment', 'followUpPlan.frequency', 'followUpPlan.monitoring'],
  'plan-notes': ['plan', 'notes'],
};
const FIELD_LABELS = {
  date: 'Date',
  type: 'Type',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  notes: 'Notes',
  'psychotherapy.type': 'Type',
  'psychotherapy.frequency': 'Frequency',
  'psychotherapy.provider': 'Provider',
  'psychotherapy.goals': 'Goals',
  'supportGroups': 'Support Groups',
  'lifestyleModifications': 'Lifestyle Modifications',
  'safetyPlan.warningSignsidentified': 'Warning Signs',
  'safetyPlan.copingStrategies': 'Coping Strategies',
  'safetyPlan.supportsContacts': 'Support Contacts',
  'safetyPlan.crisisNumbers': 'Crisis Numbers',
  'safetyPlan.meansRestriction': 'Means Restriction',
  'safetyPlan.childcarePlan': 'Childcare Plan',
  'followUpPlan.nextAppointment': 'Next Appointment',
  'followUpPlan.frequency': 'Frequency',
  'followUpPlan.monitoring': 'Monitoring',
};
const DATE_FIELDS = ['date'];
const ARRAY_FIELDS = ['supportGroups', 'lifestyleModifications', 'psychotherapy.goals', 'safetyPlan.warningSignsidentified', 'safetyPlan.copingStrategies', 'safetyPlan.supportsContacts', 'safetyPlan.crisisNumbers', 'safetyPlan.meansRestriction', 'followUpPlan.monitoring'];

const sameAsTitle = (label, sid) => String(label || '').trim().toLowerCase() === String(SECTION_TITLES[sid] || '').trim().toLowerCase();

/* ======= FLAT ELEMENT BUILDERS (each returns an array of small <Text> elements) ======= */
const fieldLabelEl = (label) => <Text style={styles.fieldLabel}>{safeString(label)}</Text>;
const subLabelEl = (label) => <Text style={styles.subLabel}>{safeString(label)}</Text>;
const valueEl = (v) => <Text style={styles.value}>{safeString(v)}</Text>;

/* date field -> label + formatted value */
const dateFieldEls = (label, val, showLabel) => {
  const els = [];
  if (showLabel) els.push(fieldLabelEl(label));
  els.push(<Text style={styles.value}>{formatDate(val)}</Text>);
  return els;
};

/* plain string array -> label + one numbered line per item */
const arrayFieldEls = (label, arr, showLabel) => {
  const items = safeArray(arr);
  if (items.length === 0) return [];
  const els = [];
  if (showLabel) els.push(fieldLabelEl(label));
  items.forEach((it, i) => els.push(<Text style={styles.listItem}>{`${i + 1}. ${safeString(fmtVal(it))}`}</Text>));
  return els;
};

/* string field -> label + sentence/comma value lines (mirrors JSX renderStringField display) */
const stringFieldEls = (label, val, showLabel) => {
  const strVal = fmtVal(val);
  const sentences = splitBySentence(strVal);
  const els = [];
  if (showLabel) els.push(fieldLabelEl(label));
  if (sentences.length <= 1) { els.push(valueEl(strVal)); return els; }
  let n = 1;
  sentences.forEach((s) => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const parts = splitByComma(parsed.value);
      els.push(subLabelEl(parsed.label));
      if (parts.length >= 2) parts.forEach(p => els.push(<Text style={styles.listItem}>{`${n++}. ${safeString(p)}`}</Text>));
      else els.push(<Text style={styles.listItem}>{`${n++}. ${safeString(parsed.value)}`}</Text>);
    } else {
      els.push(<Text style={styles.listItem}>{`${n++}. ${safeString(s)}`}</Text>);
    }
  });
  return els;
};

/* diagnoses (array of {diagnosis, icdCode, specifiers[]}) -> numbered item header + stacked ICD Code/Specifiers */
const diagnosesEls = (arr) => {
  const items = safeArray(arr).filter(d => !isObjEmptyDeep(d));
  if (items.length === 0) return [];
  const els = [];
  items.forEach((d, i) => {
    els.push(<Text style={styles.subLabel}>{`${i + 1}. ${safeString(d.diagnosis || `Diagnosis ${i + 1}`)}`}</Text>);
    if (hasVal(d.icdCode)) { els.push(fieldLabelEl('ICD Code')); els.push(valueEl(d.icdCode)); }
    const specs = Array.isArray(d.specifiers) ? d.specifiers.filter(Boolean) : [];
    if (specs.length > 0) { els.push(fieldLabelEl('Specifiers')); specs.forEach((s, si) => els.push(<Text style={styles.listItem}>{`${si + 1}. ${safeString(s)}`}</Text>)); }
  });
  return els;
};

/* pharmacological (array of {intervention, rationale, monitoring}) -> numbered item header + stacked Rationale/Monitoring */
const pharmaEls = (arr) => {
  const items = safeArray(arr).filter(p => !isObjEmptyDeep(p));
  if (items.length === 0) return [];
  const els = [];
  items.forEach((p, i) => {
    els.push(<Text style={styles.subLabel}>{`${i + 1}. ${safeString(p.intervention || `Intervention ${i + 1}`)}`}</Text>);
    if (hasVal(p.rationale)) { els.push(fieldLabelEl('Rationale')); els.push(valueEl(p.rationale)); }
    if (hasVal(p.monitoring)) { els.push(fieldLabelEl('Monitoring')); els.push(valueEl(p.monitoring)); }
  });
  return els;
};

/* recommendations (array of {recommendation, date}) -> one numbered line per item (single-name-gated: no field label) */
const recommendationsEls = (arr) => {
  const items = safeArray(arr).filter(r => !isObjEmptyDeep(r));
  if (items.length === 0) return [];
  return items.map((rec, i) => {
    const t = rec.recommendation || `Recommendation ${i + 1}`;
    const dt = rec.date ? ` (${rec.date})` : '';
    return <Text style={styles.listItem}>{`${i + 1}. ${safeString(`${t}${dt}`)}`}</Text>;
  });
};

/* results (dynamic-key object) -> flattened humanized lines */
const resultsEls = (val) => {
  if (!val || typeof val !== 'object' || isObjEmptyDeep(val)) return [];
  const lines = objectLines(val, 0, '');
  return lines.map((ln) => (
    ln.value === null
      ? subLabelEl(ln.label)
      : valueEl(`${ln.label}: ${ln.value}`)
  ));
};

/* dispatch one flat field (dotted path aware) -> flat element array */
const genericFieldEls = (record, f, sid) => {
  const val = resolve(record, f);
  if (!hasVal(val)) return [];
  const label = FIELD_LABELS[f] || f;
  const showLabel = !sameAsTitle(label, sid);
  if (DATE_FIELDS.includes(f)) return dateFieldEls(label, val, showLabel);
  if (ARRAY_FIELDS.includes(f)) return arrayFieldEls(label, val, showLabel);
  return stringFieldEls(label, val, showLabel);
};

/* build the flat element array for a whole section */
const sectionEls = (record, sid) => {
  if (sid === 'diagnoses') return diagnosesEls(record.diagnoses);
  if (sid === 'pharmacological') return pharmaEls(record.pharmacological);
  if (sid === 'results') return resultsEls(record.results);
  if (sid === 'recommendations') return recommendationsEls(record.recommendations);
  const flat = [];
  (SECTION_FIELDS[sid] || []).forEach(f => flat.push(...genericFieldEls(record, f, sid)));
  return flat;
};

/* ======= COMPONENT ======= */
const PsychiatricTreatmentPlanDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.psychiatric_treatment_plan) return Array.isArray(r.psychiatric_treatment_plan) ? r.psychiatric_treatment_plan : [r.psychiatric_treatment_plan];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.psychiatric_treatment_plan) return Array.isArray(dd.psychiatric_treatment_plan) ? dd.psychiatric_treatment_plan : [dd.psychiatric_treatment_plan]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Psychiatric Treatment Plan</Text>
          <Text style={styles.noDataText}>No psychiatric treatment plan records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Psychiatric Treatment Plan</Text>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer} break={index > 0}>
            <View wrap={false}>
              <Text style={styles.recordTitle}>{`Psychiatric Treatment Plan ${index + 1}`}</Text>
            </View>

            {SECTION_ORDER.map((sid) => {
              const flat = sectionEls(record, sid);
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

export default PsychiatricTreatmentPlanDocumentPDFTemplate;
