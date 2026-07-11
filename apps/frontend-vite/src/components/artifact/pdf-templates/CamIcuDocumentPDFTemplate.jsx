/**
 * CamIcuDocumentPDFTemplate.jsx
 * Helvetica 20/14/12pt -- LETTER size -- US medical platform
 * Collection: cam_icu
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
  listItem: { fontSize: 12, lineHeight: 1.5, marginBottom: 2 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
});

const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; return true; };
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\bvs)\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };
const parseLabel = (s) => { const m = s.replace(/[;.]+$/, '').trim().match(/^([A-Za-z][A-Za-z0-9 /()-]{1,40}):\s*(.+)$/s); return m ? { label: m[1].trim(), value: m[2].trim() } : { label: null, value: s }; };
const splitBySemicolon = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let cur = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; cur += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); cur += ch; }
    else if (ch === ';' && depth === 0) { const t = cur.trim(); if (t) result.push(t); cur = ''; }
    else cur += ch;
  }
  const t = cur.trim(); if (t) result.push(t);
  return result.length ? result : [text];
};
const renderFieldRow = (label, value) => { if (!hasVal(value)) return null; return (<View style={{ marginBottom: 4 }}><Text style={styles.fieldLabel}>{label}</Text><Text style={styles.fieldValue}>{String(value)}</Text></View>); };

const renderSentenceField = (label, text, sectionTitle) => {
  if (!hasVal(text)) return null;
  /* Semicolon-compound "Label: value; Label: value" field -> label header + bold sub-label + value per part */
  const semiParts = splitBySemicolon(String(text));
  if (semiParts.length >= 2 && semiParts.filter(p => parseLabel(p).label).length >= 2) {
    return (<View style={styles.fieldBox} wrap={semiParts.length > 8 ? undefined : false}>
      {sectionTitle && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
      <Text style={styles.fieldLabel}>{label}</Text>
      {semiParts.map((p, i) => {
        const parsed = parseLabel(p);
        return (<View key={i} style={{ marginBottom: 3, marginLeft: 8 }}>
          {parsed.label && <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 1 }}>{parsed.label}</Text>}
          <Text style={styles.listItem}>{parsed.label ? parsed.value : p}</Text>
        </View>);
      })}
    </View>);
  }
  const sentences = splitBySentence(String(text));
  if (sentences.length === 0) return null;
  let totalItems = sentences.length;
  sentences.forEach(s => { const p = parseLabel(s); const rv = p.label ? p.value : s; const ci = rv.split(/,\s+/).filter(x => x.trim()); if (ci.length > 1) totalItems += ci.length - 1; });
  return (<View style={styles.fieldBox} wrap={totalItems > 8 ? undefined : false}>
    {sectionTitle && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
    <Text style={styles.fieldLabel}>{label}</Text>
    {sentences.map((s, i) => {
      const p = parseLabel(s);
      const rawVal = p.label ? p.value : s.replace(/[;.]+$/, '').trim();
      const cItems = rawVal.split(/,\s+/).filter(x => x.trim());
      return (<View key={i} style={{ marginBottom: 3, marginLeft: 8 }}>
        {p.label && <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 1 }}>{p.label}</Text>}
        {cItems.length > 1 ? cItems.map((item, ci) => <Text key={ci} style={styles.listItem}>{ci + 1}. {item.trim()}</Text>) : <Text style={styles.listItem}>1. {rawVal}</Text>}
      </View>);
    })}
  </View>);
};

const CamIcuDocumentPDFTemplate = ({ document: data }) => {
  // Handle data unwrapping
  let records = [];
  if (Array.isArray(data)) {
    records = data;
  } else if (data?.cam_icu && Array.isArray(data.cam_icu)) {
    records = data.cam_icu;
  } else if (data?.documentData) {
    const docData = data.documentData;
    if (Array.isArray(docData)) {
      records = docData;
    } else if (docData?.cam_icu) {
      records = docData.cam_icu;
    } else if (docData && typeof docData === 'object') {
      records = [docData];
    }
  } else if (data && typeof data === 'object') {
    records = [data];
  }

  if (!records || records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>CAM-ICU Assessment</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>CAM-ICU Assessment</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`CAM-ICU Assessment ${idx + 1}`}</Text>
              {(record.assessmentDate || record.createdAt) && <Text style={styles.recordMeta}>{formatDate(record.assessmentDate || record.createdAt)}</Text>}
            </View>

            {/* 1. Assessment Information */}
            {(hasVal(record.assessmentTime) || hasVal(record.clinicalStatus)) && (
              <View style={styles.fieldBox} wrap={false}>
                <Text style={styles.sectionTitle}>Assessment Information</Text>
                {renderFieldRow('Assessment Time', record.assessmentTime)}
                {renderFieldRow('Clinical Status', record.clinicalStatus)}
              </View>
            )}

            {/* 2. Clinical Details */}
            {(hasVal(record.vitalSigns) || hasVal(record.interventions) || hasVal(record.response) || hasVal(record.plan)) && (
              <View style={styles.section}>
                {hasVal(record.vitalSigns) && renderSentenceField('Vital Signs', record.vitalSigns, 'Clinical Details')}
                {hasVal(record.interventions) && renderSentenceField('Interventions', record.interventions, !hasVal(record.vitalSigns) ? 'Clinical Details' : null)}
                {hasVal(record.response) && renderSentenceField('Response', record.response)}
                {hasVal(record.plan) && renderSentenceField('Plan', record.plan)}
              </View>
            )}

            {/* 3. Recommendations */}
            {(hasVal(record.recommendations) || (record.additionalData && typeof record.additionalData === 'object' && Object.keys(record.additionalData).length > 0)) && (
              <View style={styles.section}>
                {Array.isArray(record.recommendations) && record.recommendations.length > 0 && (
                  <View style={styles.fieldBox} wrap={record.recommendations.length > 8 ? undefined : false}>
                    <Text style={styles.sectionTitle}>Recommendations</Text>
                    <Text style={styles.fieldLabel}>Recommendations</Text>
                    {record.recommendations.map((item, i) => {
                      const isObj = typeof item === 'object' && item !== null;
                      const displayText = isObj ? `${item.recommendation || ''}${item.date ? ` (${formatDate(item.date)})` : ''}` : String(item);
                      return <Text key={i} style={styles.listItem}>{i + 1}. {displayText}</Text>;
                    })}
                  </View>
                )}
                {record.additionalData && typeof record.additionalData === 'object' && Object.keys(record.additionalData).length > 0 && (
                  <View style={styles.fieldBox} wrap={false}>
                    {!(Array.isArray(record.recommendations) && record.recommendations.length > 0) && <Text style={styles.sectionTitle}>Recommendations</Text>}
                    <Text style={styles.fieldLabel}>Additional Data</Text>
                    {Object.entries(record.additionalData).filter(([, v]) => hasVal(v)).map(([k, v], i) => (
                      <Text key={i} style={styles.listItem}>{k}: {String(v)}</Text>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default CamIcuDocumentPDFTemplate;
