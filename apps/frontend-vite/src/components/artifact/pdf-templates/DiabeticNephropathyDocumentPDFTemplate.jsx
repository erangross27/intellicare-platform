/**
 * DiabeticNephropathyDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — fieldBox marginBottom:10
 * Collection: diabetic_nephropathy
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, borderBottomWidth: 3, borderBottomColor: '#000000', paddingBottom: 14 },
  title: { fontSize: 22, fontFamily: 'Helvetica-Bold', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 2 },
  recordContainer: { marginBottom: 28, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#cccccc' },
  recordHeader: { marginBottom: 16, backgroundColor: '#f5f5f5', padding: 12, borderWidth: 2, borderColor: '#000000', borderLeftWidth: 5, borderLeftColor: '#000000' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 11, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 11, lineHeight: 1.5, marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, fontSize: 10, color: '#666666', borderTopWidth: 1, borderTopColor: '#000000', paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 10, color: '#666666' },
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

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
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

/* Flatten object for PDF */
const flattenObject = (obj) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];
  const items = [];
  Object.entries(obj).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
      if (typeof value === 'boolean') {
        items.push({ label, value: value ? 'Yes' : 'No' });
      } else if (Array.isArray(value)) {
        items.push({ label, value: value.filter(Boolean).join(', ') });
      } else if (typeof value === 'object') {
        Object.entries(value).forEach(([subKey, subValue]) => {
          if (subValue !== null && subValue !== undefined && subValue !== '') {
            const subLabel = `${label} - ${subKey.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}`;
            items.push({ label: subLabel, value: String(subValue) });
          }
        });
      } else {
        items.push({ label, value: String(value) });
      }
    }
  });
  return items;
};

/* renderFieldRow: simple label + value */
const renderFieldRow = (label, value) => {
  if (!hasVal(value)) return null;
  return (
    <View style={{ marginBottom: 4 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* renderSentenceSection: parseLabel + comma-split for text fields */
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
    <View style={styles.fieldBox} wrap={wrapProp}>
      <Text style={styles.fieldLabel}>{title}</Text>
      {rows.map((row, i) => {
        if (row.type === 'subtitle') {
          return <Text key={i} style={styles.nestedSubtitle}>{row.text}</Text>;
        }
        return <Text key={i} style={styles.listItem}>{row.num}. {row.text}</Text>;
      })}
    </View>
  );
};

/* ═══ COMPONENT ═══ */
const DiabeticNephropathyDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.diabetic_nephropathy) return Array.isArray(r.diabetic_nephropathy) ? r.diabetic_nephropathy : [r.diabetic_nephropathy];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.diabetic_nephropathy) return Array.isArray(dd.diabetic_nephropathy) ? dd.diabetic_nephropathy : [dd.diabetic_nephropathy]; return [dd]; }
      if (r?.records) return Array.isArray(r.records) ? r.records : [r.records];
      if (r?._records) return Array.isArray(r._records) ? r._records : [r._records];
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.title}>Diabetic Nephropathy</Text></View>
          <Text style={styles.emptyState}>No records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Diabetic Nephropathy</Text></View>

        {records.map((record, idx) => {
          /* Record Information fields */
          const infoFields = [
            ['Date', record.date],
            ['Provider', record.provider],
            ['Facility', record.facility],
            ['Status', record.status],
          ].filter(([, v]) => hasVal(v));

          /* Disease Status fields */
          const hasAlbuminuria = hasVal(record.albuminuriaStage);
          const hasRetinopathy = record.retinopathy !== undefined && record.retinopathy !== null;
          const hasNeuropathy = record.neuropathy !== undefined && record.neuropathy !== null;
          const hasDiseaseStatus = hasAlbuminuria || hasRetinopathy || hasNeuropathy;

          /* Glycemic Control fields */
          const gc = record.glycemicControl || {};
          const hasGC = hasVal(gc.hba1c) || hasVal(gc.target);

          /* RAAS Blockade fields */
          const rb = record.raasBlockade || {};
          const hasRAAS = hasVal(rb.agent) || hasVal(rb.dose) || hasVal(rb.potassiumMonitoring);

          /* SGLT2 Inhibitor */
          const sglt2Items = flattenObject(record.sglt2Inhibitor);

          /* Results */
          const resultItems = flattenObject(record.results);

          /* Recommendations */
          const hasRecs = Array.isArray(record.recommendations) && record.recommendations.length > 0;

          return (
            <View key={idx} style={styles.recordContainer}>
              {/* Record Header */}
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>{`Diabetic Nephropathy ${idx + 1}`}</Text>
              </View>

              {/* Record Information */}
              {infoFields.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.fieldBox} wrap={infoFields.length > 8 ? undefined : false}>
                    <Text style={styles.sectionTitle}>Record Information</Text>
                    {infoFields.map(([label, val], i) => (
                      <View key={i} style={{ marginBottom: 4 }}>
                        <Text style={styles.fieldLabel}>{label}</Text>
                        <Text style={styles.fieldValue}>{label === 'Date' ? formatDate(val) : safeString(fmtVal(val))}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Disease Status */}
              {hasDiseaseStatus && (
                <View style={styles.section}>
                  <View style={styles.fieldBox} wrap={false}>
                    <Text style={styles.sectionTitle}>Disease Status</Text>
                    {hasAlbuminuria && renderFieldRow('Albuminuria Stage', record.albuminuriaStage)}
                    {hasRetinopathy && renderFieldRow('Retinopathy', record.retinopathy)}
                    {hasNeuropathy && renderFieldRow('Neuropathy', record.neuropathy)}
                  </View>
                </View>
              )}

              {/* Glycemic Control */}
              {hasGC && (
                <View style={styles.section}>
                  <View style={styles.fieldBox} wrap={false}>
                    <Text style={styles.sectionTitle}>Glycemic Control</Text>
                    {hasVal(gc.hba1c) && renderFieldRow('HbA1c', gc.hba1c)}
                    {hasVal(gc.target) && renderFieldRow('Target', gc.target)}
                  </View>
                </View>
              )}

              {/* RAAS Blockade */}
              {hasRAAS && (
                <View style={styles.section}>
                  <View style={styles.fieldBox} wrap={false}>
                    <Text style={styles.sectionTitle}>RAAS Blockade</Text>
                    {hasVal(rb.agent) && renderFieldRow('Agent', rb.agent)}
                    {hasVal(rb.dose) && renderFieldRow('Dose', rb.dose)}
                    {hasVal(rb.potassiumMonitoring) && renderFieldRow('Potassium Monitoring', rb.potassiumMonitoring)}
                  </View>
                </View>
              )}

              {/* SGLT2 Inhibitor */}
              {sglt2Items.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.fieldBox} wrap={sglt2Items.length > 8 ? undefined : false}>
                    <Text style={styles.sectionTitle}>SGLT2 Inhibitor</Text>
                    {sglt2Items.map((item, i) => (
                      <View key={i} style={{ marginBottom: 4 }}>
                        <Text style={styles.fieldLabel}>{item.label}</Text>
                        <Text style={styles.fieldValue}>{safeString(item.value)}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Findings */}
              {hasVal(record.findings) && (
                <View style={styles.section}>
                  {renderSentenceSection('Findings', record.findings)}
                </View>
              )}

              {/* Assessment */}
              {hasVal(record.assessment) && (
                <View style={styles.section}>
                  {renderSentenceSection('Assessment', record.assessment)}
                </View>
              )}

              {/* Plan */}
              {hasVal(record.plan) && (
                <View style={styles.section}>
                  {renderSentenceSection('Plan', record.plan)}
                </View>
              )}

              {/* Recommendations */}
              {hasRecs && (
                <View style={styles.section}>
                  <View style={styles.fieldBox} wrap={record.recommendations.length > 8 ? undefined : false}>
                    <Text style={styles.sectionTitle}>Recommendations</Text>
                    {record.recommendations.map((rec, rIdx) => {
                      const recText = typeof rec === 'string' ? rec : (rec?.recommendation || '');
                      const dateText = typeof rec === 'object' && rec?.date ? ` (${formatDate(rec.date)})` : '';
                      return (
                        <Text key={rIdx} style={styles.listItem}>{rIdx + 1}. {safeString(recText)}{dateText}</Text>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Results */}
              {resultItems.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.fieldBox} wrap={resultItems.length > 8 ? undefined : false}>
                    <Text style={styles.sectionTitle}>Results</Text>
                    {resultItems.map((item, i) => (
                      <View key={i} style={{ marginBottom: 4 }}>
                        <Text style={styles.fieldLabel}>{item.label}</Text>
                        <Text style={styles.fieldValue}>{safeString(item.value)}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Notes */}
              {hasVal(record.notes) && (
                <View style={styles.section}>
                  {renderSentenceSection('Notes', record.notes)}
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

export default DiabeticNephropathyDocumentPDFTemplate;
