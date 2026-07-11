import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  procedureName: {
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

const MedicalProceduresTemplate = ({ document }) => {
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

  const formatProcedureType = (type) => {
    if (!type) return 'Procedure';
    const typeMap = {
      'surgical': 'Surgical Procedure',
      'diagnostic': 'Diagnostic Procedure',
      'therapeutic': 'Therapeutic Procedure',
      'preventive': 'Preventive Procedure',
      'emergency': 'Emergency Procedure',
      'elective': 'Elective Procedure'
    };
    return typeMap[type.toLowerCase()] || type;
  };

  return (
    <View wrap={false}>
      {/* Procedure Name */}
      <Text style={styles.procedureName}>
        {doc.procedureName || 'Medical Procedure'}
      </Text>

      {/* Type */}
      <Text style={styles.line}>
        <Text style={styles.textBold}>Type: </Text>
        {formatProcedureType(doc.procedureType || doc.type)}
      </Text>

      {/* Date */}
      {(doc.procedureDate || doc.date) && (
        <Text style={styles.line}>
          <Text style={styles.textBold}>Date: </Text>
          {formatDate(doc.procedureDate || doc.date)}
        </Text>
      )}

      {/* Time */}
      {doc.time && (
        <Text style={styles.line}>
          <Text style={styles.textBold}>Time: </Text>
          {doc.time}
        </Text>
      )}

      {/* Provider/Performed By */}
      {(doc.provider || doc.performedBy || doc.surgeon) && (
        <Text style={styles.line}>
          <Text style={styles.textBold}>Performed By: </Text>
          {doc.provider || doc.performedBy || doc.surgeon}
        </Text>
      )}

      {/* Location/Facility */}
      {(doc.location || doc.facility) && (
        <Text style={styles.line}>
          <Text style={styles.textBold}>Location: </Text>
          {doc.location || doc.facility}
        </Text>
      )}

      {/* Indication */}
      {doc.indication && doc.indication.trim() && (
        <>
          <Text style={[styles.line, styles.section]}>
            <Text style={styles.textBold}>Indication:</Text>
          </Text>
          <Text style={[styles.line, styles.indent]}>
            {doc.indication}
          </Text>
        </>
      )}

      {/* Description */}
      {doc.description && doc.description.trim() && (
        <>
          <Text style={[styles.line, styles.section]}>
            <Text style={styles.textBold}>Description:</Text>
          </Text>
          <Text style={[styles.line, styles.indent]}>
            {doc.description}
          </Text>
        </>
      )}

      {/* Technique */}
      {doc.technique && doc.technique.trim() && (
        <>
          <Text style={[styles.line, styles.section]}>
            <Text style={styles.textBold}>Technique:</Text>
          </Text>
          <Text style={[styles.line, styles.indent]}>
            {doc.technique}
          </Text>
        </>
      )}

      {/* Findings */}
      {doc.findings && doc.findings.trim() && (
        <>
          <Text style={[styles.line, styles.section]}>
            <Text style={styles.textBold}>Findings:</Text>
          </Text>
          <Text style={[styles.line, styles.indent]}>
            {doc.findings}
          </Text>
        </>
      )}

      {/* Specimens */}
      {doc.specimens && doc.specimens.length > 0 && (
        <>
          <Text style={[styles.line, styles.section]}>
            <Text style={styles.textBold}>Specimens:</Text>
          </Text>
          {doc.specimens.map((specimen, idx) => (
            <Text key={idx} style={[styles.line, styles.indent]}>
              • {specimen}
            </Text>
          ))}
        </>
      )}

      {/* Implants */}
      {doc.implants && doc.implants.length > 0 && (
        <>
          <Text style={[styles.line, styles.section]}>
            <Text style={styles.textBold}>Implants:</Text>
          </Text>
          {doc.implants.map((implant, idx) => (
            <Text key={idx} style={[styles.line, styles.indent]}>
              • {implant}
            </Text>
          ))}
        </>
      )}

      {/* Complications */}
      {doc.complications && doc.complications.trim() && (
        <>
          <Text style={[styles.line, styles.section]}>
            <Text style={styles.textBold}>Complications:</Text>
          </Text>
          <Text style={[styles.line, styles.indent]}>
            {doc.complications}
          </Text>
        </>
      )}

      {/* Outcome */}
      {doc.outcome && doc.outcome.trim() && (
        <>
          <Text style={[styles.line, styles.section]}>
            <Text style={styles.textBold}>Outcome:</Text>
          </Text>
          <Text style={[styles.line, styles.indent]}>
            {doc.outcome}
          </Text>
        </>
      )}

      {/* Post-Procedure Care */}
      {doc.postProcedureCare && doc.postProcedureCare.trim() && (
        <>
          <Text style={[styles.line, styles.section]}>
            <Text style={styles.textBold}>Post-Procedure Care:</Text>
          </Text>
          <Text style={[styles.line, styles.indent]}>
            {doc.postProcedureCare}
          </Text>
        </>
      )}

      {/* Follow-up */}
      {doc.followUp && doc.followUp.trim() && (
        <>
          <Text style={[styles.line, styles.section]}>
            <Text style={styles.textBold}>Follow-up:</Text>
          </Text>
          <Text style={[styles.line, styles.indent]}>
            {doc.followUp}
          </Text>
        </>
      )}

      {/* Notes */}
      {doc.notes && doc.notes.trim() && (
        <>
          <Text style={[styles.line, styles.section]}>
            <Text style={styles.textBold}>Additional Notes:</Text>
          </Text>
          <Text style={[styles.line, styles.indent]}>
            {doc.notes}
          </Text>
        </>
      )}
    </View>
  );
};

export default MedicalProceduresTemplate;