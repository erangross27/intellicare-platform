import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
    paddingBottom: 8,
    borderBottom: '1px solid #cccccc',
  },
  section: {
    marginTop: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 6,
    textDecoration: 'underline',
  },
  subsectionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000000',
    marginTop: 6,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  label: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#000000',
    marginRight: 4,
  },
  value: {
    fontSize: 9,
    color: '#333333',
    flex: 1,
  },
  paragraph: {
    fontSize: 9,
    color: '#333333',
    lineHeight: 1.5,
    marginBottom: 4,
  },
  listItem: {
    fontSize: 9,
    color: '#333333',
    marginBottom: 2,
    marginLeft: 12,
  },
  nestedItem: {
    fontSize: 9,
    color: '#333333',
    marginBottom: 2,
    marginLeft: 24,
  },
});

const AnesthesiaRecordsTemplate = ({ document }) => {
  const doc = document;

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const formatValue = (value) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value);
  };

  // Access nested data
  const anesthesiaAssessment = doc.anesthesiologyAssessment || {};
  const anesthesiaPlan = anesthesiaAssessment.anesthesiaPlan || {};
  const airwayAssessment = anesthesiaAssessment.airwayAssessment || {};
  const painManagementAssessment = anesthesiaAssessment.painManagement || {};
  const painManagement = doc.painManagement || {};
  const chiefComplaint = doc.chiefComplaint || {};
  const medicalHistory = doc.medicalHistory || {};
  const reviewOfSystems = doc.reviewOfSystems || {};
  const physicalExamination = doc.physicalExamination || {};
  const clinicalScores = doc.clinicalScores || {};
  const operativeDetails = doc.operativeDetails || {};
  const preOpPrep = doc.preOperativePreparation || {};
  const postOpOrders = doc.postoperativeOrders || {};
  const consultationDetails = doc.consultationDetails || {};
  const administrativeData = doc.administrativeData || {};
  const riskFactors = doc.additionalData?.riskFactors || [];

  return (
    <View style={styles.container}>
      {/* Header Information */}
      {(doc.date || administrativeData.mrn) && (
        <View style={styles.section}>
          {doc.date && (
            <View style={styles.row}>
              <Text style={styles.label}>Date:</Text>
              <Text style={styles.value}>{formatDate(doc.date)}</Text>
            </View>
          )}
          {administrativeData.mrn && (
            <View style={styles.row}>
              <Text style={styles.label}>MRN:</Text>
              <Text style={styles.value}>{administrativeData.mrn}</Text>
            </View>
          )}
        </View>
      )}

      {/* Chief Complaint */}
      {(chiefComplaint.complaint || doc.historyOfPresentIllness) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Chief Complaint & History</Text>
          {chiefComplaint.complaint && (
            <View style={styles.row}>
              <Text style={styles.label}>Complaint:</Text>
              <Text style={styles.value}>{chiefComplaint.complaint}</Text>
            </View>
          )}
          {chiefComplaint.duration && (
            <View style={styles.row}>
              <Text style={styles.label}>Duration:</Text>
              <Text style={styles.value}>{chiefComplaint.duration}</Text>
            </View>
          )}
          {doc.historyOfPresentIllness && (
            <Text style={styles.paragraph}>{doc.historyOfPresentIllness}</Text>
          )}
        </View>
      )}

      {/* Medical History */}
      {medicalHistory.pastMedicalHistory && medicalHistory.pastMedicalHistory.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Medical History</Text>
          {medicalHistory.pastMedicalHistory.map((condition, idx) => (
            <Text key={idx} style={styles.listItem}>
              • {condition.condition || condition}
              {condition.bmiValue && ` (BMI: ${condition.bmiValue})`}
            </Text>
          ))}
        </View>
      )}

      {/* Surgical History */}
      {medicalHistory.surgicalHistory && medicalHistory.surgicalHistory.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Surgical History</Text>
          {medicalHistory.surgicalHistory.map((surgery, idx) => (
            <Text key={idx} style={styles.listItem}>
              • {surgery.procedure} ({surgery.date})
              {surgery.complications && ` - ${surgery.complications}`}
            </Text>
          ))}
        </View>
      )}

      {/* Family History */}
      {medicalHistory.familyHistory?.conditions && medicalHistory.familyHistory.conditions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Family History</Text>
          {medicalHistory.familyHistory.conditions.map((item, idx) => (
            <Text key={idx} style={styles.listItem}>
              • {item.relationship}: {item.condition}
            </Text>
          ))}
        </View>
      )}

      {/* Social History */}
      {medicalHistory.socialHistory && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Social History</Text>
          {medicalHistory.socialHistory.tobacco && (
            <View style={styles.row}>
              <Text style={styles.label}>Tobacco:</Text>
              <Text style={styles.value}>{medicalHistory.socialHistory.tobacco.status}</Text>
            </View>
          )}
          {medicalHistory.socialHistory.alcohol && (
            <View style={styles.row}>
              <Text style={styles.label}>Alcohol:</Text>
              <Text style={styles.value}>
                {medicalHistory.socialHistory.alcohol.status}
                {medicalHistory.socialHistory.alcohol.amount && ` - ${medicalHistory.socialHistory.alcohol.amount}`}
                {medicalHistory.socialHistory.alcohol.frequency && ` ${medicalHistory.socialHistory.alcohol.frequency}`}
              </Text>
            </View>
          )}
          {medicalHistory.socialHistory.drugs && (
            <View style={styles.row}>
              <Text style={styles.label}>Drugs:</Text>
              <Text style={styles.value}>
                {medicalHistory.socialHistory.drugs.marijuana || 'None reported'}
              </Text>
            </View>
          )}
          {medicalHistory.socialHistory.occupation && (
            <View style={styles.row}>
              <Text style={styles.label}>Occupation:</Text>
              <Text style={styles.value}>{medicalHistory.socialHistory.occupation}</Text>
            </View>
          )}
        </View>
      )}

      {/* Review of Systems */}
      {reviewOfSystems && Object.keys(reviewOfSystems).length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Review of Systems</Text>
          {Object.entries(reviewOfSystems).map(([system, findings], idx) => {
            if (!findings) return null;
            const findingsText = typeof findings === 'object' && findings.symptoms
              ? findings.symptoms
              : formatValue(findings);
            return (
              <View key={idx} style={styles.row}>
                <Text style={styles.label}>{system.charAt(0).toUpperCase() + system.slice(1)}:</Text>
                <Text style={styles.value}>{findingsText}</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Physical Examination */}
      {physicalExamination && Object.keys(physicalExamination).length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Physical Examination</Text>
          {Object.entries(physicalExamination).map(([system, findings], idx) => {
            if (!findings) return null;
            return (
              <View key={idx}>
                <Text style={styles.subsectionTitle}>
                  {system.charAt(0).toUpperCase() + system.slice(1).replace(/([A-Z])/g, ' $1')}:
                </Text>
                {typeof findings === 'object' ? (
                  Object.entries(findings).map(([key, value], subIdx) => (
                    <Text key={subIdx} style={styles.listItem}>
                      • {key.replace(/([A-Z])/g, ' $1')}: {formatValue(value)}
                    </Text>
                  ))
                ) : (
                  <Text style={styles.paragraph}>{formatValue(findings)}</Text>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Functional Capacity */}
      {doc.functionalCapacity && (
        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.label}>Functional Capacity:</Text>
            <Text style={styles.value}>{doc.functionalCapacity}</Text>
          </View>
        </View>
      )}

      {/* Clinical Scores */}
      {Object.keys(clinicalScores).length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Clinical Scores</Text>
          {Object.entries(clinicalScores).map(([scoreName, scoreData], idx) => (
            <View key={idx}>
              <Text style={styles.subsectionTitle}>{scoreName}:</Text>
              {typeof scoreData === 'object' ? (
                <>
                  {scoreData.score !== undefined && (
                    <Text style={styles.listItem}>
                      • Score: {scoreData.score}{scoreData.denominator && `/${scoreData.denominator}`}
                    </Text>
                  )}
                  {scoreData.interpretation && (
                    <Text style={styles.listItem}>• {scoreData.interpretation}</Text>
                  )}
                  {scoreData.components && scoreData.components.length > 0 && (
                    scoreData.components.map((comp, compIdx) => (
                      <Text key={compIdx} style={styles.nestedItem}>- {comp}</Text>
                    ))
                  )}
                  {Object.entries(scoreData).map(([key, value], subIdx) => {
                    if (['score', 'denominator', 'interpretation', 'components'].includes(key)) return null;
                    return (
                      <Text key={subIdx} style={styles.listItem}>
                        • {key.replace(/([A-Z])/g, ' $1')}: {formatValue(value)}
                      </Text>
                    );
                  })}
                </>
              ) : (
                <Text style={styles.paragraph}>{formatValue(scoreData)}</Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Pulmonary Function Tests */}
      {doc.pulmonaryFunctionTests && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pulmonary Function Tests</Text>
          {doc.pulmonaryFunctionTests.preBronchodilator && (
            <>
              {doc.pulmonaryFunctionTests.preBronchodilator.fev1 && (
                <Text style={styles.listItem}>• FEV1: {formatValue(doc.pulmonaryFunctionTests.preBronchodilator.fev1.value)}</Text>
              )}
              {doc.pulmonaryFunctionTests.preBronchodilator.fvc && (
                <Text style={styles.listItem}>• FVC: {formatValue(doc.pulmonaryFunctionTests.preBronchodilator.fvc.value)}</Text>
              )}
              {doc.pulmonaryFunctionTests.preBronchodilator.fev1FvcRatio && (
                <Text style={styles.listItem}>• FEV1/FVC Ratio: {doc.pulmonaryFunctionTests.preBronchodilator.fev1FvcRatio}</Text>
              )}
            </>
          )}
          {doc.pulmonaryFunctionTests.interpretation && (
            <Text style={styles.paragraph}>{doc.pulmonaryFunctionTests.interpretation}</Text>
          )}
        </View>
      )}

      {/* Sleep Study */}
      {doc.sleepStudy && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sleep Study</Text>
          {doc.sleepStudy.studyDate && (
            <View style={styles.row}>
              <Text style={styles.label}>Study Date:</Text>
              <Text style={styles.value}>{doc.sleepStudy.studyDate}</Text>
            </View>
          )}
          {doc.sleepStudy.ahi && (
            <View style={styles.row}>
              <Text style={styles.label}>AHI:</Text>
              <Text style={styles.value}>{doc.sleepStudy.ahi}</Text>
            </View>
          )}
          {doc.sleepStudy.lowestO2 && (
            <View style={styles.row}>
              <Text style={styles.label}>Lowest O2:</Text>
              <Text style={styles.value}>{doc.sleepStudy.lowestO2}</Text>
            </View>
          )}
          {doc.sleepStudy.cpapTitration && (
            <>
              {doc.sleepStudy.cpapTitration.optimalPressure && (
                <View style={styles.row}>
                  <Text style={styles.label}>CPAP Pressure:</Text>
                  <Text style={styles.value}>{doc.sleepStudy.cpapTitration.optimalPressure}</Text>
                </View>
              )}
              {doc.sleepStudy.cpapTitration.compliance && (
                <View style={styles.row}>
                  <Text style={styles.label}>Compliance:</Text>
                  <Text style={styles.value}>{doc.sleepStudy.cpapTitration.compliance}</Text>
                </View>
              )}
            </>
          )}
        </View>
      )}

      {/* ASA Classification */}
      {anesthesiaAssessment.asaClassification && (
        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.label}>ASA Classification:</Text>
            <Text style={styles.value}>{anesthesiaAssessment.asaClassification}</Text>
          </View>
        </View>
      )}

      {/* Airway Assessment */}
      {Object.keys(airwayAssessment).length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Airway Assessment</Text>
          {Object.entries(airwayAssessment).map(([key, value], idx) => (
            <View key={idx} style={styles.row}>
              <Text style={styles.label}>{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:</Text>
              <Text style={styles.value}>{formatValue(value)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Anesthesia Plan */}
      {Object.keys(anesthesiaPlan).length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Anesthesia Plan</Text>
          {anesthesiaPlan.technique && (
            <View style={styles.row}>
              <Text style={styles.label}>Technique:</Text>
              <Text style={styles.value}>{anesthesiaPlan.technique}</Text>
            </View>
          )}
          {anesthesiaPlan.rationale && (
            <View style={styles.row}>
              <Text style={styles.label}>Rationale:</Text>
              <Text style={styles.value}>{anesthesiaPlan.rationale}</Text>
            </View>
          )}
          {anesthesiaPlan.riskAssessment && (
            <View style={styles.row}>
              <Text style={styles.label}>Risk Assessment:</Text>
              <Text style={styles.value}>{anesthesiaPlan.riskAssessment}</Text>
            </View>
          )}
          {anesthesiaPlan.primaryAnesthetic && (
            <View style={styles.row}>
              <Text style={styles.label}>Primary Anesthetic:</Text>
              <Text style={styles.value}>{anesthesiaPlan.primaryAnesthetic}</Text>
            </View>
          )}
          {anesthesiaPlan.backupPlan && (
            <View style={styles.row}>
              <Text style={styles.label}>Backup Plan:</Text>
              <Text style={styles.value}>{anesthesiaPlan.backupPlan}</Text>
            </View>
          )}
          {anesthesiaPlan.specialConsiderations && (
            <View style={styles.row}>
              <Text style={styles.label}>Special Considerations:</Text>
              <Text style={styles.value}>{anesthesiaPlan.specialConsiderations}</Text>
            </View>
          )}
          {anesthesiaPlan.adjunctMedications && Array.isArray(anesthesiaPlan.adjunctMedications) && (
            <>
              <Text style={styles.subsectionTitle}>Adjunct Medications:</Text>
              {anesthesiaPlan.adjunctMedications.map((med, idx) => (
                <Text key={idx} style={styles.listItem}>• {med}</Text>
              ))}
            </>
          )}
        </View>
      )}

      {/* Pain Management Assessment */}
      {Object.keys(painManagementAssessment).length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Pain Assessment</Text>
          {painManagementAssessment.currentPainScore !== undefined && (
            <View style={styles.row}>
              <Text style={styles.label}>Pain Score:</Text>
              <Text style={styles.value}>{painManagementAssessment.currentPainScore}/10</Text>
            </View>
          )}
          {painManagementAssessment.currentAnalgesics && painManagementAssessment.currentAnalgesics.length > 0 && (
            <>
              <Text style={styles.subsectionTitle}>Current Analgesics:</Text>
              {painManagementAssessment.currentAnalgesics.map((med, idx) => (
                <Text key={idx} style={styles.listItem}>
                  • {med.medication} {med.mme && `(${med.mme})`}
                </Text>
              ))}
            </>
          )}
        </View>
      )}

      {/* Pain Management Plan */}
      {Object.keys(painManagement).length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pain Management Plan</Text>
          {painManagement.opioidManagement && (
            <Text style={styles.paragraph}>{painManagement.opioidManagement}</Text>
          )}
          {painManagement.regionalBlocks && painManagement.regionalBlocks.length > 0 && (
            <>
              <Text style={styles.subsectionTitle}>Regional Blocks:</Text>
              {painManagement.regionalBlocks.map((block, idx) => (
                <View key={idx}>
                  <Text style={styles.listItem}>• {block.type}</Text>
                  {block.medication && (
                    <Text style={styles.nestedItem}>Medication: {block.medication}</Text>
                  )}
                  {block.rate && (
                    <Text style={styles.nestedItem}>Rate: {block.rate}</Text>
                  )}
                </View>
              ))}
            </>
          )}
          {painManagement.systemicAnalgesics && painManagement.systemicAnalgesics.length > 0 && (
            <>
              <Text style={styles.subsectionTitle}>Systemic Analgesics:</Text>
              {painManagement.systemicAnalgesics.map((med, idx) => (
                <Text key={idx} style={styles.listItem}>• {med}</Text>
              ))}
            </>
          )}
          {painManagement.breakthrough && (
            <View style={styles.row}>
              <Text style={styles.label}>Breakthrough:</Text>
              <Text style={styles.value}>{painManagement.breakthrough}</Text>
            </View>
          )}
          {painManagement.pcaDetails && (
            <View style={styles.row}>
              <Text style={styles.label}>PCA Details:</Text>
              <Text style={styles.value}>{painManagement.pcaDetails}</Text>
            </View>
          )}
          {painManagement.strategy && (
            <View style={styles.row}>
              <Text style={styles.label}>Strategy:</Text>
              <Text style={styles.value}>{painManagement.strategy}</Text>
            </View>
          )}
          {painManagement.medications && Array.isArray(painManagement.medications) && (
            <>
              <Text style={styles.subsectionTitle}>Medications:</Text>
              {painManagement.medications.map((med, idx) => (
                <Text key={idx} style={styles.listItem}>• {med}</Text>
              ))}
            </>
          )}
        </View>
      )}

      {/* Operative Details */}
      {Object.keys(operativeDetails).length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Operative Details</Text>
          {operativeDetails.proceduresPerformed && operativeDetails.proceduresPerformed.length > 0 && (
            <>
              <Text style={styles.subsectionTitle}>Procedures:</Text>
              {operativeDetails.proceduresPerformed.map((proc, idx) => (
                <Text key={idx} style={styles.listItem}>• {proc}</Text>
              ))}
            </>
          )}
          {operativeDetails.surgeonName && (
            <View style={styles.row}>
              <Text style={styles.label}>Surgeon:</Text>
              <Text style={styles.value}>{operativeDetails.surgeonName}</Text>
            </View>
          )}
          {operativeDetails.scheduledTiming && (
            <View style={styles.row}>
              <Text style={styles.label}>Scheduled:</Text>
              <Text style={styles.value}>{operativeDetails.scheduledTiming}</Text>
            </View>
          )}
          {operativeDetails.urgency && (
            <View style={styles.row}>
              <Text style={styles.label}>Urgency:</Text>
              <Text style={styles.value}>{operativeDetails.urgency}</Text>
            </View>
          )}
        </View>
      )}

      {/* Blood Products */}
      {doc.bloodProductsOrdered && (
        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.label}>Blood Products Ordered:</Text>
            <Text style={styles.value}>{doc.bloodProductsOrdered}</Text>
          </View>
        </View>
      )}

      {/* Preoperative Preparation */}
      {Object.keys(preOpPrep).length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preoperative Preparation</Text>
          {preOpPrep.medicalClearance && preOpPrep.medicalClearance.length > 0 && (
            <>
              <Text style={styles.subsectionTitle}>Medical Clearance:</Text>
              {preOpPrep.medicalClearance.map((item, idx) => (
                <Text key={idx} style={styles.listItem}>• {item}</Text>
              ))}
            </>
          )}
          {preOpPrep.perioperativeMedications && preOpPrep.perioperativeMedications.length > 0 && (
            <>
              <Text style={styles.subsectionTitle}>Perioperative Medications:</Text>
              {preOpPrep.perioperativeMedications.map((med, idx) => (
                <Text key={idx} style={styles.listItem}>
                  • {med.medication} {med.dose} {med.route} - {med.timing}
                </Text>
              ))}
            </>
          )}
        </View>
      )}

      {/* Postoperative Orders */}
      {Object.keys(postOpOrders).length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Postoperative Orders</Text>
          {postOpOrders.monitoring && postOpOrders.monitoring.length > 0 && (
            <>
              <Text style={styles.subsectionTitle}>Monitoring:</Text>
              {postOpOrders.monitoring.map((item, idx) => (
                <Text key={idx} style={styles.listItem}>• {item}</Text>
              ))}
            </>
          )}
          {postOpOrders.respiratory && (
            <View style={styles.row}>
              <Text style={styles.label}>Respiratory:</Text>
              <Text style={styles.value}>{postOpOrders.respiratory}</Text>
            </View>
          )}
          {postOpOrders.pain && (
            <View style={styles.row}>
              <Text style={styles.label}>Pain:</Text>
              <Text style={styles.value}>{postOpOrders.pain}</Text>
            </View>
          )}
          {postOpOrders.dischargeSupport && (
            <View style={styles.row}>
              <Text style={styles.label}>Discharge Support:</Text>
              <Text style={styles.value}>{postOpOrders.dischargeSupport}</Text>
            </View>
          )}
        </View>
      )}

      {/* Risk Factors */}
      {riskFactors.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Risk Factors</Text>
          {riskFactors
            .sort((a, b) => {
              const severityOrder = { high: 0, moderate: 1, low: 2, protective: 3 };
              const aSeverity = (a.severity?.toLowerCase()?.trim()) || 'unknown';
              const bSeverity = (b.severity?.toLowerCase()?.trim()) || 'unknown';
              return (severityOrder[aSeverity] ?? 99) - (severityOrder[bSeverity] ?? 99);
            })
            .map((risk, idx) => (
              <Text key={idx} style={styles.listItem}>
                • [{risk.severity?.toUpperCase()}] {risk.factor}
                {risk.category && ` (${risk.category})`}
              </Text>
            ))}
        </View>
      )}

      {/* Referrals */}
      {doc.referrals && doc.referrals.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Referrals</Text>
          {doc.referrals.map((referral, idx) => (
            <Text key={idx} style={styles.listItem}>
              • {referral.specialty}: {referral.reason}
              {referral.urgency && ` (${referral.urgency})`}
            </Text>
          ))}
        </View>
      )}

      {/* Follow-up Appointments */}
      {doc.followUpAppointments && doc.followUpAppointments.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Follow-up Appointments</Text>
          {doc.followUpAppointments.map((appt, idx) => (
            <Text key={idx} style={styles.listItem}>
              • {appt.specialty}: {appt.reason}
            </Text>
          ))}
        </View>
      )}

      {/* Consultation Details */}
      {Object.keys(consultationDetails).length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Consultation</Text>
          {consultationDetails.consultingPhysician && (
            <View style={styles.row}>
              <Text style={styles.label}>Physician:</Text>
              <Text style={styles.value}>{consultationDetails.consultingPhysician}</Text>
            </View>
          )}
          {consultationDetails.consultingSpecialty && (
            <View style={styles.row}>
              <Text style={styles.label}>Specialty:</Text>
              <Text style={styles.value}>{consultationDetails.consultingSpecialty}</Text>
            </View>
          )}
          {consultationDetails.reasonForConsult && (
            <Text style={styles.paragraph}>{consultationDetails.reasonForConsult}</Text>
          )}
          {consultationDetails.physicianCredentials && (
            <Text style={styles.paragraph}>{consultationDetails.physicianCredentials}</Text>
          )}
          {consultationDetails.signatureTime && (
            <View style={styles.row}>
              <Text style={styles.label}>Signed:</Text>
              <Text style={styles.value}>{consultationDetails.signatureTime}</Text>
            </View>
          )}
        </View>
      )}

      {/* Additional Notes */}
      {doc.additionalNotes && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Notes</Text>
          <Text style={styles.paragraph}>{doc.additionalNotes}</Text>
        </View>
      )}

      {/* Special Considerations */}
      {anesthesiaAssessment.specialConsiderations && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Special Considerations</Text>
          <Text style={styles.paragraph}>{anesthesiaAssessment.specialConsiderations}</Text>
        </View>
      )}

      {/* Preoperative Assessment Summary */}
      {anesthesiaAssessment.preoperativeAssessmentSummary && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preoperative Assessment Summary</Text>
          <Text style={styles.paragraph}>{anesthesiaAssessment.preoperativeAssessmentSummary}</Text>
        </View>
      )}

      {/* Electronic Signature */}
      {administrativeData.electronicSignatureFull && (
        <View style={styles.section}>
          <Text style={styles.paragraph}>{administrativeData.electronicSignatureFull}</Text>
        </View>
      )}
    </View>
  );
};

export default AnesthesiaRecordsTemplate;
