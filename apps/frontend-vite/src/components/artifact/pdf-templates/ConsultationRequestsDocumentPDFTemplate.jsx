/**
 * ConsultationRequestsDocumentPDFTemplate.jsx
 * Box-free line-based layout (ConsultationNotes donor) — LETTER — B&W.
 * react-pdf 4.5.1 rules: wrap = BOOLEANS (explicit undefined = unbreakable); recordContainer paddingBottom only
 * + break={idx>0} (Rule #75); sectionTitle rides INSIDE the section's field View (anti-orphan).
 * 4-area mirror: guarded splitBySentence (splits '.' AND ';', abbrev-safe) + splitByComma (>=3),
 * every value row numbered "1."; datetime fields show their time (requestedDateTime 20:42).
 * Collection: consultation_requests
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, borderBottomWidth: 2, borderBottomColor: '#000000', paddingBottom: 12 },
  title: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1 },
  recordContainer: { paddingBottom: 8 },
  recordHeader: { marginBottom: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', textTransform: 'uppercase', letterSpacing: 0.5, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 3, marginBottom: 8 },
  fieldUnit: { marginBottom: 6 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#000000', borderBottomWidth: 0.5, borderBottomColor: '#999999', paddingBottom: 3, marginBottom: 4 },
  subLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', borderBottomWidth: 0.5, borderBottomColor: '#999999', paddingBottom: 2, marginTop: 4, marginBottom: 3 },
  listItem: { fontSize: 14, color: '#000000', marginBottom: 3, paddingLeft: 8, lineHeight: 1.4 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, fontSize: 10, color: '#000000', borderTopWidth: 1, borderTopColor: '#000000', paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 10, color: '#000000' },
});

/* ═══ UTILS ═══ */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/µm/g, 'um').replace(/μm/g, 'um').replace(/°/g, ' deg')
    .replace(/±/g, '+/-').replace(/≥/g, '>=').replace(/≤/g, '<=')
    .replace(/→/g, '->').replace(/“/g, '"').replace(/”/g, '"')
    .replace(/‘/g, "'").replace(/’/g, "'").replace(/—/g, '-').replace(/–/g, '-');
  return str;
};

const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const formatDateTime = (d) => {
  if (!d) return '';
  try {
    const dt = new Date(d.$date || d); if (isNaN(dt.getTime())) return String(d);
    const datePart = dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    if (dt.getHours() === 0 && dt.getMinutes() === 0) return datePart;
    return `${datePart}, ${dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  } catch { return String(d); }
};
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };

// Abbreviation+decimal guard; splits on BOTH '.' and ';'.
const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9 /()-]{1,40}):\s*(.+)$/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

// paren-aware; keep Oxford "and/or"; skip no-space commas and date commas.
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let cur = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      const rest = text.slice(i + 1);
      if (!/^\s/.test(rest)) { cur += ch; continue; }
      if (/^\s+(?:and|or)\b/i.test(rest)) { cur += ch; continue; }
      if (/\d\s*$/.test(cur) && /^\s*\d{4}\b/.test(rest)) { cur += ch; continue; }
      const t = cur.trim(); if (t) result.push(t); cur = '';
    } else cur += ch;
  }
  const t = cur.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* One field unit: LABEL (0.5pt rule) + a single numbered value row. */
const renderFieldRow = (label, value) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldUnit} wrap={false}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.listItem}>1. {safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* Sentence field → sectionTitle inside; splitBySentence then comma-split (>=3 → sub-label + rows). */
const renderSentenceField = (label, text, sectionTitle) => {
  if (!hasVal(text)) return null;
  const sentences = splitBySentence(fmtVal(text));
  if (sentences.length === 0) return null;

  const rows = []; let n = 1;
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const commaItems = splitByComma(parsed.value);
      if (commaItems.length >= 3) {
        rows.push({ type: 'sub', text: safeString(parsed.label) });
        commaItems.forEach(ci => rows.push({ type: 'item', text: safeString(ci), num: n++ }));
      } else rows.push({ type: 'item', text: safeString(s), num: n++ });
    } else rows.push({ type: 'item', text: safeString(s), num: n++ });
  });

  const items = rows.filter(r => r.type === 'item').length;
  return (
    <View style={styles.section} wrap={items > 8 ? true : false}>
      <Text style={styles.sectionTitle}>{sectionTitle || label}</Text>
      {rows.map((row, i) => row.type === 'sub'
        ? <Text key={i} style={styles.subLabel}>{row.text}</Text>
        : <Text key={i} style={styles.listItem}>{row.num}. {row.text}</Text>)}
    </View>
  );
};

/* Array section → sectionTitle inside, numbered rows. */
const renderArraySection = (title, arr) => {
  const items = (Array.isArray(arr) ? arr : []).filter(x => x !== null && x !== undefined && String(x).trim() !== '');
  if (items.length === 0) return null;
  return (
    <View style={styles.section} wrap={items.length > 8 ? true : false}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.map((item, ri) => (
        <Text key={ri} style={styles.listItem}>{ri + 1}. {safeString(typeof item === 'string' ? item : String(item || ''))}</Text>
      ))}
    </View>
  );
};

/* ═══ COMPONENT ═══ */
const ConsultationRequestsDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.consultation_requests) return Array.isArray(r.consultation_requests) ? r.consultation_requests : [r.consultation_requests];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.consultation_requests) return Array.isArray(dd.consultation_requests) ? dd.consultation_requests : [dd.consultation_requests]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.title}>Consultation Requests</Text></View>
          <Text style={styles.emptyState}>No records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Consultation Requests</Text></View>

        {records.map((record, idx) => {
          const hasRequestInfo = hasVal(record.requestingProviderId) || hasVal(record.requestingProviderName) || hasVal(record.requestingDepartment) || hasVal(record.consultingSpecialty) || hasVal(record.consultingProviderId) || hasVal(record.consultingProviderName) || hasVal(record.urgencyLevel) || hasVal(record.date);
          const hasScheduling = hasVal(record.requestedDateTime) || hasVal(record.desiredCompletionDateTime) || hasVal(record.appointmentScheduledDateTime);
          const hasLogistics = hasVal(record.consultationMode) || hasVal(record.encounterType) || hasVal(record.locationOfService) || hasVal(record.requestIntent) || hasVal(record.authorizationRequired) || hasVal(record.authorizationNumber);

          return (
            // Rule #75: every record after the first STARTS ON A NEW PAGE; never record 0.
            <View key={idx} style={styles.recordContainer} break={idx > 0}>
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>{`Consultation Request ${idx + 1}`}</Text>
              </View>

              {hasRequestInfo && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Request Information</Text>
                  {record.date && renderFieldRow('Date', formatDate(record.date))}
                  {renderFieldRow('Requesting Provider ID', record.requestingProviderId)}
                  {renderFieldRow('Requesting Provider', record.requestingProviderName)}
                  {renderFieldRow('Requesting Department', record.requestingDepartment)}
                  {renderFieldRow('Consulting Specialty', record.consultingSpecialty)}
                  {renderFieldRow('Consulting Provider ID', record.consultingProviderId)}
                  {renderFieldRow('Consulting Provider', record.consultingProviderName)}
                  {renderFieldRow('Urgency Level', record.urgencyLevel)}
                </View>
              )}

              {hasScheduling && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Scheduling</Text>
                  {hasVal(record.requestedDateTime) && renderFieldRow('Requested Date/Time', formatDateTime(record.requestedDateTime))}
                  {hasVal(record.desiredCompletionDateTime) && renderFieldRow('Desired Completion Date/Time', formatDateTime(record.desiredCompletionDateTime))}
                  {hasVal(record.appointmentScheduledDateTime) && renderFieldRow('Appointment Scheduled Date/Time', formatDateTime(record.appointmentScheduledDateTime))}
                </View>
              )}

              {renderSentenceField('Reason for Consultation', record.reasonForConsultation, 'Reason for Consultation')}
              {renderSentenceField('Clinical Question', record.clinicalQuestion, 'Clinical Question')}
              {renderSentenceField('Priority Reason', record.priorityReason, 'Priority Reason')}

              {renderArraySection('Relevant Diagnoses', record.relevantDiagnoses)}
              {renderArraySection('Pertinent Imaging Studies', record.pertinentImagingStudies)}
              {renderArraySection('Pertinent Lab Results', record.pertinentLabResults)}
              {renderArraySection('Current Medications', record.currentMedications)}
              {renderArraySection('Supporting Documents', record.supportingDocuments)}

              {hasLogistics && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Logistics</Text>
                  {renderFieldRow('Consultation Mode', record.consultationMode)}
                  {renderFieldRow('Encounter Type', record.encounterType)}
                  {renderFieldRow('Location of Service', record.locationOfService)}
                  {renderFieldRow('Request Intent', record.requestIntent)}
                  {hasVal(record.authorizationRequired) && renderFieldRow('Authorization Required', record.authorizationRequired)}
                  {renderFieldRow('Authorization Number', record.authorizationNumber)}
                </View>
              )}

              {renderSentenceField('Performer Instructions', record.performerInstructions, 'Performer Instructions')}
            </View>
          );
        })}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Protected Health Information (PHI) - Handle according to HIPAA guidelines</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
};

export default ConsultationRequestsDocumentPDFTemplate;
