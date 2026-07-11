import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * HospitalDischargeDocumentPDFTemplate - June 2026
 * Collection: hospital_discharge
 * Box-free, Helvetica, BLACK/WHITE only. Mirrors the on-screen "Copy All" format
 * (buildSectionCopyText): date fields formatted, string fields split per-sentence
 * with embedded-label + comma-list expansion.
 *
 * 3 Sections:
 *   1. session-info: date, provider, facility, status
 *   2. clinical-findings: findings, assessment
 *   3. discharge-plan: plan, recommendations, notes
 */

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 14,
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  documentTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 20,
    color: '#000000',
    textAlign: 'center',
  },
  recordContainer: {
    marginBottom: 24,
    paddingBottom: 16,
  },
  recordTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 10,
    color: '#000000',
  },
  section: {
    marginBottom: 22,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
    color: '#000000',
  },
  subtitleLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginTop: 14,
    marginBottom: 6,
    paddingLeft: 4,
  },
  fieldRow: {
    marginBottom: 6,
    paddingLeft: 8,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: 14,
    color: '#000000',
    lineHeight: 1.4,
  },
  listItem: {
    fontSize: 14,
    color: '#000000',
    marginBottom: 10,
    paddingLeft: 12,
  },
  groupedListItem: {
    fontSize: 14,
    color: '#000000',
    marginBottom: 10,
    paddingLeft: 24,
  },
  noData: {
    fontSize: 14,
    color: '#666666',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 40,
  },
});

/* Section/field config — mirrors HospitalDischargeDocument.jsx */
const SECTION_TITLES = {
  'session-info': 'Session Information',
  'clinical-findings': 'Clinical Findings & Assessment',
  'discharge-plan': 'Discharge Plan',
};
const SECTION_FIELDS = {
  'session-info': ['date', 'provider', 'facility', 'status'],
  'clinical-findings': ['findings', 'assessment'],
  'discharge-plan': ['plan', 'recommendations', 'notes'],
};
const FIELD_LABELS = {
  date: 'Date',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  recommendations: 'Recommendations',
  notes: 'Notes',
};
const DATE_FIELDS = ['date'];

/* Replace problematic Unicode for Helvetica */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/μm/g, 'um');
  str = str.replace(/µm/g, 'um');
  str = str.replace(/°/g, ' deg');
  str = str.replace(/±/g, '+/-');
  str = str.replace(/≥/g, '>=');
  str = str.replace(/≤/g, '<=');
  str = str.replace(/→/g, '->');
  str = str.replace(/←/g, '<-');
  str = str.replace(/×/g, 'x');
  str = str.replace(/÷/g, '/');
  str = str.replace(/•/g, '-');
  str = str.replace(/–/g, '-');
  str = str.replace(/—/g, '-');
  str = str.replace(/[“”]/g, '"');
  str = str.replace(/[‘’]/g, "'");
  return str;
};

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try {
    const d = new Date(dateValue.$date || dateValue);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return String(dateValue);
  }
};

const hasValue = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'string') return v.trim() !== '';
  return true;
};

const fmtVal = (v) => {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  return String(v || '');
};

/* splitBySentence — mirrors HospitalDischargeDocument.jsx (abbreviation-protected, '.'-only) */
const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text
    .split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/)
    .map((s) => s.trim())
    .filter((s) => s && !/^[;.,!?]+$/.test(s));
};

/* parseLabel — detect "Label: value" patterns */
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

/* splitByComma — parenthesis-aware comma split */
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = [];
  let current = '';
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim();
  if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* Estimate visual line count so the wrap gate reflects real height (~60 chars/line @ 14pt) */
const CHARS_PER_LINE = 60;
const estimateLines = (strings) =>
  strings.reduce((n, s) => n + Math.max(1, Math.ceil(String(s || '').length / CHARS_PER_LINE)), 0);

/* Build the @react-pdf nodes (and plain-text lines for height estimation) for one field.
   Mirrors buildSectionCopyText + formatSentenceFieldLines in HospitalDischargeDocument.jsx. */
const buildFieldNodes = (record, fn, keyBase) => {
  const val = record[fn];
  if (!hasValue(val)) return null;
  const label = FIELD_LABELS[fn] || fn;
  const nodes = [];
  const lines = [];

  if (DATE_FIELDS.includes(fn)) {
    const display = formatDate(val);
    nodes.push(
      <View key={`${keyBase}-row`} style={styles.fieldRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValue}>{safeString(display)}</Text>
      </View>
    );
    lines.push(label, display);
    return { nodes, lines };
  }

  const strVal = fmtVal(val);
  const sentences = splitBySentence(strVal);

  /* Single sentence → plain label + value row */
  if (sentences.length <= 1) {
    nodes.push(
      <View key={`${keyBase}-row`} style={styles.fieldRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValue}>{safeString(strVal)}</Text>
      </View>
    );
    lines.push(label, strVal);
    return { nodes, lines };
  }

  /* Multi-sentence → field label header, then numbered (and comma-expanded) items */
  nodes.push(<Text key={`${keyBase}-hdr`} style={styles.subtitleLabel}>{label}</Text>);
  lines.push(label);
  let n = 1;
  sentences.forEach((s, sIdx) => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const parts = splitByComma(parsed.value);
      nodes.push(
        <Text key={`${keyBase}-l${sIdx}`} style={styles.subtitleLabel}>{safeString(parsed.label)}:</Text>
      );
      lines.push(parsed.label);
      if (parts.length >= 2) {
        parts.forEach((item, pIdx) => {
          nodes.push(
            <Text key={`${keyBase}-l${sIdx}-p${pIdx}`} style={styles.groupedListItem}>{n}. {safeString(item)}</Text>
          );
          lines.push(item);
          n++;
        });
      } else {
        nodes.push(
          <Text key={`${keyBase}-l${sIdx}-v`} style={styles.groupedListItem}>{n}. {safeString(parsed.value)}</Text>
        );
        lines.push(parsed.value);
        n++;
      }
    } else {
      nodes.push(
        <Text key={`${keyBase}-s${sIdx}`} style={styles.listItem}>{n}. {safeString(s)}</Text>
      );
      lines.push(s);
      n++;
    }
  });
  return { nodes, lines };
};

/* Build one section View, or null when it has no populated fields */
const buildSection = (record, sid, keyBase) => {
  const fields = SECTION_FIELDS[sid] || [];
  const nodes = [];
  const lines = [];
  fields.forEach((fn) => {
    const res = buildFieldNodes(record, fn, `${keyBase}-${fn}`);
    if (res) { nodes.push(...res.nodes); lines.push(...res.lines); }
  });
  if (nodes.length === 0) return null;

  /* Small sections stay together (wrap={false}); tall sections flow across pages */
  const lineCount = estimateLines(lines) + 1; // +1 for the section title
  return (
    <View key={keyBase} style={styles.section} wrap={lineCount > 8 ? undefined : false}>
      <Text style={styles.sectionTitle}>{SECTION_TITLES[sid]}</Text>
      {nodes}
    </View>
  );
};

const HospitalDischargeDocumentPDFTemplate = ({ document: data }) => {
  /* Data unwrap — mirrors HospitalDischargeDocument.jsx so the PDF works whether it
     receives pdfData (flat records) or a raw { hospital_discharge } / documentData wrapper */
  let arr = Array.isArray(data) ? data : (data ? [data] : []);
  arr = arr.flatMap((r) => {
    if (r?.hospital_discharge) return Array.isArray(r.hospital_discharge) ? r.hospital_discharge : [r.hospital_discharge];
    if (r?.documentData) {
      const dd = r.documentData;
      if (Array.isArray(dd)) return dd;
      if (dd?.hospital_discharge) return Array.isArray(dd.hospital_discharge) ? dd.hospital_discharge : [dd.hospital_discharge];
      return [dd];
    }
    return [r];
  });
  const records = arr.filter((r) => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <Text style={styles.noData}>No hospital discharge data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Hospital Discharge</Text>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View wrap={false}>
              <Text style={styles.recordTitle}>Hospital Discharge {idx + 1}</Text>
            </View>
            {Object.keys(SECTION_FIELDS).map((sid) => buildSection(record, sid, `${idx}-${sid}`))}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default HospitalDischargeDocumentPDFTemplate;
