import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * Dermatology Consultations PDF Template — July 2026 canonical BOX-FREE
 * Helvetica — LETTER — BLACK & WHITE (#000000 titles/values, #999999 label rules).
 *
 * page 14 / title 26 / recordTitle 19 / sectionTitle 16 + 1pt black rule /
 * fieldLabel & subLabel 13 + 0.5pt #999 rule / values 14.
 * Rule #74: wrap is BOOLEAN only (items>8 → true, else false); sectionTitle rides INSIDE
 * the field View (never a bare sibling). Every value row numbered ("1." even singles).
 * Single-name label skip. Labeled groups restart numbering; unlabeled rows run on.
 * Mirrors the JSX/Copy exactly: semicolon fields → sub-label + numbered value rows;
 * dermatoscopeFindings → numbered comma rows; sentence fields → parseLabel + >=3 comma rows.
 */

const safeString = (str) => {
  if (str === null || str === undefined) return '';
  if (typeof str === 'boolean') return str ? 'Yes' : 'No';
  if (typeof str === 'number') return String(str);
  return String(str)
    .replace(/μm/g, 'um')
    .replace(/°/g, 'deg')
    .replace(/±/g, '+/-')
    .replace(/×/g, 'x')
    .replace(/÷/g, '/')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/•/g, '-')
    .replace(/—/g, '--')
    .replace(/–/g, '-')
    .replace(/[^\x00-\x7F]/g, '');
};

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, paddingBottom: 14, borderBottomWidth: 2, borderBottomColor: '#000000' },
  title: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center' },
  recordContainer: { paddingBottom: 8 },
  recordHeader: { marginBottom: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 16 },
  fieldGroup: { marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 4, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  subLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  value: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2 },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  barContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  barBackground: { flex: 1, height: 14, backgroundColor: '#cccccc', overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#000000' },
  barLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 2 },
  barInterpretation: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 2 },
  emptyState: { textAlign: 'center', color: '#000000', fontSize: 14, padding: 40 },
});

// Split by semicolon (parenthesis-aware)
const splitBySemicolon = (text) => {
  if (!text || typeof text !== 'string') return [];
  const result = [];
  let current = '';
  let parenDepth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') parenDepth++;
    else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);
    if (ch === ';' && parenDepth === 0) {
      const trimmed = current.trim();
      if (trimmed) result.push(trimmed);
      current = '';
    } else {
      current += ch;
    }
  }
  const trimmed = current.trim();
  if (trimmed) result.push(trimmed);
  return result;
};

// Split by comma (parenthesis-aware + guards — mirrors the JSX exactly)
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [];
  const result = [];
  let current = '';
  let parenDepth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') parenDepth++;
    else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);
    if (ch === ',' && parenDepth === 0) {
      const rest = text.slice(i + 1);
      const noSpace = !/^\s/.test(rest);
      const nextWordM = rest.match(/^\s*([^\s,]+)/);
      const nextWord = nextWordM ? nextWordM[1].toLowerCase() : '';
      const prevWordM = current.match(/(\S+)\s*$/);
      const prevWord = prevWordM ? prevWordM[1].toLowerCase() : '';
      const nextCharM = rest.match(/^\s*(.)/);
      const nextChar = nextCharM ? nextCharM[1] : '';
      const badNext = nextChar && !/[A-Za-z>(]/.test(nextChar);
      if (noSpace || nextWord === 'and' || nextWord === 'or' || prevWord === 'and' || prevWord === 'or' || badNext) {
        current += ch;
        continue;
      }
      const trimmed = current.trim();
      if (trimmed) result.push(trimmed);
      current = '';
    } else {
      current += ch;
    }
  }
  const trimmed = current.trim();
  if (trimmed) result.push(trimmed);
  return result;
};

// Parse label from "Label: Value" pattern
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text };
  const colonIdx = text.indexOf(':');
  if (colonIdx > 0 && colonIdx < text.length - 1) {
    const label = text.substring(0, colonIdx).trim();
    const value = text.substring(colonIdx + 1).trim();
    if (label.length > 0 && label.length < 60 && value.length > 0) {
      return { isLabeled: true, label, value };
    }
  }
  return { isLabeled: false, label: '', value: text };
};

// Split by sentence with title protection (mirrors the JSX char-walker)
const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  const result = [];
  let current = '';
  let parenDepth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') parenDepth++;
    else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);
    if ((ch === '.' || ch === ';') && parenDepth === 0 && i + 1 < text.length && /\s/.test(text[i + 1])) {
      if (ch === '.' && /\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|etc)$/.test(current)) {
        current += ch;
        continue;
      }
      const trimmed = current.trim();
      if (trimmed) result.push(trimmed);
      current = '';
      while (i + 1 < text.length && /\s/.test(text[i + 1])) i++;
    } else {
      current += ch;
    }
  }
  const trimmed = current.replace(/[.;]+$/, '').trim();
  if (trimmed) result.push(trimmed);
  return result;
};

// PASI severity helper (B&W)
const getPASISeverity = (pasi) => {
  if (pasi === null || pasi === undefined) return null;
  const val = typeof pasi === 'number' ? pasi : parseFloat(pasi);
  if (isNaN(val)) return null;
  if (val <= 5) return { label: 'Clear/Almost Clear', percentage: Math.max(7, (val / 72) * 100) };
  if (val <= 10) return { label: 'Mild', percentage: (val / 72) * 100 };
  if (val <= 20) return { label: 'Moderate', percentage: (val / 72) * 100 };
  return { label: 'Severe', percentage: (val / 72) * 100 };
};

// Simple fields — numbered "1. value"; single-name label skip
const renderSimpleField = (sectionTitle, fields, keyPrefix) => {
  const validFields = fields.filter(f => f.value !== null && f.value !== undefined && f.value !== '');
  if (validFields.length === 0) return null;

  return (
    <View key={keyPrefix} style={styles.section}>
      <View style={styles.fieldGroup} wrap={false}>
        <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text>
        {validFields.map((f, idx) => {
          const showLabel = f.label && f.label.trim().toLowerCase() !== String(sectionTitle).trim().toLowerCase();
          return (
            <View key={`${keyPrefix}-${idx}`}>
              {showLabel && <Text style={styles.fieldLabel}>{safeString(f.label)}</Text>}
              <Text style={styles.listItem}>{`1. ${safeString(f.value)}`}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

// Sentence field — parseLabel per sentence; labeled → sub-label + rows (restart);
// unlabeled → running count; >=3 guarded comma items → per-item rows
const renderSentenceField = (sectionTitle, value, keyPrefix) => {
  const sentences = splitBySentence(value || '');
  if (sentences.length === 0) return null;

  const lines = [];
  let running = 1;
  sentences.forEach(sentence => {
    const parsed = parseLabel(sentence);
    const val = (parsed.isLabeled ? parsed.value : sentence).replace(/[;.]+$/, '').trim();
    if (!val) return;
    const items = splitByComma(val);
    if (parsed.isLabeled) {
      lines.push({ sub: true, text: parsed.label });
      if (items.length >= 3) items.forEach((it, i) => lines.push({ sub: false, text: `${i + 1}. ${it}` }));
      else lines.push({ sub: false, text: `1. ${val}` });
    } else if (items.length >= 3) {
      items.forEach(it => lines.push({ sub: false, text: `${running++}. ${it}` }));
    } else {
      lines.push({ sub: false, text: `${running++}. ${val}` });
    }
  });
  if (lines.length === 0) return null;

  return (
    <View key={keyPrefix} style={styles.section}>
      <View style={styles.fieldGroup} wrap={lines.length > 8 ? true : false}>
        <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text>
        {lines.map((l, idx) => (
          <Text key={`${keyPrefix}-${idx}`} style={l.sub ? styles.subLabel : styles.listItem}>{safeString(l.text)}</Text>
        ))}
      </View>
    </View>
  );
};

// Array field — numbered items
const renderArrayField = (sectionTitle, items, keyPrefix) => {
  if (!items || !Array.isArray(items) || items.length === 0) return null;

  return (
    <View key={keyPrefix} style={styles.section}>
      <View style={styles.fieldGroup} wrap={items.length > 8 ? true : false}>
        <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text>
        {items.map((item, idx) => (
          <Text key={`${keyPrefix}-${idx}`} style={styles.listItem}>
            {`${idx + 1}. ${safeString(item)}`}
          </Text>
        ))}
      </View>
    </View>
  );
};

// Semicolon field — labeled items → sub-label + "1. value"; unlabeled → running numbered
const renderSemicolonField = (sectionTitle, value, keyPrefix) => {
  const items = splitBySemicolon(value || '');
  if (items.length === 0) return null;

  let running = 1;
  return (
    <View key={keyPrefix} style={styles.section}>
      <View style={styles.fieldGroup} wrap={items.length > 8 ? true : false}>
        <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text>
        {items.map((item, idx) => {
          const parsed = parseLabel(item);
          if (parsed.isLabeled) {
            return (
              <View key={`${keyPrefix}-${idx}`}>
                <Text style={styles.subLabel}>{safeString(parsed.label)}</Text>
                <Text style={styles.listItem}>{`1. ${safeString(parsed.value)}`}</Text>
              </View>
            );
          }
          return (
            <Text key={`${keyPrefix}-${idx}`} style={styles.listItem}>
              {`${running++}. ${safeString(item)}`}
            </Text>
          );
        })}
      </View>
    </View>
  );
};

// Comma-split field — numbered items
const renderCommaSplitField = (sectionTitle, value, keyPrefix) => {
  const items = splitByComma(value || '');
  if (items.length === 0) return null;

  return (
    <View key={keyPrefix} style={styles.section}>
      <View style={styles.fieldGroup} wrap={items.length > 8 ? true : false}>
        <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text>
        {items.map((item, idx) => (
          <Text key={`${keyPrefix}-${idx}`} style={styles.listItem}>
            {`${idx + 1}. ${safeString(item)}`}
          </Text>
        ))}
      </View>
    </View>
  );
};

const DermatologyConsultationsDocumentPDFTemplate = ({ document: docData }) => {
  const records = React.useMemo(() => {
    if (Array.isArray(docData)) return docData;
    if (docData?.dermatology_consultations) return Array.isArray(docData.dermatology_consultations) ? docData.dermatology_consultations : [docData.dermatology_consultations];
    if (docData?.documentData) {
      const dd = docData.documentData;
      if (Array.isArray(dd)) return dd;
      if (dd?.dermatology_consultations) return Array.isArray(dd.dermatology_consultations) ? dd.dermatology_consultations : [dd.dermatology_consultations];
      return [dd];
    }
    if (docData && typeof docData === 'object') return [docData];
    return [];
  }, [docData]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.title}>Dermatology Consultations</Text>
          </View>
          <Text style={styles.emptyState}>No dermatology consultation records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.title}>Dermatology Consultations</Text>
        </View>

        {records.map((record, idx) => {
          const pasiSeverity = getPASISeverity(record.pasiScore);

          return (
            <View key={record._id || idx} style={styles.recordContainer} break={idx > 0}>
              {/* Record Header */}
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>{safeString(`Dermatology Consultation ${idx + 1}`)}</Text>
              </View>

              {/* Chief Complaint */}
              {record.chiefComplaint && renderSentenceField('Chief Complaint', record.chiefComplaint, `cc-${idx}`)}

              {/* Skin Lesion Locations - Array */}
              {renderArrayField('Skin Lesion Locations', Array.isArray(record.skinLesionLocation) ? record.skinLesionLocation : (record.skinLesionLocation ? [record.skinLesionLocation] : []), `sll-${idx}`)}

              {/* Lesion Morphology */}
              {record.lesionMorphology && renderSemicolonField('Lesion Morphology', record.lesionMorphology, `lm-${idx}`)}

              {/* Lesion Details */}
              {record.lesionSize && renderSimpleField('Lesion Details', [
                { label: 'Lesion Size', value: record.lesionSize },
              ], `ld-${idx}`)}

              {/* ABCDE Assessment - labeled sentences */}
              {record.abcdeAssessment && renderSentenceField('ABCDE Assessment', record.abcdeAssessment, `abcde-${idx}`)}

              {/* Dermatoscope Findings - comma list */}
              {record.dermatoscopeFindings && renderCommaSplitField('Dermatoscope Findings', record.dermatoscopeFindings, `df-${idx}`)}

              {/* Biopsy Information */}
              {(record.biopsyPerformed !== undefined || record.biopsyType) && renderSimpleField('Biopsy Information', [
                { label: 'Biopsy Performed', value: record.biopsyPerformed !== undefined ? (record.biopsyPerformed ? 'Yes' : 'No') : null },
                { label: 'Biopsy Type', value: record.biopsyType },
              ], `biopsy-${idx}`)}

              {/* Histopathology Results */}
              {record.histopathologyResults && renderSentenceField('Histopathology Results', record.histopathologyResults, `histo-${idx}`)}

              {/* PASI Score with Bar Chart */}
              {(() => {
                const n = parseFloat(record.pasiScore);
                if (isNaN(n) || n === 0) return null;
                return (
                  <View key={`pasi-${idx}`} style={styles.section}>
                    <View style={styles.fieldGroup} wrap={false}>
                      <Text style={styles.sectionTitle}>PASI Score</Text>
                      <Text style={styles.listItem}>{`1. ${safeString(n)}`}</Text>
                      {pasiSeverity && (
                        <>
                          <Text style={styles.barLabel}>Psoriasis Area Severity Index (0-72)</Text>
                          <View style={styles.barContainer}>
                            <View style={styles.barBackground}>
                              <View style={[styles.barFill, { width: `${pasiSeverity.percentage}%` }]} />
                            </View>
                          </View>
                          <Text style={styles.barInterpretation}>{safeString(pasiSeverity.label)}</Text>
                        </>
                      )}
                    </View>
                  </View>
                );
              })()}

              {/* SCORAD Index - number, hide-zero */}
              {(() => {
                const n = parseFloat(record.scoradIndex);
                if (isNaN(n) || n === 0) return null;
                return renderSimpleField('SCORAD Index', [
                  { label: 'SCORAD Index', value: String(n) },
                ], `scorad-${idx}`);
              })()}

              {/* Fitzpatrick Skin Type */}
              {record.fitzpatrickSkinType && renderSimpleField('Fitzpatrick Skin Type', [
                { label: 'Fitzpatrick Skin Type', value: record.fitzpatrickSkinType },
              ], `fst-${idx}`)}

              {/* Melanoma Staging */}
              {(record.melanomaBreslow || record.melanomaClark) && renderSimpleField('Melanoma Staging', [
                { label: 'Breslow Depth', value: record.melanomaBreslow },
                { label: 'Clark Level', value: record.melanomaClark },
              ], `mel-${idx}`)}

              {/* Patch Test Results */}
              {record.patchTestResults && renderSentenceField('Patch Test Results', record.patchTestResults, `ptr-${idx}`)}

              {/* Wood's Lamp Findings */}
              {record.woodsLampFindings && renderSentenceField("Wood's Lamp Findings", record.woodsLampFindings, `wlf-${idx}`)}

              {/* KOH Test */}
              {record.kOHTest && renderSimpleField('KOH Test', [
                { label: 'KOH Test', value: record.kOHTest },
              ], `koh-${idx}`)}

              {/* Suspected Diagnoses */}
              {renderArrayField('Suspected Diagnoses', record.suspectedDiagnosis, `sd-${idx}`)}

              {/* Allergic Reactions */}
              {renderArrayField('Allergic Reactions', record.allergicReactions, `ar-${idx}`)}

              {/* Topical Medications */}
              {renderArrayField('Topical Medications', record.topicalMedications, `tm-${idx}`)}

              {/* Systemic Therapy */}
              {renderArrayField('Systemic Therapy', record.systemicTherapy, `st-${idx}`)}

              {/* Phototherapy */}
              {record.phototherapyRecommended !== undefined && renderSimpleField('Phototherapy', [
                { label: 'Phototherapy Recommended', value: record.phototherapyRecommended ? 'Yes' : 'No' },
              ], `photo-${idx}`)}

              {/* Follow-Up Interval */}
              {record.followUpInterval && renderSemicolonField('Follow-Up Interval', record.followUpInterval, `fu-${idx}`)}

              {/* Referral Specialty */}
              {record.referralSpecialty && renderSimpleField('Referral Specialty', [
                { label: 'Referral Specialty', value: record.referralSpecialty },
              ], `ref-${idx}`)}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default DermatologyConsultationsDocumentPDFTemplate;
