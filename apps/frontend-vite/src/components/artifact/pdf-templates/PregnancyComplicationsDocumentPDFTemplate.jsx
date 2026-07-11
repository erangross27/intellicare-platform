/**
 * PregnancyComplicationsDocumentPDFTemplate.jsx
 * June 2026 — Helvetica — LETTER size — BLACK & WHITE ONLY (grayscale)
 * Collection: pregnancy_complications
 *
 * Field handling mirrors the JSX:
 *   - date                     → date-picker formatted
 *   - iugr/poly/oligohydramnios→ Yes/No (false still shown)
 *   - 4 objects (hypertensiveDisorders, placentalComplications, pretermLabor, results)
 *                              → recursive humanizeKey key/value (arrays supported)
 *   - infections (array of {type,status,notes}) → numbered recursive entries
 *   - recommendations (array of {recommendation,date}) → date-grouped numbered list
 *   - findings/assessment/plan/notes → per-sentence numbered lines
 *   - Rule #74: per-field wrap gating; sectionTitle INSIDE first present View
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 11, color: '#000000', fontFamily: 'Helvetica' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000' },
  fieldGroup: { marginBottom: 10 },
  sectionTitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#000000', marginTop: 6, marginBottom: 2 },
  subLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 1 },
  fieldValue: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 1 },
  listItem: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nested: { marginLeft: 10, paddingLeft: 8, borderLeftWidth: 1, borderLeftColor: '#000000', marginTop: 2 },
  recDate: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#cccccc', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 12, color: '#000000', textAlign: 'center', marginTop: 40 },
});

/* ======= FIELD CONFIG (mirror JSX) ======= */
const SECTION_TITLES = {
  'header-info': 'Header Information',
  'clinical-info': 'Clinical Information',
  'hypertensive-disorders': 'Hypertensive Disorders',
  'placental-complications': 'Placental Complications',
  'preterm-labor': 'Preterm Labor',
  'fluid-status': 'Fluid Status',
  'infections': 'Infections',
  'results': 'Results',
  'recommendations': 'Recommendations',
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
  hypertensiveDisorders: 'Hypertensive Disorders',
  placentalComplications: 'Placental Complications',
  pretermLabor: 'Preterm Labor',
  results: 'Results',
  infections: 'Infections',
  recommendations: 'Recommendations',
  iugr: 'IUGR (Intrauterine Growth Restriction)',
  polyhydramnios: 'Polyhydramnios',
  oligohydramnios: 'Oligohydramnios',
};

const SECTION_FIELDS = {
  'header-info': ['date', 'provider', 'facility', 'status'],
  'clinical-info': ['findings', 'assessment', 'plan', 'notes'],
  'hypertensive-disorders': ['hypertensiveDisorders'],
  'placental-complications': ['placentalComplications'],
  'preterm-labor': ['pretermLabor'],
  'fluid-status': ['iugr', 'polyhydramnios', 'oligohydramnios'],
  'infections': ['infections'],
  'results': ['results'],
  'recommendations': ['recommendations'],
};

const SECTION_ORDER = ['header-info', 'clinical-info', 'hypertensive-disorders', 'placental-complications', 'preterm-labor', 'fluid-status', 'infections', 'results', 'recommendations'];

const DATE_FIELDS = ['date'];
const BOOLEAN_FIELDS = ['iugr', 'polyhydramnios', 'oligohydramnios'];
const OBJECT_FIELDS = ['hypertensiveDisorders', 'placentalComplications', 'pretermLabor', 'results'];
const OBJECT_ARRAY_FIELDS = ['recommendations'];
const INFECTION_ARRAY_FIELDS = ['infections'];

/* ======= UTILS ======= */
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
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
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

/* recursive object node: label = bold heading; value = plain line below */
const renderObjectNode = (label, value, keyPath, depth) => {
  if (isEmptyDeep(value)) return null;
  const LabelTag = depth > 0 ? styles.subLabel : styles.fieldLabel;
  if (isScalar(value)) {
    return (
      <View key={keyPath}>
        {label ? <Text style={LabelTag}>{label}</Text> : null}
        <Text style={styles.fieldValue}>{fmtScalar(value)}</Text>
      </View>
    );
  }
  if (Array.isArray(value)) {
    const items = value.map((v, i) => [i, v]).filter(([, v]) => !isEmptyDeep(v));
    if (items.length === 0) return null;
    return (
      <View key={keyPath}>
        {label ? <Text style={LabelTag}>{label}</Text> : null}
        <View style={label ? styles.nested : undefined}>
          {items.map(([i, v]) => (
            isScalar(v)
              ? <Text key={i} style={styles.listItem}>{i + 1}. {fmtScalar(v)}</Text>
              : renderObjectNode('', v, `${keyPath}-${i}`, depth + 1)
          ))}
        </View>
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

/* Rule #74 per-field gating: returns an ARRAY of Views (each a wrap unit).
   sectionTitle goes INSIDE the first View (isFirst) — never a sibling. */
const renderField = (record, field, sectionTitle, isFirst) => {
  const val = record[field];
  if (!hasVal(val)) return [];
  const label = FIELD_LABELS[field] || field;
  const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
  const titleNode = isFirst ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null;

  if (DATE_FIELDS.includes(field)) {
    return [(
      <View key={field} style={styles.fieldGroup} wrap={false}>
        {titleNode}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        <Text style={styles.fieldValue}>{formatDate(val)}</Text>
      </View>
    )];
  }

  if (BOOLEAN_FIELDS.includes(field)) {
    return [(
      <View key={field} style={styles.fieldGroup} wrap={false}>
        {titleNode}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        <Text style={styles.fieldValue}>{val ? 'Yes' : 'No'}</Text>
      </View>
    )];
  }

  if (OBJECT_ARRAY_FIELDS.includes(field)) {
    const recs = Array.isArray(val) ? val : [];
    if (recs.length === 0) return [];
    const groups = [];
    recs.forEach((r) => { const d = (r?.date || '').trim(); const last = groups[groups.length - 1]; if (last && last.date === d) last.items.push(r); else groups.push({ date: d, items: [r] }); });
    return [(
      <View key={field} style={styles.fieldGroup} wrap={recs.length > 8 ? undefined : false}>
        {titleNode}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {groups.map((group, gIdx) => (
          <View key={gIdx}>
            {group.date ? <Text style={styles.recDate}>{group.date}</Text> : null}
            {group.items.map((r, i) => (<Text key={i} style={styles.listItem}>{i + 1}. {(r?.recommendation || '').trim()}</Text>))}
          </View>
        ))}
      </View>
    )];
  }

  if (INFECTION_ARRAY_FIELDS.includes(field)) {
    const items = (Array.isArray(val) ? val : []).filter(x => !isEmptyDeep(x));
    if (items.length === 0) return [];
    return items.map((item, i) => {
      const rows = countRows(item);
      return (
        <View key={`${field}-${i}`} style={styles.fieldGroup} wrap={rows > 8 ? undefined : false}>
          {i === 0 ? titleNode : null}
          {i === 0 && showLabel ? <Text style={styles.fieldLabel}>{label}</Text> : null}
          {isScalar(item)
            ? <Text style={styles.fieldValue}>{i + 1}. {fmtScalar(item)}</Text>
            : <View>
                <Text style={styles.subLabel}>{i + 1}.</Text>
                <View style={styles.nested}>{Object.entries(item).filter(([, v]) => !isEmptyDeep(v)).map(([k, v]) => renderObjectNode(humanizeKey(k), v, `${field}-${i}-${k}`, 1))}</View>
              </View>}
        </View>
      );
    });
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

  /* string — split into sentences */
  const strVal = fmtVal(val);
  const sentences = splitBySentence(strVal);
  if (sentences.length > 1) {
    return [(
      <View key={field} style={styles.fieldGroup} wrap={sentences.length > 8 ? undefined : false}>
        {titleNode}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {sentences.map((s, sIdx) => (<Text key={sIdx} style={styles.listItem}>{sIdx + 1}. {s}</Text>))}
      </View>
    )];
  }
  return [(
    <View key={field} style={styles.fieldGroup} wrap={false}>
      {titleNode}
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      <Text style={styles.fieldValue}>{strVal}</Text>
    </View>
  )];
};

/* ======= RENDER SECTION — title INSIDE first present field's View (no section wrapper wrap prop) ======= */
const renderSection = (record, sid) => {
  const title = SECTION_TITLES[sid];
  const fields = SECTION_FIELDS[sid] || [];
  const presentFields = fields.filter(f => hasVal(record[f]));
  if (presentFields.length === 0) return null;
  const out = [];
  presentFields.forEach((f, i) => { out.push(...renderField(record, f, title, i === 0)); });
  return <React.Fragment key={sid}>{out}</React.Fragment>;
};

/* ======= MAIN COMPONENT ======= */
const PregnancyComplicationsDocumentPDFTemplate = ({ document: docProp }) => {
  let records = [];
  if (Array.isArray(docProp)) {
    if (docProp.length > 0 && docProp[0].pregnancy_complications && Array.isArray(docProp[0].pregnancy_complications)) {
      records = docProp[0].pregnancy_complications;
    } else {
      records = docProp;
    }
  } else if (docProp && docProp.pregnancy_complications) {
    records = Array.isArray(docProp.pregnancy_complications) ? docProp.pregnancy_complications : [docProp.pregnancy_complications];
  } else if (docProp && docProp.documentData) {
    const dd = docProp.documentData;
    if (Array.isArray(dd)) records = dd;
    else if (dd?.pregnancy_complications) records = Array.isArray(dd.pregnancy_complications) ? dd.pregnancy_complications : [dd.pregnancy_complications];
    else if (dd && typeof dd === 'object') records = [dd];
  } else if (docProp) {
    records = [docProp];
  }
  records = records.filter(r => r && typeof r === 'object');

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Pregnancy Complications</Text>
          </View>
          <Text style={styles.noDataText}>No pregnancy complications data available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Pregnancy Complications</Text>
        </View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              {hasVal(record.date) && (
                <View style={styles.recordDateRow}>
                  <Text style={styles.recordDate}>{formatDate(record.date)}</Text>
                </View>
              )}
              <Text style={styles.recordTitle}>{record.provider || `Pregnancy Complications ${idx + 1}`}</Text>
            </View>
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
            {idx < records.length - 1 && <View style={styles.separator} />}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PregnancyComplicationsDocumentPDFTemplate;
