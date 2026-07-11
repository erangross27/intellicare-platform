import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000000',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'left',
  },
  subsectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#000000',
    marginTop: 8,
    marginBottom: 6,
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

const PhysicalExaminationsTemplate = ({ document }) => {
  const doc = document;

  const systems = [
    { key: 'general', title: 'General' },
    { key: 'heent', title: 'HEENT (Head, Eyes, Ears, Nose, Throat)' },
    { key: 'respiratory', title: 'Respiratory' },
    { key: 'cardiovascular', title: 'Cardiovascular' },
    { key: 'gastrointestinal', title: 'Gastrointestinal' },
    { key: 'skin', title: 'Skin' },
    { key: 'neurological', title: 'Neurological' },
    { key: 'musculoskeletal', title: 'Musculoskeletal' },
  ];

  return (
    <View>
      {systems.map((system, systemIndex) => {
        const data = doc[system.key];
        if (!data) return null;

        // Handle string data (like general)
        if (typeof data === 'string') {
          return (
            <View key={system.key} style={{ marginBottom: 12, marginTop: systemIndex === 0 ? 0 : 8 }} wrap={false}>
              <Text style={styles.sectionTitle}>{system.title}</Text>
              <Text style={styles.line}>{data}</Text>
            </View>
          );
        }

        // Handle object data (like heent, respiratory, etc.)
        const hasData = Object.values(data).some(val => val && val.trim && val.trim());
        if (!hasData) return null;

        return (
          <View key={system.key} style={{ marginTop: systemIndex === 0 ? 0 : 16 }}>
            <Text style={styles.sectionTitle}>{system.title}</Text>
            {Object.entries(data).map(([key, value]) => {
              if (!value || (typeof value === 'string' && !value.trim())) return null;

              return (
                <Text key={key} style={styles.line}>
                  <Text style={styles.textBold}>
                    {key.replace(/([A-Z])/g, ' $1').trim()}:{' '}
                  </Text>
                  {value}
                </Text>
              );
            })}
          </View>
        );
      })}
    </View>
  );
};

export default PhysicalExaminationsTemplate;
