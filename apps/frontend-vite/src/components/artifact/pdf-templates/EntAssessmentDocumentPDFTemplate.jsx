import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * EntAssessmentDocumentPDFTemplate — box-free B&W LETTER (July 2026 one-pass)
 * Mirrors the JSX (provider-details / audiometry / npl / sinus / vestibular / findings /
 * assessment / plan / results / recommendations+notes). Flatten-under-Page: the record title
 * + section field Views are DIRECT <Page> children so a single record never leaves an empty
 * first page. Accepts `records` or `document`.
 */

const styles = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 40, paddingHorizontal: 44, fontFamily: 'Helvetica', fontSize: 12, backgroundColor: '#ffffff', color: '#000000' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 8, marginBottom: 16, borderBottomWidth: 2, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 3, marginTop: 10, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000' },
  field: { marginBottom: 10 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 2, marginBottom: 4, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  subLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 2, marginTop: 5, marginBottom: 3, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  fieldValue: { fontSize: 14, color: '#000000', lineHeight: 1.4, marginBottom: 3, paddingLeft: 4 },
  noData: { fontSize: 12, color: '#666666', marginTop: 40 },
});

const SECTION_TITLES = {
  'provider-details': 'Provider Details',
  audiometry: 'Audiometry',
  nasopharyngolaryngoscopy: 'Nasopharyngolaryngoscopy',
  'sinus-assessment': 'Sinus Assessment',
  'vestibular-testing': 'Vestibular Testing',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  results: 'Results',
  'recommendations-notes': 'Recommendations & Notes',
};
const SENTENCE_SECTIONS = { findings: 'findings', assessment: 'assessment', plan: 'plan' };

/* ═══════ HELPERS ═══════ */
const safeString = (val) => { if (val === null || val === undefined) return ''; if (typeof val === 'object') return ''; return String(val); };
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const hasValue = (val) => {
  if (val === null || val === undefined || val === '') return false;
  if (typeof val === 'object' && !Array.isArray(val)) return Object.keys(val).length > 0 && Object.values(val).some(v => hasValue(v));
  if (Array.isArray(val)) return val.filter(hasValue).length > 0;
  if (typeof val === 'string') return val.trim() !== '';
  return true;
};
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const formatDate = (dateString) => {
  if (!dateString) return '';
  try { const d = new Date(dateString); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateString); }
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  const numberedMatch = text.match(/^\d+\.\s/);
  if (numberedMatch) {
    const items = text.split(/\s+(?=\d+\.\s)/).map(s => s.replace(/^\d+\.\s*/, '').replace(/[.;]$/, '').trim()).filter(Boolean);
    if (items.length > 1) return items;
  }
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) {
      const nextCh = text[i + 1] || '';
      const rest = text.slice(i + 1).replace(/^\s+/, '');
      if (/\d/.test(nextCh) || /^(and|or)\b/i.test(rest)) { current += ch; }
      else { const t = current.trim(); if (t) result.push(t); current = ''; }
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* scalar leaf value → sentence/comma-split styled <Text> (mirrors JSX formatSentenceFieldLines) */
const leafValueTexts = (value, keyPrefix) => {
  const out = [];
  const sentences = splitBySentence(safeString(value));
  if (!sentences.length) { out.push(<Text key={`${keyPrefix}-v`} style={styles.fieldValue}>{`1. ${fmtScalar(value)}`}</Text>); return out; }
  let n = 1;
  sentences.forEach((s, si) => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      out.push(<Text key={`${keyPrefix}-sl${si}`} style={styles.subLabel}>{parsed.label}</Text>);
      const parts = splitByComma(parsed.value);
      let m = 1;
      (parts.length >= 2 ? parts : [parsed.value]).forEach((it, i) => out.push(<Text key={`${keyPrefix}-${si}-${i}`} style={styles.fieldValue}>{`${m++}. ${safeString(it)}`}</Text>));
    } else {
      const parts = splitByComma(s);
      if (parts.length >= 2) parts.forEach((it, i) => out.push(<Text key={`${keyPrefix}-v${si}-${i}`} style={styles.fieldValue}>{`${n++}. ${safeString(it)}`}</Text>));
      else out.push(<Text key={`${keyPrefix}-v${si}`} style={styles.fieldValue}>{`${n++}. ${safeString(s)}`}</Text>);
    }
  });
  return out;
};

/* recursive deep-object → flat array of styled <Text> (mirrors JSX objectCopyLines) */
const objectLeafTexts = (key, value, depth, keyPrefix) => {
  const out = [];
  const labelStyle = depth === 0 ? styles.fieldLabel : styles.subLabel;
  if (value === null || typeof value !== 'object') {
    out.push(<Text key={`${keyPrefix}-l`} style={labelStyle}>{humanizeKey(key)}</Text>);
    leafValueTexts(value, keyPrefix).forEach(t => out.push(t));
  } else if (Array.isArray(value)) {
    const items = value.filter(hasValue);
    if (!items.length) return out;
    out.push(<Text key={`${keyPrefix}-l`} style={labelStyle}>{humanizeKey(key)}</Text>);
    items.forEach((it, i) => {
      if (it && typeof it === 'object') objectLeafTexts(`${i + 1}`, it, depth + 1, `${keyPrefix}-${i}`).forEach(t => out.push(t));
      else out.push(<Text key={`${keyPrefix}-${i}`} style={styles.fieldValue}>{`${i + 1}. ${fmtScalar(it)}`}</Text>);
    });
  } else {
    const entries = Object.entries(value).filter(([, v]) => hasValue(v));
    if (!entries.length) return out;
    out.push(<Text key={`${keyPrefix}-l`} style={labelStyle}>{humanizeKey(key)}</Text>);
    entries.forEach(([k, v]) => objectLeafTexts(k, v, depth + 1, `${keyPrefix}-${k}`).forEach(t => out.push(t)));
  }
  return out;
};

/* a deep-object section → one <View> per top-level key; sectionTitle glued to the first */
const objectSectionViews = (obj, sid, sectionTitle) => {
  const views = [];
  if (!obj || typeof obj !== 'object') return views;
  let first = true;
  Object.entries(obj).forEach(([k, v]) => {
    if (!hasValue(v)) return;
    const texts = [];
    if (first && sectionTitle) texts.push(<Text key="t" style={styles.sectionTitle}>{sectionTitle}</Text>);
    objectLeafTexts(k, v, 0, `${sid}-${k}`).forEach(t => texts.push(t));
    views.push(<View key={`${sid}-${k}`} wrap={first ? false : texts.length > 22} style={styles.field}>{texts}</View>);
    first = false;
  });
  return views;
};

/* audiometry groups (mirror the JSX): ears = freq→dB grid; text groups = labeled leaves */
const AUDIOMETRY_GROUPS = [
  { key: 'rightEar', label: 'Right Ear', measure: true, subKeys: ['250Hz', '500Hz', '1000Hz', '2000Hz', '4000Hz', '8000Hz', 'PTA'] },
  { key: 'leftEar', label: 'Left Ear', measure: true, subKeys: ['250Hz', '500Hz', '1000Hz', '2000Hz', '4000Hz', '8000Hz', 'PTA'] },
  { key: 'speechDiscrimination', label: 'Speech Discrimination', isString: true },
  { key: 'tympanometry', label: 'Tympanometry', subKeys: ['type', 'findings'] },
  { key: 'acousticReflexes', label: 'Acoustic Reflexes', subKeys: ['findings'] },
  { key: 'otoacousticEmissions', label: 'Otoacoustic Emissions', subKeys: ['type', 'findings'] },
];

/* audiometry section → one View per group; ear grids = "1. 250 Hz - 30 dB" rows, text groups = stacked labeled leaves */
const audiometrySectionViews = (aud, sid, sectionTitle) => {
  const views = [];
  if (!aud || typeof aud !== 'object') return views;
  let first = true;
  AUDIOMETRY_GROUPS.forEach(group => {
    const data = aud[group.key];
    if (!hasValue(data)) return;
    const content = [];
    if (group.isString) {
      content.push(<Text key={`${sid}-${group.key}-l`} style={styles.fieldLabel}>{group.label}</Text>);
      leafValueTexts(data, `${sid}-${group.key}`).forEach(t => content.push(t));
    } else if (group.measure) {
      const entries = (group.subKeys || Object.keys(data)).filter(k => hasValue(data[k]));
      if (!entries.length) return;
      content.push(<Text key={`${sid}-${group.key}-l`} style={styles.fieldLabel}>{group.label}</Text>);
      entries.forEach((k, i) => content.push(<Text key={`${sid}-${group.key}-${i}`} style={styles.fieldValue}>{`${i + 1}. ${humanizeKey(k)} - ${fmtScalar(data[k])}`}</Text>));
    } else {
      const entries = (group.subKeys || Object.keys(data)).filter(k => hasValue(data[k]));
      if (!entries.length) return;
      content.push(<Text key={`${sid}-${group.key}-l`} style={styles.fieldLabel}>{group.label}</Text>);
      entries.forEach(k => {
        content.push(<Text key={`${sid}-${group.key}-${k}-sl`} style={styles.subLabel}>{humanizeKey(k)}</Text>);
        leafValueTexts(data[k], `${sid}-${group.key}-${k}`).forEach(t => content.push(t));
      });
    }
    if (!content.length) return;
    const texts = [];
    if (first && sectionTitle) texts.push(<Text key="t" style={styles.sectionTitle}>{sectionTitle}</Text>);
    content.forEach(t => texts.push(t));
    views.push(<View key={`${sid}-${group.key}`} wrap={first ? false : texts.length > 22} style={styles.field}>{texts}</View>);
    first = false;
  });
  return views;
};

/* sentence section → typed line Views (parseLabel + comma-split + numbered; single-name gate) */
const sentenceSectionViews = (text, sid, sectionTitle, fieldLabel) => {
  const sentences = splitBySentence(safeString(text));
  if (!sentences.length) return [];
  const views = [];
  let first = true; let runningN = 1;
  sentences.forEach((s, si) => {
    const parsed = parseLabel(s);
    const texts = [];
    if (first && sectionTitle) texts.push(<Text key="t" style={styles.sectionTitle}>{sectionTitle}</Text>);
    if (first && fieldLabel) texts.push(<Text key="fl" style={styles.fieldLabel}>{fieldLabel}</Text>);
    if (parsed.isLabeled) {
      texts.push(<Text key="sl" style={styles.subLabel}>{parsed.label}</Text>);
      const parts = splitByComma(parsed.value);
      let m = 1;
      (parts.length >= 2 ? parts : [parsed.value]).forEach((it, i) => texts.push(<Text key={`v${i}`} style={styles.fieldValue}>{`${m++}. ${safeString(it)}`}</Text>));
    } else {
      texts.push(<Text key="v" style={styles.fieldValue}>{`${runningN++}. ${safeString(s)}`}</Text>);
    }
    views.push(<View key={`${sid}-${si}`} wrap={first ? false : texts.length > 22} style={styles.field}>{texts}</View>);
    first = false;
  });
  return views;
};

const unwrapData = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    if (raw.length === 0) return [];
    if (raw[0]?.ent_assessment && Array.isArray(raw[0].ent_assessment)) return raw[0].ent_assessment;
    return raw;
  }
  if (raw.ent_assessment && Array.isArray(raw.ent_assessment)) return raw.ent_assessment;
  if (raw.documentData) return unwrapData(raw.documentData);
  if (typeof raw === 'object') return [raw];
  return [];
};

const EntAssessmentDocumentPDFTemplate = ({ records, document: docData }) => {
  const recs = (Array.isArray(records) ? records : unwrapData(docData)).filter(r => r && typeof r === 'object');

  if (recs.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>ENT Assessment</Text>
          <Text style={styles.noData}>No ENT assessment data available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>ENT Assessment</Text>
        {recs.flatMap((record, idx) => {
          const els = [<Text key={`rt-${idx}`} style={styles.recordTitle} break={idx > 0}>{`ENT Assessment ${idx + 1}`}</Text>];

          /* Provider Details */
          const pdFields = [
            ['Date', hasValue(record.date) ? formatDate(record.date) : ''],
            ['Provider', safeString(record.provider)],
            ['Facility', safeString(record.facility)],
            ['Status', humanizeKey(safeString(record.status))],
          ].filter(([, v]) => v && v.trim());
          if (pdFields.length) {
            pdFields.forEach(([label, value], i) => {
              const texts = [];
              if (i === 0) texts.push(<Text key="t" style={styles.sectionTitle}>{SECTION_TITLES['provider-details']}</Text>);
              texts.push(<Text key="l" style={styles.fieldLabel}>{label}</Text>);
              texts.push(<Text key="v" style={styles.fieldValue}>{`1. ${value}`}</Text>);
              els.push(<View key={`pd-${idx}-${label}`} wrap={false} style={styles.field}>{texts}</View>);
            });
          }

          /* Audiometry / NPL / Sinus / Vestibular (deep objects) */
          els.push(...audiometrySectionViews(record.audiometry, `aud-${idx}`, SECTION_TITLES.audiometry));
          els.push(...objectSectionViews(record.nasopharyngolaryngoscopy, `npl-${idx}`, SECTION_TITLES.nasopharyngolaryngoscopy));
          els.push(...objectSectionViews(record.sinusAssessment, `sin-${idx}`, SECTION_TITLES['sinus-assessment']));
          els.push(...objectSectionViews(record.vestibularTesting, `vest-${idx}`, SECTION_TITLES['vestibular-testing']));

          /* Findings / Assessment / Plan (sentence sections, single-name) */
          Object.keys(SENTENCE_SECTIONS).forEach(sid => {
            if (hasValue(record[sid])) els.push(...sentenceSectionViews(record[sid], `${sid}-${idx}`, SECTION_TITLES[sid], null));
          });

          /* Results (deep object) */
          els.push(...objectSectionViews(record.results, `res-${idx}`, SECTION_TITLES.results));

          /* Recommendations & Notes */
          const recsArr = Array.isArray(record.recommendations) ? record.recommendations.filter(r => (typeof r === 'string' ? r : r?.recommendation)) : [];
          const hasNotes = hasValue(record.notes);
          if (recsArr.length || hasNotes) {
            if (recsArr.length) {
              const texts = [
                <Text key="t" style={styles.sectionTitle}>{SECTION_TITLES['recommendations-notes']}</Text>,
                <Text key="fl" style={styles.fieldLabel}>Recommendations</Text>,
              ];
              recsArr.forEach((r, i) => {
                const recText = typeof r === 'string' ? r : safeString(r?.recommendation);
                const recDate = typeof r === 'object' && r?.date ? formatDate(r.date) : '';
                texts.push(<Text key={`r${i}`} style={styles.fieldValue}>{`${i + 1}. ${recText}${recDate ? ` (${recDate})` : ''}`}</Text>);
              });
              els.push(<View key={`rec-${idx}`} wrap={texts.length > 22} style={styles.field}>{texts}</View>);
            }
            if (hasNotes) {
              els.push(...sentenceSectionViews(record.notes, `notes-${idx}`, recsArr.length ? null : SECTION_TITLES['recommendations-notes'], 'Notes'));
            }
          }

          return els;
        })}
      </Page>
    </Document>
  );
};

export default EntAssessmentDocumentPDFTemplate;
