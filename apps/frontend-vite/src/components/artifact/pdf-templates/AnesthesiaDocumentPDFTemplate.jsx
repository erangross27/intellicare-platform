import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// filterNulls helper - prevents React PDF crashes on null/undefined array items
const filterNulls = (arr) => {
  if (!Array.isArray(arr)) return [];
  return arr.filter(item => item !== null && item !== undefined);
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 11,
    lineHeight: 1.5,
    color: '#000000'
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center'
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 14,
    marginBottom: 6,
    textDecoration: 'underline'
  },
  subsectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 4
  },
  line: {
    marginBottom: 2,
    marginLeft: 2
  },
  emptyLine: {
    marginBottom: 6
  },
  indent: {
    marginLeft: 10
  },
  doubleIndent: {
    marginLeft: 20
  }
});

const AnesthesiaDocumentPDFTemplate = ({ document }) => {
  // Data unwrapping - handle wrapped collection structure
  const unwrappedData = document?.documentData || document;
  // Handle WRAP_ALL_RECORDS_COLLECTIONS structure where data is wrapped under collection name key
  let recordsArray = [];
  if (unwrappedData?.anesthesia_records && Array.isArray(unwrappedData.anesthesia_records)) {
    recordsArray = unwrappedData.anesthesia_records;
  } else if (Array.isArray(unwrappedData)) {
    recordsArray = unwrappedData;
  } else if (unwrappedData && typeof unwrappedData === 'object') {
    recordsArray = [unwrappedData];
  }
  // Use first record as doc for backward compatibility (single document display)
  const doc = recordsArray.length > 0 ? recordsArray[0] : {};

  // 🔍 SYSTEMATIC OBJECT DETECTION - Scan ALL fields recursively (SUMMARY ONLY)
  const scanForObjects = (obj, path = 'doc') => {
    const objectFields = [];

    const scan = (value, currentPath) => {
      if (value === null || value === undefined) return;

      const valueType = typeof value;

      // Detect objects that aren't arrays or dates
      if (valueType === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        // Silently collect object paths without logging each one
        objectFields.push({
          path: currentPath,
          keys: Object.keys(value).join(', '),
          sample: JSON.stringify(value).substring(0, 80)
        });

        // Recursively scan nested objects
        Object.entries(value).forEach(([key, val]) => {
          scan(val, `${currentPath}.${key}`);
        });
      } else if (Array.isArray(value)) {
        // Scan array items
        value.forEach((item, idx) => {
          scan(item, `${currentPath}[${idx}]`);
        });
      }
    };

    scan(obj, path);

    // ONLY OUTPUT SUMMARY (no individual logs)
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 PDF OBJECT DETECTION SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (objectFields.length === 0) {
      console.log('✅ No object fields detected - PDF should render successfully!');
    } else {
      console.log(`🚨 FOUND ${objectFields.length} OBJECT FIELDS THAT NEED TYPE CHECKING:\n`);

      // Show first 20 fields with details
      const displayLimit = 20;
      objectFields.slice(0, displayLimit).forEach((field, idx) => {
        console.log(`${idx + 1}. ${field.path}`);
        console.log(`   Keys: ${field.keys}`);
        console.log(`   Sample: ${field.sample}\n`);
      });

      if (objectFields.length > displayLimit) {
        console.log(`... and ${objectFields.length - displayLimit} more fields\n`);
      }

      console.log('📋 COMPLETE LIST OF PATHS (copy these):');
      objectFields.forEach((field, idx) => {
        console.log(`   ${idx + 1}. ${field.path}`);
      });
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    return objectFields;
  };

  // Run detection before rendering
  if (doc) {
    console.log('🔍 Starting systematic PDF object detection...');
    scanForObjects(doc);
  }

  if (!doc) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.title}>Anesthesia Preoperative Consultation</Text>
          <Text style={styles.line}>No document data available.</Text>
        </Page>
      </Document>
    );
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const formatObject = (obj) => {
    if (!obj || typeof obj !== 'object') return '';
    return Object.entries(obj)
      .filter(([k, v]) => v !== null && v !== undefined && v !== '')
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
  };

  return (
    <Document>
      <Page size="LETTER" style={styles.page} wrap>
        <Text style={styles.title}>Anesthesia Preoperative Consultation</Text>

        {/* Date */}
        {doc.date && (
          <Text style={styles.line}>Date: {formatDate(doc.date)}</Text>
        )}
        <Text style={styles.emptyLine}></Text>

        {/* Patient Demographics */}
        {doc.patientDemographics && (
          <View>
            <Text style={styles.sectionTitle}>Patient Demographics</Text>
            {doc.patientDemographics.name && (
              <Text style={styles.line}>Name: {doc.patientDemographics.name}</Text>
            )}
            {doc.patientDemographics.age && (
              <Text style={styles.line}>Age: {doc.patientDemographics.age}</Text>
            )}
            {doc.patientDemographics.gender && (
              <Text style={styles.line}>Gender: {doc.patientDemographics.gender}</Text>
            )}
            {doc.patientDemographics.mrn && (
              <Text style={styles.line}>MRN: {doc.patientDemographics.mrn}</Text>
            )}
            {doc.patientDemographics.dateOfBirth && (
              <Text style={styles.line}>DOB: {formatDate(doc.patientDemographics.dateOfBirth)}</Text>
            )}
            <Text style={styles.emptyLine}></Text>
          </View>
        )}

        {/* Chief Complaint */}
        {doc.chiefComplaint && (
          <View>
            <Text style={styles.sectionTitle}>Chief Complaint</Text>
            {doc.chiefComplaint.complaint && (
              <Text style={styles.line}>{doc.chiefComplaint.complaint}</Text>
            )}
            {doc.chiefComplaint.duration && (
              <Text style={styles.line}>Duration: {doc.chiefComplaint.duration}</Text>
            )}
            <Text style={styles.emptyLine}></Text>
          </View>
        )}

        {/* History of Present Illness */}
        {doc.historyPresentIllness && (
          <View>
            <Text style={styles.sectionTitle}>History of Present Illness</Text>
            <Text style={styles.line}>{doc.historyPresentIllness}</Text>
            <Text style={styles.emptyLine}></Text>
          </View>
        )}

        {/* Allergies */}
        {doc.allergies && doc.allergies.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Allergies</Text>
            {filterNulls(doc.allergies).map((allergy, idx) => {
              const allergen = allergy.allergen || '';
              const reaction = allergy.reaction || '';
              const severity = allergy.severity ? (typeof allergy.severity === 'string' ? allergy.severity : formatObject(allergy.severity)) : '';
              return (
                <Text key={idx} style={styles.line}>
                  • {allergen} - {reaction} ({severity})
                </Text>
              );
            })}
            <Text style={styles.emptyLine}></Text>
          </View>
        )}

        {/* Current Medications */}
        {doc.medications && doc.medications.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Current Medications</Text>
            {filterNulls(doc.medications).map((med, idx) => {
              const medName = med.name || med.medication || '';
              const dosage = med.dosage || '';
              const frequency = med.frequency || '';
              const route = med.route || '';
              const indication = med.indication || '';
              const status = med.status ? (typeof med.status === 'string' ? med.status : formatObject(med.status)) : '';
              return (
                <Text key={idx} style={styles.line}>
                  • {medName} - {dosage} {frequency} ({route})
                  {indication && ` - ${indication}`}
                  {status && ` [${status}]`}
                </Text>
              );
            })}
            <Text style={styles.emptyLine}></Text>
          </View>
        )}

        {/* Diagnoses */}
        {doc.diagnoses && doc.diagnoses.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Diagnoses</Text>
            {filterNulls(doc.diagnoses).map((dx, idx) => {
              const diagnosis = typeof dx.diagnosis === 'string' ? dx.diagnosis : (typeof dx.diagnosis === 'object' ? formatObject(dx.diagnosis) : String(dx.diagnosis || ''));
              const icd10 = dx.icd10 ? ` (${dx.icd10})` : '';
              const status = dx.status ? (typeof dx.status === 'string' ? ` - ${dx.status}` : ` - ${formatObject(dx.status)}`) : '';
              return (
                <Text key={idx} style={styles.line}>
                  • {diagnosis}{icd10}{status}
                </Text>
              );
            })}
            <Text style={styles.emptyLine}></Text>
          </View>
        )}

        {/* Medical History */}
        {doc.medicalHistory && (
          <View>
            <Text style={styles.sectionTitle}>Medical History</Text>

            {doc.medicalHistory.pastMedicalHistory && doc.medicalHistory.pastMedicalHistory.length > 0 && (
              <>
                <Text style={styles.subsectionTitle}>Past Medical History</Text>
                {filterNulls(doc.medicalHistory.pastMedicalHistory).map((pmh, idx) => {
                  const condition = typeof pmh.condition === 'string' ? pmh.condition : (typeof pmh.condition === 'object' ? formatObject(pmh.condition) : String(pmh.condition || ''));
                  const status = typeof pmh.status === 'string' ? pmh.status : (typeof pmh.status === 'object' ? formatObject(pmh.status) : String(pmh.status || ''));
                  return (
                    <Text key={idx} style={styles.line}>
                      • {condition} - {status}
                    </Text>
                  );
                })}
                <Text style={styles.emptyLine}></Text>
              </>
            )}

            {doc.medicalHistory.surgicalHistory && doc.medicalHistory.surgicalHistory.length > 0 && (
              <>
                <Text style={styles.subsectionTitle}>Surgical History</Text>
                {filterNulls(doc.medicalHistory.surgicalHistory).map((sh, idx) => (
                  <Text key={idx} style={styles.line}>
                    • {sh.procedure}
                    {sh.date && ` (${sh.date})`}
                    {sh.complications && ` - ${sh.complications}`}
                  </Text>
                ))}
                <Text style={styles.emptyLine}></Text>
              </>
            )}

            {doc.medicalHistory.familyHistory && doc.medicalHistory.familyHistory.length > 0 && (
              <>
                <Text style={styles.subsectionTitle}>Family History</Text>
                {filterNulls(doc.medicalHistory.familyHistory).map((fh, idx) => (
                  <Text key={idx} style={styles.line}>
                    • {fh.relationship}: {fh.condition}
                  </Text>
                ))}
                <Text style={styles.emptyLine}></Text>
              </>
            )}

            {doc.medicalHistory.socialHistory && (
              <>
                <Text style={styles.subsectionTitle}>Social History</Text>
                {doc.medicalHistory.socialHistory.tobacco && (
                  <Text style={styles.line}>Tobacco: {typeof doc.medicalHistory.socialHistory.tobacco === 'string' ? doc.medicalHistory.socialHistory.tobacco : formatObject(doc.medicalHistory.socialHistory.tobacco)}</Text>
                )}
                {doc.medicalHistory.socialHistory.alcohol && (
                  <Text style={styles.line}>Alcohol: {typeof doc.medicalHistory.socialHistory.alcohol === 'string' ? doc.medicalHistory.socialHistory.alcohol : formatObject(doc.medicalHistory.socialHistory.alcohol)}</Text>
                )}
                {doc.medicalHistory.socialHistory.drugs && (
                  <Text style={styles.line}>Drugs: {typeof doc.medicalHistory.socialHistory.drugs === 'string' ? doc.medicalHistory.socialHistory.drugs : formatObject(doc.medicalHistory.socialHistory.drugs)}</Text>
                )}
                {doc.medicalHistory.socialHistory.occupation && (
                  <Text style={styles.line}>Occupation: {doc.medicalHistory.socialHistory.occupation}</Text>
                )}
                <Text style={styles.emptyLine}></Text>
              </>
            )}
          </View>
        )}

        {/* Review of Systems */}
        {doc.reviewOfSystems && (
          <View>
            <Text style={styles.sectionTitle}>Review of Systems</Text>
            {Object.entries(doc.reviewOfSystems).map(([system, findings]) => {
              if (!findings) return null;
              const findingsText = typeof findings === 'string' ? findings : (typeof findings === 'object' ? formatObject(findings) : String(findings));
              return (
                <Text key={system} style={styles.line}>
                  {system}: {findingsText}
                </Text>
              );
            })}
            <Text style={styles.emptyLine}></Text>
          </View>
        )}

        {/* Vital Signs */}
        {doc.vitalSigns && (
          <View>
            <Text style={styles.sectionTitle}>Vital Signs</Text>
            {doc.vitalSigns.bloodPressure && (
              <Text style={styles.line}>BP: {doc.vitalSigns.bloodPressure}</Text>
            )}
            {doc.vitalSigns.heartRate && (
              <Text style={styles.line}>HR: {doc.vitalSigns.heartRate}</Text>
            )}
            {doc.vitalSigns.respiratoryRate && (
              <Text style={styles.line}>RR: {doc.vitalSigns.respiratoryRate}</Text>
            )}
            {doc.vitalSigns.oxygenSaturation && (
              <Text style={styles.line}>SpO2: {doc.vitalSigns.oxygenSaturation}</Text>
            )}
            {doc.vitalSigns.temperature && (
              <Text style={styles.line}>Temp: {doc.vitalSigns.temperature}</Text>
            )}
            {doc.vitalSigns.bmi && (
              <Text style={styles.line}>BMI: {doc.vitalSigns.bmi}</Text>
            )}
            {doc.vitalSigns.height && (
              <Text style={styles.line}>Height: {typeof doc.vitalSigns.height === 'string' ? doc.vitalSigns.height : formatObject(doc.vitalSigns.height)}</Text>
            )}
            {doc.vitalSigns.weight && (
              <Text style={styles.line}>Weight: {typeof doc.vitalSigns.weight === 'string' ? doc.vitalSigns.weight : formatObject(doc.vitalSigns.weight)}</Text>
            )}
            <Text style={styles.emptyLine}></Text>
          </View>
        )}

        {/* Physical Examination */}
        {doc.physicalExamination && (
          <View>
            <Text style={styles.sectionTitle}>Physical Examination</Text>
            {Object.entries(doc.physicalExamination).map(([system, findings]) => {
              if (!findings) return null;
              const findingsText = typeof findings === 'string' ? findings : (typeof findings === 'object' ? formatObject(findings) : String(findings));
              return (
                <Text key={system} style={styles.line}>
                  {system}: {findingsText}
                </Text>
              );
            })}
            <Text style={styles.emptyLine}></Text>
          </View>
        )}

        {/* ASA Classification */}
        {doc.asaClassification && (
          <View>
            <Text style={styles.sectionTitle}>ASA Classification</Text>
            <Text style={styles.line}>Class: {doc.asaClassification.class}</Text>
            {doc.asaClassification.description && (
              <Text style={styles.line}>Description: {doc.asaClassification.description}</Text>
            )}
            <Text style={styles.emptyLine}></Text>
          </View>
        )}

        {/* Airway Assessment */}
        {doc.airwayAssessment && (
          <View>
            <Text style={styles.sectionTitle}>Airway Assessment</Text>
            {doc.airwayAssessment.mallampatiScore && (
              <Text style={styles.line}>Mallampati: {doc.airwayAssessment.mallampatiScore}</Text>
            )}
            {doc.airwayAssessment.thyromental && (
              <Text style={styles.line}>Thyromental: {doc.airwayAssessment.thyromental}</Text>
            )}
            {doc.airwayAssessment.mouthOpening && (
              <Text style={styles.line}>Mouth Opening: {doc.airwayAssessment.mouthOpening}</Text>
            )}
            {doc.airwayAssessment.neckMobility && (
              <Text style={styles.line}>Neck Mobility: {doc.airwayAssessment.neckMobility}</Text>
            )}
            {doc.airwayAssessment.dentures && (
              <Text style={styles.line}>Dentures: {doc.airwayAssessment.dentures}</Text>
            )}
            <Text style={styles.emptyLine}></Text>
          </View>
        )}

        {/* Pain Management */}
        {doc.painManagement && (
          <View>
            <Text style={styles.sectionTitle}>Pain Management</Text>
            {doc.painManagement.currentPainScore && (
              <Text style={styles.line}>Current Pain Score: {doc.painManagement.currentPainScore}</Text>
            )}
            {doc.painManagement.chronicPain && (
              <Text style={styles.line}>Chronic Pain: {doc.painManagement.chronicPain}</Text>
            )}
            {doc.painManagement.opioidTolerance && (
              <Text style={styles.line}>Opioid Tolerance: {doc.painManagement.opioidTolerance}</Text>
            )}
            {doc.painManagement.plan && (
              <Text style={styles.line}>Plan: {doc.painManagement.plan}</Text>
            )}
            <Text style={styles.emptyLine}></Text>
          </View>
        )}

        {/* Anesthesia Plan */}
        {doc.anesthesiaPlan && (
          <View>
            <Text style={styles.sectionTitle}>Anesthesia Plan</Text>
            {doc.anesthesiaPlan.technique && (
              <Text style={styles.line}>Technique: {doc.anesthesiaPlan.technique}</Text>
            )}
            {doc.anesthesiaPlan.agents && (
              <Text style={styles.line}>Agents: {doc.anesthesiaPlan.agents}</Text>
            )}
            {doc.anesthesiaPlan.monitoring && (
              <Text style={styles.line}>Monitoring: {doc.anesthesiaPlan.monitoring}</Text>
            )}
            {doc.anesthesiaPlan.riskAssessment && (
              <Text style={styles.line}>Risk: {doc.anesthesiaPlan.riskAssessment}</Text>
            )}
            <Text style={styles.emptyLine}></Text>
          </View>
        )}

        {/* Laboratory Results */}
        {doc.laboratoryResults && doc.laboratoryResults.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Laboratory Results</Text>
            {filterNulls(doc.laboratoryResults).map((lab, idx) => (
              <Text key={idx} style={styles.line}>
                • {lab.testName}: {lab.value} {lab.unit}
                {lab.flag && ` [${lab.flag}]`}
              </Text>
            ))}
            <Text style={styles.emptyLine}></Text>
          </View>
        )}

        {/* Imaging Studies */}
        {doc.imagingStudies && doc.imagingStudies.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Imaging Studies</Text>
            {filterNulls(doc.imagingStudies).map((img, idx) => (
              <View key={idx}>
                <Text style={styles.line}>• {img.studyType}</Text>
                {img.findings && (
                  <Text style={[styles.line, styles.indent]}>Findings: {img.findings}</Text>
                )}
              </View>
            ))}
            <Text style={styles.emptyLine}></Text>
          </View>
        )}

        {/* Pulmonary Function Tests */}
        {doc.pulmonaryFunctionTests && (
          <View>
            <Text style={styles.sectionTitle}>Pulmonary Function Tests</Text>
            {Object.entries(doc.pulmonaryFunctionTests).map(([key, value]) => {
              if (!value || value === null) return null;
              return (
                <Text key={key} style={styles.line}>
                  {key}: {typeof value === 'object' ? formatObject(value) : value}
                </Text>
              );
            })}
            <Text style={styles.emptyLine}></Text>
          </View>
        )}

        {/* Sleep Study */}
        {doc.sleepStudy && (
          <View>
            <Text style={styles.sectionTitle}>Sleep Study</Text>
            {doc.sleepStudy.ahi && (
              <Text style={styles.line}>AHI: {doc.sleepStudy.ahi}</Text>
            )}
            {doc.sleepStudy.diagnosis && (
              <Text style={styles.line}>Diagnosis: {doc.sleepStudy.diagnosis}</Text>
            )}
            {doc.sleepStudy.cpapUsage && (
              <Text style={styles.line}>CPAP Usage: {doc.sleepStudy.cpapUsage}</Text>
            )}
            <Text style={styles.emptyLine}></Text>
          </View>
        )}

        {/* Respiratory Devices */}
        {doc.respiratoryDevices && (
          <View>
            <Text style={styles.sectionTitle}>Respiratory Devices</Text>
            {Object.entries(doc.respiratoryDevices).map(([key, value]) => {
              if (!value) return null;
              const valueText = typeof value === 'string' ? value : (typeof value === 'object' ? formatObject(value) : String(value));
              return (
                <Text key={key} style={styles.line}>
                  {key}: {valueText}
                </Text>
              );
            })}
            <Text style={styles.emptyLine}></Text>
          </View>
        )}

        {/* Clinical Scores */}
        {doc.clinicalScores && (
          <View>
            <Text style={styles.sectionTitle}>Clinical Scores</Text>
            {Object.entries(doc.clinicalScores).map(([key, value]) => {
              if (!value) return null;
              return (
                <Text key={key} style={styles.line}>
                  {key}: {typeof value === 'object' ? formatObject(value) : value}
                </Text>
              );
            })}
            <Text style={styles.emptyLine}></Text>
          </View>
        )}

        {/* Risk Stratification */}
        {doc.riskStratification && (
          <View>
            <Text style={styles.sectionTitle}>Risk Stratification</Text>
            {Object.entries(doc.riskStratification).map(([key, value]) => {
              if (!value) return null;
              const valueText = typeof value === 'string' ? value : (typeof value === 'object' ? formatObject(value) : String(value));
              return (
                <Text key={key} style={styles.line}>
                  {key}: {valueText}
                </Text>
              );
            })}
            <Text style={styles.emptyLine}></Text>
          </View>
        )}

        {/* Operative Details */}
        {doc.operativeDetails && (
          <View>
            <Text style={styles.sectionTitle}>Operative Details</Text>
            {Object.entries(doc.operativeDetails).map(([key, value]) => {
              if (!value || value === null) return null;
              if (Array.isArray(value)) {
                return (
                  <Text key={key} style={styles.line}>
                    {key}: {value.join(', ')}
                  </Text>
                );
              }
              return (
                <Text key={key} style={styles.line}>
                  {key}: {typeof value === 'object' ? formatObject(value) : value}
                </Text>
              );
            })}
            <Text style={styles.emptyLine}></Text>
          </View>
        )}

        {/* Preoperative Preparation */}
        {doc.preoperativePreparation && (
          <View>
            <Text style={styles.sectionTitle}>Preoperative Preparation</Text>
            {Object.entries(doc.preoperativePreparation).map(([key, value]) => {
              if (!value) return null;
              if (Array.isArray(value)) {
                return (
                  <View key={key}>
                    <Text style={styles.line}>{key}:</Text>
                    {filterNulls(value).map((item, idx) => (
                      <Text key={idx} style={[styles.line, styles.indent]}>
                        • {typeof item === 'object' ? formatObject(item) : item}
                      </Text>
                    ))}
                  </View>
                );
              }
              const valueText = typeof value === 'string' ? value : (typeof value === 'object' ? formatObject(value) : String(value));
              return (
                <Text key={key} style={styles.line}>
                  {key}: {valueText}
                </Text>
              );
            })}
            <Text style={styles.emptyLine}></Text>
          </View>
        )}

        {/* DVT Prophylaxis */}
        {doc.dvtProphylaxis && (
          <View>
            <Text style={styles.sectionTitle}>DVT Prophylaxis</Text>
            {Object.entries(doc.dvtProphylaxis).map(([key, value]) => {
              if (!value) return null;
              const valueText = typeof value === 'string' ? value : (typeof value === 'object' ? formatObject(value) : String(value));
              return (
                <Text key={key} style={styles.line}>
                  {key}: {valueText}
                </Text>
              );
            })}
            <Text style={styles.emptyLine}></Text>
          </View>
        )}

        {/* Postoperative Orders */}
        {doc.postoperativeOrders && (
          <View>
            <Text style={styles.sectionTitle}>Postoperative Orders</Text>
            {Object.entries(doc.postoperativeOrders).map(([key, value]) => {
              if (!value) return null;
              if (Array.isArray(value)) {
                return (
                  <View key={key}>
                    <Text style={styles.line}>{key}:</Text>
                    {filterNulls(value).map((item, idx) => (
                      <Text key={idx} style={[styles.line, styles.indent]}>
                        • {typeof item === 'object' ? formatObject(item) : item}
                      </Text>
                    ))}
                  </View>
                );
              }
              const valueText = typeof value === 'string' ? value : (typeof value === 'object' ? formatObject(value) : String(value));
              return (
                <Text key={key} style={styles.line}>
                  {key}: {valueText}
                </Text>
              );
            })}
            <Text style={styles.emptyLine}></Text>
          </View>
        )}

        {/* Referrals */}
        {doc.referrals && doc.referrals.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Referrals</Text>
            {filterNulls(doc.referrals).map((ref, idx) => {
              const specialty = typeof ref.specialty === 'string' ? ref.specialty : (typeof ref.specialty === 'object' ? formatObject(ref.specialty) : String(ref.specialty || ''));
              const reason = typeof ref.reason === 'string' ? ref.reason : (typeof ref.reason === 'object' ? formatObject(ref.reason) : String(ref.reason || ''));
              const urgency = ref.urgency ? (typeof ref.urgency === 'string' ? ref.urgency : formatObject(ref.urgency)) : '';
              return (
                <View key={idx}>
                  <Text style={styles.line}>
                    • {specialty} - {reason}
                  </Text>
                  {urgency && (
                    <Text style={[styles.line, styles.indent]}>Urgency: {urgency}</Text>
                  )}
                </View>
              );
            })}
            <Text style={styles.emptyLine}></Text>
          </View>
        )}

        {/* Follow-Up Appointments */}
        {doc.followUpAppointments && doc.followUpAppointments.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Follow-Up Appointments</Text>
            {filterNulls(doc.followUpAppointments).map((appt, idx) => {
              const specialty = typeof appt.specialty === 'string' ? appt.specialty : (typeof appt.specialty === 'object' ? formatObject(appt.specialty) : String(appt.specialty || ''));
              const timing = typeof appt.timing === 'string' ? appt.timing : (typeof appt.timing === 'object' ? formatObject(appt.timing) : String(appt.timing || ''));
              const reason = appt.reason ? (typeof appt.reason === 'string' ? appt.reason : formatObject(appt.reason)) : '';
              return (
                <View key={idx}>
                  <Text style={styles.line}>
                    • {specialty} - {timing}
                  </Text>
                  {reason && (
                    <Text style={[styles.line, styles.indent]}>Reason: {reason}</Text>
                  )}
                </View>
              );
            })}
            <Text style={styles.emptyLine}></Text>
          </View>
        )}

        {/* Patient Education */}
        {doc.patientEducation && (
          <View>
            <Text style={styles.sectionTitle}>Patient Education</Text>
            {Object.entries(doc.patientEducation).map(([key, value]) => {
              if (!value) return null;
              if (Array.isArray(value)) {
                return (
                  <View key={key}>
                    <Text style={styles.line}>{key}:</Text>
                    {filterNulls(value).map((item, idx) => {
                      const text = typeof item === 'object'
                        ? (item.topic || item.name || item.title || item.description || formatObject(item))
                        : item;
                      return (
                        <Text key={idx} style={[styles.line, styles.indent]}>
                          • {text}
                        </Text>
                      );
                    })}
                  </View>
                );
              }
              const valueText = typeof value === 'string' ? value : (typeof value === 'object' ? formatObject(value) : String(value));
              return (
                <Text key={key} style={styles.line}>
                  {key}: {valueText}
                </Text>
              );
            })}
            <Text style={styles.emptyLine}></Text>
          </View>
        )}

        {/* Clinical Decision Support */}
        {doc.clinicalDecisionSupport && (
          <View>
            <Text style={styles.sectionTitle}>Clinical Decision Support</Text>
            {doc.clinicalDecisionSupport.riskAssessment && (
              <>
                <Text style={styles.subsectionTitle}>Risk Assessment</Text>
                {Object.entries(doc.clinicalDecisionSupport.riskAssessment).map(([key, value]) => {
                  // Handle different value types
                  if (typeof value === 'string') {
                    return (
                      <Text key={key} style={styles.line}>
                        {key}: {value}
                      </Text>
                    );
                  } else if (Array.isArray(value)) {
                    // Handle arrays - show ALL data, each field on its own line
                    return (
                      <View key={key}>
                        <Text style={styles.line}>{key}:</Text>
                        {filterNulls(value).map((item, idx) => {
                          if (typeof item === 'string') {
                            // Simple string - one line
                            return (
                              <Text key={idx} style={[styles.line, styles.indent]}>
                                {item}
                              </Text>
                            );
                          } else if (typeof item === 'object' && item !== null) {
                            // Object - render each field on separate line
                            return (
                              <View key={idx}>
                                {Object.entries(item).filter(([k, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => (
                                  <Text key={k} style={[styles.line, styles.indent]}>
                                    {k}: {String(v)}
                                  </Text>
                                ))}
                              </View>
                            );
                          } else {
                            return (
                              <Text key={idx} style={[styles.line, styles.indent]}>
                                {String(item)}
                              </Text>
                            );
                          }
                        })}
                      </View>
                    );
                  } else if (typeof value === 'object' && value !== null) {
                    // Handle nested objects
                    return (
                      <Text key={key} style={styles.line}>
                        {key}: {formatObject(value)}
                      </Text>
                    );
                  } else {
                    return (
                      <Text key={key} style={styles.line}>
                        {key}: {String(value)}
                      </Text>
                    );
                  }
                })}
              </>
            )}
            {doc.clinicalDecisionSupport.redFlags && doc.clinicalDecisionSupport.redFlags.length > 0 && (
              <>
                <Text style={styles.subsectionTitle}>Red Flags</Text>
                {filterNulls(doc.clinicalDecisionSupport.redFlags).map((flag, idx) => (
                  <Text key={idx} style={styles.line}>
                    • {flag.finding || flag.issue || formatObject(flag)}
                  </Text>
                ))}
              </>
            )}
            {doc.clinicalDecisionSupport.drugInteractions && doc.clinicalDecisionSupport.drugInteractions.length > 0 && (
              <>
                <Text style={styles.subsectionTitle}>Drug Interactions</Text>
                {filterNulls(doc.clinicalDecisionSupport.drugInteractions).map((di, idx) => (
                  <Text key={idx} style={styles.line}>
                    • {di.interaction || formatObject(di)}
                  </Text>
                ))}
              </>
            )}
            {doc.clinicalDecisionSupport.contraindications && doc.clinicalDecisionSupport.contraindications.length > 0 && (
              <>
                <Text style={styles.subsectionTitle}>Contraindications</Text>
                {filterNulls(doc.clinicalDecisionSupport.contraindications).map((contra, idx) => (
                  <Text key={idx} style={styles.line}>
                    • {contra.medication || contra.condition || formatObject(contra)}
                  </Text>
                ))}
              </>
            )}
            <Text style={styles.emptyLine}></Text>
          </View>
        )}

        {/* GI Risk Assessment */}
        {doc.giRiskAssessment && (
          <View>
            <Text style={styles.sectionTitle}>GI Risk Assessment</Text>
            {Object.entries(doc.giRiskAssessment).map(([category, data]) => {
              if (!data || typeof data !== 'object') return null;
              return (
                <View key={category}>
                  <Text style={styles.subsectionTitle}>{category}</Text>
                  {data.riskLevel && (
                    <Text style={styles.line}>Risk Level: {data.riskLevel}</Text>
                  )}
                  {data.riskFactors && data.riskFactors.length > 0 && (
                    <>
                      <Text style={styles.line}>Risk Factors:</Text>
                      {filterNulls(data.riskFactors).map((factor, idx) => {
                        const factorText = typeof factor === 'string' ? factor : (typeof factor === 'object' ? formatObject(factor) : String(factor));
                        return (
                          <Text key={idx} style={[styles.line, styles.indent]}>
                            • {factorText}
                          </Text>
                        );
                      })}
                    </>
                  )}
                  {data.recommendations && data.recommendations.length > 0 && (
                    <>
                      <Text style={styles.line}>Recommendations:</Text>
                      {filterNulls(data.recommendations).map((rec, idx) => {
                        const recText = typeof rec === 'string' ? rec : (typeof rec === 'object' ? formatObject(rec) : String(rec));
                        return (
                          <Text key={idx} style={[styles.line, styles.indent]}>
                            • {recText}
                          </Text>
                        );
                      })}
                    </>
                  )}
                </View>
              );
            })}
            <Text style={styles.emptyLine}></Text>
          </View>
        )}

        {/* Assessment and Plan */}
        {doc.assessmentAndPlan && (
          <View>
            <Text style={styles.sectionTitle}>Assessment and Plan</Text>
            <Text style={styles.line}>
              {typeof doc.assessmentAndPlan === 'string' ? doc.assessmentAndPlan : formatObject(doc.assessmentAndPlan)}
            </Text>
            <Text style={styles.emptyLine}></Text>
          </View>
        )}

        {/* Additional Notes */}
        {doc.additionalNotes && (
          <View>
            <Text style={styles.sectionTitle}>Additional Notes</Text>
            <Text style={styles.line}>
              {typeof doc.additionalNotes === 'string' ? doc.additionalNotes : formatObject(doc.additionalNotes)}
            </Text>
            <Text style={styles.emptyLine}></Text>
          </View>
        )}

        {/* Administrative Data */}
        {doc.administrativeData && (
          <View>
            <Text style={styles.sectionTitle}>Administrative Data</Text>
            {Object.entries(doc.administrativeData).map(([key, value]) => {
              if (!value) return null;
              const valueText = typeof value === 'string' ? value : (typeof value === 'object' ? formatObject(value) : String(value));
              return (
                <Text key={key} style={styles.line}>
                  {key}: {valueText}
                </Text>
              );
            })}
            <Text style={styles.emptyLine}></Text>
          </View>
        )}

        {/* Consultation Details */}
        {doc.consultationDetails && (
          <View>
            <Text style={styles.sectionTitle}>Consultation Details</Text>
            {doc.consultationDetails.consultingPhysician && (
              <Text style={styles.line}>Physician: {doc.consultationDetails.consultingPhysician}</Text>
            )}
            {doc.consultationDetails.consultingSpecialty && (
              <Text style={styles.line}>Specialty: {doc.consultationDetails.consultingSpecialty}</Text>
            )}
            {doc.consultationDetails.consultDate && (
              <Text style={styles.line}>Date: {formatDate(doc.consultationDetails.consultDate)}</Text>
            )}
            {doc.consultationDetails.facility && (
              <Text style={styles.line}>Facility: {doc.consultationDetails.facility}</Text>
            )}
            {doc.consultationDetails.department && (
              <Text style={styles.line}>Department: {doc.consultationDetails.department}</Text>
            )}
          </View>
        )}
      </Page>
    </Document>
  );
};

export default AnesthesiaDocumentPDFTemplate;
