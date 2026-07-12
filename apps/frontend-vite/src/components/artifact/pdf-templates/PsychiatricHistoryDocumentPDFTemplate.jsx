/**
 * PsychiatricHistoryDocumentPDFTemplate.jsx
 * PDF export for psychiatric_history — box-free black & white generic-recursive renderer
 * (mirrors the on-screen recursive template):
 *  - No box backgrounds/borders; hierarchy shown via underlines only (documentTitle / sectionTitle / bare fieldLabel).
 *  - Field labels are BARE (no colon). The tree is FLATTENED into small elements so the anti-orphan Section
 *    glues the title to its first small body element inside a <View wrap={false}> without ever forcing a
 *    page-overflowing wrap=false block.
 *  - Scalars stack label-over-value; arrays render each item (first scalar = sub-label, rest = value rows);
 *    booleans render Yes/No (false is meaningful); a numeric 0 is treated as empty; narratives are numbered.
 *  - Keyed off the REAL record.date (never createdAt).
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 14,
    lineHeight: 1.5,
    color: '#000000',
    backgroundColor: '#ffffff',
  },
  documentTitle: {
    fontSize: 26,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    borderBottomStyle: 'solid',
    marginBottom: 20,
    textTransform: 'none',
  },
  recordContainer: {
    marginBottom: 24,
  },
  recordTitle: {
    fontSize: 19,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    borderBottomStyle: 'solid',
    marginBottom: 10,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    borderBottomStyle: 'solid',
    marginBottom: 8,
    textTransform: 'none',
  },
  fieldBox: {
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
    paddingBottom: 2,
    borderBottomWidth: 0.5,
    borderBottomColor: '#999999',
    borderBottomStyle: 'solid',
    marginBottom: 3,
    textTransform: 'none',
  },
  fieldValue: {
    fontSize: 14,
    color: '#000000',
    lineHeight: 1.5,
  },
  subLabel: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginTop: 6,
    marginBottom: 4,
  },
  listItem: {
    fontSize: 14,
    color: '#000000',
    marginBottom: 4,
    paddingLeft: 8,
    lineHeight: 1.5,
  },
  separator: {
    marginTop: 20,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    borderBottomStyle: 'solid',
  },
  noDataText: {
    fontSize: 14,
    color: '#000000',
    textAlign: 'center',
    marginTop: 40,
  },
});

const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/* safeString: ASCII-fold the few printable Unicode chars the extractor emits (multiplication sign, smart
   quotes, en/em/figure dashes, ellipsis). \u-escapes ONLY (no literal invisible/smart chars in source). */
const safeString = (v) => {
  if (v === null || v === undefined) return '';
  return String(v)
    .replace(/\u00D7/g, 'x')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/\u2026/g, '...');
};

const formatDate = (d) => { if (!d) return ''; try { const dt = new Date(d.$date || d); if (isNaN(dt.getTime())) return safeString(d); return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return safeString(d); } };

const isScalar = (v) => v === null || typeof v !== 'object';
/* isEmptyDeep — mirrors the JSX: a numeric 0 is a sentinel (empty); false booleans are meaningful ("No"). */
const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v) || v === 0;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter((x) => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};
const hasVal = (v) => !isEmptyDeep(v);
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (v === null || v === undefined) return ''; return safeString(v); };
const stripNumber = (text) => safeString(text).replace(/^\d+[.)]\s*/, '').trim();
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)[.;](?:\s+)/).map((s) => s.replace(/^\d+\.\s+/, '').trim()).filter((s) => s && !/^[;.,!?]+$/.test(s)); };

const fieldBox = (label, value, key) => (
  <View key={key} style={styles.fieldBox} wrap={false}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <Text style={styles.fieldValue}>{value}</Text>
  </View>
);

/* bodyForValue / withSubLabel are mutually recursive; both invoked only at render time.
   Returns a FLAT array of small elements (each internally wrap=false), never one tall subtree. */
const withSubLabel = (label, value, keyPrefix) => {
  const body = bodyForValue(value, keyPrefix);
  if (body.length === 0) return [];
  return [<Text key={`${keyPrefix}-sl`} style={styles.subLabel}>{label}</Text>, ...body];
};

function bodyForValue(value, keyPrefix) {
  const out = [];
  if (isEmptyDeep(value)) return out;

  if (isScalar(value)) {
    out.push(<Text key={keyPrefix} style={styles.fieldValue}>{fmtScalar(value)}</Text>);
    return out;
  }

  if (Array.isArray(value)) {
    const kept = value.filter((x) => !isEmptyDeep(x));
    if (kept.every(isScalar)) {
      kept.forEach((item, i) => {
        out.push(<Text key={`${keyPrefix}-${i}`} style={styles.listItem}>{i + 1}. {stripNumber(fmtScalar(item))}</Text>);
      });
      return out;
    }
    kept.forEach((item, i) => {
      if (isScalar(item)) { out.push(<Text key={`${keyPrefix}-${i}`} style={styles.listItem}>{i + 1}. {stripNumber(fmtScalar(item))}</Text>); return; }
      const entries = Object.entries(item).filter(([k, v]) => k !== '_id' && !isEmptyDeep(v));
      if (entries.length === 0) return;
      const headScalar = isScalar(entries[0][1]);
      if (headScalar) out.push(<Text key={`${keyPrefix}-${i}-h`} style={styles.subLabel}>{fmtScalar(entries[0][1])}</Text>);
      (headScalar ? entries.slice(1) : entries).forEach(([k, v]) => {
        if (isScalar(v)) out.push(fieldBox(humanizeKey(k), fmtScalar(v), `${keyPrefix}-${i}-${k}`));
        else out.push(...withSubLabel(humanizeKey(k), v, `${keyPrefix}-${i}-${k}`));
      });
    });
    return out;
  }

  Object.entries(value).filter(([k, v]) => k !== '_id' && !isEmptyDeep(v)).forEach(([k, v]) => {
    if (isScalar(v)) out.push(fieldBox(humanizeKey(k), fmtScalar(v), `${keyPrefix}-${k}`));
    else out.push(...withSubLabel(humanizeKey(k), v, `${keyPrefix}-${k}`));
  });
  return out;
}

/* Section — glues the title to its first body element so a title never orphans at a page break. */
const Section = ({ title, children }) => {
  const items = React.Children.toArray(children).filter(Boolean);
  if (items.length === 0) return null;
  const [first, ...rest] = items;
  return (
    <View style={styles.section}>
      <View wrap={false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {first}
      </View>
      {rest}
    </View>
  );
};

const renderSection = (title, fieldVal, keyPrefix) => {
  if (isEmptyDeep(fieldVal)) return null;
  const body = bodyForValue(fieldVal, keyPrefix);
  if (body.length === 0) return null;
  return <Section title={title}>{body}</Section>;
};

/* Record Information — flat scalar fields (date formatted, type, provider, facility). */
const renderRecordInfo = (record, keyPrefix) => {
  const body = [];
  if (hasVal(record.date)) body.push(fieldBox('Date', formatDate(record.date), `${keyPrefix}-date`));
  if (hasVal(record.type)) body.push(fieldBox('Type', fmtScalar(record.type), `${keyPrefix}-type`));
  if (hasVal(record.provider)) body.push(fieldBox('Provider', fmtScalar(record.provider), `${keyPrefix}-prov`));
  if (hasVal(record.facility)) body.push(fieldBox('Facility', fmtScalar(record.facility), `${keyPrefix}-fac`));
  if (body.length === 0) return null;
  return <Section title="Record Information">{body}</Section>;
};

/* Narrative (findings/assessment/plan/notes) — sentence-split, numbered. */
const renderNarrative = (title, text, keyPrefix) => {
  if (isEmptyDeep(text)) return null;
  const sents = splitBySentence(String(text));
  const rows = sents.length > 0 ? sents : [safeString(text)];
  const body = rows.map((s, i) => <Text key={`${keyPrefix}-${i}`} style={styles.listItem}>{i + 1}. {stripNumber(s)}</Text>);
  return <Section title={title}>{body}</Section>;
};

const PsychiatricHistoryDocumentPDFTemplate = ({ document: data }) => {
  let records = [];
  if (Array.isArray(data)) records = data;
  else if (data?.psychiatric_history) records = Array.isArray(data.psychiatric_history) ? data.psychiatric_history : [data.psychiatric_history];
  else if (data?.documentData) { const dd = data.documentData; if (Array.isArray(dd)) records = dd; else if (dd?.psychiatric_history) records = Array.isArray(dd.psychiatric_history) ? dd.psychiatric_history : [dd.psychiatric_history]; else if (dd && typeof dd === 'object') records = [dd]; }
  else if (data && typeof data === 'object') records = [data];
  records = (records || []).filter((r) => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Psychiatric History</Text>
          <Text style={styles.noDataText}>No records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Psychiatric History</Text>
        {records.map((record, idx) => {
          const p = `r${idx}`;
          return (
            <View key={idx} style={styles.recordContainer} break={idx > 0}>
              <View wrap={false}>
                <Text style={styles.recordTitle}>{`Psychiatric History ${idx + 1}`}</Text>
              </View>
              {renderRecordInfo(record, `${p}-info`)}
              {renderSection('Previous Psychiatric Episodes', record.previousEpisodes, `${p}-eps`)}
              {renderSection('Hospitalizations', record.hospitalizations, `${p}-hosp`)}
              {renderSection('Suicide Attempts', record.suicideAttempts, `${p}-sa`)}
              {renderSection('Substance Abuse History', record.substanceAbuse, `${p}-sub`)}
              {renderSection('Previous Psychotherapy', record.previousPsychotherapy, `${p}-psy`)}
              {renderSection('Family Psychiatric History', record.familyPsychHistory, `${p}-fam`)}
              {renderNarrative('Findings', record.findings, `${p}-find`)}
              {renderNarrative('Assessment', record.assessment, `${p}-assess`)}
              {renderNarrative('Plan', record.plan, `${p}-plan`)}
              {renderSection('Recommendations', record.recommendations, `${p}-rec`)}
              {renderNarrative('Notes', record.notes, `${p}-notes`)}
              {renderSection('Results', record.results, `${p}-res`)}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default PsychiatricHistoryDocumentPDFTemplate;
