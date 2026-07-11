import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const filterNulls = (arr) => Array.isArray(arr) ? arr.filter(item => item !== null && item !== undefined) : [];

// Parse text into individual items - handles both numbered points and sentences
const parseTextIntoRows = (text) => {
  if (!text) return [];
  
  // Check for pattern: (1) text (2) text OR 1. text 2. text
  const numberedPattern = /(?:^|\s)\(?\d+[.)]\s+/g;
  const hasNumbering = numberedPattern.test(text);
  
  if (hasNumbering) {
    // Split by numbering patterns and filter empty
    const parts = text.split(numberedPattern).map(p => p.trim()).filter(p => p.length > 0);
    return parts;
  }
  
  // Otherwise split by sentences
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.\s+/).map(s => s.trim()).filter(s => s.length > 0);
};

// Split a comma-separated value into items (parenthesis-aware) — for "Label: a, b, c" fields like Plan
const splitByCommaAware = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    // Oxford comma: do NOT split on a comma immediately before "and" (keep "..., and Z" as one trailing item)
    else if (ch === ',' && depth === 0 && !/^\s*and\s/i.test(text.slice(i + 1))) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

// Detect embedded "Label: value" (colon + SPACE required so "14:28"/"Dr." are NOT labels)
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

// Stacked field (mirrors the JSX mini-card): field label on top, value below — NEVER side-by-side.
// If the value is an embedded "Label: value", the embedded label renders as a sub-label line.
const renderStackedField = (label, value, key) => {
  if (value === null || value === undefined || value === '') return null;
  const sval = String(value);
  const p = parseLabel(sval);
  return (
    <View key={key} style={styles.stackedItem}>
      <Text style={styles.stackedLabel}>{label}</Text>
      {p.isLabeled && <Text style={styles.stackedSubLabel}>{p.label}</Text>}
      <Text style={styles.stackedValue}>{p.isLabeled ? p.value : sval}</Text>
    </View>
  );
};

// December 2025 standards: BLACK & WHITE, Helvetica font, 14pt minimum
// Professional medical document - no decorative colors
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 14,
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 24,
    color: '#000000',
    textAlign: 'center',
    borderBottom: '2px solid #000000',
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 10,
    marginTop: 16,
    color: '#000000',
    borderBottom: '1px solid #000000',
    paddingBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Standard row layout for simple fields
  fieldRow: {
    marginBottom: 6,
    flexDirection: 'row',
    paddingLeft: 8,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginRight: 12,
    minWidth: 180,
    color: '#000000',
  },
  fieldValue: {
    flex: 1,
    fontSize: 14,
    color: '#000000',
    lineHeight: 1.5,
  },
  // Stacked layout for label:value items with long text (Assessment, Findings, etc.)
  stackedItem: {
    marginBottom: 10,
    flexDirection: 'column',
    paddingLeft: 8,
  },
  stackedLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 4,
  },
  stackedValue: {
    fontSize: 14,
    color: '#000000',
    lineHeight: 1.5,
    paddingLeft: 20,
  },
  stackedSubLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 3,
    paddingLeft: 10,
  },
  textBlock: {
    marginBottom: 14,
    lineHeight: 1.5,
  },
  textContent: {
    fontSize: 14,
    color: '#000000',
    lineHeight: 1.5,
    paddingLeft: 8,
  },
  recommendationItem: {
    marginBottom: 8,
    flexDirection: 'row',
    paddingLeft: 8,
  },
  recommendationNumber: {
    minWidth: 28,
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
  },
  recommendationText: {
    flex: 1,
    fontSize: 14,
    color: '#000000',
    lineHeight: 1.5,
  },
  divider: {
    borderBottom: '1px solid #cccccc',
    marginVertical: 16,
  },
});

const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

const AdministrativeDataDocumentPDFTemplate = ({ documents }) => {
  // Data unwrapping - handle wrapped structure from backend
  // CRITICAL FIX: AIDocumentRenderer passes array directly for wrapped collections!
  let templateData;
  if (Array.isArray(documents)) {
    // AIDocumentRenderer passed array directly: [{...fields}]
    templateData = documents[0];  // Extract first element
  } else {
    // Standard unwrapping for other formats
    templateData = documents?.documentData || documents?.data || documents;
  }

  // Handle additional wrapper formats:
  // 1. Wrapped: { administrative_data: [{...fields}] }
  // 2. Direct: { mrn: "...", category: "...", ...fields }
  const adminData = templateData?.administrative_data;
  const data = Array.isArray(adminData)
    ? adminData[0]  // Wrapped as array
    : (adminData || templateData);  // Direct object or fallback to templateData

  if (!data) {
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <Text style={styles.title}>Administrative Data</Text>
          <Text>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Administrative Data</Text>

        {/* 1. Patient Identifiers - Who is the patient? */}
        {(data.patientName || data.mrn || data.accountNumber || data.insurance) && (
          <View style={styles.textBlock} wrap={false}>
            <Text style={styles.sectionTitle}>Patient Identifiers</Text>
            {renderStackedField('Patient Name', data.patientName)}
            {renderStackedField('MRN', data.mrn)}
            {renderStackedField('Account Number', data.accountNumber)}
            {renderStackedField('Insurance', data.insurance)}
          </View>
        )}

        {/* 2. Findings - What did we observe? */}
        {data.findings && (
          <View style={styles.textBlock} wrap={false}>
            <Text style={styles.sectionTitle}>Findings</Text>
            {(() => {
              const items = parseTextIntoRows(data.findings);
              if (items.length > 1) {
                return items.map((item, idx) => {
                  // Check if label:value format
                  const colonIndex = item.indexOf(':');
                  if (colonIndex > 0) {
                    const label = item.substring(0, colonIndex).trim();
                    const value = item.substring(colonIndex + 1).trim();
                    const parts = splitByCommaAware(value);
                    const valueRows = parts.length >= 2 ? parts : [value];
                    return (
                      <View key={idx} style={styles.stackedItem}>
                        <Text style={styles.stackedLabel}>{label}:</Text>
                        {valueRows.map((p, pi) => (
                          <Text key={pi} style={styles.stackedValue}>{pi + 1}. {p}</Text>
                        ))}
                      </View>
                    );
                  }
                  return (
                    <View key={idx} style={styles.recommendationItem}>
                      <Text style={styles.recommendationNumber}>{idx + 1}.</Text>
                      <Text style={styles.recommendationText}>{item}</Text>
                    </View>
                  );
                });
              }
              return <Text style={styles.textContent}>{data.findings}</Text>;
            })()}
          </View>
        )}

        {/* 3. Assessment - What's our interpretation? */}
        {data.assessment && (
          <View style={styles.textBlock} wrap={false}>
            <Text style={styles.sectionTitle}>Assessment</Text>
            {(() => {
              const items = parseTextIntoRows(data.assessment);
              if (items.length > 1) {
                return items.map((item, idx) => {
                  // Check if label:value format
                  const colonIndex = item.indexOf(':');
                  if (colonIndex > 0) {
                    const label = item.substring(0, colonIndex).trim();
                    const value = item.substring(colonIndex + 1).trim();
                    const parts = splitByCommaAware(value);
                    const valueRows = parts.length >= 2 ? parts : [value];
                    return (
                      <View key={idx} style={styles.stackedItem}>
                        <Text style={styles.stackedLabel}>{label}:</Text>
                        {valueRows.map((p, pi) => (
                          <Text key={pi} style={styles.stackedValue}>{pi + 1}. {p}</Text>
                        ))}
                      </View>
                    );
                  }
                  return (
                    <View key={idx} style={styles.recommendationItem}>
                      <Text style={styles.recommendationNumber}>{idx + 1}.</Text>
                      <Text style={styles.recommendationText}>{item}</Text>
                    </View>
                  );
                });
              }
              return <Text style={styles.textContent}>{data.assessment}</Text>;
            })()}
          </View>
        )}

        {/* 4. Plan - What are we going to do? */}
        {data.plan && (
          <View style={styles.textBlock} wrap={false}>
            <Text style={styles.sectionTitle}>Plan</Text>
            {(() => {
              const items = parseTextIntoRows(data.plan);
              if (items.length > 1) {
                let n = 0;
                const blocks = [];
                items.forEach((item, idx) => {
                  // Check if label:value format
                  const colonIndex = item.indexOf(':');
                  if (colonIndex > 0) {
                    const label = item.substring(0, colonIndex).trim();
                    const value = item.substring(colonIndex + 1).trim();
                    const parts = splitByCommaAware(value);
                    const valueRows = parts.length >= 2 ? parts : [value];
                    blocks.push(
                      <View key={idx} style={styles.stackedItem}>
                        <Text style={styles.stackedLabel}>{label}:</Text>
                        {valueRows.map((p, pi) => (
                          <Text key={pi} style={styles.stackedValue}>{(n += 1)}. {p}</Text>
                        ))}
                      </View>
                    );
                  } else {
                    // Non-labeled row (e.g. "Referrals to A, B, ..., and Z") → comma-split (Oxford-aware), numbered.
                    const parts = splitByCommaAware(item);
                    const rows = parts.length >= 2 ? parts : [item];
                    rows.forEach((r, ri) => {
                      const num = (n += 1);
                      blocks.push(
                        <View key={`${idx}-${ri}`} style={styles.recommendationItem}>
                          <Text style={styles.recommendationNumber}>{num}.</Text>
                          <Text style={styles.recommendationText}>{r}</Text>
                        </View>
                      );
                    });
                  }
                });
                return blocks;
              }
              return <Text style={styles.textContent}>{data.plan}</Text>;
            })()}
          </View>
        )}

        {/* 5. Recommendations - Specific actions recommended (skip if empty array) */}
        {data.recommendations && (Array.isArray(data.recommendations) ? data.recommendations.length > 0 : true) && (
          <View style={styles.textBlock} wrap={false}>
            <Text style={styles.sectionTitle}>Recommendations</Text>
            {Array.isArray(data.recommendations) ? (
              filterNulls(data.recommendations).map((rec, recIdx) => (
                <View key={recIdx} style={styles.recommendationItem}>
                  <Text style={styles.recommendationNumber}>{recIdx + 1}.</Text>
                  <Text style={styles.recommendationText}>
                    {rec.recommendation || rec}
                    {rec.date ? ` (${formatDate(rec.date)})` : ''}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.textContent}>{data.recommendations}</Text>
            )}
          </View>
        )}

        {/* 6. Clinical Status - Current patient state */}
        {(data.disposition || data.conditionAtDischarge || data.dietaryInstructions || data.status) && (
          <View style={styles.textBlock} wrap={false}>
            <Text style={styles.sectionTitle}>Clinical Status</Text>
            {renderStackedField('Disposition', data.disposition)}
            {renderStackedField('Condition at Discharge', data.conditionAtDischarge)}
            {renderStackedField('Dietary Instructions', data.dietaryInstructions)}
            {renderStackedField('Status', data.status)}
          </View>
        )}

        {/* 7. Hospital Stay - Admission/discharge details */}
        {(data.admissionDate || data.dischargeDate || data.lengthOfStay || data.admittingDiagnosis) && (
          <View style={styles.textBlock} wrap={false}>
            <Text style={styles.sectionTitle}>Hospital Stay</Text>
            {renderStackedField('Admission Date', data.admissionDate && formatDate(data.admissionDate))}
            {renderStackedField('Discharge Date', data.dischargeDate && formatDate(data.dischargeDate))}
            {renderStackedField('Length of Stay', data.lengthOfStay && `${data.lengthOfStay} days`)}
            {renderStackedField('Admitting Diagnosis', data.admittingDiagnosis)}
          </View>
        )}

        {/* 8. Consultation & Referral - Specialist involvement */}
        {(data.consultingPhysician || data.consultingSpecialty || data.referringPhysician ||
          data.referringSpecialty || data.consultDate || data.reasonForConsult) && (
          <View style={styles.textBlock} wrap={false}>
            <Text style={styles.sectionTitle}>Consultation & Referral</Text>
            {renderStackedField('Consulting Physician', data.consultingPhysician)}
            {renderStackedField('Consulting Specialty', data.consultingSpecialty)}
            {renderStackedField('Referring Physician', data.referringPhysician)}
            {renderStackedField('Referring Specialty', data.referringSpecialty)}
            {renderStackedField('Consult Date', data.consultDate && formatDate(data.consultDate))}
            {renderStackedField('Reason for Consult', data.reasonForConsult)}
          </View>
        )}

        {/* 9. Results - Test/procedure results - only render if has actual data */}
        {(() => {
          if (!data.results) return null;

          // Check if results has actual data
          let hasData = false;

          if (typeof data.results === 'object' && data.results !== null) {
            // Check if object has any non-null values
            hasData = Object.entries(data.results).some(([key, value]) => value !== null && value !== undefined);
          } else if (typeof data.results === 'string') {
            // Check if string has content
            hasData = data.results.trim().length > 0;
          } else if (Array.isArray(data.results)) {
            // Check if array has items
            hasData = data.results.length > 0;
          }

          if (!hasData) return null;

          return (
            <View style={styles.textBlock} wrap={false}>
              <Text style={styles.sectionTitle}>Results</Text>
              {typeof data.results === 'object' && data.results !== null ? (
                Object.entries(data.results).map(([key, value]) => {
                  if (value === null || value === undefined) return null;
                  const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                  return renderStackedField(label, String(value), key);
                })
              ) : (
                <Text style={styles.textContent}>{String(data.results)}</Text>
              )}
            </View>
          );
        })()}

        {/* 10. Emergency Contacts & Legal - Critical contacts and directives */}
        {(data.primaryCareProvider || data.emergencyContact || data.codeStatus ||
          data.advancedDirectives || data.powerOfAttorney) && (
          <View style={styles.textBlock} wrap={false}>
            <Text style={styles.sectionTitle}>Emergency Contacts & Legal</Text>
            {renderStackedField('Primary Care Provider', data.primaryCareProvider)}
            {renderStackedField('Emergency Contact', data.emergencyContact)}
            {renderStackedField('Code Status', data.codeStatus)}
            {data.advancedDirectives !== undefined && renderStackedField('Advanced Directives', data.advancedDirectives ? 'Yes' : 'No')}
            {renderStackedField('Power of Attorney', data.powerOfAttorney)}
          </View>
        )}

        {/* 11. Notes - Additional clinical notes */}
        {data.notes && (
          <View style={styles.textBlock} wrap={false}>
            <Text style={styles.sectionTitle}>Notes</Text>
            {(() => {
              const items = parseTextIntoRows(data.notes);
              if (items.length > 1) {
                return items.map((item, idx) => {
                  // Check if label:value format
                  const colonIndex = item.indexOf(':');
                  if (colonIndex > 0) {
                    const label = item.substring(0, colonIndex).trim();
                    const value = item.substring(colonIndex + 1).trim();
                    const parts = splitByCommaAware(value);
                    const valueRows = parts.length >= 2 ? parts : [value];
                    return (
                      <View key={idx} style={styles.stackedItem}>
                        <Text style={styles.stackedLabel}>{label}:</Text>
                        {valueRows.map((p, pi) => (
                          <Text key={pi} style={styles.stackedValue}>{pi + 1}. {p}</Text>
                        ))}
                      </View>
                    );
                  }
                  return (
                    <View key={idx} style={styles.recommendationItem}>
                      <Text style={styles.recommendationNumber}>{idx + 1}.</Text>
                      <Text style={styles.recommendationText}>{item}</Text>
                    </View>
                  );
                });
              }
              return <Text style={styles.textContent}>{data.notes}</Text>;
            })()}
          </View>
        )}

        {/* 12. Signatures & Documentation - Document metadata and signatures */}
        {(data.category || data.type || data.provider || data.date || data.facility ||
          data.facilityName || data.facilityAddress || data.electronicSignature ||
          data.electronicSignatureFull) && (
          <View style={styles.textBlock} wrap={false}>
            <Text style={styles.sectionTitle}>Signatures & Documentation</Text>
            {renderStackedField('Category', data.category)}
            {renderStackedField('Type', data.type)}
            {renderStackedField('Provider', data.provider)}
            {renderStackedField('Date', data.date && formatDate(data.date))}
            {renderStackedField('Facility', data.facility)}
            {renderStackedField('Facility Name', data.facilityName)}
            {renderStackedField('Facility Address', data.facilityAddress)}
            {renderStackedField('Electronic Signature', data.electronicSignature)}
            {renderStackedField('Electronic Signature Full', data.electronicSignatureFull)}
          </View>
        )}
      </Page>
    </Document>
  );
};

export default AdministrativeDataDocumentPDFTemplate;
