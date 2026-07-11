/**
 * ApgarScoresDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — APGAR scores
 * Collection: apgar_scores
 * NO BLUE COLORS: #000000, #333333, #cccccc, #f5f5f5 ONLY
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 15, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, borderBottomWidth: 3, borderBottomColor: '#000000', paddingBottom: 14 },
  title: { fontSize: 25, fontFamily: 'Helvetica-Bold', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 2 },
  recordContainer: { marginBottom: 28, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#cccccc' },
  recordHeader: { marginBottom: 16, backgroundColor: '#f5f5f5', padding: 12, borderWidth: 2, borderColor: '#000000', borderLeftWidth: 5, borderLeftColor: '#000000' },
  recordDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 13, color: '#333333', fontFamily: 'Helvetica' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 3, textTransform: 'uppercase' },
  fieldValue: { fontSize: 14, color: '#000000', lineHeight: 1.4 },
  listItem: { fontSize: 14, color: '#000000', lineHeight: 1.4, marginBottom: 3, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  timeLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 5, marginBottom: 1 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#cccccc' },
  noDataText: { fontSize: 14, color: '#333333', textAlign: 'center', marginTop: 40 },
  chartSection: { marginBottom: 14, padding: 12, backgroundColor: '#f5f5f5', borderRadius: 4, borderWidth: 1, borderColor: '#cccccc' },
  chartTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 8 },
  barContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  barLabel: { fontSize: 13, width: 110, fontFamily: 'Helvetica-Bold' },
  barBackground: { flex: 1, height: 18, backgroundColor: '#cccccc', borderRadius: 4, overflow: 'hidden', marginRight: 8 },
  barFill: { height: '100%', borderRadius: 4 },
  barValue: { fontSize: 13, width: 90, textAlign: 'right' },
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
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'object' && val.$date) return formatDate(val.$date);
  return String(val);
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

/* splitBySemicolon: parenthesis-aware semicolon split (timepoint separator for component fields).
   MIRRORS ApgarScoresDocument.jsx exactly so the PDF segments identically to the on-screen render. */
const splitBySemicolon = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ';' && depth === 0) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* splitFirstColon: split a timepoint "1 minute: 1 (...)" into { tlabel:'1 minute', value:'1 (...)' }.
   Splits on the FIRST colon only — handles digit-leading labels parseLabel rejects, and keeps inner
   colons (e.g. "Below 100 bpm: ~80 bpm") inside the value. */
const splitFirstColon = (s) => {
  const str = String(s == null ? '' : s);
  const m = str.match(/^([^:]+):\s*([\s\S]*)$/);
  return m ? { tlabel: m[1].trim(), value: m[2].trim() } : { tlabel: '', value: str.trim() };
};

const SECTION_TITLES = {
  'birth-info': 'Birth Information',
  'apgar-scores': 'APGAR Scores',
  'component-details': 'Component Details',
  'interventions': 'Interventions',
  'recommendations': 'Recommendations',
};

const FIELD_LABELS = {
  birthDate: 'Birth Date',
  birthTime: 'Birth Time',
  assessor: 'Assessor',
  apgar1Minute: '1 Minute Score',
  apgar5Minutes: '5 Minutes Score',
  apgar10Minutes: '10 Minutes Score',
  appearance: 'Appearance (Skin Color)',
  pulse: 'Pulse (Heart Rate)',
  grimace: 'Grimace (Reflex Irritability)',
  activity: 'Activity (Muscle Tone)',
  respiration: 'Respiration (Breathing)',
  interventions: 'Interventions',
  recommendations: 'Recommendations',
};

const SECTION_FIELDS = {
  'birth-info': ['birthDate', 'birthTime', 'assessor'],
  'apgar-scores': ['apgar1Minute', 'apgar5Minutes', 'apgar10Minutes'],
  'component-details': ['appearance', 'pulse', 'grimace', 'activity', 'respiration'],
  'interventions': ['interventions'],
  'recommendations': ['recommendations'],
};

const DATE_FIELDS = ['birthDate'];
const STRING_FIELDS = ['birthTime', 'apgar1Minute', 'apgar5Minutes', 'apgar10Minutes', 'appearance', 'pulse', 'grimace', 'activity', 'respiration', 'interventions', 'assessor'];
/* COMPONENT_FIELDS: APGAR component scores — value is semicolon-separated timepoints
   ("1 minute: X (...); 5 minutes: Y (...)"). Rendered as field label + one sub-label ("1 minute")
   + value per timepoint (NEVER a flat side-by-side line). Mirrors the JSX renderComponentField. */
const COMPONENT_FIELDS = ['appearance', 'pulse', 'grimace', 'activity', 'respiration'];

/* ======= Render helpers ======= */
const renderFieldValue = (val, label, seenLabels) => {
  const str = safeString(val);
  if (!str) return null;
  const sentences = splitBySentence(str);
  if (sentences.length > 1) {
    const items = [];
    let n = 1;
    sentences.forEach((s, si) => {
      const parsed = parseLabel(s);
      if (parsed.isLabeled) {
        const commaItems = splitByComma(parsed.value);
        if (!seenLabels.has(parsed.label)) {
          seenLabels.add(parsed.label);
          items.push(<Text key={`sub-${si}`} style={styles.nestedSubtitle}>{parsed.label}</Text>);
        }
        commaItems.forEach((ci, ciIdx) => {
          items.push(<Text key={`${si}-${ciIdx}`} style={styles.listItem}>{n++}. {ci}</Text>);
        });
      } else {
        items.push(<Text key={si} style={styles.listItem}>{n++}. {s}</Text>);
      }
    });
    return items;
  }
  return <Text style={styles.fieldValue}>{str}</Text>;
};

/* renderComponentValue: APGAR component value -> one sub-label ("1 minute") + value per timepoint.
   Mirrors the JSX renderComponentField (nested-subtitle sub-label + value). NEVER a flat line. */
const renderComponentValue = (val) => {
  const items = splitBySemicolon(safeString(val)).map(splitFirstColon);
  const out = [];
  items.forEach((it, i) => {
    if (it.tlabel) out.push(<Text key={`tl-${i}`} style={styles.timeLabel}>{it.tlabel}</Text>);
    out.push(<Text key={`tv-${i}`} style={styles.listItem}>{it.value}</Text>);
  });
  return out;
};

const getScoreColor = (score) => {
  const n = parseInt(score, 10);
  if (isNaN(n)) return '#333333';
  if (n >= 7) return '#333333';
  if (n >= 4) return '#333333';
  return '#000000';
};

const ApgarScoresDocumentPDFTemplate = ({ document: doc }) => {
  let records = [];

  if (Array.isArray(doc)) {
    records = doc;
  } else if (doc?.apgar_scores) {
    records = Array.isArray(doc.apgar_scores) ? doc.apgar_scores : [doc.apgar_scores];
  } else if (doc?.documentData?.apgar_scores) {
    records = Array.isArray(doc.documentData.apgar_scores) ? doc.documentData.apgar_scores : [doc.documentData.apgar_scores];
  } else if (doc?.documentData) {
    records = Array.isArray(doc.documentData) ? doc.documentData : [doc.documentData];
  } else if (doc && typeof doc === 'object') {
    records = [doc];
  }

  records = records.filter(r => r && Object.keys(r).length > 0);

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.title}>APGAR Scores</Text>
        </View>

        {records.length === 0 && (
          <Text style={styles.noDataText}>No APGAR score records available</Text>
        )}

        {records.map((record, idx) => {
          const scores = [
            { label: '1 Minute', value: record.apgar1Minute },
            { label: '5 Minutes', value: record.apgar5Minutes },
            { label: '10 Minutes', value: record.apgar10Minutes },
          ].filter(s => hasVal(s.value));

          return (
            <View key={idx} style={styles.recordContainer}>
              <View style={styles.recordHeader}>
                <View style={styles.recordDateRow}>
                  {record.birthDate && <Text style={styles.recordDate}>{formatDate(record.birthDate)}</Text>}
                </View>
                <Text style={styles.recordTitle}>APGAR Score {idx + 1}</Text>
              </View>

              {/* APGAR Score Summary Chart */}
              {scores.length > 0 && (
                <View style={styles.chartSection} wrap={false}>
                  <Text style={styles.chartTitle}>APGAR Score Summary</Text>
                  {scores.map((s, si) => {
                    const numVal = parseInt(s.value, 10);
                    const percentage = isNaN(numVal) ? 0 : Math.min((numVal / 10) * 100, 100);
                    return (
                      <View key={si} style={styles.barContainer}>
                        <Text style={styles.barLabel}>{s.label}</Text>
                        <View style={styles.barBackground}>
                          <View style={[styles.barFill, { width: `${percentage}%`, backgroundColor: getScoreColor(s.value) }]} />
                        </View>
                        <Text style={styles.barValue}>{s.value}/10</Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Sections */}
              {Object.entries(SECTION_FIELDS).map(([sid, fields]) => {
                const hasAny = fields.some(f => {
                  if (f === 'recommendations') {
                    return Array.isArray(record[f]) && record[f].length > 0;
                  }
                  return hasVal(record[f]);
                });
                if (!hasAny) return null;

                const seenLabels = new Set();

                return (
                  <View key={sid} style={styles.section} wrap={false}>
                    <Text style={styles.sectionTitle}>{SECTION_TITLES[sid]}</Text>
                    {fields.map(f => {
                      const label = FIELD_LABELS[f] || f;
                      const showLabel = label.toLowerCase() !== (SECTION_TITLES[sid] || '').toLowerCase();
                      if (f === 'recommendations') {
                        const recs = Array.isArray(record[f]) ? record[f] : [];
                        if (recs.length === 0) return null;
                        return (
                          <View key={f} style={styles.fieldBox}>
                            {recs.map((rec, ri) => {
                              const recText = typeof rec === 'object' ? (rec.recommendation || '') : String(rec);
                              const recDate = typeof rec === 'object' ? rec.date : null;
                              return (
                                <Text key={ri} style={styles.listItem}>
                                  {ri + 1}. {safeString(recText)}{recDate ? ` (${formatDate(recDate)})` : ''}
                                </Text>
                              );
                            })}
                          </View>
                        );
                      }
                      const val = record[f];
                      if (!hasVal(val)) return null;
                      if (DATE_FIELDS.includes(f)) {
                        return (
                          <View key={f} style={styles.fieldBox}>
                            {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
                            <Text style={styles.fieldValue}>{formatDate(val)}</Text>
                          </View>
                        );
                      }
                      if (COMPONENT_FIELDS.includes(f)) {
                        return (
                          <View key={f} style={styles.fieldBox}>
                            {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
                            {renderComponentValue(val)}
                          </View>
                        );
                      }
                      if (STRING_FIELDS.includes(f)) {
                        const str = safeString(val);
                        const parsed = parseLabel(str);
                        if (parsed.isLabeled && seenLabels.has(parsed.label)) {
                          return (
                            <View key={f} style={styles.fieldBox}>
                              {renderFieldValue(val, label, seenLabels)}
                            </View>
                          );
                        }
                        return (
                          <View key={f} style={styles.fieldBox}>
                            {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
                            {renderFieldValue(val, label, seenLabels)}
                          </View>
                        );
                      }
                      return (
                        <View key={f} style={styles.fieldBox}>
                          {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
                          <Text style={styles.fieldValue}>{safeString(val)}</Text>
                        </View>
                      );
                    })}
                  </View>
                );
              })}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default ApgarScoresDocumentPDFTemplate;
