/**
 * CytologyReportsDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — parseLabel + comma-split
 * Collection: cytology_reports
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, borderBottomWidth: 2, borderBottomColor: '#000000', paddingBottom: 12 },
  title: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: '#000000' },
  recordContainer: { paddingBottom: 16 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  fieldValue: { fontSize: 14, lineHeight: 1.5, color: '#000000', paddingLeft: 8 },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
});

/* ═══ UTILS ═══ */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/\u00b5m/g, 'um').replace(/\u03bcm/g, 'um').replace(/\u00b0/g, ' deg')
    .replace(/\u00b1/g, '+/-').replace(/\u2265/g, '>=').replace(/\u2264/g, '<=')
    .replace(/\u2192/g, '->').replace(/\u201c/g, '"').replace(/\u201d/g, '"')
    .replace(/\u2018/g, "'").replace(/\u2019/g, "'").replace(/\u2014/g, '-').replace(/\u2013/g, '-');
  return str;
};

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };

const formatDatePDF = (d) => {
  if (!d) return '';
  try {
    const dt = new Date(d.$date || d);
    return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(d); }
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"%>+-]{1,80}?):\s+([\s\S]+)$/);
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

const FIELD_LABELS = {
  date: 'Date',
  pathologist: 'Pathologist',
  specimenType: 'Specimen Type',
  bethesdaCategory: 'Bethesda Category',
  adequacy: 'Adequacy',
  cellularity: 'Cellularity',
  cytologicFindings: 'Cytologic Findings',
  diagnosis: 'Diagnosis',
};

/* renderFieldRow: label + a single numbered value */
const renderFieldRow = (label, value) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.listItem}>1. {safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* renderSentenceSection: parseLabel + comma-split (>=3) for text fields; single-name hides the field label */
const renderSentenceSection = (title, text, sectionTitle) => {
  if (!hasVal(text)) return null;
  const sentences = splitBySentence(fmtVal(text));
  if (sentences.length === 0) return null;
  const showFieldLabel = (title || '').trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();

  const rows = [];
  let n = 1;
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      rows.push({ type: 'subtitle', text: safeString(parsed.label) });
      const commaItems = splitByComma(parsed.value);
      if (commaItems.length >= 3) commaItems.forEach((ci, i) => { rows.push({ type: 'item', text: safeString(ci), num: i + 1 }); });
      else rows.push({ type: 'item', text: safeString(parsed.value), num: 1 });
    } else {
      rows.push({ type: 'item', text: safeString(s), num: n++ });
    }
  });

  return (
    <View style={styles.fieldBox} wrap={rows.length > 8}>
      {sectionTitle && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
      {showFieldLabel && <Text style={styles.fieldLabel}>{title}</Text>}
      {rows.map((row, i) => row.type === 'subtitle'
        ? <Text key={i} style={styles.nestedSubtitle}>{row.text}</Text>
        : <Text key={i} style={styles.listItem}>{row.num}. {row.text}</Text>)}
    </View>
  );
};

/* ═══ COMPONENT ═══ */
const CytologyReportsDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.cytology_reports) return Array.isArray(r.cytology_reports) ? r.cytology_reports : [r.cytology_reports];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.cytology_reports) return Array.isArray(dd.cytology_reports) ? dd.cytology_reports : [dd.cytology_reports]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.title}>Cytology Reports</Text></View>
          <Text style={styles.emptyState}>No records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Cytology Reports</Text></View>

        {records.map((record, idx) => {
          /* Section 1: Report Info fields */
          const reportInfoFields = [
            record.date ? ['Date', formatDatePDF(record.date)] : null,
            record.pathologist ? ['Pathologist', safeString(record.pathologist)] : null,
            record.specimenType ? ['Specimen Type', safeString(record.specimenType)] : null,
            record.bethesdaCategory ? ['Bethesda Category', safeString(record.bethesdaCategory)] : null,
          ].filter(Boolean);

          /* Section 2: Specimen Analysis — sentence fields + simple */
          const hasCellularity = hasVal(record.cellularity);
          const hasAdequacy = hasVal(record.adequacy);

          /* Section 3: Findings */
          const hasFindings = hasVal(record.cytologicFindings);

          /* Section 4: Diagnosis */
          const hasDiagnosis = hasVal(record.diagnosis);

          return (
            <View key={idx} style={styles.recordContainer} break={idx > 0}>
              {/* Record Header */}
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>{`Cytology Report ${idx + 1}`}</Text>
              </View>

              {/* Section 1: Report Info */}
              {reportInfoFields.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.fieldBox} wrap={reportInfoFields.length > 8}>
                    <Text style={styles.sectionTitle}>Report Info</Text>
                    {reportInfoFields.map(([label, val], i) => (
                      <View key={i}>
                        <Text style={styles.fieldLabel}>{label}</Text>
                        <Text style={styles.listItem}>1. {val}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Section 2: Specimen Analysis */}
              {(hasAdequacy || hasCellularity) && (() => {
                const adequacySentences = hasAdequacy ? splitBySentence(fmtVal(record.adequacy)) : [];
                const totalItems = adequacySentences.length + (hasCellularity ? 1 : 0);
                const rows = []; let n = 1;
                adequacySentences.forEach(s => {
                  const parsed = parseLabel(s);
                  if (parsed.isLabeled) {
                    rows.push({ type: 'subtitle', text: safeString(parsed.label) });
                    const commaItems = splitByComma(parsed.value);
                    if (commaItems.length >= 3) commaItems.forEach((ci, i) => rows.push({ type: 'item', text: safeString(ci), num: i + 1 }));
                    else rows.push({ type: 'item', text: safeString(parsed.value), num: 1 });
                  } else { rows.push({ type: 'item', text: safeString(s), num: n++ }); }
                });
                return (
                  <View style={styles.section}>
                    <View style={styles.fieldBox} wrap={totalItems > 8}>
                      <Text style={styles.sectionTitle}>Specimen Analysis</Text>
                      {hasAdequacy && (
                        <View>
                          <Text style={styles.fieldLabel}>Adequacy</Text>
                          {rows.map((row, ri) => row.type === 'subtitle'
                            ? <Text key={ri} style={styles.nestedSubtitle}>{row.text}</Text>
                            : <Text key={ri} style={styles.listItem}>{row.num}. {row.text}</Text>)}
                        </View>
                      )}
                      {hasCellularity && renderFieldRow('Cellularity', record.cellularity)}
                    </View>
                  </View>
                );
              })()}

              {/* Section 3: Findings */}
              {hasFindings && (
                <View style={styles.section}>
                  {renderSentenceSection('Cytologic Findings', record.cytologicFindings, 'Findings')}
                </View>
              )}

              {/* Section 4: Diagnosis */}
              {hasDiagnosis && (
                <View style={styles.section}>
                  {renderSentenceSection('Diagnosis', record.diagnosis, 'Diagnosis')}
                </View>
              )}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default CytologyReportsDocumentPDFTemplate;
