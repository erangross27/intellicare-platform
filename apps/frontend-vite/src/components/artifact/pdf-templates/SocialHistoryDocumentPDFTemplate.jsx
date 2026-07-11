import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * SocialHistoryDocumentPDFTemplate - December 2025
 * BLACK AND WHITE ONLY - No colors in PDF templates
 * Helvetica font, 14pt minimum body text, wrap={false} per section
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
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
  },
  recordTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
    color: '#000000',
  },
  recordMeta: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 12,
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 8,
    color: '#000000',
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
    marginBottom: 4,
    paddingLeft: 12,
  },
  noData: {
    fontSize: 14,
    color: '#666666',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 40,
  },
  subLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 2,
    marginTop: 4,
  },
  nested: {
    marginLeft: 10,
    paddingLeft: 8,
  },
});

// Safe string helper for Unicode
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
  return str;
};

// Format date helper
const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try {
    const date = new Date(dateValue.$date || dateValue);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return String(dateValue);
  }
};

// Split by semicolon
const splitBySemicolon = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/;\s*/).map(s => s.trim()).filter(s => s.length > 0);
};

// Split text by sentences
const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
};

// Parse family support with labels
const parseFamilySupport = (text) => {
  if (!text || typeof text !== 'string') return [];

  const labelPatterns = [
    'Mother', 'Father', 'Sister', 'Brother', 'Children',
    'Ex-wife', 'Ex-husband', 'Spouse', 'Partner', 'Wife', 'Husband',
    'Son', 'Daughter', 'Grandchildren', 'Grandparents'
  ];

  const labelPositions = [];
  labelPatterns.forEach((label) => {
    const regex = new RegExp(`${label}\\s*:`, 'gi');
    let match;
    while ((match = regex.exec(text)) !== null) {
      labelPositions.push({
        label,
        startIndex: match.index,
        colonEndIndex: match.index + match[0].length,
      });
    }
  });

  labelPositions.sort((a, b) => a.startIndex - b.startIndex);
  const groups = [];

  labelPositions.forEach((pos, idx) => {
    const contentStart = pos.colonEndIndex;
    const contentEnd = idx + 1 < labelPositions.length
      ? labelPositions[idx + 1].startIndex
      : text.length;

    let content = text.substring(contentStart, contentEnd).trim();
    if (content.endsWith('.')) content = content.slice(0, -1).trim();

    if (content) {
      groups.push({ label: pos.label, content });
    }
  });

  if (groups.length === 0 && text.trim()) {
    groups.push({ label: null, content: text.trim() });
  }

  return groups;
};

// Check if value exists
const hasValue = (val) => val !== null && val !== undefined && val !== '';

// Check if array has items
const hasItems = (arr) => Array.isArray(arr) && arr.length > 0;

// --- OBJECT (results) helpers ---
const KEY_OVERRIDES = { id: 'ID', bmi: 'BMI', icd: 'ICD' };
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];
  const s = String(key).replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  return safeString(v ?? '');
};

// Count rows for the wrap heuristic
const countRows = (val) => {
  if (isEmptyDeep(val)) return 0;
  if (isScalar(val)) return 1;
  if (Array.isArray(val)) { let n = 0; val.filter(x => !isEmptyDeep(x)).forEach(it => { n += isScalar(it) ? 1 : 1 + countRows(it); }); return n; }
  let n = 0; Object.values(val).forEach(sub => { if (!isEmptyDeep(sub)) n += isScalar(sub) ? 2 : 1 + countRows(sub); }); return n;
};

// Recursive object node: label = bold heading; value = plain line below
const renderObjectNode = (label, value, keyPath, depth) => {
  if (isEmptyDeep(value)) return null;
  const LabelTag = depth > 0 ? styles.subLabel : styles.fieldLabel;
  if (isScalar(value)) {
    return (
      <View key={keyPath}>
        {label ? <Text style={LabelTag}>{label}</Text> : null}
        <Text style={styles.fieldValue}>{fmtScalar(value)}</Text>
      </View>
    );
  }
  const entries = Array.isArray(value)
    ? value.map((v, i) => [String(i + 1), v]).filter(([, v]) => !isEmptyDeep(v))
    : Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  return (
    <View key={keyPath}>
      {label ? <Text style={LabelTag}>{label}</Text> : null}
      <View style={label ? styles.nested : undefined}>{entries.map(([k, v]) => renderObjectNode(humanizeKey(k), v, `${keyPath}-${k}`, depth + 1))}</View>
    </View>
  );
};

const SocialHistoryDocumentPDFTemplate = ({ document: data }) => {
  // Data unwrapping
  let rawRecords = [];
  if (Array.isArray(data)) {
    if (data.length > 0 && data[0]?.social_history) {
      rawRecords = data.flatMap(item =>
        Array.isArray(item.social_history) ? item.social_history : [item.social_history]
      );
    } else {
      rawRecords = data;
    }
  } else if (data?.social_history) {
    rawRecords = Array.isArray(data.social_history)
      ? data.social_history
      : [data.social_history];
  } else if (data) {
    rawRecords = [data];
  }

  // Clean records - remove injected underscore-prefixed fields
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

  if (!Array.isArray(records) || records.length === 0) {
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <Text style={styles.noData}>No social history records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Social History</Text>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            {/* Record Header */}
            <Text style={styles.recordTitle}>
              {safeString(`Social History Record ${idx + 1}`)}
            </Text>
            {record.date && (
              <Text style={styles.recordMeta}>{formatDate(record.date)}</Text>
            )}

            {/* Provider Information Section */}
            {(hasValue(record.provider) || hasValue(record.facility)) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Provider Information</Text>
                {hasValue(record.provider) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Provider</Text>
                    <Text style={styles.fieldValue}>{safeString(record.provider)}</Text>
                  </View>
                )}
                {hasValue(record.facility) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Facility</Text>
                    <Text style={styles.fieldValue}>{safeString(record.facility)}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Tobacco Use Section */}
            {(hasValue(record.smokingStatus) || hasValue(record.smokingHistory) ||
              hasValue(record.packYearsHistory) || hasValue(record.tobaccoType) ||
              hasValue(record.tobaccoQuitDate)) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Tobacco Use</Text>
                {hasValue(record.smokingStatus) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Smoking Status</Text>
                    <Text style={styles.fieldValue}>{safeString(record.smokingStatus)}</Text>
                  </View>
                )}
                {hasValue(record.smokingHistory) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Smoking History</Text>
                    <Text style={styles.fieldValue}>{safeString(record.smokingHistory)}</Text>
                  </View>
                )}
                {hasValue(record.packYearsHistory) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Pack Years</Text>
                    <Text style={styles.fieldValue}>{safeString(record.packYearsHistory)}</Text>
                  </View>
                )}
                {hasValue(record.tobaccoType) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Tobacco Type</Text>
                    <Text style={styles.fieldValue}>{safeString(record.tobaccoType)}</Text>
                  </View>
                )}
                {hasValue(record.tobaccoQuitDate) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Quit Date</Text>
                    <Text style={styles.fieldValue}>{formatDate(record.tobaccoQuitDate)}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Alcohol Use Section */}
            {(hasValue(record.alcoholUse) || hasValue(record.alcoholFrequency) ||
              hasValue(record.alcoholQuantity)) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Alcohol Use</Text>
                {hasValue(record.alcoholUse) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Alcohol Use</Text>
                    <Text style={styles.fieldValue}>{safeString(record.alcoholUse)}</Text>
                  </View>
                )}
                {hasValue(record.alcoholFrequency) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Frequency</Text>
                    <Text style={styles.fieldValue}>{safeString(record.alcoholFrequency)}</Text>
                  </View>
                )}
                {hasValue(record.alcoholQuantity) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Quantity</Text>
                    <Text style={styles.fieldValue}>{safeString(record.alcoholQuantity)}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Substance Use Section */}
            {(hasValue(record.substanceUse) || hasValue(record.illicitDrugUse) ||
              hasItems(record.drugTypes)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Substance Use</Text>
                {hasValue(record.illicitDrugUse) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Illicit Drug Use</Text>
                    <Text style={styles.fieldValue}>{safeString(record.illicitDrugUse)}</Text>
                  </View>
                )}
                {hasValue(record.substanceUse) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Substances</Text>
                    {splitBySemicolon(record.substanceUse).map((substance, sIdx) => (
                      <Text key={sIdx} style={styles.listItem}>
                        {sIdx + 1}. {safeString(substance)}
                      </Text>
                    ))}
                  </View>
                )}
                {hasItems(record.drugTypes) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Drug Types</Text>
                    {record.drugTypes.map((drug, dIdx) => (
                      <Text key={dIdx} style={styles.listItem}>
                        {dIdx + 1}. {safeString(drug)}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Living Situation Section */}
            {(hasValue(record.livingSituation) || record.livesAlone !== undefined ||
              hasValue(record.householdMembers) || hasValue(record.housingStability) ||
              hasValue(record.homeEnvironment)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Living Situation</Text>
                {hasValue(record.housingStability) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Housing Stability</Text>
                    <Text style={styles.fieldValue}>{safeString(record.housingStability)}</Text>
                  </View>
                )}
                {record.livesAlone !== undefined && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Lives Alone</Text>
                    <Text style={styles.fieldValue}>{record.livesAlone ? 'Yes' : 'No'}</Text>
                  </View>
                )}
                {hasValue(record.householdMembers) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Household Members</Text>
                    <Text style={styles.fieldValue}>{safeString(record.householdMembers)}</Text>
                  </View>
                )}
                {hasValue(record.homeEnvironment) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Home Environment</Text>
                    <Text style={styles.fieldValue}>{safeString(record.homeEnvironment)}</Text>
                  </View>
                )}
                {hasValue(record.livingSituation) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Details</Text>
                    {(record._livingSituationSentences || splitBySentence(record.livingSituation)).map((sentence, sIdx) => (
                      <Text key={sIdx} style={styles.listItem}>
                        {sIdx + 1}. {safeString(sentence)}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Employment & Occupation Section */}
            {(hasValue(record.employmentStatus) || hasValue(record.occupation) ||
              hasItems(record.occupationalExposures)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Employment & Occupation</Text>
                {hasValue(record.employmentStatus) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Employment Status</Text>
                    <Text style={styles.fieldValue}>{safeString(record.employmentStatus)}</Text>
                  </View>
                )}
                {hasValue(record.occupation) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Occupation</Text>
                    {(record._occupationSentences || splitBySentence(record.occupation)).map((sentence, sIdx) => (
                      <Text key={sIdx} style={styles.listItem}>
                        {sIdx + 1}. {safeString(sentence)}
                      </Text>
                    ))}
                  </View>
                )}
                {hasItems(record.occupationalExposures) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Occupational Exposures</Text>
                    {record.occupationalExposures.map((exposure, eIdx) => (
                      <Text key={eIdx} style={styles.listItem}>
                        {eIdx + 1}. {safeString(exposure)}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Education Section */}
            {(hasValue(record.educationLevel) || hasValue(record.healthLiteracy)) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Education</Text>
                {hasValue(record.educationLevel) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Education Level</Text>
                    <Text style={styles.fieldValue}>{safeString(record.educationLevel)}</Text>
                  </View>
                )}
                {hasValue(record.healthLiteracy) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Health Literacy</Text>
                    <Text style={styles.fieldValue}>{safeString(record.healthLiteracy)}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Family & Support Section */}
            {(hasValue(record.maritalStatus) || hasValue(record.familySupport) ||
              hasValue(record.supportSystem) || hasValue(record.caregiverStatus)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Family & Support</Text>
                {hasValue(record.maritalStatus) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Marital Status</Text>
                    <Text style={styles.fieldValue}>{safeString(record.maritalStatus)}</Text>
                  </View>
                )}
                {hasValue(record.caregiverStatus) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Caregiver Status</Text>
                    <Text style={styles.fieldValue}>{safeString(record.caregiverStatus)}</Text>
                  </View>
                )}
                {hasValue(record.familySupport) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Family Support</Text>
                    {parseFamilySupport(record.familySupport).map((parsed, pIdx) => (
                      <Text key={pIdx} style={styles.listItem}>
                        {parsed.label ? `${parsed.label}: ${safeString(parsed.content)}` : safeString(parsed.content)}
                      </Text>
                    ))}
                  </View>
                )}
                {hasValue(record.supportSystem) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Support System</Text>
                    {(record._supportSystemSentences || splitBySentence(record.supportSystem)).map((sentence, sIdx) => (
                      <Text key={sIdx} style={styles.listItem}>
                        {sIdx + 1}. {safeString(sentence)}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Lifestyle Section */}
            {(hasValue(record.exercise) || hasValue(record.diet) ||
              hasValue(record.physicalActivityLevel) || hasValue(record.sleepPatterns) ||
              hasValue(record.stressLevel)) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Lifestyle</Text>
                {hasValue(record.physicalActivityLevel) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Physical Activity Level</Text>
                    <Text style={styles.fieldValue}>{safeString(record.physicalActivityLevel)}</Text>
                  </View>
                )}
                {hasValue(record.exercise) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Exercise</Text>
                    <Text style={styles.fieldValue}>{safeString(record.exercise)}</Text>
                  </View>
                )}
                {hasValue(record.diet) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Diet</Text>
                    <Text style={styles.fieldValue}>{safeString(record.diet)}</Text>
                  </View>
                )}
                {hasValue(record.sleepPatterns) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Sleep Patterns</Text>
                    <Text style={styles.fieldValue}>{safeString(record.sleepPatterns)}</Text>
                  </View>
                )}
                {hasValue(record.stressLevel) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Stress Level</Text>
                    <Text style={styles.fieldValue}>{safeString(record.stressLevel)}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Personal & Cultural Section */}
            {(hasValue(record.religiousBeliefs) || hasValue(record.culturalFactors) ||
              hasValue(record.sexualActivity) || hasValue(record.sexualOrientation) ||
              hasValue(record.contraceptionMethod)) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Personal & Cultural</Text>
                {hasValue(record.religiousBeliefs) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Religious Beliefs</Text>
                    <Text style={styles.fieldValue}>{safeString(record.religiousBeliefs)}</Text>
                  </View>
                )}
                {hasValue(record.culturalFactors) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Cultural Factors</Text>
                    <Text style={styles.fieldValue}>{safeString(record.culturalFactors)}</Text>
                  </View>
                )}
                {hasValue(record.sexualOrientation) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Sexual Orientation</Text>
                    <Text style={styles.fieldValue}>{safeString(record.sexualOrientation)}</Text>
                  </View>
                )}
                {hasValue(record.sexualActivity) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Sexual Activity</Text>
                    <Text style={styles.fieldValue}>{safeString(record.sexualActivity)}</Text>
                  </View>
                )}
                {hasValue(record.contraceptionMethod) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Contraception Method</Text>
                    <Text style={styles.fieldValue}>{safeString(record.contraceptionMethod)}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Additional Information Section */}
            {(hasValue(record.insurance) || hasValue(record.financialConcerns) ||
              hasValue(record.transportation) || hasValue(record.foodSecurity) ||
              hasValue(record.domesticViolence) || hasValue(record.recentTravel) ||
              hasValue(record.militaryService) || hasValue(record.notes)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Additional Information</Text>
                {hasValue(record.insurance) && (
                  <View style={styles.fieldRow} wrap={false}>
                    <Text style={styles.fieldLabel}>Insurance</Text>
                    <Text style={styles.fieldValue}>{safeString(record.insurance)}</Text>
                  </View>
                )}
                {hasValue(record.financialConcerns) && (
                  <View style={styles.fieldRow} wrap={false}>
                    <Text style={styles.fieldLabel}>Financial Concerns</Text>
                    <Text style={styles.fieldValue}>{safeString(record.financialConcerns)}</Text>
                  </View>
                )}
                {hasValue(record.transportation) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Transportation</Text>
                    <Text style={styles.fieldValue}>{safeString(record.transportation)}</Text>
                  </View>
                )}
                {hasValue(record.foodSecurity) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Food Security</Text>
                    <Text style={styles.fieldValue}>{safeString(record.foodSecurity)}</Text>
                  </View>
                )}
                {hasValue(record.domesticViolence) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Domestic Violence</Text>
                    <Text style={styles.fieldValue}>{safeString(record.domesticViolence)}</Text>
                  </View>
                )}
                {hasValue(record.recentTravel) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Recent Travel</Text>
                    <Text style={styles.fieldValue}>{safeString(record.recentTravel)}</Text>
                  </View>
                )}
                {hasValue(record.militaryService) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Military Service</Text>
                    <Text style={styles.fieldValue}>{safeString(record.militaryService)}</Text>
                  </View>
                )}
                {hasValue(record.notes) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Notes</Text>
                    {(record._notesSentences || splitBySentence(record.notes)).map((sentence, sIdx) => (
                      <Text key={sIdx} style={styles.listItem}>
                        {sIdx + 1}. {safeString(sentence)}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Clinical Summary Section (findings, assessment, plan, status) */}
            {(hasValue(record.findings) || hasValue(record.assessment) ||
              hasValue(record.plan) || hasValue(record.status)) && (() => {
              const findingsSentences = record._findingsSentences || splitBySentence(record.findings);
              const assessmentSentences = record._assessmentSentences || splitBySentence(record.assessment);
              const planSentences = record._planSentences || splitBySentence(record.plan);
              const totalRows = findingsSentences.length + assessmentSentences.length +
                planSentences.length + (hasValue(record.status) ? 1 : 0);
              return (
                <View style={styles.section} wrap={totalRows > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Clinical Summary</Text>
                  {hasValue(record.findings) && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Findings</Text>
                      {findingsSentences.map((sentence, sIdx) => (
                        <Text key={sIdx} style={styles.listItem}>
                          {sIdx + 1}. {safeString(sentence)}
                        </Text>
                      ))}
                    </View>
                  )}
                  {hasValue(record.assessment) && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Assessment</Text>
                      {assessmentSentences.map((sentence, sIdx) => (
                        <Text key={sIdx} style={styles.listItem}>
                          {sIdx + 1}. {safeString(sentence)}
                        </Text>
                      ))}
                    </View>
                  )}
                  {hasValue(record.plan) && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Plan</Text>
                      {planSentences.map((sentence, sIdx) => (
                        <Text key={sIdx} style={styles.listItem}>
                          {sIdx + 1}. {safeString(sentence)}
                        </Text>
                      ))}
                    </View>
                  )}
                  {hasValue(record.status) && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Status</Text>
                      <Text style={styles.fieldValue}>{safeString(record.status)}</Text>
                    </View>
                  )}
                </View>
              );
            })()}

            {/* Recommendations Section */}
            {hasItems(record.recommendations) && (() => {
              const recs = record.recommendations;
              return (
                <View style={styles.section} wrap={recs.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Recommendations</Text>
                  <View style={styles.fieldRow}>
                    {recs.map((r, rIdx) => {
                      const text = (typeof r === 'object' && r !== null ? r.recommendation : r) || '';
                      const d = (typeof r === 'object' && r !== null ? r.date : '') || '';
                      return (
                        <Text key={rIdx} style={styles.listItem}>
                          {rIdx + 1}. {safeString(text)}{d ? ` (${safeString(d)})` : ''}
                        </Text>
                      );
                    })}
                  </View>
                </View>
              );
            })()}

            {/* Results Section (OBJECT) */}
            {record.results && !isScalar(record.results) && !isEmptyDeep(record.results) && (() => {
              const entries = Object.entries(record.results).filter(([, v]) => !isEmptyDeep(v));
              if (entries.length === 0) return null;
              const rows = countRows(record.results);
              return (
                <View style={styles.section} wrap={rows > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Results</Text>
                  <View style={styles.fieldRow}>
                    {entries.map(([k, v]) => renderObjectNode(humanizeKey(k), v, `results-${k}`, 1))}
                  </View>
                </View>
              );
            })()}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default SocialHistoryDocumentPDFTemplate;
