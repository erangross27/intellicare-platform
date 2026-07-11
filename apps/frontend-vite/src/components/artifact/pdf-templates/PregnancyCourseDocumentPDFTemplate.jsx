/**
 * PregnancyCourseDocumentPDFTemplate.jsx
 * June 2026 — FULL TEMPLATE STANDARD — B&W (#000000 only) — LETTER size
 * Collection: pregnancy_course
 *
 * Rule #74 (per-field wrap gating): each field is its own wrap unit (View);
 * sectionTitle embedded INSIDE the first present field's View (anti-orphan).
 *
 * TYPED:
 *   OBJECT (recursive renderObjectNode): firstTrimester, secondTrimester, thirdTrimester, results
 *   DATE: date
 *   ARRAY (per-item): recommendations
 *   STRING per-sentence: findings, assessment, plan, notes
 *   STRING simple: type, provider, facility, status
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000' },
  recordDate: { fontSize: 11, color: '#000000', fontFamily: 'Helvetica', marginTop: 2 },
  section: { marginBottom: 14 },
  fieldGroup: { marginBottom: 8 },
  sectionTitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#000000', marginBottom: 2 },
  subLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 1, marginTop: 2 },
  value: { fontSize: 11, lineHeight: 1.5, color: '#000000' },
  nested: { marginLeft: 10, paddingLeft: 8, borderLeftWidth: 1, borderLeftColor: '#000000', marginTop: 2 },
  recDate: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 3, marginBottom: 1 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 12, color: '#000000', textAlign: 'center', marginTop: 40 },
  pageNumber: { position: 'absolute', bottom: 20, left: 0, right: 0, textAlign: 'center', fontSize: 9, color: '#000000' },
});

/* ======= CONSTANTS ======= */
const SECTION_TITLES = {
  'record-details': 'Record Details',
  'clinical': 'Clinical Summary',
  'first-trimester': 'First Trimester',
  'second-trimester': 'Second Trimester',
  'third-trimester': 'Third Trimester',
  'results': 'Results',
  'recommendations': 'Recommendations',
  'notes': 'Notes',
};
const SECTION_ORDER = ['record-details', 'clinical', 'first-trimester', 'second-trimester', 'third-trimester', 'results', 'recommendations', 'notes'];
const SECTION_FIELDS = {
  'record-details': ['date', 'type', 'provider', 'facility', 'status'],
  'clinical': ['findings', 'assessment', 'plan'],
  'first-trimester': ['firstTrimester'],
  'second-trimester': ['secondTrimester'],
  'third-trimester': ['thirdTrimester'],
  'results': ['results'],
  'recommendations': ['recommendations'],
  'notes': ['notes'],
};
const FIELD_LABELS = {
  date: 'Date', type: 'Type', provider: 'Provider', facility: 'Facility', status: 'Status',
  findings: 'Findings', assessment: 'Assessment', plan: 'Plan', notes: 'Notes',
  recommendations: 'Recommendations', results: 'Results',
  firstTrimester: 'First Trimester', secondTrimester: 'Second Trimester', thirdTrimester: 'Third Trimester',
};
const DATE_FIELDS = ['date'];
const OBJECT_FIELDS = ['firstTrimester', 'secondTrimester', 'thirdTrimester', 'results'];
const ARRAY_FIELDS = ['recommendations'];
const SENTENCE_FIELDS = ['findings', 'assessment', 'plan', 'notes'];

const KEY_OVERRIDES = {
  hcg: 'hCG', nt: 'NT', papp: 'PAPP', pappa: 'PAPP-A', afp: 'AFP', gbs: 'GBS',
  ogtt: 'OGTT', bpp: 'BPP', nst: 'NST', efw: 'EFW', ga: 'GA',
};
const humanizeKey = (key) => { if (key === null || key === undefined || key === '') return ''; if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key]; const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); return s.charAt(0).toUpperCase() + s.slice(1); };

/* ======= UTILS ======= */
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try { const d = new Date(dateStr.$date || dateStr); if (isNaN(d.getTime()) || d.getFullYear() < 1971) return ''; return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return ''; }
};
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
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };

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
  if (Array.isArray(value)) {
    const items = value.filter(x => !isEmptyDeep(x));
    if (items.length === 0) return null;
    return (
      <View key={keyPath}>
        {label ? <Text style={LabelTag}>{label}</Text> : null}
        <View style={label ? styles.nested : undefined}>
          {items.map((it, i) => (
            isScalar(it)
              ? <Text key={i} style={styles.value}>{i + 1}. {fmtScalar(it)}</Text>
              : renderObjectNode('', it, `${keyPath}-${i}`, depth + 1)
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

/* Rule #74 (per-field gating): render a field as wrap-gated View(s) — EACH View is one wrap unit.
   sectionTitle goes INSIDE the first View (isFirst). Returns an ARRAY of Views. */
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
        <Text style={styles.value}>{formatDate(val)}</Text>
      </View>
    )];
  }

  if (ARRAY_FIELDS.includes(field)) {
    const recs = (Array.isArray(val) ? val : []).filter(r => !isEmptyDeep(r));
    if (recs.length === 0) return [];
    /* date-grouped when items are {recommendation,date} objects */
    const groups = [];
    recs.forEach((r) => {
      const isObj = r && typeof r === 'object';
      const d = isObj ? formatDate(r.date) : '';
      const last = groups[groups.length - 1];
      if (last && last.date === d) last.items.push(r); else groups.push({ date: d, items: [r] });
    });
    return [(
      <View key={field} style={styles.fieldGroup} wrap={recs.length > 8 ? undefined : false}>
        {titleNode}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {groups.map((group, gIdx) => (
          <View key={gIdx}>
            {group.date ? <Text style={styles.recDate}>{group.date}</Text> : null}
            {group.items.map((r, i) => {
              const s = (r && typeof r === 'object') ? fmtVal(r.recommendation) : fmtVal(r);
              return (<Text key={i} style={styles.value}>{i + 1}. {s}</Text>);
            })}
          </View>
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

  /* string — per-sentence for narratives, plain otherwise */
  const strVal = fmtVal(val);
  const sentences = splitBySentence(strVal);
  if (SENTENCE_FIELDS.includes(field) && sentences.length > 1) {
    return [(
      <View key={field} style={styles.fieldGroup} wrap={sentences.length > 8 ? undefined : false}>
        {titleNode}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {sentences.map((s, sIdx) => (<Text key={sIdx} style={styles.value}>{sIdx + 1}. {s.replace(/[;.]+$/, '').trim()}</Text>))}
      </View>
    )];
  }
  return [(
    <View key={field} style={styles.fieldGroup} wrap={false}>
      {titleNode}
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      <Text style={styles.value}>{strVal}</Text>
    </View>
  )];
};

/* ======= MAIN COMPONENT ======= */
const PregnancyCourseDocumentPDFTemplate = ({ document: docData }) => {
  let records = [];
  if (Array.isArray(docData)) {
    if (docData.length > 0 && docData[0]?.pregnancy_course) records = Array.isArray(docData[0].pregnancy_course) ? docData[0].pregnancy_course : [docData[0].pregnancy_course];
    else records = docData;
  } else if (docData?.pregnancy_course) records = Array.isArray(docData.pregnancy_course) ? docData.pregnancy_course : [docData.pregnancy_course];
  else if (docData?.documentData) { const dd = docData.documentData; if (Array.isArray(dd)) records = dd; else if (dd?.pregnancy_course) records = Array.isArray(dd.pregnancy_course) ? dd.pregnancy_course : [dd.pregnancy_course]; else if (dd && typeof dd === 'object') records = [dd]; }
  else if (docData && typeof docData === 'object') records = [docData];
  records = (records || []).filter(r => r && typeof r === 'object');

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Pregnancy Course</Text>
          </View>
          <Text style={styles.noDataText}>No pregnancy course records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Pregnancy Course</Text>
        </View>

        {records.map((record, idx) => {
          const recDate = formatDate(record.date) || formatDate(record.createdAt);
          return (
            <View key={idx} style={styles.recordContainer}>
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>
                  {records.length > 1 ? `Pregnancy Course ${idx + 1}` : 'Pregnancy Course'}
                </Text>
                {recDate ? <Text style={styles.recordDate}>{recDate}</Text> : null}
              </View>

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

              {idx < records.length - 1 && <View style={styles.separator} />}
            </View>
          );
        })}
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} fixed />
      </Page>
    </Document>
  );
};

export default PregnancyCourseDocumentPDFTemplate;
