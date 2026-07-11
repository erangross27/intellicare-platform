import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/* ================================================================
   Blood Glucose Logs PDF Template
   Helvetica font, A4 page. BOX-FREE, clean black & white:
   no backgrounds, no borders (only a thin rule under the title),
   only #000000 on #ffffff. (checklist 6a3d4c85 §H)
   ================================================================ */

const OVERVIEW_FIELDS = [
  { key: 'glucoseValue', label: 'Glucose Value' },
  { key: 'readingTime', label: 'Reading Time' },
  { key: 'mealTiming', label: 'Meal Timing' },
];

const DOSING_FIELDS = [
  { key: 'insulinDose', label: 'Insulin Dose' },
  { key: 'correctionFactor', label: 'Correction Factor' },
  { key: 'carbRatio', label: 'Carb Ratio' },
  { key: 'carbohydrates', label: 'Carbohydrates' },
];

const LIFESTYLE_FIELDS = [
  { key: 'exercise', label: 'Exercise' },
  { key: 'symptoms', label: 'Symptoms' },
];

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, color: '#000000', backgroundColor: '#ffffff' },
  header: { marginBottom: 18, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 8 },
  title: { fontSize: 20, fontFamily: 'Helvetica-Bold', marginBottom: 4, color: '#000000' },
  dateText: { fontSize: 10, color: '#000000' },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5, color: '#000000' },
  fieldBlock: { marginBottom: 6 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 2, textTransform: 'uppercase' },
  fieldValue: { fontSize: 12, color: '#000000' },
  listItem: { fontSize: 12, marginBottom: 3, paddingLeft: 8, color: '#000000' },
  subtitleLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 4 },
  subListItem: { fontSize: 12, marginBottom: 3, paddingLeft: 16, color: '#000000' },
});

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  return String(val);
};

const hasValue = (val) => {
  if (val === null || val === undefined) return false;
  if (typeof val === 'boolean') return true;
  if (typeof val === 'number') return true;
  if (typeof val === 'string') return val.trim() !== '';
  return false;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(dateStr); }
};

const splitIntoSentences = (text) => {
  if (!text) return [];
  return text.split(/(?<=[.!?;])\s+/).filter(s => s.trim()).map(s => s.trim().replace(/;$/, ''));
};

const parseEmbeddedSubtitle = (sentence) => {
  const colonIdx = sentence.indexOf(':');
  if (colonIdx === -1 || colonIdx > 50) return null;
  const label = sentence.substring(0, colonIdx).trim();
  const rest = sentence.substring(colonIdx + 1).trim();
  if (!rest) return null;
  const items = rest.split(/,\s*/).map(s => s.trim().replace(/\.$/, '')).filter(Boolean);
  if (items.length < 2) return null;
  return { label, items };
};

/* Title INSIDE the View; @react-pdf v4 BOOLEAN wrap (undefined === false on v4).
   <=8 rows → atomic wrap={false} (moves whole block to next page → no orphan).
   >8 rows → glue title+first row in a wrap={false} sub-View, rest flow → orphan-proof, no overprint. */
const Block = (title, rows) => {
  if (!rows.length) return null;
  if (rows.length <= 8) {
    return (
      <View style={styles.section} wrap={false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {rows}
      </View>
    );
  }
  return (
    <View style={styles.section} wrap>
      <View wrap={false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {rows[0]}
      </View>
      {rows.slice(1)}
    </View>
  );
};

const renderFieldSection = (record, sectionTitle, fields) => {
  const visible = fields.filter(f => hasValue(record[f.key]));
  if (visible.length === 0) return null;
  const rows = visible.map(f => (
    <View key={f.key} style={styles.fieldBlock} wrap={false}>
      <Text style={styles.fieldLabel}>{f.label}</Text>
      <Text style={styles.fieldValue}>{safeString(record[f.key])}</Text>
    </View>
  ));
  return Block(sectionTitle, rows);
};

const renderNotesSection = (record) => {
  const sentences = splitIntoSentences(record.notes);
  if (sentences.length === 0) return null;
  let plainNum = 1;
  const rows = sentences.map((s, i) => {
    const parsed = parseEmbeddedSubtitle(s);
    if (parsed) {
      return (
        <View key={i} wrap={false}>
          <Text style={styles.subtitleLabel}>{parsed.label}:</Text>
          {parsed.items.map((item, j) => (
            <Text key={j} style={styles.subListItem}>{j + 1}. {safeString(item)}</Text>
          ))}
        </View>
      );
    }
    const num = plainNum++;
    return <Text key={i} style={styles.listItem}>{num}. {safeString(s)}</Text>;
  });
  return Block('Notes', rows);
};

const BloodGlucoseLogsPDFTemplate = ({ records = [] }) => {
  if (!records.length) return null;

  return (
    <Document>
      {records.map((record, idx) => (
        <Page key={idx} size="A4" style={styles.page}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Blood Glucose Log {idx + 1}</Text>
            {record.date && <Text style={styles.dateText}>{formatDate(record.date)}</Text>}
          </View>

          {renderFieldSection(record, 'Glucose Overview', OVERVIEW_FIELDS)}
          {renderFieldSection(record, 'Insulin & Dosing', DOSING_FIELDS)}
          {renderFieldSection(record, 'Activity & Symptoms', LIFESTYLE_FIELDS)}
          {renderNotesSection(record)}
        </Page>
      ))}
    </Document>
  );
};

export default BloodGlucoseLogsPDFTemplate;
