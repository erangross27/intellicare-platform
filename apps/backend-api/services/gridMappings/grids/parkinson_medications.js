module.exports = {
  title: '💊 Parkinson Medications',
  columns: ['Medication', 'Dose', 'Frequency', 'Response', 'Neurologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Medication: getValue(entry.medication || entry.drug),
      Dose: getValue(entry.dose || entry.dosage),
      Frequency: getValue(entry.frequency || entry.schedule),
      Response: getValue(entry.response || entry.efficacy),
      Neurologist: getValue(entry.neurologist || entry.provider)
    }));
  }
};
