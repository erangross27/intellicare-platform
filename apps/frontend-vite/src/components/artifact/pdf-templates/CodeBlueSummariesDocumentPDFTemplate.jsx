/**
 * CodeBlueSummariesDocumentPDFTemplate.jsx
 * Box-free line-based layout (ConsultationNotes donor) — LETTER size — B&W.
 * react-pdf 4.5.1 engine rules: wrap props are BOOLEANS (explicit undefined = unbreakable);
 * recordContainer paddingBottom only (marginBottom → empty page 1) + break={idx>0} (Rule #75, each
 * record starts a new page); sectionTitle rides INSIDE the first field's View (anti-orphan, 6a2d6af6).
 * Every value numbered ("1." even for singles); booleans Yes/No; datetimes formatted; sentence fields
 * split into numbered rows; arrays label + numbered items. Mirrors Copy Section/Copy All.
 * Collection: code_blue_summaries
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000' },
  title: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1 },
  recordContainer: { paddingBottom: 8 },
  recordHeader: { marginBottom: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  recordMeta: { fontSize: 12, color: '#000000', marginTop: 4 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', textTransform: 'uppercase', letterSpacing: 0.5, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 3, marginBottom: 8 },
  fieldUnit: { marginBottom: 6 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#000000', borderBottomWidth: 0.5, borderBottomColor: '#999999', paddingBottom: 3, marginBottom: 4 },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 3, paddingLeft: 8 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
});

const hasVal = (v) => { if (v === null || v === undefined) return false; if (typeof v === 'number') return true; if (typeof v === 'boolean') return true; if (typeof v === 'string') return v.trim().length > 0; if (Array.isArray(v)) return v.length > 0; return Boolean(v); };
const formatBoolean = (v) => { if (v === true || v === 'true') return 'Yes'; if (v === false || v === 'false') return 'No'; return String(v || ''); };
const formatDate = (d) => { if (!d) return ''; try { const x = new Date(d.$date || d); return isNaN(x.getTime()) ? String(d) : x.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const formatDateTime = (d) => { if (!d) return ''; try { const x = new Date(d.$date || d); return isNaN(x.getTime()) ? String(d) : x.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch { return String(d); } };
// Abbreviation+decimal guard: never break on "Dr. Smith", "vs. standard", "3.5 mg"
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };

const BOOLEAN_FIELDS = [
  'epinephrineAdministered', 'acslsProtocolFollowed', 'returnOfSpontaneousCirculation',
  'intubationPerformed', 'amiodaroneAdministered', 'sodiumBicarbonateGiven',
  'witnessedArrest', 'utsteincriteriaMet', 'targetedTemperatureManagement',
];
const DATETIME_FIELDS = ['codeBlueActivationTime', 'cprStartTime', 'cprEndTime', 'roscTime'];
const ARRAY_FIELDS = ['vasopressorsAdministered'];
const SENTENCE_FIELDS = ['precipitatingFactor', 'locationOfCodeBlue'];

const FIELD_LABELS = {
  codeBlueActivationTime: 'Activation Time', locationOfCodeBlue: 'Location', witnessedArrest: 'Witnessed Arrest',
  teamLeaderRole: 'Team Leader', cprStartTime: 'CPR Start Time', cprEndTime: 'CPR End Time',
  totalCprDuration: 'Total CPR Duration (min)', initialRhythm: 'Initial Rhythm', numberOfDefibrillations: 'Defibrillations',
  acslsProtocolFollowed: 'ACLS Protocol Followed', epinephrineAdministered: 'Epinephrine Administered',
  epinephrineDoses: 'Epinephrine Doses', amiodaroneAdministered: 'Amiodarone Administered',
  sodiumBicarbonateGiven: 'Sodium Bicarbonate Given', vasopressorsAdministered: 'Vasopressors',
  returnOfSpontaneousCirculation: 'Return of Spontaneous Circulation', roscTime: 'ROSC Time',
  timeToRosc: 'Time to ROSC (min)', endTidalCo2: 'End-Tidal CO2', intubationPerformed: 'Intubation Performed',
  intubationAttempts: 'Intubation Attempts', codeBlueOutcome: 'Outcome', precipitatingFactor: 'Precipitating Factor',
  utsteincriteriaMet: 'Utstein Criteria Met', targetedTemperatureManagement: 'Targeted Temperature Management',
};

// Return the field's display rows (array of strings), or null if empty.
const fieldRows = (record, f) => {
  if (ARRAY_FIELDS.includes(f)) {
    const arr = (Array.isArray(record[f]) ? record[f] : []).filter(hasVal);
    return arr.length ? arr.map(String) : null;
  }
  const val = record[f];
  if (!hasVal(val)) return null;
  if (BOOLEAN_FIELDS.includes(f)) return [formatBoolean(val)];
  if (DATETIME_FIELDS.includes(f)) return [formatDateTime(val)];
  if (SENTENCE_FIELDS.includes(f)) { const s = splitBySentence(String(val)); return s.length ? s : [String(val)]; }
  return [String(val)];
};

/* One field = one wrap-gated glue View; sectionTitle rides inside the FIRST present field's View. */
const renderField = ([label, rows], title, isFirst) => (
  <View key={label} style={styles.fieldUnit} wrap={rows.length + 2 > 8 ? true : false}>
    {isFirst ? <Text style={styles.sectionTitle}>{title}</Text> : null}
    <Text style={styles.fieldLabel}>{label}</Text>
    {rows.map((r, i) => <Text key={i} style={styles.listItem}>{i + 1}. {r}</Text>)}
  </View>
);

const renderSection = (record, title, fields) => {
  const present = fields.map(f => { const rows = fieldRows(record, f); return rows ? [FIELD_LABELS[f] || f, rows] : null; }).filter(Boolean);
  if (present.length === 0) return null;
  return (
    <View key={title} style={styles.section}>
      {present.map((p, fi) => renderField(p, title, fi === 0))}
    </View>
  );
};

const CodeBlueSummariesDocumentPDFTemplate = ({ document: data }) => {
  let records = [];
  if (Array.isArray(data)) {
    records = data;
  } else if (data?.code_blue_summaries) {
    records = Array.isArray(data.code_blue_summaries) ? data.code_blue_summaries : [data.code_blue_summaries];
  } else if (data?.documentData) {
    const d = data.documentData;
    records = Array.isArray(d) ? d : (d?.code_blue_summaries ? (Array.isArray(d.code_blue_summaries) ? d.code_blue_summaries : [d.code_blue_summaries]) : [d]);
  } else if (data && typeof data === 'object') {
    records = [data];
  }
  records = records.filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.title}>Code Blue Summaries</Text></View>
          <Text style={styles.emptyState}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Code Blue Summaries</Text></View>
        {records.map((record, idx) => (
          // Rule #75: every record after the first STARTS ON A NEW PAGE; never on record 0.
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>Code Blue Summary {idx + 1}</Text>
              {record.codeBlueActivationTime ? <Text style={styles.recordMeta}>{formatDate(record.codeBlueActivationTime)}</Text> : null}
            </View>

            {renderSection(record, 'Activation & Location', ['codeBlueActivationTime', 'locationOfCodeBlue', 'witnessedArrest', 'teamLeaderRole'])}
            {renderSection(record, 'CPR Details', ['cprStartTime', 'cprEndTime', 'totalCprDuration', 'initialRhythm', 'numberOfDefibrillations', 'acslsProtocolFollowed'])}
            {renderSection(record, 'Medications', ['epinephrineAdministered', 'epinephrineDoses', 'amiodaroneAdministered', 'sodiumBicarbonateGiven', 'vasopressorsAdministered'])}
            {renderSection(record, 'ROSC & Airway', ['returnOfSpontaneousCirculation', 'roscTime', 'timeToRosc', 'endTidalCo2', 'intubationPerformed', 'intubationAttempts'])}
            {renderSection(record, 'Outcome', ['codeBlueOutcome', 'precipitatingFactor', 'utsteincriteriaMet', 'targetedTemperatureManagement'])}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default CodeBlueSummariesDocumentPDFTemplate;
