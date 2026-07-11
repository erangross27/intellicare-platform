import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// June 2026 PDF Standards - Helvetica font, BLACK & WHITE only (Rule #74 + black/white titles)
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 12,
    padding: 40,
    lineHeight: 1.6,
    backgroundColor: '#ffffff',
  },
  header: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#000000',
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    borderBottomStyle: 'solid',
    paddingBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  recordContainer: {
    marginBottom: 24,
  },
  recordHeader: {
    paddingBottom: 8,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    borderBottomStyle: 'solid',
  },
  recordTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 4,
  },
  recordDate: {
    fontSize: 11,
    color: '#666666',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  miniCard: {
    marginBottom: 8,
    paddingBottom: 4,
  },
  miniCardLabel: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  miniCardValue: {
    fontSize: 12,
    color: '#333333',
    lineHeight: 1.5,
  },
  recDate: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginTop: 4,
  },
  pageNumber: {
    position: 'absolute',
    bottom: 20,
    right: 40,
    fontSize: 10,
    color: '#9ca3af',
  },
});

/* ═══════ CONSTANTS ═══════ */
const SECTION_TITLES = {
  'admission-info': 'Admission Information',
  'clinical-status': 'Clinical Status',
  'interventions-response': 'Interventions & Response',
  'plan-section': 'Plan',
  'recommendations-section': 'Recommendations',
};

const FIELD_LABELS = {
  assessmentDate: 'Assessment Date',
  assessmentTime: 'Assessment Time',
  clinicalStatus: 'Clinical Status',
  vitalSigns: 'Vital Signs',
  interventions: 'Interventions',
  response: 'Response',
  plan: 'Plan',
  recommendations: 'Recommendations',
};

const SECTION_FIELDS = {
  'admission-info': ['assessmentDate', 'assessmentTime'],
  'clinical-status': ['clinicalStatus', 'vitalSigns'],
  'interventions-response': ['interventions', 'response'],
  'plan-section': ['plan'],
  'recommendations-section': ['recommendations'],
};

const NUMBER_FIELDS = [];
const DATE_FIELDS = ['assessmentDate'];
const STRING_FIELDS = ['assessmentTime', 'clinicalStatus', 'vitalSigns', 'interventions', 'response', 'plan'];
const COMMA_LIST_FIELDS = ['vitalSigns', 'interventions'];
const OBJECT_ARRAY_FIELDS = ['recommendations'];

// Format date helper
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

// splitBySentence: split on BOTH period and semicolon followed by whitespace
const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

// splitCommaList: split on top-level SEMICOLONS and COMMAS — NOT inside parens, and NOT thousands commas between digits
const splitCommaList = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if ((ch === ';' || ch === ',') && depth === 0 && !(ch === ',' && /\d/.test(text[i - 1] || '') && /\d/.test(text[i + 1] || ''))) {
      const t = current.trim(); if (t) result.push(t); current = '';
    } else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

const AdmissionAssessmentsDocumentPDFTemplate = ({ document: data }) => {
  // Data unwrapping for wrapped collections
  const unwrapData = (inputData) => {
    if (!inputData) return [];
    if (Array.isArray(inputData)) {
      if (inputData.length === 1 && inputData[0]?.admission_assessments) {
        return inputData[0].admission_assessments;
      }
      return inputData;
    }
    if (inputData.admission_assessments) {
      return inputData.admission_assessments;
    }
    return [inputData];
  };

  const records = unwrapData(data);

  // Render a single field inside a section. sectionTitle is rendered by parent View.
  const renderField = (record, field, sectionTitle) => {
    const val = record[field];
    if (!hasVal(val)) return null;
    const label = FIELD_LABELS[field] || field;
    // Single-name skip: hide the field label when it equals the section title (avoids double title)
    const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();

    if (DATE_FIELDS.includes(field)) {
      return (
        <View key={field} style={styles.miniCard}>
          {showLabel && <Text style={styles.miniCardLabel}>{label}</Text>}
          <Text style={styles.miniCardValue}>{formatDate(val)}</Text>
        </View>
      );
    }

    // Recommendations — array of {recommendation, date}: group consecutive same-date items so the
    // date renders once as a header, with each recommendation as its own numbered line beneath.
    if (OBJECT_ARRAY_FIELDS.includes(field)) {
      const recs = Array.isArray(val) ? val : [];
      if (recs.length === 0) return null;
      const groups = [];
      recs.forEach((r) => {
        const d = (r?.date || '').trim();
        const last = groups[groups.length - 1];
        if (last && last.date === d) last.items.push(r);
        else groups.push({ date: d, items: [r] });
      });
      return (
        <View key={field} style={styles.miniCard}>
          {showLabel && <Text style={styles.miniCardLabel}>{label}</Text>}
          {groups.map((group, gIdx) => (
            <View key={gIdx}>
              {group.date ? <Text style={[styles.miniCardValue, { fontFamily: 'Helvetica-Bold', marginTop: 3 }]}>{group.date}</Text> : null}
              {group.items.map((r, i) => (
                <Text key={i} style={styles.miniCardValue}>{i + 1}. {(r?.recommendation || '').trim()}</Text>
              ))}
            </View>
          ))}
        </View>
      );
    }

    // Comma/semicolon-list field — one item per numbered row (paren + thousands-comma aware)
    if (COMMA_LIST_FIELDS.includes(field)) {
      const items = splitCommaList(fmtVal(val));
      if (items.length > 1) {
        return (
          <View key={field} style={styles.miniCard}>
            {showLabel && <Text style={styles.miniCardLabel}>{label}</Text>}
            {items.map((it, iIdx) => (
              <Text key={iIdx} style={styles.miniCardValue}>{iIdx + 1}. {it}</Text>
            ))}
          </View>
        );
      }
    }

    // String field — split into sentences
    const strVal = fmtVal(val);
    const sentences = splitBySentence(strVal);
    if (sentences.length > 1) {
      return (
        <View key={field} style={styles.miniCard}>
          {showLabel && <Text style={styles.miniCardLabel}>{label}</Text>}
          {sentences.map((s, sIdx) => (
            <Text key={sIdx} style={styles.miniCardValue}>{sIdx + 1}. {s}</Text>
          ))}
        </View>
      );
    }
    return (
      <View key={field} style={styles.miniCard}>
        {showLabel && <Text style={styles.miniCardLabel}>{label}</Text>}
        <Text style={styles.miniCardValue}>{strVal}</Text>
      </View>
    );
  };

  // Compute the wrap-gating item count for a section (the heaviest field's row count)
  const sectionItemCount = (record, presentFields) => {
    let max = presentFields.length;
    presentFields.forEach(f => {
      const val = record[f];
      if (OBJECT_ARRAY_FIELDS.includes(f) && Array.isArray(val)) max = Math.max(max, val.length);
      else if (COMMA_LIST_FIELDS.includes(f)) max = Math.max(max, splitCommaList(fmtVal(val)).length);
      else if (STRING_FIELDS.includes(f)) max = Math.max(max, splitBySentence(fmtVal(val)).length);
    });
    return max;
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>Admission Assessment</Text>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            {/* Record Header */}
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>
                Admission Assessment {String(record._recordNumber || idx + 1)}
              </Text>
              {hasVal(record.assessmentDate) && (
                <Text style={styles.recordDate}>{formatDate(record.assessmentDate)}</Text>
              )}
            </View>

            {/* Sections — Rule #74: each section is ONE wrap-gated View with sectionTitle as FIRST CHILD */}
            {Object.keys(SECTION_FIELDS).map((sid) => {
              const fields = SECTION_FIELDS[sid];
              const presentFields = fields.filter(f => !NUMBER_FIELDS.includes(f) && hasVal(record[f]));
              if (presentFields.length === 0) return null;
              const itemCount = sectionItemCount(record, presentFields);
              return (
                <View key={sid} style={styles.section} wrap={itemCount > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>{SECTION_TITLES[sid]}</Text>
                  {presentFields.map(f => renderField(record, f, SECTION_TITLES[sid]))}
                </View>
              );
            })}
          </View>
        ))}

        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
};

export default AdmissionAssessmentsDocumentPDFTemplate;
