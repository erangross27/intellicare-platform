/**
 * FamilyMeetingNotesDocumentPDFTemplate.jsx
 * July 2026 — Helvetica — LETTER size — BLACK & WHITE ONLY (#000000, no color/no boxes)
 * Data collection: family_meeting_notes
 *
 * Box-free — underlines only (documentTitle 2pt, sectionTitle 1pt black, fieldLabel 0.5pt #999).
 * Rule #74 — sections are wrap={false} atomic blocks (never the unbreakable ternary wrap idiom);
 * sectionTitle rides INSIDE the section View as its first child (never an orphaned sibling).
 * splitBySentence splits on [.;]. Every flat scalar field renders a standalone label (JSX/PDF parity).
 * `date` is the clinical meeting date the JSX edits; createdAt/updatedAt (ingestion) are never rendered.
 * PHI footer is STATIC ONLY (a dynamic page-number render callback crashes react-pdf 4.5.1 on 3+ pages).
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', marginBottom: 16, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 20 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 10 },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  groupLabel: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 4 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  fieldValue: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 4 },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  noDataText: { fontSize: 12, color: '#000000', textAlign: 'center', marginTop: 40 },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, borderTopWidth: 0.5, borderTopColor: '#999999', paddingTop: 8 },
  footerText: { fontSize: 10, color: '#666666' },
});

/* ═══ UTILS ═══ */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : (typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val));
  return str.replace(/µm/g, 'um').replace(/μm/g, 'um').replace(/°/g, ' deg')
    .replace(/±/g, '+/-').replace(/≥/g, '>=').replace(/≤/g, '<=')
    .replace(/→/g, '->').replace(/“/g, '"').replace(/”/g, '"')
    .replace(/‘/g, "'").replace(/’/g, "'").replace(/—/g, '-').replace(/–/g, '-');
};
const hasStr = (v) => v !== null && v !== undefined && String(v).trim() !== '';
const humanizeKey = (key) => { if (key === null || key === undefined || key === '') return ''; const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); return s.charAt(0).toUpperCase() + s.slice(1); };
const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { return new Date(dateValue.$date || dateValue).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};
const splitByComma = (text) => {
  if (!text) return [];
  const s = String(text); const out = []; let cur = ''; let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(') { depth++; cur += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); cur += ch; }
    else if (ch === ',' && depth === 0) {
      const nx = s[i + 1] || ''; const nextWord = s.slice(i + 1).trim().split(/\s+/)[0] || '';
      if (/\d/.test(nx.trim()) || /^(and|or)\b/i.test(nextWord)) { cur += ch; }
      else { const t = cur.trim(); if (t) out.push(t); cur = ''; }
    } else cur += ch;
  }
  const t = cur.trim(); if (t) out.push(t);
  return out.length ? out : [String(text)];
};

/* one labeled scalar field: standalone label + value below */
const Field = ({ label, value }) => (hasStr(value) ? (
  <View>
    <Text style={styles.fieldLabel}>{label}</Text>
    <Text style={styles.fieldValue}>{safeString(value)}</Text>
  </View>
) : null);

/* sentence field → numbered rows; labeled sentence → sub-group */
const sentenceRows = (text) => {
  const sentences = splitBySentence(String(text || ''));
  let n = 0;
  const out = [];
  sentences.forEach((s, sIdx) => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const items = splitByComma(parsed.value);
      out.push(<Text key={`l${sIdx}`} style={styles.groupLabel}>{safeString(parsed.label)}</Text>);
      items.forEach((it, i) => out.push(<Text key={`l${sIdx}-${i}`} style={styles.listItem}>{i + 1}. {safeString(it)}</Text>));
    } else {
      n += 1;
      out.push(<Text key={`s${sIdx}`} style={styles.listItem}>{n}. {safeString(s.replace(/[;.]+$/, '').trim())}</Text>);
    }
  });
  return out;
};

/* recursive object node (results): label = bold heading; value = plain line below (stacked) */
const renderObjectNode = (label, value, keyPath, depth) => {
  if (isEmptyDeep(value)) return null;
  if (isScalar(value)) {
    return (
      <View key={keyPath}>
        {label ? <Text style={depth > 1 ? styles.fieldLabel : styles.groupLabel}>{safeString(label)}</Text> : null}
        <Text style={styles.fieldValue}>{safeString(fmtScalar(value))}</Text>
      </View>
    );
  }
  const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  return (
    <View key={keyPath}>
      {label ? <Text style={styles.groupLabel}>{safeString(label)}</Text> : null}
      {entries.map(([k, v]) => renderObjectNode(humanizeKey(k), v, `${keyPath}-${k}`, depth + 1))}
    </View>
  );
};

const NOTES_FIELDS = [['findings', 'Findings'], ['assessment', 'Assessment'], ['plan', 'Plan'], ['notes', 'Notes']];

const FamilyMeetingNotesDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.family_meeting_notes) return Array.isArray(r.family_meeting_notes) ? r.family_meeting_notes : [r.family_meeting_notes];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.family_meeting_notes) return Array.isArray(dd.family_meeting_notes) ? dd.family_meeting_notes : [dd.family_meeting_notes]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Family Meeting Notes</Text>
          <Text style={styles.noDataText}>No family meeting notes records available.</Text>
        </Page>
      </Document>
    );
  }

  const arrSection = (title, arr) => {
    const items = Array.isArray(arr) ? arr.filter(hasStr) : [];
    if (items.length === 0) return null;
    return (
      <View style={styles.section} wrap={false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {items.map((it, i) => <Text key={i} style={styles.listItem}>{i + 1}. {safeString(it)}</Text>)}
      </View>
    );
  };

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Family Meeting Notes</Text>
        {records.map((record, idx) => {
          const results = record.results;
          const resultsEntries = (!isEmptyDeep(results) && !isScalar(results)) ? Object.entries(results).filter(([, v]) => !isEmptyDeep(v)) : [];
          const recs = Array.isArray(record.recommendations) ? record.recommendations.filter(r => !isEmptyDeep(r)) : [];
          const notesFields = NOTES_FIELDS.filter(([k]) => hasStr(record[k]));

          return (
            <View key={idx} style={styles.recordContainer} break={idx > 0}>
              <Text style={styles.recordTitle}>Family Meeting Notes {idx + 1}</Text>

              {/* Session Information */}
              {(hasStr(record.date) || hasStr(record.provider) || hasStr(record.facility) || hasStr(record.status)) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Session Information</Text>
                  <Field label="Date" value={record.date ? formatDate(record.date) : ''} />
                  <Field label="Provider" value={record.provider} />
                  <Field label="Facility" value={record.facility} />
                  <Field label="Status" value={record.status} />
                </View>
              )}

              {arrSection('Attendees', record.attendees)}
              {arrSection('Discussion Points', record.discussionPoints)}
              {arrSection('Family Concerns', record.familyConcerns)}
              {arrSection('Decisions', record.decisions)}

              {/* Support Needed (single-name) */}
              {hasStr(record.supportNeeded) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Support Needed</Text>
                  {sentenceRows(record.supportNeeded)}
                </View>
              )}

              {/* Results (recursive object) */}
              {resultsEntries.length > 0 && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Results</Text>
                  {resultsEntries.map(([k, v]) => renderObjectNode(humanizeKey(k), v, `results-${k}`, 1))}
                </View>
              )}

              {/* Recommendations */}
              {recs.length > 0 && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Recommendations</Text>
                  {recs.map((r, i) => <Text key={i} style={styles.listItem}>{i + 1}. {safeString((r?.recommendation || r).toString().trim())}{hasStr(r?.date) ? ` (${safeString(r.date)})` : ''}</Text>)}
                </View>
              )}

              {/* Notes & Assessment (findings / assessment / plan / notes) */}
              {notesFields.length > 0 && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Notes &amp; Assessment</Text>
                  {notesFields.map(([k, lbl]) => (
                    <View key={k}>
                      <Text style={styles.fieldLabel}>{lbl}</Text>
                      {sentenceRows(record[k])}
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Protected Health Information (PHI) - Handle according to HIPAA guidelines</Text>
        </View>
      </Page>
    </Document>
  );
};

export default FamilyMeetingNotesDocumentPDFTemplate;
