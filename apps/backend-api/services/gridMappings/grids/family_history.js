module.exports = {
  title: '👨‍👩‍👧‍👦 Family History',
  columns: ['Relationship', 'Condition', 'Age at Onset', 'Status', 'Notes'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      const strVal = String(val).trim();
      return strVal || defaultVal;
    };

    // Handle nested structure: data might be stored with 'conditions' wrapper
    let dataArray = categoryData;

    // If data has a 'conditions' property, unwrap it
    if (categoryData.length > 0 && categoryData[0].conditions && Array.isArray(categoryData[0].conditions)) {
      dataArray = categoryData[0].conditions;
    }

    return dataArray.map(entry => {
      // Derive status from multiple possible fields
      let status = '-';
      if (entry.ageAtDeath || entry.causeOfDeath) {
        // Deceased family member
        status = `Deceased${entry.ageAtDeath ? ` (age ${entry.ageAtDeath})` : ''}`;
        if (entry.causeOfDeath) {
          status += ` - ${entry.causeOfDeath}`;
        }
      } else if (entry.status) {
        // Explicit status field (e.g., "Living", "Deceased", "Unknown")
        status = getValue(entry.status);
      } else if (entry.alive === true || entry.alive === 'true') {
        status = 'Living';
      } else if (entry.alive === false || entry.alive === 'false') {
        status = 'Deceased';
      }

      // Build notes from additional context fields
      const notes = [];
      if (entry.patientAgeAtEvent) {
        notes.push(`Patient age at event: ${entry.patientAgeAtEvent}`);
      }
      if (entry.patientEmotionalResponse) {
        notes.push(`Emotional impact: ${entry.patientEmotionalResponse}`);
      }
      const notesDisplay = notes.length > 0 ? notes.join('\n') : '-';

      // Handle age at onset - could be in multiple formats
      const ageAtOnset = getValue(
        entry.ageAtOnset ||
        entry.age ||
        entry.onsetAge ||
        entry.ageAtDiagnosis
      );

      return {
        'Relationship': getValue(
          entry.relationship ||
          entry.relation ||
          entry.familyMember ||
          entry.relative
        , 'Family Member'),
        'Condition': getValue(
          entry.condition ||
          entry.diagnosis ||
          entry.disease ||
          entry.cancerType
        ),
        'Age at Onset': ageAtOnset,
        'Status': status,
        'Notes': notesDisplay
      };
    });
  }
};
