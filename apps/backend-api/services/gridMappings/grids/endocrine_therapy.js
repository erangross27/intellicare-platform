module.exports = {
  title: '💊 Endocrine Therapy',
  columns: ['Date', 'Medication', 'Dose', 'Side Effects', 'Duration'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Medication: getValue(entry.medication || entry.agent),
      Dose: getValue(entry.dose || entry.dosage),
      'Side Effects': getValue(entry.sideEffects || entry.adverseEvents, 'None'),
      Duration: getValue(entry.duration || entry.plannedDuration)
    }));
  }
};
