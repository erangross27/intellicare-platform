/**
 * ReproductiveHistoryDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — reproductive history
 * Collection: reproductive_history
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#606060', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#1f2937', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#606060', borderBottomStyle: 'solid' },
  recordDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 11, color: '#6b7280', fontFamily: 'Helvetica' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1f2937' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#606060', marginBottom: 8 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 11, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  nestedHeader: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 5, marginBottom: 2 },
  subLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#333333', marginTop: 4, marginBottom: 1 },
  nestedItem: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nested: { paddingLeft: 10 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#d1d5db', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 12, color: '#6b7280', textAlign: 'center', marginTop: 40 },
});

/* ======= UTILS ======= */
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try { const d = new Date(dateStr.$date || dateStr); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateStr); }
};

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };

const getNestedValue = (obj, path) => {
  if (!obj || !path) return undefined;
  const parts = path.split('.');
  let val = obj;
  for (const p of parts) {
    if (val === null || val === undefined) return undefined;
    val = val[p];
  }
  return val;
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
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

/* ======= FIELD DEFINITIONS ======= */
const SECTION_FIELDS = {
  'history-info': ['date', 'type', 'provider', 'facility'],
  'infertility': ['infertilityDiagnosis', 'infertilityDuration'],
  'art-cycles': ['artCycles'],
  'pgt-testing': ['pgtTesting.performed', 'pgtTesting.result', 'pgtTesting.embryoAge'],
  'menstrual-history': ['menstrualHistory.lmp', 'menstrualHistory.menarche', 'menstrualHistory.cycleRegularity', 'menstrualHistory.duration', 'menstrualHistory.flow', 'menstrualHistory.dysmenorrhea', 'menstrualHistory.intermenstrualBleeding', 'menstrualHistory.postcoitalBleeding'],
  'contraceptive-history': ['contraceptiveHistory'],
  'clinical-findings': ['findings', 'assessment', 'results', 'notes'],
  'plan-recommendations': ['plan', 'recommendations'],
  'status-info': ['status'],
};

const SECTION_TITLES = {
  'history-info': 'History Information',
  'infertility': 'Infertility',
  'art-cycles': 'ART Cycles',
  'pgt-testing': 'PGT Testing',
  'menstrual-history': 'Menstrual History',
  'contraceptive-history': 'Contraceptive History',
  'clinical-findings': 'Clinical Findings',
  'plan-recommendations': 'Plan & Recommendations',
  'status-info': 'Status',
};

const FIELD_LABELS = {
  date: 'Date',
  type: 'Type',
  provider: 'Provider',
  facility: 'Facility',
  infertilityDiagnosis: 'Infertility Diagnosis',
  infertilityDuration: 'Infertility Duration',
  artCycles: 'ART Cycles',
  'pgtTesting.performed': 'PGT Performed',
  'pgtTesting.result': 'PGT Result',
  'pgtTesting.embryoAge': 'Embryo Age',
  'menstrualHistory.lmp': 'LMP',
  'menstrualHistory.menarche': 'Menarche',
  'menstrualHistory.cycleRegularity': 'Cycle Regularity',
  'menstrualHistory.duration': 'Duration',
  'menstrualHistory.flow': 'Flow',
  'menstrualHistory.dysmenorrhea': 'Dysmenorrhea',
  'menstrualHistory.intermenstrualBleeding': 'Intermenstrual Bleeding',
  'menstrualHistory.postcoitalBleeding': 'Postcoital Bleeding',
  contraceptiveHistory: 'Contraceptive History',
  findings: 'Findings',
  assessment: 'Assessment',
  results: 'Results',
  notes: 'Notes',
  plan: 'Plan',
  recommendations: 'Recommendations',
  status: 'Status',
};

const BOOLEAN_FIELDS = ['pgtTesting.performed'];
const DATE_FIELDS = ['date'];
const ARRAY_FIELDS = ['contraceptiveHistory', 'recommendations'];
const OBJECT_ARRAY_FIELDS = ['artCycles'];
const OBJECT_FIELDS = ['results'];

const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
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
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };

/* ======= RENDER HELPERS ======= */
const renderSentenceField = (text, label) => {
  if (!text || typeof text !== 'string') return null;
  const sentences = splitBySentence(text);
  if (sentences.length <= 1) {
    return (
      <View style={styles.fieldBox} wrap={false}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValue}>{text}</Text>
      </View>
    );
  }
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {sentences.map((sentence, sIdx) => {
        const parsed = parseLabel(sentence);
        if (parsed.isLabeled) {
          const commaItems = splitByComma(parsed.value);
          if (commaItems.length >= 2) {
            return (
              <View key={sIdx}>
                <Text style={styles.nestedSubtitle}>{parsed.label}</Text>
                {commaItems.map((ci, ciIdx) => (
                  <Text key={ciIdx} style={styles.listItem}>{ciIdx + 1}. {ci}</Text>
                ))}
              </View>
            );
          }
          return (
            <View key={sIdx}>
              <Text style={styles.nestedSubtitle}>{parsed.label}</Text>
              <Text style={styles.listItem}>{parsed.value}</Text>
            </View>
          );
        }
        return <Text key={sIdx} style={styles.listItem}>{sIdx + 1}. {sentence}</Text>;
      })}
    </View>
  );
};

/* recursive object node: label = bold heading; value = plain line below */
const renderObjectNode = (label, value, keyPath, depth) => {
  if (isEmptyDeep(value)) return null;
  const LabelTag = depth > 0 ? styles.subLabel : styles.nestedHeader;
  if (isScalar(value)) {
    return (
      <View key={keyPath}>
        {label ? <Text style={LabelTag}>{label}</Text> : null}
        <Text style={styles.nestedItem}>{fmtScalar(value)}</Text>
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

/* ======= COMPONENT ======= */
const ReproductiveHistoryDocumentPDFTemplate = ({ document: data }) => {
  let records = [];
  if (Array.isArray(data)) {
    records = data;
  } else if (data?.records) {
    records = data.records;
  } else if (data) {
    records = [data];
  }

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>REPRODUCTIVE HISTORY REPORT</Text>
          </View>
          <Text style={styles.noDataText}>No reproductive history data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>REPRODUCTIVE HISTORY REPORT</Text>
        </View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            {idx > 0 && <View style={styles.separator} />}
            <View style={styles.recordHeader}>
              <View style={styles.recordDateRow}>
                {hasVal(record.date) && <Text style={styles.recordDate}>{formatDate(record.date)}</Text>}
              </View>
              <Text style={styles.recordTitle}>{record.provider || `Reproductive History ${idx + 1}`}</Text>
            </View>

            {/* Sections */}
            {Object.entries(SECTION_FIELDS).map(([sid, fields]) => {
              const sectionHasData = fields.some(f => {
                const val = getNestedValue(record, f);
                return hasVal(val);
              });
              if (!sectionHasData) return null;

              const sectionRows = fields.reduce((sum, f) => {
                const v = getNestedValue(record, f);
                if (!hasVal(v)) return sum;
                if (OBJECT_FIELDS.includes(f)) return sum + countRows(v);
                if (Array.isArray(v)) return sum + v.length;
                if (typeof v === 'string') return sum + splitBySentence(v).length;
                return sum + 1;
              }, 0);

              return (
                <View key={sid} style={styles.section} wrap={sectionRows > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>{SECTION_TITLES[sid]}</Text>
                  {fields.map(f => {
                    const val = getNestedValue(record, f);
                    if (!hasVal(val)) return null;
                    const label = FIELD_LABELS[f] || f;

                    if (DATE_FIELDS.includes(f)) {
                      return (
                        <View key={f} style={styles.fieldBox}>
                          <Text style={styles.fieldLabel}>{label}</Text>
                          <Text style={styles.fieldValue}>{formatDate(val)}</Text>
                        </View>
                      );
                    }

                    if (BOOLEAN_FIELDS.includes(f)) {
                      return (
                        <View key={f} style={styles.fieldBox}>
                          <Text style={styles.fieldLabel}>{label}</Text>
                          <Text style={styles.fieldValue}>{val ? 'Yes' : 'No'}</Text>
                        </View>
                      );
                    }

                    if (OBJECT_FIELDS.includes(f)) {
                      const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
                      if (entries.length === 0) return null;
                      return (
                        <View key={f} style={styles.fieldBox}>
                          <Text style={styles.fieldLabel}>{label}</Text>
                          {entries.map(([k, v]) => renderObjectNode(humanizeKey(k), v, `${f}-${k}`, 1))}
                        </View>
                      );
                    }

                    if (OBJECT_ARRAY_FIELDS.includes(f)) {
                      const items = Array.isArray(val) ? val : [val];
                      return (
                        <View key={f} style={styles.fieldBox}>
                          <Text style={styles.fieldLabel}>{label}</Text>
                          {items.map((item, itemIdx) => {
                            const parts = [];
                            if (item.type) parts.push(`Type: ${item.type}`);
                            if (item.cycleNumber) parts.push(`Cycle #${item.cycleNumber}`);
                            if (item.outcome) parts.push(`Outcome: ${item.outcome}`);
                            if (item.complications?.length) parts.push(`Complications: ${item.complications.join(', ')}`);
                            return <Text key={itemIdx} style={styles.listItem}>{itemIdx + 1}. {parts.join(' | ')}</Text>;
                          })}
                        </View>
                      );
                    }

                    if (ARRAY_FIELDS.includes(f)) {
                      const items = Array.isArray(val) ? val : [val];
                      return (
                        <View key={f} style={styles.fieldBox}>
                          <Text style={styles.fieldLabel}>{label}</Text>
                          {items.map((item, itemIdx) => {
                            const itemStr = typeof item === 'object' ? (item.text || item.recommendation || JSON.stringify(item)) : String(item);
                            return <Text key={itemIdx} style={styles.listItem}>{itemIdx + 1}. {itemStr}</Text>;
                          })}
                        </View>
                      );
                    }

                    /* String field with sentence parsing */
                    return <React.Fragment key={f}>{renderSentenceField(fmtVal(val), label)}</React.Fragment>;
                  })}
                </View>
              );
            })}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default ReproductiveHistoryDocumentPDFTemplate;
