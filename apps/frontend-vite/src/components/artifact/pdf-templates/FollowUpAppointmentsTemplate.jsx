import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  appointmentTitle: {
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
});

const FollowUpAppointmentsTemplate = ({ document }) => {
  const apt = document; // Each appointment is passed as a separate document

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

  const getStatusText = (status, isScheduled) => {
    if (isScheduled) return 'Scheduled';
    if (status === 'urgent') return 'Urgent';
    if (status === 'recommended') return 'Recommended';
    return 'Pending';
  };

  return (
    <View wrap={false}>
      {/* Appointment Specialty */}
      <Text style={styles.appointmentTitle}>
        {apt.specialty || 'General Follow-Up'}
      </Text>

      {/* Status */}
      <Text style={styles.line}>
        <Text style={styles.textBold}>Status: </Text>
        {getStatusText(apt.status, apt.isScheduled)}
      </Text>

      {/* Timing */}
      {apt.timing && (
        <Text style={styles.line}>
          <Text style={styles.textBold}>Recommended Timing: </Text>
          {apt.timing}
        </Text>
      )}

      {/* Scheduled Date (if scheduled) */}
      {apt.isScheduled && apt.scheduledDate && (
        <Text style={styles.line}>
          <Text style={styles.textBold}>Scheduled Date: </Text>
          {formatDate(apt.scheduledDate)}
        </Text>
      )}

      {/* Provider */}
      {apt.provider && (
        <Text style={styles.line}>
          <Text style={styles.textBold}>Provider: </Text>
          {apt.provider}
        </Text>
      )}

      {/* Reason */}
      {apt.reason && (
        <>
          <Text style={[styles.line, { marginTop: 8 }]}>
            <Text style={styles.textBold}>Reason for Follow-Up:</Text>
          </Text>
          <Text style={[styles.line, styles.indent]}>
            {apt.reason}
          </Text>
        </>
      )}

      {/* Action needed if not scheduled */}
      {!apt.isScheduled && (
        <Text style={[styles.line, { marginTop: 8, fontWeight: 'bold' }]}>
          Action Required: Please schedule this appointment
        </Text>
      )}
    </View>
  );
};

export default FollowUpAppointmentsTemplate;
