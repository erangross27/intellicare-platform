/**
 * ChallengeTestsPDFTemplate.jsx
 * Box-free line-based layout (ConsultationNotes donor) — LETTER size — B&W.
 * react-pdf 4.5.1 engine rules: wrap props are BOOLEANS (explicit undefined = unbreakable);
 * recordContainer uses paddingBottom only (marginBottom shoves the whole record → empty page 1);
 * per-FIELD gates with the section title inside the first field's unit + leaf glue (anti-orphan).
 * Collection: challenge_tests
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, borderBottomWidth: 2, borderBottomColor: '#000000', paddingBottom: 12 },
  title: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1 },
  recordContainer: { paddingBottom: 8 },
  recordHeader: { marginBottom: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold' },
  recordMeta: { fontSize: 12, color: '#333333', marginTop: 4 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', textTransform: 'uppercase', letterSpacing: 0.5, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 3, marginBottom: 8 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#000000', borderBottomWidth: 0.5, borderBottomColor: '#999999', paddingBottom: 3, marginBottom: 4 },
  listItem: { fontSize: 14, lineHeight: 1.5, marginBottom: 3, paddingLeft: 8 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
});

const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).some(k => hasVal(v[k])); return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const safeArr = (v) => Array.isArray(v) ? v.filter(Boolean) : [];
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/[;.]\s+/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };
/* guarded comma split: never inside parentheses; ", and …"/", or …" stays connected; no-space commas kept */
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) {
      if (!/\s/.test(text[i + 1] || '')) { current += ch; continue; }
      const rest = text.slice(i + 1).replace(/^\s+/, '');
      if (/^(and|or)\b/i.test(rest)) { current += ch; continue; }
      if (/\b(and|or)\s*$/i.test(current)) { current += ch; continue; }
      const t = current.trim(); if (t) result.push(t); current = '';
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};
/* Sentences -> groups: labeled sentence = own group (sub-label + comma rows); consecutive
   unlabeled sentences collect into one group, also comma-split (mirrors the JSX). */
const parseLabeledSentences = (text) => {
  const groups = []; let nullGroup = null;
  splitBySentence(String(text || '')).forEach(sentence => {
    const ci = sentence.indexOf(':');
    const lbl = ci > 0 && ci < 60 && !sentence.substring(0, ci).includes('.') ? sentence.substring(0, ci).trim() : null;
    if (lbl) { groups.push({ label: lbl, items: splitByComma(sentence.substring(ci + 1).trim()).map(p => p.replace(/[.;]+$/, '').trim()).filter(Boolean) }); nullGroup = null; }
    else { if (!nullGroup) { nullGroup = { label: null, items: [] }; groups.push(nullGroup); } splitByComma(sentence).forEach(p => { const t = p.replace(/[.;]+$/, '').trim(); if (t) nullGroup.items.push(t); }); }
  });
  return groups;
};
const sentenceGroupRows = (text) => parseLabeledSentences(text).reduce((sum, g) => sum + g.items.length + (g.label ? 1 : 0), 0);
/* numbering restarts at each labeled group; unlabeled groups continue the running count */
const renderSentenceGroups = (text) => {
  let num = 0;
  return parseLabeledSentences(text).map((g, gi) => {
    if (g.label) num = 0;
    const start = num; num += g.items.length;
    return (
      <View key={gi} style={{ marginBottom: 4 }} wrap={g.items.length + 1 > 8 ? true : false}>
        {g.label && <Text style={styles.fieldLabel}>{g.label}</Text>}
        {g.items.map((s, i) => <Text key={i} style={styles.listItem}>{start + i + 1}. {s}</Text>)}
      </View>
    );
  });
};
/* supervisedBy: people split AFTER each close-paren so credential commas stay together */
const splitPeople = (s) => String(s).split(/(?<=\)),\s+/).map(t => t.trim()).filter(Boolean);

const CHALLENGE_TYPES = ['food', 'drug', 'aspirin', 'exercise'];
const getChallengeTypes = (record) => CHALLENGE_TYPES.filter(t => record[t] && typeof record[t] === 'object' && Object.keys(record[t]).some(k => hasVal(record[t][k])));

/* label + numbered rows as one glue unit (label can't orphan); big lists flow */
const LabeledRows = ({ label, rows }) => (
  <View style={{ marginBottom: 6 }} wrap={rows.length + 1 > 8 ? true : false}>
    {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
    {rows.map((r, i) => <Text key={i} style={styles.listItem}>{i + 1}. {r}</Text>)}
  </View>
);

const ChallengeTestsPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.challenge_tests) return Array.isArray(r.challenge_tests) ? r.challenge_tests : [r.challenge_tests];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.challenge_tests) return Array.isArray(dd.challenge_tests) ? dd.challenge_tests : [dd.challenge_tests]; return [dd]; }
      return r;
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>Challenge Tests</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Challenge Tests</Text></View>
        {records.map((record, idx) => {
          const challengeTypes = getChallengeTypes(record);
          return (
            <View key={idx} style={styles.recordContainer}>
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>{`Challenge Test ${idx + 1}`}</Text>
                {record.testDate && <Text style={styles.recordMeta}>{formatDate(record.testDate)}</Text>}
              </View>
              {challengeTypes.map((ct) => (
                <View key={ct} style={styles.section}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>{ct.charAt(0).toUpperCase() + ct.slice(1)} Challenge</Text>
                    {hasVal(record[ct]?.status) && <View style={{ marginBottom: 6 }}><Text style={styles.fieldLabel}>Status</Text><Text style={styles.listItem}>1. {fmtVal(record[ct].status)}</Text></View>}
                  </View>
                  {hasVal(record[ct]?.indication) && (
                    <View style={{ marginBottom: 6 }} wrap={sentenceGroupRows(record[ct].indication) + 1 > 8 ? true : false}>
                      <Text style={styles.fieldLabel}>Indication</Text>
                      {renderSentenceGroups(record[ct].indication)}
                    </View>
                  )}
                </View>
              ))}
              {(hasVal(record.supervisedBy) || hasVal(record.threshold)) && (
                <View style={styles.section}>
                  {hasVal(record.supervisedBy) && (
                    <View wrap={false}>
                      <Text style={styles.sectionTitle}>Test Information</Text>
                      <LabeledRows label="Supervised By" rows={splitPeople(record.supervisedBy)} />
                    </View>
                  )}
                  {hasVal(record.threshold) && (
                    <View wrap={false}>
                      {!hasVal(record.supervisedBy) && <Text style={styles.sectionTitle}>Test Information</Text>}
                      <View style={{ marginBottom: 6 }}><Text style={styles.fieldLabel}>Threshold</Text><Text style={styles.listItem}>1. {fmtVal(record.threshold)}</Text></View>
                    </View>
                  )}
                </View>
              )}
              {hasVal(record.protocol) && (
                <View style={styles.section}>
                  <View wrap={sentenceGroupRows(record.protocol) + 1 > 8 ? true : false}>
                    <Text style={styles.sectionTitle}>Protocol</Text>
                    {renderSentenceGroups(record.protocol)}
                  </View>
                </View>
              )}
              {safeArr(record.reactions).length > 0 && (
                <View style={styles.section}>
                  <View wrap={safeArr(record.reactions).length + 1 > 8 ? true : false}>
                    <Text style={styles.sectionTitle}>Reactions</Text>
                    {safeArr(record.reactions).map((it, i) => <Text key={i} style={styles.listItem}>{i + 1}. {it}</Text>)}
                  </View>
                </View>
              )}
              {hasVal(record.outcome) && (
                <View style={styles.section}>
                  <View wrap={sentenceGroupRows(record.outcome) + 1 > 8 ? true : false}>
                    <Text style={styles.sectionTitle}>Outcome</Text>
                    {renderSentenceGroups(record.outcome)}
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

export default ChallengeTestsPDFTemplate;
