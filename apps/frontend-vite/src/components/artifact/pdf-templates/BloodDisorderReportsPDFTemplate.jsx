import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * Blood Disorder Reports PDF Template — BOX-FREE black & white, bigger fonts (per MCP PDF checklist 6a3d4c85 §H).
 * - Box-free: only #000000/#ffffff; NO border/background on field/section/header; NO borderRadius
 *   (the single rule under the document title is a divider, not a box). No bar charts (those are boxes) —
 *   lab values render as clean stacked text (bold name above value).
 * - Bigger fonts: title 24 / record 19 / section 16 / body 14 (base 14).
 * - Rule #74 page-break: each section = ONE <View> with the title INSIDE it; @react-pdf 4.3.2 → BOOLEAN
 *   wrap={rows>8} (wrap={undefined}===false on v4). <=8 rows → wrap={false} (atomic, moves whole → no
 *   orphan/overprint); >8 → wrap with title+row1 GLUED in a wrap={false} sub-View, rest flow (orphan-proof).
 * - Rule #75: break per record. pdfSafe ASCII-maps glyphs Helvetica lacks (µ ≥ ≤ → × superscripts).
 */

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, color: '#000000', backgroundColor: '#ffffff' },
  header: { marginBottom: 20, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000' },
  title: { fontSize: 24, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#000000' },
  generatedDate: { fontSize: 11, color: '#000000', marginTop: 4 },
  recordContainer: { marginBottom: 20 },
  recordHeader: { marginBottom: 14 },
  recordHeaderTopRow: { flexDirection: 'row', gap: 14, marginBottom: 4 },
  badge: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  subLabel: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 1 },
  fieldValue: { fontSize: 14, color: '#000000', lineHeight: 1.4, paddingLeft: 12 },
  labEntry: { marginBottom: 6 },
  listRow: { flexDirection: 'row', marginBottom: 4, paddingLeft: 12 },
  rowNumber: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', width: 22 },
  rowContent: { flex: 1, fontSize: 14, color: '#000000', lineHeight: 1.4 },
  footer: { position: 'absolute', bottom: 22, left: 40, right: 40, textAlign: 'center', fontSize: 10, color: '#000000' },
  noRecords: { textAlign: 'center', padding: 40, color: '#000000', fontSize: 14 },
});

// Built-in Helvetica lacks µ ≥ ≤ → × ° and superscript digits; a missing glyph renders garbage AND eats the
// next space (memory 6a40999) — ASCII-map every string. Superscript run → ^N ("x10⁹/L" → "x10^9/L").
const SUP = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' };
const pdfSafe = (s) => String(s == null ? '' : s)
  .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, m => '^' + m.replace(/./g, c => SUP[c] || ''))
  .replace(/→/g, '->').replace(/←/g, '<-').replace(/≥/g, '>=').replace(/≤/g, '<=')
  .replace(/µ/g, 'u').replace(/μ/g, 'u').replace(/±/g, '+/-').replace(/×/g, 'x')
  .replace(/÷/g, '/').replace(/°/g, ' deg').replace(/—/g, '-').replace(/–/g, '-');

const formatDate = (d) => { if (!d) return ''; try { return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const formatDateShort = (d) => { if (!d) return ''; try { return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); } catch { return String(d); } };
const safeArray = (v) => (!v ? [] : Array.isArray(v) ? v : [v]);
const hasText = (v) => v !== null && v !== undefined && String(v).trim() !== '';
const getSeverityLabel = (s) => { if (!s) return ''; const m = String(s).match(/^(high|low|moderate|critical|severe)\s+(severity|risk)/i); return m ? m[0] : (s.length > 24 ? s.substring(0, 24) + '...' : s); };
const splitIntoSentences = (text) => { if (!text) return []; return String(text).split(/(?<=[.!?;])\s+/).map(s => s.trim().replace(/;$/, '')).filter(Boolean); };

// One section = ONE View, sectionTitle INSIDE (never a standalone sibling → no orphan). @react-pdf 4.3.2:
// wrap MUST be boolean. <=8 rows → wrap={false} (atomic). >8 → wrap with title+row1 glued in a wrap={false}
// sub-View, the rest flow → the title can never strand at a page bottom.
const Block = ({ title, rowNodes, breakPage }) => {
  if (!rowNodes || rowNodes.length === 0) return null;
  const bp = breakPage ? { break: true } : {};
  const titleNode = <Text style={styles.sectionTitle}>{pdfSafe(title)}</Text>;
  if (rowNodes.length <= 8) {
    return <View style={styles.section} wrap={false} {...bp}>{titleNode}{rowNodes}</View>;
  }
  return (
    <View style={styles.section} wrap {...bp}>
      <View wrap={false}>{titleNode}{rowNodes[0]}</View>
      {rowNodes.slice(1)}
    </View>
  );
};

const SimpleField = ({ label, value }) => {
  if (!hasText(value)) return null;
  return <Block title={label} rowNodes={[<Text key="v" style={styles.fieldValue}>{pdfSafe(value)}</Text>]} />;
};

// Lab/object section — each entry stacked (bold name above value), NO bar charts, NO boxes.
const ObjectSection = ({ title, obj, breakPage }) => {
  if (!obj || typeof obj !== 'object') return null;
  const entries = Object.entries(obj).filter(([, v]) => hasText(v));
  if (entries.length === 0) return null;
  const rowNodes = entries.map(([k, v], i) => (
    <View key={i} style={styles.labEntry}><Text style={styles.subLabel}>{pdfSafe(k)}</Text><Text style={styles.fieldValue}>{pdfSafe(v)}</Text></View>
  ));
  return <Block title={title} rowNodes={rowNodes} breakPage={breakPage} />;
};

const NumberedSection = ({ title, items, breakPage }) => {
  const safe = safeArray(items).filter(hasText);
  if (safe.length === 0) return null;
  const rowNodes = safe.map((item, i) => (
    <View key={i} style={styles.listRow}><Text style={styles.rowNumber}>{i + 1}.</Text><Text style={styles.rowContent}>{pdfSafe(item)}</Text></View>
  ));
  return <Block title={title} rowNodes={rowNodes} breakPage={breakPage} />;
};

const TextSection = ({ label, value }) => {
  if (!hasText(value)) return null;
  return <NumberedSection title={label} items={splitIntoSentences(value)} />;
};

const ProviderSection = ({ hematologist, facility }) => {
  const rows = [];
  if (hasText(hematologist)) rows.push(<View key="h" style={styles.labEntry}><Text style={styles.subLabel}>Hematologist</Text><Text style={styles.fieldValue}>{pdfSafe(hematologist)}</Text></View>);
  if (hasText(facility)) rows.push(<View key="f" style={styles.labEntry}><Text style={styles.subLabel}>Facility</Text><Text style={styles.fieldValue}>{pdfSafe(facility)}</Text></View>);
  if (rows.length === 0) return null;
  return <Block title="Provider Information" rowNodes={rows} />;
};

const BloodDisorderReportsPDFTemplate = ({ document }) => {
  const records = Array.isArray(document) ? document : [document];
  const hasRecords = records && records.length > 0 && records.some(r => r && typeof r === 'object' && Object.keys(r).length > 0);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Blood Disorder Reports</Text>
          <Text style={styles.subtitle}>Hematology Assessment and Monitoring</Text>
          <Text style={styles.generatedDate}>Generated: {formatDateShort(new Date().toISOString())}</Text>
        </View>

        {!hasRecords ? (
          <Text style={styles.noRecords}>No blood disorder reports available</Text>
        ) : (
          records.map((record, idx) => (
            <View key={idx} style={styles.recordContainer} break={idx > 0}>
              <View style={styles.recordHeader} wrap={false}>
                {(record.date || record.severity) && (
                  <View style={styles.recordHeaderTopRow}>
                    {record.date && <Text style={styles.badge}>{formatDate(record.date)}</Text>}
                    {record.severity && <Text style={styles.badge}>{pdfSafe(getSeverityLabel(record.severity))}</Text>}
                  </View>
                )}
                <Text style={styles.recordTitle}>{`Blood Disorder Report ${idx + 1}`}</Text>
              </View>

              {record.severity && record.severity.length > 30 && (
                <SimpleField label="Clinical Summary" value={record.severity} />
              )}

              <SimpleField label="Disorder Type" value={record.disorderType} />
              <SimpleField label="Diagnosis" value={record.diagnosis} />
              <SimpleField label="Etiology" value={record.etiology} />

              <ObjectSection title="CBC (Complete Blood Count)" obj={record.cbc} />
              <ObjectSection title="Coagulation Studies" obj={record.coagulationStudies} />
              <ObjectSection title="Iron Studies" obj={record.ironStudies} />
              <ObjectSection title="Vitamin Levels" obj={record.vitaminLevels} />
              <ObjectSection title="Hemolysis Workup" obj={record.hemolysisWorkup} />

              {hasText(record.peripheralSmear) && (
                record.peripheralSmear.split(/,\s*/).filter(s => s.trim()).length > 1
                  ? <NumberedSection title="Peripheral Smear" items={record.peripheralSmear.split(/,\s*/).map(s => s.trim()).filter(Boolean)} />
                  : <SimpleField label="Peripheral Smear" value={record.peripheralSmear} />
              )}
              <SimpleField label="Bone Marrow" value={record.boneMorrow} />

              <NumberedSection title="Treatment" items={record.treatment} />
              <TextSection label="Monitoring Plan" value={record.monitoring} />
              <TextSection label="Notes" value={record.notes} />

              <ProviderSection hematologist={record.hematologist} facility={record.facility} />
            </View>
          ))
        )}

        <Text style={styles.footer} fixed>Confidential Medical Document  •  Blood Disorder Reports</Text>
      </Page>
    </Document>
  );
};

export default BloodDisorderReportsPDFTemplate;
