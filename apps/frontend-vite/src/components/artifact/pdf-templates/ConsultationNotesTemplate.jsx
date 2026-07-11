import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  consultationDate: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000000',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'left',
  },
  line: {
    fontSize: 10,
    color: '#000000',
    marginBottom: 6,
    lineHeight: 1.6,
    textAlign: 'left',
  },
  textBold: {
    fontWeight: 'bold',
    color: '#000000',
  },
  indent: {
    marginLeft: 12,
  },
  section: {
    marginTop: 8,
  }
});

const ConsultationNotesTemplate = ({ document }) => {
  const doc = document;

  const formatDate = (dateString) => {
    if (!dateString) return null;
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

  return (
    <View wrap={false}>
      {/* Consultation Date */}
      <Text style={styles.consultationDate}>
        Consultation - {formatDate(doc.date) || 'Date Not Specified'}
      </Text>

      {/* Specialty */}
      {doc.specialty && (
        <Text style={styles.line}>
          <Text style={styles.textBold}>Specialty: </Text>
          {doc.specialty}
        </Text>
      )}

      {/* Provider */}
      {doc.provider && (
        <Text style={styles.line}>
          <Text style={styles.textBold}>Provider: </Text>
          {doc.provider}
        </Text>
      )}

      {/* Facility */}
      {doc.facility && (
        <Text style={styles.line}>
          <Text style={styles.textBold}>Facility: </Text>
          {doc.facility}
        </Text>
      )}

      {/* Department */}
      {doc.department && (
        <Text style={styles.line}>
          <Text style={styles.textBold}>Department: </Text>
          {doc.department}
        </Text>
      )}

      {/* Chief Complaint */}
      {doc.chiefComplaint && (
        <>
          <Text style={[styles.line, styles.section]}>
            <Text style={styles.textBold}>Chief Complaint:</Text>
          </Text>
          <Text style={[styles.line, styles.indent]}>
            {typeof doc.chiefComplaint === 'string'
              ? doc.chiefComplaint
              : doc.chiefComplaint?.complaint || doc.chiefComplaint}
          </Text>
          {typeof doc.chiefComplaint === 'object' && doc.chiefComplaint?.duration && (
            <Text style={[styles.line, styles.indent]}>
              Duration: {doc.chiefComplaint.duration}
            </Text>
          )}
        </>
      )}

      {/* History of Present Illness */}
      {doc.historyOfPresentIllness && typeof doc.historyOfPresentIllness === 'string' && doc.historyOfPresentIllness.trim() && (
        <>
          <Text style={[styles.line, styles.section]}>
            <Text style={styles.textBold}>History of Present Illness:</Text>
          </Text>
          <Text style={[styles.line, styles.indent]}>
            {doc.historyOfPresentIllness}
          </Text>
        </>
      )}

      {/* Review of Systems */}
      {doc.reviewOfSystems && typeof doc.reviewOfSystems === 'string' && doc.reviewOfSystems.trim() && (
        <>
          <Text style={[styles.line, styles.section]}>
            <Text style={styles.textBold}>Review of Systems:</Text>
          </Text>
          <Text style={[styles.line, styles.indent]}>
            {doc.reviewOfSystems}
          </Text>
        </>
      )}

      {/* Physical Examination */}
      {doc.physicalExamination && typeof doc.physicalExamination === 'string' && doc.physicalExamination.trim() && (
        <>
          <Text style={[styles.line, styles.section]}>
            <Text style={styles.textBold}>Physical Examination:</Text>
          </Text>
          <Text style={[styles.line, styles.indent]}>
            {doc.physicalExamination}
          </Text>
        </>
      )}

      {/* Assessment & Plan (Combined) */}
      {doc.assessmentAndPlan && typeof doc.assessmentAndPlan === 'string' && doc.assessmentAndPlan.trim() && (
        <>
          <Text style={[styles.line, styles.section]}>
            <Text style={styles.textBold}>Assessment & Plan:</Text>
          </Text>
          <Text style={[styles.line, styles.indent]}>
            {doc.assessmentAndPlan}
          </Text>
        </>
      )}

      {/* Assessment (Separate) */}
      {doc.assessment && typeof doc.assessment === 'string' && doc.assessment.trim() && !doc.assessmentAndPlan && (
        <>
          <Text style={[styles.line, styles.section]}>
            <Text style={styles.textBold}>Assessment:</Text>
          </Text>
          <Text style={[styles.line, styles.indent]}>
            {doc.assessment}
          </Text>
        </>
      )}

      {/* Plan (Separate) */}
      {doc.plan && typeof doc.plan === 'string' && doc.plan.trim() && !doc.assessmentAndPlan && (
        <>
          <Text style={[styles.line, styles.section]}>
            <Text style={styles.textBold}>Plan:</Text>
          </Text>
          <Text style={[styles.line, styles.indent]}>
            {doc.plan}
          </Text>
        </>
      )}

      {/* Clinical Impression */}
      {doc.clinicalImpression && typeof doc.clinicalImpression === 'string' && doc.clinicalImpression.trim() && (
        <>
          <Text style={[styles.line, styles.section]}>
            <Text style={styles.textBold}>Clinical Impression:</Text>
          </Text>
          <Text style={[styles.line, styles.indent]}>
            {doc.clinicalImpression}
          </Text>
        </>
      )}

      {/* Prognosis */}
      {doc.prognosis && typeof doc.prognosis === 'string' && doc.prognosis.trim() && (
        <>
          <Text style={[styles.line, styles.section]}>
            <Text style={styles.textBold}>Prognosis:</Text>
          </Text>
          <Text style={[styles.line, styles.indent]}>
            {doc.prognosis}
          </Text>
        </>
      )}

      {/* Follow-up */}
      {doc.followUp && typeof doc.followUp === 'string' && doc.followUp.trim() && (
        <>
          <Text style={[styles.line, styles.section]}>
            <Text style={styles.textBold}>Follow-up:</Text>
          </Text>
          <Text style={[styles.line, styles.indent]}>
            {doc.followUp}
          </Text>
        </>
      )}
    </View>
  );
};

export default ConsultationNotesTemplate;
