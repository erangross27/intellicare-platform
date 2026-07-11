import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/* ================================================================
   TMJ Assessment PDF Template
   Helvetica, LETTER, Professional layout with bar charts
   Rule #45: section title INSIDE fieldBox
   Rule #52: bar chart with print-friendly colors
   ================================================================ */

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, color: '#1a1a2e' },
  header: { marginBottom: 16 },
  title: { fontSize: 20, fontFamily: 'Helvetica-Bold', marginBottom: 4, color: '#1a1a2e' },
  date: { fontSize: 10, color: '#555555', marginBottom: 12 },
  divider: { borderBottomWidth: 1, borderBottomColor: '#cccccc', marginBottom: 12 },
  section: { marginBottom: 10 },
  fieldBox: { backgroundColor: '#f8f9fa', borderWidth: 1, borderColor: '#dee2e6', borderRadius: 4, padding: 10, marginBottom: 6 },
  sectionTitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 2, marginTop: 4 },
  listItem: { fontSize: 12, marginBottom: 3, paddingLeft: 8 },
  // Bar chart styles
  chartContainer: { backgroundColor: '#f8f9fa', borderWidth: 1, borderColor: '#dee2e6', padding: 10, marginBottom: 6, borderRadius: 4 },
  chartLegend: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#dee2e6' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendColor: { width: 10, height: 10, borderRadius: 2 },
  legendText: { fontSize: 8, color: '#555555' },
  barRow: { marginBottom: 6 },
  barLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#555555', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 2 },
  barContainer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  barBackground: { flex: 1, height: 16, backgroundColor: '#e5e7eb', borderRadius: 4 },
  barFill: { height: '100%', borderRadius: 4, minWidth: 4 },
  barValue: { fontSize: 10, fontFamily: 'Helvetica-Bold', width: 40, textAlign: 'right' },
  barInterpretation: { fontSize: 8, fontFamily: 'Helvetica-Bold', width: 55, textAlign: 'right' },
});

// ── Helpers ──
const safeString = (val) => {
  if (val === null || val === undefined || val === '') return '';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  return String(val);
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(dateStr); }
};

const formatValue = (val) => {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'string' && val.trim() === '') return null;
  return String(val);
};

const splitIntoItems = (text) => {
  if (!text) return [];
  const str = String(text).trim();
  if (!str) return [];
  if (str.includes(';')) return str.split(';').map(s => s.trim()).filter(Boolean);
  const numbered = str.match(/\d+\.\s+/);
  if (numbered) return str.split(/(?=\d+\.\s+)/).map(s => s.trim()).filter(Boolean);
  return str.split(/(?<!(?:Dr|Mr|Mrs|Ms|Jr|Sr|St|vs|etc)\.)(?<=\.)\s+(?=[A-Z])/).map(s => s.trim()).filter(Boolean);
};

const stripNumber = (text) => {
  if (!text) return '';
  return String(text).replace(/^\d+[\.\)]\s*/, '').trim();
};

// ── ROM Bar Chart Config (print-friendly colors) ──
const ROM_MEASURES = [
  { key: 'maximalIncisorOpening', label: 'Maximal Opening', max: 60, normalMin: 40, unit: 'mm' },
  { key: 'assistedMouthOpening', label: 'Assisted Opening', max: 60, normalMin: 45, unit: 'mm' },
  { key: 'lateralExcursionRight', label: 'Lateral Excursion (R)', max: 15, normalMin: 8, unit: 'mm' },
  { key: 'lateralExcursionLeft', label: 'Lateral Excursion (L)', max: 15, normalMin: 8, unit: 'mm' },
  { key: 'protrusiveMovement', label: 'Protrusive Movement', max: 15, normalMin: 8, unit: 'mm' },
];

const getRomColor = (value, normalMin) => {
  if (value >= normalMin) return '#6f6f6f';
  if (value >= normalMin * 0.7) return '#a0a0a0';
  return '#5c5c5c';
};

const getRomInterpretation = (value, normalMin) => {
  if (value >= normalMin) return 'Normal';
  if (value >= normalMin * 0.7) return 'Mild';
  return 'Restricted';
};

const romToPercentage = (value, max) => Math.min(100, Math.max(2, (value / max) * 100));

/* Mouth-opening measures where 0 is a sentinel (not measured), not a clinical reading. */
const MOUTH_OPENING_SENTINEL_FIELDS = ['maximalIncisorOpening', 'assistedMouthOpening'];
const isSentinelZero = (fn, v) => MOUTH_OPENING_SENTINEL_FIELDS.includes(fn) && (v === 0 || v === '0');

const getPainColor = (value) => {
  if (value <= 3) return '#6f6f6f';
  if (value <= 6) return '#a0a0a0';
  return '#5c5c5c';
};

const getPainInterpretation = (value) => {
  if (value <= 3) return 'Mild';
  if (value <= 6) return 'Moderate';
  return 'Severe';
};

const parseBilateralText = (text) => {
  if (!text) return null;
  const matches = [...text.matchAll(/((?:Right|Left)\s+TMJ):\s*([\s\S]*?)(?=(?:Right|Left)\s+TMJ:|$)/gi)];
  if (matches.length === 0) return null;
  return matches.map(m => [m[1].trim(), m[2].trim().replace(/\.\s*$/, '')]);
};

// ── Render Helpers ──
const renderFieldPDF = (title, fields) => {
  const validFields = fields.filter(([, v]) => formatValue(v) !== null);
  if (validFields.length === 0) return null;
  return (
    <View style={styles.section}>
      <View style={styles.fieldBox} wrap={validFields.length > 8 ? undefined : false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {validFields.map(([label, value], i) => (
          <View key={i} style={{ marginBottom: i < validFields.length - 1 ? 6 : 0 }}>
            <Text style={styles.fieldLabel}>{safeString(label)}</Text>
            <Text style={styles.listItem}>1. {safeString(value)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const renderTextPDF = (title, text) => {
  if (!text) return null;
  const items = splitIntoItems(text);
  if (items.length === 0) return null;
  return (
    <View style={styles.section}>
      <View style={styles.fieldBox} wrap={items.length > 8 ? undefined : false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {items.map((item, i) => (
          <Text key={i} style={styles.listItem}>{i + 1}. {stripNumber(item)}</Text>
        ))}
      </View>
    </View>
  );
};

const renderArrayPDF = (title, items) => {
  if (!items || !Array.isArray(items) || items.filter(Boolean).length === 0) return null;
  const safeItems = items.filter(Boolean);
  return (
    <View style={styles.section}>
      <View style={styles.fieldBox} wrap={safeItems.length > 8 ? undefined : false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {safeItems.map((item, i) => (
          <Text key={i} style={styles.listItem}>{i + 1}. {stripNumber(item)}</Text>
        ))}
      </View>
    </View>
  );
};

const renderPairSubtitlePDF = (title, entries) => {
  const validEntries = entries.filter(e => Array.isArray(e) && e.length >= 2 && e[1]);
  if (validEntries.length === 0) return null;
  return (
    <View style={styles.section}>
      <View style={styles.fieldBox} wrap={validEntries.length > 8 ? undefined : false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {validEntries.map(([label, value], i) => (
          <View key={i} style={{ marginBottom: i < validEntries.length - 1 ? 6 : 0 }}>
            <Text style={styles.fieldLabel}>{safeString(label)}</Text>
            <Text style={styles.listItem}>1. {safeString(value)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const TmjAssessmentPDFTemplate = ({ records = [] }) => (
  <Document>
    {records.map((record, idx) => (
      <Page key={idx} size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>TMJ Assessment {idx + 1}</Text>
          <Text style={styles.date}>{formatDate(record.date || record.createdAt)}</Text>
          <View style={styles.divider} />
        </View>

        {/* ── Range of Motion Bar Chart ── */}
        {ROM_MEASURES.some(m => formatValue(record[m.key]) !== null && !isSentinelZero(m.key, record[m.key])) && (
          <View style={styles.section}>
            <View style={styles.chartContainer}>
              <Text style={styles.sectionTitle}>Range of Motion</Text>
              {/* Legend */}
              <View style={styles.chartLegend} wrap={false}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: '#6f6f6f' }]} />
                  <Text style={styles.legendText}>Normal</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: '#a0a0a0' }]} />
                  <Text style={styles.legendText}>Mildly Restricted</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: '#5c5c5c' }]} />
                  <Text style={styles.legendText}>Restricted</Text>
                </View>
              </View>
              {/* Bars */}
              {ROM_MEASURES.map((m) => {
                const val = record[m.key];
                if (formatValue(val) === null || isSentinelZero(m.key, val)) return null;
                const color = getRomColor(val, m.normalMin);
                const interp = getRomInterpretation(val, m.normalMin);
                const pct = romToPercentage(val, m.max);
                return (
                  <View key={m.key} style={styles.barRow}>
                    <Text style={styles.barLabel}>{m.label}</Text>
                    <View style={styles.barContainer}>
                      <View style={styles.barBackground}>
                        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
                      </View>
                      <Text style={[styles.barValue, { color }]}>{val} {m.unit}</Text>
                      <Text style={[styles.barInterpretation, { color }]}>{interp}</Text>
                    </View>
                  </View>
                );
              })}
              {/* Deviation on Opening */}
              {record.deviationOnOpening && (
                <View style={{ marginTop: 6 }}>
                  <Text style={styles.fieldLabel}>Deviation on Opening</Text>
                  <Text style={styles.listItem}>1. {record.deviationOnOpening}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ── Pain & Functional Assessment ── */}
        {(formatValue(record.jawPainIntensity) !== null || formatValue(record.jawFunctionalLimitationScale) !== null || record.gcps_chronicPainGrade || (record.bruxismPresence !== undefined && record.bruxismPresence !== null)) && (
          <View style={styles.section}>
            <View style={styles.fieldBox} wrap={false}>
              <Text style={styles.sectionTitle}>Pain & Functional Assessment</Text>
              {formatValue(record.jawPainIntensity) !== null && (
                <View style={styles.barRow}>
                  <Text style={styles.barLabel}>Pain Intensity</Text>
                  <View style={styles.barContainer}>
                    <View style={styles.barBackground}>
                      <View style={[styles.barFill, { width: `${(record.jawPainIntensity / 10) * 100}%`, backgroundColor: getPainColor(record.jawPainIntensity) }]} />
                    </View>
                    <Text style={[styles.barValue, { color: getPainColor(record.jawPainIntensity) }]}>{record.jawPainIntensity}/10</Text>
                    <Text style={[styles.barInterpretation, { color: getPainColor(record.jawPainIntensity) }]}>{getPainInterpretation(record.jawPainIntensity)}</Text>
                  </View>
                </View>
              )}
              {formatValue(record.jawFunctionalLimitationScale) !== null && (
                <View style={styles.barRow}>
                  <Text style={styles.barLabel}>Jaw Functional Limitation Scale</Text>
                  <View style={styles.barContainer}>
                    <View style={styles.barBackground}>
                      <View style={[styles.barFill, { width: `${(record.jawFunctionalLimitationScale / 10) * 100}%`, backgroundColor: getPainColor(record.jawFunctionalLimitationScale) }]} />
                    </View>
                    <Text style={[styles.barValue, { color: getPainColor(record.jawFunctionalLimitationScale) }]}>{record.jawFunctionalLimitationScale}/10</Text>
                    <Text style={[styles.barInterpretation, { color: getPainColor(record.jawFunctionalLimitationScale) }]}>{getPainInterpretation(record.jawFunctionalLimitationScale)}</Text>
                  </View>
                </View>
              )}
              {record.gcps_chronicPainGrade && (
                <View style={{ marginTop: 4 }}>
                  <Text style={styles.fieldLabel}>Chronic Pain Grade (GCPS)</Text>
                  <Text style={styles.listItem}>1. {record.gcps_chronicPainGrade}</Text>
                </View>
              )}
              {record.bruxismPresence !== undefined && record.bruxismPresence !== null && (
                <View style={{ marginTop: 4 }}>
                  <Text style={styles.fieldLabel}>Bruxism</Text>
                  <Text style={styles.listItem}>{record.bruxismPresence ? 'Yes' : 'No'}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ── Joint Sounds ── */}
        {renderPairSubtitlePDF('Joint Sounds', [
          ['Right', record.jointSoundsRight],
          ['Left', record.jointSoundsLeft],
        ])}

        {/* ── Muscle Palpation ── */}
        {renderFieldPDF('Muscle Palpation', [
          ['Masseter', record.masseterPalpationTenderness],
          ['Temporalis', record.temporalisPalpationTenderness],
          ['Lateral Pterygoid', record.lateralPterygoidPalpation],
          ['Medial Pterygoid', record.medialPterygoidPalpation],
        ])}

        {/* ── Capsular & Joint Assessment ── */}
        {(() => {
          const bilateral = parseBilateralText(record.capsularTenderness);
          if (bilateral) {
            return renderPairSubtitlePDF('Capsular & Joint Assessment', bilateral);
          }
          return renderFieldPDF('Capsular & Joint Assessment', [
            ['Capsular Tenderness', record.capsularTenderness],
          ]);
        })()}

        {/* ── Disc Assessment ── */}
        {renderFieldPDF('Disc Assessment', [
          ['Disc Displacement Classification', record.discDisplacementClassification],
          ['MRI Disc Position', record.mriDiscPosition],
          ['Effusion', record.effusionPresence !== undefined && record.effusionPresence !== null ? (record.effusionPresence ? 'Yes' : 'No') : null],
        ])}

        {/* ── DC/TMD Diagnosis ── */}
        {renderArrayPDF('DC/TMD Diagnosis', record.dc_tmdDiagnosis)}

        {/* ── Occlusion ── */}
        {renderFieldPDF('Occlusion', [
          ['Occlusal Classification', record.occlusalClassification],
          ['Overjet', formatValue(record.overjetMeasurement) !== null ? `${record.overjetMeasurement} mm` : null],
          ['Overbite', formatValue(record.overbiteMeasurement) !== null ? `${record.overbiteMeasurement}%` : null],
        ])}

        {/* ── Condylar Morphology ── */}
        {renderTextPDF('Condylar Morphology', record.condylarMorphology)}
      </Page>
    ))}
  </Document>
);

export default TmjAssessmentPDFTemplate;
