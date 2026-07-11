/* PhysicalExaminationsDocumentPDFTemplate.jsx - February 2026 REBUILD */
/* Helvetica font | Black & White | splitBySentence + parseLabel | Anti-orphan */

import React from 'react';
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';

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
  str = str.replace(/²/g, '2');
  return str;
};

const hasValue = (val) => val !== null && val !== undefined && String(val).trim() !== '';

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
    color: '#000000',
    marginBottom: 20,
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    paddingBottom: 10,
  },
  recordContainer: {
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#666666',
    paddingBottom: 16,
  },
  recordTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 4,
  },
  recordMeta: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 12,
  },
  fieldBox: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  listItem: {
    fontSize: 12,
    color: '#000000',
    marginBottom: 4,
    paddingLeft: 8,
    lineHeight: 1.5,
  },
  inlineLabel: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
  },
  subFieldLabel: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
    marginTop: 6,
    marginBottom: 2,
    paddingLeft: 4,
  },
  chartContainer: {
    marginBottom: 12,
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#666666',
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderWidth: 1,
    borderColor: '#000000',
  },
  legendText: {
    fontSize: 10,
    color: '#000000',
  },
  barRow: {
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
  },
  barLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 4,
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  barBackground: {
    flex: 1,
    height: 16,
    borderWidth: 1,
    borderColor: '#000000',
  },
  barFill: {
    height: '100%',
  },
  barValue: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    minWidth: 80,
    textAlign: 'right',
  },
  barInterpretation: {
    fontSize: 11,
    color: '#666666',
    marginTop: 2,
  },
  barReference: {
    fontSize: 10,
    color: '#666666',
  },
  emptyState: {
    fontSize: 14,
    color: '#666666',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 40,
  },
});

const PhysicalExaminationsDocumentPDFTemplate = ({ document: docProp, data, templateData: tplData }) => {
  const templateData = docProp || data || tplData;

  const unwrappedData = (() => {
    if (!templateData) return [];
    if (Array.isArray(templateData)) {
      return templateData.flatMap(item => {
        if (item?.document) return Array.isArray(item.document) ? item.document : [item.document];
        if (item?.data) return Array.isArray(item.data) ? item.data : [item.data];
        return [item];
      });
    }
    if (templateData?.physical_examinations) {
      const pe = templateData.physical_examinations;
      return Array.isArray(pe) ? pe : [pe];
    }
    return [templateData];
  })();

  const formatDate = (dateVal) => {
    if (!dateVal) return '';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return String(dateVal);
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return String(dateVal);
    }
  };

  // splitBySentence — same as JSX (title protection + parenthesis protection)
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

  // splitByComma — parenthesis-aware (for comma-list fields like Vital Signs)
  const splitByComma = (text) => {
    if (!text || typeof text !== 'string') return [];
    const result = []; let current = ''; let depth = 0;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '(') { depth++; current += ch; }
      else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
      else if (ch === ',' && depth === 0) { const t = current.trim(); if (t) result.push(t); current = ''; }
      else { current += ch; }
    }
    const t = current.trim(); if (t) result.push(t);
    return result;
  };

  // splitSmart — per-finding split (same as JSX): always break on . ; (paren-aware); break on a
  // comma ONLY inside a labeled value (after a colon) and not before a conjunction (and/or/but/nor).
  const splitSmart = (text) => {
    if (!text || typeof text !== 'string') return [];
    const result = []; let current = ''; let depth = 0; let labeled = false;
    const CONJ = /^\s*(?:and|or|but|nor)\b/i;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '(') { depth++; current += ch; continue; }
      if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; continue; }
      if (depth === 0 && ch === ':') { labeled = true; current += ch; continue; }
      const isSentenceEnd = (ch === '.' || ch === ';') && i + 1 < text.length && /\s/.test(text[i + 1]);
      const isSplitComma = ch === ',' && depth === 0 && labeled && !CONJ.test(text.slice(i + 1));
      if (depth === 0 && (isSentenceEnd || isSplitComma)) {
        if (isSentenceEnd && ch === '.' && /\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|etc)$/.test(current)) { current += ch; continue; }
        const t = current.trim(); if (t) result.push(t); current = '';
        if (isSentenceEnd) labeled = false;
        while (i + 1 < text.length && /\s/.test(text[i + 1])) i++;
        continue;
      }
      current += ch;
    }
    const t = current.replace(/[.;,]+$/, '').trim(); if (t) result.push(t);
    return result;
  };

  // Comma-handled fields (same as JSX): vitalSigns = pure comma list; narrative exam fields = splitSmart.
  const PURE_COMMA_FIELDS = ['vitalSigns'];
  const COMMA_FIELDS = ['vitalSigns', 'cardiovascularExamination', 'neurologicalExamination', 'mentalStatusExamination', 'skinExamination', 'nutritionalStatus', 'peripheralPulses'];
  const splitField = (fieldName, text) =>
    PURE_COMMA_FIELDS.includes(fieldName) ? splitByComma(text)
      : COMMA_FIELDS.includes(fieldName) ? splitSmart(text)
        : splitBySentence(text);

  // Vitals already shown in the bar chart — excluded from the text rows to avoid duplication.
  const CHARTED_VITAL_PATTERNS = [
    /BP[:\s]*\d+\/\d+\s*mmHg/i,
    /HR[:\s]*\d+\s*bpm/i,
    /RR[:\s]*\d+/i,
    /(?:SpO2|O2\s*Sat)[:\s]*\d+\s*%/i,
    /Temp(?:erature)?[:\s]*[\d.]+\s*°?F/i,
    /BMI[:\s]*[\d.]+/i,
  ];
  const isChartedVital = (text) => CHARTED_VITAL_PATTERNS.some((re) => re.test(String(text || '')));

  // parseLabel — same as JSX
  const parseLabel = (sentence) => {
    if (!sentence || typeof sentence !== 'string') return { label: '', value: sentence || '', isLabeled: false };
    const match = sentence.match(/^([^:]+?):\s*(.+)$/s);
    if (match && match[1].trim().length < 60) {
      return { label: match[1].trim(), value: match[2].trim(), isLabeled: true };
    }
    return { label: '', value: sentence, isLabeled: false };
  };

  // buildMeasurements — discrete numeric scores/measurements (NYHA, GCS, BMI, pain, ABI)
  // Guards: BMI/NYHA/ABI hidden when 0 or absent; GCS hidden when 0 or outside 3-15;
  // painScale shown when a present number 0..10 (0 = legitimate "no pain").
  const NYHA_ROMAN = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' };

  const buildMeasurements = (record) => {
    const rows = [];
    const isNum = (v) => typeof v === 'number' && !Number.isNaN(v);

    const bmi = record.bodyMassIndex;
    if (isNum(bmi) && bmi > 0) {
      rows.push({ key: 'bodyMassIndex', label: 'BMI', value: `${bmi} kg/m2` });
    }

    const nyha = record.nyhaClassification;
    if (isNum(nyha) && nyha >= 1 && nyha <= 4) {
      rows.push({ key: 'nyhaClassification', label: 'NYHA Class', value: NYHA_ROMAN[nyha] });
    }

    const pain = record.painScale;
    if (isNum(pain) && pain >= 0 && pain <= 10) {
      rows.push({ key: 'painScale', label: 'Pain Scale', value: `${pain}/10` });
    }

    const gcs = record.glasgowComaScale;
    if (isNum(gcs) && gcs >= 3 && gcs <= 15) {
      rows.push({ key: 'glasgowComaScale', label: 'GCS', value: `${gcs}/15` });
    }

    const abi = record.ankleBrachialIndex;
    if (isNum(abi) && abi > 0) {
      rows.push({ key: 'ankleBrachialIndex', label: 'ABI', value: `${abi}` });
    }

    return rows;
  };

  // Parse vital signs for bar chart
  const parseVitalSigns = (text) => {
    if (!text || typeof text !== 'string') return [];
    const results = [];

    const bpMatch = text.match(/BP[:\s]*(\d+)\/(\d+)\s*mmHg/i);
    if (bpMatch) {
      const sys = parseInt(bpMatch[1], 10);
      const dia = parseInt(bpMatch[2], 10);
      results.push({
        label: 'Blood Pressure', value: `${sys}/${dia} mmHg`,
        numericValue: sys, maxValue: 200,
        interpretation: sys < 120 && dia < 80 ? 'Normal' : sys < 130 ? 'Elevated' : sys < 140 ? 'Stage 1 HTN' : 'Stage 2 HTN',
        reference: '< 120/80 mmHg'
      });
    }

    const hrMatch = text.match(/HR[:\s]*(\d+)\s*bpm/i);
    if (hrMatch) {
      const hr = parseInt(hrMatch[1], 10);
      results.push({
        label: 'Heart Rate', value: `${hr} bpm`,
        numericValue: hr, maxValue: 150,
        interpretation: hr < 60 ? 'Bradycardia' : hr <= 100 ? 'Normal' : 'Tachycardia',
        reference: '60-100 bpm'
      });
    }

    const spo2Match = text.match(/(?:SpO2|O2\s*Sat)[:\s]*(\d+)\s*%/i);
    if (spo2Match) {
      const spo2 = parseInt(spo2Match[1], 10);
      results.push({
        label: 'Oxygen Saturation', value: `${spo2}%`,
        numericValue: spo2, maxValue: 100,
        interpretation: spo2 >= 95 ? 'Normal' : spo2 >= 90 ? 'Mild Hypoxemia' : 'Hypoxemia',
        reference: '>= 95%'
      });
    }

    const rrMatch = text.match(/RR[:\s]*(\d+)/i);
    if (rrMatch) {
      const rr = parseInt(rrMatch[1], 10);
      results.push({
        label: 'Respiratory Rate', value: `${rr}/min`,
        numericValue: rr, maxValue: 40,
        interpretation: rr >= 12 && rr <= 20 ? 'Normal' : rr < 12 ? 'Bradypnea' : 'Tachypnea',
        reference: '12-20/min'
      });
    }

    const tempMatch = text.match(/Temp(?:erature)?[:\s]*([\d.]+)\s*(?:deg\s*)?F/i);
    if (tempMatch) {
      const temp = parseFloat(tempMatch[1]);
      results.push({
        label: 'Temperature', value: `${temp} F`,
        numericValue: temp, maxValue: 105,
        interpretation: temp >= 97.8 && temp <= 99.1 ? 'Normal' : temp > 100.4 ? 'Fever' : 'Low',
        reference: '97.8-99.1 F'
      });
    }

    const bmiMatch = text.match(/BMI[:\s]*([\d.]+)/i);
    if (bmiMatch) {
      const bmi = parseFloat(bmiMatch[1]);
      results.push({
        label: 'BMI', value: `${bmi} kg/m2`,
        numericValue: bmi, maxValue: 50,
        interpretation: bmi >= 30 ? 'Obese' : bmi >= 25 ? 'Overweight' : bmi < 18.5 ? 'Underweight' : 'Normal',
        reference: '18.5-24.9 kg/m2'
      });
    }

    return results;
  };

  const getBarFillColor = (interpretation) => {
    if (interpretation === 'Normal') return '#666666';
    if (interpretation.includes('Mild') || interpretation === 'Elevated') return '#999999';
    return '#333333';
  };

  // Render a section with splitBySentence + parseLabel, numbered items, title inside fieldBox
  const renderParsedSection = (sectionTitle, text, fieldKey) => {
    if (!hasValue(text)) return null;
    const sentences = splitField(fieldKey, String(text));
    if (sentences.length === 0) return null;

    const parsed = sentences.map(s => ({ ...parseLabel(s), raw: s }));
    if (!COMMA_FIELDS.includes(fieldKey)) {
      parsed.sort((a, b) => {
        if (a.isLabeled && !b.isLabeled) return -1;
        if (!a.isLabeled && b.isLabeled) return 1;
        return 0;
      });
    }

    return (
      <View style={styles.fieldBox} wrap={parsed.length > 8 ? undefined : false}>
        <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text>
        {parsed.map((item, i) => (
          <View key={i}>
            {item.isLabeled && <Text style={styles.subFieldLabel}>{safeString(item.label)}</Text>}
            <Text style={styles.listItem}>{i + 1}. {safeString(item.value)}</Text>
          </View>
        ))}
      </View>
    );
  };

  // Render additional findings sub-field with parent label
  const renderAdditionalField = (parentLabel, text, startNum) => {
    if (!hasValue(text)) return null;
    const sentences = splitBySentence(String(text));
    if (sentences.length === 0) return null;

    const parsed = sentences.map(s => ({ ...parseLabel(s), raw: s }));
    parsed.sort((a, b) => {
      if (a.isLabeled && !b.isLabeled) return -1;
      if (!a.isLabeled && b.isLabeled) return 1;
      return 0;
    });

    return (
      <View>
        <Text style={styles.subFieldLabel}>{safeString(parentLabel)}</Text>
        {parsed.map((item, i) => (
          <Text key={i} style={styles.listItem}>
            {startNum + i}. {item.isLabeled ? (
              <><Text style={styles.inlineLabel}>{safeString(item.label)}:</Text> {safeString(item.value)}</>
            ) : (
              safeString(item.value)
            )}
          </Text>
        ))}
      </View>
    );
  };

  const renderRecord = (record, idx) => {
    const vitalSignsData = parseVitalSigns(safeString(record.vitalSigns));
    const hasVitalChart = vitalSignsData.length > 0;

    const examSections = [
      { key: 'eentExamination', label: 'HEENT Examination' },
      { key: 'cardiovascularExamination', label: 'Cardiovascular' },
      { key: 'pulmonaryExamination', label: 'Pulmonary' },
      { key: 'abdominalExamination', label: 'Abdominal' },
      { key: 'neurologicalExamination', label: 'Neurological' },
      { key: 'mentalStatusExamination', label: 'Mental Status' },
      { key: 'skinExamination', label: 'Skin' },
      { key: 'musculoskeletalExamination', label: 'Musculoskeletal' },
      { key: 'lymphNodeExamination', label: 'Lymph Nodes' },
    ];

    const additionalFields = [
      { key: 'edemaAssessment', label: 'Edema' },
      { key: 'functionalStatus', label: 'Functional Status' },
      { key: 'nutritionalStatus', label: 'Nutritional Status' },
      { key: 'pressureUlcerRisk', label: 'Pressure Ulcer Risk' },
      { key: 'fallRiskAssessment', label: 'Fall Risk Assessment' },
      { key: 'peripheralPulses', label: 'Peripheral Pulses' },
      { key: 'respiratoryEffort', label: 'Respiratory Effort' },
      { key: 'genitourinaryExamination', label: 'Genitourinary' },
    ];

    const visibleAdditional = additionalFields.filter(f => hasValue(record[f.key]));
    let additionalItemNum = 1;

    const measurements = buildMeasurements(record);

    return (
      <View key={record._id || idx} style={styles.recordContainer}>
        {/* Record Header */}
        <View wrap={false}>
          <Text style={styles.recordTitle}>
            {safeString(`Physical Examination ${idx + 1}`)}
          </Text>
          {record.createdAt && (
            <Text style={styles.recordMeta}>{safeString(formatDate(record.createdAt))}</Text>
          )}
        </View>

        {/* Vital Signs — text items + bar chart */}
        {hasValue(record.vitalSigns) && (
          <View style={styles.fieldBox} wrap={false}>
            <Text style={styles.sectionTitle}>Vital Signs</Text>
            {(() => {
              const sentences = splitByComma(String(record.vitalSigns));
              const parsed = sentences.map(s => ({ ...parseLabel(s), raw: s })).filter(p => !isChartedVital(p.raw));
              parsed.sort((a, b) => {
                if (a.isLabeled && !b.isLabeled) return -1;
                if (!a.isLabeled && b.isLabeled) return 1;
                return 0;
              });
              return parsed.map((item, i) => (
                <Text key={i} style={styles.listItem}>
                  {i + 1}. {item.isLabeled ? (
                    <><Text style={styles.inlineLabel}>{safeString(item.label)}:</Text> {safeString(item.value)}</>
                  ) : (
                    safeString(item.value)
                  )}
                </Text>
              ));
            })()}
          </View>
        )}

        {/* Vital Signs Bar Chart */}
        {hasVitalChart && (
          <View style={styles.chartContainer} wrap={false}>
            <View style={styles.chartLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: '#666666' }]} />
                <Text style={styles.legendText}>Normal</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: '#999999' }]} />
                <Text style={styles.legendText}>Elevated</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: '#333333' }]} />
                <Text style={styles.legendText}>Abnormal</Text>
              </View>
            </View>
            {vitalSignsData.map((vital, vIdx) => (
              <View key={vIdx} style={styles.barRow}>
                <Text style={styles.barLabel}>{safeString(vital.label)}</Text>
                <View style={styles.barContainer}>
                  <View style={styles.barBackground}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          width: `${Math.min(100, (vital.numericValue / vital.maxValue) * 100)}%`,
                          backgroundColor: getBarFillColor(vital.interpretation),
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.barValue}>{safeString(vital.value)}</Text>
                </View>
                <Text style={styles.barInterpretation}>{safeString(vital.interpretation)}</Text>
                <Text style={styles.barReference}>Ref: {safeString(vital.reference)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Examination Sections — same order as JSX */}
        {examSections.map(({ key, label }) =>
          hasValue(record[key]) ? renderParsedSection(label, record[key], key) : null
        )}

        {/* Additional Findings */}
        {visibleAdditional.length > 0 && (
          <View style={styles.fieldBox} wrap={visibleAdditional.length > 4 ? undefined : false}>
            <Text style={styles.sectionTitle}>Additional Findings</Text>
            {visibleAdditional.map((f) => {
              const sentences = splitField(f.key, String(record[f.key]));
              const parsed = sentences.map(s => ({ ...parseLabel(s), raw: s }));
              if (!COMMA_FIELDS.includes(f.key)) {
                parsed.sort((a, b) => {
                  if (a.isLabeled && !b.isLabeled) return -1;
                  if (!a.isLabeled && b.isLabeled) return 1;
                  return 0;
                });
              }
              const items = parsed.map((item, i) => {
                const num = additionalItemNum++;
                return (
                  <View key={`${f.key}-${i}`}>
                    {item.isLabeled && <Text style={styles.subFieldLabel}>{safeString(item.label)}</Text>}
                    <Text style={styles.listItem}>{num}. {safeString(item.value)}</Text>
                  </View>
                );
              });
              return (
                <View key={f.key}>
                  <Text style={styles.subFieldLabel}>{safeString(f.label)}</Text>
                  {items}
                </View>
              );
            })}
          </View>
        )}

        {/* Measurements / Scores — discrete numeric measurements */}
        {measurements.length > 0 && (
          <View style={styles.fieldBox} wrap={false}>
            <Text style={styles.sectionTitle}>Measurements / Scores</Text>
            {measurements.map((m, i) => (
              <Text key={m.key} style={styles.listItem}>
                {i + 1}. <Text style={styles.inlineLabel}>{safeString(m.label)}:</Text> {safeString(m.value)}
              </Text>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Physical Examinations</Text>

        {unwrappedData.length > 0 ? (
          unwrappedData.map((record, idx) => renderRecord(record, idx))
        ) : (
          <Text style={styles.emptyState}>No physical examination records available.</Text>
        )}
      </Page>
    </Document>
  );
};

export default PhysicalExaminationsDocumentPDFTemplate;
