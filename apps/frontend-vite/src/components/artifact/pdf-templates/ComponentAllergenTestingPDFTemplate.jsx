/**
 * ComponentAllergenTestingPDFTemplate.jsx
 * Box-free line-based layout (ConsultationNotes donor) — LETTER size — B&W.
 * react-pdf 4.5.1 engine rules: wrap props are BOOLEANS (explicit undefined = unbreakable);
 * recordContainer paddingBottom only (marginBottom → empty page 1) + break={idx>0} (Rule #75, each
 * record starts a new page); sectionTitle rides INSIDE the first present field's View (anti-orphan, 6a2d6af6).
 * Sections/fields mirror the JSX + copy exactly (4-area mirror). Sentence fields render labeled groups
 * (a "Label: value" head → sub-label + comma-split value rows >=3; numbering restarts at each labeled group);
 * unlabeled >=3 comma lists split into numbered rows. Magnitude number 0 = "not measured" → hidden.
 * Collection: component_allergen_testing
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
  subLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', borderBottomWidth: 0.5, borderBottomColor: '#999999', paddingBottom: 2, marginBottom: 3, marginTop: 4 },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 3, paddingLeft: 8 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
});

const SECTION_DEFS = [
  ['Test Information', ['allergenComponent', 'componentClass', 'componentPanelName', 'specificIgELevel', 'clinicalRelevanceScore', 'componentSensitivityIndex']],
  ['Risk Profile', ['riskStratification', 'genuineVsCrossReactive', 'majorVsMinorAllergen', 'immunotherapyEligibility']],
  ['Reactivity', ['crossReactivityPattern', 'heatStabilityProfile', 'componentStabilityProfile', 'homologyMapping']],
  ['Clinical Guidance', ['avoidanceRecommendations', 'foodPreparationGuidance', 'toleranceInduction']],
  ['Additional', ['pollenSeasonRelevance', 'epidemiologyData', 'occupationalRelevance']],
];
const FIELD_LABELS = {
  allergenComponent: 'Allergen Component', componentClass: 'Component Class', componentPanelName: 'Component Panel Name',
  specificIgELevel: 'Specific IgE Level', clinicalRelevanceScore: 'Clinical Relevance Score', componentSensitivityIndex: 'Component Sensitivity Index',
  riskStratification: 'Risk Stratification', genuineVsCrossReactive: 'Genuine vs Cross-Reactive',
  majorVsMinorAllergen: 'Major vs Minor Allergen', immunotherapyEligibility: 'Immunotherapy Eligibility',
  crossReactivityPattern: 'Cross-Reactivity Pattern', heatStabilityProfile: 'Heat Stability Profile',
  componentStabilityProfile: 'Component Stability Profile', homologyMapping: 'Homology Mapping',
  avoidanceRecommendations: 'Avoidance Recommendations', foodPreparationGuidance: 'Food Preparation Guidance',
  toleranceInduction: 'Tolerance Induction',
  pollenSeasonRelevance: 'Pollen Season Relevance', epidemiologyData: 'Epidemiology Data', occupationalRelevance: 'Occupational Relevance',
};
const SENTENCE_FIELDS = ['crossReactivityPattern', 'heatStabilityProfile', 'foodPreparationGuidance', 'toleranceInduction', 'componentStabilityProfile'];
const ARRAY_FIELDS = ['avoidanceRecommendations', 'homologyMapping'];
const NUMBER_FIELDS = ['specificIgELevel', 'clinicalRelevanceScore', 'componentSensitivityIndex'];

const safeString = (v) => { if (v === null || v === undefined) return ''; if (typeof v === 'boolean') return v ? 'Yes' : 'No'; return String(v); };
const safeArray = (v) => Array.isArray(v) ? v : [];
const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; };
// Abbreviation+decimal guard: never break on "Dr. Smith", "vs. standard", "3.5 mg".
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };
// Paren-aware; keeps Oxford ", and/or X" attached; skips no-space commas ("$18,000") and date commas ("January 8, 2026").
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [];
  const parts = []; let cur = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      const rest = text.slice(i + 1);
      if (!/^\s/.test(rest)) { cur += ch; continue; }
      if (/^\s+(?:and|or)\b/i.test(rest)) { cur += ch; continue; }
      if (/\d\s*$/.test(cur) && /^\s*\d{4}\b/.test(rest)) { cur += ch; continue; }
      parts.push(cur.trim()); cur = '';
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
};
const parseLabel = (text) => { if (!text || typeof text !== 'string') return null; const m = text.match(/^([A-Za-z][A-Za-z\s/&(),.#><=+-]{2,}?):\s+(.*)/); return m ? { label: m[1].trim(), content: m[2].trim() } : null; };
const buildSentenceGroups = (text) => splitBySentence(text).map(s => {
  const strip = (p) => p.replace(/[.;]+$/, '').trim();
  const p = parseLabel(s);
  const content = p ? p.content : s;
  const c = splitByComma(content);
  return { label: p ? p.label : null, parts: (c.length >= 3 ? c : [content]).map(strip) };
});

// Build a field's display lines ({k:'label'|'sub'|'row', t}) or null when empty. Mirrors the JSX + copy.
const buildFieldLines = (record, f, title) => {
  const val = record[f];
  const label = FIELD_LABELS[f] || f;
  const showLabel = label.toLowerCase() !== title.toLowerCase();
  const lines = [];
  if (ARRAY_FIELDS.includes(f)) {
    const arr = safeArray(val).filter(hasVal);
    if (arr.length === 0) return null;
    if (showLabel) lines.push({ k: 'label', t: label });
    arr.forEach((item, i) => lines.push({ k: 'row', t: `${i + 1}. ${safeString(item)}` }));
  } else if (SENTENCE_FIELDS.includes(f)) {
    if (!hasVal(val)) return null;
    if (showLabel) lines.push({ k: 'label', t: label });
    let n = 0;
    buildSentenceGroups(safeString(val)).forEach(g => {
      if (g.label) { lines.push({ k: 'sub', t: g.label }); n = 0; }
      g.parts.forEach(part => lines.push({ k: 'row', t: `${++n}. ${part}` }));
    });
  } else {
    if (!hasVal(val)) return null;
    // Magnitude metrics: 0 is a "not measured" sentinel, not a meaningful reading — hide it.
    if (NUMBER_FIELDS.includes(f) && Number(val) === 0) return null;
    if (showLabel) lines.push({ k: 'label', t: label });
    lines.push({ k: 'row', t: `1. ${safeString(val)}` });
  }
  return lines.length ? lines : null;
};

/* One field = one wrap-gated glue View; sectionTitle rides inside the FIRST present field's View.
   Threshold 20 keeps short fields whole (no title/sub-label orphans); long narrative fields flow. */
const renderFieldView = (lines, title, isFirst, keyId) => (
  <View key={keyId} style={styles.fieldUnit} wrap={lines.length > 20 ? true : false}>
    {isFirst ? <Text style={styles.sectionTitle}>{title}</Text> : null}
    {lines.map((ln, i) => {
      if (ln.k === 'label') return <Text key={i} style={styles.fieldLabel}>{ln.t}</Text>;
      if (ln.k === 'sub') return <Text key={i} style={styles.subLabel}>{ln.t}</Text>;
      return <Text key={i} style={styles.listItem}>{ln.t}</Text>;
    })}
  </View>
);

const renderSection = (record, title, fields) => {
  const units = fields.map(f => buildFieldLines(record, f, title)).filter(Boolean);
  if (units.length === 0) return null;
  return <View key={title} style={styles.section}>{units.map((lines, i) => renderFieldView(lines, title, i === 0, `${title}-${i}`))}</View>;
};

const ComponentAllergenTestingPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.component_allergen_testing) return Array.isArray(r.component_allergen_testing) ? r.component_allergen_testing : [r.component_allergen_testing];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.component_allergen_testing) return Array.isArray(dd.component_allergen_testing) ? dd.component_allergen_testing : [dd.component_allergen_testing]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>Component Allergen Testing</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Component Allergen Testing</Text></View>
        {records.map((record, idx) => (
          // Rule #75: every record after the first STARTS ON A NEW PAGE; never on record 0.
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Component Allergen Testing ${idx + 1}`}</Text>
              {record.date ? <Text style={styles.recordMeta}>{formatDate(record.date)}</Text> : null}
            </View>
            {SECTION_DEFS.map(([title, fields]) => renderSection(record, title, fields))}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default ComponentAllergenTestingPDFTemplate;
