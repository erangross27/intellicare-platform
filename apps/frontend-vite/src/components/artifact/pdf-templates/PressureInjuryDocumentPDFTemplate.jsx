/**
 * PressureInjuryDocumentPDFTemplate.jsx
 * Helvetica 20/14/12pt -- LETTER size -- US medical platform
 * Collection: pressure_injury
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
const renderFieldRow = (label, value) => { if (!hasVal(value)) return null; return (<View style={{ marginBottom: 4 }}><Text style={styles.fieldLabel}>{label}</Text><Text style={styles.fieldValue}>{String(value)}</Text></View>); };

const renderSentenceField = (label, text, sectionTitle) => {
  if (!hasVal(text)) return null;
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

const PressureInjuryDocumentPDFTemplate = ({ document: data }) => {
  // Handle data unwrapping
  let records = [];
  if (Array.isArray(data)) {
    records = data;
  } else if (data?.pressure_injury && Array.isArray(data.pressure_injury)) {
    records = data.pressure_injury;
  } else if (data?.documentData) {
    const docData = data.documentData;
    if (Array.isArray(docData)) {
      records = docData;
    } else if (docData?.pressure_injury) {
      records = docData.pressure_injury;
    } else if (docData && typeof docData === 'object') {
      records = [docData];
    }
  } else if (data && typeof data === 'object') {
    records = [data];
  }

  if (!records || records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>Pressure Injury</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Pressure Injury</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Pressure Injury ${idx + 1}`}</Text>
              {record.createdAt && <Text style={styles.recordMeta}>{formatDate(record.createdAt)}</Text>}
            </View>

            {/* 1. Provider Information */}
            {(hasVal(record.provider) || hasVal(record.facility) || hasVal(record.date)) && (
              <View style={styles.fieldBox} wrap={false}>
                <Text style={styles.sectionTitle}>Provider Information</Text>
                {renderFieldRow('Provider', record.provider)}
                {renderFieldRow('Facility', record.facility)}
                {hasVal(record.date) && renderFieldRow('Date', formatDate(record.date))}
              </View>
            )}

            {/* 2. Wound Details */}
            {(hasVal(record.location) || hasVal(record.stage) || hasVal(record.size) || hasVal(record.type) || hasVal(record.description)) && (
              <View style={styles.section}>
                {hasVal(record.location) && renderSentenceField('Location', record.location, 'Wound Details')}
                {hasVal(record.stage) && renderSentenceField('Stage', record.stage, !hasVal(record.location) ? 'Wound Details' : null)}
                {hasVal(record.size) && renderFieldRow('Size', record.size)}
                {hasVal(record.type) && renderFieldRow('Type', record.type)}
                {hasVal(record.description) && renderSentenceField('Description', record.description)}
              </View>
            )}

            {/* 3. Clinical Findings */}
            {(hasVal(record.findings) || hasVal(record.assessment) || hasVal(record.notes) || hasVal(record.status)) && (
              <View style={styles.section}>
                {hasVal(record.findings) && renderSentenceField('Findings', record.findings, 'Clinical Findings')}
                {hasVal(record.assessment) && renderSentenceField('Assessment', record.assessment, !hasVal(record.findings) ? 'Clinical Findings' : null)}
                {hasVal(record.notes) && renderSentenceField('Notes', record.notes)}
                {hasVal(record.status) && renderFieldRow('Status', record.status)}
              </View>
            )}

            {/* 4. Treatment Plan */}
            {(hasVal(record.treatment) || hasVal(record.prevention) || hasVal(record.plan)) && (
              <View style={styles.section}>
                {hasVal(record.treatment) && renderSentenceField('Treatment', record.treatment, 'Treatment Plan')}
                {hasVal(record.prevention) && renderSentenceField('Prevention', record.prevention, !hasVal(record.treatment) ? 'Treatment Plan' : null)}
                {hasVal(record.plan) && renderSentenceField('Plan', record.plan)}
              </View>
            )}

            {/* 5. Recommendations & Results */}
            {(hasVal(record.recommendations) || hasVal(record.results)) && (
              <View style={styles.section}>
                {Array.isArray(record.recommendations) && record.recommendations.length > 0 && (
                  <View style={styles.fieldBox} wrap={record.recommendations.length > 8 ? undefined : false}>
                    <Text style={styles.sectionTitle}>Recommendations & Results</Text>
                    <Text style={styles.fieldLabel}>Recommendations</Text>
                    {record.recommendations.map((item, i) => (
                      <Text key={i} style={styles.listItem}>{i + 1}. {String(item)}</Text>
                    ))}
                  </View>
                )}
                {record.results && typeof record.results === 'object' && Object.keys(record.results).length > 0 && (
                  <View style={styles.fieldBox} wrap={false}>
                    {!(Array.isArray(record.recommendations) && record.recommendations.length > 0) && <Text style={styles.sectionTitle}>Recommendations & Results</Text>}
                    <Text style={styles.fieldLabel}>Results</Text>
                    {Object.entries(record.results).filter(([, v]) => hasVal(v)).map(([k, v], i) => (
                      <Text key={i} style={styles.listItem}>{k}: {typeof v === 'object' ? JSON.stringify(v) : String(v)}</Text>
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

export default PressureInjuryDocumentPDFTemplate;
