module.exports = {
  title: '⚡ Epilepsy Assessment',
  columns: ['Date', 'Seizure Type', 'Frequency', 'Medications', 'Neurologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Seizure Type': getValue(entry.seizureType || entry.type),
      Frequency: getValue(entry.frequency || entry.seizureFrequency),
      Medications: getValue(entry.medications || entry.antiepileptics),
      Neurologist: getValue(entry.neurologist || entry.provider)
    }));
  }
};
