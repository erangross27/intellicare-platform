import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 12,
    lineHeight: 1.5,
    backgroundColor: '#ffffff',
  },
  documentHeader: {
    marginBottom: 24,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#606060',
    borderBottomStyle: 'solid',
  },
  documentTitle: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 4,
  },
  recordContainer: {
    marginBottom: 24,
  },
  recordHeader: {
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#606060',
    borderBottomStyle: 'solid',
  },
  recordDateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  recordDate: {
    fontSize: 11,
    color: '#6b7280',
    fontFamily: 'Helvetica',
  },
  recordTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#1f2937',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#606060',
    marginBottom: 8,
  },
  sectionContent: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'solid',
  },
  fieldRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#404040',
    width: 200,
  },
  fieldValue: {
    fontSize: 12,
    color: '#404040',
    flex: 1,
  },
  listItem: {
    fontSize: 12,
    color: '#404040',
    marginBottom: 4,
    paddingLeft: 8,
  },
  subSectionTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#4b5563',
    marginBottom: 4,
    marginTop: 6,
  },
  separator: {
    marginTop: 20,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
    borderBottomStyle: 'solid',
  },
  noDataText: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 40,
  },
});

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return String(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return String(dateStr);
  }
};

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  return String(val);
};

const safeArray = (val) => (Array.isArray(val) ? val.filter(Boolean) : []);

const formatValue = (val) => {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'number') return String(val);
  return String(val);
};

const keyToLabel = (key) => {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
};

const ProviderInfoDocumentPDFTemplate = ({ document: data }) => {
  const unwrapData = (inputData) => {
    if (!inputData) return [];
    if (Array.isArray(inputData)) {
      if (inputData.length === 1 && inputData[0]?.provider_info) {
        return inputData[0].provider_info;
      }
      return inputData;
    }
    if (inputData.provider_info) {
      return inputData.provider_info;
    }
    return [inputData];
  };

  const records = unwrapData(data);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Provider Info</Text>
          </View>
          <Text style={styles.noDataText}>No data available</Text>
        </Page>
      </Document>
    );
  }

  const renderObjectSection = (title, obj) => {
    if (!obj || typeof obj !== 'object') return null;
    const entries = Object.entries(obj).filter(([k, v]) => formatValue(v) !== null && k !== '_id');
    if (entries.length === 0) return null;

    return (
      <View style={styles.section} wrap={entries.length > 8 ? undefined : false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.sectionContent}>
          {entries.map(([key, value], i) => (
            <View key={i} style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>{keyToLabel(key)}:</Text>
              <Text style={styles.fieldValue}>{safeString(value)}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderArraySection = (title, items) => {
    const safeItems = safeArray(items);
    if (safeItems.length === 0) return null;

    return (
      <View style={styles.section} wrap={safeItems.length > 8 ? undefined : false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.sectionContent}>
          {safeItems.map((item, i) => (
            <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
          ))}
        </View>
      </View>
    );
  };

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Provider Info</Text>
        </View>

        {records.map((record, index) => {
          const idObj = {};
          if (record.npiNumber) idObj.npiNumber = record.npiNumber;
          if (record.deaNumber) idObj.deaNumber = record.deaNumber;
          if (record.medicalLicenseNumber) idObj.medicalLicenseNumber = record.medicalLicenseNumber;
          if (record.taxonomyCode) idObj.taxonomyCode = record.taxonomyCode;

          // 0 is an extraction sentinel ("not recorded") for these administrative
          // metrics, not a meaningful count — hide it rather than display "0".
          const hasNum = (v) => typeof v === 'number' ? v !== 0 : formatValue(v) !== null;

          const credObj = {};
          if (record.credentialingStatus) credObj.credentialingStatus = record.credentialingStatus;
          if (record.malpracticeInsuranceCarrier) credObj.malpracticeInsuranceCarrier = record.malpracticeInsuranceCarrier;
          if (hasNum(record.yearsInPractice)) credObj.yearsInPractice = record.yearsInPractice;

          const qualObj = {};
          if (hasNum(record.qualityMetricsScore)) qualObj.qualityMetricsScore = record.qualityMetricsScore;
          if (record.peerReviewStatus) qualObj.peerReviewStatus = record.peerReviewStatus;
          if (hasNum(record.cmeCreditsCompleted)) qualObj.cmeCreditsCompleted = record.cmeCreditsCompleted;

          const specObj = {};
          if (record.primarySpecialty) specObj.primarySpecialty = record.primarySpecialty;

          const eduObj = {};
          if (record.medicalSchool) eduObj.medicalSchool = record.medicalSchool;
          if (record.residencyProgram) eduObj.residencyProgram = record.residencyProgram;

          const hasTelemed = record.telemedicineCapable !== undefined && record.telemedicineCapable !== null;
          const langs = safeArray(record.languagesSpoken);
          const research = safeArray(record.clinicalResearchInvolvement);

          // Count items for specialties section
          const specTotal = (record.primarySpecialty ? 1 : 0) + safeArray(record.subspecialties).length;
          // Count items for education section
          const eduTotal = (record.medicalSchool ? 1 : 0) + (record.residencyProgram ? 1 : 0) + safeArray(record.fellowshipPrograms).length;
          // Count items for clinical privileges
          const privTotal = safeArray(record.procedurePrivileges).length + safeArray(record.prescribingAuthorizations).length;
          // Count items for practice details
          const practiceTotal = (hasTelemed ? 1 : 0) + langs.length;
          // Count items for research
          const researchTotal = (record.academicAppointment ? 1 : 0) + research.length;

          return (
            <View key={index} style={styles.recordContainer}>
              {index > 0 && <View style={styles.separator} />}

              <View style={styles.recordHeader} wrap={false}>
                <View style={styles.recordDateRow}>
                  {record.createdAt && (
                    <Text style={styles.recordDate}>{formatDate(record.createdAt)}</Text>
                  )}
                </View>
                <Text style={styles.recordTitle}>{record.providerName || `Provider Info ${index + 1}`}</Text>
              </View>

              {renderObjectSection('Identification & Licensing', idObj)}

              {/* Specialties */}
              {specTotal > 0 && (
                <View style={styles.section} wrap={specTotal > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Specialties</Text>
                  <View style={styles.sectionContent}>
                    {record.primarySpecialty && (
                      <View style={styles.fieldRow}>
                        <Text style={styles.fieldLabel}>Primary Specialty:</Text>
                        <Text style={styles.fieldValue}>{record.primarySpecialty}</Text>
                      </View>
                    )}
                    {safeArray(record.subspecialties).length > 0 && (
                      <>
                        <Text style={styles.subSectionTitle}>Subspecialties</Text>
                        {safeArray(record.subspecialties).map((s, i) => (
                          <Text key={i} style={styles.listItem}>{i + 1}. {s}</Text>
                        ))}
                      </>
                    )}
                  </View>
                </View>
              )}

              {renderArraySection('Board Certifications', record.boardCertifications)}

              {/* Education & Training */}
              {eduTotal > 0 && (
                <View style={styles.section} wrap={eduTotal > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Education & Training</Text>
                  <View style={styles.sectionContent}>
                    {record.medicalSchool && (
                      <View style={styles.fieldRow}>
                        <Text style={styles.fieldLabel}>Medical School:</Text>
                        <Text style={styles.fieldValue}>{record.medicalSchool}</Text>
                      </View>
                    )}
                    {record.residencyProgram && (
                      <View style={styles.fieldRow}>
                        <Text style={styles.fieldLabel}>Residency Program:</Text>
                        <Text style={styles.fieldValue}>{record.residencyProgram}</Text>
                      </View>
                    )}
                    {safeArray(record.fellowshipPrograms).length > 0 && (
                      <>
                        <Text style={styles.subSectionTitle}>Fellowship Programs</Text>
                        {safeArray(record.fellowshipPrograms).map((f, i) => (
                          <Text key={i} style={styles.listItem}>{i + 1}. {f}</Text>
                        ))}
                      </>
                    )}
                  </View>
                </View>
              )}

              {renderArraySection('Hospital Affiliations', record.hospitalAffiliations)}
              {renderObjectSection('Credentialing & Insurance', credObj)}

              {/* Clinical Privileges */}
              {privTotal > 0 && (
                <View style={styles.section} wrap={privTotal > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Clinical Privileges</Text>
                  <View style={styles.sectionContent}>
                    {safeArray(record.procedurePrivileges).length > 0 && (
                      <>
                        <Text style={styles.subSectionTitle}>Procedure Privileges</Text>
                        {safeArray(record.procedurePrivileges).map((p, i) => (
                          <Text key={i} style={styles.listItem}>{i + 1}. {p}</Text>
                        ))}
                      </>
                    )}
                    {safeArray(record.prescribingAuthorizations).length > 0 && (
                      <>
                        <Text style={styles.subSectionTitle}>Prescribing Authorizations</Text>
                        {safeArray(record.prescribingAuthorizations).map((p, i) => (
                          <Text key={i} style={styles.listItem}>{i + 1}. {p}</Text>
                        ))}
                      </>
                    )}
                  </View>
                </View>
              )}

              {renderObjectSection('Quality & Review', qualObj)}

              {/* Practice Details */}
              {practiceTotal > 0 && (
                <View style={styles.section} wrap={practiceTotal > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Practice Details</Text>
                  <View style={styles.sectionContent}>
                    {hasTelemed && (
                      <View style={styles.fieldRow}>
                        <Text style={styles.fieldLabel}>Telemedicine Capable:</Text>
                        <Text style={styles.fieldValue}>{record.telemedicineCapable ? 'Yes' : 'No'}</Text>
                      </View>
                    )}
                    {langs.length > 0 && (
                      <>
                        <Text style={styles.subSectionTitle}>Languages Spoken</Text>
                        {langs.map((l, i) => (
                          <Text key={i} style={styles.listItem}>{i + 1}. {l}</Text>
                        ))}
                      </>
                    )}
                  </View>
                </View>
              )}

              {/* Research & Academic */}
              {researchTotal > 0 && (
                <View style={styles.section} wrap={researchTotal > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Research & Academic</Text>
                  <View style={styles.sectionContent}>
                    {record.academicAppointment && (
                      <View style={styles.fieldRow}>
                        <Text style={styles.fieldLabel}>Academic Appointment:</Text>
                        <Text style={styles.fieldValue}>{record.academicAppointment}</Text>
                      </View>
                    )}
                    {research.length > 0 && (
                      <>
                        <Text style={styles.subSectionTitle}>Clinical Research Involvement</Text>
                        {research.map((r, i) => (
                          <Text key={i} style={styles.listItem}>{i + 1}. {r}</Text>
                        ))}
                      </>
                    )}
                  </View>
                </View>
              )}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default ProviderInfoDocumentPDFTemplate;
