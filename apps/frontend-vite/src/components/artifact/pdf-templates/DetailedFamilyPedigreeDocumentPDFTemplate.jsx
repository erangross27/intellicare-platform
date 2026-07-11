/**
 * DetailedFamilyPedigreeDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — detailed family pedigree
 * Collection: detailed_family_pedigree
 * NO BLUE in PDF — all text is black/gray for print
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', marginBottom: 4 },
  recordContainer: { paddingBottom: 8 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 4, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  fieldValue: { fontSize: 14, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  noDataText: { fontSize: 14, color: '#000000', textAlign: 'center', marginTop: 40 },
});

/* ======= UTILS ======= */
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr.$date || dateStr);
    if (isNaN(date.getTime())) return String(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(dateStr); }
};

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'object' && val.$date) return formatDate(val.$date);
  return String(val);
};

const hasVal = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number') return true;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
};

const fmtVal = (v) => {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  return String(v || '');
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
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) {
      const rest = text.slice(i + 1);
      const noSpace = !/^\s/.test(rest);
      const nextWordM = rest.match(/^\s*([^\s,]+)/);
      const nextWord = nextWordM ? nextWordM[1].toLowerCase() : '';
      const prevWordM = current.match(/(\S+)\s*$/);
      const prevWord = prevWordM ? prevWordM[1].toLowerCase() : '';
      const nextCharM = rest.match(/^\s*(.)/);
      const nextChar = nextCharM ? nextCharM[1] : '';
      const badNext = nextChar && !/[A-Za-z>(]/.test(nextChar);
      if (noSpace || nextWord === 'and' || nextWord === 'or' || prevWord === 'and' || prevWord === 'or' || badNext) { current += ch; continue; }
      const t = current.trim(); if (t) result.push(t); current = '';
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* renderFieldRow: label + value inside fieldBox */
const renderFieldRow = (label, value, skipLabel) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox}>
      {!skipLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      <Text style={styles.listItem}>{`1. ${safeString(fmtVal(value))}`}</Text>
    </View>
  );
};

/* renderBooleanField */
const renderBooleanFieldPDF = (label, value, skipLabel) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox}>
      {!skipLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      <Text style={styles.listItem}>{`1. ${value ? 'Yes' : 'No'}`}</Text>
    </View>
  );
};

/* renderSentenceSection: parseLabel + comma-split */
const renderSentenceSection = (label, text, skipLabel) => {
  if (!hasVal(text)) return null;
  const sentences = splitBySentence(fmtVal(text));
  if (sentences.length === 0) return null;

  const rows = [];
  let running = 1;
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    const value = (parsed.isLabeled ? parsed.value : s).replace(/[;.]+$/, '').trim();
    if (!value) return;
    const commaItems = splitByComma(value);
    if (parsed.isLabeled) {
      rows.push({ type: 'subtitle', text: safeString(parsed.label) });
      if (commaItems.length >= 3) commaItems.forEach((ci, i) => { rows.push({ type: 'item', text: safeString(ci), num: i + 1 }); });
      else rows.push({ type: 'item', text: safeString(value), num: 1 });
    } else if (commaItems.length >= 3) {
      commaItems.forEach(ci => { rows.push({ type: 'item', text: safeString(ci), num: running++ }); });
    } else {
      rows.push({ type: 'item', text: safeString(value), num: running++ });
    }
  });

  const wrapProp = rows.length > 8 ? true : false;

  return (
    <View style={styles.fieldBox} wrap={wrapProp}>
      {!skipLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      {rows.map((row, i) => {
        if (row.type === 'subtitle') {
          return <Text key={i} style={styles.nestedSubtitle}>{row.text}</Text>;
        }
        return <Text key={i} style={styles.listItem}>{row.num}. {row.text}</Text>;
      })}
    </View>
  );
};

/* renderArrayField */
const renderArrayFieldPDF = (label, items, skipLabel) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  const safeItems = items.filter(Boolean);
  if (safeItems.length === 0) return null;

  const rows = [];
  let running = 1;
  safeItems.forEach(item => {
    const itemStr = String(item);
    const parsed = parseLabel(itemStr);
    if (parsed.isLabeled) {
      const commaItems = splitByComma(parsed.value);
      rows.push({ type: 'subtitle', text: safeString(parsed.label) });
      if (commaItems.length >= 3) commaItems.forEach((ci, i) => { rows.push({ type: 'item', text: safeString(ci), num: i + 1 }); });
      else rows.push({ type: 'item', text: safeString(parsed.value), num: 1 });
    } else {
      rows.push({ type: 'item', text: safeString(itemStr), num: running++ });
    }
  });

  return (
    <View style={styles.fieldBox} wrap={rows.length > 8 ? true : false}>
      {!skipLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      {rows.map((row, i) => {
        if (row.type === 'subtitle') return <Text key={i} style={styles.nestedSubtitle}>{row.text}</Text>;
        return <Text key={i} style={styles.listItem}>{`${row.num}. ${row.text}`}</Text>;
      })}
    </View>
  );
};

/* SECTION CONFIGS — 17 sections */
const SECTION_CONFIGS = [
  {
    title: 'Record Information',
    fields: [
      { key: 'provider', label: 'Provider', isSentence: true },
    ],
  },
  {
    title: 'Ethnic Background',
    fields: [
      { key: 'ethnicBackground', label: 'Ethnic Background', isArray: true },
    ],
  },
  {
    title: 'Maternal Grandmother History',
    fields: [
      { key: 'maternalGrandmotherMedicalHistory', label: 'Maternal Grandmother Medical History', isArray: true },
    ],
  },
  {
    title: 'Maternal Grandfather History',
    fields: [
      { key: 'maternalGrandfatherMedicalHistory', label: 'Maternal Grandfather Medical History', isArray: true },
    ],
  },
  {
    title: 'Paternal Grandmother History',
    fields: [
      { key: 'paternalGrandmotherMedicalHistory', label: 'Paternal Grandmother Medical History', isArray: true },
    ],
  },
  {
    title: 'Paternal Grandfather History',
    fields: [
      { key: 'paternalGrandfatherMedicalHistory', label: 'Paternal Grandfather Medical History', isArray: true },
    ],
  },
  {
    title: "Mother's Medical History",
    fields: [
      { key: 'motherMedicalHistory', label: "Mother's Medical History", isArray: true },
    ],
  },
  {
    title: "Father's Medical History",
    fields: [
      { key: 'fatherMedicalHistory', label: "Father's Medical History", isArray: true },
    ],
  },
  {
    title: 'Siblings Information',
    fields: [
      { key: 'siblingsCount', label: 'Number of Siblings' },
      { key: 'siblingsMedicalHistory', label: 'Siblings Medical History', isArray: true },
    ],
  },
  {
    title: 'Children Information',
    fields: [
      { key: 'childrenCount', label: 'Number of Children' },
      { key: 'childrenMedicalHistory', label: 'Children Medical History', isArray: true },
    ],
  },
  {
    title: 'Pedigree Generations',
    fields: [
      { key: 'pedigreeGenerationsDocumented', label: 'Generations Documented' },
    ],
  },
  {
    title: 'Consanguinity & Adoption',
    fields: [
      { key: 'consanguinityPresent', label: 'Consanguinity Present', isBoolean: true },
      { key: 'adoptionInFamily', label: 'Adoption in Family', isBoolean: true },
    ],
  },
  {
    title: 'Hereditary Cancer Syndromes',
    fields: [
      { key: 'hereditaryCancerSyndromes', label: 'Hereditary Cancer Syndromes', isArray: true },
    ],
  },
  {
    title: 'Cardiovascular Genetic Conditions',
    fields: [
      { key: 'cardiovascularGeneticConditions', label: 'Cardiovascular Genetic Conditions', isArray: true },
    ],
  },
  {
    title: 'Neurological Genetic Conditions',
    fields: [
      { key: 'neurologicalGeneticConditions', label: 'Neurological Genetic Conditions', isArray: true },
    ],
  },
  {
    title: 'Endocrine Familial Disorders',
    fields: [
      { key: 'endocrineFamilialDisorders', label: 'Endocrine Familial Disorders', isArray: true },
    ],
  },
  {
    title: 'Psychiatric Familial Conditions',
    fields: [
      { key: 'psychiatricFamilialConditions', label: 'Psychiatric Familial Conditions', isArray: true },
    ],
  },
  {
    title: 'Autoimmune Familial Conditions',
    fields: [
      { key: 'autoimmuneFamilialConditions', label: 'Autoimmune Familial Conditions', isArray: true },
    ],
  },
  {
    title: 'Pregnancy Complications',
    fields: [
      { key: 'pregnancyComplications', label: 'Pregnancy Complications', isArray: true },
    ],
  },
  {
    title: 'Age of Onset Patterns',
    fields: [
      { key: 'ageOfOnsetPatterns', label: 'Age of Onset Patterns', isArray: true },
    ],
  },
  {
    title: 'Genetic Testing & Carrier Status',
    fields: [
      { key: 'geneticTestingPerformed', label: 'Genetic Testing Performed', isArray: true },
      { key: 'carrierStatusKnown', label: 'Carrier Status Known', isArray: true },
    ],
  },
];

/* Duplicate label fields: where field label matches section title */
const DUPLICATE_LABEL_FIELDS = new Set([
  'ethnicBackground',
  'motherMedicalHistory',
  'fatherMedicalHistory',
  'maternalGrandmotherMedicalHistory',
  'maternalGrandfatherMedicalHistory',
  'paternalGrandmotherMedicalHistory',
  'paternalGrandfatherMedicalHistory',
  'hereditaryCancerSyndromes',
  'cardiovascularGeneticConditions',
  'neurologicalGeneticConditions',
  'endocrineFamilialDisorders',
  'psychiatricFamilialConditions',
  'autoimmuneFamilialConditions',
  'pregnancyComplications',
  'ageOfOnsetPatterns',
]);

/* ======= COMPONENT ======= */
const DetailedFamilyPedigreeDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.detailed_family_pedigree) return Array.isArray(r.detailed_family_pedigree) ? r.detailed_family_pedigree : [r.detailed_family_pedigree];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.detailed_family_pedigree) return Array.isArray(dd.detailed_family_pedigree) ? dd.detailed_family_pedigree : [dd.detailed_family_pedigree]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Detailed Family Pedigree</Text>
          </View>
          <Text style={styles.noDataText}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Document Header */}
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Detailed Family Pedigree</Text>
        </View>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer} break={index > 0}>
            {/* Record Header */}
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>
                {`Family Pedigree ${index + 1}`}
              </Text>
            </View>

            {/* Sections */}
            {SECTION_CONFIGS.map((sectionConfig, sIdx) => {
              const hasAnyVal = sectionConfig.fields.some(f => hasVal(record[f.key]));
              if (!hasAnyVal) return null;

              return (
                <View key={sIdx} style={styles.section}>
                  {(() => { let _t = false; return sectionConfig.fields.map((field, fIdx) => {
                    const val = record[field.key];
                    if (!hasVal(val)) return null;
                    const _first = !_t; _t = true;
                    const skipLabel = DUPLICATE_LABEL_FIELDS.has(field.key);
                    const _el = field.isBoolean ? renderBooleanFieldPDF(field.label, val, skipLabel) : field.isArray ? renderArrayFieldPDF(field.label, val, skipLabel) : field.isSentence ? renderSentenceSection(field.label, val, skipLabel) : renderFieldRow(field.label, val, skipLabel);
                    /* Rule #74: gate the title-inside-View wrap on the FIRST field's own row/item count.
                       <=8 rows -> wrap={false} keeps title+content together (no orphan, fits one page).
                       >8 rows -> wrap=undefined so a long list flows across pages (no overprint). */
                    if (_first) {
                      const _rows = field.isArray ? (Array.isArray(val) ? val.filter(Boolean).length : 0) : field.isSentence ? splitBySentence(fmtVal(val)).length : 1;
                      return <View key={fIdx} wrap={_rows > 8 ? true : false}><Text style={styles.sectionTitle}>{sectionConfig.title}</Text>{_el}</View>;
                    }
                    return <View key={fIdx}>{_el}</View>;
                  }); })()}
                </View>
              );
            })}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default DetailedFamilyPedigreeDocumentPDFTemplate;
