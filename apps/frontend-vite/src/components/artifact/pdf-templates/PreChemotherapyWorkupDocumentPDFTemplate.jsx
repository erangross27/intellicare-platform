/**
 * PreChemotherapyWorkupDocumentPDFTemplate.jsx
 * Helvetica 20/14/12pt -- LETTER size -- US medical platform
 * Collection: pre_chemotherapy_workup
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, borderBottomWidth: 3, borderBottomColor: '#000000', paddingBottom: 14 },
  title: { fontSize: 20, fontFamily: 'Helvetica-Bold', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 2 },
  recordContainer: { marginBottom: 28, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#cccccc' },
  recordHeader: { marginBottom: 16, backgroundColor: '#f5f5f5', padding: 12, borderWidth: 2, borderColor: '#000000', borderLeftWidth: 5, borderLeftColor: '#000000' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold' },
  recordMeta: { fontSize: 11, color: '#333333', marginTop: 4 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 12, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 12, lineHeight: 1.5, marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
});

/* ======= UTILS ======= */
const formatDate = (d) => {
  if (!d) return '';
  try {
    const date = new Date(d.$date || d);
    if (isNaN(date.getTime())) return String(d);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(d); }
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

const fmtVal = (v) => {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  return String(v || '');
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
    if (ch === '(' || ch === '"' || ch === "'") { depth++; current += ch; }
    else if (ch === ')' || (depth > 0 && (ch === '"' || ch === "'"))) { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* renderFieldRow: label + value inside fieldBox */
const renderFieldRow = (label, value) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* renderSentenceField: parseLabel + comma-split with sequential counter */
const renderSentenceField = (label, text, counterRef) => {
  if (!hasVal(text)) return null;
  if (typeof text !== 'string') {
    return renderFieldRow(label, text);
  }
  const sentences = splitBySentence(fmtVal(text));
  if (sentences.length === 0) return null;

  const rows = [];
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const commaItems = splitByComma(parsed.value);
      if (commaItems.length >= 2) {
        rows.push({ type: 'subtitle', text: safeString(parsed.label) });
        commaItems.forEach(ci => { rows.push({ type: 'item', text: safeString(ci), num: counterRef.n++ }); });
      } else {
        rows.push({ type: 'item', text: safeString(s), num: counterRef.n++ });
      }
    } else {
      rows.push({ type: 'item', text: safeString(s), num: counterRef.n++ });
    }
  });

  const wrapProp = rows.length > 8 ? undefined : false;

  return (
    <View style={styles.fieldBox} wrap={wrapProp}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {rows.map((row, i) => {
        if (row.type === 'subtitle') {
          return <Text key={i} style={styles.nestedSubtitle}>{row.text}</Text>;
        }
        return <Text key={i} style={styles.listItem}>{row.num}. {row.text}</Text>;
      })}
    </View>
  );
};

/* renderArrayField */
const renderArrayField = (label, items, counterRef) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  const safeItems = items.filter(Boolean);
  if (safeItems.length === 0) return null;

  return (
    <View style={styles.fieldBox} wrap={safeItems.length > 8 ? undefined : false}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {safeItems.map((item, i) => (
        <Text key={i} style={styles.listItem}>{counterRef.n++}. {safeString(item)}</Text>
      ))}
    </View>
  );
};

/* ======= OBJECT (dynamic-key) RENDERERS ======= */
const KEY_OVERRIDES = { cbc: 'CBC', cmp: 'CMP', anc: 'ANC', hgb: 'Hgb', wbc: 'WBC', egfr: 'eGFR', crcl: 'CrCl', lvef: 'LVEF', ecog: 'ECOG', fev1: 'FEV1', dlco: 'DLCO', hiv: 'HIV', ldh: 'LDH', bun: 'BUN', ast: 'AST', alt: 'ALT', inr: 'INR' };
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const base = String(key);
  if (KEY_OVERRIDES[base]) return KEY_OVERRIDES[base];
  if (KEY_OVERRIDES[base.toLowerCase()]) return KEY_OVERRIDES[base.toLowerCase()];
  const s = base.replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return safeString(v); };

/* Recursive OBJECT node renderer (B&W; nested indentation via paddingLeft) */
const renderObjectNode = (label, value, depth, keyPrefix) => {
  if (!hasVal(value)) return null;
  if (isScalar(value)) {
    return (
      <View key={keyPrefix} style={[styles.fieldBox, depth > 0 ? { paddingLeft: depth * 8, marginBottom: 4 } : { marginBottom: 4 }]} wrap={false}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValue}>{fmtScalar(value)}</Text>
      </View>
    );
  }
  const entries = Object.entries(value).filter(([, v]) => hasVal(v));
  if (entries.length === 0) return null;
  return (
    <View key={keyPrefix} style={depth > 0 ? { paddingLeft: depth * 8 } : undefined}>
      {label ? <Text style={styles.nestedSubtitle}>{label}</Text> : null}
      {entries.map(([k, v], i) => renderObjectNode(humanizeKey(k), v, depth + 1, `${keyPrefix}-${k}-${i}`))}
    </View>
  );
};

/* Count leaf rows for Rule #74 wrap gating */
const countLeaves = (v) => {
  if (!hasVal(v)) return 0;
  if (isScalar(v)) return 1;
  return Object.values(v).filter(hasVal).reduce((a, x) => a + countLeaves(x), 0);
};

/* Render a top-level OBJECT field as its own section (Rule #74) */
const renderObjectField = (sectionTitle, value) => {
  if (!hasVal(value) || isScalar(value)) return null;
  const entries = Object.entries(value).filter(([, v]) => hasVal(v));
  if (entries.length === 0) return null;
  const leaves = countLeaves(value);
  return (
    <View style={styles.section} wrap={leaves > 8 ? undefined : false}>
      <Text style={styles.sectionTitle}>{sectionTitle}</Text>
      {entries.map(([k, v], i) => renderObjectNode(humanizeKey(k), v, 0, `${sectionTitle}-${k}-${i}`))}
    </View>
  );
};

/* ======= COMPONENT ======= */
const PreChemotherapyWorkupDocumentPDFTemplate = ({ document: data }) => {
  /* Handle data unwrapping */
  let records = [];
  if (Array.isArray(data)) {
    records = data;
  } else if (data?.pre_chemotherapy_workup && Array.isArray(data.pre_chemotherapy_workup)) {
    records = data.pre_chemotherapy_workup;
  } else if (data?.documentData) {
    const docData = data.documentData;
    if (Array.isArray(docData)) {
      records = docData;
    } else if (docData?.pre_chemotherapy_workup) {
      records = docData.pre_chemotherapy_workup;
    } else if (docData && typeof docData === 'object') {
      records = [docData];
    }
  } else if (data && typeof data === 'object') {
    records = [data];
  }

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.title}>Pre-Chemotherapy Workup</Text>
          </View>
          <Text style={styles.emptyState}>No records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Pre-Chemotherapy Workup</Text></View>
        {records.map((record, idx) => {
          const ctr = { n: 1 };

          return (
            <View key={idx} style={styles.recordContainer}>
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>{`Pre-Chemotherapy Workup ${idx + 1}`}</Text>
                {record.date && <Text style={styles.recordMeta}>{formatDate(record.date)}</Text>}
              </View>

              {/* 1. Visit Information */}
              {(hasVal(record.date) || hasVal(record.provider) || hasVal(record.facility) || hasVal(record.status)) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Visit Information</Text>
                  {hasVal(record.date) && renderFieldRow('Date', formatDate(record.date))}
                  {renderSentenceField('Provider', record.provider, ctr)}
                  {renderSentenceField('Facility', record.facility, ctr)}
                  {renderSentenceField('Status', record.status, ctr)}
                </View>
              )}

              {/* 2. Infectious Screening */}
              {hasVal(record.infectiousScreening) && (hasVal(record.infectiousScreening?.hepatitisB) || hasVal(record.infectiousScreening?.hepatitisC) || hasVal(record.infectiousScreening?.hiv)) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Infectious Screening</Text>
                  {renderSentenceField('Hepatitis B', record.infectiousScreening?.hepatitisB, ctr)}
                  {renderSentenceField('Hepatitis C', record.infectiousScreening?.hepatitisC, ctr)}
                  {renderSentenceField('HIV', record.infectiousScreening?.hiv, ctr)}
                </View>
              )}

              {/* 3. Cardiac Assessment */}
              {hasVal(record.cardiacAssessment) && (hasVal(record.cardiacAssessment?.ekg) || hasVal(record.cardiacAssessment?.echo) || hasVal(record.cardiacAssessment?.indication)) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Cardiac Assessment</Text>
                  {renderSentenceField('EKG', record.cardiacAssessment?.ekg, ctr)}
                  {renderSentenceField('Echo', record.cardiacAssessment?.echo, ctr)}
                  {renderSentenceField('Indication', record.cardiacAssessment?.indication, ctr)}
                </View>
              )}

              {/* 4. Consultations */}
              {(hasVal(record.fertilityConsultation) || hasVal(record.dentalClearance)) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Consultations</Text>
                  {renderSentenceField('Fertility Consultation', record.fertilityConsultation, ctr)}
                  {renderSentenceField('Dental Clearance', record.dentalClearance, ctr)}
                </View>
              )}

              {/* 5. Eligibility */}
              {(hasVal(record.findings) || hasVal(record.assessment)) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Eligibility</Text>
                  {renderSentenceField('Findings', record.findings, ctr)}
                  {renderSentenceField('Assessment', record.assessment, ctr)}
                </View>
              )}

              {/* 6. Treatment Plan */}
              {(hasVal(record.plan) || hasVal(record.notes)) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Treatment Plan</Text>
                  {renderSentenceField('Plan', record.plan, ctr)}
                  {renderSentenceField('Notes', record.notes, ctr)}
                </View>
              )}

              {/* 7. Results (dynamic-key object) */}
              {renderObjectField('Results', record.results)}

              {/* Recommendations (array, if present) */}
              {Array.isArray(record.recommendations) && record.recommendations.length > 0 &&
                renderArrayField('Recommendations', record.recommendations, ctr)
              }
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default PreChemotherapyWorkupDocumentPDFTemplate;
