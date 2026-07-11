/**
 * PostOperativeReportsDocumentPDFTemplate.jsx
 * Box-free B&W — Helvetica — LETTER size — post-operative reports
 * Collection: post_operative_reports
 * Clinical date = record.surgeryDate (NOT createdAt/updatedAt ingestion timestamps).
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, color: '#000000', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid', marginBottom: 16 },
  recordContainer: { marginBottom: 20 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 12 },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid', marginBottom: 8 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid', marginBottom: 3 },
  fieldValue: { fontSize: 14, lineHeight: 1.5, color: '#000000' },
  nestedSubtitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 2 },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  separator: { marginTop: 16, marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 14, color: '#000000', textAlign: 'center', marginTop: 40 },
});

/* ======= FIELD MAPS (mirror the JSX) ======= */
const SECTION_TITLES = {
  'surgery-info': 'Surgery Information',
  'complications': 'Complications',
  'pacu-info': 'PACU Information',
  'vital-signs': 'Vital Signs',
  'pain-management': 'Pain Management',
  'recovery-status': 'Recovery Status',
  'mobility-diet': 'Mobility, Diet & Disposition',
  'discharge-info': 'Discharge & Follow-Up',
  'prescriptions-restrictions': 'Prescriptions & Restrictions',
  'recommendations': 'Recommendations',
};

const FIELD_LABELS = {
  surgeryDate: 'Surgery Date',
  procedurePerformed: 'Procedure Performed',
  surgicalFindings: 'Surgical Findings',
  complications: 'Complications',
  pacuArrival: 'PACU Arrival',
  pacuDischarge: 'PACU Discharge',
  vitalSignsTrend: 'Vital Signs Trend',
  painLevel: 'Pain Level',
  painManagement: 'Pain Management',
  nausea: 'Nausea / Vomiting',
  urineOutput: 'Urine Output',
  drainOutput: 'Drain Output',
  oxygenRequirement: 'Oxygen Requirement',
  mobilityStatus: 'Mobility Status',
  diet: 'Diet',
  disposition: 'Disposition',
  dischargeInstructions: 'Discharge Instructions',
  followUpPlan: 'Follow-Up Plan',
  prescriptions: 'Prescriptions',
  activityRestrictions: 'Activity Restrictions',
  returnPrecautions: 'Return Precautions',
  recommendations: 'Recommendations',
};

const SECTION_CONFIGS = [
  { sid: 'surgery-info', title: 'Surgery Information', fields: ['surgeryDate', 'procedurePerformed', 'surgicalFindings'] },
  { sid: 'complications', title: 'Complications', fields: ['complications'] },
  { sid: 'pacu-info', title: 'PACU Information', fields: ['pacuArrival', 'pacuDischarge'] },
  { sid: 'vital-signs', title: 'Vital Signs', fields: ['vitalSignsTrend'] },
  { sid: 'pain-management', title: 'Pain Management', fields: ['painLevel', 'painManagement'] },
  { sid: 'recovery-status', title: 'Recovery Status', fields: ['nausea', 'urineOutput', 'drainOutput', 'oxygenRequirement'] },
  { sid: 'mobility-diet', title: 'Mobility, Diet & Disposition', fields: ['mobilityStatus', 'diet', 'disposition'] },
  { sid: 'discharge-info', title: 'Discharge & Follow-Up', fields: ['dischargeInstructions', 'followUpPlan'] },
  { sid: 'prescriptions-restrictions', title: 'Prescriptions & Restrictions', fields: ['prescriptions', 'activityRestrictions', 'returnPrecautions'] },
  { sid: 'recommendations', title: 'Recommendations', fields: ['recommendations'] },
];

const DATE_FIELDS = ['surgeryDate'];
/* Genuine comma-list strings → per-item rows (mirror the JSX COMMA_FIELDS). */
const COMMA_FIELDS = ['prescriptions', 'activityRestrictions'];

/* ======= UTILS ======= */
const hasVal = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number') return true;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  return true;
};

const sameAsTitle = (label, sid) => String(label || '').trim().toLowerCase() === String(SECTION_TITLES[sid] || '').trim().toLowerCase();

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

/* Helvetica (WinAnsi) has no U+00D7 multiplication sign glyph → render it as 'x'. */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  return String(val).replace(/×/g, 'x').trim();
};

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)[.;](?:\s+)/).map(s => s.replace(/^\d+\.\s+/, '').trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) {
      const nextIsSpace = /\s/.test(text[i + 1] || '');
      const nextIsYear = /^\s*\d{4}\b/.test(text.slice(i + 1));
      if (nextIsSpace && !nextIsYear) { const t = current.trim(); if (t) result.push(t); current = ''; }
      else { current += ch; } // keep thousands separators + years whole
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* Sentence/labeled-comma rows mirroring the JSX formatSentenceFieldLines structure. */
const sentenceRows = (text) => {
  const sentences = splitBySentence(text);
  const els = []; let n = 1;
  sentences.forEach((s, si) => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      els.push(<Text key={`l${si}`} style={styles.nestedSubtitle}>{safeString(parsed.label)}</Text>);
      const parts = splitByComma(parsed.value);
      if (parts.length >= 2) {
        parts.forEach((item, pi) => els.push(<Text key={`l${si}i${pi}`} style={styles.listItem}>{n++}. {safeString(item)}</Text>));
      } else {
        els.push(<Text key={`l${si}v`} style={styles.listItem}>{n++}. {safeString(parsed.value)}</Text>);
      }
    } else {
      els.push(<Text key={`s${si}`} style={styles.listItem}>{n++}. {safeString(s)}</Text>);
    }
  });
  return els;
};

const fieldPresent = (fn, val) => {
  if (fn === 'recommendations') return Array.isArray(val) && val.filter(Boolean).length > 0;
  return hasVal(val);
};

/* ======= FIELD RENDERER — returns a bare <View style={fieldBox}> (glue owns the only wrap=false) ======= */
const renderField = (fn, val, sid) => {
  const label = FIELD_LABELS[fn] || fn;
  const showLabel = !sameAsTitle(label, sid);

  if (DATE_FIELDS.includes(fn)) {
    return (
      <View key={fn} style={styles.fieldBox}>
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        <Text style={styles.fieldValue}>{formatDate(val)}</Text>
      </View>
    );
  }

  if (fn === 'recommendations') {
    const items = Array.isArray(val) ? val.filter(Boolean) : [];
    return (
      <View key={fn} style={styles.fieldBox}>
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {items.map((item, i) => {
          const isObj = typeof item === 'object' && item !== null;
          const recText = isObj ? (item.recommendation || '') : String(item);
          const recDate = isObj && item.date ? formatDate(item.date) : '';
          return <Text key={i} style={styles.listItem}>{i + 1}. {recDate ? `[${recDate}] ` : ''}{safeString(recText)}</Text>;
        })}
      </View>
    );
  }

  if (COMMA_FIELDS.includes(fn)) {
    const items = splitByComma(safeString(val));
    return (
      <View key={fn} style={styles.fieldBox}>
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {items.map((item, i) => <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>)}
      </View>
    );
  }

  /* STRING — multi-sentence or single labeled comma-list → structured rows; else whole value */
  const rawVal = String(val == null ? '' : val);
  const pWhole = parseLabel(rawVal);
  const structured = splitBySentence(rawVal).length > 1 || (pWhole.isLabeled && splitByComma(pWhole.value).length >= 2);
  return (
    <View key={fn} style={styles.fieldBox}>
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      {structured ? sentenceRows(rawVal) : <Text style={styles.fieldValue}>{safeString(rawVal)}</Text>}
    </View>
  );
};

/* ======= PDF COMPONENT ======= */
const PostOperativeReportsDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.post_operative_reports) return Array.isArray(r.post_operative_reports) ? r.post_operative_reports : [r.post_operative_reports];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.post_operative_reports) return Array.isArray(dd.post_operative_reports) ? dd.post_operative_reports : [dd.post_operative_reports]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Post-Operative Reports</Text>
          <Text style={styles.noDataText}>No post-operative reports available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page} wrap>
        <Text style={styles.documentTitle}>Post-Operative Reports</Text>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <Text style={styles.recordTitle}>Post-Operative Report {idx + 1}</Text>

            {SECTION_CONFIGS.map(cfg => {
              const present = cfg.fields.filter(fn => fieldPresent(fn, record[fn]));
              if (present.length === 0) return null;
              const [first, ...rest] = present;
              return (
                <View key={cfg.sid} style={styles.section}>
                  {/* anti-orphan glue: section title + first field never split across pages */}
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>{cfg.title}</Text>
                    {renderField(first, record[first], cfg.sid)}
                  </View>
                  {rest.map(fn => renderField(fn, record[fn], cfg.sid))}
                </View>
              );
            })}

            {idx < records.length - 1 && <View style={styles.separator} />}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PostOperativeReportsDocumentPDFTemplate;
