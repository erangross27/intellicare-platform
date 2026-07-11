/**
 * CardiacDeviceInterrogationsDocumentPDFTemplate.jsx
 * June 2026 — Helvetica — A4 — BLACK & WHITE only (#000000 titles/borders/values, NO blue).
 * Collection: cardiac_device_interrogations.
 *
 * BOX-FREE (no backgroundColor/border on field/section views; recordHeader = black bottom-border only).
 * Rule #74: each field is ONE wrap-gated <View> (rows<=8 -> wrap={false}; rows>8 -> wrap=undefined),
 * with its sectionTitle as the FIRST child of the first present field's View (anti-orphan — never a sibling).
 * Single-name skip: hide a field label when it equals the section title.
 * OBJECT fields rendered recursively as humanized key/value lines.
 * ARRAY fields (objects or scalars) rendered as numbered lists.
 * STRING narrative fields (interrogationReason, clinicalAssessment, followUpPlan, recommendations) sentence-split.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, paddingBottom: 14, borderBottomWidth: 2, borderBottomColor: '#000000' },
  title: { fontSize: 24, fontFamily: 'Helvetica-Bold', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1, color: '#000000' },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#000000' },
  recordMeta: { fontSize: 13, color: '#000000', marginTop: 3 },
  section: { marginBottom: 16 },
  fieldGroup: { marginBottom: 8 },
  sectionTitle: { fontSize: 17, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 2, textTransform: 'uppercase' },
  subLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 1 },
  value: { fontSize: 13, lineHeight: 1.5, color: '#000000', marginBottom: 1 },
  nested: { marginLeft: 10, paddingLeft: 8, borderLeftWidth: 1, borderLeftColor: '#000000', marginTop: 2 },
  itemHeader: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 16, color: '#000000' },
  pageNumber: { position: 'absolute', bottom: 20, right: 40, fontSize: 11, color: '#000000' },
});

/* ═══════ CONSTANTS ═══════ */
const SECTION_TITLES = {
  'device-info': 'Device Information',
  'interrogation': 'Interrogation',
  'battery': 'Battery Status',
  'leads-section': 'Leads',
  'pacing': 'Pacing Parameters',
  'pacing-pct': 'Pacing Percentages',
  'sensing': 'Sensing Thresholds',
  'icd': 'ICD Therapy',
  'afib': 'Atrial Fibrillation Burden',
  'arrhythmia': 'Arrhythmia Episodes',
  'remote': 'Remote Monitoring',
  'alerts-section': 'Alerts',
  'device-alerts-section': 'Device Alerts',
  'programming': 'Programming Changes',
  'clinical': 'Clinical Assessment',
  'follow-up': 'Follow-Up Plan',
  'recommendations-section': 'Recommendations',
};
const FIELD_LABELS = {
  deviceType: 'Device Type', manufacturer: 'Manufacturer', model: 'Model', serialNumber: 'Serial Number',
  implantDate: 'Implant Date', interrogationDate: 'Interrogation Date', interrogationReason: 'Interrogation Reason',
  batteryStatus: 'Battery Status', leads: 'Leads', pacingParameters: 'Pacing Parameters',
  pacingPercentages: 'Pacing Percentages', arrhythmiaEpisodes: 'Arrhythmia Episodes', icdTherapy: 'ICD Therapy',
  atrialFibrillationBurden: 'Atrial Fibrillation Burden', alerts: 'Alerts', remoteMonitoring: 'Remote Monitoring',
  programmingChanges: 'Programming Changes', clinicalAssessment: 'Clinical Assessment', followUpPlan: 'Follow-Up Plan',
  sensingThresholds: 'Sensing Thresholds', deviceAlerts: 'Device Alerts', recommendations: 'Recommendations',
};
const SECTION_FIELDS = {
  'device-info': ['deviceType', 'manufacturer', 'model', 'serialNumber', 'implantDate'],
  'interrogation': ['interrogationDate', 'interrogationReason'],
  'battery': ['batteryStatus'],
  'leads-section': ['leads'],
  'pacing': ['pacingParameters'],
  'pacing-pct': ['pacingPercentages'],
  'sensing': ['sensingThresholds'],
  'icd': ['icdTherapy'],
  'afib': ['atrialFibrillationBurden'],
  'arrhythmia': ['arrhythmiaEpisodes'],
  'remote': ['remoteMonitoring'],
  'alerts-section': ['alerts'],
  'device-alerts-section': ['deviceAlerts'],
  'programming': ['programmingChanges'],
  'clinical': ['clinicalAssessment'],
  'follow-up': ['followUpPlan'],
  'recommendations-section': ['recommendations'],
};
const SECTION_ORDER = [
  'device-info', 'interrogation', 'battery', 'leads-section', 'pacing', 'pacing-pct',
  'sensing', 'icd', 'afib', 'arrhythmia', 'remote', 'alerts-section', 'device-alerts-section',
  'programming', 'clinical', 'follow-up', 'recommendations-section',
];
const SENTENCE_FIELDS = ['interrogationReason', 'clinicalAssessment', 'followUpPlan', 'recommendations'];
const OBJECT_FIELDS = ['batteryStatus', 'pacingParameters', 'pacingPercentages', 'sensingThresholds', 'icdTherapy', 'atrialFibrillationBurden', 'remoteMonitoring'];
const ARRAY_FIELDS = ['leads', 'arrhythmiaEpisodes', 'alerts', 'programmingChanges', 'deviceAlerts'];

const KEY_OVERRIDES = {
  icd: 'ICD', crt: 'CRT', av: 'AV', vv: 'VV', rv: 'RV', lv: 'LV', ra: 'RA', la: 'LA',
  bpm: 'BPM', mv: 'mV', ms: 'ms', ohm: 'Ohm', ohms: 'Ohms', vt: 'VT', vf: 'VF', af: 'AF',
  atp: 'ATP', eri: 'ERI', rrt: 'RRT', eos: 'EOS', mri: 'MRI', id: 'ID',
};
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
const hasVal = (v) => !isEmptyDeep(v);
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };

// Parse "Label: value" (short capitalized label + colon+space) → {label, content}; parenthesis-aware comma split.
const parseLabel = (text) => { const m = String(text || '').match(/^\s*([A-Z][A-Za-z0-9 /&()'’.-]{0,39}?):\s+(.+)$/s); if (!m) return null; const label = m[1].trim(); const content = m[2].trim(); return (label && content) ? { label, content } : null; };
const splitByComma = (text) => { const s = String(text || ''); const out = []; let cur = '', depth = 0; for (let i = 0; i < s.length; i++) { const ch = s[i]; if (ch === '(') depth++; else if (ch === ')') depth = Math.max(0, depth - 1); if (ch === ',' && depth === 0) { const t = cur.trim(); if (t) out.push(t); cur = ''; } else cur += ch; } const t = cur.trim(); if (t) out.push(t); return out; };

/* recursive object node: label = bold heading; value = plain line below */
const renderObjectNode = (label, value, keyPath, depth) => {
  if (isEmptyDeep(value)) return null;
  const LabelTag = depth > 0 ? styles.subLabel : styles.fieldLabel;
  if (isScalar(value)) {
    return (
      <View key={keyPath}>
        {label ? <Text style={LabelTag}>{label}</Text> : null}
        <Text style={styles.value}>{fmtScalar(value)}</Text>
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

/* count rows for the wrap heuristic */
const countRows = (val) => {
  if (isEmptyDeep(val)) return 0;
  if (isScalar(val)) return 1;
  if (Array.isArray(val)) { let n = 0; val.filter(x => !isEmptyDeep(x)).forEach(it => { n += isScalar(it) ? 1 : 1 + countRows(it); }); return n; }
  let n = 0; Object.values(val).forEach(sub => { if (!isEmptyDeep(sub)) n += isScalar(sub) ? 2 : 1 + countRows(sub); }); return n;
};

/* Rule #74 (per-field gating): render a field as wrap-gated View(s) — EACH View is one wrap unit.
   sectionTitle goes INSIDE the first View (isFirst) — never a sibling. Returns an ARRAY of Views. */
const renderField = (record, field, sectionTitle, isFirst) => {
  const val = record[field];
  if (!hasVal(val)) return [];
  const label = FIELD_LABELS[field] || field;
  const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
  const titleNode = isFirst ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null;

  if (ARRAY_FIELDS.includes(field)) {
    const items = Array.isArray(val) ? val.filter(x => !isEmptyDeep(x)) : [];
    if (items.length === 0) return [];
    const rows = countRows(items);
    return [(
      <View key={field} style={styles.fieldGroup} wrap={rows > 8 ? undefined : false}>
        {titleNode}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {items.map((it, i) => (
          isScalar(it)
            ? <Text key={i} style={styles.value}>{i + 1}. {fmtScalar(it)}</Text>
            : (
              <View key={i}>
                <Text style={styles.itemHeader}>{i + 1}.</Text>
                <View style={styles.nested}>
                  {Object.entries(it).filter(([, v]) => !isEmptyDeep(v)).map(([k, v]) => renderObjectNode(humanizeKey(k), v, `${field}-${i}-${k}`, 1))}
                </View>
              </View>
            )
        ))}
      </View>
    )];
  }

  if (OBJECT_FIELDS.includes(field)) {
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return [];
    return entries.map(([k, v], i) => {
      const rows = countRows(v);
      return (
        <View key={`${field}-${k}`} style={styles.fieldGroup} wrap={rows > 8 ? undefined : false}>
          {i === 0 ? titleNode : null}
          {i === 0 && showLabel ? <Text style={styles.fieldLabel}>{label}</Text> : null}
          {renderObjectNode(humanizeKey(k), v, `${field}-${k}`, 1)}
        </View>
      );
    });
  }

  if (SENTENCE_FIELDS.includes(field)) {
    const strVal = fmtVal(val);
    const sentences = splitBySentence(strVal);
    // Mirror the JSX: "Label: value" → bold label + value (comma-split ≥3 → numbered items); plain sentence → line.
    const blocks = sentences.map(sent => {
      const parsed = parseLabel(sent);
      if (!parsed) return { text: sent };
      const parts = splitByComma(parsed.content);
      return parts.length >= 3 ? { label: parsed.label, parts } : { label: parsed.label, value: parsed.content };
    });
    const rowCount = blocks.reduce((n, b) => n + 1 + (b.parts ? b.parts.length : 0), 0);
    return [(
      <View key={field} style={styles.fieldGroup} wrap={rowCount > 8 ? undefined : false}>
        {titleNode}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {blocks.map((b, i) => (
          b.text !== undefined ? (
            <Text key={i} style={styles.value}>{b.text}</Text>
          ) : (
            <View key={i}>
              <Text style={styles.fieldLabel}>{b.label}</Text>
              {b.parts
                ? b.parts.map((p, pi) => (<Text key={pi} style={styles.value}>{pi + 1}. {p}</Text>))
                : <Text style={styles.value}>{b.value}</Text>}
            </View>
          )
        ))}
      </View>
    )];
  }

  /* short string */
  return [(
    <View key={field} style={styles.fieldGroup} wrap={false}>
      {titleNode}
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      <Text style={styles.value}>{fmtVal(val)}</Text>
    </View>
  )];
};

const CardiacDeviceInterrogationsDocumentPDFTemplate = ({ document: data }) => {
  let records = [];
  if (Array.isArray(data)) {
    if (data.length === 1 && data[0]?.cardiac_device_interrogations) records = Array.isArray(data[0].cardiac_device_interrogations) ? data[0].cardiac_device_interrogations : [data[0].cardiac_device_interrogations];
    else records = data;
  } else if (data?.cardiac_device_interrogations) records = Array.isArray(data.cardiac_device_interrogations) ? data.cardiac_device_interrogations : [data.cardiac_device_interrogations];
  else if (data?.documentData) { const dd = data.documentData; if (Array.isArray(dd)) records = dd; else if (dd?.cardiac_device_interrogations) records = Array.isArray(dd.cardiac_device_interrogations) ? dd.cardiac_device_interrogations : [dd.cardiac_device_interrogations]; else if (dd && typeof dd === 'object') records = [dd]; }
  else if (data && typeof data === 'object') records = [data];
  records = (records || []).filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (<Document><Page size="A4" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>Cardiac Device Interrogations</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Cardiac Device Interrogations</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Cardiac Device Interrogation ${String(record._recordNumber || idx + 1)}`}</Text>
              {hasVal(record.deviceType) && <Text style={styles.recordMeta}>{fmtVal(record.deviceType)}</Text>}
              {hasVal(record.manufacturer) && <Text style={styles.recordMeta}>{fmtVal(record.manufacturer)}</Text>}
              {hasVal(record.interrogationDate) && <Text style={styles.recordMeta}>{fmtVal(record.interrogationDate)}</Text>}
            </View>

            {/* Rule #74 (per-field gating): section View only provides spacing and always FLOWS.
                Each field is its own wrap-gated unit (via renderField), with the sectionTitle embedded
                INSIDE the first present field's View (anti-orphan). */}
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
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} fixed />
      </Page>
    </Document>
  );
};

export default CardiacDeviceInterrogationsDocumentPDFTemplate;
