import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 12,
    paddingBottom: 6,
    borderBottom: '2px solid #7a7a7a',
  },
  card: {
    backgroundColor: '#f9f9f9',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  noteCard: {
    backgroundColor: '#fffbeb',
    borderLeft: '4px solid #a7a7a7',
    padding: 12,
    borderRadius: 4,
    marginBottom: 10,
  },
  text: {
    fontSize: 10,
    color: '#1f2937',
    marginBottom: 4,
    lineHeight: 1.5,
  },
  textBold: {
    fontWeight: 'bold',
    color: '#000000',
  },
  badge: {
    fontSize: 9,
    fontWeight: 'bold',
    padding: '3px 8px',
    borderRadius: 4,
    backgroundColor: '#7a7a7a',
    color: '#ffffff',
    marginRight: 6,
  },
  listItem: {
    fontSize: 10,
    color: '#1f2937',
    marginBottom: 4,
    marginLeft: 12,
  },
  providerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
});

const CareCoordinationNotesTemplate = ({ document }) => {
  const doc = document;

  return (
    <View>
      {/* Coordination Summary */}
      {doc.summary && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📋 Coordination Summary</Text>
          <View style={styles.noteCard}>
            <Text style={styles.text}>{doc.summary}</Text>
          </View>
        </View>
      )}

      {/* Involved Providers */}
      {doc.involvedProviders && doc.involvedProviders.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👥 Involved Providers</Text>
          <View style={styles.card}>
            {doc.involvedProviders.map((provider, index) => (
              <View key={index} style={styles.providerRow}>
                {typeof provider === 'string' ? (
                  <Text style={styles.text}>• {provider}</Text>
                ) : (
                  <>
                    <Text style={styles.text}>
                      <Text style={styles.textBold}>{provider.name}</Text>
                      {provider.specialty && ` - ${provider.specialty}`}
                    </Text>
                    {provider.role && (
                      <Text style={[styles.badge, { backgroundColor: '#757575' }]}>
                        {provider.role}
                      </Text>
                    )}
                  </>
                )}
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Communication Details */}
      {doc.communicationDetails && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💬 Communication Details</Text>
          <View style={styles.card}>
            <Text style={styles.text}>{doc.communicationDetails}</Text>
          </View>
        </View>
      )}

      {/* Action Items */}
      {doc.actionItems && doc.actionItems.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>✓ Action Items</Text>
          <View style={styles.card}>
            {doc.actionItems.map((item, index) => (
              <View key={index} style={{ marginBottom: 8 }}>
                {typeof item === 'string' ? (
                  <Text style={styles.listItem}>• {item}</Text>
                ) : (
                  <>
                    <Text style={styles.listItem}>
                      • <Text style={styles.textBold}>{item.action}</Text>
                    </Text>
                    {item.assignedTo && (
                      <Text style={[styles.text, { marginLeft: 24, fontSize: 9, color: '#6b7280' }]}>
                        Assigned to: {item.assignedTo}
                      </Text>
                    )}
                    {item.dueDate && (
                      <Text style={[styles.text, { marginLeft: 24, fontSize: 9, color: '#6b7280' }]}>
                        Due: {new Date(item.dueDate).toLocaleDateString()}
                      </Text>
                    )}
                  </>
                )}
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Follow-up Plan */}
      {doc.followUpPlan && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📅 Follow-up Plan</Text>
          <View style={styles.card}>
            <Text style={styles.text}>{doc.followUpPlan}</Text>
          </View>
        </View>
      )}

      {/* Barriers to Care */}
      {doc.barriersTocare && doc.barriersTocare.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚠️ Barriers to Care</Text>
          <View style={styles.card}>
            {doc.barriersTocare.map((barrier, index) => (
              <Text key={index} style={styles.listItem}>• {barrier}</Text>
            ))}
          </View>
        </View>
      )}

      {/* Coordination Status */}
      {doc.status && (
        <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.textBold}>Status: </Text>
          <Text style={[styles.badge, {
            backgroundColor: doc.status.toLowerCase() === 'completed' ? '#808080' :
                           doc.status.toLowerCase() === 'in progress' ? '#a7a7a7' : '#6b7280'
          }]}>
            {doc.status}
          </Text>
        </View>
      )}

      {/* Date */}
      {doc.date && (
        <View style={{ marginTop: 12 }}>
          <Text style={styles.badge}>
            📅 {new Date(doc.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </Text>
        </View>
      )}
    </View>
  );
};

export default CareCoordinationNotesTemplate;
