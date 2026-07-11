/**
 * DevelopmentalMilestonesDocumentPDFTemplate.jsx
 * July 2026 — Helvetica — LETTER — BLACK & WHITE only (#000000 titles/values, #999999 label rules).
 * Collection: developmental_milestones.
 *
 * BOX-FREE canonical: page 14 / title 26 / recordTitle 19 / sectionTitle 16 + 1pt black rule /
 * fieldLabel & subLabel 13 + 0.5pt #999 rule / values 14.
 * Rule #74: wrap is BOOLEAN only; sectionTitle rides INSIDE the section's field View.
 * Every value row numbered ("1." even singles). Milestone items mirror the JSX exactly:
 * numbered milestone row + Achieved sub-label group ("1. Yes") + optional Age Achieved group.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, paddingBottom: 14, borderBottomWidth: 2, borderBottomColor: '#000000' },
  title: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: '#000000' },
  recordContainer: { paddingBottom: 8 },
  recordHeader: { marginBottom: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 16 },
  fieldGroup: { marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 4, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  subLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  value: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2 },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
});

/* ═══ UTILS ═══ */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/µm/g, 'um').replace(/μm/g, 'um').replace(/°/g, ' deg')
    .replace(/±/g, '+/-').replace(/≥/g, '>=').replace(/≤/g, '<=')
    .replace(/→/g, '->').replace(/“/g, '"').replace(/”/g, '"')
    .replace(/‘/g, "'").replace(/’/g, "'").replace(/—/g, '-').replace(/–/g, '-');
  return str;
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

const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try {
    const d = new Date(dateValue.$date || dateValue);
    if (isNaN(d.getTime())) return String(dateValue);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(dateValue); }
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

/* splitByComma: parenthesis-aware + guards — mirrors the JSX exactly */
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) {
      const rest = text.slice(i + 1);
      const noSpace = !/^\s/.test(rest);
      const nextWordM = rest.match(/^\s*([^\s,]+)/);
      const nextWord = nextWordM ? nextWordM[1].toLowerCase() : '';
      const prevWordM = current.match(/(\S+)\s*$/);
      const prevWord = prevWordM ? prevWordM[1].toLowerCase() : '';
      const nextCharM = rest.match(/^\s*(.)/);
      const nextChar = nextCharM ? nextCharM[1] : '';
      const badNext = nextChar && !/[A-Za-z>(]/.test(nextChar);
      if (noSpace || nextWord === 'and' || nextWord === 'or' || prevWord === 'and' || prevWord === 'or' || badNext) { current += ch; continue; }
      const t = current.trim(); if (t) result.push(t); current = '';
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* sentence field lines: labeled → sub-label + rows (restart); unlabeled → running count */
const sentenceLines = (text) => {
  const sentences = splitBySentence(String(text || ''));
  const lines = []; let running = 1;
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    const value = (parsed.isLabeled ? parsed.value : s).replace(/[;.]+$/, '').trim();
    if (!value) return;
    const parts = splitByComma(value);
    if (parsed.isLabeled) {
      lines.push({ sub: true, text: parsed.label });
      if (parts.length >= 3) parts.forEach((it, i) => lines.push({ sub: false, text: `${i + 1}. ${it}` }));
      else lines.push({ sub: false, text: `1. ${value}` });
    } else if (parts.length >= 3) {
      parts.forEach(it => lines.push({ sub: false, text: `${running++}. ${it}` }));
    } else {
      lines.push({ sub: false, text: `${running++}. ${value}` });
    }
  });
  return lines;
};

/* recursive object lines (results): labels ruled, values numbered, arrays never index-keyed */
const objectLines = (value, label) => {
  const lines = [];
  if (isEmptyDeep(value)) return lines;
  if (Array.isArray(value)) {
    if (label) lines.push({ sub: true, text: label });
    let n = 1;
    value.filter(v => !isEmptyDeep(v)).forEach(v => {
      if (isScalar(v)) lines.push({ sub: false, text: `${n++}. ${fmtScalar(v)}` });
      else objectLines(v, '').forEach(l => lines.push(l));
    });
    return lines;
  }
  if (isScalar(value)) {
    if (label) lines.push({ sub: true, text: label });
    lines.push({ sub: false, text: `1. ${fmtScalar(value)}` });
    return lines;
  }
  if (label) lines.push({ sub: true, text: label });
  Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => {
    objectLines(v, humanizeKey(k)).forEach(l => lines.push(l));
  });
  return lines;
};

const SESSION_FIELDS = [
  ['date', 'Date'],
  ['provider', 'Provider'],
  ['facility', 'Facility'],
  ['type', 'Type'],
  ['status', 'Status'],
];
const MILESTONE_SECTIONS = [
  ['grossMotor', 'Gross Motor'],
  ['fineMotor', 'Fine Motor'],
  ['language', 'Language'],
  ['socialEmotional', 'Social/Emotional'],
  ['cognitive', 'Cognitive'],
];

/* ═══ COMPONENT ═══ */
const DevelopmentalMilestonesDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.developmental_milestones) return Array.isArray(r.developmental_milestones) ? r.developmental_milestones : [r.developmental_milestones];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.developmental_milestones) return Array.isArray(dd.developmental_milestones) ? dd.developmental_milestones : [dd.developmental_milestones]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.title}>Developmental Milestones</Text></View>
          <Text style={styles.emptyState}>No records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Developmental Milestones</Text></View>

        {records.map((record, idx) => {
          const sessionPresent = SESSION_FIELDS.filter(([k]) => hasVal(record[k]));
          const concerns = Array.isArray(record.concerns) ? record.concerns.filter(v => v && String(v).trim()) : [];
          const referrals = Array.isArray(record.referrals) ? record.referrals.filter(v => v && String(v).trim()) : [];
          const assessLines = [
            ['Findings', record.findings],
            ['Assessment', record.assessment],
            ['Plan', record.plan],
          ].filter(([, v]) => hasVal(v)).map(([label, v]) => [label, sentenceLines(v)]);
          const resultsLines = (hasVal(record.results) && !isScalar(record.results))
            ? Object.entries(record.results).filter(([, v]) => !isEmptyDeep(v)).flatMap(([k, v]) => objectLines(v, humanizeKey(k)))
            : [];
          const recs = Array.isArray(record.recommendations) ? record.recommendations.filter(r => (r?.recommendation || '').trim()) : [];
          const notesLines = hasVal(record.notes) ? sentenceLines(record.notes) : [];

          return (
            <View key={idx} style={styles.recordContainer} break={idx > 0}>
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>{`Developmental Milestones ${idx + 1}`}</Text>
              </View>

              {/* Session Information */}
              {sessionPresent.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.fieldGroup} wrap={sessionPresent.length * 2 > 8 ? true : false}>
                    <Text style={styles.sectionTitle}>Session Information</Text>
                    {sessionPresent.map(([k, label]) => (
                      <View key={k}>
                        <Text style={styles.fieldLabel}>{label}</Text>
                        <Text style={styles.listItem}>{`1. ${safeString(k === 'date' ? formatDate(record[k]) : record[k])}`}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Milestone sections */}
              {MILESTONE_SECTIONS.map(([fn, title]) => {
                const arr = Array.isArray(record[fn]) ? record[fn].filter(it => it && (it.milestone || it.achieved !== undefined)) : [];
                if (arr.length === 0) return null;
                const rowCount = arr.reduce((n, it) => n + 2 + (it.ageAchieved ? 2 : 0), 0);
                return (
                  <View key={fn} style={styles.section}>
                    <View style={styles.fieldGroup} wrap={rowCount > 8 ? true : false}>
                      <Text style={styles.sectionTitle}>{title}</Text>
                      {arr.map((item, i) => (
                        <View key={i}>
                          <Text style={styles.listItem}>{`${i + 1}. ${safeString(item.milestone || '')}`}</Text>
                          {item.achieved !== undefined && item.achieved !== null && item.achieved !== '' && (
                            <View>
                              <Text style={styles.subLabel}>Achieved</Text>
                              <Text style={styles.listItem}>{`1. ${safeString(item.achieved)}`}</Text>
                            </View>
                          )}
                          {item.ageAchieved !== undefined && item.ageAchieved !== null && String(item.ageAchieved).trim() !== '' && (
                            <View>
                              <Text style={styles.subLabel}>Age Achieved</Text>
                              <Text style={styles.listItem}>{`1. ${safeString(item.ageAchieved)}`}</Text>
                            </View>
                          )}
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })}

              {/* Concerns & Referrals */}
              {(concerns.length > 0 || referrals.length > 0) && (
                <View style={styles.section}>
                  <View style={styles.fieldGroup} wrap={(concerns.length + referrals.length + 2) > 8 ? true : false}>
                    <Text style={styles.sectionTitle}>Concerns & Referrals</Text>
                    {concerns.length > 0 && (
                      <View>
                        <Text style={styles.fieldLabel}>Concerns</Text>
                        {concerns.map((c, i) => <Text key={i} style={styles.listItem}>{`${i + 1}. ${safeString(c)}`}</Text>)}
                      </View>
                    )}
                    {referrals.length > 0 && (
                      <View>
                        <Text style={styles.fieldLabel}>Referrals</Text>
                        {referrals.map((c, i) => <Text key={i} style={styles.listItem}>{`${i + 1}. ${safeString(c)}`}</Text>)}
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* Assessment & Plan */}
              {assessLines.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.fieldGroup} wrap={assessLines.reduce((n, [, ls]) => n + ls.length + 1, 0) > 8 ? true : false}>
                    <Text style={styles.sectionTitle}>Assessment & Plan</Text>
                    {assessLines.map(([label, ls]) => (
                      <View key={label}>
                        <Text style={styles.fieldLabel}>{label}</Text>
                        {ls.map((l, i) => <Text key={i} style={l.sub ? styles.subLabel : styles.listItem}>{safeString(l.text)}</Text>)}
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Results (recursive object) */}
              {resultsLines.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.fieldGroup} wrap={resultsLines.length > 8 ? true : false}>
                    <Text style={styles.sectionTitle}>Results</Text>
                    {resultsLines.map((l, i) => <Text key={i} style={l.sub ? styles.subLabel : styles.listItem}>{safeString(l.text)}</Text>)}
                  </View>
                </View>
              )}

              {/* Recommendations */}
              {recs.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.fieldGroup} wrap={recs.length > 8 ? true : false}>
                    <Text style={styles.sectionTitle}>Recommendations</Text>
                    {recs.map((r, i) => (
                      <Text key={i} style={styles.listItem}>{`${i + 1}. ${safeString((r.recommendation || '').trim())}${(r.date || '').trim() ? ` (${safeString((r.date || '').trim())})` : ''}`}</Text>
                    ))}
                  </View>
                </View>
              )}

              {/* Notes */}
              {notesLines.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.fieldGroup} wrap={notesLines.length > 8 ? true : false}>
                    <Text style={styles.sectionTitle}>Notes</Text>
                    {notesLines.map((l, i) => <Text key={i} style={l.sub ? styles.subLabel : styles.listItem}>{safeString(l.text)}</Text>)}
                  </View>
                </View>
              )}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default DevelopmentalMilestonesDocumentPDFTemplate;
