import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 12,
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  documentHeader: {
    marginBottom: 16,
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    paddingBottom: 10,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  recordContainer: {
    marginBottom: 20,
  },
  recordHeader: {
    marginBottom: 8,
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderWidth: 1,
    borderColor: '#000000',
  },
  recordTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textTransform: 'uppercase',
  },
  recordMeta: {
    fontSize: 10,
    color: '#333333',
    marginTop: 4,
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textTransform: 'uppercase',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    paddingBottom: 2,
    marginBottom: 6,
  },
  fieldRow: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingLeft: 8,
  },
  fieldLabel: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    width: 180,
  },
  fieldContent: {
    fontSize: 12,
    color: '#000000',
    flex: 1,
  },
  contentText: {
    fontSize: 12,
    color: '#000000',
    lineHeight: 1.4,
    paddingLeft: 8,
  },
  listItem: {
    fontSize: 12,
    color: '#000000',
    paddingLeft: 12,
    marginBottom: 3,
  },
  nestedHeader: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginTop: 6,
    marginBottom: 4,
    paddingLeft: 4,
    textTransform: 'uppercase',
  },
});

const SECTION_TITLES = {
  'cardiovascular-metabolic': 'Cardiovascular & Metabolic Risk',
  'organ-systems': 'Organ Systems Risk',
  'screening-susceptibility': 'Screening & Susceptibility',
  'lifestyle-genetics': 'Lifestyle & Genetic Factors',
};

const FIELD_LABELS = {
  cardiovascularRiskScore: 'Cardiovascular Risk Score',
  bleedingRiskScore: 'Bleeding Risk Score',
  osteoporosisFractureRisk: 'Osteoporosis Fracture Risk',
  hypertensionTargetOrganDamage: 'Hypertension Target Organ Damage',
  diabeticRetinopathyRisk: 'Diabetic Retinopathy Risk',
  diabeticNephropathyRisk: 'Diabetic Nephropathy Risk',
  fallRiskAssessment: 'Fall Risk Assessment',
  thromboembolismRisk: 'Thromboembolism Risk',
  perioperativeRiskIndex: 'Perioperative Risk Index',
  renalDiseaseProgression: 'Renal Disease Progression',
  obesityComplicationRisk: 'Obesity Complication Risk',
  cancerScreeningRisk: 'Cancer Screening Risk',
  strokeRiskFactors: 'Stroke Risk Factors',
  infectiousDiseaseSusceptibility: 'Infectious Disease Susceptibility',
  polypharmacyRisk: 'Polypharmacy Risk',
  cognitiveDeclineRisk: 'Cognitive Decline Risk',
  pregnancyComplicationRisk: 'Pregnancy Complication Risk',
  lifestyleModificationTargets: 'Lifestyle Modification Targets',
  geneticPredispositionFactors: 'Genetic Predisposition Factors',
  anticoagulationRiskBenefit: 'Anticoagulation Risk-Benefit',
};

const SECTION_FIELDS = {
  'cardiovascular-metabolic': ['cardiovascularRiskScore', 'bleedingRiskScore', 'osteoporosisFractureRisk', 'hypertensionTargetOrganDamage', 'diabeticRetinopathyRisk', 'diabeticNephropathyRisk'],
  'organ-systems': ['fallRiskAssessment', 'thromboembolismRisk', 'perioperativeRiskIndex', 'renalDiseaseProgression', 'obesityComplicationRisk'],
  'screening-susceptibility': ['cancerScreeningRisk', 'strokeRiskFactors', 'infectiousDiseaseSusceptibility', 'polypharmacyRisk', 'cognitiveDeclineRisk', 'pregnancyComplicationRisk'],
  'lifestyle-genetics': ['lifestyleModificationTargets', 'geneticPredispositionFactors', 'anticoagulationRiskBenefit'],
};

const NUMBER_FIELDS = ['cardiovascularRiskScore', 'bleedingRiskScore', 'osteoporosisFractureRisk'];
const ARRAY_FIELDS = ['cancerScreeningRisk', 'strokeRiskFactors', 'infectiousDiseaseSusceptibility', 'lifestyleModificationTargets', 'geneticPredispositionFactors'];

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try {
    const dateStr = dateValue.$date || dateValue;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return String(dateValue);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return String(dateValue);
  }
};

const hasVal = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number') return true;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  return true;
};

const fmtVal = (v) => {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  return String(v || '');
};

// Split into sentences helper
const splitIntoSentences = (text) => {
  if (!text || typeof text !== 'string') return [];
  const abbrevs = ['Dr', 'Mr', 'Mrs', 'Ms', 'Prof', 'St', 'Jr', 'Sr', 'vs', 'etc', 'e.g', 'i.e'];
  let processed = text;
  abbrevs.forEach(abbr => {
    const regex = new RegExp(`\\b${abbr}\\.\\s`, 'g');
    processed = processed.replace(regex, `${abbr}<<DOT>> `);
  });
  const sentences = processed.split(/\.\s+/).filter(s => s.trim());
  return sentences.map(s => s.replace(/<<DOT>>/g, '.').trim()).filter(s => s);
};

// Parse findings with labels
const parseFindingsWithLabels = (text) => {
  if (!text || typeof text !== 'string') return [];
  const groups = [];
  const sentences = text.split(/\.\s+/).filter(s => s.trim());
  let currentGroup = null;

  sentences.forEach(sentence => {
    const colonIdx = sentence.indexOf(':');
    if (colonIdx > 0 && colonIdx < 80) {
      if (currentGroup) groups.push(currentGroup);
      const label = sentence.substring(0, colonIdx).trim();
      const content = sentence.substring(colonIdx + 1).trim();
      const items = [];
      let current = '';
      let parenDepth = 0;
      for (let i = 0; i < content.length; i++) {
        const char = content[i];
        if (char === '(') parenDepth++;
        else if (char === ')') parenDepth--;
        else if (char === ',' && parenDepth === 0) {
          if (current.trim()) items.push(current.trim());
          current = '';
          continue;
        }
        current += char;
      }
      if (current.trim()) items.push(current.trim());
      currentGroup = { label, items: items.length > 0 ? items : [content] };
    } else {
      if (currentGroup) {
        currentGroup.items.push(sentence.trim());
      } else {
        currentGroup = { label: null, items: [sentence.trim()] };
      }
    }
  });
  if (currentGroup) groups.push(currentGroup);
  return groups;
};

const RiskCounselingDocumentPDFTemplate = ({ document: data }) => {
  // Data unwrapping
  let rawRecords = [];
  if (Array.isArray(data)) {
    if (data.length > 0 && data[0].records) {
      rawRecords = data[0].records;
    } else {
      rawRecords = data;
    }
  } else if (data?.records) {
    rawRecords = data.records;
  } else if (data) {
    rawRecords = [data];
  }

  // Clean records - remove injected underscore-prefixed fields from JSX filtering
  const records = rawRecords.map(record => {
    if (!record || typeof record !== 'object') return record;
    const cleanRecord = {};
    for (const key of Object.keys(record)) {
      if (!key.startsWith('_')) {
        cleanRecord[key] = record[key];
      }
    }
    return cleanRecord;
  });

  // Safety check for empty records
  if (!Array.isArray(records) || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.title}>Risk Counseling</Text>
          </View>
          <Text style={styles.contentText}>No data available</Text>
        </Page>
      </Document>
    );
  }

  const renderField = (record, fn) => {
    const val = record[fn];
    if (!hasVal(val)) return null;
    const label = FIELD_LABELS[fn] || fn;

    if (NUMBER_FIELDS.includes(fn)) {
      return (
        <View key={fn} style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>{label}:</Text>
          <Text style={styles.fieldContent}>{String(val)}</Text>
        </View>
      );
    }

    if (ARRAY_FIELDS.includes(fn)) {
      const items = Array.isArray(val) ? val.filter(Boolean) : [val];
      if (items.length === 0) return null;
      return (
        <View key={fn} wrap={false}>
          <Text style={styles.nestedHeader}>{label}</Text>
          {items.map((item, itemIdx) => (
            <Text key={itemIdx} style={styles.listItem}>
              {itemIdx + 1}. {String(item)}
            </Text>
          ))}
        </View>
      );
    }

    // String field - check for label:value patterns
    const strVal = fmtVal(val);
    const parsedGroups = parseFindingsWithLabels(strVal);
    if (parsedGroups.length > 1 || (parsedGroups.length === 1 && parsedGroups[0].label)) {
      return (
        <View key={fn} wrap={false}>
          <Text style={styles.nestedHeader}>{label}</Text>
          {parsedGroups.map((group, gIdx) => (
            <View key={gIdx}>
              {group.label && <Text style={{ ...styles.nestedHeader, fontSize: 11, marginTop: 2 }}>{group.label}</Text>}
              {group.items.map((item, iIdx) => (
                <Text key={iIdx} style={styles.listItem}>{iIdx + 1}. {item}</Text>
              ))}
            </View>
          ))}
        </View>
      );
    }

    // Simple string
    const sentences = splitIntoSentences(strVal);
    if (sentences.length > 1) {
      return (
        <View key={fn} wrap={false}>
          <Text style={styles.nestedHeader}>{label}</Text>
          {sentences.map((s, sIdx) => (
            <Text key={sIdx} style={styles.listItem}>{sIdx + 1}. {s}</Text>
          ))}
        </View>
      );
    }

    return (
      <View key={fn} style={styles.fieldRow}>
        <Text style={styles.fieldLabel}>{label}:</Text>
        <Text style={styles.fieldContent}>{strVal}</Text>
      </View>
    );
  };

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.title}>Risk Counseling</Text>
        </View>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} minPresenceAhead={150}>
            <View style={styles.recordHeader}>
              <Text style={styles.recordTitle}>Risk Counseling {idx + 1}</Text>
              {record.createdAt && (
                <Text style={styles.recordMeta}>{formatDate(record.createdAt)}</Text>
              )}
            </View>

            {Object.keys(SECTION_FIELDS).map(sid => {
              const fields = SECTION_FIELDS[sid];
              const hasAny = fields.some(f => hasVal(record[f]));
              if (!hasAny) return null;

              return (
                <View key={sid} style={styles.section} minPresenceAhead={80} wrap={false}>
                  <Text style={styles.sectionTitle}>{SECTION_TITLES[sid]}</Text>
                  {fields.map(f => renderField(record, f))}
                </View>
              );
            })}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default RiskCounselingDocumentPDFTemplate;
