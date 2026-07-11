/**
 * AntimicrobialSusceptibilityDocumentPDFTemplate.jsx
 * Helvetica 20/14/12pt -- LETTER size -- US medical platform
 * Collection: antimicrobial_susceptibility
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 15, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, borderBottomWidth: 3, borderBottomColor: '#000000', paddingBottom: 14 },
  title: { fontSize: 24, fontFamily: 'Helvetica-Bold', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 2 },
  recordContainer: { marginBottom: 28, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#cccccc' },
  recordHeader: { marginBottom: 16, backgroundColor: '#f5f5f5', padding: 12, borderWidth: 2, borderColor: '#000000', borderLeftWidth: 5, borderLeftColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold' },
  recordMeta: { fontSize: 13, color: '#333333', marginTop: 4 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 17, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 14, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 14, lineHeight: 1.5, marginBottom: 2 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 16, color: '#666666' },
});

const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return v !== 0; if (typeof v === 'string') return v.trim() !== ''; return true; };
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
        {p.label && <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', marginBottom: 1 }}>{p.label}</Text>}
        {cItems.length > 1 ? cItems.map((item, ci) => <Text key={ci} style={styles.listItem}>{ci + 1}. {item.trim()}</Text>) : <Text style={styles.listItem}>1. {rawVal}</Text>}
      </View>);
    })}
  </View>);
};

const AntimicrobialSusceptibilityDocumentPDFTemplate = ({ document: data }) => {
  // Handle data unwrapping
  let records = [];
  if (Array.isArray(data)) {
    records = data;
  } else if (data?.antimicrobial_susceptibility && Array.isArray(data.antimicrobial_susceptibility)) {
    records = data.antimicrobial_susceptibility;
  } else if (data?.documentData) {
    const docData = data.documentData;
    if (Array.isArray(docData)) {
      records = docData;
    } else if (docData?.antimicrobial_susceptibility) {
      records = docData.antimicrobial_susceptibility;
    } else if (docData && typeof docData === 'object') {
      records = [docData];
    }
  } else if (data && typeof data === 'object') {
    records = [data];
  }

  if (!records || records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>Antimicrobial Susceptibility</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Antimicrobial Susceptibility</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Antimicrobial Susceptibility ${idx + 1}`}</Text>
              {(record.date || record.createdAt) && <Text style={styles.recordMeta}>{formatDate(record.date || record.createdAt)}</Text>}
            </View>

            {/* 1. Provider Information */}
            {hasVal(record.reportingLaboratory) && (
              <View style={styles.fieldBox} wrap={false}>
                <Text style={styles.sectionTitle}>Provider Information</Text>
                {renderFieldRow('Reporting Laboratory', record.reportingLaboratory)}
              </View>
            )}

            {/* 2. Specimen Information */}
            {(hasVal(record.specimenType) || hasVal(record.specimenCollectionDate) || hasVal(record.cultureMethod) || hasVal(record.cultureGrowthTime) || hasVal(record.polymicrobialGrowth)) && (
              <View style={styles.fieldBox} wrap={false}>
                <Text style={styles.sectionTitle}>Specimen Information</Text>
                {renderFieldRow('Specimen Type', record.specimenType)}
                {renderFieldRow('Specimen Collection Date', record.specimenCollectionDate)}
                {renderFieldRow('Culture Method', record.cultureMethod)}
                {hasVal(record.cultureGrowthTime) && renderFieldRow('Culture Growth Time', String(record.cultureGrowthTime))}
                {hasVal(record.polymicrobialGrowth) && renderFieldRow('Polymicrobial Growth', record.polymicrobialGrowth ? 'Yes' : 'No')}
              </View>
            )}

            {/* 3. Organism Identification */}
            {(hasVal(record.organismIdentified) || hasVal(record.gramStainResult) || hasVal(record.colonyCount) || (Array.isArray(record.coOrganisms) && record.coOrganisms.length > 0)) && (
              <View style={styles.section}>
                {hasVal(record.organismIdentified) && renderSentenceField('Organism Identified', record.organismIdentified, 'Organism Identification')}
                {hasVal(record.gramStainResult) && (
                  <View style={styles.fieldBox} wrap={false}>
                    {!hasVal(record.organismIdentified) && <Text style={styles.sectionTitle}>Organism Identification</Text>}
                    {renderFieldRow('Gram Stain Result', record.gramStainResult)}
                  </View>
                )}
                {hasVal(record.colonyCount) && renderSentenceField('Colony Count', record.colonyCount)}
                {Array.isArray(record.coOrganisms) && record.coOrganisms.length > 0 && (
                  <View style={styles.fieldBox} wrap={record.coOrganisms.length > 8 ? undefined : false}>
                    <Text style={styles.fieldLabel}>Co-Organisms</Text>
                    {record.coOrganisms.map((item, i) => (
                      <Text key={i} style={styles.listItem}>{i + 1}. {String(item)}</Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* 4. Susceptibility Testing */}
            {(hasVal(record.susceptibilityMethod) || (Array.isArray(record.antibioticsPanelTested) && record.antibioticsPanelTested.length > 0) || (Array.isArray(record.susceptibilityProfile) && record.susceptibilityProfile.length > 0) || (Array.isArray(record.minimumInhibitoryConcentration) && record.minimumInhibitoryConcentration.length > 0)) && (
              <View style={styles.section}>
                {hasVal(record.susceptibilityMethod) && (
                  <View style={styles.fieldBox} wrap={false}>
                    <Text style={styles.sectionTitle}>Susceptibility Testing</Text>
                    {renderFieldRow('Susceptibility Method', record.susceptibilityMethod)}
                  </View>
                )}
                {Array.isArray(record.antibioticsPanelTested) && record.antibioticsPanelTested.length > 0 && (
                  <View style={styles.fieldBox} wrap={record.antibioticsPanelTested.length > 8 ? undefined : false}>
                    {!hasVal(record.susceptibilityMethod) && <Text style={styles.sectionTitle}>Susceptibility Testing</Text>}
                    <Text style={styles.fieldLabel}>Antibiotics Panel Tested</Text>
                    {record.antibioticsPanelTested.map((item, i) => (
                      <Text key={i} style={styles.listItem}>{i + 1}. {String(item)}</Text>
                    ))}
                  </View>
                )}
                {Array.isArray(record.susceptibilityProfile) && record.susceptibilityProfile.length > 0 && (
                  <View style={styles.fieldBox} wrap={record.susceptibilityProfile.length > 8 ? undefined : false}>
                    <Text style={styles.fieldLabel}>Susceptibility Profile</Text>
                    {record.susceptibilityProfile.map((item, i) => (
                      <Text key={i} style={styles.listItem}>{i + 1}. {String(item)}</Text>
                    ))}
                  </View>
                )}
                {Array.isArray(record.minimumInhibitoryConcentration) && record.minimumInhibitoryConcentration.length > 0 && (
                  <View style={styles.fieldBox} wrap={record.minimumInhibitoryConcentration.length > 8 ? undefined : false}>
                    <Text style={styles.fieldLabel}>Minimum Inhibitory Concentration</Text>
                    {record.minimumInhibitoryConcentration.map((item, i) => (
                      <Text key={i} style={styles.listItem}>{i + 1}. {String(item)}</Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* 5. Resistance Markers */}
            {(hasVal(record.esblDetected) || hasVal(record.mrsaStatus) || hasVal(record.carbapenemaseProduction) || hasVal(record.vreStatus) || hasVal(record.multidrugResistant) || hasVal(record.inductibleResistance) || hasVal(record.biofilmProduction)) && (
              <View style={styles.fieldBox} wrap={false}>
                <Text style={styles.sectionTitle}>Resistance Markers</Text>
                {hasVal(record.esblDetected) && renderFieldRow('ESBL Detected', record.esblDetected ? 'Yes' : 'No')}
                {hasVal(record.mrsaStatus) && renderFieldRow('MRSA Status', record.mrsaStatus ? 'Yes' : 'No')}
                {hasVal(record.carbapenemaseProduction) && renderFieldRow('Carbapenemase Production', record.carbapenemaseProduction ? 'Yes' : 'No')}
                {hasVal(record.vreStatus) && renderFieldRow('VRE Status', record.vreStatus ? 'Yes' : 'No')}
                {hasVal(record.multidrugResistant) && renderFieldRow('Multidrug Resistant', record.multidrugResistant ? 'Yes' : 'No')}
                {hasVal(record.inductibleResistance) && renderFieldRow('Inducible Resistance', record.inductibleResistance)}
                {hasVal(record.biofilmProduction) && renderFieldRow('Biofilm Production', record.biofilmProduction ? 'Yes' : 'No')}
              </View>
            )}

            {/* 6. Reporting */}
            {(hasVal(record.interpretiveComments) || hasVal(record.breakpointStandard)) && (
              <View style={styles.section}>
                {hasVal(record.interpretiveComments) && renderSentenceField('Interpretive Comments', record.interpretiveComments, 'Reporting')}
                {hasVal(record.breakpointStandard) && (
                  <View style={styles.fieldBox} wrap={false}>
                    {!hasVal(record.interpretiveComments) && <Text style={styles.sectionTitle}>Reporting</Text>}
                    {renderFieldRow('Breakpoint Standard', record.breakpointStandard)}
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

export default AntimicrobialSusceptibilityDocumentPDFTemplate;
