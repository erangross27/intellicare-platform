/**
 * SclerodermaAssessmentDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — scleroderma assessment
 * Collection: scleroderma_assessment
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
  recordStatus: { fontSize: 10, color: '#666666', fontFamily: 'Helvetica-Bold' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1f2937' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#606060', marginBottom: 8 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 11, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#d1d5db', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 12, color: '#6b7280', textAlign: 'center', marginTop: 40 },
  providerSection: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#000000' },
  providerGrid: { flexDirection: 'row', gap: 20 },
  providerItem: { flex: 1 },
  providerLabel: { fontSize: 9, color: '#333333', fontFamily: 'Helvetica-Bold', marginBottom: 2, textTransform: 'uppercase' },
  providerValue: { fontSize: 11, color: '#000000' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, textAlign: 'center', fontSize: 8, color: '#999999', borderTopWidth: 1, borderTopColor: '#cccccc', paddingTop: 6 },
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

const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};

const hasVal = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number') return true;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return !isEmptyDeep(v);
  return true;
};

const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };

const KEY_OVERRIDES = {
  dlco: 'DLCO', fvc: 'FVC', ef: 'EF', rvsp: 'RVSP', pah: 'PAH', ild: 'ILD',
  bp: 'BP', gerd: 'GERD', hrct: 'HRCT', mrss: 'mRSS', scl70: 'Scl-70', ana: 'ANA',
  gi: 'GI', pft: 'PFT', pfts: 'PFTs',
};
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const low = String(key).toLowerCase();
  if (KEY_OVERRIDES[low]) return KEY_OVERRIDES[low];
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/* recursive dynamic-key object node: label = bold heading; scalar/array/nested handled.
   Content-gated so empty {} renders nothing. No "[object Object]". */
const renderObjectNode = (label, value, keyPath, depth) => {
  if (isEmptyDeep(value)) return null;
  const LabelTag = depth > 0 ? styles.nestedSubtitle : styles.fieldLabel;
  if (isScalar(value)) {
    return (
      <View key={keyPath} style={styles.fieldBox}>
        {label ? <Text style={LabelTag}>{label}</Text> : null}
        <Text style={styles.fieldValue}>{fmtScalar(value)}</Text>
      </View>
    );
  }
  if (Array.isArray(value)) {
    const items = value.filter(x => !isEmptyDeep(x));
    if (items.length === 0) return null;
    return (
      <View key={keyPath}>
        {label ? <Text style={LabelTag}>{label}</Text> : null}
        {items.map((it, i) => isScalar(it)
          ? <Text key={i} style={styles.listItem}>{i + 1}. {fmtScalar(it)}</Text>
          : <View key={i}>{Object.entries(it).filter(([, v]) => !isEmptyDeep(v)).map(([k, v]) => renderObjectNode(humanizeKey(k), v, `${keyPath}-${i}-${k}`, depth + 1))}</View>
        )}
      </View>
    );
  }
  const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  return (
    <View key={keyPath}>
      {label ? <Text style={LabelTag}>{label}</Text> : null}
      {entries.map(([k, v]) => renderObjectNode(humanizeKey(k), v, `${keyPath}-${k}`, depth + 1))}
    </View>
  );
};

/* parseLabel: detect "Label: value" patterns */
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
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

/* ======= RENDER HELPERS ======= */
const renderFieldBox = (label, value) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{safeString(value)}</Text>
    </View>
  );
};

const renderStringFieldPDF = (label, value) => {
  if (!hasVal(value)) return null;
  const strVal = safeString(value);
  const sentences = splitBySentence(strVal);

  if (sentences.length <= 1) {
    return renderFieldBox(label, value);
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
                <Text style={styles.nestedSubtitle}>{parsed.label}:</Text>
                {commaItems.map((ci, ciIdx) => (
                  <Text key={ciIdx} style={styles.listItem}>{ciIdx + 1}. {ci}</Text>
                ))}
              </View>
            );
          }
          return (
            <View key={sIdx}>
              <Text style={styles.nestedSubtitle}>{parsed.label}:</Text>
              <Text style={styles.listItem}>{parsed.value}</Text>
            </View>
          );
        }
        return <Text key={sIdx} style={styles.listItem}>{sIdx + 1}. {sentence}</Text>;
      })}
    </View>
  );
};

/* ======= COMPONENT ======= */
const SclerodermaAssessmentDocumentPDFTemplate = ({ document: docProp }) => {
  const records = (() => {
    if (!docProp) return [];
    if (Array.isArray(docProp)) return docProp;
    if (docProp?.scleroderma_assessment) return Array.isArray(docProp.scleroderma_assessment) ? docProp.scleroderma_assessment : [docProp.scleroderma_assessment];
    if (docProp?.documentData) {
      const dd = docProp.documentData;
      if (Array.isArray(dd)) return dd;
      if (dd?.scleroderma_assessment) return Array.isArray(dd.scleroderma_assessment) ? dd.scleroderma_assessment : [dd.scleroderma_assessment];
      return [dd];
    }
    if (typeof docProp === 'object') return [docProp];
    return [];
  })();

  const hasRecords = records && records.length > 0 && records.some(r => r && Object.keys(r).length > 0);

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Document Header */}
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Scleroderma Assessment Report</Text>
        </View>

        {!hasRecords ? (
          <Text style={styles.noDataText}>No scleroderma assessment records available</Text>
        ) : (
          records.map((record, idx) => (
            <View key={idx} style={styles.recordContainer}>
              {/* Record Header */}
              <View style={styles.recordHeader}>
                <View style={styles.recordDateRow}>
                  {record.date && <Text style={styles.recordDate}>{formatDate(record.date)}</Text>}
                  {record.status && <Text style={styles.recordStatus}>{record.status}</Text>}
                </View>
                <Text style={styles.recordTitle}>{record.type || `Scleroderma Assessment ${idx + 1}`}</Text>
              </View>

              {/* Classification */}
              {hasVal(record.type) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Classification</Text>
                  {renderFieldBox('Type', record.type)}
                </View>
              )}

              {/* Skin Thickness */}
              {record.skinThickness && (hasVal(record.skinThickness.mrodnanScore) || hasVal(record.skinThickness.distribution)) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Skin Thickness</Text>
                  {renderFieldBox('Modified Rodnan Score', record.skinThickness.mrodnanScore)}
                  {renderStringFieldPDF('Distribution', record.skinThickness.distribution)}
                </View>
              )}

              {/* Raynaud's Phenomenon */}
              {record.raynaudsPhenomenon && (hasVal(record.raynaudsPhenomenon.severity) || record.raynaudsPhenomenon.digitalUlcers !== undefined || hasVal(record.raynaudsPhenomenon.nailfoldCapillaroscopy)) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Raynaud's Phenomenon</Text>
                  {renderStringFieldPDF('Severity', record.raynaudsPhenomenon.severity)}
                  {record.raynaudsPhenomenon.digitalUlcers !== undefined && record.raynaudsPhenomenon.digitalUlcers !== null && renderFieldBox('Digital Ulcers', record.raynaudsPhenomenon.digitalUlcers)}
                  {renderStringFieldPDF('Nailfold Capillaroscopy', record.raynaudsPhenomenon.nailfoldCapillaroscopy)}
                </View>
              )}

              {/* Internal Organ Involvement */}
              {record.internalOrganInvolvement && (hasVal(record.internalOrganInvolvement.pulmonary) || hasVal(record.internalOrganInvolvement.cardiac) || hasVal(record.internalOrganInvolvement.renal) || hasVal(record.internalOrganInvolvement.gastrointestinal)) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Internal Organ Involvement</Text>
                  {renderStringFieldPDF('Pulmonary', record.internalOrganInvolvement.pulmonary)}
                  {renderStringFieldPDF('Cardiac', record.internalOrganInvolvement.cardiac)}
                  {renderStringFieldPDF('Renal', record.internalOrganInvolvement.renal)}
                  {renderStringFieldPDF('Gastrointestinal', record.internalOrganInvolvement.gastrointestinal)}
                </View>
              )}

              {/* Findings */}
              {hasVal(record.findings) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Findings</Text>
                  {renderStringFieldPDF('Findings', record.findings)}
                </View>
              )}

              {/* Assessment */}
              {hasVal(record.assessment) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Assessment</Text>
                  {renderStringFieldPDF('Assessment', record.assessment)}
                </View>
              )}

              {/* Plan */}
              {hasVal(record.plan) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Plan</Text>
                  {renderStringFieldPDF('Plan', record.plan)}
                </View>
              )}

              {/* Recommendations */}
              {Array.isArray(record.recommendations) && record.recommendations.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Recommendations</Text>
                  <View style={styles.fieldBox}>
                    {record.recommendations.map((rec, rIdx) => {
                      const txt = typeof rec === 'string' ? rec : rec?.recommendation || rec?.text || JSON.stringify(rec);
                      return <Text key={rIdx} style={styles.listItem}>{rIdx + 1}. {txt}</Text>;
                    })}
                  </View>
                </View>
              )}

              {/* Results — dynamic-key object (content-gated, humanized keys, typed leaves) */}
              {record.results && typeof record.results === 'object' && !Array.isArray(record.results) && hasVal(record.results) && (() => {
                const entries = Object.entries(record.results).filter(([, v]) => !isEmptyDeep(v));
                if (entries.length === 0) return null;
                return (
                  <View style={styles.section} wrap={entries.length > 8 ? undefined : false}>
                    <Text style={styles.sectionTitle}>Results</Text>
                    {entries.map(([k, v]) => renderObjectNode(humanizeKey(k), v, `results-${k}`, 1))}
                  </View>
                );
              })()}

              {/* Notes */}
              {hasVal(record.notes) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Notes</Text>
                  {renderStringFieldPDF('Notes', record.notes)}
                </View>
              )}

              {/* Provider Information */}
              {(hasVal(record.provider) || hasVal(record.facility)) && (
                <View style={styles.providerSection} wrap={false}>
                  <Text style={styles.sectionTitle}>Provider Information</Text>
                  <View style={styles.providerGrid}>
                    {hasVal(record.provider) && (
                      <View style={styles.providerItem}>
                        <Text style={styles.providerLabel}>Provider</Text>
                        <Text style={styles.providerValue}>{record.provider}</Text>
                      </View>
                    )}
                    {hasVal(record.facility) && (
                      <View style={styles.providerItem}>
                        <Text style={styles.providerLabel}>Facility</Text>
                        <Text style={styles.providerValue}>{record.facility}</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {idx < records.length - 1 && <View style={styles.separator} />}
            </View>
          ))
        )}

        {/* Footer */}
        <Text style={styles.footer}>Confidential Medical Document</Text>
      </Page>
    </Document>
  );
};

export default SclerodermaAssessmentDocumentPDFTemplate;
