/**
 * PodiatryExaminationsDocumentPDFTemplate.jsx
 * PDF export template for podiatry_examinations collection.
 * Box-free black & white generic-recursive renderer (mirrors the on-screen recursive template):
 *  - No box backgrounds/borders; hierarchy shown via underlines only (documentTitle / sectionTitle / bare fieldLabel).
 *  - Field labels are BARE (no colon) so they render as exact `>Label<` text nodes for JSX/PDF field parity.
 *  - The tree is FLATTENED into a list of small elements so the anti-orphan Section can glue the title to its
 *    first small body element inside a <View wrap={false}> without ever forcing a page-overflowing wrap=false block.
 *  - Scalars stack label-over-value; arrays render each item (first scalar field = sub-label, rest = value rows);
 *    hide-empty everywhere (a numeric 0 is treated as empty, matching the JSX).
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
    marginBottom: 4,
  },
  recordMeta: {
    fontSize: 12,
    color: '#000000',
    marginBottom: 12,
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

const KEY_OVERRIDES = {
  iwgdfRiskCategory: 'IWGDF Risk Category',
  anklebrachialIndex: 'Ankle-Brachial Index',
  rightABI: 'Right ABI',
  leftABI: 'Left ABI',
  prominentMTHeads: 'Prominent MT Heads',
  dorsalisPedisPulse: 'Dorsalis Pedis Pulse',
  posteriorTibialPulse: 'Posterior Tibial Pulse',
  capillaryRefillTime: 'Capillary Refill Time',
};
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const formatDate = (d) => { if (!d) return ''; try { const dt = new Date(d.$date || d); if (isNaN(dt.getTime())) return String(d); return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };

const isScalar = (v) => v === null || typeof v !== 'object';
/* isEmptyDeep — mirrors the JSX: a numeric 0 is a sentinel (empty); false booleans are meaningful (render "No"). */
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
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (v === null || v === undefined) return ''; return String(v); };
const stripNumber = (text) => String(text).replace(/^\d+[.)]\s*/, '').trim();
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)[.;](?:\s+)/).map((s) => s.replace(/^\d+\.\s+/, '').trim()).filter((s) => s && !/^[;.,!?]+$/.test(s)); };
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0 && /\s/.test(text[i + 1] || '')) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

const fieldBox = (label, value, key) => (
  <View key={key} style={styles.fieldBox} wrap={false}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <Text style={styles.fieldValue}>{value}</Text>
  </View>
);

/* bodyForValue / withSubLabel are mutually recursive; both are only invoked at render time.
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

/* Indication: multi-sentence -> numbered; single sentence with >=3 comma items -> numbered (aggressive split);
   otherwise a single plain value. */
const renderIndication = (text, keyPrefix) => {
  if (isEmptyDeep(text)) return null;
  const sents = splitBySentence(String(text));
  let items = null;
  if (sents.length > 1) items = sents;
  else { const parts = splitByComma(String(text)); if (parts.length >= 3) items = parts; }
  const body = items
    ? items.map((s, i) => <Text key={`${keyPrefix}-${i}`} style={styles.listItem}>{i + 1}. {stripNumber(s)}</Text>)
    : [<Text key={`${keyPrefix}-0`} style={styles.fieldValue}>{String(text)}</Text>];
  return <Section title="Indication">{body}</Section>;
};

const PodiatryExaminationsDocumentPDFTemplate = ({ document: data }) => {
  let records = [];
  if (Array.isArray(data)) records = data;
  else if (data?.podiatry_examinations) records = Array.isArray(data.podiatry_examinations) ? data.podiatry_examinations : [data.podiatry_examinations];
  else if (data?.documentData) { const dd = data.documentData; if (Array.isArray(dd)) records = dd; else if (dd?.podiatry_examinations) records = Array.isArray(dd.podiatry_examinations) ? dd.podiatry_examinations : [dd.podiatry_examinations]; else if (dd && typeof dd === 'object') records = [dd]; }
  else if (data && typeof data === 'object') records = [data];
  records = (records || []).filter((r) => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Podiatry Examination</Text>
          <Text style={styles.noDataText}>No records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Podiatry Examination</Text>
        {records.map((record, idx) => {
          const p = `r${idx}`;
          return (
            <View key={idx} style={styles.recordContainer}>
              {idx > 0 && <View style={styles.separator} />}
              <View wrap={false}>
                <Text style={styles.recordTitle}>{`Podiatry Examination ${idx + 1}`}</Text>
                {hasVal(record.date) && <Text style={styles.recordMeta}>{formatDate(record.date)}</Text>}
              </View>
              {renderIndication(record.indicationForExam, `${p}-ind`)}
              {renderSection('Neuropathy Assessment', record.neuropathyAssessment, `${p}-neuro`)}
              {renderSection('Vascular Assessment', record.vascularAssessment, `${p}-vasc`)}
              {renderSection('Foot Structure & Deformities', record.footStructureDeformities, `${p}-struct`)}
              {renderSection('Skin Condition', record.skinCondition, `${p}-skin`)}
              {renderSection('Nail Condition', record.nailCondition, `${p}-nail`)}
              {renderSection('Footwear Assessment', record.footwearAssessment, `${p}-footwear`)}
              {renderSection('Risk Stratification', record.riskStratification, `${p}-risk`)}
              {renderSection('Treatment Plan', record.treatmentPlan, `${p}-treat`)}
              {renderSection('Patient Education', record.patientEducation, `${p}-edu`)}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default PodiatryExaminationsDocumentPDFTemplate;
