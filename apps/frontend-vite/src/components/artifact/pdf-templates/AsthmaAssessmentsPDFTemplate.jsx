/**
 * AsthmaAssessmentsPDFTemplate.jsx
 * PDFDownloadLink + pdfData memo pattern
 * ASCII separators only (no unicode box-drawing)
 * Bar charts with 2 medical categories
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 12,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  documentTitle: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 24,
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    paddingBottom: 12,
    color: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  recordSection: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
  },
  recordTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 8,
    color: '#000000',
    backgroundColor: '#f0f0f0',
    padding: 8,
    borderWidth: 1,
    borderColor: '#000000',
  },
  recordMeta: {
    fontSize: 11,
    marginBottom: 4,
    color: '#333333',
    paddingLeft: 4,
  },
  fieldContainer: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    marginBottom: 6,
    color: '#000000',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    paddingBottom: 4,
  },
  subSectionTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
    marginTop: 4,
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: 12,
    color: '#000000',
    lineHeight: 1.5,
    paddingLeft: 12,
  },
  listItem: {
    fontSize: 12,
    lineHeight: 1.5,
    paddingLeft: 12,
    marginBottom: 4,
    color: '#000000',
  },
  emptyState: {
    textAlign: 'center',
    padding: 40,
    fontSize: 14,
    color: '#666666',
  },
  separator: {
    fontSize: 10,
    color: '#999999',
    marginBottom: 8,
    textAlign: 'center',
  },
  // Chart styles
  chartContainer: {
    marginBottom: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 4,
    backgroundColor: '#f9fafb',
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  categoryName: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
  },
  categoryDescription: {
    fontSize: 10,
    color: '#6b7280',
  },
  barChartRow: {
    marginBottom: 8,
    padding: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 4,
  },
  barLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 4,
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  barBackground: {
    flex: 1,
    height: 12,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    marginRight: 8,
  },
  barFill: {
    height: 12,
    borderRadius: 3,
  },
  barValue: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    minWidth: 60,
    textAlign: 'right',
  },
  barInterpretation: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
  },
});

const formatDate = (dateString) => {
  if (!dateString) return '';
  try {
    return new Date(dateString.$date || dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(dateString); }
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<=[.!?])\s+|(?<=;)\s+/).filter(s => s.trim().length > 0);
};

// Score extraction
const extractACTScore = (cl) => {
  if (!cl) return null;
  const m = String(cl).match(/ACT\s*(?:Score\s*)?(\d+)\/(\d+)/i);
  return m ? { value: parseInt(m[1], 10), max: parseInt(m[2], 10) } : null;
};
const extractFEV1 = (sp) => {
  if (!sp) return null;
  const m = String(sp).match(/FEV1[:\s]*(\d+(?:\.\d+)?)\s*%/i);
  return m ? { value: parseFloat(m[1]) } : null;
};
const extractFeNO = (n) => {
  if (!n) return null;
  const m = String(n).match(/FeNO[:\s]*(\d+(?:\.\d+)?)\s*ppb/i);
  return m ? { value: parseFloat(m[1]) } : null;
};
const extractEosinophils = (n) => {
  if (!n) return null;
  const m = String(n).match(/Eosinophils[:\s]*(\d+(?:\.\d+)?)\s*(?:cells\/[μu]L)?/i);
  return m ? { value: parseFloat(m[1]) } : null;
};
const extractIgE = (n) => {
  if (!n) return null;
  const m = String(n).match(/IgE[:\s]*(\d+(?:\.\d+)?)\s*(?:IU\/[mM]L)?/i);
  return m ? { value: parseFloat(m[1]) } : null;
};

// PDF is grayscale only — interpretation shading uses neutral grays (no saturated color).
const getACTInterp = (s) => { if (s >= 20) return { color: '#000000', text: 'Well Controlled' }; if (s >= 16) return { color: '#444444', text: 'Not Well Controlled' }; return { color: '#000000', text: 'Very Poorly Controlled' }; };
const getFEV1Interp = (v) => { if (v >= 80) return { color: '#000000', text: 'Normal' }; if (v >= 60) return { color: '#444444', text: 'Mild Obstruction' }; if (v >= 40) return { color: '#444444', text: 'Moderate Obstruction' }; return { color: '#000000', text: 'Severe Obstruction' }; };
const getFeNOInterp = (v) => { if (v < 25) return { color: '#000000', text: 'Normal' }; if (v <= 50) return { color: '#444444', text: 'Elevated' }; return { color: '#000000', text: 'High' }; };
const getEosInterp = (v) => { if (v < 300) return { color: '#000000', text: 'Normal' }; if (v <= 500) return { color: '#444444', text: 'Elevated' }; return { color: '#000000', text: 'High' }; };
const getIgEInterp = (v) => { if (v < 100) return { color: '#000000', text: 'Normal' }; if (v <= 400) return { color: '#444444', text: 'Elevated' }; return { color: '#000000', text: 'High' }; };

const buildChartData = (record) => {
  const categories = [];
  const controlBars = [];

  const act = extractACTScore(record.controlLevel);
  if (act) {
    const interp = getACTInterp(act.value);
    controlBars.push({ key: 'act', label: 'ACT Score', value: `${act.value}/${act.max}`, percentage: Math.round((act.value / act.max) * 100), color: interp.color, interpretation: interp.text });
  }
  const fev1 = extractFEV1(record.spirometry);
  if (fev1) {
    const interp = getFEV1Interp(fev1.value);
    controlBars.push({ key: 'fev1', label: 'FEV1', value: `${fev1.value}%`, percentage: Math.round(fev1.value), color: interp.color, interpretation: interp.text });
  }
  if (controlBars.length > 0) categories.push({ name: 'Asthma Control & Lung Function', description: 'Pulmonology', bars: controlBars });

  const bioBars = [];
  const feno = extractFeNO(record.notes);
  if (feno) { const i = getFeNOInterp(feno.value); bioBars.push({ key: 'feno', label: 'FeNO', value: `${feno.value} ppb`, percentage: Math.min(Math.round(feno.value), 100), color: i.color, interpretation: i.text }); }
  const eos = extractEosinophils(record.notes);
  if (eos) { const i = getEosInterp(eos.value); bioBars.push({ key: 'eos', label: 'Eosinophils', value: `${eos.value} cells/uL`, percentage: Math.min(Math.round((eos.value / 1000) * 100), 100), color: i.color, interpretation: i.text }); }
  const ige = extractIgE(record.notes);
  if (ige) { const i = getIgEInterp(ige.value); bioBars.push({ key: 'ige', label: 'IgE', value: `${ige.value} IU/mL`, percentage: Math.min(Math.round((ige.value / 500) * 100), 100), color: i.color, interpretation: i.text }); }
  if (bioBars.length > 0) categories.push({ name: 'Type 2 Inflammation Biomarkers', description: 'Allergology/Immunology', bars: bioBars });

  return categories;
};

const AsthmaAssessmentsPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (Array.isArray(templateData)) return templateData;
    if (templateData?.asthma_assessments) return Array.isArray(templateData.asthma_assessments) ? templateData.asthma_assessments : [templateData.asthma_assessments];
    if (templateData?.documentData) {
      const dd = templateData.documentData;
      if (Array.isArray(dd)) return dd;
      if (dd?.asthma_assessments) return Array.isArray(dd.asthma_assessments) ? dd.asthma_assessments : [dd.asthma_assessments];
      return [dd];
    }
    if (templateData && typeof templateData === 'object') return [templateData];
    return [];
  }, [templateData]);

  // Detect an embedded "Label: value" (e.g. Action Plan "Three-zone ...: Green Zone >380, ...").
  const parseLabel = (text) => {
    const s = String(text == null ? '' : text);
    const m = s.match(/^([^:]{1,80}):\s+(\S.*)$/s);
    return m ? { label: m[1].trim(), value: m[2].trim() } : null;
  };

  // sub-field WITHIN a section: sub-label (bold) above the value — never side-by-side "Label: value"
  const renderStackedField = (label, value) => {
    if (!value || (Array.isArray(value) && value.length === 0) || String(value).trim() === '') return null;
    return (
      <View style={{ marginBottom: 6 }} wrap={false}>
        <Text style={styles.subSectionTitle}>{label}</Text>
        <Text style={styles.fieldValue}>{String(value)}</Text>
      </View>
    );
  };

  // single-name section (section title === field label): header + value below, NO duplicate label.
  // If the value embeds "Label: value", surface that label as a sub-title (mini-card style).
  const renderTitledField = (title, value) => {
    if (!value || String(value).trim() === '') return null;
    const parsed = parseLabel(String(value));
    return (
      <View style={styles.fieldContainer} wrap={false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {parsed ? (
          <>
            <Text style={styles.subSectionTitle}>{parsed.label}</Text>
            <Text style={styles.fieldValue}>{parsed.value}</Text>
          </>
        ) : (
          <Text style={styles.fieldValue}>{String(value)}</Text>
        )}
      </View>
    );
  };

  const renderSentenceField = (label, value) => {
    if (!value || String(value).trim() === '') return null;
    const sentences = splitBySentence(String(value));
    if (sentences.length <= 1) return renderTitledField(label, value);
    return (
      <View style={styles.fieldContainer} wrap={sentences.length > 8}>
        <Text style={styles.sectionTitle}>{label}</Text>
        {sentences.map((s, i) => (
          <Text key={i} style={styles.listItem}>{i + 1}. {s}</Text>
        ))}
      </View>
    );
  };

  const renderArrayField = (label, items) => {
    if (!items || !Array.isArray(items) || items.length === 0) return null;
    return (
      <View style={styles.fieldContainer} wrap={items.length > 8}>
        <Text style={styles.sectionTitle}>{label}</Text>
        {items.map((item, i) => (
          <Text key={i} style={styles.listItem}>{i + 1}. {String(item)}</Text>
        ))}
      </View>
    );
  };

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <Text style={styles.documentTitle}>Asthma Assessments</Text>
          <Text style={styles.emptyState}>No asthma assessment records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Asthma Assessments</Text>

        {records.map((record, idx) => {
          const chartCategories = buildChartData(record);

          return (
            <View key={idx} style={styles.recordSection}>
              <View wrap={false}>
                <Text style={styles.recordTitle}>{`Asthma Assessment ${idx + 1}`}</Text>
                {record.date && <Text style={styles.recordMeta}>Date: {formatDate(record.date)}</Text>}
              </View>

              {idx > 0 && <Text style={styles.separator}>{'='.repeat(60)}</Text>}

              {/* Assessment Info */}
              {(record.provider || record.facility || record.asthmaType || record.severity) && (
                <View style={styles.fieldContainer} wrap={false}>
                  <Text style={styles.sectionTitle}>Assessment Information</Text>
                  {renderStackedField('Provider', record.provider)}
                  {renderStackedField('Facility', record.facility)}
                  {renderStackedField('Asthma Type', record.asthmaType)}
                  {renderStackedField('Severity', record.severity)}
                </View>
              )}

              {/* Score Overview */}
              {chartCategories.length > 0 && (
                <View style={styles.fieldContainer}>
                  <Text style={styles.sectionTitle}>Score Overview</Text>
                  {chartCategories.map((cat, catIdx) => (
                    <View key={catIdx} style={styles.chartContainer}>
                      <View style={styles.categoryHeader}>
                        <Text style={styles.categoryName}>{cat.name}</Text>
                        <Text style={styles.categoryDescription}>{cat.description}</Text>
                      </View>
                      {cat.bars.map((bar) => (
                        <View key={bar.key} style={styles.barChartRow}>
                          <Text style={styles.barLabel}>{bar.label}</Text>
                          <View style={styles.barContainer}>
                            <View style={styles.barBackground}>
                              <View style={[styles.barFill, { width: `${bar.percentage}%`, backgroundColor: bar.color }]} />
                            </View>
                            <Text style={[styles.barValue, { color: bar.color }]}>{bar.value}</Text>
                          </View>
                          <Text style={[styles.barInterpretation, { color: bar.color }]}>{bar.interpretation}</Text>
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              )}

              {/* Fields */}
              {renderTitledField('Control Level', record.controlLevel)}

              {/* Symptoms section: list + frequency + nighttime awakenings (mirrors the JSX grouping) */}
              {(() => {
                const syms = Array.isArray(record.symptoms) ? record.symptoms : [];
                if (syms.length === 0 && !record.symptomFrequency && !record.nighttimeAwakenings) return null;
                const rows = syms.length + (record.symptomFrequency ? 1 : 0) + (record.nighttimeAwakenings ? 1 : 0);
                return (
                  <View style={styles.fieldContainer} wrap={rows > 8}>
                    <Text style={styles.sectionTitle}>Symptoms</Text>
                    {syms.map((item, i) => (<Text key={i} style={styles.listItem}>{i + 1}. {String(item)}</Text>))}
                    {renderStackedField('Symptom Frequency', record.symptomFrequency)}
                    {renderStackedField('Nighttime Awakenings', record.nighttimeAwakenings)}
                  </View>
                );
              })()}

              {renderSentenceField('Exacerbations', record.exacerbations)}
              {renderArrayField('Triggers', record.triggers)}
              {renderSentenceField('Spirometry', record.spirometry)}
              {renderTitledField('Rescue Inhaler Use', record.rescueInhalerUse)}
              {renderTitledField('Peak Flow', record.peakFlow)}
              {renderArrayField('Medications', record.medications)}
              {renderSentenceField('Action Plan', record.actionPlan)}
              {renderSentenceField('Notes', record.notes)}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default AsthmaAssessmentsPDFTemplate;
