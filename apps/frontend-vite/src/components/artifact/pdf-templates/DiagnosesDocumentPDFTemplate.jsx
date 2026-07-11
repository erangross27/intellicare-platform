/**
 * DiagnosesDocumentPDFTemplate.jsx
 * July 2026 — Helvetica — LETTER — BLACK & WHITE only (#000000 titles/values, #999999 label rules).
 * Collection: diagnoses (one document per diagnosis; grouped by status).
 *
 * BOX-FREE canonical (one-pass items 9-11): page 14 / title 26 / statusGroupTitle 16 + 1pt black
 * rule / recordTitle 19 / fieldLabel 13 + 0.5pt #999 rule / values 14. Rule #74: wrap is BOOLEAN
 * only (count > 8); each field is its own glue unit; the status-group title + record title + Status
 * field ride together in the first wrap={false} header so a group title can never orphan. Every value
 * row numbered ("1." even singles). Mirrors the JSX exactly — status/date are plain fields (no badge
 * fills), severity/stage/prognosis sentence-split, notes sentence + labeled-comma with a continuous
 * counter, dateIdentified hidden on null/1970 sentinel.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, paddingBottom: 14, borderBottomWidth: 2, borderBottomColor: '#000000' },
  title: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: '#000000' },
  statusGroupTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 10, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordContainer: { paddingBottom: 8 },
  recordHeader: { marginBottom: 6 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 4 },
  fieldBlock: { marginBottom: 6 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 4, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  value: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2 },
  notesSubLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 2 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
});

/* ═══ UTILS ═══ */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/µm/g, 'um').replace(/μm/g, 'um').replace(/°/g, ' deg')
    .replace(/±/g, '+/-').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/²/g, '2')
    .replace(/→/g, '->').replace(/“/g, '"').replace(/”/g, '"')
    .replace(/‘/g, "'").replace(/’/g, "'").replace(/—/g, '-').replace(/–/g, '-');
  return str;
};

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try {
    const date = new Date(dateValue.$date || dateValue);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return String(dateValue);
  }
};

// ===== Text splitting helpers (parenthesis-aware) — mirror the JSX template =====
const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  const result = [];
  let current = '';
  let parenDepth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') parenDepth++;
    else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);
    if ((ch === '.' || ch === ';') && parenDepth === 0 && i + 1 < text.length && /\s/.test(text[i + 1])) {
      if (ch === '.' && /\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|etc)$/.test(current)) {
        current += ch;
        continue;
      }
      const trimmed = current.trim();
      if (trimmed) result.push(trimmed);
      current = '';
      while (i + 1 < text.length && /\s/.test(text[i + 1])) i++;
    } else {
      current += ch;
    }
  }
  const trimmed = current.replace(/[.;]+$/, '').trim();
  if (trimmed) result.push(trimmed);
  return result;
};

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { label: '', value: text || '', isLabeled: false };
  const colonIdx = text.indexOf(':');
  if (colonIdx > 0 && colonIdx <= 40) {
    const beforeColon = text.substring(0, colonIdx).trim();
    if (/^[A-Za-z][A-Za-z\s\-/()]*$/.test(beforeColon) && beforeColon.split(/\s+/).length <= 5) {
      const afterColon = text.substring(colonIdx + 1).trim();
      if (afterColon.length > 0) {
        return { label: beforeColon, value: afterColon, isLabeled: true };
      }
    }
  }
  return { label: '', value: text, isLabeled: false };
};

const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text];
  const parts = [];
  let current = '';
  let parenDepth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') parenDepth++;
    else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);
    if (ch === ',' && parenDepth === 0) {
      const trimmed = current.trim();
      if (trimmed) parts.push(trimmed);
      current = '';
    } else {
      current += ch;
    }
  }
  const trimmed = current.trim();
  if (trimmed) parts.push(trimmed);
  return parts.length > 1 ? parts : [text];
};

const hasValue = (val) => {
  if (val === null || val === undefined || val === '') return false;
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === 'string') return val.trim().length > 0;
  return true;
};

// dateIdentified is the onset date; treat null/empty and the 1970 epoch sentinel as "unknown".
const hasIdentifiedDate = (val) => {
  if (!hasValue(val)) return false;
  const d = new Date(val.$date || val);
  if (isNaN(d.getTime())) return false;
  return !(d.getUTCFullYear() === 1970 && d.getUTCMonth() === 0 && d.getUTCDate() === 1);
};

// Status display — TITLE case, mirrors the JSX getStatusText (the copy value).
const getStatusText = (status) => {
  switch (status) {
    case 'active': return 'Active';
    case 'chronic': return 'Chronic';
    case 'resolved': return 'Resolved';
    case 'ruled_out': return 'Ruled Out';
    default: return 'Active';
  }
};

const DiagnosesDocumentPDFTemplate = ({ document: data }) => {
  // Data unwrapping
  let rawRecords = [];
  if (Array.isArray(data)) {
    if (data.length > 0 && data[0]?.diagnoses) {
      rawRecords = data.flatMap(item => item.diagnoses || []);
    } else {
      rawRecords = data;
    }
  } else if (data?.diagnoses) {
    rawRecords = data.diagnoses;
  } else if (data) {
    rawRecords = [data];
  }

  // Clean records (drop _ prefixed helper fields)
  const records = rawRecords.map(record => {
    if (!record || typeof record !== 'object') return record;
    const cleanRecord = {};
    for (const key of Object.keys(record)) {
      if (!key.startsWith('_')) cleanRecord[key] = record[key];
    }
    return cleanRecord;
  });

  if (!Array.isArray(records) || records.length === 0) {
    return (
      <Document title="Diagnoses">
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.title}>Diagnoses</Text></View>
          <Text style={styles.emptyState}>No diagnosis records available.</Text>
        </Page>
      </Document>
    );
  }

  const activeDiagnoses = records.filter(dx => dx.status === 'active' || !dx.status);
  const chronicDiagnoses = records.filter(dx => dx.status === 'chronic');
  const resolvedDiagnoses = records.filter(dx => dx.status === 'resolved');
  const ruledOutDiagnoses = records.filter(dx => dx.status === 'ruled_out');

  // One flowing field: sub-label + 0.5pt rule + numbered value rows. wrap is boolean (Rule #74).
  const renderField = (label, values, key) => (
    <View key={key} style={styles.fieldBlock} wrap={values.length > 8}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {values.map((v, i) => (
        <Text key={i} style={styles.value}>{`${i + 1}. ${safeString(v)}`}</Text>
      ))}
    </View>
  );

  // Render one diagnosis. The status-group title + record title + Status field ride together in a
  // single wrap={false} header so the group title can never orphan at a page bottom. Remaining fields
  // each flow as their own glue unit.
  const renderRecord = (dx, idx, displayNum, groupTitle) => {
    const fields = [];
    if (hasValue(dx.diagnosis)) fields.push(['Diagnosis', splitByComma(safeString(dx.diagnosis))]);
    if (hasValue(dx.icdCode)) fields.push(['ICD Code', [safeString(dx.icdCode)]]);
    if (hasValue(dx.type)) fields.push(['Type', [safeString(dx.type)]]);
    if (hasValue(dx.severity)) fields.push(['Severity', splitBySentence(safeString(dx.severity))]);
    if (hasValue(dx.stage)) fields.push(['Stage', splitBySentence(safeString(dx.stage))]);
    if (hasValue(dx.laterality)) fields.push(['Laterality', [safeString(dx.laterality)]]);
    if (hasIdentifiedDate(dx.dateIdentified)) fields.push(['Date Identified', [safeString(formatDate(dx.dateIdentified))]]);
    if (hasValue(dx.provider)) fields.push(['Provider', [safeString(dx.provider)]]);
    if (hasValue(dx.facility)) fields.push(['Facility', [safeString(dx.facility)]]);
    if (hasValue(dx.prognosis)) {
      const prog = Array.isArray(dx.prognosis) ? dx.prognosis.join(', ') : safeString(dx.prognosis);
      fields.push(['Prognosis', splitBySentence(prog)]);
    }
    if (hasValue(dx.clinicalSignificance)) {
      const cs = Array.isArray(dx.clinicalSignificance) ? dx.clinicalSignificance.join(', ') : safeString(dx.clinicalSignificance);
      fields.push(['Clinical Significance', [cs]]);
    }
    if (hasValue(dx.targetIOp)) fields.push(['Target IOP', [safeString(dx.targetIOp)]]);

    // Notes — sentence + labeled-comma split, continuous counter (mirrors JSX/copy).
    const noteSentences = hasValue(dx.notes) ? splitBySentence(safeString(dx.notes)) : [];
    let noteRowCount = 0;
    noteSentences.forEach((s) => {
      const p = parseLabel(s);
      const it = p.isLabeled ? splitByComma(p.value) : [];
      noteRowCount += (p.isLabeled && it.length >= 3) ? (1 + it.length) : 1;
    });
    let noteNum = 0;

    const riskItems = hasValue(dx.riskFactors)
      ? (Array.isArray(dx.riskFactors)
          ? dx.riskFactors.flatMap(it => splitByComma(String(it)))
          : splitByComma(safeString(dx.riskFactors)))
      : [];

    // Each diagnosis starts on its OWN page (break on every record after the first overall).
    // This eliminates cross-record text overprint — every record gets a full fresh page.
    return (
      <View key={idx} style={styles.recordContainer} break={displayNum > 1}>
        {/* Header glue unit: group title (first record only) + record title + Status field */}
        <View style={styles.recordHeader} wrap={false}>
          {groupTitle && <Text style={styles.statusGroupTitle}>{groupTitle}</Text>}
          <Text style={styles.recordTitle}>{`Diagnoses ${displayNum}`}</Text>
          <Text style={styles.fieldLabel}>Status</Text>
          <Text style={styles.value}>{`1. ${getStatusText(dx.status)}`}</Text>
        </View>

        {fields.map(([label, values], fi) => renderField(label, values, `f-${fi}`))}

        {/* Notes */}
        {noteSentences.length > 0 && (
          <View style={styles.fieldBlock} wrap={noteRowCount > 8}>
            <Text style={styles.fieldLabel}>Notes</Text>
            {noteSentences.map((sentence, sIdx) => {
              const parsed = parseLabel(sentence);
              const commaItems = parsed.isLabeled ? splitByComma(parsed.value) : [];
              if (parsed.isLabeled && commaItems.length >= 3) {
                return (
                  <View key={sIdx}>
                    <Text style={styles.notesSubLabel}>{`${parsed.label}:`}</Text>
                    {commaItems.map((item, cIdx) => {
                      noteNum += 1;
                      return <Text key={cIdx} style={styles.value}>{`${noteNum}. ${item}`}</Text>;
                    })}
                  </View>
                );
              }
              noteNum += 1;
              return <Text key={sIdx} style={styles.value}>{`${noteNum}. ${sentence}`}</Text>;
            })}
          </View>
        )}

        {/* Risk Factors — LAST (mirrors JSX field order) */}
        {riskItems.length > 0 && renderField('Risk Factors', riskItems, 'risk')}
      </View>
    );
  };

  // Flatten every group into one ordered list so each record View is a DIRECT child of <Page>
  // — react-pdf only honours `break` on direct page children (a wrapper View swallows it).
  // The status-group title rides inside the first record of its group (groupTitle arg).
  const ordered = [];
  let displayNum = 1;
  [
    ['Active Diagnoses', activeDiagnoses],
    ['Chronic Conditions', chronicDiagnoses],
    ['Resolved Diagnoses', resolvedDiagnoses],
    ['Ruled Out', ruledOutDiagnoses],
  ].forEach(([title, list]) => {
    list.forEach((dx, i) => {
      ordered.push({ dx, displayNum, groupTitle: i === 0 ? title : undefined });
      displayNum += 1;
    });
  });

  return (
    <Document title="Diagnoses">
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Diagnoses</Text></View>

        {ordered.map((o, idx) => renderRecord(o.dx, idx, o.displayNum, o.groupTitle))}
      </Page>
    </Document>
  );
};

export default DiagnosesDocumentPDFTemplate;
