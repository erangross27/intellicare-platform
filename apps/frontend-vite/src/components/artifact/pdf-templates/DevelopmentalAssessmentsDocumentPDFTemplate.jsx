/**
 * DevelopmentalAssessmentsDocumentPDFTemplate.jsx
 * July 2026 — Helvetica — LETTER — BLACK & WHITE only (#000000 titles/values, #999999 label rules).
 * Collection: developmental_assessments.
 *
 * BOX-FREE canonical: page 14 / title 26 / recordTitle 19 / sectionTitle 16 + 1pt black rule /
 * fieldLabel & subLabel 13 + 0.5pt #999 rule / values 14.
 * Rule #74: wrap is BOOLEAN only; sectionTitle rides INSIDE the section's first field View.
 * Every value row numbered ("1." even singles). Findings mirror the JSX exactly:
 * period-sentences → parseLabel → value split semicolon-first (>=2) else comma (>=3) —
 * labeled groups restart numbering, unlabeled rows continue the running count.
 * (Replaces the old hardcoded label-pattern parser that LOST unknown groups like "Concerns:".)
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
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
});

/* ═══ UTILS ═══ */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/µm/g, 'um').replace(/μm/g, 'um').replace(/°/g, ' deg')
    .replace(/±/g, '+/-').replace(/≥/g, '>=').replace(/≤/g, '<=')
    .replace(/→/g, '->').replace(/“/g, '"').replace(/”/g, '"')
    .replace(/‘/g, "'").replace(/’/g, "'").replace(/—/g, '-').replace(/–/g, '-');
  return str;
};

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'string') return v.trim() !== ''; return true; };

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try {
    const date = new Date(dateValue.$date || dateValue);
    if (isNaN(date.getTime())) return String(dateValue);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(dateValue); }
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

const splitBySemicolon = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/;\s*/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

/* mirrors the JSX splitLabeledValue: semicolon-first (>=2) else comma (>=3) else whole */
const splitLabeledValue = (value) => {
  const semi = splitBySemicolon(value);
  if (semi.length >= 2) return { items: semi };
  const comma = splitByComma(value);
  if (comma.length >= 3) return { items: comma };
  return { items: [value] };
};

/* findings → typed lines: labeled groups restart numbering; unlabeled rows run on */
const findingsLines = (text) => {
  const sentences = splitBySentence(text);
  const lines = []; let running = 1;
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    const value = (parsed.isLabeled ? parsed.value : s).replace(/[;.]+$/, '').trim();
    if (!value) return;
    if (parsed.isLabeled) {
      const { items } = splitLabeledValue(value);
      lines.push({ sub: true, text: parsed.label });
      if (items.length >= 2) items.forEach((item, i) => lines.push({ sub: false, text: `${i + 1}. ${item}` }));
      else lines.push({ sub: false, text: `1. ${value}` });
    } else {
      lines.push({ sub: false, text: `${running++}. ${value}` });
    }
  });
  return lines;
};

const semicolonLines = (text) => {
  const parts = splitBySemicolon(text);
  if (parts.length === 0) return [`1. ${text}`];
  return parts.map((p, i) => `${i + 1}. ${p}`);
};

/* ═══ COMPONENT ═══ */
const DevelopmentalAssessmentsDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.developmental_assessments) return Array.isArray(r.developmental_assessments) ? r.developmental_assessments : [r.developmental_assessments];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.developmental_assessments) return Array.isArray(dd.developmental_assessments) ? dd.developmental_assessments : [dd.developmental_assessments]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.title}>Developmental Assessments</Text></View>
          <Text style={styles.emptyState}>No records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Developmental Assessments</Text></View>

        {records.map((record, idx) => {
          const fLines = hasVal(record.findings) ? findingsLines(record.findings) : [];
          const semiFields = [
            ['Goals & Progress', [
              ['Goals', record.goals],
              ['Progress', record.progress],
            ]],
            ['Recommendations & Follow-Up', [
              ['Recommendations', record.recommendations],
              ['Follow-Up', record.followUp],
            ]],
          ];

          return (
            <View key={idx} style={styles.recordContainer} break={idx > 0}>
              {/* Record Header */}
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>{`Developmental Assessment ${idx + 1}`}</Text>
              </View>

              {/* Assessment Information */}
              {(hasVal(record.assessmentDate) || hasVal(record.programType)) && (
                <View style={styles.section}>
                  <View style={styles.fieldGroup} wrap={false}>
                    <Text style={styles.sectionTitle}>Assessment Information</Text>
                    {hasVal(record.assessmentDate) && (
                      <View>
                        <Text style={styles.fieldLabel}>Assessment Date</Text>
                        <Text style={styles.listItem}>{`1. ${safeString(formatDate(record.assessmentDate))}`}</Text>
                      </View>
                    )}
                    {hasVal(record.programType) && (
                      <View>
                        <Text style={styles.fieldLabel}>Program Type</Text>
                        <Text style={styles.listItem}>{`1. ${safeString(record.programType)}`}</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* Developmental Findings */}
              {fLines.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.fieldGroup} wrap={fLines.length > 8 ? true : false}>
                    <Text style={styles.sectionTitle}>Developmental Findings</Text>
                    {fLines.map((l, i) => (
                      <Text key={i} style={l.sub ? styles.subLabel : styles.listItem}>{safeString(l.text)}</Text>
                    ))}
                  </View>
                </View>
              )}

              {/* Goals & Progress / Recommendations & Follow-Up */}
              {semiFields.map(([sectionTitle, fields], si) => {
                const present = fields.filter(([, v]) => hasVal(v));
                if (present.length === 0) return null;
                const rowCount = present.reduce((n, [, v]) => n + semicolonLines(String(v)).length + 1, 0);
                return (
                  <View key={si} style={styles.section}>
                    <View style={styles.fieldGroup} wrap={rowCount > 8 ? true : false}>
                      <Text style={styles.sectionTitle}>{sectionTitle}</Text>
                      {present.map(([label, v]) => (
                        <View key={label}>
                          <Text style={styles.fieldLabel}>{label}</Text>
                          {semicolonLines(String(v)).map((line, i) => (
                            <Text key={i} style={styles.listItem}>{safeString(line)}</Text>
                          ))}
                        </View>
                      ))}
                    </View>
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

export default DevelopmentalAssessmentsDocumentPDFTemplate;
