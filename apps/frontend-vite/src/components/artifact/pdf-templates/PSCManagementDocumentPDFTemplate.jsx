import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * PSC Management PDF Template — box-free canonical (black-on-white, underline rules).
 * Primary Sclerosing Cholangitis Management. Aligned field-for-field with the JSX.
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

/* ======= CONFIG (mirrors PSCManagementDocument.jsx) ======= */
const SECTION_TITLES = {
  'overview': 'Overview',
  'medication-imaging': 'Medication & Imaging',
  'management': 'Management & Assessment',
  'plan-recs': 'Plan & Recommendations',
  'notes-section': 'Notes',
};

const SECTION_ORDER = ['overview', 'medication-imaging', 'management', 'plan-recs', 'notes-section'];

const SECTION_FIELDS = {
  'overview': ['date', 'status', 'type', 'provider', 'facility'],
  'medication-imaging': ['ursodeoxycholicAcid', 'mrcp', 'dominantStrictures'],
  'management': ['hepatologyManagement', 'findings', 'assessment'],
  'plan-recs': ['plan', 'recommendations'],
  'notes-section': ['notes'],
};

const FIELD_LABELS = {
  date: 'Date',
  status: 'Status',
  type: 'Type',
  provider: 'Provider',
  facility: 'Facility',
  ursodeoxycholicAcid: 'Ursodeoxycholic Acid',
  mrcp: 'MRCP',
  dominantStrictures: 'Dominant Strictures',
  hepatologyManagement: 'Hepatology Management',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  recommendations: 'Recommendations',
  notes: 'Notes',
};

const DATE_FIELDS = ['date'];
const ARRAY_FIELDS = ['recommendations'];

/* drop a field's own label when it duplicates the section title (single-name gate) */
const sameAsTitle = (label, sid) => (label || '').trim().toLowerCase() === (SECTION_TITLES[sid] || '').trim().toLowerCase();

const formatDate = (dateString) => {
  if (!dateString) return '';
  try {
    return new Date(dateString.$date || dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return String(dateString);
  }
};

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  return String(val)
    .replace(/×/g, 'x')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...');
};

const hasVal = (v) => {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (typeof v === 'number') return true;
  if (typeof v === 'boolean') return true;
  if (Array.isArray(v)) return v.length > 0;
  return true;
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text
    .split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)[.;](?:\s+)/)
    .map(s => s.trim())
    .filter(s => s && !/^[;.,!?]+$/.test(s));
};

/* flat Text element builder for a single field — returns [] when empty */
const fieldEls = (record, f, sid) => {
  const val = record[f];
  if (!hasVal(val)) return [];
  const label = FIELD_LABELS[f] || f;
  const show = !sameAsTitle(label, sid);
  const labelEl = <Text key={f + '-l'} style={styles.fieldLabel}>{label}</Text>;

  if (DATE_FIELDS.includes(f)) {
    const els = show ? [labelEl] : [];
    els.push(<Text key={f + '-v'} style={styles.value}>{formatDate(val)}</Text>);
    return els;
  }
  if (ARRAY_FIELDS.includes(f)) {
    const items = (Array.isArray(val) ? val : [val]).filter(x => x !== null && x !== undefined && String(x).trim() !== '');
    if (!items.length) return [];
    const els = show ? [labelEl] : [];
    items.forEach((item, i) => {
      const text = typeof item === 'string' ? item : item.recommendation || item.text || JSON.stringify(item);
      els.push(<Text key={f + '-i' + i} style={styles.listItem}>{i + 1}. {safeString(text)}</Text>);
    });
    return els;
  }
  // STRING
  const str = safeString(val);
  const sentences = splitBySentence(str);
  const els = show ? [labelEl] : [];
  if (sentences.length > 1) {
    sentences.forEach((s, i) => els.push(<Text key={f + '-s' + i} style={styles.value}>{s.replace(/[.;]+$/, '')}.</Text>));
  } else {
    els.push(<Text key={f + '-v'} style={styles.value}>{str}</Text>);
  }
  return els;
};

/* FLATTEN anti-orphan: glue the section title to its first body line so a title
   never lands alone at the bottom of a page; the rest flow naturally. */
const renderSection = (record, sid) => {
  let body = [];
  (SECTION_FIELDS[sid] || []).forEach(f => { body = body.concat(fieldEls(record, f, sid)); });
  if (!body.length) return null;
  const first = body[0];
  const rest = body.slice(1).map((el, i) => React.cloneElement(el, { key: 'f' + i }));
  return (
    <View key={sid}>
      <View wrap={false}>
        <Text style={styles.sectionTitle}>{SECTION_TITLES[sid]}</Text>
        {first}
      </View>
      {rest}
    </View>
  );
};

const PSCManagementDocumentPDFTemplate = ({ document }) => {
  const records = Array.isArray(document) ? document : [document];
  const hasRecords = records && records.length > 0 && records.some(r => r && Object.keys(r).length > 0);

  if (!hasRecords) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>PSC Management</Text>
          <Text style={styles.noDataText}>No PSC management records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>PSC Management</Text>

        {records.map((record, index) => (
          <View key={index} break={index > 0}>
            <Text style={styles.recordTitle}>PSC Management {index + 1}</Text>
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PSCManagementDocumentPDFTemplate;
