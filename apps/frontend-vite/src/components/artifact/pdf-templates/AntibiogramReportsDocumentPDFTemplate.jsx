/**
 * AntibiogramReportsDocumentPDFTemplate.jsx
 * Helvetica — LETTER size — US medical platform
 * Collection: antibiogram_reports
 *
 * Page-break: TITLE-GLUE + FLOW (memory 6a3cda8c). NEVER wrap={false} on a whole tall section.
 *   - small section (<=8 rows): ONE atomic wrap={false} block (title + fields move together).
 *   - large section: a flowing <View wrap> where each field glues ONLY [label + first row] in a
 *     small wrap={false} (the section title rides in the FIRST field's glue) and the rest flow.
 * Flat susceptibilities/micValue → drug sub-label + value (each pair atomic). Nested (multi-organism)
 *   → matrix table with [title + header + first data row] glued, remaining rows flow.
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
  subLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 1 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 15, color: '#666666' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#cccccc' },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: '#000000', backgroundColor: '#f5f5f5' },
  tableCell: { fontSize: 8, padding: 2, borderRightWidth: 1, borderRightColor: '#cccccc' },
  tableCellHeader: { fontSize: 8, fontFamily: 'Helvetica-Bold', padding: 2, borderRightWidth: 1, borderRightColor: '#cccccc' },
});

/* ======= UTILS ======= */
const formatDate = (d) => {
  if (!d) return '';
  try { const dt = new Date(d.$date || d); if (isNaN(dt.getTime())) return String(d); return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); }
};

/* formatMicValue: built-in Helvetica has no ≤/≥ glyph (renders as a missing-glyph box that also
   swallows the following space). Map ≤/≥ to ASCII <=/>= and guarantee a single space between the
   number and an alphabetic unit (e.g. "≤0.5mcg/mL" -> "<=0.5 mcg/mL"). "%" stays attached. */
const formatMicValue = (raw) => {
  let s = String(raw == null ? '' : raw);
  s = s.replace(/≤/g, '<=').replace(/≥/g, '>=');
  s = s.replace(/(\d)\s*([A-Za-z])/g, '$1 $2');
  return s;
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
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\bvs)\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };
const parseLabel = (s) => { const m = String(s).replace(/[;.]+$/, '').trim().match(/^([A-Za-z][A-Za-z0-9 /()-]{1,40}):\s*(.+)$/s); return m ? { label: m[1].trim(), value: m[2].trim() } : { label: null, value: s }; };

/* ---- field UNIT builders: each field -> { label, rows: [...] } (rows are flat/atomic elements) ---- */
const valueUnit = (label, value) => { if (!hasVal(value)) return null; return { label, rows: [<Text key="v" style={styles.fieldValue}>{String(value)}</Text>] }; };
const dateUnit = (label, value) => { if (!hasVal(value)) return null; return { label, rows: [<Text key="v" style={styles.fieldValue}>{formatDate(value)}</Text>] }; };

const arrayUnit = (label, items) => {
  const safe = (Array.isArray(items) ? items : []).filter(v => v && String(v).trim());
  if (safe.length === 0) return null;
  return { label, rows: safe.map((it, i) => <Text key={i} style={styles.listItem}>{i + 1}. {String(it)}</Text>) };
};

/* flat object map (drug -> value): each drug = an ATOMIC sub-label+value View so a pair never splits
   across a page; rows flow between pairs. NEVER a side-by-side "Drug: value" row. */
const objectUnit = (label, obj) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const entries = Object.entries(obj);
  if (entries.length === 0) return null;
  return { label, rows: entries.map(([k, v], i) => (
    <View key={i} style={{ marginLeft: 8, marginBottom: 3 }} wrap={false}>
      <Text style={styles.subLabel}>{String(k)}</Text>
      <Text style={styles.listItem}>{formatMicValue(v)}</Text>
    </View>
  )) };
};

const sentenceUnit = (label, text) => {
  if (!hasVal(text)) return null;
  const sentences = splitBySentence(String(text));
  if (sentences.length === 0) return null;
  const rows = []; let n = 1;
  sentences.forEach(s => {
    const p = parseLabel(s);
    const rawVal = p.label ? p.value : String(s).replace(/[;.]+$/, '').trim();
    const cItems = rawVal.split(/,\s+/).filter(x => x.trim());
    if (p.label) rows.push(<Text key={`l${rows.length}`} style={styles.subLabel}>{p.label}</Text>);
    if (cItems.length > 1) cItems.forEach(ci => rows.push(<Text key={`r${rows.length}`} style={styles.listItem}>{n++}. {ci.trim()}</Text>));
    else rows.push(<Text key={`r${rows.length}`} style={styles.listItem}>{n++}. {rawVal}</Text>);
  });
  return rows.length ? { label, rows } : null;
};

/* renderSectionFlow — title-glue + flow (memory 6a3cda8c). */
const renderSectionFlow = (title, units) => {
  const fields = units.filter(u => u && u.rows && u.rows.length);
  if (fields.length === 0) return null;
  const totalRows = fields.reduce((acc, u) => acc + u.rows.length, 0);

  if (totalRows <= 8) {
    return (
      <View style={styles.section} wrap={false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {fields.map((u, fi) => (
          <View key={fi} style={styles.fieldBox}>
            <Text style={styles.fieldLabel}>{u.label}</Text>
            {u.rows}
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.section} wrap>
      {fields.map((u, fi) => (
        <React.Fragment key={fi}>
          <View wrap={false}>
            {fi === 0 && <Text style={styles.sectionTitle}>{title}</Text>}
            <Text style={[styles.fieldLabel, fi > 0 ? { marginTop: 8 } : null]}>{u.label}</Text>
            {u.rows.slice(0, 1)}
          </View>
          {u.rows.slice(1)}
        </React.Fragment>
      ))}
    </View>
  );
};

/* renderMatrix — nested (multi-organism) susceptibilities/micValue table.
   [title + field label + header + first data row] glued in a wrap={false}; remaining rows flow. */
const renderMatrix = (title, label, entries) => {
  const allKeys = new Set();
  entries.forEach(([, sub]) => { if (sub && typeof sub === 'object') Object.keys(sub).forEach(k => allKeys.add(k)); });
  const keys = [...allKeys];
  if (keys.length === 0) return null;
  const [firstName, firstData] = entries[0];
  return (
    <View style={styles.section} wrap>
      <View wrap={false}>
        {title && <Text style={styles.sectionTitle}>{title}</Text>}
        <Text style={styles.fieldLabel}>{label}</Text>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableCellHeader, { width: 90 }]}>Organism</Text>
          {keys.map(k => <Text key={k} style={[styles.tableCellHeader, { width: 38, textAlign: 'center' }]}>{k}</Text>)}
        </View>
        <View style={styles.tableRow}>
          <Text style={[styles.tableCell, { width: 90, fontFamily: 'Helvetica-Bold' }]}>{firstName}</Text>
          {keys.map(k => <Text key={k} style={[styles.tableCell, { width: 38, textAlign: 'center' }]}>{formatMicValue((firstData && typeof firstData === 'object' ? firstData[k] : null) || '-')}</Text>)}
        </View>
      </View>
      {entries.slice(1).map(([orgName, orgData]) => (
        <View key={orgName} style={styles.tableRow}>
          <Text style={[styles.tableCell, { width: 90, fontFamily: 'Helvetica-Bold' }]}>{orgName}</Text>
          {keys.map(k => <Text key={k} style={[styles.tableCell, { width: 38, textAlign: 'center' }]}>{formatMicValue((orgData && typeof orgData === 'object' ? orgData[k] : null) || '-')}</Text>)}
        </View>
      ))}
    </View>
  );
};

/* ======= COMPONENT ======= */
const AntibiogramReportsDocumentPDFTemplate = ({ document: data }) => {
  let records = [];
  if (Array.isArray(data)) {
    records = data;
  } else if (data?.antibiogram_reports && Array.isArray(data.antibiogram_reports)) {
    records = data.antibiogram_reports;
  } else if (data?.documentData) {
    const docData = data.documentData;
    if (Array.isArray(docData)) records = docData;
    else if (docData?.antibiogram_reports) records = docData.antibiogram_reports;
    else if (docData && typeof docData === 'object') records = [docData];
  } else if (data && typeof data === 'object') {
    records = [data];
  }
  records = (records || []).filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>Antibiogram Reports</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Antibiogram Reports</Text></View>
        {records.map((record, idx) => {
          const antibioticsTested = Array.isArray(record.antibioticsTested) ? record.antibioticsTested : [];
          const susceptibilities = (record.susceptibilities && typeof record.susceptibilities === 'object' && !Array.isArray(record.susceptibilities)) ? record.susceptibilities : {};
          const micValue = (record.micValue && typeof record.micValue === 'object' && !Array.isArray(record.micValue)) ? record.micValue : {};
          const susEntries = Object.entries(susceptibilities);
          const micEntries = Object.entries(micValue);
          const susNested = susEntries.some(([, v]) => v && typeof v === 'object' && !Array.isArray(v));
          const micNested = micEntries.some(([, v]) => v && typeof v === 'object' && !Array.isArray(v));
          const hasSusSection = antibioticsTested.length > 0 || susEntries.length > 0 || micEntries.length > 0;

          return (
            <View key={idx} style={styles.recordContainer}>
              {/* Record Header */}
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>{`Antibiogram Report ${idx + 1}`}</Text>
                {hasVal(record.date) && <Text style={styles.recordMeta}>{formatDate(record.date)}</Text>}
              </View>

              {/* 1. Provider Information */}
              {renderSectionFlow('Provider Information', [
                valueUnit('Reported By', record.reportedBy),
                valueUnit('Facility', record.facility),
              ])}

              {/* 2. Specimen Information */}
              {renderSectionFlow('Specimen Information', [
                valueUnit('Organism', record.organism),
                valueUnit('Specimen Source', record.specimenSource),
                dateUnit('Date', record.date),
              ])}

              {/* 3. Susceptibility Data — flat map via flow; nested (multi-organism) via matrix tables */}
              {hasSusSection && ((susNested || micNested) ? (
                <>
                  {antibioticsTested.length > 0 && renderSectionFlow('Susceptibility Data', [
                    arrayUnit('Antibiotics Tested', antibioticsTested),
                  ])}
                  {susNested && renderMatrix(antibioticsTested.length === 0 ? 'Susceptibility Data' : null, 'Susceptibilities', susEntries)}
                  {micNested && renderMatrix(null, 'MIC Values', micEntries)}
                </>
              ) : (
                renderSectionFlow('Susceptibility Data', [
                  arrayUnit('Antibiotics Tested', antibioticsTested),
                  objectUnit('Susceptibilities', susceptibilities),
                  objectUnit('MIC Values', micValue),
                ])
              ))}

              {/* 4. Resistance Analysis */}
              {renderSectionFlow('Resistance Analysis', [
                sentenceUnit('Resistance Pattern', record.resistancePattern),
                sentenceUnit('Method', record.method),
              ])}

              {/* 5. Clinical Interpretation */}
              {renderSectionFlow('Clinical Interpretation', [
                sentenceUnit('Interpretation', record.interpretation),
                sentenceUnit('Notes', record.notes),
              ])}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default AntibiogramReportsDocumentPDFTemplate;
