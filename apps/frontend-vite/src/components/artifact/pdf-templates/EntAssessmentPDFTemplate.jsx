import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * EntAssessmentPDFTemplate - January 2026 Standards
 * 
 * PDF Requirements:
 * - Helvetica font (not Courier)
 * - A4 page size (not LETTER)
 * - NO wrap={false} on large sections (causes text overlapping)
 * - Numbered lists with "1. " format
 * - Professional medical format
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
    textAlign: 'center',
  },
  recordContainer: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottom: '1px solid #cccccc',
  },
  recordTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 12,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    paddingBottom: 4,
  },
  fieldRow: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingLeft: 8,
  },
  fieldLabel: {
    width: 180,
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
  },
  numberLabel: {
    width: 24,
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
  },
  letterLabel: {
    width: 20,
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
  },
  inlineLabel: {
    width: 130,
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
  },
  freqLabel: {
    width: 70,
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
  },
  longLabel: {
    width: 180,
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
  },
  fieldValue: {
    flex: 1,
    fontSize: 14,
    lineHeight: 1.4,
  },
  listItem: {
    fontSize: 14,
    marginBottom: 4,
    paddingLeft: 20,
  },
  textBlock: {
    fontSize: 14,
    lineHeight: 1.6,
    paddingLeft: 8,
    marginBottom: 8,
  },
  subSectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginTop: 8,
    marginBottom: 4,
    paddingLeft: 8,
  },
});

// Safe string helper
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    if (Object.keys(val).length === 0) return '';
    return JSON.stringify(val);
  }
  return String(val);
};

// Parse numbered list (e.g., "1. Item one. 2. Item two.")
const parseNumberedList = (text) => {
  if (!text || typeof text !== 'string') return [];
  const parts = text.split(/\s*(?=\d+\.\s+)/).filter(s => s.trim().length > 0);
  return parts.map(part => part.replace(/^\d+\.\s*/, '').trim()).filter(s => s.length > 0);
};

// Parse labeled sections (e.g., "Surgical: ... Medical: ...")
const parseLabeledSections = (text) => {
  if (!text || typeof text !== 'string') return [];
  const labelPattern = /(?:^|[\.\n])\s*([A-Za-z]+):\s*/g;
  const matches = [];
  let match;
  while ((match = labelPattern.exec(text)) !== null) {
    matches.push({ label: match[1], index: match.index, endIndex: match.index + match[0].length });
  }
  const sections = [];
  for (let i = 0; i < matches.length; i++) {
    const startIdx = matches[i].endIndex;
    const endIdx = i < matches.length - 1 ? matches[i + 1].index : text.length;
    const content = text.substring(startIdx, endIdx).trim().replace(/\.$/, '');
    const items = content.split(',').map(s => s.trim()).filter(s => s.length > 0);
    sections.push({ label: matches[i].label, items });
  }
  return sections;
};

// Has value helper
const hasValue = (val) => {
  if (val === null || val === undefined || val === '') return false;
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === 'object') return Object.keys(val).length > 0;
  if (typeof val === 'number') return true;
  return true;
};

// Safe array helper
const safeArray = (arr) => {
  if (!arr) return [];
  if (Array.isArray(arr)) return arr.filter(item => item !== null && item !== undefined);
  return [];
};

// Format date helper
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return String(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return String(dateStr);
  }
};

// Extract audiometry frequency data
const extractAudiometryData = (earData) => {
  if (!earData) return [];
  const frequencies = ['250Hz', '500Hz', '1000Hz', '2000Hz', '4000Hz', '8000Hz'];
  return frequencies.map(freq => ({
    frequency: freq,
    value: earData[freq] || ''
  })).filter(item => item.value);
};

const EntAssessmentPDFTemplate = ({ records }) => {
  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <Text style={styles.documentTitle}>ENT Assessment</Text>
          <Text>No records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>ENT Assessment</Text>
        
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <Text style={styles.recordTitle}>Record {idx + 1}</Text>
            
            {/* Patient Information */}
            {(hasValue(record.provider) || hasValue(record.date) || hasValue(record.facility)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Patient Information</Text>
                {hasValue(record.provider) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.inlineLabel}>Provider:</Text>
                    <Text style={styles.fieldValue}>{safeString(record.provider)}</Text>
                  </View>
                )}
                {hasValue(record.date) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.inlineLabel}>Date:</Text>
                    <Text style={styles.fieldValue}>{formatDate(record.date)}</Text>
                  </View>
                )}
                {hasValue(record.facility) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.inlineLabel}>Facility:</Text>
                    <Text style={styles.fieldValue}>{safeString(record.facility)}</Text>
                  </View>
                )}
                {hasValue(record.status) && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.inlineLabel}>Status:</Text>
                    <Text style={styles.fieldValue}>{safeString(record.status)}</Text>
                  </View>
                )}
              </View>
            )}
            
            {/* Audiometry */}
            {record.audiometry && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Audiometry</Text>
                
                {record.audiometry.rightEar && (
                  <>
                    <Text style={styles.subSectionTitle}>Right Ear</Text>
                    {extractAudiometryData(record.audiometry.rightEar).map((item, i) => (
                      <View key={`right-${i}`} style={styles.fieldRow}>
                        <Text style={styles.freqLabel}>{item.frequency}:</Text>
                        <Text style={styles.fieldValue}>{item.value}</Text>
                      </View>
                    ))}
                    {record.audiometry.rightEar.PTA && (
                      <View style={styles.fieldRow}>
                        <Text style={styles.freqLabel}>PTA:</Text>
                        <Text style={styles.fieldValue}>{record.audiometry.rightEar.PTA}</Text>
                      </View>
                    )}
                  </>
                )}
                
                {record.audiometry.leftEar && (
                  <>
                    <Text style={styles.subSectionTitle}>Left Ear</Text>
                    {extractAudiometryData(record.audiometry.leftEar).map((item, i) => (
                      <View key={`left-${i}`} style={styles.fieldRow}>
                        <Text style={styles.freqLabel}>{item.frequency}:</Text>
                        <Text style={styles.fieldValue}>{item.value}</Text>
                      </View>
                    ))}
                    {record.audiometry.leftEar.PTA && (
                      <View style={styles.fieldRow}>
                        <Text style={styles.freqLabel}>PTA:</Text>
                        <Text style={styles.fieldValue}>{record.audiometry.leftEar.PTA}</Text>
                      </View>
                    )}
                  </>
                )}
                
                {record.audiometry.speechDiscrimination && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.longLabel}>Speech Discrimination:</Text>
                    <Text style={styles.fieldValue}>{safeString(record.audiometry.speechDiscrimination)}</Text>
                  </View>
                )}
                
                {record.audiometry.tympanometry && (
                  <>
                    <Text style={styles.subSectionTitle}>Tympanometry</Text>
                    {record.audiometry.tympanometry.type && (
                      <View style={styles.fieldRow}>
                        <Text style={styles.inlineLabel}>Type:</Text>
                        <Text style={styles.fieldValue}>{safeString(record.audiometry.tympanometry.type)}</Text>
                      </View>
                    )}
                    {record.audiometry.tympanometry.findings && (
                      <View style={styles.fieldRow}>
                        <Text style={styles.inlineLabel}>Findings:</Text>
                        <Text style={styles.fieldValue}>{safeString(record.audiometry.tympanometry.findings)}</Text>
                      </View>
                    )}
                  </>
                )}
                
                {record.audiometry.acousticReflexes?.findings && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.longLabel}>Acoustic Reflexes:</Text>
                    <Text style={styles.fieldValue}>{safeString(record.audiometry.acousticReflexes.findings)}</Text>
                  </View>
                )}
                
                {record.audiometry.otoacousticEmissions && (
                  <>
                    <Text style={styles.subSectionTitle}>Otoacoustic Emissions</Text>
                    {record.audiometry.otoacousticEmissions.type && (
                      <View style={styles.fieldRow}>
                        <Text style={styles.inlineLabel}>Type:</Text>
                        <Text style={styles.fieldValue}>{safeString(record.audiometry.otoacousticEmissions.type)}</Text>
                      </View>
                    )}
                    {record.audiometry.otoacousticEmissions.findings && (
                      <View style={styles.fieldRow}>
                        <Text style={styles.inlineLabel}>Findings:</Text>
                        <Text style={styles.fieldValue}>{safeString(record.audiometry.otoacousticEmissions.findings)}</Text>
                      </View>
                    )}
                  </>
                )}
              </View>
            )}
            
            {/* Nasopharyngolaryngoscopy */}
            {record.nasopharyngolaryngoscopy && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Nasopharyngolaryngoscopy</Text>
                {record.nasopharyngolaryngoscopy.nasalCavity && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.inlineLabel}>Nasal Cavity:</Text>
                    <Text style={styles.fieldValue}>{safeString(record.nasopharyngolaryngoscopy.nasalCavity)}</Text>
                  </View>
                )}
                {record.nasopharyngolaryngoscopy.nasopharynx && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.inlineLabel}>Nasopharynx:</Text>
                    <Text style={styles.fieldValue}>{safeString(record.nasopharyngolaryngoscopy.nasopharynx)}</Text>
                  </View>
                )}
                {record.nasopharyngolaryngoscopy.oropharynx && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.inlineLabel}>Oropharynx:</Text>
                    <Text style={styles.fieldValue}>{safeString(record.nasopharyngolaryngoscopy.oropharynx)}</Text>
                  </View>
                )}
                {record.nasopharyngolaryngoscopy.hypopharynx && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.inlineLabel}>Hypopharynx:</Text>
                    <Text style={styles.fieldValue}>{safeString(record.nasopharyngolaryngoscopy.hypopharynx)}</Text>
                  </View>
                )}
                {record.nasopharyngolaryngoscopy.larynx && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.inlineLabel}>Larynx:</Text>
                    <Text style={styles.fieldValue}>{safeString(record.nasopharyngolaryngoscopy.larynx)}</Text>
                  </View>
                )}
                {record.nasopharyngolaryngoscopy.vocalCords && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.inlineLabel}>Vocal Cords:</Text>
                    <Text style={styles.fieldValue}>{safeString(record.nasopharyngolaryngoscopy.vocalCords)}</Text>
                  </View>
                )}
              </View>
            )}
            
            {/* Sinus Assessment */}
            {record.sinusAssessment && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Sinus Assessment</Text>
                {record.sinusAssessment.ctFindings && (
                  <>
                    <Text style={styles.subSectionTitle}>CT Findings</Text>
                    {record.sinusAssessment.ctFindings.split(',').map((item, i) => (
                      <View key={i} style={styles.fieldRow}>
                        <Text style={styles.letterLabel}>{String.fromCharCode(97 + i)}.</Text>
                        <Text style={styles.fieldValue}>{item.trim()}</Text>
                      </View>
                    ))}
                  </>
                )}
                {record.sinusAssessment.endoscopy && (
                  <>
                    <Text style={styles.subSectionTitle}>Endoscopy</Text>
                    {record.sinusAssessment.endoscopy.split(',').map((item, i) => (
                      <View key={i} style={styles.fieldRow}>
                        <Text style={styles.letterLabel}>{String.fromCharCode(97 + i)}.</Text>
                        <Text style={styles.fieldValue}>{item.trim()}</Text>
                      </View>
                    ))}
                  </>
                )}
              </View>
            )}
            
            {/* Vestibular Testing */}
            {record.vestibularTesting && Object.keys(record.vestibularTesting).length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Vestibular Testing</Text>
                <Text style={styles.textBlock}>{safeString(record.vestibularTesting)}</Text>
              </View>
            )}
            
            {/* Findings */}
            {hasValue(record.findings) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Findings</Text>
                <Text style={styles.textBlock}>{safeString(record.findings)}</Text>
              </View>
            )}
            
            {/* Assessment - Numbered List */}
            {hasValue(record.assessment) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Assessment</Text>
                {parseNumberedList(record.assessment).map((item, i) => (
                  <View key={i} style={styles.fieldRow}>
                    <Text style={styles.numberLabel}>{i + 1}.</Text>
                    <Text style={styles.fieldValue}>{item}</Text>
                  </View>
                ))}
              </View>
            )}
            
            {/* Plan - Labeled sections */}
            {hasValue(record.plan) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Plan</Text>
                {parseLabeledSections(record.plan).map((section, secIdx) => (
                  <View key={secIdx}>
                    <Text style={styles.subSectionTitle}>{section.label}</Text>
                    {section.items.map((item, itemIdx) => (
                      <View key={itemIdx} style={styles.fieldRow}>
                        <Text style={styles.letterLabel}>{String.fromCharCode(97 + itemIdx)}.</Text>
                        <Text style={styles.fieldValue}>{item}</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            )}
            
            {/* Recommendations */}
            {record.recommendations && record.recommendations.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Recommendations</Text>
                {safeArray(record.recommendations).map((rec, i) => {
                  let text = '';
                  if (typeof rec === 'string') {
                    text = rec;
                  } else if (rec.recommendation) {
                    text = rec.recommendation;
                    if (rec.date) text += ` (${rec.date})`;
                  }
                  if (!text) return null;
                  return (
                    <Text key={i} style={styles.listItem}>{i + 1}. {text}</Text>
                  );
                })}
              </View>
            )}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default EntAssessmentPDFTemplate;
