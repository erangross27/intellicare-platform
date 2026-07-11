/**
 * ConsultationNotesDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — parseLabel + comma-split
 * Collection: consultation_notes
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 15, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, borderBottomWidth: 3, borderBottomColor: '#000000', paddingBottom: 14 },
  title: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 2 },
  recordContainer: { marginBottom: 28, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#cccccc' },
  recordHeader: { marginBottom: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold' },
  recordMeta: { fontSize: 13, color: '#333333', marginTop: 4 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 3 },
  fieldBox: { marginBottom: 8 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 14, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 14, lineHeight: 1.5, marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 16, color: '#666666' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, fontSize: 11, color: '#666666', borderTopWidth: 1, borderTopColor: '#000000', paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 11, color: '#666666' },
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

const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };

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

const renderFieldRow = (label, value) => {
  if (!hasVal(value)) return null;
  return (
    <View style={{ marginBottom: 4 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{safeString(fmtVal(value))}</Text>
    </View>
  );
};

const ROS_LABELS = {
  constitutional: 'Constitutional', heent: 'HEENT', cardiovascular: 'Cardiovascular',
  respiratory: 'Respiratory', gastrointestinal: 'Gastrointestinal', musculoskeletal: 'Musculoskeletal',
  neurological: 'Neurological', psychiatric: 'Psychiatric', neurologic: 'Neurologic', endocrine: 'Endocrine',
  skin: 'Skin', joint: 'Joint', eyes: 'Eyes', lymphatic: 'Lymphatic', sleep: 'Sleep', cognitive: 'Cognitive',
  genitourinary: 'Genitourinary', hematologic: 'Hematologic', cardiac: 'Cardiac', gi: 'GI', ent: 'ENT', other: 'Other',
};
/* reviewOfSystems is a DYNAMIC-KEY object — derive keys from the record, don't hardcode */
const humanizeKey = (k) => {
  if (ROS_LABELS[k]) return ROS_LABELS[k];
  return String(k)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim() || k;
};

/* renderSentenceSection: parseLabel + comma-split for heavy Label:value fields */
const renderSentenceSection = (title, text) => {
  if (!hasVal(text)) return null;
  const sentences = splitBySentence(fmtVal(text));
  if (sentences.length === 0) return null;

  const rows = [];
  let n = 1;
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const commaItems = splitByComma(parsed.value);
      if (commaItems.length >= 2) {
        rows.push({ type: 'subtitle', text: safeString(parsed.label) });
        commaItems.forEach(ci => { rows.push({ type: 'item', text: safeString(ci), num: n++ }); });
      } else {
        rows.push({ type: 'item', text: safeString(s), num: n++ });
      }
    } else {
      rows.push({ type: 'item', text: safeString(s), num: n++ });
    }
  });

  const wrapProp = rows.length > 8 ? undefined : false;

  return (
    <View style={styles.section}>
      <View style={styles.fieldBox} wrap={wrapProp}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {rows.map((row, i) => {
          if (row.type === 'subtitle') {
            return <Text key={i} style={styles.nestedSubtitle}>{row.text}</Text>;
          }
          return <Text key={i} style={styles.listItem}>{row.num}. {row.text}</Text>;
        })}
      </View>
    </View>
  );
};

/* ═══ COMPONENT ═══ */
const ConsultationNotesDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.consultation_notes) return Array.isArray(r.consultation_notes) ? r.consultation_notes : [r.consultation_notes];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.consultation_notes) return Array.isArray(dd.consultation_notes) ? dd.consultation_notes : [dd.consultation_notes]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.title}>Consultation Notes</Text></View>
          <Text style={styles.emptyState}>No records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Consultation Notes</Text></View>

        {records.map((record, idx) => {
          const rosEntries = record.reviewOfSystems && typeof record.reviewOfSystems === 'object' && !Array.isArray(record.reviewOfSystems)
            ? Object.keys(record.reviewOfSystems).filter(k => hasVal(record.reviewOfSystems[k])).map(k => ({ key: k, label: humanizeKey(k), value: record.reviewOfSystems[k] }))
            : [];
          const recArr = Array.isArray(record.recommendations) ? record.recommendations : [];

          return (
            <View key={idx} style={styles.recordContainer}>
              {/* Record Header */}
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>{`Consultation Notes ${idx + 1}`}</Text>
                {record.date && <Text style={styles.recordMeta}>{formatDate(record.date)}</Text>}
              </View>

              {/* Section 1: Consultation Information */}
              {(hasVal(record.consultingSpecialty) || hasVal(record.consultingProvider) || hasVal(record.reasonForConsultation) || hasVal(record.chiefComplaint)) && (
                <View style={styles.section}>
                  <View style={styles.fieldBox} wrap={false}>
                    <Text style={styles.sectionTitle}>Consultation Information</Text>
                    {renderFieldRow('Consulting Specialty', record.consultingSpecialty)}
                    {renderFieldRow('Consulting Provider', record.consultingProvider)}
                    {hasVal(record.reasonForConsultation) && (
                      <View style={{ marginBottom: 4 }}>
                        <Text style={styles.fieldLabel}>Reason for Consultation</Text>
                        {splitBySentence(fmtVal(record.reasonForConsultation)).map((s, i) => (
                          <Text key={i} style={styles.listItem}>{i + 1}. {safeString(s)}</Text>
                        ))}
                      </View>
                    )}
                    {hasVal(record.chiefComplaint) && (
                      <View style={{ marginBottom: 4 }}>
                        <Text style={styles.fieldLabel}>Chief Complaint</Text>
                        <Text style={styles.fieldValue}>{safeString(fmtVal(record.chiefComplaint))}</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* Section 2: History of Present Illness */}
              {renderSentenceSection('History of Present Illness', record.historyOfPresentIllness)}

              {/* Section 3: Review of Systems — comma-split per sub-field */}
              {rosEntries.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.fieldBox} wrap={rosEntries.length > 6 ? undefined : false}>
                    <Text style={styles.sectionTitle}>Review of Systems</Text>
                    {rosEntries.map((entry, ri) => {
                      const items = splitByComma(fmtVal(entry.value));
                      return (
                        <View key={ri} style={{ marginBottom: 4 }}>
                          <Text style={styles.nestedSubtitle}>{entry.label}</Text>
                          {items.length >= 2
                            ? items.map((item, ci) => <Text key={ci} style={styles.listItem}>{ci + 1}. {safeString(item)}</Text>)
                            : <Text style={styles.fieldValue}>{safeString(fmtVal(entry.value))}</Text>
                          }
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Section 4: Physical Examination — heavy parseLabel + comma-split */}
              {renderSentenceSection('Physical Examination', record.physicalExamination)}

              {/* Section 5: Assessment */}
              {renderSentenceSection('Assessment', record.assessment)}

              {/* Section 5b: Plan */}
              {renderSentenceSection('Plan', record.plan)}

              {/* Section 6: Recommendations */}
              {recArr.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.fieldBox} wrap={recArr.length > 8 ? undefined : false}>
                    <Text style={styles.sectionTitle}>Recommendations</Text>
                    {recArr.map((item, ri) => (
                      <Text key={ri} style={styles.listItem}>{ri + 1}. {safeString(typeof item === 'string' ? item : item?.recommendation || String(item || ''))}</Text>
                    ))}
                  </View>
                </View>
              )}
            </View>
          );
        })}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Protected Health Information (PHI) - Handle according to HIPAA guidelines</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
};

export default ConsultationNotesDocumentPDFTemplate;
