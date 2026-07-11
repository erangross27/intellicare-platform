/**
 * SjogrensSyndromeAssessmentDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — sjogrens syndrome assessment
 * Collection: sjogrens_syndrome_assessment
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

/* parseLabel */
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

/* splitBySentence */
const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

/* splitByComma */
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

const safeArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
};

/* KEY_OVERRIDES + humanizeKey: dynamic-key object (results.*) -> readable label */
const KEY_OVERRIDES = {
  antiRo: 'Anti-Ro/SSA', antiSSA: 'Anti-Ro/SSA', antiLa: 'Anti-La/SSB', antiSSB: 'Anti-La/SSB',
  ana: 'ANA', rf: 'Rheumatoid Factor', ssa: 'Anti-Ro/SSA', ssb: 'Anti-La/SSB',
  igg: 'IgG', esr: 'ESR', crp: 'CRP', c3: 'C3', c4: 'C4', focusScore: 'Focus Score',
};
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];
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
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const isScalar = (v) => v === null || typeof v !== 'object';

/* renderObjectNode: recursive flatten of dynamic-key object into PDF rows (no [object Object]) */
const renderObjectNode = (label, value, keyPrefix, depth) => {
  if (isEmptyDeep(value)) return null;
  if (isScalar(value)) {
    return (
      <View key={keyPrefix} style={depth > 0 ? { paddingLeft: 8 } : undefined}>
        <Text style={styles.listItem}>{label}: {fmtScalar(value)}</Text>
      </View>
    );
  }
  if (Array.isArray(value)) {
    const items = value.filter(v => !isEmptyDeep(v));
    if (items.length === 0) return null;
    if (items.every(isScalar)) {
      return (
        <View key={keyPrefix} style={depth > 0 ? { paddingLeft: 8 } : undefined}>
          <Text style={styles.listItem}>{label}: {items.map(fmtScalar).join(', ')}</Text>
        </View>
      );
    }
    return (
      <View key={keyPrefix} style={depth > 0 ? { paddingLeft: 8 } : undefined}>
        <Text style={styles.nestedSubtitle}>{label}:</Text>
        {items.map((v, i) => renderObjectNode(`${humanizeKey(label)} ${i + 1}`, v, `${keyPrefix}-${i}`, depth + 1))}
      </View>
    );
  }
  const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  return (
    <View key={keyPrefix} style={depth > 0 ? { paddingLeft: 8 } : undefined}>
      {label && <Text style={styles.nestedSubtitle}>{label}:</Text>}
      {entries.map(([k, v]) => renderObjectNode(humanizeKey(k), v, `${keyPrefix}-${k}`, depth + 1))}
    </View>
  );
};

const renderObjectField = (label, value) => {
  if (isEmptyDeep(value) || isScalar(value)) return null;
  const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {entries.map(([k, v]) => renderObjectNode(humanizeKey(k), v, `${label}-${k}`, 0))}
    </View>
  );
};

/* Sicca label mappings */
const SICCA_LABELS = {
  dryEyes: 'Dry Eyes',
  dryMouth: 'Dry Mouth',
  schirmerTest: 'Schirmer Test',
  saxonTest: 'Saxon Test',
};

/* ======= RENDER HELPERS ======= */
const renderStringField = (label, val) => {
  if (!hasVal(val)) return null;
  const strVal = safeString(val);
  const sentences = splitBySentence(strVal);

  if (sentences.length > 1) {
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
                <Text style={styles.listItem}>{sIdx + 1}. {parsed.value}</Text>
              </View>
            );
          }
          return <Text key={sIdx} style={styles.listItem}>{sIdx + 1}. {sentence}</Text>;
        })}
      </View>
    );
  }

  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{strVal}</Text>
    </View>
  );
};

const renderArrayField = (label, items) => {
  const safeItems = safeArray(items).map(r =>
    typeof r === 'object' ? (r.recommendation || r.text || JSON.stringify(r)) : String(r)
  ).filter(Boolean);
  if (safeItems.length === 0) return null;

  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {safeItems.map((item, idx) => (
        <Text key={idx} style={styles.listItem}>{idx + 1}. {item}</Text>
      ))}
    </View>
  );
};

/* ======= MAIN COMPONENT ======= */
const SjogrensSyndromeAssessmentDocumentPDFTemplate = ({ document }) => {
  const records = (() => {
    if (!document) return [];
    if (Array.isArray(document)) return document;
    if (document?.sjogrens_syndrome_assessment) return Array.isArray(document.sjogrens_syndrome_assessment) ? document.sjogrens_syndrome_assessment : [document.sjogrens_syndrome_assessment];
    if (document?.documentData) {
      const dd = document.documentData;
      if (Array.isArray(dd)) return dd;
      if (dd?.sjogrens_syndrome_assessment) return Array.isArray(dd.sjogrens_syndrome_assessment) ? dd.sjogrens_syndrome_assessment : [dd.sjogrens_syndrome_assessment];
      return [dd];
    }
    if (typeof document === 'object') return [document];
    return [];
  })();

  const hasRecords = records && records.length > 0 && records.some(r => r && Object.keys(r).length > 0);

  const getSiccaFields = (record) => {
    if (!record.sicca || typeof record.sicca !== 'object') return [];
    return Object.entries(SICCA_LABELS)
      .filter(([key]) => record.sicca[key])
      .map(([key, label]) => [label, record.sicca[key]]);
  };

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Document Header */}
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Sjogrens Syndrome Assessment Report</Text>
        </View>

        {!hasRecords ? (
          <Text style={styles.noDataText}>No sjogrens syndrome assessment records available</Text>
        ) : (
          records.map((record, idx) => (
            <View key={idx} style={styles.recordContainer}>
              {/* Record Header */}
              <View style={styles.recordHeader} wrap={false}>
                <View style={styles.recordDateRow}>
                  <Text style={styles.recordTitle}>Record #{idx + 1}</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {record.date && <Text style={styles.recordDate}>{formatDate(record.date)}</Text>}
                    {record.status && <Text style={styles.recordStatus}>{record.status}</Text>}
                  </View>
                </View>
              </View>

              {/* Sicca Symptoms */}
              {getSiccaFields(record).length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Sicca Symptoms</Text>
                  {getSiccaFields(record).map(([label, val], fIdx) => (
                    <View key={fIdx}>{renderStringField(label, val)}</View>
                  ))}
                </View>
              )}

              {/* Biopsy & Sialography */}
              {(hasVal(record.salivarGlandBiopsy) || hasVal(record.sialography)) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Biopsy & Sialography</Text>
                  {renderStringField('Salivary Gland Biopsy', record.salivarGlandBiopsy)}
                  {renderStringField('Sialography', record.sialography)}
                </View>
              )}

              {/* Systemic Manifestations & Scores */}
              {(hasVal(record.systemicManifestations) || hasVal(record.essdaiScore) || hasVal(record.esspriScore)) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Systemic Manifestations & Scores</Text>
                  {renderArrayField('Systemic Manifestations', record.systemicManifestations)}
                  {renderStringField('ESSDAI Score', record.essdaiScore)}
                  {renderStringField('ESSPRI Score', record.esspriScore)}
                </View>
              )}

              {/* Clinical Narrative */}
              {(hasVal(record.findings) || hasVal(record.assessment) || hasVal(record.plan)) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Clinical Narrative</Text>
                  {renderStringField('Findings', record.findings)}
                  {renderStringField('Assessment', record.assessment)}
                  {renderStringField('Plan', record.plan)}
                </View>
              )}

              {/* Results (dynamic-key object) */}
              {!isEmptyDeep(record.results) && typeof record.results === 'object' && !Array.isArray(record.results) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Results</Text>
                  {renderObjectField('Results', record.results)}
                </View>
              )}

              {/* Recommendations & Notes */}
              {(hasVal(record.recommendations) || hasVal(record.notes)) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Recommendations & Notes</Text>
                  {renderArrayField('Recommendations', record.recommendations)}
                  {renderStringField('Notes', record.notes)}
                </View>
              )}

              {/* Provider Information */}
              {(hasVal(record.provider) || hasVal(record.facility)) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Provider Information</Text>
                  {renderStringField('Provider', record.provider)}
                  {renderStringField('Facility', record.facility)}
                </View>
              )}

              {idx < records.length - 1 && <View style={styles.separator} />}
            </View>
          ))
        )}
      </Page>
    </Document>
  );
};

export default SjogrensSyndromeAssessmentDocumentPDFTemplate;
