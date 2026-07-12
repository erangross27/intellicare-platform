import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * Psychiatric Assessment Scales PDF — box-free canonical (black-on-white, underline rules).
 * Field-for-field aligned with the JSX: scales (nested {score,severity}), customScales
 * (array of {name,score,interpretation}), recursive results, subtitle findings/notes.
 */

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
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    borderBottomStyle: 'solid',
  },
  recordTitle: {
    fontSize: 19,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    paddingBottom: 6,
    marginTop: 6,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    borderBottomStyle: 'solid',
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    paddingBottom: 4,
    marginTop: 14,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    borderBottomStyle: 'solid',
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
    paddingBottom: 3,
    marginTop: 8,
    marginBottom: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: '#999999',
    borderBottomStyle: 'solid',
  },
  subLabel: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginTop: 6,
    marginBottom: 4,
  },
  value: {
    fontSize: 14,
    color: '#000000',
    marginBottom: 4,
  },
  listItem: {
    fontSize: 14,
    color: '#000000',
    marginBottom: 3,
    paddingLeft: 8,
  },
  noDataText: {
    fontSize: 14,
    color: '#000000',
    textAlign: 'center',
    marginTop: 40,
  },
});

const SCALE_LABELS = {
  phq9: 'PHQ-9 (Patient Health Questionnaire-9)',
  gad7: 'GAD-7 (Generalized Anxiety Disorder-7)',
  phq15: 'PHQ-15 (Patient Health Questionnaire-15)',
  mdq: 'MDQ (Mood Disorder Questionnaire)',
  pcl5: 'PCL-5 (PTSD Checklist for DSM-5)',
  audit: 'AUDIT (Alcohol Use Disorders Identification Test)',
  mmse: 'MMSE (Mini-Mental State Examination)',
  moca: 'MoCA (Montreal Cognitive Assessment)',
};
const SCALE_KEYS = ['phq9', 'gad7', 'phq15', 'mdq', 'pcl5', 'audit', 'mmse', 'moca'];

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr.$date || dateStr);
    if (isNaN(date.getTime())) return String(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return String(dateStr);
  }
};

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let s;
  if (typeof val === 'string') s = val;
  else if (typeof val === 'number') s = String(val);
  else if (typeof val === 'boolean') s = val ? 'Yes' : 'No';
  else if (typeof val === 'object') { if (val.$date) return formatDate(val.$date); s = JSON.stringify(val); }
  else s = String(val);
  return s
    .replace(/×/g, 'x')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...');
};

const keyToLabel = (key) => key
  .replace(/_/g, ' ')
  .replace(/([A-Z])/g, ' $1')
  .replace(/^./, str => str.toUpperCase())
  .trim();

const safeArray = (val) => (Array.isArray(val) ? val.filter(Boolean) : []);

const hasValue = (val) => !(val === null || val === undefined || val === '');

const splitIntoItems = (text) => {
  if (!text) return [];
  const str = String(text).trim();
  if (!str) return [];
  const numbered = str.split(/\s+(?=\d+\.\s)/).filter(s => s.trim()).map(s => s.trim());
  if (numbered.length > 1) return numbered;
  const bySemicolon = str.split(/;\s*/).filter(s => s.trim()).map(s => s.trim());
  if (bySemicolon.length > 1) return bySemicolon;
  return [str];
};

const stripNumber = (text) => String(text).replace(/^\d+\.\s*/, '');

const parseSubtitleItems = (text) => {
  if (!text) return [];
  const str = String(text).trim();
  if (!str) return [];
  const regex = /([A-Z][A-Za-z0-9\-]+(?:\s+[a-zA-Z\-]+){1,})\s*:\s*/g;
  const matches = [];
  let m;
  while ((m = regex.exec(str)) !== null) {
    matches.push({ label: m[1], start: m.index, contentStart: m.index + m[0].length });
  }
  if (matches.length === 0) return [{ label: '', value: str }];
  const result = [];
  if (matches[0].start > 0) {
    const prefix = str.substring(0, matches[0].start).trim().replace(/\.\s*$/, '');
    if (prefix) result.push({ label: '', value: prefix });
  }
  for (let i = 0; i < matches.length; i++) {
    const contentEnd = i + 1 < matches.length ? matches[i + 1].start : str.length;
    const value = str.substring(matches[i].contentStart, contentEnd).trim().replace(/\.\s*$/, '');
    if (value) result.push({ label: matches[i].label, value });
  }
  return result;
};

const isScalarVal = (v) => v === null || v === undefined || typeof v !== 'object' || (v && v.$date);

const objectIsEmpty = (v) => {
  if (v === null || v === undefined || v === '') return true;
  if (Array.isArray(v)) return v.filter(x => !objectIsEmpty(x)).length === 0;
  if (typeof v === 'object' && !v.$date) {
    return Object.entries(v).filter(([k]) => k !== '_id').every(([, val]) => objectIsEmpty(val));
  }
  return false;
};

const scaleHasData = (scale) => {
  if (!scale || typeof scale !== 'object') return false;
  return Object.entries(scale).filter(([k]) => k !== '_id').some(([, v]) => hasValue(v));
};

/* flat Text element builders */
const L = (txt, key) => <Text key={key} style={styles.fieldLabel}>{safeString(txt)}</Text>;
const V = (txt, key) => <Text key={key} style={styles.value}>{safeString(txt)}</Text>;
const LI = (txt, key) => <Text key={key} style={styles.listItem}>{safeString(txt)}</Text>;
const SUB = (txt, key) => <Text key={key} style={styles.subLabel}>{safeString(txt)}</Text>;

const providerEls = (record) => {
  const els = [];
  if (hasValue(record.provider)) { els.push(L('Provider', 'pl')); els.push(V(record.provider, 'pv')); }
  if (hasValue(record.facility)) { els.push(L('Facility', 'fl')); els.push(V(record.facility, 'fv')); }
  return els;
};

const scalesEls = (record) => {
  const active = SCALE_KEYS.filter(k => scaleHasData(record[k]));
  const els = [];
  active.forEach((key, si) => {
    els.push(L(SCALE_LABELS[key] || keyToLabel(key), `sc${si}`));
    Object.entries(record[key]).filter(([k]) => k !== '_id' && hasValue(record[key][k])).forEach(([k, v], ei) => {
      els.push(V(`${keyToLabel(k)}: ${safeString(v)}`, `sc${si}e${ei}`));
    });
  });
  return els;
};

const customScalesEls = (record) => {
  const items = safeArray(record.customScales);
  const els = [];
  items.forEach((it, i) => {
    if (typeof it === 'string') { els.push(LI(`${i + 1}. ${it}`, `cs${i}`)); return; }
    els.push(L(it.name || `Scale ${i + 1}`, `csn${i}`));
    if (it.score !== undefined && it.score !== null && it.score !== '') els.push(V(`Score: ${safeString(it.score)}`, `css${i}`));
    if (it.interpretation) els.push(V(`Interpretation: ${safeString(it.interpretation)}`, `csi${i}`));
  });
  return els;
};

const textEls = (text, prefix) => {
  if (!text || !String(text).trim()) return [];
  return splitIntoItems(text).map((it, i) => LI(`${i + 1}. ${stripNumber(it)}`, `${prefix}${i}`));
};

const subtitleEls = (text, prefix) => {
  if (!text || !String(text).trim()) return [];
  const parsed = parseSubtitleItems(text);
  if (!parsed.some(p => p.label)) return textEls(text, prefix);
  const els = [];
  parsed.forEach((item, i) => {
    if (item.label) { els.push(L(item.label, `${prefix}l${i}`)); els.push(V(item.value, `${prefix}v${i}`)); }
    else els.push(LI(`${i + 1}. ${item.value}`, `${prefix}u${i}`));
  });
  return els;
};

const recEls = (record) => safeArray(record.recommendations).map((it, i) =>
  LI(`${i + 1}. ${typeof it === 'string' ? it : (it.recommendation || it.text || safeString(it))}`, `rec${i}`));

const resultsEls = (record) => {
  const v = record.results;
  if (!v || typeof v !== 'object' || objectIsEmpty(v)) return [];
  const els = [];
  const walk = (label, val, prefix) => {
    if (objectIsEmpty(val)) return;
    if (isScalarVal(val)) { els.push(V(`${label ? label + ': ' : ''}${safeString(val)}`, prefix)); return; }
    if (label) els.push(SUB(label, prefix + 'h'));
    Object.entries(val).filter(([k, vv]) => k !== '_id' && !objectIsEmpty(vv)).forEach(([k, vv]) => walk(keyToLabel(k), vv, `${prefix}-${k}`));
  };
  Object.entries(v).filter(([k, vv]) => k !== '_id' && !objectIsEmpty(vv)).forEach(([k, vv]) => walk(keyToLabel(k), vv, `r${k}`));
  return els;
};

const PsychiatricAssessmentScalesDocumentPDFTemplate = ({ document: data }) => {
  const unwrapData = (inputData) => {
    if (!inputData) return [];
    if (Array.isArray(inputData)) {
      if (inputData.length === 1 && inputData[0]?.psychiatric_assessment_scales) {
        return inputData[0].psychiatric_assessment_scales;
      }
      return inputData;
    }
    if (inputData.psychiatric_assessment_scales) {
      return inputData.psychiatric_assessment_scales;
    }
    return [inputData];
  };

  const records = unwrapData(data);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Psychiatric Assessment Scales</Text>
          <Text style={styles.noDataText}>No data available</Text>
        </Page>
      </Document>
    );
  }

  /* FLATTEN anti-orphan: glue the section title to its first body line. */
  const renderSection = (sec, sidx) => {
    const first = sec.els[0];
    const rest = sec.els.slice(1).map((el, i) => React.cloneElement(el, { key: `f${sidx}_${i}` }));
    return (
      <View key={sidx}>
        <View wrap={false}>
          <Text style={styles.sectionTitle}>{sec.title}</Text>
          {first}
        </View>
        {rest}
      </View>
    );
  };

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Psychiatric Assessment Scales</Text>

        {records.map((record, index) => {
          const sections = [
            hasValue(record.date) && { title: 'Date', els: [V(formatDate(record.date), 'dv')] },
            { title: 'Provider Information', els: providerEls(record) },
            { title: 'Assessment Scales', els: scalesEls(record) },
            { title: 'Results', els: resultsEls(record) },
            { title: 'Custom Scales', els: customScalesEls(record) },
            { title: 'Findings', els: subtitleEls(record.findings, 'fnd') },
            { title: 'Assessment', els: textEls(record.assessment, 'asm') },
            { title: 'Plan', els: textEls(record.plan, 'pln') },
            { title: 'Recommendations', els: recEls(record) },
            { title: 'Notes', els: subtitleEls(record.notes, 'nts') },
          ].filter(s => s && s.els && s.els.length);

          return (
            <View key={index} break={index > 0}>
              <Text style={styles.recordTitle}>Psychiatric Assessment Scales {index + 1}</Text>
              {sections.map((sec, sidx) => renderSection(sec, sidx))}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default PsychiatricAssessmentScalesDocumentPDFTemplate;
